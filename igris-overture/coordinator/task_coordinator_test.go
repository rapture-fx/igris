package coordinator

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

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
	t.Parallel()

	taskID := uuid.New()
	runtimeID := "runtime-recovery-1"
	tenantID := "tenant-recovery"
	idempotencyKey := "idem-recovery"
	deadlineAt := time.Unix(1_900_000_000, 0).UTC()
	var gotBody map[string]any
	var gotTenantHeader string

	client := &http.Client{Transport: roundTripperFunc(func(r *http.Request) (*http.Response, error) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/v1/runtime/task/submit", r.URL.Path)
		gotTenantHeader = r.Header.Get("X-Igris-Tenant")

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
			{TaskID: taskID, StepIndex: 6, RuntimeID: runtimeID},
			{TaskID: taskID, StepIndex: 7, RuntimeID: runtimeID},
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
	require.Equal(t, taskID.String(), gotBody["task_id"])
	require.Equal(t, tenantID, gotBody["tenant_id"])
	require.Equal(t, idempotencyKey, gotBody["idempotency_key"])
	require.Equal(t, float64(deadlineAt.UnixMilli()), gotBody["deadline_ms"])

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

func ptrString(value string) *string {
	return &value
}

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (fn roundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}
