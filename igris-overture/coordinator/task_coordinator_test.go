package coordinator

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"database/sql/driver"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func taskRecordRowForRecoveryTest(taskID uuid.UUID, tenantID string, status TaskRecordStatus, runtimeID, runtimeEndpoint string, taskDefinition json.RawMessage, checkpoint *CheckpointPayload, idempotencyKey string, createdAt time.Time) []driver.Value {
	return taskRecordRowForRecoveryTestWithFailureReason(taskID, tenantID, status, runtimeID, runtimeEndpoint, taskDefinition, checkpoint, idempotencyKey, nil, createdAt)
}

func taskRecordRowForRecoveryTestWithFailureReason(taskID uuid.UUID, tenantID string, status TaskRecordStatus, runtimeID, runtimeEndpoint string, taskDefinition json.RawMessage, checkpoint *CheckpointPayload, idempotencyKey string, failureReason *string, createdAt time.Time, failureDetails ...*TaskFailureDetails) []driver.Value {
	var checkpointBytes []byte
	if checkpoint != nil {
		checkpointBytes, _ = json.Marshal(checkpoint)
	}
	var failureDetailBytes []byte
	if len(failureDetails) > 0 && failureDetails[0] != nil {
		failureDetailBytes, _ = json.Marshal(failureDetails[0])
	}

	return []driver.Value{
		taskID.String(),
		tenantID,
		string(status),
		runtimeID,
		runtimeEndpoint,
		[]byte(taskDefinition),
		checkpointBytes,
		nil, // execution_envelope
		nil, // execution_receipt
		nil, // proof_execution_id
		nil, // proof_expected_hash
		nil, // proof_stored_hash
		nil, // proof_signature
		nil, // proof_status
		nil, // proof_checked_at
		nil, // proof_verified
		nil, // proof_hash_valid
		nil, // proof_signature_matches
		nil, // proof_runtime_key_found
		nil, // proof_chain_link_valid
		nil, // proof_verification_reason
		nil, // proof_verified_at
		idempotencyKey,
		failureReason,
		failureDetailBytes,
		nil,
		nil,
		nil,
		nil,
		createdAt,
		nil, // executed_target
		nil, // fallback_reason
		nil, // registered_agent_id
		"",  // registered_agent_name
	}
}

func signedArtifactJSON(t *testing.T, privateKey ed25519.PrivateKey, payload map[string]any) json.RawMessage {
	t.Helper()
	canonical, err := json.Marshal(payload)
	require.NoError(t, err)
	sum := sha256.Sum256(canonical)
	payload["signature"] = base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, sum[:]))
	signed, err := json.Marshal(payload)
	require.NoError(t, err)
	return signed
}

func signedReceiptJSON(t *testing.T, privateKey ed25519.PrivateKey, payload map[string]any) json.RawMessage {
	t.Helper()
	canonical := map[string]string{
		"agent_id":           receiptTestFieldString(payload, "agent_id"),
		"cpu_time_ms":        receiptTestFieldString(payload, "cpu_time_ms"),
		"execution_id":       receiptTestFieldString(payload, "execution_id"),
		"fs_bytes_written":   receiptTestFieldString(payload, "fs_bytes_written"),
		"memory_peak_mb":     receiptTestFieldString(payload, "memory_peak_mb"),
		"previous_hash":      receiptTestFieldString(payload, "previous_hash"),
		"timestamp_utc":      receiptTestFieldString(payload, "timestamp_utc"),
		"tool_calls":         receiptTestFieldString(payload, "tool_calls"),
		"violation_occurred": receiptTestFieldString(payload, "violation_occurred"),
		"wall_time_ms":       receiptTestFieldString(payload, "wall_time_ms"),
	}
	if runtimeID := receiptTestFieldString(payload, "runtime_id"); runtimeID != "" {
		canonical["runtime_id"] = runtimeID
	}
	if txHash := receiptTestFieldString(payload, "transaction_hash"); txHash != "" {
		canonical["transaction_hash"] = txHash
	}
	if txID := receiptTestFieldString(payload, "transaction_id"); txID != "" {
		canonical["transaction_id"] = txID
	}
	canonicalBytes, err := json.Marshal(canonical)
	require.NoError(t, err)
	sum := sha256.Sum256(canonicalBytes)
	payload["hash"] = hex.EncodeToString(sum[:])
	payload["signature"] = base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, sum[:]))
	signed, err := json.Marshal(payload)
	require.NoError(t, err)
	return signed
}

func TestSelectRuntimeSkipsInvalidEndpoints(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedCheckpointDB(t, []queuedQueryExpectation{{
		columns: []string{"runtime_id", "endpoint"},
		rows: [][]driver.Value{
			{"runtime-empty", " "},
			{"runtime-invalid", "not-a-url"},
			{"runtime-ftp", "ftp://runtime.test"},
			{"runtime-valid", " https://runtime.valid.test/ "},
		},
	}})
	tc := &TaskCoordinator{db: db}

	runtime, err := tc.selectRuntime(context.Background(), "tenant-runtime", "")
	require.NoError(t, err)
	require.Equal(t, "runtime-valid", runtime.RuntimeID)
	require.Equal(t, "https://runtime.valid.test", runtime.Endpoint)
	require.Equal(t, 0, queued.remainingQueries())
}

func TestSelectRuntimeFailsWhenOnlyInvalidEndpointsExist(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedCheckpointDB(t, []queuedQueryExpectation{{
		columns: []string{"runtime_id", "endpoint"},
		rows: [][]driver.Value{
			{"runtime-empty", ""},
			{"runtime-invalid", "not-a-url"},
		},
	}})
	tc := &TaskCoordinator{db: db}

	runtime, err := tc.selectRuntime(context.Background(), "tenant-runtime", "")
	require.Error(t, err)
	require.Nil(t, runtime)
	require.Contains(t, err.Error(), "no routable runtime")
	require.NotContains(t, err.Error(), "not-a-url")
	require.Equal(t, 0, queued.remainingQueries())
}

func receiptTestFieldString(receipt map[string]any, key string) string {
	value, ok := receipt[key]
	if !ok || value == nil {
		return ""
	}
	switch v := value.(type) {
	case string:
		return v
	case bool:
		return strconv.FormatBool(v)
	case float64:
		if v == math.Trunc(v) {
			return strconv.FormatInt(int64(v), 10)
		}
		return strconv.FormatFloat(v, 'f', -1, 64)
	case float32:
		if v == float32(math.Trunc(float64(v))) {
			return strconv.FormatInt(int64(v), 10)
		}
		return strconv.FormatFloat(float64(v), 'f', -1, 32)
	case int:
		return strconv.Itoa(v)
	case int64:
		return strconv.FormatInt(v, 10)
	case int32:
		return strconv.FormatInt(int64(v), 10)
	case uint64:
		return strconv.FormatUint(v, 10)
	case uint32:
		return strconv.FormatUint(uint64(v), 10)
	case uint:
		return strconv.FormatUint(uint64(v), 10)
	case json.Number:
		return v.String()
	default:
		return fmt.Sprintf("%v", v)
	}
}

func TestVerifyExecutionArtifactsForTaskUsesRuntimeRegistryKey(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	t.Setenv("IGRIS_RUNTIME_PUBLIC_KEY", strings.Repeat("00", ed25519.PublicKeySize))

	db, queued := newQueuedCheckpointDB(t, []queuedQueryExpectation{{
		values: []driver.Value{hex.EncodeToString(publicKey)},
	}})

	runtimeID := "runtime-proof-1"
	tc := &TaskCoordinator{db: db}
	task := &TaskRecord{RuntimeID: &runtimeID}

	envelope := signedArtifactJSON(t, privateKey, map[string]any{
		"execution_id":     "exec-proof-1",
		"tenant_id":        "tenant-proof",
		"routing_decision": "runtime:test",
		"request_hash":     "request-hash",
	})
	receipt := signedReceiptJSON(t, privateKey, map[string]any{
		"execution_id":       "exec-proof-1",
		"violation_occurred": false,
	})

	require.NoError(t, tc.verifyExecutionArtifactsForTask(context.Background(), task, envelope, receipt))
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestTaskGovernanceForLegacyRecordDerivesCapabilitiesWhenSigningIsAvailable(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	_ = publicKey
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY", hex.EncodeToString(privateKey))

	governance := taskGovernanceForRecord(&TaskRecord{
		TaskID:         uuid.New(),
		TenantID:       "tenant-legacy",
		TaskDefinition: json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[{"kind":"tool","node_id":"github-write","tool_name":"github.issues.write"}]}}`),
	})

	require.Equal(t, []string{"tools.github.issues.write"}, governance.RequiredCapabilities)
}

func TestGetRecoveringTasksHydratesPersistedPermissionEnvelope(t *testing.T) {
	_, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY", hex.EncodeToString(privateKey))

	taskID := uuid.New()
	tenantID := "tenant-envelope"
	runtimeID := "runtime-envelope"
	createdAt := time.Unix(1_900_400_000, 0).UTC()
	envelope := TaskPermissionEnvelope{
		SchemaVersion:        "task_permission_envelope.v1",
		EnvelopeID:           "env-recovery-1",
		TenantID:             tenantID,
		TaskID:               taskID.String(),
		RuntimeID:            &runtimeID,
		RequiredCapabilities: []string{"tools.github.issues.write"},
		AgentIdentity: AgentIdentity{
			AgentID:          "agent-envelope",
			PrincipalID:      "principal-envelope",
			SubmittedBy:      "principal-envelope",
			ActingOnBehalfOf: "principal-envelope",
		},
		IssuedAtUnixMs:  1_900_400_000_000,
		ExpiresAtUnixMs: 1_900_400_030_000,
	}
	envelopeBytes, err := json.Marshal(envelope)
	require.NoError(t, err)

	db, queued := newQueuedCheckpointDB(t, []queuedQueryExpectation{
		{
			columns: []string{
				"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
				"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
				"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
				"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
				"idempotency_key", "failure_reason", "failure_details",
				"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
			},
			rows: [][]driver.Value{taskRecordRowForRecoveryTest(
				taskID,
				tenantID,
				TaskStatusRecovering,
				runtimeID,
				"http://runtime-envelope",
				json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[{"kind":"tool","node_id":"github-write","tool_name":"github.issues.write"}]}}`),
				nil,
				"idempotency-envelope",
				createdAt,
			)},
		},
		{
			columns: []string{"permission_envelope"},
			values:  []driver.Value{envelopeBytes},
		},
	})

	store := NewCheckpointStore(db)
	tasks, err := store.GetRecoveringTasks()
	require.NoError(t, err)
	require.Len(t, tasks, 1)
	task, err := store.HydrateTaskPermissionEnvelope(tasks[0])
	require.NoError(t, err)
	require.NotNil(t, task.PermissionEnvelope)
	require.Equal(t, "env-recovery-1", task.PermissionEnvelope.EnvelopeID)
	require.Equal(t, []string{"tools.github.issues.write"}, task.RequiredCapabilities)
	require.Equal(t, "agent-envelope", task.AgentIdentity.AgentID)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestNormalizePublicTaskDefinitionSingleInference(t *testing.T) {
	t.Parallel()

	raw := json.RawMessage(`{
		"model": "gpt-4.1-mini",
		"messages": [{"role":"user","content":"hello"}]
	}`)

	normalized, err := normalizePublicTaskDefinition("single_inference", raw)
	require.NoError(t, err)

	var definition map[string]any
	require.NoError(t, json.Unmarshal(normalized, &definition))
	require.Equal(t, "single_inference", definition["type"])
	require.Equal(t, "gpt-4.1-mini", definition["model"])
}

func TestNormalizePublicTaskDefinitionRejectsUnknownTaskType(t *testing.T) {
	t.Parallel()

	_, err := normalizePublicTaskDefinition("unknown", json.RawMessage(`{"foo":"bar"}`))
	require.ErrorIs(t, err, ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "unsupported task_type")
}

func TestNormalizePublicTaskDefinitionRejectsInvalidAgentWorkflow(t *testing.T) {
	t.Parallel()

	raw := json.RawMessage(`{
		"steps": [
			{"step_index": 1, "messages": [{"role":"user","content":"hello"}]}
		]
	}`)

	_, err := normalizePublicTaskDefinition("agent_workflow", raw)
	require.ErrorIs(t, err, ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "agent_workflow.steps[0]: model is required")
}

func TestNormalizePublicTaskDefinitionAcceptsAgentWorkflowCheckpointAfterSteps(t *testing.T) {
	t.Parallel()

	normalized, err := normalizePublicTaskDefinition("agent_workflow", json.RawMessage(`{
		"checkpoint_after_steps": 1,
		"steps": [
			{"step_index": 0, "model": "mock-model", "messages": [{"role":"user","content":"hello"}]}
		]
	}`))
	require.NoError(t, err)

	var definition map[string]any
	require.NoError(t, json.Unmarshal(normalized, &definition))
	require.Equal(t, float64(1), definition["checkpoint_after_steps"])
}

func TestNormalizePublicTaskDefinitionRejectsInvalidAgentWorkflowCheckpointAfterSteps(t *testing.T) {
	t.Parallel()

	_, err := normalizePublicTaskDefinition("agent_workflow", json.RawMessage(`{
		"checkpoint_after_steps": 0,
		"steps": [
			{"step_index": 0, "model": "mock-model", "messages": [{"role":"user","content":"hello"}]}
		]
	}`))
	require.ErrorIs(t, err, ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "checkpoint_after_steps must be a positive integer")
}

