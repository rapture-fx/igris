// Package coordinator manages durable task lifecycle across runtime instances.
// It dispatches tasks to healthy runtimes, monitors heartbeats, and reassigns
// in-flight tasks when a runtime goes dark — making execution survive failures.
package coordinator

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

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
)

var ErrInvalidTaskDefinition = errors.New("invalid task_definition")

// TaskCoordinator dispatches tasks to runtimes and handles failure recovery.
type TaskCoordinator struct {
	db         *sql.DB
	store      *CheckpointStore
	httpClient *http.Client
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

	taskID := uuid.New()
	if req.TaskID != uuid.Nil {
		taskID = req.TaskID // caller can supply for idempotency
	}

	idempotencyKey := req.IdempotencyKey
	if idempotencyKey == "" {
		idempotencyKey = taskID.String()
	}

	task := &TaskRecord{
		TaskID:         taskID,
		TenantID:       req.TenantID,
		Status:         TaskStatusPending,
		TaskDefinition: normalizedDefinition,
		IdempotencyKey: idempotencyKey,
		DeadlineAt:     req.DeadlineAt,
		CreatedAt:      time.Now(),
	}

	inserted, err := tc.store.CreateTask(task)
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

	runtime, err := tc.selectRuntime(ctx, req.TenantID)
	if err != nil {
		_ = tc.store.MarkFailed(taskID, "no healthy runtime available")
		return nil, fmt.Errorf("no healthy runtime: %w", err)
	}

	if err := tc.store.MarkDispatched(taskID, runtime.RuntimeID, runtime.Endpoint); err != nil {
		return nil, fmt.Errorf("mark dispatched: %w", err)
	}
	task.Status = TaskStatusDispatched
	task.RuntimeID = &runtime.RuntimeID
	task.RuntimeEndpoint = &runtime.Endpoint

	// Dispatch asynchronously so Submit returns immediately.
	go tc.dispatchToRuntime(context.Background(), task, nil)

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
// Prefers runtimes with the lowest active task count.
func (tc *TaskCoordinator) selectRuntime(ctx context.Context, tenantID string) (*runtimeInfo, error) {
	row := tc.db.QueryRowContext(ctx, `
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
		  AND ri.last_heartbeat > NOW() - INTERVAL '90 seconds'
		ORDER BY COALESCE(t.active_count, 0) ASC
		LIMIT 1`,
		tenantID,
	)

	var r runtimeInfo
	if err := row.Scan(&r.RuntimeID, &r.Endpoint); err == sql.ErrNoRows {
		return nil, fmt.Errorf("no healthy runtime for tenant %s", tenantID)
	} else if err != nil {
		return nil, err
	}
	return &r, nil
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
	if task.RuntimeEndpoint == nil {
		log.Error().Str("task_id", task.TaskID.String()).Msg("[Coordinator] No endpoint for dispatch")
		_ = tc.store.MarkFailed(task.TaskID, "missing runtime endpoint")
		return
	}

	// task.TaskDefinition stores the runtime-facing task_type object. Wrap it in
	// the runtime submit payload and inject control-plane fields.
	taskTypeBytes := json.RawMessage(task.TaskDefinition)
	if err := json.Unmarshal(taskTypeBytes, &map[string]json.RawMessage{}); err != nil {
		log.Error().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Unmarshal task definition")
		_ = tc.store.MarkFailed(task.TaskID, "invalid task definition")
		return
	}
	runtimePayload := map[string]json.RawMessage{
		"task_type": taskTypeBytes,
	}

	// Inject / override control-plane fields.
	taskIDBytes, _ := json.Marshal(task.TaskID)
	tenantIDBytes, _ := json.Marshal(task.TenantID)
	idempotencyBytes, _ := json.Marshal(task.IdempotencyKey)
	runtimePayload["task_id"] = taskIDBytes
	runtimePayload["tenant_id"] = tenantIDBytes
	runtimePayload["idempotency_key"] = idempotencyBytes

	if checkpoint != nil {
		// resume_from carries the WAL watermark for digest verification.
		resumeBytes, _ := json.Marshal(checkpoint.ResumeToken)
		runtimePayload["resume_from"] = resumeBytes
		// resume_checkpoint carries task-type-specific state (e.g. blackboard for BT).
		// Forward the whole payload so the runtime can pick out what it needs.
		cpBytes, _ := json.Marshal(checkpoint)
		runtimePayload["resume_checkpoint"] = cpBytes
	}
	if task.DeadlineAt != nil {
		deadlineBytes, _ := json.Marshal(task.DeadlineAt.UnixMilli())
		runtimePayload["deadline_ms"] = deadlineBytes
	}

	body, err := json.Marshal(runtimePayload)
	if err != nil {
		log.Error().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Marshal dispatch payload")
		_ = tc.store.MarkFailed(task.TaskID, "internal marshal error")
		return
	}

	url := fmt.Sprintf("%s/v1/runtime/task/submit", *task.RuntimeEndpoint)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		_ = tc.store.MarkFailed(task.TaskID, err.Error())
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Igris-Tenant", task.TenantID)

	resp, err := tc.httpClient.Do(req)
	if err != nil {
		log.Warn().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Runtime unreachable, marking recovering")
		tc.markAndRecover(ctx, task.TaskID, *task.RuntimeID)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 500 {
		log.Warn().Int("status", resp.StatusCode).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Runtime error, marking recovering")
		tc.markAndRecover(ctx, task.TaskID, *task.RuntimeID)
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
		if err := tc.store.SaveExecutionArtifacts(task.TaskID, result.ExecutionEnvelope, result.ExecutionReceipt); err != nil {
			log.Error().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Save execution artifacts")
		} else {
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

	switch result.Status {
	case "completed":
		_ = tc.store.MarkCompleted(task.TaskID)
	case "failed":
		_ = tc.store.MarkFailed(task.TaskID, result.FailureReason)
	}
}

type taskSubmitResult struct {
	TaskID            uuid.UUID          `json:"task_id"`
	Status            string             `json:"status"` // completed | checkpointed | failed
	Checkpoint        *CheckpointPayload `json:"checkpoint,omitempty"`
	FailureReason     string             `json:"reason,omitempty"` // matches Rust TaskStatus::Failed { reason }
	ExecutionEnvelope json.RawMessage    `json:"execution_envelope,omitempty"`
	ExecutionReceipt  json.RawMessage    `json:"execution_receipt,omitempty"`
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
		cp, err := tc.store.GetLastCheckpoint(taskID)
		if err != nil {
			log.Error().Err(err).Str("task_id", taskID.String()).Msg("[Coordinator] Get checkpoint for recovery")
			continue
		}

		// We need tenant_id to find a runtime — get it from the task record.
		var tenantID string
		_ = tc.db.QueryRowContext(ctx,
			`SELECT tenant_id FROM task_records WHERE task_id = $1`, taskID,
		).Scan(&tenantID)

		newRuntime, err := tc.selectRuntime(ctx, tenantID)
		if err != nil {
			log.Error().Err(err).Str("task_id", taskID.String()).Msg("[Coordinator] No runtime for recovery")
			_ = tc.store.MarkFailed(taskID, "no runtime available for recovery")
			continue
		}

		if err := tc.store.MarkDispatched(taskID, newRuntime.RuntimeID, newRuntime.Endpoint); err != nil {
			continue
		}

		task, err := tc.store.GetTask(taskID, tenantID)
		if err != nil {
			continue
		}
		task.RuntimeEndpoint = &newRuntime.Endpoint

		log.Info().
			Str("task_id", taskID.String()).
			Str("new_runtime", newRuntime.RuntimeID).
			Msg("[Coordinator] Redispatching recovered task")

		go tc.dispatchToRuntime(ctx, task, cp)
	}
}

func (tc *TaskCoordinator) markAndRecover(ctx context.Context, taskID uuid.UUID, runtimeID string) {
	// Use Background context: the caller's ctx is an HTTP request context that
	// will be cancelled once the response returns, which would abort the recovery.
	go tc.recoverRuntime(context.Background(), runtimeID)
}

// TaskSubmitRequest is the payload from external clients to /v1/tasks/submit.
type TaskSubmitRequest struct {
	TaskID         uuid.UUID       `json:"task_id,omitempty"`
	TenantID       string          `json:"tenant_id"`
	TaskType       string          `json:"task_type"` // "agent_workflow" | "robotics_workflow" | "single_inference" | "behavior_tree" | "execution_graph"
	TaskDefinition json.RawMessage `json:"task_definition"`
	IdempotencyKey string          `json:"idempotency_key,omitempty"`
	DeadlineAt     *time.Time      `json:"deadline_at,omitempty"`
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
	case "agent_workflow":
		steps, err := requireArrayField(definition, "steps")
		if err != nil {
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

func invalidTaskDefinition(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidTaskDefinition, fmt.Sprintf(format, args...))
}

func unwrapInvalidTaskDefinition(err error) string {
	msg := err.Error()
	prefix := ErrInvalidTaskDefinition.Error() + ": "
	return strings.TrimPrefix(msg, prefix)
}
