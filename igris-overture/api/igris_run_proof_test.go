package api

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/internal/canonicaljson"
)

func sampleBoundTaskDefinition(t *testing.T, actionName string, toolInput map[string]interface{}) json.RawMessage {
	t.Helper()
	body, err := json.Marshal(toolInput)
	require.NoError(t, err)
	def := map[string]interface{}{
		"checkpoint_after_steps": 1,
		"graph": map[string]interface{}{
			"nodes": []map[string]interface{}{
				{
					"kind":      "tool",
					"node_id":   "contract-bound-http-0",
					"tool_name": "http_request",
					"args": map[string]interface{}{
						"method": "POST",
						"url":    "http://127.0.0.1:18099/v1/clock3b/consequential-transfer",
						"body":   string(body),
					},
					"metadata": map[string]interface{}{
						"action_name":   actionName,
						"contract_hash": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					},
				},
				{
					"kind":      "tool",
					"node_id":   "contract-bound-completion-1",
					"tool_name": "database_write",
					"metadata": map[string]interface{}{
						"action_name": actionName,
					},
				},
			},
		},
	}
	raw, err := json.Marshal(def)
	require.NoError(t, err)
	return raw
}

func TestExtractBoundToolContextMatchesCanonicalInputHash(t *testing.T) {
	t.Parallel()
	input := map[string]interface{}{"account_id": "acct-1", "amount_cents": 2500}
	def := sampleBoundTaskDefinition(t, "clock3b.consequential_transfer", input)

	actionName, toolHash, err := extractBoundToolContext(def)
	require.NoError(t, err)
	require.Equal(t, "clock3b.consequential_transfer", actionName)

	// Recompute expected hash with the same canonical rules as the SDK.
	normalized := map[string]interface{}{"account_id": "acct-1", "amount_cents": int64(2500)}
	canonical, err := canonicaljson.Encode(normalized)
	require.NoError(t, err)
	require.Equal(t, canonicaljson.SHA256Hex(canonical), toolHash)
	require.Regexp(t, `^[0-9a-f]{64}$`, toolHash)
}

func TestExtractBoundToolContextRejectsMissingToolBody(t *testing.T) {
	t.Parallel()
	def := json.RawMessage(`{"graph":{"nodes":[{"tool_name":"database_write"}]}}`)
	_, _, err := extractBoundToolContext(def)
	require.Error(t, err)
}

func TestExtractBoundToolContextUsesEncryptedInputDigest(t *testing.T) {
	t.Parallel()
	digest := "20ad649578cecdcc49393db339d09adcfced38bea03678cb5f7cab9d7115db5a"
	def := map[string]interface{}{
		"graph": map[string]interface{}{
			"nodes": []map[string]interface{}{
				{
					"node_id":   "contract-bound-http-0",
					"tool_name": "http_request",
					"args": map[string]interface{}{
						"url": "http://127.0.0.1:18099/v1/clock3b/consequential-transfer",
						"body": map[string]interface{}{
							"encrypted_input_ref":    true,
							"input_redacted":         true,
							"input_digest_sha256":    digest,
							"encrypted_input_ref_id": uuid.New().String(),
							"safe_summary":           "sensitive input redacted",
						},
					},
					"metadata": map[string]interface{}{
						"action_name": "clock3b.consequential_transfer",
					},
				},
			},
		},
	}
	raw, err := json.Marshal(def)
	require.NoError(t, err)
	actionName, toolHash, err := extractBoundToolContext(raw)
	require.NoError(t, err)
	require.Equal(t, "clock3b.consequential_transfer", actionName)
	require.Equal(t, digest, toolHash)
}

