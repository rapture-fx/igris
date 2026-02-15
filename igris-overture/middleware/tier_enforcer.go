// Package middleware provides tier-based gating and enforcement
package middleware

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/redis/go-redis/v9"
	"gopkg.in/yaml.v3"
)

// ============================================================================
// PROMETHEUS METRICS
// ============================================================================

var (
	// Tier enforcement metrics
	tierEnforcementHits = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_tier_enforcement_hits_total",
			Help: "Total number of tier enforcement checks performed",
		},
		[]string{"tier", "feature", "result"}, // result: allowed/denied
	)

	tierLimitExceeded = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_tier_limit_exceeded_total",
			Help: "Total number of tier limit violations",
		},
		[]string{"tier", "limit_type"}, // limit_type: requests/providers/features
	)

	tierRequestUsage = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_tier_request_usage",
			Help: "Current request usage for each tenant tier",
		},
		[]string{"tier", "tenant_id"},
	)

	tierProviderUsage = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_tier_provider_usage",
			Help: "Current provider count for each tenant tier",
		},
		[]string{"tier", "tenant_id"},
	)

	tierLimitPercentage = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "igris_tier_limit_percentage",
			Help: "Percentage of tier limit consumed (0-100)",
		},
		[]string{"tier", "tenant_id", "limit_type"},
	)

	tierSoftLimitWarnings = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "igris_tier_soft_limit_warnings_total",
			Help: "Total soft limit warnings issued (80% threshold)",
		},
		[]string{"tier", "tenant_id", "limit_type"},
	)
)

// ============================================================================
// TIER CONFIGURATION STRUCTURES
// ============================================================================

// TierConfig represents the complete tier configuration from tier_config.yaml
type TierConfig struct {
	Version     string                `yaml:"version"`
	LastUpdated string                `yaml:"last_updated"`
	Tiers       map[string]TierPolicy `yaml:"tiers"`
	Global      GlobalConfig          `yaml:"global"`
}

// TierPolicy defines limits and feature flags for a specific tier
type TierPolicy struct {
	Name         string       `yaml:"name"`
	DisplayName  string       `yaml:"display_name"`
	Description  string       `yaml:"description"`
	Price        PriceInfo    `yaml:"price"`
	Limits       TierLimits   `yaml:"limits"`
	Features     FeatureFlags `yaml:"features"`
	CostControls CostControls `yaml:"cost_controls"`
}

// PriceInfo contains pricing details
type PriceInfo struct {
	USD              float64 `yaml:"usd"`
	Currency         string  `yaml:"currency"`
	BillingPeriod    string  `yaml:"billing_period"`
	OverageRatePer1k float64 `yaml:"overage_rate_per_1k"` // Cost per 1,000 requests after limit
}

// TierLimits defines usage limits for a tier
type TierLimits struct {
	MaxRequestsPerMonth    int `yaml:"max_requests_per_month"`    // -1 = unlimited
	MaxRequestsPerSecond   int `yaml:"max_requests_per_second"`
	MaxRequestsPerMinute   int `yaml:"max_requests_per_minute"`
	MaxProviders           int `yaml:"max_providers"`              // -1 = unlimited
	MaxModelsPerProvider   int `yaml:"max_models_per_provider"`
	MaxCustomProviders     int `yaml:"max_custom_providers"`
	MaxTenants             int `yaml:"max_tenants"`
	MaxAPIKeys             int `yaml:"max_api_keys"`
	CacheTTLSeconds        int `yaml:"cache_ttl_seconds"`
	MaxCachedClassifications int `yaml:"max_cached_classifications"` // -1 = unlimited
}

// FeatureFlags defines feature access per tier
type FeatureFlags struct {
	// Core Features
	MultiTenancy        bool `yaml:"multi_tenancy"`
	BYOK                bool `yaml:"byok"`

	// Routing & Optimization
	ThompsonSampling      bool `yaml:"thompson_sampling"`
	SemanticRouting       bool `yaml:"semantic_routing"`
	CostAwareRouting      bool `yaml:"cost_aware_routing"`
	AutomaticFailover     bool `yaml:"automatic_failover"`
	CircuitBreaker        bool `yaml:"circuit_breaker"`
	SpeculativeExecution  bool `yaml:"speculative_execution"`  // Growth+ only
	CouncilMode           bool `yaml:"council_mode"`           // Growth+ only

	// Cognitive Advisor
	CognitiveAdvisor      bool `yaml:"cognitive_advisor"`
	CognitiveAutoApply    bool `yaml:"cognitive_auto_apply"`   // Growth+ only

	// Analytics & Observability
	ObservabilityMetrics bool `yaml:"observability_metrics"`
	CostForecasting      bool `yaml:"cost_forecasting"`
	RealTimeAnalytics    bool `yaml:"real_time_analytics"`

	// Caching
	RedisCaching         bool `yaml:"redis_caching"`
	L2Caching            bool `yaml:"l2_caching"`

	// Authentication & Authorization
	JWTAuth              bool `yaml:"jwt_auth"`
	APIKeyAuth           bool `yaml:"api_key_auth"`
	RBAC                 bool `yaml:"rbac"`
	SSO                  bool `yaml:"sso"`

	// Governance & Compliance
	SLAEnforcement       bool `yaml:"sla_enforcement"`
	PolicyVersioning     bool `yaml:"policy_versioning"`
	AuditLogs            bool `yaml:"audit_logs"`
	HotReloadPolicies    bool `yaml:"hot_reload_policies"`

	// Cryptographic Features (Scale only)
	CryptographicSigning       bool `yaml:"cryptographic_signing"`         // Scale only
	SignedExecutionEnvelopes   bool `yaml:"signed_execution_envelopes"`    // Scale only
	TamperEvidentLogs          bool `yaml:"tamper_evident_logs"`           // Scale only

	// Advanced Features
	CustomSLATargets     bool `yaml:"custom_sla_targets"`
	AdvancedGovernance   bool `yaml:"advanced_governance"`
	OnPremiseDeployment  bool `yaml:"on_premise_deployment"`
	MultiRegion          bool `yaml:"multi_region"`
}

