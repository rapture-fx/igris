package api

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/executionevals"
)

func TestExecutionEvalCreateRejectsTenantOverride(t *testing.T) {
	t.Parallel()

	db, driver := newQueuedRouteDB(t, nil)
	app := executionEvalTestApp("tenant-a")
	app.Post("/v1/execution-evals", handleExecutionEvalCreate(&executionevals.SQLStore{DB: db}))

	req := httptest.NewRequest(http.MethodPost, "/v1/execution-evals", strings.NewReader(`{
		"tenant_id":"tenant-b",
		"name":"Billing eval",
		"assertions_json":[{"name":"proof","type":"proof_generated"}]
	}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, driver.remainingQueries())
	require.Zero(t, driver.remainingExecs())
}

func TestExecutionEvalCreateIsTenantScoped(t *testing.T) {
	t.Parallel()

	now := time.Now().UTC()
	evalID := "11111111-1111-1111-1111-111111111111"
	db, driver := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: executionEvalColumns(),
		rows: [][]driver.Value{{
			evalID, "tenant-a", "Billing eval", "", "charge_customer", "",
			[]byte(`[{"name":"called","type":"action_called","action_name":"charge_customer"}]`),
			true, now, now, nil,
		}},
		checkArgs: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "INSERT INTO execution_evals")
			require.Equal(t, "tenant-a", args[0].Value)
		},
	}})
	app := executionEvalTestApp("tenant-a")
	app.Post("/v1/execution-evals", handleExecutionEvalCreate(&executionevals.SQLStore{DB: db}))

	req := httptest.NewRequest(http.MethodPost, "/v1/execution-evals", strings.NewReader(`{
		"name":"Billing eval",
		"target_action_name":"charge_customer",
		"assertions_json":[{"name":"called","type":"action_called","action_name":"charge_customer"}]
	}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	require.Zero(t, driver.remainingQueries())
}

func TestExecutionEvalCrossTenantGetReturnsSafeNotFound(t *testing.T) {
	t.Parallel()

	db, driver := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: executionEvalColumns(),
		err:     sql.ErrNoRows,
		checkArgs: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "tenant_id = $1")
			require.Equal(t, "tenant-a", args[0].Value)
		},
	}})
	app := executionEvalTestApp("tenant-a")
	app.Get("/v1/execution-evals/:id", handleExecutionEvalGet(&executionevals.SQLStore{DB: db}))

	req := httptest.NewRequest(http.MethodGet, "/v1/execution-evals/22222222-2222-2222-2222-222222222222", nil)
	resp, err := app.Test(req)

	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
	require.Zero(t, driver.remainingQueries())
}

func TestExecutionEvalRunRejectsBodyTenantIDBeforeLookup(t *testing.T) {
	t.Parallel()

	db, driver := newQueuedRouteDB(t, nil)
	app := executionEvalTestApp("tenant-a")
	app.Post("/v1/execution-evals/:id/run", handleExecutionEvalRun(&executionevals.SQLStore{DB: db}))

	req := httptest.NewRequest(http.MethodPost, "/v1/execution-evals/11111111-1111-1111-1111-111111111111/run", strings.NewReader(`{
		"tenant_id":"tenant-b",
		"task_id":"33333333-3333-3333-3333-333333333333"
	}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)

	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, driver.remainingQueries())
}

func TestExecutionEvalRunsForEvalAreTenantScoped(t *testing.T) {
	t.Parallel()

	now := time.Now().UTC()
	evalID := "11111111-1111-1111-1111-111111111111"
	runID := "22222222-2222-2222-2222-222222222222"
	taskID := "33333333-3333-3333-3333-333333333333"
	db, driver := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: executionEvalColumns(),
			rows: [][]driver.Value{{
				evalID, "tenant-a", "Billing eval", "", "charge_customer", "",
				[]byte(`[{"name":"proof","type":"proof_generated"}]`),
				true, now, now, nil,
			}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "tenant_id = $1")
				require.Equal(t, "tenant-a", args[0].Value)
			},
		},
		{
			columns: executionEvalRunColumns(),
			rows: [][]driver.Value{{
				runID, "tenant-a", evalID, taskID, "exec-1", "failed", int64(1), int64(1),
				[]byte(`[{"name":"proof","status":"failed","reason":"proof or receipt state was not recorded"}]`),
				now, "Billing eval",
			}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INNER JOIN execution_evals")
				require.Equal(t, "tenant-a", args[0].Value)
				require.Equal(t, evalID, args[1].Value)
			},
		},
	})
	app := executionEvalTestApp("tenant-a")
	app.Get("/v1/execution-evals/:id/runs", handleExecutionEvalRunsForEvalGet(&executionevals.SQLStore{DB: db}))

	req := httptest.NewRequest(http.MethodGet, "/v1/execution-evals/"+evalID+"/runs?limit=5", nil)
	resp, err := app.Test(req)

	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Zero(t, driver.remainingQueries())
}

func TestExecutionEvalResultsJSONRejectsUnsafePayload(t *testing.T) {
	t.Parallel()

	_, err := executionevals.ResultsJSON([]executionevals.AssertionResult{{
		Name:   "safe",
		Status: executionevals.StatusFailed,
		Reason: "bearer token leaked",
	}})
	require.Error(t, err)

	results, passed, failed := executionevals.RunAssertions([]executionevals.Assertion{{
		Name: "no secret", Type: executionevals.TypeNoSecretLeak,
	}}, executionevals.ExecutionTruth{})
	require.Equal(t, 1, passed)
	require.Equal(t, 0, failed)
	raw, err := executionevals.ResultsJSON(results)
	require.NoError(t, err)
	require.NotContains(t, strings.ToLower(string(raw)), "bearer")
	require.True(t, json.Valid(raw))
}

func executionEvalTestApp(tenantID string) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	return app
}

func executionEvalColumns() []string {
	return []string{
		"eval_id", "tenant_id", "name", "description", "target_action_name", "target_agent_id",
		"assertions_json", "enabled", "created_at", "updated_at", "archived_at",
	}
}

func executionEvalRunColumns() []string {
	return []string{
		"eval_run_id", "tenant_id", "eval_id", "task_id", "execution_id", "status",
		"passed_count", "failed_count", "results_json", "created_at", "eval_name",
	}
}
