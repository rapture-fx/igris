package coordinator

import (
	"database/sql/driver"
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// TestSaveExecutionLineageRejectsMissingTenant proves the write-time fail-closed
// guard: a product lineage/proof record with no tenant_id is refused before any
// INSERT runs. execution_lineage is a tenant-bound trust object — persisting a
// tenant-null row would create a receipt that no normal, tenant-scoped read path
// can return, so it must never be written.
func TestSaveExecutionLineageRejectsMissingTenant(t *testing.T) {
	t.Parallel()

	for _, tenant := range []string{"", "   ", "\t"} {
		db, driverState := newQueuedExecDB(t, queuedExecExpectation{rowsAffected: 1})

		err := saveExecutionLineage(db, &ExecutionLineageRecord{
			ExecutionID: "exec-1",
			ReceiptHash: "hash-1",
			TenantID:    tenant,
		})

		require.ErrorIs(t, err, ErrExecutionLineageMissingTenant)
		// No INSERT must have been issued: the guard fails closed before the DB.
		require.Equal(t, 1, driverState.remainingExecs(),
			"tenant=%q should be rejected before any exec", tenant)
	}
}

// TestSaveExecutionLineagePersistsTenantBoundRecord proves a valid tenant-bound
// record is persisted and that tenant_id is bound into the INSERT arguments.
func TestSaveExecutionLineagePersistsTenantBoundRecord(t *testing.T) {
	t.Parallel()

	var capturedQuery string
	var capturedArgs []driver.NamedValue
	db, driverState := newQueuedExecDB(t, queuedExecExpectation{
		rowsAffected: 1,
		check: func(query string, args []driver.NamedValue) {
			capturedQuery = query
			capturedArgs = args
		},
	})

	err := saveExecutionLineage(db, &ExecutionLineageRecord{
		ExecutionID: "exec-1",
		ReceiptHash: "hash-1",
		TenantID:    "tenant-a",
	})
	require.NoError(t, err)
	require.Equal(t, 0, driverState.remainingExecs())

	require.Contains(t, capturedQuery, "INSERT INTO execution_lineage")
	foundTenant := false
	for _, a := range capturedArgs {
		if s, ok := a.Value.(string); ok && s == "tenant-a" {
			foundTenant = true
		}
	}
	require.True(t, foundTenant, "tenant_id must be bound into the lineage INSERT")
}

// TestSaveExecutionContextRejectsMissingTenant proves the execution_context
// write path is fail-closed before SQL when a tenant cannot be established.
func TestSaveExecutionContextRejectsMissingTenant(t *testing.T) {
	t.Parallel()

	for _, tenant := range []string{"", "   ", "\t"} {
		db, driverState := newQueuedExecDB(t, queuedExecExpectation{rowsAffected: 1})

		err := saveExecutionContext(db, &ExecutionContextRecord{
			ExecutionID: "exec-context-1",
			TenantID:    tenant,
		})

		require.ErrorIs(t, err, ErrExecutionContextMissingTenant)
		require.Equal(t, 1, driverState.remainingExecs(),
			"tenant=%q should be rejected before any exec", tenant)
	}
}

// TestSaveExecutionContextPersistsTenantBoundRecord proves tenant_id is bound
// into the INSERT and conflict updates are limited to the same tenant.
func TestSaveExecutionContextPersistsTenantBoundRecord(t *testing.T) {
	t.Parallel()

	var capturedQuery string
	var capturedArgs []driver.NamedValue
	db, driverState := newQueuedExecDB(t, queuedExecExpectation{
		rowsAffected: 1,
		check: func(query string, args []driver.NamedValue) {
			capturedQuery = query
			capturedArgs = args
		},
	})

	err := saveExecutionContext(db, &ExecutionContextRecord{
		ExecutionID:        "exec-context-1",
		TenantID:           " tenant-a ",
		RuntimeID:          "runtime-a",
		VerificationStatus: "verified",
		ReceiptHash:        "hash-a",
	})
	require.NoError(t, err)
	require.Equal(t, 0, driverState.remainingExecs())

	normalized := strings.Join(strings.Fields(capturedQuery), " ")
	require.Contains(t, normalized, "INSERT INTO execution_context")
	require.Contains(t, normalized, "WHERE execution_context.tenant_id = EXCLUDED.tenant_id")
	require.NotContains(t, strings.ToUpper(normalized), "TENANT_ID IS NULL")
	require.Equal(t, "tenant-a", capturedArgs[1].Value)
}

// TestSaveExecutionContextRejectsCrossTenantConflict proves a duplicate
// execution_id cannot update an existing row owned by a different tenant.
func TestSaveExecutionContextRejectsCrossTenantConflict(t *testing.T) {
	t.Parallel()

	db, driverState := newQueuedExecDB(t, queuedExecExpectation{rowsAffected: 0})

	err := saveExecutionContext(db, &ExecutionContextRecord{
		ExecutionID: "exec-context-1",
		TenantID:    "tenant-b",
		RuntimeID:   "runtime-b",
	})

	require.ErrorIs(t, err, ErrExecutionContextTenantMismatch)
	require.Equal(t, 0, driverState.remainingExecs())
}

// TestSyncTaskProofLineageLookupIsTenantScoped is a guard on the proof-state
// lineage read: the query must filter by tenant_id and must never reintroduce
// `OR tenant_id IS NULL`, which previously let tenant-null (legacy) receipts
// leak into another tenant's proof state.
func TestSyncTaskProofLineageLookupIsTenantScoped(t *testing.T) {
	t.Parallel()

	normalized := strings.Join(strings.Fields(syncTaskProofLineageLookupSQL), " ")
	require.Contains(t, normalized, "WHERE execution_id = $1 AND tenant_id = $2")
	require.NotContains(t, strings.ToUpper(normalized), "IS NULL")
}

// TestExecutionContextSourceHasNoTenantNullProductException guards coordinator
// SQL from reintroducing a tenant-null execution_context bypass.
func TestExecutionContextSourceHasNoTenantNullProductException(t *testing.T) {
	t.Parallel()

	src, err := os.ReadFile("execution_context.go")
	require.NoError(t, err)
	upper := strings.ToUpper(string(src))
	require.NotContains(t, upper, "TENANT_ID IS NULL")
	require.NotContains(t, upper, "OR EXECUTION_CONTEXT.TENANT_ID IS NULL")
}

// TestSyncTaskProofStateReadsTenantBoundLineage exercises the full happy path:
// the task lookup and the lineage lookup both run tenant-scoped and the stored
// receipt hash/signature flow back into the proof state.
func TestSyncTaskProofStateReadsTenantBoundLineage(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedCheckpointDB(t,
		[]queuedQueryExpectation{
			// task_records lookup: returns proof_execution_id + expected hash.
			{columns: []string{"proof_execution_id", "proof_expected_hash"}, values: []driver.Value{"exec-1", "hash-1"}},
			// execution_lineage lookup: returns stored hash + signature.
			{columns: []string{"receipt_hash", "signature"}, values: []driver.Value{"hash-1", "sig-1"}},
		},
		// updateTaskProofState exec.
		queuedExecExpectation{rowsAffected: 1},
	)
	store := NewCheckpointStore(db)

	proof, err := store.SyncTaskProofState(uuid.New(), "tenant-a")
	require.NoError(t, err)
	require.NotNil(t, proof)
	require.Equal(t, "hash-1", proof.StoredHash)
	require.Equal(t, "sig-1", proof.Signature)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}
