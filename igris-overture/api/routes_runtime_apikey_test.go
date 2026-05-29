package api

import (
	"database/sql/driver"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/security"
)

// These tests lock the runtime-key issuance contract:
//   - the raw key is returned exactly once and never persisted (only its
//     SHA-256 hash + display prefix are stored),
//   - every write is scoped to the authenticated tenant,
//   - GET never leaks a raw key,
//   - unauthenticated requests are rejected before any DB access, and
//   - a key minted in tenant_api_keys authenticates the runtime auth path
//     (RuntimeHandler.apiKeyAuth) without touching tenants.api_key_hash.

const rtKeyTenant = "tenant-runtime-key-test"

// runtimeKeyTenantLookup is the row BetterAuth's API-key branch resolves from
// the Bearer service key (columns: tenant_id, tenant_name, tenant_email).
func runtimeKeyTenantLookup() queuedRouteQueryExpectation {
	return queuedRouteQueryExpectation{
		columns: []string{"tenant_id", "tenant_name", "tenant_email"},
		rows:    [][]driver.Value{{rtKeyTenant, "Runtime Key Tenant", "rt@example.test"}},
	}
}

// TestGenerateRuntimeAPIKey_StoresHashNotRaw asserts the INSERT persists only a
// hash + prefix scoped to the authenticated tenant, and returns the raw key once.
func TestGenerateRuntimeAPIKey_StoresHashNotRaw(t *testing.T) {
	var capturedHash, capturedPrefix string
	var capturedName interface{}
	var capturedTenant interface{}

	db, drv := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{runtimeKeyTenantLookup()},
		queuedRouteExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INSERT INTO tenant_api_keys")
				require.GreaterOrEqual(t, len(args), 4)
				capturedTenant = args[0].Value
				capturedName = args[1].Value
				capturedHash = args[2].Value.(string)
				capturedPrefix = args[3].Value.(string)
			},
		},
	)

	app := fiber.New()
	RegisterRuntimeAPIKeyRoutes(app, db)

	req := httptest.NewRequest(http.MethodPost, "/v1/runtime/api-key", nil)
	req.Header.Set("Authorization", "Bearer igris_service_key")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var out map[string]any
	require.NoError(t, json.Unmarshal(body, &out))

	rawKey, _ := out["api_key"].(string)
	require.True(t, len(rawKey) > 12 && rawKey[:6] == "igris_", "raw key must be an igris_ key")

	// Tenant scoping + name tagging.
	require.Equal(t, rtKeyTenant, capturedTenant, "INSERT must be scoped to the authenticated tenant")
	require.Equal(t, runtimeAPIKeyName, capturedName)

	// The stored value must be the hash, never the raw key.
	require.NotEqual(t, rawKey, capturedHash, "raw key must never be persisted")
	require.Equal(t, security.HashAPIKey(rawKey), capturedHash, "stored value must be sha256(raw key)")
	require.Equal(t, rawKey[:12], capturedPrefix, "prefix must be the first 12 chars")

	// The raw key must not appear anywhere it could be logged/echoed beyond the body field.
	require.Equal(t, 0, drv.remainingQueries())
	require.Equal(t, 0, drv.remainingExecs())
}

// TestGetRuntimeAPIKey_ReturnsMetadataNeverRaw asserts GET returns prefix/status
// only — never a raw key.
func TestGetRuntimeAPIKey_ReturnsMetadataNeverRaw(t *testing.T) {
	db, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		runtimeKeyTenantLookup(),
		{
			columns: []string{"key_prefix", "created_at"},
			rows:    [][]driver.Value{{"igris_a1b2c3", time.Now()}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM tenant_api_keys")
				require.Equal(t, rtKeyTenant, args[0].Value, "GET must be tenant-scoped")
				require.Equal(t, runtimeAPIKeyName, args[1].Value)
			},
		},
	})

	app := fiber.New()
	RegisterRuntimeAPIKeyRoutes(app, db)

	req := httptest.NewRequest(http.MethodGet, "/v1/runtime/api-key", nil)
	req.Header.Set("Authorization", "Bearer igris_service_key")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var out map[string]any
	require.NoError(t, json.Unmarshal(body, &out))
	require.Equal(t, true, out["has_key"])
	require.Equal(t, "igris_a1b2c3", out["prefix"])
	require.NotContains(t, out, "api_key", "GET must never return a raw key")
	require.NotContains(t, string(body), "igris_a1b2c3d4", "no full raw key in body")
}

