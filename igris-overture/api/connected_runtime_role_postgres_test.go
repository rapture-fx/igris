package api

// Proves Connected contract + evidence store paths under the least-privilege
// igris_app_runtime role on a disposable bootstrap+roles database.
//
// Skipped unless IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN is set. Does not use shared
// infrastructure.

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"io"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/database/bootstrap"
	"github.com/Igris-inertial/system/igris-overture/database/roles"
	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func TestConnectedPathsUnderRuntimeRolePostgres(t *testing.T) {
	adminDSN := os.Getenv("IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN")
	if adminDSN == "" {
		t.Skip("set IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN to run runtime-role Connected path tests")
	}

	suffix := randomHexAPI(t, 4)
	names := roles.Names{
		MigrationOwner:   "igris_mig_" + suffix,
		AppRuntime:       "igris_rt_" + suffix,
		ReadOnlyOperator: "igris_ro_" + suffix,
		BackupRestore:    "igris_bk_" + suffix,
	}
	t.Cleanup(func() {
		admin, err := sql.Open("postgres", adminDSN)
		if err != nil {
			return
		}
		defer admin.Close()
		for _, role := range []string{names.AppRuntime, names.ReadOnlyOperator, names.BackupRestore, names.MigrationOwner} {
			_, _ = admin.Exec(`DROP OWNED BY ` + pq.QuoteIdentifier(role) + ` CASCADE`)
			_, _ = admin.Exec(`DROP ROLE IF EXISTS ` + pq.QuoteIdentifier(role))
		}
	})

	adminDB, dbName := openDisposableConnectedDB(t, adminDSN)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()

	boot, err := bootstrap.NewRunner()
	require.NoError(t, err)
	_, err = boot.Run(ctx, adminDB, bootstrap.ModeApply, io.Discard)
	require.NoError(t, err)

	roleRunner, err := roles.NewRunner(names)
	require.NoError(t, err)
	_, err = roleRunner.Run(ctx, adminDB, roles.ModeApply, io.Discard)
	require.NoError(t, err)

	runtimeDB := openDBAsRole(t, adminDSN, dbName, names.AppRuntime)

	// Tenant + contract sync store path (INSERT contract, claim/complete idempotency).
	_, err = runtimeDB.Exec(`
		INSERT INTO tenants (tenant_id, tenant_name) VALUES ('rt-tenant', 'Runtime Role Tenant')
		ON CONFLICT DO NOTHING`)
	require.NoError(t, err)

	_, _, err = insertContractVersion(ctx, runtimeDB, "rt-tenant", "rt.action",
		repeatHex('a', 64), "1", []byte(`{"schema_version":"1","action_name":"rt.action"}`),
		"low", "never", "embedded", nil, false, nil)
	require.NoError(t, err)

	claimed, err := claimContractSyncIdempotencyRecord(ctx, runtimeDB, "rt-tenant", "rt.action", "idem-rt-1", repeatHex('a', 64))
	require.NoError(t, err)
	require.True(t, claimed)
	require.NoError(t, completeContractSyncIdempotencyRecord(ctx, runtimeDB, "rt-tenant", "rt.action", "idem-rt-1", repeatHex('a', 64), 200, []byte(`{"ok":true}`)))

	// Evidence store path under runtime role.
	require.NoError(t, insertSDKSigningKey(ctx, runtimeDB, "rt-tenant", "ed25519:rt", "PUBLIC KEY ONLY", repeatHex('b', 64)))
	batchID, _, err := insertEvidenceBatch(ctx, runtimeDB, "rt-tenant", "ed25519:rt", "verified",
		repeatHex('c', 64), nil, strPtr(repeatHex('d', 64)), 1, 1, timePtr(time.Now().UTC()), nil, nil)
	require.NoError(t, err)
	require.NoError(t, insertEvidenceEvent(ctx, runtimeDB, "rt-tenant", "ed25519:rt", repeatHex('e', 64), batchID,
		[]byte(`{"event_type":"decision","redacted":true}`), "ev-rt-1", "decision", "rt.action", repeatHex('a', 64), nil, time.Now().UTC()))

	// Immutability still enforced for runtime. Least-privilege grants deny
	// UPDATE (42501) before the migration-069 trigger (55000) can fire — both
	// are acceptable fail-closed outcomes under the runtime role.
	_, err = runtimeDB.Exec(`UPDATE action_contract_versions SET risk = 'high' WHERE tenant_id = 'rt-tenant'`)
	require.Error(t, err)
	var pqErr *pq.Error
	require.True(t, errors.As(err, &pqErr), "expected PostgreSQL error, got %T: %v", err, err)
	require.Contains(t, []pq.ErrorCode{"55000", "42501"}, pqErr.Code)

	// Schema history inaccessible.
	_, err = runtimeDB.Exec(`SELECT count(*) FROM igris_schema_history`)
	require.Error(t, err)

	// Read-only can inspect, cannot mutate.
	roDB := openDBAsRole(t, adminDSN, dbName, names.ReadOnlyOperator)
	var n int
	require.NoError(t, roDB.QueryRow(`SELECT count(*) FROM action_contract_versions WHERE tenant_id = 'rt-tenant'`).Scan(&n))
	require.Equal(t, 1, n)
	_, err = roDB.Exec(`DELETE FROM action_contract_versions WHERE tenant_id = 'rt-tenant'`)
	require.Error(t, err)
}

func openDisposableConnectedDB(t *testing.T, adminDSN string) (*sql.DB, string) {
	t.Helper()
	admin, err := sql.Open("postgres", adminDSN)
	require.NoError(t, err)
	require.NoError(t, admin.Ping())
	name := "igris_rt_api_" + randomHexAPI(t, 6)
	_, err = admin.Exec(`CREATE DATABASE ` + pq.QuoteIdentifier(name))
	require.NoError(t, err)

	u, err := url.Parse(adminDSN)
	require.NoError(t, err)
	u.Path = "/" + name
	db, err := sql.Open("postgres", u.String())
	require.NoError(t, err)
	require.NoError(t, db.Ping())
	t.Cleanup(func() {
		db.Close()
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		_, _ = admin.ExecContext(ctx, `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, name)
		_, _ = admin.ExecContext(ctx, `DROP DATABASE IF EXISTS `+pq.QuoteIdentifier(name))
		_ = admin.Close()
	})
	return db, name
}

func openDBAsRole(t *testing.T, adminDSN, dbName, role string) *sql.DB {
	t.Helper()
	u, err := url.Parse(adminDSN)
	require.NoError(t, err)
	u.Path = "/" + dbName
	db, err := sql.Open("postgres", u.String())
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	require.NoError(t, db.Ping())
	_, err = db.Exec(`SET ROLE ` + pq.QuoteIdentifier(role))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func randomHexAPI(t *testing.T, n int) string {
	t.Helper()
	buf := make([]byte, n)
	_, err := rand.Read(buf)
	require.NoError(t, err)
	return hex.EncodeToString(buf)
}

func repeatHex(ch byte, n int) string {
	b := make([]byte, n)
	for i := range b {
		b[i] = ch
	}
	return string(b)
}

func strPtr(s string) *string { return &s }

func timePtr(t time.Time) *time.Time { return &t }
