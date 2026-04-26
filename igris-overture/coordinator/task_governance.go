package coordinator

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

var ErrTaskCapabilityDenied = errors.New("task capability policy denied")

type AgentIdentity struct {
	AgentID          string   `json:"agent_id,omitempty"`
	PrincipalID      string   `json:"principal_id,omitempty"`
	SubmittedBy      string   `json:"submitted_by,omitempty"`
	ActingOnBehalfOf string   `json:"acting_on_behalf_of,omitempty"`
	DelegationChain  []string `json:"delegation_chain,omitempty"`
}

type CredentialRequest struct {
	Tool             string `json:"tool,omitempty"`
	Capability       string `json:"capability,omitempty"`
	Scope            string `json:"scope,omitempty"`
	ExpiresInSeconds int64  `json:"expires_in_seconds,omitempty"`
}

type CredentialReference struct {
	ReferenceID     string `json:"reference_id"`
	TenantID        string `json:"tenant_id"`
	TaskID          string `json:"task_id"`
	Tool            string `json:"tool,omitempty"`
	Capability      string `json:"capability,omitempty"`
	Scope           string `json:"scope,omitempty"`
	ExpiresAtUnixMs int64  `json:"expires_at_unix_ms"`
	Revocable       bool   `json:"revocable"`
}

type CapabilityDecision struct {
	Capability    string `json:"capability"`
	Permit        bool   `json:"permit"`
	Reason        string `json:"reason"`
	PolicyVersion string `json:"policy_version"`
}

type TaskPermissionEnvelope struct {
	SchemaVersion        string                `json:"schema_version"`
	EnvelopeID           string                `json:"envelope_id"`
	TenantID             string                `json:"tenant_id"`
	TaskID               string                `json:"task_id"`
	RuntimeID            *string               `json:"runtime_id,omitempty"`
	AgentIdentity        AgentIdentity         `json:"agent_identity"`
	RequiredCapabilities []string              `json:"required_capabilities"`
	Decisions            []CapabilityDecision  `json:"decisions"`
	CredentialRefs       []CredentialReference `json:"credential_refs,omitempty"`
	IssuedAtUnixMs       int64                 `json:"issued_at_unix_ms"`
	ExpiresAtUnixMs      int64                 `json:"expires_at_unix_ms"`
	SignerKeyVersion     *string               `json:"signer_key_version,omitempty"`
	Signature            string                `json:"signature"`
}

type taskGovernance struct {
	AgentIdentity        AgentIdentity       `json:"agent_identity,omitempty"`
	RequiredCapabilities []string            `json:"required_capabilities,omitempty"`
	CredentialRequests   []CredentialRequest `json:"credential_requests,omitempty"`
}

type capabilityPolicyEvaluation struct {
	Decisions     []CapabilityDecision
	PolicyVersion string
	Permit        bool
	Reason        string
}

func normalizeTaskGovernance(tenantID string, identity *AgentIdentity, required []string, credentialRequests []CredentialRequest) taskGovernance {
	normalized := taskGovernance{
		RequiredCapabilities: normalizeCapabilityList(required),
		CredentialRequests:   normalizeCredentialRequests(credentialRequests),
	}
	if identity != nil {
		normalized.AgentIdentity = *identity
	}
	normalized.AgentIdentity.SubmittedBy = firstNonEmpty(normalized.AgentIdentity.SubmittedBy, tenantID)
	normalized.AgentIdentity.PrincipalID = firstNonEmpty(normalized.AgentIdentity.PrincipalID, normalized.AgentIdentity.SubmittedBy)
	normalized.AgentIdentity.ActingOnBehalfOf = firstNonEmpty(normalized.AgentIdentity.ActingOnBehalfOf, normalized.AgentIdentity.PrincipalID)
	normalized.AgentIdentity.AgentID = strings.TrimSpace(normalized.AgentIdentity.AgentID)
	normalized.AgentIdentity.PrincipalID = strings.TrimSpace(normalized.AgentIdentity.PrincipalID)
	normalized.AgentIdentity.SubmittedBy = strings.TrimSpace(normalized.AgentIdentity.SubmittedBy)
	normalized.AgentIdentity.ActingOnBehalfOf = strings.TrimSpace(normalized.AgentIdentity.ActingOnBehalfOf)
	normalized.AgentIdentity.DelegationChain = normalizeDelegationChain(normalized.AgentIdentity)
	return normalized
}

