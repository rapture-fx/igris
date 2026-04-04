package coordinator

import (
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// CheckpointStore persists task checkpoints to PostgreSQL.
// On runtime failure, the TaskCoordinator reads the last checkpoint
// to build a ResumeToken for dispatch to a healthy runtime.
type CheckpointStore struct {
	db *sql.DB
}

func NewCheckpointStore(db *sql.DB) *CheckpointStore {
	return &CheckpointStore{db: db}
}

// TaskRecord is the durable state of a task tracked by Overture.
type TaskRecord struct {
	TaskID          uuid.UUID          `json:"task_id"`
	TenantID        string             `json:"tenant_id"`
	Status          TaskRecordStatus   `json:"status"`
	RuntimeID       *string            `json:"runtime_id,omitempty"`
	RuntimeEndpoint *string            `json:"runtime_endpoint,omitempty"`
	TaskDefinition  json.RawMessage    `json:"task_definition"`
	LastCheckpoint  *CheckpointPayload `json:"last_checkpoint,omitempty"`
	IdempotencyKey  string             `json:"idempotency_key"`
	FailureReason   *string            `json:"failure_reason,omitempty"`
	DeadlineAt      *time.Time         `json:"deadline_at,omitempty"`
	DispatchedAt    *time.Time         `json:"dispatched_at,omitempty"`
	CompletedAt     *time.Time         `json:"completed_at,omitempty"`
	CreatedAt       time.Time          `json:"created_at"`
}

type TaskRecordStatus string

const (
	TaskStatusPending      TaskRecordStatus = "pending"
	TaskStatusDispatched   TaskRecordStatus = "dispatched"
	TaskStatusCheckpointed TaskRecordStatus = "checkpointed"
	TaskStatusCompleted    TaskRecordStatus = "completed"
	TaskStatusFailed       TaskRecordStatus = "failed"
	TaskStatusRecovering   TaskRecordStatus = "recovering"
)

// ResumeToken mirrors igris_wal::ResumeToken exactly.
// It is nested inside CheckpointPayload, matching the Rust JSON shape.
type ResumeToken struct {
	LastCommittedStep uint32 `json:"last_committed_step"`
	CheckpointDigest  string `json:"checkpoint_digest"` // hex-encoded [u8;32]
	RuntimeID         string `json:"runtime_id"`
}

// CheckpointPayload mirrors igris_wal::CheckpointPayload exactly.
// The resume_token field is nested, matching the Rust JSON shape:
//
//	{ "task_id": "...", "resume_token": { "last_committed_step": N, ... }, "wal_entries": [...] }
//
// Overture persists it so any runtime can resume the task after failure.
// The Metadata field is task-type-specific opaque JSON stored and forwarded
// verbatim — e.g. behavior tree tasks carry blackboard_state and tick_count here.
type CheckpointPayload struct {
	TaskID      uuid.UUID       `json:"task_id"`
	ResumeToken ResumeToken     `json:"resume_token"`
	WalEntries  []WalEntry      `json:"wal_entries"`
	Metadata    json.RawMessage `json:"metadata,omitempty"`
	CapturedAt  time.Time       `json:"captured_at,omitempty"`
}

// WalEntry mirrors the Rust WalEntry for cross-language JSON compatibility.
type WalEntry struct {
	EntryID      uuid.UUID   `json:"entry_id"`
	TaskID       uuid.UUID   `json:"task_id"`
	StepIndex    uint32      `json:"step_index"`
	StepType     interface{} `json:"step_type"`
	Status       string      `json:"status"`
	InputDigest  string      `json:"input_digest"`            // hex
	OutputDigest *string     `json:"output_digest,omitempty"` // hex, nil until committed
	TimestampMs  uint64      `json:"timestamp_ms"`
	RuntimeID    string      `json:"runtime_id"`
	Signature    *string     `json:"signature,omitempty"` // base64
}

// CreateTask inserts a new TaskRecord in PENDING state.
// It returns true when a new row was inserted and false when the idempotency
// key already existed.
func (s *CheckpointStore) CreateTask(task *TaskRecord) (bool, error) {
	defBytes, err := json.Marshal(task.TaskDefinition)
	if err != nil {
		return false, fmt.Errorf("marshal task definition: %w", err)
	}
	result, err := s.db.Exec(`
		INSERT INTO task_records
			(task_id, tenant_id, status, task_definition, idempotency_key, deadline_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (idempotency_key) DO NOTHING`,
		task.TaskID, task.TenantID, TaskStatusPending, defBytes,
		task.IdempotencyKey, task.DeadlineAt,
	)
	if err != nil {
		return false, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return rowsAffected == 1, nil
}

// MarkDispatched transitions a task to DISPATCHED and records which runtime took it.
func (s *CheckpointStore) MarkDispatched(taskID uuid.UUID, runtimeID, runtimeEndpoint string) error {
	now := time.Now()
	_, err := s.db.Exec(`
		UPDATE task_records
		SET status = $1, runtime_id = $2, runtime_endpoint = $3, dispatched_at = $4
		WHERE task_id = $5`,
		TaskStatusDispatched, runtimeID, runtimeEndpoint, now, taskID,
	)
	return err
}

// SaveCheckpoint persists a checkpoint from the runtime and updates the task record.
func (s *CheckpointStore) SaveCheckpoint(cp *CheckpointPayload) error {
	cpBytes, err := json.Marshal(cp)
	if err != nil {
		return fmt.Errorf("marshal checkpoint: %w", err)
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO wal_checkpoints
			(checkpoint_id, task_id, step_index, checkpoint_digest, wal_entries, received_at)
		VALUES ($1, $2, $3, $4, $5, NOW())`,
		uuid.New(), cp.TaskID, cp.ResumeToken.LastCommittedStep,
		decodeHexToBytes(cp.ResumeToken.CheckpointDigest), cpBytes,
	)
	if err != nil {
		return fmt.Errorf("insert checkpoint: %w", err)
	}

	_, err = tx.Exec(`
		UPDATE task_records
		SET status = $1, last_checkpoint = $2
		WHERE task_id = $3`,
		TaskStatusCheckpointed, cpBytes, cp.TaskID,
	)
	if err != nil {
		return fmt.Errorf("update task record: %w", err)
	}

	return tx.Commit()
}

// MarkCompleted transitions a task to COMPLETED.
func (s *CheckpointStore) MarkCompleted(taskID uuid.UUID) error {
	_, err := s.db.Exec(`
		UPDATE task_records SET status = $1, completed_at = NOW() WHERE task_id = $2`,
		TaskStatusCompleted, taskID,
	)
	return err
}

// MarkFailed transitions a task to FAILED.
func (s *CheckpointStore) MarkFailed(taskID uuid.UUID, reason string) error {
	_, err := s.db.Exec(`
		UPDATE task_records SET status = $1, failure_reason = $2 WHERE task_id = $3`,
		TaskStatusFailed, reason, taskID,
	)
	return err
}

// MarkRecovering transitions all DISPATCHED tasks on a failed runtime to RECOVERING.
func (s *CheckpointStore) MarkRecovering(runtimeID string) ([]uuid.UUID, error) {
	rows, err := s.db.Query(`
		UPDATE task_records
		SET status = $1
		WHERE runtime_id = $2 AND status IN ('dispatched', 'checkpointed')
		RETURNING task_id`,
		TaskStatusRecovering, runtimeID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// GetTask returns a task record by ID, scoped to tenant.
func (s *CheckpointStore) GetTask(taskID uuid.UUID, tenantID string) (*TaskRecord, error) {
	row := s.db.QueryRow(`
		SELECT task_id, tenant_id, status, runtime_id, runtime_endpoint,
		       task_definition, last_checkpoint, idempotency_key, failure_reason,
		       deadline_at, dispatched_at, completed_at, created_at
		FROM task_records
		WHERE task_id = $1 AND tenant_id = $2`,
		taskID, tenantID,
	)
	return scanTaskRecord(row)
}

// GetTaskByIdempotencyKey returns a task record by tenant and idempotency key.
func (s *CheckpointStore) GetTaskByIdempotencyKey(tenantID, idempotencyKey string) (*TaskRecord, error) {
	row := s.db.QueryRow(`
		SELECT task_id, tenant_id, status, runtime_id, runtime_endpoint,
		       task_definition, last_checkpoint, idempotency_key, failure_reason,
		       deadline_at, dispatched_at, completed_at, created_at
		FROM task_records
		WHERE tenant_id = $1 AND idempotency_key = $2`,
		tenantID, idempotencyKey,
	)
	return scanTaskRecord(row)
}

// GetTasksByTenant returns recent tasks for a tenant.
func (s *CheckpointStore) GetTasksByTenant(tenantID string, limit int) ([]*TaskRecord, error) {
	rows, err := s.db.Query(`
		SELECT task_id, tenant_id, status, runtime_id, runtime_endpoint,
		       task_definition, last_checkpoint, idempotency_key, failure_reason,
		       deadline_at, dispatched_at, completed_at, created_at
		FROM task_records
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2`,
		tenantID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*TaskRecord
	for rows.Next() {
		t, err := scanTaskRecord(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

// GetLastCheckpoint returns the most recent checkpoint for a task.
func (s *CheckpointStore) GetLastCheckpoint(taskID uuid.UUID) (*CheckpointPayload, error) {
	var cpBytes []byte
	err := s.db.QueryRow(`
		SELECT wal_entries FROM wal_checkpoints
		WHERE task_id = $1
		ORDER BY step_index DESC
		LIMIT 1`,
		taskID,
	).Scan(&cpBytes)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var cp CheckpointPayload
	if err := json.Unmarshal(cpBytes, &cp); err != nil {
		return nil, err
	}
	return &cp, nil
}

// GetRecoveringTasks returns tasks in RECOVERING state with their last checkpoints.
func (s *CheckpointStore) GetRecoveringTasks() ([]*TaskRecord, error) {
	rows, err := s.db.Query(`
		SELECT task_id, tenant_id, status, runtime_id, runtime_endpoint,
		       task_definition, last_checkpoint, idempotency_key, failure_reason,
		       deadline_at, dispatched_at, completed_at, created_at
		FROM task_records
		WHERE status = 'recovering'
		ORDER BY created_at ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*TaskRecord
	for rows.Next() {
		t, err := scanTaskRecord(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, rows.Err()
}

// scanner abstracts sql.Row and sql.Rows for scanTaskRecord.
type scanner interface {
	Scan(dest ...any) error
}

func scanTaskRecord(row scanner) (*TaskRecord, error) {
	var t TaskRecord
	var defBytes []byte
	var cpBytes []byte
	err := row.Scan(
		&t.TaskID, &t.TenantID, &t.Status, &t.RuntimeID, &t.RuntimeEndpoint,
		&defBytes, &cpBytes, &t.IdempotencyKey, &t.FailureReason,
		&t.DeadlineAt, &t.DispatchedAt, &t.CompletedAt, &t.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	t.TaskDefinition = defBytes
	if cpBytes != nil {
		var cp CheckpointPayload
		if err := json.Unmarshal(cpBytes, &cp); err == nil {
			t.LastCheckpoint = &cp
		}
	}
	return &t, nil
}

func decodeHexToBytes(h string) []byte {
	b, _ := hex.DecodeString(h)
	return b
}
