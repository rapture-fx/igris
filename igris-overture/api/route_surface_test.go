package api

import (
	"database/sql"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	_ "github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func TestExperimentalRoutesDisabledByDefault(t *testing.T) {
	clearRouteFlags(t)

	app := fiber.New()
	require.NoError(t, RegisterHealthRoutes(app))
	require.NoError(t, RegisterAllRoutes(app, nil, nil))

	require.True(t, hasRoute(app, "GET", "/healthz"))
	require.True(t, hasRoute(app, "GET", "/readyz"))
	require.True(t, hasRoute(app, "GET", "/startupz"))

	require.False(t, hasRoute(app, "POST", "/v1/infer"))
	require.False(t, hasRoute(app, "GET", "/v1/models"))
	require.False(t, hasRoute(app, "GET", "/metrics"))
	require.False(t, hasRoute(app, "GET", "/v1/metrics/debug"))
}

func TestExperimentalRoutesRequireExplicitFlag(t *testing.T) {
	clearRouteFlags(t)
	t.Setenv(ExperimentalModelRoutesFlag, "true")

	modelApp := fiber.New()
	require.NoError(t, RegisterAllRoutes(modelApp, nil, nil))
	require.True(t, hasRoute(modelApp, "POST", "/v1/infer"))
	require.True(t, hasRoute(modelApp, "GET", "/v1/models"))
	require.False(t, hasRoute(modelApp, "GET", "/metrics"))

	clearRouteFlags(t)
	t.Setenv(DebugMetricsRoutesFlag, "true")

	metricsApp := fiber.New()
	require.NoError(t, RegisterAllRoutes(metricsApp, nil, nil))
	require.True(t, hasRoute(metricsApp, "GET", "/metrics"))
	require.True(t, hasRoute(metricsApp, "GET", "/v1/metrics/debug"))
	require.False(t, hasRoute(metricsApp, "POST", "/v1/infer"))
}

func TestFrontendExperimentalGroupsDisabledByDefault(t *testing.T) {
	clearRouteFlags(t)

	db, err := sql.Open("postgres", "postgres://route-inventory.invalid/unused")
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	app := fiber.New()
	RegisterFrontendRoutes(app, db)

	require.True(t, hasRoute(app, "GET", "/v1/project/"))
	require.False(t, hasRoute(app, "GET", "/v1/cognitive/status"))
	require.False(t, hasRoute(app, "GET", "/v1/shadow/status"))
	require.False(t, hasRoute(app, "GET", "/v1/council/status"))
	require.False(t, hasRoute(app, "GET", "/v1/escapevector/status"))
	require.False(t, hasRoute(app, "GET", "/v1/analytics/cost"))
}

func TestFrontendExperimentalGroupsCanBeEnabledIndependently(t *testing.T) {
	clearRouteFlags(t)
	t.Setenv(ExperimentalRoutingRoutesFlag, "true")

	db, err := sql.Open("postgres", "postgres://route-inventory.invalid/unused")
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })

	app := fiber.New()
	RegisterFrontendRoutes(app, db)

	require.True(t, hasRoute(app, "GET", "/v1/shadow/status"))
	require.True(t, hasRoute(app, "GET", "/v1/council/status"))
	require.True(t, hasRoute(app, "GET", "/v1/escapevector/status"))
	require.False(t, hasRoute(app, "GET", "/v1/cognitive/status"))
	require.False(t, hasRoute(app, "GET", "/v1/analytics/cost"))
}

