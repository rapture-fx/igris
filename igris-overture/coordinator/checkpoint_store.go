package coordinator

import (
	"crypto/sha256"
	"database/sql"
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

// TaskRecord is the durable state of a task tracked by Overture.
type TaskRecord struct {
	TaskID            uuid.UUID           `json:"task_id"`
	TenantID          string              `json:"tenant_id"`
	Status            TaskRecordStatus    `json:"status"`
	RuntimeID         *string             `json:"runtime_id,omitempty"`
	RuntimeEndpoint   *string             `json:"runtime_endpoint,omitempty"`
	TaskDefinition    json.RawMessage     `json:"task_definition"`
	LastCheckpoint    *CheckpointPayload  `json:"last_checkpoint,omitempty"`
	ExecutionEnvelope json.RawMessage     `json:"execution_envelope,omitempty"`
	ExecutionReceipt  json.RawMessage     `json:"execution_receipt,omitempty"`
	Proof             *TaskProofState     `json:"proof,omitempty"`
	AgentIdentity     AgentIdentity       `json:"agent_identity,omitempty"`
	RequiredCapabilities []string         `json:"required_capabilities,omitempty"`
	CredentialRequests   []CredentialRequest `json:"credential_requests,omitempty"`
	PermissionEnvelope   *TaskPermissionEnvelope `json:"permission_envelope,omitempty"`
	IdempotencyKey    string              `json:"idempotency_key"`
	FailureReason     *string             `json:"failure_reason,omitempty"`
	FailureDetails    *TaskFailureDetails `json:"failure_details,omitempty"`
	DeadlineAt        *time.Time          `json:"deadline_at,omitempty"`
	DispatchedAt      *time.Time          `json:"dispatched_at,omitempty"`
	CompletedAt       *time.Time          `json:"completed_at,omitempty"`
	CanceledAt        *time.Time          `json:"canceled_at,omitempty"`
	CreatedAt         time.Time           `json:"created_at"`
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
	TaskFailureReasonInvalidRecoveryCheckpoint                      = "invalid checkpoint for recovery"
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