// CostControls defines cost management settings
type CostControls struct {
	EnforceBudget        bool    `yaml:"enforce_budget"`
	MonthlyBudgetUSD     float64 `yaml:"monthly_budget_usd"`
	BudgetAlertThreshold float64 `yaml:"budget_alert_threshold"`
	CostPerRequestLimit  float64 `yaml:"cost_per_request_limit"`
}

// GlobalConfig defines global tier management settings
type GlobalConfig struct {
	DefaultTier                 string `yaml:"default_tier"`
	AllowSelfServiceUpgrade     bool   `yaml:"allow_self_service_upgrade"`
	AllowSelfServiceDowngrade   bool   `yaml:"allow_self_service_downgrade"`
	DowngradeGracePeriodDays    int    `yaml:"downgrade_grace_period_days"`
	RateLimitStrategy           string `yaml:"rate_limit_strategy"`
	RateLimitRedisKeyPrefix     string `yaml:"rate_limit_redis_key_prefix"`
	CacheStrategy               string `yaml:"cache_strategy"`
	EnforceTenantIsolation      bool   `yaml:"enforce_tenant_isolation"`
}

// ============================================================================
// TIER ENFORCER
// ============================================================================

// TierEnforcer enforces tier-based limits and feature access
type TierEnforcer struct {
	config       *TierConfig
	configPath   string
	db           *sql.DB
	redis        *redis.Client
	logger       *log.Logger
	mu           sync.RWMutex
	lastReloaded time.Time
	enabled      bool
}

// TierEnforcerConfig holds initialization config
type TierEnforcerConfig struct {
	ConfigPath string
	DB         *sql.DB
	Redis      *redis.Client
	Enabled    bool
}

// NewTierEnforcer creates a new tier enforcement middleware
func NewTierEnforcer(cfg TierEnforcerConfig) (*TierEnforcer, error) {
	enforcer := &TierEnforcer{
		configPath: cfg.ConfigPath,
		db:         cfg.DB,
		redis:      cfg.Redis,
		logger:     log.Default(),
		enabled:    cfg.Enabled,
	}

	// Load tier configuration
	if err := enforcer.loadConfig(); err != nil {
		return nil, fmt.Errorf("failed to load tier config: %w", err)
	}

	enforcer.logger.Printf("[TierEnforcer] Initialized with %d tiers (enabled: %v)",
		len(enforcer.config.Tiers), enforcer.enabled)

	// ========================================================================
	// UNKILLABLE RESILIENCE SUITE - FREE FOREVER ON ALL TIERS
	// ========================================================================
	enforcer.logger.Printf("[TierEnforcer] ✅ Unkillable Resilience Suite: ENABLED FOR ALL TIERS")
	enforcer.logger.Printf("[TierEnforcer]    • Gold Code Override (BYOK_BYPASS_CONTROL_PLANE)")
	enforcer.logger.Printf("[TierEnforcer]    • EscapeVector Mode (TypeScript + Rust WASM)")
	enforcer.logger.Printf("[TierEnforcer]    • Emergency Hotfix Blob fetching & application")
	enforcer.logger.Printf("[TierEnforcer]    • 72-hour encrypted Bayesian cache")
	enforcer.logger.Printf("[TierEnforcer]    Core survival is free forever. Superpowers cost money.")

	return enforcer, nil
}

// loadConfig loads tier configuration from YAML file
func (te *TierEnforcer) loadConfig() error {
	te.mu.Lock()
	defer te.mu.Unlock()

	data, err := os.ReadFile(te.configPath)
	if err != nil {
		return fmt.Errorf("failed to read config file: %w", err)
	}

	var config TierConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return fmt.Errorf("failed to parse YAML: %w", err)
	}

	te.config = &config
	te.lastReloaded = time.Now()

	te.logger.Printf("[TierEnforcer] Config loaded: %d tiers (version: %s)",
		len(config.Tiers), config.Version)

	return nil
}

// ReloadConfig reloads tier configuration (hot reload support)
func (te *TierEnforcer) ReloadConfig() error {
	start := time.Now()
	if err := te.loadConfig(); err != nil {
		return err
	}
	te.logger.Printf("[TierEnforcer] Config reloaded in %v", time.Since(start))
	return nil
}

// ============================================================================
// MIDDLEWARE HANDLER
// ============================================================================

