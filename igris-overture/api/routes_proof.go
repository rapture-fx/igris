// Package api provides proof receipt listing and verification routes.
package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/internal"
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
	ID                 string                   `json:"id"`
	ExecutionID        string                   `json:"execution_id"`
	AgentID            string                   `json:"agent_id"`
	DeviceID           string                   `json:"device_id"`
	RuntimeID          string                   `json:"runtime_id,omitempty"`
	RuntimeLabel       string                   `json:"runtime_label,omitempty"`
	Timestamp          time.Time                `json:"timestamp"`
	StartTime          time.Time                `json:"start_time"`
	EndTime            time.Time                `json:"end_time"`
	Status             string                   `json:"status"`
	VerificationStatus string                   `json:"verification_status"`
	Signature          string                   `json:"signature"`
	Hash               string                   `json:"hash"`
	PrevHash           string                   `json:"prev_hash"`
	HasViolation       bool                     `json:"has_violation"`
	Signed             bool                     `json:"signed"`
	CpuMs              int64                    `json:"cpu_ms"`
	MemoryMb           int64                    `json:"memory_mb"`
	TokensUsed         int                      `json:"tokens_used"`
	ToolCalls          int                      `json:"tool_calls"`
	DurationMs         int64                    `json:"duration_ms"`
	Violations         []ReceiptViolationRecord `json:"violations"`
}

