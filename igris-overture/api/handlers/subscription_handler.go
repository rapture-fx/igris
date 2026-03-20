// Package handlers provides HTTP handlers for subscription management
package handlers

import (
	"fmt"
	"log"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/Igris-inertial/system/igris-overture/billing"
)

// SubscriptionHandler handles subscription-related endpoints
type SubscriptionHandler struct {
	polarClient *billing.PolarClient
	gating      *billing.GatingMiddleware
	logger      *log.Logger
}

// NewSubscriptionHandler creates a new subscription handler
func NewSubscriptionHandler(polarClient *billing.PolarClient, gating *billing.GatingMiddleware) *SubscriptionHandler {
	return &SubscriptionHandler{
		polarClient: polarClient,
		gating:      gating,
		logger:      log.Default(),
	}
}

// ============================================================================
// SUBSCRIPTION STATUS
// ============================================================================

// GetSubscriptionStatus returns subscription and runtime usage info
// GET /api/subscription/status
func (h *SubscriptionHandler) GetSubscriptionStatus(c *fiber.Ctx) error {
	tenantID := c.Locals("tenant_id")
	if tenantID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
			"code":  "NO_TENANT",
		})
	}

	usage, err := h.gating.GetTierUsage(c.Context(), tenantID.(string))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to get subscription status",
			"code":  "STATUS_ERROR",
		})
	}

	return c.JSON(usage)
}

// ============================================================================
// AVAILABLE PLANS
// ============================================================================

// GetAvailablePlans returns all purchasable plans with pricing and runtime limits
// GET /api/subscription/plans
func (h *SubscriptionHandler) GetAvailablePlans(c *fiber.Ctx) error {
	plans := billing.AllPlans()

	result := make([]fiber.Map, 0, len(plans))
	for _, p := range plans {
		result = append(result, fiber.Map{
			"tier_id":             string(p.ID),
			"name":                p.Name,
			"monthly_price_usd":   p.MonthlyPriceCents / 100,
			"runtime_limit":       p.RuntimeLimit,
			"checkout_url":        checkoutURL(p.MonthlyPriceID),
		})
	}

	return c.JSON(fiber.Map{"plans": result})
}

// ============================================================================
// UPGRADE FLOW
// ============================================================================

// GetUpgradeOptions returns available upgrade tiers for the authenticated tenant
// GET /api/subscription/upgrade-options
func (h *SubscriptionHandler) GetUpgradeOptions(c *fiber.Ctx) error {
	tenantID := c.Locals("tenant_id")
	if tenantID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
			"code":  "NO_TENANT",
		})
	}

	sub, _ := h.polarClient.GetSubscription(c.Context(), tenantID.(string))
	currentTier := string(billing.TierSeed)
	if sub != nil && sub.Metadata["tier"] != "" {
		currentTier = sub.Metadata["tier"]
	}

	options := []fiber.Map{
		{
			"tier_id":           string(billing.TierSeed),
			"name":              "Seed",
			"monthly_price_usd": 29,
			"runtime_limit":     3,
			"features":          []string{"3 runtime instances", "Edge or server deployment", "Execution receipts", "Policy enforcement", "Basic routing"},
			"checkout_url":      checkoutURL(billing.PlanSeed.MonthlyPriceID),
			"recommended":       currentTier == "",
		},
		{
			"tier_id":           string(billing.TierHorizon),
			"name":              "Horizon",
			"monthly_price_usd": 149,
			"runtime_limit":     50,
			"features":          []string{"50 runtime instances", "Fleet dashboard", "Speculative execution", "Council routing", "Shadow mode"},
			"checkout_url":      checkoutURL(billing.PlanHorizon.MonthlyPriceID),
			"recommended":       currentTier == string(billing.TierSeed),
			"popular":           true,
		},
		{
			"tier_id":           string(billing.TierInfinite),
			"name":              "Infinite",
			"monthly_price_usd": 699,
			"runtime_limit":     500,
			"features":          []string{"500 runtime instances", "Enterprise fleet management", "Advanced policy engine", "OTA runtime updates", "Priority support"},
			"checkout_url":      checkoutURL(billing.PlanInfinite.MonthlyPriceID),
			"recommended":       currentTier == string(billing.TierHorizon),
		},
	}

	return c.JSON(fiber.Map{
		"current_tier": currentTier,
		"options":      options,
	})
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// generateTenantID generates tenant ID from email (simplified)
func generateTenantID(email string) string {
	return "tenant_" + email[:strings.Index(email, "@")]
}

// generateAPIKey generates API key for tenant (simplified)
func generateAPIKey(tenantID string) string {
	return "sk_test_" + tenantID + "_" + randomString(32)
}

// checkoutURL builds a Polar checkout URL for a price ID
func checkoutURL(priceID string) string {
	return fmt.Sprintf("https://polar.sh/igris-inertial/checkout?price=%s", priceID)
}

// randomString generates random string (placeholder)
func randomString(n int) string {
	return "random_" + strconv.Itoa(n)
}
