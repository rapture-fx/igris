package api

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/cognitive"
	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/database"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// CognitiveHandler handles cognitive advisor API requests
type CognitiveHandler struct {
	applier       *cognitive.Applier
	db            *database.DB
	runtimeConfig *config.RuntimeOptimizerConfig
}

// NewCognitiveHandler creates a new cognitive handler
func NewCognitiveHandler(applier *cognitive.Applier) *CognitiveHandler {
	return &CognitiveHandler{
		applier:       applier,
		runtimeConfig: config.GetRuntimeConfig(),
	}
}

// NewCognitiveHandlerWithDB creates a new cognitive handler with database access
func NewCognitiveHandlerWithDB(applier *cognitive.Applier, db *database.DB) *CognitiveHandler {
	return &CognitiveHandler{
		applier:       applier,
		db:            db,
		runtimeConfig: config.GetRuntimeConfig(),
	}
}

// ProposalListRequest represents a request to list proposals
type ProposalListRequest struct {
	TenantID string `query:"tenant_id"`
	Status   string `query:"status"`
	Limit    int    `query:"limit"`
}

// ProposalActionRequest represents a request to approve/reject a proposal
type ProposalActionRequest struct {
	ApprovedBy string `json:"approved_by"`
	Reason     string `json:"reason,omitempty"`
}

// RegisterCognitiveRoutes registers cognitive advisor routes
func RegisterCognitiveRoutes(app *fiber.App, applier *cognitive.Applier) {
	handler := NewCognitiveHandler(applier)

	admin := app.Group("/admin/cognitive")
	admin.Use(handler.AdminAuthMiddleware)

	admin.Get("/proposals", handler.ListProposals)
	admin.Get("/proposals/:id", handler.GetProposal)
	admin.Post("/proposals/:id/approve", handler.ApproveProposal)
	admin.Post("/proposals/:id/reject", handler.RejectProposal)
	admin.Post("/proposals/:id/apply", handler.ApplyProposal)
}

// RegisterCognitiveV1Routes registers v1 API routes for cognitive advisor (tenant-scoped)
func RegisterCognitiveV1Routes(app *fiber.App, applier *cognitive.Applier, db *database.DB) {
	handler := NewCognitiveHandlerWithDB(applier, db)

	// v1 API routes (tenant-scoped via API key authentication)
	v1 := app.Group("/api/v1/cognitive")

	// Proposal endpoints
	v1.Get("/proposals", handler.V1ListProposals)
	v1.Get("/proposals/:id", handler.V1GetProposal)
	v1.Post("/proposals/:id/apply", handler.V1ApplyProposal)

	// Auto-apply configuration endpoints
	v1.Get("/config", handler.GetAutoApplyConfig)
	v1.Put("/config", handler.UpdateAutoApplyConfig)
	v1.Patch("/config", handler.PatchAutoApplyConfig)
}

// AutoApplyConfigRequest represents auto-apply configuration
type AutoApplyConfigRequest struct {
	Enabled                       *bool    `json:"auto_apply_enabled,omitempty"`
	ConfidenceThreshold           *float64 `json:"confidence_threshold,omitempty"`
	MaxRiskScore                  *float64 `json:"max_risk_score,omitempty"`
	IntervalHours                 *int     `json:"interval_hours,omitempty"`
	RollbackWindowMinutes         *int     `json:"rollback_window_minutes,omitempty"`
	LatencyDegradationThreshold   *float64 `json:"latency_degradation_threshold,omitempty"`
	ErrorRateDegradationThreshold *float64 `json:"error_rate_degradation_threshold,omitempty"`
	CostDegradationThreshold      *float64 `json:"cost_degradation_threshold,omitempty"`
}

