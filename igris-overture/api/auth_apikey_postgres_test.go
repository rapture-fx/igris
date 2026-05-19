package api

import (
	"context"
	"database/sql"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gofiber/fiber/v2"
	_ "github.com/lib/pq"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/security"
)

// These tests exercise BetterAuth's API-key branch against a REAL Postgres
// database. The companion file auth_apikey_integration_test.go uses a mock
// driver that returns whatever columns the test asks for — it cannot catch
// schema drift between application SQL and the actual table layout. The
// tenant_email schema-drift bug discovered by scripts/cli_mcp_smoke_demo.sh
// is exactly the class of issue these tests guard against.
//
// Skipped unless IGRIS_OVERTURE_POSTGRES_TEST_DSN (or POSTGRES_TEST_DSN) is
// set. The CLI/MCP smoke harness applies migration 050 before running, so
// `bash scripts/cli_mcp_smoke_demo.sh` followed by these tests with
// POSTGRES_TEST_DSN pointing at the same DB is the end-to-end path.

func openPostgresForAuthTest(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("IGRIS_OVERTURE_POSTGRES_TEST_DSN")
	if dsn == "" {
		dsn = os.Getenv("POSTGRES_TEST_DSN")
	}
	if dsn == "" {
		t.Skip("set IGRIS_OVERTURE_POSTGRES_TEST_DSN or POSTGRES_TEST_DSN to run real-Postgres auth tests")
	}
	db, err := sql.Open("postgres", dsn)
	require.NoError(t, err)
	require.NoError(t, db.Ping())
	t.Cleanup(func() { _ = db.Close() })
	return db
}

// prepareTenantEmailAuthSchema creates an older tenants(email) table shape,
// applies migration 050, and pins this test's DB handle to the isolated schema.
func prepareTenantEmailAuthSchema(t *testing.T, db *sql.DB) {
	t.Helper()
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	schema := "tenant_email_auth_test_" + randomHex16(t)
	_, err := db.Exec(`CREATE SCHEMA ` + schema)
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = db.Exec(`DROP SCHEMA ` + schema + ` CASCADE`)
	})

	_, err = db.Exec(`SET search_path TO ` + schema + `, public`)
	require.NoError(t, err)
	_, err = db.Exec(`
		CREATE TABLE tenants (
			tenant_id text PRIMARY KEY,
			tenant_name text NOT NULL DEFAULT '',
			email text,
			status text NOT NULL DEFAULT 'active',
			tier text NOT NULL DEFAULT 'seed',
			api_key_hash text,
			api_key_prefix varchar(10),
			is_active boolean NOT NULL DEFAULT true,
			runtime_limit integer NOT NULL DEFAULT 1,
			created_at timestamptz NOT NULL DEFAULT NOW(),
			updated_at timestamptz NOT NULL DEFAULT NOW()
		);
	`)
	require.NoError(t, err)

	sqlBytes, err := os.ReadFile(filepath.Join("..", "database", "migrations", "050_tenant_email_alignment.sql"))
	require.NoError(t, err)
	_, err = db.Exec(string(sqlBytes))
	require.NoError(t, err, "migration 050 must apply before real-Postgres API-key auth tests")

	var exists int
	err = db.QueryRow(`
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = $1 AND table_name = 'tenants' AND column_name = 'tenant_email'
	`, schema).Scan(&exists)
	require.NoError(t, err)
}

func TestTenantEmailAlignmentMigration_AddsAndBackfillsColumn(t *testing.T) {
	db := openPostgresForAuthTest(t)
	ctx := context.Background()
	conn, err := db.Conn(ctx)
	require.NoError(t, err)
	defer conn.Close()

	schema := "tenant_email_migration_test_" + randomHex16(t)
	_, err = conn.ExecContext(ctx, `CREATE SCHEMA `+schema)
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = db.Exec(`DROP SCHEMA ` + schema + ` CASCADE`)
	})

	_, err = conn.ExecContext(ctx, `SET search_path TO `+schema+`, public`)
	require.NoError(t, err)
	_, err = conn.ExecContext(ctx, `
		CREATE TABLE tenants (
			tenant_id text PRIMARY KEY,
			email text
		);
		INSERT INTO tenants (tenant_id, email)
		VALUES ('migration-test-tenant', 'migration-test@example.test');
	`)
	require.NoError(t, err)

	sqlBytes, err := os.ReadFile("../database/migrations/050_tenant_email_alignment.sql")
	require.NoError(t, err)

	_, err = conn.ExecContext(ctx, string(sqlBytes))
	require.NoError(t, err, "migration 050 must apply to an older tenants(email) schema")

	var tenantEmail string
	err = conn.QueryRowContext(ctx, `SELECT tenant_email FROM tenants WHERE tenant_id = 'migration-test-tenant'`).Scan(&tenantEmail)
	require.NoError(t, err)
	require.Equal(t, "migration-test@example.test", tenantEmail)

	_, err = conn.ExecContext(ctx, string(sqlBytes))
	require.NoError(t, err, "migration 050 must remain idempotent")
}

