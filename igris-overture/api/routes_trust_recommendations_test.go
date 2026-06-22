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

	"github.com/Igris-inertial/system/igris-overture/trustrecs"
)

// tb builds an intelligenceBreakdown with rates derived the same way the
// production query path derives them (via buildExecutionIntelligenceBreakdown).
func tb(key, name string, total, successful, failed, approvals, recoveries, evalRuns, evalPassed, proofRuns int64) intelligenceBreakdown {
	return buildExecutionIntelligenceBreakdown(key, name, total, successful, failed, approvals, recoveries, evalRuns, evalPassed, proofRuns, sql.NullFloat64{})
}

func findRec(recs []trustRecommendation, id string) *trustRecommendation {
	for i := range recs {
		if recs[i].ID == id {
			return &recs[i]
		}
	}
	return nil
}

// ── Pure builder: each required signal ───────────────────────────────────────

func TestBuildTrustNoEvalCoverage(t *testing.T) {
	t.Parallel()
	recs := buildTrustRecommendations("7d",
		[]intelligenceBreakdown{tb("agent-1", "claude-prod", 10, 10, 0, 0, 0, 0, 0, 10)}, nil, nil)
	r := findRec(recs, "agent:no_eval_coverage:agent-1")
	require.NotNil(t, r)
	require.Equal(t, trustSeverityWarning, r.Severity)
	require.Equal(t, "agent", r.EntityType)
	require.Equal(t, "claude-prod", r.EntityName)
	require.Contains(t, r.RecommendedAction, "Create an evaluation")
}

func TestBuildTrustLowEvalPass(t *testing.T) {
	t.Parallel()
	// Very low pass rate → critical.
	crit := buildTrustRecommendations("7d",
		[]intelligenceBreakdown{tb("agent-1", "a1", 20, 10, 0, 0, 0, 10, 5, 20)}, nil, nil)
	r := findRec(crit, "agent:low_eval_pass:agent-1")
	require.NotNil(t, r)
	require.Equal(t, trustSeverityCritical, r.Severity)
	require.Equal(t, trustCategoryEvaluation, r.Category)

	// Mildly low (0.85) → warning.
	warn := buildTrustRecommendations("7d",
		[]intelligenceBreakdown{tb("agent-2", "a2", 20, 17, 0, 0, 0, 20, 17, 20)}, nil, nil)
	rw := findRec(warn, "agent:low_eval_pass:agent-2")
	require.NotNil(t, rw)
	require.Equal(t, trustSeverityWarning, rw.Severity)

	// Too few eval runs → no finding even at a low pass rate.
	none := buildTrustRecommendations("7d",
		[]intelligenceBreakdown{tb("agent-3", "a3", 20, 1, 0, 0, 0, 2, 0, 20)}, nil, nil)
	require.Nil(t, findRec(none, "agent:low_eval_pass:agent-3"))
}

func TestBuildTrustHighRecovery(t *testing.T) {
	t.Parallel()
	recs := buildTrustRecommendations("7d", nil,
		[]intelligenceBreakdown{tb("stripe.refund", "stripe.refund", 20, 15, 0, 0, 5, 0, 0, 20)}, nil)
	r := findRec(recs, "action:high_recovery:stripe.refund")
	require.NotNil(t, r)
	require.Equal(t, trustSeverityWarning, r.Severity)
	require.Equal(t, "action", r.EntityType)
	require.Contains(t, r.Reason, "25%")
}

func TestBuildTrustLowProof(t *testing.T) {
	t.Parallel()
	crit := buildTrustRecommendations("7d", nil,
		[]intelligenceBreakdown{tb("db.write", "db.write", 20, 20, 0, 0, 0, 0, 0, 10)}, nil)
	r := findRec(crit, "action:low_proof:db.write")
	require.NotNil(t, r)
	require.Equal(t, trustSeverityCritical, r.Severity)
	require.Equal(t, trustCategoryProof, r.Category)

	warn := buildTrustRecommendations("7d", nil,
		[]intelligenceBreakdown{tb("db.read", "db.read", 20, 20, 0, 0, 0, 0, 0, 18)}, nil)
	rw := findRec(warn, "action:low_proof:db.read")
	require.NotNil(t, rw)
	require.Equal(t, trustSeverityWarning, rw.Severity)
}

