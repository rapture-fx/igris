// Package api provides tier-related API routes
package api

import (
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// TierHandler handles tier-related API requests
type TierHandler struct{}

// NewTierHandler creates a new tier handler
func NewTierHandler() *TierHandler {
	return &TierHandler{}
}

// RegisterTierRoutes registers tier-related API routes
func RegisterTierRoutes(app *fiber.App, _ *middleware.TenantAuth) {
	handler := NewTierHandler()

	// v1 API routes (tenant-scoped via Clerk authentication)
	v1 := app.Group("/api/v1/tier")

	// Tier capabilities endpoint - returns what features/limits are available for the tenant's tier
	v1.Get("/capabilities", handler.GetCapabilities)

	log.Info().Msg("[Routes] ✓ Registered tier API endpoints (/api/v1/tier)")
}

// CapabilitiesResponse represents the tier capabilities response
type CapabilitiesResponse struct {
	Tier           string                 `json:"tier"`
	DisplayName    string                 `json:"display_name"`
	AuthorityLevel string                 `json:"authority_level"`
	Description    string                 `json:"description"`
	Features       TierFeaturesResponse   `json:"features"`
	Limits         TierLimitsResponse     `json:"limits"`
	CostControls   TierCostControlsResponse `json:"cost_controls"`
}

// TierFeaturesResponse represents the feature flags in the response
type TierFeaturesResponse struct {
	// Routing & Optimization
	ThompsonSampling     bool `json:"thompson_sampling"`
	SemanticRouting      bool `json:"semantic_routing"`
	CostAwareRouting     bool `json:"cost_aware_routing"`
	AutomaticFailover    bool `json:"automatic_failover"`
	CircuitBreaker       bool `json:"circuit_breaker"`
	SpeculativeExecution bool `json:"speculative_execution"`
	CouncilMode          bool `json:"council_mode"`

	// Cognitive Advisor
	CognitiveAdvisor   bool `json:"cognitive_advisor"`
	CognitiveAutoApply bool `json:"cognitive_auto_apply"`

	// Analytics & Observability
	ObservabilityMetrics bool `json:"observability_metrics"`
	CostForecasting      bool `json:"cost_forecasting"`
	RealTimeAnalytics    bool `json:"real_time_analytics"`

	// Caching
	RedisCaching bool `json:"redis_caching"`
	L2Caching    bool `json:"l2_caching"`

	// Authentication & Authorization
	JWTAuth    bool `json:"jwt_auth"`
	APIKeyAuth bool `json:"api_key_auth"`
	RBAC       bool `json:"rbac"`
	SSO        bool `json:"sso"`

	// Governance & Compliance
	SLAEnforcement    bool `json:"sla_enforcement"`
	PolicyVersioning  bool `json:"policy_versioning"`
	AuditLogs         bool `json:"audit_logs"`
	HotReloadPolicies bool `json:"hot_reload_policies"`

	// Cryptographic Features (Scale only)
	CryptographicSigning     bool `json:"cryptographic_signing"`
	SignedExecutionEnvelopes bool `json:"signed_execution_envelopes"`
	TamperEvidentLogs        bool `json:"tamper_evident_logs"`

	// Core Features
	MultiTenancy bool `json:"multi_tenancy"`
	BYOK         bool `json:"byok"`

	// Advanced Features
	CustomSLATargets    bool `json:"custom_sla_targets"`
	AdvancedGovernance  bool `json:"advanced_governance"`
	OnPremiseDeployment bool `json:"on_premise_deployment"`
	MultiRegion         bool `json:"multi_region"`

	// Unkillable Resilience Suite (FREE for ALL tiers)
	EscapeVectorMode  bool `json:"escapevector_mode"`
	EmergencyHotfix   bool `json:"emergency_hotfix"`
	GoldCodeOverride  bool `json:"gold_code_override"`
	RustWASMFallback  bool `json:"rust_wasm_fallback"`
}

// TierLimitsResponse represents the usage limits in the response
type TierLimitsResponse struct {
	MaxRequestsPerMonth      int `json:"max_requests_per_month"`      // -1 = unlimited
	MaxRequestsPerSecond     int `json:"max_requests_per_second"`
	MaxRequestsPerMinute     int `json:"max_requests_per_minute"`
	MaxConcurrentRequests    int `json:"max_concurrent_requests"`
	MaxProviders             int `json:"max_providers"`              // -1 = unlimited
	MaxModelsPerProvider     int `json:"max_models_per_provider"`
	MaxCustomProviders       int `json:"max_custom_providers"`
	MaxTenants               int `json:"max_tenants"`
	MaxAPIKeys               int `json:"max_api_keys"`
	CacheTTLSeconds          int `json:"cache_ttl_seconds"`
	MaxCachedClassifications int `json:"max_cached_classifications"` // -1 = unlimited
	AuditLogRetentionDays    int `json:"audit_log_retention_days"`
}

// TierCostControlsResponse represents cost control settings in the response
type TierCostControlsResponse struct {
	EnforceBudget        bool    `json:"enforce_budget"`
	MonthlyBudgetUSD     float64 `json:"monthly_budget_usd"`
	BudgetAlertThreshold float64 `json:"budget_alert_threshold"`
	CostPerRequestLimit  float64 `json:"cost_per_request_limit"`
}

// GetCapabilities handles GET /api/v1/tier/capabilities
// Returns the capabilities (features and limits) for the authenticated tenant's tier
func (h *TierHandler) GetCapabilities(c *fiber.Ctx) error {
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Tenant context not found",
				"type":    "authentication_error",
			},
		})
	}

	// Get tier from context (set by TierEnforcer middleware)
	tier, ok := c.Locals("tier").(string)
	if !ok || tier == "" {
		// Default to Seed tier if not set
		tier = "seed"
	}

	// Get tier policy from context
	tierPolicy, ok := c.Locals("tier_policy").(middleware.TierPolicy)
	if !ok {
		// Return minimal response if tier policy not available
		return c.JSON(CapabilitiesResponse{
			Tier:           tier,
			DisplayName:    middleware.GetTierDisplayName(tier),
			AuthorityLevel: middleware.GetTierAuthorityLevel(tier),
			Description:    "Tier details not available",
			Features:       getDefaultFeatures(tier),
			Limits:         getDefaultLimits(tier),
			CostControls:   TierCostControlsResponse{},
		})
	}

	// Build response from tier policy
	response := CapabilitiesResponse{
		Tier:           tier,
		DisplayName:    tierPolicy.DisplayName,
		AuthorityLevel: middleware.GetTierAuthorityLevel(tier),
		Description:    tierPolicy.Description,
		Features: TierFeaturesResponse{
			// Routing & Optimization
			ThompsonSampling:     tierPolicy.Features.ThompsonSampling,
			SemanticRouting:      tierPolicy.Features.SemanticRouting,
			CostAwareRouting:     tierPolicy.Features.CostAwareRouting,
			AutomaticFailover:    tierPolicy.Features.AutomaticFailover,
			CircuitBreaker:       tierPolicy.Features.CircuitBreaker,
			SpeculativeExecution: tierPolicy.Features.SpeculativeExecution,
			CouncilMode:          tierPolicy.Features.CouncilMode,

			// Cognitive Advisor
			CognitiveAdvisor:   tierPolicy.Features.CognitiveAdvisor,
			CognitiveAutoApply: tierPolicy.Features.CognitiveAutoApply,

			// Analytics & Observability
			ObservabilityMetrics: tierPolicy.Features.ObservabilityMetrics,
			CostForecasting:      tierPolicy.Features.CostForecasting,
			RealTimeAnalytics:    tierPolicy.Features.RealTimeAnalytics,

			// Caching
			RedisCaching: tierPolicy.Features.RedisCaching,
			L2Caching:    tierPolicy.Features.L2Caching,

			// Authentication & Authorization
			JWTAuth:    tierPolicy.Features.JWTAuth,
			APIKeyAuth: tierPolicy.Features.APIKeyAuth,
			RBAC:       tierPolicy.Features.RBAC,
			SSO:        tierPolicy.Features.SSO,

			// Governance & Compliance
			SLAEnforcement:    tierPolicy.Features.SLAEnforcement,
			PolicyVersioning:  tierPolicy.Features.PolicyVersioning,
			AuditLogs:         tierPolicy.Features.AuditLogs,
			HotReloadPolicies: tierPolicy.Features.HotReloadPolicies,

			// Cryptographic Features (Scale only)
			CryptographicSigning:     tierPolicy.Features.CryptographicSigning,
			SignedExecutionEnvelopes: tierPolicy.Features.SignedExecutionEnvelopes,
			TamperEvidentLogs:        tierPolicy.Features.TamperEvidentLogs,

			// Core Features
			MultiTenancy: tierPolicy.Features.MultiTenancy,
			BYOK:         tierPolicy.Features.BYOK,

			// Advanced Features
			CustomSLATargets:    tierPolicy.Features.CustomSLATargets,
			AdvancedGovernance:  tierPolicy.Features.AdvancedGovernance,
			OnPremiseDeployment: tierPolicy.Features.OnPremiseDeployment,
			MultiRegion:         tierPolicy.Features.MultiRegion,

			// Unkillable Resilience Suite - FREE for ALL tiers
			EscapeVectorMode: true,
			EmergencyHotfix:  true,
			GoldCodeOverride: true,
			RustWASMFallback: true,
		},
		Limits: TierLimitsResponse{
			MaxRequestsPerMonth:      tierPolicy.Limits.MaxRequestsPerMonth,
			MaxRequestsPerSecond:     tierPolicy.Limits.MaxRequestsPerSecond,
			MaxRequestsPerMinute:     tierPolicy.Limits.MaxRequestsPerMinute,
			MaxConcurrentRequests:    0, // Not in current TierLimits struct
			MaxProviders:             tierPolicy.Limits.MaxProviders,
			MaxModelsPerProvider:     tierPolicy.Limits.MaxModelsPerProvider,
			MaxCustomProviders:       tierPolicy.Limits.MaxCustomProviders,
			MaxTenants:               tierPolicy.Limits.MaxTenants,
			MaxAPIKeys:               tierPolicy.Limits.MaxAPIKeys,
			CacheTTLSeconds:          tierPolicy.Limits.CacheTTLSeconds,
			MaxCachedClassifications: tierPolicy.Limits.MaxCachedClassifications,
			AuditLogRetentionDays:    0, // Not in current TierLimits struct
		},
		CostControls: TierCostControlsResponse{
			EnforceBudget:        tierPolicy.CostControls.EnforceBudget,
			MonthlyBudgetUSD:     tierPolicy.CostControls.MonthlyBudgetUSD,
			BudgetAlertThreshold: tierPolicy.CostControls.BudgetAlertThreshold,
			CostPerRequestLimit:  tierPolicy.CostControls.CostPerRequestLimit,
		},
	}

	log.Info().
		Str("tenant_id", tenantCtx.TenantID).
		Str("tier", tier).
		Str("authority_level", response.AuthorityLevel).
		Msg("[Tier API] Capabilities requested")

	return c.JSON(response)
}

