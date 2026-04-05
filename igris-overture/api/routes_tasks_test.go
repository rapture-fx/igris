package api

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
)

func TestBuildTaskResponseIncludesFailureReasonAndCheckpointMetadata(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	runtimeID := "runtime-1"
	failureReason := "navigation canceled"
	createdAt := time.Unix(1_700_000_000, 0).UTC()
	completedAt := createdAt.Add(2 * time.Minute)

	task := &coordinator.TaskRecord{
		TaskID:         taskID,
		Status:         coordinator.TaskStatusFailed,
		RuntimeID:      &runtimeID,
		FailureReason:  &failureReason,
		CreatedAt:      createdAt,
		CompletedAt:    &completedAt,
		DeadlineAt:     &completedAt,
		TaskDefinition: json.RawMessage(`{"type":"robotics_workflow","steps":[{"step_index":1,"action":"cancel_navigation"}]}`),
		LastCheckpoint: &coordinator.CheckpointPayload{
			ResumeToken: coordinator.ResumeToken{
				LastCommittedStep: 3,
				CheckpointDigest:  "abc123",
			},
			Metadata: json.RawMessage(`{
				"domain":"robotics",
				"action":"cancel_navigation",
				"requested_mode":"quality",
				"resolved_strategy":"provider_race_quality",
				"graph_blackboard":{
					"last_node_id":"robotics-1",
					"nodes":{"robotics-1":{"status":"canceled"}},
					"slots":{"robotics.robotics_1":{"status":"canceled"}}
				}
			}`),
		},
	}

	resp := buildTaskResponse(task)

	require.Equal(t, taskID, resp["task_id"])
	require.Equal(t, coordinator.TaskStatusFailed, resp["status"])
	require.Equal(t, &runtimeID, resp["runtime_id"])
	require.Equal(t, failureReason, resp["failure_reason"])
	require.Equal(t, &completedAt, resp["deadline_at"])
	require.Equal(t, "robotics_workflow", resp["task_type"])
	require.Equal(t, "quality", resp["requested_mode"])
	require.Equal(t, "provider_race_quality", resp["resolved_strategy"])
	require.EqualValues(t, 3, resp["last_step"])
	require.Equal(t, "abc123", resp["checkpoint_digest"])
	require.NotNil(t, resp["checkpoint_metadata"])
	require.JSONEq(t, `{"last_node_id":"robotics-1","nodes":{"robotics-1":{"status":"canceled"}},"slots":{"robotics.robotics_1":{"status":"canceled"}}}`, string(resp["graph_blackboard"].(json.RawMessage)))
	require.JSONEq(t, `{"robotics-1":{"status":"canceled"}}`, string(resp["graph_nodes"].(json.RawMessage)))
	require.JSONEq(t, `{"robotics.robotics_1":{"status":"canceled"}}`, string(resp["graph_slots"].(json.RawMessage)))
}

func TestBuildTaskResponseOmitsEmptyOptionalFields(t *testing.T) {
	t.Parallel()

	task := &coordinator.TaskRecord{
		TaskID:    uuid.New(),
		Status:    coordinator.TaskStatusPending,
		CreatedAt: time.Unix(1_700_000_100, 0).UTC(),
	}

	resp := buildTaskResponse(task)

	require.NotContains(t, resp, "failure_reason")
	require.NotContains(t, resp, "deadline_at")
	require.NotContains(t, resp, "task_type")
	require.NotContains(t, resp, "requested_mode")
	require.NotContains(t, resp, "resolved_strategy")
	require.NotContains(t, resp, "last_step")
	require.NotContains(t, resp, "checkpoint_digest")
	require.NotContains(t, resp, "checkpoint_metadata")
}

func TestBuildTaskResponseReturnsFiberMap(t *testing.T) {
	t.Parallel()

	resp := buildTaskResponse(&coordinator.TaskRecord{
		TaskID:    uuid.New(),
		Status:    coordinator.TaskStatusCompleted,
		CreatedAt: time.Now().UTC(),
	})

	_, ok := any(resp).(fiber.Map)
	require.True(t, ok)
}