func TestBuildTrustHighFailure(t *testing.T) {
	t.Parallel()
	crit := buildTrustRecommendations("7d", nil,
		[]intelligenceBreakdown{tb("a.x", "a.x", 20, 13, 7, 0, 0, 0, 0, 20)}, nil)
	r := findRec(crit, "action:high_failure:a.x")
	require.NotNil(t, r)
	require.Equal(t, trustSeverityCritical, r.Severity)
}

func TestBuildTrustApprovalHeavy(t *testing.T) {
	t.Parallel()
	recs := buildTrustRecommendations("7d", nil,
		[]intelligenceBreakdown{tb("a.y", "a.y", 20, 20, 0, 19, 0, 0, 0, 20)}, nil)
	r := findRec(recs, "action:approval_heavy:a.y")
	require.NotNil(t, r)
	require.Equal(t, trustSeverityWarning, r.Severity)
	require.Equal(t, trustCategoryPolicy, r.Category)
}

func TestBuildTrustProposalStale(t *testing.T) {
	t.Parallel()
	old := time.Now().UTC().Add(-10 * 24 * time.Hour)
	fresh := time.Now().UTC().Add(-1 * time.Hour)

	stale := buildTrustRecommendations("7d", nil, nil, []trustProposalInput{
		{ID: "p1", Name: "Refund guard", Status: "approved", SimulatedAt: &old},
	})
	r := findRec(stale, "policy:proposal_stale:p1")
	require.NotNil(t, r)
	require.Equal(t, trustSeverityWarning, r.Severity)
	require.Equal(t, "policy_proposal", r.EntityType)

	never := buildTrustRecommendations("7d", nil, nil, []trustProposalInput{
		{ID: "p2", Name: "No sim", Status: "approved", SimulatedAt: nil},
	})
	require.NotNil(t, findRec(never, "policy:proposal_stale:p2"))

	freshRecs := buildTrustRecommendations("7d", nil, nil, []trustProposalInput{
		{ID: "p3", Name: "Fresh", Status: "approved", SimulatedAt: &fresh},
	})
	require.Nil(t, findRec(freshRecs, "policy:proposal_stale:p3"))

	// Non-approved proposals are never flagged.
	draft := buildTrustRecommendations("7d", nil, nil, []trustProposalInput{
		{ID: "p4", Name: "Draft", Status: "draft", SimulatedAt: nil},
	})
	require.Empty(t, draft)
}

func TestBuildTrustSkipsUnattributedAndLowActivity(t *testing.T) {
	t.Parallel()
	recs := buildTrustRecommendations("7d",
		[]intelligenceBreakdown{tb("unattributed", "unattributed", 50, 50, 0, 0, 0, 0, 0, 50)},
		[]intelligenceBreakdown{
			tb("unknown_action", "unknown_action", 50, 0, 25, 0, 25, 0, 0, 0), // sentinel → skipped
			tb("tiny", "tiny", 2, 0, 1, 0, 1, 0, 0, 0),                        // below activity floor → skipped
		}, nil)
	require.Empty(t, recs)
}

func TestBuildTrustSortsBySeverity(t *testing.T) {
	t.Parallel()
	recs := buildTrustRecommendations("7d",
		[]intelligenceBreakdown{tb("agent-1", "a1", 10, 10, 0, 0, 0, 0, 0, 10)},       // warning (no eval)
		[]intelligenceBreakdown{tb("db.write", "db.write", 20, 20, 0, 0, 0, 0, 0, 5)}, // critical (low proof)
		nil)
	require.GreaterOrEqual(t, len(recs), 2)
	require.Equal(t, trustSeverityCritical, recs[0].Severity)
}

