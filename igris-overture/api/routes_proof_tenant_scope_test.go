package api

import (
	"context"
	"database/sql/driver"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"
)

// TestListReceiptsQueryIsTenantScoped drives the live ListReceipts handler and
// captures the SQL it actually issues, proving the receipt/lineage read binds
// the authenticated tenant into the WHERE clause and never accepts
// `tenant_id IS NULL`. The tenant comes from the auth middleware
// (clerk_user_id), not from the request — a tenant-null or other-tenant row can
// therefore never match.
func TestListReceiptsQueryIsTenantScoped(t *testing.T) {
	t.Parallel()

	timestamp := time.Date(2026, 6, 5, 10, 0, 0, 0, time.UTC)

	var capturedQuery string
	var capturedArgs []driver.NamedValue
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			// schema capability probe
			columns: []string{"task_proof_lookup", "task_proof_detail", "permission_audit", "lineage_violation_detail"},
			rows:    [][]driver.Value{{false, false, false, false}},
		},
		{
			columns: []string{
				"id", "execution_id", "agent_id", "runtime_id", "runtime_label", "timestamp_utc",
				"receipt_hash", "previous_hash", "signature", "cpu_time_ms", "memory_peak_mb",
				"tool_calls", "wall_time_ms", "violation_occurred", "proof_status", "violation_details",
			},
			rows: [][]driver.Value{{
				"receipt-1", "exec-1", "agent-1", "runtime-1", "", timestamp,
				"hash-1", "hash-0", "sig-1", int64(1), int64(1), int64(1), int64(1), false, "verified", nil,
			}},
			checkArgs: func(query string, args []driver.NamedValue) {
				capturedQuery = query
				capturedArgs = args
			},
		},
	})

	handler := NewProofHandler(db)
	app := fiber.New()
	app.Get("/proof/receipts", func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-a")
		return handler.ListReceipts(c)
	})

	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/proof/receipts?limit=20", nil))
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Equal(t, 0, queued.remainingQueries())

	normalized := strings.Join(strings.Fields(capturedQuery), " ")
	require.Contains(t, normalized, "WHERE el.tenant_id = $1",
		"receipt list must filter by the authenticated tenant")
	require.NotContains(t, strings.ToUpper(normalized), "TENANT_ID IS NULL",
		"receipt list must not accept tenant-null rows")
	// The join onto execution_context must be tenant-matched, not tenant-null.
	require.Contains(t, normalized, "ec.tenant_id = el.tenant_id")

	require.NotEmpty(t, capturedArgs)
	require.Equal(t, "tenant-a", capturedArgs[0].Value,
		"tenant_id ($1) must be the authenticated tenant from middleware")
}

func TestFetchReceiptVerifyRowExecutionContextJoinIsTenantScoped(t *testing.T) {
	t.Parallel()

	timestamp := time.Date(2026, 6, 5, 10, 0, 0, 0, time.UTC)
	var capturedQuery string
	var capturedArgs []driver.NamedValue
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{
				"id", "execution_id", "agent_id", "runtime_id", "runtime_label",
				"transaction_id", "transaction_hash", "cpu_time_ms", "wall_time_ms",
				"memory_peak_mb", "fs_bytes_written", "tool_calls", "violation_occurred",
				"receipt_hash", "previous_hash", "signature", "timestamp_utc",
				"runtime_public_key", "proof_status",
			},
			rows: [][]driver.Value{{
				"receipt-1", "exec-1", "agent-1", "runtime-1", "Runtime 1",
				"", "", int64(1), int64(1), int64(1), int64(0), int64(1), false,
				"hash-1", "hash-0", "sig-1", timestamp, "", "verified",
			}},
			checkArgs: func(query string, args []driver.NamedValue) {
				capturedQuery = query
				capturedArgs = args
			},
		},
	})

	handler := NewProofHandler(db)
	row, err := handler.fetchReceiptVerifyRow(context.Background(), "exec-1", "tenant-a", executionSchemaCapabilities{})
	require.NoError(t, err)
	require.Equal(t, "verified", row.proofStatus)
	require.Equal(t, 0, queued.remainingQueries())

	normalized := strings.Join(strings.Fields(capturedQuery), " ")
	require.Contains(t, normalized, "ec.tenant_id = el.tenant_id")
	require.NotContains(t, strings.ToUpper(normalized), "TENANT_ID IS NULL")
	require.Len(t, capturedArgs, 2)
	require.Equal(t, "exec-1", capturedArgs[0].Value)
	require.Equal(t, "tenant-a", capturedArgs[1].Value)
}

// TestProofAndLineageReadPathsHaveNoTenantNullException is a source-level
// regression guard for the proof/lineage read paths that are awkward to drive
// end-to-end (receipt verification, chain traversal, fleet device lineage).
// None of them may reintroduce `tenant_id IS NULL`, which previously let a
// tenant-null (legacy) lineage row bypass tenant isolation.
func TestProofAndLineageReadPathsHaveNoTenantNullException(t *testing.T) {
	t.Parallel()

	for _, file := range []string{
		"routes_proof.go",
		"routes_execution.go",
		"routes_fleet.go",
	} {
		src, err := os.ReadFile(file)
		require.NoError(t, err)
		upper := strings.ToUpper(string(src))
		require.NotContains(t, upper, "TENANT_ID IS NULL",
			"%s must not query execution_lineage with tenant_id IS NULL", file)
	}
}
