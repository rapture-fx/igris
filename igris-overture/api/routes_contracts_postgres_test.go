package api

// Real-Postgres integration tests for Connected contract sync. The mock
// driver cannot prove uniqueness races, immutability, or cross-tenant
// isolation against the actual schema — these tests do.
//
// Skipped unless IGRIS_OVERTURE_POSTGRES_TEST_DSN (or POSTGRES_TEST_DSN) is
// set. Each run uses a disposable schema created from the REAL migration
// files (054 + 067), so schema drift between the migration and the
// application SQL fails here, not in production.

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

func openContractPostgres(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("IGRIS_OVERTURE_POSTGRES_TEST_DSN")
	if dsn == "" {
		dsn = os.Getenv("POSTGRES_TEST_DSN")
	}
	if dsn == "" {
		t.Skip("set IGRIS_OVERTURE_POSTGRES_TEST_DSN or POSTGRES_TEST_DSN to run real-Postgres contract sync tests")
	}

	seed := make([]byte, 8)
	_, err := rand.Read(seed)
	require.NoError(t, err)
	schema := "contract_sync_test_" + hex.EncodeToString(seed)

	admin, err := sql.Open("postgres", dsn)
	require.NoError(t, err)
	require.NoError(t, admin.Ping())
	_, err = admin.Exec(`CREATE SCHEMA ` + schema)
	require.NoError(t, err)
	t.Cleanup(func() {
		_, _ = admin.Exec(`DROP SCHEMA ` + schema + ` CASCADE`)
		_ = admin.Close()
	})

	// Pin every pooled connection to the disposable schema via the DSN so
	// concurrency tests (multiple connections) stay isolated.
	scoped, err := sql.Open("postgres", dsnWithSearchPath(dsn, schema))
	require.NoError(t, err)
	require.NoError(t, scoped.Ping())
	t.Cleanup(func() { _ = scoped.Close() })

	for _, migration := range []string{"054_action_definitions.sql", "067_action_contract_versions.sql"} {
		ddl, err := os.ReadFile(filepath.Join("..", "database", "migrations", migration))
		require.NoError(t, err)
		_, err = scoped.Exec(string(ddl))
		require.NoError(t, err, "apply %s", migration)
	}
	return scoped
}

func openContractBindingPostgres(t *testing.T) *sql.DB {
	t.Helper()
	db := openContractPostgres(t)
	for _, migration := range []string{
		"031_task_records.sql",
		"035_task_failure_details.sql",
		"055_action_execution_targets.sql",
		"057_task_records_tenant_scoped_idempotency.sql",
		"062_task_records_registered_agent.sql",
		"068_sdk_evidence_ingestion.sql",
		"069_connected_immutable_records.sql",
		"070_contract_execution_bindings.sql",
		"071_run_scoped_evidence_link_exclusivity.sql",
		"072_operator_reconciliation_events.sql",
	} {
		ddl, err := os.ReadFile(filepath.Join("..", "database", "migrations", migration))
		require.NoError(t, err)
		_, err = db.Exec(string(ddl))
		require.NoError(t, err, "apply %s", migration)
	}
	return db
}

func dsnWithSearchPath(dsn, schema string) string {
	options := "-csearch_path=" + schema
	if strings.Contains(dsn, "://") {
		separator := "?"
		if strings.Contains(dsn, "?") {
			separator = "&"
		}
		return dsn + separator + "options=" + url.QueryEscape(options)
	}
	return dsn + " options='" + options + "'"
}

func postContractSyncRaw(t *testing.T, app *fiber.App, body []byte, headers map[string]string) (int, map[string]any, http.Header) {
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
	require.NoError(t, json.Unmarshal(raw, &decoded), "body: %s", raw)
	return resp.StatusCode, decoded, resp.Header
}