// Enforce is the main tier enforcement middleware
func (te *TierEnforcer) Enforce() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Skip if disabled
		if !te.enabled {
			return c.Next()
		}

		// Get tenant context (populated by TenantAuth middleware)
		tenantCtx := GetTenantContext(c)
		if tenantCtx == nil {
			// No tenant context - skip enforcement (e.g., health checks)
			return c.Next()
		}

		// Get tenant tier from database
		tier, err := te.getTenantTier(tenantCtx.TenantID)
		if err != nil {
			te.logger.Printf("[TierEnforcer] Failed to get tier for tenant %s: %v",
				tenantCtx.TenantID, err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Failed to verify tier membership",
				"code":  "TIER_VERIFICATION_FAILED",
			})
		}

		// Get tier policy
		policy, exists := te.getTierPolicy(tier)
		if !exists {
			te.logger.Printf("[TierEnforcer] Unknown tier: %s for tenant %s",
				tier, tenantCtx.TenantID)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Invalid tier configuration",
				"code":  "INVALID_TIER",
			})
		}

		// Store tier info in context for downstream use
		c.Locals("tier", tier)
		c.Locals("tier_policy", policy)

		// Enforce request limits
		if err := te.enforceRequestLimits(c, tenantCtx.TenantID, tier, policy); err != nil {
			return err // Error response already sent
		}

		// Enforce provider limits (only on provider-related endpoints)
		if te.isProviderEndpoint(c.Path()) {
			if err := te.enforceProviderLimits(c, tenantCtx.TenantID, tier, policy); err != nil {
				return err
			}
		}

		// Enforce feature flags (only on feature-specific endpoints)
		if err := te.enforceFeatureFlags(c, tier, policy); err != nil {
			return err
		}

		// Record enforcement success
		tierEnforcementHits.WithLabelValues(tier, "all_checks", "allowed").Inc()

		return c.Next()
	}
}

// ============================================================================
// REQUEST LIMIT ENFORCEMENT
// ============================================================================

// enforceRequestLimits checks and enforces monthly request limits
func (te *TierEnforcer) enforceRequestLimits(c *fiber.Ctx, tenantID, tier string, policy TierPolicy) error {
	// Skip if unlimited
	if policy.Limits.MaxRequestsPerMonth == -1 {
		return nil
	}

	// Get current request count from Redis
	ctx := context.Background()
	redisKey := te.getRequestCounterKey(tenantID)

	// Increment request counter atomically
	currentCount, err := te.redis.Incr(ctx, redisKey).Result()
	if err != nil {
		te.logger.Printf("[TierEnforcer] Redis incr failed for tenant %s: %v", tenantID, err)
		// Fail open (allow request) but log error
		return nil
	}

	// Set expiry on first increment (monthly TTL)
	if currentCount == 1 {
		// Set TTL to end of current month
		now := time.Now()
		endOfMonth := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location())
		ttl := endOfMonth.Sub(now)
		te.redis.Expire(ctx, redisKey, ttl)
	}

	// Calculate usage percentage
	limitPercent := (float64(currentCount) / float64(policy.Limits.MaxRequestsPerMonth)) * 100

	// Update Prometheus metrics
	tierRequestUsage.WithLabelValues(tier, tenantID).Set(float64(currentCount))
	tierLimitPercentage.WithLabelValues(tier, tenantID, "requests").Set(limitPercent)

	// Check hard limit (100%)
	if currentCount > int64(policy.Limits.MaxRequestsPerMonth) {
		tierLimitExceeded.WithLabelValues(tier, "requests").Inc()

		te.logger.Printf("[TierEnforcer] Hard limit exceeded: tenant=%s tier=%s count=%d limit=%d",
			tenantID, tier, currentCount, policy.Limits.MaxRequestsPerMonth)

		// Mark hard limit reached in database
		te.markHardLimitReached(tenantID)

		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
			"error":   "Monthly request limit exceeded",
			"code":    "TIER_LIMIT_EXCEEDED",
			"tier":    tier,
			"limit":   policy.Limits.MaxRequestsPerMonth,
			"current": currentCount,
			"resets_at": te.getResetTimestamp(tenantID),
			"upgrade_url": "/api/v1/account/upgrade",
		})
	}

	// Check soft limit (80%)
	if limitPercent >= 80.0 && limitPercent < 100.0 {
		// Issue soft limit warning (non-blocking)
		if !te.hasSoftLimitWarningBeenSent(tenantID) {
			tierSoftLimitWarnings.WithLabelValues(tier, tenantID, "requests").Inc()
			te.sendSoftLimitWarning(tenantID, tier, currentCount, policy.Limits.MaxRequestsPerMonth)
			te.markSoftLimitWarningSent(tenantID)

			// Add warning header (but allow request)
			c.Set("X-Tier-Warning", fmt.Sprintf("Approaching limit: %.0f%% of monthly requests used", limitPercent))
		}
	}

	// OVERAGE LOGIC: Calculate overage cost and handle notifications/upgrades
	if limitPercent >= 100.0 {
		overageCost := te.calculateOverageCost(currentCount, policy)

		// Send 100% overage notification (once)
		if limitPercent >= 100.0 && limitPercent < 105.0 {
			if !te.hasOverageNotificationBeenSent(tenantID) {
				te.sendOverageNotification(tenantID, tier, currentCount, policy.Limits.MaxRequestsPerMonth, overageCost)
				te.markOverageNotificationSent(tenantID)
			}
		}

		// Send 120% overage notification with auto-upgrade suggestion
		if limitPercent >= 120.0 {
			nextTier, nextTierPrice, hasNext := te.getNextTier(tier)
			if hasNext {
				// Check if auto-upgrade would save money
				if overageCost > nextTierPrice {
					// Trigger auto-upgrade
					te.logger.Printf("[TierEnforcer] Auto-upgrade condition met: overage=$%.2f > next_tier=$%.2f",
						overageCost, nextTierPrice)

					if !te.hasAutoUpgradeBeenTriggered(tenantID) {
						if err := te.triggerAutoUpgrade(tenantID, tier, nextTier, overageCost, nextTierPrice); err != nil {
							te.logger.Printf("[TierEnforcer] Auto-upgrade failed: %v", err)
						} else {
							te.markAutoUpgradeTriggered(tenantID)
						}
					}
				} else {
					// Send high overage notification without auto-upgrade
					if !te.hasHighOverageNotificationBeenSent(tenantID) {
						te.sendOverageHighNotification(tenantID, tier, currentCount, policy.Limits.MaxRequestsPerMonth,
							overageCost, nextTierPrice, nextTier)
						te.markHighOverageNotificationSent(tenantID)
					}
				}
			}
		}

		// Add overage info to response headers
		c.Set("X-Overage-Cost", fmt.Sprintf("$%.2f", overageCost))
		c.Set("X-Overage-Requests", fmt.Sprintf("%d", currentCount-int64(policy.Limits.MaxRequestsPerMonth)))
	}

	return nil
}

