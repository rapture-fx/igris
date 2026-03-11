// Package api provides runtime registration and heartbeat endpoints.
// Runtimes call these endpoints on startup and every 30 seconds to register
// themselves against the tenant's subscription and maintain a live presence.
package api

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/billing"
	"github.com/Igris-inertial/system/igris-overture/security"
)

// RuntimeHandler handles runtime registration and heartbeat requests.
type RuntimeHandler struct {
	db       *sql.DB
	enforcer *billing.RuntimeEnforcer
}

// NewRuntimeHandler creates a new handler backed by a database connection
// and the runtime limit enforcer.
func NewRuntimeHandler(db *sql.DB, enforcer *billing.RuntimeEnforcer) *RuntimeHandler {
	return &RuntimeHandler{db: db, enforcer: enforcer}
}

// RegisterRuntimeRoutes registers runtime registration endpoints.
// All endpoints require a valid tenant API key (X-API-Key header).
func RegisterRuntimeRoutes(app *fiber.App, db *sql.DB, enforcer *billing.RuntimeEnforcer) {
	if db == nil {
		log.Warn().Msg("[Routes] Runtime registration disabled — database not available")
		return
	}

	h := NewRuntimeHandler(db, enforcer)

	v1 := app.Group("/api/v1/runtime")
	v1.Use(h.apiKeyAuth)

	v1.Post("/register", h.Register)
	v1.Post("/heartbeat", h.Heartbeat)
	v1.Delete("/deregister", h.Deregister)
	v1.Get("/download", h.Download)

	log.Info().Msg("[Routes] Registered runtime endpoints (/api/v1/runtime)")
}

// runtimeInstanceRegisterRequest is the payload sent by igris-runtime on startup.
type runtimeInstanceRegisterRequest struct {
	MachineID      string `json:"machine_id"`         // dev_{sha256[..16]} fingerprint
	Hostname       string `json:"hostname"`
	Platform       string `json:"platform"`           // e.g. linux-amd64
	RuntimeVersion string `json:"runtime_version"`
	Endpoint       string `json:"endpoint,omitempty"` // optional public endpoint
}

// runtimeRegisterResponse is returned after a successful registration.
type runtimeRegisterResponse struct {
	RuntimeID    string `json:"runtime_id"`
	Tier         string `json:"tier"`
	RuntimeLimit int    `json:"runtime_limit"`
	RegisteredAt string `json:"registered_at"`
}

// runtimeInstanceHeartbeatRequest is the minimal payload for heartbeat/deregister calls.
type runtimeInstanceHeartbeatRequest struct {
	MachineID string `json:"machine_id"`
}

