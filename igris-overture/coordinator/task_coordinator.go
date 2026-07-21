// Package coordinator manages durable task lifecycle across runtime instances.
// It dispatches tasks to healthy runtimes, monitors heartbeats, and reassigns
// in-flight tasks when a runtime goes dark — making execution survive failures.
package coordinator

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/Igris-inertial/system/igris-overture/internal"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

const (
	// heartbeatTimeout is how long we wait before declaring a runtime dead.
	heartbeatTimeout = 90 * time.Second
	// recoveryInterval is how often we scan for failed runtimes.
	recoveryInterval = 15 * time.Second
	// checkpointInterval is how many steps between forced checkpoints.
	checkpointInterval = 5
	// minRuntimeDeadlineBudgetMs keeps an already-expired first dispatch from
	// becoming a huge absolute timestamp when Runtime expects a duration budget.
	minRuntimeDeadlineBudgetMs = int64(1)
)

var ErrInvalidTaskDefinition = errors.New("invalid task_definition")
var ErrTaskIdempotencyConflict = errors.New("idempotency key reused with a different request")

// TaskCoordinator dispatches tasks to runtimes and handles failure recovery.
type TaskCoordinator struct {
	db           *sql.DB
	store        *CheckpointStore
	httpClient   *http.Client
	recoveryHook func(context.Context, uuid.UUID, string)
}

func NewTaskCoordinator(db *sql.DB) *TaskCoordinator {
	return &TaskCoordinator{
		db:    db,
		store: NewCheckpointStore(db),
		httpClient: &http.Client{
			Timeout: 300 * time.Second, // long-running tasks
		},
	}
}

// Store returns the checkpoint store for use in route handlers.
func (tc *TaskCoordinator) Store() *CheckpointStore {
	return tc.store
}

// Submit creates a task record and dispatches to a healthy runtime.
// Returns the task_id immediately; the caller polls /v1/tasks/:id.
func (tc *TaskCoordinator) Submit(ctx context.Context, req *TaskSubmitRequest) (*TaskRecord, error) {
	normalizedDefinition, err := normalizePublicTaskDefinition(req.TaskType, req.TaskDefinition)
	if err != nil {
		return nil, err
	}
	governance := normalizeTaskGovernance(req.TenantID, req.AgentIdentity, req.RequiredCapabilities, req.CredentialRequests)
	governance.RequiredCapabilities = normalizeCapabilityList(append(
		governance.RequiredCapabilities,
		deriveRequiredCapabilitiesFromTaskDefinition(normalizedDefinition)...,
	))
	normalizedDefinition = attachTaskGovernanceToDefinition(normalizedDefinition, governance)

	taskID := uuid.New()
	if req.TaskID != uuid.Nil {
		taskID = req.TaskID // caller can supply for idempotency
	}

	idempotencyKey := req.IdempotencyKey
	if idempotencyKey == "" {
		idempotencyKey = taskID.String()
	}

	protectedDefinition, err := protectTaskDefinitionInputs(normalizedDefinition, req.TenantID, taskID)
	if err != nil {
		// Sensitive input + no usable keyring (or an encryption failure) must
		// not be mistaken for a runtime problem downstream.
		return nil, fmt.Errorf("%w: %v", ErrExecutionInputProtectionUnavailable, err)
	}
	task := &TaskRecord{
		TaskID:               taskID,
		TenantID:             req.TenantID,
		Status:               TaskStatusPending,
		TaskDefinition:       protectedDefinition.Definition,
		AgentIdentity:        governance.AgentIdentity,
		RequiredCapabilities: governance.RequiredCapabilities,
		CredentialRequests:   governance.CredentialRequests,
		IdempotencyKey:       idempotencyKey,
		DeadlineAt:           req.DeadlineAt,
		RegisteredAgentID:    req.RegisteredAgentID,
		RegisteredAgentName:  req.RegisteredAgentName,
		BoundAction:          req.BoundAction,
		CreatedAt:            time.Now(),
	}

	inserted, err := tc.store.CreateTaskWithExecutionInputRefs(ctx, task, protectedDefinition.Refs)
	if err != nil {
		return nil, fmt.Errorf("create task record: %w", err)
	}
	if !inserted {
		if req.BoundAction != nil {
			existingBound, boundErr := tc.store.GetBoundActionRunByIdempotency(ctx, req.TenantID, idempotencyKey)
			if boundErr == sql.ErrNoRows {
				return nil, ErrTaskIdempotencyConflict
			}
			if boundErr != nil {
				return nil, fmt.Errorf("lookup contract-bound idempotency: %w", boundErr)
			}
			if existingBound.RequestFingerprint != req.BoundAction.RequestFingerprint {
				return nil, ErrTaskIdempotencyConflict
			}
		}
		existing, err := tc.store.GetTaskByIdempotencyKey(req.TenantID, idempotencyKey)
		if err == nil {
			return existing, nil
		}
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("idempotency key is already in use")
		}
		return nil, fmt.Errorf("lookup idempotent task: %w", err)
	}

	runtime, err := tc.selectRuntime(ctx, req.TenantID, req.PreferredRuntimeID)
	if err != nil {
		_ = tc.store.MarkFailedWithDetails(taskID, "no healthy runtime available", overtureTaskFailureDetails("submit", "no_runtime_available", "no healthy runtime available"))
		return nil, fmt.Errorf("no healthy runtime: %w", err)
	}

	decision := evaluateActionPolicy(actionPolicyInput{
		TenantID:       task.TenantID,
		TaskID:         task.TaskID,
		RuntimeID:      runtime.RuntimeID,
		TaskDefinition: task.TaskDefinition,
		AgentIdentity:  task.AgentIdentity,
		RequiredCaps:   task.RequiredCapabilities,
	})
	if err := tc.store.SaveActionPolicyDecision(decision); err != nil {
		_ = tc.store.MarkFailedWithDetails(taskID, "action policy decision persistence failed", overtureTaskFailureDetails("submit", "policy_decision_persistence_failed", err.Error()))
		return nil, fmt.Errorf("persist action policy decision: %w", err)
	}
	_ = tc.store.SetLatestPolicyDecision(taskID, decision)
	_ = tc.store.SaveExecutionBoundary(decision, task.TaskDefinition, task.RequiredCapabilities)
	switch decision.Decision {
	case ActionDecisionDenied:
		_ = tc.store.MarkFailedWithDetails(taskID, decision.PolicyReason, overtureTaskFailureDetails("submit", "action_policy_denied", decision.PolicyReason))
		return nil, fmt.Errorf("%w: %s", ErrTaskCapabilityDenied, decision.PolicyReason)
	case ActionDecisionApprovalRequired:
		_ = tc.store.SaveApprovalRequest(decision)
		if err := tc.store.MarkApprovalRequired(taskID, decision.PolicyReason); err != nil {
			return nil, fmt.Errorf("mark approval required: %w", err)
		}
		task.Status = TaskStatusApprovalRequired
		task.RuntimeID = &runtime.RuntimeID
		return task, nil
	}

	if err := tc.store.MarkDispatched(taskID, runtime.RuntimeID, runtime.Endpoint); err != nil {
		return nil, fmt.Errorf("mark dispatched: %w", err)
	}
	task.Status = TaskStatusDispatched
	task.RuntimeID = &runtime.RuntimeID
	task.RuntimeEndpoint = &runtime.Endpoint
	runtimeTask := *task
	runtimeTask.TaskDefinition = normalizedDefinition
	envelope, err := tc.buildTaskPermissionEnvelope(ctx, task, governance)
	if err != nil {
		_ = tc.store.MarkFailedWithDetails(taskID, "task capability policy denied", overtureTaskFailureDetails("submit", "capability_policy_denied", err.Error()))
		return nil, err
	}
	task.PermissionEnvelope = envelope
	runtimeTask.PermissionEnvelope = envelope
	if err := tc.store.SaveTaskPermissionEnvelope(task.TaskID, envelope); err != nil {
		_ = tc.store.MarkFailedWithDetails(taskID, "task permission audit persistence failed", overtureTaskFailureDetails("submit", "permission_audit_persistence_failed", err.Error()))
		return nil, fmt.Errorf("persist task permission envelope: %w", err)
	}

	// Dispatch asynchronously so Submit returns immediately.
	go tc.dispatchToRuntime(context.Background(), &runtimeTask, nil)

	return task, nil
}

// SubmitDemoSimulatedFailure creates a durable task record and marks it failed
// without dispatching to a runtime. Used by mock_demo starter-pack actions
// that demonstrate failure visibility (demo.fail_once).
func (tc *TaskCoordinator) SubmitDemoSimulatedFailure(ctx context.Context, req *TaskSubmitRequest, failureReason string) (*TaskRecord, error) {
	normalizedDefinition, err := normalizePublicTaskDefinition(req.TaskType, req.TaskDefinition)
	if err != nil {
		return nil, err
	}
	governance := normalizeTaskGovernance(req.TenantID, req.AgentIdentity, req.RequiredCapabilities, req.CredentialRequests)
	governance.RequiredCapabilities = normalizeCapabilityList(append(
		governance.RequiredCapabilities,
		deriveRequiredCapabilitiesFromTaskDefinition(normalizedDefinition)...,
	))
	normalizedDefinition = attachTaskGovernanceToDefinition(normalizedDefinition, governance)

	taskID := uuid.New()
	if req.TaskID != uuid.Nil {
		taskID = req.TaskID
	}
	idempotencyKey := req.IdempotencyKey
	if idempotencyKey == "" {
		idempotencyKey = taskID.String()
	}
	protectedDefinition, err := protectTaskDefinitionInputs(normalizedDefinition, req.TenantID, taskID)
	if err != nil {
		// Sensitive input + no usable keyring (or an encryption failure) must
		// not be mistaken for a runtime problem downstream.
		return nil, fmt.Errorf("%w: %v", ErrExecutionInputProtectionUnavailable, err)
	}
	task := &TaskRecord{
		TaskID:               taskID,
		TenantID:             req.TenantID,
		Status:               TaskStatusPending,
		TaskDefinition:       protectedDefinition.Definition,
		AgentIdentity:        governance.AgentIdentity,
		RequiredCapabilities: governance.RequiredCapabilities,
		CredentialRequests:   governance.CredentialRequests,
		IdempotencyKey:       idempotencyKey,
		DeadlineAt:           req.DeadlineAt,
		RegisteredAgentID:    req.RegisteredAgentID,
		RegisteredAgentName:  req.RegisteredAgentName,
		BoundAction:          req.BoundAction,
		CreatedAt:            time.Now(),
	}
	inserted, err := tc.store.CreateTaskWithExecutionInputRefs(ctx, task, protectedDefinition.Refs)
	if err != nil {
		return nil, fmt.Errorf("create task record: %w", err)
	}
	if !inserted {
		existing, err := tc.store.GetTaskByIdempotencyKey(req.TenantID, idempotencyKey)
		if err == nil {
			return existing, nil
		}
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("idempotency key is already in use")
		}
		return nil, fmt.Errorf("lookup idempotent task: %w", err)
	}
	reason := strings.TrimSpace(failureReason)
	if reason == "" {
		reason = "demo simulated failure"
	}
	if err := tc.store.MarkFailedWithDetails(taskID, reason, overtureTaskFailureDetails("submit", "demo_simulated_failure", reason)); err != nil {
		return nil, fmt.Errorf("mark demo failure: %w", err)
	}
	task.Status = TaskStatusFailed
	task.FailureReason = &reason
	return task, nil
}