// ============================================================================
// PROVIDER LIMIT ENFORCEMENT
// ============================================================================

// enforceProviderLimits checks provider count limits
func (te *TierEnforcer) enforceProviderLimits(c *fiber.Ctx, tenantID, tier string, policy TierPolicy) error {
	// Skip if unlimited
	if policy.Limits.MaxProviders == -1 {
		return nil
	}

	// Only enforce on POST /v1/providers (creating new provider)
	if c.Method() != "POST" {
		return nil
	}

	// Get current provider count from database
	providerCount, err := te.getProviderCount(tenantID)
	if err != nil {
		te.logger.Printf("[TierEnforcer] Failed to get provider count for tenant %s: %v",
			tenantID, err)
		// Fail open
		return nil
	}

	// Update Prometheus metrics
	tierProviderUsage.WithLabelValues(tier, tenantID).Set(float64(providerCount))

	// Calculate percentage
	limitPercent := (float64(providerCount) / float64(policy.Limits.MaxProviders)) * 100
	tierLimitPercentage.WithLabelValues(tier, tenantID, "providers").Set(limitPercent)

	// Check hard limit
	if providerCount >= policy.Limits.MaxProviders {
		tierLimitExceeded.WithLabelValues(tier, "providers").Inc()

		te.logger.Printf("[TierEnforcer] Provider limit exceeded: tenant=%s tier=%s count=%d limit=%d",
			tenantID, tier, providerCount, policy.Limits.MaxProviders)

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":   "Provider limit exceeded for tier",
			"code":    "PROVIDER_LIMIT_EXCEEDED",
			"tier":    tier,
			"limit":   policy.Limits.MaxProviders,
			"current": providerCount,
			"message": fmt.Sprintf("Your %s tier allows up to %d providers. Please upgrade to add more.",
				tier, policy.Limits.MaxProviders),
			"upgrade_url": "/api/v1/account/upgrade",
		})
	}

	// Soft limit warning (80%)
	if limitPercent >= 80.0 {
		c.Set("X-Tier-Warning", fmt.Sprintf("Approaching provider limit: %d/%d providers used",
			providerCount, policy.Limits.MaxProviders))
		tierSoftLimitWarnings.WithLabelValues(tier, tenantID, "providers").Inc()
	}

	return nil
}

// ============================================================================
// FEATURE FLAG ENFORCEMENT
// ============================================================================

// enforceFeatureFlags checks if tenant has access to requested features
func (te *TierEnforcer) enforceFeatureFlags(c *fiber.Ctx, tier string, policy TierPolicy) error {
	path := c.Path()

	// Map endpoints to required features
	requiredFeature := te.getRequiredFeature(path)
	if requiredFeature == "" {
		// No feature gating for this endpoint
		return nil
	}

	// Check if feature is enabled for this tier
	hasAccess := te.hasFeatureAccess(policy.Features, requiredFeature)

	// Record metric
	result := "allowed"
	if !hasAccess {
		result = "denied"
	}
	tierEnforcementHits.WithLabelValues(tier, requiredFeature, result).Inc()

	if !hasAccess {
		tierLimitExceeded.WithLabelValues(tier, "features").Inc()

		te.logger.Printf("[TierEnforcer] Feature access denied: tier=%s feature=%s path=%s",
			tier, requiredFeature, path)

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":   "Feature not available in your tier",
			"code":    "FEATURE_NOT_AVAILABLE",
			"tier":    tier,
			"feature": requiredFeature,
			"message": fmt.Sprintf("The '%s' feature is not available in the %s tier",
				requiredFeature, tier),
			"upgrade_url": "/api/v1/account/upgrade",
		})
	}

	return nil
}