// Register handles POST /api/v1/runtime/register
func (h *RuntimeHandler) Register(c *fiber.Ctx) error {
	tenantID := c.Locals("tenant_id").(string)
	ctx := context.Background()

	var req runtimeInstanceRegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid_request",
			"message": "Failed to parse request body",
		})
	}
	if req.MachineID == "" || req.Hostname == "" || req.RuntimeVersion == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_fields",
			"message": "machine_id, hostname, and runtime_version are required",
		})
	}

	// Check if this machine_id is already registered for this tenant.
	// If so, treat as re-registration (runtime restarted).
	var existingID string
	err := h.db.QueryRowContext(ctx, `
		SELECT runtime_id FROM runtime_instances
		WHERE tenant_id = $1 AND machine_id = $2
		LIMIT 1
	`, tenantID, req.MachineID).Scan(&existingID)

	isNew := errors.Is(err, sql.ErrNoRows)
	now := time.Now().UTC()
	clientIP := c.IP()

	if isNew {
		// Enforce runtime limit before inserting a new record
		if h.enforcer != nil {
			if limitErr := h.enforcer.CheckRuntimeLimit(ctx, tenantID); limitErr != nil {
				if errors.Is(limitErr, billing.ErrTierLimitExceeded) {
					tier, limit := h.getTierAndLimit(ctx, tenantID)
					log.Warn().
						Str("tenant_id", tenantID).
						Str("machine_id", req.MachineID).
						Str("tier", tier).
						Int("limit", limit).
						Msg("[Runtime] Registration rejected — tier limit reached")
					return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
						"error":       "tier_limit_exceeded",
						"message":     "Runtime limit reached for your subscription tier",
						"tier":        tier,
						"limit":       limit,
						"upgrade_url": "https://igrisinertial.com/pricing",
					})
				}
				return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
					"error":   "enforcer_error",
					"message": "Failed to check runtime limit",
				})
			}
		}

		var runtimeID string
		endpoint := nullableString(req.Endpoint)
		err = h.db.QueryRowContext(ctx, `
			INSERT INTO runtime_instances
				(runtime_id, tenant_id, machine_id, hostname_cached, ip_address,
				 public_key_ed25519, endpoint, capabilities, platform, version,
				 is_edge, is_healthy, status, last_heartbeat, last_seen_at, registered_at)
			VALUES
				(gen_random_uuid()::text, $1, $2, $3, $4,
				 '', COALESCE($5, ''), '[]', $6, $7,
				 true, true, 'active', $8, $8, $8)
			RETURNING runtime_id
		`, tenantID, req.MachineID, req.Hostname, clientIP,
			endpoint, req.Platform, req.RuntimeVersion, now,
		).Scan(&runtimeID)

		if err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Runtime] Failed to insert runtime instance")
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error":   "registration_failed",
				"message": "Failed to register runtime instance",
			})
		}

		if h.enforcer != nil {
			if incrErr := h.enforcer.IncrementRuntimeCount(ctx, tenantID); incrErr != nil {
				log.Warn().Err(incrErr).Str("tenant_id", tenantID).Msg("[Runtime] Failed to increment runtime count in Redis")
			}
		}

		log.Info().
			Str("tenant_id", tenantID).
			Str("runtime_id", runtimeID).
			Str("machine_id", req.MachineID).
			Str("hostname", req.Hostname).
			Msg("[Runtime] New runtime registered")

		tier, limit := h.getTierAndLimit(ctx, tenantID)
		return c.Status(fiber.StatusOK).JSON(runtimeRegisterResponse{
			RuntimeID:    runtimeID,
			Tier:         tier,
			RuntimeLimit: limit,
			RegisteredAt: now.Format(time.RFC3339),
		})
	}

	// Re-registration: refresh liveness fields
	_, err = h.db.ExecContext(ctx, `
		UPDATE runtime_instances
		SET hostname_cached = $1, ip_address = $2, version = $3,
		    last_heartbeat = $4, last_seen_at = $4,
		    is_healthy = true, status = 'active'
		WHERE tenant_id = $5 AND machine_id = $6
	`, req.Hostname, clientIP, req.RuntimeVersion, now, tenantID, req.MachineID)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Runtime] Failed to update runtime instance on re-registration")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "registration_failed",
			"message": "Failed to update runtime instance",
		})
	}

	log.Info().
		Str("tenant_id", tenantID).
		Str("runtime_id", existingID).
		Str("machine_id", req.MachineID).
		Msg("[Runtime] Runtime re-registered")

	tier, limit := h.getTierAndLimit(ctx, tenantID)
	return c.Status(fiber.StatusOK).JSON(runtimeRegisterResponse{
		RuntimeID:    existingID,
		Tier:         tier,
		RuntimeLimit: limit,
		RegisteredAt: now.Format(time.RFC3339),
	})
}

// Heartbeat handles POST /api/v1/runtime/heartbeat
func (h *RuntimeHandler) Heartbeat(c *fiber.Ctx) error {
	tenantID := c.Locals("tenant_id").(string)
	ctx := context.Background()

	var req runtimeInstanceHeartbeatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid_request",
		})
	}
	if req.MachineID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_fields",
			"message": "machine_id is required",
		})
	}

	now := time.Now().UTC()
	result, err := h.db.ExecContext(ctx, `
		UPDATE runtime_instances
		SET last_heartbeat = $1, last_seen_at = $1, is_healthy = true,
		    status = 'active', ip_address = $2
		WHERE tenant_id = $3 AND machine_id = $4
	`, now, c.IP(), tenantID, req.MachineID)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Runtime] Heartbeat DB error")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "heartbeat_failed",
		})
	}

	n, _ := result.RowsAffected()
	if n == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "not_registered",
			"message": "Runtime not found — call /api/v1/runtime/register first",
		})
	}

	return c.JSON(fiber.Map{
		"status":    "ok",
		"timestamp": now.Format(time.RFC3339),
	})
}