// HandleCheckpoint is called by the task route when a runtime pushes a checkpoint.
func (tc *TaskCoordinator) HandleCheckpoint(cp *CheckpointPayload) error {
	return tc.store.SaveCheckpoint(cp)
}

// HandleComplete marks a task as completed.
func (tc *TaskCoordinator) HandleComplete(taskID uuid.UUID) error {
	return tc.store.MarkCompleted(taskID)
}

// HandleFailed marks a task as failed.
func (tc *TaskCoordinator) HandleFailed(taskID uuid.UUID, reason string) error {
	return tc.store.MarkFailed(taskID, reason)
}

// HandleFailedWithDetails preserves the signed Runtime callback's structured
// failure metadata. Unknown-effect reconciliation eligibility is established
// here before the Runtime's synchronous task response can race the callback.
func (tc *TaskCoordinator) HandleFailedWithDetails(taskID uuid.UUID, reason string, details *TaskFailureDetails) error {
	return tc.store.MarkFailedWithDetails(taskID, reason, details)
}

// RecordRuntimeFailedRecoveryDecision persists the conservative recovery
// decision that follows an accepted runtime failed callback for irreversible or
// otherwise non-replayable work. It does not redispatch the task.
func (tc *TaskCoordinator) RecordRuntimeFailedRecoveryDecision(task *TaskRecord, callbackRuntimeID string) error {
	if tc == nil || tc.store == nil || task == nil {
		return nil
	}
	decision, runtimeID, allowed, reason, shouldRecord := runtimeFailedRecoveryDecision(task, callbackRuntimeID)
	if !shouldRecord {
		return nil
	}
	if err := tc.store.SaveActionPolicyDecision(decision); err != nil {
		return err
	}
	_ = tc.store.SetLatestPolicyDecision(task.TaskID, decision)
	if allowed {
		return nil
	}
	_ = tc.store.SaveRuntimeHandoffEvent(RuntimeHandoffEvent{
		TenantID:              task.TenantID,
		TaskID:                task.TaskID,
		SourceRuntimeID:       runtimeID,
		TargetRuntimeID:       runtimeID,
		CheckpointDigest:      checkpointDigest(task.LastCheckpoint),
		CheckpointPortability: decision.CheckpointPortability,
		Decision:              mapBoolDecision(false),
		Reason:                reason,
	})
	replayAllowed := false
	return tc.store.SaveRecoveryEvent(RecoveryEvent{
		TenantID:          task.TenantID,
		TaskID:            task.TaskID,
		EventType:         "automatic_replay_blocked",
		SourceRuntimeID:   runtimeID,
		TargetRuntimeID:   runtimeID,
		CheckpointDigest:  checkpointDigest(task.LastCheckpoint),
		LastCommittedStep: checkpointLastCommittedStep(task.LastCheckpoint),
		ReplayAllowed:     &replayAllowed,
		Reason:            reason,
	})
}

func runtimeFailedRecoveryDecision(task *TaskRecord, callbackRuntimeID string) (ActionPolicyDecision, string, bool, string, bool) {
	if task == nil {
		return ActionPolicyDecision{}, "", false, "", false
	}
	runtimeID := strings.TrimSpace(callbackRuntimeID)
	if runtimeID == "" && task.RuntimeID != nil {
		runtimeID = *task.RuntimeID
	}
	decision := evaluateActionPolicy(actionPolicyInput{
		TenantID:        task.TenantID,
		TaskID:          task.TaskID,
		RuntimeID:       runtimeID,
		TaskDefinition:  task.TaskDefinition,
		AgentIdentity:   task.AgentIdentity,
		RequiredCaps:    task.RequiredCapabilities,
		Checkpoint:      task.LastCheckpoint,
		RecoveryAttempt: true,
	})
	if !decision.Irreversible && decision.ReplayClass != ReplayClassNonRetryable {
		return decision, runtimeID, false, "", false
	}
	allowed, reason := RecoveryHandoffAllowed(task, task.LastCheckpoint, runtimeID, decision)
	return decision, runtimeID, allowed, reason, true
}

// HandleCancel marks a task as canceled.
func (tc *TaskCoordinator) HandleCancel(taskID uuid.UUID) error {
	return tc.store.MarkCanceled(taskID)
}

// StartRecoveryLoop runs a background goroutine that detects dead runtimes
// and reassigns their in-flight tasks. Call this from main.go after DB is ready.
func (tc *TaskCoordinator) StartRecoveryLoop(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(recoveryInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				tc.recoverFailedRuntimes(ctx)
			}
		}
	}()
}

// runtimeInfo holds the minimal info needed to dispatch a task.
type runtimeInfo struct {
	RuntimeID string
	Endpoint  string
}

// selectRuntime picks the healthiest available runtime for a tenant.
// Prefers runtimes with the lowest active task count. When preferredRuntimeID
// is non-empty the lookup is pinned to that runtime — the tenant + health
// guards still apply so cross-tenant pinning cannot succeed.
func (tc *TaskCoordinator) selectRuntime(ctx context.Context, tenantID, preferredRuntimeID string) (*runtimeInfo, error) {
	preferredRuntimeID = strings.TrimSpace(preferredRuntimeID)
	query := `
		SELECT ri.runtime_id, ri.endpoint
		FROM runtime_instances ri
		LEFT JOIN (
			SELECT runtime_id, COUNT(*) AS active_count
			FROM task_records
			WHERE status IN ('dispatched', 'checkpointed')
			GROUP BY runtime_id
		) t ON t.runtime_id = ri.runtime_id
		WHERE ri.tenant_id = $1
		  AND ri.is_healthy = true
		  AND ri.status = 'active'
		  AND ri.endpoint IS NOT NULL
		  AND BTRIM(ri.endpoint) <> ''
		  AND ri.last_heartbeat > NOW() - INTERVAL '90 seconds'`
	args := []interface{}{tenantID}
	if preferredRuntimeID != "" {
		query += ` AND ri.runtime_id = $2`
		args = append(args, preferredRuntimeID)
	}
	query += ` ORDER BY COALESCE(t.active_count, 0) ASC LIMIT 10`

	rows, err := tc.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var r runtimeInfo
		if err := rows.Scan(&r.RuntimeID, &r.Endpoint); err != nil {
			return nil, err
		}
		normalizedEndpoint, err := internal.NormalizeHTTPRuntimeEndpoint(r.Endpoint)
		if err != nil {
			log.Warn().Str("tenant_id", tenantID).Str("runtime_id", r.RuntimeID).Msg("[Coordinator] Skipping runtime with unroutable endpoint")
			continue
		}
		r.Endpoint = normalizedEndpoint
		return &r, nil
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if preferredRuntimeID != "" {
		return nil, fmt.Errorf("no routable runtime %s for tenant %s", preferredRuntimeID, tenantID)
	}
	return nil, fmt.Errorf("no routable runtime for tenant %s", tenantID)
}

func normalizeTaskRuntimeEndpoint(task *TaskRecord) (string, error) {
	if task == nil || task.RuntimeEndpoint == nil {
		return "", internal.ErrInvalidRuntimeEndpoint
	}
	return internal.NormalizeHTTPRuntimeEndpoint(*task.RuntimeEndpoint)
}

