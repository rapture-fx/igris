// Package billing provides gating middleware for subscription enforcement
package billing

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// ============================================================================
// GATING MIDDLEWARE
// ============================================================================

// GatingMiddleware enforces subscription and tier limits
type GatingMiddleware struct {
	client *PolarClient
	logger *log.Logger
}

// NewGatingMiddleware creates a new gating middleware
func NewGatingMiddleware(client *PolarClient) *GatingMiddleware {
	return &GatingMiddleware{
		client: client,
		logger: log.Default(),
	}
}

// Enforce is the main gating middleware handler
func (gm *GatingMiddleware) Enforce() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Skip gating for health checks and webhooks
		path := c.Path()
		if gm.shouldSkip(path) {
			return c.Next()
		}

		// Get tenant ID from context (set by auth middleware)
		tenantID := c.Locals("tenant_id")
		if tenantID == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Unauthorized - no tenant ID",
				"code":  "NO_TENANT",
			})
		}

		tenantIDStr := tenantID.(string)
		ctx := c.Context()

		// Get subscription
		sub, err := gm.client.GetSubscription(ctx, tenantIDStr)
		if err != nil {
			gm.logger.Printf("[Gating] No subscription found: tenant=%s error=%v", tenantIDStr, err)
			return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
				"error":       "No active subscription",
				"code":        "NO_SUBSCRIPTION",
				"upgrade_url": gm.getUpgradeURL(tenantIDStr, "develop"),
			})
		}

		// Check subscription status
		if sub.Status != StatusActive && sub.Status != StatusTrialing {
			gm.logger.Printf("[Gating] Inactive subscription: tenant=%s status=%s", tenantIDStr, sub.Status)
			return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
				"error":       fmt.Sprintf("Subscription %s", sub.Status),
				"code":        "SUBSCRIPTION_INACTIVE",
				"status":      sub.Status,
				"upgrade_url": gm.getUpgradeURL(tenantIDStr, "develop"),
			})
		}

		// Get tier plan
		tierID := sub.Metadata["tier"]
		if tierID == "" {
			tierID = "develop" // fallback
		}

		tier, err := GetTierByID(tierID)
		if err != nil {
			gm.logger.Printf("[Gating] Invalid tier: tenant=%s tier=%s", tenantIDStr, tierID)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Invalid tier configuration",
				"code":  "INVALID_TIER",
			})
		}

		// Store tier in context for downstream use
		c.Locals("tier", tier)
		c.Locals("subscription", sub)

		// Enforce request limits (only for inference endpoints)
		if gm.isInferenceEndpoint(path) {
			if err := gm.enforceRequestLimits(ctx, tenantIDStr, tier); err != nil {
				return err
			}

			// Enforce feature access
			if err := gm.enforceFeatureAccess(c, path, tier); err != nil {
				return err
			}
		}

		return c.Next()
	}
}

// ============================================================================
// LIMIT ENFORCEMENT
// ============================================================================

// enforceRequestLimits checks and enforces monthly request limits
func (gm *GatingMiddleware) enforceRequestLimits(ctx context.Context, tenantID string, tier *TierPlan) error {
	// Skip if unlimited
	if tier.MaxRequestsPerMonth == -1 {
		return nil
	}

	// Increment and check counter
	count, err := gm.client.IncrementRequestCount(ctx, tenantID)
	if err != nil {
		gm.logger.Printf("[Gating] Failed to increment request count: tenant=%s error=%v", tenantID, err)
		// SECURITY: Fail closed — deny request when billing counter is unavailable
		return fiber.NewError(fiber.StatusServiceUnavailable, "Billing service temporarily unavailable. Please try again.")
	}

	// Check if over limit
	if count > int64(tier.MaxRequestsPerMonth) {
		gm.logger.Printf("[Gating] Request limit exceeded: tenant=%s count=%d limit=%d tier=%s",
			tenantID, count, tier.MaxRequestsPerMonth, tier.ID)

		// Determine upgrade tier
		upgradeTier := gm.getRecommendedUpgrade(tier.ID)

		return fiber.NewError(fiber.StatusTooManyRequests, fmt.Sprintf(
			"Monthly request limit exceeded (%d/%d). Upgrade to %s for more capacity.",
			count, tier.MaxRequestsPerMonth, upgradeTier,
		))
	}

	// Check soft limit (80%)
	limitPercent := (float64(count) / float64(tier.MaxRequestsPerMonth)) * 100
	if limitPercent >= 80.0 {
		gm.logger.Printf("[Gating] Soft limit warning: tenant=%s usage=%.1f%% tier=%s",
			tenantID, limitPercent, tier.ID)
		// TODO: Send in-app nudge or email
	}

	return nil
}