// getDefaultFeatures returns feature flags for a tier.
// Per the Igris Inertial pricing model, all tiers have identical feature access.
// Only runtime scale (number of registered instances) differs between tiers.
func getDefaultFeatures(_ string) TierFeaturesResponse {
	return TierFeaturesResponse{
		// Routing & Optimization
		ThompsonSampling:     true,
		SemanticRouting:      true,
		CostAwareRouting:     true,
		AutomaticFailover:    true,
		CircuitBreaker:       true,
		SpeculativeExecution: true,
		CouncilMode:          true,

		// Cognitive Advisor
		CognitiveAdvisor:   true,
		CognitiveAutoApply: true,

		// Analytics & Observability
		ObservabilityMetrics: true,
		CostForecasting:      true,
		RealTimeAnalytics:    true,

		// Caching
		RedisCaching: true,
		L2Caching:    true,

		// Authentication & Authorization
		JWTAuth:    true,
		APIKeyAuth: true,
		RBAC:       true,
		SSO:        true,

		// Governance & Compliance
		SLAEnforcement:    true,
		PolicyVersioning:  true,
		AuditLogs:         true,
		HotReloadPolicies: true,

		// Cryptographic Features
		CryptographicSigning:     true,
		SignedExecutionEnvelopes: true,
		TamperEvidentLogs:        true,

		// Core Features
		MultiTenancy: true,
		BYOK:         true,

		// Advanced Features
		CustomSLATargets:    true,
		AdvancedGovernance:  true,
		OnPremiseDeployment: true,
		MultiRegion:         true,

		// Unkillable Resilience Suite — always available
		EscapeVectorMode: true,
		EmergencyHotfix:  true,
		GoldCodeOverride: true,
		RustWASMFallback: true,
	}
}