// dispatchToRuntime sends the task definition to a runtime's /v1/runtime/task/submit.
// If the runtime is unreachable, marks the task as recovering.
//
// The runtime expects TaskSubmitRequest: { task_id, task_type, containment,
// resume_from, resume_checkpoint, idempotency_key, tenant_id, deadline_ms }.
// task.TaskDefinition holds the normalized task_type object for the runtime.
//
// On recovery, checkpoint carries the full last CheckpointPayload including the
// Metadata field. resume_from is derived from checkpoint.ResumeToken so that
// the runtime can verify WAL digest continuity. resume_checkpoint is forwarded
// opaquely — behavior tree tasks use it to restore blackboard state.
func (tc *TaskCoordinator) dispatchToRuntime(ctx context.Context, task *TaskRecord, checkpoint *CheckpointPayload) {
	if tc.store == nil && tc.db != nil {
		tc.store = NewCheckpointStore(tc.db)
	}
	normalizedEndpoint, err := normalizeTaskRuntimeEndpoint(task)
	if err != nil {
		log.Error().Str("task_id", task.TaskID.String()).Msg("[Coordinator] Invalid endpoint for dispatch")
		_ = tc.store.MarkFailedWithDetails(task.TaskID, "invalid runtime endpoint", overtureTaskFailureDetails("dispatch", "invalid_runtime_endpoint", "invalid runtime endpoint"))
		return
	}

	// task.TaskDefinition stores the runtime-facing task_type object. Wrap it in
	// the runtime submit payload and inject control-plane fields.
	taskTypeBytes := json.RawMessage(task.TaskDefinition)
	if err := json.Unmarshal(taskTypeBytes, &map[string]json.RawMessage{}); err != nil {
		log.Error().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Unmarshal task definition")
		_ = tc.store.MarkFailedWithDetails(task.TaskID, "invalid task definition", overtureTaskFailureDetails("dispatch", "invalid_task_definition", "invalid task definition"))
		return
	}
	runtimePayload := map[string]json.RawMessage{
		"task_type": taskTypeBytes,
	}

	// Inject / override control-plane fields.
	taskIDBytes, _ := json.Marshal(task.TaskID)
	tenantIDBytes, _ := json.Marshal(task.TenantID)
	idempotencyBytes, _ := json.Marshal(runtimeDispatchIdempotencyKey(task, checkpoint))
	runtimePayload["task_id"] = taskIDBytes
	runtimePayload["tenant_id"] = tenantIDBytes
	runtimePayload["idempotency_key"] = idempotencyBytes
	if callbackBaseURL := strings.TrimSpace(os.Getenv("IGRIS_RUNTIME_CALLBACK_BASE_URL")); callbackBaseURL != "" {
		callbackBaseURLBytes, _ := json.Marshal(callbackBaseURL)
		runtimePayload["callback_base_url"] = callbackBaseURLBytes
		callbackHeaderName := strings.TrimSpace(os.Getenv("IGRIS_RUNTIME_CALLBACK_AUTH_HEADER_NAME"))
		callbackHeaderValue := strings.TrimSpace(os.Getenv("IGRIS_RUNTIME_CALLBACK_AUTH_HEADER_VALUE"))
		if callbackHeaderName != "" && callbackHeaderValue != "" {
			callbackAuthBytes, _ := json.Marshal(map[string]string{
				"header_name":  callbackHeaderName,
				"header_value": callbackHeaderValue,
			})
			runtimePayload["callback_auth"] = callbackAuthBytes
		}
	}

	if checkpoint != nil {
		// resume_from carries the WAL watermark for digest verification.
		resumeBytes, _ := json.Marshal(checkpoint.ResumeToken)
		runtimePayload["resume_from"] = resumeBytes
		// resume_checkpoint carries task-type-specific state (e.g. blackboard for BT).
		// Forward the whole payload so the runtime can pick out what it needs.
		cpBytes, _ := json.Marshal(checkpoint)
		runtimePayload["resume_checkpoint"] = cpBytes
	}
	if deadlineBudgetMs := runtimeDeadlineBudgetMs(task.DeadlineAt, checkpoint, time.Now()); deadlineBudgetMs != nil {
		deadlineBytes, _ := json.Marshal(*deadlineBudgetMs)
		runtimePayload["deadline_ms"] = deadlineBytes
	}
	governance := taskGovernanceForRecord(task)
	if !agentIdentityEmpty(governance.AgentIdentity) {
		identityBytes, _ := json.Marshal(governance.AgentIdentity)
		runtimePayload["agent_identity"] = identityBytes
	}
	if len(governance.RequiredCapabilities) > 0 {
		requiredBytes, _ := json.Marshal(governance.RequiredCapabilities)
		runtimePayload["required_capabilities"] = requiredBytes
		envelope := task.PermissionEnvelope
		if envelope == nil {
			var err error
			envelope, err = tc.buildTaskPermissionEnvelope(ctx, task, governance)
			if err != nil {
				log.Error().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Build task permission envelope")
				_ = tc.store.MarkFailedWithDetails(task.TaskID, "task capability policy denied", overtureTaskFailureDetails("dispatch", "capability_policy_denied", err.Error()))
				return
			}
		}
		envelopeBytes, _ := json.Marshal(envelope)
		runtimePayload["permission_envelope"] = envelopeBytes
		if err := tc.store.SaveTaskPermissionEnvelope(task.TaskID, envelope); err != nil {
			log.Error().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Persist signed task permission envelope")
			_ = tc.store.MarkFailedWithDetails(task.TaskID, "task permission audit persistence failed", overtureTaskFailureDetails("dispatch", "permission_audit_persistence_failed", err.Error()))
			return
		}
		if len(envelope.CredentialRefs) > 0 {
			credentialRefBytes, _ := json.Marshal(envelope.CredentialRefs)
			runtimePayload["credential_refs"] = credentialRefBytes
		}
	}
	if decisions := buildSignedGovernedPolicyDecisions(task, taskTypeBytes, tc.db); len(decisions) > 0 {
		if err := tc.store.SaveRoboticsPolicyDecisions(task.TaskID, decisions); err != nil {
			log.Error().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Persist signed robotics policy decisions")
			_ = tc.store.MarkFailedWithDetails(task.TaskID, "robotics policy audit persistence failed", overtureTaskFailureDetails("dispatch", "policy_audit_persistence_failed", err.Error()))
			return
		}
		decisionBytes, _ := json.Marshal(decisions)
		runtimePayload["signed_policy_decisions"] = decisionBytes
		containmentBytes, _ := json.Marshal(map[string]uint64{"max_tick_ms": 30000})
		runtimePayload["containment"] = containmentBytes
	}

	body, err := json.Marshal(runtimePayload)
	if err != nil {
		log.Error().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Marshal dispatch payload")
		_ = tc.store.MarkFailedWithDetails(task.TaskID, "internal marshal error", overtureTaskFailureDetails("dispatch", "internal_marshal_error", "internal marshal error"))
		return
	}

	url := fmt.Sprintf("%s/v1/runtime/task/submit", normalizedEndpoint)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		_ = tc.store.MarkFailedWithDetails(task.TaskID, err.Error(), overtureTaskFailureDetails("dispatch", "request_build_failed", err.Error()))
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Igris-Tenant", task.TenantID)
	if runtimeSecret := strings.TrimSpace(os.Getenv("IGRIS_RUNTIME_SECRET")); runtimeSecret != "" {
		req.Header.Set("Authorization", "Bearer "+runtimeSecret)
	}
	internal.SetDecisionSigHeader(req, body)

	resp, err := tc.httpClient.Do(req)
	if err != nil {
		log.Warn().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Runtime unreachable, marking recovering")
		tc.handleDispatchFailure(ctx, task, nil, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		log.Warn().Int("status", resp.StatusCode).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Runtime error, marking recovering")
		tc.handleDispatchFailure(ctx, task, resp, nil)
		return
	}
	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		reason, details := runtimeTaskDispatchFailure(resp.StatusCode, raw, checkpoint != nil)
		log.Warn().
			Int("status", resp.StatusCode).
			Str("task_id", task.TaskID.String()).
			Str("reason", reason).
			Msg("[Coordinator] Runtime rejected durable task submission")
		_ = tc.store.MarkFailedWithDetails(task.TaskID, reason, details)
		return
	}

	// Parse the response — runtime may include a checkpoint or final result.
	var result taskSubmitResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Warn().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Could not decode runtime response")
		return
	}

	if result.Checkpoint != nil {
		if err := tc.store.SaveCheckpoint(result.Checkpoint); err != nil {
			log.Error().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Save checkpoint")
		}
	}
	if len(result.ExecutionEnvelope) > 0 || len(result.ExecutionReceipt) > 0 {
		if err := tc.verifyExecutionArtifactsForTask(ctx, task, result.ExecutionEnvelope, result.ExecutionReceipt); err != nil {
			log.Error().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Runtime execution artifact verification failed")
			_ = tc.store.MarkFailedWithDetails(task.TaskID, fmt.Sprintf("runtime artifact verification failed: %v", err), overtureTaskFailureDetails("dispatch", "runtime_artifact_verification_failed", err.Error()))
			return
		}
		// When the runtime returned the full per-step receipt chain, verify each
		// receipt cryptographically before persisting any of them. The chain head
		// (last entry) equals result.ExecutionReceipt, already verified above.
		if len(result.StepReceipts) > 0 {
			if err := tc.verifyStepReceiptsForTask(ctx, task, result.StepReceipts); err != nil {
				log.Error().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Runtime step receipt verification failed")
				_ = tc.store.MarkFailedWithDetails(task.TaskID, fmt.Sprintf("runtime step receipt verification failed: %v", err), overtureTaskFailureDetails("dispatch", "runtime_step_receipt_verification_failed", err.Error()))
				return
			}
		}
		if err := tc.store.SaveExecutionArtifacts(task.TaskID, result.ExecutionEnvelope, result.ExecutionReceipt); err != nil {
			log.Error().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Save execution artifacts")
		} else {
			// Persist the receipt chain into execution_lineage in commit order so
			// the chain link stays verifiable for multi-step tasks. Fall back to
			// the single final receipt for runtimes that don't send step_receipts.
			// SaveExecutionLineage upserts on execution_id, so re-processing is
			// idempotent (no duplicate rows).
			receiptsToPersist := result.StepReceipts
			if len(receiptsToPersist) == 0 {
				receiptsToPersist = []json.RawMessage{result.ExecutionReceipt}
			}
			for idx, rawReceipt := range receiptsToPersist {
				lineage, err := BuildExecutionLineageRecordFromReceipt(
					rawReceipt,
					task.TenantID,
					taskRuntimeID(task),
					result.Status.Name,
					"",
				)
				if err != nil {
					log.Warn().Err(err).Int("step", idx).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Build execution lineage from task receipt")
					continue
				}
				if lineage == nil {
					continue
				}
				if err := tc.store.SaveExecutionLineage(lineage); err != nil {
					log.Warn().Err(err).Int("step", idx).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Save execution lineage from task receipt")
				}
			}
			triggerAvailable, err := tc.store.HasTaskProofSyncTrigger()
			if err != nil {
				log.Warn().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Proof trigger readiness check failed; falling back to direct sync")
			}
			if err != nil || !triggerAvailable {
				if _, syncErr := tc.store.SyncTaskProofState(task.TaskID, task.TenantID); syncErr != nil && syncErr != sql.ErrNoRows {
					log.Warn().Err(syncErr).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Initial proof sync")
				}
			}
		}
	}

	failureReason := result.FailureReason
	if failureReason == "" {
		failureReason = result.Status.Reason
	}

	switch result.Status.Name {
	case "completed":
		_ = tc.store.MarkCompleted(task.TaskID)
	case "failed":
		_ = tc.store.MarkFailedWithDetails(task.TaskID, failureReason, result.FailureDetails)
	}
}

