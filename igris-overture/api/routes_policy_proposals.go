package api

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/policyproposals"
)

// RegisterPolicyProposalRoutes exposes the policy proposal lifecycle: operators
// save a simulated policy rule as a draft, re-simulate it over fresh execution
// truth, mark it ready for review, and (optionally) approve it.
//
// This surface is governance metadata only. It NEVER mutates active policy,
// replays runs, dispatches tasks, calls runtimes, or persists raw
// request/response bodies, prompts, chain-of-thought, secrets, or ciphertext.
// Re-simulation reuses the exact same read-only simulation engine as
// /v1/policy/simulate. Tenant identity is derived from auth and tenant_id body
// overrides are rejected.
func RegisterPolicyProposalRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		return
	}
	v1 := app.Group("/v1/policy/proposals")
	v1.Use(middleware.BetterAuth(db))
	store := &policyproposals.SQLStore{DB: db}

	v1.Get("", handlePolicyProposalList(store))
	v1.Post("", handlePolicyProposalCreate(store))
	v1.Get("/:id", handlePolicyProposalGet(store))
	v1.Patch("/:id", handlePolicyProposalUpdate(store))
	v1.Delete("/:id", handlePolicyProposalDelete(store))
	v1.Post("/:id/simulate", handlePolicyProposalSimulate(store, db))
	v1.Post("/:id/approve", handlePolicyProposalApprove(store))
}

// policyProposalRequest is the strict, allow-listed body for create/update.
// tenant_id is present only so it can be explicitly rejected; every other
// unknown field (including nested criteria fields) is rejected by
// DisallowUnknownFields.
type policyProposalRequest struct {
	TenantID      string                        `json:"tenant_id"`
	Name          string                        `json:"name"`
	Description   string                        `json:"description"`
	PolicyMode    string                        `json:"policy_mode"`
	MatchCriteria policyproposals.MatchCriteria `json:"match_criteria_json"`
	Status        string                        `json:"status"`
}

// proposalSimulationSummary is the safe, persisted snapshot of a re-simulation.
// It embeds the same safe response the simulate endpoint returns and stamps when
// it was computed. No raw bodies, prompts, or secrets are present.
type proposalSimulationSummary struct {
	policySimulateResponse
	SimulatedAt time.Time `json:"simulated_at"`
}

func handlePolicyProposalList(store *policyproposals.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		items, err := store.List(c.Context(), tenantID)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"proposals": items, "total": len(items)})
	}
}

func handlePolicyProposalCreate(store *policyproposals.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		var req policyProposalRequest
		if err := decodePolicyProposalBody(c.Body(), &req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		if strings.TrimSpace(req.TenantID) != "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "tenant_override_rejected",
				"message": "tenant_id must not be supplied in the request body",
			})
		}
		created, err := store.Create(c.Context(), tenantID, tenantID, policyproposals.CreateInput{
			Name:          req.Name,
			Description:   req.Description,
			PolicyMode:    req.PolicyMode,
			MatchCriteria: req.MatchCriteria,
		})
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_proposal", "message": err.Error()})
		}
		return c.Status(http.StatusCreated).JSON(fiber.Map{"proposal": created})
	}
}

func handlePolicyProposalGet(store *policyproposals.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		item, err := store.Get(c.Context(), tenantID, c.Params("id"))
		if errors.Is(err, policyproposals.ErrNotFound) {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		events, err := store.ListEvents(c.Context(), tenantID, c.Params("id"), c.QueryInt("events_limit", 20))
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"proposal": item, "events": events})
	}
}

func handlePolicyProposalUpdate(store *policyproposals.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		var req policyProposalRequest
		if err := decodePolicyProposalBody(c.Body(), &req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		if strings.TrimSpace(req.TenantID) != "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "tenant_override_rejected",
				"message": "tenant_id must not be supplied in the request body",
			})
		}

		input := policyproposals.UpdateInput{}
		if bodyHasField(c.Body(), "name") {
			input.Name = &req.Name
		}
		if bodyHasField(c.Body(), "description") {
			input.Description = &req.Description
		}
		if bodyHasField(c.Body(), "policy_mode") {
			input.PolicyMode = &req.PolicyMode
		}
		if bodyHasField(c.Body(), "match_criteria_json") {
			criteria := req.MatchCriteria
			input.MatchCriteria = &criteria
		}
		if bodyHasField(c.Body(), "status") {
			input.Status = &req.Status
		}

		updated, err := store.Update(c.Context(), tenantID, c.Params("id"), input)
		switch {
		case errors.Is(err, policyproposals.ErrNotFound):
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
		case errors.Is(err, policyproposals.ErrInvalidTransition):
			return c.Status(http.StatusConflict).JSON(fiber.Map{
				"error":   "invalid_transition",
				"message": "this proposal can no longer be edited in its current state",
			})
		case err != nil:
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_proposal", "message": err.Error()})
		}
		return c.JSON(fiber.Map{"proposal": updated})
	}
}

