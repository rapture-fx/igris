package api

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/internal/canonicaljson"
)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func contractTestApp(db *sql.DB, tenantID string) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		if tenantID != "" {
			c.Locals("clerk_user_id", tenantID)
		}
		return c.Next()
	})
	app.Post("/v1/contracts/sync", handleContractSync(db))
	app.Get("/v1/contracts/actions/:name", handleContractActionGet(db))
	app.Post("/v1/contracts/actions/:name/versions/:contract_hash/bindings", handleContractBindingCreate(db))
	app.Get("/v1/contracts/actions/:name/versions/:contract_hash/binding", handleContractBindingGet(db))
	app.Get("/v1/contracts/actions/:name/versions/:contract_hash", handleContractVersionGet(db))
	return app
}

// buildTestContract returns a valid ActionContract v1 body with a correct
// (production-canonicalizer-recomputed) contract_hash. Byte-level authority
// vs the Python SDK is pinned separately by the fixture tests below and in
// internal/canonicaljson.
func buildTestContract(t *testing.T, mutate func(map[string]any)) map[string]any {
	t.Helper()
	contract := map[string]any{
		"schema_version": "1",
		"action_name":    "tests.customer.refund",
		"module":         "tests.module",
		"qualified_name": "refund_customer",
		"risk":           "critical",
		"approval_mode":  "required",
		"execution_mode": "embedded",
		"parameter_descriptors": []any{
			map[string]any{
				"name":        "customer_id",
				"kind":        "POSITIONAL_OR_KEYWORD",
				"has_default": false,
				"annotation":  "str",
			},
		},
		"code_fingerprint": nil,
	}
	if mutate != nil {
		mutate(contract)
	}
	if _, present := contract["contract_hash"]; !present {
		hash, err := canonicaljson.ContractHash(contract)
		require.NoError(t, err)
		contract["contract_hash"] = hash
	}
	return contract
}

func syncBody(t *testing.T, contract map[string]any) []byte {
	t.Helper()
	body, err := json.Marshal(map[string]any{"contract": contract})
	require.NoError(t, err)
	return body
}

func postContractSync(t *testing.T, app *fiber.App, body []byte, headers map[string]string) (*http.Response, map[string]any) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/v1/contracts/sync", strings.NewReader(string(body)))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	raw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	var decoded map[string]any
	if len(raw) > 0 {
		require.NoError(t, json.Unmarshal(raw, &decoded), "body: %s", raw)
	}
	return resp, decoded
}

func contractVersionRow(hash string, created time.Time, risk, approval string) []driver.Value {
	return []driver.Value{
		"version-uuid-1", hash, "1", []byte(`{"schema_version":"1"}`),
		risk, approval, "embedded", nil, false, []byte(`[]`), created,
	}
}

var contractVersionCols = []string{
	"id", "contract_hash", "schema_version", "contract", "risk", "approval_mode",
	"execution_mode", "code_fingerprint", "security_sensitive_change",
	"policy_flags", "created_at",
}

// assertAppendOnly rejects any statement that could rewrite history.
func assertAppendOnly(t *testing.T) func(query string, args []driver.NamedValue) {
	t.Helper()
	return func(query string, args []driver.NamedValue) {
		upper := strings.ToUpper(query)
		require.NotContains(t, upper, "UPDATE ", "contract sync must never UPDATE: %s", query)
		require.NotContains(t, upper, "DELETE ", "contract sync must never DELETE: %s", query)
	}
}

// ---------------------------------------------------------------------------
// Authentication and tenant derivation
// ---------------------------------------------------------------------------

func TestContractSyncUnauthenticatedRejected(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	app := contractTestApp(db, "") // no authenticated tenant in context

	resp, body := postContractSync(t, app, syncBody(t, buildTestContract(t, nil)), nil)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	require.Equal(t, "unauthenticated", body["error"])
	require.Equal(t, 0, drv.remainingQueries())
}