func runtimeDeadlineBudgetMs(deadlineAt *time.Time, checkpoint *CheckpointPayload, now time.Time) *uint64 {
	if deadlineAt == nil {
		return nil
	}
	remainingMs := deadlineAt.Sub(now).Milliseconds()
	if checkpoint != nil && remainingMs <= 0 {
		return nil
	}
	if remainingMs < minRuntimeDeadlineBudgetMs {
		remainingMs = minRuntimeDeadlineBudgetMs
	}
	value := uint64(remainingMs)
	return &value
}

func runtimeDispatchIdempotencyKey(task *TaskRecord, checkpoint *CheckpointPayload) string {
	if task == nil {
		return ""
	}
	if checkpoint == nil {
		return task.IdempotencyKey
	}
	digest := strings.TrimSpace(checkpoint.ResumeToken.CheckpointDigest)
	if len(digest) > 16 {
		digest = digest[:16]
	}
	return fmt.Sprintf("%s:resume:%d:%s", task.IdempotencyKey, checkpoint.ResumeToken.LastCommittedStep, digest)
}

func taskRuntimeID(task *TaskRecord) string {
	if task == nil || task.RuntimeID == nil {
		return ""
	}
	return *task.RuntimeID
}

func (tc *TaskCoordinator) runtimePublicKeyForTask(ctx context.Context, task *TaskRecord) (string, error) {
	if task == nil || task.RuntimeID == nil || strings.TrimSpace(*task.RuntimeID) == "" {
		return "", fmt.Errorf("runtime identity missing for execution artifact verification")
	}
	var publicKeyHex string
	err := tc.db.QueryRowContext(ctx, `
		SELECT COALESCE(public_key_ed25519, '')
		FROM runtime_instances
		WHERE runtime_id = $1
		LIMIT 1
	`, *task.RuntimeID).Scan(&publicKeyHex)
	if errors.Is(err, sql.ErrNoRows) {
		return "", fmt.Errorf("runtime public key missing for runtime %s", *task.RuntimeID)
	}
	if err != nil {
		return "", fmt.Errorf("load runtime public key: %w", err)
	}
	if strings.TrimSpace(publicKeyHex) == "" {
		return "", fmt.Errorf("runtime public key missing for runtime %s", *task.RuntimeID)
	}
	return publicKeyHex, nil
}

func (tc *TaskCoordinator) verifyExecutionArtifactsForTask(ctx context.Context, task *TaskRecord, envelopeRaw, receiptRaw json.RawMessage) error {
	publicKeyHex, err := tc.runtimePublicKeyForTask(ctx, task)
	if err != nil {
		return err
	}
	return internal.VerifyExecutionArtifactsRawWithPublicKey(envelopeRaw, receiptRaw, publicKeyHex)
}

// validateReceiptChainLinks checks that a batch of per-step receipts forms a
// contiguous hash chain: every receipt has a non-empty hash, and each receipt
// after the first has previous_hash equal to the prior receipt's hash. The
// first receipt may be genesis ("") or chained off a receipt persisted by an
// earlier runtime call (e.g. on resume) — either is acceptable here; the chain
// is validated against persisted history by /proof/receipts/verify. Returns the
// chain's head hash (the last receipt's hash) on success.
func validateReceiptChainLinks(stepReceipts []json.RawMessage) (string, error) {
	prevHash := ""
	for idx, raw := range stepReceipts {
		var receipt map[string]interface{}
		if err := json.Unmarshal(raw, &receipt); err != nil {
			return "", fmt.Errorf("step receipt %d is not a JSON object: %w", idx, err)
		}
		gotPrev, _ := receipt["previous_hash"].(string)
		if idx > 0 && gotPrev != prevHash {
			return "", fmt.Errorf("step receipt %d previous_hash %q does not chain to prior receipt hash %q", idx, gotPrev, prevHash)
		}
		hash, _ := receipt["hash"].(string)
		if strings.TrimSpace(hash) == "" {
			return "", fmt.Errorf("step receipt %d has no hash", idx)
		}
		prevHash = hash
	}
	return prevHash, nil
}

// verifyStepReceiptsForTask cryptographically verifies every per-step receipt
// (canonical-hash re-derivation + Ed25519 signature against the runtime's
// registered public key) and that the batch forms a contiguous hash chain.
func (tc *TaskCoordinator) verifyStepReceiptsForTask(ctx context.Context, task *TaskRecord, stepReceipts []json.RawMessage) error {
	if len(stepReceipts) == 0 {
		return nil
	}
	publicKeyHex, err := tc.runtimePublicKeyForTask(ctx, task)
	if err != nil {
		return err
	}
	for idx, raw := range stepReceipts {
		var receipt map[string]interface{}
		if err := json.Unmarshal(raw, &receipt); err != nil {
			return fmt.Errorf("step receipt %d is not a JSON object: %w", idx, err)
		}
		res := internal.VerifyReceiptCryptographic(receipt, publicKeyHex)
		if !res.Verified() {
			return fmt.Errorf("step receipt %d failed cryptographic verification: %s", idx, res.Reason)
		}
	}
	if _, err := validateReceiptChainLinks(stepReceipts); err != nil {
		return err
	}
	return nil
}

type taskSubmitResult struct {
	TaskID            uuid.UUID              `json:"task_id"`
	Status            taskSubmitResultStatus `json:"status"`
	Checkpoint        *CheckpointPayload     `json:"checkpoint,omitempty"`
	FailureReason     string                 `json:"reason,omitempty"` // legacy string-form status compatibility
	FailureDetails    *TaskFailureDetails    `json:"failure_details,omitempty"`
	ExecutionEnvelope json.RawMessage        `json:"execution_envelope,omitempty"`
	ExecutionReceipt  json.RawMessage        `json:"execution_receipt,omitempty"`
	// StepReceipts, when present, is the full per-step receipt chain in commit
	// order (its last entry equals ExecutionReceipt, the head). Older runtimes
	// only send ExecutionReceipt — handled transparently.
	StepReceipts []json.RawMessage `json:"step_receipts,omitempty"`
}

type taskSubmitResultStatus struct {
	Name        string       `json:"status"`
	Reason      string       `json:"reason,omitempty"`
	ResumeToken *ResumeToken `json:"resume_token,omitempty"`
}

func (s *taskSubmitResultStatus) UnmarshalJSON(data []byte) error {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		*s = taskSubmitResultStatus{}
		return nil
	}

	if trimmed[0] == '"' {
		var name string
		if err := json.Unmarshal(trimmed, &name); err != nil {
			return err
		}
		*s = taskSubmitResultStatus{Name: name}
		return nil
	}

	type alias taskSubmitResultStatus
	var decoded alias
	if err := json.Unmarshal(trimmed, &decoded); err != nil {
		return err
	}
	*s = taskSubmitResultStatus(decoded)
	return nil
}

type governedAction struct {
	SchemaVersion      string  `json:"schema_version"`
	Domain             string  `json:"domain"`
	ActionType         string  `json:"action_type"`
	ActionName         string  `json:"action_name"`
	NodeID             string  `json:"node_id"`
	StepIndex          uint32  `json:"step_index"`
	Target             *string `json:"target,omitempty"`
	RequiresPolicy     bool    `json:"requires_policy"`
	SafetyModeRequired bool    `json:"safety_mode_required"`
}

type signedGovernedPolicyDecision struct {
	SchemaVersion      string         `json:"schema_version"`
	DecisionID         string         `json:"decision_id"`
	TenantID           string         `json:"tenant_id"`
	TaskID             string         `json:"task_id"`
	RuntimeID          *string        `json:"runtime_id,omitempty"`
	Action             governedAction `json:"action"`
	Permit             bool           `json:"permit"`
	Reason             string         `json:"reason"`
	PolicyVersion      string         `json:"policy_version"`
	RuntimePermitted   bool           `json:"runtime_permitted"`
	TenantPermitted    bool           `json:"tenant_permitted"`
	PolicyPermitted    bool           `json:"policy_permitted"`
	RobotModePermitted bool           `json:"robot_mode_permitted"`
	IssuedAtUnixMs     int64          `json:"issued_at_unix_ms"`
	ExpiresAtUnixMs    int64          `json:"expires_at_unix_ms"`
	SignerKeyVersion   *string        `json:"signer_key_version,omitempty"`
	Signature          string         `json:"signature"`
}

type roboticsPolicyEvaluation struct {
	PolicyVersion      string
	Permit             bool
	Reason             string
	RuntimePermitted   bool
	TenantPermitted    bool
	PolicyPermitted    bool
	RobotModePermitted bool
	ExpiresAt          *time.Time
}

func (p roboticsPolicyEvaluation) ExpiresAtUnixMs(now int64) int64 {
	if p.ExpiresAt != nil {
		return p.ExpiresAt.UnixMilli()
	}
	return now + 30_000
}

