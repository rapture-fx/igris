// Package api provides runtime registration and heartbeat endpoints.
// Runtimes call these endpoints on startup and every 30 seconds to register
// themselves against the tenant's subscription and maintain a live presence.
package api

import (
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/billing"
	"github.com/Igris-inertial/system/igris-overture/internal"
	"github.com/Igris-inertial/system/igris-overture/security"
)

const runtimeRequestTimestampWindow = 5 * time.Minute

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
	v1.Get("/commands", h.GetPendingCommands)
	v1.Post("/commands/ack", h.AckPendingCommands)

	log.Info().Msg("[Routes] Registered runtime endpoints (/api/v1/runtime)")
}

// runtimeInstanceRegisterRequest is the payload sent by igris-runtime on startup.
type runtimeInstanceRegisterRequest struct {
	MachineID        string `json:"machine_id"` // persisted runtime installation identity
	Hostname         string `json:"hostname"`
	Platform         string `json:"platform"` // e.g. linux-amd64
	RuntimeVersion   string `json:"runtime_version"`
	Endpoint         string `json:"endpoint,omitempty"` // optional public endpoint
	PublicKeyEd25519 string `json:"public_key_ed25519"`
	TimestampUnixMs  int64  `json:"timestamp_unix_ms"`
	Signature        string `json:"signature"`
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
	// BtState is the latest BT tick snapshot from the executor
	// ({"tick":N,"status":"...","tree":{...}}). Optional — omitted when idle.
	BtState                     json.RawMessage `json:"bt_state,omitempty"`
	LocalCommandSpoolDepth      uint64          `json:"local_command_spool_depth,omitempty"`
	LocalCommandClearGeneration uint64          `json:"local_command_clear_generation,omitempty"`
	LocalCommandStatuses        json.RawMessage `json:"local_command_statuses,omitempty"`
	TimestampUnixMs             int64           `json:"timestamp_unix_ms"`
	Signature                   string          `json:"signature"`
}

type runtimeCommandAckRequest struct {
	MachineID               string   `json:"machine_id"`
	DeliveryKeys            []string `json:"delivery_keys"`
	ExpectedClearGeneration uint64   `json:"expected_clear_generation"`
	TimestampUnixMs         int64    `json:"timestamp_unix_ms"`
	Signature               string   `json:"signature"`
}

type runtimeCommandsResponse struct {
	Commands        []map[string]interface{} `json:"commands"`
	ClearGeneration int64                    `json:"clear_generation"`
}

