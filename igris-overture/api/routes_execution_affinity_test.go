package api

import (
	"database/sql/driver"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"
)

func TestExecutionAffinityHandlerReturnsTenantScopedAggregates(t *testing.T) {
	t.Parallel()

	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{
				"action_name", "action_display_name", "pack_name", "run_count",
				"successful_runs", "failed_runs", "approval_required_runs", "recovery_runs",
				"eval_run_count", "eval_passed_runs", "proof_covered_runs",
			},
			rows: [][]driver.Value{{
				"send_email", "Send email", "starter", int64(10),
				int64(8), int64(1), int64(6), int64(2),
				int64(5), int64(4), int64(7),
			}},
			checkArgs: requireAffinityArgs(t, "agent-1"),
		},
		{
			columns: []string{
				"agent_id", "agent_name", "agent_type", "action_name", "action_display_name",
				"pack_name", "run_count", "successful_runs", "failed_runs", "approval_required_runs",
				"recovery_runs", "eval_run_count", "eval_passed_runs", "proof_covered_runs",
			},
			rows: [][]driver.Value{{
				"agent-1", "Claude Code Agent", "operator", "send_email", "Send email",
				"starter", int64(10), int64(8), int64(1), int64(6),
				int64(2), int64(5), int64(4), int64(7),
			}},
			checkArgs: requireAffinityArgs(t, "agent-1"),
		},
		{
			columns: []string{
				"pack_name", "action_name", "action_display_name", "agent_id", "agent_name",
				"run_count", "successful_runs", "approval_required_runs", "recovery_runs",
				"eval_run_count", "eval_passed_runs", "proof_covered_runs",
			},
			rows: [][]driver.Value{{
				"starter", "send_email", "Send email", "agent-1", "Claude Code Agent",
				int64(10), int64(8), int64(6), int64(2), int64(5), int64(4), int64(7),
			}},
			checkArgs: requireAffinityArgs(t, "agent-1"),
		},
	})

	app := fiber.New()
	app.Get("/v1/execution/affinity", func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-a")
		return handleExecutionAffinity(db)(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/v1/execution/affinity?range=last_30d&agent_id=agent-1", nil)
	res, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, res.StatusCode)

	var body executionAffinityResponse
	require.NoError(t, json.NewDecoder(res.Body).Decode(&body))
	require.Equal(t, "last_30d", body.Range)
	require.Equal(t, executionAffinitySource, body.Source)
	require.Len(t, body.AgentActions, 1)
	require.Equal(t, "send_email", body.AgentActions[0].ActionName)
	require.Equal(t, 0.8, body.AgentActions[0].SuccessRate)
	require.Len(t, body.ActionAgents, 1)
	require.Equal(t, "agent-1", body.ActionAgents[0].AgentID)
	require.Len(t, body.PackEdges, 1)
	require.Equal(t, "starter", body.PackEdges[0].PackName)
	require.NotEmpty(t, body.Hotspots)
	require.Empty(t, drv.queries)
}

func TestExecutionAffinityRejectsOversizedFilters(t *testing.T) {
	t.Parallel()

	err := validateAffinityFilters(executionAffinityFilters{ActionName: strings.Repeat("a", affinityMaxFilterLen+1)})
	require.Error(t, err)
}

func TestBuildExecutionAffinityHotspotsUsesObservationsOnly(t *testing.T) {
	t.Parallel()

	actions := []executionAffinityAction{{
		ActionName:           "charge_customer",
		RunCount:             10,
		SuccessfulRuns:       8,
		ApprovalRequiredRuns: 6,
		RecoveryRuns:         2,
		EvalRunCount:         5,
		EvalPassedRuns:       4,
		ProofCoveredRuns:     7,
	}}
	actions[0].fillRates()

	hotspots := buildExecutionAffinityHotspots(actions, nil)
	require.Len(t, hotspots, 4)
	for _, hotspot := range hotspots {
		require.Equal(t, "action", hotspot.Scope)
		require.NotContains(t, strings.ToLower(hotspot.Observation), "recommend")
		require.NotContains(t, strings.ToLower(hotspot.Observation), "confidence")
		require.NotContains(t, strings.ToLower(hotspot.Observation), "score")
	}
}

func requireAffinityArgs(t *testing.T, filter string) func(string, []driver.NamedValue) {
	t.Helper()
	return func(query string, args []driver.NamedValue) {
		require.Contains(t, query, "WHERE tr.tenant_id = $1")
		require.Len(t, args, 2)
		require.Equal(t, "tenant-a", args[0].Value)
		require.Equal(t, filter, args[1].Value)
	}
}