// getRequiredFeature maps endpoint paths to required features
func (te *TierEnforcer) getRequiredFeature(path string) string {
	// Map specific endpoints to features
	// Authority levels: observe → influence → enforce → prove
	featureMap := map[string]string{
		// Governance & Compliance
		"/v1/sla":             "sla_enforcement",
		"/v1/policies":        "policy_versioning",
		"/v1/audit":           "audit_logs",
		"/v1/governance":      "advanced_governance",
		"/v1/sso":             "sso",

		// Analytics & Observability
		"/v1/analytics":       "real_time_analytics",
		"/v1/forecasting":     "cost_forecasting",
		"/v1/semantic":        "semantic_routing",

		// Routing Features (Growth+ only)
		"/v1/speculative":     "speculative_execution",   // Growth+ only
		"/v1/council":         "council_mode",            // Growth+ only
		"/v1/thompson":        "thompson_sampling",       // Growth+ only (live exploration)

		// Cognitive Advisor
		"/v1/cognitive/proposals":      "cognitive_advisor",
		"/v1/cognitive/config":         "cognitive_auto_apply",  // Growth+ for auto-apply config

		// Cryptographic Features (Scale only)
		"/v1/crypto":          "cryptographic_signing",   // Scale only
		"/v1/signed":          "signed_execution_envelopes", // Scale only

		// NOTE: EscapeVector Mode, Emergency Policy, and Gold Code Override
		// are FREE for all tiers - no gating required
		"/v1/emergency":       "",  // No gating - free for all
		"/v1/escapevector":    "",  // No gating - free for all
	}

	for prefix, feature := range featureMap {
		if len(path) >= len(prefix) && path[:len(prefix)] == prefix {
			return feature
		}
	}

	return ""
}

// hasFeatureAccess checks if a feature is enabled
func (te *TierEnforcer) hasFeatureAccess(features FeatureFlags, featureName string) bool {
	switch featureName {
	// Governance & Compliance
	case "sla_enforcement":
		return features.SLAEnforcement
	case "policy_versioning":
		return features.PolicyVersioning
	case "audit_logs":
		return features.AuditLogs
	case "advanced_governance":
		return features.AdvancedGovernance
	case "sso":
		return features.SSO

	// Analytics & Observability
	case "real_time_analytics":
		return features.RealTimeAnalytics
	case "cost_forecasting":
		return features.CostForecasting
	case "semantic_routing":
		return features.SemanticRouting

	// Routing Features (Growth+ only)
	case "speculative_execution":
		return features.SpeculativeExecution
	case "council_mode":
		return features.CouncilMode
	case "thompson_sampling":
		return features.ThompsonSampling

	// Cognitive Advisor
	case "cognitive_advisor":
		return features.CognitiveAdvisor
	case "cognitive_auto_apply":
		return features.CognitiveAutoApply

	// Cryptographic Features (Scale only)
	case "cryptographic_signing":
		return features.CryptographicSigning
	case "signed_execution_envelopes":
		return features.SignedExecutionEnvelopes
	case "tamper_evident_logs":
		return features.TamperEvidentLogs

	// ======================================================================
	// RESILIENCE FEATURES - FREE FOR ALL TIERS
	// ======================================================================
	// EscapeVector Mode, Emergency Hotfix Blob, and Gold Code Override
	// are fundamental resilience features that ship free on ALL tiers.
	// No paywalls. No gating. These are table stakes.
	case "escapevector_mode":
		return true  // Free for all tiers
	case "emergency_hotfix":
		return true  // Free for all tiers
	case "gold_code_override":
		return true  // Free for all tiers
	case "rust_wasm_fallback":
		return true  // Free for all tiers
	default:
		return true // Unknown features are allowed by default
	}
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// getTenantTier retrieves tier from database
// Respects trial status: if trial is active, uses trial_tier with full access
func (te *TierEnforcer) getTenantTier(tenantID string) (string, error) {
	var tier string
	var trialActive bool
	var trialEndsAt sql.NullTime

	err := te.db.QueryRow(`
		SELECT
			tier,
			COALESCE(trial_active, false) as trial_active,
			trial_ends_at
		FROM tenants
		WHERE id = $1
	`, tenantID).Scan(&tier, &trialActive, &trialEndsAt)

	if err == sql.ErrNoRows {
		// Default to 'developer' tier for unknown tenants
		return te.config.Global.DefaultTier, nil
	}

	if err != nil {
		return "", err
	}

	// If trial is active and not expired, grant full tier access
	if trialActive && trialEndsAt.Valid && time.Now().Before(trialEndsAt.Time) {
		te.logger.Printf("[TierEnforcer] Trial active: tenant=%s tier=%s expires=%s",
			tenantID, tier, trialEndsAt.Time.Format(time.RFC3339))
		return tier, nil
	}

	// If trial expired, auto-downgrade to develop (this is a safety check)
	if trialActive && trialEndsAt.Valid && time.Now().After(trialEndsAt.Time) {
		te.logger.Printf("[TierEnforcer] Trial expired: tenant=%s, downgrading to develop", tenantID)

		// Update database to mark trial as inactive
		te.db.Exec(`
			UPDATE tenants
			SET trial_active = false, tier = 'develop', trial_expired_at = CURRENT_TIMESTAMP
			WHERE id = $1
		`, tenantID)

		return "develop", nil
	}

	return tier, nil
}

// getTierPolicy retrieves tier policy from config
func (te *TierEnforcer) getTierPolicy(tierName string) (TierPolicy, bool) {
	te.mu.RLock()
	defer te.mu.RUnlock()

	policy, exists := te.config.Tiers[tierName]
	return policy, exists
}

// getRequestCounterKey generates Redis key for request counter
func (te *TierEnforcer) getRequestCounterKey(tenantID string) string {
	// Format: igris:ratelimit:tenant_id:YYYY-MM:request_count
	now := time.Now()
	monthKey := now.Format("2006-01")
	return fmt.Sprintf("%s%s:%s:request_count",
		te.config.Global.RateLimitRedisKeyPrefix, tenantID, monthKey)
}

// getProviderCount counts active providers for a tenant
func (te *TierEnforcer) getProviderCount(tenantID string) (int, error) {
	var count int
	err := te.db.QueryRow(`
		SELECT COUNT(*) FROM provider_registry
		WHERE tenant_id = $1 AND status = 'active'
	`, tenantID).Scan(&count)

	return count, err
}

// isProviderEndpoint checks if path is a provider-related endpoint
func (te *TierEnforcer) isProviderEndpoint(path string) bool {
	return len(path) >= 13 && path[:13] == "/v1/providers"
}

// getResetTimestamp returns when the monthly counter resets
func (te *TierEnforcer) getResetTimestamp(tenantID string) string {
	now := time.Now()
	nextMonth := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, now.Location())
	return nextMonth.Format(time.RFC3339)
}

