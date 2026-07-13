package api

// End-to-end proofs for the alpha.2 evidence privacy preflight, driven
// through the REAL Python SDK CLI (subprocess, via uv):
//
//   1. A journal that retains ordinary argument values refuses `igris
//      evidence sync` with the dedicated exit code 3 BEFORE configuration
//      validation, client creation, or any network connection.
//   2. `--allow-unredacted` acknowledges exactly one invocation: the
//      acknowledged sync uploads through real HTTP + BetterAuth + Postgres,
//      and the very next unacknowledged sync refuses again.
//
// The fully redacted happy path, missing-key configuration error, tamper
// rejection, idempotency, and isolation proofs live in
// evidence_ingestion_e2e_test.go.

import (
	"crypto/sha256"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/security"
)

// Retains one ordinary argument value (a synthetic unicode business label)
// so the decision classifies as partially_redacted; the api_key parameter is
// redacted by the SDK's default sensitive-name list. Synthetic data only.
const retainedJournalScript = `
import igris
from igris.approval import ApprovalDecision


class AllowProvider:
    def decide(self, request):
        return ApprovalDecision("allowed", "e2e")


@igris.guard(action="e2e.privacy.retained", approval_provider=AllowProvider())
def tag_account(account_label: str, api_key: str):
    return account_label


assert tag_account("synthetic-业务-label-e2e", api_key="secret-arg-value") == "synthetic-业务-label-e2e"
print("RETAINED-JOURNAL-OK")
`

const exitPrivacyAckRequired = 3 // sdk/python cli EXIT_PRIVACY_ACK_REQUIRED

type sdkRunner struct {
	t      *testing.T
	uvPath string
	sdkDir string
}

func newSDKRunner(t *testing.T) *sdkRunner {
	t.Helper()
	uvPath, err := exec.LookPath("uv")
	if err != nil {
		t.Skip("uv is required to drive the Python SDK end-to-end")
	}
	repoRoot, err := filepath.Abs(filepath.Join("..", ".."))
	require.NoError(t, err)
	return &sdkRunner{t: t, uvPath: uvPath, sdkDir: filepath.Join(repoRoot, "sdk", "python")}
}

// env returns a copy of the process environment with every IGRIS_* variable
// removed, then the given entries appended, so an operator shell exporting
// Connected configuration cannot change what these tests prove.
func (r *sdkRunner) env(extra ...string) []string {
	base := make([]string, 0, len(os.Environ())+len(extra))
	for _, kv := range os.Environ() {
		if strings.HasPrefix(kv, "IGRIS_") {
			continue
		}
		base = append(base, kv)
	}
	return append(base, extra...)
}

func (r *sdkRunner) run(env []string, args ...string) string {
	r.t.Helper()
	cmd := exec.Command(r.uvPath, args...)
	cmd.Dir = r.sdkDir
	cmd.Env = env
	output, err := cmd.CombinedOutput()
	require.NoError(r.t, err, "uv %v failed:\n%s", args, output)
	return string(output)
}

func (r *sdkRunner) runExpectExit(env []string, wantExit int, args ...string) string {
	r.t.Helper()
	cmd := exec.Command(r.uvPath, args...)
	cmd.Dir = r.sdkDir
	cmd.Env = env
	output, err := cmd.CombinedOutput()
	require.Error(r.t, err, "uv %v unexpectedly succeeded:\n%s", args, output)
	var exitErr *exec.ExitError
	require.ErrorAs(r.t, err, &exitErr, "output:\n%s", output)
	require.Equal(r.t, wantExit, exitErr.ExitCode(), "output:\n%s", output)
	return string(output)
}

func (r *sdkRunner) writeRetainedJournal(igrisHome string) string {
	r.t.Helper()
	scriptPath := filepath.Join(r.t.TempDir(), "retained_journal_e2e.py")
	require.NoError(r.t, os.WriteFile(scriptPath, []byte(retainedJournalScript), 0o644))
	output := r.run(r.env("IGRIS_HOME="+igrisHome), "run", "python", scriptPath)
	require.Contains(r.t, output, "RETAINED-JOURNAL-OK")
	return filepath.Join(igrisHome, "journal.jsonl")
}