// Deregister handles DELETE /api/v1/runtime/deregister
func (h *RuntimeHandler) Deregister(c *fiber.Ctx) error {
	tenantID := c.Locals("tenant_id").(string)
	ctx := context.Background()

	var req runtimeInstanceHeartbeatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid_request",
		})
	}
	if req.MachineID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_fields",
			"message": "machine_id is required",
		})
	}

	result, err := h.db.ExecContext(ctx, `
		UPDATE runtime_instances
		SET status = 'deregistered', is_healthy = false
		WHERE tenant_id = $1 AND machine_id = $2 AND status != 'deregistered'
	`, tenantID, req.MachineID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "deregister_failed",
		})
	}

	n, _ := result.RowsAffected()
	if n > 0 && h.enforcer != nil {
		if err := h.enforcer.DecrementRuntimeCount(ctx, tenantID); err != nil {
			log.Warn().Err(err).Str("tenant_id", tenantID).Msg("[Runtime] Failed to decrement runtime count")
		}
		log.Info().
			Str("tenant_id", tenantID).
			Str("machine_id", req.MachineID).
			Msg("[Runtime] Runtime deregistered")
	}

	return c.JSON(fiber.Map{"status": "ok"})
}

// Download handles GET /api/v1/runtime/download?platform=linux-x64
func (h *RuntimeHandler) Download(c *fiber.Ctx) error {
	platform := c.Query("platform", "linux-x64")

	binaries := map[string]string{
		"linux-x64":    "igris-runtime-linux-x64.tar.gz",
		"linux-amd64":  "igris-runtime-linux-x64.tar.gz",
		"linux-arm64":  "igris-runtime-linux-arm64.tar.gz",
		"macos-arm64":  "igris-runtime-macos-arm64.tar.gz",
		"darwin-arm64": "igris-runtime-macos-arm64.tar.gz",
	}

	binaryName, ok := binaries[platform]
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":     "unsupported_platform",
			"message":   "Supported: linux-x64, linux-arm64, macos-arm64",
			"supported": []string{"linux-x64", "linux-arm64", "macos-arm64"},
		})
	}

	baseURL := os.Getenv("RUNTIME_BINARIES_URL")
	version := os.Getenv("RUNTIME_BINARY_VERSION")
	if baseURL == "" {
		baseURL = "https://github.com/Igris-inertial/system/releases/download"
	}
	if version == "" {
		version = "runtime-v1.6.0"
	}

	url := baseURL + "/" + version + "/" + binaryName
	return c.Redirect(url, fiber.StatusFound)
}

// apiKeyAuth validates X-API-Key and injects tenant_id / tenant_tier into locals.
func (h *RuntimeHandler) apiKeyAuth(c *fiber.Ctx) error {
	apiKey := c.Get("X-API-Key")
	if apiKey == "" {
		auth := c.Get("Authorization")
		if len(auth) > 7 && auth[:7] == "Bearer " {
			apiKey = auth[7:]
		}
	}
	if apiKey == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "missing_api_key",
			"message": "Provide your tenant API key via X-API-Key header",
		})
	}

	keyHash := security.HashAPIKey(apiKey)

	var tenantID, tenantTier, tenantStatus string
	err := h.db.QueryRowContext(context.Background(), `
		SELECT id, tier, status FROM tenants WHERE api_key_hash = $1
	`, keyHash).Scan(&tenantID, &tenantTier, &tenantStatus)

	if errors.Is(err, sql.ErrNoRows) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "invalid_api_key",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "auth_failed",
		})
	}
	if tenantStatus != "active" {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":  "tenant_not_active",
			"status": tenantStatus,
		})
	}

	c.Locals("tenant_id", tenantID)
	c.Locals("tenant_tier", tenantTier)
	return c.Next()
}

// getTierAndLimit looks up tier string and runtime limit for a tenant.
func (h *RuntimeHandler) getTierAndLimit(ctx context.Context, tenantID string) (string, int) {
	var tier string
	_ = h.db.QueryRowContext(ctx, `SELECT tier FROM tenants WHERE id = $1`, tenantID).Scan(&tier)

	t := billing.Tier(tier)
	limit, ok := billing.TierRuntimeLimit[t]
	if !ok {
		limit = billing.TierRuntimeLimit[billing.TierSeed]
	}
	return tier, limit
}

// nullableString converts an empty string to nil for SQL nullable columns.
func nullableString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
