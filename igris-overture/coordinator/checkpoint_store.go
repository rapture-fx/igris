package coordinator

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/Igris-inertial/system/igris-overture/internal"
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

// DB exposes the underlying *sql.DB for callers that need to issue ad-hoc
// queries against tables managed by the same connection (e.g.
// runtime_instances for cryptographic verification key lookup). Prefer
// adding a typed method on CheckpointStore when the query is reusable.
func (s *CheckpointStore) DB() *sql.DB {
	if s == nil {
		return nil
	}
	return s.db
}

// TaskRecord is the durable state of a task tracked by Overture.
type TaskRecord struct {
	TaskID               uuid.UUID               `json:"task_id"`
	TenantID             string                  `json:"tenant_id"`
	Status               TaskRecordStatus        `json:"status"`
	RuntimeID            *string                 `json:"runtime_id,omitempty"`
	RuntimeEndpoint      *string                 `json:"runtime_endpoint,omitempty"`
	TaskDefinition       json.RawMessage         `json:"task_definition"`
	LastCheckpoint       *CheckpointPayload      `json:"last_checkpoint,omitempty"`
	ExecutionEnvelope    json.RawMessage         `json:"execution_envelope,omitempty"`
	ExecutionReceipt     json.RawMessage         `json:"execution_receipt,omitempty"`
	Proof                *TaskProofState         `json:"proof,omitempty"`
	AgentIdentity        AgentIdentity           `json:"agent_identity,omitempty"`
	RequiredCapabilities []string                `json:"required_capabilities,omitempty"`
	CredentialRequests   []CredentialRequest     `json:"credential_requests,omitempty"`
	PermissionEnvelope   *TaskPermissionEnvelope `json:"permission_envelope,omitempty"`
	IdempotencyKey       string                  `json:"idempotency_key"`
	FailureReason        *string                 `json:"failure_reason,omitempty"`
	FailureDetails       *TaskFailureDetails     `json:"failure_details,omitempty"`
	DeadlineAt           *time.Time              `json:"deadline_at,omitempty"`
	DispatchedAt         *time.Time              `json:"dispatched_at,omitempty"`
	CompletedAt          *time.Time              `json:"completed_at,omitempty"`
	CanceledAt           *time.Time              `json:"canceled_at,omitempty"`
	CreatedAt            time.Time               `json:"created_at"`

	// ExecutedTarget records which Action execution target actually ran the
	// task (hosted_api, webhook, local_runtime, mock_demo, or hybrid_fallback
	// once that resolver lands). It is informational — operators read it on
	// run detail; nothing in the dispatch pipeline branches on it.
	ExecutedTarget *string `json:"executed_target,omitempty"`
	// FallbackReason is set only when a future hybrid_fallback resolver
	// actually switched surfaces. Until that resolver exists, this stays nil.
	FallbackReason *string `json:"fallback_reason,omitempty"`

	// RegisteredAgentID and RegisteredAgentName attribute the run to a tenant
	// registry agent when the caller supplied agent_id or agent_name.
	RegisteredAgentID   *uuid.UUID `json:"registered_agent_id,omitempty"`
	RegisteredAgentName string     `json:"registered_agent_name,omitempty"`

	// BoundAction is present only for the explicit Clock 3B contract-bound
	// Action path. It links this durable task to one immutable SDK contract
	// version and one immutable executable-target snapshot without changing
	// Runtime receipts or Action Protocol Evidence.
	BoundAction *BoundActionRunIdentity `json:"bound_action,omitempty"`
}

type BoundActionRunIdentity struct {
	BindingID              uuid.UUID `json:"binding_id"`
	ContractHash           string    `json:"contract_hash"`
	TargetActionID         uuid.UUID `json:"target_action_id"`
	TargetVersionHash      string    `json:"target_version_hash"`
	BusinessIdempotencyKey string    `json:"business_idempotency_key"`
	RequestFingerprint     string    `json:"-"`
}

type TaskRecordStatus string

const (
	TaskStatusPending          TaskRecordStatus = "pending"
	TaskStatusDispatched       TaskRecordStatus = "dispatched"
	TaskStatusCheckpointed     TaskRecordStatus = "checkpointed"
	TaskStatusCompleted        TaskRecordStatus = "completed"
	TaskStatusFailed           TaskRecordStatus = "failed"
	TaskStatusRecovering       TaskRecordStatus = "recovering"
	TaskStatusCanceled         TaskRecordStatus = "canceled"
	TaskStatusApprovalRequired TaskRecordStatus = "approval_required"
)

type TaskDurabilityClass string

const (
	TaskDurabilityClassResumable                TaskDurabilityClass = "resumable"
	TaskDurabilityClassStreamingNonResumable    TaskDurabilityClass = "streaming_non_resumable"
	TaskFailureReasonStreamingResumeUnsupported                     = "streaming durable tasks do not support resume"
	TaskFailureReasonInvalidRecoveryCheckpoint                      = "invalid checkpoint for recovery"
)

var ErrTaskTransitionRejected = errors.New("task transition rejected")
var ErrCredentialReferenceRevoked = errors.New("credential reference revoked")
var ErrInvalidCumulativeCheckpoint = errors.New("invalid cumulative checkpoint")

type TaskProofState struct {
	ExecutionID  string     `json:"execution_id,omitempty"`
	ExpectedHash string     `json:"expected_hash,omitempty"`
	StoredHash   string     `json:"stored_hash,omitempty"`
	Signature    string     `json:"signature,omitempty"`
	Status       string     `json:"status,omitempty"`
	CheckedAt    *time.Time `json:"checked_at,omitempty"`

	// Persisted verification summary — set the last time
	// /v1/tasks/:id/proof/verify ran a fresh cryptographic + chain-link check.
	// Nil pointers / empty strings mean "verification has not run yet". These
	// hold only booleans + a short reason + a timestamp — never receipt
	// contents, payloads, or secrets.
	Verified           *bool      `json:"verified,omitempty"`
	HashValid          *bool      `json:"hash_valid,omitempty"`
	SignatureMatches   *bool      `json:"signature_matches,omitempty"`
	RuntimeKeyFound    *bool      `json:"runtime_key_found,omitempty"`
	ChainLinkValid     *bool      `json:"chain_link_valid,omitempty"`
	VerificationReason string     `json:"verification_reason,omitempty"`
	VerifiedAt         *time.Time `json:"verified_at,omitempty"`
}

// TaskProofVerificationSummary is the safe outcome of a fresh proof
// verification, persisted onto task_records by PersistTaskProofVerification.
type TaskProofVerificationSummary struct {
	Verified         bool
	HashValid        bool
	SignatureMatches bool
	RuntimeKeyFound  bool
	// ChainChecked indicates whether chain-link verification was attempted at
	// all (false ⇒ ChainLinkValid is left as "unknown"/NULL, not persisted).
	ChainChecked   bool
	ChainLinkValid bool
	Reason         string
}

type TaskFailureDetails struct {
	Source                    string  `json:"source,omitempty"`
	Operation                 string  `json:"operation,omitempty"`
	StatusCode                int     `json:"status_code,omitempty"`
	RejectionType             string  `json:"rejection_type,omitempty"`
	Message                   string  `json:"message,omitempty"`
	StepIndex                 *uint32 `json:"step_index,omitempty"`
	Domain                    string  `json:"domain,omitempty"`
	NodeID                    string  `json:"node_id,omitempty"`
	RequestedLastStep         *uint32 `json:"requested_last_step,omitempty"`
	LocalLastStep             *uint32 `json:"local_last_step,omitempty"`
	RequestedCheckpointDigest string  `json:"requested_checkpoint_digest,omitempty"`
	LocalCheckpointDigest     string  `json:"local_checkpoint_digest,omitempty"`
	ResumeCheckpointProvided  *bool   `json:"resume_checkpoint_provided,omitempty"`
	EffectState               string  `json:"effect_state,omitempty"`
	ReconciliationRequired    bool    `json:"reconciliation_required,omitempty"`
	TargetErrorCode           string  `json:"target_error_code,omitempty"`
	TargetHost                string  `json:"target_host,omitempty"`
	TargetResponseDigest      string  `json:"target_response_digest,omitempty"`
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

func (e WalEntry) MarshalJSON() ([]byte, error) {
	type walEntryJSON struct {
		EntryID      uuid.UUID        `json:"entry_id"`
		TaskID       uuid.UUID        `json:"task_id"`
		StepIndex    uint32           `json:"step_index"`
		StepType     interface{}      `json:"step_type"`
		Status       any              `json:"status"`
		InputDigest  json.RawMessage  `json:"input_digest"`
		OutputDigest *json.RawMessage `json:"output_digest,omitempty"`
		TimestampMs  uint64           `json:"timestamp_ms"`
		RuntimeID    string           `json:"runtime_id"`
		Signature    *json.RawMessage `json:"signature,omitempty"`
	}

	inputDigest, err := marshalHexByteArrayField(e.InputDigest, 32)
	if err != nil {
		return nil, err
	}

	var outputDigest *json.RawMessage
	if e.OutputDigest != nil {
		encoded, err := marshalHexByteArrayField(*e.OutputDigest, 32)
		if err != nil {
			return nil, err
		}
		outputDigest = &encoded
	}

	var signature *json.RawMessage
	if e.Signature != nil {
		encoded, err := marshalBinaryArrayField(*e.Signature)
		if err != nil {
			return nil, err
		}
		signature = &encoded
	}

	return json.Marshal(walEntryJSON{
		EntryID:      e.EntryID,
		TaskID:       e.TaskID,
		StepIndex:    e.StepIndex,
		StepType:     e.StepType,
		Status:       marshalWalStatusField(e.Status),
		InputDigest:  inputDigest,
		OutputDigest: outputDigest,
		TimestampMs:  e.TimestampMs,
		RuntimeID:    e.RuntimeID,
		Signature:    signature,
	})
}

func (e *WalEntry) UnmarshalJSON(data []byte) error {
	type walEntryJSON struct {
		EntryID      uuid.UUID       `json:"entry_id"`
		TaskID       uuid.UUID       `json:"task_id"`
		StepIndex    uint32          `json:"step_index"`
		StepType     interface{}     `json:"step_type"`
		Status       json.RawMessage `json:"status"`
		InputDigest  json.RawMessage `json:"input_digest"`
		OutputDigest json.RawMessage `json:"output_digest"`
		TimestampMs  uint64          `json:"timestamp_ms"`
		RuntimeID    string          `json:"runtime_id"`
		Signature    json.RawMessage `json:"signature"`
	}

	var decoded walEntryJSON
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}

	inputDigest, err := unmarshalHexByteArrayField(decoded.InputDigest, 32)
	if err != nil {
		return fmt.Errorf("decode input_digest: %w", err)
	}

	outputDigest, err := unmarshalOptionalHexByteArrayField(decoded.OutputDigest, 32)
	if err != nil {
		return fmt.Errorf("decode output_digest: %w", err)
	}

	signature, err := unmarshalOptionalBinaryArrayField(decoded.Signature)
	if err != nil {
		return fmt.Errorf("decode signature: %w", err)
	}

	*e = WalEntry{
		EntryID:      decoded.EntryID,
		TaskID:       decoded.TaskID,
		StepIndex:    decoded.StepIndex,
		StepType:     decoded.StepType,
		Status:       unmarshalWalStatusField(decoded.Status),
		InputDigest:  inputDigest,
		OutputDigest: outputDigest,
		TimestampMs:  decoded.TimestampMs,
		RuntimeID:    decoded.RuntimeID,
		Signature:    signature,
	}
	return nil
}

func marshalHexByteArrayField(value string, expectedLen int) (json.RawMessage, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return json.Marshal(trimmed)
	}

	decoded, err := hex.DecodeString(trimmed)
	if err != nil || (expectedLen > 0 && len(decoded) != expectedLen) {
		return json.Marshal(trimmed)
	}
	return json.Marshal(decoded)
}