func TestNormalizePublicTaskDefinitionAcceptsExecutionGraphCheckpointAfterSteps(t *testing.T) {
	t.Parallel()

	normalized, err := normalizePublicTaskDefinition("execution_graph", json.RawMessage(`{
		"checkpoint_after_steps": 2,
		"graph": {
			"nodes": [
				{"kind":"tool","node_id":"http_call-1","tool_name":"http_request"}
			]
		}
	}`))
	require.NoError(t, err)

	var definition map[string]any
	require.NoError(t, json.Unmarshal(normalized, &definition))
	require.Equal(t, float64(2), definition["checkpoint_after_steps"])
}

func TestNormalizePublicTaskDefinitionRejectsInvalidExecutionGraphCheckpointAfterSteps(t *testing.T) {
	t.Parallel()

	_, err := normalizePublicTaskDefinition("execution_graph", json.RawMessage(`{
		"checkpoint_after_steps": 0,
		"graph": {
			"nodes": [
				{"kind":"tool","node_id":"http_call-1","tool_name":"http_request"}
			]
		}
	}`))
	require.ErrorIs(t, err, ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "checkpoint_after_steps must be a positive integer")
}

func TestNormalizePublicTaskDefinitionRejectsStreamingSingleInference(t *testing.T) {
	t.Parallel()

	raw := json.RawMessage(`{
		"model": "gpt-4.1-mini",
		"messages": [{"role":"user","content":"hello"}],
		"stream": true
	}`)

	_, err := normalizePublicTaskDefinition("single_inference", raw)
	require.ErrorIs(t, err, ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "single_inference.stream=true is not supported on Overture durable tasks")
}

func TestHandleRecoverySkipMarksLegacyStreamingTaskFailed(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedExecDB(t, queuedExecExpectation{rowsAffected: 1})
	tc := &TaskCoordinator{store: NewCheckpointStore(db)}
	taskID := uuid.New()

	tc.handleRecoverySkip(taskID, &TaskRecord{
		Status:         TaskStatusRecovering,
		TaskDefinition: json.RawMessage(`{"type":"single_inference","model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}],"stream":true}`),
	}, "streaming_resume_unsupported")

	require.Equal(t, 0, queued.remainingExecs())
}

func TestHandleRecoverySkipDoesNotMarkNonRecoveringTaskFailed(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedCheckpointDB(t, []queuedQueryExpectation{{values: []driver.Value{nil}}})
	tc := &TaskCoordinator{store: NewCheckpointStore(db)}

	tc.handleRecoverySkip(uuid.New(), &TaskRecord{
		Status:         TaskStatusFailed,
		TaskDefinition: json.RawMessage(`{"type":"single_inference","model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}],"stream":true}`),
	}, "streaming_resume_unsupported")

	require.Equal(t, 0, queued.remainingExecs())
}

func TestRuntimeFailedRecoveryDecisionBlocksIrreversibleReplay(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	runtimeID := "runtime-failed-live"
	task := &TaskRecord{
		TaskID:    taskID,
		TenantID:  "tenant-live-recovery",
		Status:    TaskStatusDispatched,
		RuntimeID: &runtimeID,
		TaskDefinition: json.RawMessage(`{
			"type":"execution_graph",
			"graph":{"nodes":[
				{"kind":"tool","tool_name":"filesystem","node_id":"read_file-0"},
				{"kind":"tool","tool_name":"database_write","node_id":"db_write-1"}
			]},
			"local_demo_failure":{"after_steps":1,"reason":"safe demo failure"}
		}`),
	}

	// No checkpoint is attached, so recovery cannot prove the irreversible
	// database_write is still pending — it must be denied.
	decision, gotRuntimeID, allowed, reason, shouldRecord := runtimeFailedRecoveryDecision(task, runtimeID)
	require.True(t, shouldRecord)
	require.Equal(t, runtimeID, gotRuntimeID)
	require.Equal(t, ActionDecisionDenied, decision.Decision)
	require.Equal(t, ReplayClassNonRetryable, decision.ReplayClass)
	require.True(t, decision.Irreversible)
	require.False(t, allowed)
	require.Equal(t, "irreversible action already committed or checkpoint cannot prove safe forward-resume", reason)
}

func TestRuntimeFailedRecoveryDecisionAllowsForwardResumeBeforeIrreversibleStep(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	runtimeID := "runtime-failed-fwd"
	targetRuntimeID := "runtime-clean-host"
	// read_file(0) -> http_call(1) -> read_file(2) -> http_call(3) -> db_write(4).
	// The checkpoint committed through step 1, so the irreversible db_write at
	// step 4 has not executed and forward-resume onto a clean host is safe.
	task := &TaskRecord{
		TaskID:    taskID,
		TenantID:  "tenant-fwd-recovery",
		Status:    TaskStatusDispatched,
		RuntimeID: &runtimeID,
		TaskDefinition: json.RawMessage(`{
			"type":"execution_graph",
			"graph":{"nodes":[
				{"kind":"tool","tool_name":"filesystem","node_id":"read_file-0"},
				{"kind":"tool","tool_name":"http_request","node_id":"http_call-1"},
				{"kind":"tool","tool_name":"filesystem","node_id":"read_file-2"},
				{"kind":"tool","tool_name":"http_request","node_id":"http_call-3"},
				{"kind":"tool","tool_name":"database_write","node_id":"db_write-4"}
			]}
		}`),
		LastCheckpoint: &CheckpointPayload{
			TaskID: taskID,
			ResumeToken: ResumeToken{
				LastCommittedStep: 1,
				CheckpointDigest:  "abc",
				RuntimeID:         runtimeID,
			},
			WalEntries: []WalEntry{
				{EntryID: uuid.New(), TaskID: taskID, StepIndex: 0, Status: "committed", InputDigest: "a", RuntimeID: runtimeID},
				{EntryID: uuid.New(), TaskID: taskID, StepIndex: 1, Status: "committed", InputDigest: "b", RuntimeID: runtimeID},
			},
		},
	}

	decision, _, allowed, reason, shouldRecord := runtimeFailedRecoveryDecision(task, runtimeID)
	require.True(t, shouldRecord)
	require.Equal(t, ActionDecisionAllowed, decision.Decision)
	require.True(t, decision.Irreversible, "task still contains an irreversible action")
	require.Equal(t, CheckpointPortabilityCompatibleRuntime, decision.CheckpointPortability)
	require.True(t, allowed, "forward-resume before the irreversible step must be allowed: %s", reason)

	// Handing off to a different (clean-host) runtime is permitted precisely
	// because the irreversible step is still pending.
	handoffAllowed, handoffReason := RecoveryHandoffAllowed(task, task.LastCheckpoint, targetRuntimeID, decision)
	require.True(t, handoffAllowed, "cross-runtime handoff should be allowed for pending irreversible work: %s", handoffReason)

	// If the db_write had already committed (watermark past step 4), the same
	// task must be denied so a committed side effect is never replayed.
	task.LastCheckpoint.ResumeToken.LastCommittedStep = 4
	task.LastCheckpoint.WalEntries = append(task.LastCheckpoint.WalEntries,
		WalEntry{EntryID: uuid.New(), TaskID: taskID, StepIndex: 2, Status: "committed", InputDigest: "c", RuntimeID: runtimeID},
		WalEntry{EntryID: uuid.New(), TaskID: taskID, StepIndex: 3, Status: "committed", InputDigest: "d", RuntimeID: runtimeID},
		WalEntry{EntryID: uuid.New(), TaskID: taskID, StepIndex: 4, Status: "committed", InputDigest: "e", RuntimeID: runtimeID},
	)
	committedDecision, _, committedAllowed, _, _ := runtimeFailedRecoveryDecision(task, runtimeID)
	require.Equal(t, ActionDecisionDenied, committedDecision.Decision)
	require.False(t, committedAllowed, "committed irreversible step must never be replayed on another runtime")
}

func TestSelectRecoveryCheckpoint(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	older := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 3,
			CheckpointDigest:  "digest-3",
			RuntimeID:         "runtime-a",
		},
	}
	newer := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 5,
			CheckpointDigest:  "digest-5",
			RuntimeID:         "runtime-b",
		},
	}

	tests := []struct {
		name      string
		primary   *CheckpointPayload
		secondary *CheckpointPayload
		want      *CheckpointPayload
	}{
		{
			name:      "prefers secondary when it advances",
			primary:   older,
			secondary: newer,
			want:      newer,
		},
		{
			name:      "keeps primary when secondary is stale",
			primary:   newer,
			secondary: older,
			want:      newer,
		},
		{
			name:      "falls back to secondary when primary missing",
			primary:   nil,
			secondary: newer,
			want:      newer,
		},
		{
			name:      "keeps primary when secondary missing",
			primary:   newer,
			secondary: nil,
			want:      newer,
		},
		{
			name:      "returns nil when both missing",
			primary:   nil,
			secondary: nil,
			want:      nil,
		},
	}

	for _, test := range tests {
		test := test
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			require.Equal(t, test.want, selectRecoveryCheckpoint(test.primary, test.secondary))
		})
	}
}

func TestNormalizePublicTaskDefinitionValidatesRoboticsWorkflow(t *testing.T) {
	t.Parallel()

	raw := json.RawMessage(`{
		"steps": [
			{
				"step_index": 1,
				"action": "publish_velocity",
				"linear_x": 0.25,
				"angular_z": -0.10
			},
			{
				"step_index": 2,
				"action": "navigate_to_pose",
				"goal": {"x": 1.0, "y": 2.0, "frame_id": "map"}
			}
		]
	}`)

	normalized, err := normalizePublicTaskDefinition("robotics_workflow", raw)
	require.NoError(t, err)

	var definition map[string]any
	require.NoError(t, json.Unmarshal(normalized, &definition))
	require.Equal(t, "robotics_workflow", definition["type"])
}

func TestNormalizePublicTaskDefinitionValidatesExecutionGraph(t *testing.T) {
	t.Parallel()

	raw := json.RawMessage(`{
		"graph": {
			"graph_id": "agent-graph",
			"nodes": [
				{
					"kind": "reason",
					"node_id": "reason-0",
					"model": "gpt-4.1-mini",
					"messages": [{"role":"user","content":"hello"}]
				},
				{
					"kind": "robotics",
					"node_id": "robotics-1",
					"action": "publish_zero_velocity"
				}
			]
		}
	}`)

	normalized, err := normalizePublicTaskDefinition("execution_graph", raw)
	require.NoError(t, err)

	var definition map[string]any
	require.NoError(t, json.Unmarshal(normalized, &definition))
	require.Equal(t, "execution_graph", definition["type"])
}

func TestNormalizePublicTaskDefinitionRejectsInvalidExecutionGraph(t *testing.T) {
	t.Parallel()

	raw := json.RawMessage(`{
		"graph": {
			"nodes": [
				{
					"kind": "reason",
					"node_id": "reason-0"
				}
			]
		}
	}`)

	_, err := normalizePublicTaskDefinition("execution_graph", raw)
	require.ErrorIs(t, err, ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "execution_graph.graph.nodes[0]: model is required")
}

func TestNormalizePublicTaskDefinitionAcceptsToolExecutionGraphNode(t *testing.T) {
	t.Parallel()

	raw := json.RawMessage(`{
		"graph": {
			"nodes": [
				{
					"kind": "tool",
					"node_id": "tool-0",
					"tool_name": "web.search"
				}
			]
		}
	}`)

	normalized, err := normalizePublicTaskDefinition("execution_graph", raw)
	require.NoError(t, err)

	var definition map[string]any
	require.NoError(t, json.Unmarshal(normalized, &definition))
	require.Equal(t, "execution_graph", definition["type"])
}

func TestSanitizeTaskDefinitionForPersistenceRedactsExecutionInputs(t *testing.T) {
	t.Parallel()

	const marker = "IGRIS_SHOULD_NEVER_PERSIST_INPUT_SECRET"
	raw := json.RawMessage(`{
		"type":"execution_graph",
		"graph":{
			"nodes":[{
				"kind":"tool",
				"node_id":"unsafe-http",
				"tool_name":"http_request",
				"args":{
					"method":"POST",
					"url":"https://api.internal.example/write?token=` + marker + `",
					"body":"` + marker + `",
					"headers":{
						"Authorization":"Bearer ` + marker + `",
						"Cookie":"session=` + marker + `",
						"Content-Type":"application/json"
					}
				}
			}]
		}
	}`)

	sanitized := sanitizeTaskDefinitionForPersistence(raw)
	body := string(sanitized)
	require.NotContains(t, body, marker)
	require.NotContains(t, body, "Bearer")
	require.NotContains(t, body, "session=")
	require.NotContains(t, body, "?token=")
	require.Contains(t, body, "input_redacted")
	require.Contains(t, body, "input_digest_sha256")
	require.Contains(t, body, "input_bytes")
	require.Contains(t, body, inputRedactionPolicyVersion)
	require.Contains(t, body, "Content-Type")
}

func TestSanitizeTaskDefinitionForPersistenceRedactsPrivatePathsAndContent(t *testing.T) {
	t.Parallel()

	const marker = "IGRIS_SHOULD_NEVER_PERSIST_INPUT_SECRET"
	raw := json.RawMessage(`{
		"type":"execution_graph",
		"graph":{
			"nodes":[{
				"kind":"tool",
				"node_id":"unsafe-file",
				"tool_name":"filesystem",
				"args":{
					"operation":"read",
					"path":"/Users/customer/private/` + marker + `.txt",
					"content":"` + marker + `"
				}
			},{
				"kind":"reason",
				"node_id":"unsafe-prompt",
				"model":"gpt-4.1-mini",
				"messages":[{"role":"user","content":"` + marker + `"}]
			}]
		}
	}`)

	sanitized := sanitizeTaskDefinitionForPersistence(raw)
	body := string(sanitized)
	require.NotContains(t, body, marker)
	require.NotContains(t, body, "/Users/customer/private")
	require.Contains(t, body, "safe_path_digest")
	require.Contains(t, body, "input_redacted")
	require.Contains(t, body, "input_digest_sha256")
}

