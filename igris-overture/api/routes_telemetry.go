package api

import (
	"database/sql"
	"encoding/json"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/internal"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/observability"
	"github.com/Igris-inertial/system/igris-overture/security"
)

// runtimeRegisterRequest is the extended registration payload.
// It embeds security.RuntimeRegistration (for signature verification) and adds
// the fields needed to populate the runtime_instances DB table.
type runtimeRegisterRequest struct {
	security.RuntimeRegistration
	Endpoint     string   `json:"endpoint"`
	IsEdge       bool     `json:"is_edge"`
	Capabilities []string `json:"capabilities"`
	Platform     string   `json:"platform"`
	Version      string   `json:"version"`
}

// TelemetryHandler handles telemetry and execution feedback endpoints
type TelemetryHandler struct {
	db                 *sql.DB
	routingIntegration *security.RoutingIntegration
	runtimeRegistry    *security.RuntimeRegistry
	repo               *internal.RuntimeRepository // nil when DB unavailable
}

// NewTelemetryHandler creates a new telemetry handler
func NewTelemetryHandler(db *sql.DB, routingIntegration *security.RoutingIntegration) *TelemetryHandler {
	var repo *internal.RuntimeRepository
	if db != nil {
		repo = internal.NewRuntimeRepository(db)
	}
	return &TelemetryHandler{
		db:                 db,
		routingIntegration: routingIntegration,
		runtimeRegistry:    security.NewRuntimeRegistry(),
		repo:               repo,
	}
}

// RegisterTelemetryRoutes registers telemetry and execution feedback endpoints
func RegisterTelemetryRoutes(
	app *fiber.App,
	_ *middleware.TenantAuth,
	db *sql.DB,
	routingIntegration *security.RoutingIntegration,
) {
	handler := NewTelemetryHandler(db, routingIntegration)

	// API v1 routes
	v1 := app.Group("/api/v1")

	// Runtime registration and heartbeat
	v1.Post("/runtime/register", handler.HandleRuntimeRegister)
	v1.Post("/runtime/heartbeat", handler.HandleRuntimeHeartbeat)
	v1.Get("/runtime/list", handler.HandleRuntimeList)

	// Execution feedback (cryptographic verification)
	v1.Post("/telemetry/execution", handler.HandleExecutionFeedback)

	// Audit and statistics (always require Clerk authentication)
	v1.Get("/telemetry/audit", middleware.BetterAuth(db), handler.HandleGetAuditLog)
	v1.Get("/telemetry/stats", middleware.BetterAuth(db), handler.HandleGetStats)

	log.Info().Msg("Telemetry routes registered")
}

// ExecutionFeedbackRequest represents execution feedback from Runtime
type ExecutionFeedbackRequest struct {
	// Signed decision that was executed
	SignedDecision *security.SignedDecisionEnvelope `json:"signed_decision"`

	// Signed execution envelope from Runtime
	ExecutionEnvelope *security.SignedExecutionEnvelope `json:"execution_envelope"`

	// Runtime identification
	RuntimeID string `json:"runtime_id"`
}

