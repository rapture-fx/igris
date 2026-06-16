package api

import (
	"crypto/subtle"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
)

const (
	ExperimentalCognitiveRoutesFlag  = "IGRIS_ENABLE_EXPERIMENTAL_COGNITIVE_ROUTES"
	ExperimentalModelRoutesFlag      = "IGRIS_ENABLE_EXPERIMENTAL_MODEL_ROUTES"
	ExperimentalRoutingRoutesFlag    = "IGRIS_ENABLE_EXPERIMENTAL_ROUTING_ROUTES"
	ExperimentalRoboticsRoutesFlag   = "IGRIS_ENABLE_EXPERIMENTAL_ROBOTICS_ROUTES"
	ExperimentalAIPolicyRoutesFlag   = "IGRIS_ENABLE_EXPERIMENTAL_AI_POLICY_ROUTES"
	ExperimentalFederatedRoutesFlag  = "IGRIS_ENABLE_EXPERIMENTAL_FEDERATED_ROUTES"
	ExperimentalFleetRoutesFlag      = "IGRIS_ENABLE_EXPERIMENTAL_FLEET_ROUTES"
	ExperimentalConsoleGapRoutesFlag = "IGRIS_ENABLE_EXPERIMENTAL_CONSOLE_GAP_ROUTES"
	DebugMetricsRoutesFlag           = "IGRIS_ENABLE_DEBUG_METRICS_ROUTES"
	InternalAdminTokenEnv            = "IGRIS_INTERNAL_ADMIN_TOKEN"
)

type RouteGroupClassification struct {
	Method                   string
	Path                     string
	RegistrationFile         string
	HandlerOrGroup           string
	RegistrationFunction     string
	AuthMiddleware           string
	TenantSource             string
	Classification           string
	DefaultExposureAfterTask string
	RiskNotes                string
	FeatureFlag              string
}

func RouteFlagEnabled(flag string) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(flag))) {
	case "1", "true", "yes", "on", "enabled":
		return true
	default:
		return false
	}
}

func DebugMetricsRoutesEnabled() bool {
	return RouteFlagEnabled(DebugMetricsRoutesFlag)
}

func ExperimentalModelRoutesEnabled() bool {
	return RouteFlagEnabled(ExperimentalModelRoutesFlag)
}

func ExperimentalCognitiveRoutesEnabled() bool {
	return RouteFlagEnabled(ExperimentalCognitiveRoutesFlag)
}

func ExperimentalRoutingRoutesEnabled() bool {
	return RouteFlagEnabled(ExperimentalRoutingRoutesFlag)
}

func ExperimentalRoboticsRoutesEnabled() bool {
	return RouteFlagEnabled(ExperimentalRoboticsRoutesFlag)
}

func ExperimentalAIPolicyRoutesEnabled() bool {
	return RouteFlagEnabled(ExperimentalAIPolicyRoutesFlag)
}

func ExperimentalFederatedRoutesEnabled() bool {
	return RouteFlagEnabled(ExperimentalFederatedRoutesFlag)
}

func ExperimentalFleetRoutesEnabled() bool {
	return RouteFlagEnabled(ExperimentalFleetRoutesFlag)
}

func ExperimentalConsoleGapRoutesEnabled() bool {
	return RouteFlagEnabled(ExperimentalConsoleGapRoutesFlag)
}

func InternalAdminAuthMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		expected := strings.TrimSpace(os.Getenv(InternalAdminTokenEnv))
		if expected == "" {
			return c.SendStatus(fiber.StatusNotFound)
		}

		provided := strings.TrimSpace(c.Get("X-Admin-Token"))
		if provided == "" {
			provided = strings.TrimPrefix(strings.TrimSpace(c.Get("Authorization")), "Bearer ")
		}
		if provided == "" {
			return c.SendStatus(fiber.StatusUnauthorized)
		}
		if subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) != 1 {
			return c.SendStatus(fiber.StatusUnauthorized)
		}
		return c.Next()
	}
}

