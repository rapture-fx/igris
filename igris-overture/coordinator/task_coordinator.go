// Package coordinator manages durable task lifecycle across runtime instances.
// It dispatches tasks to healthy runtimes, monitors heartbeats, and reassigns
// in-flight tasks when a runtime goes dark — making execution survive failures.
package coordinator

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
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
// Returns the task_id immediately; the caller polls /v1/tasks/:id/status.
func (tc *TaskCoordinator) Submit(ctx context.Context, req *TaskSubmitRequest) (*TaskRecord, error) {
	taskID := uuid.New()
	if req.TaskID != uuid.Nil {
		taskID = req.TaskID // caller can supply for idempotency
	}

	defBytes, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal task: %w", err)
	}

	idempotencyKey := req.IdempotencyKey
	if idempotencyKey == "" {
		idempotencyKey = taskID.String()
	}

	task := &TaskRecord{
		TaskID:         taskID,
		TenantID:       req.TenantID,
		Status:         TaskStatusPending,
		TaskDefinition: defBytes,
		IdempotencyKey: idempotencyKey,
		DeadlineAt:     req.DeadlineAt,
		CreatedAt:      time.Now(),
	}

	if err := tc.store.CreateTask(task); err != nil {
		return nil, fmt.Errorf("create task record: %w", err)
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
// task.TaskDefinition holds the client-submitted JSON which already contains
// task_type (and optionally containment). We merge in the control-plane fields.
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

	// Unmarshal stored task definition into a mutable map so we can inject
	// control-plane fields without losing the task_type / steps the client sent.
	var runtimePayload map[string]json.RawMessage
	if err := json.Unmarshal(task.TaskDefinition, &runtimePayload); err != nil {
		log.Error().Err(err).Str("task_id", task.TaskID.String()).Msg("[Coordinator] Unmarshal task definition")
		_ = tc.store.MarkFailed(task.TaskID, "invalid task definition")
		return
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

	switch result.Status {
	case "completed":
		_ = tc.store.MarkCompleted(task.TaskID)
	case "failed":
		_ = tc.store.MarkFailed(task.TaskID, result.FailureReason)
	}
}

type taskSubmitResult struct {
	TaskID        uuid.UUID          `json:"task_id"`
	Status        string             `json:"status"` // completed | checkpointed | failed
	Checkpoint    *CheckpointPayload `json:"checkpoint,omitempty"`
	FailureReason string             `json:"reason,omitempty"` // matches Rust TaskStatus::Failed { reason }
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
	TaskType       string          `json:"task_type"` // "agent_workflow" | "single_inference"
	TaskDefinition json.RawMessage `json:"task_definition"`
	IdempotencyKey string          `json:"idempotency_key,omitempty"`
	DeadlineAt     *time.Time      `json:"deadline_at,omitempty"`
}
