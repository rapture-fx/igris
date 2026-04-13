package coordinator

import (
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
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
	TaskID            uuid.UUID          `json:"task_id"`
	TenantID          string             `json:"tenant_id"`
	Status            TaskRecordStatus   `json:"status"`
	RuntimeID         *string            `json:"runtime_id,omitempty"`
	RuntimeEndpoint   *string            `json:"runtime_endpoint,omitempty"`
	TaskDefinition    json.RawMessage    `json:"task_definition"`
	LastCheckpoint    *CheckpointPayload `json:"last_checkpoint,omitempty"`
	ExecutionEnvelope json.RawMessage    `json:"execution_envelope,omitempty"`
	ExecutionReceipt  json.RawMessage    `json:"execution_receipt,omitempty"`
	Proof             *TaskProofState    `json:"proof,omitempty"`
	IdempotencyKey    string             `json:"idempotency_key"`
	FailureReason     *string            `json:"failure_reason,omitempty"`
	FailureDetails    *TaskFailureDetails `json:"failure_details,omitempty"`
	DeadlineAt        *time.Time         `json:"deadline_at,omitempty"`
	DispatchedAt      *time.Time         `json:"dispatched_at,omitempty"`
	CompletedAt       *time.Time         `json:"completed_at,omitempty"`
	CanceledAt        *time.Time         `json:"canceled_at,omitempty"`
	CreatedAt         time.Time          `json:"created_at"`
}

type TaskRecordStatus string

const (
	TaskStatusPending      TaskRecordStatus = "pending"
	TaskStatusDispatched   TaskRecordStatus = "dispatched"
	TaskStatusCheckpointed TaskRecordStatus = "checkpointed"
	TaskStatusCompleted    TaskRecordStatus = "completed"
	TaskStatusFailed       TaskRecordStatus = "failed"
	TaskStatusRecovering   TaskRecordStatus = "recovering"
	TaskStatusCanceled     TaskRecordStatus = "canceled"
)

type TaskDurabilityClass string

const (
	TaskDurabilityClassResumable                TaskDurabilityClass = "resumable"
	TaskDurabilityClassStreamingNonResumable    TaskDurabilityClass = "streaming_non_resumable"
	TaskFailureReasonStreamingResumeUnsupported                     = "streaming durable tasks do not support resume"
)

var ErrTaskTransitionRejected = errors.New("task transition rejected")

type TaskProofState struct {
	ExecutionID  string     `json:"execution_id,omitempty"`
	ExpectedHash string     `json:"expected_hash,omitempty"`
	StoredHash   string     `json:"stored_hash,omitempty"`
	Signature    string     `json:"signature,omitempty"`
	Status       string     `json:"status,omitempty"`
	CheckedAt    *time.Time `json:"checked_at,omitempty"`
}

type TaskFailureDetails struct {
	Source        string `json:"source,omitempty"`
	Operation     string `json:"operation,omitempty"`
	StatusCode    int    `json:"status_code,omitempty"`
	RejectionType string `json:"rejection_type,omitempty"`
	Message       string `json:"message,omitempty"`
}

const (
	proofPendingRefreshInterval  = 30 * time.Second
	proofMissingRefreshInterval  = 2 * time.Minute
	proofPresentRefreshInterval  = 10 * time.Minute
	proofVerifiedRefreshInterval = 30 * time.Minute
	proofMismatchRefreshInterval = 5 * time.Minute
	taskProofSyncTriggerName     = "task_record_proof_state_from_lineage"
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
	result, err := s.db.Exec(`
		UPDATE task_records
		SET status = $1, runtime_id = $2, runtime_endpoint = $3, dispatched_at = $4
		WHERE task_id = $5
		  AND status IN ($6, $7)`,
		TaskStatusDispatched, runtimeID, runtimeEndpoint, now, taskID,
		TaskStatusPending, TaskStatusRecovering,
	)
	return taskTransitionResult(result, err)
}