// AutoApplyConfigResponse represents the auto-apply config in API response
type AutoApplyConfigResponse struct {
	TenantID                      string    `json:"tenant_id"`
	Enabled                       bool      `json:"enabled"`
	AutoApplyEnabled              bool      `json:"auto_apply_enabled"`
	ConfidenceThreshold           float64   `json:"confidence_threshold"`
	MaxRiskScore                  float64   `json:"max_risk_score"`
	IntervalHours                 int       `json:"interval_hours"`
	RollbackWindowMinutes         int       `json:"rollback_window_minutes"`
	LatencyDegradationThreshold   float64   `json:"latency_degradation_threshold"`
	ErrorRateDegradationThreshold float64   `json:"error_rate_degradation_threshold"`
	CostDegradationThreshold      float64   `json:"cost_degradation_threshold"`
	LastRun                       *string   `json:"last_run,omitempty"`
	LastAutoApply                 *string   `json:"last_auto_apply,omitempty"`
	UpdatedAt                     time.Time `json:"updated_at"`
}

// V1ListProposals handles GET /api/v1/cognitive/proposals (tenant-scoped)
func (h *CognitiveHandler) V1ListProposals(c *fiber.Ctx) error {
	// Get tenant from context (set by auth middleware)
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Tenant context not found",
				"type":    "authentication_error",
			},
		})
	}

	status := c.Query("status", "")
	limit := c.QueryInt("limit", 50)
	if limit > 100 {
		limit = 100
	}

	proposals, err := h.applier.ListProposals(c.Context(), tenantCtx.TenantID, status, limit)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantCtx.TenantID).Msg("[Cognitive V1 API] Failed to list proposals")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Failed to retrieve proposals",
				"type":    "internal_error",
			},
		})
	}

	// Transform proposals to include confidence/risk scores prominently
	var response []map[string]interface{}
	for _, p := range proposals {
		response = append(response, map[string]interface{}{
			"proposal_id":                       p.ProposalID,
			"generated_at":                      p.GeneratedAt,
			"confidence":                        p.Confidence,
			"risk_score":                        p.RiskScore,
			"status":                            p.Status,
			"rationale":                         p.Rationale,
			"proposed_changes":                  p.ProposedChanges,
			"projected_latency_reduction_pct":   p.ProjectedLatencyP95Reduct,
			"projected_cost_saving_usd_monthly": p.ProjectedCostSavingMonthly,
		})
	}

	return c.JSON(fiber.Map{
		"proposals": response,
		"count":     len(proposals),
		"tenant_id": tenantCtx.TenantID,
	})
}

// V1GetProposal handles GET /api/v1/cognitive/proposals/:id (tenant-scoped)
func (h *CognitiveHandler) V1GetProposal(c *fiber.Ctx) error {
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Tenant context not found",
				"type":    "authentication_error",
			},
		})
	}

	proposalID := c.Params("id")
	if proposalID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "proposal_id is required",
				"type":    "invalid_request_error",
			},
		})
	}

	proposals, err := h.applier.ListProposals(c.Context(), tenantCtx.TenantID, "", 100)
	if err != nil {
		log.Error().Err(err).Msg("[Cognitive V1 API] Failed to get proposal")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Failed to retrieve proposal",
				"type":    "internal_error",
			},
		})
	}

	for _, p := range proposals {
		if p.ProposalID == proposalID {
			return c.JSON(fiber.Map{
				"proposal_id":                       p.ProposalID,
				"tenant_id":                         p.TenantID,
				"generated_at":                      p.GeneratedAt,
				"confidence":                        p.Confidence,
				"risk_score":                        p.RiskScore,
				"status":                            p.Status,
				"rationale":                         p.Rationale,
				"proposed_changes":                  p.ProposedChanges,
				"shadow_simulation_results":         p.ShadowResults,
				"projected_latency_reduction_pct":   p.ProjectedLatencyP95Reduct,
				"projected_cost_saving_usd_monthly": p.ProjectedCostSavingMonthly,
				"approved_by":                       p.ApprovedBy,
				"approved_at":                       p.ApprovedAt,
				"applied_at":                        p.AppliedAt,
			})
		}
	}

	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"error": map[string]interface{}{
			"message": "Proposal not found",
			"type":    "not_found_error",
		},
	})
}