// TestGetRuntimeAPIKey_NoKey returns has_key:false when the tenant has none.
func TestGetRuntimeAPIKey_NoKey(t *testing.T) {
	db, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		runtimeKeyTenantLookup(),
		{columns: []string{"key_prefix", "created_at"}, rows: nil}, // ErrNoRows
	})

	app := fiber.New()
	RegisterRuntimeAPIKeyRoutes(app, db)

	req := httptest.NewRequest(http.MethodGet, "/v1/runtime/api-key", nil)
	req.Header.Set("Authorization", "Bearer igris_service_key")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var out map[string]any
	require.NoError(t, json.Unmarshal(body, &out))
	require.Equal(t, false, out["has_key"])
}

// TestRevokeRuntimeAPIKeys_TenantScoped asserts DELETE revokes only the
// authenticated tenant's runtime keys.
func TestRevokeRuntimeAPIKeys_TenantScoped(t *testing.T) {
	db, _ := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{runtimeKeyTenantLookup()},
		queuedRouteExecExpectation{
			rowsAffected: 2,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "UPDATE tenant_api_keys")
				require.Contains(t, query, "status = 'revoked'")
				require.Equal(t, rtKeyTenant, args[0].Value, "DELETE must be tenant-scoped")
				require.Equal(t, runtimeAPIKeyName, args[1].Value)
			},
		},
	)

	app := fiber.New()
	RegisterRuntimeAPIKeyRoutes(app, db)

	req := httptest.NewRequest(http.MethodDelete, "/v1/runtime/api-key", nil)
	req.Header.Set("Authorization", "Bearer igris_service_key")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var out map[string]any
	require.NoError(t, json.Unmarshal(body, &out))
	require.EqualValues(t, 2, out["revoked"])
}

// TestRuntimeAPIKey_Unauthorized rejects requests with no credential before any
// DB access (zero queued queries means a stray query would error the test).
func TestRuntimeAPIKey_Unauthorized(t *testing.T) {
	db, _ := newQueuedRouteDB(t, nil)

	app := fiber.New()
	RegisterRuntimeAPIKeyRoutes(app, db)

	req := httptest.NewRequest(http.MethodPost, "/v1/runtime/api-key", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

// TestApiKeyAuth_FallsBackToTenantAPIKeys locks the runtime-auth fallback: a key
// that isn't the tenant's primary api_key_hash but IS an active tenant_api_keys
// row still authenticates the runtime, resolving the correct tenant.
func TestApiKeyAuth_FallsBackToTenantAPIKeys(t *testing.T) {
	db, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		// 1. Primary lookup (tenants.api_key_hash) misses.
		{columns: []string{"tenant_id", "tier", "is_active"}, rows: nil},
		// 2. Fallback lookup (tenant_api_keys join) resolves the tenant.
		{
			columns: []string{"tenant_id", "tier", "is_active"},
			rows:    [][]driver.Value{{rtKeyTenant, "seed", true}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "tenant_api_keys")
				require.Contains(t, query, "status = 'active'")
			},
		},
	})

	h := &RuntimeHandler{db: db}
	app := fiber.New()
	app.Use(h.apiKeyAuth)
	app.Get("/whoami", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"tenant_id": c.Locals("tenant_id")})
	})

	req := httptest.NewRequest(http.MethodGet, "/whoami", nil)
	req.Header.Set("X-API-Key", "igris_runtime_key_from_tenant_api_keys")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var out map[string]any
	require.NoError(t, json.Unmarshal(body, &out))
	require.Equal(t, rtKeyTenant, out["tenant_id"], "runtime auth must resolve tenant from the fallback table")
}
