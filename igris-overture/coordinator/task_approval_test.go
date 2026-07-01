package coordinator

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// approvalTaskDefinition is a minimal task with no derived capabilities, so
// dispatch does not attempt to build a signed permission envelope (which would
// require a signing key). It is enough to prove the approve→dispatch handoff.
const approvalTaskDefinition = `{"type":"single_inference","prompt":"hello","model":"local"}`

func approvalRequiredTaskRow(taskID uuid.UUID, tenantID string, status TaskRecordStatus) [][]driver.Value {
	return [][]driver.Value{taskRecordRowForRecoveryTest(
		taskID,
		tenantID,
		status,
		"",                             // runtime_id (not yet dispatched)
		"",                             // runtime_endpoint
		json.RawMessage(approvalTaskDefinition),
		nil,                            // checkpoint
		"idem-"+taskID.String(),
		time.Unix(1_900_500_000, 0).UTC(),
	)}
}

func taskRecordColumns() []string {
	return []string{
		"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
		"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
		"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
		"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
		"idempotency_key", "failure_reason", "failure_details",
		"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
	}
}

func TestTaskAwaitingApproval(t *testing.T) {
	t.Parallel()
	require.True(t, TaskAwaitingApproval(TaskStatusApprovalRequired))
	for _, s := range []TaskRecordStatus{
		TaskStatusPending, TaskStatusDispatched, TaskStatusCheckpointed,
		TaskStatusCompleted, TaskStatusFailed, TaskStatusRecovering, TaskStatusCanceled,
	} {
		require.Falsef(t, TaskAwaitingApproval(s), "status %s must not be awaiting approval", s)
	}
}

// TestApproveTaskDispatchesApprovalRequiredTaskThroughRuntime proves the full
// gate: an approval_required durable task is approved, the task_records CAS wins,
// and the task is dispatched to the runtime through the coordinator path.
func TestApproveTaskDispatchesApprovalRequiredTaskThroughRuntime(t *testing.T) {
	taskID := uuid.New()
	tenantID := "tenant-approve"

	dispatched := make(chan map[string]any, 1)
	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		require.Equal(t, "/v1/runtime/task/submit", r.URL.Path)
		body, _ := io.ReadAll(r.Body)
		var parsed map[string]any
		_ = json.Unmarshal(body, &parsed)
		dispatched <- parsed
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{}`)),
		}, nil
	})}

	db, queued := newQueuedCheckpointDB(t, []queuedQueryExpectation{
		{columns: taskRecordColumns(), rows: approvalRequiredTaskRow(taskID, tenantID, TaskStatusApprovalRequired)},
		{columns: []string{"runtime_id", "endpoint"}, rows: [][]driver.Value{{"runtime-approve", "https://runtime.approve.test"}}},
	}, queuedExecExpectation{
		rowsAffected: 1,
		check: func(query string, _ []driver.NamedValue) {
			require.Contains(t, query, "UPDATE task_records")
			require.Contains(t, query, "status = $7") // pinned to approval_required
		},
	})
	tc := &TaskCoordinator{db: db, store: NewCheckpointStore(db), httpClient: client}

	task, err := tc.ApproveTask(context.Background(), taskID, tenantID, "approver-1")
	require.NoError(t, err)
	require.Equal(t, TaskStatusDispatched, task.Status)
	require.NotNil(t, task.RuntimeID)
	require.Equal(t, "runtime-approve", *task.RuntimeID)

	select {
	case body := <-dispatched:
		require.Equal(t, taskID.String(), body["task_id"])
		require.Equal(t, tenantID, body["tenant_id"])
	case <-time.After(2 * time.Second):
		t.Fatal("approved task was not dispatched to the runtime")
	}
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

// TestApproveTaskDoubleApproveDispatchesOnce proves the compare-and-set prevents
// a second (racing) approval from dispatching the same run twice: the second
// approve's task_records transition affects zero rows and is rejected.
func TestApproveTaskDoubleApproveDispatchesOnce(t *testing.T) {
	taskID := uuid.New()
	tenantID := "tenant-double"

	var dispatchCount int
	dispatched := make(chan struct{}, 4)
	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		dispatchCount++
		dispatched <- struct{}{}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{}`)),
		}, nil
	})}

	db, queued := newQueuedCheckpointDB(t, []queuedQueryExpectation{
		// First approve: reads approval_required, selects a runtime.
		{columns: taskRecordColumns(), rows: approvalRequiredTaskRow(taskID, tenantID, TaskStatusApprovalRequired)},
		{columns: []string{"runtime_id", "endpoint"}, rows: [][]driver.Value{{"runtime-1", "https://runtime.one.test"}}},
		// Second approve: even a stale read of approval_required still loses the CAS.
		{columns: taskRecordColumns(), rows: approvalRequiredTaskRow(taskID, tenantID, TaskStatusApprovalRequired)},
		{columns: []string{"runtime_id", "endpoint"}, rows: [][]driver.Value{{"runtime-2", "https://runtime.two.test"}}},
	},
		queuedExecExpectation{rowsAffected: 1}, // first approve wins
		queuedExecExpectation{rowsAffected: 0}, // second approve loses the CAS
	)
	tc := &TaskCoordinator{db: db, store: NewCheckpointStore(db), httpClient: client}

	_, err1 := tc.ApproveTask(context.Background(), taskID, tenantID, "approver-1")
	require.NoError(t, err1)

	// Wait for the single dispatch from the winning approval.
	select {
	case <-dispatched:
	case <-time.After(2 * time.Second):
		t.Fatal("winning approval did not dispatch")
	}

	_, err2 := tc.ApproveTask(context.Background(), taskID, tenantID, "approver-2")
	require.ErrorIs(t, err2, ErrTaskNotAwaitingApproval)

	// Give any (incorrect) second dispatch a chance to fire, then assert none did.
	select {
	case <-dispatched:
		t.Fatal("second approval must not dispatch the task a second time")
	case <-time.After(200 * time.Millisecond):
	}
	require.Equal(t, 1, dispatchCount)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

