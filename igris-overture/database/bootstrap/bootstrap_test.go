package bootstrap

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

	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func TestEmbeddedArtifactsMatchPinnedChecksums(t *testing.T) {
	_, err := NewRunner()
	require.NoError(t, err)
}

func TestValidateServerVersion(t *testing.T) {
	require.ErrorContains(t, validateServerVersion("130012"), "version 14 or newer")
	require.NoError(t, validateServerVersion("140000"))
	require.NoError(t, validateServerVersion("170001"))
	require.Error(t, validateServerVersion("not-a-version"))
}

func TestPostgresBootstrapLifecycle(t *testing.T) {
	adminDSN := os.Getenv("IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN")
	if adminDSN == "" {
		t.Skip("set IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN to run disposable database bootstrap tests")
	}
	admin, err := sql.Open("postgres", adminDSN)
	require.NoError(t, err)
	defer admin.Close()
	var sessionUser, currentUser string
	require.NoError(t, admin.QueryRow(`SELECT session_user, current_user`).Scan(&sessionUser, &currentUser))
	require.Equal(t, sessionUser, currentUser)
	runner, err := NewOperatorRunner(currentUser)
	require.NoError(t, err)

	t.Run("explicit operator bootstrap applies actions baseline through v069", func(t *testing.T) {
		db := openDisposableDatabase(t, adminDSN)
		ctx := testContext(t)
		plan, err := runner.Run(ctx, db, ModePreflight, io.Discard)
		require.NoError(t, err)
		require.Equal(t, PathFresh, plan.Path)
		plan, err = runner.Run(ctx, db, ModeApply, io.Discard)
		require.NoError(t, err)
		require.Equal(t, PathCurrent, plan.Path)
		plan, err = runner.Run(ctx, db, ModeApply, io.Discard)
		require.NoError(t, err)
		require.Equal(t, PathCurrent, plan.Path)

		var historyCount int
		require.NoError(t, db.QueryRowContext(ctx, `SELECT count(*) FROM public.igris_schema_history WHERE component = $1`, Component).Scan(&historyCount))
		require.Equal(t, 4, historyCount)
		for _, table := range []string{"action_contract_versions", "sdk_evidence_batches", "sdk_evidence_events"} {
			var exists bool
			require.NoError(t, db.QueryRowContext(ctx, `SELECT to_regclass('public.' || $1) IS NOT NULL`, table).Scan(&exists))
			require.True(t, exists, table)
		}
	})

	t.Run("apply without migration-owner identity fails before DDL", func(t *testing.T) {
		db := openDisposableDatabase(t, adminDSN)
		ctx := testContext(t)
		inspector, err := NewRunner()
		require.NoError(t, err)
		_, err = inspector.Run(ctx, db, ModeApply, io.Discard)
		require.ErrorContains(t, err, "explicit migration-owner identity")
		var historyExists bool
		require.NoError(t, db.QueryRowContext(ctx, `SELECT to_regclass('public.igris_schema_history') IS NOT NULL`).Scan(&historyExists))
		require.False(t, historyExists)
	})

	t.Run("mismatched migration-owner credential fails before DDL", func(t *testing.T) {
		db := openDisposableDatabase(t, adminDSN)
		ctx := testContext(t)
		wrongOwner, err := NewOperatorRunner("igris_wrong_migration_owner")
		require.NoError(t, err)
		_, err = wrongOwner.Run(ctx, db, ModeApply, io.Discard)
		require.ErrorContains(t, err, "requires session_user and current_user")
		var historyExists bool
		require.NoError(t, db.QueryRowContext(ctx, `SELECT to_regclass('public.igris_schema_history') IS NOT NULL`).Scan(&historyExists))
		require.False(t, historyExists)
	})

	t.Run("dedicated migration-owner credential applies bootstrap", func(t *testing.T) {
		db, owner := openDisposableDatabaseAsMigrationOwner(t, adminDSN)
		ctx := testContext(t)
		operator, err := NewOperatorRunner(owner)
		require.NoError(t, err)
		plan, err := operator.Run(ctx, db, ModeApply, io.Discard)
		require.NoError(t, err)
		require.Equal(t, PathCurrent, plan.Path)
		var sessionUser, currentUser string
		require.NoError(t, db.QueryRowContext(ctx, `SELECT session_user, current_user`).Scan(&sessionUser, &currentUser))
		require.Equal(t, owner, sessionUser)
		require.Equal(t, owner, currentUser)
	})

	t.Run("explicit v066 adoption preserves data", func(t *testing.T) {
		db := openDisposableDatabase(t, adminDSN)
		ctx := testContext(t)
		_, err := db.ExecContext(ctx, string(BaselineSQL))
		require.NoError(t, err)
		_, err = db.ExecContext(ctx, `INSERT INTO public.tenants (tenant_id, tenant_name) VALUES ('bootstrap-survival', 'survives')`)
		require.NoError(t, err)

		plan, err := runner.Run(ctx, db, ModePreflight, io.Discard)
		require.NoError(t, err)
		require.Equal(t, PathAdoptV066, plan.Path)
		_, err = runner.Run(ctx, db, ModeApply, io.Discard)
		require.ErrorContains(t, err, "--mode=adopt-v066")
		plan, err = runner.Run(ctx, db, ModeAdoptV066, io.Discard)
		require.NoError(t, err)
		require.Equal(t, PathCurrent, plan.Path)

		var name string
		require.NoError(t, db.QueryRowContext(ctx, `SELECT tenant_name FROM public.tenants WHERE tenant_id = 'bootstrap-survival'`).Scan(&name))
		require.Equal(t, "survives", name)
	})

	t.Run("recorded v066 applies only forward migrations", func(t *testing.T) {
		db := openDisposableDatabase(t, adminDSN)
		ctx := testContext(t)
		_, err := db.ExecContext(ctx, string(BaselineSQL))
		require.NoError(t, err)
		_, err = db.ExecContext(ctx, `INSERT INTO public.tenants (tenant_id, tenant_name) VALUES ('recorded-v066', 'preserved')`)
		require.NoError(t, err)
		tx, err := db.BeginTx(ctx, nil)
		require.NoError(t, err)
		require.NoError(t, createHistory(ctx, tx))
		require.NoError(t, insertHistory(ctx, tx, runner.baseline))
		require.NoError(t, tx.Commit())

		plan, err := runner.Run(ctx, db, ModePreflight, io.Discard)
		require.NoError(t, err)
		require.Equal(t, PathForward, plan.Path)
		plan, err = runner.Run(ctx, db, ModeApply, io.Discard)
		require.NoError(t, err)
		require.Equal(t, PathCurrent, plan.Path)

		var name string
		require.NoError(t, db.QueryRowContext(ctx, `SELECT tenant_name FROM public.tenants WHERE tenant_id = 'recorded-v066'`).Scan(&name))
		require.Equal(t, "preserved", name)
	})

	t.Run("unknown nonempty schema is refused", func(t *testing.T) {
		db := openDisposableDatabase(t, adminDSN)
		ctx := testContext(t)
		_, err := db.ExecContext(ctx, `CREATE TABLE public.unknown_state (id integer PRIMARY KEY)`)
		require.NoError(t, err)
		_, err = runner.Run(ctx, db, ModeApply, io.Discard)
		require.ErrorContains(t, err, "refusing non-empty unrecorded public schema")
	})

	t.Run("wrong baseline checksum is refused", func(t *testing.T) {
		db := openDisposableDatabase(t, adminDSN)
		ctx := testContext(t)
		_, err := runner.Run(ctx, db, ModeApply, io.Discard)
		require.NoError(t, err)
		_, err = db.ExecContext(ctx, `UPDATE public.igris_schema_history SET checksum_sha256 = $1 WHERE component = $2 AND version = $3`, strings.Repeat("0", 64), Component, BaselineVersion)
		require.NoError(t, err)
		_, err = runner.Run(ctx, db, ModePreflight, io.Discard)
		require.ErrorContains(t, err, "history checksum mismatch")
	})

	t.Run("ledger schema mismatch is refused", func(t *testing.T) {
		db := openDisposableDatabase(t, adminDSN)
		ctx := testContext(t)
		_, err := runner.Run(ctx, db, ModeApply, io.Discard)
		require.NoError(t, err)
		_, err = db.ExecContext(ctx, `DROP TRIGGER sdk_evidence_events_immutable ON public.sdk_evidence_events`)
		require.NoError(t, err)
		_, err = runner.Run(ctx, db, ModePreflight, io.Discard)
		require.ErrorContains(t, err, "ledger claims v069 but required schema objects differ")
	})

	t.Run("interrupted bootstrap rolls back", func(t *testing.T) {
		db := openDisposableDatabase(t, adminDSN)
		ctx := testContext(t)
		broken := *runner
		broken.forward = append([]Artifact(nil), runner.forward...)
		broken.forward[0].SQL = []byte(`SELECT definitely_not_a_function()`)
		err := broken.apply(ctx, db, Plan{Path: PathFresh})
		require.Error(t, err)
		_, count, manifestErr := schemaHashDB(ctx, db)
		require.NoError(t, manifestErr)
		require.Zero(t, count)
	})

	t.Run("concurrent bootstrap advisory locking", func(t *testing.T) {
		db := openDisposableDatabase(t, adminDSN)
		ctx := testContext(t)

		// Hold the same advisory xact lock the bootstrap path uses, then start
		// apply in another session. The second session must block until release
		// and still produce a correct v069 state (no double-apply corruption).
		lockConn, err := db.Conn(ctx)
		require.NoError(t, err)
		defer lockConn.Close()
		tx, err := lockConn.BeginTx(ctx, nil)
		require.NoError(t, err)
		_, err = tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(438774918066)`)
		require.NoError(t, err)

		started := make(chan struct{})
		done := make(chan error, 1)
		go func() {
			close(started)
			_, applyErr := runner.Run(ctx, db, ModeApply, io.Discard)
			done <- applyErr
		}()
		<-started
		// Give the apply goroutine time to block on the advisory lock.
		time.Sleep(250 * time.Millisecond)
		select {
		case err := <-done:
			t.Fatalf("bootstrap returned before lock release: %v", err)
		default:
		}
		require.NoError(t, tx.Commit())
		require.NoError(t, <-done)

		plan, err := runner.Run(ctx, db, ModePreflight, io.Discard)
		require.NoError(t, err)
		require.Equal(t, PathCurrent, plan.Path)
	})
}

func openDisposableDatabase(t *testing.T, adminDSN string) *sql.DB {
	t.Helper()
	admin, err := sql.Open("postgres", adminDSN)
	require.NoError(t, err)
	require.NoError(t, admin.Ping())
	name := "igris_bootstrap_test_" + randomHex(t, 6)
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

func openDisposableDatabaseAsMigrationOwner(t *testing.T, adminDSN string) (*sql.DB, string) {
	t.Helper()
	admin, err := sql.Open("postgres", adminDSN)
	require.NoError(t, err)
	require.NoError(t, admin.Ping())
	owner := "igris_migration_test_" + randomHex(t, 4)
	password := randomHex(t, 24)
	name := "igris_bootstrap_owner_test_" + randomHex(t, 6)
	_, err = admin.Exec(`CREATE ROLE ` + pq.QuoteIdentifier(owner) + ` LOGIN PASSWORD ` + pq.QuoteLiteral(password) +
		` NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS`)
	require.NoError(t, err)
	_, err = admin.Exec(`CREATE DATABASE ` + pq.QuoteIdentifier(name) + ` OWNER ` + pq.QuoteIdentifier(owner))
	require.NoError(t, err)

	targetURL, err := url.Parse(adminDSN)
	require.NoError(t, err)
	targetURL.Path = "/" + name
	targetURL.User = url.UserPassword(owner, password)
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
		_, dropRoleErr := admin.ExecContext(ctx, `DROP ROLE IF EXISTS `+pq.QuoteIdentifier(owner))
		require.NoError(t, dropRoleErr)
		require.NoError(t, admin.Close())
	})
	return db, owner
}

func randomHex(t *testing.T, bytes int) string {
	t.Helper()
	buf := make([]byte, bytes)
	_, err := rand.Read(buf)
	require.NoError(t, err)
	return hex.EncodeToString(buf)
}

func testContext(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	t.Cleanup(cancel)
	return ctx
}

func TestPrintPlanDoesNotContainDatabaseURL(t *testing.T) {
	var output strings.Builder
	printPlan(&output, Plan{Path: PathFresh, Baseline: BaselineVersion, SchemaHash: "hash"})
	require.NotContains(t, output.String(), "postgres://")
	require.Contains(t, output.String(), fmt.Sprintf("baseline=%s", BaselineVersion))
}
