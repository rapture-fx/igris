package api

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func TestRoboticsPolicyActivationWithPostgresMigrations(t *testing.T) {
	dsn := os.Getenv("IGRIS_OVERTURE_POSTGRES_TEST_DSN")
	if dsn == "" {
		dsn = os.Getenv("POSTGRES_TEST_DSN")
	}
	if dsn == "" {
		t.Skip("set IGRIS_OVERTURE_POSTGRES_TEST_DSN or POSTGRES_TEST_DSN to run real Postgres migration test")
	}

	db, err := sql.Open("postgres", dsn)
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	t.Cleanup(func() { _ = db.Close() })

	schema := "robotics_policy_test_" + strings.ReplaceAll(uuid.NewString(), "-", "_")
	_, err = db.Exec(`CREATE SCHEMA ` + schema)
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = db.Exec(`DROP SCHEMA ` + schema + ` CASCADE`) })
	_, err = db.Exec(`SET search_path TO ` + schema)
	require.NoError(t, err)

	for _, name := range []string{
		"036_robotics_policy_settings.sql",
		"038_robotics_policy_lifecycle.sql",
	} {
		sqlBytes, err := os.ReadFile(filepath.Join("..", "database", "migrations", name))
		require.NoError(t, err)
		_, err = db.Exec(string(sqlBytes))
		require.NoError(t, err)
	}

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-real-pg")
		return c.Next()
	})
	app.Post("/v1/robotics/policies", createDraftRoboticsPolicy(db))
	app.Post("/v1/robotics/policies/:version/activate", activateRoboticsPolicy(db))

	createReq := httptest.NewRequest(http.MethodPost, "/v1/robotics/policies", strings.NewReader(`{
		"policy_version":"robotics-policy.pg",
		"permit":true,
		"runtime_permitted":true,
		"robot_mode":"supervised",
		"allowed_runtimes":["runtime-pg"]
	}`))
	createReq.Header.Set("Content-Type", "application/json")
	createResp, err := app.Test(createReq)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, createResp.StatusCode)

	activateReq := httptest.NewRequest(http.MethodPost, "/v1/robotics/policies/robotics-policy.pg/activate", nil)
	activateResp, err := app.Test(activateReq)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, activateResp.StatusCode)

	var status string
	var active bool
	var activatedPresent bool
	err = db.QueryRow(`
		SELECT status, active, activated_at IS NOT NULL
		FROM robotics_policy_settings
		WHERE tenant_id = $1 AND policy_version = $2`,
		"tenant-real-pg", "robotics-policy.pg",
	).Scan(&status, &active, &activatedPresent)
	require.NoError(t, err)
	require.Equal(t, "active", status)
	require.True(t, active)
	require.True(t, activatedPresent)
}