func evaluateRoboticsPolicy(ctx context.Context, db *sql.DB, task *TaskRecord) roboticsPolicyEvaluation {
	denied := roboticsPolicyEvaluation{
		PolicyVersion: "robotics-policy.missing",
		Reason:        "default deny: no active robotics policy",
	}
	if db == nil || task == nil {
		return denied
	}

	var policyVersion, robotMode, allowedRuntimesRaw sql.NullString
	var permit, runtimeEnabled sql.NullBool
	var expiresAt sql.NullTime
	err := db.QueryRowContext(ctx, `
		SELECT
			policy_version,
			permit,
			runtime_permitted,
			robot_mode,
			COALESCE(allowed_runtimes::text, '[]'),
			expires_at
		FROM robotics_policy_settings
		WHERE tenant_id = $1
		  AND active = true
		  AND COALESCE(status, CASE WHEN active THEN 'active' ELSE 'draft' END) = 'active'
		  AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY updated_at DESC
		LIMIT 1
	`, task.TenantID).Scan(
		&policyVersion,
		&permit,
		&runtimeEnabled,
		&robotMode,
		&allowedRuntimesRaw,
		&expiresAt,
	)
	if err != nil {
		if err != sql.ErrNoRows {
			log.Warn().Err(err).Str("tenant_id", task.TenantID).Msg("[Coordinator] Robotics policy lookup failed")
		}
		return denied
	}

	runtimeAllowed := runtimeEnabled.Valid && runtimeEnabled.Bool && runtimeListed(task.RuntimeID, allowedRuntimesRaw.String)
	tenantPermitted := task.TenantID != ""
	policyPermitted := permit.Valid && permit.Bool
	mode := strings.ToLower(strings.TrimSpace(robotMode.String))
	robotModePermitted := mode == "supervised" || mode == "active"
	finalPermit := runtimeAllowed && tenantPermitted && policyPermitted && robotModePermitted
	reason := "permitted"
	if !finalPermit {
		reason = "default deny: robotics policy prerequisites are incomplete"
	}
	var expires *time.Time
	if expiresAt.Valid {
		value := expiresAt.Time.UTC()
		expires = &value
	}
	version := policyVersion.String
	if version == "" {
		version = "robotics-policy.db"
	}
	return roboticsPolicyEvaluation{
		PolicyVersion:      version,
		Permit:             finalPermit,
		Reason:             reason,
		RuntimePermitted:   runtimeAllowed,
		TenantPermitted:    tenantPermitted,
		PolicyPermitted:    policyPermitted,
		RobotModePermitted: robotModePermitted,
		ExpiresAt:          expires,
	}
}

func runtimeListed(runtimeID *string, raw string) bool {
	if runtimeID == nil || strings.TrimSpace(*runtimeID) == "" {
		return false
	}
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || trimmed == "[]" || trimmed == "null" {
		return false
	}
	var runtimes []string
	if err := json.Unmarshal([]byte(trimmed), &runtimes); err != nil {
		return false
	}
	for _, candidate := range runtimes {
		if candidate == "*" || candidate == *runtimeID {
			return true
		}
	}
	return false
}

func buildSignedGovernedPolicyDecisions(task *TaskRecord, taskTypeBytes json.RawMessage, db *sql.DB) []signedGovernedPolicyDecision {
	signingKey := loadOvertureSigningKey()
	if signingKey == nil || task == nil || db == nil {
		return nil
	}
	actions := extractGovernedRoboticsActions(taskTypeBytes)
	if len(actions) == 0 {
		return nil
	}

	now := time.Now().UnixMilli()
	policy := evaluateRoboticsPolicy(context.Background(), db, task)
	keyVersion := strings.TrimSpace(os.Getenv("IGRIS_OVERTURE_SIGNING_KEY_VERSION"))

	decisions := make([]signedGovernedPolicyDecision, 0, len(actions))
	for _, action := range actions {
		decision := signedGovernedPolicyDecision{
			SchemaVersion:      "governed_policy_decision.v1",
			DecisionID:         uuid.NewString(),
			TenantID:           task.TenantID,
			TaskID:             task.TaskID.String(),
			RuntimeID:          task.RuntimeID,
			Action:             action,
			Permit:             policy.Permit,
			Reason:             policy.Reason,
			PolicyVersion:      policy.PolicyVersion,
			RuntimePermitted:   policy.RuntimePermitted,
			TenantPermitted:    policy.TenantPermitted,
			PolicyPermitted:    policy.PolicyPermitted,
			RobotModePermitted: policy.RobotModePermitted,
			IssuedAtUnixMs:     now,
			ExpiresAtUnixMs:    policy.ExpiresAtUnixMs(now),
		}
		if keyVersion != "" {
			decision.SignerKeyVersion = &keyVersion
		}
		decision.Signature = signGovernedPolicyDecision(decision, signingKey)
		decisions = append(decisions, decision)
	}
	return decisions
}

func loadOvertureSigningKey() ed25519.PrivateKey {
	hexKey := os.Getenv("IGRIS_OVERTURE_SIGNING_KEY")
	if hexKey == "" {
		return nil
	}
	decoded, err := hex.DecodeString(hexKey)
	if err != nil || len(decoded) != ed25519.PrivateKeySize {
		return nil
	}
	return ed25519.PrivateKey(decoded)
}

func signGovernedPolicyDecision(decision signedGovernedPolicyDecision, signingKey ed25519.PrivateKey) string {
	canonical, _ := json.Marshal(canonicalGovernedPolicyDecision(decision))
	sum := sha256.Sum256(canonical)
	return base64.StdEncoding.EncodeToString(ed25519.Sign(signingKey, sum[:]))
}

func canonicalGovernedPolicyDecision(decision signedGovernedPolicyDecision) map[string]any {
	value := map[string]any{
		"action":               canonicalGovernedAction(decision.Action),
		"decision_id":          decision.DecisionID,
		"expires_at_unix_ms":   decision.ExpiresAtUnixMs,
		"issued_at_unix_ms":    decision.IssuedAtUnixMs,
		"permit":               decision.Permit,
		"policy_permitted":     decision.PolicyPermitted,
		"policy_version":       decision.PolicyVersion,
		"reason":               decision.Reason,
		"robot_mode_permitted": decision.RobotModePermitted,
		"runtime_permitted":    decision.RuntimePermitted,
		"schema_version":       decision.SchemaVersion,
		"task_id":              decision.TaskID,
		"tenant_id":            decision.TenantID,
		"tenant_permitted":     decision.TenantPermitted,
	}
	if decision.RuntimeID != nil {
		value["runtime_id"] = *decision.RuntimeID
	}
	if decision.SignerKeyVersion != nil {
		value["signer_key_version"] = *decision.SignerKeyVersion
	}
	return value
}

func canonicalGovernedAction(action governedAction) map[string]any {
	value := map[string]any{
		"action_name":          action.ActionName,
		"action_type":          action.ActionType,
		"domain":               action.Domain,
		"node_id":              action.NodeID,
		"requires_policy":      action.RequiresPolicy,
		"safety_mode_required": action.SafetyModeRequired,
		"schema_version":       action.SchemaVersion,
		"step_index":           action.StepIndex,
	}
	if action.Target != nil {
		value["target"] = *action.Target
	}
	return value
}

func extractGovernedRoboticsActions(taskTypeBytes json.RawMessage) []governedAction {
	var taskType map[string]json.RawMessage
	if err := json.Unmarshal(taskTypeBytes, &taskType); err != nil {
		return nil
	}
	var kind string
	_ = json.Unmarshal(taskType["type"], &kind)
	switch kind {
	case "robotics_workflow":
		return extractGovernedRoboticsSteps(taskType["steps"], false)
	case "execution_graph":
		var graph struct {
			Nodes []json.RawMessage `json:"nodes"`
		}
		if err := json.Unmarshal(taskType["graph"], &graph); err != nil {
			return nil
		}
		return extractGovernedRoboticsNodes(graph.Nodes)
	default:
		return nil
	}
}

func extractGovernedRoboticsNodes(nodes []json.RawMessage) []governedAction {
	actions := make([]governedAction, 0)
	for idx, raw := range nodes {
		var node map[string]json.RawMessage
		if err := json.Unmarshal(raw, &node); err != nil {
			continue
		}
		var kind string
		_ = json.Unmarshal(node["kind"], &kind)
		if kind != "robotics" {
			continue
		}
		actions = append(actions, governedActionFromRawStep(node, uint32(idx), true))
	}
	return actions
}

func extractGovernedRoboticsSteps(raw json.RawMessage, graphNode bool) []governedAction {
	var steps []map[string]json.RawMessage
	if err := json.Unmarshal(raw, &steps); err != nil {
		return nil
	}
	actions := make([]governedAction, 0, len(steps))
	for idx, step := range steps {
		actions = append(actions, governedActionFromRawStep(step, uint32(idx), graphNode))
	}
	return actions
}

func governedActionFromRawStep(step map[string]json.RawMessage, fallbackStepIndex uint32, graphNode bool) governedAction {
	stepIndex := fallbackStepIndex
	if raw, ok := step["step_index"]; ok {
		var parsed uint32
		if err := json.Unmarshal(raw, &parsed); err == nil {
			stepIndex = parsed
		}
	}
	nodeID := fmt.Sprintf("robotics-step-%d", stepIndex)
	if raw, ok := step["node_id"]; ok {
		var parsed string
		if err := json.Unmarshal(raw, &parsed); err == nil && parsed != "" {
			nodeID = parsed
		}
	}
	actionName := rawStringField(step, "action")
	target := roboticsActionTargetFromRaw(actionName, step)
	return governedAction{
		SchemaVersion:      "governed_action.v1",
		Domain:             "robotics",
		ActionType:         "ros2_action",
		ActionName:         actionName,
		NodeID:             nodeID,
		StepIndex:          stepIndex,
		Target:             target,
		RequiresPolicy:     true,
		SafetyModeRequired: true,
	}
}

func rawStringField(raw map[string]json.RawMessage, key string) string {
	var value string
	_ = json.Unmarshal(raw[key], &value)
	return value
}