// hasSoftLimitWarningBeenSent checks if soft limit warning was already sent
func (te *TierEnforcer) hasSoftLimitWarningBeenSent(tenantID string) bool {
	var sent bool
	err := te.db.QueryRow(`
		SELECT soft_limit_warning_sent FROM tenants WHERE id = $1
	`, tenantID).Scan(&sent)

	if err != nil {
		return false
	}

	return sent
}

// markSoftLimitWarningSent marks that soft limit warning was sent
func (te *TierEnforcer) markSoftLimitWarningSent(tenantID string) {
	te.db.Exec(`
		UPDATE tenants SET soft_limit_warning_sent = true WHERE id = $1
	`, tenantID)
}

// markHardLimitReached marks that hard limit was reached
func (te *TierEnforcer) markHardLimitReached(tenantID string) {
	te.db.Exec(`
		UPDATE tenants SET hard_limit_reached_at = CURRENT_TIMESTAMP WHERE id = $1
	`, tenantID)
}

// hasOverageNotificationBeenSent checks if 100% overage notification was sent
func (te *TierEnforcer) hasOverageNotificationBeenSent(tenantID string) bool {
	var sent bool
	err := te.db.QueryRow(`
		SELECT overage_notification_sent FROM tenants WHERE id = $1
	`, tenantID).Scan(&sent)

	if err != nil {
		return false
	}

	return sent
}

// markOverageNotificationSent marks that 100% overage notification was sent
func (te *TierEnforcer) markOverageNotificationSent(tenantID string) {
	te.db.Exec(`
		UPDATE tenants SET overage_notification_sent = true WHERE id = $1
	`, tenantID)
}

// hasHighOverageNotificationBeenSent checks if 120% overage notification was sent
func (te *TierEnforcer) hasHighOverageNotificationBeenSent(tenantID string) bool {
	var sent bool
	err := te.db.QueryRow(`
		SELECT high_overage_notification_sent FROM tenants WHERE id = $1
	`, tenantID).Scan(&sent)

	if err != nil {
		return false
	}

	return sent
}

// markHighOverageNotificationSent marks that 120% overage notification was sent
func (te *TierEnforcer) markHighOverageNotificationSent(tenantID string) {
	te.db.Exec(`
		UPDATE tenants SET high_overage_notification_sent = true WHERE id = $1
	`, tenantID)
}

// hasAutoUpgradeBeenTriggered checks if auto-upgrade was triggered
func (te *TierEnforcer) hasAutoUpgradeBeenTriggered(tenantID string) bool {
	var triggered bool
	err := te.db.QueryRow(`
		SELECT auto_upgrade_triggered FROM tenants WHERE id = $1
	`, tenantID).Scan(&triggered)

	if err != nil {
		return false
	}

	return triggered
}

// markAutoUpgradeTriggered marks that auto-upgrade was triggered
func (te *TierEnforcer) markAutoUpgradeTriggered(tenantID string) {
	te.db.Exec(`
		UPDATE tenants SET auto_upgrade_triggered = true, auto_upgrade_triggered_at = CURRENT_TIMESTAMP WHERE id = $1
	`, tenantID)
}

// sendSoftLimitWarning sends warning notification (placeholder for future alerting)
func (te *TierEnforcer) sendSoftLimitWarning(tenantID, tier string, current int64, limit int) {
	te.logger.Printf("[TierEnforcer] 80%% Usage Warning: tenant=%s tier=%s usage=%d/%d",
		tenantID, tier, current, limit)

	// TODO: Send email using AlertQueue
	// Email Template: "80% Usage Warning"
	// Subject: "You've used 80% of your monthly request limit"
	// Body:
	//   Hi there,
	//
	//   You've used 80% of your monthly request limit on your {tier} plan.
	//
	//   Current usage: {current:,} / {limit:,} requests
	//   Remaining: {limit-current:,} requests
	//   Resets: {next_month}
	//
	//   What happens if I exceed my limit?
	//   - Develop: $0.25 per 1,000 requests
	//   - Growth: $0.20 per 1,000 requests
	//
	//   We'll notify you when you reach 100% and suggest an upgrade if it saves you money.
	//
	//   View your usage: {dashboard_url}
}

// calculateOverageCost calculates the overage cost for current usage
func (te *TierEnforcer) calculateOverageCost(currentCount int64, policy TierPolicy) float64 {
	// No overage if unlimited or under limit
	if policy.Limits.MaxRequestsPerMonth == -1 || currentCount <= int64(policy.Limits.MaxRequestsPerMonth) {
		return 0
	}

	// Calculate overage requests
	overageRequests := currentCount - int64(policy.Limits.MaxRequestsPerMonth)

	// Calculate cost: (overage_requests / 1000) * rate_per_1k
	overageCost := (float64(overageRequests) / 1000.0) * policy.Price.OverageRatePer1k

	return overageCost
}