func normalizeCapabilityList(values []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		capability := strings.TrimSpace(strings.ToLower(value))
		if capability == "" {
			continue
		}
		if _, ok := seen[capability]; ok {
			continue
		}
		seen[capability] = struct{}{}
		out = append(out, capability)
	}
	sort.Strings(out)
	return out
}

func normalizeCredentialRequests(values []CredentialRequest) []CredentialRequest {
	out := make([]CredentialRequest, 0, len(values))
	for _, value := range values {
		req := CredentialRequest{
			Tool:             strings.TrimSpace(strings.ToLower(value.Tool)),
			Capability:       strings.TrimSpace(strings.ToLower(value.Capability)),
			Scope:            strings.TrimSpace(value.Scope),
			ExpiresInSeconds: value.ExpiresInSeconds,
		}
		if req.Tool == "" && req.Capability == "" && req.Scope == "" {
			continue
		}
		out = append(out, req)
	}
	return out
}

func normalizeDelegationChain(identity AgentIdentity) []string {
	chain := make([]string, 0, len(identity.DelegationChain)+2)
	seen := map[string]struct{}{}
	appendValue := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" {
			return
		}
		if _, ok := seen[value]; ok {
			return
		}
		seen[value] = struct{}{}
		chain = append(chain, value)
	}
	appendValue(identity.ActingOnBehalfOf)
	for _, value := range identity.DelegationChain {
		appendValue(value)
	}
	appendValue(identity.AgentID)
	return chain
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func agentIdentityEmpty(identity AgentIdentity) bool {
	return strings.TrimSpace(identity.AgentID) == "" &&
		strings.TrimSpace(identity.PrincipalID) == "" &&
		strings.TrimSpace(identity.SubmittedBy) == "" &&
		strings.TrimSpace(identity.ActingOnBehalfOf) == "" &&
		len(identity.DelegationChain) == 0
}

func attachTaskGovernanceToDefinition(definition json.RawMessage, governance taskGovernance) json.RawMessage {
	if len(governance.RequiredCapabilities) == 0 && len(governance.CredentialRequests) == 0 && agentIdentityEmpty(governance.AgentIdentity) {
		return definition
	}
	var object map[string]json.RawMessage
	if err := json.Unmarshal(definition, &object); err != nil {
		return definition
	}
	if raw, err := json.Marshal(governance.AgentIdentity); err == nil {
		object["agent_identity"] = raw
	}
	if raw, err := json.Marshal(governance.RequiredCapabilities); err == nil {
		object["required_capabilities"] = raw
	}
	if len(governance.CredentialRequests) > 0 {
		if raw, err := json.Marshal(governance.CredentialRequests); err == nil {
			object["credential_requests"] = raw
		}
	}
	encoded, err := json.Marshal(object)
	if err != nil {
		return definition
	}
	return encoded
}

func extractTaskGovernanceFromDefinition(definition json.RawMessage) taskGovernance {
	var object map[string]json.RawMessage
	if err := json.Unmarshal(definition, &object); err != nil {
		return taskGovernance{}
	}
	var governance taskGovernance
	_ = json.Unmarshal(object["agent_identity"], &governance.AgentIdentity)
	_ = json.Unmarshal(object["required_capabilities"], &governance.RequiredCapabilities)
	_ = json.Unmarshal(object["credential_requests"], &governance.CredentialRequests)
	governance.RequiredCapabilities = normalizeCapabilityList(governance.RequiredCapabilities)
	governance.CredentialRequests = normalizeCredentialRequests(governance.CredentialRequests)
	return governance
}

