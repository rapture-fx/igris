package coordinator

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type ExecutionContextRecord struct {
	ExecutionID        string
	TenantID           string
	TaskID             *uuid.UUID
	RuntimeID          string
	RuntimeLabel       string
	Provider           string
	RouteDecision      string
	ExecutionPath      string
	FallbackUsed       bool
	FallbackReason     string
	PolicySnapshot     json.RawMessage
	CapabilitySnapshot json.RawMessage
	Events             json.RawMessage
	Logs               json.RawMessage
	VerificationStatus string
	ReceiptID          string
	ReceiptHash        string
}

type executionContextExecer interface {
	Exec(query string, args ...interface{}) (sql.Result, error)
}

type executionContextArtifactRefs struct {
	ExecutionID        string
	TenantID           string
	Provider           string
	RouteDecision      string
	ExecutionPath      string
	PolicySnapshot     json.RawMessage
	CapabilitySnapshot json.RawMessage
	Events             json.RawMessage
	Logs               json.RawMessage
	VerificationStatus string
	ReceiptHash        string
}

type executionContextTaskSource struct {
	TenantID           string
	RuntimeID          string
	RuntimeEndpoint    string
	ProofStatus        string
	FailureReason      string
	FailureDetails     []byte
	PermissionEnvelope []byte
	CreatedAt          time.Time
	DispatchedAt       sql.NullTime
	CompletedAt        sql.NullTime
	CanceledAt         sql.NullTime
}

func (s *CheckpointStore) SaveExecutionContext(record *ExecutionContextRecord) error {
	return saveExecutionContext(s.db, record)
}

func buildTaskExecutionContextRecord(queryer queryRower, taskID uuid.UUID, executionEnvelope, executionReceipt json.RawMessage) (*ExecutionContextRecord, error) {
	refs, ok := executionContextRefsFromArtifacts(executionEnvelope, executionReceipt)
	if !ok {
		return nil, nil
	}

	source, err := loadExecutionContextTaskSource(queryer, taskID)
	if err != nil {
		return nil, err
	}

	record := &ExecutionContextRecord{
		ExecutionID:        refs.ExecutionID,
		TenantID:           firstNonEmpty(refs.TenantID, source.TenantID),
		TaskID:             &taskID,
		RuntimeID:          source.RuntimeID,
		RuntimeLabel:       source.RuntimeEndpoint,
		Provider:           refs.Provider,
		RouteDecision:      refs.RouteDecision,
		ExecutionPath:      firstNonEmpty(refs.ExecutionPath, executionPathFromRouteDecision(refs.RouteDecision, source.RuntimeID != "")),
		PolicySnapshot:     refs.PolicySnapshot,
		CapabilitySnapshot: firstNonEmptyJSON(refs.CapabilitySnapshot, capabilitySnapshotFromPermissionEnvelope(source.PermissionEnvelope)),
		VerificationStatus: firstNonEmpty(source.ProofStatus, refs.VerificationStatus),
		ReceiptHash:        refs.ReceiptHash,
	}

	record.Events, record.Logs = buildTaskExecutionEventPayloads(source, refs)
	return record, nil
}