func TestProtectTaskDefinitionInputsCreatesEncryptedRefsWithoutPlaintext(t *testing.T) {
	const marker = "IGRIS_ENCRYPTED_INPUT_SECRET_MARKER"
	t.Setenv(executionInputRefKeyEnv, base64.StdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef")))
	t.Setenv(executionInputRefKeyVersionEnv, "test:v1")

	taskID := uuid.New()
	protected, err := protectTaskDefinitionInputs(json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{
			"kind":"tool",
			"node_id":"unsafe-http",
			"tool_name":"http_request",
			"args":{
				"method":"POST",
				"url":"https://api.example.test/hook?token=`+marker+`",
				"body":"`+marker+`",
				"headers":{"Authorization":"Bearer `+marker+`","Content-Type":"application/json"}
			}
		}]}
	}`), "tenant-input-ref", taskID)
	require.NoError(t, err)
	require.NotEmpty(t, protected.Refs)

	persisted := string(protected.Definition)
	require.NotContains(t, persisted, marker)
	require.NotContains(t, persisted, "Bearer")
	require.NotContains(t, persisted, "?token=")
	require.Contains(t, persisted, "encrypted_input_ref_id")
	require.Contains(t, persisted, inputReferenceRedactionPolicyVersion)
	for _, ref := range protected.Refs {
		require.NotContains(t, string(ref.Ciphertext), marker)
		require.Equal(t, "tenant-input-ref", ref.TenantID)
		require.Equal(t, taskID, ref.TaskID)
		require.NotEmpty(t, ref.KeyVersion)
		require.NotEmpty(t, ref.DigestSHA256)
		require.Positive(t, ref.PlaintextBytes)
	}
}

func TestEncryptedInputRefDecryptRequiresCorrectScopeAndTamperFails(t *testing.T) {
	const marker = "IGRIS_ENCRYPTED_INPUT_SECRET_MARKER"
	key := base64.StdEncoding.EncodeToString([]byte("abcdef0123456789abcdef0123456789"))
	cipherSvc, err := newExecutionInputCipher(key, "test:v2")
	require.NoError(t, err)
	tenantID := "tenant-a"
	taskID := uuid.New()
	refID := uuid.New()
	purpose := "execution_payload"
	aad, err := executionInputAssociatedData(tenantID, taskID, refID, purpose, cipherSvc.keyVersion)
	require.NoError(t, err)
	ciphertext, nonce, err := cipherSvc.encrypt([]byte(marker), aad)
	require.NoError(t, err)

	plaintext, err := cipherSvc.decrypt(ciphertext, nonce, aad)
	require.NoError(t, err)
	require.Equal(t, marker, string(plaintext))

	wrongTenantAAD, err := executionInputAssociatedData("tenant-b", taskID, refID, purpose, cipherSvc.keyVersion)
	require.NoError(t, err)
	_, err = cipherSvc.decrypt(ciphertext, nonce, wrongTenantAAD)
	require.ErrorIs(t, err, ErrExecutionInputRefDecrypt)

	wrongTaskAAD, err := executionInputAssociatedData(tenantID, uuid.New(), refID, purpose, cipherSvc.keyVersion)
	require.NoError(t, err)
	_, err = cipherSvc.decrypt(ciphertext, nonce, wrongTaskAAD)
	require.ErrorIs(t, err, ErrExecutionInputRefDecrypt)

	wrongPurposeAAD, err := executionInputAssociatedData(tenantID, taskID, refID, "private_path", cipherSvc.keyVersion)
	require.NoError(t, err)
	_, err = cipherSvc.decrypt(ciphertext, nonce, wrongPurposeAAD)
	require.ErrorIs(t, err, ErrExecutionInputRefDecrypt)

	tampered := append([]byte(nil), ciphertext...)
	tampered[0] ^= 0xff
	_, err = cipherSvc.decrypt(tampered, nonce, aad)
	require.ErrorIs(t, err, ErrExecutionInputRefDecrypt)
}

func TestProtectTaskDefinitionInputsFailsClosedWhenKeyMissing(t *testing.T) {
	t.Setenv(executionInputRefKeyEnv, "")

	_, err := protectTaskDefinitionInputs(json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{"kind":"tool","node_id":"http","tool_name":"http_request","args":{"body":"secret"}}]}
	}`), "tenant-input-ref", uuid.New())
	require.ErrorIs(t, err, ErrExecutionInputRefKeyMissing)
}

func TestRecoveryRehydratesEncryptedInputRefsOnlyThroughResolver(t *testing.T) {
	const marker = "IGRIS_ENCRYPTED_INPUT_SECRET_MARKER"
	t.Setenv(executionInputRefKeyEnv, base64.StdEncoding.EncodeToString([]byte("22222222222222222222222222222222")))
	t.Setenv(executionInputRefKeyVersionEnv, "test:recovery")

	tenantID := "tenant-recovery"
	taskID := uuid.New()
	protected, err := protectTaskDefinitionInputs(json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{"kind":"tool","node_id":"unsafe-file","tool_name":"filesystem","args":{"path":"/private/`+marker+`.txt"}}]}
	}`), tenantID, taskID)
	require.NoError(t, err)
	require.NotContains(t, string(protected.Definition), marker)

	refs := map[uuid.UUID]ExecutionInputRef{}
	for _, ref := range protected.Refs {
		refs[ref.ID] = ref
	}
	cipherSvc, err := newExecutionInputCipherFromEnv()
	require.NoError(t, err)
	rehydrated, err := rehydrateTaskDefinitionInputRefs(protected.Definition, tenantID, taskID, func(refID uuid.UUID, purpose string) ([]byte, error) {
		ref, ok := refs[refID]
		require.True(t, ok)
		require.Equal(t, purpose, ref.Purpose)
		return cipherSvc.decrypt(ref.Ciphertext, ref.Nonce, ref.AAD)
	})
	require.NoError(t, err)
	require.Contains(t, string(rehydrated), marker)
	require.Contains(t, string(rehydrated), "/private/")
}

func TestNormalizePublicTaskDefinitionRejectsInvalidExecutionGraphSlotFields(t *testing.T) {
	t.Parallel()

	raw := json.RawMessage(`{
		"graph": {
			"nodes": [
				{
					"kind": "tool",
					"node_id": "tool-0",
					"tool_name": "web.search",
					"write_slot": "",
					"read_slots": ["reason.plan"]
				}
			]
		}
	}`)

	_, err := normalizePublicTaskDefinition("execution_graph", raw)
	require.ErrorIs(t, err, ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), `execution_graph.graph.nodes[0]: write_slot must be a non-empty string`)
}

func TestNormalizePublicTaskDefinitionRejectsUnsupportedRoboticsAction(t *testing.T) {
	t.Parallel()

	raw := json.RawMessage(`{
		"steps": [
			{"step_index": 1, "action": "fire_lasers"}
		]
	}`)

	_, err := normalizePublicTaskDefinition("robotics_workflow", raw)
	require.ErrorIs(t, err, ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), `unsupported robotics action "fire_lasers"`)
}

func TestNormalizePublicTaskDefinitionRequiresBehaviorTreeDefinition(t *testing.T) {
	t.Parallel()

	_, err := normalizePublicTaskDefinition("behavior_tree", json.RawMessage(`{"max_ticks": 10}`))
	require.ErrorIs(t, err, ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "behavior_tree.tree is required")
}

func TestDispatchToRuntimeIncludesRecoveryResumePayload(t *testing.T) {
	taskID := uuid.New()
	runtimeID := "runtime-recovery-1"
	tenantID := "tenant-recovery"
	idempotencyKey := "idem-recovery"
	deadlineAt := time.Unix(1_900_000_000, 0).UTC()
	var gotBody map[string]any
	var gotTenantHeader string
	var gotAuthHeader string

	t.Setenv("IGRIS_RUNTIME_SECRET", "runtime-secret-test")
	t.Setenv("IGRIS_RUNTIME_CALLBACK_BASE_URL", "http://overture.test")
	t.Setenv("IGRIS_RUNTIME_CALLBACK_AUTH_HEADER_NAME", "Cookie")
	t.Setenv("IGRIS_RUNTIME_CALLBACK_AUTH_HEADER_VALUE", "better-auth.session_token=redacted")

	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/v1/runtime/task/submit", r.URL.Path)
		gotTenantHeader = r.Header.Get("X-Igris-Tenant")
		gotAuthHeader = r.Header.Get("Authorization")

		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(body, &gotBody))

		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{}`)),
		}, nil
	})}

	task := &TaskRecord{
		TaskID:          taskID,
		TenantID:        tenantID,
		RuntimeID:       &runtimeID,
		RuntimeEndpoint: ptrString("http://runtime.test"),
		TaskDefinition: json.RawMessage(`{
			"type":"behavior_tree",
			"tree":{"root":{"type":"sequence","children":[]}}
		}`),
		IdempotencyKey: idempotencyKey,
		DeadlineAt:     &deadlineAt,
	}
	checkpoint := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 7,
			CheckpointDigest:  "digest-7",
			RuntimeID:         runtimeID,
		},
		WalEntries: []WalEntry{
			{EntryID: uuid.New(), TaskID: taskID, StepIndex: 6, RuntimeID: runtimeID},
			{EntryID: uuid.New(), TaskID: taskID, StepIndex: 7, RuntimeID: runtimeID},
		},
		Metadata: json.RawMessage(`{
			"blackboard_state":{"goal":"dock","phase":"approach"},
			"tick_count": 42
		}`),
		CapturedAt: time.Unix(1_900_000_010, 0).UTC(),
	}

	tc := &TaskCoordinator{httpClient: client}
	tc.dispatchToRuntime(context.Background(), task, checkpoint)

	require.Equal(t, tenantID, gotTenantHeader)
	require.Equal(t, "Bearer runtime-secret-test", gotAuthHeader)
	require.Equal(t, taskID.String(), gotBody["task_id"])
	require.Equal(t, tenantID, gotBody["tenant_id"])
	require.Equal(t, "idem-recovery:resume:7:digest-7", gotBody["idempotency_key"])
	require.Equal(t, "http://overture.test", gotBody["callback_base_url"])
	callbackAuth, ok := gotBody["callback_auth"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "Cookie", callbackAuth["header_name"])
	require.Equal(t, "better-auth.session_token=redacted", callbackAuth["header_value"])
	deadlineBudget, ok := gotBody["deadline_ms"].(float64)
	require.True(t, ok)
	require.Greater(t, deadlineBudget, float64(0))
	require.LessOrEqual(t, deadlineBudget, float64(time.Until(deadlineAt).Milliseconds()+1000))

	taskType, ok := gotBody["task_type"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "behavior_tree", taskType["type"])

	resumeFrom, ok := gotBody["resume_from"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(7), resumeFrom["last_committed_step"])
	require.Equal(t, "digest-7", resumeFrom["checkpoint_digest"])
	require.Equal(t, runtimeID, resumeFrom["runtime_id"])

	resumeCheckpoint, ok := gotBody["resume_checkpoint"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, taskID.String(), resumeCheckpoint["task_id"])
	embeddedResume, ok := resumeCheckpoint["resume_token"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(7), embeddedResume["last_committed_step"])
	require.Equal(t, "digest-7", embeddedResume["checkpoint_digest"])
	metadata, ok := resumeCheckpoint["metadata"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, float64(42), metadata["tick_count"])
	blackboard, ok := metadata["blackboard_state"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "dock", blackboard["goal"])
}

func TestRuntimeDeadlineBudgetMsOmitsExpiredDeadlineOnRecovery(t *testing.T) {
	t.Parallel()

	now := time.Unix(1_900_000_000, 0).UTC()
	expired := now.Add(-time.Second)
	future := now.Add(30 * time.Second)
	checkpoint := &CheckpointPayload{ResumeToken: ResumeToken{LastCommittedStep: 1}}

	require.Nil(t, runtimeDeadlineBudgetMs(nil, checkpoint, now))
	require.Nil(t, runtimeDeadlineBudgetMs(&expired, checkpoint, now))

	initialExpired := runtimeDeadlineBudgetMs(&expired, nil, now)
	require.NotNil(t, initialExpired)
	require.Equal(t, uint64(1), *initialExpired)

	recoveryFuture := runtimeDeadlineBudgetMs(&future, checkpoint, now)
	require.NotNil(t, recoveryFuture)
	require.Equal(t, uint64(30_000), *recoveryFuture)
}

func TestRuntimeDispatchIdempotencyKeyDerivesRecoveryKeyFromCheckpoint(t *testing.T) {
	t.Parallel()

	task := &TaskRecord{IdempotencyKey: "idem-original"}
	checkpoint := &CheckpointPayload{ResumeToken: ResumeToken{
		LastCommittedStep: 4,
		CheckpointDigest:  "0123456789abcdef999999",
	}}

	require.Equal(t, "idem-original", runtimeDispatchIdempotencyKey(task, nil))
	require.Equal(t, "idem-original:resume:4:0123456789abcdef", runtimeDispatchIdempotencyKey(task, checkpoint))
}

