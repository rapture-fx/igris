package coordinator

import (
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/Igris-inertial/system/igris-overture/internal"
	"github.com/google/uuid"
)

const (
	ActionDecisionAllowed          = "allowed"
	ActionDecisionDenied           = "denied"
	ActionDecisionApprovalRequired = "approval_required"

	ReplayClassRetryable    = "retryable"
	ReplayClassNonRetryable = "non_retryable"

	CheckpointPortabilitySameRuntime       = "same_runtime_only"
	CheckpointPortabilityCompatibleRuntime = "compatible_runtime"
	CheckpointPortabilityAnyRuntime        = "any_runtime"
)

type ActionPolicyDecision struct {
	DecisionID            uuid.UUID `json:"decision_id"`
	TenantID              string    `json:"tenant_id"`
	TaskID                uuid.UUID `json:"task_id,omitempty"`
	AgentID               string    `json:"agent_id,omitempty"`
	RuntimeID             string    `json:"runtime_id,omitempty"`
	TaskType              string    `json:"task_type"`
	ActionName            string    `json:"action_name"`
	EnvironmentLabel      string    `json:"environment_label,omitempty"`
	ResourceScope         string    `json:"resource_scope,omitempty"`
	RiskLevel             string    `json:"risk_level"`
	Decision              string    `json:"decision"`
	ReplayClass           string    `json:"replay_class"`
	Irreversible          bool      `json:"irreversible"`
	HumanGated            bool      `json:"human_gated"`
	PolicyVersion         string    `json:"policy_version"`
	PolicyReason          string    `json:"policy_reason"`
	ActionDigest          string    `json:"action_digest"`
	BoundaryDigest        string    `json:"boundary_digest,omitempty"`
	CheckpointPortability string    `json:"checkpoint_portability"`
	CreatedAt             time.Time `json:"created_at"`
}

type RecoveryEvent struct {
	EventID           uuid.UUID `json:"recovery_event_id"`
	TenantID          string    `json:"tenant_id"`
	TaskID            uuid.UUID `json:"task_id"`
	EventType         string    `json:"event_type"`
	SourceRuntimeID   string    `json:"source_runtime_id,omitempty"`
	TargetRuntimeID   string    `json:"target_runtime_id,omitempty"`
	CheckpointDigest  string    `json:"checkpoint_digest,omitempty"`
	LastCommittedStep *int      `json:"last_committed_step,omitempty"`
	ReplayAllowed     *bool     `json:"replay_allowed,omitempty"`
	Reason            string    `json:"reason"`
	CreatedAt         time.Time `json:"created_at"`
}

type RuntimeHandoffEvent struct {
	EventID               uuid.UUID `json:"handoff_event_id"`
	TenantID              string    `json:"tenant_id"`
	TaskID                uuid.UUID `json:"task_id"`
	SourceRuntimeID       string    `json:"source_runtime_id,omitempty"`
	TargetRuntimeID       string    `json:"target_runtime_id,omitempty"`
	CheckpointDigest      string    `json:"checkpoint_digest,omitempty"`
	CheckpointPortability string    `json:"checkpoint_portability"`
	Decision              string    `json:"decision"`
	Reason                string    `json:"reason"`
	CreatedAt             time.Time `json:"created_at"`
}

type ExecutionBoundarySummary struct {
	BoundaryID          uuid.UUID       `json:"boundary_id"`
	TaskID              uuid.UUID       `json:"task_id,omitempty"`
	RuntimeID           string          `json:"runtime_id,omitempty"`
	PolicyDecisionID    *uuid.UUID      `json:"policy_decision_id,omitempty"`
	EnvironmentLabel    string          `json:"environment_label,omitempty"`
	AllowedTools        json.RawMessage `json:"allowed_tools,omitempty"`
	DeniedTools         json.RawMessage `json:"denied_tools,omitempty"`
	NetworkScope        string          `json:"network_scope"`
	FilesystemScope     string          `json:"filesystem_scope"`
	APIScope            string          `json:"api_scope"`
	ResourceLimits      json.RawMessage `json:"resource_limits,omitempty"`
	RuntimeCapabilities json.RawMessage `json:"runtime_capabilities,omitempty"`
	BoundaryDigest      string          `json:"boundary_digest"`
	CreatedAt           time.Time       `json:"created_at"`
}

type RuntimePortabilitySummary struct {
	SameRuntimeOnly   int `json:"same_runtime_only"`
	CompatibleRuntime int `json:"compatible_runtime"`
	AnyRuntime        int `json:"any_runtime"`
}

type RuntimeOperationsSummary struct {
	RuntimeID                    string                    `json:"runtime_id"`
	RuntimeLabel                 string                    `json:"runtime_label"`
	LastSeen                     *time.Time                `json:"last_seen,omitempty"`
	CapabilitySummary            json.RawMessage           `json:"capability_summary,omitempty"`
	Routable                     bool                      `json:"routable"`
	TrustState                   string                    `json:"trust_state"`
	ActiveExecutionCount         int                       `json:"active_execution_count"`
	RecentExecutionCount         int                       `json:"recent_execution_count"`
	BoundaryCount                int                       `json:"boundary_count"`
	ViolationCount               int                       `json:"violation_count"`
	HandoffCount                 int                       `json:"handoff_count"`
	VerifiedProofCount           int                       `json:"verified_proof_count"`
	FailedVerificationCount      int                       `json:"failed_verification_count"`
	CheckpointPortabilitySummary RuntimePortabilitySummary `json:"checkpoint_portability_summary"`
	EnforcementWarning           string                    `json:"enforcement_warning,omitempty"`
}

type VerificationResultRecord struct {
	TenantID         string
	TaskID           uuid.UUID
	ExecutionID      string
	PolicyDecisionID *uuid.UUID
	CheckpointDigest string
	ActionDigest     string
	Status           string
	PolicyCompliant  *bool
	EvidenceDigest   string
	Reason           string
}

type GovernanceListOptions struct {
	Limit           int
	Offset          int
	Sort            string
	TaskID          string
	AgentID         string
	RuntimeID       string
	Action          string
	Decision        string
	RiskLevel       string
	ReplayClass     string
	Irreversible    *bool
	HumanGated      *bool
	EventType       string
	HandoffDecision string
	Severity        string
	Status          string
	ExecutionID     string
	TimeRange       string
}

type GovernanceListResponse[T any] struct {
	Items  []T `json:"items"`
	Total  int `json:"total"`
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}

