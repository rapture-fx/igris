package api

import (
	"context"
	"database/sql/driver"
	"strings"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestCleanupExpiredRuntimeCallbackNoncesUsesRetentionFloor(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedRouteDB(t, nil, queuedRouteExecExpectation{
		rowsAffected: 2,
		check: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "DELETE FROM runtime_callback_nonces")
			require.Contains(t, query, "accepted_at < $1")
			require.Len(t, args, 1)
			cutoff, ok := args[0].Value.(time.Time)
			require.True(t, ok)
			age := time.Since(cutoff)
			require.GreaterOrEqual(t, age, runtimeCallbackFreshness)
			require.Less(t, age, runtimeCallbackFreshness+time.Minute)
		},
	})

	deleted, err := CleanupExpiredRuntimeCallbackNonces(context.Background(), db, time.Minute)
	require.NoError(t, err)
	require.Equal(t, int64(2), deleted)
	require.Equal(t, 0, queued.remainingExecs())
}

func TestRuntimeCallbackNonceReplayStillBlocksBeforeCleanup(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	db, queued := newQueuedRouteDB(t, nil, queuedRouteExecExpectation{rowsAffected: 0})
	err := reserveRuntimeCallbackNonce(coordinator.NewCheckpointStore(db), runtimeCallbackEnvelope{
		TenantID:        "tenant-replay",
		TaskID:          taskID.String(),
		RuntimeID:       "runtime-replay",
		CallbackType:    "complete",
		Nonce:           "nonce-replay",
		BodyDigest:      strings.Repeat("a", 64),
		TimestampUnixMs: time.Now().UnixMilli(),
	})

	require.EqualError(t, err, "runtime callback replay detected")
	require.Equal(t, 0, queued.remainingExecs())
}
