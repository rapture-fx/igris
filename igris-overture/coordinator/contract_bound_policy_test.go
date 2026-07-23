package coordinator

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestContractBoundPolicyUsesStricterRiskAndApproval(t *testing.T) {
	t.Parallel()
	taskID := uuid.New()
	definition := json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[
			{
				"kind":"tool",
				"node_id":"contract-bound-http-0",
				"tool_name":"http_request",
				"metadata":{
					"action_name":"clock3b.consequential_transfer",
					"contract_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					"contract_binding_id":"11111111-1111-1111-1111-111111111111",
					"contract_risk":"critical",
					"replay_class":"retryable",
					"approval_required":true,
					"irreversible":false
				}
			},
			{
				"kind":"tool",
				"node_id":"contract-bound-completion-1",
				"tool_name":"database_write",
				"metadata":{"irreversible":true}
			}
		]}
	}`)

	decision := evaluateActionPolicy(actionPolicyInput{
		TenantID: "tenant-a", TaskID: taskID, RuntimeID: "runtime-1",
		TaskDefinition: definition,
	})
	require.Equal(t, ActionDecisionApprovalRequired, decision.Decision)
	require.Equal(t, "critical", decision.RiskLevel, "human gating must not lower critical risk")
	require.True(t, decision.HumanGated)
	require.Equal(t, ReplayClassNonRetryable, decision.ReplayClass, "the stricter irreversible completion step wins")
	require.Equal(t, "execution-governance.contract-bound.v1", decision.PolicyVersion)
}

func TestExtractBoundActionPolicyRequiresHashAndBindingIdentity(t *testing.T) {
	t.Parallel()
	withoutBinding := extractBoundActionPolicy(json.RawMessage(`{
		"graph":{"nodes":[{"metadata":{"contract_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","contract_risk":"critical"}}]}
	}`))
	require.False(t, withoutBinding.Present)

	withBinding := extractBoundActionPolicy(json.RawMessage(`{
		"graph":{"nodes":[{"metadata":{
			"contract_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			"contract_binding_id":"11111111-1111-1111-1111-111111111111",
			"contract_risk":"high",
			"approval_required":false,
			"replay_class":"retryable"
		}}]}
	}`))
	require.True(t, withBinding.Present)
	require.Equal(t, "high", withBinding.Risk)
	require.False(t, withBinding.ApprovalRequired)
}

func TestRecoveryForwardResumeSafeForContractBoundCheckpoint(t *testing.T) {
	t.Parallel()
	taskID := uuid.New()
	definition := json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[
			{"kind":"tool","node_id":"contract-bound-http-0","tool_name":"http_request","metadata":{"contract_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","contract_binding_id":"11111111-1111-1111-1111-111111111111"}},
			{"kind":"tool","node_id":"contract-bound-completion-1","tool_name":"database_write","metadata":{"irreversible":true}}
		]}
	}`)
	afterHTTP := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 0,
			CheckpointDigest:  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			RuntimeID:         "runtime-1",
		},
		WalEntries: []WalEntry{{
			EntryID: uuid.New(), TaskID: taskID, StepIndex: 0, Status: "committed",
		}},
	}
	require.True(t, recoveryForwardResumeSafe(taskID, definition, afterHTTP),
		"after the HTTP step commits, the irreversible completion step must remain forward-resumable")

	afterCompletion := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 1,
			CheckpointDigest:  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			RuntimeID:         "runtime-2",
		},
		WalEntries: []WalEntry{
			{EntryID: uuid.New(), TaskID: taskID, StepIndex: 0, Status: "committed"},
			{EntryID: uuid.New(), TaskID: taskID, StepIndex: 1, Status: "committed"},
		},
	}
	require.False(t, recoveryForwardResumeSafe(taskID, definition, afterCompletion),
		"once the irreversible completion commits, automatic forward resume must stop")
}