type BoundaryViolationRecord struct {
	ViolationID    uuid.UUID `json:"violation_id"`
	TaskID         uuid.UUID `json:"task_id,omitempty"`
	RuntimeID      string    `json:"runtime_id,omitempty"`
	BoundaryID     uuid.UUID `json:"boundary_id,omitempty"`
	ViolationType  string    `json:"violation_type"`
	Severity       string    `json:"severity"`
	Reason         string    `json:"reason"`
	EvidenceDigest string    `json:"evidence_digest,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

type VerificationResultSummary struct {
	VerificationID   uuid.UUID  `json:"verification_id"`
	TaskID           uuid.UUID  `json:"task_id,omitempty"`
	ExecutionID      string     `json:"execution_id,omitempty"`
	RuntimeID        string     `json:"runtime_id,omitempty"`
	PolicyDecisionID *uuid.UUID `json:"policy_decision_id,omitempty"`
	CheckpointDigest string     `json:"checkpoint_digest,omitempty"`
	ActionDigest     string     `json:"action_digest,omitempty"`
	Status           string     `json:"status"`
	PolicyCompliant  *bool      `json:"policy_compliant,omitempty"`
	HashValid        *bool      `json:"hash_valid,omitempty"`
	SignatureMatches *bool      `json:"signature_matches,omitempty"`
	RuntimeKeyFound  *bool      `json:"runtime_key_found,omitempty"`
	ChainLinkValid   *bool      `json:"chain_link_valid,omitempty"`
	EvidenceDigest   string     `json:"evidence_digest,omitempty"`
	Reason           string     `json:"reason"`
	CreatedAt        time.Time  `json:"created_at"`
}

type actionPolicyInput struct {
	TenantID        string
	TaskID          uuid.UUID
	RuntimeID       string
	TaskDefinition  json.RawMessage
	AgentIdentity   AgentIdentity
	RequiredCaps    []string
	Checkpoint      *CheckpointPayload
	RecoveryAttempt bool
}

type boundActionPolicy struct {
	Present          bool
	Risk             string
	ReplayClass      string
	ApprovalRequired bool
}

func extractBoundActionPolicy(definition json.RawMessage) boundActionPolicy {
	var payload struct {
		Graph struct {
			Nodes []struct {
				Metadata map[string]interface{} `json:"metadata"`
			} `json:"nodes"`
		} `json:"graph"`
	}
	if err := json.Unmarshal(definition, &payload); err != nil {
		return boundActionPolicy{}
	}
	for _, node := range payload.Graph.Nodes {
		contractHash, _ := node.Metadata["contract_hash"].(string)
		bindingID, _ := node.Metadata["contract_binding_id"].(string)
		if strings.TrimSpace(contractHash) == "" || strings.TrimSpace(bindingID) == "" {
			continue
		}
		risk, _ := node.Metadata["contract_risk"].(string)
		if riskLevelRank(risk) == 0 {
			risk = "low"
		}
		replayClass, _ := node.Metadata["replay_class"].(string)
		if replayClass != ReplayClassNonRetryable {
			replayClass = ReplayClassRetryable
		}
		approvalRequired, _ := node.Metadata["approval_required"].(bool)
		return boundActionPolicy{
			Present:          true,
			Risk:             risk,
			ReplayClass:      replayClass,
			ApprovalRequired: approvalRequired,
		}
	}
	return boundActionPolicy{}
}

func riskLevelRank(risk string) int {
	switch strings.ToLower(strings.TrimSpace(risk)) {
	case "low":
		return 1
	case "medium":
		return 2
	case "high":
		return 3
	case "critical":
		return 4
	default:
		return 0
	}
}

func evaluateActionPolicy(input actionPolicyInput) ActionPolicyDecision {
	taskType, actionName := classifyTaskAction(input.TaskDefinition)
	irreversible := taskHasIrreversibleAction(input.TaskDefinition)
	humanGated := taskRequiresHumanApproval(input.TaskDefinition)
	boundPolicy := extractBoundActionPolicy(input.TaskDefinition)
	replayClass := ReplayClassRetryable
	risk := "low"
	decision := ActionDecisionAllowed
	reason := "allowed by built-in execution governance"
	policyVersion := "execution-governance.builtin.v1"
	portability := CheckpointPortabilityCompatibleRuntime

	// A recovery may safely resume forward only when the checkpoint proves every
	// irreversible step is still pending. In that case the pre-irreversible
	// checkpoint is portable to a compatible runtime; otherwise irreversible work
	// pins the task to its original runtime.
	forwardResumeSafe := input.RecoveryAttempt &&
		recoveryForwardResumeSafe(input.TaskID, input.TaskDefinition, input.Checkpoint)
	if irreversible {
		replayClass = ReplayClassNonRetryable
		risk = "high"
		portability = CheckpointPortabilitySameRuntime
		if forwardResumeSafe {
			portability = CheckpointPortabilityCompatibleRuntime
		}
	}
	if boundPolicy.Present {
		policyVersion = "execution-governance.contract-bound.v1"
		if riskLevelRank(boundPolicy.Risk) > riskLevelRank(risk) {
			risk = boundPolicy.Risk
		}
		if boundPolicy.ReplayClass == ReplayClassNonRetryable {
			replayClass = ReplayClassNonRetryable
		}
		humanGated = humanGated || boundPolicy.ApprovalRequired
		reason = "allowed by stricter bound-contract and execution governance policy"
	}
	if humanGated {
		if riskLevelRank("medium") > riskLevelRank(risk) {
			risk = "medium"
		}
		decision = ActionDecisionApprovalRequired
		reason = "human approval required before execution"
	}
	if input.RecoveryAttempt && !TaskRecoveryCheckpointUsable(input.TaskID, input.Checkpoint) {
		decision = ActionDecisionDenied
		reason = "recovery checkpoint is missing or invalid"
	}
	// Irreversible actions may be recovered only when the checkpoint proves the
	// irreversible step has not executed yet (forward-resume). If it has committed,
	// may have committed, or the checkpoint cannot prove safety, recovery is denied
	// so a committed side effect is never replayed on another runtime.
	if input.RecoveryAttempt && irreversible && !forwardResumeSafe {
		decision = ActionDecisionDenied
		reason = "irreversible action already committed or checkpoint cannot prove safe forward-resume"
	}

	boundary := defaultExecutionBoundary(input.TaskDefinition, input.RequiredCaps)
	return ActionPolicyDecision{
		DecisionID:            uuid.New(),
		TenantID:              input.TenantID,
		TaskID:                input.TaskID,
		AgentID:               input.AgentIdentity.AgentID,
		RuntimeID:             input.RuntimeID,
		TaskType:              taskType,
		ActionName:            actionName,
		EnvironmentLabel:      "tenant-runtime",
		ResourceScope:         boundary.resourceScope,
		RiskLevel:             risk,
		Decision:              decision,
		ReplayClass:           replayClass,
		Irreversible:          irreversible,
		HumanGated:            humanGated,
		PolicyVersion:         policyVersion,
		PolicyReason:          reason,
		ActionDigest:          digestRaw(input.TaskDefinition),
		BoundaryDigest:        boundary.digest,
		CheckpointPortability: portability,
		CreatedAt:             time.Now().UTC(),
	}
}

func classifyTaskAction(definition json.RawMessage) (string, string) {
	var payload struct {
		Type  string `json:"type"`
		Graph struct {
			Nodes []struct {
				Kind     string `json:"kind"`
				ToolName string `json:"tool_name"`
				Action   string `json:"action"`
			} `json:"nodes"`
		} `json:"graph"`
	}
	_ = json.Unmarshal(definition, &payload)
	taskType := strings.TrimSpace(payload.Type)
	if taskType == "" {
		taskType = "unknown"
	}
	actions := make([]string, 0, len(payload.Graph.Nodes))
	for _, node := range payload.Graph.Nodes {
		if node.ToolName != "" {
			actions = append(actions, "tool:"+node.ToolName)
			continue
		}
		if node.Action != "" {
			actions = append(actions, node.Kind+":"+node.Action)
		}
	}
	if len(actions) == 0 {
		return taskType, taskType
	}
	return taskType, strings.Join(actions, ",")
}

func taskHasIrreversibleAction(definition json.RawMessage) bool {
	return containsIrreversibleActionToken(strings.ToLower(string(definition)))
}

// containsIrreversibleActionToken reports whether a lower-cased JSON fragment
// names an action whose side effect cannot be undone. Used both at the whole-task
// level and per graph node so the two never disagree about what is irreversible.
func containsIrreversibleActionToken(lower string) bool {
	return strings.Contains(lower, `"irreversible":true`) ||
		strings.Contains(lower, `"db_write"`) ||
		strings.Contains(lower, `"database_write"`) ||
		strings.Contains(lower, `"publish_velocity"`) ||
		strings.Contains(lower, `"navigate_to_pose"`)
}

// irreversibleStepIndexes returns the 0-based execution-graph node indexes whose
// action is irreversible, in order. The index matches the WalEntry/step_index
// space, so it can be compared against a checkpoint's last_committed_step.
func irreversibleStepIndexes(definition json.RawMessage) []int {
	var payload struct {
		Graph struct {
			Nodes []json.RawMessage `json:"nodes"`
		} `json:"graph"`
	}
	if err := json.Unmarshal(definition, &payload); err != nil {
		return nil
	}
	indexes := make([]int, 0, len(payload.Graph.Nodes))
	for i, node := range payload.Graph.Nodes {
		if containsIrreversibleActionToken(strings.ToLower(string(node))) {
			indexes = append(indexes, i)
		}
	}
	return indexes
}

// recoveryForwardResumeSafe reports whether an automatic recovery can resume this
// task from its checkpoint WITHOUT any risk of replaying an irreversible side
// effect. It is deliberately conservative: it allows resume only when it can
// positively prove the checkpoint precedes every irreversible step. A task with
// no irreversible action is always safe. Any of the following deny it: a missing
// or unusable checkpoint; an irreversible definition whose steps cannot be
// located in the graph (ambiguous); or an irreversible step whose index is at or
// before the checkpoint's last_committed_step (already committed, or committed at
// the watermark — either way replaying it would double the side effect).
func recoveryForwardResumeSafe(taskID uuid.UUID, definition json.RawMessage, cp *CheckpointPayload) bool {
	if !taskHasIrreversibleAction(definition) {
		return true
	}
	if cp == nil || !TaskRecoveryCheckpointUsable(taskID, cp) {
		return false
	}
	indexes := irreversibleStepIndexes(definition)
	if len(indexes) == 0 {
		// The definition contains an irreversible action but we cannot locate the
		// step in the graph — we cannot prove it is still pending, so deny.
		return false
	}
	lastCommitted := int(cp.ResumeToken.LastCommittedStep)
	for _, idx := range indexes {
		if idx <= lastCommitted {
			return false
		}
	}
	return true
}

func taskRequiresHumanApproval(definition json.RawMessage) bool {
	lower := strings.ToLower(string(definition))
	if strings.Contains(lower, `"approval"`) &&
		(strings.Contains(lower, `"required":true`) || strings.Contains(lower, `"human_approval"`)) {
		return true
	}

	// Actions gateway runs stamp `approval_required` into execution-graph node
	// metadata (api.actionNodeMetadata). Detect that shape structurally: the
	// substring heuristic above never matches `"approval_required":true`, and a
	// human-gated registered action must pause rather than dispatch.
	var payload struct {
		Graph struct {
			Nodes []struct {
				Metadata map[string]json.RawMessage `json:"metadata"`
			} `json:"nodes"`
		} `json:"graph"`
	}
	if err := json.Unmarshal(definition, &payload); err != nil {
		return false
	}
	for _, node := range payload.Graph.Nodes {
		raw, ok := node.Metadata["approval_required"]
		if !ok {
			continue
		}
		var required bool
		if err := json.Unmarshal(raw, &required); err == nil && required {
			return true
		}
	}
	return false
}

type boundaryDefaults struct {
	allowedTools  []string
	deniedTools   []string
	networkScope  string
	fileScope     string
	apiScope      string
	resourceScope string
	digest        string
}

func defaultExecutionBoundary(definition json.RawMessage, caps []string) boundaryDefaults {
	b := boundaryDefaults{
		networkScope:  "none",
		fileScope:     "none",
		apiScope:      "none",
		resourceScope: "task",
	}
	for _, cap := range caps {
		switch {
		case strings.HasPrefix(cap, "tools."):
			b.allowedTools = append(b.allowedTools, strings.TrimPrefix(cap, "tools."))
		case strings.HasPrefix(cap, "network."):
			b.networkScope = "policy_scoped"
		case strings.HasPrefix(cap, "filesystem."):
			b.fileScope = "policy_scoped"
		}
	}
	if len(b.allowedTools) == 0 {
		_, action := classifyTaskAction(definition)
		if strings.Contains(action, "tool:") {
			for _, part := range strings.Split(action, ",") {
				b.allowedTools = append(b.allowedTools, strings.TrimPrefix(part, "tool:"))
			}
		}
	}
	raw, _ := json.Marshal(map[string]any{
		"allowed_tools": b.allowedTools,
		"denied_tools":  b.deniedTools,
		"network":       b.networkScope,
		"filesystem":    b.fileScope,
		"api":           b.apiScope,
	})
	b.digest = digestRaw(raw)
	return b
}

func digestRaw(raw []byte) string {
	sum := sha256.Sum256(raw)
	return fmt.Sprintf("%x", sum[:])
}

func (s *CheckpointStore) SaveActionPolicyDecision(decision ActionPolicyDecision) error {
	if s == nil || s.db == nil || decision.DecisionID == uuid.Nil {
		return nil
	}
	if isSQLMockDB(s.db) {
		return nil
	}
	_, err := s.db.Exec(`
		INSERT INTO action_policy_decisions (
			decision_id, tenant_id, task_id, agent_id, runtime_id, task_type,
			action_name, environment_label, resource_scope, risk_level, decision,
			replay_class, irreversible, human_gated, policy_version, policy_reason,
			action_digest, boundary_digest, checkpoint_portability, created_at
		) VALUES ($1,$2,$3,NULLIF($4,''),NULLIF($5,''),$6,$7,
		          NULLIF($8,''),NULLIF($9,''),$10,$11,$12,$13,$14,$15,$16,$17,NULLIF($18,''),$19,$20)
		ON CONFLICT (decision_id) DO NOTHING`,
		decision.DecisionID, decision.TenantID, decision.TaskID, decision.AgentID, decision.RuntimeID,
		decision.TaskType, decision.ActionName, decision.EnvironmentLabel, decision.ResourceScope,
		decision.RiskLevel, decision.Decision, decision.ReplayClass, decision.Irreversible,
		decision.HumanGated, decision.PolicyVersion, decision.PolicyReason, decision.ActionDigest,
		decision.BoundaryDigest, decision.CheckpointPortability, decision.CreatedAt,
	)
	return err
}

func (s *CheckpointStore) SaveApprovalRequest(decision ActionPolicyDecision) error {
	if s == nil || s.db == nil || decision.Decision != ActionDecisionApprovalRequired {
		return nil
	}
	if isSQLMockDB(s.db) {
		return nil
	}
	_, err := s.db.Exec(`
		INSERT INTO approval_requests (decision_id, tenant_id, task_id, requested_reason)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT DO NOTHING`,
		decision.DecisionID, decision.TenantID, decision.TaskID, decision.PolicyReason,
	)
	return err
}

func (s *CheckpointStore) MarkApprovalRequired(taskID uuid.UUID, reason string) error {
	if s == nil || s.db == nil {
		return nil
	}
	if isSQLMockDB(s.db) {
		return nil
	}
	result, err := s.db.Exec(`
		UPDATE task_records
		SET status = $1, failure_reason = $2
		WHERE task_id = $3
		  AND status IN ($4, $5)`,
		TaskStatusApprovalRequired, reason, taskID, TaskStatusPending, TaskStatusRecovering,
	)
	return taskTransitionResult(result, err)
}

// MarkApprovedDispatched atomically transitions an approval_required task to
// dispatched and binds it to the approving runtime. The WHERE clause pins the
// current status to approval_required, so exactly one caller can win: a repeated
// or concurrent approve affects zero rows and returns ErrTaskTransitionRejected,
// which the coordinator surfaces as "not awaiting approval". This is the single
// serialization point that prevents double dispatch. It is intentionally NOT
// short-circuited under the mock driver so the compare-and-set result drives the
// coordinator's behaviour in tests.
func (s *CheckpointStore) MarkApprovedDispatched(taskID uuid.UUID, tenantID, runtimeID, runtimeEndpoint, approvedBy string) error {
	if s == nil || s.db == nil {
		return ErrTaskTransitionRejected
	}
	now := time.Now()
	result, err := s.db.Exec(`
		UPDATE task_records
		SET status = $1, runtime_id = $2, runtime_endpoint = $3, dispatched_at = $4, failure_reason = NULL
		WHERE task_id = $5 AND tenant_id = $6 AND status = $7`,
		TaskStatusDispatched, runtimeID, runtimeEndpoint, now, taskID, tenantID, TaskStatusApprovalRequired,
	)
	return taskTransitionResult(result, err)
}

// MarkApprovalRejected atomically transitions an approval_required task to the
// terminal failed state with a rejection reason. Like MarkApprovedDispatched it
// pins the current status to approval_required, so a rejected task can never also
// be dispatched (and a double reject is a no-op that returns
// ErrTaskTransitionRejected).
func (s *CheckpointStore) MarkApprovalRejected(taskID uuid.UUID, tenantID, reason string, details *TaskFailureDetails) error {
	if s == nil || s.db == nil {
		return ErrTaskTransitionRejected
	}
	var detailBytes json.RawMessage
	if details != nil {
		if encoded, err := json.Marshal(details); err == nil {
			detailBytes = encoded
		}
	}
	result, err := s.db.Exec(`
		UPDATE task_records
		SET status = $1, failure_reason = $2, failure_details = $3
		WHERE task_id = $4 AND tenant_id = $5 AND status = $6`,
		TaskStatusFailed, reason, nullRawJSON(detailBytes), taskID, tenantID, TaskStatusApprovalRequired,
	)
	return taskTransitionResult(result, err)
}

// ResolveApprovalRequest records the human decision on the approval_requests
// audit row (who decided, when, and why). It is best-effort audit metadata — the
// task_records transition is the source of truth — so it is mock-guarded and only
// updates a still-pending request.
func (s *CheckpointStore) ResolveApprovalRequest(taskID uuid.UUID, tenantID, status, decidedBy, reason string) error {
	if s == nil || s.db == nil {
		return nil
	}
	if isSQLMockDB(s.db) {
		return nil
	}
	_, err := s.db.Exec(`
		UPDATE approval_requests
		SET status = $1, decided_by = NULLIF($2,''), decided_at = NOW(), decision_reason = NULLIF($3,'')
		WHERE tenant_id = $4 AND task_id = $5 AND status = 'pending'`,
		status, decidedBy, reason, tenantID, taskID,
	)
	return err
}

func (s *CheckpointStore) SetLatestPolicyDecision(taskID uuid.UUID, decision ActionPolicyDecision) error {
	if s == nil || s.db == nil || decision.DecisionID == uuid.Nil {
		return nil
	}
	if isSQLMockDB(s.db) {
		return nil
	}
	_, err := s.db.Exec(`
		UPDATE task_records
		SET latest_policy_decision_id = $1,
		    checkpoint_portability = $2
		WHERE task_id = $3`,
		decision.DecisionID, decision.CheckpointPortability, taskID,
	)
	return err
}

func (s *CheckpointStore) SaveExecutionBoundary(decision ActionPolicyDecision, definition json.RawMessage, caps []string) error {
	if s == nil || s.db == nil {
		return nil
	}
	if isSQLMockDB(s.db) {
		return nil
	}
	b := defaultExecutionBoundary(definition, caps)
	allowed, _ := json.Marshal(b.allowedTools)
	denied, _ := json.Marshal(b.deniedTools)
	limits, _ := json.Marshal(map[string]any{"deadline_enforced": true})
	capsJSON, _ := json.Marshal(map[string]any{"declared_by": "overture"})
	_, err := s.db.Exec(`
		INSERT INTO execution_boundaries (
			tenant_id, task_id, runtime_id, policy_decision_id, environment_label,
			allowed_tools, denied_tools, network_scope, filesystem_scope, api_scope,
			resource_limits, runtime_capabilities, boundary_digest
		) VALUES ($1,$2,NULLIF($3,''),$4,NULLIF($5,''),$6,$7,$8,$9,$10,$11,$12,$13)`,
		decision.TenantID, decision.TaskID, decision.RuntimeID, decision.DecisionID,
		decision.EnvironmentLabel, nullRawJSON(allowed), nullRawJSON(denied),
		b.networkScope, b.fileScope, b.apiScope, nullRawJSON(limits), nullRawJSON(capsJSON), b.digest,
	)
	return err
}

func (s *CheckpointStore) SaveRecoveryEvent(event RecoveryEvent) error {
	if s == nil || s.db == nil || event.TaskID == uuid.Nil {
		return nil
	}
	if isSQLMockDB(s.db) {
		return nil
	}
	if event.EventID == uuid.Nil {
		event.EventID = uuid.New()
	}
	_, err := s.db.Exec(`
		INSERT INTO task_recovery_events (
			recovery_event_id, tenant_id, task_id, event_type, source_runtime_id,
			target_runtime_id, checkpoint_digest, last_committed_step, replay_allowed,
			reason
		) VALUES ($1,$2,$3,$4,NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),$8,$9,$10)`,
		event.EventID, event.TenantID, event.TaskID, event.EventType, event.SourceRuntimeID,
		event.TargetRuntimeID, event.CheckpointDigest, event.LastCommittedStep,
		event.ReplayAllowed, event.Reason,
	)
	return err
}

func (s *CheckpointStore) SaveRuntimeHandoffEvent(event RuntimeHandoffEvent) error {
	if s == nil || s.db == nil || event.TaskID == uuid.Nil {
		return nil
	}
	if isSQLMockDB(s.db) {
		return nil
	}
	if event.EventID == uuid.Nil {
		event.EventID = uuid.New()
	}
	_, err := s.db.Exec(`
		INSERT INTO runtime_handoff_events (
			handoff_event_id, tenant_id, task_id, source_runtime_id, target_runtime_id,
			checkpoint_digest, checkpoint_portability, decision, reason
		) VALUES ($1,$2,$3,NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),$7,$8,$9)`,
		event.EventID, event.TenantID, event.TaskID, event.SourceRuntimeID, event.TargetRuntimeID,
		event.CheckpointDigest, event.CheckpointPortability, event.Decision, event.Reason,
	)
	return err
}

func isSQLMockDB(db *sql.DB) bool {
	if db == nil {
		return false
	}
	driverType := strings.ToLower(fmt.Sprintf("%T", db.Driver()))
	return strings.Contains(driverType, "sqlmock") || strings.Contains(driverType, "queuedexecdriver")
}

func (s *CheckpointStore) LatestActionPolicyDecision(tenantID string, taskID uuid.UUID) (*ActionPolicyDecision, error) {
	row := s.db.QueryRow(`
		SELECT decision_id, tenant_id, task_id, COALESCE(agent_id,''), COALESCE(runtime_id,''),
		       task_type, action_name, COALESCE(environment_label,''), COALESCE(resource_scope,''),
		       risk_level, decision, replay_class, irreversible, human_gated, policy_version,
		       policy_reason, action_digest, COALESCE(boundary_digest,''), checkpoint_portability, created_at
		FROM action_policy_decisions
		WHERE tenant_id = $1 AND task_id = $2
		ORDER BY created_at DESC
		LIMIT 1`, tenantID, taskID)
	var d ActionPolicyDecision
	if err := row.Scan(&d.DecisionID, &d.TenantID, &d.TaskID, &d.AgentID, &d.RuntimeID, &d.TaskType,
		&d.ActionName, &d.EnvironmentLabel, &d.ResourceScope, &d.RiskLevel, &d.Decision,
		&d.ReplayClass, &d.Irreversible, &d.HumanGated, &d.PolicyVersion, &d.PolicyReason,
		&d.ActionDigest, &d.BoundaryDigest, &d.CheckpointPortability, &d.CreatedAt); err != nil {
		return nil, err
	}
	return &d, nil
}

func (s *CheckpointStore) ListRecoveryEvents(tenantID string, taskID uuid.UUID) ([]RecoveryEvent, error) {
	rows, err := s.db.Query(`
		SELECT recovery_event_id, tenant_id, task_id, event_type, COALESCE(source_runtime_id,''),
		       COALESCE(target_runtime_id,''), COALESCE(checkpoint_digest,''), last_committed_step,
		       replay_allowed, reason, created_at
		FROM task_recovery_events
		WHERE tenant_id = $1 AND task_id = $2
		ORDER BY created_at ASC`, tenantID, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []RecoveryEvent
	for rows.Next() {
		var e RecoveryEvent
		var step sql.NullInt64
		var replay sql.NullBool
		if err := rows.Scan(&e.EventID, &e.TenantID, &e.TaskID, &e.EventType, &e.SourceRuntimeID,
			&e.TargetRuntimeID, &e.CheckpointDigest, &step, &replay, &e.Reason, &e.CreatedAt); err != nil {
			return nil, err
		}
		if step.Valid {
			v := int(step.Int64)
			e.LastCommittedStep = &v
		}
		if replay.Valid {
			v := replay.Bool
			e.ReplayAllowed = &v
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *CheckpointStore) LatestRuntimeHandoffEvent(tenantID string, taskID uuid.UUID) (*RuntimeHandoffEvent, error) {
	row := s.db.QueryRow(`
		SELECT handoff_event_id, tenant_id, task_id, COALESCE(source_runtime_id,''), COALESCE(target_runtime_id,''),
		       COALESCE(checkpoint_digest,''), checkpoint_portability, decision, reason, created_at
		FROM runtime_handoff_events
		WHERE tenant_id = $1 AND task_id = $2
		ORDER BY created_at DESC
		LIMIT 1`, tenantID, taskID)
	var e RuntimeHandoffEvent
	if err := row.Scan(&e.EventID, &e.TenantID, &e.TaskID, &e.SourceRuntimeID, &e.TargetRuntimeID,
		&e.CheckpointDigest, &e.CheckpointPortability, &e.Decision, &e.Reason, &e.CreatedAt); err != nil {
		return nil, err
	}
	return &e, nil
}

func (s *CheckpointStore) LatestExecutionBoundary(tenantID string, taskID uuid.UUID) (*ExecutionBoundarySummary, error) {
	row := s.db.QueryRow(`
		SELECT boundary_id, COALESCE(runtime_id,''), COALESCE(environment_label,''), allowed_tools,
		       denied_tools, network_scope, filesystem_scope, api_scope, resource_limits,
		       runtime_capabilities, boundary_digest, created_at
		FROM execution_boundaries
		WHERE tenant_id = $1 AND task_id = $2
		ORDER BY created_at DESC
		LIMIT 1`, tenantID, taskID)
	var b ExecutionBoundarySummary
	if err := row.Scan(&b.BoundaryID, &b.RuntimeID, &b.EnvironmentLabel, &b.AllowedTools,
		&b.DeniedTools, &b.NetworkScope, &b.FilesystemScope, &b.APIScope, &b.ResourceLimits,
		&b.RuntimeCapabilities, &b.BoundaryDigest, &b.CreatedAt); err != nil {
		return nil, err
	}
	return &b, nil
}

func (s *CheckpointStore) SaveVerificationResult(record VerificationResultRecord) error {
	if s == nil || s.db == nil || record.TaskID == uuid.Nil {
		return nil
	}
	if isSQLMockDB(s.db) {
		return nil
	}
	_, err := s.db.Exec(`
		INSERT INTO verification_results (
			tenant_id, task_id, execution_id, policy_decision_id, checkpoint_digest,
			action_digest, status, policy_compliant, evidence_digest, reason
		) VALUES ($1,$2,NULLIF($3,''),$4,NULLIF($5,''),NULLIF($6,''),$7,$8,NULLIF($9,''),$10)`,
		record.TenantID,
		record.TaskID,
		record.ExecutionID,
		record.PolicyDecisionID,
		record.CheckpointDigest,
		record.ActionDigest,
		record.Status,
		record.PolicyCompliant,
		record.EvidenceDigest,
		record.Reason,
	)
	return err
}

func (s *CheckpointStore) ListActionPolicyDecisions(tenantID string, opts GovernanceListOptions) (*GovernanceListResponse[ActionPolicyDecision], error) {
	opts = normalizeGovernanceListOptions(opts)
	out := &GovernanceListResponse[ActionPolicyDecision]{Items: []ActionPolicyDecision{}, Limit: opts.Limit, Offset: opts.Offset}
	if s == nil || s.db == nil || isSQLMockDB(s.db) {
		return out, nil
	}
	where, args := governanceBaseWhere(tenantID, opts, "created_at")
	if opts.Decision != "" && validString(opts.Decision, ActionDecisionAllowed, ActionDecisionDenied, ActionDecisionApprovalRequired) {
		where = append(where, fmt.Sprintf("decision = $%d", len(args)+1))
		args = append(args, opts.Decision)
	}
	if opts.RiskLevel != "" && validString(opts.RiskLevel, "low", "medium", "high", "critical") {
		where = append(where, fmt.Sprintf("risk_level = $%d", len(args)+1))
		args = append(args, opts.RiskLevel)
	}
	if opts.ReplayClass != "" && validString(opts.ReplayClass, ReplayClassRetryable, ReplayClassNonRetryable) {
		where = append(where, fmt.Sprintf("replay_class = $%d", len(args)+1))
		args = append(args, opts.ReplayClass)
	}
	if opts.Irreversible != nil {
		where = append(where, fmt.Sprintf("irreversible = $%d", len(args)+1))
		args = append(args, *opts.Irreversible)
	}
	if opts.HumanGated != nil {
		where = append(where, fmt.Sprintf("human_gated = $%d", len(args)+1))
		args = append(args, *opts.HumanGated)
	}
	if opts.AgentID != "" {
		where = append(where, fmt.Sprintf("agent_id = $%d", len(args)+1))
		args = append(args, opts.AgentID)
	}
	if opts.RuntimeID != "" {
		where = append(where, fmt.Sprintf("runtime_id = $%d", len(args)+1))
		args = append(args, opts.RuntimeID)
	}
	if opts.Action != "" {
		where = append(where, fmt.Sprintf("action_name ILIKE $%d", len(args)+1))
		args = append(args, "%"+opts.Action+"%")
	}
	query := fmt.Sprintf(`
		SELECT decision_id, tenant_id, task_id, COALESCE(agent_id,''), COALESCE(runtime_id,''),
		       task_type, action_name, COALESCE(environment_label,''), COALESCE(resource_scope,''),
		       risk_level, decision, replay_class, irreversible, human_gated, policy_version,
		       policy_reason, action_digest, COALESCE(boundary_digest,''), checkpoint_portability, created_at,
		       COUNT(*) OVER()
		FROM action_policy_decisions
		WHERE %s
		ORDER BY created_at %s
		LIMIT $%d OFFSET $%d`, strings.Join(where, " AND "), sortDirection(opts.Sort), len(args)+1, len(args)+2)
	args = append(args, opts.Limit, opts.Offset)
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var d ActionPolicyDecision
		if err := rows.Scan(&d.DecisionID, &d.TenantID, &d.TaskID, &d.AgentID, &d.RuntimeID, &d.TaskType,
			&d.ActionName, &d.EnvironmentLabel, &d.ResourceScope, &d.RiskLevel, &d.Decision,
			&d.ReplayClass, &d.Irreversible, &d.HumanGated, &d.PolicyVersion, &d.PolicyReason,
			&d.ActionDigest, &d.BoundaryDigest, &d.CheckpointPortability, &d.CreatedAt, &out.Total); err != nil {
			return nil, err
		}
		out.Items = append(out.Items, d)
	}
	return out, rows.Err()
}

func (s *CheckpointStore) ListTaskRecoveryEvents(tenantID string, opts GovernanceListOptions) (*GovernanceListResponse[RecoveryEvent], error) {
	opts = normalizeGovernanceListOptions(opts)
	out := &GovernanceListResponse[RecoveryEvent]{Items: []RecoveryEvent{}, Limit: opts.Limit, Offset: opts.Offset}
	if s == nil || s.db == nil || isSQLMockDB(s.db) {
		return out, nil
	}
	where, args := governanceBaseWhere(tenantID, opts, "created_at")
	if opts.EventType != "" {
		where = append(where, fmt.Sprintf("event_type = $%d", len(args)+1))
		args = append(args, opts.EventType)
	}
	if opts.RuntimeID != "" {
		where = append(where, fmt.Sprintf("(source_runtime_id = $%d OR target_runtime_id = $%d)", len(args)+1, len(args)+1))
		args = append(args, opts.RuntimeID)
	}
	query := fmt.Sprintf(`
		SELECT recovery_event_id, tenant_id, task_id, event_type, COALESCE(source_runtime_id,''),
		       COALESCE(target_runtime_id,''), COALESCE(checkpoint_digest,''), last_committed_step,
		       replay_allowed, reason, created_at, COUNT(*) OVER()
		FROM task_recovery_events
		WHERE %s
		ORDER BY created_at %s
		LIMIT $%d OFFSET $%d`, strings.Join(where, " AND "), sortDirection(opts.Sort), len(args)+1, len(args)+2)
	args = append(args, opts.Limit, opts.Offset)
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var e RecoveryEvent
		var step sql.NullInt64
		var replay sql.NullBool
		if err := rows.Scan(&e.EventID, &e.TenantID, &e.TaskID, &e.EventType, &e.SourceRuntimeID,
			&e.TargetRuntimeID, &e.CheckpointDigest, &step, &replay, &e.Reason, &e.CreatedAt, &out.Total); err != nil {
			return nil, err
		}
		if step.Valid {
			v := int(step.Int64)
			e.LastCommittedStep = &v
		}
		if replay.Valid {
			v := replay.Bool
			e.ReplayAllowed = &v
		}
		out.Items = append(out.Items, e)
	}
	return out, rows.Err()
}

func (s *CheckpointStore) ListRuntimeHandoffEvents(tenantID string, opts GovernanceListOptions) (*GovernanceListResponse[RuntimeHandoffEvent], error) {
	opts = normalizeGovernanceListOptions(opts)
	out := &GovernanceListResponse[RuntimeHandoffEvent]{Items: []RuntimeHandoffEvent{}, Limit: opts.Limit, Offset: opts.Offset}
	if s == nil || s.db == nil || isSQLMockDB(s.db) {
		return out, nil
	}
	where, args := governanceBaseWhere(tenantID, opts, "created_at")
	if opts.HandoffDecision != "" && validString(opts.HandoffDecision, "allowed", "denied") {
		where = append(where, fmt.Sprintf("decision = $%d", len(args)+1))
		args = append(args, opts.HandoffDecision)
	}
	if opts.RuntimeID != "" {
		where = append(where, fmt.Sprintf("(source_runtime_id = $%d OR target_runtime_id = $%d)", len(args)+1, len(args)+1))
		args = append(args, opts.RuntimeID)
	}
	query := fmt.Sprintf(`
		SELECT handoff_event_id, tenant_id, task_id, COALESCE(source_runtime_id,''), COALESCE(target_runtime_id,''),
		       COALESCE(checkpoint_digest,''), checkpoint_portability, decision, reason, created_at, COUNT(*) OVER()
		FROM runtime_handoff_events
		WHERE %s
		ORDER BY created_at %s
		LIMIT $%d OFFSET $%d`, strings.Join(where, " AND "), sortDirection(opts.Sort), len(args)+1, len(args)+2)
	args = append(args, opts.Limit, opts.Offset)
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var e RuntimeHandoffEvent
		if err := rows.Scan(&e.EventID, &e.TenantID, &e.TaskID, &e.SourceRuntimeID, &e.TargetRuntimeID,
			&e.CheckpointDigest, &e.CheckpointPortability, &e.Decision, &e.Reason, &e.CreatedAt, &out.Total); err != nil {
			return nil, err
		}
		out.Items = append(out.Items, e)
	}
	return out, rows.Err()
}

func (s *CheckpointStore) ListBoundaryViolations(tenantID string, opts GovernanceListOptions) (*GovernanceListResponse[BoundaryViolationRecord], error) {
	opts = normalizeGovernanceListOptions(opts)
	out := &GovernanceListResponse[BoundaryViolationRecord]{Items: []BoundaryViolationRecord{}, Limit: opts.Limit, Offset: opts.Offset}
	if s == nil || s.db == nil || isSQLMockDB(s.db) {
		return out, nil
	}
	where, args := governanceBaseWhere(tenantID, opts, "created_at")
	if opts.Severity != "" && validString(opts.Severity, "info", "warning", "error", "critical") {
		where = append(where, fmt.Sprintf("severity = $%d", len(args)+1))
		args = append(args, opts.Severity)
	}
	if opts.RuntimeID != "" {
		where = append(where, fmt.Sprintf("runtime_id = $%d", len(args)+1))
		args = append(args, opts.RuntimeID)
	}
	if opts.Action != "" {
		where = append(where, fmt.Sprintf("violation_type ILIKE $%d", len(args)+1))
		args = append(args, "%"+opts.Action+"%")
	}
	query := fmt.Sprintf(`
		SELECT violation_id, task_id, COALESCE(runtime_id,''), boundary_id, violation_type,
		       severity, reason, COALESCE(evidence_digest,''), created_at, COUNT(*) OVER()
		FROM boundary_violations
		WHERE %s
		ORDER BY created_at %s
		LIMIT $%d OFFSET $%d`, strings.Join(where, " AND "), sortDirection(opts.Sort), len(args)+1, len(args)+2)
	args = append(args, opts.Limit, opts.Offset)
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var v BoundaryViolationRecord
		var taskID, boundaryID uuid.NullUUID
		if err := rows.Scan(&v.ViolationID, &taskID, &v.RuntimeID, &boundaryID, &v.ViolationType,
			&v.Severity, &v.Reason, &v.EvidenceDigest, &v.CreatedAt, &out.Total); err != nil {
			return nil, err
		}
		if taskID.Valid {
			v.TaskID = taskID.UUID
		}
		if boundaryID.Valid {
			v.BoundaryID = boundaryID.UUID
		}
		out.Items = append(out.Items, v)
	}
	return out, rows.Err()
}

func (s *CheckpointStore) ListVerificationResults(tenantID string, opts GovernanceListOptions) (*GovernanceListResponse[VerificationResultSummary], error) {
	opts = normalizeGovernanceListOptions(opts)
	out := &GovernanceListResponse[VerificationResultSummary]{Items: []VerificationResultSummary{}, Limit: opts.Limit, Offset: opts.Offset}
	if s == nil || s.db == nil || isSQLMockDB(s.db) {
		return out, nil
	}
	where, args := governanceBaseWhereWithAlias(tenantID, opts, "created_at", "v")
	if opts.Status != "" && validString(opts.Status, "verified", "partially_verified", "unverifiable", "failed_verification", "policy_violation") {
		where = append(where, fmt.Sprintf("v.status = $%d", len(args)+1))
		args = append(args, opts.Status)
	}
	if opts.ExecutionID != "" {
		where = append(where, fmt.Sprintf("v.execution_id = $%d", len(args)+1))
		args = append(args, opts.ExecutionID)
	}
	if opts.RuntimeID != "" {
		where = append(where, fmt.Sprintf("tr.runtime_id = $%d", len(args)+1))
		args = append(args, opts.RuntimeID)
	}
	if opts.Action != "" {
		where = append(where, fmt.Sprintf("v.action_digest = $%d", len(args)+1))
		args = append(args, opts.Action)
	}
	query := fmt.Sprintf(`
		SELECT v.verification_id, v.task_id, COALESCE(v.execution_id,''), COALESCE(tr.runtime_id,''), v.policy_decision_id,
		       COALESCE(v.checkpoint_digest,''), COALESCE(v.action_digest,''), v.status,
		       v.policy_compliant, tr.proof_hash_valid, tr.proof_signature_matches,
		       tr.proof_runtime_key_found, tr.proof_chain_link_valid,
		       COALESCE(v.evidence_digest,''), v.reason, v.created_at, COUNT(*) OVER()
		FROM verification_results v
		LEFT JOIN task_records tr
		  ON tr.tenant_id = v.tenant_id AND tr.task_id = v.task_id
		WHERE %s
		ORDER BY v.created_at %s
		LIMIT $%d OFFSET $%d`, strings.Join(where, " AND "), sortDirection(opts.Sort), len(args)+1, len(args)+2)
	args = append(args, opts.Limit, opts.Offset)
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var v VerificationResultSummary
		var taskID, decisionID uuid.NullUUID
		var compliant, hashValid, signatureMatches, runtimeKeyFound, chainLinkValid sql.NullBool
		if err := rows.Scan(&v.VerificationID, &taskID, &v.ExecutionID, &v.RuntimeID, &decisionID,
			&v.CheckpointDigest, &v.ActionDigest, &v.Status, &compliant,
			&hashValid, &signatureMatches, &runtimeKeyFound, &chainLinkValid,
			&v.EvidenceDigest, &v.Reason, &v.CreatedAt, &out.Total); err != nil {
			return nil, err
		}
		if taskID.Valid {
			v.TaskID = taskID.UUID
		}
		if decisionID.Valid {
			id := decisionID.UUID
			v.PolicyDecisionID = &id
		}
		if compliant.Valid {
			value := compliant.Bool
			v.PolicyCompliant = &value
		}
		if hashValid.Valid {
			value := hashValid.Bool
			v.HashValid = &value
		}
		if signatureMatches.Valid {
			value := signatureMatches.Bool
			v.SignatureMatches = &value
		}
		if runtimeKeyFound.Valid {
			value := runtimeKeyFound.Bool
			v.RuntimeKeyFound = &value
		}
		if chainLinkValid.Valid {
			value := chainLinkValid.Bool
			v.ChainLinkValid = &value
		}
		out.Items = append(out.Items, v)
	}
	return out, rows.Err()
}

func (s *CheckpointStore) ListExecutionBoundaries(tenantID string, opts GovernanceListOptions) (*GovernanceListResponse[ExecutionBoundarySummary], error) {
	opts = normalizeGovernanceListOptions(opts)
	out := &GovernanceListResponse[ExecutionBoundarySummary]{Items: []ExecutionBoundarySummary{}, Limit: opts.Limit, Offset: opts.Offset}
	if s == nil || s.db == nil || isSQLMockDB(s.db) {
		return out, nil
	}
	where, args := governanceBaseWhere(tenantID, opts, "created_at")
	if opts.RuntimeID != "" {
		where = append(where, fmt.Sprintf("runtime_id = $%d", len(args)+1))
		args = append(args, opts.RuntimeID)
	}
	query := fmt.Sprintf(`
		SELECT boundary_id, task_id, COALESCE(runtime_id,''), policy_decision_id,
		       COALESCE(environment_label,''), allowed_tools, denied_tools, network_scope,
		       filesystem_scope, api_scope, resource_limits, runtime_capabilities,
		       boundary_digest, created_at, COUNT(*) OVER()
		FROM execution_boundaries
		WHERE %s
		ORDER BY created_at %s
		LIMIT $%d OFFSET $%d`, strings.Join(where, " AND "), sortDirection(opts.Sort), len(args)+1, len(args)+2)
	args = append(args, opts.Limit, opts.Offset)
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var b ExecutionBoundarySummary
		var taskID, decisionID uuid.NullUUID
		if err := rows.Scan(&b.BoundaryID, &taskID, &b.RuntimeID, &decisionID,
			&b.EnvironmentLabel, &b.AllowedTools, &b.DeniedTools, &b.NetworkScope,
			&b.FilesystemScope, &b.APIScope, &b.ResourceLimits, &b.RuntimeCapabilities,
			&b.BoundaryDigest, &b.CreatedAt, &out.Total); err != nil {
			return nil, err
		}
		if taskID.Valid {
			b.TaskID = taskID.UUID
		}
		if decisionID.Valid {
			id := decisionID.UUID
			b.PolicyDecisionID = &id
		}
		out.Items = append(out.Items, b)
	}
	return out, rows.Err()
}

func (s *CheckpointStore) ListRuntimeOperations(tenantID string, opts GovernanceListOptions) (*GovernanceListResponse[RuntimeOperationsSummary], error) {
	opts = normalizeGovernanceListOptions(opts)
	out := &GovernanceListResponse[RuntimeOperationsSummary]{Items: []RuntimeOperationsSummary{}, Limit: opts.Limit, Offset: opts.Offset}
	if s == nil || s.db == nil || isSQLMockDB(s.db) {
		return out, nil
	}
	where := []string{"runtime_id <> ''"}
	args := []any{tenantID}
	if opts.RuntimeID != "" {
		where = append(where, fmt.Sprintf("runtime_id = $%d", len(args)+1))
		args = append(args, opts.RuntimeID)
	}
	query := fmt.Sprintf(`
		WITH runtime_ids AS (
			SELECT runtime_id FROM runtime_instances WHERE tenant_id = $1 AND COALESCE(runtime_id,'') <> ''
			UNION SELECT runtime_id FROM action_policy_decisions WHERE tenant_id = $1 AND COALESCE(runtime_id,'') <> ''
			UNION SELECT runtime_id FROM execution_boundaries WHERE tenant_id = $1 AND COALESCE(runtime_id,'') <> ''
			UNION SELECT runtime_id FROM boundary_violations WHERE tenant_id = $1 AND COALESCE(runtime_id,'') <> ''
			UNION SELECT source_runtime_id FROM task_recovery_events WHERE tenant_id = $1 AND COALESCE(source_runtime_id,'') <> ''
			UNION SELECT target_runtime_id FROM task_recovery_events WHERE tenant_id = $1 AND COALESCE(target_runtime_id,'') <> ''
			UNION SELECT source_runtime_id FROM runtime_handoff_events WHERE tenant_id = $1 AND COALESCE(source_runtime_id,'') <> ''
			UNION SELECT target_runtime_id FROM runtime_handoff_events WHERE tenant_id = $1 AND COALESCE(target_runtime_id,'') <> ''
		), runtime_rows AS (
			SELECT r.runtime_id,
			       COALESCE(ri.capabilities, '[]'::jsonb) AS capabilities,
			       COALESCE(ri.last_heartbeat, ri.last_seen_at) AS last_seen,
			       COALESCE(ri.status, '') AS status,
			       COALESCE(ri.is_healthy, false) AS is_healthy,
			       COALESCE(ri.endpoint, '') AS endpoint
			FROM runtime_ids r
			LEFT JOIN runtime_instances ri
			  ON ri.tenant_id = $1 AND ri.runtime_id = r.runtime_id
		)
		SELECT runtime_id, capabilities, last_seen, status, is_healthy, endpoint,
		       (SELECT COUNT(*) FROM task_records tr
		        WHERE tr.tenant_id = $1 AND tr.runtime_id = runtime_rows.runtime_id
		          AND tr.status IN ('dispatched','checkpointed','recovering')) AS active_execution_count,
		       (SELECT COUNT(*) FROM task_records tr
		        WHERE tr.tenant_id = $1 AND tr.runtime_id = runtime_rows.runtime_id
		          AND tr.created_at >= NOW() - INTERVAL '24 hours') AS recent_execution_count,
		       (SELECT COUNT(*) FROM execution_boundaries eb
		        WHERE eb.tenant_id = $1 AND eb.runtime_id = runtime_rows.runtime_id) AS boundary_count,
		       (SELECT COUNT(*) FROM boundary_violations bv
		        WHERE bv.tenant_id = $1 AND bv.runtime_id = runtime_rows.runtime_id) AS violation_count,
		       (SELECT COUNT(*) FROM runtime_handoff_events he
		        WHERE he.tenant_id = $1 AND (he.source_runtime_id = runtime_rows.runtime_id OR he.target_runtime_id = runtime_rows.runtime_id)) AS handoff_count,
		       (SELECT COUNT(*) FROM verification_results vr
		        JOIN task_records tr ON tr.tenant_id = vr.tenant_id AND tr.task_id = vr.task_id
		        WHERE vr.tenant_id = $1 AND tr.runtime_id = runtime_rows.runtime_id AND vr.status = 'verified') AS verified_proof_count,
		       (SELECT COUNT(*) FROM verification_results vr
		        JOIN task_records tr ON tr.tenant_id = vr.tenant_id AND tr.task_id = vr.task_id
		        WHERE vr.tenant_id = $1 AND tr.runtime_id = runtime_rows.runtime_id
		          AND vr.status IN ('failed_verification','policy_violation')) AS failed_verification_count,
		       (SELECT COUNT(*) FROM runtime_handoff_events he
		        WHERE he.tenant_id = $1 AND (he.source_runtime_id = runtime_rows.runtime_id OR he.target_runtime_id = runtime_rows.runtime_id)
		          AND he.checkpoint_portability = 'same_runtime_only') AS portability_same_runtime_only,
		       (SELECT COUNT(*) FROM runtime_handoff_events he
		        WHERE he.tenant_id = $1 AND (he.source_runtime_id = runtime_rows.runtime_id OR he.target_runtime_id = runtime_rows.runtime_id)
		          AND he.checkpoint_portability = 'compatible_runtime') AS portability_compatible_runtime,
		       (SELECT COUNT(*) FROM runtime_handoff_events he
		        WHERE he.tenant_id = $1 AND (he.source_runtime_id = runtime_rows.runtime_id OR he.target_runtime_id = runtime_rows.runtime_id)
		          AND he.checkpoint_portability = 'any_runtime') AS portability_any_runtime,
		       COUNT(*) OVER()
		FROM runtime_rows
		WHERE %s
		ORDER BY last_seen %s NULLS LAST, runtime_id ASC
		LIMIT $%d OFFSET $%d`, strings.Join(where, " AND "), sortDirection(opts.Sort), len(args)+1, len(args)+2)
	args = append(args, opts.Limit, opts.Offset)
	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var r RuntimeOperationsSummary
		var lastSeen sql.NullTime
		var status string
		var healthy bool
		var endpoint string
		if err := rows.Scan(&r.RuntimeID, &r.CapabilitySummary, &lastSeen, &status, &healthy, &endpoint,
			&r.ActiveExecutionCount, &r.RecentExecutionCount, &r.BoundaryCount, &r.ViolationCount,
			&r.HandoffCount, &r.VerifiedProofCount, &r.FailedVerificationCount,
			&r.CheckpointPortabilitySummary.SameRuntimeOnly,
			&r.CheckpointPortabilitySummary.CompatibleRuntime,
			&r.CheckpointPortabilitySummary.AnyRuntime,
			&out.Total); err != nil {
			return nil, err
		}
		r.RuntimeLabel = r.RuntimeID
		if lastSeen.Valid {
			t := lastSeen.Time
			r.LastSeen = &t
		}
		r.Routable = healthy && status == "active" && internal.IsRoutableHTTPRuntimeEndpoint(endpoint)
		r.TrustState = runtimeTrustState(status, r.Routable, r)
		if r.BoundaryCount > 0 && len(r.CapabilitySummary) <= 2 {
			r.EnforcementWarning = "Runtime capability evidence not available; boundary enforcement depends on runtime support."
		}
		out.Items = append(out.Items, r)
	}
	return out, rows.Err()
}

func runtimeTrustState(status string, healthy bool, r RuntimeOperationsSummary) string {
	if r.ViolationCount > 0 {
		return "boundary_violation"
	}
	if r.FailedVerificationCount > 0 {
		return "limited_trust"
	}
	if healthy && (status == "" || status == "active") {
		return "trusted"
	}
	return "limited_trust"
}

func normalizeGovernanceListOptions(opts GovernanceListOptions) GovernanceListOptions {
	if opts.Limit <= 0 {
		opts.Limit = 100
	}
	if opts.Limit > 500 {
		opts.Limit = 500
	}
	if opts.Offset < 0 {
		opts.Offset = 0
	}
	if opts.Sort != "asc" {
		opts.Sort = "desc"
	}
	opts.Decision = strings.ToLower(strings.TrimSpace(opts.Decision))
	opts.RiskLevel = strings.ToLower(strings.TrimSpace(opts.RiskLevel))
	opts.ReplayClass = strings.ToLower(strings.TrimSpace(opts.ReplayClass))
	opts.HandoffDecision = strings.ToLower(strings.TrimSpace(opts.HandoffDecision))
	opts.Severity = strings.ToLower(strings.TrimSpace(opts.Severity))
	opts.Status = strings.ToLower(strings.TrimSpace(opts.Status))
	return opts
}

func governanceBaseWhere(tenantID string, opts GovernanceListOptions, timeColumn string) ([]string, []any) {
	where := []string{"tenant_id = $1"}
	args := []any{tenantID}
	if taskID := strings.TrimSpace(opts.TaskID); taskID != "" {
		where = append(where, fmt.Sprintf("task_id::text = $%d", len(args)+1))
		args = append(args, taskID)
	}
	if since := governanceSince(opts.TimeRange); since != nil {
		where = append(where, fmt.Sprintf("%s >= $%d", timeColumn, len(args)+1))
		args = append(args, *since)
	}
	return where, args
}

func governanceBaseWhereWithAlias(tenantID string, opts GovernanceListOptions, timeColumn, alias string) ([]string, []any) {
	prefix := strings.TrimSpace(alias)
	if prefix != "" {
		prefix += "."
	}
	where := []string{prefix + "tenant_id = $1"}
	args := []any{tenantID}
	if taskID := strings.TrimSpace(opts.TaskID); taskID != "" {
		where = append(where, fmt.Sprintf("%stask_id::text = $%d", prefix, len(args)+1))
		args = append(args, taskID)
	}
	if since := governanceSince(opts.TimeRange); since != nil {
		where = append(where, fmt.Sprintf("%s%s >= $%d", prefix, timeColumn, len(args)+1))
		args = append(args, *since)
	}
	return where, args
}

func governanceSince(value string) *time.Time {
	now := time.Now().UTC()
	var since time.Time
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1h", "last_1h":
		since = now.Add(-time.Hour)
	case "6h", "last_6h":
		since = now.Add(-6 * time.Hour)
	case "24h", "last_24h":
		since = now.Add(-24 * time.Hour)
	case "7d", "last_7d":
		since = now.Add(-7 * 24 * time.Hour)
	case "30d", "last_30d":
		since = now.Add(-30 * 24 * time.Hour)
	default:
		return nil
	}
	return &since
}

func sortDirection(sort string) string {
	if strings.EqualFold(sort, "asc") {
		return "ASC"
	}
	return "DESC"
}

func validString(value string, allowed ...string) bool {
	for _, item := range allowed {
		if value == item {
			return true
		}
	}
	return false
}

func RecoveryHandoffAllowed(task *TaskRecord, checkpoint *CheckpointPayload, targetRuntimeID string, decision ActionPolicyDecision) (bool, string) {
	if task == nil {
		return false, "task missing"
	}
	if decision.Decision != ActionDecisionAllowed {
		return false, decision.PolicyReason
	}
	// Re-verify the irreversible-safety invariant at the actual redispatch point:
	// an irreversible task may hand off only when its checkpoint proves every
	// irreversible step is still pending (forward-resume). This never replays a
	// committed side effect, and denies when the checkpoint cannot prove safety.
	if decision.Irreversible && !recoveryForwardResumeSafe(task.TaskID, task.TaskDefinition, checkpoint) {
		return false, "irreversible action already committed or checkpoint cannot prove safe forward-resume"
	}
	if checkpoint == nil {
		return true, "no checkpoint; first safe redispatch"
	}
	switch decision.CheckpointPortability {
	case CheckpointPortabilityAnyRuntime, CheckpointPortabilityCompatibleRuntime:
		return true, "checkpoint portability allows compatible runtime handoff"
	case CheckpointPortabilitySameRuntime:
		if checkpoint.ResumeToken.RuntimeID == "" || checkpoint.ResumeToken.RuntimeID == targetRuntimeID {
			return true, "same runtime checkpoint"
		}
		return false, "checkpoint is same-runtime-only"
	default:
		return false, "unknown checkpoint portability"
	}
}
