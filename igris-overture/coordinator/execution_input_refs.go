package coordinator

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"
)

const inputReferenceRedactionPolicyVersion = "input-reference-redaction-v1"

var (
	ErrExecutionInputRefNotFound = errors.New("execution input ref not found")
	ErrExecutionInputRefRevoked  = errors.New("execution input ref revoked")
	ErrExecutionInputRefExpired  = errors.New("execution input ref expired")
	ErrExecutionInputRefScope    = errors.New("execution input ref scope mismatch")
)

type ExecutionInputRef struct {
	ID                     uuid.UUID       `json:"id"`
	TenantID               string          `json:"tenant_id"`
	TaskID                 uuid.UUID       `json:"task_id,omitempty"`
	ActionID               *uuid.UUID      `json:"action_id,omitempty"`
	Purpose                string          `json:"purpose"`
	Ciphertext             []byte          `json:"-"`
	Nonce                  []byte          `json:"-"`
	AAD                    json.RawMessage `json:"-"`
	DigestSHA256           string          `json:"digest_sha256"`
	PlaintextBytes         int             `json:"plaintext_bytes"`
	ContentType            string          `json:"content_type,omitempty"`
	RedactionPolicyVersion string          `json:"redaction_policy_version"`
	KeyVersion             string          `json:"key_version"`
	CreatedAt              time.Time       `json:"created_at"`
	ExpiresAt              *time.Time      `json:"expires_at,omitempty"`
	RevokedAt              *time.Time      `json:"revoked_at,omitempty"`
	LastDecryptedAt        *time.Time      `json:"last_decrypted_at,omitempty"`
}

type executionInputAAD struct {
	TenantID   string    `json:"tenant_id"`
	TaskID     uuid.UUID `json:"task_id,omitempty"`
	InputRefID uuid.UUID `json:"input_ref_id"`
	Purpose    string    `json:"purpose"`
	KeyVersion string    `json:"key_version"`
}

func executionInputAssociatedData(tenantID string, taskID uuid.UUID, refID uuid.UUID, purpose, keyVersion string) ([]byte, error) {
	return json.Marshal(executionInputAAD{
		TenantID:   tenantID,
		TaskID:     taskID,
		InputRefID: refID,
		Purpose:    purpose,
		KeyVersion: keyVersion,
	})
}