func TestContractSyncPostgresLifecycle(t *testing.T) {
	db := openContractPostgres(t)
	appA := contractTestApp(db, "tenant-pg-a")
	appB := contractTestApp(db, "tenant-pg-b")

	first := buildTestContract(t, nil)
	firstHash := first["contract_hash"].(string)

	// First sync creates the logical action and version 1.
	status, body, _ := postContractSyncRaw(t, appA, syncBody(t, first), nil)
	require.Equal(t, http.StatusCreated, status, "body: %v", body)
	require.Equal(t, true, body["version"].(map[string]any)["created"])

	var storedContract string
	var storedCreatedAt string
	require.NoError(t, db.QueryRow(`
		SELECT contract::text, created_at::text FROM action_contract_versions
		WHERE tenant_id = 'tenant-pg-a' AND action_name = 'tests.customer.refund' AND contract_hash = $1
	`, firstHash).Scan(&storedContract, &storedCreatedAt))

	// Natural idempotency: repeat resolves to the same version, no new row.
	status, body, _ = postContractSyncRaw(t, appA, syncBody(t, first), nil)
	require.Equal(t, http.StatusOK, status)
	require.Equal(t, false, body["version"].(map[string]any)["created"])

	// A changed contract creates version 2 and flags the weakenings.
	weakened := buildTestContract(t, func(c map[string]any) {
		c["risk"] = "low"
		c["approval_mode"] = "never"
	})
	status, body, _ = postContractSyncRaw(t, appA, syncBody(t, weakened), nil)
	require.Equal(t, http.StatusCreated, status)
	version := body["version"].(map[string]any)
	require.Equal(t, true, version["created"])
	require.Equal(t, true, version["security_sensitive_change"])

	var versionCount int
	require.NoError(t, db.QueryRow(`
		SELECT COUNT(*) FROM action_contract_versions
		WHERE tenant_id = 'tenant-pg-a' AND action_name = 'tests.customer.refund'
	`).Scan(&versionCount))
	require.Equal(t, 2, versionCount)

	// Immutability: version 1's row is byte-identical after version 2 landed.
	var contractAfter, createdAfter string
	require.NoError(t, db.QueryRow(`
		SELECT contract::text, created_at::text FROM action_contract_versions
		WHERE tenant_id = 'tenant-pg-a' AND action_name = 'tests.customer.refund' AND contract_hash = $1
	`, firstHash).Scan(&contractAfter, &createdAfter))
	require.Equal(t, storedContract, contractAfter, "historical version content must never change")
	require.Equal(t, storedCreatedAt, createdAfter, "historical version timestamps must never change")

	// Exactly one logical action row was created, non-executable, sdk_sync.
	var targetType, origin string
	require.NoError(t, db.QueryRow(`
		SELECT target_type, origin FROM action_definitions
		WHERE tenant_id = 'tenant-pg-a' AND name = 'tests.customer.refund' AND archived_at IS NULL
	`).Scan(&targetType, &origin))
	require.Equal(t, contractLogicalActionTargetType, targetType)
	require.Equal(t, "sdk_sync", origin)

	// Cross-tenant isolation: tenant B owns its own namespace...
	status, body, _ = postContractSyncRaw(t, appB, syncBody(t, first), nil)
	require.Equal(t, http.StatusCreated, status, "both tenants can own the same logical name")
	// ...and tenant B cannot read tenant A's versions (404, indistinguishable
	// from absent) even knowing the exact hash.
	req := httptest.NewRequest(http.MethodGet,
		"/v1/contracts/actions/tests.customer.refund/versions/"+weakened["contract_hash"].(string), nil)
	resp, err := appB.Test(req, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)

	var crossTenantRows int
	require.NoError(t, db.QueryRow(`
		SELECT COUNT(*) FROM action_contract_versions WHERE tenant_id = 'tenant-pg-b'
	`).Scan(&crossTenantRows))
	require.Equal(t, 1, crossTenantRows, "tenant-b must have exactly its own row")
}

