package api

// Real-Postgres integration tests for Embedded evidence ingestion. The mock
// driver cannot prove uniqueness races, fork prevention, append-only
// storage, structural provenance, or cross-tenant isolation against the
// actual schema — these tests do.
//
// Skipped unless IGRIS_OVERTURE_POSTGRES_TEST_DSN (or POSTGRES_TEST_DSN) is
// set. Each run uses a disposable schema created from the REAL migration
// file (068), so schema drift between the migration and the application SQL
// fails here, not in production. Note that neither task_records nor any
// Managed receipt table exists in the disposable schema: ingestion working
// here is itself proof that the path is structurally separate from Managed
// storage.

import (
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	_ "github.com/lib/pq"
	"github.com/stretchr/testify/require"
)

type evidencePostgresHarness struct {
	db *sql.DB
}

func openEvidencePostgres(t *testing.T) *evidencePostgresHarness {
	t.Helper()
	db := openContractPostgres(t) // disposable schema; applies 054 + 067
	for _, migration := range []string{
		"068_sdk_evidence_ingestion.sql",
		"069_connected_immutable_records.sql",
	} {
		ddl, err := os.ReadFile(filepath.Join("..", "database", "migrations", migration))
		require.NoError(t, err)
		_, err = db.Exec(string(ddl))
		require.NoError(t, err, "apply %s", migration)
	}
	return &evidencePostgresHarness{db: db}
}