// V1ApplyProposal handles POST /api/v1/cognitive/proposals/:id/apply (manual apply, tenant-scoped)
func (h *CognitiveHandler) V1ApplyProposal(c *fiber.Ctx) error {
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Tenant context not found",
				"type":    "authentication_error",
			},
		})
	}

	proposalID := c.Params("id")
	if proposalID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "proposal_id is required",
				"type":    "invalid_request_error",
			},
		})
	}

	// Verify proposal belongs to tenant
	proposals, err := h.applier.ListProposals(c.Context(), tenantCtx.TenantID, "", 100)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Failed to verify proposal",
				"type":    "internal_error",
			},
		})
	}

	found := false
	for _, p := range proposals {
		if p.ProposalID == proposalID {
			found = true
			break
		}
	}

	if !found {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Proposal not found",
				"type":    "not_found_error",
			},
		})
	}

	// Apply the proposal
	if err := h.applier.ApplyProposal(c.Context(), proposalID); err != nil {
		log.Error().Err(err).Str("proposal_id", proposalID).Msg("[Cognitive V1 API] Failed to apply proposal")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": fmt.Sprintf("Failed to apply proposal: %v", err),
				"type":    "operation_error",
			},
		})
	}

	log.Info().
		Str("tenant_id", tenantCtx.TenantID).
		Str("proposal_id", proposalID).
		Msg("[Cognitive V1 API] Proposal applied successfully")

	return c.JSON(fiber.Map{
		"status":      "applied",
		"proposal_id": proposalID,
		"message":     "Proposal applied successfully",
	})
}

// GetAutoApplyConfig handles GET /api/v1/cognitive/config
func (h *CognitiveHandler) GetAutoApplyConfig(c *fiber.Ctx) error {
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Tenant context not found",
				"type":    "authentication_error",
			},
		})
	}

	if h.db == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Database not configured",
				"type":    "configuration_error",
			},
		})
	}

	config, err := h.db.GetSelfTunerConfig(c.Context(), tenantCtx.TenantID)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantCtx.TenantID).Msg("[Cognitive V1 API] Failed to get config")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Failed to retrieve configuration",
				"type":    "internal_error",
			},
		})
	}

	response := AutoApplyConfigResponse{
		TenantID:                      config.TenantID,
		Enabled:                       config.Enabled,
		AutoApplyEnabled:              config.AutoApplyEnabled,
		ConfidenceThreshold:           config.AutoApplyThreshold,
		MaxRiskScore:                  config.MaxRiskScore,
		IntervalHours:                 int(config.Interval.Hours()),
		RollbackWindowMinutes:         int(config.RollbackWindow.Minutes()),
		LatencyDegradationThreshold:   config.LatencyDegradationThreshold,
		ErrorRateDegradationThreshold: config.ErrorRateDegradationThreshold,
		CostDegradationThreshold:      config.CostDegradationThreshold,
		UpdatedAt:                     config.UpdatedAt,
	}

	if !config.LastRun.IsZero() {
		s := config.LastRun.Format(time.RFC3339)
		response.LastRun = &s
	}
	if !config.LastAutoApply.IsZero() {
		s := config.LastAutoApply.Format(time.RFC3339)
		response.LastAutoApply = &s
	}

	return c.JSON(response)
}