func saveExecutionContext(execer executionContextExecer, record *ExecutionContextRecord) error {
	if record == nil || strings.TrimSpace(record.ExecutionID) == "" {
		return nil
	}

	events := ensureJSONArray(record.Events)
	logs := ensureJSONArray(record.Logs)

	_, err := execer.Exec(`
		INSERT INTO execution_context (
			execution_id, tenant_id, task_id, runtime_id, runtime_label, provider,
			route_decision, execution_path, fallback_used, fallback_reason,
			policy_snapshot, capability_snapshot, events, logs, verification_status,
			receipt_id, receipt_hash, created_at, updated_at
		)
		VALUES (
			$1, NULLIF($2, ''), $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''),
			NULLIF($7, ''), NULLIF($8, ''), $9, NULLIF($10, ''),
			$11, $12, $13, $14, NULLIF($15, ''), NULLIF($16, ''), NULLIF($17, ''),
			NOW(), NOW()
		)
		ON CONFLICT (execution_id) DO UPDATE
		SET tenant_id = COALESCE(EXCLUDED.tenant_id, execution_context.tenant_id),
		    task_id = COALESCE(EXCLUDED.task_id, execution_context.task_id),
		    runtime_id = COALESCE(EXCLUDED.runtime_id, execution_context.runtime_id),
		    runtime_label = COALESCE(EXCLUDED.runtime_label, execution_context.runtime_label),
		    provider = COALESCE(EXCLUDED.provider, execution_context.provider),
		    route_decision = COALESCE(EXCLUDED.route_decision, execution_context.route_decision),
		    execution_path = COALESCE(EXCLUDED.execution_path, execution_context.execution_path),
		    fallback_used = execution_context.fallback_used OR EXCLUDED.fallback_used,
		    fallback_reason = COALESCE(EXCLUDED.fallback_reason, execution_context.fallback_reason),
		    policy_snapshot = COALESCE(EXCLUDED.policy_snapshot, execution_context.policy_snapshot),
		    capability_snapshot = COALESCE(EXCLUDED.capability_snapshot, execution_context.capability_snapshot),
		    events = CASE
		        WHEN jsonb_array_length(EXCLUDED.events) > 0 THEN EXCLUDED.events
		        ELSE execution_context.events
		    END,
		    logs = CASE
		        WHEN jsonb_array_length(EXCLUDED.logs) > 0 THEN EXCLUDED.logs
		        ELSE execution_context.logs
		    END,
		    verification_status = COALESCE(EXCLUDED.verification_status, execution_context.verification_status),
		    receipt_id = COALESCE(EXCLUDED.receipt_id, execution_context.receipt_id),
		    receipt_hash = COALESCE(EXCLUDED.receipt_hash, execution_context.receipt_hash),
		    updated_at = NOW()`,
		record.ExecutionID,
		record.TenantID,
		record.TaskID,
		record.RuntimeID,
		record.RuntimeLabel,
		record.Provider,
		record.RouteDecision,
		record.ExecutionPath,
		record.FallbackUsed,
		record.FallbackReason,
		nullRawJSON(record.PolicySnapshot),
		nullRawJSON(record.CapabilitySnapshot),
		events,
		logs,
		record.VerificationStatus,
		record.ReceiptID,
		record.ReceiptHash,
	)
	return err
}

func executionContextRefsFromArtifacts(executionEnvelope, executionReceipt json.RawMessage) (*executionContextArtifactRefs, bool) {
	if len(executionEnvelope) == 0 {
		return nil, false
	}

	var envelope struct {
		ExecutionID        string         `json:"execution_id"`
		TenantID           *string        `json:"tenant_id"`
		Provider           string         `json:"provider"`
		Model              string         `json:"model"`
		RoutingDecision    string         `json:"routing_decision"`
		BoundsApplied      map[string]any `json:"bounds_applied"`
		PolicyDecisionID   string         `json:"policy_decision_id"`
		PolicyDecisionHash string         `json:"policy_decision_hash"`
		GovernedActionHash string         `json:"governed_action_hash"`
		Violation          string         `json:"violation"`
		FinishReason       string         `json:"finish_reason"`
	}
	if err := json.Unmarshal(executionEnvelope, &envelope); err != nil {
		return nil, false
	}
	if envelope.ExecutionID == "" {
		return nil, false
	}

	var receipt struct {
		ExecutionID string `json:"execution_id"`
		ReceiptHash string `json:"receipt_hash"`
		Hash        string `json:"hash"`
	}
	if len(executionReceipt) > 0 && string(executionReceipt) != "null" && string(executionReceipt) != "{}" {
		if err := json.Unmarshal(executionReceipt, &receipt); err != nil {
			return nil, false
		}
		if receipt.ExecutionID != "" && receipt.ExecutionID != envelope.ExecutionID {
			return nil, false
		}
	}

	policySnapshot := make(map[string]any)
	if len(envelope.BoundsApplied) > 0 {
		policySnapshot["bounds_applied"] = envelope.BoundsApplied
	}
	if envelope.PolicyDecisionID != "" {
		policySnapshot["policy_decision_id"] = envelope.PolicyDecisionID
	}
	if envelope.PolicyDecisionHash != "" {
		policySnapshot["policy_decision_hash"] = envelope.PolicyDecisionHash
	}
	if envelope.GovernedActionHash != "" {
		policySnapshot["governed_action_hash"] = envelope.GovernedActionHash
	}
	if envelope.Violation != "" {
		policySnapshot["violation"] = envelope.Violation
	}

	var policySnapshotRaw json.RawMessage
	if len(policySnapshot) > 0 {
		policySnapshotRaw, _ = json.Marshal(policySnapshot)
	}

	receiptHash := firstNonEmpty(receipt.ReceiptHash, receipt.Hash)
	tenantID := ""
	if envelope.TenantID != nil {
		tenantID = *envelope.TenantID
	}

	return &executionContextArtifactRefs{
		ExecutionID:        envelope.ExecutionID,
		TenantID:           tenantID,
		Provider:           firstNonEmpty(envelope.Provider, providerFromRouteDecision(envelope.RoutingDecision), envelope.Model),
		RouteDecision:      envelope.RoutingDecision,
		ExecutionPath:      executionPathFromRouteDecision(envelope.RoutingDecision, true),
		PolicySnapshot:     policySnapshotRaw,
		VerificationStatus: proofStatusFromReceiptHash(receiptHash),
		ReceiptHash:        receiptHash,
	}, true
}