// HandleExecutionFeedback handles POST /api/v1/telemetry/execution
// This verifies execution feedback and records it to the audit log
func (h *TelemetryHandler) HandleExecutionFeedback(c *fiber.Ctx) error {
	start := time.Now()

	var req ExecutionFeedbackRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid_request",
			"message": "Failed to parse request body",
		})
	}

	// Validate required fields
	if req.SignedDecision == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_signed_decision",
			"message": "signed_decision is required",
		})
	}

	if req.ExecutionEnvelope == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_execution_envelope",
			"message": "execution_envelope is required",
		})
	}

	if req.RuntimeID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_runtime_id",
			"message": "runtime_id is required",
		})
	}

	tenantID := req.SignedDecision.Decision.TenantID

	// Get Runtime's public key from registry
	runtimePublicKey, err := h.runtimeRegistry.GetRuntimePublicKey(req.RuntimeID)
	if err != nil {
		log.Warn().
			Str("runtime_id", req.RuntimeID).
			Err(err).
			Msg("Runtime not registered, attempting verification without cached key")

		// For unregistered runtimes, we can't verify the execution envelope
		// Record this as a warning but don't reject (unless strict mode)
		if h.routingIntegration != nil && h.routingIntegration.IsEnabled() {
			observability.RecordVerificationFailure(tenantID, "runtime_not_registered")
		}

		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "runtime_not_registered",
			"message": "Runtime must be registered before sending execution feedback",
			"failure": telemetryFailure("runtime", "execution_feedback", "runtime_not_registered", "Runtime must be registered before sending execution feedback", err.Error()),
		})
	}

	// Check if crypto integration is enabled
	if h.routingIntegration == nil || !h.routingIntegration.IsEnabled() {
		// Crypto disabled - just acknowledge receipt
		latencyMs := time.Since(start).Milliseconds()

		log.Debug().
			Str("decision_id", req.SignedDecision.Decision.DecisionID).
			Str("runtime_id", req.RuntimeID).
			Int64("latency_ms", latencyMs).
			Msg("Execution feedback received (crypto disabled)")

		return c.JSON(fiber.Map{
			"status":     "acknowledged",
			"verified":   false,
			"message":    "Crypto verification disabled",
			"latency_ms": latencyMs,
		})
	}

	// Verify execution feedback
	ctx := c.UserContext()
	err = h.routingIntegration.VerifyExecutionFeedback(
		ctx,
		req.SignedDecision,
		req.ExecutionEnvelope,
		runtimePublicKey,
	)

	latencyMs := time.Since(start).Milliseconds()

	if err != nil {
		log.Error().
			Err(err).
			Str("decision_id", req.SignedDecision.Decision.DecisionID).
			Str("runtime_id", req.RuntimeID).
			Str("tenant_id", tenantID).
			Msg("Execution feedback verification failed - TAMPER DETECTED")

		observability.RecordTamperDetection(tenantID, "execution_verification_failed")

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error":       "verification_failed",
			"message":     "Execution feedback verification failed",
			"details":     err.Error(),
			"decision_id": req.SignedDecision.Decision.DecisionID,
			"latency_ms":  latencyMs,
			"failure":     telemetryFailure("runtime", "execution_feedback", "verification_failed", "Execution feedback verification failed", err.Error()),
		})
	}

	log.Info().
		Str("decision_id", req.SignedDecision.Decision.DecisionID).
		Str("runtime_id", req.RuntimeID).
		Str("tenant_id", tenantID).
		Bool("success", req.ExecutionEnvelope.Envelope.Success).
		Int("execution_latency_ms", req.ExecutionEnvelope.Envelope.LatencyMs).
		Int64("verification_latency_ms", latencyMs).
		Msg("Execution feedback verified successfully")

	return c.JSON(fiber.Map{
		"status":                  "verified",
		"verified":                true,
		"decision_id":             req.SignedDecision.Decision.DecisionID,
		"execution_success":       req.ExecutionEnvelope.Envelope.Success,
		"execution_latency_ms":    req.ExecutionEnvelope.Envelope.LatencyMs,
		"verification_latency_ms": latencyMs,
	})
}

