package api

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"github.com/gofiber/fiber/v2"
)

const RouteManifestVersion = "route-manifest/v1"

type RouteManifest struct {
	ManifestVersion    string               `json:"manifest_version"`
	GeneratedFrom      string               `json:"generated_from"`
	DefaultEnvironment string               `json:"default_environment"`
	Routes             []RouteManifestEntry `json:"routes"`
}

type RouteManifestEntry struct {
	Method                                 string `json:"method"`
	Path                                   string `json:"path"`
	RouteGroup                             string `json:"route_group"`
	HandlerOrRegistrationSourceIfAvailable string `json:"handler_or_registration_source_if_available"`
	Classification                         string `json:"classification"`
	DefaultExposure                        string `json:"default_exposure"`
	AuthExpectation                        string `json:"auth_expectation"`
	TenantScopeExpectation                 string `json:"tenant_scope_expectation"`
	FeatureFlag                            string `json:"feature_flag"`
	Notes                                  string `json:"notes"`
}

type RouteManifestMetadata struct {
	RouteGroup             string
	RegistrationSource     string
	Classification         string
	DefaultExposure        string
	AuthExpectation        string
	TenantScopeExpectation string
	FeatureFlag            string
	Notes                  string
}

type routeManifestRule struct {
	Method string
	Path   string
	Meta   RouteManifestMetadata
}

func GenerateRouteManifest(app *fiber.App, generatedFrom, defaultEnvironment string) (RouteManifest, error) {
	routes := make([]RouteManifestEntry, 0)
	seen := map[string]bool{}

	for _, route := range app.GetRoutes(true) {
		if route.Method == "" || route.Path == "" || route.Method == "HEAD" {
			continue
		}
		key := route.Method + " " + normalizeManifestPath(route.Path)
		if seen[key] {
			continue
		}
		seen[key] = true

		meta, ok := routeManifestMetadata(route.Method, route.Path)
		if !ok {
			return RouteManifest{}, fmt.Errorf("route %s %s has no route manifest classification", route.Method, route.Path)
		}
		routes = append(routes, RouteManifestEntry{
			Method:                                 route.Method,
			Path:                                   normalizeManifestPath(route.Path),
			RouteGroup:                             meta.RouteGroup,
			HandlerOrRegistrationSourceIfAvailable: meta.RegistrationSource,
			Classification:                         meta.Classification,
			DefaultExposure:                        meta.DefaultExposure,
			AuthExpectation:                        meta.AuthExpectation,
			TenantScopeExpectation:                 meta.TenantScopeExpectation,
			FeatureFlag:                            meta.FeatureFlag,
			Notes:                                  meta.Notes,
		})
	}

	sort.Slice(routes, func(i, j int) bool {
		if routes[i].Path == routes[j].Path {
			return routes[i].Method < routes[j].Method
		}
		return routes[i].Path < routes[j].Path
	})

	return RouteManifest{
		ManifestVersion:    RouteManifestVersion,
		GeneratedFrom:      generatedFrom,
		DefaultEnvironment: defaultEnvironment,
		Routes:             routes,
	}, nil
}

func MarshalRouteManifest(manifest RouteManifest) ([]byte, error) {
	out, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return nil, err
	}
	return append(out, '\n'), nil
}

func normalizeManifestPath(path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return "/"
	}
	if len(path) > 1 {
		path = strings.TrimSuffix(path, "/")
	}
	return path
}

func routeManifestMetadata(method, path string) (RouteManifestMetadata, bool) {
	method = strings.ToUpper(strings.TrimSpace(method))
	path = normalizeManifestPath(path)

	for _, rule := range routeManifestRules {
		if rule.Method != "" && rule.Method != method {
			continue
		}
		if routeManifestPathMatches(rule.Path, path) {
			return rule.Meta, true
		}
	}
	return RouteManifestMetadata{}, false
}

func routeManifestPathMatches(pattern, path string) bool {
	pattern = normalizeManifestPath(pattern)
	if strings.HasSuffix(pattern, "/*") {
		prefix := strings.TrimSuffix(pattern, "/*")
		return path == prefix || strings.HasPrefix(path, prefix+"/")
	}
	return pattern == path
}

