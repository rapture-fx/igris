package api

import (
	"crypto/ed25519"
	"database/sql"
	"encoding/hex"
	"net/http"
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
	_, err = db.Exec(`SET search_path TO ` + schema + `, public`)
	require.NoError(t, err)

	for _, name := range []string{
		"036_robotics_policy_settings.sql",
		"038_robotics_policy_lifecycle.sql",
		"040_robotics_policy_lifecycle_audit.sql",
		"041_robotics_policy_signing_keys.sql",
		"042_robotics_policy_command_nonce_audit.sql",
	} {
		sqlBytes, err := os.ReadFile(filepath.Join("..", "database", "migrations", name))
		require.NoError(t, err)
		_, err = db.Exec(string(sqlBytes))
		require.NoError(t, err)
	}

	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-real-pg")
		c.Locals("clerk_email", "tenant-real-pg@example.test")
		c.Locals("clerk_role", "admin")
		return c.Next()
	})
	app.Post("/v1/robotics/policies", createDraftRoboticsPolicy(db))
	app.Post("/v1/robotics/policies/:version/activate", activateRoboticsPolicy(db))

	activePublicKey, activePrivateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	revokedPublicKey, revokedPrivateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	_, err = db.Exec(`
		INSERT INTO robotics_policy_signing_keys (
			tenant_id, key_version, signer_identity, public_key_ed25519,
			status, created_by, created_at, updated_at
		)
		VALUES
			($1, 'policy-key-old', $2, $3, 'revoked', $1, NOW(), NOW()),
			($1, 'policy-key-active', $2, $4, 'active', $1, NOW(), NOW())`,
		"tenant-real-pg",
		// Must match the signer header set by signedRoboticsPolicyRouteRequest;
		// the handler 403s (policy_signer_identity_mismatch) when the header and
		// the key row disagree.
		"policy-admin@example.test",
		hex.EncodeToString(revokedPublicKey),
		hex.EncodeToString(activePublicKey),
	)
	require.NoError(t, err)

	createBody := `{
		"policy_version":"robotics-policy.pg",
		"permit":true,
		"runtime_permitted":true,
		"robot_mode":"supervised",
		"allowed_runtimes":["runtime-pg"]
	}`
	revokedReq := signedRoboticsPolicyRouteRequest(t, http.MethodPost, "/v1/robotics/policies", createBody, revokedPrivateKey, "policy-key-old", "draft")
	revokedResp, err := app.Test(revokedReq)
	require.NoError(t, err)
	require.Equal(t, http.StatusForbidden, revokedResp.StatusCode)

	createReq := signedRoboticsPolicyRouteRequest(t, http.MethodPost, "/v1/robotics/policies", createBody, activePrivateKey, "policy-key-active", "draft")
	createResp, err := app.Test(createReq)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, createResp.StatusCode)

	activateReq := signedRoboticsPolicyRouteRequest(t, http.MethodPost, "/v1/robotics/policies/robotics-policy.pg/activate", "", activePrivateKey, "policy-key-active", "activate")
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

	var activationAuditRows int
	err = db.QueryRow(`
		SELECT COUNT(*)
		FROM robotics_policy_lifecycle_audit
		WHERE tenant_id = $1
		  AND policy_version = $2
		  AND action = 'activate'
		  AND actor_id = $1
		  AND signer_identity = $3
		  AND signer_key_version = 'policy-key-active'
		  AND command_nonce IS NOT NULL
		  AND command_hash IS NOT NULL
		  AND command_signature IS NOT NULL`,
		"tenant-real-pg", "robotics-policy.pg", "policy-admin@example.test",
	).Scan(&activationAuditRows)
	require.NoError(t, err)
	require.Equal(t, 1, activationAuditRows)
}