type runtimeCommandAckResponse struct {
	Status           string `json:"status"`
	AckedCount       int    `json:"acked_count"`
	OwnershipGranted bool   `json:"ownership_granted"`
	ClearGeneration  int64  `json:"clear_generation"`
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
	if req.PublicKeyEd25519 == "" || req.TimestampUnixMs == 0 || req.Signature == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_fields",
			"message": "public_key_ed25519, timestamp_unix_ms, and signature are required",
		})
	}
	if err := validateRuntimeTimestamp(req.TimestampUnixMs); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "runtime_signature_invalid",
			"message": err.Error(),
		})
	}
	if err := verifyRuntimeRegisterSignature(req); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "runtime_signature_invalid",
			"message": err.Error(),
		})
	}
	normalizedEndpoint, err := internal.NormalizeHTTPRuntimeEndpoint(req.Endpoint)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid_runtime_endpoint",
			"message": "runtime endpoint must be a valid http:// or https:// URL reachable by Igris for task routing",
		})
	}

	// Check if this machine_id is already registered for this tenant.
	// If so, treat as re-registration (runtime restarted).
	var existingID string
	var existingPublicKey string
	err = h.db.QueryRowContext(ctx, `
		SELECT runtime_id, COALESCE(public_key_ed25519, '') FROM runtime_instances
		WHERE tenant_id = $1 AND machine_id = $2
		LIMIT 1
	`, tenantID, req.MachineID).Scan(&existingID, &existingPublicKey)

	isNew := errors.Is(err, sql.ErrNoRows)
	if err != nil && !isNew {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Runtime] Failed to query runtime instance")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "registration_failed",
			"message": "Failed to query runtime registration state",
		})
	}
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
		err = h.db.QueryRowContext(ctx, `
			INSERT INTO runtime_instances
				(runtime_id, tenant_id, machine_id, hostname_cached, ip_address,
				 public_key_ed25519, endpoint, capabilities, platform, version,
				 is_edge, is_healthy, status, last_heartbeat, last_seen_at, registered_at)
			VALUES
				(gen_random_uuid()::text, $1, $2, $3, $4,
				 $5, $6, '[]', $7, $8,
				 true, true, 'active', $9, $9, $9)
			RETURNING runtime_id
		`, tenantID, req.MachineID, req.Hostname, clientIP,
			req.PublicKeyEd25519, normalizedEndpoint, req.Platform, req.RuntimeVersion, now,
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
	if existingPublicKey != "" && existingPublicKey != req.PublicKeyEd25519 {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":   "runtime_public_key_mismatch",
			"message": "runtime public key does not match the registered machine identity",
		})
	}

	// Re-registration: refresh liveness fields
	_, err = h.db.ExecContext(ctx, `
		UPDATE runtime_instances
		SET hostname_cached = $1, ip_address = $2, version = $3,
		    public_key_ed25519 = CASE
		        WHEN COALESCE(public_key_ed25519, '') = '' THEN $4
		        ELSE public_key_ed25519
		    END,
		    endpoint = $5,
		    platform = $6,
		    last_heartbeat = $7, last_seen_at = $7,
		    is_healthy = true, status = 'active'
		WHERE tenant_id = $8 AND machine_id = $9
	`, req.Hostname, clientIP, req.RuntimeVersion, req.PublicKeyEd25519, normalizedEndpoint, req.Platform, now, tenantID, req.MachineID)
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
	if req.TimestampUnixMs == 0 || req.Signature == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_fields",
			"message": "timestamp_unix_ms and signature are required",
		})
	}
	runtimePublicKey, err := h.runtimePublicKeyForMachine(ctx, tenantID, req.MachineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error":   "not_registered",
				"message": "Runtime not found — call /api/v1/runtime/register first",
			})
		}
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Runtime] Heartbeat runtime lookup failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "heartbeat_failed"})
	}
	if strings.TrimSpace(runtimePublicKey) == "" {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":   "runtime_unverified",
			"message": "Runtime has no registered public key",
		})
	}
	if err := validateRuntimeTimestamp(req.TimestampUnixMs); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "runtime_signature_invalid",
			"message": err.Error(),
		})
	}
	if err := verifyRuntimeHeartbeatSignature(runtimePublicKey, req); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "runtime_signature_invalid",
			"message": err.Error(),
		})
	}

	now := time.Now().UTC()

	var result sql.Result
	if len(req.BtState) > 0 && string(req.BtState) != "null" {
		result, err = h.db.ExecContext(ctx, `
			UPDATE runtime_instances
			SET last_heartbeat = $1, last_seen_at = $1, is_healthy = true,
			    status = 'active', ip_address = $2,
			    bt_state = $5::jsonb, bt_state_updated_at = $1,
			    local_command_spool_depth = $6,
			    local_command_clear_generation = $7,
			    local_command_statuses = COALESCE($8::jsonb, '[]'::jsonb)
			WHERE tenant_id = $3 AND machine_id = $4
		`, now, c.IP(), tenantID, req.MachineID, req.BtState, req.LocalCommandSpoolDepth, req.LocalCommandClearGeneration, nullableJSON(req.LocalCommandStatuses))
	} else {
		result, err = h.db.ExecContext(ctx, `
			UPDATE runtime_instances
			SET last_heartbeat = $1, last_seen_at = $1, is_healthy = true,
			    status = 'active', ip_address = $2,
			    local_command_spool_depth = $5,
			    local_command_clear_generation = $6,
			    local_command_statuses = COALESCE($7::jsonb, '[]'::jsonb)
			WHERE tenant_id = $3 AND machine_id = $4
		`, now, c.IP(), tenantID, req.MachineID, req.LocalCommandSpoolDepth, req.LocalCommandClearGeneration, nullableJSON(req.LocalCommandStatuses))
	}
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

	// Check whether there are pending commands waiting for this runtime.
	var pendingCount int
	var localSpoolDepth int
	_ = h.db.QueryRowContext(ctx, `
		SELECT jsonb_array_length(COALESCE(pending_commands, '[]'::jsonb)),
		       COALESCE(local_command_spool_depth, 0)
		FROM runtime_instances
		WHERE tenant_id = $1 AND machine_id = $2
	`, tenantID, req.MachineID).Scan(&pendingCount, &localSpoolDepth)

	return c.JSON(fiber.Map{
		"status":               "ok",
		"timestamp":            now.Format(time.RFC3339),
		"has_pending_commands": pendingCount+localSpoolDepth > 0,
	})
}