// SaveCheckpoint persists a checkpoint from the runtime and updates the task record.
func (s *CheckpointStore) SaveCheckpoint(cp *CheckpointPayload) error {
	if !TaskCheckpointWatermarkConsistent(cp) {
		return ErrTaskTransitionRejected
	}

	cpBytes, err := json.Marshal(cp)
	if err != nil {
		return fmt.Errorf("marshal checkpoint: %w", err)
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var currentCheckpointBytes []byte
	switch err := tx.QueryRow(`
		SELECT last_checkpoint
		FROM task_records
		WHERE task_id = $1
		FOR UPDATE`,
		cp.TaskID,
	).Scan(&currentCheckpointBytes); err {
	case nil:
	case sql.ErrNoRows:
		return ErrTaskTransitionRejected
	default:
		return fmt.Errorf("load current checkpoint: %w", err)
	}

	if currentCheckpoint, ok := decodeCheckpointPayload(currentCheckpointBytes); ok && !TaskCheckpointAdvances(currentCheckpoint, cp) {
		return ErrTaskTransitionRejected
	}

	result, err := tx.Exec(`
		UPDATE task_records
		SET status = $1, last_checkpoint = $2
		WHERE task_id = $3
		  AND status IN ($4, $5, $6)`,
		TaskStatusCheckpointed, cpBytes, cp.TaskID,
		TaskStatusDispatched, TaskStatusCheckpointed, TaskStatusRecovering,
	)
	if err != nil {
		return fmt.Errorf("update task record: %w", err)
	}
	if err := taskTransitionResult(result, nil); err != nil {
		return err
	}

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

	return tx.Commit()
}

func decodeCheckpointPayload(cpBytes []byte) (*CheckpointPayload, bool) {
	if len(cpBytes) == 0 {
		return nil, false
	}

	var cp CheckpointPayload
	if err := json.Unmarshal(cpBytes, &cp); err != nil {
		return nil, false
	}
	return &cp, true
}

// MarkCompleted transitions a task to COMPLETED.
func (s *CheckpointStore) MarkCompleted(taskID uuid.UUID) error {
	result, err := s.db.Exec(`
		UPDATE task_records
		SET status = $1, completed_at = NOW()
		WHERE task_id = $2
		  AND status IN ($3, $4, $5)`,
		TaskStatusCompleted, taskID,
		TaskStatusDispatched, TaskStatusCheckpointed, TaskStatusRecovering,
	)
	return taskTransitionResult(result, err)
}

// MarkFailed transitions a task to FAILED.
func (s *CheckpointStore) MarkFailed(taskID uuid.UUID, reason string) error {
	return s.MarkFailedWithDetails(taskID, reason, nil)
}

func (s *CheckpointStore) MarkFailedWithDetails(taskID uuid.UUID, reason string, details *TaskFailureDetails) error {
	var detailBytes []byte
	if details != nil {
		encoded, err := json.Marshal(details)
		if err != nil {
			return fmt.Errorf("marshal failure details: %w", err)
		}
		detailBytes = encoded
	}

	result, err := s.db.Exec(`
		UPDATE task_records
		SET status = $1, failure_reason = $2, failure_details = $3
		WHERE task_id = $4
		  AND status IN ($5, $6, $7)`,
		TaskStatusFailed, reason, nullRawJSON(detailBytes), taskID,
		TaskStatusDispatched, TaskStatusCheckpointed, TaskStatusRecovering,
	)
	return taskTransitionResult(result, err)
}

// MarkCanceled transitions a task to CANCELED.
func (s *CheckpointStore) MarkCanceled(taskID uuid.UUID) error {
	result, err := s.db.Exec(`
		UPDATE task_records
		SET status = $1, canceled_at = NOW()
		WHERE task_id = $2
		  AND status IN ($3, $4, $5, $6)`,
		TaskStatusCanceled, taskID,
		TaskStatusPending, TaskStatusDispatched, TaskStatusCheckpointed, TaskStatusRecovering,
	)
	return taskTransitionResult(result, err)
}

// SaveExecutionArtifacts persists signed runtime execution material on the task.
func (s *CheckpointStore) SaveExecutionArtifacts(taskID uuid.UUID, executionEnvelope, executionReceipt json.RawMessage) error {
	executionID, expectedHash, hasProofRefs := extractProofRefs(executionReceipt)
	_, err := s.db.Exec(`
		UPDATE task_records
		SET execution_envelope = COALESCE($1, execution_envelope),
		    execution_receipt = COALESCE($2, execution_receipt),
		    proof_execution_id = COALESCE($3, proof_execution_id),
		    proof_expected_hash = COALESCE($4, proof_expected_hash),
		    proof_stored_hash = CASE WHEN $5 THEN NULL ELSE proof_stored_hash END,
		    proof_signature = CASE WHEN $5 THEN NULL ELSE proof_signature END,
		    proof_status = CASE WHEN $5 THEN 'pending' ELSE proof_status END,
		    proof_checked_at = CASE WHEN $5 THEN NULL ELSE proof_checked_at END
		WHERE task_id = $6`,
		nullRawJSON(executionEnvelope), nullRawJSON(executionReceipt), nullString(executionID), nullString(expectedHash), hasProofRefs, taskID,
	)
	return err
}

func (s *CheckpointStore) SyncTaskProofState(taskID uuid.UUID, tenantID string) (*TaskProofState, error) {
	var executionID, expectedHash sql.NullString
	if err := s.db.QueryRow(`
		SELECT proof_execution_id, proof_expected_hash
		FROM task_records
		WHERE task_id = $1 AND tenant_id = $2`,
		taskID, tenantID,
	).Scan(&executionID, &expectedHash); err != nil {
		return nil, err
	}

	if !executionID.Valid || executionID.String == "" {
		return nil, nil
	}

	now := time.Now().UTC()
	state := buildTaskProofState(executionID.String, expectedHash.String, "", "", false, now)

	var storedHash, signature sql.NullString
	err := s.db.QueryRow(`
		SELECT receipt_hash, signature
		FROM execution_lineage
		WHERE execution_id = $1
		  AND (tenant_id = $2 OR tenant_id IS NULL)`,
		executionID.String, tenantID,
	).Scan(&storedHash, &signature)
	if err == sql.ErrNoRows {
		if updateErr := s.updateTaskProofState(taskID, state); updateErr != nil {
			return nil, updateErr
		}
		return state, nil
	}
	if err != nil {
		return nil, err
	}

	state = buildTaskProofState(executionID.String, expectedHash.String, storedHash.String, signature.String, true, now)

	if err := s.updateTaskProofState(taskID, state); err != nil {
		return nil, err
	}
	return state, nil
}

func (s *CheckpointStore) UpdateTaskProofStateByExecutionID(tenantID, executionID, expectedHash, storedHash, signature string) error {
	if executionID == "" {
		return nil
	}

	state := buildTaskProofState(executionID, expectedHash, storedHash, signature, true, time.Now().UTC())
	_, err := s.db.Exec(`
		UPDATE task_records
		SET proof_expected_hash = COALESCE(NULLIF($1, ''), proof_expected_hash),
		    proof_stored_hash = $2,
		    proof_signature = $3,
		    proof_status = $4,
		    proof_checked_at = $5
		WHERE tenant_id = $6
		  AND proof_execution_id = $7
	`, expectedHash, storedHash, signature, state.Status, state.CheckedAt, tenantID, executionID)
	return err
}

func (s *CheckpointStore) HasTaskProofSyncTrigger() (bool, error) {
	var exists bool
	err := s.db.QueryRow(`
		SELECT EXISTS (
			SELECT 1
			FROM pg_trigger t
			JOIN pg_class c ON c.oid = t.tgrelid
			WHERE t.tgname = $1
			  AND c.relname = 'execution_lineage'
			  AND NOT t.tgisinternal
		)
	`, taskProofSyncTriggerName).Scan(&exists)
	if err != nil {
		return false, err
	}
	return exists, nil
}

func (s *CheckpointStore) RefreshPendingProofStates(tenantID string, limit int) error {
	if limit <= 0 {
		limit = 20
	}

	rows, err := s.db.Query(`
		SELECT task_id, proof_status, proof_checked_at
		FROM task_records
		WHERE tenant_id = $1
		  AND proof_execution_id IS NOT NULL
		  AND COALESCE(proof_status, '') IN ('', 'pending', 'missing')
		ORDER BY COALESCE(completed_at, created_at) DESC
		LIMIT $2`,
		tenantID, limit,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	type proofRefreshCandidate struct {
		taskID uuid.UUID
		proof  *TaskProofState
	}
	var candidates []proofRefreshCandidate
	for rows.Next() {
		var taskID uuid.UUID
		var status sql.NullString
		var checkedAt sql.NullTime
		if err := rows.Scan(&taskID, &status, &checkedAt); err != nil {
			return err
		}
		var proof *TaskProofState
		if status.Valid || checkedAt.Valid {
			proof = &TaskProofState{Status: status.String}
			if checkedAt.Valid {
				proof.CheckedAt = &checkedAt.Time
			}
		}
		if TaskProofNeedsReadReconciliation(proof, time.Now().UTC()) {
			candidates = append(candidates, proofRefreshCandidate{taskID: taskID, proof: proof})
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, candidate := range candidates {
		if _, err := s.SyncTaskProofState(candidate.taskID, tenantID); err != nil && err != sql.ErrNoRows {
			return err
		}
	}
	return nil
}

func (s *CheckpointStore) updateTaskProofState(taskID uuid.UUID, proof *TaskProofState) error {
	if proof == nil {
		return nil
	}
	_, err := s.db.Exec(`
		UPDATE task_records
		SET proof_execution_id = $1,
		    proof_expected_hash = $2,
		    proof_stored_hash = $3,
		    proof_signature = $4,
		    proof_status = $5,
		    proof_checked_at = $6
		WHERE task_id = $7`,
		nullString(proof.ExecutionID),
		nullString(proof.ExpectedHash),
		nullString(proof.StoredHash),
		nullString(proof.Signature),
		nullString(proof.Status),
		proof.CheckedAt,
		taskID,
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
		       task_definition, last_checkpoint, execution_envelope, execution_receipt,
		       proof_execution_id, proof_expected_hash, proof_stored_hash, proof_signature, proof_status, proof_checked_at,
		       idempotency_key, failure_reason, failure_details,
		       deadline_at, dispatched_at, completed_at, canceled_at, created_at
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
		       task_definition, last_checkpoint, execution_envelope, execution_receipt,
		       proof_execution_id, proof_expected_hash, proof_stored_hash, proof_signature, proof_status, proof_checked_at,
		       idempotency_key, failure_reason, failure_details,
		       deadline_at, dispatched_at, completed_at, canceled_at, created_at
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
		       task_definition, last_checkpoint, execution_envelope, execution_receipt,
		       proof_execution_id, proof_expected_hash, proof_stored_hash, proof_signature, proof_status, proof_checked_at,
		       idempotency_key, failure_reason, failure_details,
		       deadline_at, dispatched_at, completed_at, canceled_at, created_at
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

// GetAllTaskSteps aggregates WAL entries across all checkpoint rows for a task,
// deduplicates by entry_id, and returns them sorted by step_index ascending.
// This is necessary because checkpoints are delta-based (each row contains only
// the entries written since the prior checkpoint), not cumulative.
func (s *CheckpointStore) GetAllTaskSteps(taskID uuid.UUID) ([]WalEntry, error) {
	rows, err := s.db.Query(`
		SELECT wal_entries FROM wal_checkpoints
		WHERE task_id = $1
		ORDER BY step_index ASC`,
		taskID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	seen := make(map[uuid.UUID]struct{})
	var all []WalEntry
	for rows.Next() {
		var cpBytes []byte
		if err := rows.Scan(&cpBytes); err != nil {
			return nil, err
		}
		var cp CheckpointPayload
		if err := json.Unmarshal(cpBytes, &cp); err != nil {
			return nil, err
		}
		for _, entry := range cp.WalEntries {
			if _, dup := seen[entry.EntryID]; !dup {
				seen[entry.EntryID] = struct{}{}
				all = append(all, entry)
			}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	sort.Slice(all, func(i, j int) bool {
		return all[i].StepIndex < all[j].StepIndex
	})
	return all, nil
}

// GetRecoveringTasks returns tasks in RECOVERING state with their last checkpoints.
func (s *CheckpointStore) GetRecoveringTasks() ([]*TaskRecord, error) {
	rows, err := s.db.Query(`
		SELECT task_id, tenant_id, status, runtime_id, runtime_endpoint,
		       task_definition, last_checkpoint, execution_envelope, execution_receipt,
		       proof_execution_id, proof_expected_hash, proof_stored_hash, proof_signature, proof_status, proof_checked_at,
		       idempotency_key, failure_reason, failure_details,
		       deadline_at, dispatched_at, completed_at, canceled_at, created_at
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
	var envelopeBytes []byte
	var receiptBytes []byte
	var failureDetailBytes []byte
	var proofExecutionID sql.NullString
	var proofExpectedHash sql.NullString
	var proofStoredHash sql.NullString
	var proofSignature sql.NullString
	var proofStatus sql.NullString
	var proofCheckedAt sql.NullTime
	err := row.Scan(
		&t.TaskID, &t.TenantID, &t.Status, &t.RuntimeID, &t.RuntimeEndpoint,
		&defBytes, &cpBytes, &envelopeBytes, &receiptBytes,
		&proofExecutionID, &proofExpectedHash, &proofStoredHash, &proofSignature, &proofStatus, &proofCheckedAt,
		&t.IdempotencyKey, &t.FailureReason, &failureDetailBytes,
		&t.DeadlineAt, &t.DispatchedAt, &t.CompletedAt, &t.CanceledAt, &t.CreatedAt,
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
	if len(envelopeBytes) > 0 {
		t.ExecutionEnvelope = envelopeBytes
	}
	if len(receiptBytes) > 0 {
		t.ExecutionReceipt = receiptBytes
	}
	if proofExecutionID.Valid || proofExpectedHash.Valid || proofStoredHash.Valid || proofSignature.Valid || proofStatus.Valid || proofCheckedAt.Valid {
		t.Proof = &TaskProofState{
			ExecutionID:  proofExecutionID.String,
			ExpectedHash: proofExpectedHash.String,
			StoredHash:   proofStoredHash.String,
			Signature:    proofSignature.String,
			Status:       proofStatus.String,
		}
		if proofCheckedAt.Valid {
			t.Proof.CheckedAt = &proofCheckedAt.Time
		}
	}
	if len(failureDetailBytes) > 0 {
		var details TaskFailureDetails
		if err := json.Unmarshal(failureDetailBytes, &details); err == nil {
			t.FailureDetails = &details
		}
	}
	return &t, nil
}

func decodeHexToBytes(h string) []byte {
	b, _ := hex.DecodeString(h)
	return b
}

func TaskAllowsRuntimeMutation(status TaskRecordStatus) bool {
	switch status {
	case TaskStatusDispatched, TaskStatusCheckpointed, TaskStatusRecovering:
		return true
	default:
		return false
	}
}

func TaskAllowsDispatch(status TaskRecordStatus) bool {
	switch status {
	case TaskStatusPending, TaskStatusRecovering:
		return true
	default:
		return false
	}
}

func TaskAllowsRecoveryRedispatch(status TaskRecordStatus) bool {
	return status == TaskStatusRecovering
}

func TaskAllowsCancellation(status TaskRecordStatus) bool {
	switch status {
	case TaskStatusPending, TaskStatusDispatched, TaskStatusCheckpointed, TaskStatusRecovering:
		return true
	default:
		return false
	}
}

func TaskDurabilityClassForDefinition(taskDefinition json.RawMessage) TaskDurabilityClass {
	if len(taskDefinition) == 0 {
		return TaskDurabilityClassResumable
	}

	var payload struct {
		Type   string `json:"type"`
		Stream bool   `json:"stream"`
	}
	if err := json.Unmarshal(taskDefinition, &payload); err != nil {
		return TaskDurabilityClassResumable
	}
	if payload.Type == "single_inference" && payload.Stream {
		return TaskDurabilityClassStreamingNonResumable
	}
	return TaskDurabilityClassResumable
}

func TaskSupportsRecoveryResume(task *TaskRecord) bool {
	if task == nil {
		return false
	}
	return TaskDurabilityClassForDefinition(task.TaskDefinition) == TaskDurabilityClassResumable
}

func TaskRecoveryRedispatchEligible(task *TaskRecord) bool {
	if task == nil {
		return false
	}
	return TaskAllowsRecoveryRedispatch(task.Status) && TaskSupportsRecoveryResume(task)
}

func TaskRecoverySkipReason(task *TaskRecord) string {
	if task == nil {
		return ""
	}
	if TaskAllowsRecoveryRedispatch(task.Status) {
		if !TaskSupportsRecoveryResume(task) {
			return "streaming_resume_unsupported"
		}
		return ""
	}

	switch task.Status {
	case TaskStatusCanceled:
		return "task_canceled"
	case TaskStatusCompleted:
		return "task_completed"
	case TaskStatusFailed:
		if task.FailureReason != nil {
			switch *task.FailureReason {
			case "no runtime available for recovery":
				return "no_runtime_available_for_recovery"
			case TaskFailureReasonStreamingResumeUnsupported:
				return "streaming_resume_unsupported"
			}
		}
		return "task_failed"
	default:
		return ""
	}
}

func TaskCheckpointAdvances(current *CheckpointPayload, next *CheckpointPayload) bool {
	if next == nil {
		return false
	}
	if current == nil {
		return true
	}
	return next.ResumeToken.LastCommittedStep > current.ResumeToken.LastCommittedStep
}

func TaskCheckpointWatermarkConsistent(cp *CheckpointPayload) bool {
	if cp == nil {
		return false
	}
	for _, entry := range cp.WalEntries {
		if entry.StepIndex > cp.ResumeToken.LastCommittedStep {
			return false
		}
	}
	return true
}

func TaskProofNeedsRefresh(proof *TaskProofState, now time.Time) bool {
	if proof == nil {
		return false
	}
	if proof.CheckedAt == nil {
		return true
	}

	age := now.Sub(*proof.CheckedAt)
	switch proof.Status {
	case "", "pending":
		return age >= proofPendingRefreshInterval
	case "missing":
		return age >= proofMissingRefreshInterval
	case "present":
		return age >= proofPresentRefreshInterval
	case "mismatch":
		return age >= proofMismatchRefreshInterval
	case "verified":
		return age >= proofVerifiedRefreshInterval
	default:
		return age >= proofMissingRefreshInterval
	}
}

func TaskProofNeedsReadReconciliation(proof *TaskProofState, now time.Time) bool {
	if proof == nil {
		return false
	}

	switch proof.Status {
	case "", "pending", "missing":
		return TaskProofNeedsRefresh(proof, now)
	default:
		return false
	}
}

func buildTaskProofState(executionID, expectedHash, storedHash, signature string, proofFound bool, checkedAt time.Time) *TaskProofState {
	state := &TaskProofState{
		ExecutionID:  executionID,
		ExpectedHash: expectedHash,
		CheckedAt:    &checkedAt,
	}

	if !proofFound {
		state.Status = "missing"
		return state
	}

	state.StoredHash = storedHash
	state.Signature = signature
	switch {
	case expectedHash != "" && storedHash == expectedHash:
		state.Status = "verified"
	case expectedHash != "":
		state.Status = "mismatch"
	default:
		state.Status = "present"
	}
	return state
}

func taskTransitionResult(result sql.Result, err error) error {
	if err != nil {
		return err
	}
	if result == nil {
		return ErrTaskTransitionRejected
	}
	rowsAffected, rowsErr := result.RowsAffected()
	if rowsErr != nil {
		return rowsErr
	}
	if rowsAffected == 0 {
		return ErrTaskTransitionRejected
	}
	return nil
}

func nullRawJSON(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}
	return raw
}

func nullString(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func extractProofRefs(receipt json.RawMessage) (executionID, expectedHash string, ok bool) {
	if len(receipt) == 0 {
		return "", "", false
	}

	var payload struct {
		ExecutionID string `json:"execution_id"`
		ReceiptHash string `json:"receipt_hash"`
		Hash        string `json:"hash"`
	}
	if err := json.Unmarshal(receipt, &payload); err != nil {
		return "", "", false
	}
	if payload.ExecutionID == "" {
		return "", "", false
	}
	if payload.ReceiptHash != "" {
		return payload.ExecutionID, payload.ReceiptHash, true
	}
	return payload.ExecutionID, payload.Hash, true
}