func TestContractExecutionBindingPostgresTenantScopeAndImmutability(t *testing.T) {
	db := openContractBindingPostgres(t)
	appA := contractTestApp(db, "tenant-binding-a")
	appB := contractTestApp(db, "tenant-binding-b")
	contract := buildTestContract(t, func(c map[string]any) {
		c["action_name"] = "clock3b.consequential_transfer"
		c["approval_mode"] = "never"
	})
	hash := contract["contract_hash"].(string)
	status, _, _ := postContractSyncRaw(t, appA, syncBody(t, contract), nil)
	require.Equal(t, http.StatusCreated, status)
	status, _, _ = postContractSyncRaw(t, appB, syncBody(t, contract), nil)
	require.Equal(t, http.StatusCreated, status)

	targetID := uuid.NewString()
	_, err := db.Exec(`
		INSERT INTO action_definitions (
			id, tenant_id, name, display_name, target_type, target_url, method,
			policy_preset, replay_class, approval_required, irreversible,
			secret_refs, target_metadata, fallback_policy, origin
		) VALUES (
			$1, 'tenant-binding-a', 'clock3b_adapter_target', 'Clock 3B Adapter',
			'webhook', 'http://127.0.0.1:18099/v1/clock3b/consequential-transfer',
			'POST', 'Safe automation', 'retryable', false, false, '[]'::jsonb,
			'{"local_auth_header_name":"X-Igris-Adapter-Token","local_auth_secret_env":"IGRIS_CLOCK3B_ADAPTER_TOKEN"}'::jsonb,
			'{"enabled":false}'::jsonb, 'manual'
		)`, targetID)
	require.NoError(t, err)

	body := map[string]any{
		"target_action_id":     targetID,
		"input_mapping":        map[string]string{"customer_id": "customer_id"},
		"timeout_ms":           30_000,
		"replay_class":         "retryable",
		"idempotency_required": true,
	}
	raw, err := json.Marshal(body)
	require.NoError(t, err)
	path := "/v1/contracts/actions/clock3b.consequential_transfer/versions/" + hash + "/bindings"
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(string(raw)))
	req.Header.Set("Content-Type", "application/json")
	resp, err := appA.Test(req, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var created map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&created))
	bindingID := created["id"].(string)
	targetVersionHash := created["target_version_hash"].(string)
	require.Equal(t, hash, created["contract_hash"])
	require.Equal(t, targetID, created["target_action_id"])

	// The selected immutable identities are inserted atomically with the
	// durable task rather than being inferred later from an Action name.
	store := coordinator.NewCheckpointStore(db)
	taskID := uuid.New()
	parsedBindingID, err := uuid.Parse(bindingID)
	require.NoError(t, err)
	parsedTargetID, err := uuid.Parse(targetID)
	require.NoError(t, err)
	task := &coordinator.TaskRecord{
		TaskID:         taskID,
		TenantID:       "tenant-binding-a",
		Status:         coordinator.TaskStatusPending,
		TaskDefinition: json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[]}}`),
		IdempotencyKey: "clock3b-business-effect",
		BoundAction: &coordinator.BoundActionRunIdentity{
			BindingID:              parsedBindingID,
			ContractHash:           hash,
			TargetActionID:         parsedTargetID,
			TargetVersionHash:      targetVersionHash,
			BusinessIdempotencyKey: "clock3b-business-effect",
			RequestFingerprint:     strings.Repeat("c", 64),
		},
	}
	inserted, err := store.CreateTask(task)
	require.NoError(t, err)
	require.True(t, inserted)
	persisted, err := store.GetBoundActionRun(t.Context(), taskID, "tenant-binding-a")
	require.NoError(t, err)
	require.Equal(t, parsedBindingID, persisted.BindingID)
	require.Equal(t, hash, persisted.ContractHash)
	require.Equal(t, parsedTargetID, persisted.TargetActionID)

	historical := &coordinator.TaskRecord{
		TaskID: uuid.New(), TenantID: "tenant-binding-a",
		Status: coordinator.TaskStatusPending, TaskDefinition: json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[]}}`),
		IdempotencyKey: "historical-unbound-task",
	}
	inserted, err = store.CreateTask(historical)
	require.NoError(t, err)
	require.True(t, inserted)
	_, err = store.GetBoundActionRun(t.Context(), historical.TaskID, "tenant-binding-a")
	require.ErrorIs(t, err, sql.ErrNoRows)

	// The same exact contract version cannot be rebound, even to the same target.
	req = httptest.NewRequest(http.MethodPost, path, strings.NewReader(string(raw)))
	req.Header.Set("Content-Type", "application/json")
	resp, err = appA.Test(req, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)

	// Tenant B knows the target UUID but cannot bind to tenant A's target.
	req = httptest.NewRequest(http.MethodPost, path, strings.NewReader(string(raw)))
	req.Header.Set("Content-Type", "application/json")
	resp, err = appB.Test(req, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)

	_, err = db.Exec(`UPDATE action_contract_execution_bindings SET timeout_ms = 1 WHERE id = $1`, bindingID)
	require.Error(t, err, "database trigger must reject binding mutation")
	_, err = db.Exec(`DELETE FROM action_contract_execution_bindings WHERE id = $1`, bindingID)
	require.Error(t, err, "database trigger must reject binding deletion")
}