func TestDispatchToRuntimeIncludesRoboticsTaskDefinitionWithoutResumeFields(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	runtimeID := "runtime-robotics-1"
	tenantID := "tenant-robotics"
	idempotencyKey := "idem-robotics"
	var gotBody map[string]any

	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(body, &gotBody))

		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{}`)),
		}, nil
	})}

	tc := &TaskCoordinator{httpClient: client}
	tc.dispatchToRuntime(context.Background(), &TaskRecord{
		TaskID:          taskID,
		TenantID:        tenantID,
		RuntimeID:       &runtimeID,
		RuntimeEndpoint: ptrString("http://runtime.test"),
		TaskDefinition: json.RawMessage(`{
			"type":"robotics_workflow",
			"steps":[
				{"step_index":1,"action":"publish_velocity","linear_x":0.25,"angular_z":-0.10},
				{"step_index":2,"action":"navigate_to_pose","goal":{"x":1.0,"y":2.0,"frame_id":"map"}}
			]
		}`),
		IdempotencyKey: idempotencyKey,
	}, nil)

	require.Equal(t, taskID.String(), gotBody["task_id"])
	require.Equal(t, tenantID, gotBody["tenant_id"])
	require.Equal(t, idempotencyKey, gotBody["idempotency_key"])

	taskType, ok := gotBody["task_type"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "robotics_workflow", taskType["type"])
	steps, ok := taskType["steps"].([]any)
	require.True(t, ok)
	require.Len(t, steps, 2)
	require.NotContains(t, gotBody, "resume_from")
	require.NotContains(t, gotBody, "resume_checkpoint")
	require.NotContains(t, gotBody, "deadline_ms")
}

func TestDispatchToRuntimeForwardsAgentWorkflowCheckpointAfterSteps(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	runtimeID := "runtime-agent-checkpoint"
	tenantID := "tenant-agent-checkpoint"
	var gotBody map[string]any

	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(body, &gotBody))

		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{}`)),
		}, nil
	})}

	tc := &TaskCoordinator{httpClient: client}
	tc.dispatchToRuntime(context.Background(), &TaskRecord{
		TaskID:          taskID,
		TenantID:        tenantID,
		RuntimeID:       &runtimeID,
		RuntimeEndpoint: ptrString("http://runtime.test"),
		TaskDefinition: json.RawMessage(`{
			"type":"agent_workflow",
			"checkpoint_after_steps":1,
			"steps":[
				{"step_index":0,"model":"mock-model","messages":[{"role":"user","content":"step 0"}]},
				{"step_index":1,"model":"mock-model","messages":[{"role":"user","content":"step 1"}]}
			]
		}`),
		IdempotencyKey: "idem-agent-checkpoint",
	}, nil)

	taskType, ok := gotBody["task_type"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "agent_workflow", taskType["type"])
	require.Equal(t, float64(1), taskType["checkpoint_after_steps"])
	require.NotContains(t, gotBody, "deadline_ms")
}

func TestDispatchToRuntimeAttachesSignedRoboticsPolicyDecisions(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY", hex.EncodeToString(privateKey))
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY_VERSION", "test-key")

	taskID := uuid.New()
	runtimeID := "runtime-robotics-signed"
	tenantID := "tenant-robotics"
	var gotBody struct {
		SignedPolicyDecisions []signedGovernedPolicyDecision `json:"signed_policy_decisions"`
		Containment           map[string]any                 `json:"containment"`
	}
	var gotDecisionSig string
	expiresAt := time.Now().Add(time.Minute).UTC()
	db, queued := newQueuedCheckpointDB(t, []queuedQueryExpectation{
		{
			values: []driver.Value{`{
				"policy_version":"capabilities-policy.test",
				"allowed_capabilities":["robotics.execute"]
			}`},
		},
		{
			columns: []string{
				"policy_version",
				"permit",
				"runtime_permitted",
				"robot_mode",
				"allowed_runtimes",
				"expires_at",
			},
			values: []driver.Value{
				"robotics-policy.test",
				true,
				true,
				"supervised",
				fmt.Sprintf(`["%s"]`, runtimeID),
				expiresAt,
			},
		},
	},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 1},
	)

	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		gotDecisionSig = r.Header.Get("X-Igris-Decision-Sig")
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(body, &gotBody))

		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{}`)),
		}, nil
	})}

	tc := &TaskCoordinator{httpClient: client, db: db}
	tc.dispatchToRuntime(context.Background(), &TaskRecord{
		TaskID:          taskID,
		TenantID:        tenantID,
		RuntimeID:       &runtimeID,
		RuntimeEndpoint: ptrString("http://runtime.test"),
		TaskDefinition: json.RawMessage(`{
			"type":"robotics_workflow",
			"steps":[
				{"step_index":0,"action":"publish_zero_velocity"},
				{"step_index":1,"action":"publish_velocity","linear_x":0.25,"angular_z":-0.10}
			]
		}`),
		IdempotencyKey: "idem-signed-robotics",
	}, nil)

	require.NotEmpty(t, gotDecisionSig)
	require.Len(t, gotBody.SignedPolicyDecisions, 2)
	require.Equal(t, float64(30000), gotBody.Containment["max_tick_ms"])

	decision := gotBody.SignedPolicyDecisions[0]
	require.True(t, decision.Permit)
	require.Equal(t, "governed_policy_decision.v1", decision.SchemaVersion)
	require.Equal(t, "governed_action.v1", decision.Action.SchemaVersion)
	require.Equal(t, "robotics", decision.Action.Domain)
	require.Equal(t, "ros2_action", decision.Action.ActionType)
	require.Equal(t, "publish_zero_velocity", decision.Action.ActionName)
	require.Equal(t, "robotics-step-0", decision.Action.NodeID)
	require.Equal(t, "test-key", *decision.SignerKeyVersion)

	canonical, err := json.Marshal(canonicalGovernedPolicyDecision(decision))
	require.NoError(t, err)
	sum := sha256.Sum256(canonical)
	signature, err := base64.StdEncoding.DecodeString(decision.Signature)
	require.NoError(t, err)
	require.True(t, ed25519.Verify(publicKey, sum[:], signature))
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestDispatchToRuntimeAttachesSignedTaskPermissionEnvelope(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY", hex.EncodeToString(privateKey))
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY_VERSION", "capability-key")

	taskID := uuid.New()
	runtimeID := "runtime-ai-signed"
	tenantID := "tenant-ai"
	var gotBody struct {
		AgentIdentity        AgentIdentity          `json:"agent_identity"`
		RequiredCapabilities []string               `json:"required_capabilities"`
		PermissionEnvelope   TaskPermissionEnvelope `json:"permission_envelope"`
		CredentialRefs       []CredentialReference  `json:"credential_refs"`
	}
	db, queued := newQueuedCheckpointDB(t, []queuedQueryExpectation{{
		values: []driver.Value{`{
			"policy_version":"capabilities-policy.test",
			"allowed_capabilities":["tools.github.issues.write"]
		}`},
	}},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 1},
	)

	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(body, &gotBody))
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{}`)),
		}, nil
	})}

	tc := &TaskCoordinator{httpClient: client, db: db}
	tc.dispatchToRuntime(context.Background(), &TaskRecord{
		TaskID:          taskID,
		TenantID:        tenantID,
		RuntimeID:       &runtimeID,
		RuntimeEndpoint: ptrString("http://runtime.test"),
		TaskDefinition: json.RawMessage(`{
			"type":"execution_graph",
			"graph":{"nodes":[{"kind":"tool","node_id":"github-write","tool_name":"github.issues.write"}]}
		}`),
		AgentIdentity: AgentIdentity{
			AgentID:          "agent-researcher",
			PrincipalID:      "user-123",
			SubmittedBy:      "user-123",
			ActingOnBehalfOf: "user-123",
			DelegationChain:  []string{"user-123", "agent-researcher"},
		},
		RequiredCapabilities: []string{"tools.github.issues.write"},
		CredentialRequests: []CredentialRequest{{
			Tool:       "github.issues.write",
			Capability: "tools.github.issues.write",
			Scope:      "task",
		}},
		IdempotencyKey: "idem-ai-signed",
	}, nil)

	require.Equal(t, "agent-researcher", gotBody.AgentIdentity.AgentID)
	require.Equal(t, []string{"tools.github.issues.write"}, gotBody.RequiredCapabilities)
	require.Equal(t, "task_permission_envelope.v1", gotBody.PermissionEnvelope.SchemaVersion)
	require.Equal(t, taskID.String(), gotBody.PermissionEnvelope.TaskID)
	require.Equal(t, tenantID, gotBody.PermissionEnvelope.TenantID)
	require.Equal(t, runtimeID, *gotBody.PermissionEnvelope.RuntimeID)
	require.Len(t, gotBody.PermissionEnvelope.Decisions, 1)
	require.True(t, gotBody.PermissionEnvelope.Decisions[0].Permit)
	require.Len(t, gotBody.CredentialRefs, 1)
	require.True(t, gotBody.CredentialRefs[0].Revocable)

	canonical, err := json.Marshal(canonicalTaskPermissionEnvelope(gotBody.PermissionEnvelope))
	require.NoError(t, err)
	sum := sha256.Sum256(canonical)
	signature, err := base64.StdEncoding.DecodeString(gotBody.PermissionEnvelope.Signature)
	require.NoError(t, err)
	require.True(t, ed25519.Verify(publicKey, sum[:], signature))
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestDispatchToRuntimeRecoveryRegeneratesPermissionEnvelopeForReplacementRuntime(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY", hex.EncodeToString(privateKey))
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY_VERSION", "capability-key")

	taskID := uuid.New()
	runtimeID := "runtime-ai-replacement"
	tenantID := "tenant-ai-recovery"
	var gotBody struct {
		ResumeFrom           ResumeToken            `json:"resume_from"`
		PermissionEnvelope   TaskPermissionEnvelope `json:"permission_envelope"`
		RequiredCapabilities []string               `json:"required_capabilities"`
	}
	db, queued := newQueuedCheckpointDB(t, []queuedQueryExpectation{{
		values: []driver.Value{`{
			"policy_version":"capabilities-policy.test",
			"allowed_capabilities":["tools.github.issues.write"]
		}`},
	}},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 1},
	)

	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(body, &gotBody))
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{}`)),
		}, nil
	})}

	checkpoint := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 1,
			CheckpointDigest:  "digest-1",
			RuntimeID:         "runtime-ai-failed",
		},
		WalEntries: []WalEntry{{EntryID: uuid.New(), TaskID: taskID, StepIndex: 1, RuntimeID: "runtime-ai-failed"}},
	}
	tc := &TaskCoordinator{httpClient: client, db: db}
	tc.dispatchToRuntime(context.Background(), &TaskRecord{
		TaskID:          taskID,
		TenantID:        tenantID,
		RuntimeID:       &runtimeID,
		RuntimeEndpoint: ptrString("http://runtime.test"),
		TaskDefinition: json.RawMessage(`{
			"type":"execution_graph",
			"graph":{"nodes":[{"kind":"tool","node_id":"github-write","tool_name":"github.issues.write"}]}
		}`),
		AgentIdentity: AgentIdentity{
			AgentID:          "agent-researcher",
			PrincipalID:      "user-123",
			SubmittedBy:      "user-123",
			ActingOnBehalfOf: "user-123",
			DelegationChain:  []string{"user-123", "agent-researcher"},
		},
		RequiredCapabilities: []string{"tools.github.issues.write"},
		IdempotencyKey:       "idem-ai-recovery",
	}, checkpoint)

	require.Equal(t, uint32(1), gotBody.ResumeFrom.LastCommittedStep)
	require.Equal(t, []string{"tools.github.issues.write"}, gotBody.RequiredCapabilities)
	require.Equal(t, runtimeID, *gotBody.PermissionEnvelope.RuntimeID)
	require.Equal(t, taskID.String(), gotBody.PermissionEnvelope.TaskID)
	canonical, err := json.Marshal(canonicalTaskPermissionEnvelope(gotBody.PermissionEnvelope))
	require.NoError(t, err)
	sum := sha256.Sum256(canonical)
	signature, err := base64.StdEncoding.DecodeString(gotBody.PermissionEnvelope.Signature)
	require.NoError(t, err)
	require.True(t, ed25519.Verify(publicKey, sum[:], signature))
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestDispatchToRuntimeDeniesCapabilityPolicyBeforeHTTP(t *testing.T) {
	_, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY", hex.EncodeToString(privateKey))

	taskID := uuid.New()
	runtimeID := "runtime-ai-denied"
	db, queued := newQueuedCheckpointDB(t, []queuedQueryExpectation{{
		values: []driver.Value{`{
			"policy_version":"capabilities-policy.test",
			"allowed_capabilities":["tools.web.search"]
		}`},
	}}, queuedExecExpectation{rowsAffected: 1})

	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		t.Fatalf("runtime dispatch should not be attempted when capability policy denies the task")
		return nil, nil
	})}

	tc := &TaskCoordinator{httpClient: client, db: db}
	tc.dispatchToRuntime(context.Background(), &TaskRecord{
		TaskID:               taskID,
		TenantID:             "tenant-ai",
		RuntimeID:            &runtimeID,
		RuntimeEndpoint:      ptrString("http://runtime.test"),
		TaskDefinition:       json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[{"kind":"tool","node_id":"github-write","tool_name":"github.issues.write"}]}}`),
		RequiredCapabilities: []string{"tools.github.issues.write"},
		IdempotencyKey:       "idem-ai-denied",
	}, nil)

	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestHandleDispatchFailureSchedulesRecoveryForTransportError(t *testing.T) {
	t.Parallel()

	runtimeID := "runtime-transport-fail"
	taskID := uuid.New()
	called := false
	var gotTaskID uuid.UUID
	var gotRuntimeID string

	tc := &TaskCoordinator{recoveryHook: func(_ context.Context, incomingTaskID uuid.UUID, incomingRuntimeID string) {
		called = true
		gotTaskID = incomingTaskID
		gotRuntimeID = incomingRuntimeID
	}}

	tc.handleDispatchFailure(context.Background(), &TaskRecord{
		TaskID:    taskID,
		RuntimeID: &runtimeID,
	}, nil, errors.New("dial tcp timeout"))

	require.True(t, called)
	require.Equal(t, taskID, gotTaskID)
	require.Equal(t, runtimeID, gotRuntimeID)
}