func TestBuildTaskSubmitRequestBuildsRoboticsMissionDefinition(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "robotics_workflow",
		"robotics_mission": {
			"name": "warehouse-patrol",
			"waypoints": [
				{"x": 1.5, "y": 2.5, "frame_id": "map"},
				{"x": 3.0, "y": 4.0}
			],
			"prompt": "scan aisle 3",
			"emit_zero_velocity_on_finish": true,
			"approval": {"required": true, "context": {"zone": "aisle-3"}}
		}
	}`)

	req, err := buildTaskSubmitRequest(body, "tenant-1")
	require.NoError(t, err)
	require.Equal(t, "tenant-1", req.TenantID)
	require.Equal(t, "robotics_workflow", req.TaskType)

	var definition struct {
		Steps []map[string]any `json:"steps"`
	}
	require.NoError(t, json.Unmarshal(req.TaskDefinition, &definition))
	require.Len(t, definition.Steps, 4)
	require.Equal(t, "navigate_to_pose", definition.Steps[0]["action"])
	require.Equal(t, "publish_prompt", definition.Steps[2]["action"])
	require.Equal(t, "publish_zero_velocity", definition.Steps[3]["action"])

	approval, ok := definition.Steps[0]["approval"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, true, approval["required"])
	require.Equal(t, "warehouse-patrol:navigate_to_pose", approval["task"])
}

func TestBuildTaskSubmitRequestRejectsAmbiguousMissionInput(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "robotics_workflow",
		"task_definition": {"steps": [{"step_index":1,"action":"publish_zero_velocity"}]},
		"robotics_mission": {"prompt": "hello"}
	}`)

	_, err := buildTaskSubmitRequest(body, "tenant-1")
	require.ErrorIs(t, err, coordinator.ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "only one of task_definition, agent_task, or robotics_mission")
}

func TestBuildTaskSubmitRequestRejectsMissionOnWrongTaskType(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "single_inference",
		"robotics_mission": {"prompt": "hello"}
	}`)

	_, err := buildTaskSubmitRequest(body, "tenant-1")
	require.ErrorIs(t, err, coordinator.ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "task_type=robotics_workflow")
}

func TestBuildTaskSubmitRequestRejectsEmptyRoboticsMission(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "robotics_workflow",
		"robotics_mission": {"name": "empty"}
	}`)

	_, err := buildTaskSubmitRequest(body, "tenant-1")
	require.ErrorIs(t, err, coordinator.ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "must include at least one waypoint, prompt, or velocity action")
}

func TestBuildTaskSubmitRequestBuildsSingleInferenceAgentTask(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "single_inference",
		"agent_task": {
			"name": "summarize-ticket",
			"model": "gpt-4.1-mini",
			"messages": [{"role":"user","content":"summarize this incident"}],
			"mode": "council",
			"memory": {"recall_query":"incident history","store_output":true},
			"approval": {"required": true}
		}
	}`)

	req, err := buildTaskSubmitRequest(body, "tenant-2")
	require.NoError(t, err)
	require.Equal(t, "single_inference", req.TaskType)

	var definition map[string]any
	require.NoError(t, json.Unmarshal(req.TaskDefinition, &definition))
	require.Equal(t, "gpt-4.1-mini", definition["model"])
	require.Equal(t, "council", definition["mode"])
	require.NotNil(t, definition["memory"])
	require.NotNil(t, definition["approval"])
}

func TestBuildTaskSubmitRequestBuildsExecutionGraphAgentTask(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "execution_graph",
		"agent_task": {
			"name": "reasoning-graph",
			"steps": [
				{
					"model": "gpt-4.1-mini",
					"messages": [{"role":"user","content":"plan route"}]
				}
			]
		}
	}`)

	req, err := buildTaskSubmitRequest(body, "tenant-graph-agent")
	require.NoError(t, err)
	require.Equal(t, "execution_graph", req.TaskType)

	var definition struct {
		Graph struct {
			GraphID string                   `json:"graph_id"`
			Nodes   []map[string]interface{} `json:"nodes"`
		} `json:"graph"`
	}
	require.NoError(t, json.Unmarshal(req.TaskDefinition, &definition))
	require.Equal(t, "reasoning-graph", definition.Graph.GraphID)
	require.Len(t, definition.Graph.Nodes, 1)
	require.Equal(t, "reason", definition.Graph.Nodes[0]["kind"])
	require.Equal(t, "reasoning-graph-0", definition.Graph.Nodes[0]["node_id"])
	require.Equal(t, "reason.reasoning_graph_0", definition.Graph.Nodes[0]["write_slot"])
}