func TestContractSyncPostgresConcurrentDuplicates(t *testing.T) {
	db := openContractPostgres(t)
	db.SetMaxOpenConns(10)
	app := contractTestApp(db, "tenant-pg-race")

	contract := buildTestContract(t, func(c map[string]any) {
		c["action_name"] = "tests.race.transfer"
	})
	body := syncBody(t, contract)

	const workers = 12
	statuses := make([]int, workers)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			req := httptest.NewRequest(http.MethodPost, "/v1/contracts/sync", strings.NewReader(string(body)))
			req.Header.Set("Content-Type", "application/json")
			resp, err := app.Test(req, -1)
			if err != nil {
				statuses[i] = -1
				return
			}
			_, _ = io.Copy(io.Discard, resp.Body)
			statuses[i] = resp.StatusCode
		}(i)
	}
	wg.Wait()

	createdCount := 0
	for i, status := range statuses {
		require.Contains(t, []int{http.StatusCreated, http.StatusOK}, status, "worker %d got %d", i, status)
		if status == http.StatusCreated {
			createdCount++
		}
	}
	require.Equal(t, 1, createdCount, "exactly one concurrent sync may observe creation")

	var versionRows, actionRows int
	require.NoError(t, db.QueryRow(`
		SELECT COUNT(*) FROM action_contract_versions
		WHERE tenant_id = 'tenant-pg-race' AND action_name = 'tests.race.transfer'
	`).Scan(&versionRows))
	require.NoError(t, db.QueryRow(`
		SELECT COUNT(*) FROM action_definitions
		WHERE tenant_id = 'tenant-pg-race' AND name = 'tests.race.transfer' AND archived_at IS NULL
	`).Scan(&actionRows))
	require.Equal(t, 1, versionRows, "concurrent duplicate sync must create exactly one version")
	require.Equal(t, 1, actionRows, "concurrent duplicate sync must create exactly one logical action")
}

