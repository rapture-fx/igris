// Package api provides settings endpoints for the web-console Settings > General page.
// Covers general preferences, security options, runtime config, and named API key management.
package api

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterSettingsRoutes registers the /v1/settings/* endpoints.
func RegisterSettingsRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Warn().Msg("[Routes] Settings endpoints disabled — database not available")
		return
	}

	s := &settingsHandler{db: db}

	v1 := app.Group("/v1/settings")
	v1.Use(middleware.BetterAuth(db))

	v1.Post("/general", s.updateGeneral)
	v1.Post("/security", s.updateSecurity)
	v1.Post("/runtime", s.updateRuntime)
	v1.Get("/api-keys", s.listAPIKeys)
	v1.Post("/api-keys", s.createAPIKey)
	v1.Post("/api-keys/revoke", s.revokeAPIKey)

	log.Info().Msg("[Routes] Registered settings endpoints (/v1/settings/general|security|runtime|api-keys)")
}

type settingsHandler struct{ db *sql.DB }

// ── POST /v1/settings/general ───────────────────────────────────────────────

func (s *settingsHandler) updateGeneral(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req struct {
		SystemName  string `json:"system_name"`
		Environment string `json:"environment"`
		Timezone    string `json:"timezone"`
		LogLevel    string `json:"log_level"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid_request"})
	}

	_, err := s.db.Exec(`
		UPDATE tenants
		SET
			tenant_name  = COALESCE(NULLIF($2, ''), tenant_name),
			environment  = COALESCE(NULLIF($3, ''), environment),
			timezone     = COALESCE(NULLIF($4, ''), timezone),
			log_level    = COALESCE(NULLIF($5, ''), log_level)
		WHERE tenant_id = $1
	`, tenantID, req.SystemName, req.Environment, req.Timezone, req.LogLevel)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Settings] Failed to update general settings")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	return c.JSON(fiber.Map{"status": "ok"})
}

// ── POST /v1/settings/security ──────────────────────────────────────────────

func (s *settingsHandler) updateSecurity(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req struct {
		ExecutionSigning bool   `json:"execution_signing"`
		VerificationKey  string `json:"verification_key"`
		AuditLogging     bool   `json:"audit_logging"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid_request"})
	}

	_, err := s.db.Exec(`
		UPDATE tenants
		SET execution_signing = $2,
		    audit_logging      = $3
		WHERE tenant_id = $1
	`, tenantID, req.ExecutionSigning, req.AuditLogging)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Settings] Failed to update security settings")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	return c.JSON(fiber.Map{"status": "ok"})
}

// ── POST /v1/settings/runtime ───────────────────────────────────────────────

func (s *settingsHandler) updateRuntime(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req struct {
		ReceiptRetentionDays     int  `json:"receipt_retention_days"`
		TelemetryEnabled         bool `json:"telemetry_enabled"`
		DefaultExecutionTimeout  int  `json:"default_execution_timeout"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid_request"})
	}

	if req.ReceiptRetentionDays <= 0 {
		req.ReceiptRetentionDays = 90
	}
	if req.DefaultExecutionTimeout <= 0 {
		req.DefaultExecutionTimeout = 30000
	}

	_, err := s.db.Exec(`
		UPDATE tenants
		SET receipt_retention_days   = $2,
		    telemetry_enabled         = $3,
		    default_execution_timeout = $4
		WHERE tenant_id = $1
	`, tenantID, req.ReceiptRetentionDays, req.TelemetryEnabled, req.DefaultExecutionTimeout)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Settings] Failed to update runtime settings")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	return c.JSON(fiber.Map{"status": "ok"})
}

// ── GET /v1/settings/api-keys ───────────────────────────────────────────────

func (s *settingsHandler) listAPIKeys(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	rows, err := s.db.Query(`
		SELECT id, name, key_prefix, status, last_used_at, created_at
		FROM tenant_api_keys
		WHERE tenant_id = $1
		ORDER BY created_at DESC
	`, tenantID)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Settings] Failed to list API keys")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	defer rows.Close()

	type APIKeyRecord struct {
		ID        string  `json:"id"`
		Name      string  `json:"name"`
		MaskedKey string  `json:"masked_key"`
		CreatedAt string  `json:"created_at"`
		LastUsed  *string `json:"last_used"`
		Status    string  `json:"status"`
	}

	keys := make([]APIKeyRecord, 0)
	for rows.Next() {
		var k APIKeyRecord
		var lastUsed sql.NullTime
		var createdAt time.Time

		if err := rows.Scan(&k.ID, &k.Name, &k.MaskedKey, &k.Status, &lastUsed, &createdAt); err != nil {
			continue
		}
		// Mask all but the prefix — prefix is already e.g. "igk_live_a1b2c3d4"
		k.MaskedKey = k.MaskedKey + "••••••••••••"
		k.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		if lastUsed.Valid {
			s := lastUsed.Time.UTC().Format(time.RFC3339)
			k.LastUsed = &s
		}
		keys = append(keys, k)
	}
	return c.JSON(keys)
}

// ── POST /v1/settings/api-keys ──────────────────────────────────────────────

func (s *settingsHandler) createAPIKey(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil || req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "name is required"})
	}

	// Generate a cryptographically random key: igk_live_{32 hex chars}
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "key_generation_failed"})
	}
	rawKey := "igk_live_" + hex.EncodeToString(raw)
	prefix := rawKey[:16] // "igk_live_" + first 7 hex chars

	// Store SHA-256 hash, never the raw key
	hashBytes := sha256.Sum256([]byte(rawKey))
	keyHash := fmt.Sprintf("%x", hashBytes)

	var keyID string
	err := s.db.QueryRow(`
		INSERT INTO tenant_api_keys (tenant_id, name, key_hash, key_prefix, status)
		VALUES ($1, $2, $3, $4, 'active')
		RETURNING id
	`, tenantID, req.Name, keyHash, prefix).Scan(&keyID)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Settings] Failed to create API key")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":      keyID,
		"name":    req.Name,
		"raw_key": rawKey, // Shown only once
		"prefix":  prefix,
		"status":  "active",
	})
}

// ── POST /v1/settings/api-keys/revoke ───────────────────────────────────────

func (s *settingsHandler) revokeAPIKey(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req struct {
		KeyID string `json:"key_id"`
	}
	if err := c.BodyParser(&req); err != nil || req.KeyID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "key_id is required"})
	}

	result, err := s.db.Exec(`
		UPDATE tenant_api_keys
		SET status = 'revoked', revoked_at = NOW()
		WHERE id = $1 AND tenant_id = $2 AND status = 'active'
	`, req.KeyID, tenantID)
	if err != nil {
		log.Error().Err(err).Str("key_id", req.KeyID).Msg("[Settings] Failed to revoke API key")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "key not found or already revoked"})
	}
	return c.JSON(fiber.Map{"status": "revoked"})
}