func TestRouteGroupsHaveClassificationGuard(t *testing.T) {
	clearRouteFlags(t)

	require.NotEmpty(t, RouteGroupInventory)
	for _, group := range RouteGroupInventory {
		require.NotEmpty(t, group.Method, group.Path)
		require.NotEmpty(t, group.RegistrationFile, group.Path)
		require.NotEmpty(t, group.HandlerOrGroup, group.Path)
		require.NotEmpty(t, group.RegistrationFunction, group.Path)
		require.NotEmpty(t, group.AuthMiddleware, group.Path)
		require.NotEmpty(t, group.TenantSource, group.Path)
		require.NotEmpty(t, group.Classification, group.Path)
		require.NotEmpty(t, group.DefaultExposureAfterTask, group.Path)
		require.NotEmpty(t, group.RiskNotes, group.Path)
		if strings.Contains(group.Classification, "feature_flag_required") {
			require.NotEmpty(t, group.FeatureFlag, group.Path)
			require.False(t, RouteFlagEnabled(group.FeatureFlag), "%s should default disabled", group.FeatureFlag)
		}
	}

	requiredClassifiedGroups := []string{
		"RegisterHealthRoutes",
		"RegisterAgentMcpRoutes",
		"RegisterActionRoutes",
		"RegisterActionPackRoutes",
		"RegisterAgentRegistryRoutes",
		"RegisterTaskRoutes",
		"RegisterRuntimeRoutes",
		"RegisterExecutionRoutes",
		"RegisterExecutionAffinityRoutes",
		"RegisterProofRoutes",
		"RegisterExecutionEvalRoutes",
		"RegisterInferRoutes",
		"RegisterMetricsRoutes",
		"RegisterRoutingRoutes",
		"RegisterRoboticsPolicyRoutes",
	}
	classified := map[string]bool{}
	for _, group := range RouteGroupInventory {
		classified[group.RegistrationFunction] = true
	}
	for _, fn := range requiredClassifiedGroups {
		require.True(t, classified[fn], "%s must be represented in RouteGroupInventory", fn)
	}
}

func TestRouteRegistrationSourceGuard(t *testing.T) {
	known := map[string]string{
		"RegisterHealthRoutes":                "core_public_product_api",
		"RegisterAllRoutes":                   "feature-flagged model/debug registration wrapper",
		"RegisterLicenseRoutes":               "console_support_api",
		"RegisterUsageRoutes":                 "console_support_api",
		"RegisterAPIKeyRoutes":                "core_public_product_api",
		"RegisterRuntimeAPIKeyRoutes":         "runtime_registration_or_callback",
		"RegisterAccountAPIKeysRoutes":        "core_public_product_api",
		"RegisterStatsRoutes":                 "console_support_api",
		"RegisterExecutionRoutes":             "core_public_product_api",
		"RegisterExecutionIntelligenceRoutes": "core_public_product_api",
		"RegisterExecutionAffinityRoutes":     "core_public_product_api",
		"RegisterTrustRecommendationRoutes":   "core_public_product_api",
		"RegisterExecutionEvalRoutes":         "core_public_product_api",
		"RegisterPolicySimulationRoutes":      "core_public_product_api",
		"RegisterPolicyProposalRoutes":        "core_public_product_api",
		"RegisterProofRoutes":                 "core_public_product_api",
		"RegisterGovernanceRoutes":            "core_public_product_api",
		"RegisterSpeculativeRoutes":           "experimental_non_core",
		"RegisterModelProviderRoutes":         "experimental_non_core",
		"RegisterFrontendRoutes":              "console_support_api with internal flags",
		"RegisterDeviceRoutes":                "feature_flag_required",
		"RegisterHistoryRoutes":               "feature_flag_required",
		"RegisterSettingsRoutes":              "feature_flag_required",
		"RegisterCostRoutes":                  "feature_flag_required",
		"RegisterPolicyExtRoutes":             "feature_flag_required",
		"RegisterSubscriptionRoutes":          "feature_flag_required",
		"RegisterROSRoutes":                   "experimental_non_core",
		"RegisterBTRoutes":                    "experimental_non_core",
		"RegisterAgentRoutes":                 "feature_flag_required",
		"RegisterCouncilRoutes":               "experimental_non_core",
		"RegisterRuntimeRoutes":               "runtime_registration_or_callback",
		"RegisterDownloadRoutes":              "runtime_registration_or_callback",
		"RegisterTrialRoutes":                 "console_support_api",
		"RegisterFederatedRoutes":             "experimental_non_core",
		"RegisterLoRARoutes":                  "experimental_non_core",
		"RegisterCircuitBreakerRoutes":        "experimental_non_core",
		"RegisterRoutingConfigRoutes":         "experimental_non_core",
		"RegisterRoutingAnalyticsRoutes":      "experimental_non_core",
		"RegisterReceiptRoutes":               "core_public_product_api",
		"RegisterRoboticsPolicyRoutes":        "experimental_non_core",
		"RegisterAICapabilityPolicyRoutes":    "experimental_non_core",
		"RegisterAICredentialRoutes":          "experimental_non_core",
		"RegisterFleetPushRoutes":             "experimental_non_core",
		"RegisterMultimodalRoutes":            "experimental_non_core",
		"RegisterTaskRoutes":                  "core_public_product_api",
		"RegisterActionRoutes":                "core_public_product_api",
		"RegisterContractRoutes":              "core_public_product_api",
		"RegisterEvidenceRoutes":              "core_public_product_api",
		"RegisterActionPackRoutes":            "core_public_product_api",
		"RegisterAgentRegistryRoutes":         "core_public_product_api",
		"RegisterAgentMemoryRoutes":           "core_public_product_api",
		"RegisterAgentMcpRoutes":              "agent_mcp_surface",
		"RegisterCognitiveRoutes":             "experimental_non_core",
		"RegisterCognitiveV1Aliases":          "experimental_non_core",
		"SetupMultiTenancy":                   "core wrapper with provider/routing flags",
		"RegisterTenancyRoutes":               "core_public_product_api",
		"RegisterAuthRoutes":                  "core_public_product_api",
		"RegisterProviderRegistryRoutes":      "experimental_non_core",
		"RegisterRoutingRoutes":               "experimental_non_core",
	}

	for _, source := range []string{
		fileFromPackage(t, "..", "..", "cmd", "igris-overture", "main.go"),
		fileFromPackage(t, "routes_tenancy.go"),
	} {
		for _, fn := range routeRegistrationCalls(t, source) {
			require.Contains(t, known, fn, "%s is registered in %s but is not classified in the route source guard", fn, source)
		}
	}
}

