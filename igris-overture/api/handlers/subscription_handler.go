// Package handlers provides HTTP handlers for subscription management
package handlers

import (
	"fmt"
	"log"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/Schlep-engine/igris-inertial/igris-overture/billing"
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
// TRIAL SIGNUP
// ============================================================================

// CreateTrialRequest represents trial signup request
type CreateTrialRequest struct {
	Email     string `json:"email" validate:"required,email"`
	CompanyName string `json:"company_name"`
	UseCase   string `json:"use_case"`
}

// CreateTrial creates a 14-day free trial subscription
// POST /api/subscribe/trial
func (h *SubscriptionHandler) CreateTrial(c *fiber.Ctx) error {
	var req CreateTrialRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
			"code":  "INVALID_REQUEST",
		})
	}

	// Validate email
	if req.Email == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Email required",
			"code":  "EMAIL_REQUIRED",
		})
	}

	// Generate tenant ID (in production, use proper UUID)
	tenantID := generateTenantID(req.Email)

	// Check if trial already exists
	existing, _ := h.polarClient.GetSubscription(c.Context(), tenantID)
	if existing != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Trial already exists for this email",
			"code":  "TRIAL_EXISTS",
			"subscription": fiber.Map{
				"id":         existing.ID,
				"status":     existing.Status,
				"trial_end":  existing.TrialEnd,
			},
		})
	}

	// Create trial subscription
	sub, err := h.polarClient.CreateTrialSubscription(c.Context(), tenantID, req.Email)
	if err != nil {
		h.logger.Printf("[Subscription] Failed to create trial: email=%s error=%v", req.Email, err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to create trial",
			"code":  "TRIAL_CREATION_FAILED",
		})
	}

	h.logger.Printf("[Subscription] Trial created: tenant=%s email=%s trial_end=%s",
		tenantID, req.Email, sub.TrialEnd.Format("2006-01-02"))

	// Return success with API key (in production, generate secure API key)
	apiKey := generateAPIKey(tenantID)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"subscription": fiber.Map{
			"id":               sub.ID,
			"status":           sub.Status,
			"tier":             "trial",
			"trial_end":        sub.TrialEnd,
			"request_limit":    50000,
			"features_unlocked": "all",
		},
		"tenant_id": tenantID,
		"api_key":   apiKey,
		"message":   "Trial created! You have 14 days and 50,000 requests to explore all features.",
		"next_steps": []string{
			"Save your API key securely",
			"Visit https://docs.igris-inertial.dev to get started",
			"Upgrade anytime at https://polar.sh/igris-inertial/subscribe",
		},
	})
}

// ============================================================================
// SUBSCRIPTION STATUS
// ============================================================================

// GetSubscriptionStatus returns subscription and usage info
// GET /api/subscription/status
func (h *SubscriptionHandler) GetSubscriptionStatus(c *fiber.Ctx) error {
	tenantID := c.Locals("tenant_id")
	if tenantID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
			"code":  "NO_TENANT",
		})
	}

	// Get usage stats
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
// UPGRADE FLOW
// ============================================================================

// GetUpgradeOptions returns available upgrade tiers
// GET /api/subscription/upgrade-options
func (h *SubscriptionHandler) GetUpgradeOptions(c *fiber.Ctx) error {
	tenantID := c.Locals("tenant_id")
	if tenantID == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Unauthorized",
			"code":  "NO_TENANT",
		})
	}

	// Get current tier
	sub, _ := h.polarClient.GetSubscription(c.Context(), tenantID.(string))
	currentTier := "trial"
	if sub != nil && sub.Metadata["tier"] != "" {
		currentTier = sub.Metadata["tier"]
	}

	// Return upgrade options
	options := []fiber.Map{
		{
			"tier_id":          "develop",
			"name":             "Develop",
			"monthly_price":    99,
			"annual_price":     950,
			"annual_discount":  20,
			"requests":         "500k/month",
			"features":         []string{"Basic routing", "Circuit breaker", "BYOK", "Cost tracking"},
			"checkout_url":     h.getCheckoutURL(tenantID.(string), "develop", "monthly"),
			"recommended":      currentTier == "trial",
		},
		{
			"tier_id":          "growth",
			"name":             "Growth",
			"monthly_price":    499,
			"annual_price":     4790,
			"annual_discount":  20,
			"requests":         "2M/month",
			"features":         []string{"All Develop features", "Speculative execution (-60% TTFT)", "Council mode", "Cognitive advisor", "SLO enforcer"},
			"checkout_url":     h.getCheckoutURL(tenantID.(string), "growth", "monthly"),
			"recommended":      currentTier == "develop",
			"popular":          true,
		},
		{
			"tier_id":          "scale",
			"name":             "Scale",
			"monthly_price":    1499,
			"annual_price":     14390,
			"annual_discount":  20,
			"requests":         "Unlimited",
			"features":         []string{"All Growth features", "Self-host", "Advanced SLO", "Unlimited tenants", "Solutions engineer"},
			"checkout_url":     h.getCheckoutURL(tenantID.(string), "scale", "monthly"),
			"recommended":      currentTier == "growth",
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
	// In production, use proper UUID generation
	return "tenant_" + email[:strings.Index(email, "@")]
}

// generateAPIKey generates API key for tenant (simplified)
func generateAPIKey(tenantID string) string {
	// In production, use cryptographically secure key generation
	return "sk_test_" + tenantID + "_" + randomString(32)
}

// getCheckoutURL generates Polar checkout URL
func (h *SubscriptionHandler) getCheckoutURL(tenantID, tierID, interval string) string {
	tier, _ := billing.GetTierByID(tierID)
	priceID := tier.MonthlyPriceID
	if interval == "annual" {
		priceID = tier.AnnualPriceID
	}

	// TODO: Replace with actual Polar checkout URL
	return fmt.Sprintf("https://polar.sh/igris-inertial/checkout?price=%s&customer=%s", priceID, tenantID)
}

// randomString generates random string (placeholder)
func randomString(n int) string {
	// In production, use crypto/rand
	return "random_" + strconv.Itoa(n)
}