func TestHandleDispatchFailureSchedulesRecoveryForServerError(t *testing.T) {
	t.Parallel()

	runtimeID := "runtime-5xx-fail"
	taskID := uuid.New()
	called := false

	tc := &TaskCoordinator{recoveryHook: func(_ context.Context, incomingTaskID uuid.UUID, incomingRuntimeID string) {
		called = incomingTaskID == taskID && incomingRuntimeID == runtimeID
	}}

	tc.handleDispatchFailure(context.Background(), &TaskRecord{
		TaskID:    taskID,
		RuntimeID: &runtimeID,
	}, &http.Response{StatusCode: http.StatusBadGateway}, nil)

	require.True(t, called)
}

func TestRuntimeTaskDispatchFailure(t *testing.T) {
	t.Parallel()

	t.Run("structured runtime error", func(t *testing.T) {
		t.Parallel()

		reason, details := runtimeTaskDispatchFailure(http.StatusConflict, []byte(`{
			"error": {
				"type": "checkpoint_mismatch",
				"message": "Checkpoint digest mismatch - WAL state diverged"
			}
		}`), false)
		require.Equal(t, "runtime submit rejected (checkpoint_mismatch): Checkpoint digest mismatch - WAL state diverged", reason)
		require.Equal(t, &TaskFailureDetails{
			Source:        "runtime",
			Operation:     "submit",
			StatusCode:    http.StatusConflict,
			RejectionType: "checkpoint_mismatch",
			Message:       "Checkpoint digest mismatch - WAL state diverged",
		}, details)
	})

	t.Run("falls back to raw body", func(t *testing.T) {
		t.Parallel()

		reason, details := runtimeTaskDispatchFailure(http.StatusBadRequest, []byte(`{"detail":"bad request"}`), false)
		require.Equal(t, `runtime submit rejected with status 400: {"detail":"bad request"}`, reason)
		require.Equal(t, &TaskFailureDetails{
			Source:     "runtime",
			Operation:  "submit",
			StatusCode: http.StatusBadRequest,
			Message:    `{"detail":"bad request"}`,
		}, details)
	})

	t.Run("uses resume wording for recovery redispatch", func(t *testing.T) {
		t.Parallel()

		resumeCheckpointProvided := true
		requestedLastStep := uint32(7)
		localLastStep := uint32(6)
		reason, details := runtimeTaskDispatchFailure(http.StatusConflict, []byte(`{
			"error": {
				"type": "checkpoint_mismatch",
				"message": "Checkpoint digest mismatch - WAL state diverged"
			},
			"resume": {
				"resume_checkpoint_provided": true,
				"requested_resume_from": {
					"last_committed_step": 7,
					"checkpoint_digest": [51, 51, 51, 51]
				},
				"local_last_committed_step": 6,
				"local_checkpoint_digest": "4444"
			}
		}`), true)
		require.Equal(t, "runtime resume rejected (checkpoint_mismatch): Checkpoint digest mismatch - WAL state diverged", reason)
		require.Equal(t, &TaskFailureDetails{
			Source:                    "runtime",
			Operation:                 "resume",
			StatusCode:                http.StatusConflict,
			RejectionType:             "checkpoint_mismatch",
			Message:                   "Checkpoint digest mismatch - WAL state diverged",
			RequestedLastStep:         &requestedLastStep,
			LocalLastStep:             &localLastStep,
			RequestedCheckpointDigest: "33333333",
			LocalCheckpointDigest:     "4444",
			ResumeCheckpointProvided:  &resumeCheckpointProvided,
		}, details)
	})
}

func TestOvertureTaskFailureDetails(t *testing.T) {
	t.Parallel()

	require.Equal(t, &TaskFailureDetails{
		Source:        "overture",
		Operation:     "recovery",
		RejectionType: "no_runtime_available",
		Message:       "no runtime available for recovery",
	}, overtureTaskFailureDetails("recovery", "no_runtime_available", "no runtime available for recovery"))
}

func TestDispatchToRuntimeSchedulesRecoveryOnTransportError(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	runtimeID := "runtime-transport-error"
	called := false
	var gotTaskID uuid.UUID
	var gotRuntimeID string

	tc := &TaskCoordinator{
		httpClient: &http.Client{Transport: roundTripperFunc(func(*http.Request) (*http.Response, error) {
			return nil, errors.New("dial tcp timeout")
		})},
		recoveryHook: func(_ context.Context, incomingTaskID uuid.UUID, incomingRuntimeID string) {
			called = true
			gotTaskID = incomingTaskID
			gotRuntimeID = incomingRuntimeID
		},
	}

	tc.dispatchToRuntime(context.Background(), &TaskRecord{
		TaskID:          taskID,
		TenantID:        "tenant-a",
		RuntimeID:       &runtimeID,
		RuntimeEndpoint: ptrString("http://runtime.test"),
		TaskDefinition:  json.RawMessage(`{"type":"agent_workflow","steps":[{"step_index":1,"model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}]}]}`),
		IdempotencyKey:  "idem-transport",
	}, nil)

	require.True(t, called)
	require.Equal(t, taskID, gotTaskID)
	require.Equal(t, runtimeID, gotRuntimeID)
}

func TestDispatchToRuntimeSchedulesRecoveryOnServerError(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	runtimeID := "runtime-server-error"
	called := false
	var gotTaskID uuid.UUID
	var gotRuntimeID string

	tc := &TaskCoordinator{
		httpClient: &http.Client{Transport: roundTripperFunc(func(*http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusBadGateway,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"error":"upstream failure"}`)),
			}, nil
		})},
		recoveryHook: func(_ context.Context, incomingTaskID uuid.UUID, incomingRuntimeID string) {
			called = true
			gotTaskID = incomingTaskID
			gotRuntimeID = incomingRuntimeID
		},
	}

	tc.dispatchToRuntime(context.Background(), &TaskRecord{
		TaskID:          taskID,
		TenantID:        "tenant-b",
		RuntimeID:       &runtimeID,
		RuntimeEndpoint: ptrString("http://runtime.test"),
		TaskDefinition:  json.RawMessage(`{"type":"robotics_workflow","steps":[{"step_index":1,"action":"publish_zero_velocity"}]}`),
		IdempotencyKey:  "idem-server",
	}, nil)

	require.True(t, called)
	require.Equal(t, taskID, gotTaskID)
	require.Equal(t, runtimeID, gotRuntimeID)
}

func TestDispatchToRuntimeMarksFailedOnConflictResponse(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	runtimeID := "runtime-submit-conflict"
	recoveryCalled := false
	db, queued := newQueuedExecDB(t, queuedExecExpectation{rowsAffected: 1})

	tc := &TaskCoordinator{
		store: NewCheckpointStore(db),
		httpClient: &http.Client{Transport: roundTripperFunc(func(*http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusConflict,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body: io.NopCloser(strings.NewReader(`{
					"error": {
						"type": "idempotency_conflict",
						"message": "Idempotency key already used for a different task submission"
					}
				}`)),
			}, nil
		})},
		recoveryHook: func(context.Context, uuid.UUID, string) {
			recoveryCalled = true
		},
	}

	tc.dispatchToRuntime(context.Background(), &TaskRecord{
		TaskID:          taskID,
		TenantID:        "tenant-conflict",
		RuntimeID:       &runtimeID,
		RuntimeEndpoint: ptrString("http://runtime.test"),
		TaskDefinition:  json.RawMessage(`{"type":"agent_workflow","steps":[{"step_index":1,"model":"gpt-4.1-mini","messages":[{"role":"user","content":"hello"}]}]}`),
		IdempotencyKey:  "idem-conflict",
	}, nil)

	require.False(t, recoveryCalled)
	require.Equal(t, 0, queued.remainingExecs())
}

func TestDispatchToRuntimePreservesCheckpointAndFailureDetailsOnExecutionFailure(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	runtimeID := "runtime-execution-failed"
	stepIndex := uint32(5)
	failureReason := "Step 5 failed: approval required for tool execution"
	failureDetails := &TaskFailureDetails{
		Source:        "runtime",
		Operation:     "execution",
		RejectionType: "step_failed",
		Message:       "approval required for tool execution",
		StepIndex:     &stepIndex,
		Domain:        "tool",
		NodeID:        "tool-5",
	}
	checkpoint := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 5,
			CheckpointDigest:  "digest-5",
			RuntimeID:         runtimeID,
		},
		WalEntries: []WalEntry{{EntryID: uuid.New(), TaskID: taskID, StepIndex: 5, RuntimeID: runtimeID}},
		Metadata:   json.RawMessage(`{"domain":"tool","node_id":"tool-5"}`),
		CapturedAt: time.Unix(1_900_000_305, 0).UTC(),
	}
	failureDetailBytes, err := json.Marshal(failureDetails)
	require.NoError(t, err)

	db, queued := newQueuedCheckpointDB(t,
		[]queuedQueryExpectation{{
			columns: []string{"last_checkpoint"},
			values:  []driver.Value{nil},
		}},
		queuedExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "UPDATE task_records")
				require.Equal(t, string(TaskStatusCheckpointed), args[0].Value)
				var persisted CheckpointPayload
				require.NoError(t, json.Unmarshal(args[1].Value.([]byte), &persisted))
				require.Equal(t, checkpoint.ResumeToken, persisted.ResumeToken)
				require.Equal(t, checkpoint.Metadata, persisted.Metadata)
				require.Len(t, persisted.WalEntries, 1)
				require.EqualValues(t, 5, persisted.WalEntries[0].StepIndex)
				require.Equal(t, "tool", persisted.WalEntries[0].StepType)
				require.Equal(t, "failed", persisted.WalEntries[0].Status)
				require.Equal(t, "abcd", persisted.WalEntries[0].InputDigest)
				require.Equal(t, taskID.String(), args[2].Value)
			},
		},
		queuedExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INSERT INTO wal_checkpoints")
				require.Equal(t, taskID.String(), args[1].Value)
				require.EqualValues(t, 5, args[2].Value)
			},
		},
		queuedExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "SET status = $1, failure_reason = $2, failure_details = $3")
				require.Equal(t, string(TaskStatusFailed), args[0].Value)
				require.Equal(t, failureReason, args[1].Value)
				require.Equal(t, failureDetailBytes, args[2].Value.([]byte))
				require.Equal(t, taskID.String(), args[3].Value)
			},
		},
	)

	tc := &TaskCoordinator{
		store: NewCheckpointStore(db),
		httpClient: &http.Client{Transport: roundTripperFunc(func(*http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body: io.NopCloser(strings.NewReader(`{
					"task_id":"` + taskID.String() + `",
					"status":"failed",
					"reason":"Step 5 failed: approval required for tool execution",
					"checkpoint":{
						"task_id":"` + taskID.String() + `",
						"resume_token":{
							"last_committed_step":5,
							"checkpoint_digest":"digest-5",
							"runtime_id":"` + runtimeID + `"
						},
						"wal_entries":[
							{
								"entry_id":"` + uuid.NewString() + `",
								"task_id":"` + taskID.String() + `",
								"step_index":5,
								"step_type":"tool",
								"status":"failed",
								"input_digest":"abcd",
								"timestamp_ms":1700000305000,
								"runtime_id":"` + runtimeID + `"
							}
						],
						"metadata":{"domain":"tool","node_id":"tool-5"},
						"captured_at":"2030-03-17T17:11:45Z"
					},
					"failure_details":{
						"source":"runtime",
						"operation":"execution",
						"rejection_type":"step_failed",
						"message":"approval required for tool execution",
						"step_index":5,
						"domain":"tool",
						"node_id":"tool-5"
					}
				}`)),
			}, nil
		})},
	}

	tc.dispatchToRuntime(context.Background(), &TaskRecord{
		TaskID:          taskID,
		TenantID:        "tenant-execution-failed",
		RuntimeID:       &runtimeID,
		RuntimeEndpoint: ptrString("http://runtime.test"),
		TaskDefinition:  json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[{"kind":"tool","node_id":"tool-5","tool_name":"web.search"}]}}`),
		IdempotencyKey:  "idem-execution-failed",
	}, nil)

	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestDispatchToRuntimeAcceptsStructuredRuntimeCheckpointStatus(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	runtimeID := "runtime-checkpointed"
	inputDigest := strings.Repeat("ab", 32)
	checkpoint := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 4,
			CheckpointDigest:  "digest-4",
			RuntimeID:         runtimeID,
		},
		WalEntries: []WalEntry{{
			EntryID:     uuid.New(),
			TaskID:      taskID,
			StepIndex:   4,
			StepType:    "agent",
			Status:      "committed",
			InputDigest: inputDigest,
			TimestampMs: 1_700_000_045_000,
			RuntimeID:   runtimeID,
		}},
		Metadata:   json.RawMessage(`{"tick_count":42}`),
		CapturedAt: time.Unix(1_900_000_045, 0).UTC(),
	}
	checkpointBytes, err := json.Marshal(checkpoint)
	require.NoError(t, err)
	var checkpointJSON any
	require.NoError(t, json.Unmarshal(checkpointBytes, &checkpointJSON))
	responsePayload, err := json.Marshal(map[string]any{
		"task_id": taskID,
		"status": map[string]any{
			"status":       "checkpointed",
			"resume_token": checkpoint.ResumeToken,
		},
		"checkpoint": checkpointJSON,
	})
	require.NoError(t, err)

	db, queued := newQueuedCheckpointDB(t,
		[]queuedQueryExpectation{{
			columns: []string{"last_checkpoint"},
			values:  []driver.Value{nil},
		}},
		queuedExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "UPDATE task_records")
				require.Equal(t, string(TaskStatusCheckpointed), args[0].Value)
				require.JSONEq(t, string(checkpointBytes), string(args[1].Value.([]byte)))
				require.Equal(t, taskID.String(), args[2].Value)
			},
		},
		queuedExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INSERT INTO wal_checkpoints")
				require.Equal(t, taskID.String(), args[1].Value)
				require.EqualValues(t, 4, args[2].Value)
			},
		},
	)

	tc := &TaskCoordinator{
		store: NewCheckpointStore(db),
		httpClient: &http.Client{Transport: roundTripperFunc(func(*http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(string(responsePayload))),
			}, nil
		})},
	}

	tc.dispatchToRuntime(context.Background(), &TaskRecord{
		TaskID:          taskID,
		TenantID:        "tenant-checkpointed",
		RuntimeID:       &runtimeID,
		RuntimeEndpoint: ptrString("http://runtime.test"),
		TaskDefinition:  json.RawMessage(`{"type":"agent_workflow","steps":[{"step_index":4,"model":"gpt-4.1-mini","messages":[{"role":"user","content":"checkpoint"}]}]}`),
		IdempotencyKey:  "idem-checkpointed",
	}, nil)

	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestSaveExecutionArtifactsIndexesRoboticsReceiptAudit(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	tenantID := "tenant-robotics-audit"
	envelope := json.RawMessage(`{
		"execution_id":"exec-robotics-1",
		"tenant_id":"tenant-robotics-audit",
		"policy_decision_id":"decision-robotics-1",
		"policy_decision_hash":"policy-hash-1",
		"governed_action_hash":"action-hash-1",
		"routing_decision":"ros2:publish_zero_velocity",
		"signature":"env-sig"
	}`)
	receipt := json.RawMessage(`{
		"execution_id":"exec-robotics-1",
		"hash":"receipt-hash-1",
		"signature":"receipt-sig",
		"violation_occurred":false
	}`)
	db, queued := newQueuedCheckpointDB(t,
		[]queuedQueryExpectation{{
			columns: []string{
				"tenant_id", "runtime_id", "runtime_endpoint", "proof_status", "failure_reason",
				"failure_details", "permission_envelope", "created_at", "dispatched_at", "completed_at", "canceled_at",
			},
			values: []driver.Value{
				tenantID,
				"runtime-robotics",
				"http://runtime-robotics",
				"pending",
				"",
				nil,
				[]byte(`{}`),
				time.Date(2026, 5, 3, 12, 0, 0, 0, time.UTC),
				time.Date(2026, 5, 3, 12, 0, 5, 0, time.UTC),
				time.Date(2026, 5, 3, 12, 0, 45, 0, time.UTC),
				nil,
			},
		}},
		queuedExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "UPDATE task_records")
				require.Equal(t, taskID.String(), args[5].Value)
			},
		},
		queuedExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INSERT INTO robotics_receipt_audit")
				require.Equal(t, taskID.String(), args[0].Value)
				require.Equal(t, tenantID, args[1].Value)
				require.Equal(t, "exec-robotics-1", args[2].Value)
				require.Equal(t, "decision-robotics-1", args[3].Value)
				require.Equal(t, "publish_zero_velocity", args[6].Value)
				require.Equal(t, "ros2:publish_zero_velocity", args[7].Value)
				require.Equal(t, "receipt-hash-1", args[8].Value)
				require.Equal(t, "receipt-sig", args[9].Value)
				require.Equal(t, "env-sig", args[10].Value)
				require.Equal(t, false, args[11].Value)
				require.Equal(t, []byte(envelope), args[13].Value)
				require.Equal(t, []byte(receipt), args[14].Value)
			},
		},
		queuedExecExpectation{rowsAffected: 1},
	)
	store := NewCheckpointStore(db)

	require.NoError(t, store.SaveExecutionArtifacts(taskID, envelope, receipt))
	require.Equal(t, 0, queued.remainingExecs())
}