func TestBuildTrustProducesNoUnsafeText(t *testing.T) {
	t.Parallel()
	recs := buildTrustRecommendations("7d",
		[]intelligenceBreakdown{tb("agent-1", "a1", 10, 10, 0, 0, 0, 0, 0, 10)},
		[]intelligenceBreakdown{tb("db.write", "db.write", 20, 10, 6, 19, 5, 8, 2, 8)}, nil)
	require.NotEmpty(t, recs)
	markers := []string{"prompt", "chain of thought", "raw_body", "request_body", "response_body", "ciphertext", "nonce", "api_key", "bearer ", "cookie", "private key"}
	for _, r := range recs {
		blob := strings.ToLower(r.Title + " " + r.Summary + " " + r.Reason + " " + r.RecommendedAction)
		for _, m := range markers {
			require.NotContains(t, blob, m, "rec %s leaked marker %q", r.ID, m)
		}
	}
}

// ── Route layer: auth, validation, tenant scoping, safe output ───────────────

func trustTestApp(tenantID string, db *sql.DB) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error { c.Locals("clerk_user_id", tenantID); return c.Next() })
	app.Get("/v1/execution/trust-recommendations", handleTrustRecommendations(db))
	return app
}

func getTrust(t *testing.T, app *fiber.App, url string) *http.Response {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, url, nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	return resp
}

func TestTrustRecommendationsUnauthenticated(t *testing.T) {
	t.Parallel()
	db, _ := newQueuedRouteDB(t, nil)
	resp := getTrust(t, trustTestApp("", db), "/v1/execution/trust-recommendations")
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestTrustRecommendationsRejectsTenantOverride(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	resp := getTrust(t, trustTestApp("tenant-a", db), "/v1/execution/trust-recommendations?tenant_id=tenant-b")
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

func TestTrustRecommendationsRejectsInvalidRange(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	resp := getTrust(t, trustTestApp("tenant-a", db), "/v1/execution/trust-recommendations?range=90d")
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

func trustBreakdownColumns() []string {
	return []string{"key", "name", "total", "successful", "failed", "approvals", "recoveries", "eval_runs", "eval_passed", "proof_runs", "avg_duration"}
}

func TestTrustRecommendationsEmptyWindow(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{columns: trustBreakdownColumns(), rows: [][]driver.Value{}}, // agents
		{columns: trustBreakdownColumns(), rows: [][]driver.Value{}}, // actions
		{columns: policyProposalColumns(), rows: [][]driver.Value{}}, // proposals
		{columns: trustStateColumns(), rows: [][]driver.Value{}},     // lifecycle states
	})
	resp := getTrust(t, trustTestApp("tenant-a", db), "/v1/execution/trust-recommendations?range=7d")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := decodeTrustResponse(t, resp)
	require.Equal(t, "7d", body.Range)
	require.NotEmpty(t, body.GeneratedAt)
	require.Empty(t, body.Recommendations)
	require.Zero(t, drv.remainingQueries())
}

func TestTrustRecommendationsTenantScopedAndBuilds(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{ // agents — one active agent with no eval coverage
			columns: trustBreakdownColumns(),
			rows:    [][]driver.Value{{"agent-1", "claude-prod", int64(12), int64(12), int64(0), int64(0), int64(0), int64(0), int64(0), int64(12), nil}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Equal(t, "tenant-a", args[0].Value)
			},
		},
		{ // actions — one action with high recovery + low proof
			columns: trustBreakdownColumns(),
			rows:    [][]driver.Value{{"stripe.refund", "stripe.refund", int64(20), int64(15), int64(0), int64(0), int64(5), int64(0), int64(0), int64(10), nil}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Equal(t, "tenant-a", args[0].Value)
			},
		},
		{ // proposals — none
			columns: policyProposalColumns(),
			rows:    [][]driver.Value{},
		},
		{ // lifecycle states — none (every finding reads as active)
			columns: trustStateColumns(),
			rows:    [][]driver.Value{},
		},
	})
	resp := getTrust(t, trustTestApp("tenant-a", db), "/v1/execution/trust-recommendations?range=7d")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := decodeTrustResponse(t, resp)
	require.NotEmpty(t, body.Recommendations)
	// Critical (low proof) sorts ahead of warnings.
	require.Equal(t, trustSeverityCritical, body.Recommendations[0].Severity)
	require.NotNil(t, findRec(body.Recommendations, "agent:no_eval_coverage:agent-1"))
	require.NotNil(t, findRec(body.Recommendations, "action:high_recovery:stripe.refund"))
	require.Zero(t, drv.remainingQueries())
}