// TestRejectTaskMarksFailedAndNeverDispatches proves rejection is terminal and
// never reaches the runtime.
func TestRejectTaskMarksFailedAndNeverDispatches(t *testing.T) {
	taskID := uuid.New()
	tenantID := "tenant-reject"

	client := &http.Client{Transport: roundTripperFunc(func(*http.Request) (*http.Response, error) {
		t.Fatal("a rejected task must never be dispatched to a runtime")
		return nil, nil
	})}

	db, queued := newQueuedCheckpointDB(t, []queuedQueryExpectation{
		{columns: taskRecordColumns(), rows: approvalRequiredTaskRow(taskID, tenantID, TaskStatusApprovalRequired)},
	}, queuedExecExpectation{
		rowsAffected: 1,
		check: func(query string, _ []driver.NamedValue) {
			require.Contains(t, query, "UPDATE task_records")
			require.Contains(t, query, "status = $6") // pinned to approval_required
		},
	})
	tc := &TaskCoordinator{db: db, store: NewCheckpointStore(db), httpClient: client}

	task, err := tc.RejectTask(context.Background(), taskID, tenantID, "rejector-1", "not allowed by policy")
	require.NoError(t, err)
	require.Equal(t, TaskStatusFailed, task.Status)
	require.NotNil(t, task.FailureReason)
	require.Contains(t, *task.FailureReason, "rejected by approver")
	require.Contains(t, *task.FailureReason, "not allowed by policy")

	// Allow any erroneous async dispatch to surface.
	time.Sleep(150 * time.Millisecond)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestApproveTaskRejectsNonApprovalState(t *testing.T) {
	taskID := uuid.New()
	tenantID := "tenant-state"

	db, queued := newQueuedCheckpointDB(t, []queuedQueryExpectation{
		{columns: taskRecordColumns(), rows: approvalRequiredTaskRow(taskID, tenantID, TaskStatusDispatched)},
	})
	tc := &TaskCoordinator{db: db, store: NewCheckpointStore(db)}

	_, err := tc.ApproveTask(context.Background(), taskID, tenantID, "approver-1")
	require.ErrorIs(t, err, ErrTaskNotAwaitingApproval)
	// No runtime selection or CAS should have run for a non-approval task.
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestApproveTaskNotFoundIsTenantScoped(t *testing.T) {
	taskID := uuid.New()

	db, queued := newQueuedCheckpointDB(t, []queuedQueryExpectation{
		{columns: taskRecordColumns()}, // no rows → tenant-scoped GetTask returns ErrNoRows
	})
	tc := &TaskCoordinator{db: db, store: NewCheckpointStore(db)}

	_, err := tc.ApproveTask(context.Background(), taskID, "tenant-other", "approver-1")
	require.ErrorIs(t, err, sql.ErrNoRows)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}