func taskGovernanceForRecord(task *TaskRecord) taskGovernance {
	if task == nil {
		return taskGovernance{}
	}
	governance := taskGovernance{
		AgentIdentity:        task.AgentIdentity,
		RequiredCapabilities: normalizeCapabilityList(task.RequiredCapabilities),
		CredentialRequests:   normalizeCredentialRequests(task.CredentialRequests),
	}
	if len(governance.RequiredCapabilities) == 0 && len(governance.CredentialRequests) == 0 && agentIdentityEmpty(governance.AgentIdentity) {
		governance = extractTaskGovernanceFromDefinition(task.TaskDefinition)
	}
	if len(governance.RequiredCapabilities) == 0 && loadOvertureSigningKey() != nil {
		governance.RequiredCapabilities = deriveRequiredCapabilitiesFromTaskDefinition(task.TaskDefinition)
	}
	governance.AgentIdentity = normalizeTaskGovernance(task.TenantID, &governance.AgentIdentity, governance.RequiredCapabilities, governance.CredentialRequests).AgentIdentity
	return governance
}

func deriveRequiredCapabilitiesFromTaskDefinition(definition json.RawMessage) []string {
	var object map[string]json.RawMessage
	if err := json.Unmarshal(definition, &object); err != nil {
		return nil
	}

	var taskType string
	_ = json.Unmarshal(object["type"], &taskType)
	capabilities := map[string]struct{}{}
	addCapability := func(value string) {
		value = strings.TrimSpace(strings.ToLower(value))
		if value == "" {
			return
		}
		capabilities[value] = struct{}{}
	}
	addMemoryCapabilities := func(raw json.RawMessage) {
		var memory struct {
			RecallQuery *string `json:"recall_query"`
			RecallTopK  *int    `json:"recall_top_k"`
			StoreKey    *string `json:"store_key"`
			StoreOutput bool    `json:"store_output"`
		}
		if len(raw) == 0 || json.Unmarshal(raw, &memory) != nil {
			return
		}
		if memory.RecallQuery != nil && strings.TrimSpace(*memory.RecallQuery) != "" {
			addCapability("memory.read")
		}
		if memory.RecallTopK != nil && *memory.RecallTopK > 0 {
			addCapability("memory.read")
		}
		if memory.StoreOutput {
			addCapability("memory.write")
		}
		if memory.StoreKey != nil && strings.TrimSpace(*memory.StoreKey) != "" {
			addCapability("memory.write")
		}
	}
	addApprovalCapability := func(raw json.RawMessage) {
		var approval struct {
			Required   bool     `json:"required"`
			Confidence *float64 `json:"confidence"`
		}
		if len(raw) == 0 || json.Unmarshal(raw, &approval) != nil {
			return
		}
		if approval.Required || approval.Confidence != nil {
			addCapability("human.approval")
		}
	}

	switch taskType {
	case "single_inference":
		addMemoryCapabilities(object["memory"])
		addApprovalCapability(object["approval"])
	case "agent_workflow":
		var payload struct {
			Steps []map[string]json.RawMessage `json:"steps"`
		}
		if json.Unmarshal(definition, &payload) == nil {
			for _, step := range payload.Steps {
				addMemoryCapabilities(step["memory"])
				addApprovalCapability(step["approval"])
			}
		}
	case "robotics_workflow":
		addCapability("robotics.execute")
		var payload struct {
			Steps []map[string]json.RawMessage `json:"steps"`
		}
		if json.Unmarshal(definition, &payload) == nil {
			for _, step := range payload.Steps {
				addApprovalCapability(step["approval"])
			}
		}
	case "behavior_tree":
		addCapability("behavior_tree.execute")
	case "execution_graph":
		var payload struct {
			Graph struct {
				Nodes []map[string]json.RawMessage `json:"nodes"`
			} `json:"graph"`
		}
		if json.Unmarshal(definition, &payload) == nil {
			for _, node := range payload.Graph.Nodes {
				var kind string
				_ = json.Unmarshal(node["kind"], &kind)
				switch strings.TrimSpace(strings.ToLower(kind)) {
				case "tool":
					var toolName string
					if json.Unmarshal(node["tool_name"], &toolName) == nil {
						addCapability(normalizeToolCapability(toolName))
					}
				case "memory_recall":
					addCapability("memory.read")
				case "memory_store":
					addCapability("memory.write")
				case "human_approval":
					addCapability("human.approval")
				case "robotics":
					addCapability("robotics.execute")
					addApprovalCapability(node["approval"])
				case "behavior_tree":
					addCapability("behavior_tree.execute")
				case "reason":
					addMemoryCapabilities(node["memory"])
					addApprovalCapability(node["approval"])
				}
			}
		}
	}

	out := make([]string, 0, len(capabilities))
	for capability := range capabilities {
		out = append(out, capability)
	}
	sort.Strings(out)
	return out
}

