package coordinator

import (
	"encoding/json"
	"testing"

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
