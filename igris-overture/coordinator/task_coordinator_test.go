package coordinator

import (
	"database/sql/driver"
	"encoding/json"
	"testing"

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
