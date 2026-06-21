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

	"github.com/Igris-inertial/system/igris-overture/policyproposals"
)

// newProposalApp mounts the proposal handlers behind a stub that injects a tenant
// id, mirroring how BetterAuth populates request locals in production.
func newProposalApp(tenantID string, db *sql.DB) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		return c.Next()
	})
	store := &policyproposals.SQLStore{DB: db}
	app.Get("/v1/policy/proposals", handlePolicyProposalList(store))
	app.Post("/v1/policy/proposals", handlePolicyProposalCreate(store))
	app.Get("/v1/policy/proposals/:id", handlePolicyProposalGet(store))
	app.Patch("/v1/policy/proposals/:id", handlePolicyProposalUpdate(store))
	app.Delete("/v1/policy/proposals/:id", handlePolicyProposalDelete(store))
	app.Post("/v1/policy/proposals/:id/simulate", handlePolicyProposalSimulate(store, db))
	app.Post("/v1/policy/proposals/:id/approve", handlePolicyProposalApprove(store))
	return app
}

func policyProposalColumns() []string {
	return []string{
		"proposal_id", "tenant_id", "name", "description", "status", "policy_mode",
		"match_criteria_json", "latest_simulation_json", "created_by", "created_at", "updated_at", "archived_at",
	}
}

// proposalRow builds a RETURNING/SELECT row in proposalColumns order.
func proposalRow(id, tenant, name, status, mode, criteriaJSON string, sim []byte, now time.Time) []driver.Value {
	var simVal driver.Value
	if sim != nil {
		simVal = sim
	}
	return []driver.Value{
		id, tenant, name, "", status, mode, []byte(criteriaJSON), simVal, "creator", now, now, nil,
	}
}

const testProposalID = "33333333-3333-3333-3333-333333333333"

func doProposalReq(t *testing.T, app *fiber.App, method, path, body string) *http.Response {
	t.Helper()
	var reader *strings.Reader
	if body != "" {
		reader = strings.NewReader(body)
	} else {
		reader = strings.NewReader("")
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	return resp
}

// ── Auth + hostile input ─────────────────────────────────────────────────────

func TestPolicyProposalUnauthenticated(t *testing.T) {
	t.Parallel()
	db, _ := newQueuedRouteDB(t, nil)
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error { c.Locals("clerk_user_id", ""); return c.Next() })
	app.Get("/v1/policy/proposals", handlePolicyProposalList(&policyproposals.SQLStore{DB: db}))

	resp := doProposalReq(t, app, http.MethodGet, "/v1/policy/proposals", "")
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestPolicyProposalCreateRejectsTenantOverride(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodPost, "/v1/policy/proposals",
		`{"tenant_id":"tenant-b","name":"Refund guard","policy_mode":"block","match_criteria_json":{"range":"30d","match_action_name":"stripe.refund"}}`)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestPolicyProposalCreateRejectsUnknownField(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodPost, "/v1/policy/proposals",
		`{"name":"x","policy_mode":"block","match_criteria_json":{"range":"30d"},"evil":"drop table"}`)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

func TestPolicyProposalCreateRejectsUnknownCriteriaField(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodPost, "/v1/policy/proposals",
		`{"name":"x","policy_mode":"block","match_criteria_json":{"range":"30d","sneaky":"1"}}`)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

func TestPolicyProposalCreateRejectsUnsafeName(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodPost, "/v1/policy/proposals",
		`{"name":"leak the system prompt","policy_mode":"block","match_criteria_json":{"range":"30d"}}`)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestPolicyProposalCreateRejectsInvalidRange(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodPost, "/v1/policy/proposals",
		`{"name":"x","policy_mode":"block","match_criteria_json":{"range":"90d"}}`)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

// ── Create persists only safe, tenant-scoped metadata ────────────────────────

func TestPolicyProposalCreateIsTenantScopedAndAudited(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: policyProposalColumns(),
		rows: [][]driver.Value{proposalRow(testProposalID, "tenant-a", "Refund guard", "draft", "block",
			`{"range":"30d","match_action_name":"stripe.refund"}`, nil, now)},
		checkArgs: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "INSERT INTO policy_proposals")
			require.Equal(t, "tenant-a", args[0].Value) // tenant comes from auth, not body
		},
	}},
		queuedRouteExecExpectation{rowsAffected: 1, check: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "policy_proposal_events")
			require.Equal(t, "tenant-a", args[0].Value)
			require.Equal(t, "created", args[2].Value)
		}})
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodPost, "/v1/policy/proposals",
		`{"name":"Refund guard","description":"Pause big refunds","policy_mode":"block","match_criteria_json":{"range":"30d","match_action_name":"stripe.refund"}}`)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())

	body := decodeProposalEnvelope(t, resp)
	require.Equal(t, "draft", body.Proposal.Status)
	require.Equal(t, "30d", body.Proposal.MatchCriteria.Range)
}