func loadExecutionContextTaskSource(queryer queryRower, taskID uuid.UUID) (*executionContextTaskSource, error) {
	source := &executionContextTaskSource{}
	err := queryer.QueryRow(`
		SELECT
			tr.tenant_id,
			COALESCE(tr.runtime_id, ''),
			COALESCE(tr.runtime_endpoint, ''),
			COALESCE(tr.proof_status, ''),
			COALESCE(tr.failure_reason, ''),
			tr.failure_details,
			COALESCE((
				SELECT permission_envelope
				FROM ai_task_permission_audit
				WHERE task_id = tr.task_id
				ORDER BY persisted_at DESC
				LIMIT 1
			), '{}'::jsonb),
			tr.created_at,
			tr.dispatched_at,
			tr.completed_at,
			tr.canceled_at
		FROM task_records tr
		WHERE tr.task_id = $1`,
		taskID,
	).Scan(
		&source.TenantID,
		&source.RuntimeID,
		&source.RuntimeEndpoint,
		&source.ProofStatus,
		&source.FailureReason,
		&source.FailureDetails,
		&source.PermissionEnvelope,
		&source.CreatedAt,
		&source.DispatchedAt,
		&source.CompletedAt,
		&source.CanceledAt,
	)
	if err != nil {
		return nil, err
	}
	return source, nil
}

func buildTaskExecutionEventPayloads(source *executionContextTaskSource, refs *executionContextArtifactRefs) (json.RawMessage, json.RawMessage) {
	if source == nil {
		return ensureJSONArray(nil), ensureJSONArray(nil)
	}

	events := make([]map[string]any, 0, 8)
	appendEvent := func(ts time.Time, kind, message string) {
		events = append(events, map[string]any{
			"timestamp": ts.UTC().Format(time.RFC3339),
			"kind":      kind,
			"message":   message,
		})
	}

	appendEvent(source.CreatedAt, "task_created", "Task accepted by Overture")
	if source.DispatchedAt.Valid {
		message := "Task dispatched to runtime"
		if source.RuntimeID != "" {
			message = fmt.Sprintf("Task dispatched to runtime %s", source.RuntimeID)
		}
		appendEvent(source.DispatchedAt.Time, "task_dispatched", message)
	}
	if refs != nil && refs.RouteDecision != "" {
		routeAt := source.CreatedAt
		if source.DispatchedAt.Valid {
			routeAt = source.DispatchedAt.Time
		}
		appendEvent(routeAt, "route_decision", fmt.Sprintf("Runtime route decision recorded: %s", refs.RouteDecision))
	}
	if source.PermissionEnvelope != nil && string(source.PermissionEnvelope) != "{}" {
		appendEvent(source.CreatedAt, "capability_envelope", "Capability permission envelope recorded")
	}
	if refs != nil && refs.ReceiptHash != "" {
		receiptAt := source.CreatedAt
		if source.CompletedAt.Valid {
			receiptAt = source.CompletedAt.Time
		}
		appendEvent(receiptAt, "receipt_recorded", "Execution receipt recorded")
	}
	if source.CompletedAt.Valid {
		appendEvent(source.CompletedAt.Time, "task_completed", "Runtime reported task completion")
	}
	if source.CanceledAt.Valid {
		appendEvent(source.CanceledAt.Time, "task_canceled", "Task was canceled")
	}
	if source.FailureReason != "" {
		failureAt := source.CreatedAt
		if source.CompletedAt.Valid {
			failureAt = source.CompletedAt.Time
		}
		appendEvent(failureAt, "task_failed", fmt.Sprintf("Task failed: %s", source.FailureReason))
	}

	logs := make([]string, 0, len(events))
	for _, event := range events {
		logs = append(logs, fmt.Sprintf("%s %s: %s", event["timestamp"], event["kind"], event["message"]))
	}

	eventsRaw, _ := json.Marshal(events)
	logsRaw, _ := json.Marshal(logs)
	return ensureJSONArray(eventsRaw), ensureJSONArray(logsRaw)
}

