package coordinator

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// ErrExecutionLineageMissingTenant is returned when a product execution lineage
// record is persisted without a tenant_id. Lineage is a tenant-bound trust
// object: writing a tenant-null row would create a record that normal,
// tenant-scoped read paths must (and now do) refuse to return. Fail closed at
// write time rather than create an orphaned, unreadable receipt.
var ErrExecutionLineageMissingTenant = errors.New("execution lineage record missing tenant_id")

// ErrExecutionContextMissingTenant is returned when product execution context
// would be persisted without a tenant_id. execution_context enriches proof and
// inspection reads, so tenant-null rows are legacy/invalid for normal product
// paths.
var ErrExecutionContextMissingTenant = errors.New("execution context record missing tenant_id")

// ErrExecutionContextTenantMismatch is returned when an execution_id conflict
// targets an existing execution_context row owned by another tenant.
var ErrExecutionContextTenantMismatch = errors.New("execution context tenant mismatch")

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

type ExecutionLineageRecord struct {
	ExecutionID       string
	TransactionID     string
	TransactionHash   string
	AgentID           string
	CPUTimeMs         int64
	WallTimeMs        int64
	MemoryPeakMB      int64
	FSBytesWritten    int64
	ToolCalls         int
	ViolationOccurred bool
	ReceiptHash       string
	PreviousHash      string
	Signature         string
	RuntimeID         string
	TenantID          string
	TimestampUTC      time.Time
	Status            string
	PromptPreview     string
	ViolationDetails  json.RawMessage
}

type executionContextExecer interface {
	Exec(query string, args ...interface{}) (sql.Result, error)
}