func TestPolicyProposalListIsTenantScoped(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: policyProposalColumns(),
		rows: [][]driver.Value{proposalRow(testProposalID, "tenant-a", "Refund guard", "draft", "block",
			`{"range":"30d"}`, nil, now)},
		checkArgs: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "tenant_id = $1")
			require.Contains(t, query, "archived_at IS NULL")
			require.Equal(t, "tenant-a", args[0].Value)
		},
	}})
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodGet, "/v1/policy/proposals", "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

func TestPolicyProposalGetReturnsEventsAndIsTenantScoped(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: policyProposalColumns(),
			rows: [][]driver.Value{proposalRow(testProposalID, "tenant-a", "Refund guard", "draft", "block",
				`{"range":"30d"}`, nil, now)},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Equal(t, "tenant-a", args[0].Value)
			},
		},
		{
			columns: []string{"event_id", "tenant_id", "proposal_id", "event_type", "safe_summary", "created_at"},
			rows:    [][]driver.Value{{"44444444-4444-4444-4444-444444444444", "tenant-a", testProposalID, "created", "Draft proposal created", now}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "policy_proposal_events")
				require.Equal(t, "tenant-a", args[0].Value)
			},
		},
	})
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodGet, "/v1/policy/proposals/"+testProposalID, "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

func TestPolicyProposalGetNotFound(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: policyProposalColumns(),
		rows:    [][]driver.Value{}, // no rows → ErrNotFound
	}})
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodGet, "/v1/policy/proposals/"+testProposalID, "")
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

// ── Update: content edits gated by state; tenant override rejected ───────────

func TestPolicyProposalUpdateRejectsTenantOverride(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodPatch, "/v1/policy/proposals/"+testProposalID,
		`{"tenant_id":"tenant-b","name":"x"}`)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

func TestPolicyProposalUpdateContentOnDraft(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{ // Get (current)
			columns: policyProposalColumns(),
			rows: [][]driver.Value{proposalRow(testProposalID, "tenant-a", "Old name", "draft", "block",
				`{"range":"30d"}`, nil, now)},
		},
		{ // UPDATE ... RETURNING
			columns: policyProposalColumns(),
			rows: [][]driver.Value{proposalRow(testProposalID, "tenant-a", "New name", "draft", "block",
				`{"range":"30d"}`, nil, now)},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "UPDATE policy_proposals")
				require.Equal(t, "tenant-a", args[0].Value)
			},
		},
	},
		queuedRouteExecExpectation{rowsAffected: 1, check: func(query string, args []driver.NamedValue) {
			require.Equal(t, "updated", args[2].Value)
		}})
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodPatch, "/v1/policy/proposals/"+testProposalID, `{"name":"New name"}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestPolicyProposalUpdateContentOnApprovedRejected(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: policyProposalColumns(),
		rows: [][]driver.Value{proposalRow(testProposalID, "tenant-a", "Locked", "approved", "block",
			`{"range":"30d"}`, []byte(`{"total_runs_considered":5}`), now)},
	}})
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodPatch, "/v1/policy/proposals/"+testProposalID, `{"name":"New name"}`)
	require.Equal(t, http.StatusConflict, resp.StatusCode)
	// Only the Get ran — no UPDATE, no event: an approved proposal's rule is frozen.
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestPolicyProposalUpdateStatusToggle(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: policyProposalColumns(),
			rows: [][]driver.Value{proposalRow(testProposalID, "tenant-a", "Refund guard", "draft", "block",
				`{"range":"30d"}`, nil, now)},
		},
		{
			columns: policyProposalColumns(),
			rows: [][]driver.Value{proposalRow(testProposalID, "tenant-a", "Refund guard", "review_ready", "block",
				`{"range":"30d"}`, nil, now)},
		},
	},
		queuedRouteExecExpectation{rowsAffected: 1, check: func(query string, args []driver.NamedValue) {
			require.Equal(t, "status_changed", args[2].Value)
		}})
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodPatch, "/v1/policy/proposals/"+testProposalID, `{"status":"review_ready"}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Zero(t, drv.remainingExecs())
}

