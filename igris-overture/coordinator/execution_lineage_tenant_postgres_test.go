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

// TestExecutionLineageTenantIsolationPostgres exercises the real Postgres
// behavior of tenant-bound proof/lineage lookup after migration 058. It proves
// against a live database that:
//   - a tenant reads its own receipt hash/signature through SyncTaskProofState,
//   - a different tenant referencing the same execution_id cannot read it,
//   - a tenant-null legacy lineage row is never returned through the lookup,
//   - migration 058 deterministically backfills a tenant-null row from the
//     tenant-bound task_records source and then constrains tenant_id NOT NULL.
//
// Set IGRIS_OVERTURE_POSTGRES_TEST_DSN (or POSTGRES_TEST_DSN) to run it.
func TestExecutionLineageTenantIsolationPostgres(t *testing.T) {
	dsn := os.Getenv("IGRIS_OVERTURE_POSTGRES_TEST_DSN")
	if dsn == "" {
		dsn = os.Getenv("POSTGRES_TEST_DSN")
	}
	if dsn == "" {
		t.Skip("set IGRIS_OVERTURE_POSTGRES_TEST_DSN or POSTGRES_TEST_DSN to run execution_lineage tenant isolation Postgres test")
	}

	db, err := sql.Open("postgres", dsn)
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	t.Cleanup(func() { _ = db.Close() })

	schema := "lineage_tenant_test_" + strings.ReplaceAll(uuid.NewString(), "-", "_")
	_, err = db.Exec(`CREATE SCHEMA ` + schema)
	require.NoError(t, err)
	t.Cleanup(func() { _, _ = db.Exec(`DROP SCHEMA ` + schema + ` CASCADE`) })
	_, err = db.Exec(`SET search_path TO ` + schema + `, public`)
	require.NoError(t, err)

	for _, name := range []string{
		"006_execution_lineage.sql",
		"031_task_records.sql",
		"033_task_proof_state.sql",
	} {
		sqlBytes, err := os.ReadFile(filepath.Join("..", "database", "migrations", name))
		require.NoError(t, err)
		_, err = db.Exec(string(sqlBytes))
		require.NoError(t, err)
	}

	store := NewCheckpointStore(db)

	insertLineage := func(executionID, tenantID, receiptHash, signature string) {
		var tenant interface{}
		if tenantID == "" {
			tenant = nil
		} else {
			tenant = tenantID
		}
		_, err := db.Exec(`
			INSERT INTO execution_lineage
				(execution_id, agent_id, receipt_hash, signature, tenant_id, timestamp_utc)
			VALUES ($1, 'agent', $2, $3, $4, NOW())`,
			executionID, receiptHash, signature, tenant)
		require.NoError(t, err)
	}

	insertTaskWithProof := func(tenantID, executionID, expectedHash string) uuid.UUID {
		taskID := uuid.New()
		_, err := db.Exec(`
			INSERT INTO task_records
				(task_id, tenant_id, status, task_definition, proof_execution_id, proof_expected_hash, created_at)
			VALUES ($1, $2, 'completed', '{}'::jsonb, $3, $4, NOW())`,
			taskID, tenantID, executionID, expectedHash)
		require.NoError(t, err)
		return taskID
	}

	// Tenant A owns execution exec-A with a stored receipt.
	insertLineage("exec-A", "tenant-A", "hash-A", "sig-A")
	taskA := insertTaskWithProof("tenant-A", "exec-A", "hash-A")

	// Tenant B references the SAME execution_id but does not own the lineage.
	taskBSameExec := insertTaskWithProof("tenant-B", "exec-A", "hash-A")

	// A tenant-null legacy lineage row, referenced by a tenant-A task.
	insertLineage("exec-null", "", "hash-null", "sig-null")
	taskANull := insertTaskWithProof("tenant-A", "exec-null", "hash-null")

	// 1. Tenant A reads its own receipt.
	proofA, err := store.SyncTaskProofState(taskA, "tenant-A")
	require.NoError(t, err)
	require.NotNil(t, proofA)
	require.Equal(t, "hash-A", proofA.StoredHash)
	require.Equal(t, "sig-A", proofA.Signature)

	// 2. Tenant B cannot read tenant A's receipt even with the same execution_id:
	//    the lineage lookup is tenant-scoped, so no stored hash is returned.
	proofB, err := store.SyncTaskProofState(taskBSameExec, "tenant-B")
	require.NoError(t, err)
	require.NotNil(t, proofB)
	require.Empty(t, proofB.StoredHash, "tenant B must not see tenant A's stored receipt hash")
	require.Empty(t, proofB.Signature, "tenant B must not see tenant A's signature")

	// 3. A tenant-null lineage row is not returned through the tenant-scoped read.
	proofNull, err := store.SyncTaskProofState(taskANull, "tenant-A")
	require.NoError(t, err)
	require.NotNil(t, proofNull)
	require.Empty(t, proofNull.StoredHash, "tenant-null lineage must not be returned")
	require.Empty(t, proofNull.Signature, "tenant-null lineage must not be returned")

	// 4. Migration 058 backfills the tenant-null row deterministically from the
	//    tenant-bound task_records source, then constrains tenant_id.
	sqlBytes, err := os.ReadFile(filepath.Join("..", "database", "migrations", "058_execution_lineage_tenant_bound.sql"))
	require.NoError(t, err)
	_, err = db.Exec(string(sqlBytes))
	require.NoError(t, err)

	var backfilled string
	require.NoError(t, db.QueryRow(
		`SELECT tenant_id FROM execution_lineage WHERE execution_id = $1`, "exec-null",
	).Scan(&backfilled))
	require.Equal(t, "tenant-A", backfilled, "tenant-null row must be backfilled to its owning tenant only")

	// NOT NULL is now enforced: a tenant-null insert must fail.
	_, err = db.Exec(`
		INSERT INTO execution_lineage
			(execution_id, agent_id, receipt_hash, signature, tenant_id, timestamp_utc)
		VALUES ('exec-reject', 'agent', 'h', 's', NULL, NOW())`)
	require.Error(t, err, "tenant-null lineage insert must be rejected after migration 058")
}
