package api

// True end-to-end proof for the second Connected slice: the REAL Python SDK
// (subprocess, via uv) records guarded executions into a local journal under
// pure Embedded semantics (zero Connected configuration, zero network), then
// the developer EXPLICITLY runs `igris evidence sync`, which uploads the
// locally signed evidence over real HTTP through the REAL BetterAuth API-key
// middleware into REAL Postgres, where the server re-verifies every hash,
// signature, and chain link and stores it as embedded, verified evidence.
//
// Also proven here: repeat-sync idempotency (up to date), incremental
// continuation after new local events, server-side tamper rejection, cross-
// tenant isolation, and that the journal is byte-identical and still
// offline-verifiable after upload.
//
// Skipped unless a Postgres test DSN is set AND `uv` is on PATH.

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/internal/canonicaljson"
	"github.com/Igris-inertial/system/igris-overture/security"
)

const evidenceJournalScript = `
import sys

import igris
from igris.approval import ApprovalDecision
from igris.identity import LocalSigningIdentity, default_journal_path, load_public_key
from igris.verification import verify_journal


class AllowProvider:
    def decide(self, request):
        return ApprovalDecision("allowed", "e2e")


class DenyProvider:
    def decide(self, request):
        return ApprovalDecision("denied", "e2e")


# Every business argument is redacted so the journal is fully_redacted and
# the alpha.2 privacy preflight lets an ordinary explicit sync proceed. The
# retained-argument refusal and --allow-unredacted acknowledgement paths are
# proven separately in evidence_privacy_e2e_test.go.
@igris.guard(
    action="e2e.evidence.refund",
    risk="critical",
    approval_provider=AllowProvider(),
    redact=["customer_id", "amount", "memo"],
)
def refund(customer_id: str, amount: int, api_key: str, memo: str):
    if amount == 13:
        raise ValueError("unlucky amount")
    return {"ok": amount}


@igris.guard(action="e2e.evidence.denied", approval_provider=DenyProvider())
def never_runs():
    raise AssertionError("must not run")


n = int(sys.argv[1])
for i in range(n):
    assert refund("cus_ünïcode_001", i + 1, "secret-arg-value", 'café ☕ 日本語 <b>&amp;</b> "q"') == {"ok": i + 1}
try:
    refund("cus_fail", 13, "secret-arg-value", "fäilure path")
    raise AssertionError("expected ValueError")
except ValueError:
    pass
try:
    never_runs()
    raise AssertionError("expected ActionDenied")
except igris.ActionDenied:
    pass

identity = LocalSigningIdentity.load_or_create()
result = verify_journal(default_journal_path(), load_public_key(identity.public_key_path))
assert result.valid, result.issues
print("JOURNAL-OK", identity.key_id, result.events_verified)
`