func TestContractSyncRegisteredRoutesRequireBetterAuth(t *testing.T) {
	t.Parallel()
	// Through the real registration (BetterAuth middleware), a request with
	// no session and no API key never reaches the handler.
	db, _ := newQueuedRouteDB(t, nil)
	app := fiber.New()
	RegisterContractRoutes(app, db)

	req := httptest.NewRequest(http.MethodPost, "/v1/contracts/sync", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func TestContractSyncBodyTenantFieldRejected(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	app := contractTestApp(db, "tenant-a")

	body, err := json.Marshal(map[string]any{
		"tenant_id": "tenant-victim",
		"contract":  buildTestContract(t, nil),
	})
	require.NoError(t, err)
	resp, decoded := postContractSync(t, app, body, nil)
	require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	require.Equal(t, "validation_failed", decoded["error"])
	require.Contains(t, decoded["detail"], "tenant_id")
	require.Equal(t, 0, drv.remainingQueries(), "nothing may be stored")
}

func TestContractSyncTenantComesFromAuthContext(t *testing.T) {
	t.Parallel()
	created := time.Date(2026, 7, 10, 15, 4, 5, 0, time.UTC)
	contract := buildTestContract(t, nil)
	hash := contract["contract_hash"].(string)

	assertTenant := func(query string, args []driver.NamedValue) {
		assertAppendOnly(t)(query, args)
		require.NotEmpty(t, args)
		require.Equal(t, "tenant-auth", args[0].Value, "every statement must be scoped to the authenticated tenant: %s", query)
	}
	db, drv := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{columns: []string{"id", "origin"}, rows: [][]driver.Value{{"action-uuid", "sdk_sync"}}, checkArgs: assertTenant},
			{columns: contractVersionCols, rows: nil, checkArgs: assertTenant},                                                  // version lookup: absent
			{columns: contractVersionCols, rows: nil, checkArgs: assertTenant},                                                  // latest prior: absent
			{columns: []string{"id", "created_at"}, rows: [][]driver.Value{{"version-uuid", created}}, checkArgs: assertTenant}, // insert returning
		},
		queuedRouteExecExpectation{rowsAffected: 1, check: assertTenant},
	)
	app := contractTestApp(db, "tenant-auth")

	resp, body := postContractSync(t, app, syncBody(t, contract), nil)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	require.Equal(t, 0, drv.remainingQueries())
	require.Equal(t, 0, drv.remainingExecs())

	version := body["version"].(map[string]any)
	require.Equal(t, hash, version["contract_hash"])
	require.Equal(t, true, version["created"])
	action := body["action"].(map[string]any)
	require.Equal(t, "tests.customer.refund", action["action_name"])
	require.Equal(t, "sdk_sync", action["origin"])
	require.Equal(t, false, action["origin_divergence"])
	grants := body["grants"].(map[string]any)
	require.Equal(t, false, grants["execution_permission"])
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

func TestContractSyncValidationRejections(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name       string
		mutate     func(map[string]any)
		wantStatus int
		wantError  string
	}{
		{"unknown schema_version", func(c map[string]any) {
			c["schema_version"] = "2"
			delete(c, "contract_hash")
		}, http.StatusUnprocessableEntity, "unsupported_schema_version"},
		{"invalid action_name", func(c map[string]any) {
			c["action_name"] = "9starts-with-digit"
			delete(c, "contract_hash")
		}, http.StatusUnprocessableEntity, "invalid_action_name"},
		{"invalid risk", func(c map[string]any) {
			c["risk"] = "catastrophic"
			delete(c, "contract_hash")
		}, http.StatusUnprocessableEntity, "validation_failed"},
		{"invalid approval_mode", func(c map[string]any) {
			c["approval_mode"] = "sometimes"
			delete(c, "contract_hash")
		}, http.StatusUnprocessableEntity, "validation_failed"},
		{"managed execution_mode rejected", func(c map[string]any) {
			c["execution_mode"] = "managed"
			delete(c, "contract_hash")
		}, http.StatusUnprocessableEntity, "validation_failed"},
		{"unknown contract field", func(c map[string]any) {
			c["execution_permission"] = true
			delete(c, "contract_hash")
		}, http.StatusUnprocessableEntity, "validation_failed"},
		{"missing contract_hash", func(c map[string]any) {
			delete(c, "contract_hash")
			c["contract_hash"] = ""
		}, http.StatusUnprocessableEntity, "validation_failed"},
		{"too many parameter descriptors", func(c map[string]any) {
			descriptors := make([]any, 129)
			for i := range descriptors {
				descriptors[i] = map[string]any{
					"name": "p", "kind": "POSITIONAL_OR_KEYWORD", "has_default": false, "annotation": nil,
				}
			}
			c["parameter_descriptors"] = descriptors
			delete(c, "contract_hash")
		}, http.StatusUnprocessableEntity, "validation_failed"},
		{"unknown descriptor field", func(c map[string]any) {
			c["parameter_descriptors"] = []any{map[string]any{
				"name": "p", "kind": "POSITIONAL_OR_KEYWORD", "has_default": false, "annotation": nil,
				"default_value": "leak",
			}}
			delete(c, "contract_hash")
		}, http.StatusUnprocessableEntity, "validation_failed"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			db, drv := newQueuedRouteDB(t, nil)
			app := contractTestApp(db, "tenant-a")
			contract := buildTestContract(t, tc.mutate)
			if _, ok := contract["contract_hash"]; !ok {
				contract["contract_hash"] = strings.Repeat("a", 64)
			}
			resp, body := postContractSync(t, app, syncBody(t, contract), nil)
			require.Equal(t, tc.wantStatus, resp.StatusCode)
			require.Equal(t, tc.wantError, body["error"])
			require.Equal(t, 0, drv.remainingQueries(), "invalid contracts must never reach the database")
		})
	}
}