var RouteGroupInventory = []RouteGroupClassification{
	{
		Method: "GET", Path: "/health,/healthz,/readyz,/startupz,/v1/health", RegistrationFile: "igris-overture/api/routes_health.go",
		HandlerOrGroup: "health probes", RegistrationFunction: "RegisterHealthRoutes", AuthMiddleware: "none", TenantSource: "n/a",
		Classification: "core_public_product_api", DefaultExposureAfterTask: "registered", RiskNotes: "safe liveness/readiness surface",
	},
	{
		Method: "POST", Path: "/v1/mcp", RegistrationFile: "igris-overture/api/routes_mcp.go",
		HandlerOrGroup: "agent MCP", RegistrationFunction: "RegisterAgentMcpRoutes", AuthMiddleware: "BetterAuth", TenantSource: "tenant credential",
		Classification: "agent_mcp_surface", DefaultExposureAfterTask: "registered", RiskNotes: "strict versioned schemas and param validation",
	},
	{
		Method: "GET,POST", Path: "/v1/action-packs,/v1/action-packs/:name/install", RegistrationFile: "igris-overture/api/routes_action_packs.go",
		HandlerOrGroup: "action packs", RegistrationFunction: "RegisterActionPackRoutes", AuthMiddleware: "BetterAuth", TenantSource: "tenant credential",
		Classification: "core_public_product_api", DefaultExposureAfterTask: "registered", RiskNotes: "installs registered actions only; no raw task execution",
	},
	{
		Method: "GET,POST,PATCH,DELETE", Path: "/v1/actions,/v1/actions/run,/v1/actions/runs/:id", RegistrationFile: "igris-overture/api/routes_actions.go",
		HandlerOrGroup: "registered actions", RegistrationFunction: "RegisterActionRoutes", AuthMiddleware: "BetterAuth", TenantSource: "tenant credential",
		Classification: "core_public_product_api", DefaultExposureAfterTask: "registered", RiskNotes: "registered tenant-owned actions only",
	},
	{
		Method: "GET,POST,PATCH,DELETE", Path: "/v1/agents,/v1/agents/:id", RegistrationFile: "igris-overture/api/routes_agent_registry.go",
		HandlerOrGroup: "agent registry", RegistrationFunction: "RegisterAgentRegistryRoutes", AuthMiddleware: "BetterAuth", TenantSource: "tenant credential",
		Classification: "core_public_product_api", DefaultExposureAfterTask: "registered", RiskNotes: "tenant-scoped agent identity and attribution only; PATCH dispatches registry vs execution settings",
	},
	{
		Method: "GET,POST", Path: "/v1/tasks", RegistrationFile: "igris-overture/api/routes_tasks.go",
		HandlerOrGroup: "durable tasks and runtime callbacks", RegistrationFunction: "RegisterTaskRoutes", AuthMiddleware: "BetterAuth", TenantSource: "tenant credential/runtime-forwarded tenant",
		Classification: "core_public_product_api", DefaultExposureAfterTask: "registered", RiskNotes: "runtime callback handlers remain covered by existing callback signature checks",
	},
	{
		Method: "GET,POST,DELETE", Path: "/api/v1/runtime/*,/v1/runtime/api-key,/v1/runtime/download", RegistrationFile: "igris-overture/api/routes_runtime.go",
		HandlerOrGroup: "runtime registration, heartbeat, commands, keys, download", RegistrationFunction: "RegisterRuntimeRoutes", AuthMiddleware: "runtime api key/BetterAuth", TenantSource: "runtime key or tenant credential",
		Classification: "runtime_registration_or_callback", DefaultExposureAfterTask: "registered", RiskNotes: "core runtime bridge",
	},
	{
		Method: "GET,POST,DELETE", Path: "/v1/api-keys,/v1/account/api-key", RegistrationFile: "igris-overture/api/routes_account_apikeys.go",
		HandlerOrGroup: "tenant key management", RegistrationFunction: "RegisterAccountAPIKeysRoutes", AuthMiddleware: "BetterAuth", TenantSource: "tenant credential",
		Classification: "core_public_product_api", DefaultExposureAfterTask: "registered", RiskNotes: "raw keys returned once only",
	},
	{
		Method: "GET,POST", Path: "/v1/execution/*,/v1/execution/governance/*", RegistrationFile: "igris-overture/api/routes_execution.go",
		HandlerOrGroup: "execution inspection and governance", RegistrationFunction: "RegisterExecutionRoutes", AuthMiddleware: "BetterAuth", TenantSource: "tenant credential",
		Classification: "core_public_product_api", DefaultExposureAfterTask: "registered", RiskNotes: "inspection and governance console surface",
	},
	{
		Method: "GET,POST", Path: "/proof/receipts,/v1/proof/*,/v1/receipts/*", RegistrationFile: "igris-overture/api/routes_proof.go",
		HandlerOrGroup: "proof and receipts", RegistrationFunction: "RegisterProofRoutes", AuthMiddleware: "BetterAuth", TenantSource: "tenant credential",
		Classification: "core_public_product_api", DefaultExposureAfterTask: "registered", RiskNotes: "tenant-bound evidence reads",
	},
	{
		Method: "GET,POST,PUT,DELETE", Path: "/v1/tenants,/v1/vault,/v1/policy,/v1/usage,/v1/audit,/v1/traces", RegistrationFile: "igris-overture/api/routes_tenancy.go",
		HandlerOrGroup: "multi-tenancy core", RegistrationFunction: "RegisterTenancyRoutes", AuthMiddleware: "BetterAuth/RequireAdmin", TenantSource: "tenant credential",
		Classification: "core_public_product_api", DefaultExposureAfterTask: "registered when multi-tenancy enabled", RiskNotes: "tenant/admin auth applies",
	},
	{
		Method: "POST", Path: "/v1/infer,/v1/chat/completions,/v1/models,/models/providers,/v1/providers", RegistrationFile: "igris-overture/api/routes_infer.go",
		HandlerOrGroup: "model inference and provider registry", RegistrationFunction: "RegisterInferRoutes", AuthMiddleware: "optional/BetterAuth depending route", TenantSource: "optional tenant or tenant credential",
		Classification: "experimental_non_core,feature_flag_required", DefaultExposureAfterTask: "disabled_by_default", RiskNotes: "model gateway/provider registry is outside the core execution-trust API", FeatureFlag: ExperimentalModelRoutesFlag,
	},
	{
		Method: "GET", Path: "/metrics,/v1/metrics,/v1/metrics/debug", RegistrationFile: "igris-overture/api/routes_metrics.go",
		HandlerOrGroup: "metrics/debug", RegistrationFunction: "RegisterMetricsRoutes", AuthMiddleware: "none", TenantSource: "n/a",
		Classification: "internal_admin,feature_flag_required", DefaultExposureAfterTask: "disabled_by_default", RiskNotes: "debug metrics expose provider/request internals", FeatureFlag: DebugMetricsRoutesFlag,
	},
	{
		Method: "GET,POST,PUT,PATCH", Path: "/admin/cognitive,/v1/cognitive,/api/v1/cognitive", RegistrationFile: "igris-overture/api/routes_cognitive.go",
		HandlerOrGroup: "cognitive advisor", RegistrationFunction: "RegisterCognitiveRoutes", AuthMiddleware: "AdminAuth/BetterAuth", TenantSource: "admin token or tenant credential",
		Classification: "experimental_non_core,feature_flag_required", DefaultExposureAfterTask: "disabled_by_default", RiskNotes: "advisor/applier control plane", FeatureFlag: ExperimentalCognitiveRoutesFlag,
	},
	{
		Method: "GET,POST,PATCH", Path: "/v1/routing,/v1/shadow,/v1/council,/v1/escapevector", RegistrationFile: "igris-overture/api/routes_routing.go",
		HandlerOrGroup: "routing experiments", RegistrationFunction: "RegisterRoutingRoutes", AuthMiddleware: "BetterAuth", TenantSource: "tenant credential",
		Classification: "experimental_non_core,feature_flag_required", DefaultExposureAfterTask: "disabled_by_default", RiskNotes: "speculative, council, shadow, and routing config experiments", FeatureFlag: ExperimentalRoutingRoutesFlag,
	},
	{
		Method: "GET,POST,PUT", Path: "/v1/federated", RegistrationFile: "igris-overture/api/routes_federated.go",
		HandlerOrGroup: "federated learning", RegistrationFunction: "RegisterFederatedRoutes", AuthMiddleware: "BetterAuth", TenantSource: "tenant credential",
		Classification: "experimental_non_core,feature_flag_required", DefaultExposureAfterTask: "disabled_by_default", RiskNotes: "model-training coordinator", FeatureFlag: ExperimentalFederatedRoutesFlag,
	},
	{
		Method: "GET,POST,PUT", Path: "/v1/robotics,/v1/ai/capabilities,/v1/ai/credentials,/v1/ros,/v1/bt", RegistrationFile: "igris-overture/api/routes_robotics_policy.go",
		HandlerOrGroup: "robotics and AI policy lifecycle", RegistrationFunction: "RegisterRoboticsPolicyRoutes", AuthMiddleware: "BetterAuth", TenantSource: "tenant credential",
		Classification: "experimental_non_core,feature_flag_required", DefaultExposureAfterTask: "disabled_by_default", RiskNotes: "robotics lifecycle and credential policy surfaces are non-core", FeatureFlag: ExperimentalRoboticsRoutesFlag,
	},
	{
		Method: "GET,POST,PUT,DELETE", Path: "/devices,/models/usage,/policy,/api/subscription,/v1/agents/memory", RegistrationFile: "igris-overture/api/routes_fleet.go",
		HandlerOrGroup: "gap-fill console APIs", RegistrationFunction: "RegisterDeviceRoutes", AuthMiddleware: "BetterAuth", TenantSource: "tenant credential",
		Classification: "console_support_api,feature_flag_required", DefaultExposureAfterTask: "disabled_by_default", RiskNotes: "mixed-prefix console gap-fill surfaces", FeatureFlag: ExperimentalConsoleGapRoutesFlag,
	},
	{
		Method: "GET,POST", Path: "/admin/slo", RegistrationFile: "cmd/igris-overture/main.go",
		HandlerOrGroup: "SLO enforcer admin", RegistrationFunction: "RegisterSLOAdminRoutes", AuthMiddleware: "InternalAdminAuthMiddleware", TenantSource: "internal admin token",
		Classification: "internal_admin,internalize_required", DefaultExposureAfterTask: "requires_explicit_slo_flag_and_internal_admin_token", RiskNotes: "operational admin/debug surface",
	},
}