func unmarshalHexByteArrayField(data []byte, expectedLen int) (string, error) {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return "", nil
	}

	if trimmed[0] == '"' {
		var value string
		if err := json.Unmarshal(trimmed, &value); err != nil {
			return "", err
		}
		if value == "" {
			return "", nil
		}
		if decoded, err := hex.DecodeString(value); err == nil && (expectedLen <= 0 || len(decoded) == expectedLen) {
			return strings.ToLower(value), nil
		}
		if decoded, ok := decodeBase64ByteArrayField(value, expectedLen); ok {
			return hex.EncodeToString(decoded), nil
		}
		return strings.ToLower(value), nil
	}

	var raw []byte
	if err := json.Unmarshal(trimmed, &raw); err != nil {
		return "", err
	}
	if expectedLen > 0 && len(raw) != expectedLen {
		return "", fmt.Errorf("expected %d bytes, got %d", expectedLen, len(raw))
	}
	return hex.EncodeToString(raw), nil
}

func decodeBase64ByteArrayField(value string, expectedLen int) ([]byte, bool) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil, false
	}
	encodings := []*base64.Encoding{
		base64.StdEncoding,
		base64.RawStdEncoding,
		base64.URLEncoding,
		base64.RawURLEncoding,
	}
	for _, encoding := range encodings {
		decoded, err := encoding.DecodeString(trimmed)
		if err == nil && (expectedLen <= 0 || len(decoded) == expectedLen) {
			return decoded, true
		}
	}
	return nil, false
}

func unmarshalOptionalHexByteArrayField(data []byte, expectedLen int) (*string, error) {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return nil, nil
	}
	value, err := unmarshalHexByteArrayField(trimmed, expectedLen)
	if err != nil {
		return nil, err
	}
	return &value, nil
}

func marshalBinaryArrayField(value string) (json.RawMessage, error) {
	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return json.Marshal(value)
	}
	return json.Marshal(decoded)
}

func unmarshalOptionalBinaryArrayField(data []byte) (*string, error) {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return nil, nil
	}
	if trimmed[0] == '"' {
		var value string
		if err := json.Unmarshal(trimmed, &value); err != nil {
			return nil, err
		}
		return &value, nil
	}
	var raw []byte
	if err := json.Unmarshal(trimmed, &raw); err != nil {
		return nil, err
	}
	encoded := base64.StdEncoding.EncodeToString(raw)
	return &encoded, nil
}

func unmarshalWalStatusField(data []byte) string {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 || bytes.Equal(trimmed, []byte("null")) {
		return ""
	}

	if trimmed[0] == '"' {
		var value string
		if err := json.Unmarshal(trimmed, &value); err == nil {
			return normalizeWalStatus(value)
		}
		return ""
	}

	var object map[string]json.RawMessage
	if err := json.Unmarshal(trimmed, &object); err != nil {
		return ""
	}
	for key := range object {
		return normalizeWalStatus(key)
	}
	return ""
}

func marshalWalStatusField(status string) any {
	switch normalizeWalStatus(status) {
	case "intent":
		return "Intent"
	case "executing":
		return "Executing"
	case "committed", "completed":
		return "Committed"
	case "failed":
		return "Failed"
	default:
		return status
	}
}

func normalizeWalStatus(status string) string {
	return strings.ToLower(strings.TrimSpace(status))
}