func TestContractSyncHashMismatchRejectedAndNothingStored(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil) // zero DB expectations: any DB call fails the test
	app := contractTestApp(db, "tenant-a")

	contract := buildTestContract(t, nil)
	contract["contract_hash"] = strings.Repeat("0", 64) // well-formed but wrong

	resp, body := postContractSync(t, app, syncBody(t, contract), nil)
	require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	require.Equal(t, "contract_hash_mismatch", body["error"])
	require.Equal(t, 0, drv.remainingQueries())
	require.Equal(t, 0, drv.remainingExecs())
}

func TestContractSyncOversizedBodyRejected(t *testing.T) {
	t.Parallel()
	db, _ := newQueuedRouteDB(t, nil)
	app := contractTestApp(db, "tenant-a")

	oversized := append([]byte(`{"contract":{"pad":"`), []byte(strings.Repeat("x", contractSyncMaxBodyBytes))...)
	oversized = append(oversized, []byte(`"}}`)...)
	resp, body := postContractSync(t, app, oversized, nil)
	require.Equal(t, http.StatusRequestEntityTooLarge, resp.StatusCode)
	require.Equal(t, "payload_too_large", body["error"])
}

func TestContractSyncMalformedJSONRejected(t *testing.T) {
	t.Parallel()
	db, _ := newQueuedRouteDB(t, nil)
	app := contractTestApp(db, "tenant-a")

	resp, body := postContractSync(t, app, []byte(`{"contract": not-json`), nil)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Equal(t, "invalid_body", body["error"])
}

// ---------------------------------------------------------------------------
// Python fixture interoperability (mandatory acceptance test)
// ---------------------------------------------------------------------------

func loadFixtureContract(t *testing.T, name string) (map[string]any, string) {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("..", "..", "testdata", "igris-contract-v1", name))
	require.NoError(t, err)
	contract, err := canonicaljson.DecodeObjectPreserving(raw)
	require.NoError(t, err)
	hash, ok := contract["contract_hash"].(string)
	require.True(t, ok, "fixture %s has no contract_hash", name)
	return contract, hash
}

