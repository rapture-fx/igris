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

func TestEvaluateActionPolicyRequiresApprovalForGatewayMetadata(t *testing.T) {
	// The Actions gateway does not emit an `"approval":{"required":true}` block;
	// it stamps `approval_required` into execution-graph node metadata
	// (api.actionNodeMetadata). A human-gated registered action such as
	// demo.needs_approval must pause on that shape.
	definition := json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{"id":"action","metadata":{
			"action":"demo.needs_approval",
			"policy_preset":"Human-gated",
			"approval_required":true,
			"irreversible":false
		}}]}
	}`)

	decision := evaluateActionPolicy(actionPolicyInput{
		TenantID:       "tenant-1",
		TaskID:         uuid.New(),
		RuntimeID:      "runtime-1",
		TaskDefinition: definition,
	})

	if decision.Decision != ActionDecisionApprovalRequired {
		t.Fatalf("decision = %q, want approval_required for gateway approval_required metadata", decision.Decision)
	}
	if !decision.HumanGated {
		t.Fatal("gateway approval_required metadata was not marked human gated")
	}

	notGated := json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{"id":"action","metadata":{
			"action":"demo.echo",
			"policy_preset":"Safe automation",
			"approval_required":false
		}}]}
	}`)
	open := evaluateActionPolicy(actionPolicyInput{
		TenantID:       "tenant-1",
		TaskID:         uuid.New(),
		RuntimeID:      "runtime-1",
		TaskDefinition: notGated,
	})
	if open.Decision != ActionDecisionAllowed {
		t.Fatalf("decision = %q, want allowed when approval_required=false", open.Decision)
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

func TestEvaluateActionPolicyAllowsForwardResumeBeforeIrreversibleStep(t *testing.T) {
	taskID := uuid.New()
	// db_write is step 4; the checkpoint committed only through step 1.
	definition := json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[
			{"kind":"tool","tool_name":"filesystem","node_id":"read_file-0"},
			{"kind":"tool","tool_name":"http_request","node_id":"http_call-1"},
			{"kind":"tool","tool_name":"filesystem","node_id":"read_file-2"},
			{"kind":"tool","tool_name":"http_request","node_id":"http_call-3"},
			{"kind":"tool","tool_name":"database_write","node_id":"db_write-4"}
		]}
	}`)
	checkpoint := &CheckpointPayload{
		TaskID:      taskID,
		ResumeToken: ResumeToken{LastCommittedStep: 1, CheckpointDigest: "abc", RuntimeID: "runtime-1"},
		WalEntries: []WalEntry{
			{EntryID: uuid.New(), TaskID: taskID, StepIndex: 0, Status: "committed", InputDigest: "a", RuntimeID: "runtime-1"},
			{EntryID: uuid.New(), TaskID: taskID, StepIndex: 1, Status: "committed", InputDigest: "b", RuntimeID: "runtime-1"},
		},
	}

	decision := evaluateActionPolicy(actionPolicyInput{
		TenantID:        "tenant-1",
		TaskID:          taskID,
		RuntimeID:       "runtime-2",
		TaskDefinition:  definition,
		Checkpoint:      checkpoint,
		RecoveryAttempt: true,
	})

	if decision.Decision != ActionDecisionAllowed {
		t.Fatalf("decision = %q, want allowed (irreversible step still pending)", decision.Decision)
	}
	if !decision.Irreversible {
		t.Fatal("task with database_write should still be marked irreversible")
	}
	if decision.CheckpointPortability != CheckpointPortabilityCompatibleRuntime {
		t.Fatalf("portability = %q, want compatible_runtime for safe forward-resume", decision.CheckpointPortability)
	}
}

func TestEvaluateActionPolicyDeniesIrreversibleRecoveryWithoutCheckpoint(t *testing.T) {
	taskID := uuid.New()
	definition := json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{"kind":"tool","tool_name":"database_write","node_id":"db_write-0"}]}
	}`)

	decision := evaluateActionPolicy(actionPolicyInput{
		TenantID:        "tenant-1",
		TaskID:          taskID,
		RuntimeID:       "runtime-2",
		TaskDefinition:  definition,
		Checkpoint:      nil,
		RecoveryAttempt: true,
	})

	if decision.Decision != ActionDecisionDenied {
		t.Fatalf("decision = %q, want denied when checkpoint cannot prove the irreversible step is pending", decision.Decision)
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
