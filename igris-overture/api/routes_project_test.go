package api

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"
)

// These tests lock the project-identity contract:
//   - GET returns only the tenant's project name (tenants.tenant_name),
//   - PATCH validates length + character allow-list before any DB write,
//   - HTML/script names are rejected (no write, no echo),
//   - every read/write is scoped to the authenticated tenant, and
//   - unauthenticated requests are rejected before any DB access.

const projectTenant = "tenant-project-test"

// projectTenantLookup is the row BetterAuth's API-key branch resolves from the
// Bearer service key (columns: tenant_id, tenant_name, tenant_email).
func projectTenantLookup() queuedRouteQueryExpectation {
	return queuedRouteQueryExpectation{
		columns: []string{"tenant_id", "tenant_name", "tenant_email"},
		rows:    [][]driver.Value{{projectTenant, "Support Agent", "p@example.test"}},
	}
}

// TestGetProject_ReturnsTenantName asserts GET returns the tenant's project
// name, scoped to the authenticated tenant.
func TestGetProject_ReturnsTenantName(t *testing.T) {
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		projectTenantLookup(),
		{
			columns: []string{"tenant_name"},
			rows:    [][]driver.Value{{"Support Agent"}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM tenants")
				require.Equal(t, projectTenant, args[0].Value, "GET must be tenant-scoped")
			},
		},
	})

	app := fiber.New()
	RegisterProjectRoutes(app, db)

	req := httptest.NewRequest(http.MethodGet, "/v1/project", nil)
	req.Header.Set("Authorization", "Bearer igris_service_key")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var out map[string]any
	require.NoError(t, json.Unmarshal(body, &out))
	require.Equal(t, "Support Agent", out["name"])
	require.Equal(t, 0, drv.remainingQueries())
}

// TestGetProject_NoName returns an empty name when the tenant row is missing.
func TestGetProject_NoName(t *testing.T) {
	db, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		projectTenantLookup(),
		{columns: []string{"tenant_name"}, rows: nil}, // ErrNoRows
	})

	app := fiber.New()
	RegisterProjectRoutes(app, db)

	req := httptest.NewRequest(http.MethodGet, "/v1/project", nil)
	req.Header.Set("Authorization", "Bearer igris_service_key")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var out map[string]any
	require.NoError(t, json.Unmarshal(body, &out))
	require.Equal(t, "", out["name"])
}

// TestPatchProject_ValidUpdate asserts a valid name is trimmed, written scoped
// to the authenticated tenant, and echoed back.
func TestPatchProject_ValidUpdate(t *testing.T) {
	db, _ := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{projectTenantLookup()},
		queuedRouteExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "UPDATE tenants")
				require.Contains(t, query, "tenant_name")
				require.Equal(t, projectTenant, args[0].Value, "UPDATE must be tenant-scoped")
				require.Equal(t, "Finance Ops Agent", args[1].Value, "name must be trimmed before write")
			},
		},
	)

	app := fiber.New()
	RegisterProjectRoutes(app, db)

	req := httptest.NewRequest(http.MethodPatch, "/v1/project",
		bytes.NewBufferString(`{"name":"  Finance Ops Agent  "}`))
	req.Header.Set("Authorization", "Bearer igris_service_key")
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	var out map[string]any
	require.NoError(t, json.Unmarshal(body, &out))
	require.Equal(t, "Finance Ops Agent", out["name"])
}

// TestPatchProject_InvalidName rejects too-short and out-of-charset names
// before any DB write (only the auth lookup query is queued).
func TestPatchProject_InvalidName(t *testing.T) {
	cases := []struct {
		name string
		body string
		code string
	}{
		{"too short", `{"name":"a"}`, "INVALID_NAME_LENGTH"},
		{"empty after trim", `{"name":"   "}`, "INVALID_NAME_LENGTH"},
		{"bad chars", `{"name":"acme/agent?"}`, "INVALID_NAME_CHARS"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// Only the BetterAuth tenant lookup should run — no Exec.
			db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{projectTenantLookup()})

			app := fiber.New()
			RegisterProjectRoutes(app, db)

			req := httptest.NewRequest(http.MethodPatch, "/v1/project",
				bytes.NewBufferString(tc.body))
			req.Header.Set("Authorization", "Bearer igris_service_key")
			req.Header.Set("Content-Type", "application/json")
			resp, err := app.Test(req)
			require.NoError(t, err)
			require.Equal(t, http.StatusBadRequest, resp.StatusCode)

			body, _ := io.ReadAll(resp.Body)
			var out map[string]any
			require.NoError(t, json.Unmarshal(body, &out))
			require.Equal(t, tc.code, out["code"])
			require.Equal(t, 0, drv.remainingExecs(), "no write may happen for an invalid name")
		})
	}
}

// TestPatchProject_RejectsHTMLScript asserts an injected <script> name is
// rejected (it contains '<' and '/') and never written or echoed back.
func TestPatchProject_RejectsHTMLScript(t *testing.T) {
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{projectTenantLookup()})

	app := fiber.New()
	RegisterProjectRoutes(app, db)

	payload, _ := json.Marshal(map[string]string{"name": "<script>alert(1)</script>"})
	req := httptest.NewRequest(http.MethodPatch, "/v1/project", bytes.NewBuffer(payload))
	req.Header.Set("Authorization", "Bearer igris_service_key")
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)

	body, _ := io.ReadAll(resp.Body)
	require.NotContains(t, string(body), "<script>", "rejected name must never be echoed back")
	require.Equal(t, 0, drv.remainingExecs(), "script name must never be written")
}

// TestProject_Unauthorized rejects credential-less requests before any DB
// access (zero queued queries means a stray query would error the test).
func TestProject_Unauthorized(t *testing.T) {
	for _, m := range []string{http.MethodGet, http.MethodPatch} {
		db, _ := newQueuedRouteDB(t, nil)
		app := fiber.New()
		RegisterProjectRoutes(app, db)

		req := httptest.NewRequest(m, "/v1/project", nil)
		resp, err := app.Test(req)
		require.NoError(t, err)
		require.Equal(t, http.StatusUnauthorized, resp.StatusCode, "%s must be unauthorized", m)
	}
}

// TestValidProjectName unit-tests the pure validator directly.
func TestValidProjectName(t *testing.T) {
	ok := []string{"Support Agent", "Acme AI Actions", "O'Brien & Co.", "internal_tools-1"}
	for _, n := range ok {
		got, reason := validProjectName(n)
		require.Empty(t, reason, "%q should be valid", n)
		require.Equal(t, n, got)
	}
	require.Equal(t, "Trimmed", mustName(t, "  Trimmed  "))

	bad := map[string]string{
		"a":             "INVALID_NAME_LENGTH",
		"":              "INVALID_NAME_LENGTH",
		"<b>x</b>":      "INVALID_NAME_CHARS",
		"path/to/thing": "INVALID_NAME_CHARS",
		"a=b":           "INVALID_NAME_CHARS",
	}
	for n, code := range bad {
		_, reason := validProjectName(n)
		require.Equal(t, code, reason, "%q should be rejected as %s", n, code)
	}
}

func mustName(t *testing.T, raw string) string {
	t.Helper()
	got, reason := validProjectName(raw)
	require.Empty(t, reason)
	return got
}