// HandleRuntimeRegister handles POST /api/v1/runtime/register
func (h *TelemetryHandler) HandleRuntimeRegister(c *fiber.Ctx) error {
	var req runtimeRegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid_request",
			"message": "Failed to parse request body",
		})
	}

	// Validate required fields
	if req.RuntimeID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_runtime_id",
			"message": "runtime_id is required",
		})
	}

	if req.TenantID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_tenant_id",
			"message": "tenant_id is required",
		})
	}

	if req.PublicKeyBase64 == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_public_key",
			"message": "public_key is required",
		})
	}

	// Set timestamp if not provided
	if req.Timestamp == 0 {
		req.Timestamp = time.Now().Unix()
	}

	// Register the Runtime (in-memory, with signature verification)
	if err := h.runtimeRegistry.RegisterRuntime(&req.RuntimeRegistration); err != nil {
		log.Error().
			Err(err).
			Str("runtime_id", req.RuntimeID).
			Str("tenant_id", req.TenantID).
			Msg("Runtime registration failed")

		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error":   "registration_failed",
			"message": err.Error(),
			"failure": telemetryFailure("runtime", "runtime_register", "registration_failed", "Runtime registration failed", err.Error()),
		})
	}

	// Persist to runtime_instances DB table when endpoint is provided.
	if h.repo != nil && req.Endpoint != "" {
		inst := internal.RuntimeInstance{
			RuntimeID:    req.RuntimeID,
			Endpoint:     req.Endpoint,
			PublicKey:    req.PublicKeyBase64,
			Capabilities: req.Capabilities,
			Platform:     req.Platform,
			Version:      req.Version,
			IsEdge:       req.IsEdge,
		}
		if err := h.repo.Upsert(c.UserContext(), inst); err != nil {
			log.Warn().Err(err).Str("runtime_id", req.RuntimeID).
				Msg("Failed to persist runtime to DB (non-fatal)")
		} else {
			log.Info().Str("runtime_id", req.RuntimeID).Bool("is_edge", req.IsEdge).
				Msg("Runtime persisted to runtime_instances")
		}
	}

	// If crypto integration is enabled, ensure tenant has signing keys
	if h.routingIntegration != nil && h.routingIntegration.IsEnabled() {
		ctx := c.UserContext()
		tenantKey, err := h.routingIntegration.EnsureTenantKey(ctx, req.TenantID)
		if err != nil {
			log.Warn().
				Err(err).
				Str("tenant_id", req.TenantID).
				Msg("Failed to ensure tenant key during runtime registration")
		} else {
			log.Info().
				Str("tenant_id", req.TenantID).
				Int("key_version", tenantKey.KeyVersion).
				Msg("Tenant key ensured for crypto integration")
		}
	}

	return c.JSON(fiber.Map{
		"status":        "registered",
		"runtime_id":    req.RuntimeID,
		"tenant_id":     req.TenantID,
		"registered_at": req.Timestamp,
	})
}

// HandleRuntimeHeartbeat handles POST /api/v1/runtime/heartbeat
func (h *TelemetryHandler) HandleRuntimeHeartbeat(c *fiber.Ctx) error {
	var req security.RuntimeHeartbeat
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "invalid_request",
			"message": "Failed to parse request body",
		})
	}

	// Validate required fields
	if req.RuntimeID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_runtime_id",
			"message": "runtime_id is required",
		})
	}

	// Set timestamp if not provided
	if req.Timestamp == 0 {
		req.Timestamp = time.Now().Unix()
	}

	// Update heartbeat (in-memory registry)
	if err := h.runtimeRegistry.UpdateHeartbeat(&req); err != nil {
		log.Warn().
			Err(err).
			Str("runtime_id", req.RuntimeID).
			Msg("Runtime heartbeat failed")

		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error":   "heartbeat_failed",
			"message": err.Error(),
			"failure": telemetryFailure("runtime", "runtime_heartbeat", "heartbeat_failed", "Runtime heartbeat failed", err.Error()),
		})
	}

	// Also refresh is_healthy in the DB table (non-fatal).
	if h.repo != nil {
		if err := h.repo.UpdateHealth(c.UserContext(), req.RuntimeID, true); err != nil {
			log.Warn().Err(err).Str("runtime_id", req.RuntimeID).
				Msg("Failed to update runtime health in DB (non-fatal)")
		}
	}

	return c.JSON(fiber.Map{
		"status":     "acknowledged",
		"runtime_id": req.RuntimeID,
		"timestamp":  req.Timestamp,
	})
}

func telemetryFailure(source, operation, failureType, message, detail string) map[string]interface{} {
	return models.BuildSimpleFailureResponse(source, operation, failureType, message, detail)
}

// HandleRuntimeList handles GET /api/v1/runtime/list
func (h *TelemetryHandler) HandleRuntimeList(c *fiber.Ctx) error {
	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		// Try to get from auth context
		tenantID = middleware.GetTenantIDFromContext(c)
	}

	if tenantID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_tenant_id",
			"message": "tenant_id query parameter or authentication required",
		})
	}

	runtimes := h.runtimeRegistry.ListRuntimes(tenantID)

	// Convert to JSON-safe format
	result := make([]fiber.Map, 0, len(runtimes))
	for _, rt := range runtimes {
		result = append(result, fiber.Map{
			"runtime_id":     rt.RuntimeID,
			"tenant_id":      rt.TenantID,
			"registered_at":  rt.RegisteredAt,
			"last_heartbeat": rt.LastHeartbeat,
			"stats":          rt.Stats,
		})
	}

	return c.JSON(fiber.Map{
		"runtimes": result,
		"count":    len(result),
	})
}

