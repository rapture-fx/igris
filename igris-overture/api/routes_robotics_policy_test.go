package api

import (
	"database/sql/driver"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func roboticsPolicyRouteColumns() []string {
	return []string{
		"tenant_id",
		"policy_version",
		"status",
		"permit",
		"runtime_permitted",
		"robot_mode",
		"allowed_runtimes",
		"active",
		"expires_at",
		"activated_at",
		"expired_at",
		"revoked_at",
		"created_by",
		"updated_by",
		"revoked_by",
		"created_at",
		"updated_at",
	}
}

func roboticsPolicyRouteRow(status string, active bool) []driver.Value {
	now := time.Unix(1_900_100_000, 0).UTC()
	var activatedAt driver.Value
	if active {
		activatedAt = now
	}
	return []driver.Value{
		"tenant-robotics-policy",
		"robotics-policy.v2",
		status,
		true,
		true,
		"supervised",
		`["runtime-a","runtime-b"]`,
		active,
		nil,
		activatedAt,
		nil,
		nil,
		"tenant-robotics-policy",
		"tenant-robotics-policy",
		nil,
		now,
		now,
	}
}

func roboticsPolicyTestApp(tenantID string) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	return app
}

func TestCreateDraftRoboticsPolicyRoute(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: roboticsPolicyRouteColumns(),
		rows:    [][]driver.Value{roboticsPolicyRouteRow("draft", false)},
	}})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Post("/v1/robotics/policies", createDraftRoboticsPolicy(db))

	req := httptest.NewRequest(http.MethodPost, "/v1/robotics/policies", strings.NewReader(`{
		"policy_version":"robotics-policy.v2",
		"permit":true,
		"runtime_permitted":true,
		"robot_mode":"supervised",
		"allowed_runtimes":["runtime-a","runtime-b","runtime-a"]
	}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var body roboticsPolicyResponse
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "tenant-robotics-policy", body.TenantID)
	require.Equal(t, "robotics-policy.v2", body.PolicyVersion)
	require.Equal(t, "draft", body.Status)
	require.False(t, body.Active)
	require.Equal(t, []string{"runtime-a", "runtime-b"}, body.AllowedRuntimes)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestActivateRoboticsPolicyRoute(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: roboticsPolicyRouteColumns(),
		rows:    [][]driver.Value{roboticsPolicyRouteRow("active", true)},
	}}, queuedRouteExecExpectation{rowsAffected: 1})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Post("/v1/robotics/policies/:version/activate", activateRoboticsPolicy(db))

	req := httptest.NewRequest(http.MethodPost, "/v1/robotics/policies/robotics-policy.v2/activate", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body roboticsPolicyResponse
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "active", body.Status)
	require.True(t, body.Active)
	require.NotNil(t, body.ActivatedAt)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestListRoboticsReceiptsRouteFiltersAuditIndex(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	persistedAt := time.Unix(1_900_200_000, 0).UTC()
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{
			"task_id",
			"tenant_id",
			"runtime_id",
			"execution_id",
			"policy_decision_id",
			"policy_decision_hash",
			"governed_action_hash",
			"robot_action",
			"routing_decision",
			"receipt_hash",
			"receipt_signature",
			"envelope_signature",
			"violation_occurred",
			"violation",
			"execution_envelope",
			"execution_receipt",
			"persisted_at",
		},
		rows: [][]driver.Value{{
			taskID.String(),
			"tenant-robotics-policy",
			"runtime-a",
			"exec-robotics-1",
			"decision-1",
			"policy-hash-1",
			"action-hash-1",
			"publish_zero_velocity",
			"ros2:publish_zero_velocity",
			"receipt-hash-1",
			"receipt-sig",
			"env-sig",
			false,
			"",
			[]byte(`{"execution_id":"exec-robotics-1"}`),
			[]byte(`{"execution_id":"exec-robotics-1"}`),
			persistedAt,
		}},
	}})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Get("/v1/receipts/robotics", listRoboticsReceipts(db))

	req := httptest.NewRequest(http.MethodGet, "/v1/receipts/robotics?task_id="+taskID.String()+"&policy_decision_id=decision-1&robot_action=publish_zero_velocity", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body struct {
		Receipts []struct {
			TaskID           uuid.UUID `json:"task_id"`
			PolicyDecisionID string    `json:"policy_decision_id"`
			RobotAction      string    `json:"robot_action"`
			ReceiptHash      string    `json:"receipt_hash"`
		} `json:"receipts"`
		Total int `json:"total"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, 1, body.Total)
	require.Len(t, body.Receipts, 1)
	require.Equal(t, taskID, body.Receipts[0].TaskID)
	require.Equal(t, "decision-1", body.Receipts[0].PolicyDecisionID)
	require.Equal(t, "publish_zero_velocity", body.Receipts[0].RobotAction)
	require.Equal(t, "receipt-hash-1", body.Receipts[0].ReceiptHash)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}
