// Package api provides proof receipt listing and verification routes.
package api

import (
	"database/sql"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// ProofHandler handles proof receipt API requests.
type ProofHandler struct {
	db *sql.DB
}

// NewProofHandler creates a new proof handler.
func NewProofHandler(db *sql.DB) *ProofHandler {
	return &ProofHandler{db: db}
}

// RegisterProofRoutes registers proof receipt endpoints.
func RegisterProofRoutes(app *fiber.App, db *sql.DB, _ *middleware.TenantAuth) {
	if db == nil {
		log.Warn().Msg("[Routes] Proof endpoints disabled — database not available")
		return
	}

	h := NewProofHandler(db)

	// Use unprefixed /proof group to match web-console calls
	proof := app.Group("/proof")
	proof.Get("/receipts", middleware.ClerkAuth(), h.ListReceipts)
	proof.Post("/receipts/verify", middleware.ClerkAuth(), h.VerifyReceipt)

	log.Info().Msg("[Routes] Registered proof endpoints (GET /proof/receipts, POST /proof/receipts/verify)")
}

// ProofReceipt is the response shape for a single receipt row.
type ProofReceipt struct {
	ID           string    `json:"id"`
	ExecutionID  string    `json:"execution_id"`
	AgentID      string    `json:"agent_id"`
	DeviceID     string    `json:"device_id"`
	Timestamp    time.Time `json:"timestamp"`
	StartTime    time.Time `json:"start_time"`
	EndTime      time.Time `json:"end_time"`
	Status       string    `json:"status"`
	Signature    string    `json:"signature"`
	Hash         string    `json:"hash"`
	PrevHash     string    `json:"prev_hash"`
	HasViolation bool      `json:"has_violation"`
	Signed       bool      `json:"signed"`
	CpuMs        int64     `json:"cpu_ms"`
	MemoryMb     int64     `json:"memory_mb"`
	TokensUsed   int       `json:"tokens_used"`
	ToolCalls    int       `json:"tool_calls"`
	DurationMs   int64     `json:"duration_ms"`
	Violations   []string  `json:"violations"`
}

// ListReceipts handles GET /proof/receipts?limit=500&sort=timestamp:desc
func (h *ProofHandler) ListReceipts(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	limit := 500
	if raw := c.Query("limit", ""); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	if limit > 1000 {
		limit = 1000
	}

	sortDir := "DESC"
	if raw := c.Query("sort", ""); raw != "" {
		parts := strings.SplitN(raw, ":", 2)
		if len(parts) == 2 && strings.EqualFold(parts[1], "asc") {
			sortDir = "ASC"
		}
	}

	query := `
		SELECT
			id,
			execution_id,
			agent_id,
			COALESCE(runtime_id, '')   AS device_id,
			timestamp_utc,
			receipt_hash,
			previous_hash,
			signature,
			cpu_time_ms,
			memory_peak_mb,
			tool_calls,
			wall_time_ms,
			violation_occurred
		FROM execution_lineage
		WHERE tenant_id = $1
		ORDER BY timestamp_utc ` + sortDir + `
		LIMIT $2
	`

	rows, err := h.db.Query(query, tenantID, limit)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Proof] Failed to list receipts")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "internal_error",
			"message": "Failed to retrieve receipts",
		})
	}
	defer rows.Close()

	receipts := make([]ProofReceipt, 0, limit)
	for rows.Next() {
		var r ProofReceipt
		var violOccurred bool

		if err := rows.Scan(
			&r.ID,
			&r.ExecutionID,
			&r.AgentID,
			&r.DeviceID,
			&r.Timestamp,
			&r.Hash,
			&r.PrevHash,
			&r.Signature,
			&r.CpuMs,
			&r.MemoryMb,
			&r.ToolCalls,
			&r.DurationMs,
			&violOccurred,
		); err != nil {
			log.Error().Err(err).Msg("[Proof] Scan error")
			continue
		}

		r.HasViolation = violOccurred
		r.Signed = r.Signature != ""
		r.StartTime = r.Timestamp
		r.EndTime = r.Timestamp.Add(time.Duration(r.DurationMs) * time.Millisecond)
		if violOccurred {
			r.Status = "violation"
			r.Violations = []string{"policy_violation"}
		} else {
			r.Status = "verified"
			r.Violations = []string{}
		}
		// TokensUsed is not stored in execution_lineage; default to 0.
		r.TokensUsed = 0

		receipts = append(receipts, r)
	}

	return c.JSON(receipts)
}

// VerifyReceiptRequest is the body for POST /proof/receipts/verify.
type VerifyReceiptRequest struct {
	ExecutionID  string `json:"execution_id"`
	ExpectedHash string `json:"expected_hash"`
}

// VerifyReceiptResponse is the response for POST /proof/receipts/verify.
type VerifyReceiptResponse struct {
	Valid       bool   `json:"valid"`
	ExecutionID string `json:"execution_id"`
	Hash        string `json:"hash"`
	Signature   string `json:"signature"`
}

// VerifyReceipt handles POST /proof/receipts/verify.
func (h *ProofHandler) VerifyReceipt(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	var req VerifyReceiptRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid_request",
			"message": "Failed to parse request body",
		})
	}

	if req.ExecutionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_fields",
			"message": "execution_id is required",
		})
	}

	var storedHash, signature string
	err := h.db.QueryRow(`
		SELECT receipt_hash, signature
		FROM execution_lineage
		WHERE execution_id = $1
		  AND (tenant_id = $2 OR tenant_id IS NULL)
	`, req.ExecutionID, tenantID).Scan(&storedHash, &signature)

	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "not_found",
			"message": "Execution receipt not found",
		})
	}
	if err != nil {
		log.Error().Err(err).Str("execution_id", req.ExecutionID).Msg("[Proof] Verify query failed")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "internal_error",
			"message": "Failed to verify receipt",
		})
	}

	valid := true
	if req.ExpectedHash != "" {
		valid = storedHash == req.ExpectedHash
	}

	return c.JSON(VerifyReceiptResponse{
		Valid:       valid,
		ExecutionID: req.ExecutionID,
		Hash:        storedHash,
		Signature:   signature,
	})
}
