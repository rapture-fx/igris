// Package api provides API key management endpoints for the Igris console.
//
// Endpoints (all require Clerk JWT auth):
//   GET    /v1/account/api-key  — return current key metadata (masked, never raw)
//   POST   /v1/account/api-key  — generate a new key, revokes the old one
//   DELETE /v1/account/api-key  — revoke the current key
package api

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/security"
)

// APIKeyHandler handles runtime API key management requests.
type APIKeyHandler struct {
	db *sql.DB
}

// NewAPIKeyHandler creates a new APIKeyHandler.
func NewAPIKeyHandler(db *sql.DB) *APIKeyHandler {
	return &APIKeyHandler{db: db}
}

// RegisterAPIKeyRoutes registers the three API key endpoints under /v1/account.
// All endpoints require a valid Clerk JWT (ClerkAuth middleware).
func RegisterAPIKeyRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Warn().Msg("[Routes] API key endpoints disabled — database not available")
		return
	}

	h := NewAPIKeyHandler(db)

	account := app.Group("/v1/account")
	account.Use(middleware.BetterAuth(db))

	account.Get("/api-key", h.GetAPIKey)
	account.Post("/api-key", h.GenerateAPIKey)
	account.Delete("/api-key", h.RevokeAPIKey)

	log.Info().Msg("[Routes] Registered API key endpoints (GET/POST/DELETE /v1/account/api-key)")
}

// apiKeyInfoRow holds the columns read from the tenants table.
type apiKeyInfoRow struct {
	Hash      sql.NullString
	Prefix    sql.NullString
	CreatedAt sql.NullTime
}

// GetAPIKey handles GET /v1/account/api-key
//
// Returns current key metadata. The raw key is never returned here.
// Response: { has_key: bool, prefix: "igris_a1b2", created_at: "..." }
func (h *APIKeyHandler) GetAPIKey(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized",
		})
	}

	var row apiKeyInfoRow
	err := h.db.QueryRowContext(c.Context(),
		`SELECT api_key_hash, api_key_prefix, api_key_created_at
		   FROM tenants
		  WHERE tenant_id = $1`,
		tenantID,
	).Scan(&row.Hash, &row.Prefix, &row.CreatedAt)

	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "tenant_not_found",
		})
	}
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[APIKey] Failed to query tenant")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "internal_error",
		})
	}

	hasKey := row.Hash.Valid && row.Hash.String != ""

	resp := fiber.Map{
		"has_key": hasKey,
	}
	if hasKey {
		if row.Prefix.Valid {
			resp["prefix"] = row.Prefix.String
		}
		if row.CreatedAt.Valid {
			resp["created_at"] = row.CreatedAt.Time.UTC().Format(time.RFC3339)
		}
	}

	return c.JSON(resp)
}

// GenerateAPIKey handles POST /v1/account/api-key
//
// Generates a new igris_ key, stores its SHA-256 hash and 12-char prefix in
// the tenants table (revoking any previous key), and returns the raw key once.
//
// Response: { api_key: "igris_xxx...", prefix: "igris_a1b2c3" }
func (h *APIKeyHandler) GenerateAPIKey(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized",
		})
	}

	// Generate 32 cryptographically random bytes → 64 hex chars.
	rawBytes := make([]byte, 32)
	if _, err := rand.Read(rawBytes); err != nil {
		log.Error().Err(err).Msg("[APIKey] Failed to generate random bytes")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "key_generation_failed",
		})
	}

	rawKey := "igris_" + hex.EncodeToString(rawBytes) // "igris_" + 64 hex chars = 70 chars total
	prefix := rawKey[:12]                              // "igris_" + first 6 hex chars
	keyHash := security.HashAPIKey(rawKey)
	now := time.Now().UTC()

	_, err := h.db.ExecContext(c.Context(),
		`UPDATE tenants
		    SET api_key_hash       = $1,
		        api_key_prefix     = $2,
		        api_key_created_at = $3,
		        updated_at         = $3
		  WHERE tenant_id = $4`,
		keyHash, prefix, now, tenantID,
	)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[APIKey] Failed to store new API key")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "key_storage_failed",
		})
	}

	log.Info().Str("tenant_id", tenantID).Str("prefix", prefix).Msg("[APIKey] New API key generated")

	// Return the raw key exactly once — never stored in plaintext.
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"api_key":    rawKey,
		"prefix":     prefix,
		"created_at": now.Format(time.RFC3339),
	})
}

// RevokeAPIKey handles DELETE /v1/account/api-key
//
// Clears api_key_hash and api_key_prefix from the tenant row, immediately
// invalidating any runtime instances that use the old key.
//
// Response: { revoked: true }
func (h *APIKeyHandler) RevokeAPIKey(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized",
		})
	}

	_, err := h.db.ExecContext(c.Context(),
		`UPDATE tenants
		    SET api_key_hash       = NULL,
		        api_key_prefix     = NULL,
		        api_key_created_at = NULL,
		        updated_at         = NOW()
		  WHERE tenant_id = $1`,
		tenantID,
	)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[APIKey] Failed to revoke API key")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "revocation_failed",
		})
	}

	log.Info().Str("tenant_id", tenantID).Msg("[APIKey] API key revoked")

	return c.JSON(fiber.Map{
		"revoked": true,
	})
}