// getNextTier returns the next tier up from current tier (for auto-upgrade logic)
func (te *TierEnforcer) getNextTier(currentTier string) (string, float64, bool) {
	// Authority progression: observe → influence → enforce → prove
	tierOrder := []string{"hacker", "startup", "growth", "scale"}

	// Handle legacy tier name
	if currentTier == "developer" {
		currentTier = "startup"
	}

	for i, tier := range tierOrder {
		if tier == currentTier && i < len(tierOrder)-1 {
			nextTierName := tierOrder[i+1]
			nextPolicy, exists := te.getTierPolicy(nextTierName)
			if exists {
				return nextTierName, nextPolicy.Price.USD, true
			}
		}
	}

	return "", 0, false
}

// sendOverageNotification sends notification when user enters overage (100%)
func (te *TierEnforcer) sendOverageNotification(tenantID, tier string, current int64, limit int, overageCost float64) {
	te.logger.Printf("[TierEnforcer] 100%% Overage Started: tenant=%s tier=%s usage=%d/%d overage_cost=$%.2f",
		tenantID, tier, current, limit, overageCost)

	// TODO: Send email using AlertQueue
	// Email Template: "You've exceeded your request limit"
	// Subject: "Overage charges started on your {tier} plan"
	// Body:
	//   Hi there,
	//
	//   You've exceeded your monthly request limit and overage charges have started.
	//
	//   Plan: {tier}
	//   Monthly limit: {limit:,} requests
	//   Current usage: {current:,} requests
	//   Overage: {current-limit:,} requests
	//   Current overage cost: ${overageCost:.2f}
	//
	//   Overage rate: ${rate} per 1,000 requests
	//
	//   Don't worry - we'll suggest an upgrade if it would save you money!
	//
	//   View your usage: {dashboard_url}
}

// sendOverageHighNotification sends notification at 120% usage with auto-upgrade suggestion
func (te *TierEnforcer) sendOverageHighNotification(tenantID, tier string, current int64, limit int, overageCost, nextTierPrice float64, nextTierName string) {
	te.logger.Printf("[TierEnforcer] 120%% High Overage: tenant=%s tier=%s usage=%d/%d overage=$%.2f next_tier=%s ($%.2f)",
		tenantID, tier, current, limit, overageCost, nextTierName, nextTierPrice)

	// TODO: Send email using AlertQueue
	// Email Template: "Consider upgrading to save money"
	// Subject: "You could save ${savings:.2f} by upgrading to {next_tier}"
	// Body:
	//   Hi there,
	//
	//   Your usage has grown significantly this month!
	//
	//   Current plan: {tier} (${tier_price}/month)
	//   Current overage: ${overageCost:.2f}
	//   Total cost this month: ${tier_price + overageCost:.2f}
	//
	//   Upgrading to {next_tier} would cost ${next_tier_price}/month
	//   and give you {next_tier_limit:,} requests with no overage.
	//
	//   You'd save: ${(tier_price + overageCost) - next_tier_price:.2f}
	//
	//   Upgrade now: {upgrade_url}
	//   View usage: {dashboard_url}
}

// triggerAutoUpgrade triggers automatic tier upgrade via Polar webhook
func (te *TierEnforcer) triggerAutoUpgrade(tenantID, currentTier, nextTier string, overageCost, nextTierPrice float64) error {
	te.logger.Printf("[TierEnforcer] Auto-Upgrade Triggered: tenant=%s %s→%s overage=$%.2f next_tier_price=$%.2f",
		tenantID, currentTier, nextTier, overageCost, nextTierPrice)

	// TODO: Implement Polar API integration
	// Steps:
	// 1. Get tenant's Polar subscription ID from database
	// 2. Call Polar API: POST https://api.polar.sh/v1/subscriptions/{subscription_id}/upgrade
	//    Body: { "product_id": "{next_tier_product_id}" }
	// 3. Update local database: UPDATE tenants SET tier = $1 WHERE id = $2
	// 4. Send confirmation email:
	//    Subject: "Your plan has been upgraded to {next_tier}"
	//    Body:
	//      Great news! We've automatically upgraded your plan to {next_tier}
	//      because it will save you money this month.
	//
	//      Old plan: {current_tier} (${current_price}/month + ${overage_cost} overage)
	//      New plan: {next_tier} (${next_tier_price}/month, no overage)
	//      Monthly savings: ${savings:.2f}
	//
	//      Your new limits: {next_tier_limits}
	//
	//      View your updated plan: {dashboard_url}

	return nil
}

// ============================================================================
// ADMIN FUNCTIONS
// ============================================================================

// GetTierUsage returns usage statistics for a tenant
func (te *TierEnforcer) GetTierUsage(tenantID string) (fiber.Map, error) {
	tier, err := te.getTenantTier(tenantID)
	if err != nil {
		return nil, err
	}

	policy, exists := te.getTierPolicy(tier)
	if !exists {
		return nil, fmt.Errorf("tier policy not found: %s", tier)
	}

	// Get request count from Redis
	ctx := context.Background()
	redisKey := te.getRequestCounterKey(tenantID)
	requestCount, _ := te.redis.Get(ctx, redisKey).Int64()

	// Get provider count
	providerCount, _ := te.getProviderCount(tenantID)

	// Calculate percentages
	requestPercent := 0.0
	if policy.Limits.MaxRequestsPerMonth > 0 {
		requestPercent = (float64(requestCount) / float64(policy.Limits.MaxRequestsPerMonth)) * 100
	}

	providerPercent := 0.0
	if policy.Limits.MaxProviders > 0 {
		providerPercent = (float64(providerCount) / float64(policy.Limits.MaxProviders)) * 100
	}

	return fiber.Map{
		"tier": tier,
		"limits": fiber.Map{
			"requests": fiber.Map{
				"used":    requestCount,
				"limit":   policy.Limits.MaxRequestsPerMonth,
				"percent": requestPercent,
			},
			"providers": fiber.Map{
				"used":    providerCount,
				"limit":   policy.Limits.MaxProviders,
				"percent": providerPercent,
			},
		},
		"resets_at": te.getResetTimestamp(tenantID),
	}, nil
}