// UpdateAutoApplyConfig handles PUT /api/v1/cognitive/config (full update)
func (h *CognitiveHandler) UpdateAutoApplyConfig(c *fiber.Ctx) error {
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Tenant context not found",
				"type":    "authentication_error",
			},
		})
	}

	if h.db == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Database not configured",
				"type":    "configuration_error",
			},
		})
	}

	var req AutoApplyConfigRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Invalid request body",
				"type":    "invalid_request_error",
			},
		})
	}

	// TIER ENFORCEMENT: Check if user is trying to enable auto-apply
	// Auto-apply requires Growth+ tier (cognitive_auto_apply feature)
	if req.Enabled != nil && *req.Enabled {
		tierPolicy, ok := c.Locals("tier_policy").(middleware.TierPolicy)
		if !ok || !tierPolicy.Features.CognitiveAutoApply {
			tier, _ := c.Locals("tier").(string)
			log.Warn().
				Str("tenant_id", tenantCtx.TenantID).
				Str("tier", tier).
				Msg("[Cognitive V1 API] Tier enforcement: auto-apply requires Growth+ tier")
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": map[string]interface{}{
					"message": "Auto-apply feature requires Growth tier or higher",
					"type":    "feature_not_available",
					"tier":    tier,
					"feature": "cognitive_auto_apply",
					"upgrade_url": "/api/v1/account/upgrade",
				},
			})
		}
	}

	// Build config from request
	config := database.DefaultSelfTunerConfig(tenantCtx.TenantID)

	if req.Enabled != nil {
		config.Enabled = *req.Enabled
	}
	if req.ConfidenceThreshold != nil {
		config.AutoApplyThreshold = *req.ConfidenceThreshold
	}
	if req.MaxRiskScore != nil {
		config.MaxRiskScore = *req.MaxRiskScore
	}
	if req.IntervalHours != nil {
		config.Interval = time.Duration(*req.IntervalHours) * time.Hour
	}
	if req.RollbackWindowMinutes != nil {
		config.RollbackWindow = time.Duration(*req.RollbackWindowMinutes) * time.Minute
	}
	if req.LatencyDegradationThreshold != nil {
		config.LatencyDegradationThreshold = *req.LatencyDegradationThreshold
	}
	if req.ErrorRateDegradationThreshold != nil {
		config.ErrorRateDegradationThreshold = *req.ErrorRateDegradationThreshold
	}
	if req.CostDegradationThreshold != nil {
		config.CostDegradationThreshold = *req.CostDegradationThreshold
	}

	if err := h.db.UpsertSelfTunerConfig(c.Context(), config); err != nil {
		log.Error().Err(err).Str("tenant_id", tenantCtx.TenantID).Msg("[Cognitive V1 API] Failed to update config")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Failed to update configuration",
				"type":    "internal_error",
			},
		})
	}

	log.Info().
		Str("tenant_id", tenantCtx.TenantID).
		Bool("auto_apply_enabled", config.AutoApplyEnabled).
		Msg("[Cognitive V1 API] Configuration updated")

	return c.JSON(fiber.Map{
		"status":  "updated",
		"message": "Auto-apply configuration updated successfully",
	})
}

// PatchAutoApplyConfig handles PATCH /api/v1/cognitive/config (partial update)
func (h *CognitiveHandler) PatchAutoApplyConfig(c *fiber.Ctx) error {
	tenantCtx := middleware.GetTenantContext(c)
	if tenantCtx == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Tenant context not found",
				"type":    "authentication_error",
			},
		})
	}

	if h.db == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Database not configured",
				"type":    "configuration_error",
			},
		})
	}

	// Get existing config
	config, err := h.db.GetSelfTunerConfig(c.Context(), tenantCtx.TenantID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Failed to retrieve existing configuration",
				"type":    "internal_error",
			},
		})
	}

	var req AutoApplyConfigRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Invalid request body",
				"type":    "invalid_request_error",
			},
		})
	}

	// TIER ENFORCEMENT: Check if user is trying to enable auto-apply
	// Auto-apply requires Growth+ tier (cognitive_auto_apply feature)
	if req.Enabled != nil && *req.Enabled {
		tierPolicy, ok := c.Locals("tier_policy").(middleware.TierPolicy)
		if !ok || !tierPolicy.Features.CognitiveAutoApply {
			tier, _ := c.Locals("tier").(string)
			log.Warn().
				Str("tenant_id", tenantCtx.TenantID).
				Str("tier", tier).
				Msg("[Cognitive V1 API] Tier enforcement: auto-apply requires Growth+ tier")
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": map[string]interface{}{
					"message": "Auto-apply feature requires Growth tier or higher",
					"type":    "feature_not_available",
					"tier":    tier,
					"feature": "cognitive_auto_apply",
					"upgrade_url": "/api/v1/account/upgrade",
				},
			})
		}
	}

	// Apply partial updates
	if req.Enabled != nil {
		config.AutoApplyEnabled = *req.Enabled
	}
	if req.ConfidenceThreshold != nil {
		config.AutoApplyThreshold = *req.ConfidenceThreshold
	}
	if req.MaxRiskScore != nil {
		config.MaxRiskScore = *req.MaxRiskScore
	}
	if req.IntervalHours != nil {
		config.Interval = time.Duration(*req.IntervalHours) * time.Hour
	}
	if req.RollbackWindowMinutes != nil {
		config.RollbackWindow = time.Duration(*req.RollbackWindowMinutes) * time.Minute
	}
	if req.LatencyDegradationThreshold != nil {
		config.LatencyDegradationThreshold = *req.LatencyDegradationThreshold
	}
	if req.ErrorRateDegradationThreshold != nil {
		config.ErrorRateDegradationThreshold = *req.ErrorRateDegradationThreshold
	}
	if req.CostDegradationThreshold != nil {
		config.CostDegradationThreshold = *req.CostDegradationThreshold
	}

	if err := h.db.UpsertSelfTunerConfig(c.Context(), config); err != nil {
		log.Error().Err(err).Str("tenant_id", tenantCtx.TenantID).Msg("[Cognitive V1 API] Failed to patch config")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Failed to update configuration",
				"type":    "internal_error",
			},
		})
	}

	log.Info().
		Str("tenant_id", tenantCtx.TenantID).
		Msg("[Cognitive V1 API] Configuration patched")

	return c.JSON(fiber.Map{
		"status":  "updated",
		"message": "Auto-apply configuration patched successfully",
	})
}