// GetPendingCommands handles GET /api/v1/runtime/commands
// Returns all queued commands for the calling runtime with stable delivery keys.
func (h *RuntimeHandler) GetPendingCommands(c *fiber.Ctx) error {
	tenantID := c.Locals("tenant_id").(string)
	ctx := context.Background()

	machineID := c.Query("machine_id")
	if machineID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_machine_id",
			"message": "machine_id query parameter is required",
		})
	}
	timestampUnixMs, err := strconv.ParseInt(strings.TrimSpace(c.Query("timestamp_unix_ms")), 10, 64)
	if err != nil || timestampUnixMs == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_timestamp",
			"message": "timestamp_unix_ms query parameter is required",
		})
	}
	signature := strings.TrimSpace(c.Query("signature"))
	if signature == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_signature",
			"message": "signature query parameter is required",
		})
	}
	runtimePublicKey, err := h.runtimePublicKeyForMachine(ctx, tenantID, machineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error":   "not_registered",
				"message": "Runtime not found — call /api/v1/runtime/register first",
			})
		}
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Runtime] Command runtime lookup failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "internal_error",
		})
	}
	if strings.TrimSpace(runtimePublicKey) == "" {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":   "runtime_unverified",
			"message": "Runtime has no registered public key",
		})
	}
	if err := validateRuntimeTimestamp(timestampUnixMs); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "runtime_signature_invalid",
			"message": err.Error(),
		})
	}
	if err := verifyRuntimeSignatureMessage(
		runtimePublicKey,
		signature,
		fmt.Sprintf("runtime_commands.v1:%s:%d", machineID, timestampUnixMs),
	); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "runtime_signature_invalid",
			"message": err.Error(),
		})
	}

	var (
		rawCommands     []byte
		clearGeneration int64
	)
	err = h.db.QueryRowContext(ctx, `
		SELECT COALESCE(pending_commands, '[]'::jsonb),
		       COALESCE(pending_commands_clear_generation, 0)
		FROM runtime_instances
		WHERE tenant_id = $1 AND machine_id = $2
	`, tenantID, machineID).Scan(&rawCommands, &clearGeneration)

	if errors.Is(err, sql.ErrNoRows) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "not_registered",
			"message": "Runtime not found — call /api/v1/runtime/register first",
		})
	}
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Runtime] GetPendingCommands failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "internal_error",
		})
	}

	commands, err := decoratePendingCommandsForDelivery(rawCommands)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Runtime] GetPendingCommands decorate failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "internal_error",
		})
	}

	return c.JSON(runtimeCommandsResponse{
		Commands:        commands,
		ClearGeneration: clearGeneration,
	})
}