var routeManifestRules = []routeManifestRule{
	{
		Path: "/health/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "health",
			RegistrationSource:     "RegisterHealthRoutes",
			Classification:         "health_or_readiness",
			DefaultExposure:        "health_probe",
			AuthExpectation:        "none",
			TenantScopeExpectation: "n/a",
			Notes:                  "Kubernetes and console health checks",
		},
	},
	{
		Path: "/health",
		Meta: RouteManifestMetadata{
			RouteGroup:             "health",
			RegistrationSource:     "RegisterHealthRoutes",
			Classification:         "health_or_readiness",
			DefaultExposure:        "health_probe",
			AuthExpectation:        "none",
			TenantScopeExpectation: "n/a",
			Notes:                  "Console health gate alias",
		},
	},
	{
		Path: "/healthz",
		Meta: RouteManifestMetadata{
			RouteGroup:             "health",
			RegistrationSource:     "RegisterHealthRoutes",
			Classification:         "health_or_readiness",
			DefaultExposure:        "health_probe",
			AuthExpectation:        "none",
			TenantScopeExpectation: "n/a",
			Notes:                  "Kubernetes liveness probe",
		},
	},
	{
		Path: "/readyz",
		Meta: RouteManifestMetadata{
			RouteGroup:             "health",
			RegistrationSource:     "RegisterHealthRoutes",
			Classification:         "health_or_readiness",
			DefaultExposure:        "health_probe",
			AuthExpectation:        "none",
			TenantScopeExpectation: "n/a",
			Notes:                  "Kubernetes readiness probe",
		},
	},
	{
		Path: "/startupz",
		Meta: RouteManifestMetadata{
			RouteGroup:             "health",
			RegistrationSource:     "RegisterHealthRoutes",
			Classification:         "health_or_readiness",
			DefaultExposure:        "health_probe",
			AuthExpectation:        "none",
			TenantScopeExpectation: "n/a",
			Notes:                  "Kubernetes startup probe",
		},
	},
	{
		Path: "/v1/health",
		Meta: RouteManifestMetadata{
			RouteGroup:             "health",
			RegistrationSource:     "RegisterHealthRoutes",
			Classification:         "health_or_readiness",
			DefaultExposure:        "health_probe",
			AuthExpectation:        "none",
			TenantScopeExpectation: "n/a",
			Notes:                  "Detailed health endpoint",
		},
	},
	{
		Path: "/v1/mcp",
		Meta: RouteManifestMetadata{
			RouteGroup:             "agent_mcp",
			RegistrationSource:     "RegisterAgentMcpRoutes",
			Classification:         "agent_mcp_surface",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant credential required",
			Notes:                  "Agent-facing MCP JSON-RPC endpoint with strict tool schemas",
		},
	},
	{
		Path: "/v1/action-packs/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "action_packs",
			RegistrationSource:     "RegisterActionPackRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-owned registered action installs",
			Notes:                  "Built-in Action Pack install (registered actions only)",
		},
	},
	{
		Path: "/v1/action-packs",
		Meta: RouteManifestMetadata{
			RouteGroup:             "action_packs",
			RegistrationSource:     "RegisterActionPackRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant credential required",
			Notes:                  "Built-in Action Pack catalog",
		},
	},
	{
		Method: "GET",
		Path:   "/v1/actions/runs/:id/reconciliation",
		Meta: RouteManifestMetadata{
			RouteGroup:             "actions",
			RegistrationSource:     "RegisterActionRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth admin session",
			TenantScopeExpectation: "tenant-owned immutable reconciliation history",
			Notes:                  "Operator inspection of typed unknown-effect state; no raw target body or proof mutation",
		},
	},
	{
		Method: "POST",
		Path:   "/v1/actions/runs/:id/reconciliation",
		Meta: RouteManifestMetadata{
			RouteGroup:             "actions",
			RegistrationSource:     "RegisterActionRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth admin session",
			TenantScopeExpectation: "tenant-owned append-only operator resolution",
			Notes:                  "Appends an operator assertion only; never retries an effect or rewrites execution evidence",
		},
	},
	{
		Path: "/v1/actions/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "actions",
			RegistrationSource:     "RegisterActionRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-owned action definitions and idempotency",
			Notes:                  "Registered action gateway",
		},
	},
	{
		Path: "/v1/actions",
		Meta: RouteManifestMetadata{
			RouteGroup:             "actions",
			RegistrationSource:     "RegisterActionRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-owned action definitions",
			Notes:                  "Registered action management",
		},
	},
	{
		Path: "/v1/contracts/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "contracts",
			RegistrationSource:     "RegisterContractRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-owned logical actions and immutable contract versions",
			Notes:                  "Contract sync remains declaration-only; execution requires a separate explicit immutable target binding",
		},
	},
	{
		Path: "/v1/evidence/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "evidence",
			RegistrationSource:     "RegisterEvidenceRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-scoped SDK signing keys, evidence batches, and events",
			Notes:                  "Embedded SDK evidence ingestion and status; server re-verifies hashes/signatures/chain, stores execution_provenance=embedded only, and grants no execution permission",
		},
	},
	{
		Path: "/v1/tasks/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "tasks",
			RegistrationSource:     "RegisterTaskRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential or runtime-forwarded tenant context",
			TenantScopeExpectation: "tenant-bound task records and proof state",
			Notes:                  "Durable task lifecycle and runtime callbacks",
		},
	},
	{
		Path: "/v1/tasks",
		Meta: RouteManifestMetadata{
			RouteGroup:             "tasks",
			RegistrationSource:     "RegisterTaskRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound task listing",
			Notes:                  "Durable task listing",
		},
	},
	{
		Path: "/api/v1/runtime/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "runtime",
			RegistrationSource:     "RegisterRuntimeRoutes",
			Classification:         "runtime_registration_or_callback",
			DefaultExposure:        "runtime_authenticated",
			AuthExpectation:        "runtime API key with request signature where applicable",
			TenantScopeExpectation: "runtime key maps to tenant",
			Notes:                  "Runtime registration, heartbeat, command polling, and acknowledgements",
		},
	},
	{
		Path: "/v1/runtime/install",
		Meta: RouteManifestMetadata{
			RouteGroup:             "runtime_download",
			RegistrationSource:     "RegisterDownloadRoutes",
			Classification:         "runtime_registration_or_callback",
			DefaultExposure:        "public",
			AuthExpectation:        "none",
			TenantScopeExpectation: "n/a",
			Notes:                  "Public runtime installer helper",
		},
	},
	{
		Path: "/v1/runtime/checksum",
		Meta: RouteManifestMetadata{
			RouteGroup:             "runtime_download",
			RegistrationSource:     "RegisterDownloadRoutes",
			Classification:         "runtime_registration_or_callback",
			DefaultExposure:        "public",
			AuthExpectation:        "none",
			TenantScopeExpectation: "n/a",
			Notes:                  "Public runtime checksum helper",
		},
	},
	{
		Path: "/v1/runtime/download",
		Meta: RouteManifestMetadata{
			RouteGroup:             "runtime_download",
			RegistrationSource:     "RegisterDownloadRoutes",
			Classification:         "runtime_registration_or_callback",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant subscription checked before binary download",
			Notes:                  "Authenticated runtime binary download",
		},
	},
	{
		Path: "/proof/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "proof",
			RegistrationSource:     "RegisterProofRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound evidence reads and verification",
			Notes:                  "Proof receipt listing and verification",
		},
	},
	{
		Path: "/v1/proof/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "proof",
			RegistrationSource:     "RegisterProofRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound proof violation reads",
			Notes:                  "Proof violation support surface",
		},
	},
	{
		Path: "/v1/receipts/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "receipts",
			RegistrationSource:     "RegisterReceiptRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound receipt reads and exports",
			Notes:                  "Execution receipt and replay support",
		},
	},
	{
		Path: "/v1/receipts",
		Meta: RouteManifestMetadata{
			RouteGroup:             "receipts",
			RegistrationSource:     "RegisterReceiptRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound receipt listing",
			Notes:                  "Execution receipt listing",
		},
	},
	{
		Path: "/v1/execution/intelligence",
		Meta: RouteManifestMetadata{
			RouteGroup:             "execution_intelligence",
			RegistrationSource:     "RegisterExecutionIntelligenceRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound execution metrics derived from durable task truth",
			Notes:                  "Agent and action reliability metrics from task, approval, and recovery records",
		},
	},
	{
		Path: "/v1/execution/affinity",
		Meta: RouteManifestMetadata{
			RouteGroup:             "execution_affinity",
			RegistrationSource:     "RegisterExecutionAffinityRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound agent/action/pack relationship aggregates",
			Notes:                  "Agent-to-action, action-to-agent, and pack relationship metrics from durable execution truth; no raw execution payloads",
		},
	},
	{
		Path: "/v1/execution/trust-recommendations",
		Meta: RouteManifestMetadata{
			RouteGroup:             "trust_recommendations",
			RegistrationSource:     "RegisterTrustRecommendationRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound deterministic attention items derived from durable execution aggregates",
			Notes:                  "Read-only execution-trust findings (recovery/proof/eval/approval thresholds + stale approved proposals); no LLM, no mutation, no persistence, no raw payloads",
		},
	},
	{
		Path: "/v1/execution/trust-recommendations/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "trust_recommendations",
			RegistrationSource:     "RegisterTrustRecommendationRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-owned trust recommendation lifecycle state (acknowledge/snooze/resolve)",
			Notes:                  "Lifecycle overlay on deterministic findings; stores only status/reason/timestamps by stable recommendation_id; no payloads, no mutation of execution data; rejects tenant override and unknown fields",
		},
	},
	{
		Path: "/v1/execution-evals/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "execution_evals",
			RegistrationSource:     "RegisterExecutionEvalRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound deterministic eval definitions and eval run results",
			Notes:                  "Execution-truth assertions over durable task, proof, approval, and recovery records",
		},
	},
	{
		Path: "/v1/execution-evals",
		Meta: RouteManifestMetadata{
			RouteGroup:             "execution_evals",
			RegistrationSource:     "RegisterExecutionEvalRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-owned deterministic eval definitions",
			Notes:                  "Execution evaluation CRUD; rejects tenant_id body overrides",
		},
	},
	{
		Path: "/v1/policy/proposals",
		Meta: RouteManifestMetadata{
			RouteGroup:             "policy_proposals",
			RegistrationSource:     "RegisterPolicyProposalRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-owned draft policy rules and their governance events",
			Notes:                  "Policy proposal lifecycle (draft/review/approve) over the read-only simulation engine; no active-policy mutation, replay, dispatch, or raw-body persistence; rejects tenant_id body overrides",
		},
	},
	{
		Path: "/v1/policy/proposals/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "policy_proposals",
			RegistrationSource:     "RegisterPolicyProposalRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-owned draft policy rule detail, re-simulation, and approval",
			Notes:                  "Proposal get/update/archive/simulate/approve; re-simulation reuses /v1/policy/simulate engine; safe summaries only",
		},
	},
	{
		Path: "/v1/policy/simulate",
		Meta: RouteManifestMetadata{
			RouteGroup:             "policy_simulation",
			RegistrationSource:     "RegisterPolicySimulationRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound read-only impact preview over durable execution records",
			Notes:                  "Deterministic policy-change preview; read-only aggregation, no policy mutation, replay, dispatch, or persistence; rejects tenant_id body overrides",
		},
	},
	{
		Path: "/v1/execution/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "execution",
			RegistrationSource:     "RegisterExecutionRoutes/RegisterGovernanceRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound execution inspection",
			Notes:                  "Execution inspection and governance",
		},
	},
	{
		Path: "/v1/agents",
		Meta: RouteManifestMetadata{
			RouteGroup:             "agent_registry",
			RegistrationSource:     "RegisterAgentRegistryRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-owned registered agent identities",
			Notes:                  "Agent registry list and create",
		},
	},
	{
		Path: "/v1/agents/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "agent_registry",
			RegistrationSource:     "RegisterAgentRegistryRoutes/RegisterExecutionRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound registry CRUD and execution agent state",
			Notes:                  "Registered agent management, settings patch dispatch, and BT state",
		},
	},
	{
		Path: "/v1/agent-memory",
		Meta: RouteManifestMetadata{
			RouteGroup:             "agent_memory",
			RegistrationSource:     "RegisterAgentMemoryRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound summary memory attached to tasks, runs, or registered agents",
			Notes:                  "Summary-only evidence memory; rejects prompts, chain-of-thought, and secrets",
		},
	},
	{
		Path: "/v1/policies/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "execution",
			RegistrationSource:     "RegisterExecutionRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound policy assignment",
			Notes:                  "Execution policy assignment",
		},
	},
	{
		Path: "/v1/policies",
		Meta: RouteManifestMetadata{
			RouteGroup:             "execution",
			RegistrationSource:     "RegisterExecutionRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound policy listing",
			Notes:                  "Execution policy listing",
		},
	},
	{
		Path: "/v1/alerts/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "execution",
			RegistrationSource:     "RegisterExecutionRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound alert stream",
			Notes:                  "Execution alert stream",
		},
	},
	{
		Path: "/v1/api-keys/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "account_api_keys",
			RegistrationSource:     "RegisterAccountAPIKeysRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound app or agent keys",
			Notes:                  "Tenant app and agent API key management",
		},
	},
	{
		Path: "/v1/api-keys",
		Meta: RouteManifestMetadata{
			RouteGroup:             "account_api_keys",
			RegistrationSource:     "RegisterAccountAPIKeysRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound app or agent keys",
			Notes:                  "Tenant app and agent API key management",
		},
	},
	{
		Path: "/v1/account/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "account_api_key",
			RegistrationSource:     "RegisterAPIKeyRoutes",
			Classification:         "core_public_product_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound runtime API key",
			Notes:                  "Tenant runtime API key management",
		},
	},
	{
		Path: "/v1/runtime/api-key/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "runtime_api_key",
			RegistrationSource:     "RegisterRuntimeAPIKeyRoutes",
			Classification:         "runtime_registration_or_callback",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound runtime API key",
			Notes:                  "Tenant runtime key lifecycle",
		},
	},
	{
		Path: "/v1/runtime/api-key",
		Meta: RouteManifestMetadata{
			RouteGroup:             "runtime_api_key",
			RegistrationSource:     "RegisterRuntimeAPIKeyRoutes",
			Classification:         "runtime_registration_or_callback",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-bound runtime API key",
			Notes:                  "Tenant runtime key lifecycle",
		},
	},
	{
		Path: "/api/v1/license/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "license",
			RegistrationSource:     "RegisterLicenseRoutes",
			Classification:         "console_support_api",
			DefaultExposure:        "public",
			AuthExpectation:        "license key validation in request payload where applicable",
			TenantScopeExpectation: "tenant/license scoped",
			Notes:                  "License validation and console support",
		},
	},
	{
		Path: "/v1/license/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "license",
			RegistrationSource:     "RegisterLicenseRoutes",
			Classification:         "console_support_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-scoped license state",
			Notes:                  "Console license support",
		},
	},
	{
		Path: "/api/v1/usage/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "usage",
			RegistrationSource:     "RegisterUsageRoutes",
			Classification:         "console_support_api",
			DefaultExposure:        "public",
			AuthExpectation:        "license key in request payload",
			TenantScopeExpectation: "tenant/license scoped usage",
			Notes:                  "Usage accounting support",
		},
	},
	{
		Path: "/v1/stats/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "stats",
			RegistrationSource:     "RegisterStatsRoutes",
			Classification:         "console_support_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-scoped dashboard aggregate",
			Notes:                  "Console dashboard aggregates",
		},
	},
	{
		Path: "/v1/usage/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "stats",
			RegistrationSource:     "RegisterStatsRoutes",
			Classification:         "console_support_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-scoped usage summary",
			Notes:                  "Console usage summary",
		},
	},
	{
		Path: "/v1/project/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "project",
			RegistrationSource:     "RegisterFrontendRoutes/RegisterProjectRoutes",
			Classification:         "console_support_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-scoped project identity",
			Notes:                  "Console project identity support",
		},
	},
	{
		Path: "/v1/project",
		Meta: RouteManifestMetadata{
			RouteGroup:             "project",
			RegistrationSource:     "RegisterFrontendRoutes/RegisterProjectRoutes",
			Classification:         "console_support_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-scoped project identity",
			Notes:                  "Console project identity support",
		},
	},
	{
		Path: "/v1/trial/*",
		Meta: RouteManifestMetadata{
			RouteGroup:             "trial",
			RegistrationSource:     "RegisterTrialRoutes",
			Classification:         "console_support_api",
			DefaultExposure:        "authenticated",
			AuthExpectation:        "BetterAuth tenant credential",
			TenantScopeExpectation: "tenant-scoped trial state",
			Notes:                  "Trial lifecycle support",
		},
	},
}