// enforceFeatureAccess checks if tenant has access to requested features
func (gm *GatingMiddleware) enforceFeatureAccess(c *fiber.Ctx, path string, tier *TierPlan) error {
	// Map paths to required features
	featureChecks := map[string]func(*TierFeatures) bool{
		"/v1/infer/speculative":     func(f *TierFeatures) bool { return f.SpeculativeExecution },
		"/v1/infer/council":         func(f *TierFeatures) bool { return f.CouncilMode },
		"/v1/infer/cognitive":       func(f *TierFeatures) bool { return f.CognitiveAdvisor },
		"/v1/slo":                   func(f *TierFeatures) bool { return f.SLOEnforcer != "none" },
		"/v1/audit":                 func(f *TierFeatures) bool { return f.AuditLogs },
		"/v1/policies":              func(f *TierFeatures) bool { return f.PolicyEngine },
		"/v1/self-host":             func(f *TierFeatures) bool { return f.SelfHost },
	}

	for pathPrefix, checkFunc := range featureChecks {
		if strings.HasPrefix(path, pathPrefix) {
			if !checkFunc(&tier.Features) {
				featureName := gm.getFeatureName(pathPrefix)
				upgradeTier := gm.getRecommendedUpgradeForFeature(featureName)

				gm.logger.Printf("[Gating] Feature access denied: tenant=%s tier=%s feature=%s",
					c.Locals("tenant_id"), tier.ID, featureName)

				return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
					"error":       fmt.Sprintf("Feature '%s' not available in %s tier", featureName, tier.Name),
					"code":        "FEATURE_LOCKED",
					"tier":        tier.ID,
					"feature":     featureName,
					"upgrade_tier": upgradeTier,
					"upgrade_url": gm.getUpgradeURL(c.Locals("tenant_id").(string), upgradeTier),
				})
			}
		}
	}

	// Check for speculative parameter in request body (for /v1/infer)
	if path == "/v1/infer" || path == "/v1/chat/completions" {
		var body map[string]interface{}
		if err := c.BodyParser(&body); err == nil {
			if specMode, ok := body["speculative_mode"].(string); ok && specMode != "" {
				if !tier.Features.SpeculativeExecution {
					return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
						"error":       "Speculative execution not available in " + tier.Name + " tier",
						"code":        "FEATURE_LOCKED",
						"feature":     "speculative_execution",
						"upgrade_tier": "growth",
						"upgrade_url": gm.getUpgradeURL(c.Locals("tenant_id").(string), "growth"),
					})
				}
			}
		}
	}

	return nil
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// shouldSkip checks if path should skip gating
func (gm *GatingMiddleware) shouldSkip(path string) bool {
	skipPaths := []string{
		"/v1/health",
		"/metrics",
		"/polar/webhook",
		"/api/subscribe",
		"/docs",
		"/static",
	}

	for _, skipPath := range skipPaths {
		if strings.HasPrefix(path, skipPath) {
			return true
		}
	}

	return false
}

// isInferenceEndpoint checks if path is an inference endpoint
func (gm *GatingMiddleware) isInferenceEndpoint(path string) bool {
	inferPaths := []string{
		"/v1/infer",
		"/v1/chat/completions",
		"/v1/completions",
	}

	for _, inferPath := range inferPaths {
		if path == inferPath || strings.HasPrefix(path, inferPath+"/") {
			return true
		}
	}

	return false
}

// getUpgradeURL generates Polar checkout URL
func (gm *GatingMiddleware) getUpgradeURL(tenantID, tierID string) string {
	tier, err := GetTierByID(tierID)
	if err != nil {
		return "https://polar.sh/igris-inertial/subscribe"
	}

	// TODO: Replace with actual Polar checkout URL
	return fmt.Sprintf("https://polar.sh/igris-inertial/subscribe?price=%s&customer=%s",
		tier.MonthlyPriceID, tenantID)
}

// getRecommendedUpgrade recommends next tier for upgrade
// NOTE: NO ENTERPRISE TIER - SCALE IS THE HIGHEST
func (gm *GatingMiddleware) getRecommendedUpgrade(currentTier string) string {
	upgradeMap := map[string]string{
		"trial":   "develop",
		"develop": "growth",
		"growth":  "scale",
		"scale":   "scale", // Scale is max tier
	}

	if next, ok := upgradeMap[currentTier]; ok {
		return next
	}

	return "growth"
}

// getRecommendedUpgradeForFeature recommends tier for specific feature
func (gm *GatingMiddleware) getRecommendedUpgradeForFeature(feature string) string {
	featureTierMap := map[string]string{
		"speculative_execution": "growth",
		"council_mode":          "growth",
		"cognitive_advisor":     "growth",
		"slo_enforcer":          "growth",
		"audit_logs":            "growth",
		"policy_engine":         "growth",
		"self_host":             "scale",
	}

	if tier, ok := featureTierMap[feature]; ok {
		return tier
	}

	return "growth"
}

// getFeatureName converts path prefix to feature name
func (gm *GatingMiddleware) getFeatureName(pathPrefix string) string {
	nameMap := map[string]string{
		"/v1/infer/speculative": "speculative_execution",
		"/v1/infer/council":     "council_mode",
		"/v1/infer/cognitive":   "cognitive_advisor",
		"/v1/slo":               "slo_enforcer",
		"/v1/audit":             "audit_logs",
		"/v1/policies":          "policy_engine",
		"/v1/self-host":         "self_host",
	}

	if name, ok := nameMap[pathPrefix]; ok {
		return name
	}

	return strings.TrimPrefix(pathPrefix, "/v1/")
}

// ============================================================================
// ADMIN HELPERS
// ============================================================================

// GetTierUsage returns usage statistics for tenant
func (gm *GatingMiddleware) GetTierUsage(ctx context.Context, tenantID string) (fiber.Map, error) {
	sub, err := gm.client.GetSubscription(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("no subscription found: %w", err)
	}

	tierID := sub.Metadata["tier"]
	tier, err := GetTierByID(tierID)
	if err != nil {
		return nil, fmt.Errorf("invalid tier: %w", err)
	}

	// Get request count
	count, _ := gm.client.GetRequestCount(ctx, tenantID)

	// Calculate percentage
	percent := 0.0
	if tier.MaxRequestsPerMonth > 0 {
		percent = (float64(count) / float64(tier.MaxRequestsPerMonth)) * 100
	}

	return fiber.Map{
		"tier": tier.ID,
		"tier_name": tier.Name,
		"subscription_status": sub.Status,
		"requests": fiber.Map{
			"used":    count,
			"limit":   tier.MaxRequestsPerMonth,
			"percent": percent,
		},
		"current_period_end": sub.CurrentPeriodEnd.Format(http.TimeFormat),
		"features":           tier.Features,
	}, nil
}
