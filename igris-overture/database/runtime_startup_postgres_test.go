package database

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func TestRuntimeConfigNeverFallsBackToMigrationCredentials(t *testing.T) {
	t.Setenv("DATABASE_URL_RUNTIME", "")
	t.Setenv("DATABASE_URL", "")
	t.Setenv("POSTGRES_URL", "")
	t.Setenv("DATABASE_URL_MIGRATION", "postgres://migration-owner@localhost/igris")
	t.Setenv("ENABLE_PERSISTENCE", "true")

	config := NewConfig()
	require.Empty(t, config.DatabaseURL)
	require.False(t, config.EnablePersistence)
}

func TestApplicationStartupDoesNotMigrateOutdatedDatabase(t *testing.T) {
	adminDSN := os.Getenv("IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN")
	if adminDSN == "" {
		t.Skip("set IGRIS_BOOTSTRAP_POSTGRES_ADMIN_DSN to run runtime startup boundary test")
	}

	admin, err := sql.Open("postgres", adminDSN)
	require.NoError(t, err)
	require.NoError(t, admin.Ping())
	name := "igris_runtime_startup_test_" + runtimeRandomHex(t, 6)
	_, err = admin.Exec(`CREATE DATABASE ` + pq.QuoteIdentifier(name))
	require.NoError(t, err)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		_, _ = admin.ExecContext(ctx, `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, name)
		_, dropErr := admin.ExecContext(ctx, `DROP DATABASE IF EXISTS `+pq.QuoteIdentifier(name))
		require.NoError(t, dropErr)
		require.NoError(t, admin.Close())
	})

	targetURL, err := url.Parse(adminDSN)
	require.NoError(t, err)
	targetURL.Path = "/" + name
	targetDSN := targetURL.String()
	setup, err := sql.Open("postgres", targetDSN)
	require.NoError(t, err)
	require.NoError(t, setup.Ping())
	_, err = setup.Exec(`CREATE TABLE public.pre_v069_marker (id integer PRIMARY KEY)`)
	require.NoError(t, err)
	require.NoError(t, setup.Close())

	db, err := Connect(&Config{
		DatabaseURL:       targetDSN,
		EnablePersistence: true,
		FailFastOnError:   true,
		MaxOpenConns:      2,
		MaxIdleConns:      1,
		ConnMaxLifetime:   time.Minute,
		ConnMaxIdleTime:   time.Minute,
	})
	require.NoError(t, err)
	require.NotNil(t, db)
	t.Cleanup(func() { require.NoError(t, db.Close()) })

	var markerExists, historyExists, v069TableExists bool
	require.NoError(t, db.QueryRow(`SELECT to_regclass('public.pre_v069_marker') IS NOT NULL`).Scan(&markerExists))
	require.NoError(t, db.QueryRow(`SELECT to_regclass('public.igris_schema_history') IS NOT NULL`).Scan(&historyExists))
	require.NoError(t, db.QueryRow(`SELECT to_regclass('public.action_contract_versions') IS NOT NULL`).Scan(&v069TableExists))
	require.True(t, markerExists)
	require.False(t, historyExists)
	require.False(t, v069TableExists)
}

func runtimeRandomHex(t *testing.T, n int) string {
	t.Helper()
	buf := make([]byte, n)
	_, err := rand.Read(buf)
	require.NoError(t, err)
	return hex.EncodeToString(buf)
}