func TestContractSyncAcceptsPythonGeneratedFixtureContract(t *testing.T) {
	t.Parallel()
	for _, fixture := range []string{"action_contract.json", "action_contract_specialchars.json"} {
		fixture := fixture
		t.Run(fixture, func(t *testing.T) {
			t.Parallel()
			contract, wantHash := loadFixtureContract(t, fixture)
			created := time.Date(2026, 7, 10, 15, 4, 5, 123456000, time.UTC)

			db, drv := newQueuedRouteDB(t,
				[]queuedRouteQueryExpectation{
					{columns: []string{"id", "origin"}, rows: [][]driver.Value{{"action-uuid", "sdk_sync"}}},
					{columns: contractVersionCols, rows: nil},
					{columns: contractVersionCols, rows: nil},
					{columns: []string{"id", "created_at"}, rows: [][]driver.Value{{"version-uuid", created}},
						checkArgs: func(query string, args []driver.NamedValue) {
							// The version row must persist the SERVER-recomputed
							// hash, equal to the Python SDK's embedded value.
							require.Equal(t, wantHash, args[2].Value, "stored contract_hash must be the Python-compatible recomputation")
						}},
				},
				queuedRouteExecExpectation{rowsAffected: 1},
			)
			app := contractTestApp(db, "tenant-fixture")

			resp, body := postContractSync(t, app, syncBody(t, contract), nil)
			require.Equal(t, http.StatusCreated, resp.StatusCode, "body: %v", body)
			require.Equal(t, 0, drv.remainingQueries())
			version := body["version"].(map[string]any)
			require.Equal(t, wantHash, version["contract_hash"])
		})
	}
}

func TestContractSyncRejectsTamperedPythonFixture(t *testing.T) {
	t.Parallel()
	contract, _ := loadFixtureContract(t, "action_contract.json")
	contract["risk"] = "low" // tamper: weaken risk, keep the embedded hash

	db, drv := newQueuedRouteDB(t, nil)
	app := contractTestApp(db, "tenant-fixture")
	resp, body := postContractSync(t, app, syncBody(t, contract), nil)
	require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	require.Equal(t, "contract_hash_mismatch", body["error"])
	require.Equal(t, 0, drv.remainingQueries())
}

// ---------------------------------------------------------------------------
// Versioning semantics
// ---------------------------------------------------------------------------

func TestContractSyncRepeatedIdenticalReturnsExistingVersion(t *testing.T) {
	t.Parallel()
	contract := buildTestContract(t, nil)
	hash := contract["contract_hash"].(string)
	created := time.Date(2026, 7, 9, 10, 0, 0, 0, time.UTC)

	db, drv := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{columns: []string{"id", "origin"}, rows: [][]driver.Value{{"action-uuid", "sdk_sync"}}},
			{columns: contractVersionCols, rows: [][]driver.Value{contractVersionRow(hash, created, "critical", "required")}},
		},
		queuedRouteExecExpectation{rowsAffected: 0},
	)
	app := contractTestApp(db, "tenant-a")

	resp, body := postContractSync(t, app, syncBody(t, contract), nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Equal(t, 0, drv.remainingQueries())
	version := body["version"].(map[string]any)
	require.Equal(t, false, version["created"])
	require.Equal(t, hash, version["contract_hash"])
}

