// Package api provides /policy/bounds and /policy/capabilities endpoints for the
// web-console Policy section. These store runtime execution bounds and capability
// allow/deny rules as JSONB on the tenants table (added in migration 013).
package api

import (
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterPolicyExtRoutes registers the /policy/* endpoints consumed by the
// web-console Policy > Bounds and Policy > Capabilities pages.
// These are mounted at root (no /v1/ prefix) to match the frontend calls.
func RegisterPolicyExtRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		log.Warn().Msg("[Routes] Policy-ext endpoints disabled — database not available")
		return
	}

	h := &policyExtHandler{db: db}

	policy := app.Group("/policy")
	policy.Use(middleware.BetterAuth(db))

	policy.Get("/bounds", h.getBounds)
	policy.Post("/bounds", h.updateBounds)
	policy.Get("/capabilities", h.getCapabilities)
	policy.Post("/capabilities", h.updateCapabilities)
	policy.Get("/capabilities/history", h.capabilitiesHistory)
	policy.Get("/history", h.boundsHistory)

	log.Info().Msg("[Routes] Registered policy-ext endpoints (/policy/bounds, /policy/capabilities)")
}

type policyExtHandler struct{ db *sql.DB }

// defaultBounds returns the zero-value PolicyBounds for a new tenant.
func defaultBounds() map[string]interface{} {
	return map[string]interface{}{
		"max_execution_ms": 30000,
		"max_tick_ms":      5000,
		"max_steps":        100,
		"cpu_percent":      80,
		"memory_mb":        512,
		"disk_write_mb":    256,
	}
}

// defaultCapabilities returns the zero-value Capabilities for a new tenant.
func defaultCapabilities() map[string]interface{} {
	return map[string]interface{}{
		"allow_http":         true,
		"allow_shell":        false,
		"allow_fs_write":     false,
		"allow_external_api": true,
		"domain_allowlist":   []interface{}{},
		"domain_denylist":    []interface{}{},
		"writable_paths":     []interface{}{},
		"readable_paths":     []interface{}{},
		"violation_behavior": "terminate",
	}
}

// policyHash computes a short deterministic hash for a JSONB blob.
func policyHash(data []byte) string {
	h := sha256.Sum256(data)
	return fmt.Sprintf("sha256:%x", h[:8])
}

// ── GET /policy/bounds ───────────────────────────────────────────────────────

func (h *policyExtHandler) getBounds(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var rawJSON []byte
	err := h.db.QueryRow(`
		SELECT COALESCE(runtime_bounds, '{}') FROM tenants WHERE tenant_id = $1
	`, tenantID).Scan(&rawJSON)
	if err == sql.ErrNoRows || len(rawJSON) == 0 || string(rawJSON) == "{}" {
		bounds := defaultBounds()
		bounds["policy_hash"] = policyHash([]byte("{}"))
		bounds["updated_at"] = time.Now().UTC().Format(time.RFC3339)
		return c.JSON(bounds)
	}
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Policy] getBounds query failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}

	var bounds map[string]interface{}
	if err := json.Unmarshal(rawJSON, &bounds); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "parse_error"})
	}
	if bounds["policy_hash"] == nil {
		bounds["policy_hash"] = policyHash(rawJSON)
	}
	if bounds["updated_at"] == nil {
		bounds["updated_at"] = time.Now().UTC().Format(time.RFC3339)
	}
	return c.JSON(bounds)
}

// ── POST /policy/bounds ──────────────────────────────────────────────────────

func (h *policyExtHandler) updateBounds(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req map[string]interface{}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid_request"})
	}

	// Stamp hash and timestamp
	raw, _ := json.Marshal(req)
	req["policy_hash"] = policyHash(raw)
	req["updated_at"] = time.Now().UTC().Format(time.RFC3339)
	stamped, _ := json.Marshal(req)

	_, err := h.db.Exec(`
		UPDATE tenants SET runtime_bounds = $2 WHERE tenant_id = $1
	`, tenantID, string(stamped))
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Policy] updateBounds failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}

	// Log audit event
	go h.logPolicyAudit(tenantID, "bounds_updated", stamped)

	return c.JSON(req)
}

// ── GET /policy/capabilities ─────────────────────────────────────────────────

func (h *policyExtHandler) getCapabilities(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var rawJSON []byte
	err := h.db.QueryRow(`
		SELECT COALESCE(capabilities_policy, '{}') FROM tenants WHERE tenant_id = $1
	`, tenantID).Scan(&rawJSON)
	if err == sql.ErrNoRows || len(rawJSON) == 0 || string(rawJSON) == "{}" {
		caps := defaultCapabilities()
		caps["policy_hash"] = policyHash([]byte("{}"))
		caps["updated_at"] = time.Now().UTC().Format(time.RFC3339)
		return c.JSON(caps)
	}
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Policy] getCapabilities query failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}

	var caps map[string]interface{}
	if err := json.Unmarshal(rawJSON, &caps); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "parse_error"})
	}
	if caps["policy_hash"] == nil {
		caps["policy_hash"] = policyHash(rawJSON)
	}
	if caps["updated_at"] == nil {
		caps["updated_at"] = time.Now().UTC().Format(time.RFC3339)
	}
	return c.JSON(caps)
}

// ── POST /policy/capabilities ────────────────────────────────────────────────

func (h *policyExtHandler) updateCapabilities(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req map[string]interface{}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid_request"})
	}

	raw, _ := json.Marshal(req)
	req["policy_hash"] = policyHash(raw)
	req["updated_at"] = time.Now().UTC().Format(time.RFC3339)
	stamped, _ := json.Marshal(req)

	_, err := h.db.Exec(`
		UPDATE tenants SET capabilities_policy = $2 WHERE tenant_id = $1
	`, tenantID, string(stamped))
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Policy] updateCapabilities failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}

	go h.logPolicyAudit(tenantID, "capabilities_updated", stamped)

	return c.JSON(req)
}

// ── GET /policy/capabilities/history ─────────────────────────────────────────

func (h *policyExtHandler) capabilitiesHistory(c *fiber.Ctx) error {
	return h.getHistory(c, "capabilities_updated")
}

// ── GET /policy/history ───────────────────────────────────────────────────────

func (h *policyExtHandler) boundsHistory(c *fiber.Ctx) error {
	return h.getHistory(c, "bounds_updated")
}

func (h *policyExtHandler) getHistory(c *fiber.Ctx, eventType string) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	rows, err := h.db.Query(`
		SELECT id, event_type, timestamp, COALESCE(metadata::text, '{}')
		FROM audit_events
		WHERE tenant_id = $1
		  AND event_type = $2
		ORDER BY timestamp DESC
		LIMIT 50
	`, tenantID, eventType)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Policy] history query failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	defer rows.Close()

	type HistEntry struct {
		ID          string `json:"id"`
		Timestamp   string `json:"timestamp"`
		PolicyHash  string `json:"policy_hash"`
		ChangeType  string `json:"change_type"`
		ChangedBy   string `json:"changed_by"`
	}

	entries := make([]HistEntry, 0)
	for rows.Next() {
		var e HistEntry
		var ts time.Time
		var meta string
		var id string
		if err := rows.Scan(&id, &e.ChangeType, &ts, &meta); err != nil {
			continue
		}
		e.ID = id
		e.Timestamp = ts.UTC().Format(time.RFC3339)
		e.PolicyHash = policyHash([]byte(meta))
		e.ChangedBy = tenantID
		entries = append(entries, e)
	}
	return c.JSON(entries)
}

func (h *policyExtHandler) logPolicyAudit(tenantID, eventType string, data []byte) {
	_, err := h.db.Exec(`
		INSERT INTO audit_events (tenant_id, event_type, event_category, severity, metadata)
		VALUES ($1, $2, 'policy', 'info', $3)
	`, tenantID, eventType, string(data))
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Policy] Failed to log audit event")
	}
}