// CreateTask inserts a new TaskRecord in PENDING state.
// It returns true when a new row was inserted and false when the idempotency
// key already existed for this tenant. Idempotency is tenant-scoped: the
// (tenant_id, idempotency_key) conflict target deduplicates only within the
// same tenant, so different tenants may reuse the same idempotency key.
func (s *CheckpointStore) CreateTask(task *TaskRecord) (bool, error) {
	defBytes, err := json.Marshal(task.TaskDefinition)
	if err != nil {
		return false, fmt.Errorf("marshal task definition: %w", err)
	}
	if task.BoundAction != nil {
		tx, err := s.db.Begin()
		if err != nil {
			return false, err
		}
		defer tx.Rollback()
		result, err := tx.Exec(`
			INSERT INTO task_records
				(task_id, tenant_id, status, task_definition, idempotency_key, deadline_at,
				 registered_agent_id, registered_agent_name, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
			ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
			task.TaskID, task.TenantID, TaskStatusPending, defBytes,
			task.IdempotencyKey, task.DeadlineAt,
			nullUUID(task.RegisteredAgentID), task.RegisteredAgentName,
		)
		if err != nil {
			return false, err
		}
		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return false, err
		}
		if rowsAffected == 0 {
			if err := tx.Commit(); err != nil {
				return false, err
			}
			return false, nil
		}
		if err := insertBoundActionRun(context.Background(), tx, task); err != nil {
			return false, err
		}
		if err := tx.Commit(); err != nil {
			return false, err
		}
		return true, nil
	}
	result, err := s.db.Exec(`
		INSERT INTO task_records
			(task_id, tenant_id, status, task_definition, idempotency_key, deadline_at,
			 registered_agent_id, registered_agent_name, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
		ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
		task.TaskID, task.TenantID, TaskStatusPending, defBytes,
		task.IdempotencyKey, task.DeadlineAt,
		// registered_agent_name is NOT NULL DEFAULT '' (migration 062); an
		// unattributed run stores '' rather than NULL so anonymous submissions
		// do not violate the constraint.
		nullUUID(task.RegisteredAgentID), task.RegisteredAgentName,
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

func insertBoundActionRun(ctx context.Context, execer sqlExecerContext, task *TaskRecord) error {
	if task == nil || task.BoundAction == nil {
		return nil
	}
	bound := task.BoundAction
	if bound.BindingID == uuid.Nil || bound.TargetActionID == uuid.Nil ||
		strings.TrimSpace(bound.ContractHash) == "" ||
		strings.TrimSpace(bound.TargetVersionHash) == "" ||
		strings.TrimSpace(bound.BusinessIdempotencyKey) == "" ||
		strings.TrimSpace(bound.RequestFingerprint) == "" {
		return fmt.Errorf("bound action identity is incomplete")
	}
	_, err := execer.ExecContext(ctx, `
		INSERT INTO contract_bound_action_runs (
			task_id, tenant_id, binding_id, contract_hash, target_action_id,
			target_version_hash, business_idempotency_key, request_fingerprint
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
		task.TaskID, task.TenantID, bound.BindingID, bound.ContractHash,
		bound.TargetActionID, bound.TargetVersionHash, bound.BusinessIdempotencyKey,
		bound.RequestFingerprint,
	)
	return err
}

func (s *CheckpointStore) GetBoundActionRunByIdempotency(ctx context.Context, tenantID, key string) (*BoundActionRunIdentity, error) {
	var bound BoundActionRunIdentity
	err := s.db.QueryRowContext(ctx, `
		SELECT binding_id, contract_hash, target_action_id, target_version_hash,
		       business_idempotency_key, request_fingerprint
		FROM contract_bound_action_runs
		WHERE tenant_id = $1 AND business_idempotency_key = $2`,
		tenantID, key,
	).Scan(
		&bound.BindingID, &bound.ContractHash, &bound.TargetActionID,
		&bound.TargetVersionHash, &bound.BusinessIdempotencyKey,
		&bound.RequestFingerprint,
	)
	if err != nil {
		return nil, err
	}
	return &bound, nil
}

func (s *CheckpointStore) GetBoundActionRun(ctx context.Context, taskID uuid.UUID, tenantID string) (*BoundActionRunIdentity, error) {
	var bound BoundActionRunIdentity
	err := s.db.QueryRowContext(ctx, `
		SELECT binding_id, contract_hash, target_action_id, target_version_hash,
		       business_idempotency_key, request_fingerprint
		FROM contract_bound_action_runs
		WHERE task_id = $1 AND tenant_id = $2`,
		taskID, tenantID,
	).Scan(
		&bound.BindingID, &bound.ContractHash, &bound.TargetActionID,
		&bound.TargetVersionHash, &bound.BusinessIdempotencyKey,
		&bound.RequestFingerprint,
	)
	if err != nil {
		return nil, err
	}
	return &bound, nil
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
	if !TaskCheckpointEntriesBelongToTask(cp) {
		return ErrTaskTransitionRejected
	}
	if !TaskCheckpointEntriesHaveStableIDs(cp) {
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

// IsTypedReconciliationFailure accepts only the narrow, machine-readable
// Runtime signal emitted for a target's explicit unknown-effect response.
// Human-readable failure strings never establish reconciliation eligibility.
func IsTypedReconciliationFailure(details *TaskFailureDetails) bool {
	if details == nil ||
		!details.ReconciliationRequired ||
		details.EffectState != "unknown_effect_state" ||
		details.TargetErrorCode != "idempotency_unresolved" ||
		details.StatusCode < 400 || details.StatusCode > 599 ||
		len(details.TargetResponseDigest) != 64 ||
		len(strings.TrimSpace(details.TargetHost)) < 1 ||
		len(strings.TrimSpace(details.TargetHost)) > 253 {
		return false
	}
	decoded, err := hex.DecodeString(details.TargetResponseDigest)
	return err == nil && len(decoded) == sha256.Size
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

	if IsTypedReconciliationFailure(details) {
		tx, err := s.db.Begin()
		if err != nil {
			return s.markFailedRecord(taskID, reason, detailBytes)
		}
		defer func() { _ = tx.Rollback() }()

		result, err := tx.Exec(`
			UPDATE task_records
			SET status = $1, failure_reason = $2, failure_details = $3
			WHERE task_id = $4
			  AND status IN ($5, $6, $7)`,
			TaskStatusFailed, reason, nullRawJSON(detailBytes), taskID,
			TaskStatusDispatched, TaskStatusCheckpointed, TaskStatusRecovering,
		)
		if err := taskTransitionResult(result, err); err != nil {
			return err
		}

		// The observation is eligible only for an immutable contract-bound run
		// whose binding required a business idempotency identity. The inserted
		// row snapshots managed identities; no client metadata is trusted.
		_, err = tx.Exec(`
			INSERT INTO contract_bound_action_reconciliation_events (
				tenant_id, task_id, binding_id, contract_hash,
				target_action_id, target_version_hash,
				business_idempotency_digest, event_type,
				observed_effect_state, actor_type, actor_id, reason,
				external_reference_type, external_reference_value,
				target_host, source_status_code
			)
			SELECT r.tenant_id, r.task_id, r.binding_id, r.contract_hash,
			       r.target_action_id, r.target_version_hash,
			       encode(sha256(convert_to(r.business_idempotency_key, 'UTF8')), 'hex'),
			       'unresolved_effect_observed', 'unknown_effect_state',
			       'runtime', COALESCE(NULLIF(t.runtime_id, ''), 'runtime:unknown'),
			       'Runtime reported a typed unknown consequential effect; automatic replay is refused',
			       'runtime_response_digest', $2, $3, $4
			FROM contract_bound_action_runs r
			JOIN action_contract_execution_bindings b
			  ON b.id = r.binding_id
			 AND b.tenant_id = r.tenant_id
			 AND b.contract_hash = r.contract_hash
			 AND b.target_action_id = r.target_action_id
			 AND b.target_version_hash = r.target_version_hash
			JOIN task_records t
			  ON t.task_id = r.task_id AND t.tenant_id = r.tenant_id
			WHERE r.task_id = $1
			  AND b.idempotency_required = TRUE
			ON CONFLICT DO NOTHING`,
			taskID, details.TargetResponseDigest, strings.TrimSpace(details.TargetHost), details.StatusCode,
		)
		if err != nil {
			// Migration 072 is manual. If its table is unavailable (or the
			// observation insert otherwise fails), the task must still become
			// terminal failed so recovery can never replay an uncertain effect.
			_ = tx.Rollback()
			return s.markFailedRecord(taskID, reason, detailBytes)
		}
		if err := tx.Commit(); err != nil {
			return s.ensureTaskFailedRecord(taskID, reason, detailBytes)
		}
		return nil
	}

	return s.markFailedRecord(taskID, reason, detailBytes)
}

func (s *CheckpointStore) markFailedRecord(taskID uuid.UUID, reason string, detailBytes []byte) error {
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

func (s *CheckpointStore) ensureTaskFailedRecord(taskID uuid.UUID, reason string, detailBytes []byte) error {
	err := s.markFailedRecord(taskID, reason, detailBytes)
	if !errors.Is(err, ErrTaskTransitionRejected) {
		return err
	}
	var status TaskRecordStatus
	if queryErr := s.db.QueryRow(`
		SELECT status FROM task_records WHERE task_id = $1`,
		taskID,
	).Scan(&status); queryErr == nil && status == TaskStatusFailed {
		return nil
	}
	return err
}

// StampExecutedTarget records which Action execution target (hosted_api,
// webhook, local_runtime, mock_demo) actually ran a task. Tenant-scoped to
// prevent cross-tenant writes. Silently no-ops if the task does not match.
func (s *CheckpointStore) StampExecutedTarget(taskID uuid.UUID, tenantID, executedTarget string) error {
	_, err := s.db.Exec(`
		UPDATE task_records
		SET executed_target = $3
		WHERE task_id = $1 AND tenant_id = $2`,
		taskID, tenantID, executedTarget,
	)
	return err
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
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
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
	if err != nil {
		return err
	}
	if err := saveRoboticsReceiptAudit(tx, taskID, executionEnvelope, executionReceipt); err != nil {
		return err
	}
	if err := saveAIToolReceiptAudit(tx, taskID, executionEnvelope, executionReceipt); err != nil {
		return err
	}
	contextRecord, err := buildTaskExecutionContextRecord(tx, taskID, executionEnvelope, executionReceipt)
	if err != nil {
		return err
	}
	if err := saveExecutionContext(tx, contextRecord); err != nil {
		return err
	}
	return tx.Commit()
}

// RoboticsAuditReceipt is a query-optimized reference to a signed Runtime
// receipt for a governed ROS2 action.
type RoboticsAuditReceipt struct {
	TaskID             uuid.UUID       `json:"task_id"`
	TenantID           string          `json:"tenant_id"`
	RuntimeID          string          `json:"runtime_id,omitempty"`
	ExecutionID        string          `json:"execution_id"`
	PolicyDecisionID   string          `json:"policy_decision_id"`
	PolicyDecisionHash string          `json:"policy_decision_hash,omitempty"`
	GovernedActionHash string          `json:"governed_action_hash,omitempty"`
	RobotAction        string          `json:"robot_action"`
	RoutingDecision    string          `json:"routing_decision"`
	ReceiptHash        string          `json:"receipt_hash,omitempty"`
	ReceiptSignature   string          `json:"receipt_signature,omitempty"`
	EnvelopeSignature  string          `json:"envelope_signature,omitempty"`
	ViolationOccurred  bool            `json:"violation_occurred"`
	Violation          string          `json:"violation,omitempty"`
	ExecutionEnvelope  json.RawMessage `json:"execution_envelope,omitempty"`
	ExecutionReceipt   json.RawMessage `json:"execution_receipt,omitempty"`
	PersistedAt        time.Time       `json:"persisted_at"`
}

type RoboticsAuditReceiptFilter struct {
	TaskID           *uuid.UUID
	PolicyDecisionID string
	RobotAction      string
	Limit            int
}

type AIToolAuditReceipt struct {
	TaskID            uuid.UUID       `json:"task_id"`
	TenantID          string          `json:"tenant_id"`
	RuntimeID         string          `json:"runtime_id,omitempty"`
	ExecutionID       string          `json:"execution_id"`
	EnvelopeID        string          `json:"envelope_id,omitempty"`
	Capability        string          `json:"capability,omitempty"`
	ToolName          string          `json:"tool_name"`
	ToolActionHash    string          `json:"tool_action_hash,omitempty"`
	RoutingDecision   string          `json:"routing_decision"`
	RequestHash       string          `json:"request_hash,omitempty"`
	ResponseHash      string          `json:"response_hash,omitempty"`
	ReceiptHash       string          `json:"receipt_hash,omitempty"`
	ReceiptSignature  string          `json:"receipt_signature,omitempty"`
	EnvelopeSignature string          `json:"envelope_signature,omitempty"`
	ViolationOccurred bool            `json:"violation_occurred"`
	Violation         string          `json:"violation,omitempty"`
	ExecutionEnvelope json.RawMessage `json:"execution_envelope,omitempty"`
	ExecutionReceipt  json.RawMessage `json:"execution_receipt,omitempty"`
	PersistedAt       time.Time       `json:"persisted_at"`
}

type AIToolAuditReceiptFilter struct {
	TaskID     *uuid.UUID
	EnvelopeID string
	Capability string
	ToolName   string
	Limit      int
}

type AICredentialReferenceAudit struct {
	ReferenceID     string     `json:"reference_id"`
	EnvelopeID      string     `json:"envelope_id"`
	TaskID          uuid.UUID  `json:"task_id"`
	TenantID        string     `json:"tenant_id"`
	Tool            string     `json:"tool,omitempty"`
	Capability      string     `json:"capability,omitempty"`
	Scope           string     `json:"scope,omitempty"`
	ExpiresAtUnixMs int64      `json:"expires_at_unix_ms"`
	Revocable       bool       `json:"revocable"`
	RevokedAt       *time.Time `json:"revoked_at,omitempty"`
	PersistedAt     time.Time  `json:"persisted_at"`
}

type AICredentialReferenceFilter struct {
	TaskID         *uuid.UUID
	Capability     string
	Tool           string
	IncludeRevoked bool
	Limit          int
}

type AIToolAuditReplay struct {
	TaskID                    uuid.UUID       `json:"task_id"`
	TenantID                  string          `json:"tenant_id"`
	RuntimeID                 string          `json:"runtime_id,omitempty"`
	ExecutionID               string          `json:"execution_id"`
	EnvelopeID                string          `json:"envelope_id,omitempty"`
	Capability                string          `json:"capability,omitempty"`
	ToolName                  string          `json:"tool_name"`
	ToolActionHash            string          `json:"tool_action_hash,omitempty"`
	RoutingDecision           string          `json:"routing_decision"`
	RequestHash               string          `json:"request_hash,omitempty"`
	ResponseHash              string          `json:"response_hash,omitempty"`
	ReceiptHash               string          `json:"receipt_hash,omitempty"`
	ReceiptSignature          string          `json:"receipt_signature,omitempty"`
	RuntimeSignature          string          `json:"runtime_signature,omitempty"`
	RuntimeSignaturePresent   bool            `json:"runtime_signature_present"`
	RuntimeSignatureVerified  bool            `json:"runtime_signature_verified"`
	RuntimeSignatureKeySource string          `json:"runtime_signature_key_source,omitempty"`
	RuntimePublicKeyEd25519   string          `json:"-"`
	EnvelopeSignature         string          `json:"envelope_signature,omitempty"`
	ViolationOccurred         bool            `json:"violation_occurred"`
	Violation                 string          `json:"violation,omitempty"`
	Valid                     bool            `json:"valid"`
	ValidationErrors          []string        `json:"validation_errors,omitempty"`
	ExecutionEnvelope         json.RawMessage `json:"execution_envelope,omitempty"`
	ExecutionReceipt          json.RawMessage `json:"execution_receipt,omitempty"`
	PersistedAt               time.Time       `json:"persisted_at"`
}

type RoboticsAuditReplay struct {
	TaskID                    uuid.UUID       `json:"task_id"`
	TenantID                  string          `json:"tenant_id"`
	RuntimeID                 string          `json:"runtime_id,omitempty"`
	PolicyDecisionID          string          `json:"policy_decision_id"`
	PolicyVersion             string          `json:"policy_version,omitempty"`
	RobotAction               string          `json:"robot_action"`
	RobotNodeID               string          `json:"robot_node_id,omitempty"`
	RobotTarget               string          `json:"robot_target,omitempty"`
	Permit                    bool            `json:"permit"`
	Reason                    string          `json:"reason,omitempty"`
	ExecutionID               string          `json:"execution_id"`
	RoutingDecision           string          `json:"routing_decision"`
	RuntimeSignature          string          `json:"runtime_signature,omitempty"`
	RuntimeSignaturePresent   bool            `json:"runtime_signature_present"`
	RuntimeSignatureVerified  bool            `json:"runtime_signature_verified"`
	RuntimeSignatureKeySource string          `json:"runtime_signature_key_source,omitempty"`
	RuntimePublicKeyEd25519   string          `json:"-"`
	PolicySignature           string          `json:"policy_signature,omitempty"`
	PolicyDecisionHash        string          `json:"policy_decision_hash,omitempty"`
	GovernedActionHash        string          `json:"governed_action_hash,omitempty"`
	ReceiptHash               string          `json:"receipt_hash,omitempty"`
	ReceiptSignature          string          `json:"receipt_signature,omitempty"`
	ViolationOccurred         bool            `json:"violation_occurred"`
	Violation                 string          `json:"violation,omitempty"`
	Valid                     bool            `json:"valid"`
	ValidationErrors          []string        `json:"validation_errors,omitempty"`
	SignedPolicyDecision      json.RawMessage `json:"signed_policy_decision,omitempty"`
	ExecutionEnvelope         json.RawMessage `json:"execution_envelope,omitempty"`
	ExecutionReceipt          json.RawMessage `json:"execution_receipt,omitempty"`
	PersistedAt               time.Time       `json:"persisted_at"`
}

type roboticsArtifactRefs struct {
	ExecutionID        string
	TenantID           string
	PolicyDecisionID   string
	PolicyDecisionHash string
	GovernedActionHash string
	RobotAction        string
	RoutingDecision    string
	ReceiptHash        string
	ReceiptSignature   string
	EnvelopeSignature  string
	ViolationOccurred  bool
	Violation          string
}

func roboticsAuditRefs(executionEnvelope, executionReceipt json.RawMessage) (*roboticsArtifactRefs, bool) {
	if len(executionEnvelope) == 0 || len(executionReceipt) == 0 {
		return nil, false
	}

	var envelope struct {
		ExecutionID        string  `json:"execution_id"`
		TenantID           *string `json:"tenant_id"`
		PolicyDecisionID   string  `json:"policy_decision_id"`
		PolicyDecisionHash string  `json:"policy_decision_hash"`
		GovernedActionHash string  `json:"governed_action_hash"`
		RoutingDecision    string  `json:"routing_decision"`
		EnvelopeSignature  string  `json:"signature"`
		Violation          string  `json:"violation"`
	}
	if err := json.Unmarshal(executionEnvelope, &envelope); err != nil {
		return nil, false
	}
	if envelope.PolicyDecisionID == "" || envelope.ExecutionID == "" {
		return nil, false
	}
	if !roboticsRoutingDecisionAuditable(envelope.RoutingDecision) {
		return nil, false
	}
	action := robotActionFromRoutingDecision(envelope.RoutingDecision)

	var receipt struct {
		ExecutionID       string `json:"execution_id"`
		ReceiptHash       string `json:"receipt_hash"`
		Hash              string `json:"hash"`
		Signature         string `json:"signature"`
		ViolationOccurred bool   `json:"violation_occurred"`
	}
	if err := json.Unmarshal(executionReceipt, &receipt); err != nil {
		return nil, false
	}
	if receipt.ExecutionID != "" && receipt.ExecutionID != envelope.ExecutionID {
		return nil, false
	}
	receiptHash := receipt.ReceiptHash
	if receiptHash == "" {
		receiptHash = receipt.Hash
	}

	tenantID := ""
	if envelope.TenantID != nil {
		tenantID = *envelope.TenantID
	}

	return &roboticsArtifactRefs{
		ExecutionID:        envelope.ExecutionID,
		TenantID:           tenantID,
		PolicyDecisionID:   envelope.PolicyDecisionID,
		PolicyDecisionHash: envelope.PolicyDecisionHash,
		GovernedActionHash: envelope.GovernedActionHash,
		RobotAction:        action,
		RoutingDecision:    envelope.RoutingDecision,
		ReceiptHash:        receiptHash,
		ReceiptSignature:   receipt.Signature,
		EnvelopeSignature:  envelope.EnvelopeSignature,
		ViolationOccurred:  receipt.ViolationOccurred || envelope.Violation != "",
		Violation:          envelope.Violation,
	}, true
}

func robotActionFromRoutingDecision(routingDecision string) string {
	const prefix = "ros2:"
	if !strings.HasPrefix(routingDecision, prefix) {
		return ""
	}
	action := strings.TrimSpace(strings.TrimPrefix(routingDecision, prefix))
	if action == "" {
		return ""
	}
	return action
}

func roboticsRoutingDecisionAuditable(routingDecision string) bool {
	return strings.HasPrefix(routingDecision, "ros2:") || strings.HasPrefix(routingDecision, "runtime:robotics:")
}

func governedPolicyDecisionHash(decision signedGovernedPolicyDecision) string {
	canonical, _ := json.Marshal(canonicalGovernedPolicyDecision(decision))
	sum := sha256.Sum256(canonical)
	return fmt.Sprintf("%x", sum[:])
}

func (s *CheckpointStore) SaveRoboticsPolicyDecisions(taskID uuid.UUID, decisions []signedGovernedPolicyDecision) error {
	if len(decisions) == 0 {
		return nil
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, decision := range decisions {
		if decision.DecisionID == "" || decision.Action.ActionName == "" {
			continue
		}
		raw, err := json.Marshal(decision)
		if err != nil {
			return fmt.Errorf("marshal signed policy decision: %w", err)
		}
		_, err = tx.Exec(`
			INSERT INTO robotics_policy_decision_audit (
				policy_decision_id,
				task_id,
				tenant_id,
				runtime_id,
				policy_version,
				robot_action,
				robot_node_id,
				robot_target,
				permit,
				reason,
				policy_decision_hash,
				policy_signature,
				signed_policy_decision,
				issued_at_unix_ms,
				expires_at_unix_ms,
				persisted_at
			)
			VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7, NULLIF($8, ''), $9, $10, $11, $12, $13, $14, $15, NOW())
			ON CONFLICT (policy_decision_id) DO UPDATE
			SET runtime_id = EXCLUDED.runtime_id,
			    policy_version = EXCLUDED.policy_version,
			    robot_action = EXCLUDED.robot_action,
			    robot_node_id = EXCLUDED.robot_node_id,
			    robot_target = EXCLUDED.robot_target,
			    permit = EXCLUDED.permit,
			    reason = EXCLUDED.reason,
			    policy_decision_hash = EXCLUDED.policy_decision_hash,
			    policy_signature = EXCLUDED.policy_signature,
			    signed_policy_decision = EXCLUDED.signed_policy_decision,
			    issued_at_unix_ms = EXCLUDED.issued_at_unix_ms,
			    expires_at_unix_ms = EXCLUDED.expires_at_unix_ms,
			    persisted_at = NOW()`,
			decision.DecisionID,
			taskID,
			decision.TenantID,
			stringPtrValue(decision.RuntimeID),
			decision.PolicyVersion,
			decision.Action.ActionName,
			decision.Action.NodeID,
			stringPtrValue(decision.Action.Target),
			decision.Permit,
			decision.Reason,
			governedPolicyDecisionHash(decision),
			decision.Signature,
			nullRawJSON(raw),
			decision.IssuedAtUnixMs,
			decision.ExpiresAtUnixMs,
		)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func taskPermissionEnvelopeHash(envelope TaskPermissionEnvelope) string {
	canonical, _ := json.Marshal(canonicalTaskPermissionEnvelope(envelope))
	sum := sha256.Sum256(canonical)
	return fmt.Sprintf("%x", sum[:])
}

func (s *CheckpointStore) SaveTaskPermissionEnvelope(taskID uuid.UUID, envelope *TaskPermissionEnvelope) error {
	if envelope == nil || envelope.EnvelopeID == "" {
		return nil
	}
	raw, err := json.Marshal(envelope)
	if err != nil {
		return fmt.Errorf("marshal task permission envelope: %w", err)
	}
	requiredCapabilities, err := json.Marshal(envelope.RequiredCapabilities)
	if err != nil {
		return fmt.Errorf("marshal required capabilities: %w", err)
	}
	credentialRefs, err := json.Marshal(envelope.CredentialRefs)
	if err != nil {
		return fmt.Errorf("marshal credential refs: %w", err)
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO ai_task_permission_audit (
			envelope_id, task_id, tenant_id, runtime_id, agent_id, principal_id,
			acting_on_behalf_of, required_capabilities, credential_refs,
			permission_envelope, envelope_hash, envelope_signature,
			signer_key_version, issued_at_unix_ms, expires_at_unix_ms, persisted_at
		)
		VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''),
		        NULLIF($7, ''), $8, $9, $10, $11, $12, NULLIF($13, ''), $14, $15, NOW())
		ON CONFLICT (envelope_id) DO UPDATE
		SET runtime_id = EXCLUDED.runtime_id,
		    agent_id = EXCLUDED.agent_id,
		    principal_id = EXCLUDED.principal_id,
		    acting_on_behalf_of = EXCLUDED.acting_on_behalf_of,
		    required_capabilities = EXCLUDED.required_capabilities,
		    credential_refs = EXCLUDED.credential_refs,
		    permission_envelope = EXCLUDED.permission_envelope,
		    envelope_hash = EXCLUDED.envelope_hash,
		    envelope_signature = EXCLUDED.envelope_signature,
		    signer_key_version = EXCLUDED.signer_key_version,
		    issued_at_unix_ms = EXCLUDED.issued_at_unix_ms,
		    expires_at_unix_ms = EXCLUDED.expires_at_unix_ms,
		    persisted_at = NOW()`,
		envelope.EnvelopeID,
		taskID,
		envelope.TenantID,
		stringPtrValue(envelope.RuntimeID),
		envelope.AgentIdentity.AgentID,
		envelope.AgentIdentity.PrincipalID,
		envelope.AgentIdentity.ActingOnBehalfOf,
		nullRawJSON(requiredCapabilities),
		nullRawJSON(credentialRefs),
		nullRawJSON(raw),
		taskPermissionEnvelopeHash(*envelope),
		envelope.Signature,
		stringPtrValue(envelope.SignerKeyVersion),
		envelope.IssuedAtUnixMs,
		envelope.ExpiresAtUnixMs,
	)
	if err != nil {
		return err
	}

	refsByCapability := make(map[string][]string)
	for _, ref := range envelope.CredentialRefs {
		if ref.Capability != "" && ref.ReferenceID != "" {
			refsByCapability[ref.Capability] = append(refsByCapability[ref.Capability], ref.ReferenceID)
		}
	}
	for _, decision := range envelope.Decisions {
		refIDs, _ := json.Marshal(refsByCapability[decision.Capability])
		_, err = tx.Exec(`
			INSERT INTO ai_capability_decision_audit (
				envelope_id, task_id, tenant_id, runtime_id, capability, permit,
				reason, policy_version, credential_ref_ids, persisted_at
			)
			VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7, $8, $9, NOW())
			ON CONFLICT (envelope_id, capability) DO UPDATE
			SET runtime_id = EXCLUDED.runtime_id,
			    permit = EXCLUDED.permit,
			    reason = EXCLUDED.reason,
			    policy_version = EXCLUDED.policy_version,
			    credential_ref_ids = EXCLUDED.credential_ref_ids,
			    persisted_at = NOW()`,
			envelope.EnvelopeID,
			taskID,
			envelope.TenantID,
			stringPtrValue(envelope.RuntimeID),
			decision.Capability,
			decision.Permit,
			decision.Reason,
			decision.PolicyVersion,
			nullRawJSON(refIDs),
		)
		if err != nil {
			return err
		}
	}
	for _, ref := range envelope.CredentialRefs {
		if ref.ReferenceID == "" {
			continue
		}
		_, err = tx.Exec(`
			INSERT INTO ai_credential_ref_audit (
				reference_id, envelope_id, task_id, tenant_id, tool, capability,
				scope, expires_at_unix_ms, revocable, persisted_at
			)
			VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), $8, $9, NOW())
			ON CONFLICT (reference_id) DO UPDATE
			SET envelope_id = EXCLUDED.envelope_id,
			    tool = EXCLUDED.tool,
			    capability = EXCLUDED.capability,
			    scope = EXCLUDED.scope,
			    expires_at_unix_ms = EXCLUDED.expires_at_unix_ms,
			    revocable = EXCLUDED.revocable,
			    persisted_at = NOW()`,
			ref.ReferenceID,
			envelope.EnvelopeID,
			taskID,
			envelope.TenantID,
			ref.Tool,
			ref.Capability,
			ref.Scope,
			ref.ExpiresAtUnixMs,
			ref.Revocable,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func stringPtrValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func (s *CheckpointStore) SaveRoboticsReceiptAudit(taskID uuid.UUID, executionEnvelope, executionReceipt json.RawMessage) error {
	return saveRoboticsReceiptAudit(s.db, taskID, executionEnvelope, executionReceipt)
}

type roboticsReceiptAuditExecer interface {
	Exec(query string, args ...interface{}) (sql.Result, error)
}

func saveRoboticsReceiptAudit(execer roboticsReceiptAuditExecer, taskID uuid.UUID, executionEnvelope, executionReceipt json.RawMessage) error {
	refs, ok := roboticsAuditRefs(executionEnvelope, executionReceipt)
	if !ok {
		return nil
	}

	_, err := execer.Exec(`
		INSERT INTO robotics_receipt_audit (
			task_id,
			tenant_id,
			runtime_id,
			execution_id,
			policy_decision_id,
			policy_decision_hash,
			governed_action_hash,
			robot_action,
			routing_decision,
			receipt_hash,
			receipt_signature,
			envelope_signature,
			violation_occurred,
			violation,
			execution_envelope,
			execution_receipt,
			persisted_at
		)
		SELECT
			tr.task_id,
			COALESCE(NULLIF($2, ''), tr.tenant_id),
			tr.runtime_id,
			$3,
			$4,
			NULLIF($5, ''),
			NULLIF($6, ''),
				COALESCE(NULLIF($7, ''), pd.robot_action, 'unknown'),
			$8,
			NULLIF($9, ''),
			NULLIF($10, ''),
			NULLIF($11, ''),
			$12,
			NULLIF($13, ''),
			$14,
			$15,
			NOW()
			FROM task_records tr
			LEFT JOIN robotics_policy_decision_audit pd
			  ON pd.task_id = tr.task_id
			 AND pd.policy_decision_id = $4
			WHERE tr.task_id = $1
		ON CONFLICT (task_id, execution_id, policy_decision_id) DO UPDATE
		SET receipt_hash = EXCLUDED.receipt_hash,
		    receipt_signature = EXCLUDED.receipt_signature,
		    envelope_signature = EXCLUDED.envelope_signature,
		    violation_occurred = EXCLUDED.violation_occurred,
		    violation = EXCLUDED.violation,
		    execution_envelope = EXCLUDED.execution_envelope,
		    execution_receipt = EXCLUDED.execution_receipt,
		    persisted_at = NOW()`,
		taskID,
		refs.TenantID,
		refs.ExecutionID,
		refs.PolicyDecisionID,
		refs.PolicyDecisionHash,
		refs.GovernedActionHash,
		refs.RobotAction,
		refs.RoutingDecision,
		refs.ReceiptHash,
		refs.ReceiptSignature,
		refs.EnvelopeSignature,
		refs.ViolationOccurred,
		refs.Violation,
		nullRawJSON(executionEnvelope),
		nullRawJSON(executionReceipt),
	)
	return err
}

type aiToolArtifactRefs struct {
	ExecutionID       string
	TenantID          string
	EnvelopeID        string
	Capability        string
	ToolName          string
	ToolActionHash    string
	RoutingDecision   string
	RequestHash       string
	ResponseHash      string
	ReceiptHash       string
	ReceiptSignature  string
	EnvelopeSignature string
	ViolationOccurred bool
	Violation         string
}

func aiToolAuditRefs(executionEnvelope, executionReceipt json.RawMessage) (*aiToolArtifactRefs, bool) {
	if len(executionEnvelope) == 0 {
		return nil, false
	}
	var envelope struct {
		ExecutionID        string  `json:"execution_id"`
		TenantID           *string `json:"tenant_id"`
		Model              string  `json:"model"`
		PolicyDecisionID   string  `json:"policy_decision_id"`
		PolicyDecisionHash string  `json:"policy_decision_hash"`
		GovernedActionHash string  `json:"governed_action_hash"`
		RoutingDecision    string  `json:"routing_decision"`
		RequestHash        string  `json:"request_hash"`
		ResponseHash       string  `json:"response_hash"`
		EnvelopeSignature  string  `json:"signature"`
		Violation          string  `json:"violation"`
	}
	if err := json.Unmarshal(executionEnvelope, &envelope); err != nil {
		return nil, false
	}
	if envelope.ExecutionID == "" || !aiToolRoutingDecisionAuditable(envelope.RoutingDecision) {
		return nil, false
	}

	var receipt struct {
		ExecutionID       string `json:"execution_id"`
		ReceiptHash       string `json:"receipt_hash"`
		Hash              string `json:"hash"`
		Signature         string `json:"signature"`
		ViolationOccurred bool   `json:"violation_occurred"`
	}
	if len(executionReceipt) > 0 {
		if err := json.Unmarshal(executionReceipt, &receipt); err != nil {
			return nil, false
		}
		if receipt.ExecutionID != "" && receipt.ExecutionID != envelope.ExecutionID {
			return nil, false
		}
	}
	receiptHash := receipt.ReceiptHash
	if receiptHash == "" {
		receiptHash = receipt.Hash
	}
	tenantID := ""
	if envelope.TenantID != nil {
		tenantID = *envelope.TenantID
	}
	toolName := aiToolNameFromRoutingDecision(envelope.RoutingDecision)
	if toolName == "" {
		toolName = envelope.Model
	}

	return &aiToolArtifactRefs{
		ExecutionID:       envelope.ExecutionID,
		TenantID:          tenantID,
		EnvelopeID:        envelope.PolicyDecisionID,
		Capability:        capabilityFromToolName(toolName),
		ToolName:          toolName,
		ToolActionHash:    envelope.GovernedActionHash,
		RoutingDecision:   envelope.RoutingDecision,
		RequestHash:       envelope.RequestHash,
		ResponseHash:      envelope.ResponseHash,
		ReceiptHash:       receiptHash,
		ReceiptSignature:  receipt.Signature,
		EnvelopeSignature: envelope.EnvelopeSignature,
		ViolationOccurred: receipt.ViolationOccurred || envelope.Violation != "",
		Violation:         envelope.Violation,
	}, true
}

func aiToolRoutingDecisionAuditable(routingDecision string) bool {
	return strings.HasPrefix(routingDecision, "tool:") || strings.HasPrefix(routingDecision, "runtime:tool:")
}

func aiToolNameFromRoutingDecision(routingDecision string) string {
	for _, prefix := range []string{"tool:", "runtime:tool:"} {
		if strings.HasPrefix(routingDecision, prefix) {
			return strings.TrimSpace(strings.TrimPrefix(routingDecision, prefix))
		}
	}
	return ""
}

func capabilityFromToolName(toolName string) string {
	toolName = strings.TrimSpace(strings.ToLower(toolName))
	if toolName == "" {
		return ""
	}
	if strings.HasPrefix(toolName, "tools.") {
		return toolName
	}
	return "tools." + toolName
}

func saveAIToolReceiptAudit(execer roboticsReceiptAuditExecer, taskID uuid.UUID, executionEnvelope, executionReceipt json.RawMessage) error {
	refs, ok := aiToolAuditRefs(executionEnvelope, executionReceipt)
	if !ok {
		return nil
	}
	if err := ensureAIToolCredentialRefsActive(execer, refs); err != nil {
		return err
	}
	_, err := execer.Exec(`
		INSERT INTO ai_tool_receipt_audit (
			task_id, tenant_id, runtime_id, execution_id, envelope_id, capability,
			tool_name, tool_action_hash, routing_decision, request_hash, response_hash,
			receipt_hash, receipt_signature, envelope_signature, violation_occurred,
			violation, execution_envelope, execution_receipt, persisted_at
		)
		SELECT
			tr.task_id,
			COALESCE(NULLIF($2, ''), tr.tenant_id),
			tr.runtime_id,
			$3,
			NULLIF($4, ''),
			NULLIF($5, ''),
			$6,
			NULLIF($7, ''),
			$8,
			NULLIF($9, ''),
			NULLIF($10, ''),
			NULLIF($11, ''),
			NULLIF($12, ''),
			NULLIF($13, ''),
			$14,
			NULLIF($15, ''),
			$16,
			$17,
			NOW()
		FROM task_records tr
		WHERE tr.task_id = $1
		ON CONFLICT (task_id, execution_id) DO UPDATE
		SET receipt_hash = EXCLUDED.receipt_hash,
		    receipt_signature = EXCLUDED.receipt_signature,
		    envelope_signature = EXCLUDED.envelope_signature,
		    violation_occurred = EXCLUDED.violation_occurred,
		    violation = EXCLUDED.violation,
		    execution_envelope = EXCLUDED.execution_envelope,
		    execution_receipt = EXCLUDED.execution_receipt,
		    persisted_at = NOW()`,
		taskID,
		refs.TenantID,
		refs.ExecutionID,
		refs.EnvelopeID,
		refs.Capability,
		refs.ToolName,
		refs.ToolActionHash,
		refs.RoutingDecision,
		refs.RequestHash,
		refs.ResponseHash,
		refs.ReceiptHash,
		refs.ReceiptSignature,
		refs.EnvelopeSignature,
		refs.ViolationOccurred,
		refs.Violation,
		nullRawJSON(executionEnvelope),
		nullRawJSON(executionReceipt),
	)
	return err
}

type queryRower interface {
	QueryRow(query string, args ...interface{}) *sql.Row
}

func ensureAIToolCredentialRefsActive(execer roboticsReceiptAuditExecer, refs *aiToolArtifactRefs) error {
	if refs == nil || refs.EnvelopeID == "" {
		return nil
	}
	queryer, ok := execer.(queryRower)
	if !ok {
		return nil
	}
	var referenceID string
	err := queryer.QueryRow(`
		SELECT reference_id
		FROM ai_credential_ref_audit
		WHERE envelope_id = $1
		  AND revoked_at IS NOT NULL
		  AND (
		    NULLIF($2, '') IS NULL
		    OR capability = $2
		    OR tool = $3
		  )
		ORDER BY revoked_at DESC
		LIMIT 1`,
		refs.EnvelopeID,
		refs.Capability,
		refs.ToolName,
	).Scan(&referenceID)
	if err == sql.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}
	return fmt.Errorf("%w: %s", ErrCredentialReferenceRevoked, referenceID)
}

func (s *CheckpointStore) RevokeAICredentialReference(ctx context.Context, tenantID, referenceID string) (*AICredentialReferenceAudit, error) {
	row := s.db.QueryRowContext(ctx, `
		UPDATE ai_credential_ref_audit
		SET revoked_at = NOW()
		WHERE tenant_id = $1
		  AND reference_id = $2
		  AND revocable = true
		  AND revoked_at IS NULL
		RETURNING reference_id, envelope_id, task_id, tenant_id, COALESCE(tool, ''),
		          COALESCE(capability, ''), COALESCE(scope, ''), expires_at_unix_ms,
		          revocable, revoked_at, persisted_at`,
		tenantID,
		referenceID,
	)
	ref, err := scanAICredentialReference(row)
	if err != sql.ErrNoRows {
		return ref, err
	}
	var revokedAt sql.NullTime
	err = s.db.QueryRowContext(ctx, `
		SELECT revoked_at
		FROM ai_credential_ref_audit
		WHERE tenant_id = $1
		  AND reference_id = $2
		  AND revocable = true`,
		tenantID,
		referenceID,
	).Scan(&revokedAt)
	if err == nil && revokedAt.Valid {
		return nil, fmt.Errorf("%w: %s", ErrCredentialReferenceRevoked, referenceID)
	}
	if err != nil {
		return nil, err
	}
	return nil, sql.ErrNoRows
}

func (s *CheckpointStore) GetAICredentialReferences(tenantID string, filter AICredentialReferenceFilter) ([]AICredentialReferenceAudit, error) {
	limit := filter.Limit
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	args := []any{tenantID}
	where := "tenant_id = $1"
	if filter.TaskID != nil {
		args = append(args, *filter.TaskID)
		where += fmt.Sprintf(" AND task_id = $%d", len(args))
	}
	if filter.Capability != "" {
		args = append(args, filter.Capability)
		where += fmt.Sprintf(" AND capability = $%d", len(args))
	}
	if filter.Tool != "" {
		args = append(args, filter.Tool)
		where += fmt.Sprintf(" AND tool = $%d", len(args))
	}
	if !filter.IncludeRevoked {
		where += " AND revoked_at IS NULL"
	}
	args = append(args, limit)
	rows, err := s.db.Query(fmt.Sprintf(`
		SELECT reference_id, envelope_id, task_id, tenant_id, COALESCE(tool, ''),
		       COALESCE(capability, ''), COALESCE(scope, ''), expires_at_unix_ms,
		       revocable, revoked_at, persisted_at
		FROM ai_credential_ref_audit
		WHERE %s
		ORDER BY persisted_at DESC
		LIMIT $%d`, where, len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	refs := make([]AICredentialReferenceAudit, 0)
	for rows.Next() {
		ref, err := scanAICredentialReference(rows)
		if err != nil {
			return nil, err
		}
		refs = append(refs, *ref)
	}
	return refs, rows.Err()
}

func scanAICredentialReference(row interface{ Scan(...interface{}) error }) (*AICredentialReferenceAudit, error) {
	var ref AICredentialReferenceAudit
	var revokedAt sql.NullTime
	if err := row.Scan(
		&ref.ReferenceID,
		&ref.EnvelopeID,
		&ref.TaskID,
		&ref.TenantID,
		&ref.Tool,
		&ref.Capability,
		&ref.Scope,
		&ref.ExpiresAtUnixMs,
		&ref.Revocable,
		&revokedAt,
		&ref.PersistedAt,
	); err != nil {
		return nil, err
	}
	if revokedAt.Valid {
		ref.RevokedAt = &revokedAt.Time
	}
	return &ref, nil
}

func (s *CheckpointStore) GetRoboticsAuditReceipts(tenantID string, filter RoboticsAuditReceiptFilter) ([]RoboticsAuditReceipt, error) {
	limit := filter.Limit
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	args := []any{tenantID}
	where := "tenant_id = $1"
	if filter.TaskID != nil {
		args = append(args, *filter.TaskID)
		where += fmt.Sprintf(" AND task_id = $%d", len(args))
	}
	if filter.PolicyDecisionID != "" {
		args = append(args, filter.PolicyDecisionID)
		where += fmt.Sprintf(" AND policy_decision_id = $%d", len(args))
	}
	if filter.RobotAction != "" {
		args = append(args, filter.RobotAction)
		where += fmt.Sprintf(" AND robot_action = $%d", len(args))
	}
	args = append(args, limit)

	rows, err := s.db.Query(fmt.Sprintf(`
		SELECT task_id, tenant_id, COALESCE(runtime_id, ''), execution_id,
		       policy_decision_id, COALESCE(policy_decision_hash, ''),
		       COALESCE(governed_action_hash, ''), robot_action, routing_decision,
		       COALESCE(receipt_hash, ''), COALESCE(receipt_signature, ''),
		       COALESCE(envelope_signature, ''), violation_occurred,
		       COALESCE(violation, ''), execution_envelope, execution_receipt,
		       persisted_at
		FROM robotics_receipt_audit
		WHERE %s
		ORDER BY persisted_at DESC
		LIMIT $%d`, where, len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	receipts := make([]RoboticsAuditReceipt, 0)
	for rows.Next() {
		var receipt RoboticsAuditReceipt
		if err := rows.Scan(
			&receipt.TaskID,
			&receipt.TenantID,
			&receipt.RuntimeID,
			&receipt.ExecutionID,
			&receipt.PolicyDecisionID,
			&receipt.PolicyDecisionHash,
			&receipt.GovernedActionHash,
			&receipt.RobotAction,
			&receipt.RoutingDecision,
			&receipt.ReceiptHash,
			&receipt.ReceiptSignature,
			&receipt.EnvelopeSignature,
			&receipt.ViolationOccurred,
			&receipt.Violation,
			&receipt.ExecutionEnvelope,
			&receipt.ExecutionReceipt,
			&receipt.PersistedAt,
		); err != nil {
			return nil, err
		}
		receipts = append(receipts, receipt)
	}
	return receipts, rows.Err()
}

func (s *CheckpointStore) GetAIToolAuditReceipts(tenantID string, filter AIToolAuditReceiptFilter) ([]AIToolAuditReceipt, error) {
	limit := filter.Limit
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	args := []any{tenantID}
	where := "tenant_id = $1"
	if filter.TaskID != nil {
		args = append(args, *filter.TaskID)
		where += fmt.Sprintf(" AND task_id = $%d", len(args))
	}
	if filter.EnvelopeID != "" {
		args = append(args, filter.EnvelopeID)
		where += fmt.Sprintf(" AND envelope_id = $%d", len(args))
	}
	if filter.Capability != "" {
		args = append(args, filter.Capability)
		where += fmt.Sprintf(" AND capability = $%d", len(args))
	}
	if filter.ToolName != "" {
		args = append(args, filter.ToolName)
		where += fmt.Sprintf(" AND tool_name = $%d", len(args))
	}
	args = append(args, limit)

	rows, err := s.db.Query(fmt.Sprintf(`
		SELECT task_id, tenant_id, COALESCE(runtime_id, ''), execution_id,
		       COALESCE(envelope_id, ''), COALESCE(capability, ''), tool_name,
		       COALESCE(tool_action_hash, ''), routing_decision,
		       COALESCE(request_hash, ''), COALESCE(response_hash, ''),
		       COALESCE(receipt_hash, ''), COALESCE(receipt_signature, ''),
		       COALESCE(envelope_signature, ''), violation_occurred,
		       COALESCE(violation, ''), execution_envelope, COALESCE(execution_receipt, '{}'::jsonb),
		       persisted_at
		FROM ai_tool_receipt_audit
		WHERE %s
		ORDER BY persisted_at DESC
		LIMIT $%d`, where, len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	receipts := make([]AIToolAuditReceipt, 0)
	for rows.Next() {
		var receipt AIToolAuditReceipt
		if err := rows.Scan(
			&receipt.TaskID,
			&receipt.TenantID,
			&receipt.RuntimeID,
			&receipt.ExecutionID,
			&receipt.EnvelopeID,
			&receipt.Capability,
			&receipt.ToolName,
			&receipt.ToolActionHash,
			&receipt.RoutingDecision,
			&receipt.RequestHash,
			&receipt.ResponseHash,
			&receipt.ReceiptHash,
			&receipt.ReceiptSignature,
			&receipt.EnvelopeSignature,
			&receipt.ViolationOccurred,
			&receipt.Violation,
			&receipt.ExecutionEnvelope,
			&receipt.ExecutionReceipt,
			&receipt.PersistedAt,
		); err != nil {
			return nil, err
		}
		receipts = append(receipts, receipt)
	}
	return receipts, rows.Err()
}

func (s *CheckpointStore) ReplayAIToolAudit(tenantID string, filter AIToolAuditReceiptFilter) ([]AIToolAuditReplay, error) {
	limit := filter.Limit
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	args := []any{tenantID}
	where := "ra.tenant_id = $1"
	if filter.TaskID != nil {
		args = append(args, *filter.TaskID)
		where += fmt.Sprintf(" AND ra.task_id = $%d", len(args))
	}
	if filter.EnvelopeID != "" {
		args = append(args, filter.EnvelopeID)
		where += fmt.Sprintf(" AND ra.envelope_id = $%d", len(args))
	}
	if filter.Capability != "" {
		args = append(args, filter.Capability)
		where += fmt.Sprintf(" AND ra.capability = $%d", len(args))
	}
	if filter.ToolName != "" {
		args = append(args, filter.ToolName)
		where += fmt.Sprintf(" AND ra.tool_name = $%d", len(args))
	}
	args = append(args, limit)

	rows, err := s.db.Query(fmt.Sprintf(`
		SELECT
			ra.task_id, ra.tenant_id, COALESCE(ra.runtime_id, ''), ra.execution_id,
			COALESCE(ra.envelope_id, ''), COALESCE(ra.capability, ''), ra.tool_name,
			COALESCE(ra.tool_action_hash, ''), ra.routing_decision,
			COALESCE(ra.request_hash, ''), COALESCE(ra.response_hash, ''),
			COALESCE(ra.receipt_hash, ''), COALESCE(ra.receipt_signature, ''),
			COALESCE(ra.envelope_signature, ''), ra.violation_occurred,
			COALESCE(ra.violation, ''), ra.execution_envelope,
			COALESCE(ra.execution_receipt, '{}'::jsonb), ra.persisted_at,
			COALESCE(ri.public_key_ed25519, '')
		FROM ai_tool_receipt_audit ra
		LEFT JOIN runtime_instances ri
		  ON ri.runtime_id = ra.runtime_id
		WHERE %s
		ORDER BY ra.persisted_at DESC
		LIMIT $%d`, where, len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	replays := make([]AIToolAuditReplay, 0)
	for rows.Next() {
		var replay AIToolAuditReplay
		if err := rows.Scan(
			&replay.TaskID,
			&replay.TenantID,
			&replay.RuntimeID,
			&replay.ExecutionID,
			&replay.EnvelopeID,
			&replay.Capability,
			&replay.ToolName,
			&replay.ToolActionHash,
			&replay.RoutingDecision,
			&replay.RequestHash,
			&replay.ResponseHash,
			&replay.ReceiptHash,
			&replay.ReceiptSignature,
			&replay.EnvelopeSignature,
			&replay.ViolationOccurred,
			&replay.Violation,
			&replay.ExecutionEnvelope,
			&replay.ExecutionReceipt,
			&replay.PersistedAt,
			&replay.RuntimePublicKeyEd25519,
		); err != nil {
			return nil, err
		}
		validateAIToolAuditReplay(&replay)
		replays = append(replays, replay)
	}
	return replays, rows.Err()
}

func validateAIToolAuditReplay(replay *AIToolAuditReplay) {
	if replay == nil {
		return
	}
	errors := make([]string, 0)
	var envelope struct {
		ExecutionID        string `json:"execution_id"`
		TenantID           string `json:"tenant_id"`
		PolicyDecisionID   string `json:"policy_decision_id"`
		GovernedActionHash string `json:"governed_action_hash"`
		RoutingDecision    string `json:"routing_decision"`
		RequestHash        string `json:"request_hash"`
		ResponseHash       string `json:"response_hash"`
		Signature          string `json:"signature"`
	}
	if err := json.Unmarshal(replay.ExecutionEnvelope, &envelope); err != nil {
		errors = append(errors, "execution_envelope_invalid_json")
	} else {
		if envelope.ExecutionID != replay.ExecutionID {
			errors = append(errors, "execution_id_mismatch")
		}
		if envelope.TenantID != "" && envelope.TenantID != replay.TenantID {
			errors = append(errors, "tenant_id_mismatch")
		}
		if envelope.PolicyDecisionID != "" && envelope.PolicyDecisionID != replay.EnvelopeID {
			errors = append(errors, "permission_envelope_id_mismatch")
		}
		if envelope.GovernedActionHash != "" && envelope.GovernedActionHash != replay.ToolActionHash {
			errors = append(errors, "tool_action_hash_mismatch")
		}
		if envelope.RoutingDecision != replay.RoutingDecision {
			errors = append(errors, "routing_decision_mismatch")
		}
		if envelope.RequestHash != "" && envelope.RequestHash != replay.RequestHash {
			errors = append(errors, "request_hash_mismatch")
		}
		if envelope.ResponseHash != "" && envelope.ResponseHash != replay.ResponseHash {
			errors = append(errors, "response_hash_mismatch")
		}
		if envelope.Signature == "" {
			errors = append(errors, "runtime_envelope_signature_missing")
		}
		replay.RuntimeSignature = envelope.Signature
	}
	var receipt struct {
		ExecutionID       string `json:"execution_id"`
		ReceiptHash       string `json:"receipt_hash"`
		Hash              string `json:"hash"`
		Signature         string `json:"signature"`
		ViolationOccurred bool   `json:"violation_occurred"`
	}
	if len(replay.ExecutionReceipt) > 0 && string(replay.ExecutionReceipt) != "{}" {
		if err := json.Unmarshal(replay.ExecutionReceipt, &receipt); err != nil {
			errors = append(errors, "execution_receipt_invalid_json")
		} else {
			if receipt.ExecutionID != "" && receipt.ExecutionID != replay.ExecutionID {
				errors = append(errors, "receipt_execution_id_mismatch")
			}
			receiptHash := receipt.ReceiptHash
			if receiptHash == "" {
				receiptHash = receipt.Hash
			}
			if receiptHash != "" && receiptHash != replay.ReceiptHash {
				errors = append(errors, "receipt_hash_mismatch")
			}
			if receipt.Signature == "" {
				errors = append(errors, "runtime_receipt_signature_missing")
			}
			if receipt.ViolationOccurred != replay.ViolationOccurred {
				errors = append(errors, "violation_flag_mismatch")
			}
		}
	}
	replay.RuntimeSignaturePresent = replay.RuntimeSignature != "" && replay.ReceiptSignature != ""
	if strings.TrimSpace(replay.RuntimePublicKeyEd25519) != "" {
		replay.RuntimeSignatureKeySource = "runtime_registry"
	}
	if replay.RuntimeSignatureKeySource == "" && strings.TrimSpace(os.Getenv("IGRIS_RUNTIME_PUBLIC_KEY")) != "" {
		replay.RuntimeSignatureKeySource = "env_fallback"
	}
	var verifyErr error
	if replay.RuntimeSignatureKeySource == "runtime_registry" {
		verifyErr = internal.VerifyExecutionArtifactsRawWithPublicKey(replay.ExecutionEnvelope, replay.ExecutionReceipt, replay.RuntimePublicKeyEd25519)
	} else {
		verifyErr = internal.VerifyExecutionArtifactsRaw(replay.ExecutionEnvelope, replay.ExecutionReceipt)
	}
	if verifyErr != nil {
		errors = append(errors, "runtime_signature_invalid: "+verifyErr.Error())
	} else if replay.RuntimeSignaturePresent && replay.RuntimeSignatureKeySource != "" {
		replay.RuntimeSignatureVerified = true
	}
	replay.ValidationErrors = errors
	replay.Valid = len(errors) == 0
}

func (s *CheckpointStore) ReplayRoboticsAudit(tenantID string, filter RoboticsAuditReceiptFilter) ([]RoboticsAuditReplay, error) {
	limit := filter.Limit
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	args := []any{tenantID}
	where := "ra.tenant_id = $1"
	if filter.TaskID != nil {
		args = append(args, *filter.TaskID)
		where += fmt.Sprintf(" AND ra.task_id = $%d", len(args))
	}
	if filter.PolicyDecisionID != "" {
		args = append(args, filter.PolicyDecisionID)
		where += fmt.Sprintf(" AND ra.policy_decision_id = $%d", len(args))
	}
	if filter.RobotAction != "" {
		args = append(args, filter.RobotAction)
		where += fmt.Sprintf(" AND ra.robot_action = $%d", len(args))
	}
	args = append(args, limit)

	rows, err := s.db.Query(fmt.Sprintf(`
		SELECT
			ra.task_id, ra.tenant_id, COALESCE(ra.runtime_id, ''), ra.execution_id,
			ra.policy_decision_id, COALESCE(pd.policy_version, ''),
			ra.robot_action, COALESCE(pd.robot_node_id, ''), COALESCE(pd.robot_target, ''),
			COALESCE(pd.permit, false), COALESCE(pd.reason, ''),
			ra.routing_decision, COALESCE(ra.policy_decision_hash, ''),
			COALESCE(ra.governed_action_hash, ''), COALESCE(ra.receipt_hash, ''),
			COALESCE(ra.receipt_signature, ''), COALESCE(ra.envelope_signature, ''),
			COALESCE(pd.policy_signature, ''), ra.violation_occurred,
			COALESCE(ra.violation, ''), COALESCE(pd.signed_policy_decision, '{}'::jsonb),
			ra.execution_envelope, ra.execution_receipt, ra.persisted_at,
			COALESCE(ri.public_key_ed25519, '')
		FROM robotics_receipt_audit ra
		LEFT JOIN robotics_policy_decision_audit pd
		  ON pd.task_id = ra.task_id
		 AND pd.policy_decision_id = ra.policy_decision_id
		 AND pd.tenant_id = ra.tenant_id
		LEFT JOIN runtime_instances ri
		  ON ri.runtime_id = ra.runtime_id
		WHERE %s
		ORDER BY ra.persisted_at DESC
		LIMIT $%d`, where, len(args)), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	replays := make([]RoboticsAuditReplay, 0)
	for rows.Next() {
		var replay RoboticsAuditReplay
		if err := rows.Scan(
			&replay.TaskID,
			&replay.TenantID,
			&replay.RuntimeID,
			&replay.ExecutionID,
			&replay.PolicyDecisionID,
			&replay.PolicyVersion,
			&replay.RobotAction,
			&replay.RobotNodeID,
			&replay.RobotTarget,
			&replay.Permit,
			&replay.Reason,
			&replay.RoutingDecision,
			&replay.PolicyDecisionHash,
			&replay.GovernedActionHash,
			&replay.ReceiptHash,
			&replay.ReceiptSignature,
			&replay.RuntimeSignature,
			&replay.PolicySignature,
			&replay.ViolationOccurred,
			&replay.Violation,
			&replay.SignedPolicyDecision,
			&replay.ExecutionEnvelope,
			&replay.ExecutionReceipt,
			&replay.PersistedAt,
			&replay.RuntimePublicKeyEd25519,
		); err != nil {
			return nil, err
		}
		validateRoboticsAuditReplay(&replay)
		replays = append(replays, replay)
	}
	return replays, rows.Err()
}

func validateRoboticsAuditReplay(replay *RoboticsAuditReplay) {
	if replay == nil {
		return
	}
	errors := make([]string, 0)
	var envelope struct {
		ExecutionID        string `json:"execution_id"`
		TenantID           string `json:"tenant_id"`
		PolicyDecisionID   string `json:"policy_decision_id"`
		PolicyDecisionHash string `json:"policy_decision_hash"`
		GovernedActionHash string `json:"governed_action_hash"`
		RoutingDecision    string `json:"routing_decision"`
		Signature          string `json:"signature"`
	}
	if err := json.Unmarshal(replay.ExecutionEnvelope, &envelope); err != nil {
		errors = append(errors, "execution_envelope_invalid_json")
	} else {
		if envelope.ExecutionID != replay.ExecutionID {
			errors = append(errors, "execution_id_mismatch")
		}
		if envelope.TenantID != "" && envelope.TenantID != replay.TenantID {
			errors = append(errors, "tenant_id_mismatch")
		}
		if envelope.PolicyDecisionID != replay.PolicyDecisionID {
			errors = append(errors, "policy_decision_id_mismatch")
		}
		if envelope.PolicyDecisionHash != "" && envelope.PolicyDecisionHash != replay.PolicyDecisionHash {
			errors = append(errors, "policy_decision_hash_mismatch")
		}
		if envelope.GovernedActionHash != "" && envelope.GovernedActionHash != replay.GovernedActionHash {
			errors = append(errors, "governed_action_hash_mismatch")
		}
		if envelope.RoutingDecision != replay.RoutingDecision {
			errors = append(errors, "routing_decision_mismatch")
		}
		if envelope.Signature == "" {
			errors = append(errors, "runtime_envelope_signature_missing")
		}
	}

	var receipt struct {
		ExecutionID       string `json:"execution_id"`
		ReceiptHash       string `json:"receipt_hash"`
		Hash              string `json:"hash"`
		Signature         string `json:"signature"`
		ViolationOccurred bool   `json:"violation_occurred"`
	}
	if err := json.Unmarshal(replay.ExecutionReceipt, &receipt); err != nil {
		errors = append(errors, "execution_receipt_invalid_json")
	} else {
		if receipt.ExecutionID != "" && receipt.ExecutionID != replay.ExecutionID {
			errors = append(errors, "receipt_execution_id_mismatch")
		}
		receiptHash := receipt.ReceiptHash
		if receiptHash == "" {
			receiptHash = receipt.Hash
		}
		if receiptHash != "" && receiptHash != replay.ReceiptHash {
			errors = append(errors, "receipt_hash_mismatch")
		}
		if receipt.Signature == "" {
			errors = append(errors, "runtime_receipt_signature_missing")
		}
		if receipt.ViolationOccurred != replay.ViolationOccurred {
			errors = append(errors, "violation_flag_mismatch")
		}
	}
	replay.RuntimeSignaturePresent = replay.RuntimeSignature != "" && replay.ReceiptSignature != ""
	if strings.TrimSpace(replay.RuntimePublicKeyEd25519) != "" {
		replay.RuntimeSignatureKeySource = "runtime_registry"
	}
	if replay.RuntimeSignatureKeySource == "" && strings.TrimSpace(os.Getenv("IGRIS_RUNTIME_PUBLIC_KEY")) != "" {
		replay.RuntimeSignatureKeySource = "env_fallback"
	}
	var verifyErr error
	if replay.RuntimeSignatureKeySource == "runtime_registry" {
		verifyErr = internal.VerifyExecutionArtifactsRawWithPublicKey(replay.ExecutionEnvelope, replay.ExecutionReceipt, replay.RuntimePublicKeyEd25519)
	} else {
		verifyErr = internal.VerifyExecutionArtifactsRaw(replay.ExecutionEnvelope, replay.ExecutionReceipt)
	}
	if verifyErr != nil {
		errors = append(errors, "runtime_signature_invalid: "+verifyErr.Error())
	} else if replay.RuntimeSignaturePresent && replay.RuntimeSignatureKeySource != "" {
		replay.RuntimeSignatureVerified = true
	}

	if len(replay.SignedPolicyDecision) == 0 || string(replay.SignedPolicyDecision) == "{}" {
		errors = append(errors, "signed_policy_decision_missing")
	} else {
		var decision signedGovernedPolicyDecision
		if err := json.Unmarshal(replay.SignedPolicyDecision, &decision); err != nil {
			errors = append(errors, "signed_policy_decision_invalid_json")
		} else {
			if decision.DecisionID != replay.PolicyDecisionID {
				errors = append(errors, "decision_id_mismatch")
			}
			if decision.TenantID != replay.TenantID {
				errors = append(errors, "decision_tenant_mismatch")
			}
			if decision.TaskID != replay.TaskID.String() {
				errors = append(errors, "decision_task_mismatch")
			}
			if decision.RuntimeID != nil && *decision.RuntimeID != "" && *decision.RuntimeID != replay.RuntimeID {
				errors = append(errors, "decision_runtime_mismatch")
			}
			if decision.Action.ActionName != replay.RobotAction {
				errors = append(errors, "decision_action_mismatch")
			}
			if decision.Action.NodeID != "" && replay.RobotNodeID != "" && decision.Action.NodeID != replay.RobotNodeID {
				errors = append(errors, "decision_node_mismatch")
			}
			if decision.PolicyVersion != replay.PolicyVersion {
				errors = append(errors, "decision_policy_version_mismatch")
			}
			if decision.Permit != replay.Permit {
				errors = append(errors, "decision_permit_mismatch")
			}
			if decision.Signature == "" {
				errors = append(errors, "policy_signature_missing")
			}
			if replay.PolicyDecisionHash != "" && governedPolicyDecisionHash(decision) != replay.PolicyDecisionHash {
				errors = append(errors, "decision_hash_mismatch")
			}
		}
	}

	replay.ValidationErrors = errors
	replay.Valid = len(errors) == 0
}

// syncTaskProofLineageLookupSQL reads the stored receipt hash/signature for an
// execution. execution_lineage is a tenant-bound trust object: the lookup is
// ALWAYS filtered by tenant_id and must never accept `OR tenant_id IS NULL`, or
// a tenant-null (legacy) receipt could leak into another tenant's proof state.
const syncTaskProofLineageLookupSQL = `
		SELECT receipt_hash, signature
		FROM execution_lineage
		WHERE execution_id = $1
		  AND tenant_id = $2`

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
	err := s.db.QueryRow(syncTaskProofLineageLookupSQL,
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
		       proof_verified, proof_hash_valid, proof_signature_matches, proof_runtime_key_found, proof_chain_link_valid, proof_verification_reason, proof_verified_at,
		       idempotency_key, failure_reason, failure_details,
		       deadline_at, dispatched_at, completed_at, canceled_at, created_at,
		       executed_target, fallback_reason,
		       registered_agent_id, registered_agent_name
		FROM task_records
		WHERE task_id = $1 AND tenant_id = $2`,
		taskID, tenantID,
	)
	return scanTaskRecord(row)
}

// getTaskByIdempotencyKeySQL looks up a task by idempotency key. Idempotency is
// tenant-scoped, so the lookup is ALWAYS filtered by tenant_id and must never be
// reduced to idempotency_key alone — otherwise a key could resolve another
// tenant's task.
const getTaskByIdempotencyKeySQL = `
		SELECT task_id, tenant_id, status, runtime_id, runtime_endpoint,
		       task_definition, last_checkpoint, execution_envelope, execution_receipt,
		       proof_execution_id, proof_expected_hash, proof_stored_hash, proof_signature, proof_status, proof_checked_at,
		       proof_verified, proof_hash_valid, proof_signature_matches, proof_runtime_key_found, proof_chain_link_valid, proof_verification_reason, proof_verified_at,
		       idempotency_key, failure_reason, failure_details,
		       deadline_at, dispatched_at, completed_at, canceled_at, created_at,
		       executed_target, fallback_reason,
		       registered_agent_id, registered_agent_name
		FROM task_records
		WHERE tenant_id = $1 AND idempotency_key = $2`

// GetTaskByIdempotencyKey returns a task record by tenant and idempotency key.
func (s *CheckpointStore) GetTaskByIdempotencyKey(tenantID, idempotencyKey string) (*TaskRecord, error) {
	row := s.db.QueryRow(getTaskByIdempotencyKeySQL, tenantID, idempotencyKey)
	return scanTaskRecord(row)
}

// GetTasksByTenant returns recent tasks for a tenant.
func (s *CheckpointStore) GetTasksByTenant(tenantID string, limit int) ([]*TaskRecord, error) {
	rows, err := s.db.Query(`
		SELECT task_id, tenant_id, status, runtime_id, runtime_endpoint,
		       task_definition, last_checkpoint, execution_envelope, execution_receipt,
		       proof_execution_id, proof_expected_hash, proof_stored_hash, proof_signature, proof_status, proof_checked_at,
		       proof_verified, proof_hash_valid, proof_signature_matches, proof_runtime_key_found, proof_chain_link_valid, proof_verification_reason, proof_verified_at,
		       idempotency_key, failure_reason, failure_details,
		       deadline_at, dispatched_at, completed_at, canceled_at, created_at,
		       executed_target, fallback_reason,
		       registered_agent_id, registered_agent_name
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

// GetTasksByTenantAndAgent is GetTasksByTenant scoped to a single registered
// agent. It lets the console fetch an agent's own run window directly from the
// database (bounded by limit) rather than over-fetching the tenant's runs and
// filtering client-side, so an agent-scoped investigation link lands on the
// agent's runs precisely. Tenant scoping is preserved exactly as in the
// unfiltered query.
func (s *CheckpointStore) GetTasksByTenantAndAgent(tenantID string, agentID uuid.UUID, limit int) ([]*TaskRecord, error) {
	rows, err := s.db.Query(`
		SELECT task_id, tenant_id, status, runtime_id, runtime_endpoint,
		       task_definition, last_checkpoint, execution_envelope, execution_receipt,
		       proof_execution_id, proof_expected_hash, proof_stored_hash, proof_signature, proof_status, proof_checked_at,
		       proof_verified, proof_hash_valid, proof_signature_matches, proof_runtime_key_found, proof_chain_link_valid, proof_verification_reason, proof_verified_at,
		       idempotency_key, failure_reason, failure_details,
		       deadline_at, dispatched_at, completed_at, canceled_at, created_at,
		       executed_target, fallback_reason,
		       registered_agent_id, registered_agent_name
		FROM task_records
		WHERE tenant_id = $1 AND registered_agent_id = $2
		ORDER BY created_at DESC
		LIMIT $3`,
		tenantID, agentID, limit,
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

// GetCumulativeRecoveryCheckpoint reconstructs the committed WAL prefix for a
// task from every persisted checkpoint row. Runtime checkpoints are delta-based:
// each row carries entries since the prior checkpoint, while the resume token
// digest covers all committed entries. Clean-host recovery therefore needs a
// cumulative checkpoint payload so an empty replacement runtime can seed its WAL
// and verify the latest resume token.
func (s *CheckpointStore) GetCumulativeRecoveryCheckpoint(taskID uuid.UUID) (*CheckpointPayload, error) {
	checkpoints, err := s.GetAllCheckpoints(taskID)
	if err != nil {
		return nil, err
	}
	return BuildCumulativeRecoveryCheckpoint(taskID, checkpoints)
}

func BuildCumulativeRecoveryCheckpoint(taskID uuid.UUID, checkpoints []*CheckpointPayload) (*CheckpointPayload, error) {
	if taskID == uuid.Nil {
		return nil, fmt.Errorf("%w: task_id is required", ErrInvalidCumulativeCheckpoint)
	}
	if len(checkpoints) == 0 {
		return nil, nil
	}

	var latest *CheckpointPayload
	entriesByStep := make(map[uint32]WalEntry)
	for _, cp := range checkpoints {
		if cp == nil {
			continue
		}
		if cp.TaskID != taskID {
			return nil, fmt.Errorf("%w: checkpoint task_id mismatch", ErrInvalidCumulativeCheckpoint)
		}
		if latest == nil || TaskCheckpointAdvances(latest, cp) {
			latest = cp
		}
		for _, entry := range cp.WalEntries {
			if entry.TaskID != taskID {
				return nil, fmt.Errorf("%w: WAL entry task_id mismatch", ErrInvalidCumulativeCheckpoint)
			}
			if normalizeWalStatus(entry.Status) != "committed" {
				continue
			}
			existing, ok := entriesByStep[entry.StepIndex]
			if ok {
				if !walEntriesEquivalent(existing, entry) {
					return nil, fmt.Errorf("%w: conflicting duplicate step %d", ErrInvalidCumulativeCheckpoint, entry.StepIndex)
				}
				continue
			}
			entriesByStep[entry.StepIndex] = entry
		}
	}
	if latest == nil {
		return nil, nil
	}
	if !TaskRecoveryCheckpointUsable(taskID, latest) {
		return nil, fmt.Errorf("%w: latest checkpoint is not usable", ErrInvalidCumulativeCheckpoint)
	}

	lastStep := latest.ResumeToken.LastCommittedStep
	entries := make([]WalEntry, 0, len(entriesByStep))
	for step := uint32(0); step <= lastStep; step++ {
		entry, ok := entriesByStep[step]
		if !ok {
			return nil, fmt.Errorf("%w: missing committed step %d", ErrInvalidCumulativeCheckpoint, step)
		}
		entries = append(entries, entry)
		if step == ^uint32(0) {
			break
		}
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].StepIndex < entries[j].StepIndex
	})

	return &CheckpointPayload{
		TaskID:      latest.TaskID,
		ResumeToken: latest.ResumeToken,
		WalEntries:  entries,
		Metadata:    latest.Metadata,
		CapturedAt:  latest.CapturedAt,
	}, nil
}

func walEntriesEquivalent(a, b WalEntry) bool {
	aBytes, aErr := json.Marshal(a)
	bBytes, bErr := json.Marshal(b)
	return aErr == nil && bErr == nil && bytes.Equal(aBytes, bBytes)
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

// GetAllCheckpoints returns every persisted checkpoint payload for a task in
// ascending step order. Checkpoints are delta-based, so callers that need a
// complete action-evidence view can merge safe summaries across payload
// metadata without changing the task's latest checkpoint.
func (s *CheckpointStore) GetAllCheckpoints(taskID uuid.UUID) ([]*CheckpointPayload, error) {
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

	var checkpoints []*CheckpointPayload
	for rows.Next() {
		var cpBytes []byte
		if err := rows.Scan(&cpBytes); err != nil {
			return nil, err
		}
		var cp CheckpointPayload
		if err := json.Unmarshal(cpBytes, &cp); err != nil {
			return nil, err
		}
		checkpoints = append(checkpoints, &cp)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return checkpoints, nil
}

// GetRecoveringTasks returns tasks in RECOVERING state with their last checkpoints.
func (s *CheckpointStore) GetRecoveringTasks() ([]*TaskRecord, error) {
	rows, err := s.db.Query(`
		SELECT task_id, tenant_id, status, runtime_id, runtime_endpoint,
		       task_definition, last_checkpoint, execution_envelope, execution_receipt,
		       proof_execution_id, proof_expected_hash, proof_stored_hash, proof_signature, proof_status, proof_checked_at,
		       proof_verified, proof_hash_valid, proof_signature_matches, proof_runtime_key_found, proof_chain_link_valid, proof_verification_reason, proof_verified_at,
		       idempotency_key, failure_reason, failure_details,
		       deadline_at, dispatched_at, completed_at, canceled_at, created_at,
		       executed_target, fallback_reason,
		       registered_agent_id, registered_agent_name
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

func (s *CheckpointStore) HydrateTaskPermissionEnvelope(task *TaskRecord) (*TaskRecord, error) {
	if task == nil || task.PermissionEnvelope != nil {
		return task, nil
	}
	if loadOvertureSigningKey() == nil {
		return task, nil
	}
	if len(task.RequiredCapabilities) == 0 && len(deriveRequiredCapabilitiesFromTaskDefinition(task.TaskDefinition)) == 0 {
		return task, nil
	}

	envelope, err := s.LoadLatestTaskPermissionEnvelope(task.TaskID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return task, nil
		}
		return nil, err
	}
	task.PermissionEnvelope = envelope
	if len(task.RequiredCapabilities) == 0 && len(envelope.RequiredCapabilities) > 0 {
		task.RequiredCapabilities = append([]string(nil), envelope.RequiredCapabilities...)
	}
	if agentIdentityEmpty(task.AgentIdentity) && !agentIdentityEmpty(envelope.AgentIdentity) {
		task.AgentIdentity = envelope.AgentIdentity
	}
	return task, nil
}

func (s *CheckpointStore) LoadLatestTaskPermissionEnvelope(taskID uuid.UUID) (*TaskPermissionEnvelope, error) {
	var raw []byte
	err := s.db.QueryRow(`
		SELECT permission_envelope
		FROM ai_task_permission_audit
		WHERE task_id = $1
		ORDER BY issued_at_unix_ms DESC, persisted_at DESC
		LIMIT 1`,
		taskID,
	).Scan(&raw)
	if err != nil {
		return nil, err
	}
	if len(raw) == 0 {
		return nil, sql.ErrNoRows
	}

	var envelope TaskPermissionEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil, fmt.Errorf("decode task permission envelope: %w", err)
	}
	return &envelope, nil
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
	var proofVerified, proofHashValid, proofSignatureMatches, proofRuntimeKeyFound, proofChainLinkValid sql.NullBool
	var proofVerificationReason sql.NullString
	var proofVerifiedAt sql.NullTime
	var executedTarget sql.NullString
	var fallbackReason sql.NullString
	var registeredAgentID uuid.NullUUID
	var registeredAgentName sql.NullString
	err := row.Scan(
		&t.TaskID, &t.TenantID, &t.Status, &t.RuntimeID, &t.RuntimeEndpoint,
		&defBytes, &cpBytes, &envelopeBytes, &receiptBytes,
		&proofExecutionID, &proofExpectedHash, &proofStoredHash, &proofSignature, &proofStatus, &proofCheckedAt,
		&proofVerified, &proofHashValid, &proofSignatureMatches, &proofRuntimeKeyFound, &proofChainLinkValid, &proofVerificationReason, &proofVerifiedAt,
		&t.IdempotencyKey, &t.FailureReason, &failureDetailBytes,
		&t.DeadlineAt, &t.DispatchedAt, &t.CompletedAt, &t.CanceledAt, &t.CreatedAt,
		&executedTarget, &fallbackReason,
		&registeredAgentID, &registeredAgentName,
	)
	if err != nil {
		return nil, err
	}
	t.TaskDefinition = defBytes
	if executedTarget.Valid && executedTarget.String != "" {
		v := executedTarget.String
		t.ExecutedTarget = &v
	}
	if fallbackReason.Valid && fallbackReason.String != "" {
		v := fallbackReason.String
		t.FallbackReason = &v
	}
	if registeredAgentID.Valid {
		id := registeredAgentID.UUID
		t.RegisteredAgentID = &id
	}
	if registeredAgentName.Valid {
		t.RegisteredAgentName = registeredAgentName.String
	}
	governance := extractTaskGovernanceFromDefinition(t.TaskDefinition)
	t.AgentIdentity = governance.AgentIdentity
	t.RequiredCapabilities = governance.RequiredCapabilities
	t.CredentialRequests = governance.CredentialRequests
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
	if proofExecutionID.Valid || proofExpectedHash.Valid || proofStoredHash.Valid || proofSignature.Valid || proofStatus.Valid || proofCheckedAt.Valid ||
		proofVerified.Valid || proofHashValid.Valid || proofSignatureMatches.Valid || proofRuntimeKeyFound.Valid || proofChainLinkValid.Valid || proofVerificationReason.Valid || proofVerifiedAt.Valid {
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
		if proofVerified.Valid {
			v := proofVerified.Bool
			t.Proof.Verified = &v
		}
		if proofHashValid.Valid {
			v := proofHashValid.Bool
			t.Proof.HashValid = &v
		}
		if proofSignatureMatches.Valid {
			v := proofSignatureMatches.Bool
			t.Proof.SignatureMatches = &v
		}
		if proofRuntimeKeyFound.Valid {
			v := proofRuntimeKeyFound.Bool
			t.Proof.RuntimeKeyFound = &v
		}
		if proofChainLinkValid.Valid {
			v := proofChainLinkValid.Bool
			t.Proof.ChainLinkValid = &v
		}
		if proofVerificationReason.Valid {
			t.Proof.VerificationReason = proofVerificationReason.String
		}
		if proofVerifiedAt.Valid {
			t.Proof.VerifiedAt = &proofVerifiedAt.Time
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
	case TaskStatusApprovalRequired:
		return "approval_required"
	case TaskStatusCompleted:
		return "task_completed"
	case TaskStatusFailed:
		if task.FailureReason != nil {
			switch *task.FailureReason {
			case "no runtime available for recovery":
				return "no_runtime_available_for_recovery"
			case TaskFailureReasonInvalidRecoveryCheckpoint:
				return "invalid_recovery_checkpoint"
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
	if len(cp.WalEntries) == 0 {
		return cp.ResumeToken.LastCommittedStep == 0
	}
	var maxStep uint32
	for _, entry := range cp.WalEntries {
		if entry.StepIndex > cp.ResumeToken.LastCommittedStep {
			return false
		}
		if entry.StepIndex > maxStep {
			maxStep = entry.StepIndex
		}
	}
	if maxStep != cp.ResumeToken.LastCommittedStep {
		return false
	}
	return true
}

func TaskCheckpointEntriesBelongToTask(cp *CheckpointPayload) bool {
	if cp == nil || cp.TaskID == uuid.Nil {
		return false
	}
	for _, entry := range cp.WalEntries {
		if entry.TaskID != cp.TaskID {
			return false
		}
	}
	return true
}

func TaskCheckpointEntriesHaveStableIDs(cp *CheckpointPayload) bool {
	if cp == nil {
		return false
	}
	for _, entry := range cp.WalEntries {
		if entry.EntryID == uuid.Nil {
			return false
		}
	}
	return true
}

func TaskRecoveryCheckpointUsable(taskID uuid.UUID, cp *CheckpointPayload) bool {
	if cp == nil || taskID == uuid.Nil || cp.TaskID != taskID {
		return false
	}
	return TaskCheckpointWatermarkConsistent(cp) &&
		TaskCheckpointEntriesBelongToTask(cp) &&
		TaskCheckpointEntriesHaveStableIDs(cp)
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

func nullUUID(id *uuid.UUID) any {
	if id == nil || *id == uuid.Nil {
		return nil
	}
	return *id
}

// PersistTaskProofVerification stores the safe outcome of a fresh proof
// verification (booleans + reason + timestamp) onto task_records, so the task
// detail GET path can show "Receipt verified" / "Chain intact" without
// re-running verification. It never persists receipt contents or secrets.
func (s *CheckpointStore) PersistTaskProofVerification(taskID uuid.UUID, tenantID string, summary TaskProofVerificationSummary) error {
	var chainValid any
	if summary.ChainChecked {
		chainValid = summary.ChainLinkValid
	}
	_, err := s.db.Exec(`
		UPDATE task_records
		SET proof_verified = $1,
		    proof_hash_valid = $2,
		    proof_signature_matches = $3,
		    proof_runtime_key_found = $4,
		    proof_chain_link_valid = $5,
		    proof_verification_reason = $6,
		    proof_verified_at = $7
		WHERE task_id = $8 AND tenant_id = $9`,
		summary.Verified,
		summary.HashValid,
		summary.SignatureMatches,
		summary.RuntimeKeyFound,
		chainValid,
		nullString(summary.Reason),
		time.Now().UTC(),
		taskID, tenantID,
	)
	return err
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