func TestContractSyncNewHashCreatesNewVersionAndFlagsSecurityDelta(t *testing.T) {
	t.Parallel()
	// The prior version was critical/required; the new declaration is
	// low/never — both weakenings must be flagged, visibly, on the response.
	contract := buildTestContract(t, func(c map[string]any) {
		c["risk"] = "low"
		c["approval_mode"] = "never"
	})
	priorCreated := time.Date(2026, 7, 8, 10, 0, 0, 0, time.UTC)
	created := time.Date(2026, 7, 10, 10, 0, 0, 0, time.UTC)

	db, drv := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{columns: []string{"id", "origin"}, rows: [][]driver.Value{{"action-uuid", "sdk_sync"}}},
			{columns: contractVersionCols, rows: nil}, // this hash: absent
			{columns: contractVersionCols, rows: [][]driver.Value{contractVersionRow(strings.Repeat("b", 64), priorCreated, "critical", "required")}},
			{columns: []string{"id", "created_at"}, rows: [][]driver.Value{{"version-uuid-2", created}},
				checkArgs: func(query string, args []driver.NamedValue) {
					require.Equal(t, true, args[9].Value, "security_sensitive_change must be persisted on the version row")
				}},
		},
		queuedRouteExecExpectation{rowsAffected: 0},
	)
	app := contractTestApp(db, "tenant-a")

	resp, body := postContractSync(t, app, syncBody(t, contract), nil)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	require.Equal(t, 0, drv.remainingQueries())
	version := body["version"].(map[string]any)
	require.Equal(t, true, version["created"])
	require.Equal(t, true, version["security_sensitive_change"])
	flags := version["policy_flags"].([]any)
	require.Contains(t, flags, "risk_lowered:critical->low")
	require.Contains(t, flags, "approval_weakened:required->never")
}

func TestContractSyncConcurrentDuplicateResolvesToSingleVersion(t *testing.T) {
	t.Parallel()
	// Simulates losing the uniqueness race: INSERT ... ON CONFLICT DO NOTHING
	// returns no row, and the handler re-reads the surviving version instead
	// of failing or double-creating.
	contract := buildTestContract(t, nil)
	hash := contract["contract_hash"].(string)
	created := time.Date(2026, 7, 10, 10, 0, 0, 0, time.UTC)

	db, drv := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{columns: []string{"id", "origin"}, rows: [][]driver.Value{{"action-uuid", "sdk_sync"}}},
			{columns: contractVersionCols, rows: nil},          // not visible yet
			{columns: contractVersionCols, rows: nil},          // no prior
			{columns: []string{"id", "created_at"}, rows: nil}, // conflict: RETURNING empty
			{columns: contractVersionCols, rows: [][]driver.Value{contractVersionRow(hash, created, "critical", "required")}},
		},
		queuedRouteExecExpectation{rowsAffected: 1},
	)
	app := contractTestApp(db, "tenant-a")

	resp, body := postContractSync(t, app, syncBody(t, contract), nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Equal(t, 0, drv.remainingQueries())
	version := body["version"].(map[string]any)
	require.Equal(t, false, version["created"])
	require.Equal(t, hash, version["contract_hash"])
}

func TestContractSyncManualActionCollisionReportsOriginDivergence(t *testing.T) {
	t.Parallel()
	contract := buildTestContract(t, nil)
	created := time.Date(2026, 7, 10, 10, 0, 0, 0, time.UTC)

	db, drv := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{columns: []string{"id", "origin"}, rows: [][]driver.Value{{"action-uuid", "manual"}}},
			{columns: contractVersionCols, rows: nil},
			{columns: contractVersionCols, rows: nil},
			{columns: []string{"id", "created_at"}, rows: [][]driver.Value{{"version-uuid", created}}},
		},
		// ON CONFLICT DO NOTHING: the existing manual action is untouched.
		queuedRouteExecExpectation{rowsAffected: 0, check: assertAppendOnly(t)},
	)
	app := contractTestApp(db, "tenant-a")

	resp, body := postContractSync(t, app, syncBody(t, contract), nil)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	require.Equal(t, 0, drv.remainingQueries())
	action := body["action"].(map[string]any)
	require.Equal(t, "manual", action["origin"])
	require.Equal(t, true, action["origin_divergence"])
}

// ---------------------------------------------------------------------------
// Idempotency-Key semantics
// ---------------------------------------------------------------------------

