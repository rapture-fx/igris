package api

import (
	"database/sql"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/Schlep-engine/igris-inertial/igris-overture/cognitive"
	"github.com/Schlep-engine/igris-inertial/igris-overture/config"
)

// CognitiveHandler handles cognitive advisor API requests
type CognitiveHandler struct {
	applier       *cognitive.Applier
	runtimeConfig *config.RuntimeOptimizerConfig
}

// NewCognitiveHandler creates a new cognitive handler
func NewCognitiveHandler(applier *cognitive.Applier) *CognitiveHandler {
	return &CognitiveHandler{
		applier:       applier,
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
