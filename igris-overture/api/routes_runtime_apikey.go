// Package api — runtime API key issuance.
//
// These endpoints let an authenticated tenant mint a dedicated *runtime* key
// (the IGRIS_API_KEY a runtime uses to register and connect) without touching
// the tenant's primary key in tenants.api_key_hash — which doubles as the
// Rails console's OVERTURE_API_KEY service key. Rotating that primary key would
// revoke the console's own credential, so runtime keys live separately in the
// tenant_api_keys table (migration 014) and are accepted by the runtime auth
// path (RuntimeHandler.apiKeyAuth) via an additive, tenant-scoped fallback.
//
// Endpoints (auth: BetterAuth — accepts the console service key Bearer → tenant):
//   GET    /v1/runtime/api-key  — metadata for the current runtime key (never raw)
//   POST   /v1/runtime/api-key  — mint a new runtime key, returns the raw key once
//   DELETE /v1/runtime/api-key  — revoke all active runtime keys for the tenant
//
// The raw key is returned exactly once at creation; only its SHA-256 hash and a
// display prefix are persisted.
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

// runtimeAPIKeyName is the tenant_api_keys.name used to tag runtime-connect
// keys, so GET/DELETE can scope to them without disturbing other named keys.
const runtimeAPIKeyName = "Runtime key"

// RuntimeAPIKeyHandler issues and manages tenant runtime keys.
type RuntimeAPIKeyHandler struct {
	db *sql.DB
}

// NewRuntimeAPIKeyHandler creates a new RuntimeAPIKeyHandler.
func NewRuntimeAPIKeyHandler(db *sql.DB) *RuntimeAPIKeyHandler {
	return &RuntimeAPIKeyHandler{db: db}
}

// RegisterRuntimeAPIKeyRoutes registers GET/POST/DELETE /v1/runtime/api-key.
// All endpoints require a valid tenant credential (BetterAuth, which accepts
// the console service key as a Bearer token and resolves it to a tenant).
func RegisterRuntimeAPIKeyRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Warn().Msg("[Routes] Runtime API key endpoints disabled — database not available")
		return
	}

	h := NewRuntimeAPIKeyHandler(db)

	grp := app.Group("/v1/runtime/api-key")
	grp.Use(middleware.BetterAuth(db))

	grp.Get("/", h.GetRuntimeAPIKey)
	grp.Post("/", h.GenerateRuntimeAPIKey)
	grp.Delete("/", h.RevokeRuntimeAPIKeys)

	log.Info().Msg("[Routes] Registered runtime API key endpoints (GET/POST/DELETE /v1/runtime/api-key)")
}

// GetRuntimeAPIKey handles GET /v1/runtime/api-key.
//
// Returns metadata for the most recent active runtime key. The raw key is never
// returned. Response: { has_key: bool, prefix?: string, created_at?: string }.
func (h *RuntimeAPIKeyHandler) GetRuntimeAPIKey(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var prefix sql.NullString
	var createdAt sql.NullTime
	err := h.db.QueryRowContext(c.Context(),
		`SELECT key_prefix, created_at
		   FROM tenant_api_keys
		  WHERE tenant_id = $1 AND name = $2 AND status = 'active'
		  ORDER BY created_at DESC
		  LIMIT 1`,
		tenantID, runtimeAPIKeyName,
	).Scan(&prefix, &createdAt)

	if err == sql.ErrNoRows {
		return c.JSON(fiber.Map{"has_key": false})
	}
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[RuntimeAPIKey] Failed to query runtime key")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}

	resp := fiber.Map{"has_key": true}
	if prefix.Valid {
		resp["prefix"] = prefix.String
	}
	if createdAt.Valid {
		resp["created_at"] = createdAt.Time.UTC().Format(time.RFC3339)
	}
	return c.JSON(resp)
}

// GenerateRuntimeAPIKey handles POST /v1/runtime/api-key.
//
// Mints a new igris_ runtime key for the tenant, stores its SHA-256 hash and a
// 12-char display prefix in tenant_api_keys, and returns the raw key once. The
// tenant's primary api_key_hash (the console service key) is left untouched.
//
// Response: { api_key: "igris_…", prefix: "igris_a1b2c3", created_at: "…" }.
func (h *RuntimeAPIKeyHandler) GenerateRuntimeAPIKey(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	// 32 cryptographically random bytes → 64 hex chars, prefixed with igris_.
	rawBytes := make([]byte, 32)
	if _, err := rand.Read(rawBytes); err != nil {
		log.Error().Err(err).Msg("[RuntimeAPIKey] Failed to generate random bytes")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "key_generation_failed"})
	}

	rawKey := "igris_" + hex.EncodeToString(rawBytes) // "igris_" + 64 hex = 70 chars
	prefix := rawKey[:12]                              // "igris_" + first 6 hex chars
	keyHash := security.HashAPIKey(rawKey)
	now := time.Now().UTC()

	_, err := h.db.ExecContext(c.Context(),
		`INSERT INTO tenant_api_keys (tenant_id, name, key_hash, key_prefix, status, created_at)
		 VALUES ($1, $2, $3, $4, 'active', $5)`,
		tenantID, runtimeAPIKeyName, keyHash, prefix, now,
	)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[RuntimeAPIKey] Failed to store runtime key")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "key_storage_failed"})
	}

	// prefix (safe) is logged; the raw key is never logged.
	log.Info().Str("tenant_id", tenantID).Str("prefix", prefix).Msg("[RuntimeAPIKey] New runtime key generated")

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"api_key":    rawKey,
		"prefix":     prefix,
		"created_at": now.Format(time.RFC3339),
	})
}

// RevokeRuntimeAPIKeys handles DELETE /v1/runtime/api-key.
//
// Revokes every active runtime key for the tenant. Any runtime still using a
// revoked key will fail its next registration/heartbeat. Response: { revoked: n }.
func (h *RuntimeAPIKeyHandler) RevokeRuntimeAPIKeys(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	res, err := h.db.ExecContext(c.Context(),
		`UPDATE tenant_api_keys
		    SET status = 'revoked', revoked_at = NOW()
		  WHERE tenant_id = $1 AND name = $2 AND status = 'active'`,
		tenantID, runtimeAPIKeyName,
	)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[RuntimeAPIKey] Failed to revoke runtime keys")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "revocation_failed"})
	}
	n, _ := res.RowsAffected()

	log.Info().Str("tenant_id", tenantID).Int64("revoked", n).Msg("[RuntimeAPIKey] Runtime keys revoked")
	return c.JSON(fiber.Map{"revoked": n})
}
