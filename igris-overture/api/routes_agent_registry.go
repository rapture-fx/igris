package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/Igris-inertial/system/igris-overture/agentregistry"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterAgentRegistryRoutes exposes tenant-scoped Agent Registry CRUD and the
// combined PATCH dispatcher for registry fields vs execution settings.
func RegisterAgentRegistryRoutes(app *fiber.App, db *sql.DB, executionHandler *ExecutionHandler) {
	if db == nil {
		return
	}
	store := &agentregistry.SQLStore{DB: db}

	v1 := app.Group("/v1/agents")
	v1.Use(middleware.BetterAuth(db))

	v1.Get("", handleAgentRegistryList(store))
	v1.Post("", handleAgentRegistryCreate(store))
	v1.Get("/:id", handleAgentRegistryGet(store))
	v1.Patch("/:id", handleAgentRegistryPatch(store, executionHandler))
	v1.Delete("/:id", handleAgentRegistryArchive(store))
}

type agentRegistryRequest struct {
	TenantID     string                 `json:"tenant_id"`
	Name         string                 `json:"name"`
	DisplayName  string                 `json:"display_name"`
	AgentType    string                 `json:"agent_type"`
	TemplateName string                 `json:"template_name"`
	Version      string                 `json:"version"`
	Description  string                 `json:"description"`
	Metadata     map[string]interface{} `json:"metadata"`
}

func handleAgentRegistryList(store *agentregistry.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		includeArchived := strings.EqualFold(strings.TrimSpace(c.Query("include_archived")), "true")
		agents, err := store.List(c.Context(), tenantID, includeArchived)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		out := make([]fiber.Map, 0, len(agents))
		for _, agent := range agents {
			out = append(out, publicAgentResponse(agent))
		}
		return c.JSON(fiber.Map{"agents": out})
	}
}

func handleAgentRegistryCreate(store *agentregistry.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		var req agentRegistryRequest
		if err := json.Unmarshal(c.Body(), &req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		if strings.TrimSpace(req.TenantID) != "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "tenant_override_rejected",
				"message": "tenant_id must not be supplied in the request body",
			})
		}
		created, err := store.Create(c.Context(), tenantID, agentregistry.CreateInput{
			Name:         req.Name,
			DisplayName:  req.DisplayName,
			AgentType:    req.AgentType,
			TemplateName: req.TemplateName,
			Version:      req.Version,
			Description:  req.Description,
			Metadata:     req.Metadata,
		})
		if err != nil {
			if agentregistry.IsUniqueViolation(err) {
				return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "agent_name_conflict"})
			}
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "invalid_agent",
				"message": err.Error(),
			})
		}
		return c.Status(http.StatusCreated).JSON(publicAgentResponse(created))
	}
}

func handleAgentRegistryGet(store *agentregistry.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		agent, err := store.GetByID(c.Context(), tenantID, c.Params("id"))
		if errors.Is(err, agentregistry.ErrNotFound) {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "agent_not_found"})
		}
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(publicAgentResponse(agent))
	}
}

func handleAgentRegistryArchive(store *agentregistry.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		if err := store.Archive(c.Context(), tenantID, c.Params("id")); errors.Is(err, agentregistry.ErrNotFound) {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "agent_not_found"})
		} else if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.SendStatus(http.StatusNoContent)
	}
}

