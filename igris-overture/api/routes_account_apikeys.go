// Package api — agent / app API key management.
//
// These endpoints let an authenticated tenant mint, list, and revoke the named
// API keys an agent or app uses to call Igris action endpoints. They live in
// the tenant_api_keys table (migration 014), separate from the tenant's primary
// api_key_hash (the console service key / OVERTURE_API_KEY) — so issuing or
// revoking one never disturbs the console's own credential.
//
// Runtime keys (tenant_api_keys.name == runtimeAPIKeyName) are managed by the
// runtime-key endpoints and are deliberately excluded here, keeping the two key
// kinds distinct in the console UI.
//
// Endpoints (auth: BetterAuth — accepts the console service key or any active
// tenant key as a Bearer token and resolves it to a tenant):
//
//	GET    /v1/api-keys      — list agent/app key metadata (never raw, never hash)
//	POST   /v1/api-keys      — mint a new key, returns the raw key exactly once
//	DELETE /v1/api-keys/:id  — revoke one agent/app key (tenant-scoped)
package api

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/security"
)

const (
	agentAPIKeyDefaultName = "Agent key"
	maxAPIKeyNameLen       = 60
)

// AccountAPIKeysHandler issues and manages named agent/app API keys.
type AccountAPIKeysHandler struct {
	db *sql.DB
}

// NewAccountAPIKeysHandler creates a new AccountAPIKeysHandler.
func NewAccountAPIKeysHandler(db *sql.DB) *AccountAPIKeysHandler {
	return &AccountAPIKeysHandler{db: db}
}

// RegisterAccountAPIKeysRoutes registers GET/POST /v1/api-keys and
// DELETE /v1/api-keys/:id. All endpoints require a tenant credential.
func RegisterAccountAPIKeysRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Warn().Msg("[Routes] Agent API key management disabled — database not available")
		return
	}

	h := NewAccountAPIKeysHandler(db)

	grp := app.Group("/v1/api-keys")
	grp.Use(middleware.BetterAuth(db))

	grp.Get("/", h.ListAPIKeys)
	grp.Post("/", h.CreateAPIKey)
	grp.Delete("/:id", h.RevokeAPIKey)

	log.Info().Msg("[Routes] Registered agent API key endpoints (GET/POST /v1/api-keys, DELETE /v1/api-keys/:id)")
}

// sanitizeAgentKeyName trims and validates a user-supplied key label. Returns
// the cleaned name and true on success, or ("", false) when invalid. An empty
// name defaults to "Agent key". The reserved runtime-key name is rejected so
// agent keys never collide with the runtime-key flow, and control characters /
// angle brackets are rejected so a stored label can never carry HTML.
func sanitizeAgentKeyName(raw string) (string, bool) {
	name := strings.TrimSpace(raw)
	if name == "" {
		name = agentAPIKeyDefaultName
	}
	if len(name) > maxAPIKeyNameLen {
		return "", false
	}
	if strings.EqualFold(name, runtimeAPIKeyName) {
		return "", false
	}
	for _, r := range name {
		if r < 0x20 || r == '<' || r == '>' {
			return "", false
		}
	}
	return name, true
}

// ListAPIKeys handles GET /v1/api-keys.
//
// Returns metadata for the tenant's active agent/app keys — never a raw key or
// a hash. Runtime keys are excluded. Response: { keys: [ { id, name, prefix,
// created_at, last_used_at } ] }.
func (h *AccountAPIKeysHandler) ListAPIKeys(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	rows, err := h.db.QueryContext(c.Context(),
		`SELECT id, name, key_prefix, created_at, last_used_at
		   FROM tenant_api_keys
		  WHERE tenant_id = $1 AND status = 'active' AND name <> $2
		  ORDER BY created_at DESC`,
		tenantID, runtimeAPIKeyName,
	)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[APIKeys] Failed to list keys")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	defer rows.Close()

	keys := make([]fiber.Map, 0)
	for rows.Next() {
		var id, name, prefix string
		var createdAt time.Time
		var lastUsed sql.NullTime
		if err := rows.Scan(&id, &name, &prefix, &createdAt, &lastUsed); err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[APIKeys] Failed to scan key row")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		k := fiber.Map{
			"id":         id,
			"name":       name,
			"prefix":     prefix,
			"created_at": createdAt.UTC().Format(time.RFC3339),
		}
		if lastUsed.Valid {
			k["last_used_at"] = lastUsed.Time.UTC().Format(time.RFC3339)
		} else {
			k["last_used_at"] = nil
		}
		keys = append(keys, k)
	}

	return c.JSON(fiber.Map{"keys": keys})
}

// CreateAPIKey handles POST /v1/api-keys.
//
// Mints a new igris_ agent key for the tenant, stores its SHA-256 hash and a
// 12-char display prefix, and returns the raw key exactly once. The tenant's
// primary api_key_hash (the console service key) is left untouched.
//
// Response: { id, name, prefix, api_key: "igris_…", created_at }.
func (h *AccountAPIKeysHandler) CreateAPIKey(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req struct {
		Name string `json:"name"`
	}
	_ = c.BodyParser(&req)

	name, ok := sanitizeAgentKeyName(req.Name)
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid_name",
			"code":  "INVALID_NAME",
		})
	}

	rawBytes := make([]byte, 32)
	if _, err := rand.Read(rawBytes); err != nil {
		log.Error().Err(err).Msg("[APIKeys] Failed to generate random bytes")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "key_generation_failed"})
	}

	rawKey := "igris_" + hex.EncodeToString(rawBytes) // "igris_" + 64 hex = 70 chars
	prefix := rawKey[:12]                             // "igris_" + first 6 hex chars
	keyHash := security.HashAPIKey(rawKey)
	now := time.Now().UTC()

	var id string
	err := h.db.QueryRowContext(c.Context(),
		`INSERT INTO tenant_api_keys (tenant_id, name, key_hash, key_prefix, status, created_at)
		 VALUES ($1, $2, $3, $4, 'active', $5)
		 RETURNING id`,
		tenantID, name, keyHash, prefix, now,
	).Scan(&id)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[APIKeys] Failed to store new key")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "key_storage_failed"})
	}

	// prefix (safe) is logged; the raw key is never logged.
	log.Info().Str("tenant_id", tenantID).Str("prefix", prefix).Msg("[APIKeys] New agent API key generated")

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":         id,
		"name":       name,
		"prefix":     prefix,
		"api_key":    rawKey,
		"created_at": now.Format(time.RFC3339),
	})
}

// RevokeAPIKey handles DELETE /v1/api-keys/:id.
//
// Revokes one agent/app key, scoped to the authenticated tenant. Runtime keys
// cannot be revoked here (name <> runtimeAPIKeyName). Response: { ok: true }.
func (h *AccountAPIKeysHandler) RevokeAPIKey(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	id := c.Params("id")
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "missing_id"})
	}

	res, err := h.db.ExecContext(c.Context(),
		`UPDATE tenant_api_keys
		    SET status = 'revoked', revoked_at = NOW()
		  WHERE id = $1 AND tenant_id = $2 AND name <> $3 AND status = 'active'`,
		id, tenantID, runtimeAPIKeyName,
	)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[APIKeys] Failed to revoke key")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "revocation_failed"})
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "key_not_found"})
	}

	log.Info().Str("tenant_id", tenantID).Msg("[APIKeys] Agent API key revoked")
	return c.JSON(fiber.Map{"ok": true})
}
