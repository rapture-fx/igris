package middleware

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"
)

func TestBetterAuthSessionPropagatesExistingAdminRole(t *testing.T) {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		setBetterAuthSessionContext(
			c, "tenant-admin", "admin@example.test", "Admin", "user,admin",
		)
		return c.Next()
	})
	app.Get("/check", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"tenant_id":   GetClerkUserID(c),
			"is_admin":    IsAdminRequest(c),
			"auth_method": c.Locals("auth_method"),
		})
	})
	req := httptest.NewRequest("GET", "/check", nil)
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)
	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "tenant-admin", body["tenant_id"])
	require.Equal(t, true, body["is_admin"])
	require.Equal(t, "session", body["auth_method"])
}