func TestSaveExecutionArtifactsPersistsExecutionContext(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	createdAt := time.Date(2026, 5, 3, 12, 0, 0, 0, time.UTC)
	dispatchedAt := createdAt.Add(5 * time.Second)
	completedAt := createdAt.Add(45 * time.Second)

	envelope := json.RawMessage(`{
		"execution_id":"exec-context-1",
		"tenant_id":"tenant-context",
		"provider":"openai",
		"routing_decision":"runtime:test",
		"bounds_applied":{"max_tick_ms":1000}
	}`)
	receipt := json.RawMessage(`{
		"execution_id":"exec-context-1",
		"receipt_hash":"receipt-hash-context-1",
		"signature":"receipt-sig-context-1"
	}`)

	db, queued := newQueuedCheckpointDB(t,
		[]queuedQueryExpectation{{
			columns: []string{
				"tenant_id", "runtime_id", "runtime_endpoint", "proof_status", "failure_reason",
				"failure_details", "permission_envelope", "created_at", "dispatched_at", "completed_at", "canceled_at",
			},
			values: []driver.Value{
				"tenant-context",
				"runtime-context",
				"http://runtime-context",
				"verified",
				"",
				nil,
				[]byte(`{"envelope_id":"env-1","required_capabilities":["tools.github.issues.write"],"decisions":[{"capability":"tools.github.issues.write","permit":true,"reason":"allowed","policy_version":"capabilities.v1"}],"credential_refs":[],"issued_at_unix_ms":1800000000000,"expires_at_unix_ms":1800000030000,"signature":"env-sig"}`),
				createdAt,
				dispatchedAt,
				completedAt,
				nil,
			},
		}},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INSERT INTO execution_context")
				require.Equal(t, "exec-context-1", args[0].Value)
				require.Equal(t, "tenant-context", args[1].Value)
				require.Equal(t, taskID.String(), args[2].Value)
				require.Equal(t, "runtime-context", args[3].Value)
				require.Equal(t, "http://runtime-context", args[4].Value)
				require.Equal(t, "openai", args[5].Value)
				require.Equal(t, "runtime:test", args[6].Value)
				require.Equal(t, "runtime_task", args[7].Value)
				require.Equal(t, false, args[8].Value)
				require.Equal(t, "verified", args[14].Value)
				require.Equal(t, "receipt-hash-context-1", args[16].Value)
			},
		},
	)
	store := NewCheckpointStore(db)

	require.NoError(t, store.SaveExecutionArtifacts(taskID, envelope, receipt))
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func signedRuntimeArtifactJSON(t *testing.T, privateKey ed25519.PrivateKey, fields map[string]any) json.RawMessage {
	t.Helper()
	canonical, err := json.Marshal(fields)
	require.NoError(t, err)
	sum := sha256.Sum256(canonical)
	fields["signature"] = base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, sum[:]))
	raw, err := json.Marshal(fields)
	require.NoError(t, err)
	return raw
}

func mustJSONFieldString(t *testing.T, raw json.RawMessage, field string) string {
	t.Helper()
	var value map[string]any
	require.NoError(t, json.Unmarshal(raw, &value))
	got, ok := value[field].(string)
	require.True(t, ok)
	return got
}

func TestReplayRoboticsAuditReconstructsPolicyActionAndRuntimeReceipt(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	t.Setenv("IGRIS_RUNTIME_PUBLIC_KEY", hex.EncodeToString(publicKey))

	taskID := uuid.New()
	runtimeID := "runtime-replay"
	target := "base-controller"
	decision := signedGovernedPolicyDecision{
		SchemaVersion: "governed_policy_decision.v1",
		DecisionID:    "decision-replay-1",
		TenantID:      "tenant-replay",
		TaskID:        taskID.String(),
		RuntimeID:     &runtimeID,
		Action: governedAction{
			SchemaVersion:      "governed_action.v1",
			Domain:             "robotics",
			ActionType:         "ros2_action",
			ActionName:         "cancel_navigation",
			NodeID:             "robotics-step-0",
			StepIndex:          0,
			Target:             &target,
			RequiresPolicy:     true,
			SafetyModeRequired: true,
		},
		Permit:             true,
		Reason:             "permitted",
		PolicyVersion:      "robotics-policy.active",
		RuntimePermitted:   true,
		TenantPermitted:    true,
		PolicyPermitted:    true,
		RobotModePermitted: true,
		IssuedAtUnixMs:     1_900_000_000_000,
		ExpiresAtUnixMs:    1_900_000_030_000,
		Signature:          "policy-sig",
	}
	decisionBytes, err := json.Marshal(decision)
	require.NoError(t, err)
	decisionHash := governedPolicyDecisionHash(decision)
	envelope := signedRuntimeArtifactJSON(t, privateKey, map[string]any{
		"execution_id":         "exec-replay-1",
		"tenant_id":            "tenant-replay",
		"policy_decision_id":   "decision-replay-1",
		"policy_decision_hash": decisionHash,
		"governed_action_hash": "action-hash-replay",
		"routing_decision":     "runtime:robotics:failed",
	})
	receipt := signedReceiptJSON(t, privateKey, map[string]any{
		"execution_id":       "exec-replay-1",
		"violation_occurred": true,
	})
	receiptHash := mustJSONFieldString(t, receipt, "hash")
	persistedAt := time.Unix(1_900_000_100, 0).UTC()
	db, queued := newQueuedCheckpointDB(t, []queuedQueryExpectation{{
		columns: []string{
			"task_id",
			"tenant_id",
			"runtime_id",
			"execution_id",
			"policy_decision_id",
			"policy_version",
			"robot_action",
			"robot_node_id",
			"robot_target",
			"permit",
			"reason",
			"routing_decision",
			"policy_decision_hash",
			"governed_action_hash",
			"receipt_hash",
			"receipt_signature",
			"envelope_signature",
			"policy_signature",
			"violation_occurred",
			"violation",
			"signed_policy_decision",
			"execution_envelope",
			"execution_receipt",
			"persisted_at",
			"runtime_public_key_ed25519",
		},
		values: []driver.Value{
			taskID.String(),
			"tenant-replay",
			runtimeID,
			"exec-replay-1",
			"decision-replay-1",
			"robotics-policy.active",
			"cancel_navigation",
			"robotics-step-0",
			target,
			true,
			"permitted",
			"runtime:robotics:failed",
			decisionHash,
			"action-hash-replay",
			receiptHash,
			mustJSONFieldString(t, receipt, "signature"),
			mustJSONFieldString(t, envelope, "signature"),
			"policy-sig",
			true,
			"navigation canceled",
			[]byte(decisionBytes),
			[]byte(envelope),
			[]byte(receipt),
			persistedAt,
			hex.EncodeToString(publicKey),
		},
	}})
	store := NewCheckpointStore(db)

	replays, err := store.ReplayRoboticsAudit("tenant-replay", RoboticsAuditReceiptFilter{
		TaskID:           &taskID,
		PolicyDecisionID: "decision-replay-1",
		RobotAction:      "cancel_navigation",
	})
	require.NoError(t, err)
	require.Len(t, replays, 1)
	require.True(t, replays[0].Valid, replays[0].ValidationErrors)
	require.Equal(t, "tenant-replay", replays[0].TenantID)
	require.Equal(t, runtimeID, replays[0].RuntimeID)
	require.Equal(t, "robotics-policy.active", replays[0].PolicyVersion)
	require.Equal(t, "cancel_navigation", replays[0].RobotAction)
	require.Equal(t, "robotics-step-0", replays[0].RobotNodeID)
	require.Equal(t, target, replays[0].RobotTarget)
	require.Equal(t, mustJSONFieldString(t, envelope, "signature"), replays[0].RuntimeSignature)
	require.True(t, replays[0].RuntimeSignaturePresent)
	require.True(t, replays[0].RuntimeSignatureVerified)
	require.Equal(t, "runtime_registry", replays[0].RuntimeSignatureKeySource)
	require.Equal(t, 0, queued.remainingQueries())
}

func TestRecoverRuntimeRedispatchUsesNewestTaskCheckpointSource(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	failedRuntimeID := "runtime-failed"
	runRecoverRuntimeRedispatchCheckpointTest(t, taskID, failedRuntimeID,
		&CheckpointPayload{
			TaskID: taskID,
			ResumeToken: ResumeToken{
				LastCommittedStep: 4,
				CheckpointDigest:  "digest-4",
				RuntimeID:         failedRuntimeID,
			},
			WalEntries: []WalEntry{{EntryID: uuid.New(), TaskID: taskID, StepIndex: 4, RuntimeID: failedRuntimeID}},
			Metadata:   json.RawMessage(`{"tick_count": 4}`),
			CapturedAt: time.Unix(1_900_000_104, 0).UTC(),
		},
		&CheckpointPayload{
			TaskID: taskID,
			ResumeToken: ResumeToken{
				LastCommittedStep: 6,
				CheckpointDigest:  "digest-6",
				RuntimeID:         failedRuntimeID,
			},
			WalEntries: []WalEntry{{EntryID: uuid.New(), TaskID: taskID, StepIndex: 6, RuntimeID: failedRuntimeID}},
			Metadata:   json.RawMessage(`{"tick_count": 6}`),
			CapturedAt: time.Unix(1_900_000_106, 0).UTC(),
		},
		6, "digest-6", 6,
	)
}

func TestRecoverRuntimeRedispatchUsesNewestWalCheckpointSource(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	failedRuntimeID := "runtime-failed"
	runRecoverRuntimeRedispatchCheckpointTest(t, taskID, failedRuntimeID,
		&CheckpointPayload{
			TaskID: taskID,
			ResumeToken: ResumeToken{
				LastCommittedStep: 8,
				CheckpointDigest:  "digest-8",
				RuntimeID:         failedRuntimeID,
			},
			WalEntries: []WalEntry{{EntryID: uuid.New(), TaskID: taskID, StepIndex: 8, RuntimeID: failedRuntimeID}},
			Metadata:   json.RawMessage(`{"tick_count": 8}`),
			CapturedAt: time.Unix(1_900_000_108, 0).UTC(),
		},
		&CheckpointPayload{
			TaskID: taskID,
			ResumeToken: ResumeToken{
				LastCommittedStep: 5,
				CheckpointDigest:  "digest-5",
				RuntimeID:         failedRuntimeID,
			},
			WalEntries: []WalEntry{{EntryID: uuid.New(), TaskID: taskID, StepIndex: 5, RuntimeID: failedRuntimeID}},
			Metadata:   json.RawMessage(`{"tick_count": 5}`),
			CapturedAt: time.Unix(1_900_000_105, 0).UTC(),
		},
		8, "digest-8", 8,
	)
}