// HandleGetAuditLog handles GET /api/v1/telemetry/audit
func (h *TelemetryHandler) HandleGetAuditLog(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantIDFromContext(c)
	if tenantID == "" {
		tenantID = c.Query("tenant_id")
	}

	if tenantID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_tenant_id",
			"message": "tenant_id required (via auth or query parameter)",
		})
	}

	// Parse time range
	sinceStr := c.Query("since", "24h")
	sinceDuration, err := time.ParseDuration(sinceStr)
	if err != nil {
		sinceDuration = 24 * time.Hour
	}
	since := time.Now().Add(-sinceDuration)

	// Parse limit
	limit := c.QueryInt("limit", 100)
	if limit > 1000 {
		limit = 1000
	}

	// Parse status filter
	statusFilter := c.Query("status", "")

	// Query audit log
	query := `
		SELECT
			decision_id,
			request_id,
			signed_decision,
			decision_signature,
			decision_key_version,
			execution_envelope,
			execution_signature,
			decision_verified,
			execution_verified,
			verification_status,
			verification_error,
			execution_success,
			latency_ms,
			provider_id,
			decision_timestamp,
			execution_timestamp,
			created_at,
			verified_at
		FROM decision_execution_audit
		WHERE tenant_id = $1 AND created_at >= $2
	`

	args := []interface{}{tenantID, since}

	if statusFilter != "" {
		query += " AND verification_status = $3"
		args = append(args, statusFilter)
	}

	query += " ORDER BY created_at DESC LIMIT $" + string(rune('0'+len(args)+1))
	args = append(args, limit)

	rows, err := h.db.QueryContext(c.UserContext(), query, args...)
	if err != nil {
		log.Error().Err(err).Msg("Failed to query audit log")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "query_failed",
			"message": "Failed to query audit log",
		})
	}
	defer rows.Close()

	var entries []fiber.Map
	for rows.Next() {
		var entry struct {
			DecisionID         string
			RequestID          string
			SignedDecision     json.RawMessage
			DecisionSignature  string
			DecisionKeyVersion int
			ExecutionEnvelope  sql.NullString
			ExecutionSignature sql.NullString
			DecisionVerified   bool
			ExecutionVerified  sql.NullBool
			VerificationStatus string
			VerificationError  sql.NullString
			ExecutionSuccess   sql.NullBool
			LatencyMs          sql.NullInt32
			ProviderID         sql.NullString
			DecisionTimestamp  time.Time
			ExecutionTimestamp sql.NullTime
			CreatedAt          time.Time
			VerifiedAt         sql.NullTime
		}

		if err := rows.Scan(
			&entry.DecisionID,
			&entry.RequestID,
			&entry.SignedDecision,
			&entry.DecisionSignature,
			&entry.DecisionKeyVersion,
			&entry.ExecutionEnvelope,
			&entry.ExecutionSignature,
			&entry.DecisionVerified,
			&entry.ExecutionVerified,
			&entry.VerificationStatus,
			&entry.VerificationError,
			&entry.ExecutionSuccess,
			&entry.LatencyMs,
			&entry.ProviderID,
			&entry.DecisionTimestamp,
			&entry.ExecutionTimestamp,
			&entry.CreatedAt,
			&entry.VerifiedAt,
		); err != nil {
			log.Warn().Err(err).Msg("Failed to scan audit row")
			continue
		}

		entryMap := fiber.Map{
			"decision_id":          entry.DecisionID,
			"request_id":           entry.RequestID,
			"decision_key_version": entry.DecisionKeyVersion,
			"decision_verified":    entry.DecisionVerified,
			"verification_status":  entry.VerificationStatus,
			"decision_timestamp":   entry.DecisionTimestamp,
			"created_at":           entry.CreatedAt,
		}

		if entry.ExecutionVerified.Valid {
			entryMap["execution_verified"] = entry.ExecutionVerified.Bool
		}
		if entry.VerificationError.Valid {
			entryMap["verification_error"] = entry.VerificationError.String
		}
		if entry.ExecutionSuccess.Valid {
			entryMap["execution_success"] = entry.ExecutionSuccess.Bool
		}
		if entry.LatencyMs.Valid {
			entryMap["latency_ms"] = entry.LatencyMs.Int32
		}
		if entry.ProviderID.Valid {
			entryMap["provider_id"] = entry.ProviderID.String
		}
		if entry.ExecutionTimestamp.Valid {
			entryMap["execution_timestamp"] = entry.ExecutionTimestamp.Time
		}
		if entry.VerifiedAt.Valid {
			entryMap["verified_at"] = entry.VerifiedAt.Time
		}

		entries = append(entries, entryMap)
	}

	return c.JSON(fiber.Map{
		"tenant_id": tenantID,
		"entries":   entries,
		"count":     len(entries),
		"since":     since,
	})
}