func handleAgentRegistryPatch(store *agentregistry.SQLStore, executionHandler *ExecutionHandler) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthorized"})
		}
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(c.Body(), &fields); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid body"})
		}
		if raw, ok := fields["tenant_id"]; ok && len(strings.TrimSpace(string(raw))) > 0 && string(raw) != "null" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "tenant_override_rejected",
				"message": "tenant_id must not be supplied in the request body",
			})
		}

		registryKeys, settingsKeys := classifyAgentPatchFields(fields)
		if len(registryKeys) > 0 && len(settingsKeys) > 0 {
			return c.Status(http.StatusConflict).JSON(fiber.Map{
				"error":   "mixed_patch_fields",
				"message": "registry fields and execution settings fields cannot be patched in the same request",
			})
		}
		if len(settingsKeys) > 0 {
			if executionHandler == nil {
				return c.Status(http.StatusServiceUnavailable).JSON(fiber.Map{"error": "execution_handler_unavailable"})
			}
			return executionHandler.PatchAgent(c)
		}
		if len(registryKeys) == 0 {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error": "at least one registry or execution settings field is required",
			})
		}

		update := agentregistry.UpdateInput{}
		if raw, ok := fields["name"]; ok {
			value, err := decodeOptionalString(raw)
			if err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid name"})
			}
			update.Name = value
		}
		if raw, ok := fields["display_name"]; ok {
			value, err := decodeOptionalString(raw)
			if err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid display_name"})
			}
			update.DisplayName = value
		}
		if raw, ok := fields["agent_type"]; ok {
			value, err := decodeOptionalString(raw)
			if err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid agent_type"})
			}
			update.AgentType = value
		}
		if raw, ok := fields["template_name"]; ok {
			value, err := decodeOptionalString(raw)
			if err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid template_name"})
			}
			update.TemplateName = value
		}
		if raw, ok := fields["version"]; ok {
			value, err := decodeOptionalString(raw)
			if err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid version"})
			}
			update.Version = value
		}
		if raw, ok := fields["description"]; ok {
			value, err := decodeOptionalString(raw)
			if err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid description"})
			}
			update.Description = value
		}
		if raw, ok := fields["metadata"]; ok {
			var metadata map[string]interface{}
			if err := json.Unmarshal(raw, &metadata); err != nil {
				return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid metadata"})
			}
			update.Metadata = metadata
			update.MetadataSet = true
		}

		updated, err := store.Update(c.Context(), tenantID, c.Params("id"), update)
		if errors.Is(err, agentregistry.ErrNotFound) {
			return c.Status(http.StatusNotFound).JSON(fiber.Map{"error": "agent_not_found"})
		}
		if err != nil {
			if agentregistry.IsUniqueViolation(err) {
				return c.Status(http.StatusConflict).JSON(fiber.Map{"error": "agent_name_conflict"})
			}
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "invalid_agent",
				"message": err.Error(),
			})
		}
		return c.JSON(publicAgentResponse(updated))
	}
}

func classifyAgentPatchFields(fields map[string]json.RawMessage) (registry []string, settings []string) {
	registryFieldSet := map[string]struct{}{
		"name":          {},
		"display_name":  {},
		"description":   {},
		"agent_type":    {},
		"template_name": {},
		"version":       {},
		"metadata":      {},
	}
	settingsFieldSet := map[string]struct{}{
		"shadow_mode":               {},
		"reflection_mode":           {},
		"council_mode":              {},
		"cognitive_advisor_enabled": {},
	}
	for key := range fields {
		if key == "tenant_id" {
			continue
		}
		if _, ok := registryFieldSet[key]; ok {
			registry = append(registry, key)
		}
		if _, ok := settingsFieldSet[key]; ok {
			settings = append(settings, key)
		}
	}
	return registry, settings
}

func decodeOptionalString(raw json.RawMessage) (*string, error) {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" || trimmed == "null" {
		empty := ""
		return &empty, nil
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, err
	}
	return &value, nil
}

func publicAgentResponse(agent agentregistry.Agent) fiber.Map {
	resp := fiber.Map{
		"agent_id":      agent.AgentID.String(),
		"name":          agent.Name,
		"display_name":  agent.DisplayName,
		"agent_type":    agent.AgentType,
		"template_name": agent.TemplateName,
		"version":       agent.Version,
		"description":   agent.Description,
		"metadata":      agent.Metadata,
		"created_at":    agent.CreatedAt,
		"updated_at":    agent.UpdatedAt,
	}
	if agent.ArchivedAt != nil {
		resp["archived_at"] = agent.ArchivedAt
	}
	return resp
}