func TestRecoverRuntimeRetryUsesNewestCheckpointOnNextAttempt(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	failedRuntimeID := "runtime-failed"
	retryRuntimeID := "runtime-retry"
	finalRuntimeID := "runtime-final"
	tenantID := "tenant-recovery"
	idempotencyKey := "idem-recovery-retry"
	createdAt := time.Unix(1_900_000_200, 0).UTC()
	taskDefinition := json.RawMessage(`{
		"type":"behavior_tree",
		"tree":{"root":{"type":"sequence","children":[]}}
	}`)
	initialWalCheckpoint := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 4,
			CheckpointDigest:  "digest-4",
			RuntimeID:         failedRuntimeID,
		},
		WalEntries: []WalEntry{{EntryID: uuid.New(), TaskID: taskID, StepIndex: 4, RuntimeID: failedRuntimeID}},
		Metadata:   json.RawMessage(`{"tick_count": 4}`),
		CapturedAt: time.Unix(1_900_000_204, 0).UTC(),
	}
	initialTaskCheckpoint := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 6,
			CheckpointDigest:  "digest-6",
			RuntimeID:         failedRuntimeID,
		},
		WalEntries: []WalEntry{{EntryID: uuid.New(), TaskID: taskID, StepIndex: 6, RuntimeID: failedRuntimeID}},
		Metadata:   json.RawMessage(`{"tick_count": 6}`),
		CapturedAt: time.Unix(1_900_000_206, 0).UTC(),
	}
	retryWalCheckpoint := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 9,
			CheckpointDigest:  "digest-9",
			RuntimeID:         retryRuntimeID,
		},
		WalEntries: []WalEntry{{EntryID: uuid.New(), TaskID: taskID, StepIndex: 9, RuntimeID: retryRuntimeID}},
		Metadata:   json.RawMessage(`{"tick_count": 9}`),
		CapturedAt: time.Unix(1_900_000_209, 0).UTC(),
	}

	initialWalCheckpoint = cumulativeRecoveryTestCheckpoint(taskID, failedRuntimeID, initialWalCheckpoint)
	initialTaskCheckpoint = cumulativeRecoveryTestCheckpointRange(taskID, failedRuntimeID, initialTaskCheckpoint, initialWalCheckpoint.ResumeToken.LastCommittedStep+1)
	retryWalCheckpoint = cumulativeRecoveryTestCheckpoint(taskID, retryRuntimeID, retryWalCheckpoint)

	initialWalCheckpointBytes, err := json.Marshal(initialWalCheckpoint)
	require.NoError(t, err)
	retryWalCheckpointBytes, err := json.Marshal(retryWalCheckpoint)
	require.NoError(t, err)

	db, queued := newQueuedCheckpointDB(t,
		[]queuedQueryExpectation{
			{
				columns: []string{"task_id"},
				rows:    [][]driver.Value{{taskID.String()}},
			},
			{
				columns: []string{"last_checkpoint"},
				values:  []driver.Value{initialWalCheckpointBytes},
			},
			{
				columns: []string{"tenant_id"},
				values:  []driver.Value{tenantID},
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				values: taskRecordRowForRecoveryTest(taskID, tenantID, TaskStatusRecovering, failedRuntimeID, "http://failed-runtime.test", taskDefinition, initialTaskCheckpoint, idempotencyKey, createdAt),
			},
			{
				columns: []string{"runtime_id", "endpoint"},
				values:  []driver.Value{retryRuntimeID, "http://retry-runtime.test"},
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				values: taskRecordRowForRecoveryTest(taskID, tenantID, TaskStatusDispatched, retryRuntimeID, "http://retry-runtime.test", taskDefinition, initialTaskCheckpoint, idempotencyKey, createdAt),
			},
			{
				columns: []string{"task_id"},
				rows:    [][]driver.Value{{taskID.String()}},
			},
			{
				columns: []string{"last_checkpoint"},
				values:  []driver.Value{retryWalCheckpointBytes},
			},
			{
				columns: []string{"tenant_id"},
				values:  []driver.Value{tenantID},
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				values: taskRecordRowForRecoveryTest(taskID, tenantID, TaskStatusRecovering, retryRuntimeID, "http://retry-runtime.test", taskDefinition, initialTaskCheckpoint, idempotencyKey, createdAt),
			},
			{
				columns: []string{"runtime_id", "endpoint"},
				values:  []driver.Value{finalRuntimeID, "http://final-runtime.test"},
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				values: taskRecordRowForRecoveryTest(taskID, tenantID, TaskStatusDispatched, finalRuntimeID, "http://final-runtime.test", taskDefinition, initialTaskCheckpoint, idempotencyKey, createdAt),
			},
		},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 1},
	)

	var mu sync.Mutex
	dispatchCount := 0
	bodyCh := make(chan map[string]any, 1)
	recoveryCh := make(chan struct {
		taskID    uuid.UUID
		runtimeID string
	}, 1)
	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		mu.Lock()
		dispatchCount++
		currentDispatch := dispatchCount
		mu.Unlock()

		if currentDispatch == 1 {
			return nil, errors.New("dial tcp timeout")
		}

		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)

		var gotBody map[string]any
		require.NoError(t, json.Unmarshal(body, &gotBody))
		bodyCh <- gotBody

		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{}`)),
		}, nil
	})}

	tc := &TaskCoordinator{
		db:         db,
		store:      NewCheckpointStore(db),
		httpClient: client,
		recoveryHook: func(_ context.Context, incomingTaskID uuid.UUID, incomingRuntimeID string) {
			recoveryCh <- struct {
				taskID    uuid.UUID
				runtimeID string
			}{taskID: incomingTaskID, runtimeID: incomingRuntimeID}
		},
	}

	tc.recoverRuntime(context.Background(), failedRuntimeID)

	select {
	case scheduled := <-recoveryCh:
		require.Equal(t, taskID, scheduled.taskID)
		require.Equal(t, retryRuntimeID, scheduled.runtimeID)
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for first recovery retry to be scheduled")
	}

	tc.recoverRuntime(context.Background(), retryRuntimeID)

	select {
	case gotBody := <-bodyCh:
		resumeFrom, ok := gotBody["resume_from"].(map[string]any)
		require.True(t, ok)
		require.Equal(t, float64(9), resumeFrom["last_committed_step"])
		require.Equal(t, "digest-9", resumeFrom["checkpoint_digest"])

		resumeCheckpoint, ok := gotBody["resume_checkpoint"].(map[string]any)
		require.True(t, ok)
		metadata, ok := resumeCheckpoint["metadata"].(map[string]any)
		require.True(t, ok)
		require.Equal(t, float64(9), metadata["tick_count"])
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for second recovery redispatch")
	}

	require.Equal(t, 0, queued.remainingExecs())
	require.Equal(t, 0, queued.remainingQueries())
}

func TestRecoverRuntimeMarksFailedForInvalidRecoveryCheckpoint(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	failedRuntimeID := "runtime-failed-invalid-checkpoint"
	tenantID := "tenant-recovery-invalid-checkpoint"
	idempotencyKey := "idem-recovery-invalid-checkpoint"
	createdAt := time.Unix(1_900_000_250, 0).UTC()
	taskDefinition := json.RawMessage(`{
		"type":"behavior_tree",
		"tree":{"root":{"type":"sequence","children":[]}}
	}`)
	invalidCheckpoint := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 5,
			CheckpointDigest:  "digest-5",
			RuntimeID:         failedRuntimeID,
		},
		WalEntries: []WalEntry{{TaskID: taskID, StepIndex: 5, RuntimeID: failedRuntimeID}},
		Metadata:   json.RawMessage(`{"tick_count": 5}`),
		CapturedAt: time.Unix(1_900_000_255, 0).UTC(),
	}
	invalidCheckpointBytes, err := json.Marshal(invalidCheckpoint)
	require.NoError(t, err)

	db, queued := newQueuedCheckpointDB(t,
		[]queuedQueryExpectation{
			{
				columns: []string{"task_id"},
				rows:    [][]driver.Value{{taskID.String()}},
			},
			{
				columns: []string{"last_checkpoint"},
				values:  []driver.Value{invalidCheckpointBytes},
			},
			{
				columns: []string{"tenant_id"},
				values:  []driver.Value{tenantID},
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				values: taskRecordRowForRecoveryTest(taskID, tenantID, TaskStatusRecovering, failedRuntimeID, "http://failed-runtime.test", taskDefinition, nil, idempotencyKey, createdAt),
			},
		},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "SET status = $1, failure_reason = $2, failure_details = $3")
				require.Equal(t, string(TaskStatusFailed), args[0].Value)
				require.Equal(t, TaskFailureReasonInvalidRecoveryCheckpoint, args[1].Value)

				detailBytes, ok := args[2].Value.([]byte)
				require.True(t, ok)
				var details TaskFailureDetails
				require.NoError(t, json.Unmarshal(detailBytes, &details))
				require.Equal(t, "overture", details.Source)
				require.Equal(t, "recovery", details.Operation)
				require.Equal(t, "invalid_recovery_checkpoint", details.RejectionType)
				require.Equal(t, TaskFailureReasonInvalidRecoveryCheckpoint, details.Message)
				require.Equal(t, taskID.String(), args[3].Value)
			},
		},
	)

	dispatchCalled := false
	tc := &TaskCoordinator{
		db:    db,
		store: NewCheckpointStore(db),
		httpClient: &http.Client{Transport: roundTripperFunc(func(*http.Request) (*http.Response, error) {
			dispatchCalled = true
			return nil, errors.New("unexpected redispatch")
		})},
	}

	tc.recoverRuntime(context.Background(), failedRuntimeID)

	require.False(t, dispatchCalled)
	require.Equal(t, 0, queued.remainingExecs())
	require.Equal(t, 0, queued.remainingQueries())
}

func TestRecoverRuntimeMarksFailedOnRedispatchConflictResponse(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	failedRuntimeID := "runtime-failed"
	newRuntimeID := "runtime-replacement"
	tenantID := "tenant-recovery-conflict"
	idempotencyKey := "idem-recovery-conflict"
	createdAt := time.Unix(1_900_000_250, 0).UTC()
	localLastStep := uint32(10)
	taskDefinition := json.RawMessage(`{
		"type":"behavior_tree",
		"tree":{"root":{"type":"sequence","children":[]}}
	}`)
	checkpoint := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 11,
			CheckpointDigest:  "digest-11",
			RuntimeID:         failedRuntimeID,
		},
		WalEntries: []WalEntry{{EntryID: uuid.New(), TaskID: taskID, StepIndex: 11, RuntimeID: failedRuntimeID}},
		Metadata:   json.RawMessage(`{"tick_count": 11}`),
		CapturedAt: time.Unix(1_900_000_261, 0).UTC(),
	}
	checkpoint = cumulativeRecoveryTestCheckpoint(taskID, failedRuntimeID, checkpoint)
	checkpointBytes, err := json.Marshal(checkpoint)
	require.NoError(t, err)

	db, queued := newQueuedCheckpointDB(t,
		[]queuedQueryExpectation{
			{
				columns: []string{"task_id"},
				rows:    [][]driver.Value{{taskID.String()}},
			},
			{
				columns: []string{"last_checkpoint"},
				values:  []driver.Value{checkpointBytes},
			},
			{
				columns: []string{"tenant_id"},
				values:  []driver.Value{tenantID},
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				values: taskRecordRowForRecoveryTest(taskID, tenantID, TaskStatusRecovering, failedRuntimeID, "http://failed-runtime.test", taskDefinition, checkpoint, idempotencyKey, createdAt),
			},
			{
				columns: []string{"runtime_id", "endpoint"},
				values:  []driver.Value{newRuntimeID, "http://new-runtime.test"},
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				values: taskRecordRowForRecoveryTest(taskID, tenantID, TaskStatusDispatched, newRuntimeID, "http://new-runtime.test", taskDefinition, checkpoint, idempotencyKey, createdAt),
			},
		},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "SET status = $1, failure_reason = $2, failure_details = $3")
				require.Equal(t, string(TaskStatusFailed), args[0].Value)
				require.Equal(t, "runtime resume rejected (checkpoint_mismatch): Checkpoint digest mismatch - WAL state diverged", args[1].Value)

				detailBytes, ok := args[2].Value.([]byte)
				require.True(t, ok)
				var details TaskFailureDetails
				require.NoError(t, json.Unmarshal(detailBytes, &details))
				require.Equal(t, "runtime", details.Source)
				require.Equal(t, "resume", details.Operation)
				require.Equal(t, http.StatusConflict, details.StatusCode)
				require.Equal(t, "checkpoint_mismatch", details.RejectionType)
				require.Equal(t, "Checkpoint digest mismatch - WAL state diverged", details.Message)
				require.NotNil(t, details.RequestedLastStep)
				require.Equal(t, uint32(11), *details.RequestedLastStep)
				require.NotNil(t, details.LocalLastStep)
				require.Equal(t, localLastStep, *details.LocalLastStep)
				require.Equal(t, "digest-11", details.RequestedCheckpointDigest)
				require.Equal(t, "digest-local", details.LocalCheckpointDigest)
				require.NotNil(t, details.ResumeCheckpointProvided)
				require.True(t, *details.ResumeCheckpointProvided)
				require.Equal(t, taskID.String(), args[3].Value)
			},
		},
	)

	dispatchCh := make(chan map[string]any, 1)
	recoveryCh := make(chan struct{}, 1)
	tc := &TaskCoordinator{
		db:    db,
		store: NewCheckpointStore(db),
		httpClient: &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
			body, err := io.ReadAll(r.Body)
			require.NoError(t, err)

			var gotBody map[string]any
			require.NoError(t, json.Unmarshal(body, &gotBody))
			dispatchCh <- gotBody

			return &http.Response{
				StatusCode: http.StatusConflict,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body: io.NopCloser(strings.NewReader(`{
					"error": {
						"type": "checkpoint_mismatch",
						"message": "Checkpoint digest mismatch - WAL state diverged"
					},
					"resume": {
						"resume_checkpoint_provided": true,
						"requested_resume_from": {
							"last_committed_step": 11,
							"checkpoint_digest": "digest-11"
						},
						"local_last_committed_step": 10,
						"local_checkpoint_digest": "digest-local"
					}
				}`)),
			}, nil
		})},
		recoveryHook: func(context.Context, uuid.UUID, string) {
			recoveryCh <- struct{}{}
		},
	}

	tc.recoverRuntime(context.Background(), failedRuntimeID)

	select {
	case gotBody := <-dispatchCh:
		resumeFrom, ok := gotBody["resume_from"].(map[string]any)
		require.True(t, ok)
		require.Equal(t, float64(11), resumeFrom["last_committed_step"])
		require.Equal(t, "digest-11", resumeFrom["checkpoint_digest"])
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for recovery redispatch conflict")
	}

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if queued.remainingExecs() == 0 && queued.remainingQueries() == 0 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	require.Equal(t, 0, queued.remainingExecs())
	require.Equal(t, 0, queued.remainingQueries())

	select {
	case <-recoveryCh:
		t.Fatal("unexpected recovery reschedule after runtime redispatch conflict")
	default:
	}
}

func TestRecoverRuntimeSkipsCanceledTaskBeforeRedispatch(t *testing.T) {
	t.Parallel()

	testRecoverRuntimeSkipsTerminalTaskBeforeRedispatch(t, TaskStatusCanceled, nil)
}

func TestRecoverRuntimeSkipsCompletedTaskBeforeRedispatch(t *testing.T) {
	t.Parallel()

	testRecoverRuntimeSkipsTerminalTaskBeforeRedispatch(t, TaskStatusCompleted, nil)
}

func TestRecoverRuntimeSkipsFailedTaskBeforeRedispatch(t *testing.T) {
	t.Parallel()

	failureReason := "runtime surfaced late failure"
	testRecoverRuntimeSkipsTerminalTaskBeforeRedispatch(t, TaskStatusFailed, &failureReason)
}

func ptrString(value string) *string {
	return &value
}

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (fn roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func runRecoverRuntimeRedispatchCheckpointTest(t *testing.T, taskID uuid.UUID, failedRuntimeID string, walCheckpoint, lastCheckpoint *CheckpointPayload, wantStep float64, wantDigest string, wantTickCount float64) {
	t.Helper()

	newRuntimeID := "runtime-replacement"
	tenantID := "tenant-recovery"
	idempotencyKey := "idem-recovery-newest"
	createdAt := time.Unix(1_900_000_100, 0).UTC()
	taskDefinition := json.RawMessage(`{
		"type":"behavior_tree",
		"tree":{"root":{"type":"sequence","children":[]}}
	}`)
	walCheckpoint = cumulativeRecoveryTestCheckpoint(taskID, failedRuntimeID, walCheckpoint)
	if TaskCheckpointAdvances(walCheckpoint, lastCheckpoint) {
		lastCheckpoint = cumulativeRecoveryTestCheckpointRange(taskID, failedRuntimeID, lastCheckpoint, walCheckpoint.ResumeToken.LastCommittedStep+1)
	}

	walCheckpointBytes, err := json.Marshal(walCheckpoint)
	require.NoError(t, err)

	db, queued := newQueuedCheckpointDB(t,
		[]queuedQueryExpectation{
			{
				columns: []string{"task_id"},
				rows:    [][]driver.Value{{taskID.String()}},
			},
			{
				columns: []string{"last_checkpoint"},
				values:  []driver.Value{walCheckpointBytes},
			},
			{
				columns: []string{"tenant_id"},
				values:  []driver.Value{tenantID},
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				values: taskRecordRowForRecoveryTest(taskID, tenantID, TaskStatusRecovering, failedRuntimeID, "http://failed-runtime.test", taskDefinition, lastCheckpoint, idempotencyKey, createdAt),
			},
			{
				columns: []string{"runtime_id", "endpoint"},
				values:  []driver.Value{newRuntimeID, "http://new-runtime.test"},
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				values: taskRecordRowForRecoveryTest(taskID, tenantID, TaskStatusDispatched, newRuntimeID, "http://new-runtime.test", taskDefinition, lastCheckpoint, idempotencyKey, createdAt),
			},
		},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 1},
	)

	bodyCh := make(chan map[string]any, 1)
	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)

		var gotBody map[string]any
		require.NoError(t, json.Unmarshal(body, &gotBody))
		bodyCh <- gotBody

		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{}`)),
		}, nil
	})}

	tc := &TaskCoordinator{
		db:         db,
		store:      NewCheckpointStore(db),
		httpClient: client,
	}

	tc.recoverRuntime(context.Background(), failedRuntimeID)

	select {
	case gotBody := <-bodyCh:
		resumeFrom, ok := gotBody["resume_from"].(map[string]any)
		require.True(t, ok)
		require.Equal(t, wantStep, resumeFrom["last_committed_step"])
		require.Equal(t, wantDigest, resumeFrom["checkpoint_digest"])

		resumeCheckpoint, ok := gotBody["resume_checkpoint"].(map[string]any)
		require.True(t, ok)
		walEntries, ok := resumeCheckpoint["wal_entries"].([]any)
		require.True(t, ok)
		require.NotEmpty(t, walEntries)
		lastWalEntry, ok := walEntries[len(walEntries)-1].(map[string]any)
		require.True(t, ok)
		require.Equal(t, wantStep, lastWalEntry["step_index"])
		require.Equal(t, failedRuntimeID, lastWalEntry["runtime_id"])
		metadata, ok := resumeCheckpoint["metadata"].(map[string]any)
		require.True(t, ok)
		require.Equal(t, wantTickCount, metadata["tick_count"])
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for recovery redispatch")
	}

	require.Equal(t, 0, queued.remainingExecs())
	require.Equal(t, 0, queued.remainingQueries())
}

