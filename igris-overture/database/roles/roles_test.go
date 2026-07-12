package roles

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/database/bootstrap"
	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func TestRoleNamesValidation(t *testing.T) {
	_, err := NewRunner(Names{
		MigrationOwner:   "igris_migration_owner",
		AppRuntime:       "igris_migration_owner",
		ReadOnlyOperator: "igris_read_only_operator",
		BackupRestore:    "igris_backup_restore",
	})
	require.Error(t, err)

	_, err = NewRunner(Names{MigrationOwner: "Bad-Name"})
	require.Error(t, err)

	r, err := NewRunner(Names{})
	require.NoError(t, err)
	require.Equal(t, DefaultAppRuntime, r.Names.AppRuntime)
}

func TestRedactedDSN(t *testing.T) {
	require.Equal(t, "postgres://user:***@localhost:5432/db?sslmode=disable",
		RedactedDSN("postgres://user:s3cret@localhost:5432/db?sslmode=disable"))
	require.NotContains(t, RedactedDSN("host=localhost password=s3cret user=u"), "s3cret")
}

func TestPostgresRoleBoundaries(t *testing.T) {
	adminDSN := os.Getenv("IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN")
	if adminDSN == "" {
		t.Skip("set IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN to run disposable role boundary tests")
	}

	// Unique role-name suffix so parallel packages cannot collide on cluster roles.
	suffix := randomHex(t, 4)
	names := Names{
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

	bootstrapRunner, err := bootstrap.NewRunner()
	require.NoError(t, err)
	roleRunner, err := NewRunner(names)
	require.NoError(t, err)

	t.Run("provision and boundaries", func(t *testing.T) {
		db := openDisposableDatabase(t, adminDSN)
		ctx := testContext(t)

		_, err := bootstrapRunner.Run(ctx, db, bootstrap.ModeApply, io.Discard)
		require.NoError(t, err)

		// First apply.
		plan, err := roleRunner.Run(ctx, db, ModeApply, io.Discard)
		require.NoError(t, err)
		require.Empty(t, plan.Issues)

		// Repeat provisioning is idempotent.
		plan, err = roleRunner.Run(ctx, db, ModeApply, io.Discard)
		require.NoError(t, err)
		require.Empty(t, plan.Issues)

		// Preflight after apply is clean.
		plan, err = roleRunner.Run(ctx, db, ModePreflight, io.Discard)
		require.NoError(t, err)
		require.Empty(t, plan.Issues)

		// Runtime cannot create/alter/drop/own schema objects.
		runtimeDB := openAsRole(t, adminDSN, dbNameFromConn(t, db), names.AppRuntime)
		_, err = runtimeDB.Exec(`CREATE TABLE runtime_should_fail (id int)`)
		require.Error(t, err)
		_, err = runtimeDB.Exec(`ALTER TABLE action_contract_versions ADD COLUMN evil text`)
		require.Error(t, err)
		_, err = runtimeDB.Exec(`DROP TABLE action_contract_versions`)
		require.Error(t, err)
		_, err = runtimeDB.Exec(`CREATE FUNCTION evil() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$`)
		require.Error(t, err)

		// Runtime cannot disable triggers.
		_, err = runtimeDB.Exec(`ALTER TABLE action_contract_versions DISABLE TRIGGER action_contract_versions_immutable`)
		require.Error(t, err)

		// Runtime cannot mutate schema history.
		_, err = runtimeDB.Exec(`SELECT count(*) FROM igris_schema_history`)
		require.Error(t, err)
		_, err = runtimeDB.Exec(`INSERT INTO igris_schema_history (component, version, artifact_kind, checksum_sha256) VALUES ('connected-actions','x','migration', repeat('0',64))`)
		require.Error(t, err)
		_, err = runtimeDB.Exec(`UPDATE igris_schema_history SET version = version`)
		require.Error(t, err)
		_, err = runtimeDB.Exec(`DELETE FROM igris_schema_history`)
		require.Error(t, err)

		// Runtime can insert contracts/evidence and complete idempotency updates.
		_, err = runtimeDB.Exec(`
			INSERT INTO action_contract_versions (
				tenant_id, action_name, contract_hash, schema_version, contract,
				risk, approval_mode, execution_mode
			) VALUES (
				'tenant-role', 'role.probe', repeat('c', 64), '1', '{}'::jsonb,
				'low', 'never', 'embedded'
			)`)
		require.NoError(t, err, "runtime contract insert")

		_, err = runtimeDB.Exec(`
			INSERT INTO sdk_signing_keys (tenant_id, key_id, public_key_pem, fingerprint_sha256)
			VALUES ('tenant-role', 'ed25519:probe', 'PUBLIC', repeat('d', 64))`)
		require.NoError(t, err)

		var batchID string
		err = runtimeDB.QueryRow(`
			INSERT INTO sdk_evidence_batches (
				tenant_id, key_id, evidence_state, content_hash, chain_head,
				events_accepted, events_verified, verified_at
			) VALUES (
				'tenant-role', 'ed25519:probe', 'verified', repeat('e', 64), repeat('f', 64),
				1, 1, NOW()
			) RETURNING id`).Scan(&batchID)
		require.NoError(t, err)

		_, err = runtimeDB.Exec(`
			INSERT INTO sdk_evidence_events (
				tenant_id, key_id, event_hash, batch_id, event, event_id,
				event_type, action_name, contract_hash, timestamp_utc
			) VALUES (
				'tenant-role', 'ed25519:probe', repeat('1', 64), $1, '{}'::jsonb, 'ev-1',
				'decision', 'role.probe', repeat('c', 64), NOW()
			)`, batchID)
		require.NoError(t, err)

		// Immutable UPDATE/DELETE blocked by trigger (and no privilege for DELETE/UPDATE).
		_, err = runtimeDB.Exec(`UPDATE action_contract_versions SET risk = 'high' WHERE tenant_id = 'tenant-role'`)
		require.Error(t, err)
		_, err = runtimeDB.Exec(`DELETE FROM action_contract_versions WHERE tenant_id = 'tenant-role'`)
		require.Error(t, err)
		_, err = runtimeDB.Exec(`UPDATE sdk_evidence_batches SET issues = '[]'::jsonb WHERE id = $1`, batchID)
		require.Error(t, err)
		_, err = runtimeDB.Exec(`DELETE FROM sdk_evidence_events WHERE tenant_id = 'tenant-role'`)
		require.Error(t, err)

		// Idempotency INSERT + UPDATE allowed; cannot rewrite an immutable result row concept
		// (idempotency rows are mutable only for response completion fields).
		_, err = runtimeDB.Exec(`
			INSERT INTO contract_sync_idempotency (
				tenant_id, operation, action_name, idempotency_key,
				request_fingerprint, response_status, response_body
			) VALUES (
				'tenant-role', 'contract_sync', 'role.probe', 'idem-1',
				repeat('a', 64), 0, '{}'::jsonb
			)`)
		require.NoError(t, err)
		_, err = runtimeDB.Exec(`
			UPDATE contract_sync_idempotency
			SET response_status = 200, response_body = '{"ok":true}'::jsonb
			WHERE tenant_id = 'tenant-role' AND idempotency_key = 'idem-1'`)
		require.NoError(t, err)

		// Read-only cannot write.
		roDB := openAsRole(t, adminDSN, dbNameFromConn(t, db), names.ReadOnlyOperator)
		var n int
		require.NoError(t, roDB.QueryRow(`SELECT count(*) FROM action_contract_versions`).Scan(&n))
		require.GreaterOrEqual(t, n, 1)
		_, err = roDB.Exec(`INSERT INTO action_contract_versions (
			tenant_id, action_name, contract_hash, schema_version, contract,
			risk, approval_mode, execution_mode
		) VALUES ('tenant-role', 'x', repeat('0',64), '1', '{}'::jsonb, 'low', 'never', 'embedded')`)
		require.Error(t, err)
		_, err = roDB.Exec(`UPDATE action_contract_versions SET risk = 'low'`)
		require.Error(t, err)
		_, err = roDB.Exec(`DELETE FROM action_contract_versions`)
		require.Error(t, err)
		_, err = roDB.Exec(`TRUNCATE action_contract_versions`)
		require.Error(t, err)
		_, err = roDB.Exec(`ALTER TABLE action_contract_versions ADD COLUMN x int`)
		require.Error(t, err)

		// Backup role is not used by application tests — only SELECT.
		backupDB := openAsRole(t, adminDSN, dbNameFromConn(t, db), names.BackupRestore)
		require.NoError(t, backupDB.QueryRow(`SELECT count(*) FROM action_contract_versions`).Scan(&n))
		_, err = backupDB.Exec(`INSERT INTO tenants (tenant_id, tenant_name) VALUES ('nope', 'nope')`)
		require.Error(t, err)

		// PUBLIC has no unintended privileges on sensitive tables.
		for _, table := range SensitiveTables {
			var acl sql.NullString
			err := db.QueryRow(`
				SELECT c.relacl::text FROM pg_class c
				JOIN pg_namespace n ON n.oid = c.relnamespace
				WHERE n.nspname = 'public' AND c.relname = $1`, table).Scan(&acl)
			if err == sql.ErrNoRows {
				continue
			}
			require.NoError(t, err)
			if acl.Valid {
				require.NotRegexp(t, `(^|[,{])=`, acl.String, "PUBLIC privilege on %s: %s", table, acl.String)
			}
		}

		// Staging preflight passes.
		_, err = StagingPreflight(ctx, db, names, io.Discard)
		require.NoError(t, err)
	})

	t.Run("fail closed before provision", func(t *testing.T) {
		db := openDisposableDatabase(t, adminDSN)
		ctx := testContext(t)
		_, err := bootstrapRunner.Run(ctx, db, bootstrap.ModeApply, io.Discard)
		require.NoError(t, err)
		_, err = roleRunner.Run(ctx, db, ModePreflight, io.Discard)
		require.Error(t, err)
		require.Contains(t, err.Error(), "failed closed")
	})

	t.Run("runtime diagnostic detects migration owner", func(t *testing.T) {
		db := openDisposableDatabase(t, adminDSN)
		ctx := testContext(t)
		_, err := bootstrapRunner.Run(ctx, db, bootstrap.ModeApply, io.Discard)
		require.NoError(t, err)
		_, err = roleRunner.Run(ctx, db, ModeApply, io.Discard)
		require.NoError(t, err)

		// Connect as migration owner and diagnose.
		migDB := openAsRole(t, adminDSN, dbNameFromConn(t, db), names.MigrationOwner)
		d, err := DiagnoseRuntime(ctx, migDB, names.MigrationOwner)
		require.NoError(t, err)
		require.False(t, d.OK)
		require.True(t, d.IsMigrationOwner)

		rtDB := openAsRole(t, adminDSN, dbNameFromConn(t, db), names.AppRuntime)
		d, err = DiagnoseRuntime(ctx, rtDB, names.MigrationOwner)
		require.NoError(t, err)
		require.True(t, d.OK, "issues: %v", d.Issues)
	})
}

func openDisposableDatabase(t *testing.T, adminDSN string) *sql.DB {
	t.Helper()
	admin, err := sql.Open("postgres", adminDSN)
	require.NoError(t, err)
	require.NoError(t, admin.Ping())
	name := "igris_roles_test_" + randomHex(t, 6)
	_, err = admin.Exec(`CREATE DATABASE ` + pq.QuoteIdentifier(name))
	require.NoError(t, err)

	targetURL, err := url.Parse(adminDSN)
	require.NoError(t, err)
	targetURL.Path = "/" + name
	db, err := sql.Open("postgres", targetURL.String())
	require.NoError(t, err)
	require.NoError(t, db.Ping())
	t.Cleanup(func() {
		db.Close()
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		_, _ = admin.ExecContext(ctx, `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, name)
		_, dropErr := admin.ExecContext(ctx, `DROP DATABASE IF EXISTS `+pq.QuoteIdentifier(name))
		require.NoError(t, dropErr)
		require.NoError(t, admin.Close())
	})
	return db
}

func openAsRole(t *testing.T, adminDSN, dbName, role string) *sql.DB {
	t.Helper()
	// Use admin connection with SET ROLE via options is unreliable across pool;
	// instead grant the role ability to login without password under local trust
	// by connecting as admin and using SET ROLE on a single connection via
	// a simple driver wrapper: connect as admin then SET ROLE per session.
	adminURL, err := url.Parse(adminDSN)
	require.NoError(t, err)
	adminURL.Path = "/" + dbName
	db, err := sql.Open("postgres", adminURL.String())
	require.NoError(t, err)
	// Force a single connection so SET ROLE sticks for the pool.
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	require.NoError(t, db.Ping())
	_, err = db.Exec(`SET ROLE ` + pq.QuoteIdentifier(role))
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func dbNameFromConn(t *testing.T, db *sql.DB) string {
	t.Helper()
	var name string
	require.NoError(t, db.QueryRow(`SELECT current_database()`).Scan(&name))
	return name
}

func randomHex(t *testing.T, n int) string {
	t.Helper()
	buf := make([]byte, n)
	_, err := rand.Read(buf)
	require.NoError(t, err)
	return hex.EncodeToString(buf)
}

func testContext(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	t.Cleanup(cancel)
	return ctx
}

func TestPrintPlanOmitsSecrets(t *testing.T) {
	var b strings.Builder
	printPlan(&b, Plan{
		Mode:          ModePreflight,
		ConnectedUser: "postgres",
		Names:         NamesFromEnv(),
		RolesPresent:  map[string]bool{DefaultAppRuntime: false},
	})
	require.NotContains(t, b.String(), "password")
	require.NotContains(t, b.String(), "postgres://")
	require.Contains(t, b.String(), "role_mode=preflight")
}

// Ensure fmt import used when building without tests optimized away.
var _ = fmt.Sprintf
