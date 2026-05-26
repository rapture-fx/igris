package api

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
)

func TestBuildActionTaskSubmitRequestHTTPAction(t *testing.T) {
	t.Parallel()

	deadline := time.Unix(1_700_000_000, 0).UTC()
	req, err := buildActionTaskSubmitRequest(actionRunRequest{
		Action: "github.create_issue",
		Input: map[string]interface{}{
			"method": "POST",
			"url":    "http://localhost:8787/issues",
			"body": map[string]interface{}{
				"title": "Bug from agent",
			},
		},
		Metadata: map[string]interface{}{
			"agent_id": "support-agent",
			"user_id":  "user_123",
		},
		RuntimeTarget: "http_request",
		DeadlineAt:    &deadline,
	}, "tenant-actions")
	require.NoError(t, err)
	require.Equal(t, "tenant-actions", req.TenantID)
	require.Equal(t, "execution_graph", req.TaskType)
	require.Equal(t, "support-agent", req.AgentIdentity.AgentID)
	require.Equal(t, "user_123", req.AgentIdentity.PrincipalID)
	require.Equal(t, &deadline, req.DeadlineAt)

	var def map[string]interface{}
	require.NoError(t, json.Unmarshal(req.TaskDefinition, &def))
	graph := def["graph"].(map[string]interface{})
	nodes := graph["nodes"].([]interface{})
	node := nodes[0].(map[string]interface{})
	require.Equal(t, "tool", node["kind"])
	require.Equal(t, "http_request", node["tool_name"])
	require.Equal(t, "github-create-issue-0", node["node_id"])
	args := node["args"].(map[string]interface{})
	require.Equal(t, "POST", args["method"])
	require.Equal(t, "http://localhost:8787/issues", args["url"])
	require.JSONEq(t, `{"title":"Bug from agent"}`, args["body"].(string))
}

func TestBuildActionTaskSubmitRequestRejectsUnmappedAction(t *testing.T) {
	t.Parallel()

	_, err := buildActionTaskSubmitRequest(actionRunRequest{
		Action: "github.create_issue",
		Input:  map[string]interface{}{"title": "Bug from agent"},
	}, "tenant-actions")
	require.Error(t, err)
	require.Contains(t, err.Error(), "runtime_target is required")
}

func TestBuildActionRunResponseDoesNotExposeRawProofOrSecrets(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	verified := true
	resp := buildActionRunResponse(&coordinator.TaskRecord{
		TaskID: taskID,
		Status: coordinator.TaskStatusCompleted,
		Proof: &coordinator.TaskProofState{
			ExecutionID: "exec_123",
			Status:      "verified",
			Signature:   "raw-signature-not-returned",
			StoredHash:  "raw-hash-not-returned",
			Verified:    &verified,
		},
		CreatedAt: time.Now().UTC(),
	})

	require.Equal(t, taskID.String(), resp["task_id"])
	require.Equal(t, "exec_123", resp["execution_id"])
	require.Equal(t, "verified", resp["proof_status"])
	raw, err := json.Marshal(resp)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "raw-signature-not-returned")
	require.NotContains(t, string(raw), "raw-hash-not-returned")
}