func roboticsActionTargetFromRaw(actionName string, raw map[string]json.RawMessage) *string {
	switch actionName {
	case "navigate_to_pose":
		var payload struct {
			Goal struct {
				X       float64 `json:"x"`
				Y       float64 `json:"y"`
				FrameID string  `json:"frame_id"`
			} `json:"goal"`
		}
		if err := json.Unmarshal(mustRaw(raw["goal"], []byte(`{}`)), &payload.Goal); err == nil {
			if payload.Goal.FrameID == "" {
				payload.Goal.FrameID = "map"
			}
			target := fmt.Sprintf("%v,%v,%s", payload.Goal.X, payload.Goal.Y, payload.Goal.FrameID)
			return &target
		}
	case "publish_prompt":
		prompt := rawStringField(raw, "prompt")
		target := truncateRunes(prompt, 120)
		return &target
	case "publish_velocity":
		var payload struct {
			LinearX  float64 `json:"linear_x"`
			AngularZ float64 `json:"angular_z"`
		}
		_ = json.Unmarshal(json.RawMessage(mustRawMap(raw)), &payload)
		target := fmt.Sprintf("%.3f,%.3f", payload.LinearX, payload.AngularZ)
		return &target
	}
	return nil
}

func mustRaw(raw json.RawMessage, fallback []byte) []byte {
	if len(raw) == 0 {
		return fallback
	}
	return raw
}

func mustRawMap(raw map[string]json.RawMessage) []byte {
	data, _ := json.Marshal(raw)
	return data
}

func truncateRunes(value string, max int) string {
	runes := []rune(value)
	if len(runes) <= max {
		return value
	}
	return string(runes[:max])
}

func runtimeTaskDispatchFailure(statusCode int, raw []byte, resumed bool) (string, *TaskFailureDetails) {
	type runtimeErrorEnvelope struct {
		Error struct {
			Message string `json:"message"`
			Type    string `json:"type"`
		} `json:"error"`
		Resume struct {
			ResumeCheckpointProvided *bool `json:"resume_checkpoint_provided"`
			RequestedResumeFrom      *struct {
				LastCommittedStep *uint32         `json:"last_committed_step"`
				CheckpointDigest  json.RawMessage `json:"checkpoint_digest"`
			} `json:"requested_resume_from"`
			LocalLastCommittedStep *uint32 `json:"local_last_committed_step"`
			LocalCheckpointDigest  string  `json:"local_checkpoint_digest"`
		} `json:"resume"`
	}

	operation := "submit"
	if resumed {
		operation = "resume"
	}
	details := &TaskFailureDetails{
		Source:     "runtime",
		Operation:  operation,
		StatusCode: statusCode,
	}

	var payload runtimeErrorEnvelope
	if err := json.Unmarshal(raw, &payload); err == nil {
		if payload.Error.Type != "" {
			details.RejectionType = payload.Error.Type
		}
		if payload.Error.Message != "" {
			details.Message = payload.Error.Message
		}
		if payload.Resume.ResumeCheckpointProvided != nil {
			details.ResumeCheckpointProvided = payload.Resume.ResumeCheckpointProvided
		}
		if payload.Resume.LocalCheckpointDigest != "" {
			details.LocalCheckpointDigest = payload.Resume.LocalCheckpointDigest
		}
		if payload.Resume.LocalLastCommittedStep != nil {
			details.LocalLastStep = payload.Resume.LocalLastCommittedStep
		}
		if payload.Resume.RequestedResumeFrom != nil {
			if payload.Resume.RequestedResumeFrom.LastCommittedStep != nil {
				details.RequestedLastStep = payload.Resume.RequestedResumeFrom.LastCommittedStep
			}
			if digest := normalizeRuntimeCheckpointDigest(payload.Resume.RequestedResumeFrom.CheckpointDigest); digest != "" {
				details.RequestedCheckpointDigest = digest
			}
		}
		switch {
		case payload.Error.Type != "" && payload.Error.Message != "":
			return fmt.Sprintf("runtime %s rejected (%s): %s", operation, payload.Error.Type, payload.Error.Message), details
		case payload.Error.Message != "":
			return fmt.Sprintf("runtime %s rejected: %s", operation, payload.Error.Message), details
		case payload.Error.Type != "":
			return fmt.Sprintf("runtime %s rejected (%s)", operation, payload.Error.Type), details
		}
	}

	body := strings.TrimSpace(string(raw))
	if body != "" {
		details.Message = body
		return fmt.Sprintf("runtime %s rejected with status %d: %s", operation, statusCode, body), details
	}
	return fmt.Sprintf("runtime %s rejected with status %d", operation, statusCode), details
}

func normalizeRuntimeCheckpointDigest(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return ""
	}

	var digest string
	if err := json.Unmarshal(raw, &digest); err == nil {
		return digest
	}

	var digestBytes []uint8
	if err := json.Unmarshal(raw, &digestBytes); err == nil {
		return fmt.Sprintf("%x", digestBytes)
	}

	var compact bytes.Buffer
	if err := json.Compact(&compact, raw); err == nil {
		return compact.String()
	}
	return string(raw)
}

// recoverFailedRuntimes scans for runtimes with stale heartbeats, marks their
// tasks as RECOVERING, and redispatches each to a healthy runtime.
func (tc *TaskCoordinator) recoverFailedRuntimes(ctx context.Context) {
	rows, err := tc.db.QueryContext(ctx, `
		SELECT DISTINCT runtime_id
		FROM runtime_instances
		WHERE is_healthy = true
		  AND last_heartbeat < NOW() - INTERVAL '90 seconds'
		  AND status = 'active'`,
	)
	if err != nil {
		log.Error().Err(err).Msg("[Coordinator] Query stale runtimes")
		return
	}
	defer rows.Close()

	for rows.Next() {
		var runtimeID string
		if err := rows.Scan(&runtimeID); err != nil {
			continue
		}
		tc.recoverRuntime(ctx, runtimeID)
	}
}