func TestContractSyncIdempotencyKeyReplaysSameFingerprint(t *testing.T) {
	t.Parallel()
	contract := buildTestContract(t, nil)
	hash := contract["contract_hash"].(string)
	stored := []byte(`{"action":{"action_name":"tests.customer.refund"},"version":{"contract_hash":"` + hash + `","created":true}}`)

	db, drv := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{columns: []string{"request_fingerprint"}, rows: nil}, // claim lost; re-read winner
			{
				columns: []string{"request_fingerprint", "response_status", "response_body"},
				rows:    [][]driver.Value{{hash, int64(201), stored}},
				checkArgs: func(query string, args []driver.NamedValue) {
					require.Equal(t, "tenant-a", args[0].Value)
					require.Equal(t, "contract_sync", args[1].Value)
				},
			},
		},
	)
	app := contractTestApp(db, "tenant-a")

	resp, body := postContractSync(t, app, syncBody(t, contract), map[string]string{"Idempotency-Key": "retry-key-1"})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	require.Equal(t, "true", resp.Header.Get("Idempotency-Replayed"))
	version := body["version"].(map[string]any)
	require.Equal(t, hash, version["contract_hash"])
	require.Equal(t, 0, drv.remainingQueries(), "replay must not touch contract tables")
}

func TestContractSyncIdempotencyKeyConflictOnDifferentFingerprint(t *testing.T) {
	t.Parallel()
	contract := buildTestContract(t, nil)

	db, drv := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{columns: []string{"request_fingerprint"}, rows: nil}, // claim lost; re-read winner
			{
				columns: []string{"request_fingerprint", "response_status", "response_body"},
				rows:    [][]driver.Value{{strings.Repeat("c", 64), int64(201), []byte(`{}`)}},
			},
		},
	)
	app := contractTestApp(db, "tenant-a")

	resp, body := postContractSync(t, app, syncBody(t, contract), map[string]string{"Idempotency-Key": "reused-key"})
	require.Equal(t, http.StatusConflict, resp.StatusCode)
	require.Equal(t, "idempotency_key_conflict", body["error"])
	require.Equal(t, 0, drv.remainingQueries(), "a key conflict must store nothing")
	require.Equal(t, 0, drv.remainingExecs())
}

func TestContractSyncIdempotencyKeyRecordsResponseSnapshot(t *testing.T) {
	t.Parallel()
	contract := buildTestContract(t, nil)
	hash := contract["contract_hash"].(string)
	created := time.Date(2026, 7, 10, 10, 0, 0, 0, time.UTC)

	db, drv := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{columns: []string{"request_fingerprint"}, rows: [][]driver.Value{{hash}}}, // claim won
			{columns: []string{"id", "origin"}, rows: [][]driver.Value{{"action-uuid", "sdk_sync"}}},
			{columns: contractVersionCols, rows: nil},
			{columns: contractVersionCols, rows: nil},
			{columns: []string{"id", "created_at"}, rows: [][]driver.Value{{"version-uuid", created}}},
		},
		queuedRouteExecExpectation{rowsAffected: 1}, // logical action insert
		queuedRouteExecExpectation{rowsAffected: 1, check: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "contract_sync_idempotency")
			require.Contains(t, query, "UPDATE")
			require.Equal(t, "tenant-a", args[0].Value)
			require.Equal(t, "new-key", args[3].Value)
			require.Equal(t, hash, args[4].Value, "the stored fingerprint must be the server recomputation")
		}},
	)
	app := contractTestApp(db, "tenant-a")

	resp, _ := postContractSync(t, app, syncBody(t, contract), map[string]string{"Idempotency-Key": "new-key"})
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	require.Equal(t, 0, drv.remainingExecs())
}

