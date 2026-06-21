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

// policySimTestApp mounts the simulate handler behind a stub that injects a
// tenant id, mirroring how BetterAuth populates the request locals in prod.
func policySimTestApp(tenantID string) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	return app
}

func postPolicySim(t *testing.T, app *fiber.App, body string) *http.Response {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/v1/policy/simulate", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	return resp
}

// ── Pure impact math ────────────────────────────────────────────────────────

func TestComputePolicyImpactRequireApproval(t *testing.T) {
	t.Parallel()
	allow, approval, block := computePolicyImpact(142, 18, policySimMode_RequireApproval)
	require.Equal(t, int64(124), allow)
	require.Equal(t, int64(18), approval)
	require.Equal(t, int64(0), block)
}

func TestComputePolicyImpactBlock(t *testing.T) {
	t.Parallel()
	allow, approval, block := computePolicyImpact(50, 12, policySimMode_Block)
	require.Equal(t, int64(38), allow)
	require.Equal(t, int64(0), approval)
	require.Equal(t, int64(12), block)
}

func TestComputePolicyImpactClampsAndEmptyWindow(t *testing.T) {
	t.Parallel()
	// affected can never exceed total.
	allow, approval, _ := computePolicyImpact(5, 9, policySimMode_RequireApproval)
	require.Equal(t, int64(0), allow)
	require.Equal(t, int64(5), approval)

	allow, approval, block := computePolicyImpact(0, 0, policySimMode_Block)
	require.Equal(t, int64(0), allow)
	require.Equal(t, int64(0), approval)
	require.Equal(t, int64(0), block)
}

func TestPolicySimRangeToInterval(t *testing.T) {
	t.Parallel()
	for token, want := range map[string]string{"24h": "24 hours", "7d": "7 days", "30d": "30 days"} {
		got, ok := policySimRangeToInterval(token)
		require.True(t, ok, token)
		require.Equal(t, want, got)
	}
	for _, bad := range []string{"", "1h", "90d", "all", "last_30d", "30 days"} {
		_, ok := policySimRangeToInterval(bad)
		require.False(t, ok, bad)
	}
}

// ── Match-clause construction (parameterization + escaping) ──────────────────

func TestBuildPolicyMatchClauseNoCriteria(t *testing.T) {
	t.Parallel()
	clause, args, has := buildPolicyMatchClause(policySimulateRequest{})
	require.False(t, has)
	require.Equal(t, "false", clause)
	require.Empty(t, args)
}

func TestBuildPolicyMatchClauseBindsEveryValueAsParam(t *testing.T) {
	t.Parallel()
	clause, args, has := buildPolicyMatchClause(policySimulateRequest{
		MatchActionName:         "stripe.refund_payment",
		MatchActionPrefix:       "stripe.",
		MatchAgentID:            "agent-7",
		MatchAgentType:          "claude_code",
		MatchResultStatus:       "completed",
		RequireProofMissing:     true,
		RequireRecoveryOccurred: true,
		RequireEvalFailed:       true,
	})
	require.True(t, has)
	// Parameters are numbered from $2 ($1 is always tenant_id) in field order.
	require.Contains(t, clause, "b.action_name = $2")
	require.Contains(t, clause, "b.action_name LIKE $3 ESCAPE '\\'")
	require.Contains(t, clause, "b.agent_id = $4")
	require.Contains(t, clause, "b.agent_type = $5")
	require.Contains(t, clause, "b.status = $6")
	// Boolean predicates carry no user value, so they take no parameter.
	require.Contains(t, clause, "b.proof_covered = false")
	require.Contains(t, clause, "b.had_recovery = true")
	require.Contains(t, clause, "b.eval_failed = true")
	// No raw user value is ever concatenated into the SQL string itself.
	require.NotContains(t, clause, "stripe")
	require.NotContains(t, clause, "agent-7")
	require.Equal(t, []interface{}{"stripe.refund_payment", "stripe.%", "agent-7", "claude_code", "completed"}, args)
}