func handlePolicyProposalDelete(store *policyproposals.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		err := store.Archive(c.Context(), tenantID, c.Params("id"))
		if errors.Is(err, policyproposals.ErrNotFound) {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"ok": true})
	}
}

// handlePolicyProposalSimulate re-runs the read-only simulation for a stored
// proposal over fresh execution truth and persists the safe summary. It reuses
// the exact same simulation engine as /v1/policy/simulate and changes neither
// the proposal's criteria nor its status.
func handlePolicyProposalSimulate(store *policyproposals.SQLStore, db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		// A simulate request takes no body. Reject any to avoid a tenant override
		// or unexpected field sneaking in.
		if len(bytes.TrimSpace(c.Body())) > 0 {
			var probe struct {
				TenantID string `json:"tenant_id"`
			}
			if err := decodePolicyProposalBody(c.Body(), &probe); err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
			}
			if strings.TrimSpace(probe.TenantID) != "" {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{
					"error":   "tenant_override_rejected",
					"message": "tenant_id must not be supplied in the request body",
				})
			}
		}

		proposal, err := store.Get(c.Context(), tenantID, c.Params("id"))
		if errors.Is(err, policyproposals.ErrNotFound) {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		simReq := policySimulateRequest{
			Range:                   proposal.MatchCriteria.Range,
			PolicyMode:              proposal.PolicyMode,
			MatchActionName:         proposal.MatchCriteria.MatchActionName,
			MatchActionPrefix:       proposal.MatchCriteria.MatchActionPrefix,
			MatchAgentID:            proposal.MatchCriteria.MatchAgentID,
			MatchAgentType:          proposal.MatchCriteria.MatchAgentType,
			MatchResultStatus:       proposal.MatchCriteria.MatchResultStatus,
			RequireProofMissing:     proposal.MatchCriteria.RequireProofMissing,
			RequireRecoveryOccurred: proposal.MatchCriteria.RequireRecoveryOccurred,
			RequireEvalFailed:       proposal.MatchCriteria.RequireEvalFailed,
		}
		resp, validationErr, dbErr := runPolicySimulation(c.Context(), db, tenantID, simReq)
		if validationErr != "" {
			// Stored criteria were validated on write; reaching here means the
			// proposal is no longer simulatable. Report safely without leaking SQL.
			return c.Status(http.StatusUnprocessableEntity).JSON(fiber.Map{"error": "proposal_not_simulatable"})
		}
		if dbErr != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		summary := proposalSimulationSummary{policySimulateResponse: resp, SimulatedAt: time.Now().UTC()}
		summaryJSON, err := json.Marshal(summary)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		updated, err := store.SaveSimulation(c.Context(), tenantID, c.Params("id"), summaryJSON, resp.AffectedRunCount, resp.TotalRunsConsidered)
		if errors.Is(err, policyproposals.ErrNotFound) {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"proposal": updated, "simulation": resp})
	}
}

func handlePolicyProposalApprove(store *policyproposals.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		updated, err := store.Approve(c.Context(), tenantID, c.Params("id"))
		switch {
		case errors.Is(err, policyproposals.ErrNotFound):
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "not_found"})
		case errors.Is(err, policyproposals.ErrNotSimulated):
			return c.Status(http.StatusConflict).JSON(fiber.Map{
				"error":   "not_simulated",
				"message": "simulate the proposal before approving it",
			})
		case errors.Is(err, policyproposals.ErrInvalidTransition):
			return c.Status(http.StatusConflict).JSON(fiber.Map{
				"error":   "invalid_transition",
				"message": "only a proposal marked ready for review can be approved",
			})
		case err != nil:
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"proposal": updated})
	}
}

func decodePolicyProposalBody(body []byte, out any) error {
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	return decoder.Decode(out)
}
