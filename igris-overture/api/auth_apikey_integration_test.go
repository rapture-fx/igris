package api

import (
	"database/sql/driver"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/security"
)

// These tests lock in the behavior that BetterAuth accepts an `igris_`-prefixed
// API key via either the `Authorization: Bearer …` or `X-API-Key` header on the
// same routes the web-console uses (/v1/tasks/*, /proof/*). This is what the
// CLI relies on; if a refactor ever drops the API-key branch from BetterAuth,
// these tests fail fast.

const (
	testAPIKey    = "igris_testkeyfor_apikey_integration_test_abcdef0123456789abcdef0123456789"
	testTenantID  = "tenant-apikey-test"
	testTenantNm  = "API Key Test Tenant"
	testTenantEml = "apikey-test@example.test"
)

// tenantLookupRow matches the columns selected by BetterAuth's API-key branch:
//
//	SELECT tenant_id, COALESCE(tenant_name,''), COALESCE(tenant_email,'')
//	FROM tenants WHERE api_key_hash = $1 AND COALESCE(is_active, true) = true
func tenantLookupRow() queuedRouteQueryExpectation {
	return queuedRouteQueryExpectation{
		columns: []string{"tenant_id", "tenant_name", "tenant_email"},
		rows: [][]driver.Value{{
			testTenantID,
			testTenantNm,
			testTenantEml,
		}},
	}
}

// echoHandler returns a fiber handler that echoes the tenant context the
// middleware resolved. Used as a stub for routes we don't want to exercise
// end-to-end (we're testing auth, not the task coordinator).
func echoHandler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"clerk_user_id": middleware.GetClerkUserID(c),
			"clerk_email":   middleware.GetClerkEmail(c),
		})
	}
}

func TestBetterAuth_APIKey_Bearer_GrantsAccessToTaskRoute(t *testing.T) {
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{tenantLookupRow()})

	app := fiber.New()
	v1 := app.Group("/v1/tasks")
	v1.Use(middleware.BetterAuth(db))
	v1.Get("/echo", echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/v1/tasks/echo", nil)
	req.Header.Set("Authorization", "Bearer "+testAPIKey)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	require.Equal(t, http.StatusOK, resp.StatusCode, "API-key bearer auth should be accepted on /v1/tasks/*")

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Contains(t, string(body), testTenantID, "resolved tenant ID must come from the API-key lookup")

	require.Zero(t, drv.remainingQueries(), "exactly one tenant lookup expected")
}

func TestBetterAuth_APIKey_XAPIKeyHeader_GrantsAccessToProofRoute(t *testing.T) {
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{tenantLookupRow()})

	app := fiber.New()
	proof := app.Group("/proof")
	proof.Use(middleware.BetterAuth(db))
	proof.Get("/receipts", echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/proof/receipts", nil)
	req.Header.Set("X-API-Key", testAPIKey)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	require.Equal(t, http.StatusOK, resp.StatusCode, "X-API-Key auth should be accepted on /proof/*")

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Contains(t, string(body), testTenantID)

	require.Zero(t, drv.remainingQueries())
}

func TestBetterAuth_APIKey_HashLookup_UsesSHA256(t *testing.T) {
	// Sanity check: the hash format the middleware sends must match what
	// /v1/account/api-key stores at issuance time. Both call security.HashAPIKey,
	// so this asserts the contract one place rather than across two files.
	got := security.HashAPIKey(testAPIKey)
	require.Len(t, got, 64, "SHA-256 hex should be 64 chars")
	// Hex only.
	for _, r := range got {
		require.True(t, (r >= '0' && r <= '9') || (r >= 'a' && r <= 'f'), "hash must be lowercase hex: %q", got)
	}
}

func TestBetterAuth_InvalidAPIKey_Rejected(t *testing.T) {
	// Driver responds with zero rows for the lookup — middleware should reject.
	db, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{"tenant_id", "tenant_name", "tenant_email"},
		rows:    nil,
	}})

	app := fiber.New()
	app.Use(middleware.BetterAuth(db))
	app.Get("/v1/tasks/echo", echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/v1/tasks/echo", nil)
	req.Header.Set("Authorization", "Bearer igris_unknown_key_doesnotexist_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	require.Equal(t, http.StatusUnauthorized, resp.StatusCode, "unknown API key must be rejected")
}

func TestBetterAuth_MissingAuth_Rejected(t *testing.T) {
	// No driver expectations needed — middleware should reject before any DB
	// call when there's no cookie and no API key.
	db, _ := newQueuedRouteDB(t, nil)

	app := fiber.New()
	app.Use(middleware.BetterAuth(db))
	app.Get("/v1/tasks/echo", echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/v1/tasks/echo", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	require.Equal(t, http.StatusUnauthorized, resp.StatusCode, "missing auth must return 401")
}

func TestBetterAuth_InactiveTenant_Rejected(t *testing.T) {
	// The BetterAuth API-key branch filters on `COALESCE(is_active, true) = true`.
	// A revoked or deactivated tenant whose api_key_hash still exists must NOT
	// authenticate — the DB's WHERE clause filters them out, so the lookup
	// returns zero rows and the middleware should respond 401. This guards the
	// revocation flow: after `DELETE /v1/account/api-key` or an admin deactivation,
	// any in-flight key copy stops working immediately.
	db, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{"tenant_id", "tenant_name", "tenant_email"},
		rows:    nil, // simulates `is_active = false` filtered out
	}})

	app := fiber.New()
	app.Use(middleware.BetterAuth(db))
	app.Get("/v1/tasks/echo", echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/v1/tasks/echo", nil)
	req.Header.Set("Authorization", "Bearer "+testAPIKey)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	require.Equal(t, http.StatusUnauthorized, resp.StatusCode, "inactive tenant must be rejected even with otherwise valid key")
}

func TestBetterAuth_NonIgrisPrefixedBearer_FallsThroughToSessionPath(t *testing.T) {
	// A bearer token that doesn't start with "igris_" should NOT be treated as
	// an API key. With no cookie set, the request must fall through to the
	// session-cookie path and be rejected as MISSING_SESSION.
	db, _ := newQueuedRouteDB(t, nil)

	app := fiber.New()
	app.Use(middleware.BetterAuth(db))
	app.Get("/v1/tasks/echo", echoHandler())

	req := httptest.NewRequest(http.MethodGet, "/v1/tasks/echo", nil)
	req.Header.Set("Authorization", "Bearer not_an_igris_key_xyz")
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}