func (s *CheckpointStore) SaveExecutionInputRef(ctx context.Context, ref ExecutionInputRef) error {
	if s == nil || s.db == nil || ref.ID == uuid.Nil {
		return nil
	}
	if isSQLMockDB(s.db) {
		return nil
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO execution_input_refs (
			id, tenant_id, task_id, action_id, purpose, ciphertext, nonce, aad,
			digest_sha256, plaintext_bytes, content_type, redaction_policy_version,
			key_version, created_at, expires_at, revoked_at
		) VALUES ($1,$2,NULLIF($3,'')::uuid,$4,$5,$6,$7,$8::jsonb,$9,$10,NULLIF($11,''),$12,$13,NOW(),$14,$15)
		ON CONFLICT (id) DO NOTHING`,
		ref.ID, ref.TenantID, nullUUIDString(ref.TaskID), ref.ActionID, ref.Purpose, ref.Ciphertext, ref.Nonce,
		string(ref.AAD), ref.DigestSHA256, ref.PlaintextBytes, ref.ContentType, ref.RedactionPolicyVersion,
		ref.KeyVersion, ref.ExpiresAt, ref.RevokedAt,
	)
	return err
}

func (s *CheckpointStore) CreateTaskWithExecutionInputRefs(ctx context.Context, task *TaskRecord, refs []ExecutionInputRef) (bool, error) {
	if len(refs) == 0 || s == nil || s.db == nil || isSQLMockDB(s.db) {
		return s.CreateTask(task)
	}
	defBytes, err := json.Marshal(task.TaskDefinition)
	if err != nil {
		return false, fmt.Errorf("marshal task definition: %w", err)
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	result, err := tx.ExecContext(ctx, `
		INSERT INTO task_records
			(task_id, tenant_id, status, task_definition, idempotency_key, deadline_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (idempotency_key) DO NOTHING`,
		task.TaskID, task.TenantID, TaskStatusPending, defBytes, task.IdempotencyKey, task.DeadlineAt,
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
	for _, ref := range refs {
		if err := insertExecutionInputRef(ctx, tx, ref); err != nil {
			return false, err
		}
		eventType := "input_ref_created"
		if err := insertExecutionInputRefAudit(ctx, tx, ExecutionInputRefAuditEvent{
			TenantID:   ref.TenantID,
			TaskID:     ref.TaskID,
			ActionID:   ref.ActionID,
			InputRefID: ref.ID,
			Purpose:    ref.Purpose,
			ActorType:  "system",
			EventType:  eventType,
			Reason:     "task submission stored encrypted execution input reference",
			Success:    true,
		}); err != nil {
			return false, err
		}
	}
	if err := tx.Commit(); err != nil {
		return false, err
	}
	return true, nil
}

type sqlExecerContext interface {
	ExecContext(context.Context, string, ...interface{}) (sql.Result, error)
}

func insertExecutionInputRef(ctx context.Context, execer sqlExecerContext, ref ExecutionInputRef) error {
	_, err := execer.ExecContext(ctx, `
		INSERT INTO execution_input_refs (
			id, tenant_id, task_id, action_id, purpose, ciphertext, nonce, aad,
			digest_sha256, plaintext_bytes, content_type, redaction_policy_version,
			key_version, created_at, expires_at, revoked_at
		) VALUES ($1,$2,NULLIF($3,'')::uuid,$4,$5,$6,$7,$8::jsonb,$9,$10,NULLIF($11,''),$12,$13,NOW(),$14,$15)
		ON CONFLICT (id) DO NOTHING`,
		ref.ID, ref.TenantID, nullUUIDString(ref.TaskID), ref.ActionID, ref.Purpose, ref.Ciphertext, ref.Nonce,
		string(ref.AAD), ref.DigestSHA256, ref.PlaintextBytes, ref.ContentType, ref.RedactionPolicyVersion,
		ref.KeyVersion, ref.ExpiresAt, ref.RevokedAt,
	)
	return err
}

func (s *CheckpointStore) LoadExecutionInputRef(ctx context.Context, tenantID string, taskID uuid.UUID, refID uuid.UUID, purpose string) (*ExecutionInputRef, error) {
	if s == nil || s.db == nil {
		return nil, ErrExecutionInputRefNotFound
	}
	var ref ExecutionInputRef
	var actionID sql.NullString
	var taskIDValue sql.NullString
	var aad []byte
	var contentType sql.NullString
	err := s.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, COALESCE(task_id::text,''), COALESCE(action_id::text,''), purpose,
		       ciphertext, nonce, aad, digest_sha256, plaintext_bytes, COALESCE(content_type,''),
		       redaction_policy_version, key_version, created_at, expires_at, revoked_at, last_decrypted_at
		FROM execution_input_refs
		WHERE id = $1 AND tenant_id = $2 AND (task_id = $3 OR task_id IS NULL) AND purpose = $4`,
		refID, tenantID, taskID, purpose,
	).Scan(
		&ref.ID, &ref.TenantID, &taskIDValue, &actionID, &ref.Purpose,
		&ref.Ciphertext, &ref.Nonce, &aad, &ref.DigestSHA256, &ref.PlaintextBytes, &contentType,
		&ref.RedactionPolicyVersion, &ref.KeyVersion, &ref.CreatedAt, &ref.ExpiresAt, &ref.RevokedAt, &ref.LastDecryptedAt,
	)
	if err == sql.ErrNoRows {
		return nil, ErrExecutionInputRefNotFound
	}
	if err != nil {
		return nil, err
	}
	if taskIDValue.Valid && strings.TrimSpace(taskIDValue.String) != "" {
		if parsed, parseErr := uuid.Parse(taskIDValue.String); parseErr == nil {
			ref.TaskID = parsed
		}
	}
	if actionID.Valid && strings.TrimSpace(actionID.String) != "" {
		if parsed, parseErr := uuid.Parse(actionID.String); parseErr == nil {
			ref.ActionID = &parsed
		}
	}
	ref.AAD = aad
	ref.ContentType = contentType.String
	if ref.TaskID != uuid.Nil && ref.TaskID != taskID {
		return nil, ErrExecutionInputRefScope
	}
	if ref.RevokedAt != nil {
		return nil, ErrExecutionInputRefRevoked
	}
	if ref.ExpiresAt != nil && time.Now().UTC().After(*ref.ExpiresAt) {
		return nil, ErrExecutionInputRefExpired
	}
	return &ref, nil
}

func (s *CheckpointStore) DecryptExecutionInputRef(ctx context.Context, tenantID string, taskID uuid.UUID, refID uuid.UUID, purpose, reason string) ([]byte, error) {
	ref, err := s.LoadExecutionInputRef(ctx, tenantID, taskID, refID, purpose)
	if err != nil {
		_ = s.SaveExecutionInputRefAudit(ctx, ExecutionInputRefAuditEvent{
			TenantID: tenantID, TaskID: taskID, InputRefID: refID, Purpose: purpose,
			EventType: "input_ref_decrypt_denied", ActorType: "system", Reason: reason,
			Success: false, FailureCode: safeInputRefFailureCode(err),
		})
		return nil, err
	}
	cipherSvc, err := newExecutionInputCipherFromEnv()
	if err != nil {
		_ = s.SaveExecutionInputRefAudit(ctx, ExecutionInputRefAuditEvent{
			TenantID: tenantID, TaskID: taskID, InputRefID: refID, Purpose: purpose,
			EventType: "input_ref_decrypt_denied", ActorType: "system", Reason: reason,
			Success: false, FailureCode: "key_unavailable",
		})
		return nil, err
	}
	expectedAAD, err := executionInputAssociatedData(tenantID, taskID, refID, purpose, ref.KeyVersion)
	if err != nil {
		return nil, err
	}
	if string(expectedAAD) != string(ref.AAD) {
		_ = s.SaveExecutionInputRefAudit(ctx, ExecutionInputRefAuditEvent{
			TenantID: tenantID, TaskID: taskID, InputRefID: refID, Purpose: purpose,
			EventType: "input_ref_decrypt_denied", ActorType: "system", Reason: reason,
			Success: false, FailureCode: "aad_mismatch",
		})
		return nil, ErrExecutionInputRefScope
	}
	plaintext, err := cipherSvc.decrypt(ref.Ciphertext, ref.Nonce, expectedAAD)
	if err != nil {
		_ = s.SaveExecutionInputRefAudit(ctx, ExecutionInputRefAuditEvent{
			TenantID: tenantID, TaskID: taskID, InputRefID: refID, Purpose: purpose,
			EventType: "input_ref_decrypt_denied", ActorType: "system", Reason: reason,
			Success: false, FailureCode: "auth_failed",
		})
		return nil, err
	}
	if sha256InputBytes(plaintext) != ref.DigestSHA256 || len(plaintext) != ref.PlaintextBytes {
		_ = s.SaveExecutionInputRefAudit(ctx, ExecutionInputRefAuditEvent{
			TenantID: tenantID, TaskID: taskID, InputRefID: refID, Purpose: purpose,
			EventType: "input_ref_decrypt_denied", ActorType: "system", Reason: reason,
			Success: false, FailureCode: "digest_mismatch",
		})
		return nil, ErrExecutionInputRefDecrypt
	}
	_ = s.MarkExecutionInputRefDecrypted(ctx, refID)
	_ = s.SaveExecutionInputRefAudit(ctx, ExecutionInputRefAuditEvent{
		TenantID: tenantID, TaskID: taskID, InputRefID: refID, Purpose: purpose,
		EventType: "input_ref_decrypted_for_recovery", ActorType: "system", Reason: reason,
		Success: true,
	})
	return plaintext, nil
}

func (s *CheckpointStore) MarkExecutionInputRefDecrypted(ctx context.Context, refID uuid.UUID) error {
	if s == nil || s.db == nil || refID == uuid.Nil || isSQLMockDB(s.db) {
		return nil
	}
	_, err := s.db.ExecContext(ctx, `UPDATE execution_input_refs SET last_decrypted_at = NOW() WHERE id = $1`, refID)
	return err
}

type ExecutionInputRefAuditEvent struct {
	TenantID    string
	TaskID      uuid.UUID
	ActionID    *uuid.UUID
	InputRefID  uuid.UUID
	Purpose     string
	ActorType   string
	EventType   string
	Reason      string
	Success     bool
	FailureCode string
}

func (s *CheckpointStore) SaveExecutionInputRefAudit(ctx context.Context, event ExecutionInputRefAuditEvent) error {
	if s == nil || s.db == nil || isSQLMockDB(s.db) {
		return nil
	}
	if event.ActorType == "" {
		event.ActorType = "system"
	}
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO execution_input_ref_audit (
			event_id, tenant_id, task_id, action_id, input_ref_id, purpose,
			actor_type, event_type, reason, success, failure_code, created_at
		) VALUES ($1,$2,NULLIF($3,'')::uuid,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
		uuid.New(), event.TenantID, nullUUIDString(event.TaskID), event.ActionID, event.InputRefID,
		event.Purpose, event.ActorType, event.EventType, event.Reason, event.Success, event.FailureCode,
	)
	return err
}

func nullUUIDString(id uuid.UUID) string {
	if id == uuid.Nil {
		return ""
	}
	return id.String()
}

func safeInputRefFailureCode(err error) string {
	switch {
	case errors.Is(err, ErrExecutionInputRefNotFound):
		return "not_found"
	case errors.Is(err, ErrExecutionInputRefRevoked):
		return "revoked"
	case errors.Is(err, ErrExecutionInputRefExpired):
		return "expired"
	case errors.Is(err, ErrExecutionInputRefScope):
		return "scope_mismatch"
	case errors.Is(err, ErrExecutionInputRefDecrypt):
		return "auth_failed"
	case errors.Is(err, ErrExecutionInputRefKeyMissing):
		return "key_unavailable"
	default:
		return "internal_error"
	}
}

func purposeForSensitiveInputKey(key string) string {
	switch normalizeInputKey(key) {
	case "body", "raw_body", "request_body", "payload", "content", "file_content", "file_contents", "full_text":
		return "execution_payload"
	case "path", "file_path", "absolute_path", "full_absolute_path", "private_path":
		return "private_path"
	case "url":
		return "signed_url"
	case "headers", "authorization", "cookie", "set_cookie", "set-cookie", "token", "secret", "password", "api_key", "apikey", "private_key", "credential":
		return "sensitive_header"
	default:
		return "sensitive_input"
	}
}

func safeURLContainsSensitiveMaterial(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	return err == nil && parsed.Scheme != "" && parsed.Host != "" && (parsed.RawQuery != "" || parsed.User != nil)
}

func encryptedInputRefMetadata(ref ExecutionInputRef, summary string) map[string]interface{} {
	return map[string]interface{}{
		"input_redacted":            true,
		"encrypted_input_ref":       true,
		"encrypted_input_ref_id":    ref.ID.String(),
		"purpose":                   ref.Purpose,
		"input_digest_sha256":       ref.DigestSHA256,
		"input_bytes":               ref.PlaintextBytes,
		"input_content_type":        ref.ContentType,
		"safe_summary":              summary,
		"sensitive_fields_redacted": []string{ref.Purpose},
		"key_version":               ref.KeyVersion,
		"redaction_policy_version":  inputReferenceRedactionPolicyVersion,
	}
}

func inputRefMetadata(value map[string]interface{}) (uuid.UUID, string, bool) {
	if value == nil {
		return uuid.Nil, "", false
	}
	if value["encrypted_input_ref"] != true {
		return uuid.Nil, "", false
	}
	refID, err := uuid.Parse(valueToInputString(value["encrypted_input_ref_id"]))
	if err != nil {
		return uuid.Nil, "", false
	}
	purpose := strings.TrimSpace(valueToInputString(value["purpose"]))
	if purpose == "" {
		return uuid.Nil, "", false
	}
	return refID, purpose, true
}

func safeInputRefError(err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("encrypted input ref unavailable: %s", safeInputRefFailureCode(err))
}