func TestEvidenceIngestionEndToEndPythonSDK(t *testing.T) {
	uvPath, err := exec.LookPath("uv")
	if err != nil {
		t.Skip("uv is required to drive the Python SDK end-to-end")
	}
	h := openEvidencePostgres(t)

	// Minimal auth tables in the disposable schema: the exact columns the
	// BetterAuth API-key branch queries. Two tenants for isolation proofs.
	_, err = h.db.Exec(`
		CREATE TABLE tenants (
			tenant_id TEXT PRIMARY KEY,
			tenant_name TEXT DEFAULT '',
			tenant_email TEXT DEFAULT '',
			api_key_hash TEXT,
			is_active BOOLEAN DEFAULT true
		);
		CREATE TABLE tenant_api_keys (
			key_hash TEXT PRIMARY KEY,
			tenant_id TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'active'
		);
	`)
	require.NoError(t, err)
	const apiKeyA = "igris_e2e_evidence_key_a_not_real"
	const apiKeyB = "igris_e2e_evidence_key_b_not_real"
	for tenant, key := range map[string]string{"tenant-ev-e2e-a": apiKeyA, "tenant-ev-e2e-b": apiKeyB} {
		_, err = h.db.Exec(`
			INSERT INTO tenants (tenant_id, tenant_name, tenant_email, api_key_hash)
			VALUES ($1, $1, $1 || '@example.test', $2)
		`, tenant, security.HashAPIKey(key))
		require.NoError(t, err)
	}

	// Real registration: BetterAuth + rate limiter + handlers.
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	RegisterEvidenceRoutes(app, h.db)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	go func() { _ = app.Listener(listener) }()
	t.Cleanup(func() { _ = app.Shutdown() })
	baseURL := "http://" + listener.Addr().String()
	require.Eventually(t, func() bool {
		resp, err := http.Post(baseURL+"/v1/evidence/batches", "application/json", strings.NewReader("{}"))
		if err != nil {
			return false
		}
		defer resp.Body.Close()
		return resp.StatusCode == http.StatusUnauthorized // reachable, auth enforced
	}, 5*time.Second, 50*time.Millisecond)

	repoRoot, err := filepath.Abs(filepath.Join("..", ".."))
	require.NoError(t, err)
	sdkDir := filepath.Join(repoRoot, "sdk", "python")
	igrisHome := t.TempDir()
	scriptPath := filepath.Join(t.TempDir(), "evidence_journal_e2e.py")
	require.NoError(t, os.WriteFile(scriptPath, []byte(evidenceJournalScript), 0o644))

	runPython := func(env []string, args ...string) string {
		t.Helper()
		cmd := exec.Command(uvPath, args...)
		cmd.Dir = sdkDir
		cmd.Env = append(os.Environ(), env...)
		output, err := cmd.CombinedOutput()
		require.NoError(t, err, "uv %v failed:\n%s", args, output)
		return string(output)
	}
	runPythonExpectFailure := func(env []string, args ...string) string {
		t.Helper()
		cmd := exec.Command(uvPath, args...)
		cmd.Dir = sdkDir
		cmd.Env = append(os.Environ(), env...)
		output, err := cmd.CombinedOutput()
		require.Error(t, err, "uv %v unexpectedly succeeded:\n%s", args, output)
		return string(output)
	}

	// 1. Generate the journal with the REAL SDK under pure Embedded
	// semantics: NO Connected configuration, so guarded execution performs
	// zero network activity and no automatic upload can exist.
	embeddedEnv := []string{"IGRIS_HOME=" + igrisHome}
	output := runPython(embeddedEnv, "run", "python", scriptPath, "3")
	require.Contains(t, output, "JOURNAL-OK")
	fields := strings.Fields(lastLine(output))
	require.Len(t, fields, 3)
	keyID := fields[1]
	// 3 refunds (2 events each) + 1 failure (2) + 1 denial (1) = 9 events.
	require.Equal(t, "9", fields[2])

	journalPath := filepath.Join(igrisHome, "journal.jsonl")
	journalBefore, err := os.ReadFile(journalPath)
	require.NoError(t, err)
	journalDigestBefore := sha256.Sum256(journalBefore)

	connectedEnv := []string{
		"IGRIS_HOME=" + igrisHome,
		"IGRIS_API_URL=" + baseURL,
		"IGRIS_API_KEY=" + apiKeyA,
	}

	// 2. Sync with incomplete configuration fails clearly (exit != 0). The
	// journal is fully redacted, so the alpha.2 privacy preflight passes and
	// configuration validation is actually reached.
	partialOutput := runPythonExpectFailure(
		[]string{"IGRIS_HOME=" + igrisHome, "IGRIS_API_URL=" + baseURL},
		"run", "igris", "evidence", "sync",
	)
	require.Contains(t, partialOutput, "IGRIS_API_KEY")

	// 3. Explicit evidence sync through the real CLI, real HTTP, real
	// BetterAuth API-key auth, real Postgres.
	syncOutput := runPython(connectedEnv, "run", "igris", "evidence", "sync")
	require.Contains(t, syncOutput, "OK: local verification passed")
	require.Contains(t, syncOutput, "verified")
	require.Contains(t, syncOutput, "embedded")

	// Server state: one verified batch, 9 embedded events, public key only.
	var batchID, evidenceState, provenance string
	var eventsVerified int
	require.NoError(t, h.db.QueryRow(`
		SELECT id, evidence_state, execution_provenance, events_verified
		FROM sdk_evidence_batches WHERE tenant_id = 'tenant-ev-e2e-a'
	`).Scan(&batchID, &evidenceState, &provenance, &eventsVerified))
	require.Equal(t, "verified", evidenceState)
	require.Equal(t, "embedded", provenance)
	require.Equal(t, 9, eventsVerified)

	var eventCount int
	require.NoError(t, h.db.QueryRow(`
		SELECT COUNT(*) FROM sdk_evidence_events
		WHERE tenant_id = 'tenant-ev-e2e-a' AND key_id = $1 AND execution_provenance = 'embedded'
	`, keyID).Scan(&eventCount))
	require.Equal(t, 9, eventCount)

	var storedPEM string
	require.NoError(t, h.db.QueryRow(`
		SELECT public_key_pem FROM sdk_signing_keys WHERE tenant_id = 'tenant-ev-e2e-a' AND key_id = $1
	`, keyID).Scan(&storedPEM))
	require.Contains(t, storedPEM, "BEGIN PUBLIC KEY")
	require.NotContains(t, storedPEM, "PRIVATE")

	// No raw argument value ever reaches the backend (redaction happened at
	// guard time; the journal itself is the upload).
	var leaked int
	require.NoError(t, h.db.QueryRow(`
		SELECT COUNT(*) FROM sdk_evidence_events WHERE event::text LIKE '%secret-arg-value%'
	`).Scan(&leaked))
	require.Equal(t, 0, leaked)
	require.NoError(t, h.db.QueryRow(`
		SELECT COUNT(*) FROM sdk_evidence_events WHERE event::text LIKE '%`+apiKeyA+`%'
	`).Scan(&leaked))
	require.Equal(t, 0, leaked, "the API credential must never be stored as evidence")

	// 4. Repeat sync of the UNCHANGED journal: the derived Idempotency-Key
	// and the batch content identity both match, so the endpoint replays the
	// original result and no new row is created. Exit 0. The journal is
	// byte-identical after both uploads.
	repeatOutput := runPython(connectedEnv, "run", "igris", "evidence", "sync")
	require.Contains(t, repeatOutput, "OK: local verification passed")
	var batchCount int
	require.NoError(t, h.db.QueryRow(`
		SELECT COUNT(*) FROM sdk_evidence_batches WHERE tenant_id = 'tenant-ev-e2e-a'
	`).Scan(&batchCount))
	require.Equal(t, 1, batchCount, "a repeated sync must not create a second batch")
	journalAfter, err := os.ReadFile(journalPath)
	require.NoError(t, err)
	require.Equal(t, journalDigestBefore, sha256.Sum256(journalAfter), "sync must never modify the journal")

	// 5. New local executions, then sync again: ONLY the remainder uploads
	// as a chain-linked continuation (the server reports its stored head;
	// the SDK resumes after it). Another run of the script adds 5 events.
	runPython(embeddedEnv, "run", "python", scriptPath, "1")
	incrementalOutput := runPython(connectedEnv, "run", "igris", "evidence", "sync")
	require.Contains(t, incrementalOutput, "synced 5 event(s)", "output:\n%s", incrementalOutput)
	require.NoError(t, h.db.QueryRow(`
		SELECT COUNT(*) FROM sdk_evidence_events WHERE tenant_id = 'tenant-ev-e2e-a'
	`).Scan(&eventCount))
	require.Equal(t, 14, eventCount)

	// 5b. A further sync with nothing new: the stored head equals the local
	// tail, so the SDK reports up to date without uploading anything.
	upToDateOutput := runPython(connectedEnv, "run", "igris", "evidence", "sync")
	require.Contains(t, upToDateOutput, "already up to date", "output:\n%s", upToDateOutput)
	require.NoError(t, h.db.QueryRow(`
		SELECT COUNT(*) FROM sdk_evidence_batches WHERE tenant_id = 'tenant-ev-e2e-a'
	`).Scan(&batchCount))
	require.Equal(t, 2, batchCount)

	// 6. The grown journal is untouched and still passes offline
	// verification after all uploads.
	journalGrown, err := os.ReadFile(journalPath)
	require.NoError(t, err)
	journalGrownDigest := sha256.Sum256(journalGrown)
	verifyOutput := runPython(embeddedEnv, "run", "igris", "verify")
	require.Contains(t, verifyOutput, "OK: 14 event(s) verified")
	journalFinal, err := os.ReadFile(journalPath)
	require.NoError(t, err)
	require.Equal(t, journalGrownDigest, sha256.Sum256(journalFinal))

	// 7. Local tamper: the SDK refuses BEFORE any upload (nonzero exit).
	tamperedHome := t.TempDir()
	copyDir(t, igrisHome, tamperedHome)
	tamperedJournal := filepath.Join(tamperedHome, "journal.jsonl")
	tamperedBytes, err := os.ReadFile(tamperedJournal)
	require.NoError(t, err)
	require.Contains(t, string(tamperedBytes), `"status":"succeeded"`)
	require.NoError(t, os.WriteFile(tamperedJournal, bytes.Replace(tamperedBytes, []byte(`"status":"succeeded"`), []byte(`"status":"failed"   `), 1), 0o600))
	tamperOutput := runPythonExpectFailure(
		[]string{"IGRIS_HOME=" + tamperedHome, "IGRIS_API_URL=" + baseURL, "IGRIS_API_KEY=" + apiKeyB},
		"run", "igris", "evidence", "sync",
	)
	require.Contains(t, tamperOutput, "LOCAL verification")

	// 8. Server-side tamper rejection: submit the tampered events directly
	// (bypassing the SDK's local check) as tenant B — the server recomputes
	// hashes and stores the batch as rejected, embedded, with NO events.
	tamperedEvents := journalLinesToEvents(t, tamperedJournal)
	pemBytes, err := os.ReadFile(filepath.Join(tamperedHome, "verify_key.pem"))
	require.NoError(t, err)
	submission := map[string]any{
		"key_id":         keyID,
		"public_key_pem": string(pemBytes),
		"journal_segment": map[string]any{
			"first_previous_event_hash": nil,
			"events":                    tamperedEvents,
		},
	}
	body, err := json.Marshal(submission)
	require.NoError(t, err)
	req, err := http.NewRequest(http.MethodPost, baseURL+"/v1/evidence/batches", bytes.NewReader(body))
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKeyB)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, http.StatusAccepted, resp.StatusCode, "body: %s", respBody)
	var decoded map[string]any
	require.NoError(t, json.Unmarshal(respBody, &decoded))
	require.Equal(t, "rejected", decoded["evidence_state"])
	require.Equal(t, "embedded", decoded["execution_provenance"])
	var tenantBEvents int
	require.NoError(t, h.db.QueryRow(`
		SELECT COUNT(*) FROM sdk_evidence_events WHERE tenant_id = 'tenant-ev-e2e-b'
	`).Scan(&tenantBEvents))
	require.Equal(t, 0, tenantBEvents, "no event from a rejected batch may be stored")

	// 9. Cross-tenant isolation: tenant B cannot read tenant A's batch even
	// knowing its exact id.
	req, err = http.NewRequest(http.MethodGet, baseURL+"/v1/evidence/batches/"+batchID, nil)
	require.NoError(t, err)
	req.Header.Set("Authorization", "Bearer "+apiKeyB)
	resp, err = http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()
	require.Equal(t, http.StatusNotFound, resp.StatusCode)

	// 10. The SDK status command reads the tenant-scoped batch.
	statusOutput := runPython(connectedEnv, "run", "igris", "evidence", "status", batchID)
	require.Contains(t, statusOutput, "evidence_state: verified")
	require.Contains(t, statusOutput, "execution_provenance: embedded")

	fmt.Println("evidence e2e verified: explicit sync, idempotent replay, incremental continuation, tamper rejection, tenant isolation")
}

func journalLinesToEvents(t *testing.T, path string) []map[string]any {
	t.Helper()
	raw, err := os.ReadFile(path)
	require.NoError(t, err)
	var events []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(string(raw)), "\n") {
		event, err := canonicaljson.DecodeObjectPreserving([]byte(line))
		require.NoError(t, err)
		events = append(events, event)
	}
	return events
}

func copyDir(t *testing.T, src, dst string) {
	t.Helper()
	entries, err := os.ReadDir(src)
	require.NoError(t, err)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		data, err := os.ReadFile(filepath.Join(src, entry.Name()))
		require.NoError(t, err)
		require.NoError(t, os.WriteFile(filepath.Join(dst, entry.Name()), data, 0o600))
	}
}
