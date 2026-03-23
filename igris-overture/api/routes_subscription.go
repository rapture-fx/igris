// Package api provides subscription status and plan endpoints consumed by the
// web-console billing page.
package api

import (
	"database/sql"
	"math"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterSubscriptionRoutes wires up /api/subscription/status and /api/subscription/plans.
func RegisterSubscriptionRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Warn().Msg("[Routes] Subscription endpoints disabled — database not available")
		return
	}

	h := &subscriptionHandler{db: db}

	grp := app.Group("/api/subscription")
	grp.Use(middleware.BetterAuth(db))
	grp.Get("/status", h.getStatus)
	grp.Get("/plans", h.getPlans)

	log.Info().Msg("[Routes] Registered subscription endpoints (/api/subscription/status|plans)")
}

type subscriptionHandler struct{ db *sql.DB }

// tierMeta holds static info about each tier.
type tierMeta struct {
	Name              string
	MonthlyPriceCents int
	RuntimeLimit      int
	UpgradeTier       string
	// CheckoutEnvVar is checked first (direct checkout URL).
	// PriceIDEnvVar is used as fallback to construct a Polar checkout URL.
	CheckoutEnvVar string
	PriceIDEnvVar  string
}

var tierMetaMap = map[string]tierMeta{
	"seed":     {Name: "Seed",     MonthlyPriceCents: 2900,  RuntimeLimit: 3,   UpgradeTier: "horizon",  CheckoutEnvVar: "POLAR_CHECKOUT_SEED",     PriceIDEnvVar: "POLAR_PRICE_SEED"},
	"horizon":  {Name: "Horizon",  MonthlyPriceCents: 14900, RuntimeLimit: 50,  UpgradeTier: "infinite", CheckoutEnvVar: "POLAR_CHECKOUT_HORIZON",  PriceIDEnvVar: "POLAR_PRICE_HORIZON"},
	"infinite": {Name: "Infinite", MonthlyPriceCents: 69900, RuntimeLimit: 500, UpgradeTier: "",         CheckoutEnvVar: "POLAR_CHECKOUT_INFINITE", PriceIDEnvVar: "POLAR_PRICE_INFINITE"},
}

// GET /api/subscription/status
func (h *subscriptionHandler) getStatus(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var tier, subStatus sql.NullString
	var runtimeLimit sql.NullInt64

	_ = h.db.QueryRowContext(c.Context(), `
		SELECT COALESCE(tier::text,'seed'), COALESCE(subscription_status,'none'), COALESCE(runtime_limit,3)
		FROM tenants WHERE tenant_id = $1
	`, tenantID).Scan(&tier, &subStatus, &runtimeLimit)

	tierStr := "seed"
	if tier.Valid && tier.String != "" {
		tierStr = tier.String
	}
	statusStr := "none"
	if subStatus.Valid {
		statusStr = subStatus.String
	}
	limit := 3
	if runtimeLimit.Valid && runtimeLimit.Int64 > 0 {
		limit = int(runtimeLimit.Int64)
	}

	// Count active runtime instances for this tenant
	var used int
	_ = h.db.QueryRowContext(c.Context(), `
		SELECT COUNT(*) FROM runtime_instances
		WHERE tenant_id = $1 AND COALESCE(is_healthy, false) = true
	`, tenantID).Scan(&used)

	pct := 0.0
	if limit > 0 {
		pct = math.Round(float64(used) / float64(limit) * 100)
	}

	meta, ok := tierMetaMap[tierStr]
	if !ok {
		meta = tierMetaMap["seed"]
	}

	return c.JSON(fiber.Map{
		"tier":                tierStr,
		"tier_name":           meta.Name,
		"monthly_price_cents": meta.MonthlyPriceCents,
		"subscription_status": statusStr,
		"runtimes": fiber.Map{
			"used":    used,
			"limit":   limit,
			"percent": pct,
		},
		"upgrade_tier":       meta.UpgradeTier,
		"current_period_end": "",
	})
}

// GET /api/subscription/plans
func (h *subscriptionHandler) getPlans(c *fiber.Ctx) error {
	tierOrder := []string{"seed", "horizon", "infinite"}
	plans := make([]fiber.Map, 0, len(tierOrder))

	for _, id := range tierOrder {
		meta := tierMetaMap[id]
		checkoutURL := os.Getenv(meta.CheckoutEnvVar)
		if checkoutURL == "" {
			// Fall back to constructing a Polar checkout URL from the price ID.
			if priceID := os.Getenv(meta.PriceIDEnvVar); priceID != "" {
				checkoutURL = "https://polar.sh/checkout?productPriceId=" + priceID
			} else {
				checkoutURL = "https://polar.sh/igris-inertial"
			}
		}
		plans = append(plans, fiber.Map{
			"tier_id":           id,
			"name":              meta.Name,
			"monthly_price_usd": meta.MonthlyPriceCents / 100,
			"runtime_limit":     meta.RuntimeLimit,
			"checkout_url":      checkoutURL,
		})
	}

	return c.JSON(fiber.Map{"plans": plans})
}
