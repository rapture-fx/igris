package api

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/security"
)

// These tests lock the agent/app API key contract:
//   - listing returns metadata only (never raw, never hash) and excludes
//     runtime keys,
//   - creating persists hash + prefix scoped to the tenant and returns the raw
//     key exactly once,
//   - the reserved runtime-key name is rejected,
//   - revoking is tenant-scoped and cannot touch runtime keys,
//   - unauthenticated requests are rejected before any DB access, and
//   - BetterAuth resolves a tenant from an active tenant_api_keys row, so a
//     minted agent key actually authenticates (the whole point of the flow).

const agentKeyTenant = "tenant-agent-key-test"

func agentKeyTenantLookup() queuedRouteQueryExpectation {
	return queuedRouteQueryExpectation{
		columns: []string{"tenant_id", "tenant_name", "tenant_email"},
		rows:    [][]driver.Value{{agentKeyTenant, "Agent Key Tenant", "ak@example.test"}},
	}
}

// TestListAPIKeys_ExcludesRuntimeAndReturnsMetadata asserts GET lists agent
// keys (scoped, runtime keys excluded) and never leaks a raw key or hash.
func TestListAPIKeys_ExcludesRuntimeAndReturnsMetadata(t *testing.T) {
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		agentKeyTenantLookup(),
		{
			columns: []string{"id", "name", "key_prefix", "created_at", "last_used_at"},
			rows: [][]driver.Value{
				{"key-1", "Agent key", "igris_a1b2c3", time.Now(), nil},
			},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM tenant_api_keys")
				require.Contains(t, query, "name <> $2")
				require.Equal(t, agentKeyTenant, args[0].Value, "list must be tenant-scoped")
				require.Equal(t, runtimeAPIKeyName, args[1].Value, "runtime keys must be excluded")
			},
		},
	})

	app := fiber.New()
	RegisterAccountAPIKeysRoutes(app, db)

	req := httptest.NewRequest(http.MethodGet, "/v1/api-keys", nil)
	req.Header.Set("Authorization", "Bearer igris_service_key")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	require.NotContains(t, string(body), "key_hash")
	require.NotContains(t, string(body), "api_key")

	var out struct {
		Keys []map[string]any `json:"keys"`
	}
	require.NoError(t, json.Unmarshal(body, &out))
	require.Len(t, out.Keys, 1)
	require.Equal(t, "igris_a1b2c3", out.Keys[0]["prefix"])
	require.Equal(t, "Agent key", out.Keys[0]["name"])
	require.Equal(t, 0, drv.remainingQueries())
}

// TestCreateAPIKey_StoresHashNotRaw asserts the INSERT persists only a hash +
// prefix scoped to the tenant, and returns the raw key exactly once.
func TestCreateAPIKey_StoresHashNotRaw(t *testing.T) {
	var capturedTenant, capturedName, capturedHash, capturedPrefix interface{}

	db, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		agentKeyTenantLookup(),
		{
			columns: []string{"id"},
			rows:    [][]driver.Value{{"new-key-id"}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INSERT INTO tenant_api_keys")
				require.GreaterOrEqual(t, len(args), 5)
				capturedTenant = args[0].Value
				capturedName = args[1].Value
				capturedHash = args[2].Value
				capturedPrefix = args[3].Value
			},
		},
	})

	app := fiber.New()
	RegisterAccountAPIKeysRoutes(app, db)

	req := httptest.NewRequest(http.MethodPost, "/v1/api-keys",
		bytes.NewBufferString(`{"name":"Support Agent key"}`))
	req.Header.Set("Authorization", "Bearer igris_service_key")
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var out map[string]any
	require.NoError(t, json.Unmarshal(body, &out))

	rawKey, _ := out["api_key"].(string)
	require.True(t, len(rawKey) > 12 && rawKey[:6] == "igris_", "raw key must be an igris_ key")
	require.Equal(t, "Support Agent key", out["name"])
	require.Equal(t, "new-key-id", out["id"])

	require.Equal(t, agentKeyTenant, capturedTenant, "INSERT must be tenant-scoped")
	require.Equal(t, "Support Agent key", capturedName)
	require.NotEqual(t, rawKey, capturedHash, "raw key must never be persisted")
	require.Equal(t, security.HashAPIKey(rawKey), capturedHash, "stored value must be sha256(raw key)")
	require.Equal(t, rawKey[:12], capturedPrefix, "prefix must be the first 12 chars")
}

// TestCreateAPIKey_RejectsRuntimeName ensures agent keys can't hijack the
// reserved runtime-key name — rejected before any write.
func TestCreateAPIKey_RejectsRuntimeName(t *testing.T) {
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{agentKeyTenantLookup()})

	app := fiber.New()
	RegisterAccountAPIKeysRoutes(app, db)

	req := httptest.NewRequest(http.MethodPost, "/v1/api-keys",
		bytes.NewBufferString(`{"name":"Runtime key"}`))
	req.Header.Set("Authorization", "Bearer igris_service_key")
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Equal(t, 0, drv.remainingQueries(), "only the auth lookup should run — no insert")
}