func cumulativeRecoveryTestCheckpoint(taskID uuid.UUID, runtimeID string, checkpoint *CheckpointPayload) *CheckpointPayload {
	if checkpoint == nil {
		return nil
	}
	entriesByStep := make(map[uint32]WalEntry, len(checkpoint.WalEntries))
	for _, entry := range checkpoint.WalEntries {
		entriesByStep[entry.StepIndex] = entry
	}
	entries := make([]WalEntry, 0, int(checkpoint.ResumeToken.LastCommittedStep)+1)
	for step := uint32(0); step <= checkpoint.ResumeToken.LastCommittedStep; step++ {
		if entry, ok := entriesByStep[step]; ok {
			entry.Status = "committed"
			if entry.OutputDigest == nil {
				entry.OutputDigest = ptrString(fmt.Sprintf("%064x", step+1))
			}
			entries = append(entries, entry)
		} else {
			entries = append(entries, WalEntry{
				EntryID:      uuid.New(),
				TaskID:       taskID,
				StepIndex:    step,
				StepType:     map[string]any{"kind": "test"},
				Status:       "committed",
				InputDigest:  fmt.Sprintf("%064x", step+1),
				OutputDigest: ptrString(fmt.Sprintf("%064x", step+101)),
				TimestampMs:  uint64(1_900_000_000 + step),
				RuntimeID:    runtimeID,
			})
		}
		if step == ^uint32(0) {
			break
		}
	}
	next := *checkpoint
	next.WalEntries = entries
	return &next
}

func cumulativeRecoveryTestCheckpointRange(taskID uuid.UUID, runtimeID string, checkpoint *CheckpointPayload, firstStep uint32) *CheckpointPayload {
	if checkpoint == nil {
		return nil
	}
	entriesByStep := make(map[uint32]WalEntry, len(checkpoint.WalEntries))
	for _, entry := range checkpoint.WalEntries {
		entriesByStep[entry.StepIndex] = entry
	}
	entries := make([]WalEntry, 0, int(checkpoint.ResumeToken.LastCommittedStep-firstStep)+1)
	for step := firstStep; step <= checkpoint.ResumeToken.LastCommittedStep; step++ {
		if entry, ok := entriesByStep[step]; ok {
			entry.Status = "committed"
			if entry.OutputDigest == nil {
				entry.OutputDigest = ptrString(fmt.Sprintf("%064x", step+1))
			}
			entries = append(entries, entry)
		} else {
			entries = append(entries, WalEntry{
				EntryID:      uuid.New(),
				TaskID:       taskID,
				StepIndex:    step,
				StepType:     map[string]any{"kind": "test"},
				Status:       "committed",
				InputDigest:  fmt.Sprintf("%064x", step+1),
				OutputDigest: ptrString(fmt.Sprintf("%064x", step+101)),
				TimestampMs:  uint64(1_900_000_000 + step),
				RuntimeID:    runtimeID,
			})
		}
		if step == ^uint32(0) {
			break
		}
	}
	next := *checkpoint
	next.WalEntries = entries
	return &next
}

func testRecoverRuntimeSkipsTerminalTaskBeforeRedispatch(t *testing.T, terminalStatus TaskRecordStatus, failureReason *string) {
	t.Helper()

	taskID := uuid.New()
	failedRuntimeID := "runtime-failed"
	tenantID := "tenant-recovery"
	idempotencyKey := "idem-recovery-terminal"
	createdAt := time.Unix(1_900_000_300, 0).UTC()
	taskDefinition := json.RawMessage(`{
		"type":"behavior_tree",
		"tree":{"root":{"type":"sequence","children":[]}}
	}`)
	checkpoint := &CheckpointPayload{
		TaskID: taskID,
		ResumeToken: ResumeToken{
			LastCommittedStep: 7,
			CheckpointDigest:  "digest-7",
			RuntimeID:         failedRuntimeID,
		},
		WalEntries: []WalEntry{{EntryID: uuid.New(), TaskID: taskID, StepIndex: 7, RuntimeID: failedRuntimeID}},
		Metadata:   json.RawMessage(`{"tick_count": 7}`),
		CapturedAt: time.Unix(1_900_000_307, 0).UTC(),
	}
	checkpointBytes, err := json.Marshal(checkpoint)
	require.NoError(t, err)

	db, queued := newQueuedCheckpointDB(t,
		[]queuedQueryExpectation{
			{
				columns: []string{"task_id"},
				rows:    [][]driver.Value{{taskID.String()}},
			},
			{
				columns: []string{"last_checkpoint"},
				values:  []driver.Value{checkpointBytes},
			},
			{
				columns: []string{"tenant_id"},
				values:  []driver.Value{tenantID},
			},
			{
				columns: []string{
					"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
					"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
					"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
					"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
				},
				values: taskRecordRowForRecoveryTestWithFailureReason(taskID, tenantID, terminalStatus, failedRuntimeID, "http://failed-runtime.test", taskDefinition, checkpoint, idempotencyKey, failureReason, createdAt),
			},
		},
		queuedExecExpectation{rowsAffected: 1},
	)

	dispatchCalled := false
	tc := &TaskCoordinator{
		db:    db,
		store: NewCheckpointStore(db),
		httpClient: &http.Client{Transport: roundTripperFunc(func(*http.Request) (*http.Response, error) {
			dispatchCalled = true
			return nil, errors.New("unexpected redispatch")
		})},
	}

	tc.recoverRuntime(context.Background(), failedRuntimeID)

	require.False(t, dispatchCalled)
	require.Equal(t, 0, queued.remainingExecs())
	require.Equal(t, 0, queued.remainingQueries())
}

func TestValidateReceiptChainLinks(t *testing.T) {
	t.Parallel()

	receipt := func(hash, prev string) json.RawMessage {
		return json.RawMessage(fmt.Sprintf(`{"hash":%q,"previous_hash":%q}`, hash, prev))
	}

	t.Run("empty batch is valid", func(t *testing.T) {
		head, err := validateReceiptChainLinks(nil)
		require.NoError(t, err)
		require.Equal(t, "", head)
	})

	t.Run("single genesis receipt is valid", func(t *testing.T) {
		head, err := validateReceiptChainLinks([]json.RawMessage{receipt("h0", "")})
		require.NoError(t, err)
		require.Equal(t, "h0", head)
	})

	t.Run("single receipt chained off prior history is valid", func(t *testing.T) {
		head, err := validateReceiptChainLinks([]json.RawMessage{receipt("h5", "h4")})
		require.NoError(t, err)
		require.Equal(t, "h5", head)
	})

	t.Run("contiguous chain is valid and returns the head", func(t *testing.T) {
		head, err := validateReceiptChainLinks([]json.RawMessage{
			receipt("h0", ""),
			receipt("h1", "h0"),
			receipt("h2", "h1"),
		})
		require.NoError(t, err)
		require.Equal(t, "h2", head)
	})

	t.Run("broken previous_hash is rejected", func(t *testing.T) {
		_, err := validateReceiptChainLinks([]json.RawMessage{
			receipt("h0", ""),
			receipt("h1", "h0"),
			receipt("h2", "WRONG"),
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "does not chain")
	})

	t.Run("missing hash is rejected", func(t *testing.T) {
		_, err := validateReceiptChainLinks([]json.RawMessage{
			receipt("h0", ""),
			receipt("", "h0"),
		})
		require.Error(t, err)
		require.Contains(t, err.Error(), "has no hash")
	})

	t.Run("non-object receipt is rejected", func(t *testing.T) {
		_, err := validateReceiptChainLinks([]json.RawMessage{json.RawMessage(`"not-an-object"`)})
		require.Error(t, err)
	})
}