// Proposal table missing (e.g. migration not applied) must degrade gracefully:
// the proposals query errors, but agent/action findings still return 200.
func TestTrustRecommendationsDegradesWhenProposalTableMissing(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{columns: trustBreakdownColumns(), rows: [][]driver.Value{}},
		{columns: trustBreakdownColumns(), rows: [][]driver.Value{}},
		{columns: policyProposalColumns(), err: sql.ErrConnDone}, // simulate unavailable proposal store
		{columns: trustStateColumns(), rows: [][]driver.Value{}}, // lifecycle states present but empty
	})
	resp := getTrust(t, trustTestApp("tenant-a", db), "/v1/execution/trust-recommendations")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := decodeTrustResponse(t, resp)
	require.Empty(t, body.Recommendations)
	require.Zero(t, drv.remainingQueries())
}

// ── Lifecycle overlay (pure) ─────────────────────────────────────────────────

func TestApplyTrustStateFiltersAndOverlays(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	future := now.Add(24 * time.Hour)
	past := now.Add(-time.Hour)

	recs := []trustRecommendation{
		{ID: "a", Severity: trustSeverityWarning},
		{ID: "b", Severity: trustSeverityWarning},
		{ID: "c", Severity: trustSeverityWarning},
		{ID: "d", Severity: trustSeverityWarning},
		{ID: "e", Severity: trustSeverityWarning},
	}
	states := map[string]trustrecs.State{
		"b": {RecommendationID: "b", Status: trustrecs.StatusAcknowledged},
		"c": {RecommendationID: "c", Status: trustrecs.StatusSnoozed, SnoozedUntil: &future},
		"d": {RecommendationID: "d", Status: trustrecs.StatusResolved},
		"e": {RecommendationID: "e", Status: trustrecs.StatusSnoozed, SnoozedUntil: &past}, // expired
	}

	// Default view: active (a), acknowledged (b), and expired-snooze (e→active).
	def := applyTrustState(recs, states, now, false, false)
	ids := map[string]string{}
	for _, r := range def {
		ids[r.ID] = r.State
	}
	require.Equal(t, trustrecs.StatusActive, ids["a"])
	require.Equal(t, trustrecs.StatusAcknowledged, ids["b"])
	require.Equal(t, trustrecs.StatusActive, ids["e"], "expired snooze reads as active")
	require.NotContains(t, ids, "c", "snoozed hidden by default")
	require.NotContains(t, ids, "d", "resolved hidden by default")

	// include_snoozed surfaces the still-snoozed finding.
	withSnoozed := applyTrustState(recs, states, now, false, true)
	require.True(t, containsID(withSnoozed, "c"))
	require.False(t, containsID(withSnoozed, "d"))

	// include_resolved surfaces the resolved finding.
	withResolved := applyTrustState(recs, states, now, true, false)
	require.True(t, containsID(withResolved, "d"))
	require.False(t, containsID(withResolved, "c"))
}

func containsID(recs []trustRecommendation, id string) bool {
	for _, r := range recs {
		if r.ID == id {
			return true
		}
	}
	return false
}

// ── Lifecycle routes ─────────────────────────────────────────────────────────

func trustStateColumns() []string {
	return []string{"state_id", "tenant_id", "recommendation_id", "status", "reason", "snoozed_until", "acknowledged_at", "resolved_at", "created_at", "updated_at"}
}