func capabilitySnapshotFromPermissionEnvelope(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 || string(raw) == "{}" || string(raw) == "null" {
		return nil
	}

	var envelope TaskPermissionEnvelope
	if err := json.Unmarshal(raw, &envelope); err != nil {
		return nil
	}

	permitCount := 0
	denyCount := 0
	for _, decision := range envelope.Decisions {
		if decision.Permit {
			permitCount++
		} else {
			denyCount++
		}
	}

	snapshot := map[string]any{
		"envelope_id":              envelope.EnvelopeID,
		"required_capabilities":    envelope.RequiredCapabilities,
		"decisions":                envelope.Decisions,
		"credential_refs":          envelope.CredentialRefs,
		"permission_signed":        envelope.Signature != "",
		"issued_at_unix_ms":        envelope.IssuedAtUnixMs,
		"expires_at_unix_ms":       envelope.ExpiresAtUnixMs,
		"granted_capability_count": permitCount,
		"denied_capability_count":  denyCount,
	}

	encoded, _ := json.Marshal(snapshot)
	return encoded
}

func ensureJSONArray(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 || string(raw) == "null" {
		return json.RawMessage("[]")
	}
	return raw
}

func firstNonEmptyJSON(values ...json.RawMessage) json.RawMessage {
	for _, value := range values {
		if len(value) == 0 || string(value) == "null" || string(value) == "{}" {
			continue
		}
		return value
	}
	return nil
}

func providerFromRouteDecision(routeDecision string) string {
	normalized := strings.ToLower(strings.TrimSpace(routeDecision))
	switch {
	case strings.HasPrefix(normalized, "tool:") || strings.HasPrefix(normalized, "runtime:tool:"):
		return "tool"
	case strings.HasPrefix(normalized, "ros2:") || strings.HasPrefix(normalized, "runtime:robotics:"):
		return "robotics"
	case strings.Contains(normalized, "openai"):
		return "openai"
	case strings.Contains(normalized, "anthropic"):
		return "anthropic"
	case strings.Contains(normalized, "runtime"):
		return "runtime"
	default:
		return ""
	}
}

func executionPathFromRouteDecision(routeDecision string, runtimeBacked bool) string {
	normalized := strings.ToLower(strings.TrimSpace(routeDecision))
	switch {
	case strings.HasPrefix(normalized, "tool:") || strings.HasPrefix(normalized, "runtime:tool:"):
		return "runtime_tool"
	case strings.HasPrefix(normalized, "ros2:") || strings.HasPrefix(normalized, "runtime:robotics:"):
		return "runtime_robotics"
	case runtimeBacked || strings.Contains(normalized, "runtime"):
		return "runtime_task"
	case normalized != "":
		return "direct_provider"
	default:
		return ""
	}
}

func proofStatusFromReceiptHash(receiptHash string) string {
	if strings.TrimSpace(receiptHash) == "" {
		return ""
	}
	return "present"
}