func TestEscapeLikePrefixNeutralizesWildcards(t *testing.T) {
	t.Parallel()
	require.Equal(t, `stripe\_`, escapeLikePrefix("stripe_"))
	require.Equal(t, `a\%b`, escapeLikePrefix("a%b"))
	require.Equal(t, `c\\d`, escapeLikePrefix(`c\d`))
}

// ── Request validation / hostile input ──────────────────────────────────────

func TestPolicySimulateRejectsTenantOverride(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	app := policySimTestApp("tenant-a")
	app.Post("/v1/policy/simulate", handlePolicySimulate(db))

	resp := postPolicySim(t, app, `{"tenant_id":"tenant-b","range":"30d","policy_mode":"block"}`)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestPolicySimulateRejectsUnknownField(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	app := policySimTestApp("tenant-a")
	app.Post("/v1/policy/simulate", handlePolicySimulate(db))

	resp := postPolicySim(t, app, `{"range":"30d","policy_mode":"block","evil":"drop table"}`)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

func TestPolicySimulateRejectsInvalidRangeAndMode(t *testing.T) {
	t.Parallel()
	db, _ := newQueuedRouteDB(t, nil)
	app := policySimTestApp("tenant-a")
	app.Post("/v1/policy/simulate", handlePolicySimulate(db))

	bad := postPolicySim(t, app, `{"range":"90d","policy_mode":"block"}`)
	require.Equal(t, http.StatusBadRequest, bad.StatusCode)

	badMode := postPolicySim(t, app, `{"range":"30d","policy_mode":"delete_everything"}`)
	require.Equal(t, http.StatusBadRequest, badMode.StatusCode)

	badStatus := postPolicySim(t, app, `{"range":"30d","policy_mode":"block","match_result_status":"haxx"}`)
	require.Equal(t, http.StatusBadRequest, badStatus.StatusCode)
}

func TestPolicySimulateUnauthenticated(t *testing.T) {
	t.Parallel()
	db, _ := newQueuedRouteDB(t, nil)
	app := policySimTestApp("") // empty tenant
	app.Post("/v1/policy/simulate", handlePolicySimulate(db))

	resp := postPolicySim(t, app, `{"range":"30d","policy_mode":"block"}`)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

// ── End-to-end deterministic simulation (tenant scoping + math + safe output) ─

func decodePolicySimResponse(t *testing.T, resp *http.Response) policySimulateResponse {
	t.Helper()
	var out policySimulateResponse
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&out))
	return out
}

func TestPolicySimulateRequireApprovalMathAndScoping(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{ // counts: 142 considered, 18 affected
			columns: []string{"total", "affected"},
			rows:    [][]driver.Value{{int64(142), int64(18)}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM base b")
				require.Contains(t, query, "FILTER (WHERE")
				require.Equal(t, "tenant-a", args[0].Value) // $1 is always tenant
				require.Equal(t, "stripe.refund_payment", args[1].Value)
			},
		},
		{ // affected agents
			columns: []string{"key", "name", "run_count"},
			rows:    [][]driver.Value{{"agent-1", "claude-production", int64(18)}},
		},
		{ // affected actions
			columns: []string{"name", "run_count"},
			rows:    [][]driver.Value{{"stripe.refund_payment", int64(18)}},
		},
		{ // sample runs
			columns: []string{"task_id", "status"},
			rows:    [][]driver.Value{{"task-1", "completed"}, {"task-2", "completed"}},
		},
	})

	app := policySimTestApp("tenant-a")
	app.Post("/v1/policy/simulate", handlePolicySimulate(db))

	resp := postPolicySim(t, app, `{"range":"30d","policy_mode":"require_approval","match_action_name":"stripe.refund_payment"}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body := decodePolicySimResponse(t, resp)
	require.Equal(t, "30d", body.Range)
	require.Equal(t, "require_approval", body.PolicyMode)
	require.Equal(t, int64(142), body.TotalRunsConsidered)
	require.Equal(t, int64(124), body.WouldAllow)
	require.Equal(t, int64(18), body.WouldRequireApproval)
	require.Equal(t, int64(0), body.WouldBlock)
	require.Equal(t, int64(18), body.AffectedRunCount)
	require.Len(t, body.AffectedAgents, 1)
	require.Equal(t, "claude-production", body.AffectedAgents[0].Name)
	require.Len(t, body.AffectedActions, 1)
	require.Equal(t, "stripe.refund_payment", body.AffectedActions[0].Name)
	require.Len(t, body.SampleRuns, 2)
	require.Equal(t, "task-1", body.SampleRuns[0].TaskID)
	// All four bounded queries were consumed; nothing was executed (no mutation).
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestPolicySimulateBlockMode(t *testing.T) {
	t.Parallel()
	db, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{columns: []string{"total", "affected"}, rows: [][]driver.Value{{int64(40), int64(6)}}},
		{columns: []string{"key", "name", "run_count"}, rows: [][]driver.Value{{"unattributed", "unattributed", int64(6)}}},
		{columns: []string{"name", "run_count"}, rows: [][]driver.Value{{"db.write", int64(6)}}},
		{columns: []string{"task_id", "status"}, rows: [][]driver.Value{{"t-9", "failed"}}},
	})
	app := policySimTestApp("tenant-a")
	app.Post("/v1/policy/simulate", handlePolicySimulate(db))

	resp := postPolicySim(t, app, `{"range":"7d","policy_mode":"block","require_proof_missing":true}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := decodePolicySimResponse(t, resp)
	require.Equal(t, int64(34), body.WouldAllow)
	require.Equal(t, int64(0), body.WouldRequireApproval)
	require.Equal(t, int64(6), body.WouldBlock)
}

