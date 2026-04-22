package api

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

func RegisterAICredentialRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Warn().Msg("[Routes] AI credential endpoints disabled — database not available")
		return
	}
	auth := middleware.BetterAuth(db)
	app.Get("/v1/ai/credentials", auth, listAICredentialReferences(db))
	app.Post("/v1/ai/credentials/:reference_id/revoke", auth, revokeAICredentialReference(db))
	log.Info().Msg("[Routes] Registered AI credential endpoints (/v1/ai/credentials)")
}

func listAICredentialReferences(db *sql.DB) fiber.Handler {
	store := coordinator.NewCheckpointStore(db)
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		filter, err := aiCredentialReferenceFilterFromQuery(c)
		if err != nil {
			return err
		}
		refs, err := store.GetAICredentialReferences(tenantID, filter)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[AICredentials] list query failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		return c.JSON(fiber.Map{"credentials": refs, "total": len(refs)})
	}
}

func revokeAICredentialReference(db *sql.DB) fiber.Handler {
	store := coordinator.NewCheckpointStore(db)
	return func(c *fiber.Ctx) error {
		actor, authErr := roboticsPolicyActorForWrite(c, db, "credential_revoke")
		if authErr != nil {
			return roboticsPolicyAuthError(c, authErr)
		}
		referenceID := c.Params("reference_id")
		if referenceID == "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "reference_id_required"})
		}
		ref, err := store.RevokeAICredentialReference(c.Context(), actor.ID, referenceID)
		if err == sql.ErrNoRows {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "credential_reference_not_found"})
		}
		if err != nil {
			if errors.Is(err, coordinator.ErrCredentialReferenceRevoked) {
				return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "credential_reference_revoked"})
			}
			log.Error().Err(err).Str("tenant_id", actor.ID).Str("reference_id", referenceID).Msg("[AICredentials] revoke failed")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		return c.JSON(ref)
	}
}

func aiCredentialReferenceFilterFromQuery(c *fiber.Ctx) (coordinator.AICredentialReferenceFilter, error) {
	limit := c.QueryInt("limit", 100)
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	filter := coordinator.AICredentialReferenceFilter{
		Capability:     c.Query("capability"),
		Tool:           c.Query("tool"),
		IncludeRevoked: c.QueryBool("include_revoked", false),
		Limit:          limit,
	}
	if rawTaskID := c.Query("task_id"); rawTaskID != "" {
		taskID, err := uuid.Parse(rawTaskID)
		if err != nil {
			return filter, c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid task_id"})
		}
		filter.TaskID = &taskID
	}
	return filter, nil
}
