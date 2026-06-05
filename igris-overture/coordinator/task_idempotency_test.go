package coordinator

import (
	"database/sql/driver"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// TestCreateTaskUsesTenantScopedConflictTarget proves the task insert
// deduplicates on (tenant_id, idempotency_key) rather than idempotency_key
// alone. The composite conflict target is what makes idempotency tenant-scoped
// at the application layer and is required to match the tenant-scoped unique
// index from migration 057.
func TestCreateTaskUsesTenantScopedConflictTarget(t *testing.T) {
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
	store := NewCheckpointStore(db)

	inserted, err := store.CreateTask(&TaskRecord{
		TaskID:         uuid.New(),
		TenantID:       "tenant-a",
		IdempotencyKey: "same-key",
		TaskDefinition: json.RawMessage(`{"type":"noop"}`),
	})
	require.NoError(t, err)
	require.True(t, inserted)
	require.Equal(t, 0, driverState.remainingExecs())

	require.Contains(t, capturedQuery, "ON CONFLICT (tenant_id, idempotency_key) DO NOTHING")
	// The legacy global conflict target must be gone.
	require.NotContains(t, capturedQuery, "ON CONFLICT (idempotency_key)")

	// tenant_id must be supplied as an argument (not derived from anything the
	// caller put in the body downstream).
	foundTenant := false
	for _, a := range capturedArgs {
		if s, ok := a.Value.(string); ok && s == "tenant-a" {
			foundTenant = true
		}
	}
	require.True(t, foundTenant, "tenant_id must be bound into the insert")
}

// TestCreateTaskConflictReturnsNotInserted proves the dedup signal: when the
// composite (tenant_id, idempotency_key) already exists the insert affects zero
// rows and CreateTask reports inserted=false, which the coordinator turns into a
// tenant-scoped existing-task lookup.
func TestCreateTaskConflictReturnsNotInserted(t *testing.T) {
	t.Parallel()

	db, _ := newQueuedExecDB(t, queuedExecExpectation{rowsAffected: 0})
	store := NewCheckpointStore(db)

	inserted, err := store.CreateTask(&TaskRecord{
		TaskID:         uuid.New(),
		TenantID:       "tenant-a",
		IdempotencyKey: "same-key",
		TaskDefinition: json.RawMessage(`{"type":"noop"}`),
	})
	require.NoError(t, err)
	require.False(t, inserted)
}

// TestGetTaskByIdempotencyKeyQueryIsTenantScoped is a guard on the lookup SQL:
// the query must filter by tenant_id so a key can never resolve another tenant's
// task. The query text is asserted directly to keep the invariant from
// regressing.
func TestGetTaskByIdempotencyKeyQueryIsTenantScoped(t *testing.T) {
	t.Parallel()

	src := getTaskByIdempotencyKeySQL
	normalized := strings.Join(strings.Fields(src), " ")
	require.Contains(t, normalized, "WHERE tenant_id = $1 AND idempotency_key = $2")
}