// No criteria → a single counts query, zero affected, an explicit warning, and
// NO breakdown/sample fan-out (the proposed rule matched nothing).
func TestPolicySimulateNoCriteriaWarnsAndDoesNotFanOut(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"total", "affected"},
			rows:    [][]driver.Value{{int64(20), int64(0)}},
			checkArgs: func(query string, _ []driver.NamedValue) {
				require.Contains(t, query, "FILTER (WHERE false)")
			},
		},
	})
	app := policySimTestApp("tenant-a")
	app.Post("/v1/policy/simulate", handlePolicySimulate(db))

	resp := postPolicySim(t, app, `{"range":"24h","policy_mode":"block"}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := decodePolicySimResponse(t, resp)
	require.Equal(t, int64(20), body.TotalRunsConsidered)
	require.Equal(t, int64(0), body.AffectedRunCount)
	require.Equal(t, int64(20), body.WouldAllow)
	require.NotEmpty(t, body.Warnings)
	require.Empty(t, body.AffectedAgents)
	require.Empty(t, body.SampleRuns)
	// Only the counts query ran; no breakdown queries, and never any exec.
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestPolicySimulateEmptyWindowWarns(t *testing.T) {
	t.Parallel()
	db, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{columns: []string{"total", "affected"}, rows: [][]driver.Value{{int64(0), int64(0)}}},
	})
	app := policySimTestApp("tenant-a")
	app.Post("/v1/policy/simulate", handlePolicySimulate(db))

	resp := postPolicySim(t, app, `{"range":"30d","policy_mode":"block","match_action_name":"x"}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := decodePolicySimResponse(t, resp)
	require.Equal(t, int64(0), body.TotalRunsConsidered)
	require.True(t, hasWarningContaining(body.Warnings, "No execution records"))
}

func hasWarningContaining(warnings []string, sub string) bool {
	for _, w := range warnings {
		if strings.Contains(w, sub) {
			return true
		}
	}
	return false
}