// HandleGetStats handles GET /api/v1/telemetry/stats
func (h *TelemetryHandler) HandleGetStats(c *fiber.Ctx) error {
	tenantID := middleware.GetTenantIDFromContext(c)
	if tenantID == "" {
		tenantID = c.Query("tenant_id")
	}

	if tenantID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error":   "missing_tenant_id",
			"message": "tenant_id required (via auth or query parameter)",
		})
	}

	// Parse time range
	sinceStr := c.Query("since", "24h")
	sinceDuration, err := time.ParseDuration(sinceStr)
	if err != nil {
		sinceDuration = 24 * time.Hour
	}
	since := time.Now().Add(-sinceDuration)

	// Get stats from decision signer if available
	if h.routingIntegration != nil && h.routingIntegration.IsEnabled() {
		signer := h.routingIntegration.GetDecisionSigner()
		if signer != nil {
			stats, err := signer.GetAuditStats(c.UserContext(), tenantID, since)
			if err != nil {
				log.Warn().Err(err).Msg("Failed to get audit stats")
			} else {
				return c.JSON(fiber.Map{
					"tenant_id": tenantID,
					"since":     since,
					"stats":     stats,
				})
			}
		}
	}

	// Fallback: query directly
	query := `
		SELECT
			COUNT(*) as total_decisions,
			COUNT(CASE WHEN verification_status = 'verified' THEN 1 END) as verified_count,
			COUNT(CASE WHEN verification_status = 'tamper_detected' THEN 1 END) as tamper_count,
			COUNT(CASE WHEN verification_status = 'pending' THEN 1 END) as pending_count,
			COUNT(CASE WHEN verification_status = 'failed' THEN 1 END) as failed_count,
			AVG(latency_ms) as avg_latency_ms,
			COUNT(CASE WHEN execution_success = TRUE THEN 1 END) as success_count,
			COUNT(CASE WHEN execution_success = FALSE THEN 1 END) as failure_count
		FROM decision_execution_audit
		WHERE tenant_id = $1 AND created_at >= $2
	`

	var stats struct {
		TotalDecisions int64
		VerifiedCount  int64
		TamperCount    int64
		PendingCount   int64
		FailedCount    int64
		AvgLatencyMs   sql.NullFloat64
		SuccessCount   int64
		FailureCount   int64
	}

	err = h.db.QueryRowContext(c.UserContext(), query, tenantID, since).Scan(
		&stats.TotalDecisions,
		&stats.VerifiedCount,
		&stats.TamperCount,
		&stats.PendingCount,
		&stats.FailedCount,
		&stats.AvgLatencyMs,
		&stats.SuccessCount,
		&stats.FailureCount,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to query telemetry stats")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error":   "query_failed",
			"message": "Failed to query telemetry stats",
		})
	}

	verificationRate := 0.0
	if stats.TotalDecisions > 0 {
		verificationRate = float64(stats.VerifiedCount) / float64(stats.TotalDecisions)
	}

	successRate := 0.0
	totalExecuted := stats.SuccessCount + stats.FailureCount
	if totalExecuted > 0 {
		successRate = float64(stats.SuccessCount) / float64(totalExecuted)
	}

	return c.JSON(fiber.Map{
		"tenant_id": tenantID,
		"since":     since,
		"stats": fiber.Map{
			"total_decisions":        stats.TotalDecisions,
			"verified_count":         stats.VerifiedCount,
			"tamper_count":           stats.TamperCount,
			"pending_count":          stats.PendingCount,
			"failed_count":           stats.FailedCount,
			"avg_latency_ms":         stats.AvgLatencyMs.Float64,
			"success_count":          stats.SuccessCount,
			"failure_count":          stats.FailureCount,
			"verification_rate":      verificationRate,
			"execution_success_rate": successRate,
		},
	})
}