func (tc *TaskCoordinator) recoverRuntime(ctx context.Context, runtimeID string) {
	// Mark runtime unhealthy
	_, _ = tc.db.ExecContext(ctx,
		`UPDATE runtime_instances SET is_healthy = false, status = 'failed' WHERE runtime_id = $1`,
		runtimeID,
	)

	taskIDs, err := tc.store.MarkRecovering(runtimeID)
	if err != nil {
		log.Error().Err(err).Str("runtime_id", runtimeID).Msg("[Coordinator] Mark recovering")
		return
	}

	log.Warn().Str("runtime_id", runtimeID).Int("tasks", len(taskIDs)).Msg("[Coordinator] Recovering tasks from failed runtime")

	for _, taskID := range taskIDs {
		cp, checkpointErr := tc.store.GetCumulativeRecoveryCheckpoint(taskID)
		if checkpointErr != nil {
			log.Error().Err(checkpointErr).Str("task_id", taskID.String()).Msg("[Coordinator] Get checkpoint for recovery")
		}

		// We need tenant_id to find a runtime — get it from the task record.
		var tenantID string
		_ = tc.db.QueryRowContext(ctx,
			`SELECT tenant_id FROM task_records WHERE task_id = $1`, taskID,
		).Scan(&tenantID)

		task, err := tc.store.GetTask(taskID, tenantID)
		if err != nil {
			log.Warn().Err(err).Str("task_id", taskID.String()).Msg("[Coordinator] Could not load task state for recovery")
			continue
		}
		step := checkpointLastCommittedStep(cp)
		_ = tc.store.SaveRecoveryEvent(RecoveryEvent{
			TenantID:          task.TenantID,
			TaskID:            taskID,
			EventType:         "runtime_failed",
			SourceRuntimeID:   runtimeID,
			CheckpointDigest:  checkpointDigest(cp),
			LastCommittedStep: step,
			Reason:            "runtime heartbeat became stale",
		})
		task, err = tc.store.HydrateTaskPermissionEnvelope(task)
		if err != nil {
			log.Warn().Err(err).Str("task_id", taskID.String()).Msg("[Coordinator] Could not hydrate task governance for recovery")
			continue
		}
		if skipReason := TaskRecoverySkipReason(task); skipReason != "" {
			tc.handleRecoverySkip(taskID, task, skipReason)
			continue
		}

		if checkpointErr != nil {
			if errors.Is(checkpointErr, ErrInvalidCumulativeCheckpoint) {
				_ = tc.store.MarkFailedWithDetails(taskID, TaskFailureReasonInvalidRecoveryCheckpoint, overtureTaskFailureDetails("recovery", "invalid_recovery_checkpoint", TaskFailureReasonInvalidRecoveryCheckpoint))
			}
			continue
		}
		if task.LastCheckpoint != nil && TaskCheckpointAdvances(cp, task.LastCheckpoint) {
			cp, checkpointErr = BuildCumulativeRecoveryCheckpoint(taskID, []*CheckpointPayload{cp, task.LastCheckpoint})
			if checkpointErr != nil {
				log.Error().Err(checkpointErr).Str("task_id", taskID.String()).Msg("[Coordinator] Merge task checkpoint for recovery")
				_ = tc.store.MarkFailedWithDetails(taskID, TaskFailureReasonInvalidRecoveryCheckpoint, overtureTaskFailureDetails("recovery", "invalid_recovery_checkpoint", TaskFailureReasonInvalidRecoveryCheckpoint))
				continue
			}
		}
		if cp != nil && !TaskRecoveryCheckpointUsable(taskID, cp) {
			log.Error().
				Str("task_id", taskID.String()).
				Msg("[Coordinator] Invalid recovery checkpoint, marking task failed")
			_ = tc.store.MarkFailedWithDetails(taskID, TaskFailureReasonInvalidRecoveryCheckpoint, overtureTaskFailureDetails("recovery", "invalid_recovery_checkpoint", TaskFailureReasonInvalidRecoveryCheckpoint))
			continue
		}

		newRuntime, err := tc.selectRuntime(ctx, tenantID, "")
		if err != nil {
			log.Error().Err(err).Str("task_id", taskID.String()).Msg("[Coordinator] No runtime for recovery")
			_ = tc.store.MarkFailedWithDetails(taskID, "no runtime available for recovery", overtureTaskFailureDetails("recovery", "no_runtime_available", "no runtime available for recovery"))
			continue
		}

		decision := evaluateActionPolicy(actionPolicyInput{
			TenantID:        task.TenantID,
			TaskID:          task.TaskID,
			RuntimeID:       newRuntime.RuntimeID,
			TaskDefinition:  task.TaskDefinition,
			AgentIdentity:   task.AgentIdentity,
			RequiredCaps:    task.RequiredCapabilities,
			Checkpoint:      cp,
			RecoveryAttempt: true,
		})
		if err := tc.store.SaveActionPolicyDecision(decision); err != nil {
			log.Error().Err(err).Str("task_id", taskID.String()).Msg("[Coordinator] Persist recovery action policy decision")
			_ = tc.store.MarkFailedWithDetails(taskID, "recovery action policy decision persistence failed", overtureTaskFailureDetails("recovery", "policy_decision_persistence_failed", err.Error()))
			continue
		}
		_ = tc.store.SetLatestPolicyDecision(taskID, decision)
		allowed, handoffReason := RecoveryHandoffAllowed(task, cp, newRuntime.RuntimeID, decision)
		_ = tc.store.SaveRuntimeHandoffEvent(RuntimeHandoffEvent{
			TenantID:              task.TenantID,
			TaskID:                taskID,
			SourceRuntimeID:       runtimeID,
			TargetRuntimeID:       newRuntime.RuntimeID,
			CheckpointDigest:      checkpointDigest(cp),
			CheckpointPortability: decision.CheckpointPortability,
			Decision:              mapBoolDecision(allowed),
			Reason:                handoffReason,
		})
		_ = tc.store.SaveRecoveryEvent(RecoveryEvent{
			TenantID:          task.TenantID,
			TaskID:            taskID,
			EventType:         "handoff_" + mapBoolDecision(allowed),
			SourceRuntimeID:   runtimeID,
			TargetRuntimeID:   newRuntime.RuntimeID,
			CheckpointDigest:  checkpointDigest(cp),
			LastCommittedStep: checkpointLastCommittedStep(cp),
			ReplayAllowed:     &allowed,
			Reason:            handoffReason,
		})
		if !allowed {
			_ = tc.store.MarkFailedWithDetails(taskID, handoffReason, overtureTaskFailureDetails("recovery", "runtime_handoff_denied", handoffReason))
			continue
		}

		if err := tc.store.MarkDispatched(taskID, newRuntime.RuntimeID, newRuntime.Endpoint); err != nil {
			log.Info().
				Str("task_id", taskID.String()).
				Str("new_runtime", newRuntime.RuntimeID).
				Msg("[Coordinator] Skipping recovery redispatch because task no longer allows dispatch")
			continue
		}

		task, err = tc.store.GetTask(taskID, tenantID)
		if err != nil {
			continue
		}
		task, err = tc.store.HydrateTaskPermissionEnvelope(task)
		if err != nil {
			log.Warn().Err(err).Str("task_id", taskID.String()).Msg("[Coordinator] Could not rehydrate task governance for recovery retry")
			continue
		}
		task.RuntimeEndpoint = &newRuntime.Endpoint
		// The persisted permission envelope is bound to the runtime that first
		// received the task. Recovery must rebuild it after MarkDispatched updates
		// task.RuntimeID, otherwise the replacement runtime correctly rejects the
		// resume request as a runtime-binding mismatch.
		task.PermissionEnvelope = nil
		rehydratedDefinition, err := rehydrateTaskDefinitionInputRefs(task.TaskDefinition, task.TenantID, task.TaskID, func(refID uuid.UUID, purpose string) ([]byte, error) {
			return tc.store.DecryptExecutionInputRef(ctx, task.TenantID, task.TaskID, refID, purpose, "runtime recovery redispatch")
		})
		if err != nil {
			safeErr := safeInputRefError(err)
			log.Warn().Err(safeErr).Str("task_id", taskID.String()).Msg("[Coordinator] Could not rehydrate encrypted input refs for recovery")
			_ = tc.store.MarkFailedWithDetails(taskID, "encrypted input unavailable for recovery", overtureTaskFailureDetails("recovery", "encrypted_input_unavailable", safeErr.Error()))
			continue
		}
		runtimeTask := *task
		runtimeTask.TaskDefinition = rehydratedDefinition

		log.Info().
			Str("task_id", taskID.String()).
			Str("new_runtime", newRuntime.RuntimeID).
			Msg("[Coordinator] Redispatching recovered task")

		_ = tc.store.SaveExecutionBoundary(decision, task.TaskDefinition, task.RequiredCapabilities)
		_ = tc.store.SaveRecoveryEvent(RecoveryEvent{
			TenantID:          task.TenantID,
			TaskID:            taskID,
			EventType:         "redispatched",
			SourceRuntimeID:   runtimeID,
			TargetRuntimeID:   newRuntime.RuntimeID,
			CheckpointDigest:  checkpointDigest(cp),
			LastCommittedStep: checkpointLastCommittedStep(cp),
			ReplayAllowed:     &allowed,
			Reason:            "recovery redispatch accepted",
		})
		go tc.dispatchToRuntime(ctx, &runtimeTask, cp)
	}
}

func (tc *TaskCoordinator) handleRecoverySkip(taskID uuid.UUID, task *TaskRecord, skipReason string) {
	log.Info().
		Str("task_id", taskID.String()).
		Str("status", string(task.Status)).
		Str("skip_reason", skipReason).
		Msg("[Coordinator] Skipping recovery redispatch")

	if skipReason == "streaming_resume_unsupported" && task.Status == TaskStatusRecovering {
		_ = tc.store.MarkFailedWithDetails(taskID, TaskFailureReasonStreamingResumeUnsupported, overtureTaskFailureDetails("recovery", "streaming_resume_unsupported", TaskFailureReasonStreamingResumeUnsupported))
	}
}

func checkpointDigest(cp *CheckpointPayload) string {
	if cp == nil {
		return ""
	}
	return cp.ResumeToken.CheckpointDigest
}

func checkpointLastCommittedStep(cp *CheckpointPayload) *int {
	if cp == nil {
		return nil
	}
	v := int(cp.ResumeToken.LastCommittedStep)
	return &v
}

func mapBoolDecision(allowed bool) string {
	if allowed {
		return "allowed"
	}
	return "denied"
}

func overtureTaskFailureDetails(operation, rejectionType, message string) *TaskFailureDetails {
	return &TaskFailureDetails{
		Source:        "overture",
		Operation:     operation,
		RejectionType: rejectionType,
		Message:       message,
	}
}

func selectRecoveryCheckpoint(primary *CheckpointPayload, secondary *CheckpointPayload) *CheckpointPayload {
	switch {
	case primary == nil:
		return secondary
	case secondary == nil:
		return primary
	case TaskCheckpointAdvances(primary, secondary):
		return secondary
	default:
		return primary
	}
}

func (tc *TaskCoordinator) markAndRecover(ctx context.Context, taskID uuid.UUID, runtimeID string) {
	if tc.recoveryHook != nil {
		tc.recoveryHook(ctx, taskID, runtimeID)
		return
	}
	// Use Background context: the caller's ctx is an HTTP request context that
	// will be cancelled once the response returns, which would abort the recovery.
	go tc.recoverRuntime(context.Background(), runtimeID)
}

func (tc *TaskCoordinator) handleDispatchFailure(ctx context.Context, task *TaskRecord, resp *http.Response, err error) {
	if task == nil || task.RuntimeID == nil {
		return
	}
	tc.markAndRecover(ctx, task.TaskID, *task.RuntimeID)
}

// TaskSubmitRequest is the payload from external clients to /v1/tasks/submit.
type TaskSubmitRequest struct {
	TaskID               uuid.UUID           `json:"task_id,omitempty"`
	TenantID             string              `json:"tenant_id"`
	TaskType             string              `json:"task_type"` // "agent_workflow" | "robotics_workflow" | "single_inference" | "behavior_tree" | "execution_graph"
	TaskDefinition       json.RawMessage     `json:"task_definition"`
	AgentIdentity        *AgentIdentity      `json:"agent_identity,omitempty"`
	RequiredCapabilities []string            `json:"required_capabilities,omitempty"`
	CredentialRequests   []CredentialRequest `json:"credential_requests,omitempty"`
	IdempotencyKey       string              `json:"idempotency_key,omitempty"`
	DeadlineAt           *time.Time          `json:"deadline_at,omitempty"`

	// PreferredRuntimeID pins dispatch to a specific tenant runtime. Used by
	// local_runtime action dispatch so a customer-owned runtime executes the
	// action. The runtime must still be tenant-scoped and healthy; if no such
	// runtime exists Submit returns a no-healthy-runtime error.
	PreferredRuntimeID string `json:"-"`

	RegisteredAgentID   *uuid.UUID              `json:"-"`
	RegisteredAgentName string                  `json:"-"`
	BoundAction         *BoundActionRunIdentity `json:"-"`
}

func normalizePublicTaskDefinition(taskType string, raw json.RawMessage) (json.RawMessage, error) {
	var definition map[string]json.RawMessage
	if err := json.Unmarshal(raw, &definition); err != nil {
		return nil, fmt.Errorf("%w: task_definition must be a JSON object", ErrInvalidTaskDefinition)
	}
	if err := validateTaskDefinition(taskType, definition); err != nil {
		return nil, err
	}
	typeBytes, err := json.Marshal(taskType)
	if err != nil {
		return nil, fmt.Errorf("%w: could not encode task_type", ErrInvalidTaskDefinition)
	}
	definition["type"] = typeBytes
	normalized, err := json.Marshal(definition)
	if err != nil {
		return nil, fmt.Errorf("%w: could not normalize task_definition", ErrInvalidTaskDefinition)
	}
	return normalized, nil
}

