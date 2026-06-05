package coordinator

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

// TestTaskRecordsTenantScopedIdempotencyPostgres exercises the real Postgres
// uniqueness behavior after migration 057. It proves the database — not just
// application code — enforces tenant-scoped idempotency: two tenants may reuse
// the same key, a repeat within a tenant deduplicates, and the legacy global
// unique index is gone.
//
// Set IGRIS_OVERTURE_POSTGRES_TEST_DSN (or POSTGRES_TEST_DSN) to run it.
func TestTaskRecordsTenantScopedIdempotencyPostgres(t *testing.T) {
	dsn := os.Getenv("IGRIS_OVERTURE_POSTGRES_TEST_DSN")
	if dsn == "" {
		dsn = os.Getenv("POSTGRES_TEST_DSN")
	}
	if dsn == "" {
		t.Skip("set IGRIS_OVERTURE_POSTGRES_TEST_DSN or POSTGRES_TEST_DSN to run tenant-scoped idempotency Postgres test")
	}

	db, err := sql.Open("postgres", dsn)
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	t.Cleanup(func() { _ = db.Close() })

	schema := "idem_test_" + strings.ReplaceAll(uuid.NewString(), "-", "_")
	_, err = db.Exec(`CREATE SCHEMA ` + schema)
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = db.Exec(`DROP SCHEMA ` + schema + ` CASCADE`) })
	_, err = db.Exec(`SET search_path TO ` + schema + `, public`)
	require.NoError(t, err)

	for _, name := range []string{
		"031_task_records.sql",
		"057_task_records_tenant_scoped_idempotency.sql",
	} {
		sqlBytes, err := os.ReadFile(filepath.Join("..", "database", "migrations", name))
		require.NoError(t, err)
		_, err = db.Exec(string(sqlBytes))
		require.NoError(t, err)
	}

	// insertTask mirrors CreateTask's exact conflict target.
	insertTask := func(tenantID, key string) (uuid.UUID, int64) {
		taskID := uuid.New()
		res, err := db.Exec(`
			INSERT INTO task_records
				(task_id, tenant_id, status, task_definition, idempotency_key, created_at)
			VALUES ($1, $2, 'pending', '{}'::jsonb, $3, NOW())
			ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
			taskID, tenantID, key,
		)
		require.NoError(t, err)
		affected, err := res.RowsAffected()
		require.NoError(t, err)
		return taskID, affected
	}

	const key = "same-key"

	// Tenant A and Tenant B can both use the same idempotency key.
	taskA, affA := insertTask("tenant-a", key)
	require.Equal(t, int64(1), affA, "tenant A first insert should succeed")
	taskB, affB := insertTask("tenant-b", key)
	require.Equal(t, int64(1), affB, "tenant B may reuse the same key across tenants")
	require.NotEqual(t, taskA, taskB)

	// Repeats within the same tenant deduplicate (zero rows affected).
	_, affARepeat := insertTask("tenant-a", key)
	require.Equal(t, int64(0), affARepeat, "tenant A repeat should deduplicate")
	_, affBRepeat := insertTask("tenant-b", key)
	require.Equal(t, int64(0), affBRepeat, "tenant B repeat should deduplicate")

	// A tenant-scoped lookup returns only that tenant's task.
	var foundA, foundB string
	require.NoError(t, db.QueryRow(
		`SELECT task_id::text FROM task_records WHERE tenant_id = $1 AND idempotency_key = $2`,
		"tenant-a", key,
	).Scan(&foundA))
	require.Equal(t, taskA.String(), foundA)
	require.NoError(t, db.QueryRow(
		`SELECT task_id::text FROM task_records WHERE tenant_id = $1 AND idempotency_key = $2`,
		"tenant-b", key,
	).Scan(&foundB))
	require.Equal(t, taskB.String(), foundB)
	require.NotEqual(t, foundA, foundB)

	// A different tenant sees no task for the same key (no cross-tenant leak).
	err = db.QueryRow(
		`SELECT task_id::text FROM task_records WHERE tenant_id = $1 AND idempotency_key = $2`,
		"tenant-c", key,
	).Scan(new(string))
	require.ErrorIs(t, err, sql.ErrNoRows)

	// Index shape: the new composite unique index exists and the legacy global
	// unique index does not.
	var newIdxDef string
	require.NoError(t, db.QueryRow(
		`SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname = $2`,
		schema, "task_records_tenant_id_idempotency_key_idx",
	).Scan(&newIdxDef))
	require.Contains(t, newIdxDef, "UNIQUE")
	require.Contains(t, newIdxDef, "tenant_id")
	require.Contains(t, newIdxDef, "idempotency_key")

	var legacyCount int
	require.NoError(t, db.QueryRow(
		`SELECT count(*) FROM pg_indexes WHERE schemaname = $1 AND indexname = $2`,
		schema, "task_records_idempotency_key_idx",
	).Scan(&legacyCount))
	require.Equal(t, 0, legacyCount, "legacy global idempotency index must be dropped")
}