// UpgradeTier upgrades a tenant to a new tier
func (te *TierEnforcer) UpgradeTier(tenantID, newTier string) error {
	// Validate new tier exists
	if _, exists := te.getTierPolicy(newTier); !exists {
		return fmt.Errorf("invalid tier: %s", newTier)
	}

	// Update database
	_, err := te.db.Exec(`
		UPDATE tenants
		SET tier = $1, tier_upgraded_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`, newTier, tenantID)

	if err != nil {
		return fmt.Errorf("failed to upgrade tier: %w", err)
	}

	te.logger.Printf("[TierEnforcer] Tier upgraded: tenant=%s new_tier=%s", tenantID, newTier)

	return nil
}

// DowngradeTier downgrades a tenant with grace period
func (te *TierEnforcer) DowngradeTier(tenantID, newTier string) error {
	// Validate new tier exists
	if _, exists := te.getTierPolicy(newTier); !exists {
		return fmt.Errorf("invalid tier: %s", newTier)
	}

	gracePeriodDays := te.config.Global.DowngradeGracePeriodDays

	// Update database with grace period
	_, err := te.db.Exec(`
		UPDATE tenants
		SET
			tier = $1,
			tier_downgraded_at = CURRENT_TIMESTAMP,
			tier_grace_period_ends_at = CURRENT_TIMESTAMP + INTERVAL '1 day' * $2
		WHERE id = $3
	`, newTier, gracePeriodDays, tenantID)

	if err != nil {
		return fmt.Errorf("failed to downgrade tier: %w", err)
	}

	te.logger.Printf("[TierEnforcer] Tier downgraded: tenant=%s new_tier=%s grace_period=%d days",
		tenantID, newTier, gracePeriodDays)

	return nil
}

// ============================================================================
// REDIS REQUEST COUNTER RESET (Monthly Cron Job)
// ============================================================================

// ResetMonthlyCounters resets all monthly request counters
// This should be called via cron on the first day of each month
func (te *TierEnforcer) ResetMonthlyCounters(ctx context.Context) (int, error) {
	// Get all tenant IDs
	rows, err := te.db.QueryContext(ctx, `
		SELECT id FROM tenants WHERE status = 'active'
	`)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	resetCount := 0
	for rows.Next() {
		var tenantID string
		if err := rows.Scan(&tenantID); err != nil {
			continue
		}

		// Delete Redis counter (it will auto-recreate on next request)
		redisKey := te.getRequestCounterKey(tenantID)
		te.redis.Del(ctx, redisKey)

		// Reset database flags
		te.db.ExecContext(ctx, `
			UPDATE tenants
			SET
				requests_this_month = 0,
				soft_limit_warning_sent = false,
				hard_limit_reached_at = NULL,
				overage_notification_sent = false,
				high_overage_notification_sent = false,
				auto_upgrade_triggered = false,
				requests_reset_at = DATE_TRUNC('month', CURRENT_TIMESTAMP) + INTERVAL '1 month'
			WHERE id = $1
		`, tenantID)

		resetCount++
	}

	te.logger.Printf("[TierEnforcer] Reset monthly counters for %d tenants", resetCount)

	return resetCount, nil
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// ParseTierFromString converts string to tier (validation)
func ParseTierFromString(tierStr string) (string, error) {
	validTiers := map[string]bool{
		"hacker":    true,
		"startup":   true,
		"growth":    true,
		"scale":     true,
		// Legacy tier names (for backward compatibility)
		"developer": true, // Maps to startup
	}

	if !validTiers[tierStr] {
		return "", fmt.Errorf("invalid tier: %s", tierStr)
	}

	// Map legacy tier name
	if tierStr == "developer" {
		return "startup", nil
	}

	return tierStr, nil
}

// GetTierDisplayName returns human-readable tier name
func GetTierDisplayName(tier string) string {
	displayNames := map[string]string{
		"hacker":    "Hacker",
		"startup":   "Startup",
		"growth":    "Growth",
		"scale":     "Scale",
		"developer": "Startup", // Legacy mapping
	}

	if name, exists := displayNames[tier]; exists {
		return name
	}

	return tier
}

// GetTierAuthorityLevel returns the authority level for a tier
func GetTierAuthorityLevel(tier string) string {
	authorityLevels := map[string]string{
		"hacker":  "observe",   // Read-only visibility
		"startup": "influence", // Configure but no autonomy
		"growth":  "enforce",   // System-enforced policies
		"scale":   "prove",     // Cryptographic guarantees
	}

	if level, exists := authorityLevels[tier]; exists {
		return level
	}

	return "observe" // Default to most restrictive
}

// GetTierPrice returns tier price in USD
func (te *TierEnforcer) GetTierPrice(tierName string) float64 {
	policy, exists := te.getTierPolicy(tierName)
	if !exists {
		return 0
	}

	return policy.Price.USD
}
