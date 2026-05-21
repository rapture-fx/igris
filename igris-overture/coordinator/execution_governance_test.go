package coordinator

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
)

func TestEvaluateActionPolicyAllowsRetryableReadOnlyAction(t *testing.T) {
	taskID := uuid.New()
	definition := json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{"kind":"tool","tool_name":"filesystem","node_id":"read_file-0"}]}
	}`)

	decision := evaluateActionPolicy(actionPolicyInput{
		TenantID:       "tenant-1",
		TaskID:         taskID,
		RuntimeID:      "runtime-1",
		TaskDefinition: definition,
		RequiredCaps:   []string{"tools.filesystem", "filesystem.read"},
	})

	if decision.Decision != ActionDecisionAllowed {
		t.Fatalf("decision = %q, want allowed", decision.Decision)
	}
	if decision.ReplayClass != ReplayClassRetryable {
		t.Fatalf("replay class = %q, want retryable", decision.ReplayClass)
	}
	if decision.Irreversible {
		t.Fatal("read-only action marked irreversible")
	}
}

func TestEvaluateActionPolicyRequiresApprovalBeforeExecution(t *testing.T) {
	definition := json.RawMessage(`{
		"type":"single_inference",
		"model":"test-model",
		"approval":{"required":true}
	}`)

	decision := evaluateActionPolicy(actionPolicyInput{
		TenantID:       "tenant-1",
		TaskID:         uuid.New(),
		RuntimeID:      "runtime-1",
		TaskDefinition: definition,
	})

	if decision.Decision != ActionDecisionApprovalRequired {
		t.Fatalf("decision = %q, want approval_required", decision.Decision)
	}
	if !decision.HumanGated {
		t.Fatal("approval-required action was not marked human gated")
	}
}

func TestEvaluateActionPolicyBlocksIrreversibleRecoveryReplay(t *testing.T) {
	taskID := uuid.New()
	definition := json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{"kind":"tool","tool_name":"database_write","node_id":"db_write-0"}]}
	}`)
	checkpoint := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 0,
			CheckpointDigest:  "abc",
			RuntimeID:         "runtime-1",
		},
		WalEntries: []WalEntry{{
			EntryID:     uuid.New(),
			TaskID:      taskID,
			StepIndex:   0,
			Status:      "committed",
			InputDigest: "abc",
			RuntimeID:   "runtime-1",
		}},
	}

	decision := evaluateActionPolicy(actionPolicyInput{
		TenantID:        "tenant-1",
		TaskID:          taskID,
		RuntimeID:       "runtime-2",
		TaskDefinition:  definition,
		Checkpoint:      checkpoint,
		RecoveryAttempt: true,
	})

	if decision.Decision != ActionDecisionDenied {
		t.Fatalf("decision = %q, want denied", decision.Decision)
	}
	if decision.ReplayClass != ReplayClassNonRetryable {
		t.Fatalf("replay class = %q, want non_retryable", decision.ReplayClass)
	}
	if !decision.Irreversible {
		t.Fatal("database write action was not marked irreversible")
	}
}

func TestRecoveryHandoffBlocksSameRuntimeOnlyMigration(t *testing.T) {
	taskID := uuid.New()
	checkpoint := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 0,
			CheckpointDigest:  "digest",
			RuntimeID:         "runtime-a",
		},
		WalEntries: []WalEntry{{
			EntryID:     uuid.New(),
			TaskID:      taskID,
			StepIndex:   0,
			Status:      "committed",
			InputDigest: "abc",
			RuntimeID:   "runtime-a",
		}},
	}
	decision := ActionPolicyDecision{
		Decision:              ActionDecisionAllowed,
		ReplayClass:           ReplayClassRetryable,
		CheckpointPortability: CheckpointPortabilitySameRuntime,
	}

	allowed, reason := RecoveryHandoffAllowed(&TaskRecord{TaskID: taskID}, checkpoint, "runtime-b", decision)
	if allowed {
		t.Fatalf("handoff allowed, want denied; reason=%s", reason)
	}
}

func TestRecoveryHandoffAllowsCompatibleRuntime(t *testing.T) {
	taskID := uuid.New()
	checkpoint := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 0,
			CheckpointDigest:  "digest",
			RuntimeID:         "runtime-a",
		},
		WalEntries: []WalEntry{{
			EntryID:     uuid.New(),
			TaskID:      taskID,
			StepIndex:   0,
			Status:      "committed",
			InputDigest: "abc",
			RuntimeID:   "runtime-a",
		}},
	}
	decision := ActionPolicyDecision{
		Decision:              ActionDecisionAllowed,
		ReplayClass:           ReplayClassRetryable,
		CheckpointPortability: CheckpointPortabilityCompatibleRuntime,
	}

	allowed, reason := RecoveryHandoffAllowed(&TaskRecord{TaskID: taskID}, checkpoint, "runtime-b", decision)
	if !allowed {
		t.Fatalf("handoff denied, want allowed; reason=%s", reason)
	}
}
