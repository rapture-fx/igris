package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/Igris-inertial/system/igris-overture/agentmemory"
	"github.com/Igris-inertial/system/igris-overture/agentregistry"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterAgentMemoryRoutes exposes summary-only evidence memory. This route
// stores operator-facing summaries, never prompts, chain-of-thought, tokens, or
// raw execution bodies.
func RegisterAgentMemoryRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		return
	}
	v1 := app.Group("/v1/agent-memory")
	v1.Use(middleware.BetterAuth(db))
	store := &agentmemory.SQLStore{DB: db}
	v1.Post("", handleAgentMemoryCreate(db, store))
	v1.Get("", handleAgentMemoryList(store))
}

type agentMemoryRequest struct {
	TenantID            string   `json:"tenant_id"`
	TaskID              string   `json:"task_id"`
	ExecutionID         string   `json:"execution_id"`
	RegisteredAgentID   string   `json:"registered_agent_id"`
	RegisteredAgentName string   `json:"registered_agent_name"`
	GoalSummary         string   `json:"goal_summary"`
	DecisionSummary     string   `json:"decision_summary"`
	EvidenceSummary     []string `json:"evidence_summary"`
	OutcomeSummary      string   `json:"outcome_summary"`
	RetentionDays       *int     `json:"retention_days"`
}

func handleAgentMemoryCreate(db *sql.DB, store *agentmemory.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		var req agentMemoryRequest
		if err := json.Unmarshal(c.Body(), &req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		if strings.TrimSpace(req.TenantID) != "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "tenant_override_rejected",
				"message": "tenant_id must not be supplied in the request body",
			})
		}

		input, err := buildAgentMemoryInput(c.Context(), db, tenantID, req)
		if errors.Is(err, agentregistry.ErrNotFound) || errors.Is(err, agentmemory.ErrNotFound) {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "memory_target_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "invalid_agent_memory",
				"message": err.Error(),
			})
		}

		created, err := store.Create(c.Context(), tenantID, input, time.Now().UTC())
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "invalid_agent_memory",
				"message": err.Error(),
			})
		}
		return c.Status(http.StatusCreated).JSON(created)
	}
}

func handleAgentMemoryList(store *agentmemory.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		filter := agentmemory.ListFilter{
			ExecutionID: strings.TrimSpace(c.Query("execution_id")),
			AgentName:   strings.TrimSpace(c.Query("registered_agent_name")),
			Limit:       c.QueryInt("limit", 50),
		}
		if raw := strings.TrimSpace(c.Query("task_id")); raw != "" {
			id, err := uuid.Parse(raw)
			if err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_task_id"})
			}
			filter.TaskID = &id
		}
		if raw := strings.TrimSpace(c.Query("registered_agent_id")); raw != "" {
			id, err := uuid.Parse(raw)
			if err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_registered_agent_id"})
			}
			filter.AgentID = &id
		}
		if raw := strings.TrimSpace(c.Query("agent_id")); raw != "" && filter.AgentID == nil {
			id, err := uuid.Parse(raw)
			if err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_agent_id"})
			}
			filter.AgentID = &id
		}
		if filter.Limit <= 0 {
			filter.Limit = 50
		}
		if filter.Limit > 200 {
			filter.Limit = 200
		}

		items, err := store.List(c.Context(), tenantID, filter)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"memory": items, "total": len(items)})
	}
}

func buildAgentMemoryInput(ctx context.Context, db *sql.DB, tenantID string, req agentMemoryRequest) (agentmemory.CreateInput, error) {
	explicitExecutionID := strings.TrimSpace(req.ExecutionID) != ""
	explicitAgentName := strings.TrimSpace(req.RegisteredAgentName) != ""
	input := agentmemory.CreateInput{
		ExecutionID:         req.ExecutionID,
		RegisteredAgentName: req.RegisteredAgentName,
		GoalSummary:         req.GoalSummary,
		DecisionSummary:     req.DecisionSummary,
		EvidenceSummary:     req.EvidenceSummary,
		OutcomeSummary:      req.OutcomeSummary,
		RetentionDays:       req.RetentionDays,
	}

	if raw := strings.TrimSpace(req.TaskID); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			return agentmemory.CreateInput{}, errors.New("invalid task_id")
		}
		input.TaskID = &id
		agentID, agentName, executionID, err := lookupTaskMemoryTarget(ctx, db, tenantID, id)
		if err != nil {
			return agentmemory.CreateInput{}, err
		}
		if input.RegisteredAgentID == nil && agentID != nil {
			input.RegisteredAgentID = agentID
		}
		if input.RegisteredAgentName == "" {
			input.RegisteredAgentName = agentName
		}
		if strings.TrimSpace(input.ExecutionID) == "" {
			input.ExecutionID = executionID
		}
	}

	if raw := strings.TrimSpace(req.RegisteredAgentID); raw != "" {
		id, err := uuid.Parse(raw)
		if err != nil {
			return agentmemory.CreateInput{}, errors.New("invalid registered_agent_id")
		}
		agent, err := (&agentregistry.SQLStore{DB: db}).GetByID(ctx, tenantID, id.String())
		if err != nil {
			return agentmemory.CreateInput{}, err
		}
		input.RegisteredAgentID = &agent.AgentID
		input.RegisteredAgentName = agent.Name
	}
	if input.RegisteredAgentID == nil && strings.TrimSpace(input.RegisteredAgentName) != "" {
		agent, err := (&agentregistry.SQLStore{DB: db}).GetByName(ctx, tenantID, input.RegisteredAgentName)
		if err == nil {
			input.RegisteredAgentID = &agent.AgentID
			input.RegisteredAgentName = agent.Name
		} else if explicitAgentName && errors.Is(err, agentregistry.ErrNotFound) {
			return agentmemory.CreateInput{}, err
		} else if !errors.Is(err, agentregistry.ErrNotFound) {
			return agentmemory.CreateInput{}, err
		}
	}
	if explicitExecutionID {
		if err := assertExecutionBelongsToTenant(ctx, db, tenantID, input.ExecutionID); err != nil {
			return agentmemory.CreateInput{}, err
		}
	}
	return input, nil
}

func lookupTaskMemoryTarget(ctx context.Context, db *sql.DB, tenantID string, taskID uuid.UUID) (*uuid.UUID, string, string, error) {
	var agentID uuid.NullUUID
	var agentName sql.NullString
	var executionID sql.NullString
	err := db.QueryRowContext(ctx, `
		SELECT registered_agent_id, registered_agent_name, proof_execution_id
		FROM task_records
		WHERE task_id = $1 AND tenant_id = $2`,
		taskID, tenantID,
	).Scan(&agentID, &agentName, &executionID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, "", "", agentmemory.ErrNotFound
	}
	if err != nil {
		return nil, "", "", err
	}
	var agentUUID *uuid.UUID
	if agentID.Valid {
		id := agentID.UUID
		agentUUID = &id
	}
	return agentUUID, agentName.String, executionID.String, nil
}

func assertExecutionBelongsToTenant(ctx context.Context, db *sql.DB, tenantID, executionID string) error {
	var found int
	err := db.QueryRowContext(ctx, `
		SELECT 1
		FROM execution_lineage
		WHERE tenant_id = $1 AND execution_id = $2
		LIMIT 1`,
		tenantID, strings.TrimSpace(executionID),
	).Scan(&found)
	if errors.Is(err, sql.ErrNoRows) {
		return agentmemory.ErrNotFound
	}
	return err
}