type executionContextArtifactRefs struct {
	ExecutionID        string
	TenantID           string
	RuntimeID          string
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

func (s *CheckpointStore) SaveExecutionLineage(record *ExecutionLineageRecord) error {
	return saveExecutionLineage(s.db, record)
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
		RuntimeID:          firstNonEmpty(refs.RuntimeID, source.RuntimeID),
		RuntimeLabel:       source.RuntimeEndpoint,
		Provider:           refs.Provider,
		RouteDecision:      refs.RouteDecision,
		ExecutionPath:      firstNonEmpty(refs.ExecutionPath, executionPathFromRouteDecision(refs.RouteDecision, firstNonEmpty(refs.RuntimeID, source.RuntimeID) != "")),
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
	tenantID := strings.TrimSpace(record.TenantID)
	if tenantID == "" {
		return ErrExecutionContextMissingTenant
	}

	events := ensureJSONArray(record.Events)
	logs := ensureJSONArray(record.Logs)

	result, err := execer.Exec(`
		INSERT INTO execution_context (
			execution_id, tenant_id, task_id, runtime_id, runtime_label, provider,
			route_decision, execution_path, fallback_used, fallback_reason,
			policy_snapshot, capability_snapshot, events, logs, verification_status,
			receipt_id, receipt_hash, created_at, updated_at
		)
		VALUES (
			$1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''),
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
		    updated_at = NOW()
		WHERE execution_context.tenant_id = EXCLUDED.tenant_id`,
		record.ExecutionID,
		tenantID,
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
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err == nil && rowsAffected == 0 {
		return ErrExecutionContextTenantMismatch
	}
	return nil
}

func saveExecutionLineage(execer executionContextExecer, record *ExecutionLineageRecord) error {
	if record == nil || strings.TrimSpace(record.ExecutionID) == "" || strings.TrimSpace(record.ReceiptHash) == "" {
		return nil
	}
	// Product lineage must be tenant-bound. Refuse to persist a tenant-null row.
	if strings.TrimSpace(record.TenantID) == "" {
		return ErrExecutionLineageMissingTenant
	}
	timestamp := record.TimestampUTC
	if timestamp.IsZero() {
		timestamp = time.Now().UTC()
	}

	_, err := execer.Exec(`
		INSERT INTO execution_lineage (
			execution_id, transaction_id, transaction_hash, agent_id,
			cpu_time_ms, wall_time_ms, memory_peak_mb, fs_bytes_written, tool_calls,
			violation_occurred, receipt_hash, previous_hash, signature,
			runtime_id, tenant_id, timestamp_utc, status, prompt_preview, violation_details, persisted_at
		)
		VALUES (
			$1, COALESCE($2, ''), COALESCE($3, ''), $4,
			$5, $6, $7, $8, $9,
			$10, $11, COALESCE($12, ''), COALESCE($13, ''),
			NULLIF($14, ''), NULLIF($15, ''), $16, NULLIF($17, ''), NULLIF($18, ''), $19, NOW()
		)
		ON CONFLICT (execution_id) DO UPDATE
		SET transaction_id = COALESCE(NULLIF(EXCLUDED.transaction_id, ''), execution_lineage.transaction_id),
		    transaction_hash = COALESCE(NULLIF(EXCLUDED.transaction_hash, ''), execution_lineage.transaction_hash),
		    agent_id = COALESCE(NULLIF(EXCLUDED.agent_id, ''), execution_lineage.agent_id),
		    cpu_time_ms = EXCLUDED.cpu_time_ms,
		    wall_time_ms = EXCLUDED.wall_time_ms,
		    memory_peak_mb = EXCLUDED.memory_peak_mb,
		    fs_bytes_written = EXCLUDED.fs_bytes_written,
		    tool_calls = EXCLUDED.tool_calls,
		    violation_occurred = EXCLUDED.violation_occurred,
		    receipt_hash = EXCLUDED.receipt_hash,
		    previous_hash = EXCLUDED.previous_hash,
		    signature = EXCLUDED.signature,
		    runtime_id = COALESCE(EXCLUDED.runtime_id, execution_lineage.runtime_id),
		    tenant_id = COALESCE(EXCLUDED.tenant_id, execution_lineage.tenant_id),
		    timestamp_utc = EXCLUDED.timestamp_utc,
		    status = COALESCE(EXCLUDED.status, execution_lineage.status),
		    prompt_preview = COALESCE(EXCLUDED.prompt_preview, execution_lineage.prompt_preview),
		    violation_details = COALESCE(EXCLUDED.violation_details, execution_lineage.violation_details),
		    persisted_at = NOW()`,
		record.ExecutionID,
		nullString(record.TransactionID),
		nullString(record.TransactionHash),
		record.AgentID,
		record.CPUTimeMs,
		record.WallTimeMs,
		record.MemoryPeakMB,
		record.FSBytesWritten,
		record.ToolCalls,
		record.ViolationOccurred,
		record.ReceiptHash,
		nullString(record.PreviousHash),
		nullString(record.Signature),
		record.RuntimeID,
		record.TenantID,
		timestamp,
		record.Status,
		record.PromptPreview,
		nullRawJSON(record.ViolationDetails),
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
		RuntimeID          string         `json:"runtime_id"`
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
		RuntimeID   string `json:"runtime_id"`
	}
	if len(executionReceipt) > 0 && string(executionReceipt) != "null" && string(executionReceipt) != "{}" {
		if err := json.Unmarshal(executionReceipt, &receipt); err != nil {
			return nil, false
		}
		if strings.TrimSpace(receipt.RuntimeID) != "" && strings.TrimSpace(envelope.RuntimeID) != "" && strings.TrimSpace(receipt.RuntimeID) != strings.TrimSpace(envelope.RuntimeID) {
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
		ExecutionID:        firstNonEmpty(receipt.ExecutionID, envelope.ExecutionID),
		TenantID:           tenantID,
		RuntimeID:          firstNonEmpty(receipt.RuntimeID, envelope.RuntimeID),
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

func BuildExecutionLineageRecordFromReceipt(
	executionReceipt json.RawMessage,
	tenantID string,
	runtimeID string,
	status string,
	promptPreview string,
) (*ExecutionLineageRecord, error) {
	if len(executionReceipt) == 0 || string(executionReceipt) == "null" || string(executionReceipt) == "{}" {
		return nil, nil
	}

	var receipt struct {
		ExecutionID       string `json:"execution_id"`
		TransactionID     string `json:"transaction_id"`
		TransactionHash   string `json:"transaction_hash"`
		AgentID           string `json:"agent_id"`
		RuntimeID         string `json:"runtime_id"`
		CPUTimeMs         int64  `json:"cpu_time_ms"`
		WallTimeMs        int64  `json:"wall_time_ms"`
		MemoryPeakMB      int64  `json:"memory_peak_mb"`
		FSBytesWritten    int64  `json:"fs_bytes_written"`
		ToolCalls         int    `json:"tool_calls"`
		ViolationOccurred bool   `json:"violation_occurred"`
		ReceiptHash       string `json:"receipt_hash"`
		Hash              string `json:"hash"`
		PreviousHash      string `json:"previous_hash"`
		Signature         string `json:"signature"`
		TimestampUTC      string `json:"timestamp_utc"`
		Violation         string `json:"violation"`
	}
	if err := json.Unmarshal(executionReceipt, &receipt); err != nil {
		return nil, err
	}
	if receipt.ExecutionID == "" {
		return nil, nil
	}

	receiptHash := firstNonEmpty(receipt.ReceiptHash, receipt.Hash)
	if receiptHash == "" {
		return nil, nil
	}

	timestamp := time.Now().UTC()
	if strings.TrimSpace(receipt.TimestampUTC) != "" {
		if parsed, err := time.Parse(time.RFC3339, receipt.TimestampUTC); err == nil {
			timestamp = parsed.UTC()
		}
	}

	record := &ExecutionLineageRecord{
		ExecutionID:       receipt.ExecutionID,
		TransactionID:     receipt.TransactionID,
		TransactionHash:   receipt.TransactionHash,
		AgentID:           firstNonEmpty(receipt.AgentID, tenantID),
		CPUTimeMs:         receipt.CPUTimeMs,
		WallTimeMs:        receipt.WallTimeMs,
		MemoryPeakMB:      receipt.MemoryPeakMB,
		FSBytesWritten:    receipt.FSBytesWritten,
		ToolCalls:         receipt.ToolCalls,
		ViolationOccurred: receipt.ViolationOccurred,
		ReceiptHash:       receiptHash,
		PreviousHash:      receipt.PreviousHash,
		Signature:         receipt.Signature,
		RuntimeID:         firstNonEmpty(receipt.RuntimeID, runtimeID),
		TenantID:          tenantID,
		TimestampUTC:      timestamp,
		Status:            normalizeExecutionLineageStatus(status, receipt.ViolationOccurred),
		PromptPreview:     promptPreview,
	}

	if receipt.ViolationOccurred || strings.TrimSpace(receipt.Violation) != "" {
		violationDetails, _ := json.Marshal(map[string]any{
			"violation_type": firstNonEmpty(receipt.Violation, "violation_recorded"),
		})
		record.ViolationDetails = violationDetails
	}
	return record, nil
}

func normalizeExecutionLineageStatus(status string, violationOccurred bool) string {
	normalized := strings.ToUpper(strings.TrimSpace(status))
	switch {
	case violationOccurred && normalized == "COMPLETED":
		return "VIOLATION"
	case normalized != "":
		return normalized
	case violationOccurred:
		return "VIOLATION"
	default:
		return "COMPLETED"
	}
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