func TestContractSyncPostgresIdempotencyKey(t *testing.T) {
	db := openContractPostgres(t)
	app := contractTestApp(db, "tenant-pg-idem")

	contract := buildTestContract(t, func(c map[string]any) {
		c["action_name"] = "tests.idem.transfer"
	})
	headers := map[string]string{"Idempotency-Key": "op-1234"}

	status, body, _ := postContractSyncRaw(t, app, syncBody(t, contract), headers)
	require.Equal(t, http.StatusCreated, status)
	originalVersion := body["version"].(map[string]any)["id"]

	// Same key + same fingerprint: byte-replay of the original response.
	status, body, header := postContractSyncRaw(t, app, syncBody(t, contract), headers)
	require.Equal(t, http.StatusCreated, status, "replay returns the ORIGINAL status")
	require.Equal(t, "true", header.Get("Idempotency-Replayed"))
	require.Equal(t, originalVersion, body["version"].(map[string]any)["id"])

	// Same key + different fingerprint: explicit conflict, nothing stored.
	different := buildTestContract(t, func(c map[string]any) {
		c["action_name"] = "tests.idem.transfer"
		c["risk"] = "low"
	})
	status, body, _ = postContractSyncRaw(t, app, syncBody(t, different), headers)
	require.Equal(t, http.StatusConflict, status)
	require.Equal(t, "idempotency_key_conflict", body["error"])

	var versionRows int
	require.NoError(t, db.QueryRow(`
		SELECT COUNT(*) FROM action_contract_versions
		WHERE tenant_id = 'tenant-pg-idem' AND action_name = 'tests.idem.transfer'
	`).Scan(&versionRows))
	require.Equal(t, 1, versionRows, "the conflicting request must not have stored a version")

	// The same key in ANOTHER tenant is isolated: fresh, not replay/conflict.
	otherApp := contractTestApp(db, "tenant-pg-idem-2")
	status, _, header = postContractSyncRaw(t, otherApp, syncBody(t, contract), headers)
	require.Equal(t, http.StatusCreated, status)
	require.Empty(t, header.Get("Idempotency-Replayed"))
}

func TestContractSyncPostgresConcurrentIdenticalIdempotencyKey(t *testing.T) {
	db := openContractPostgres(t)
	db.SetMaxOpenConns(4)
	app := contractTestApp(db, "tenant-pg-idem-identical")
	contract := buildTestContract(t, func(c map[string]any) {
		c["action_name"] = "tests.idem.concurrent.identical"
	})
	body := syncBody(t, contract)
	headers := map[string]string{"Idempotency-Key": "concurrent-identical"}

	type result struct {
		status   int
		body     map[string]any
		replayed string
	}
	results := make([]result, 2)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range results {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			status, response, responseHeaders := postContractSyncRaw(t, app, body, headers)
			results[i] = result{status: status, body: response, replayed: responseHeaders.Get("Idempotency-Replayed")}
		}(i)
	}
	close(start)
	wg.Wait()

	replayed := 0
	versionIDs := map[any]bool{}
	for _, result := range results {
		require.Equal(t, http.StatusCreated, result.status, "both callers receive the original result")
		if result.replayed == "true" {
			replayed++
		}
		versionIDs[result.body["version"].(map[string]any)["id"]] = true
	}
	require.Equal(t, 1, replayed)
	require.Len(t, versionIDs, 1)

	var versionRows, idempotencyRows int
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM action_contract_versions WHERE tenant_id = 'tenant-pg-idem-identical'`).Scan(&versionRows))
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM contract_sync_idempotency WHERE tenant_id = 'tenant-pg-idem-identical'`).Scan(&idempotencyRows))
	require.Equal(t, 1, versionRows)
	require.Equal(t, 1, idempotencyRows)
}