// ListReceipts handles GET /proof/receipts?limit=500&sort=timestamp:desc
func (h *ProofHandler) ListReceipts(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	schemaCaps, err := detectExecutionSchemaCapabilities(c.Context(), h.db)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Proof] Failed to inspect schema capabilities")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "internal_error",
			"message": "Failed to retrieve receipts",
		})
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
			el.id,
			el.execution_id,
			el.agent_id,
			COALESCE(NULLIF(el.runtime_id, ''), NULLIF(ec.runtime_id, ''), '') AS runtime_id,
			COALESCE(ec.runtime_label, '') AS runtime_label,
			el.timestamp_utc,
			COALESCE(el.receipt_hash, '') AS receipt_hash,
			COALESCE(el.previous_hash, '') AS previous_hash,
			COALESCE(el.signature, '') AS signature,
			COALESCE(el.cpu_time_ms, 0) AS cpu_time_ms,
			COALESCE(el.memory_peak_mb, 0) AS memory_peak_mb,
			COALESCE(el.tool_calls, 0) AS tool_calls,
			COALESCE(el.wall_time_ms, 0) AS wall_time_ms,
			COALESCE(el.violation_occurred, false) AS violation_occurred,
			COALESCE(NULLIF(tp.proof_status, ''), NULLIF(ec.verification_status, ''), '') AS proof_status,
			%s
		FROM execution_lineage el
		LEFT JOIN execution_context ec
		       ON ec.execution_id = el.execution_id
		      AND ec.tenant_id = el.tenant_id
		%s
		WHERE el.tenant_id = $1
		ORDER BY el.timestamp_utc ` + sortDir + `
		LIMIT $2
	`

	query = fmt.Sprintf(
		query,
		executionLineageViolationDetailsSQL(schemaCaps.lineageViolationDetail, "el"),
		executionTaskProofLookupJoinSQL(schemaCaps.taskProofLookup, "el"),
	)

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
		var proofStatus string
		var violationDetails []byte

		if err := rows.Scan(
			&r.ID,
			&r.ExecutionID,
			&r.AgentID,
			&r.RuntimeID,
			&r.RuntimeLabel,
			&r.Timestamp,
			&r.Hash,
			&r.PrevHash,
			&r.Signature,
			&r.CpuMs,
			&r.MemoryMb,
			&r.ToolCalls,
			&r.DurationMs,
			&violOccurred,
			&proofStatus,
			&violationDetails,
		); err != nil {
			log.Error().Err(err).Msg("[Proof] Scan error")
			continue
		}

		r.HasViolation = violOccurred
		r.DeviceID = r.RuntimeID
		r.Signed = r.Signature != ""
		r.StartTime = r.Timestamp
		r.EndTime = r.Timestamp.Add(time.Duration(r.DurationMs) * time.Millisecond)
		r.VerificationStatus = receiptVerificationStatus(proofStatus, r.Hash)
		r.Status = receiptVerificationBadgeStatus(r.VerificationStatus)
		if violOccurred {
			r.Violations = []ReceiptViolationRecord{
				buildReceiptViolationRecord(r.Timestamp, violationDetails),
			}
		} else {
			r.Violations = []ReceiptViolationRecord{}
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
	Hash         string `json:"hash"`
	Signature    string `json:"signature"`
}

// VerifyReceiptResponse is the response for POST /proof/receipts/verify.
//
// Verified is true only when fresh cryptographic verification succeeded:
// the canonical hash re-derived from stored receipt columns matches the
// stored hash AND the Ed25519 signature verifies against a known runtime
// public key. Stored-value comparison alone is not sufficient.
type VerifyReceiptResponse struct {
	Verified           bool   `json:"verified"`
	Valid              bool   `json:"valid"`
	ExecutionID        string `json:"execution_id"`
	ReceiptID          string `json:"receipt_id"`
	RuntimeID          string `json:"runtime_id,omitempty"`
	RuntimeLabel       string `json:"runtime_label,omitempty"`
	Hash               string `json:"hash"`
	Signature          string `json:"signature"`
	VerificationStatus string `json:"verification_status"`
	HashValid          *bool  `json:"hash_valid,omitempty"`
	SignatureMatches   *bool  `json:"signature_matches,omitempty"`
	ChainValid         *bool  `json:"chain_valid,omitempty"`
	RuntimeKeyFound    *bool  `json:"runtime_key_found,omitempty"`
	Message            string `json:"message"`
}

// VerifyReceipt handles POST /proof/receipts/verify.
func (h *ProofHandler) VerifyReceipt(c *fiber.Ctx) error {
	tenantID := middleware.GetClerkUserID(c)
	if tenantID == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
	}

	schemaCaps, err := detectExecutionSchemaCapabilities(c.Context(), h.db)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("[Proof] Failed to inspect schema capabilities")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "internal_error",
			"message": "Failed to verify receipt",
		})
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

	comparisonHash := expectedHashFromVerifyRequest(req)

	row, err := h.fetchReceiptVerifyRow(c.Context(), req.ExecutionID, tenantID, schemaCaps)
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

	// Pick a runtime public key: registry entry first, env var fallback.
	publicKeyHex := strings.TrimSpace(row.runtimePublicKey)
	if publicKeyHex == "" {
		publicKeyHex = strings.TrimSpace(os.Getenv("IGRIS_RUNTIME_PUBLIC_KEY"))
	}

	// Reconstruct the canonical receipt from stored execution_lineage columns.
	receipt := buildReceiptForVerification(row)

	// Fresh cryptographic verification: canonical hash + Ed25519 signature.
	cryptoResult := internal.VerifyReceiptCryptographic(receipt, publicKeyHex)

	// Surface stored-value comparison fields for back-compat (consumed by
	// scripts and the console) but do not let them set verified=true on
	// their own.
	var (
		hashValid        *bool
		signatureMatches *bool
	)
	if cryptoResult.RuntimeKeyFound {
		// Once we have a key, hash and signature checks are the cryptographic
		// outcomes — not stored-value comparisons.
		hv := cryptoResult.HashValid
		sm := cryptoResult.SignatureValid
		hashValid = &hv
		signatureMatches = &sm
	} else {
		// No runtime key: still report stored-value matches if the request
		// supplied them, but verified will be false because we cannot
		// cryptographically verify.
		if comparisonHash != "" {
			match := row.storedHash != "" && row.storedHash == comparisonHash
			hashValid = &match
		}
		if req.Signature != "" {
			match := row.storedSignature != "" && row.storedSignature == req.Signature
			signatureMatches = &match
		}
	}
	runtimeKeyFound := cryptoResult.RuntimeKeyFound

	verified := cryptoResult.Verified()
	verificationStatus := cryptographicVerificationStatus(cryptoResult, row.proofStatus, row.storedHash)

	// Chain-link verification: the previous_hash in the current receipt must
	// reference a prior receipt whose canonical re-derivation still equals
	// that pointer. This is independent of cryptographic verification of the
	// current receipt — a row can verify cryptographically while still having
	// a broken chain pointer (e.g. orphaned after a rollback).
	chainOutcome := h.verifyReceiptChainLink(c.Context(), tenantID, row.previousHash)
	chainValid := chainOutcome.Valid

	message := buildCryptographicReceiptVerificationMessage(cryptoResult, hashValid, signatureMatches)
	if chainOutcome.Checked && !chainOutcome.Valid {
		message = message + " Chain link: " + chainOutcome.Reason + "."
	}

	if err := coordinator.NewCheckpointStore(h.db).UpdateTaskProofStateByExecutionID(tenantID, req.ExecutionID, comparisonHash, row.storedHash, row.storedSignature); err != nil {
		log.Warn().Err(err).Str("execution_id", req.ExecutionID).Msg("[Proof] Failed to sync task proof state")
	}

	return c.JSON(VerifyReceiptResponse{
		Verified:           verified,
		Valid:              verified,
		ExecutionID:        req.ExecutionID,
		ReceiptID:          row.receiptID,
		RuntimeID:          row.runtimeID,
		RuntimeLabel:       row.runtimeLabel,
		Hash:               row.storedHash,
		Signature:          row.storedSignature,
		VerificationStatus: verificationStatus,
		HashValid:          hashValid,
		SignatureMatches:   signatureMatches,
		ChainValid:         &chainValid,
		RuntimeKeyFound:    &runtimeKeyFound,
		Message:            message,
	})
}

// receiptVerifyRow holds every stored execution_lineage column needed to
// re-derive the canonical receipt JSON, plus the runtime's registered public
// key. Each text field is COALESCE'd to ” in SQL so a sparse row never
// causes a NULL-scan failure.
type receiptVerifyRow struct {
	receiptID         string
	executionID       string
	agentID           string
	runtimeID         string
	runtimeLabel      string
	transactionID     string
	transactionHash   string
	cpuTimeMs         int64
	wallTimeMs        int64
	memoryPeakMb      int64
	fsBytesWritten    int64
	toolCalls         int64
	violationOccurred bool
	storedHash        string
	previousHash      string
	storedSignature   string
	timestampUTC      time.Time
	runtimePublicKey  string
	proofStatus       string
}

func (h *ProofHandler) fetchReceiptVerifyRow(ctx context.Context, executionID, tenantID string, schemaCaps executionSchemaCapabilities) (*receiptVerifyRow, error) {
	query := `
		SELECT el.id::text,
		       el.execution_id,
		       COALESCE(el.agent_id, '') AS agent_id,
		       COALESCE(NULLIF(el.runtime_id, ''), NULLIF(ec.runtime_id, ''), '') AS runtime_id,
		       COALESCE(ec.runtime_label, '') AS runtime_label,
		       COALESCE(el.transaction_id, '') AS transaction_id,
		       COALESCE(el.transaction_hash, '') AS transaction_hash,
		       COALESCE(el.cpu_time_ms, 0) AS cpu_time_ms,
		       COALESCE(el.wall_time_ms, 0) AS wall_time_ms,
		       COALESCE(el.memory_peak_mb, 0) AS memory_peak_mb,
		       COALESCE(el.fs_bytes_written, 0) AS fs_bytes_written,
		       COALESCE(el.tool_calls, 0) AS tool_calls,
		       COALESCE(el.violation_occurred, false) AS violation_occurred,
		       COALESCE(el.receipt_hash, '') AS receipt_hash,
		       COALESCE(el.previous_hash, '') AS previous_hash,
		       COALESCE(el.signature, '') AS signature,
		       el.timestamp_utc,
		       COALESCE(ri.public_key_ed25519, '') AS runtime_public_key,
		       COALESCE(NULLIF(tp.proof_status, ''), NULLIF(ec.verification_status, ''), '') AS proof_status
		FROM execution_lineage el
		LEFT JOIN execution_context ec
		       ON ec.execution_id = el.execution_id
		      AND ec.tenant_id = el.tenant_id
		LEFT JOIN runtime_instances ri
		       ON ri.runtime_id::text = COALESCE(NULLIF(el.runtime_id, ''), NULLIF(ec.runtime_id, ''))
		%s
		WHERE el.execution_id = $1
		  AND el.tenant_id = $2
	`
	query = fmt.Sprintf(query, executionTaskProofLookupJoinSQL(schemaCaps.taskProofLookup, "el"))

	row := &receiptVerifyRow{}
	err := h.db.QueryRowContext(ctx, query, executionID, tenantID).Scan(
		&row.receiptID,
		&row.executionID,
		&row.agentID,
		&row.runtimeID,
		&row.runtimeLabel,
		&row.transactionID,
		&row.transactionHash,
		&row.cpuTimeMs,
		&row.wallTimeMs,
		&row.memoryPeakMb,
		&row.fsBytesWritten,
		&row.toolCalls,
		&row.violationOccurred,
		&row.storedHash,
		&row.previousHash,
		&row.storedSignature,
		&row.timestampUTC,
		&row.runtimePublicKey,
		&row.proofStatus,
	)
	if err != nil {
		return nil, err
	}
	return row, nil
}

// chainLinkOutcome captures whether the current receipt's previous_hash
// pointer references a real, intact prior receipt for the same tenant.
//
// Empty previous_hash is treated as a genesis receipt and reported as Valid
// (with a clear reason). When a prior row exists but its canonical
// re-derivation does not match the pointer, Valid is false — that case
// indicates tampering or backfill-induced drift, not a missing chain.
type chainLinkOutcome struct {
	Valid             bool
	Checked           bool
	PriorReceiptID    string
	PriorReceiptHash  string
	PreviousHash      string
	ComputedPriorHash string
	Reason            string
}

// verifyReceiptChainLink resolves the prior receipt referenced by
// previousHash for the given tenant and verifies that the prior receipt's
// canonical SHA-256 still equals previousHash. Returns 200-shaped outcomes
// even when the prior row is missing or malformed; never bubbles errors up
// to a 500 unless the database itself is unhealthy.
func (h *ProofHandler) verifyReceiptChainLink(ctx context.Context, tenantID, previousHash string) chainLinkOutcome {
	return verifyReceiptChainLinkWithDB(ctx, h.db, tenantID, previousHash)
}

// verifyReceiptChainLinkWithDB is the database-only entry point used by both
// /proof/receipts/verify and /v1/tasks/:id/proof/verify. Splitting it from
// the handler method lets the task path reuse exactly the same chain
// semantics without recreating a ProofHandler.
func verifyReceiptChainLinkWithDB(ctx context.Context, db *sql.DB, tenantID, previousHash string) chainLinkOutcome {
	out := chainLinkOutcome{PreviousHash: previousHash, Checked: true}
	if strings.TrimSpace(previousHash) == "" {
		out.Valid = true
		out.Reason = "genesis receipt: no prior link to verify"
		return out
	}
	if db == nil {
		out.Reason = "database not available for chain lookup"
		return out
	}

	prior, err := fetchReceiptForChain(ctx, db, tenantID, previousHash)
	if err == sql.ErrNoRows {
		out.Reason = "no prior receipt found for previous_hash"
		return out
	}
	if err != nil {
		out.Reason = "prior receipt lookup failed: " + err.Error()
		return out
	}
	out.PriorReceiptID = prior.receiptID
	out.PriorReceiptHash = prior.storedHash

	priorReceipt := buildReceiptForVerification(prior)
	computed, err := internal.ComputeCanonicalReceiptHash(priorReceipt)
	if err != nil {
		out.Reason = "prior receipt canonical hash failed: " + err.Error()
		return out
	}
	out.ComputedPriorHash = computed

	if computed != previousHash {
		out.Reason = "prior receipt canonical hash does not match previous_hash pointer"
		return out
	}
	if prior.storedHash != "" && prior.storedHash != previousHash {
		out.Reason = "prior receipt stored hash does not match previous_hash pointer"
		return out
	}

	out.Valid = true
	out.Reason = "prior receipt re-derives to previous_hash"
	return out
}

// fetchReceiptForChain returns the canonical-receipt fields for the prior
// row whose receipt_hash equals previousHash. Tenant-scoped to prevent
// cross-tenant chain leakage.
func fetchReceiptForChain(ctx context.Context, db *sql.DB, tenantID, previousHash string) (*receiptVerifyRow, error) {
	row := &receiptVerifyRow{}
	err := db.QueryRowContext(ctx, `
		SELECT el.id::text,
		       el.execution_id,
		       COALESCE(el.agent_id, '') AS agent_id,
		       COALESCE(el.runtime_id, '') AS runtime_id,
		       '' AS runtime_label,
		       COALESCE(el.transaction_id, '') AS transaction_id,
		       COALESCE(el.transaction_hash, '') AS transaction_hash,
		       COALESCE(el.cpu_time_ms, 0) AS cpu_time_ms,
		       COALESCE(el.wall_time_ms, 0) AS wall_time_ms,
		       COALESCE(el.memory_peak_mb, 0) AS memory_peak_mb,
		       COALESCE(el.fs_bytes_written, 0) AS fs_bytes_written,
		       COALESCE(el.tool_calls, 0) AS tool_calls,
		       COALESCE(el.violation_occurred, false) AS violation_occurred,
		       COALESCE(el.receipt_hash, '') AS receipt_hash,
		       COALESCE(el.previous_hash, '') AS previous_hash,
		       COALESCE(el.signature, '') AS signature,
		       el.timestamp_utc,
		       '' AS runtime_public_key,
		       '' AS proof_status
		FROM execution_lineage el
		WHERE el.receipt_hash = $1
		  AND el.tenant_id = $2
		LIMIT 1
	`, previousHash, tenantID).Scan(
		&row.receiptID,
		&row.executionID,
		&row.agentID,
		&row.runtimeID,
		&row.runtimeLabel,
		&row.transactionID,
		&row.transactionHash,
		&row.cpuTimeMs,
		&row.wallTimeMs,
		&row.memoryPeakMb,
		&row.fsBytesWritten,
		&row.toolCalls,
		&row.violationOccurred,
		&row.storedHash,
		&row.previousHash,
		&row.storedSignature,
		&row.timestampUTC,
		&row.runtimePublicKey,
		&row.proofStatus,
	)
	if err != nil {
		return nil, err
	}
	return row, nil
}

// buildReceiptForVerification reconstructs the canonical receipt map from the
// stored execution_lineage columns. The map keys, types, and conditional
// inclusion rules MUST match the runtime's BTreeMap construction in
// igris-runtime/crates/igris-server/src/receipt.rs.
func buildReceiptForVerification(row *receiptVerifyRow) map[string]interface{} {
	if row == nil {
		return nil
	}
	receipt := map[string]interface{}{
		"execution_id":       row.executionID,
		"agent_id":           row.agentID,
		"cpu_time_ms":        row.cpuTimeMs,
		"wall_time_ms":       row.wallTimeMs,
		"memory_peak_mb":     row.memoryPeakMb,
		"fs_bytes_written":   row.fsBytesWritten,
		"tool_calls":         row.toolCalls,
		"violation_occurred": row.violationOccurred,
		"timestamp_utc":      row.timestampUTC.UTC().Format(time.RFC3339Nano),
		"previous_hash":      row.previousHash,
		"hash":               row.storedHash,
		"signature":          row.storedSignature,
	}
	if row.runtimeID != "" {
		receipt["runtime_id"] = row.runtimeID
	}
	if row.transactionID != "" {
		receipt["transaction_id"] = row.transactionID
	}
	if row.transactionHash != "" {
		receipt["transaction_hash"] = row.transactionHash
	}
	return receipt
}

type ReceiptViolationRecord struct {
	Timestamp     string   `json:"timestamp"`
	ViolationType string   `json:"violation_type"`
	PolicyRule    string   `json:"policy_rule,omitempty"`
	ActionTaken   string   `json:"action_taken,omitempty"`
	Severity      string   `json:"severity,omitempty"`
	LimitValue    *float64 `json:"limit_value,omitempty"`
	ObservedValue *float64 `json:"observed_value,omitempty"`
}

// PolicyViolation is the response shape for a single violation entry.
type PolicyViolation struct {
	ID                string         `json:"id"`
	Timestamp         string         `json:"timestamp"`
	ExecutionID       string         `json:"execution_id"`
	AgentID           string         `json:"agent_id"`
	DeviceID          string         `json:"device_id"`
	Status            string         `json:"status"`
	ViolationType     string         `json:"violation_type,omitempty"`
	Severity          string         `json:"severity,omitempty"`
	PolicyRule        string         `json:"policy_rule,omitempty"`
	PolicyHash        string         `json:"policy_hash,omitempty"`
	CapabilityRule    string         `json:"capability_rule,omitempty"`
	BoundsRule        string         `json:"bounds_rule,omitempty"`
	ActionTaken       string         `json:"action_taken,omitempty"`
	ExecutionState    string         `json:"execution_state,omitempty"`
	SupervisorAction  string         `json:"supervisor_action,omitempty"`
	ContainmentResult string         `json:"containment_result,omitempty"`
	Signature         string         `json:"signature"`
	Hash              string         `json:"hash"`
	PreviousHash      string         `json:"previous_hash"`
	LimitValue        *float64       `json:"limit_value,omitempty"`
	ObservedValue     *float64       `json:"observed_value,omitempty"`
	Details           map[string]any `json:"details,omitempty"`
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

	rangeParam := c.Query("range", "")
	intervalFilter := ""
	if rangeParam != "" {
		intervalFilter = " AND timestamp_utc >= NOW() - INTERVAL '" + rangeToInterval(rangeParam) + "'"
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
			signature,
			COALESCE(status, CASE WHEN violation_occurred THEN 'VIOLATION' ELSE 'COMPLETED' END) AS status,
			violation_details
		FROM execution_lineage
		WHERE tenant_id = $1
		  AND violation_occurred = TRUE
		  ` + intervalFilter + `
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
		var status string
		var violationDetails []byte

		if err := rows.Scan(
			&v.ID, &v.ExecutionID, &v.AgentID, &v.DeviceID,
			&ts, &v.Hash, &v.PreviousHash, &v.Signature, &status, &violationDetails,
		); err != nil {
			log.Error().Err(err).Msg("[Proof] Violation scan error")
			continue
		}
		violations = append(violations, buildPolicyViolation(v, ts, status, violationDetails))
	}

	return c.JSON(violations)
}

type policyViolationMetadata struct {
	ViolationType     string
	Severity          string
	PolicyRule        string
	CapabilityRule    string
	BoundsRule        string
	ActionTaken       string
	ExecutionState    string
	SupervisorAction  string
	ContainmentResult string
	LimitValue        *float64
	ObservedValue     *float64
	Details           map[string]any
}

func expectedHashFromVerifyRequest(req VerifyReceiptRequest) string {
	if req.ExpectedHash != "" {
		return req.ExpectedHash
	}
	return req.Hash
}

// cryptographicVerificationStatus returns "verified" when fresh
// cryptographic verification succeeded. When the runtime key was missing or
// crypto checks failed, it falls back to the stored proof_status (if any)
// or "present"/"missing" derived from the stored receipt hash. We never
// upgrade an unverified row to "verified".
func cryptographicVerificationStatus(result internal.ReceiptVerificationResult, proofStatus, storedHash string) string {
	if result.Verified() {
		return "verified"
	}
	if result.RuntimeKeyFound && result.ReceiptPresent && result.SignaturePresent {
		// We had everything to verify and it failed cryptographically.
		return "mismatch"
	}
	return receiptVerificationStatus(proofStatus, storedHash)
}

// buildCryptographicReceiptVerificationMessage produces a human-readable
// message that explains the verification outcome. It distinguishes between
// "no key available" (operator action: configure registry/env), "hash
// mismatch" (tampering/corruption), "signature mismatch" (forgery), and the
// success case.
func buildCryptographicReceiptVerificationMessage(result internal.ReceiptVerificationResult, hashValid, signatureMatches *bool) string {
	if result.Verified() {
		return "Receipt cryptographically verified: canonical hash and Ed25519 signature both match the registered runtime public key."
	}
	if !result.ReceiptPresent {
		return "No receipt was available for cryptographic verification."
	}
	if !result.RuntimeKeyFound {
		// Fall back to the legacy stored-value message so callers still see
		// some signal, but make clear verified=false until a key is found.
		stored := buildReceiptVerificationMessage(hashValid, signatureMatches)
		return "Runtime public key not found — cryptographic verification skipped. " + stored
	}
	if !result.SignaturePresent {
		return "Receipt has no signature; cryptographic verification cannot proceed."
	}
	if !result.SignatureValid {
		return "Receipt Ed25519 signature did not verify against the registered runtime public key."
	}
	if !result.HashValid {
		return "Receipt hash does not match the canonical re-computation; receipt has been altered or rebuilt."
	}
	if result.Reason != "" {
		return result.Reason
	}
	return "Cryptographic verification failed."
}

func buildReceiptVerificationMessage(hashValid *bool, signatureMatches *bool) string {
	switch {
	case hashValid != nil && signatureMatches != nil:
		if *hashValid && *signatureMatches {
			return "Stored receipt hash and signature matched the submitted values. This endpoint does not perform cryptographic signature validation."
		}
		return "Stored receipt values did not match the submitted hash or signature."
	case hashValid != nil:
		if *hashValid {
			return "Stored receipt hash matched the submitted expected hash."
		}
		return "Stored receipt hash did not match the submitted expected hash."
	case signatureMatches != nil:
		if *signatureMatches {
			return "Stored receipt signature matched the submitted signature value. This endpoint does not perform cryptographic signature validation."
		}
		return "Stored receipt signature did not match the submitted signature value."
	default:
		return "Receipt record was found, but no comparison fields were supplied, so no verification checks were performed."
	}
}

func receiptVerificationStatus(proofStatus, receiptHash string) string {
	normalized := strings.ToLower(strings.TrimSpace(proofStatus))
	if normalized != "" {
		return normalized
	}
	if receiptHash == "" {
		return "missing"
	}
	return "present"
}

func receiptVerificationBadgeStatus(verificationStatus string) string {
	switch strings.ToLower(strings.TrimSpace(verificationStatus)) {
	case "verified":
		return "verified"
	case "mismatch":
		return "failed"
	default:
		return "unverified"
	}
}

func buildReceiptViolationRecord(ts time.Time, rawDetails []byte) ReceiptViolationRecord {
	meta := parsePolicyViolationDetails(rawDetails)
	record := ReceiptViolationRecord{
		Timestamp:     ts.UTC().Format(time.RFC3339),
		ViolationType: meta.ViolationType,
		PolicyRule:    meta.PolicyRule,
		ActionTaken:   meta.ActionTaken,
		Severity:      meta.Severity,
		LimitValue:    meta.LimitValue,
		ObservedValue: meta.ObservedValue,
	}
	if record.ViolationType == "" {
		record.ViolationType = "violation_recorded"
	}
	return record
}

func buildPolicyViolation(v PolicyViolation, ts time.Time, status string, rawDetails []byte) PolicyViolation {
	meta := parsePolicyViolationDetails(rawDetails)
	v.Timestamp = ts.UTC().Format(time.RFC3339)
	v.Status = strings.ToUpper(strings.TrimSpace(status))
	v.PolicyHash = v.Hash
	v.ViolationType = meta.ViolationType
	v.Severity = meta.Severity
	v.PolicyRule = meta.PolicyRule
	v.CapabilityRule = meta.CapabilityRule
	v.BoundsRule = meta.BoundsRule
	v.ActionTaken = meta.ActionTaken
	if meta.ExecutionState != "" {
		v.ExecutionState = meta.ExecutionState
	} else {
		v.ExecutionState = v.Status
	}
	v.SupervisorAction = meta.SupervisorAction
	v.ContainmentResult = meta.ContainmentResult
	v.LimitValue = meta.LimitValue
	v.ObservedValue = meta.ObservedValue
	v.Details = meta.Details
	return v
}

func parsePolicyViolationDetails(raw []byte) policyViolationMetadata {
	meta := policyViolationMetadata{}
	if len(raw) == 0 || string(raw) == "null" {
		return meta
	}

	var details map[string]any
	if err := json.Unmarshal(raw, &details); err != nil {
		return meta
	}

	meta.Details = details
	meta.ViolationType = firstDetailString(details, "violation_type", "type", "kind")
	meta.Severity = firstDetailString(details, "severity")
	meta.PolicyRule = firstDetailString(details, "policy_rule")
	meta.CapabilityRule = firstDetailString(details, "capability_rule")
	meta.BoundsRule = firstDetailString(details, "bounds_rule", "bound_violated")
	meta.ActionTaken = firstDetailString(details, "action_taken")
	meta.ExecutionState = firstDetailString(details, "execution_state")
	meta.SupervisorAction = firstDetailString(details, "supervisor_action")
	meta.ContainmentResult = firstDetailString(details, "containment_result")
	meta.LimitValue = firstDetailNumber(details, "limit_value", "expected", "threshold")
	meta.ObservedValue = firstDetailNumber(details, "observed_value", "actual", "measured")
	return meta
}

func firstDetailString(details map[string]any, keys ...string) string {
	for _, key := range keys {
		value, ok := details[key]
		if !ok {
			continue
		}
		if str, ok := value.(string); ok {
			trimmed := strings.TrimSpace(str)
			if trimmed != "" {
				return trimmed
			}
		}
	}
	return ""
}

func firstDetailNumber(details map[string]any, keys ...string) *float64 {
	for _, key := range keys {
		value, ok := details[key]
		if !ok {
			continue
		}
		switch n := value.(type) {
		case float64:
			return &n
		case float32:
			converted := float64(n)
			return &converted
		case int:
			converted := float64(n)
			return &converted
		case int64:
			converted := float64(n)
			return &converted
		case json.Number:
			if parsed, err := n.Float64(); err == nil {
				return &parsed
			}
		}
	}
	return nil
}