func TestEvidenceSyncPrivacyPreflightPrecedesConfigAndNetwork(t *testing.T) {
	sdk := newSDKRunner(t)
	igrisHome := t.TempDir()
	journalPath := sdk.writeRetainedJournal(igrisHome)
	journalBefore, err := os.ReadFile(journalPath)
	require.NoError(t, err)
	journalDigest := sha256.Sum256(journalBefore)

	// A listener that must never be contacted: any accepted connection is a
	// test failure. This stands in for "no DNS, no client, no HTTP".
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	var connections atomic.Int64
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			connections.Add(1)
			_ = conn.Close()
		}
	}()
	t.Cleanup(func() { _ = listener.Close() })
	guardURL := "http://" + listener.Addr().String()

	// 1. No configuration at all: the preflight refuses with exit code 3
	// before configuration validation — the error is the privacy refusal,
	// not the missing-key error, and no retained value is echoed.
	unconfigured := sdk.runExpectExit(
		sdk.env("IGRIS_HOME="+igrisHome),
		exitPrivacyAckRequired,
		"run", "igris", "evidence", "sync",
	)
	require.Contains(t, unconfigured, "privacy preflight")
	require.Contains(t, unconfigured, "--allow-unredacted")
	require.NotContains(t, unconfigured, "IGRIS_API_KEY",
		"the preflight must refuse before configuration validation runs")
	require.NotContains(t, unconfigured, "synthetic-业务-label-e2e",
		"a refusal must never echo retained argument values")

	// 2. Full, valid-looking configuration: still exit code 3, and the
	// endpoint is never contacted.
	configured := sdk.runExpectExit(
		sdk.env(
			"IGRIS_HOME="+igrisHome,
			"IGRIS_API_URL="+guardURL,
			"IGRIS_API_KEY=igris_e2e_privacy_key_not_real",
		),
		exitPrivacyAckRequired,
		"run", "igris", "evidence", "sync",
	)
	require.Contains(t, configured, "privacy preflight")
	require.Equal(t, int64(0), connections.Load(),
		"a refused sync must not create any network connection")

	// 3. Refusals never rewrite the journal.
	journalAfter, err := os.ReadFile(journalPath)
	require.NoError(t, err)
	require.Equal(t, journalDigest, sha256.Sum256(journalAfter))
}

func TestEvidenceSyncAllowUnredactedIsInvocationOnly(t *testing.T) {
	sdk := newSDKRunner(t)
	h := openEvidencePostgres(t)

	_, err := h.db.Exec(`
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
	const apiKey = "igris_e2e_privacy_ack_key_not_real"
	_, err = h.db.Exec(`
		INSERT INTO tenants (tenant_id, tenant_name, tenant_email, api_key_hash)
		VALUES ('tenant-priv-ack', 'tenant-priv-ack', 'priv-ack@example.test', $1)
	`, security.HashAPIKey(apiKey))
	require.NoError(t, err)

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
		return resp.StatusCode == http.StatusUnauthorized
	}, 5*time.Second, 50*time.Millisecond)

	igrisHome := t.TempDir()
	sdk.writeRetainedJournal(igrisHome)
	connected := sdk.env(
		"IGRIS_HOME="+igrisHome,
		"IGRIS_API_URL="+baseURL,
		"IGRIS_API_KEY="+apiKey,
	)

	// 1. Without acknowledgement the retained journal refuses (exit 3) and
	// nothing reaches the server.
	sdk.runExpectExit(connected, exitPrivacyAckRequired, "run", "igris", "evidence", "sync")
	var batches int
	require.NoError(t, h.db.QueryRow(`SELECT COUNT(*) FROM sdk_evidence_batches`).Scan(&batches))
	require.Equal(t, 0, batches, "a refused sync must not create a batch")

	// 2. The explicit acknowledgement permits this one invocation: the
	// journal uploads through real HTTP + auth and verifies server-side.
	ackOutput := sdk.run(connected, "run", "igris", "evidence", "sync", "--allow-unredacted")
	require.Contains(t, ackOutput, "OK: local verification passed")
	require.Contains(t, ackOutput, "verified")
	var evidenceState, provenance string
	require.NoError(t, h.db.QueryRow(`
		SELECT evidence_state, execution_provenance FROM sdk_evidence_batches
		WHERE tenant_id = 'tenant-priv-ack'
	`).Scan(&evidenceState, &provenance))
	require.Equal(t, "verified", evidenceState)
	require.Equal(t, "embedded", provenance)

	// 3. The acknowledgement is not persisted anywhere: the very next
	// unacknowledged sync of the same journal refuses again with exit 3
	// before any request, and no second batch appears.
	sdk.runExpectExit(connected, exitPrivacyAckRequired, "run", "igris", "evidence", "sync")
	require.NoError(t, h.db.QueryRow(`SELECT COUNT(*) FROM sdk_evidence_batches`).Scan(&batches))
	require.Equal(t, 1, batches, "an unacknowledged retry must not upload")
}