func TestPolicyProposalUpdateRejectsForbiddenStatus(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	app := newProposalApp("tenant-a", db)

	// 'approved' is not settable via PATCH — approval has its own audited path.
	resp := doProposalReq(t, app, http.MethodPatch, "/v1/policy/proposals/"+testProposalID, `{"status":"approved"}`)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

// ── Approve: gated transition that requires attached simulation evidence ─────

func TestPolicyProposalApproveRequiresReviewReady(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: policyProposalColumns(),
		rows: [][]driver.Value{proposalRow(testProposalID, "tenant-a", "Refund guard", "draft", "block",
			`{"range":"30d"}`, []byte(`{"total_runs_considered":5}`), now)},
	}})
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodPost, "/v1/policy/proposals/"+testProposalID+"/approve", "")
	require.Equal(t, http.StatusConflict, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestPolicyProposalApproveRequiresSimulation(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: policyProposalColumns(),
		rows: [][]driver.Value{proposalRow(testProposalID, "tenant-a", "Refund guard", "review_ready", "block",
			`{"range":"30d"}`, nil, now)}, // no simulation attached
	}})
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodPost, "/v1/policy/proposals/"+testProposalID+"/approve", "")
	require.Equal(t, http.StatusConflict, resp.StatusCode)
	body := decodeRawMap(t, resp)
	require.Equal(t, "not_simulated", body["error"])
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestPolicyProposalApproveSuccess(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: policyProposalColumns(),
			rows: [][]driver.Value{proposalRow(testProposalID, "tenant-a", "Refund guard", "review_ready", "block",
				`{"range":"30d"}`, []byte(`{"total_runs_considered":5}`), now)},
		},
		{
			columns: policyProposalColumns(),
			rows: [][]driver.Value{proposalRow(testProposalID, "tenant-a", "Refund guard", "approved", "block",
				`{"range":"30d"}`, []byte(`{"total_runs_considered":5}`), now)},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "UPDATE policy_proposals")
				require.NotContains(t, query, "action_policy_decisions") // never touches live policy
			},
		},
	},
		queuedRouteExecExpectation{rowsAffected: 1, check: func(query string, args []driver.NamedValue) {
			require.Equal(t, "approved", args[2].Value)
		}})
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodPost, "/v1/policy/proposals/"+testProposalID+"/approve", "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := decodeProposalEnvelope(t, resp)
	require.Equal(t, "approved", body.Proposal.Status)
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

// ── Simulate: reuses the simulation engine and persists only a safe summary ──

func TestPolicyProposalSimulateRejectsTenantOverride(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodPost, "/v1/policy/proposals/"+testProposalID+"/simulate",
		`{"tenant_id":"tenant-b"}`)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, drv.remainingQueries())
}

func TestPolicyProposalSimulateReusesEngineAndPersistsSummary(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{ // Get proposal
			columns: policyProposalColumns(),
			rows: [][]driver.Value{proposalRow(testProposalID, "tenant-a", "Refund guard", "draft", "require_approval",
				`{"range":"30d","match_action_name":"stripe.refund"}`, nil, now)},
		},
		{ // policy simulation counts (the reused engine) — affected 0 ⇒ no fan-out
			columns: []string{"total", "affected"},
			rows:    [][]driver.Value{{int64(12), int64(0)}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM base b")
				require.Equal(t, "tenant-a", args[0].Value)
				require.Equal(t, "stripe.refund", args[1].Value)
			},
		},
		{ // SaveSimulation UPDATE ... RETURNING
			columns: policyProposalColumns(),
			rows: [][]driver.Value{proposalRow(testProposalID, "tenant-a", "Refund guard", "draft", "require_approval",
				`{"range":"30d","match_action_name":"stripe.refund"}`, []byte(`{"total_runs_considered":12,"simulated_at":"2026-06-21T00:00:00Z"}`), now)},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "UPDATE policy_proposals")
				require.Contains(t, query, "latest_simulation_json")
			},
		},
	},
		queuedRouteExecExpectation{rowsAffected: 1, check: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "policy_proposal_events")
			require.Equal(t, "simulated", args[2].Value)
		}})
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodPost, "/v1/policy/proposals/"+testProposalID+"/simulate", "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	// Engine, persistence, and one audit event all ran — and nothing else.
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())

	body := decodeRawMap(t, resp)
	require.Contains(t, body, "simulation")
	require.Contains(t, body, "proposal")
}

// ── Archive ──────────────────────────────────────────────────────────────────

func TestPolicyProposalArchive(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil,
		queuedRouteExecExpectation{rowsAffected: 1, check: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "UPDATE policy_proposals")
			require.Contains(t, query, "archived_at")
			require.Equal(t, "tenant-a", args[0].Value)
		}},
		queuedRouteExecExpectation{rowsAffected: 1, check: func(query string, args []driver.NamedValue) {
			require.Equal(t, "archived", args[2].Value)
		}})
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodDelete, "/v1/policy/proposals/"+testProposalID, "")
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Zero(t, drv.remainingExecs())
}

func TestPolicyProposalArchiveNotFound(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil,
		queuedRouteExecExpectation{rowsAffected: 0})
	app := newProposalApp("tenant-a", db)

	resp := doProposalReq(t, app, http.MethodDelete, "/v1/policy/proposals/"+testProposalID, "")
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
	require.Zero(t, drv.remainingExecs())
}

// ── helpers ──────────────────────────────────────────────────────────────────

type proposalEnvelope struct {
	Proposal policyproposals.Proposal `json:"proposal"`
}

func decodeProposalEnvelope(t *testing.T, resp *http.Response) proposalEnvelope {
	t.Helper()
	var out proposalEnvelope
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&out))
	return out
}

func decodeRawMap(t *testing.T, resp *http.Response) map[string]any {
	t.Helper()
	var out map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&out))
	return out
}