func TestContractSyncIdempotencyKeyIsTenantScoped(t *testing.T) {
	t.Parallel()
	// The same key used by another tenant must be looked up under THAT
	// tenant only — the statement is scoped by the authenticated tenant.
	contract := buildTestContract(t, nil)
	created := time.Date(2026, 7, 10, 10, 0, 0, 0, time.UTC)

	db, _ := newQueuedRouteDB(t,
		[]queuedRouteQueryExpectation{
			{
				columns: []string{"request_fingerprint"},
				rows:    [][]driver.Value{{contract["contract_hash"].(string)}}, // tenant-b wins its isolated claim
				checkArgs: func(query string, args []driver.NamedValue) {
					require.Equal(t, "tenant-b", args[0].Value, "idempotency claim must be scoped to the caller's tenant")
				},
			},
			{columns: []string{"id", "origin"}, rows: [][]driver.Value{{"action-uuid-b", "sdk_sync"}}},
			{columns: contractVersionCols, rows: nil},
			{columns: contractVersionCols, rows: nil},
			{columns: []string{"id", "created_at"}, rows: [][]driver.Value{{"version-uuid-b", created}}},
		},
		queuedRouteExecExpectation{rowsAffected: 1},
		queuedRouteExecExpectation{rowsAffected: 1},
	)
	app := contractTestApp(db, "tenant-b")

	resp, _ := postContractSync(t, app, syncBody(t, contract), map[string]string{"Idempotency-Key": "shared-key"})
	require.Equal(t, http.StatusCreated, resp.StatusCode, "tenant-b proceeds fresh; tenant-a's record is invisible")
}

func TestContractSyncInvalidIdempotencyKeyRejected(t *testing.T) {
	t.Parallel()
	db, drv := newQueuedRouteDB(t, nil)
	app := contractTestApp(db, "tenant-a")

	resp, body := postContractSync(t, app, syncBody(t, buildTestContract(t, nil)),
		map[string]string{"Idempotency-Key": "bad key with spaces"})
	require.Equal(t, http.StatusUnprocessableEntity, resp.StatusCode)
	require.Equal(t, "validation_failed", body["error"])
	require.Equal(t, 0, drv.remainingQueries())
}

// ---------------------------------------------------------------------------
// Registration grants no execution
// ---------------------------------------------------------------------------

func TestSyncedLogicalActionTargetTypeIsNotExecutable(t *testing.T) {
	t.Parallel()
	// The gateway must refuse to build a run request for the target type
	// that contract sync stamps on auto-created logical actions.
	_, err := buildActionRunRequestFromDefinition(actionDefinition{
		ID:         "action-sdk",
		Name:       "tests.customer.refund",
		TargetType: contractLogicalActionTargetType,
	}, actionRunByNameRequest{Input: map[string]interface{}{"amount": 1}})
	require.Error(t, err)
	require.Contains(t, err.Error(), "unsupported target type")
}

// ---------------------------------------------------------------------------
// Lookup endpoints
// ---------------------------------------------------------------------------

func TestContractActionLookupTenantScopedAndNotFound(t *testing.T) {
	t.Parallel()
	db, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{columns: []string{"id", "origin", "created_at"}, rows: nil, checkArgs: func(query string, args []driver.NamedValue) {
			require.Equal(t, "tenant-b", args[0].Value)
		}},
	})
	app := contractTestApp(db, "tenant-b")

	req := httptest.NewRequest(http.MethodGet, "/v1/contracts/actions/tests.customer.refund", nil)
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode, "another tenant's action is indistinguishable from absent")
}

