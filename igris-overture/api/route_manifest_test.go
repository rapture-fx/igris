package api

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/Igris-inertial/system/igris-overture/billing"
	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/gofiber/fiber/v2"
	_ "github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

const defaultRouteManifestFixture = "testdata/route_manifest.default.json"

func TestRouteManifestMatchesDefaultFixture(t *testing.T) {
	manifest := generateDefaultRouteManifestForTest(t)
	generated, err := MarshalRouteManifest(manifest)
	require.NoError(t, err)

	fixturePath := filepath.Join(".", defaultRouteManifestFixture)
	if os.Getenv("UPDATE_ROUTE_MANIFEST") == "1" {
		require.NoError(t, os.MkdirAll(filepath.Dir(fixturePath), 0o755))
		require.NoError(t, os.WriteFile(fixturePath, generated, 0o644))
	}

	expected, err := os.ReadFile(fixturePath)
	require.NoError(t, err)
	require.Equal(t, string(expected), string(generated), "route manifest drift detected; review API exposure/classification and update %s intentionally with UPDATE_ROUTE_MANIFEST=1 go test ./igris-overture/api -run TestRouteManifestMatchesDefaultFixture -count=1", defaultRouteManifestFixture)
}

func TestRouteManifestHasClassificationForEveryRoute(t *testing.T) {
	manifest := generateDefaultRouteManifestForTest(t)

	allowedClassifications := map[string]bool{
		"core_public_product_api":          true,
		"agent_mcp_surface":                true,
		"runtime_registration_or_callback": true,
		"console_support_api":              true,
		"internal_admin":                   true,
		"health_or_readiness":              true,
		"debug_or_metrics":                 true,
		"experimental_non_core":            true,
		"legacy_or_dead":                   true,
	}
	allowedExposures := map[string]bool{
		"public":                true,
		"authenticated":         true,
		"runtime_authenticated": true,
		"internal_admin":        true,
		"disabled_by_default":   true,
		"health_probe":          true,
	}

	require.NotEmpty(t, manifest.Routes)
	for _, route := range manifest.Routes {
		require.NotEmpty(t, route.Method, route.Path)
		require.NotEmpty(t, route.Path, route.Method)
		require.NotEmpty(t, route.RouteGroup, "%s %s", route.Method, route.Path)
		require.NotEmpty(t, route.HandlerOrRegistrationSourceIfAvailable, "%s %s", route.Method, route.Path)
		require.Contains(t, allowedClassifications, route.Classification, "%s %s", route.Method, route.Path)
		require.Contains(t, allowedExposures, route.DefaultExposure, "%s %s", route.Method, route.Path)
		require.NotEmpty(t, route.AuthExpectation, "%s %s", route.Method, route.Path)
		require.NotEmpty(t, route.TenantScopeExpectation, "%s %s", route.Method, route.Path)
		require.NotEmpty(t, route.Notes, "%s %s", route.Method, route.Path)
		if route.Classification == "experimental_non_core" || route.DefaultExposure == "disabled_by_default" {
			require.NotEmpty(t, route.FeatureFlag, "%s %s", route.Method, route.Path)
		}
		if route.Classification == "internal_admin" || route.Classification == "debug_or_metrics" {
			require.NotEqual(t, "public", route.DefaultExposure, "%s %s must not be public", route.Method, route.Path)
		}
	}
}

func TestCoreRoutesPresentInDefaultManifest(t *testing.T) {
	manifest := generateDefaultRouteManifestForTest(t)

	for _, expected := range []string{
		"POST /v1/mcp",
		"GET /v1/actions",
		"POST /v1/actions",
		"POST /v1/actions/run",
		"GET /v1/actions/runs/:id",
		"POST /v1/contracts/sync",
		"GET /v1/contracts/actions/:name",
		"GET /v1/contracts/actions/:name/versions/:contract_hash",
		"POST /v1/evidence/batches",
		"GET /v1/evidence/batches/:id",
		"POST /v1/tasks/submit",
		"GET /v1/tasks",
		"GET /v1/tasks/:id",
		"GET /v1/execution-evals",
		"POST /v1/execution-evals",
		"POST /api/v1/runtime/register",
		"POST /api/v1/runtime/heartbeat",
		"GET /api/v1/runtime/commands",
		"POST /api/v1/runtime/commands/ack",
		"GET /proof/receipts",
		"GET /v1/receipts",
		"GET /healthz",
		"GET /readyz",
	} {
		require.True(t, manifestHasRoute(manifest, expected), "%s must be present in default route manifest", expected)
	}
}