// TestRevokeAPIKey_TenantScopedExcludesRuntime asserts revoke is tenant-scoped
// and can never revoke a runtime key.
func TestRevokeAPIKey_TenantScopedExcludesRuntime(t *testing.T) {
	db, _ := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{agentKeyTenantLookup()},
		queuedRouteExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "UPDATE tenant_api_keys")
				require.Contains(t, query, "status = 'revoked'")
				require.Contains(t, query, "name <> $3")
				require.Equal(t, "key-123", args[0].Value)
				require.Equal(t, agentKeyTenant, args[1].Value, "revoke must be tenant-scoped")
				require.Equal(t, runtimeAPIKeyName, args[2].Value, "runtime keys excluded from agent revoke")
			},
		},
	)

	app := fiber.New()
	RegisterAccountAPIKeysRoutes(app, db)

	req := httptest.NewRequest(http.MethodDelete, "/v1/api-keys/key-123", nil)
	req.Header.Set("Authorization", "Bearer igris_service_key")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var out map[string]any
	require.NoError(t, json.Unmarshal(body, &out))
	require.Equal(t, true, out["ok"])
}

// TestRevokeAPIKey_NotFound returns 404 when nothing matched (wrong tenant,
// already revoked, or a runtime key id).
func TestRevokeAPIKey_NotFound(t *testing.T) {
	db, _ := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{agentKeyTenantLookup()},
		queuedRouteExecExpectation{rowsAffected: 0},
	)

	app := fiber.New()
	RegisterAccountAPIKeysRoutes(app, db)

	req := httptest.NewRequest(http.MethodDelete, "/v1/api-keys/does-not-exist", nil)
	req.Header.Set("Authorization", "Bearer igris_service_key")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
}

// TestAPIKeys_Unauthorized rejects credential-less requests before any DB
// access (zero queued queries means a stray query would error the test).
func TestAPIKeys_Unauthorized(t *testing.T) {
	cases := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/v1/api-keys"},
		{http.MethodPost, "/v1/api-keys"},
		{http.MethodDelete, "/v1/api-keys/some-id"},
	}
	for _, tc := range cases {
		db, _ := newQueuedRouteDB(t, nil)
		app := fiber.New()
		RegisterAccountAPIKeysRoutes(app, db)

		req := httptest.NewRequest(tc.method, tc.path, nil)
		resp, err := app.Test(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusUnauthorized, resp.StatusCode, "%s %s", tc.method, tc.path)
	}
}

// TestBetterAuthFallsBackToTenantAPIKeys locks the auth mapping: a key absent
// from tenants.api_key_hash but present (active) in tenant_api_keys resolves
// the correct tenant — so a minted agent key authenticates action endpoints.
func TestBetterAuthFallsBackToTenantAPIKeys(t *testing.T) {
	db, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		// 1. Primary lookup (tenants.api_key_hash) misses.
		{columns: []string{"tenant_id", "tenant_name", "tenant_email"}, rows: nil},
		// 2. Fallback (tenant_api_keys join) resolves the tenant.
		{
			columns: []string{"tenant_id", "tenant_name", "tenant_email"},
			rows:    [][]driver.Value{{agentKeyTenant, "Agent Key Tenant", "ak@example.test"}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "tenant_api_keys")
				require.Contains(t, query, "status = 'active'")
			},
		},
	})

	app := fiber.New()
	app.Use(middleware.BetterAuth(db))
	app.Get("/whoami", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"tenant_id": middleware.GetClerkUserID(c)})
	})

	req := httptest.NewRequest(http.MethodGet, "/whoami", nil)
	req.Header.Set("Authorization", "Bearer igris_agent_key_from_tenant_api_keys")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var out map[string]any
	require.NoError(t, json.Unmarshal(body, &out))
	require.Equal(t, agentKeyTenant, out["tenant_id"], "agent key must resolve its tenant via the fallback")
}

// TestSanitizeAgentKeyName unit-tests the pure name validator.
func TestSanitizeAgentKeyName(t *testing.T) {
	name, ok := sanitizeAgentKeyName("  ")
	require.True(t, ok)
	require.Equal(t, agentAPIKeyDefaultName, name, "blank name defaults to Agent key")

	name, ok = sanitizeAgentKeyName("  CI / Deploy  ")
	require.True(t, ok)
	require.Equal(t, "CI / Deploy", name, "name is trimmed")

	_, ok = sanitizeAgentKeyName("Runtime key")
	require.False(t, ok, "reserved runtime-key name is rejected")

	_, ok = sanitizeAgentKeyName("<script>")
	require.False(t, ok, "angle brackets rejected")

	_, ok = sanitizeAgentKeyName(string(make([]byte, 61)))
	require.False(t, ok, "over-length rejected")
}