func normalizeToolCapability(toolName string) string {
	normalized := strings.TrimSpace(strings.ToLower(toolName))
	if normalized == "" {
		return ""
	}
	if strings.HasPrefix(normalized, "tools.") {
		return normalized
	}
	return "tools." + normalized
}

func (tc *TaskCoordinator) buildTaskPermissionEnvelope(ctx context.Context, task *TaskRecord, governance taskGovernance) (*TaskPermissionEnvelope, error) {
	if task == nil || len(governance.RequiredCapabilities) == 0 {
		return nil, nil
	}
	signingKey := loadOvertureSigningKey()
	if signingKey == nil {
		return nil, fmt.Errorf("%w: missing Overture signing key", ErrTaskCapabilityDenied)
	}
	evaluation := evaluateTaskCapabilityPolicy(ctx, tc.db, task.TenantID, governance.RequiredCapabilities)
	if !evaluation.Permit {
		return nil, fmt.Errorf("%w: %s", ErrTaskCapabilityDenied, evaluation.Reason)
	}
	now := time.Now().UnixMilli()
	expiresAt := now + int64(5*time.Minute/time.Millisecond)
	keyVersion := strings.TrimSpace(os.Getenv("IGRIS_OVERTURE_SIGNING_KEY_VERSION"))
	envelope := &TaskPermissionEnvelope{
		SchemaVersion:        "task_permission_envelope.v1",
		EnvelopeID:           uuid.NewString(),
		TenantID:             task.TenantID,
		TaskID:               task.TaskID.String(),
		RuntimeID:            task.RuntimeID,
		AgentIdentity:        governance.AgentIdentity,
		RequiredCapabilities: governance.RequiredCapabilities,
		Decisions:            evaluation.Decisions,
		CredentialRefs:       buildCredentialReferences(task, governance.CredentialRequests, expiresAt),
		IssuedAtUnixMs:       now,
		ExpiresAtUnixMs:      expiresAt,
	}
	if keyVersion != "" {
		envelope.SignerKeyVersion = &keyVersion
	}
	envelope.Signature = signTaskPermissionEnvelope(*envelope, signingKey)
	return envelope, nil
}

func evaluateTaskCapabilityPolicy(ctx context.Context, db *sql.DB, tenantID string, required []string) capabilityPolicyEvaluation {
	evaluation := capabilityPolicyEvaluation{
		PolicyVersion: "capabilities-policy.missing",
		Permit:        false,
		Reason:        "default deny: no active capability policy",
	}
	if len(required) == 0 {
		evaluation.Permit = true
		evaluation.Reason = "no capabilities requested"
		return evaluation
	}
	if db == nil {
		evaluation.Decisions = capabilityDecisions(required, evaluation.PolicyVersion, false, evaluation.Reason)
		return evaluation
	}

	var raw []byte
	if err := db.QueryRowContext(ctx, `
		SELECT COALESCE(
			(
				SELECT policy
				FROM ai_capability_policy_settings
				WHERE tenant_id = $1
				  AND active = true
				  AND status = 'active'
				  AND (expires_at IS NULL OR expires_at > NOW())
				ORDER BY updated_at DESC
				LIMIT 1
			),
			(
				SELECT capabilities_policy
				FROM tenants
				WHERE tenant_id = $1
			),
			'{}'::jsonb
		)`, tenantID).Scan(&raw); err != nil {
		evaluation.Reason = "default deny: capability policy lookup failed"
		evaluation.Decisions = capabilityDecisions(required, evaluation.PolicyVersion, false, evaluation.Reason)
		return evaluation
	}
	var policy map[string]any
	if err := json.Unmarshal(raw, &policy); err != nil {
		evaluation.Reason = "default deny: capability policy is invalid"
		evaluation.Decisions = capabilityDecisions(required, evaluation.PolicyVersion, false, evaluation.Reason)
		return evaluation
	}

	policyVersion := policyVersionFromCapabilityPolicy(raw, policy)
	evaluation.PolicyVersion = policyVersion
	decisions := make([]CapabilityDecision, 0, len(required))
	allPermit := true
	for _, capability := range required {
		permit, reason := capabilityPermittedByPolicy(capability, policy)
		if !permit {
			allPermit = false
		}
		decisions = append(decisions, CapabilityDecision{
			Capability:    capability,
			Permit:        permit,
			Reason:        reason,
			PolicyVersion: policyVersion,
		})
	}
	evaluation.Decisions = decisions
	evaluation.Permit = allPermit
	if allPermit {
		evaluation.Reason = "capability policy permitted"
	} else {
		evaluation.Reason = "capability policy denied one or more required capabilities"
	}
	return evaluation
}

