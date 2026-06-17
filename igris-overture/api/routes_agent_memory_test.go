package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/agentmemory"
)

func TestHandleAgentMemoryCreateRejectsTenantOverride(t *testing.T) {
	t.Parallel()

	db, driver := newQueuedRouteDB(t, nil)
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-a")
		return c.Next()
	})
	app.Post("/v1/agent-memory", handleAgentMemoryCreate(db, &agentmemory.SQLStore{DB: db}))

	req := httptest.NewRequest(http.MethodPost, "/v1/agent-memory", strings.NewReader(`{
		"tenant_id":"tenant-b",
		"registered_agent_name":"claude_local",
		"goal_summary":"Invoice enterprise customer",
		"decision_summary":"Usage exceeded contracted threshold",
		"evidence_summary":["usage=4821","plan=enterprise"],
		"outcome_summary":"Invoice sent"
	}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Zero(t, driver.remainingQueries())
	require.Zero(t, driver.remainingExecs())
}