// AdminAuthMiddleware validates admin token
func (h *CognitiveHandler) AdminAuthMiddleware(c *fiber.Ctx) error {
	adminToken := c.Get("X-Admin-Token")
	if adminToken == "" {
		log.Warn().Msg("[Cognitive API] Missing X-Admin-Token header")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Missing X-Admin-Token header",
				"type":    "authentication_error",
			},
		})
	}

	expectedToken := h.runtimeConfig.GetAdminToken()
	if expectedToken == "" {
		log.Warn().Msg("[Cognitive API] Admin token not configured")
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Admin API is disabled (ADMIN_TOKEN not configured)",
				"type":    "configuration_error",
			},
		})
	}

	if adminToken != expectedToken {
		log.Warn().Msg("[Cognitive API] Invalid admin token")
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Invalid admin token",
				"type":    "authentication_error",
			},
		})
	}

	return c.Next()
}

// ListProposals handles GET /admin/cognitive/proposals
func (h *CognitiveHandler) ListProposals(c *fiber.Ctx) error {
	var req ProposalListRequest
	if err := c.QueryParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Invalid query parameters",
				"type":    "invalid_request_error",
			},
		})
	}

	// Set defaults
	if req.TenantID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "tenant_id query parameter is required",
				"type":    "invalid_request_error",
			},
		})
	}

	if req.Limit <= 0 {
		req.Limit = 50
	}
	if req.Limit > 100 {
		req.Limit = 100
	}

	proposals, err := h.applier.ListProposals(c.Context(), req.TenantID, req.Status, req.Limit)
	if err != nil {
		log.Error().Err(err).Msg("[Cognitive API] Failed to list proposals")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Failed to retrieve proposals",
				"type":    "internal_error",
			},
		})
	}

	return c.JSON(fiber.Map{
		"proposals": proposals,
		"count":     len(proposals),
	})
}

// GetProposal handles GET /admin/cognitive/proposals/:id
func (h *CognitiveHandler) GetProposal(c *fiber.Ctx) error {
	proposalID := c.Params("id")
	if proposalID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "proposal_id is required",
				"type":    "invalid_request_error",
			},
		})
	}

	// Get tenant_id from query for authorization
	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "tenant_id query parameter is required",
				"type":    "invalid_request_error",
			},
		})
	}

	proposals, err := h.applier.ListProposals(c.Context(), tenantID, "", 100)
	if err != nil {
		log.Error().Err(err).Msg("[Cognitive API] Failed to get proposal")
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Failed to retrieve proposal",
				"type":    "internal_error",
			},
		})
	}

	// Find matching proposal
	for _, p := range proposals {
		if p.ProposalID == proposalID {
			return c.JSON(p)
		}
	}

	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
		"error": map[string]interface{}{
			"message": "Proposal not found",
			"type":    "not_found_error",
		},
	})
}

