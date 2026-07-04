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
				(task_id, tenant_id, status, task_definition, idempotency_key, proof_execution_id, proof_expected_hash, created_at)
			VALUES ($1, $2, 'completed', '{}'::jsonb, $3, $4, $5, NOW())`,
			taskID, tenantID, "idem-"+taskID.String(), executionID, expectedHash)
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

// TestExecutionContextTenantBoundMigrationPostgres exercises migration 060
// against a live Postgres database. It proves deterministic backfill from
// task_records and execution_lineage, proves tenant-null inserts are rejected
// when all rows are resolvable, and proves ambiguous legacy rows are not
// guessed.
//
// Set IGRIS_OVERTURE_POSTGRES_TEST_DSN (or POSTGRES_TEST_DSN) to run it.
func TestExecutionContextTenantBoundMigrationPostgres(t *testing.T) {
	dsn := os.Getenv("IGRIS_OVERTURE_POSTGRES_TEST_DSN")
	if dsn == "" {
		dsn = os.Getenv("POSTGRES_TEST_DSN")
	}
	if dsn == "" {
		t.Skip("set IGRIS_OVERTURE_POSTGRES_TEST_DSN or POSTGRES_TEST_DSN to run execution_context tenant-bound Postgres test")
	}

	db, err := sql.Open("postgres", dsn)
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	t.Cleanup(func() { _ = db.Close() })

	applyBase := func(schema string) {
		t.Helper()
		_, err := db.Exec(`CREATE SCHEMA ` + schema)
		require.NoError(t, err)
		t.Cleanup(func() { _, _ = db.Exec(`DROP SCHEMA ` + schema + ` CASCADE`) })
		_, err = db.Exec(`SET search_path TO ` + schema + `, public`)
		require.NoError(t, err)

		for _, name := range []string{
			"006_execution_lineage.sql",
			"031_task_records.sql",
			"033_task_proof_state.sql",
			"047_execution_context.sql",
		} {
			sqlBytes, err := os.ReadFile(filepath.Join("..", "database", "migrations", name))
			require.NoError(t, err)
			_, err = db.Exec(string(sqlBytes))
			require.NoError(t, err)
		}
	}

	insertTask := func(taskID uuid.UUID, tenantID, idempotencyKey, proofExecutionID string) {
		t.Helper()
		_, err := db.Exec(`
			INSERT INTO task_records
				(task_id, tenant_id, status, task_definition, idempotency_key, proof_execution_id, proof_expected_hash, created_at)
			VALUES ($1, $2, 'completed', '{}'::jsonb, $3, NULLIF($4, ''), 'hash', NOW())`,
			taskID, tenantID, idempotencyKey, proofExecutionID)
		require.NoError(t, err)
	}

	runMigration060 := func() {
		t.Helper()
		sqlBytes, err := os.ReadFile(filepath.Join("..", "database", "migrations", "060_execution_context_tenant_bound.sql"))
		require.NoError(t, err)
		_, err = db.Exec(string(sqlBytes))
		require.NoError(t, err)
	}

	resolvedSchema := "context_tenant_resolved_" + strings.ReplaceAll(uuid.NewString(), "-", "_")
	applyBase(resolvedSchema)

	taskDirect := uuid.New()
	insertTask(taskDirect, "tenant-direct", "idem-direct", "")
	_, err = db.Exec(`INSERT INTO execution_context (execution_id, tenant_id, task_id) VALUES ($1, NULL, $2)`, "exec-direct", taskDirect)
	require.NoError(t, err)

	taskProof := uuid.New()
	insertTask(taskProof, "tenant-proof", "idem-proof", "exec-proof")
	_, err = db.Exec(`INSERT INTO execution_context (execution_id, tenant_id) VALUES ($1, NULL)`, "exec-proof")
	require.NoError(t, err)

	_, err = db.Exec(`
		INSERT INTO execution_lineage
			(execution_id, agent_id, receipt_hash, signature, tenant_id, timestamp_utc)
		VALUES ('exec-lineage', 'agent', 'hash-lineage', 'sig-lineage', 'tenant-lineage', NOW())`)
	require.NoError(t, err)
	_, err = db.Exec(`INSERT INTO execution_context (execution_id, tenant_id) VALUES ($1, NULL)`, "exec-lineage")
	require.NoError(t, err)

	runMigration060()

	for executionID, wantTenant := range map[string]string{
		"exec-direct":  "tenant-direct",
		"exec-proof":   "tenant-proof",
		"exec-lineage": "tenant-lineage",
	} {
		var gotTenant string
		require.NoError(t, db.QueryRow(`SELECT tenant_id FROM execution_context WHERE execution_id = $1`, executionID).Scan(&gotTenant))
		require.Equal(t, wantTenant, gotTenant)
	}

	_, err = db.Exec(`INSERT INTO execution_context (execution_id, tenant_id) VALUES ('exec-reject-null', NULL)`)
	require.Error(t, err, "tenant-null execution_context insert must be rejected after migration 060 when all rows are resolvable")

	ambiguousSchema := "context_tenant_ambiguous_" + strings.ReplaceAll(uuid.NewString(), "-", "_")
	applyBase(ambiguousSchema)

	insertTask(uuid.New(), "tenant-A", "idem-a", "exec-ambiguous")
	insertTask(uuid.New(), "tenant-B", "idem-b", "exec-ambiguous")
	_, err = db.Exec(`INSERT INTO execution_context (execution_id, tenant_id) VALUES ($1, NULL)`, "exec-ambiguous")
	require.NoError(t, err)

	runMigration060()

	var ambiguousTenant sql.NullString
	require.NoError(t, db.QueryRow(`SELECT tenant_id FROM execution_context WHERE execution_id = $1`, "exec-ambiguous").Scan(&ambiguousTenant))
	require.False(t, ambiguousTenant.Valid, "ambiguous tenant-null execution_context row must not be guessed")
	_, err = db.Exec(`INSERT INTO execution_context (execution_id, tenant_id) VALUES ('exec-still-legacy', NULL)`)
	require.NoError(t, err, "migration 060 must not apply NOT NULL while unresolvable tenant-null rows remain")
}