func TestContractSyncPostgresConcurrentConflictingIdempotencyKey(t *testing.T) {
	db := openContractPostgres(t)
	db.SetMaxOpenConns(4)
	app := contractTestApp(db, "tenant-pg-idem-conflict")
	first := buildTestContract(t, func(c map[string]any) {
		c["action_name"] = "tests.idem.concurrent.conflict"
		c["risk"] = "high"
	})
	second := buildTestContract(t, func(c map[string]any) {
		c["action_name"] = "tests.idem.concurrent.conflict"
		c["risk"] = "low"
	})
	bodies := [][]byte{syncBody(t, first), syncBody(t, second)}
	headers := map[string]string{"Idempotency-Key": "concurrent-conflict"}

	type result struct {
		status int
		body   map[string]any
	}
	results := make([]result, 2)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range results {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			status, response, _ := postContractSyncRaw(t, app, bodies[i], headers)
			results[i] = result{status: status, body: response}
		}(i)
	}
	close(start)
	wg.Wait()

	var winnerHash string
	successes, conflicts := 0, 0
	for _, result := range results {
		switch result.status {
		case http.StatusCreated:
			successes++
			winnerHash = result.body["version"].(map[string]any)["contract_hash"].(string)
		case http.StatusConflict:
			conflicts++
			require.Equal(t, "idempotency_key_conflict", result.body["error"])
		default:
			t.Fatalf("unexpected concurrent result: status=%d body=%v", result.status, result.body)
		}
	}
	require.Equal(t, 1, successes)
	require.Equal(t, 1, conflicts)

	var storedFingerprint string
	var storedBody []byte
	require.NoError(t, db.QueryRow(`
		SELECT request_fingerprint, response_body
		FROM contract_sync_idempotency
		WHERE tenant_id = 'tenant-pg-idem-conflict' AND idempotency_key = 'concurrent-conflict'
	`).Scan(&storedFingerprint, &storedBody))
	require.Equal(t, winnerHash, storedFingerprint, "the losing request cannot overwrite the winner fingerprint")
	var storedResponse map[string]any
	require.NoError(t, json.Unmarshal(storedBody, &storedResponse))
	require.Equal(t, winnerHash, storedResponse["version"].(map[string]any)["contract_hash"])

	var versionRows int
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM action_contract_versions WHERE tenant_id = 'tenant-pg-idem-conflict'`).Scan(&versionRows))
	require.Equal(t, 1, versionRows, "the losing conflict request cannot persist its contract")
}

func TestContractSyncPostgresIdempotencyRollbackLeavesNoPartialState(t *testing.T) {
	db := openContractPostgres(t)
	app := contractTestApp(db, "tenant-pg-idem-rollback")
	_, err := db.Exec(`DROP TABLE action_contract_versions`)
	require.NoError(t, err)

	contract := buildTestContract(t, func(c map[string]any) {
		c["action_name"] = "tests.idem.rollback"
	})
	status, body, _ := postContractSyncRaw(t, app, syncBody(t, contract), map[string]string{
		"Idempotency-Key": "rollback-key",
	})
	require.Equal(t, http.StatusInternalServerError, status)
	require.Equal(t, "db_error", body["error"])

	var idempotencyRows, actionRows int
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM contract_sync_idempotency WHERE tenant_id = 'tenant-pg-idem-rollback'`).Scan(&idempotencyRows))
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM action_definitions WHERE tenant_id = 'tenant-pg-idem-rollback'`).Scan(&actionRows))
	require.Zero(t, idempotencyRows, "the claim must roll back with the failed operation")
	require.Zero(t, actionRows, "the logical action insert must roll back with the failed operation")
}

// TestContractSyncPostgresManualActionPreserved proves an existing manually
// registered action keeps its configuration when an SDK sync attaches to it.
func TestContractSyncPostgresManualActionPreserved(t *testing.T) {
	db := openContractPostgres(t)
	app := contractTestApp(db, "tenant-pg-manual")

	_, err := db.Exec(`
		INSERT INTO action_definitions (tenant_id, name, display_name, target_type, target_url, method, origin)
		VALUES ('tenant-pg-manual', 'tests.customer.refund', 'Manual refund', 'webhook', 'https://example.test/refund', 'POST', 'manual')
	`)
	require.NoError(t, err)

	status, body, _ := postContractSyncRaw(t, app, syncBody(t, buildTestContract(t, nil)), nil)
	require.Equal(t, http.StatusCreated, status)
	action := body["action"].(map[string]any)
	require.Equal(t, "manual", action["origin"])
	require.Equal(t, true, action["origin_divergence"])

	var targetType, targetURL, origin string
	require.NoError(t, db.QueryRow(`
		SELECT target_type, target_url, origin FROM action_definitions
		WHERE tenant_id = 'tenant-pg-manual' AND name = 'tests.customer.refund' AND archived_at IS NULL
	`).Scan(&targetType, &targetURL, &origin))
	require.Equal(t, "webhook", targetType, "manual execution configuration must be untouched")
	require.Equal(t, "https://example.test/refund", targetURL)
	require.Equal(t, "manual", origin)
}