// getDefaultLimits returns default limits for a tier when policy is not available.
// Limits are now based on runtime instance count only — there are no per-request limits.
func getDefaultLimits(tier string) TierLimitsResponse {
	switch tier {
	case "infinite":
		return TierLimitsResponse{
			MaxRequestsPerMonth:      -1, // Unlimited
			MaxRequestsPerSecond:     -1,
			MaxRequestsPerMinute:     -1,
			MaxConcurrentRequests:    -1,
			MaxProviders:             -1,
			MaxModelsPerProvider:     -1,
			MaxCustomProviders:       -1,
			MaxTenants:               -1,
			MaxAPIKeys:               -1,
			CacheTTLSeconds:          1800,
			MaxCachedClassifications: -1,
			AuditLogRetentionDays:    90,
		}
	case "horizon":
		return TierLimitsResponse{
			MaxRequestsPerMonth:      -1, // Unlimited
			MaxRequestsPerSecond:     -1,
			MaxRequestsPerMinute:     -1,
			MaxConcurrentRequests:    -1,
			MaxProviders:             -1,
			MaxModelsPerProvider:     -1,
			MaxCustomProviders:       -1,
			MaxTenants:               -1,
			MaxAPIKeys:               -1,
			CacheTTLSeconds:          600,
			MaxCachedClassifications: -1,
			AuditLogRetentionDays:    30,
		}
	default: // seed
		return TierLimitsResponse{
			MaxRequestsPerMonth:      -1, // Unlimited
			MaxRequestsPerSecond:     -1,
			MaxRequestsPerMinute:     -1,
			MaxConcurrentRequests:    -1,
			MaxProviders:             -1,
			MaxModelsPerProvider:     -1,
			MaxCustomProviders:       -1,
			MaxTenants:               1,
			MaxAPIKeys:               5,
			CacheTTLSeconds:          300,
			MaxCachedClassifications: 1000,
			AuditLogRetentionDays:    14,
		}
	}
}