func policyVersionFromCapabilityPolicy(raw []byte, policy map[string]any) string {
	for _, key := range []string{"policy_version", "version", "policy_hash"} {
		if value, ok := policy[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	sum := sha256.Sum256(raw)
	return fmt.Sprintf("capabilities-policy:%x", sum[:8])
}

func capabilityDecisions(required []string, policyVersion string, permit bool, reason string) []CapabilityDecision {
	decisions := make([]CapabilityDecision, 0, len(required))
	for _, capability := range required {
		decisions = append(decisions, CapabilityDecision{
			Capability:    capability,
			Permit:        permit,
			Reason:        reason,
			PolicyVersion: policyVersion,
		})
	}
	return decisions
}

func capabilityPermittedByPolicy(capability string, policy map[string]any) (bool, string) {
	if capabilityMatchesAny(capability, stringListFromPolicy(policy, "denied_capabilities", "deny", "deny_capabilities")) {
		return false, "capability explicitly denied"
	}
	if capabilityMatchesAny(capability, stringListFromPolicy(policy, "allowed_capabilities", "allow", "allow_capabilities")) {
		return true, "capability explicitly allowed"
	}
	switch {
	case capability == "network.http" || strings.HasPrefix(capability, "network.http."):
		return boolPolicy(policy, "allow_http"), "capability mapped to allow_http"
	case capability == "network.api" || strings.HasPrefix(capability, "network.api."):
		return boolPolicy(policy, "allow_external_api"), "capability mapped to allow_external_api"
	case capability == "filesystem.write" || strings.HasPrefix(capability, "filesystem.write."):
		return boolPolicy(policy, "allow_fs_write", "allow_filesystem_write"), "capability mapped to filesystem write policy"
	case capability == "filesystem.read" || strings.HasPrefix(capability, "filesystem.read."):
		return boolPolicy(policy, "allow_filesystem", "allow_fs_read"), "capability mapped to filesystem read policy"
	case capability == "tools.shell" || strings.HasPrefix(capability, "tools.shell."):
		return boolPolicy(policy, "allow_shell"), "capability mapped to allow_shell"
	default:
		return false, "capability is not allow-listed"
	}
}

func stringListFromPolicy(policy map[string]any, keys ...string) []string {
	var values []string
	for _, key := range keys {
		raw, ok := policy[key]
		if !ok {
			continue
		}
		switch typed := raw.(type) {
		case []any:
			for _, item := range typed {
				if text, ok := item.(string); ok {
					values = append(values, strings.TrimSpace(strings.ToLower(text)))
				}
			}
		case []string:
			for _, item := range typed {
				values = append(values, strings.TrimSpace(strings.ToLower(item)))
			}
		case string:
			for _, item := range strings.Split(typed, ",") {
				values = append(values, strings.TrimSpace(strings.ToLower(item)))
			}
		}
	}
	return values
}

func boolPolicy(policy map[string]any, keys ...string) bool {
	for _, key := range keys {
		if value, ok := policy[key].(bool); ok {
			return value
		}
	}
	return false
}

func capabilityMatchesAny(capability string, patterns []string) bool {
	for _, pattern := range patterns {
		if pattern == "" {
			continue
		}
		if pattern == capability || pattern == "*" {
			return true
		}
		if strings.HasSuffix(pattern, ".*") && strings.HasPrefix(capability, strings.TrimSuffix(pattern, "*")) {
			return true
		}
	}
	return false
}

func buildCredentialReferences(task *TaskRecord, requests []CredentialRequest, defaultExpiresAt int64) []CredentialReference {
	if task == nil || len(requests) == 0 {
		return nil
	}
	refs := make([]CredentialReference, 0, len(requests))
	now := time.Now()
	for _, req := range requests {
		expiresAt := defaultExpiresAt
		if req.ExpiresInSeconds > 0 {
			expiresAt = now.Add(time.Duration(req.ExpiresInSeconds) * time.Second).UnixMilli()
		}
		refs = append(refs, CredentialReference{
			ReferenceID:     "credref-" + uuid.NewString(),
			TenantID:        task.TenantID,
			TaskID:          task.TaskID.String(),
			Tool:            req.Tool,
			Capability:      req.Capability,
			Scope:           req.Scope,
			ExpiresAtUnixMs: expiresAt,
			Revocable:       true,
		})
	}
	return refs
}

func signTaskPermissionEnvelope(envelope TaskPermissionEnvelope, signingKey ed25519.PrivateKey) string {
	canonical, _ := json.Marshal(canonicalTaskPermissionEnvelope(envelope))
	sum := sha256.Sum256(canonical)
	return base64.StdEncoding.EncodeToString(ed25519.Sign(signingKey, sum[:]))
}

func canonicalTaskPermissionEnvelope(envelope TaskPermissionEnvelope) map[string]any {
	value := map[string]any{
		"agent_identity":        canonicalAgentIdentity(envelope.AgentIdentity),
		"credential_refs":       canonicalCredentialReferences(envelope.CredentialRefs),
		"decisions":             canonicalCapabilityDecisions(envelope.Decisions),
		"envelope_id":           envelope.EnvelopeID,
		"expires_at_unix_ms":    envelope.ExpiresAtUnixMs,
		"issued_at_unix_ms":     envelope.IssuedAtUnixMs,
		"required_capabilities": envelope.RequiredCapabilities,
		"schema_version":        envelope.SchemaVersion,
		"task_id":               envelope.TaskID,
		"tenant_id":             envelope.TenantID,
	}
	if envelope.RuntimeID != nil {
		value["runtime_id"] = *envelope.RuntimeID
	}
	if envelope.SignerKeyVersion != nil {
		value["signer_key_version"] = *envelope.SignerKeyVersion
	}
	return value
}

func canonicalAgentIdentity(identity AgentIdentity) map[string]any {
	return map[string]any{
		"acting_on_behalf_of": identity.ActingOnBehalfOf,
		"agent_id":            identity.AgentID,
		"delegation_chain":    identity.DelegationChain,
		"principal_id":        identity.PrincipalID,
		"submitted_by":        identity.SubmittedBy,
	}
}

func canonicalCapabilityDecisions(decisions []CapabilityDecision) []map[string]any {
	out := make([]map[string]any, 0, len(decisions))
	for _, decision := range decisions {
		out = append(out, map[string]any{
			"capability":     decision.Capability,
			"permit":         decision.Permit,
			"policy_version": decision.PolicyVersion,
			"reason":         decision.Reason,
		})
	}
	return out
}

func canonicalCredentialReferences(refs []CredentialReference) []map[string]any {
	out := make([]map[string]any, 0, len(refs))
	for _, ref := range refs {
		out = append(out, map[string]any{
			"capability":         ref.Capability,
			"expires_at_unix_ms": ref.ExpiresAtUnixMs,
			"reference_id":       ref.ReferenceID,
			"revocable":          ref.Revocable,
			"scope":              ref.Scope,
			"task_id":            ref.TaskID,
			"tenant_id":          ref.TenantID,
			"tool":               ref.Tool,
		})
	}
	return out
}