func TestContractActionLookupReturnsVersionsNewestFirst(t *testing.T) {
	t.Parallel()
	createdAction := time.Date(2026, 7, 8, 9, 0, 0, 0, time.UTC)
	newer := time.Date(2026, 7, 10, 9, 0, 0, 0, time.UTC)
	older := time.Date(2026, 7, 9, 9, 0, 0, 0, time.UTC)

	db, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{columns: []string{"id", "origin", "created_at"}, rows: [][]driver.Value{{"action-uuid", "sdk_sync", createdAction}}},
		{
			columns: contractVersionCols,
			rows: [][]driver.Value{
				contractVersionRow(strings.Repeat("d", 64), newer, "low", "never"),
				contractVersionRow(strings.Repeat("e", 64), older, "critical", "required"),
			},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "ORDER BY created_at DESC")
				require.Equal(t, "tenant-a", args[0].Value)
			},
		},
	})
	app := contractTestApp(db, "tenant-a")

	req := httptest.NewRequest(http.MethodGet, "/v1/contracts/actions/tests.customer.refund", nil)
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	raw, _ := io.ReadAll(resp.Body)
	var body map[string]any
	require.NoError(t, json.Unmarshal(raw, &body))
	versions := body["versions"].([]any)
	require.Len(t, versions, 2)
	first := versions[0].(map[string]any)
	require.Equal(t, strings.Repeat("d", 64), first["contract_hash"])
}

func TestContractVersionLookupValidatesHashAndScopesTenant(t *testing.T) {
	t.Parallel()
	db, _ := newQueuedRouteDB(t, nil)
	app := contractTestApp(db, "tenant-a")

	req := httptest.NewRequest(http.MethodGet, "/v1/contracts/actions/tests.customer.refund/versions/NOT-A-HASH", nil)
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)

	db2, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{columns: contractVersionCols, rows: nil, checkArgs: func(query string, args []driver.NamedValue) {
			require.Equal(t, "tenant-a", args[0].Value)
		}},
	})
	app2 := contractTestApp(db2, "tenant-a")
	req2 := httptest.NewRequest(http.MethodGet, "/v1/contracts/actions/tests.customer.refund/versions/"+strings.Repeat("f", 64), nil)
	resp2, err := app2.Test(req2, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp2.StatusCode)
}

// ---------------------------------------------------------------------------
// Route surface
// ---------------------------------------------------------------------------

func TestRegisterContractRoutesExposesOnlyContractEndpoints(t *testing.T) {
	t.Parallel()
	db, _ := newQueuedRouteDB(t, nil)
	app := fiber.New()
	RegisterContractRoutes(app, db)

	require.True(t, hasRoute(app, "POST", "/v1/contracts/sync"))
	require.True(t, hasRoute(app, "GET", "/v1/contracts/actions/:name"))
	require.True(t, hasRoute(app, "GET", "/v1/contracts/actions/:name/versions/:contract_hash"))

	for _, route := range app.GetRoutes(true) {
		// "/v1/contracts" (no trailing segment) is the group middleware mount.
		if route.Method == "HEAD" || route.Path == "/" || route.Path == "/v1/contracts" {
			continue
		}
		require.True(t, strings.HasPrefix(route.Path, "/v1/contracts/"),
			"unexpected route registered by RegisterContractRoutes: %s %s", route.Method, route.Path)
		require.NotContains(t, route.Path, "evidence",
			"no evidence-ingestion endpoint may be registered in this slice")
	}
}

// ---------------------------------------------------------------------------
// Immutability discipline (source-level guard)
// ---------------------------------------------------------------------------

func TestContractVersionPersistenceSourceHasNoUpdateOrDelete(t *testing.T) {
	t.Parallel()
	// Contract versions remain append-only. The separate idempotency replay
	// table intentionally receives one in-transaction UPDATE that completes a
	// newly claimed response snapshot before commit.
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`(?i)\bUPDATE\s+action_contract_versions\b`),
		regexp.MustCompile(`(?i)\bDELETE\s+FROM\s+action_contract_versions\b`),
	}
	for _, file := range []string{"contract_store.go", "routes_contracts.go"} {
		source, err := os.ReadFile(file)
		require.NoError(t, err)
		for _, pattern := range patterns {
			require.False(t, pattern.Match(source),
				"%s contains a contract-version mutation: %s", file, pattern)
		}
	}
}
