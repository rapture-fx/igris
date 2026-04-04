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

// GatingMiddleware enforces subscription status. Feature access is not gated —
// all tiers share identical capabilities; only runtime scale differs.
type GatingMiddleware struct {
	client          *PolarClient
	runtimeEnforcer *RuntimeEnforcer
	logger          *log.Logger
}

// NewGatingMiddleware creates a new gating middleware
func NewGatingMiddleware(client *PolarClient) *GatingMiddleware {
	return &GatingMiddleware{
		client: client,
		logger: log.Default(),
	}
}

// NewGatingMiddlewareWithEnforcer creates a gating middleware with runtime enforcement.
func NewGatingMiddlewareWithEnforcer(client *PolarClient, re *RuntimeEnforcer) *GatingMiddleware {
	return &GatingMiddleware{
		client:          client,
		runtimeEnforcer: re,
		logger:          log.Default(),
	}
}

// Enforce is the main gating middleware handler.
// It validates subscription status but does NOT gate features or request counts —
// all tiers have identical feature access. Runtime scale is enforced separately
// at registration time by RuntimeEnforcer.
func (gm *GatingMiddleware) Enforce() fiber.Handler {
	return func(c *fiber.Ctx) error {
		path := c.Path()
		if gm.shouldSkip(path) {
			return c.Next()
		}

		tenantID := c.Locals("tenant_id")
		if tenantID == nil {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Unauthorized - no tenant ID",
				"code":  "NO_TENANT",
			})
		}

		tenantIDStr := tenantID.(string)
		ctx := c.Context()

		sub, err := gm.client.GetSubscription(ctx, tenantIDStr)
		if err != nil {
			gm.logger.Printf("[Gating] No subscription found: tenant=%s error=%v", tenantIDStr, err)
			return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
				"error":       "No active subscription",
				"code":        "NO_SUBSCRIPTION",
				"upgrade_url": "https://polar.sh/igris-inertial/subscribe",
			})
		}

		if sub.Status != StatusActive {
			gm.logger.Printf("[Gating] Inactive subscription: tenant=%s status=%s", tenantIDStr, sub.Status)
			return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
				"error":       fmt.Sprintf("Subscription %s", sub.Status),
				"code":        "SUBSCRIPTION_INACTIVE",
				"status":      sub.Status,
				"upgrade_url": "https://polar.sh/igris-inertial/subscribe",
			})
		}

		// Resolve tier plan and inject into context for downstream handlers.
		// Billing state must be explicit; do not silently downgrade unknown plans.
		tierID, err := ResolveTierID(sub.Metadata, sub.PriceID)
		if err != nil {
			gm.logger.Printf("[Gating] Invalid tier resolution: tenant=%s error=%v", tenantIDStr, err)
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
				"error": "Billing tier unavailable",
				"code":  "BILLING_TIER_UNAVAILABLE",
			})
		}

		tier, err := GetTierByID(tierID)
		if err != nil {
			gm.logger.Printf("[Gating] Invalid tier: tenant=%s tier=%s", tenantIDStr, tierID)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "Invalid tier configuration",
				"code":  "INVALID_TIER",
			})
		}

		c.Locals("tier", tier)
		c.Locals("subscription", sub)

		return c.Next()
	}
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

// getUpgradeURL generates Polar checkout URL for a given tier
func (gm *GatingMiddleware) getUpgradeURL(tenantID, tierID string) string {
	tier, err := GetTierByID(tierID)
	if err != nil {
		return "https://polar.sh/igris-inertial/subscribe"
	}
	return fmt.Sprintf("https://polar.sh/igris-inertial/subscribe?price=%s&customer=%s",
		tier.MonthlyPriceID, tenantID)
}

// getNextTier recommends the next tier up from the current one
func getNextTier(current Tier) Tier {
	switch current {
	case TierSeed:
		return TierHorizon
	case TierHorizon:
		return TierInfinite
	default:
		return TierInfinite
	}
}

// ============================================================================
// ADMIN HELPERS
// ============================================================================

// GetTierUsage returns runtime usage statistics for a tenant.
func (gm *GatingMiddleware) GetTierUsage(ctx context.Context, tenantID string) (fiber.Map, error) {
	sub, err := gm.client.GetSubscription(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("no subscription found: %w", err)
	}

	tierID, err := ResolveTierID(sub.Metadata, sub.PriceID)
	if err != nil {
		return nil, fmt.Errorf("could not resolve tier: %w", err)
	}

	tier, err := GetTierByID(tierID)
	if err != nil {
		return nil, fmt.Errorf("invalid tier: %w", err)
	}

	// Get runtime usage from enforcer if available
	runtimeUsed := 0
	if gm.runtimeEnforcer != nil {
		runtimeUsed, _, _ = gm.runtimeEnforcer.GetRuntimeUsage(ctx, tenantID)
	}

	runtimePercent := 0.0
	if tier.RuntimeLimit > 0 {
		runtimePercent = (float64(runtimeUsed) / float64(tier.RuntimeLimit)) * 100
	}

	return fiber.Map{
		"tier":                string(tier.ID),
		"tier_name":           tier.Name,
		"monthly_price_cents": tier.MonthlyPriceCents,
		"subscription_status": sub.Status,
		"runtimes": fiber.Map{
			"used":    runtimeUsed,
			"limit":   tier.RuntimeLimit,
			"percent": runtimePercent,
		},
		"current_period_end": sub.CurrentPeriodEnd.Format(http.TimeFormat),
		"upgrade_tier":       string(getNextTier(tier.ID)),
	}, nil
}
