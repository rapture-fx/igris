// Package api provides fleet config-push and OTA update endpoints.
package api

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterFleetPushRoutes registers fleet config-push and OTA update endpoints.
func RegisterFleetPushRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Warn().Msg("[Routes] Fleet push endpoints disabled — database not available")
		return
	}

	auth := middleware.BetterAuth(db)
	app.Post("/api/v1/runtime/config/push", auth, handleConfigPush(db))
	app.Post("/api/v1/runtime/update", auth, handleOTAUpdate(db))

	log.Info().Msg("[Routes] Registered fleet push endpoints (/api/v1/runtime/config/push, /api/v1/runtime/update)")
}

// ── POST /api/v1/runtime/config/push ────────────────────────────────────────

type configPushRequest struct {
	Selector map[string]interface{} `json:"selector"`
	Config   json.RawMessage        `json:"config"`
}

func handleConfigPush(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		var req configPushRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
		}
		if len(req.Config) == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "config is required"})
		}

		cmd, _ := json.Marshal(map[string]interface{}{
			"command_id": uuid.NewString(),
			"type":       "config_push",
			"config":     req.Config,
			"selector":   req.Selector,
			"queued_at":  time.Now().UTC().Format(time.RFC3339),
		})

		// Queue command to all matching runtime instances via pending_commands JSONB array.
		result, err := db.ExecContext(c.Context(), `
			UPDATE runtime_instances
			SET pending_commands = COALESCE(pending_commands, '[]'::jsonb) || $1::jsonb
			WHERE tenant_id = $2
		`, string(cmd), tenantID)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Fleet] config/push failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}

		n, _ := result.RowsAffected()
		log.Info().Str("tenant_id", tenantID).Int64("instances_queued", n).Msg("[Fleet] Config push queued")
		return c.JSON(fiber.Map{
			"queued":    true,
			"instances": n,
			"queued_at": time.Now().UTC().Format(time.RFC3339),
		})
	}
}

// ── POST /api/v1/runtime/update ──────────────────────────────────────────────

type otaUpdateRequest struct {
	Selector       map[string]interface{} `json:"selector"`
	Version        string                 `json:"version"`
	Strategy       string                 `json:"strategy"`        // rolling | all-at-once | canary
	MaxUnavailable int                    `json:"max_unavailable"` // for rolling strategy
}

func handleOTAUpdate(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}

		var req otaUpdateRequest
		if err := c.BodyParser(&req); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
		}
		if req.Version == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "version is required"})
		}
		if req.Strategy == "" {
			req.Strategy = "rolling"
		}
		if req.MaxUnavailable == 0 {
			req.MaxUnavailable = 1
		}

		cmd, _ := json.Marshal(map[string]interface{}{
			"command_id":      uuid.NewString(),
			"type":            "ota_update",
			"version":         req.Version,
			"strategy":        req.Strategy,
			"max_unavailable": req.MaxUnavailable,
			"selector":        req.Selector,
			"queued_at":       time.Now().UTC().Format(time.RFC3339),
		})

		result, err := db.ExecContext(c.Context(), `
			UPDATE runtime_instances
			SET pending_commands = COALESCE(pending_commands, '[]'::jsonb) || $1::jsonb
			WHERE tenant_id = $2
		`, string(cmd), tenantID)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Fleet] OTA update failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}

		n, _ := result.RowsAffected()
		log.Info().Str("tenant_id", tenantID).Str("version", req.Version).Int64("instances_queued", n).
			Msg("[Fleet] OTA update queued")
		return c.JSON(fiber.Map{
			"queued":    true,
			"version":   req.Version,
			"strategy":  req.Strategy,
			"instances": n,
			"queued_at": time.Now().UTC().Format(time.RFC3339),
		})
	}
}