func validateTaskDefinition(taskType string, definition map[string]json.RawMessage) error {
	switch taskType {
	case "single_inference":
		if err := requireStringField(definition, "model"); err != nil {
			return err
		}
		if _, err := requireArrayField(definition, "messages"); err != nil {
			return err
		}
		if rawStream, ok := definition["stream"]; ok {
			var stream bool
			if err := json.Unmarshal(rawStream, &stream); err != nil {
				return invalidTaskDefinition("stream must be a boolean")
			}
			if stream {
				return invalidTaskDefinition("single_inference.stream=true is not supported on Overture durable tasks")
			}
		}
	case "agent_workflow":
		steps, err := requireArrayField(definition, "steps")
		if err != nil {
			return err
		}
		if err := validateOptionalPositiveUint32Field(definition, "checkpoint_after_steps"); err != nil {
			return err
		}
		if len(steps) == 0 {
			return invalidTaskDefinition("agent_workflow.steps must contain at least one step")
		}
		for idx, rawStep := range steps {
			var step map[string]json.RawMessage
			if err := json.Unmarshal(rawStep, &step); err != nil {
				return invalidTaskDefinition("agent_workflow.steps[%d] must be an object", idx)
			}
			if err := requireNumericField(step, "step_index"); err != nil {
				return invalidTaskDefinition("agent_workflow.steps[%d]: %s", idx, unwrapInvalidTaskDefinition(err))
			}
			if err := requireStringField(step, "model"); err != nil {
				return invalidTaskDefinition("agent_workflow.steps[%d]: %s", idx, unwrapInvalidTaskDefinition(err))
			}
			if _, err := requireArrayField(step, "messages"); err != nil {
				return invalidTaskDefinition("agent_workflow.steps[%d]: %s", idx, unwrapInvalidTaskDefinition(err))
			}
		}
	case "robotics_workflow":
		steps, err := requireArrayField(definition, "steps")
		if err != nil {
			return err
		}
		if len(steps) == 0 {
			return invalidTaskDefinition("robotics_workflow.steps must contain at least one step")
		}
		for idx, rawStep := range steps {
			var step map[string]json.RawMessage
			if err := json.Unmarshal(rawStep, &step); err != nil {
				return invalidTaskDefinition("robotics_workflow.steps[%d] must be an object", idx)
			}
			if err := requireNumericField(step, "step_index"); err != nil {
				return invalidTaskDefinition("robotics_workflow.steps[%d]: %s", idx, unwrapInvalidTaskDefinition(err))
			}
			if err := validateRoboticsStep(step); err != nil {
				return invalidTaskDefinition("robotics_workflow.steps[%d]: %s", idx, unwrapInvalidTaskDefinition(err))
			}
		}
	case "behavior_tree":
		if _, ok := definition["tree"]; !ok {
			return invalidTaskDefinition("behavior_tree.tree is required")
		}
	case "execution_graph":
		if err := validateOptionalPositiveUint32Field(definition, "checkpoint_after_steps"); err != nil {
			return err
		}
		if err := validateOptionalBoolField(definition, "continue_after_checkpoint"); err != nil {
			return err
		}
		if err := validateExecutionGraph(definition); err != nil {
			return err
		}
	default:
		return invalidTaskDefinition("unsupported task_type %q", taskType)
	}
	return nil
}

func validateExecutionGraph(definition map[string]json.RawMessage) error {
	rawGraph, ok := definition["graph"]
	if !ok {
		return invalidTaskDefinition("execution_graph.graph is required")
	}
	var graph map[string]json.RawMessage
	if err := json.Unmarshal(rawGraph, &graph); err != nil {
		return invalidTaskDefinition("execution_graph.graph must be an object")
	}

	nodes, err := requireArrayField(graph, "nodes")
	if err != nil {
		return invalidTaskDefinition("execution_graph.%s", unwrapInvalidTaskDefinition(err))
	}
	if len(nodes) == 0 {
		return invalidTaskDefinition("execution_graph.graph.nodes must contain at least one node")
	}

	for idx, rawNode := range nodes {
		var node map[string]json.RawMessage
		if err := json.Unmarshal(rawNode, &node); err != nil {
			return invalidTaskDefinition("execution_graph.graph.nodes[%d] must be an object", idx)
		}
		if err := validateExecutionGraphNode(node); err != nil {
			return invalidTaskDefinition("execution_graph.graph.nodes[%d]: %s", idx, unwrapInvalidTaskDefinition(err))
		}
	}

	return nil
}

func validateExecutionGraphNode(node map[string]json.RawMessage) error {
	if err := requireStringField(node, "node_id"); err != nil {
		return err
	}
	if err := validateExecutionGraphSlotFields(node); err != nil {
		return err
	}
	kind, err := readStringField(node, "kind")
	if err != nil {
		return err
	}

	switch kind {
	case "reason":
		if err := requireStringField(node, "model"); err != nil {
			return err
		}
		if _, err := requireArrayField(node, "messages"); err != nil {
			return err
		}
	case "robotics":
		if err := validateRoboticsActionPayload(node); err != nil {
			return err
		}
	case "tool":
		if err := requireStringField(node, "tool_name"); err != nil {
			return err
		}
	case "behavior_tree":
		if _, ok := node["tree"]; !ok {
			return invalidTaskDefinition("tree is required")
		}
	case "human_approval":
		if err := requireStringField(node, "task"); err != nil {
			return err
		}
	case "memory_recall":
		if err := requireStringField(node, "query"); err != nil {
			return err
		}
	case "memory_store":
		if err := requireStringField(node, "content"); err != nil {
			return err
		}
	default:
		return invalidTaskDefinition("unsupported execution graph node kind %q", kind)
	}

	return nil
}

func validateExecutionGraphSlotFields(node map[string]json.RawMessage) error {
	if rawWriteSlot, ok := node["write_slot"]; ok {
		var writeSlot string
		if err := json.Unmarshal(rawWriteSlot, &writeSlot); err != nil || writeSlot == "" {
			return invalidTaskDefinition("write_slot must be a non-empty string")
		}
	}

	if rawReadSlots, ok := node["read_slots"]; ok {
		var readSlots []string
		if err := json.Unmarshal(rawReadSlots, &readSlots); err != nil {
			return invalidTaskDefinition("read_slots must be an array of strings")
		}
		for _, slot := range readSlots {
			if slot == "" {
				return invalidTaskDefinition("read_slots must not contain empty values")
			}
		}
	}

	return nil
}

func validateRoboticsStep(step map[string]json.RawMessage) error {
	if err := requireNumericField(step, "step_index"); err != nil {
		return err
	}
	return validateRoboticsActionPayload(step)
}

func validateRoboticsActionPayload(step map[string]json.RawMessage) error {
	action, err := readStringField(step, "action")
	if err != nil {
		return err
	}

	switch action {
	case "navigate_to_pose":
		rawGoal, ok := step["goal"]
		if !ok {
			return invalidTaskDefinition("goal is required")
		}
		var goal map[string]json.RawMessage
		if err := json.Unmarshal(rawGoal, &goal); err != nil {
			return invalidTaskDefinition("goal must be an object")
		}
		if err := requireNumericField(goal, "x"); err != nil {
			return err
		}
		if err := requireNumericField(goal, "y"); err != nil {
			return err
		}
	case "publish_prompt":
		if err := requireStringField(step, "prompt"); err != nil {
			return err
		}
	case "publish_velocity":
		if err := requireNumericField(step, "linear_x"); err != nil {
			return err
		}
		if err := requireNumericField(step, "angular_z"); err != nil {
			return err
		}
	case "get_navigation_status", "cancel_navigation", "publish_zero_velocity":
	default:
		return invalidTaskDefinition("unsupported robotics action %q", action)
	}

	return nil
}

func requireStringField(definition map[string]json.RawMessage, field string) error {
	value, err := readStringField(definition, field)
	if err != nil {
		return err
	}
	if value == "" {
		return invalidTaskDefinition("%s must be a non-empty string", field)
	}
	return nil
}

func readStringField(definition map[string]json.RawMessage, field string) (string, error) {
	raw, ok := definition[field]
	if !ok {
		return "", invalidTaskDefinition("%s is required", field)
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return "", invalidTaskDefinition("%s must be a string", field)
	}
	return value, nil
}

func requireArrayField(definition map[string]json.RawMessage, field string) ([]json.RawMessage, error) {
	raw, ok := definition[field]
	if !ok {
		return nil, invalidTaskDefinition("%s is required", field)
	}
	var values []json.RawMessage
	if err := json.Unmarshal(raw, &values); err != nil {
		return nil, invalidTaskDefinition("%s must be an array", field)
	}
	return values, nil
}

func requireNumericField(definition map[string]json.RawMessage, field string) error {
	raw, ok := definition[field]
	if !ok {
		return invalidTaskDefinition("%s is required", field)
	}
	var value json.Number
	if err := json.Unmarshal(raw, &value); err != nil {
		return invalidTaskDefinition("%s must be a number", field)
	}
	if _, err := value.Float64(); err != nil {
		return invalidTaskDefinition("%s must be a number", field)
	}
	return nil
}

func validateOptionalPositiveUint32Field(definition map[string]json.RawMessage, field string) error {
	raw, ok := definition[field]
	if !ok {
		return nil
	}
	var value uint64
	if err := json.Unmarshal(raw, &value); err != nil {
		return invalidTaskDefinition("%s must be a positive integer", field)
	}
	if value == 0 || value > uint64(^uint32(0)) {
		return invalidTaskDefinition("%s must be a positive integer", field)
	}
	return nil
}

func validateOptionalBoolField(definition map[string]json.RawMessage, field string) error {
	raw, ok := definition[field]
	if !ok {
		return nil
	}
	var value bool
	if err := json.Unmarshal(raw, &value); err != nil {
		return invalidTaskDefinition("%s must be a boolean", field)
	}
	return nil
}

func invalidTaskDefinition(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidTaskDefinition, fmt.Sprintf(format, args...))
}

func unwrapInvalidTaskDefinition(err error) string {
	msg := err.Error()
	prefix := ErrInvalidTaskDefinition.Error() + ": "
	return strings.TrimPrefix(msg, prefix)
}
