package coordinator

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"
)

// Approval-loop errors. These are mapped to HTTP status codes by the action
// gateway route handlers.
var (
	// ErrTaskNotAwaitingApproval is returned when an approve/reject is attempted
	// on a task that is not currently in approval_required. It also covers the
	// lost side of a double-approval race (the compare-and-set found no row to
	// transition), so a second concurrent approve can never dispatch twice.
	ErrTaskNotAwaitingApproval = errors.New("task is not awaiting approval")

	// ErrNoRuntimeForApproval is returned when an approval cannot be dispatched
	// because no healthy runtime is available. The task is left in
	// approval_required so it can be approved again once a runtime reconnects.
	ErrNoRuntimeForApproval = errors.New("no runtime available to dispatch approved task")
)

// TaskFailureReasonApprovalRejected is the terminal failure_reason recorded when
// a human reviewer rejects an approval-required task. The task moves to the
// terminal `failed` state (there is no dedicated `rejected` task status), and the
// human decision is separately recorded as `rejected` on the approval_requests
// audit row.
const TaskFailureReasonApprovalRejected = "action run rejected by approver"

// TaskAwaitingApproval reports whether a task is currently paused on a human
// approval gate. It is the single precondition for approve/reject.
func TaskAwaitingApproval(status TaskRecordStatus) bool {
	return status == TaskStatusApprovalRequired
}

// ApproveTask records a human approval for an approval_required durable task and
// dispatches it through the existing coordinator/runtime path.
//
// Ownership is enforced by tenant-scoped load. The task must currently be
// awaiting approval. The approval_required→dispatched transition is an atomic
// compare-and-set in the store, so a second concurrent (or repeated) approval
// finds no row to transition and returns ErrTaskNotAwaitingApproval instead of
// dispatching a second time. Encrypted input refs are rehydrated only for
// dispatch, exactly as on the recovery path — raw sensitive inputs are never
// re-persisted.
func (tc *TaskCoordinator) ApproveTask(ctx context.Context, taskID uuid.UUID, tenantID, approvedBy string) (*TaskRecord, error) {
	if tc.store == nil && tc.db != nil {
		tc.store = NewCheckpointStore(tc.db)
	}
	task, err := tc.store.GetTask(taskID, tenantID)
	if err != nil {
		return nil, err // sql.ErrNoRows → 404 (also covers wrong-tenant)
	}
	if !TaskAwaitingApproval(task.Status) {
		return nil, ErrTaskNotAwaitingApproval
	}

	// Pick a runtime before claiming the task. If none is available we leave the
	// task in approval_required so it can be approved again later.
	runtime, err := tc.selectRuntime(ctx, tenantID, "")
	if err != nil {
		return nil, ErrNoRuntimeForApproval
	}

	// Atomic claim. Only the first approver transitions the task; a racing or
	// repeated approve gets ErrTaskTransitionRejected and never dispatches.
	if err := tc.store.MarkApprovedDispatched(taskID, tenantID, runtime.RuntimeID, runtime.Endpoint, approvedBy); err != nil {
		if errors.Is(err, ErrTaskTransitionRejected) {
			return nil, ErrTaskNotAwaitingApproval
		}
		return nil, err
	}
	// Best-effort auditable approval event: who approved, when. Never blocks
	// dispatch — the task_records transition above is the source of truth.
	_ = tc.store.ResolveApprovalRequest(taskID, tenantID, "approved", approvedBy, "")

	rid := runtime.RuntimeID
	endpoint := runtime.Endpoint
	task.Status = TaskStatusDispatched
	task.RuntimeID = &rid
	task.RuntimeEndpoint = &endpoint
	// Rebuild the permission envelope at dispatch bound to the selected runtime.
	task.PermissionEnvelope = nil

	rehydrated, err := rehydrateTaskDefinitionInputRefs(task.TaskDefinition, task.TenantID, task.TaskID, func(refID uuid.UUID, purpose string) ([]byte, error) {
		return tc.store.DecryptExecutionInputRef(ctx, task.TenantID, task.TaskID, refID, purpose, "approved action dispatch")
	})
	if err != nil {
		safeErr := safeInputRefError(err)
		_ = tc.store.MarkFailedWithDetails(taskID, "encrypted input unavailable for approved dispatch", overtureTaskFailureDetails("approval", "encrypted_input_unavailable", safeErr.Error()))
		return nil, safeErr
	}

	runtimeTask := *task
	runtimeTask.TaskDefinition = rehydrated
	// Dispatch asynchronously so approve returns immediately, mirroring Submit.
	go tc.dispatchToRuntime(context.Background(), &runtimeTask, nil)
	return task, nil
}

// RejectTask records a human rejection for an approval_required durable task. The
// task moves to the terminal `failed` state and is never dispatched. Ownership is
// tenant-scoped and the awaiting-approval precondition is enforced by an atomic
// compare-and-set, so a rejected or already-resolved task cannot be rejected (or
// approved) into dispatch.
func (tc *TaskCoordinator) RejectTask(ctx context.Context, taskID uuid.UUID, tenantID, rejectedBy, reason string) (*TaskRecord, error) {
	if tc.store == nil && tc.db != nil {
		tc.store = NewCheckpointStore(tc.db)
	}
	task, err := tc.store.GetTask(taskID, tenantID)
	if err != nil {
		return nil, err
	}
	if !TaskAwaitingApproval(task.Status) {
		return nil, ErrTaskNotAwaitingApproval
	}

	failureReason := TaskFailureReasonApprovalRejected
	trimmed := strings.TrimSpace(reason)
	if trimmed != "" {
		failureReason = TaskFailureReasonApprovalRejected + ": " + trimmed
	}
	if err := tc.store.MarkApprovalRejected(taskID, tenantID, failureReason, overtureTaskFailureDetails("approval", "approval_rejected", failureReason)); err != nil {
		if errors.Is(err, ErrTaskTransitionRejected) {
			return nil, ErrTaskNotAwaitingApproval
		}
		return nil, err
	}
	_ = tc.store.ResolveApprovalRequest(taskID, tenantID, "rejected", rejectedBy, trimmed)

	task.Status = TaskStatusFailed
	task.FailureReason = &failureReason
	return task, nil
}
