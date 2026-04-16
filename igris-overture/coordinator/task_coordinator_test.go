package coordinator

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"io"
	"net/http"
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
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
		idempotencyKey,
		failureReason,
		failureDetailBytes,
		nil,
		nil,
		nil,
		nil,
		createdAt,
	}
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
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at",
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
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at",
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
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at",
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
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at",
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
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at",
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
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at",
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
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at",
				},
				values: taskRecordRowForRecoveryTest(taskID, tenantID, TaskStatusDispatched, newRuntimeID, "http://new-runtime.test", taskDefinition, checkpoint, idempotencyKey, createdAt),
			},
		},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 1},
		queuedExecExpectation{rowsAffected: 1},
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
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at",
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
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at",
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
		metadata, ok := resumeCheckpoint["metadata"].(map[string]any)
		require.True(t, ok)
		require.Equal(t, wantTickCount, metadata["tick_count"])
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for recovery redispatch")
	}

	require.Equal(t, 0, queued.remainingExecs())
	require.Equal(t, 0, queued.remainingQueries())
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
					"idempotency_key", "failure_reason", "failure_details",
					"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at",
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