func TestBuildTaskSubmitRequestBuildsAgentWorkflowFromSteps(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "agent_workflow",
		"agent_task": {
			"name": "triage-flow",
			"steps": [
				{
					"model": "gpt-4.1-mini",
					"messages": [{"role":"system","content":"classify"}]
				},
				{
					"model": "gpt-4.1-mini",
					"messages": [{"role":"user","content":"draft response"}],
					"approval": {"required": true}
				}
			]
		}
	}`)

	req, err := buildTaskSubmitRequest(body, "tenant-3")
	require.NoError(t, err)
	require.Equal(t, "agent_workflow", req.TaskType)

	var definition struct {
		Steps []map[string]any `json:"steps"`
	}
	require.NoError(t, json.Unmarshal(req.TaskDefinition, &definition))
	require.Len(t, definition.Steps, 2)
	require.EqualValues(t, 1, definition.Steps[0]["step_index"])
	require.EqualValues(t, 2, definition.Steps[1]["step_index"])
	approval, ok := definition.Steps[1]["approval"].(map[string]any)
	require.True(t, ok)
	require.Equal(t, "triage-flow:agent_step", approval["task"])
}

func TestBuildTaskSubmitRequestBuildsExecutionGraphRoboticsMission(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "execution_graph",
		"robotics_mission": {
			"name": "robot-graph",
			"waypoints": [
				{"x": 2.0, "y": 3.0, "frame_id": "map"}
			],
			"prompt": "inspect station"
		}
	}`)

	req, err := buildTaskSubmitRequest(body, "tenant-graph-robotics")
	require.NoError(t, err)
	require.Equal(t, "execution_graph", req.TaskType)

	var definition struct {
		Graph struct {
			Nodes []map[string]interface{} `json:"nodes"`
		} `json:"graph"`
	}
	require.NoError(t, json.Unmarshal(req.TaskDefinition, &definition))
	require.Len(t, definition.Graph.Nodes, 2)
	require.Equal(t, "robotics", definition.Graph.Nodes[0]["kind"])
	require.Equal(t, "navigate_to_pose", definition.Graph.Nodes[0]["action"])
	require.Equal(t, "robotics.robot_graph_0", definition.Graph.Nodes[0]["write_slot"])
	require.Equal(t, "publish_prompt", definition.Graph.Nodes[1]["action"])
	require.Equal(t, "robotics.robot_graph_1", definition.Graph.Nodes[1]["write_slot"])
}

func TestBuildTaskSubmitRequestRejectsAgentTaskOnWrongTaskType(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "robotics_workflow",
		"agent_task": {
			"model": "gpt-4.1-mini",
			"messages": [{"role":"user","content":"hello"}]
		}
	}`)

	_, err := buildTaskSubmitRequest(body, "tenant-4")
	require.ErrorIs(t, err, coordinator.ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "agent_task is only valid with task_type=single_inference, task_type=agent_workflow, or task_type=execution_graph")
}

func TestBuildTaskSubmitRequestRejectsAgentWorkflowStepsOnSingleInference(t *testing.T) {
	t.Parallel()

	body := []byte(`{
		"task_type": "single_inference",
		"agent_task": {
			"steps": [
				{
					"model": "gpt-4.1-mini",
					"messages": [{"role":"user","content":"hello"}]
				}
			]
		}
	}`)

	_, err := buildTaskSubmitRequest(body, "tenant-5")
	require.ErrorIs(t, err, coordinator.ErrInvalidTaskDefinition)
	require.Contains(t, err.Error(), "agent_task.steps is only valid with task_type=agent_workflow")
}