func TestExperimentalRoutesNotPublicByDefaultInManifest(t *testing.T) {
	manifest := generateDefaultRouteManifestForTest(t)

	disabledPrefixes := []string{
		"/admin/cognitive",
		"/api/v1/cognitive",
		"/v1/cognitive",
		"/v1/lora",
		"/v1/federated",
		"/v1/infer",
		"/v1/robotics",
		"/v1/ai/capabilities",
		"/v1/ai/credentials",
		"/v1/ros",
		"/v1/bt",
		"/v1/routing",
		"/v1/shadow",
		"/v1/council",
		"/v1/escapevector",
		"/api/v1/runtime/config/push",
		"/api/v1/runtime/update",
	}
	for _, route := range manifest.Routes {
		for _, prefix := range disabledPrefixes {
			require.False(t, route.Path == prefix || strings.HasPrefix(route.Path, prefix+"/"), "%s %s is experimental and must be absent by default", route.Method, route.Path)
		}
	}
}

func TestDebugMetricsNotPublicByDefaultInManifest(t *testing.T) {
	manifest := generateDefaultRouteManifestForTest(t)

	for _, route := range manifest.Routes {
		require.NotEqual(t, "/metrics", route.Path)
		require.NotEqual(t, "/v1/metrics", route.Path)
		require.NotEqual(t, "/v1/metrics/debug", route.Path)
		require.False(t, strings.HasPrefix(route.Path, "/admin/slo"), "%s %s must not be registered without explicit SLO enablement", route.Method, route.Path)
		if route.Classification == "debug_or_metrics" || route.Classification == "internal_admin" {
			require.NotEqual(t, "public", route.DefaultExposure, "%s %s must not be public", route.Method, route.Path)
		}
	}
	require.True(t, manifestHasRoute(manifest, "GET /healthz"))
	require.True(t, manifestHasRoute(manifest, "GET /readyz"))
}

func generateDefaultRouteManifestForTest(t *testing.T) RouteManifest {
	t.Helper()

	app := buildDefaultRouteManifestApp(t)
	manifest, err := GenerateRouteManifest(app, "fiber.GetRoutes(true)", "default feature flags cleared, database-backed core routes registered with inert local handles")
	require.NoError(t, err)
	return manifest
}

func buildDefaultRouteManifestApp(t *testing.T) *fiber.App {
	t.Helper()
	clearRouteFlags(t)
	t.Setenv("POLAR_API_KEY", "")
	t.Setenv("ENABLE_MULTI_TENANCY", "")
	t.Setenv("ENABLE_SLO_ENFORCER", "")
	t.Setenv("ENABLE_COGNITIVE_ADVISOR", "")

	db, err := sql.Open("postgres", "postgres://route-manifest.invalid/unused")
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	app := fiber.New()
	require.NoError(t, RegisterHealthRoutes(app))
	require.NoError(t, RegisterAllRoutes(app, nil, nil))

	RegisterLicenseRoutes(app, db)
	RegisterUsageRoutes(app, db)
	RegisterAPIKeyRoutes(app, db)
	RegisterRuntimeAPIKeyRoutes(app, db)
	RegisterAccountAPIKeysRoutes(app, db)
	RegisterStatsRoutes(app, db, nil, nil)
	RegisterAgentRegistryRoutes(app, db, NewExecutionHandler(db))
	RegisterExecutionRoutes(app, db, nil)
	RegisterExecutionIntelligenceRoutes(app, db)
	RegisterExecutionAffinityRoutes(app, db)
	RegisterTrustRecommendationRoutes(app, db)
	RegisterExecutionEvalRoutes(app, db)
	RegisterPolicySimulationRoutes(app, db)
	RegisterPolicyProposalRoutes(app, db)
	RegisterAgentMemoryRoutes(app, db)
	RegisterProofRoutes(app, db, nil)
	RegisterGovernanceRoutes(app, db)
	RegisterFrontendRoutes(app, db)
	RegisterRuntimeRoutes(app, db, nil)
	RegisterDownloadRoutes(app, db, nil, nil)
	RegisterTrialRoutes(app, db, billing.NewTrialManager(db, nil))
	RegisterReceiptRoutes(app, db)

	taskCoordinator := coordinator.NewTaskCoordinator(db)
	RegisterTaskRoutes(app, db, taskCoordinator)
	RegisterActionRoutes(app, db, taskCoordinator)
	RegisterAgentMcpRoutes(app, db, taskCoordinator)
	RegisterContractRoutes(app, db)
	RegisterEvidenceRoutes(app, db)

	return app
}

func manifestHasRoute(manifest RouteManifest, methodPath string) bool {
	for _, route := range manifest.Routes {
		if route.Method+" "+route.Path == methodPath {
			return true
		}
	}
	return false
}