// AckPendingCommands handles POST /api/v1/runtime/commands/ack
// and removes the acknowledged commands from the runtime queue.
func (h *RuntimeHandler) AckPendingCommands(c *fiber.Ctx) error {
	tenantID := c.Locals("tenant_id").(string)
	ctx := context.Background()

	var req runtimeCommandAckRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid_request",
		})
	}
	if req.MachineID == "" || req.TimestampUnixMs == 0 || req.Signature == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_fields",
			"message": "machine_id, timestamp_unix_ms, and signature are required",
		})
	}

	runtimePublicKey, err := h.runtimePublicKeyForMachine(ctx, tenantID, req.MachineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error":   "not_registered",
				"message": "Runtime not found — call /api/v1/runtime/register first",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "internal_error",
		})
	}
	if strings.TrimSpace(runtimePublicKey) == "" {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":   "runtime_unverified",
			"message": "Runtime has no registered public key",
		})
	}
	if err := validateRuntimeTimestamp(req.TimestampUnixMs); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "runtime_signature_invalid",
			"message": err.Error(),
		})
	}
	if err := verifyRuntimeCommandAckSignature(runtimePublicKey, req); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "runtime_signature_invalid",
			"message": err.Error(),
		})
	}

	tx, err := h.db.BeginTx(ctx, nil)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	defer tx.Rollback()

	var rawCommands []byte
	var clearGeneration int64
	err = tx.QueryRowContext(ctx, `
		SELECT COALESCE(pending_commands, '[]'::jsonb),
		       COALESCE(pending_commands_clear_generation, 0)
		FROM runtime_instances
		WHERE tenant_id = $1 AND machine_id = $2
		FOR UPDATE
	`, tenantID, req.MachineID).Scan(&rawCommands, &clearGeneration)
	if errors.Is(err, sql.ErrNoRows) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "not_registered",
			"message": "Runtime not found — call /api/v1/runtime/register first",
		})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}

	if clearGeneration != int64(req.ExpectedClearGeneration) {
		if err := tx.Commit(); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
		return c.JSON(runtimeCommandAckResponse{
			Status:           "generation_mismatch",
			AckedCount:       0,
			OwnershipGranted: false,
			ClearGeneration:  clearGeneration,
		})
	}

	var commands []json.RawMessage
	if len(rawCommands) > 0 {
		if err := json.Unmarshal(rawCommands, &commands); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
		}
	}

	ackSet := make(map[string]struct{}, len(req.DeliveryKeys))
	for _, key := range req.DeliveryKeys {
		key = strings.TrimSpace(key)
		if key != "" {
			ackSet[key] = struct{}{}
		}
	}

	filtered := make([]json.RawMessage, 0, len(commands))
	ackedCount := 0
	for _, raw := range commands {
		deliveryKey, keyErr := runtimeCommandDeliveryKeyFromRaw(raw)
		if keyErr != nil {
			filtered = append(filtered, raw)
			continue
		}
		if _, ok := ackSet[deliveryKey]; ok {
			ackedCount++
			continue
		}
		filtered = append(filtered, raw)
	}

	filteredBytes, err := json.Marshal(filtered)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE runtime_instances
		SET pending_commands = $1::jsonb,
		    updated_at = NOW()
		WHERE tenant_id = $2 AND machine_id = $3
	`, filteredBytes, tenantID, req.MachineID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}
	if err := tx.Commit(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "internal_error"})
	}

	return c.JSON(runtimeCommandAckResponse{
		Status:           "ok",
		AckedCount:       ackedCount,
		OwnershipGranted: true,
		ClearGeneration:  clearGeneration,
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
	if req.TimestampUnixMs == 0 || req.Signature == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_fields",
			"message": "timestamp_unix_ms and signature are required",
		})
	}
	runtimePublicKey, err := h.runtimePublicKeyForMachine(ctx, tenantID, req.MachineID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error":   "not_registered",
				"message": "Runtime not found — call /api/v1/runtime/register first",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "deregister_failed",
		})
	}
	if strings.TrimSpace(runtimePublicKey) == "" {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error":   "runtime_unverified",
			"message": "Runtime has no registered public key",
		})
	}
	if err := validateRuntimeTimestamp(req.TimestampUnixMs); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "runtime_signature_invalid",
			"message": err.Error(),
		})
	}
	if err := verifyRuntimeMachineSignature(runtimePublicKey, "runtime_deregister.v1", req); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "runtime_signature_invalid",
			"message": err.Error(),
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

// Download handles GET /api/v1/runtime/download?platform=linux-amd64
// This endpoint uses X-API-Key auth (set by apiKeyAuth middleware).
// It delegates to the same DownloadHandler used by the Clerk-authed endpoint.
func (h *RuntimeHandler) Download(c *fiber.Ctx) error {
	// tenant_id is injected by apiKeyAuth middleware
	tenantID, ok := c.Locals("tenant_id").(string)
	if !ok || tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized",
		})
	}

	platform := c.Query("platform", "")
	if platform == "" {
		platform = "linux-amd64"
	}

	// Normalize platform
	switch platform {
	case "linux-x64":
		platform = "linux-amd64"
	case "darwin-arm64":
		platform = "macos-arm64"
	}

	binaries := map[string]string{
		"linux-amd64": "igris-runtime-linux-x64.tar.gz",
		"linux-arm64": "igris-runtime-linux-arm64.tar.gz",
		"linux-armv7": "igris-runtime-linux-armv7.tar.gz",
		"macos-arm64": "igris-runtime-macos-arm64.tar.gz",
		"macos-x64":   "igris-runtime-macos-x64.tar.gz",
	}

	binaryName, ok := binaries[platform]
	if !ok {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":     "unsupported_platform",
			"message":   "Supported: linux-amd64, linux-arm64, linux-armv7, macos-arm64, macos-x64",
			"supported": []string{"linux-amd64", "linux-arm64", "linux-armv7", "macos-arm64", "macos-x64"},
		})
	}

	version := os.Getenv("RUNTIME_BINARY_VERSION")
	if version == "" {
		version = "latest"
	}

	binariesDir := os.Getenv("RUNTIME_BINARIES_DIR")
	binariesURL := os.Getenv("RUNTIME_BINARIES_URL")

	// Audit log (non-blocking)
	go func() {
		_, _ = h.db.ExecContext(context.Background(), `
			INSERT INTO runtime_downloads (tenant_id, ip_address, runtime_version, platform, user_agent)
			VALUES ($1::uuid, $2, $3, $4, $5)
		`, tenantID, c.IP(), version, platform, c.Get("User-Agent"))
	}()

	// Serve from local filesystem
	if binariesDir != "" {
		binaryPath := filepath.Join(binariesDir, platform, binaryName)
		f, err := os.Open(binaryPath)
		if os.IsNotExist(err) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error":    "binary_not_found",
				"message":  "Runtime binary not available for this platform yet",
				"platform": platform,
			})
		}
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "read_failed"})
		}
		defer f.Close()

		stat, _ := f.Stat()
		c.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, binaryName))
		c.Set("Content-Type", "application/octet-stream")
		if stat != nil {
			c.Set("Content-Length", strconv.FormatInt(stat.Size(), 10))
		}
		c.Set("X-Runtime-Version", version)
		c.Set("X-Runtime-Platform", platform)
		c.Status(http.StatusOK)
		_, err = io.Copy(c.Response().BodyWriter(), f)
		return err
	}

	// Redirect to private URL
	if binariesURL != "" {
		url := fmt.Sprintf("%s/%s/%s", binariesURL, version, binaryName)
		return c.Redirect(url, fiber.StatusFound)
	}

	return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
		"error":   "not_configured",
		"message": "Binary hosting not yet configured on this server. Contact support.",
	})
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

	var tenantID, tenantTier string
	var isActive bool
	err := h.db.QueryRowContext(context.Background(), `
		SELECT tenant_id, COALESCE(tier, 'seed'), COALESCE(is_active, true)
		FROM tenants WHERE api_key_hash = $1
	`, keyHash).Scan(&tenantID, &tenantTier, &isActive)

	// Fallback: dedicated runtime keys (and other named tenant keys) live in
	// tenant_api_keys, separate from the tenant's primary api_key_hash. This
	// stays tenant-scoped — tenant_id is resolved from the matched row.
	if errors.Is(err, sql.ErrNoRows) {
		err = h.db.QueryRowContext(context.Background(), `
			SELECT t.tenant_id, COALESCE(t.tier, 'seed'), COALESCE(t.is_active, true)
			FROM tenant_api_keys k
			JOIN tenants t ON t.tenant_id = k.tenant_id
			WHERE k.key_hash = $1 AND k.status = 'active'
			LIMIT 1
		`, keyHash).Scan(&tenantID, &tenantTier, &isActive)
	}

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
	if !isActive {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "tenant_not_active",
		})
	}

	c.Locals("tenant_id", tenantID)
	c.Locals("tenant_tier", tenantTier)
	return c.Next()
}

// getTierAndLimit looks up tier string and runtime limit for a tenant.
func (h *RuntimeHandler) getTierAndLimit(ctx context.Context, tenantID string) (string, int) {
	var tier string
	_ = h.db.QueryRowContext(ctx, `SELECT COALESCE(tier, 'seed') FROM tenants WHERE tenant_id = $1`, tenantID).Scan(&tier)

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

func nullableJSON(raw json.RawMessage) interface{} {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	return raw
}

func (h *RuntimeHandler) runtimePublicKeyForMachine(ctx context.Context, tenantID, machineID string) (string, error) {
	var publicKey string
	err := h.db.QueryRowContext(ctx, `
		SELECT COALESCE(public_key_ed25519, '')
		FROM runtime_instances
		WHERE tenant_id = $1 AND machine_id = $2
		LIMIT 1
	`, tenantID, machineID).Scan(&publicKey)
	return publicKey, err
}

func verifyRuntimeRegisterSignature(req runtimeInstanceRegisterRequest) error {
	message := fmt.Sprintf(
		"runtime_register.v1:%s:%s:%s:%s:%s:%s:%d",
		req.MachineID,
		req.Hostname,
		req.Platform,
		req.RuntimeVersion,
		req.PublicKeyEd25519,
		req.Endpoint,
		req.TimestampUnixMs,
	)
	return verifyRuntimeSignatureMessage(req.PublicKeyEd25519, req.Signature, message)
}

func verifyRuntimeMachineSignature(publicKeyHex, purpose string, req runtimeInstanceHeartbeatRequest) error {
	message := fmt.Sprintf(
		"%s:%s:%d:%s",
		purpose,
		req.MachineID,
		req.TimestampUnixMs,
		runtimeBtStateHash(req.BtState),
	)
	return verifyRuntimeSignatureMessage(publicKeyHex, req.Signature, message)
}

func verifyRuntimeHeartbeatSignature(publicKeyHex string, req runtimeInstanceHeartbeatRequest) error {
	if len(req.LocalCommandStatuses) > 0 && string(req.LocalCommandStatuses) != "null" {
		statusHash := sha256.Sum256(req.LocalCommandStatuses)
		message := fmt.Sprintf(
			"runtime_heartbeat.v3:%s:%d:%s:%d:%d:%s",
			req.MachineID,
			req.TimestampUnixMs,
			runtimeBtStateHash(req.BtState),
			req.LocalCommandSpoolDepth,
			req.LocalCommandClearGeneration,
			hex.EncodeToString(statusHash[:]),
		)
		if err := verifyRuntimeSignatureMessage(publicKeyHex, req.Signature, message); err == nil {
			return nil
		}
	}
	message := fmt.Sprintf(
		"runtime_heartbeat.v2:%s:%d:%s:%d:%d",
		req.MachineID,
		req.TimestampUnixMs,
		runtimeBtStateHash(req.BtState),
		req.LocalCommandSpoolDepth,
		req.LocalCommandClearGeneration,
	)
	if err := verifyRuntimeSignatureMessage(publicKeyHex, req.Signature, message); err == nil {
		return nil
	}
	return verifyRuntimeMachineSignature(publicKeyHex, "runtime_heartbeat.v1", req)
}

func verifyRuntimeCommandAckSignature(publicKeyHex string, req runtimeCommandAckRequest) error {
	keys := append([]string(nil), req.DeliveryKeys...)
	sort.Strings(keys)
	message := fmt.Sprintf(
		"runtime_commands_ack.v1:%s:%d:%s:%d",
		req.MachineID,
		req.TimestampUnixMs,
		strings.Join(keys, ","),
		req.ExpectedClearGeneration,
	)
	return verifyRuntimeSignatureMessage(publicKeyHex, req.Signature, message)
}

func validateRuntimeTimestamp(timestampUnixMs int64) error {
	requestTime := time.UnixMilli(timestampUnixMs)
	now := time.Now().UTC()
	if requestTime.Before(now.Add(-runtimeRequestTimestampWindow)) || requestTime.After(now.Add(runtimeRequestTimestampWindow)) {
		return fmt.Errorf("runtime request timestamp is outside the accepted window")
	}
	return nil
}

func verifyRuntimeSignatureMessage(publicKeyHex, signatureBase64, message string) error {
	keyBytes, err := hex.DecodeString(strings.TrimSpace(publicKeyHex))
	if err != nil {
		return fmt.Errorf("runtime public key is not valid hex")
	}
	if len(keyBytes) != ed25519.PublicKeySize {
		return fmt.Errorf("runtime public key has invalid length")
	}
	signature, err := base64.StdEncoding.DecodeString(strings.TrimSpace(signatureBase64))
	if err != nil {
		return fmt.Errorf("runtime signature is not valid base64")
	}
	if !ed25519.Verify(ed25519.PublicKey(keyBytes), []byte(message), signature) {
		return fmt.Errorf("runtime signature verification failed")
	}
	return nil
}

func decoratePendingCommandsForDelivery(rawCommands []byte) ([]map[string]interface{}, error) {
	var commands []json.RawMessage
	if len(rawCommands) == 0 {
		return []map[string]interface{}{}, nil
	}
	if err := json.Unmarshal(rawCommands, &commands); err != nil {
		return nil, err
	}

	decorated := make([]map[string]interface{}, 0, len(commands))
	for _, raw := range commands {
		var command map[string]interface{}
		if err := json.Unmarshal(raw, &command); err != nil {
			return nil, err
		}
		deliveryKey, err := runtimeCommandDeliveryKeyFromRaw(raw)
		if err != nil {
			return nil, err
		}
		command["delivery_key"] = deliveryKey
		decorated = append(decorated, command)
	}
	return decorated, nil
}

func runtimeCommandDeliveryKeyFromRaw(raw json.RawMessage) (string, error) {
	var command map[string]interface{}
	if err := json.Unmarshal(raw, &command); err != nil {
		return "", err
	}
	if commandID, ok := command["command_id"].(string); ok && strings.TrimSpace(commandID) != "" {
		return commandID, nil
	}
	canonical, err := json.Marshal(command)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(canonical)
	return hex.EncodeToString(sum[:]), nil
}

func runtimeBtStateHash(raw json.RawMessage) string {
	if len(bytes.TrimSpace(raw)) == 0 || string(bytes.TrimSpace(raw)) == "null" {
		return ""
	}
	var compact bytes.Buffer
	if err := json.Compact(&compact, raw); err != nil {
		trimmed := bytes.TrimSpace(raw)
		sum := sha256.Sum256(trimmed)
		return hex.EncodeToString(sum[:])
	}
	sum := sha256.Sum256(compact.Bytes())
	return hex.EncodeToString(sum[:])
}