func trustStateApp(tenantID string, db *sql.DB) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error { c.Locals("clerk_user_id", tenantID); return c.Next() })
	store := &trustrecs.SQLStore{DB: db}
	app.Patch("/v1/execution/trust-recommendations/:id/state", handleTrustRecommendationStatePatch(store))
	app.Get("/v1/execution/trust-recommendations/states", handleTrustRecommendationStates(store))
	return app
}

func patchTrustState(t *testing.T, app *fiber.App, id, body string) *http.Response {
	t.Helper()
	req := httptest.NewRequest(http.MethodPatch, "/v1/execution/trust-recommendations/"+id+"/state", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	return resp
}

func TestTrustStatePatchUnauthenticated(t *testing.T) {
	t.Parallel()
	db, _ := newQueuedRouteDB(t, nil)
	resp := patchTrustState(t, trustStateApp("", db), "a", `{"status":"acknowledged"}`)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestTrustStatePatchRejectsTenantOverride(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	resp := patchTrustState(t, trustStateApp("tenant-a", db), "a", `{"tenant_id":"tenant-b","status":"acknowledged"}`)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

func TestTrustStatePatchRejectsUnknownField(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	resp := patchTrustState(t, trustStateApp("tenant-a", db), "a", `{"status":"acknowledged","evil":"x"}`)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

func TestTrustStatePatchRejectsInvalidStatus(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	resp := patchTrustState(t, trustStateApp("tenant-a", db), "a", `{"status":"deferred"}`)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

func TestTrustStatePatchRejectsUnsafeReason(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	resp := patchTrustState(t, trustStateApp("tenant-a", db), "a", `{"status":"acknowledged","reason":"see the prompt"}`)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

func TestTrustStatePatchAcknowledgeIsTenantScoped(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: trustStateColumns(),
		rows: [][]driver.Value{{
			"11111111-1111-1111-1111-111111111111", "tenant-a", "action:high_recovery:stripe.refund",
			"acknowledged", "", nil, now, nil, now, now,
		}},
		checkArgs: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "INSERT INTO trust_recommendation_states")
			require.Contains(t, query, "ON CONFLICT")
			require.Equal(t, "tenant-a", args[0].Value)
			require.Equal(t, "action:high_recovery:stripe.refund", args[1].Value)
			require.Equal(t, "acknowledged", args[2].Value)
		},
	}})
	resp := patchTrustState(t, trustStateApp("tenant-a", db),
		"action:high_recovery:stripe.refund", `{"status":"acknowledged"}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

func TestTrustStatePatchSnoozeComputesUntil(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: trustStateColumns(),
		rows: [][]driver.Value{{
			"22222222-2222-2222-2222-222222222222", "tenant-a", "rec-1",
			"snoozed", "", now.Add(7 * 24 * time.Hour), nil, nil, now, now,
		}},
		checkArgs: func(query string, args []driver.NamedValue) {
			// $5 is snoozed_until — must be a non-null future time the server set.
			snooze, ok := args[4].Value.(time.Time)
			require.True(t, ok, "snoozed_until must be a server-computed timestamp")
			require.True(t, snooze.After(now), "snoozed_until must be in the future")
		},
	}})
	resp := patchTrustState(t, trustStateApp("tenant-a", db), "rec-1", `{"status":"snoozed","snooze_duration":"7d"}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

func TestTrustStatesListTenantScoped(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: trustStateColumns(),
		rows: [][]driver.Value{{
			"33333333-3333-3333-3333-333333333333", "tenant-a", "rec-1", "resolved", "", nil, nil, now, now, now,
		}},
		checkArgs: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "FROM trust_recommendation_states")
			require.Equal(t, "tenant-a", args[0].Value)
		},
	}})
	req := httptest.NewRequest(http.MethodGet, "/v1/execution/trust-recommendations/states", nil)
	resp, err := trustStateApp("tenant-a", db).Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

type trustResponse struct {
	Range           string                `json:"range"`
	GeneratedAt     string                `json:"generated_at"`
	Recommendations []trustRecommendation `json:"recommendations"`
}

func decodeTrustResponse(t *testing.T, resp *http.Response) trustResponse {
	t.Helper()
	var out trustResponse
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&out))
	return out
}
