package api

import (
	"database/sql/driver"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
)

// approvalTaskRecordRow builds a full task_records row (matching GetTask's
// SELECT) for the approval route tests. Most columns are nil; only the fields the
// approval path reads are populated.
func approvalTaskRecordRow(taskID uuid.UUID, tenantID string, status coordinator.TaskRecordStatus) []driver.Value {
	return []driver.Value{
		taskID.String(), tenantID, string(status), "", "",
		[]byte(`{"type":"single_inference","prompt":"hi","model":"local"}`), nil, nil, nil,
		nil, nil, nil, nil, nil, nil,
		nil, nil, nil, nil, nil, nil, nil,
		"idem-" + taskID.String(), nil, nil,
		nil, nil, nil, nil, time.Unix(1_900_600_000, 0).UTC(), nil, nil, nil, nil,
	}
}

func approvalTaskRecordColumns() []string {
	return []string{
		"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
		"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
		"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
		"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
		"idempotency_key", "failure_reason", "failure_details",
		"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason", "registered_agent_id", "registered_agent_name",
	}
}

func TestHandleActionApproveRunRequiresAuth(t *testing.T) {
	t.Parallel()

	app := fiber.New() // no tenant injected
	app.Post("/v1/actions/runs/:id/approve", handleActionApproveRun(coordinator.NewTaskCoordinator(nil)))

	req := httptest.NewRequest(http.MethodPost, "/v1/actions/runs/"+uuid.NewString()+"/approve", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestHandleActionApproveRunInvalidID(t *testing.T) {
	t.Parallel()

	app := actionTestApp()
	app.Post("/v1/actions/runs/:id/approve", handleActionApproveRun(coordinator.NewTaskCoordinator(nil)))

	req := httptest.NewRequest(http.MethodPost, "/v1/actions/runs/not-a-uuid/approve", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestHandleActionApproveRunNotFoundIsTenantScoped(t *testing.T) {
	taskID := uuid.New()
	db, drv := newQueuedExecRouteDB(t, []queuedRouteQueryExpectation{
		// Tenant-scoped GetTask returns no rows for another tenant's run.
		{columns: approvalTaskRecordColumns()},
	})
	app := actionTestApp()
	app.Post("/v1/actions/runs/:id/approve", handleActionApproveRun(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/actions/runs/"+taskID.String()+"/approve", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
	require.Equal(t, 0, drv.remainingQueries())
	require.Equal(t, 0, drv.remainingExecs())
}

func TestHandleActionRejectRunInvalidState(t *testing.T) {
	taskID := uuid.New()
	db, drv := newQueuedExecRouteDB(t, []queuedRouteQueryExpectation{
		{columns: approvalTaskRecordColumns(), rows: [][]driver.Value{approvalTaskRecordRow(taskID, "tenant-a", coordinator.TaskStatusCompleted)}},
	})
	app := actionTestApp()
	app.Post("/v1/actions/runs/:id/reject", handleActionRejectRun(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/actions/runs/"+taskID.String()+"/reject", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)

	raw, _ := io.ReadAll(resp.Body)
	require.Contains(t, string(raw), "not_awaiting_approval")
	require.Equal(t, 0, drv.remainingQueries())
	require.Equal(t, 0, drv.remainingExecs())
}

// TestHandleActionRejectRunMarksRejectedWithoutDispatch proves the reject route
// resolves the run terminally and never selects a runtime or dispatches: only the
// GetTask read and the terminal task_records transition run.
func TestHandleActionRejectRunMarksRejectedWithoutDispatch(t *testing.T) {
	taskID := uuid.New()
	db, drv := newQueuedExecRouteDB(t, []queuedRouteQueryExpectation{
		{columns: approvalTaskRecordColumns(), rows: [][]driver.Value{approvalTaskRecordRow(taskID, "tenant-a", coordinator.TaskStatusApprovalRequired)}},
	}, queuedRouteExecExpectation{
		rowsAffected: 1,
		check: func(query string, _ []driver.NamedValue) {
			require.Contains(t, query, "UPDATE task_records")
		},
	})
	app := actionTestApp()
	app.Post("/v1/actions/runs/:id/reject", handleActionRejectRun(coordinator.NewTaskCoordinator(db)))

	req := httptest.NewRequest(http.MethodPost, "/v1/actions/runs/"+taskID.String()+"/reject", strings.NewReader(`{"reason":"policy violation"}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "rejected", body["decision"])
	require.Equal(t, false, body["dispatched"])
	require.Equal(t, taskID.String(), body["run_id"])

	// A runtime lookup would have needed a second query; none was queued/consumed.
	require.Equal(t, 0, drv.remainingQueries())
	require.Equal(t, 0, drv.remainingExecs())
}
