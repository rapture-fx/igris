// Package api provides trial lifecycle API endpoints.
// POST /v1/trial/start  — start the 7-day free trial (Clerk auth, one-time per tenant)
// GET  /v1/trial/status — return current trial status (Clerk auth)
package api

import (
	"database/sql"
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/billing"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// TrialHandler handles trial lifecycle requests.
type TrialHandler struct {
	manager *billing.TrialManager
}

// NewTrialHandler creates a new trial handler.
func NewTrialHandler(manager *billing.TrialManager) *TrialHandler {
	return &TrialHandler{manager: manager}
}

// RegisterTrialRoutes registers trial endpoints under /v1/trial.
// Requires: database + TrialManager. All endpoints use Clerk JWT auth.
func RegisterTrialRoutes(app *fiber.App, db *sql.DB, manager *billing.TrialManager) {
	if db == nil || manager == nil {
		log.Warn().Msg("[Routes] Trial endpoints disabled — database or trial manager not available")
		return
	}

	h := NewTrialHandler(manager)

	v1 := app.Group("/v1/trial")
	v1.Use(middleware.BetterAuth(db))

	v1.Post("/start", h.StartTrial)
	v1.Get("/status", h.GetStatus)

	log.Info().Msg("[Routes] Registered trial endpoints (/v1/trial/start, /v1/trial/status)")
}

// startTrialRequest is the payload for POST /v1/trial/start.
type startTrialRequest struct {
	// Tier is the plan the user selected: seed, horizon, or infinite.
	Tier string `json:"tier"`
}

// StartTrial handles POST /v1/trial/start
//
// Body: { "tier": "seed" | "horizon" | "infinite" }
//
// Starts a 7-day free trial on the chosen tier. Each account is eligible for
// exactly one trial. Returns 409 if a trial has already been used.
func (h *TrialHandler) StartTrial(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized",
		})
	}

	var req startTrialRequest
	if err := c.BodyParser(&req); err != nil || req.Tier == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid_request",
			"message": "Provide { \"tier\": \"seed\" | \"horizon\" | \"infinite\" }",
		})
	}

	if !billing.ValidTier(req.Tier) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid_tier",
			"message": "tier must be seed, horizon, or infinite",
		})
	}

	ctx := c.Context()
	if err := h.manager.StartTrial(ctx, tenantID, req.Tier); err != nil {
		if errors.Is(err, billing.ErrTrialAlreadyUsed) {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error":   "trial_already_used",
				"message": "Each account is eligible for one 7-day trial. Subscribe to continue.",
				"upgrade_url": "https://igrisinertial.com/pricing",
			})
		}
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Trial] Failed to start trial")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed_to_start_trial",
		})
	}

	// Return the trial status immediately so the console can update its UI
	status, err := h.manager.GetTrialStatus(ctx, tenantID)
	if err != nil {
		// Trial was started; just return minimal confirmation
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"status":  "trial_started",
			"tier":    req.Tier,
			"message": "Your 7-day trial has started.",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"status":       "trial_started",
		"tier":         status.TrialTier,
		"days_left":    status.DaysLeft,
		"ends_at":      status.EndsAt,
		"message":      "Your 7-day trial has started. No credit card required.",
		"upgrade_url":  "https://igrisinertial.com/pricing",
	})
}

// GetStatus handles GET /v1/trial/status
//
// Returns the tenant's current trial state. Returns 404 if the tenant has
// never started a trial.
func (h *TrialHandler) GetStatus(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized",
		})
	}

	status, err := h.manager.GetTrialStatus(c.Context(), tenantID)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Trial] Failed to get trial status")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed_to_get_trial_status",
		})
	}

	return c.JSON(fiber.Map{
		"trial_active":  status.Active,
		"trial_tier":    status.TrialTier,
		"current_tier":  status.CurrentTier,
		"started_at":    status.StartedAt,
		"ends_at":       status.EndsAt,
		"days_left":     status.DaysLeft,
	})
}