// ApproveProposal handles POST /admin/cognitive/proposals/:id/approve
func (h *CognitiveHandler) ApproveProposal(c *fiber.Ctx) error {
	proposalID := c.Params("id")
	if proposalID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "proposal_id is required",
				"type":    "invalid_request_error",
			},
		})
	}

	var req ProposalActionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Invalid request body",
				"type":    "invalid_request_error",
			},
		})
	}

	if req.ApprovedBy == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "approved_by is required",
				"type":    "invalid_request_error",
			},
		})
	}

	if err := h.applier.ApproveProposal(c.Context(), proposalID, req.ApprovedBy); err != nil {
		log.Error().Err(err).Str("proposal_id", proposalID).Msg("[Cognitive API] Failed to approve proposal")

		status := fiber.StatusInternalServerError
		if err == sql.ErrNoRows {
			status = fiber.StatusNotFound
		}

		return c.Status(status).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": fmt.Sprintf("Failed to approve proposal: %v", err),
				"type":    "operation_error",
			},
		})
	}

	log.Info().
		Str("proposal_id", proposalID).
		Str("approved_by", req.ApprovedBy).
		Msg("[Cognitive API] Proposal approved")

	return c.JSON(fiber.Map{
		"status":      "approved",
		"proposal_id": proposalID,
		"approved_by": req.ApprovedBy,
	})
}

// RejectProposal handles POST /admin/cognitive/proposals/:id/reject
func (h *CognitiveHandler) RejectProposal(c *fiber.Ctx) error {
	proposalID := c.Params("id")
	if proposalID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "proposal_id is required",
				"type":    "invalid_request_error",
			},
		})
	}

	var req ProposalActionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "Invalid request body",
				"type":    "invalid_request_error",
			},
		})
	}

	if req.ApprovedBy == "" {
		req.ApprovedBy = "admin"
	}

	if req.Reason == "" {
		req.Reason = "No reason provided"
	}

	if err := h.applier.RejectProposal(c.Context(), proposalID, req.ApprovedBy, req.Reason); err != nil {
		log.Error().Err(err).Str("proposal_id", proposalID).Msg("[Cognitive API] Failed to reject proposal")

		status := fiber.StatusInternalServerError
		if err == sql.ErrNoRows {
			status = fiber.StatusNotFound
		}

		return c.Status(status).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": fmt.Sprintf("Failed to reject proposal: %v", err),
				"type":    "operation_error",
			},
		})
	}

	log.Info().
		Str("proposal_id", proposalID).
		Str("rejected_by", req.ApprovedBy).
		Str("reason", req.Reason).
		Msg("[Cognitive API] Proposal rejected")

	return c.JSON(fiber.Map{
		"status":      "rejected",
		"proposal_id": proposalID,
		"rejected_by": req.ApprovedBy,
		"reason":      req.Reason,
	})
}

// ApplyProposal handles POST /admin/cognitive/proposals/:id/apply
func (h *CognitiveHandler) ApplyProposal(c *fiber.Ctx) error {
	proposalID := c.Params("id")
	if proposalID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": "proposal_id is required",
				"type":    "invalid_request_error",
			},
		})
	}

	if err := h.applier.ApplyProposal(c.Context(), proposalID); err != nil {
		log.Error().Err(err).Str("proposal_id", proposalID).Msg("[Cognitive API] Failed to apply proposal")

		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": map[string]interface{}{
				"message": fmt.Sprintf("Failed to apply proposal: %v", err),
				"type":    "operation_error",
			},
		})
	}

	log.Info().Str("proposal_id", proposalID).Msg("[Cognitive API] Proposal applied successfully")

	return c.JSON(fiber.Map{
		"status":      "applied",
		"proposal_id": proposalID,
		"message":     "Proposal applied and policy hot-reloaded successfully",
	})
}