func TestEvidenceIngestPostgresLifecycle(t *testing.T) {
	h := openEvidencePostgres(t)
	events, pemText, keyID := loadFixtureJournal(t)
	appA := evidenceTestApp(h.db, "tenant-ev-a")
	appB := evidenceTestApp(h.db, "tenant-ev-b")

	// 1. The Python-SDK-generated journal is accepted and verified.
	resp, body := postEvidence(t, appA, evidenceBody(t, keyID, pemText, nil, events), nil)
	require.Equal(t, http.StatusAccepted, resp.StatusCode, "body: %v", body)
	require.Equal(t, "verified", body["evidence_state"])
	require.Equal(t, "embedded", body["execution_provenance"])
	require.Equal(t, true, body["created"])
	require.Equal(t, float64(len(events)), body["events_verified"])
	batchID := body["batch_id"].(string)
	chainHead := body["chain_head"].(string)
	require.Equal(t, events[len(events)-1]["event_hash"], chainHead)

	// Stored rows are structurally embedded and complete.
	var storedProvenance string
	var storedEvents int
	require.NoError(t, h.db.QueryRow(`
		SELECT COUNT(*) FROM sdk_evidence_events WHERE tenant_id = 'tenant-ev-a' AND key_id = $1
	`, keyID).Scan(&storedEvents))
	require.Equal(t, len(events), storedEvents)
	require.NoError(t, h.db.QueryRow(`
		SELECT DISTINCT execution_provenance FROM sdk_evidence_events WHERE tenant_id = 'tenant-ev-a'
	`).Scan(&storedProvenance))
	require.Equal(t, "embedded", storedProvenance)

	// The signing key was registered for the tenant — public key only.
	var storedPEM string
	require.NoError(t, h.db.QueryRow(`
		SELECT public_key_pem FROM sdk_signing_keys WHERE tenant_id = 'tenant-ev-a' AND key_id = $1
	`, keyID).Scan(&storedPEM))
	require.Contains(t, storedPEM, "BEGIN PUBLIC KEY")
	require.NotContains(t, storedPEM, "PRIVATE")

	// 2. Natural idempotency: identical resubmission replays the same batch.
	resp, body = postEvidence(t, appA, evidenceBody(t, keyID, pemText, nil, events), nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Equal(t, false, body["created"])
	require.Equal(t, batchID, body["batch_id"])
	var batchCount int
	require.NoError(t, h.db.QueryRow(`
		SELECT COUNT(*) FROM sdk_evidence_batches WHERE tenant_id = 'tenant-ev-a'
	`).Scan(&batchCount))
	require.Equal(t, 1, batchCount, "resubmission must not duplicate the batch")

	// 3. GET returns the tenant-scoped status.
	req := httptest.NewRequest(http.MethodGet, "/v1/evidence/batches/"+batchID, nil)
	getResp, err := appA.Test(req, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, getResp.StatusCode)
	raw, err := io.ReadAll(getResp.Body)
	require.NoError(t, err)
	var status map[string]any
	require.NoError(t, json.Unmarshal(raw, &status))
	require.Equal(t, "verified", status["evidence_state"])
	require.Equal(t, "embedded", status["execution_provenance"])
	require.Equal(t, chainHead, status["chain_head"])
	require.NotNil(t, status["verified_at"])

	// 4. Cross-tenant reads are indistinguishable from absent.
	req = httptest.NewRequest(http.MethodGet, "/v1/evidence/batches/"+batchID, nil)
	crossResp, err := appB.Test(req, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, crossResp.StatusCode)
	crossRaw, err := io.ReadAll(crossResp.Body)
	require.NoError(t, err)
	require.Contains(t, string(crossRaw), "batch_not_found")

	// 5. Another tenant submitting the same evidence gets its own,
	// independent records (same public key, no cross-tenant join).
	resp, body = postEvidence(t, appB, evidenceBody(t, keyID, pemText, nil, events), nil)
	require.Equal(t, http.StatusAccepted, resp.StatusCode)
	require.Equal(t, true, body["created"])
	require.NotEqual(t, batchID, body["batch_id"])

	// 6. Continuation from the stored head is accepted; a gap is refused.
	signer := newTestSigner(t)
	chain := signer.chain(t, 6)
	appC := evidenceTestApp(h.db, "tenant-ev-c")

	resp, body = postEvidence(t, appC, evidenceBody(t, signer.keyID, signer.pem, nil, chain[:2]), nil)
	require.Equal(t, http.StatusAccepted, resp.StatusCode, "body: %v", body)
	head1 := body["chain_head"].(string)
	require.Equal(t, chain[1]["event_hash"], head1)

	// Correct continuation.
	resp, body = postEvidence(t, appC, evidenceBody(t, signer.keyID, signer.pem, head1, chain[2:4]), nil)
	require.Equal(t, http.StatusAccepted, resp.StatusCode, "body: %v", body)
	require.Equal(t, "verified", body["evidence_state"])

	// Gap: skipping chain[4] and claiming its hash as prev is a mismatch.
	resp, body = postEvidence(t, appC, evidenceBody(t, signer.keyID, signer.pem, chain[4]["event_hash"], chain[5:]), nil)
	require.Equal(t, http.StatusConflict, resp.StatusCode)
	require.Equal(t, "chain_head_mismatch", body["error"])
	require.Equal(t, chain[3]["event_hash"], body["expected_head"], "the server reports the real head for resync")

	// Fork: a different continuation of an ALREADY-EXTENDED position.
	fork := signer.event(t, "decision", "evt-fork", head1, map[string]any{"risk": "low"})
	resp, body = postEvidence(t, appC, evidenceBody(t, signer.keyID, signer.pem, head1, []map[string]any{fork}), nil)
	require.Equal(t, http.StatusConflict, resp.StatusCode)
	require.Equal(t, "chain_head_mismatch", body["error"])
}

func TestEvidenceIngestPostgresTamperedBatchRejected(t *testing.T) {
	h := openEvidencePostgres(t)
	events, pemText, keyID := loadFixtureJournal(t)
	app := evidenceTestApp(h.db, "tenant-ev-tamper")

	tampered := make([]map[string]any, len(events))
	for i, event := range events {
		clone := map[string]any{}
		for k, v := range event {
			clone[k] = v
		}
		tampered[i] = clone
	}
	tampered[2]["decision"] = "allowed" // flip the signed denial

	resp, body := postEvidence(t, app, evidenceBody(t, keyID, pemText, nil, tampered), nil)
	require.Equal(t, http.StatusAccepted, resp.StatusCode, "a failed verification is stored as rejected evidence, not an HTTP error")
	require.Equal(t, "rejected", body["evidence_state"])
	require.Equal(t, "embedded", body["execution_provenance"], "rejection never changes provenance")
	require.NotNil(t, body["verification_error_code"])
	issues := body["issues"].([]any)
	require.NotEmpty(t, issues)

	// Bounded metadata only: no event rows, no key registration, and the
	// stored issues carry index+code only — never payloads.
	var eventRows, keyRows int
	require.NoError(t, h.db.QueryRow(`SELECT COUNT(*) FROM sdk_evidence_events WHERE tenant_id = 'tenant-ev-tamper'`).Scan(&eventRows))
	require.NoError(t, h.db.QueryRow(`SELECT COUNT(*) FROM sdk_signing_keys WHERE tenant_id = 'tenant-ev-tamper'`).Scan(&keyRows))
	require.Equal(t, 0, eventRows, "no event from a rejected batch may be stored")
	require.Equal(t, 0, keyRows, "a rejected batch must not register a signing key")

	var storedIssues string
	require.NoError(t, h.db.QueryRow(`SELECT issues::text FROM sdk_evidence_batches WHERE tenant_id = 'tenant-ev-tamper'`).Scan(&storedIssues))
	require.NotContains(t, storedIssues, "redacted_input_summary", "issues must not embed event payloads")
	require.NotContains(t, storedIssues, tampered[2]["signature"].(string), "issues must not embed signature values")
	require.NotContains(t, storedIssues, "cus_", "issues must not embed event input summaries")

	// Resubmitting the SAME tampered bytes replays the rejected batch.
	resp, body = postEvidence(t, app, evidenceBody(t, keyID, pemText, nil, tampered), nil)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Equal(t, "rejected", body["evidence_state"])
	require.Equal(t, false, body["created"])

	// A rejected batch is never promoted and never blocks the truth: the
	// CORRECTED journal has a different byte-level batch identity, so it
	// creates a NEW verified batch while the rejected row stays rejected.
	resp, body = postEvidence(t, app, evidenceBody(t, keyID, pemText, nil, events), nil)
	require.Equal(t, http.StatusAccepted, resp.StatusCode, "body: %v", body)
	require.Equal(t, "verified", body["evidence_state"])
	var states []string
	rows, err := h.db.Query(`SELECT evidence_state FROM sdk_evidence_batches WHERE tenant_id = 'tenant-ev-tamper' ORDER BY received_at`)
	require.NoError(t, err)
	defer rows.Close()
	for rows.Next() {
		var state string
		require.NoError(t, rows.Scan(&state))
		states = append(states, state)
	}
	require.NoError(t, rows.Err())
	require.ElementsMatch(t, []string{"rejected", "verified"}, states)
}

func TestEvidenceIngestPostgresIdempotencyKey(t *testing.T) {
	h := openEvidencePostgres(t)
	events, pemText, keyID := loadFixtureJournal(t)
	app := evidenceTestApp(h.db, "tenant-ev-idem")
	headers := map[string]string{"Idempotency-Key": "evidence-op-1"}

	resp, body := postEvidence(t, app, evidenceBody(t, keyID, pemText, nil, events), headers)
	require.Equal(t, http.StatusAccepted, resp.StatusCode)
	originalBatch := body["batch_id"]

	// Same key + same batch fingerprint: byte-replay of the original result.
	req := httptest.NewRequest(http.MethodPost, "/v1/evidence/batches", strings.NewReader(string(evidenceBody(t, keyID, pemText, nil, events))))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Idempotency-Key", "evidence-op-1")
	replayResp, err := app.Test(req, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusAccepted, replayResp.StatusCode, "replay returns the ORIGINAL status")
	require.Equal(t, "true", replayResp.Header.Get("Idempotency-Replayed"))
	replayRaw, err := io.ReadAll(replayResp.Body)
	require.NoError(t, err)
	var replayBody map[string]any
	require.NoError(t, json.Unmarshal(replayRaw, &replayBody))
	require.Equal(t, originalBatch, replayBody["batch_id"])

	// Same key + different fingerprint: explicit 409, nothing stored.
	resp, body = postEvidence(t, app, evidenceBody(t, keyID, pemText, nil, events[:2]), headers)
	require.Equal(t, http.StatusConflict, resp.StatusCode)
	require.Equal(t, "idempotency_key_conflict", body["error"])
	var batches int
	require.NoError(t, h.db.QueryRow(`SELECT COUNT(*) FROM sdk_evidence_batches WHERE tenant_id = 'tenant-ev-idem'`).Scan(&batches))
	require.Equal(t, 1, batches, "the conflicting request must not have stored a batch")

	// The same key in ANOTHER tenant is isolated: fresh submission.
	otherApp := evidenceTestApp(h.db, "tenant-ev-idem-2")
	resp, body = postEvidence(t, otherApp, evidenceBody(t, keyID, pemText, nil, events), headers)
	require.Equal(t, http.StatusAccepted, resp.StatusCode, "body: %v", body)
	require.Equal(t, true, body["created"])
}

func TestEvidenceIngestPostgresConcurrentIdenticalSubmissions(t *testing.T) {
	h := openEvidencePostgres(t)
	h.db.SetMaxOpenConns(10)
	events, pemText, keyID := loadFixtureJournal(t)
	app := evidenceTestApp(h.db, "tenant-ev-race")
	body := evidenceBody(t, keyID, pemText, nil, events)

	const workers = 10
	statuses := make([]int, workers)
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			req := httptest.NewRequest(http.MethodPost, "/v1/evidence/batches", strings.NewReader(string(body)))
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

	acceptedCount := 0
	for i, status := range statuses {
		require.Contains(t, []int{http.StatusAccepted, http.StatusOK}, status, "worker %d got %d", i, status)
		if status == http.StatusAccepted {
			acceptedCount++
		}
	}
	require.Equal(t, 1, acceptedCount, "exactly one concurrent submission may observe creation")

	var batchRows, eventRows, keyRows int
	require.NoError(t, h.db.QueryRow(`SELECT COUNT(*) FROM sdk_evidence_batches WHERE tenant_id = 'tenant-ev-race'`).Scan(&batchRows))
	require.NoError(t, h.db.QueryRow(`SELECT COUNT(*) FROM sdk_evidence_events WHERE tenant_id = 'tenant-ev-race'`).Scan(&eventRows))
	require.NoError(t, h.db.QueryRow(`SELECT COUNT(*) FROM sdk_signing_keys WHERE tenant_id = 'tenant-ev-race'`).Scan(&keyRows))
	require.Equal(t, 1, batchRows, "concurrent identical submissions must create exactly one batch")
	require.Equal(t, len(events), eventRows, "and exactly one set of events")
	require.Equal(t, 1, keyRows)
}

func TestEvidenceIngestPostgresManagedProvenanceStructurallyImpossible(t *testing.T) {
	h := openEvidencePostgres(t)

	// Even a direct INSERT (bypassing the application entirely) cannot store
	// managed provenance in the SDK evidence tables.
	_, err := h.db.Exec(`
		INSERT INTO sdk_evidence_batches (tenant_id, key_id, evidence_state, content_hash, execution_provenance)
		VALUES ('t', 'ed25519:aaaaaaaaaaaaaaaa', 'verified', 'c-managed', 'managed')
	`)
	require.Error(t, err)
	require.Contains(t, err.Error(), "check", "the CHECK constraint must refuse managed provenance")

	_, err = h.db.Exec(`
		INSERT INTO sdk_evidence_events (tenant_id, key_id, event_hash, batch_id, event, event_id, event_type, action_name, contract_hash, timestamp_utc, execution_provenance)
		VALUES ('t', 'ed25519:aaaaaaaaaaaaaaaa', 'h', '00000000-0000-0000-0000-000000000000', '{}', 'e', 'decision', 'a', 'c', NOW(), 'managed')
	`)
	require.Error(t, err)
	require.Contains(t, err.Error(), "check")
}
