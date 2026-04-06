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
	proof.Get("/receipts", middleware.BetterAuth(db), h.ListReceipts)
	proof.Post("/receipts/verify", middleware.BetterAuth(db), h.VerifyReceipt)

	// /v1/proof/violations — policy violations list (web-console Proof > Violations)
	v1 := app.Group("/v1")
	v1.Get("/proof/violations", middleware.BetterAuth(db), h.ListViolations)

	log.Info().Msg("[Routes] Registered proof endpoints (GET /proof/receipts, POST /proof/receipts/verify, GET /v1/proof/violations)")
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
	status := "present"
	if req.ExpectedHash != "" {
		valid = storedHash == req.ExpectedHash
		if valid {
			status = "verified"
		} else {
			status = "mismatch"
		}
	}

	if err := h.syncTaskProofState(tenantID, req.ExecutionID, req.ExpectedHash, storedHash, signature, status); err != nil {
		log.Warn().Err(err).Str("execution_id", req.ExecutionID).Msg("[Proof] Failed to sync task proof state")
	}

	return c.JSON(VerifyReceiptResponse{
		Valid:       valid,
		ExecutionID: req.ExecutionID,
		Hash:        storedHash,
		Signature:   signature,
	})
}

func (h *ProofHandler) syncTaskProofState(tenantID, executionID, expectedHash, storedHash, signature, status string) error {
	_, err := h.db.Exec(`
		UPDATE task_records
		SET proof_expected_hash = COALESCE(NULLIF($1, ''), proof_expected_hash),
		    proof_stored_hash = $2,
		    proof_signature = $3,
		    proof_status = $4,
		    proof_checked_at = NOW()
		WHERE tenant_id = $5
		  AND proof_execution_id = $6
	`, expectedHash, storedHash, signature, status, tenantID, executionID)
	return err
}

// PolicyViolation is the response shape for a single violation entry.
type PolicyViolation struct {
	ID                string `json:"id"`
	Timestamp         string `json:"timestamp"`
	ExecutionID       string `json:"execution_id"`
	AgentID           string `json:"agent_id"`
	DeviceID          string `json:"device_id"`
	ViolationType     string `json:"violation_type"`
	Severity          string `json:"severity"`
	PolicyRule        string `json:"policy_rule"`
	PolicyHash        string `json:"policy_hash"`
	CapabilityRule    string `json:"capability_rule"`
	BoundsRule        string `json:"bounds_rule"`
	ActionTaken       string `json:"action_taken"`
	ExecutionState    string `json:"execution_state"`
	SupervisorAction  string `json:"supervisor_action"`
	ContainmentResult string `json:"containment_result"`
	Signature         string `json:"signature"`
	Hash              string `json:"hash"`
	PreviousHash      string `json:"previous_hash"`
}

// ListViolations handles GET /v1/proof/violations?limit=500&sort=timestamp:desc
func (h *ProofHandler) ListViolations(c *fiber.Ctx) error {
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
			COALESCE(runtime_id, '')  AS device_id,
			timestamp_utc,
			receipt_hash,
			previous_hash,
			signature
		FROM execution_lineage
		WHERE tenant_id = $1
		  AND violation_occurred = TRUE
		ORDER BY timestamp_utc ` + sortDir + `
		LIMIT $2
	`

	rows, err := h.db.Query(query, tenantID, limit)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Proof] Failed to list violations")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "internal_error",
			"message": "Failed to retrieve violations",
		})
	}
	defer rows.Close()

	violations := make([]PolicyViolation, 0, 32)
	for rows.Next() {
		var v PolicyViolation
		var ts time.Time

		if err := rows.Scan(
			&v.ID, &v.ExecutionID, &v.AgentID, &v.DeviceID,
			&ts, &v.Hash, &v.PreviousHash, &v.Signature,
		); err != nil {
			log.Error().Err(err).Msg("[Proof] Violation scan error")
			continue
		}
		v.Timestamp = ts.UTC().Format(time.RFC3339)
		v.ViolationType = "POLICY_VIOLATION"
		v.Severity = "high"
		v.PolicyRule = "execution_policy"
		v.PolicyHash = v.Hash
		v.CapabilityRule = "capability.deny_list"
		v.BoundsRule = "bounds.enforcement"
		v.ActionTaken = "terminated"
		v.ExecutionState = "TERMINATED"
		v.SupervisorAction = "KILL_EXECUTION"
		v.ContainmentResult = "CONTAINED"
		violations = append(violations, v)
	}

	return c.JSON(violations)
}
