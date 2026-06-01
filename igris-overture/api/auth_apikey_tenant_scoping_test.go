package api

import (
	"database/sql/driver"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// These tests lock the contract that a service API key resolved by
// BetterAuth flows its tenant_id into the per-route SQL filter. The Rails
// console depends on this for MVP deploy: one console-tenant key sees only
// that tenant's actions, never another tenant's.
//
// The mechanism is in two layers:
//   1. middleware/session_auth.go — BetterAuth API-key branch resolves
//      the bearer token to a tenant row and stashes it in c.Locals.
//   2. api/routes_actions.go — handleActionList runs
//          SELECT … FROM action_definitions WHERE tenant_id = $1 …
//      with the tenant_id from GetClerkUserID(c).
//
// If a future refactor accidentally drops the WHERE clause, omits the
// tenant arg, or leaks a different tenant id, these tests fail fast.

func tenantLookupRowFor(tenantID, name, email string) queuedRouteQueryExpectation {
	return queuedRouteQueryExpectation{
		columns: []string{"tenant_id", "tenant_name", "tenant_email"},
		rows:    [][]driver.Value{{tenantID, name, email}},
	}
}

// actionsListEmptyForTenant returns a query expectation that asserts the
// route's SELECT was scoped to `expectedTenantID` (passed as the first arg)
// and that no rows match.
func actionsListEmptyForTenant(t *testing.T, expectedTenantID string) queuedRouteQueryExpectation {
	t.Helper()
	return queuedRouteQueryExpectation{
		columns: []string{
			"id", "tenant_id", "name", "display_name", "description",
			"target_type", "target_url", "method",
			"policy_preset", "replay_class", "approval_required", "irreversible",
			"secret_refs", "target_metadata", "fallback_policy", "created_at", "updated_at", "archived_at",
		},
		rows: nil,
		checkArgs: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "FROM action_definitions",
				"actions list must query action_definitions")
			require.Contains(t, query, "tenant_id = $1",
				"actions list must filter by tenant_id (otherwise tenant scoping is broken)")
			require.GreaterOrEqual(t, len(args), 1, "tenant_id must be passed as the first arg")
			require.Equal(t, expectedTenantID, args[0].Value,
				"tenant_id arg must come from the authenticated principal, not a hardcoded value")
		},
	}
}

// TestServiceAPIKey_ActionsList_ScopesToAuthenticatedTenant is the headline
// MVP guarantee: when Rails console authenticates as tenant A and asks for
// /v1/actions, the SQL filter uses tenant A's id (never another tenant's).
func TestServiceAPIKey_ActionsList_ScopesToAuthenticatedTenant(t *testing.T) {
	const tenantA = "tenant-A-console"

	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		// 1. BetterAuth resolves the bearer key → tenant A.
		tenantLookupRowFor(tenantA, "Tenant A", "a@example.test"),
		// 2. handleActionList must run a SELECT scoped to tenant A.
		actionsListEmptyForTenant(t, tenantA),
	})

	app := fiber.New()
	v1 := app.Group("/v1/actions")
	v1.Use(middleware.BetterAuth(db))
	v1.Get("", handleActionList(db))

	req := httptest.NewRequest(http.MethodGet, "/v1/actions", nil)
	req.Header.Set("Authorization", "Bearer "+testAPIKey)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	var parsed struct {
		Actions []map[string]any `json:"actions"`
	}
	require.NoError(t, json.Unmarshal(body, &parsed))
	require.Empty(t, parsed.Actions, "tenant A has no actions — must not leak any other tenant's rows")

	require.Zero(t, drv.remainingQueries(), "exactly two queries expected (auth + list)")
}

// TestServiceAPIKey_ActionsList_DifferentKey_DifferentTenant exercises the
// same route with two different keys back-to-back and asserts each sees a
// different tenant scope. This is the per-tenant isolation guarantee.
func TestServiceAPIKey_ActionsList_DifferentKey_DifferentTenant(t *testing.T) {
	const tenantA = "tenant-A"
	const tenantB = "tenant-B"

	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		// Request 1: key resolves to tenant A → list scoped to tenant A.
		tenantLookupRowFor(tenantA, "A", "a@x"),
		actionsListEmptyForTenant(t, tenantA),
		// Request 2: a different key resolves to tenant B → list scoped to tenant B.
		tenantLookupRowFor(tenantB, "B", "b@x"),
		actionsListEmptyForTenant(t, tenantB),
	})

	app := fiber.New()
	v1 := app.Group("/v1/actions")
	v1.Use(middleware.BetterAuth(db))
	v1.Get("", handleActionList(db))

	for _, key := range []string{
		"igris_keyA_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		"igris_keyB_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
	} {
		req := httptest.NewRequest(http.MethodGet, "/v1/actions", nil)
		req.Header.Set("Authorization", "Bearer "+key)
		resp, err := app.Test(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		resp.Body.Close()
	}

	require.Zero(t, drv.remainingQueries(), "four queries expected (auth+list, twice)")
}

// TestServiceAPIKey_ActionsList_MissingKey_Rejected confirms the actions
// route never reaches the SQL layer when there is no auth — no tenant id
// could be sourced, so the filter would be empty.
func TestServiceAPIKey_ActionsList_MissingKey_Rejected(t *testing.T) {
	db, drv := newQueuedRouteDB(t, nil) // zero expected queries

	app := fiber.New()
	v1 := app.Group("/v1/actions")
	v1.Use(middleware.BetterAuth(db))
	v1.Get("", handleActionList(db))

	req := httptest.NewRequest(http.MethodGet, "/v1/actions", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	require.Equal(t, http.StatusUnauthorized, resp.StatusCode,
		"missing auth must return 401 — actions list must not execute without a tenant context")
	require.Zero(t, drv.remainingQueries(), "no SQL should fire when auth fails")
}