// seedTestTenant inserts a tenants row with a hashed API key. The cleanup
// callback deletes the row when the test finishes.
func seedTestTenant(t *testing.T, db *sql.DB, rawKey, tenantID, email string, active bool) {
	t.Helper()
	hash := security.HashAPIKey(rawKey)
	// api_key_prefix is varchar(10) in the production schema — cap accordingly.
	prefix := rawKey
	if len(rawKey) > 10 {
		prefix = rawKey[:10]
	}
	_, err := db.Exec(`
		INSERT INTO tenants
		    (tenant_id, tenant_name, email, tenant_email, status, tier, api_key_hash, api_key_prefix, is_active, runtime_limit, created_at, updated_at)
		VALUES
		    ($1::text, 'auth_apikey_postgres_test', $2::text, $3::text, 'active', 'seed', $4::text, $5::text, $6::boolean, 3, NOW(), NOW())
		ON CONFLICT (tenant_id) DO UPDATE SET
		    email = EXCLUDED.email,
		    tenant_email = EXCLUDED.tenant_email,
		    api_key_hash = EXCLUDED.api_key_hash,
		    api_key_prefix = EXCLUDED.api_key_prefix,
		    is_active = EXCLUDED.is_active,
		    status = 'active',
		    updated_at = NOW()
	`, tenantID, email, email, hash, prefix, active)
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = db.Exec(`DELETE FROM tenants WHERE tenant_id = $1`, tenantID)
	})
}

func TestBetterAuth_RealPostgres_APIKey_Bearer_Authenticates(t *testing.T) {
	db := openPostgresForAuthTest(t)
	prepareTenantEmailAuthSchema(t, db)

	rawKey := "igris_postgres_auth_test_" + randomHex16(t)
	tenantID := "auth-pgtest-" + randomHex16(t)
	email := "auth-pgtest+" + randomHex16(t) + "@example.test"
	seedTestTenant(t, db, rawKey, tenantID, email, true)

	app := fiber.New()
	app.Use(middleware.BetterAuth(db))
	app.Get("/echo", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"clerk_user_id": middleware.GetClerkUserID(c),
			"clerk_email":   middleware.GetClerkEmail(c),
		})
	})

	req := httptest.NewRequest(http.MethodGet, "/echo", nil)
	req.Header.Set("Authorization", "Bearer "+rawKey)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusOK, resp.StatusCode, "real-Postgres API-key auth must succeed (this is the test that caught the tenant_email drift)")

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Contains(t, string(body), tenantID)
	require.Contains(t, string(body), email)
}

func TestBetterAuth_RealPostgres_InactiveTenant_Rejected(t *testing.T) {
	db := openPostgresForAuthTest(t)
	prepareTenantEmailAuthSchema(t, db)

	rawKey := "igris_postgres_inactive_" + randomHex16(t)
	tenantID := "auth-pgtest-inactive-" + randomHex16(t)
	email := "auth-pgtest-inactive+" + randomHex16(t) + "@example.test"
	seedTestTenant(t, db, rawKey, tenantID, email, false)

	app := fiber.New()
	app.Use(middleware.BetterAuth(db))
	app.Get("/echo", func(c *fiber.Ctx) error { return c.SendStatus(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/echo", nil)
	req.Header.Set("Authorization", "Bearer "+rawKey)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode, "inactive tenant with valid hash must be rejected")
}

func TestBetterAuth_RealPostgres_UnknownKey_Rejected(t *testing.T) {
	db := openPostgresForAuthTest(t)
	prepareTenantEmailAuthSchema(t, db)

	app := fiber.New()
	app.Use(middleware.BetterAuth(db))
	app.Get("/echo", func(c *fiber.Ctx) error { return c.SendStatus(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/echo", nil)
	req.Header.Set("Authorization", "Bearer igris_definitely_not_a_real_key_"+randomHex16(t))
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

// randomHex16 returns a 16-character hex string with enough entropy to keep
// per-test tenant rows isolated even when tests run in parallel. We avoid
// crypto/rand here — pseudo-random is fine for test fixture uniqueness.
func randomHex16(t *testing.T) string {
	t.Helper()
	var b [8]byte
	_, err := io.ReadFull(testRandReader{}, b[:])
	require.NoError(t, err)
	const hex = "0123456789abcdef"
	out := make([]byte, 16)
	for i, x := range b {
		out[i*2] = hex[x>>4]
		out[i*2+1] = hex[x&0x0f]
	}
	return string(out)
}

type testRandReader struct{}

func (testRandReader) Read(p []byte) (int, error) {
	// Use crypto/rand transitively via the testing standard library's clock
	// would be ideal, but a quick deterministic-enough source for fixture
	// uniqueness keeps imports minimal. nanoTime + counter gives plenty.
	for i := range p {
		p[i] = byte(testCounter.next())
	}
	return len(p), nil
}

type counter struct {
	n uint64
}

func (c *counter) next() uint64 {
	c.n = c.n*1103515245 + 12345 + uint64(os.Getpid())
	return c.n
}

var testCounter = &counter{n: 0xDEADBEEFCAFE}