func hasRoute(app *fiber.App, method, path string) bool {
	for _, route := range app.GetRoutes(true) {
		if route.Method == method && route.Path == path {
			return true
		}
	}
	return false
}

func clearRouteFlags(t *testing.T) {
	t.Helper()
	for _, flag := range []string{
		ExperimentalCognitiveRoutesFlag,
		ExperimentalModelRoutesFlag,
		ExperimentalRoutingRoutesFlag,
		ExperimentalRoboticsRoutesFlag,
		ExperimentalAIPolicyRoutesFlag,
		ExperimentalFederatedRoutesFlag,
		ExperimentalFleetRoutesFlag,
		ExperimentalConsoleGapRoutesFlag,
		DebugMetricsRoutesFlag,
		InternalAdminTokenEnv,
	} {
		t.Setenv(flag, "")
	}
}

func fileFromPackage(t *testing.T, parts ...string) string {
	t.Helper()
	path := filepath.Join(parts...)
	require.FileExists(t, path)
	return path
}

func routeRegistrationCalls(t *testing.T, path string) []string {
	t.Helper()
	data, err := os.ReadFile(path)
	require.NoError(t, err)

	re := regexp.MustCompile(`(?:api\.)?\b(Register[A-Za-z0-9]+Routes|Register[A-Za-z0-9]+V1Aliases|SetupMultiTenancy)\s*\(`)
	seen := map[string]bool{}
	for _, line := range strings.Split(string(data), "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "//") || strings.HasPrefix(trimmed, "func ") {
			continue
		}
		for _, match := range re.FindAllStringSubmatch(line, -1) {
			seen[match[1]] = true
		}
	}

	calls := make([]string, 0, len(seen))
	for fn := range seen {
		calls = append(calls, fn)
	}
	return calls
}
