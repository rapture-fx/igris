package api

import (
	"database/sql/driver"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// scannerColumns is the exact set of columns scanActionDefinition reads, in
// order. handleActionList's SELECT must name every one of them — if it omits
// any (as it once did with fallback_policy), the scanner's destination count
// no longer matches the row's column count and every non-empty list returns
// `db_error`. The empty-list tests never caught this because the scanner only
// runs when there is at least one row.
var scannerColumns = []string{
	"id", "tenant_id", "name", "display_name", "description",
	"target_type", "target_url", "method",
	"policy_preset", "replay_class", "approval_required", "irreversible",
	"secret_refs", "target_metadata", "fallback_policy",
	"created_at", "updated_at", "archived_at",
}

// TestActionsList_SelectNamesEveryScannerColumn locks the list SELECT to the
// scanner contract. A non-empty row is fed through the real handler so the
// scanner actually executes; the checkArgs hook asserts the SELECT string
// names each scanner column. This fails fast if a future edit drops a column
// from either side.
func TestActionsList_SelectNamesEveryScannerColumn(t *testing.T) {
	const tenantA = "tenant-A-list-cols"

	now := time.Now().UTC()
	listRow := queuedRouteQueryExpectation{
		columns: scannerColumns,
		rows: [][]driver.Value{{
			"act-1", tenantA, "smoke_ping", "Smoke Ping", "desc",
			"hosted_api", "https://example.com/ping", "POST",
			"Read-only", "read_only", false, false,
			[]byte(`[]`), []byte(`{}`), []byte(`{"enabled":false}`),
			now, now, nil,
		}},
		checkArgs: func(query string, _ []driver.NamedValue) {
			for _, col := range scannerColumns {
				require.Contains(t, query, col,
					"handleActionList SELECT must name %q to match scanActionDefinition", col)
			}
			// fallback_policy is the column the original bug dropped — assert it
			// explicitly so the regression is unmistakable in test output.
			require.Contains(t, query, "fallback_policy",
				"list SELECT dropped fallback_policy — non-empty lists will 500 with db_error")
			// Guard the lower-bound too: the scanner reads 18 destinations, so a
			// SELECT that names fewer real columns can never satisfy it.
			require.GreaterOrEqual(t, strings.Count(query, ","), len(scannerColumns)-1,
				"list SELECT names fewer columns than the scanner reads")
		},
	}

	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantA, "Tenant A", "a@example.test"),
		listRow,
	})

	app := fiber.New()
	v1 := app.Group("/v1/actions")
	v1.Use(middleware.BetterAuth(db))
	v1.Get("", handleActionList(db))

	req := httptest.NewRequest(http.MethodGet, "/v1/actions", nil)
	req.Header.Set("Authorization", "Bearer "+testAPIKey)
	resp, err := app.Test(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	require.Equal(t, http.StatusOK, resp.StatusCode,
		"a non-empty list must scan cleanly — a column/scanner mismatch surfaces as 500 db_error here")

	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	var parsed struct {
		Actions []map[string]any `json:"actions"`
	}
	require.NoError(t, json.Unmarshal(body, &parsed))
	require.Len(t, parsed.Actions, 1, "the single seeded action must round-trip through the scanner")
	require.Equal(t, "smoke_ping", parsed.Actions[0]["name"])

	require.Zero(t, drv.remainingQueries(), "exactly two queries expected (auth + list)")
}
