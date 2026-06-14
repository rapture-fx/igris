package api

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/agentregistry"
	"github.com/Igris-inertial/system/igris-overture/coordinator"
)

func TestHandleAgentRegistryCreateRejectsBodyTenantOverride(t *testing.T) {
	t.Parallel()

	db, driver := newQueuedRouteDB(t, nil)
	app := agentRegistryTestApp(db, NewExecutionHandler(db))
	req := httptest.NewRequest(http.MethodPost, "/v1/agents", strings.NewReader(`{
		"tenant_id":"tenant-b",
		"name":"support-bot",
		"agent_type":"cursor",
		"description":"Support workflows"
	}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Equal(t, 0, driver.remainingExecs())
}

func TestHandleAgentRegistryPatchRejectsMixedFields(t *testing.T) {
	t.Parallel()

	db, _ := newQueuedRouteDB(t, nil)
	app := agentRegistryTestApp(db, NewExecutionHandler(db))
	req := httptest.NewRequest(http.MethodPatch, "/v1/agents/"+uuid.NewString(), strings.NewReader(`{
		"name":"renamed-bot",
		"shadow_mode":true
	}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)
}

func TestHandleAgentRegistryGetIsTenantScoped(t *testing.T) {
	t.Parallel()

	agentID := uuid.New()
	now := time.Now().UTC()
	db, driver := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: agentRegistryColumns(),
		rows:    nil,
		checkArgs: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "FROM registered_agents")
			require.Contains(t, query, "tenant_id = $1")
			require.Equal(t, "tenant-a", args[0].Value)
			require.Equal(t, agentID.String(), args[1].Value)
		},
	}})
	app := agentRegistryTestApp(db, NewExecutionHandler(db))
	req := httptest.NewRequest(http.MethodGet, "/v1/agents/"+agentID.String(), nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
	require.Equal(t, 0, driver.remainingQueries())
	_ = now
}

func TestResolveActionRunAgentRejectsUnknownAgent(t *testing.T) {
	t.Parallel()

	db, driver := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: agentRegistryColumns(),
		rows:    nil,
		checkArgs: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "FROM registered_agents")
			require.Equal(t, "tenant-a", args[0].Value)
		},
	}})
	_, err := resolveActionRunAgent(t.Context(), db, "tenant-a", "", "missing-agent")
	require.Error(t, err)
	require.Equal(t, 0, driver.remainingQueries())
}

func TestBuildActionRunResponseIncludesSafeAgentObject(t *testing.T) {
	t.Parallel()

	agentID := uuid.New()
	resp := buildActionRunResponse(&coordinator.TaskRecord{
		TaskID:              uuid.New(),
		Status:              coordinator.TaskStatusCompleted,
		RegisteredAgentID:   &agentID,
		RegisteredAgentName: "support_bot",
	}, &agentregistry.ResolvedAgent{
		Agent: agentregistry.Agent{
			AgentID:      agentID,
			Name:         "support_bot",
			DisplayName:  "Support Bot",
			AgentType:    agentregistry.AgentTypeCursor,
			TemplateName: "cursor",
		},
	})
	agent, ok := resp["agent"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, agentID.String(), agent["agent_id"])
	require.Equal(t, "support_bot", agent["name"])
	require.Equal(t, "Support Bot", agent["display_name"])
	require.Equal(t, agentregistry.AgentTypeCursor, agent["agent_type"])
	raw, err := json.Marshal(resp)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "metadata")
}

func agentRegistryTestApp(db *sql.DB, executionHandler *ExecutionHandler) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-a")
		return c.Next()
	})
	store := &agentregistry.SQLStore{DB: db}
	v1 := app.Group("/v1/agents")
	v1.Get("", handleAgentRegistryList(store))
	v1.Post("", handleAgentRegistryCreate(store))
	v1.Get("/:id", handleAgentRegistryGet(store))
	v1.Patch("/:id", handleAgentRegistryPatch(store, executionHandler))
	v1.Delete("/:id", handleAgentRegistryArchive(store))
	return app
}

func agentRegistryColumns() []string {
	return []string{
		"agent_id",
		"tenant_id",
		"name",
		"display_name",
		"agent_type",
		"template_name",
		"version",
		"description",
		"metadata",
		"created_at",
		"updated_at",
		"archived_at",
	}
}

func readBodyJSON(t *testing.T, resp *http.Response) map[string]interface{} {
	t.Helper()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	var out map[string]interface{}
	require.NoError(t, json.Unmarshal(body, &out))
	return out
}