func TestBuildIgrisRunProofClaimTypeSeparation(t *testing.T) {
	t.Parallel()
	taskID := uuid.New()
	bindingID := uuid.New()
	targetID := uuid.New()
	verified := true
	task := &coordinator.TaskRecord{
		TaskID:         taskID,
		TenantID:       "tenant-a",
		Status:         coordinator.TaskStatusCompleted,
		TaskDefinition: sampleBoundTaskDefinition(t, "clock3b.consequential_transfer", map[string]interface{}{"account_id": "acct-1", "amount_cents": 1}),
		Proof: &coordinator.TaskProofState{
			ExecutionID: "exec-1",
			Status:      "verified",
			Verified:    &verified,
		},
		BoundAction: &coordinator.BoundActionRunIdentity{
			BindingID:              bindingID,
			ContractHash:           "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			TargetActionID:         targetID,
			TargetVersionHash:      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			BusinessIdempotencyKey: "biz-1",
			RequestFingerprint:     "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
		},
	}
	link := &actionEvidenceLink{
		ID:          uuid.New(),
		BatchID:     uuid.New(),
		ChainDigest: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
	}
	resp := buildActionRunResponse(task, nil)
	attachIgrisRunProof(resp, task, link, []coordinator.RecoveryEvent{
		{SourceRuntimeID: "rt1", TargetRuntimeID: "rt2"},
	}, &coordinator.RuntimeHandoffEvent{
		SourceRuntimeID: "rt1", TargetRuntimeID: "rt2",
	})

	require.NotNil(t, resp["igris_run_proof"])
	runProof := asMap(t, resp["igris_run_proof"])
	require.Equal(t, igrisRunProofSchemaV1, runProof["schema"])
	require.Equal(t, "Igris Run Proof", runProof["product_term"])
	require.Equal(t, taskID.String(), runProof["run_id"])
	require.Equal(t, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", runProof["contract_hash"])
	require.Equal(t, bindingID.String(), runProof["binding_id"])

	statuses := asMap(t, runProof["statuses"])
	require.Equal(t, "verified", statuses["runtime_proof_status"])
	require.Equal(t, "linked", statuses["action_evidence_status"])
	require.Equal(t, "eligible_linked", statuses["run_linkage_status"])
	require.Equal(t, "completed", statuses["execution_status"])

	boundary := asMap(t, runProof["claim_boundary"])
	require.Contains(t, boundary["action_protocol_evidence"], "does not prove managed")
	require.Contains(t, boundary["runtime_receipt"], "does not prove external")
	require.Contains(t, boundary["linked_view"], "not protocol-level")

	rt := asMap(t, runProof["runtime_proof"])
	require.Equal(t, "runtime_receipt", rt["claim_type"])
	ae := asMap(t, runProof["action_protocol_evidence"])
	require.Equal(t, "action_protocol_evidence", ae["claim_type"])
	require.NotEqual(t, rt["claim_type"], ae["claim_type"])

	// Clock 3B linked_proof remains present and coherent.
	linked := asMap(t, resp["linked_proof"])
	require.Equal(t, igrisRunProofSchemaV1, linked["schema"])
	require.NotNil(t, linked["action_protocol_evidence"])
	require.NotNil(t, linked["runtime_proof"])
	require.NotNil(t, linked["recovery_lineage"])
}

func TestBuildIgrisRunProofWithoutEvidenceLink(t *testing.T) {
	t.Parallel()
	task := &coordinator.TaskRecord{
		TaskID:         uuid.New(),
		Status:         coordinator.TaskStatusDispatched,
		TaskDefinition: sampleBoundTaskDefinition(t, "clock3b.consequential_transfer", map[string]interface{}{"account_id": "a", "amount_cents": 2}),
		BoundAction: &coordinator.BoundActionRunIdentity{
			BindingID:              uuid.New(),
			ContractHash:           "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			TargetActionID:         uuid.New(),
			TargetVersionHash:      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			BusinessIdempotencyKey: "biz-2",
			RequestFingerprint:     "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
		},
	}
	resp := buildActionRunResponse(task, nil)
	attachIgrisRunProof(resp, task, nil, nil, nil)
	runProof := asMap(t, resp["igris_run_proof"])
	statuses := asMap(t, runProof["statuses"])
	require.Equal(t, "not_linked", statuses["action_evidence_status"])
	require.Equal(t, "not_linked", statuses["run_linkage_status"])
	require.Equal(t, "unavailable", statuses["action_evidence_verification_status"])
	ae := asMap(t, runProof["action_protocol_evidence"])
	require.Equal(t, "not_linked", ae["status"])
}

func TestEvidenceNotLinkableErrorClassification(t *testing.T) {
	t.Parallel()
	err := errEvidenceNotLinkable("same contract different run")
	require.True(t, isEvidenceNotLinkable(err))
	require.False(t, isEvidenceNotLinkable(assertError("db boom")))
}

type simpleErr string

func (e simpleErr) Error() string { return string(e) }

func assertError(msg string) error { return simpleErr(msg) }

func asMap(t *testing.T, v interface{}) map[string]interface{} {
	t.Helper()
	switch m := v.(type) {
	case map[string]interface{}:
		return m
	default:
		// fiber.Map aliases map[string]interface{}; re-encode for safety.
		raw, err := json.Marshal(v)
		require.NoError(t, err)
		out := map[string]interface{}{}
		require.NoError(t, json.Unmarshal(raw, &out))
		return out
	}
}

func TestManagedAndExecutionStatusDimensions(t *testing.T) {
	t.Parallel()
	approval := &coordinator.TaskRecord{Status: coordinator.TaskStatusApprovalRequired}
	require.Equal(t, statusRequired, managedDecisionStatus(approval))
	require.Equal(t, statusPending, durableExecutionStatus(approval))

	done := &coordinator.TaskRecord{Status: coordinator.TaskStatusCompleted}
	require.Equal(t, statusObserved, managedDecisionStatus(done))
	require.Equal(t, statusCompleted, durableExecutionStatus(done))

	recovering := &coordinator.TaskRecord{Status: coordinator.TaskStatusRecovering}
	require.Equal(t, statusRecovering, durableExecutionStatus(recovering))
	require.Equal(t, statusRecovering, recoveryStatus(recovering, nil, nil))
}

func TestClaimBoundaryDoesNotUnifyClaims(t *testing.T) {
	t.Parallel()
	boundary := igrisRunProofClaimBoundary()
	require.Contains(t, boundary["linked_view"], "not protocol-level cryptographic unification")
	require.Contains(t, boundary["external_effect"], "neither cryptographic claim")
	require.NotContains(t, boundary["runtime_receipt"], "proves external side-effect uniqueness alone")
}
