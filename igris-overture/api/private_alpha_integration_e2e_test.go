package api

import (
	"crypto/sha256"
	"fmt"
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

	"github.com/Igris-inertial/system/igris-overture/security"
)

const privateAlphaCrossSliceScript = `
import os
from pathlib import Path

import igris
from igris.identity import LocalSigningIdentity, default_journal_path, load_public_key
from igris.verification import verify_journal

marker = Path(os.environ["ALPHA_EXECUTION_MARKER"])

@igris.guard(
    action="alpha.customer.refund",
    risk="high",
    approval="never",
    # Evidence v1 persists a bounded redacted input summary. Explicitly
    # redact every business argument for the no-function-value proof.
    redact=["customer_id", "amount", "local_path"],
)
def refund(customer_id: str, amount: int, api_key: str, local_path: str):
    marker.write_text(marker.read_text() + "executed\n" if marker.exists() else "executed\n")
    return {"ok": amount}

assert refund("customer-secret-value", 25, os.environ["ALPHA_SECRET_ARGUMENT"], os.environ["ALPHA_LOCAL_PATH"]) == {"ok": 25}
contract = refund.__igris_contract__
identity = LocalSigningIdentity.load_or_create()
verification = verify_journal(default_journal_path(), load_public_key(identity.public_key_path))
assert verification.valid, verification.issues
assert verification.events_verified == 2
print("PRIVATE-ALPHA-CROSS-SLICE-OK", contract.contract_hash)
`

func TestPrivateAlphaCrossSliceEndToEnd(t *testing.T) {
	uvPath, err := exec.LookPath("uv")
	if err != nil {
		t.Skip("uv is required to drive the Python SDK end-to-end")
	}
	h := openEvidencePostgres(t)
	db := h.db
	_, err = db.Exec(`
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

	const tenantID = "tenant-private-alpha"
	const apiKey = "igris_private_alpha_test_key_not_real"
	_, err = db.Exec(`
		INSERT INTO tenants (tenant_id, tenant_name, tenant_email, api_key_hash)
		VALUES ($1, 'Private Alpha', 'alpha@example.test', $2)
	`, tenantID, security.HashAPIKey(apiKey))
	require.NoError(t, err)

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	RegisterContractRoutes(app, db)
	RegisterEvidenceRoutes(app, db)
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	go func() { _ = app.Listener(listener) }()
	t.Cleanup(func() { _ = app.Shutdown() })
	baseURL := "http://" + listener.Addr().String()
	require.Eventually(t, func() bool {
		resp, err := http.Post(baseURL+"/v1/contracts/sync", "application/json", strings.NewReader("{}"))
		if err != nil {
			return false
		}
		defer resp.Body.Close()
		return resp.StatusCode == http.StatusUnauthorized
	}, 5*time.Second, 50*time.Millisecond)

	repoRoot, err := filepath.Abs(filepath.Join("..", ".."))
	require.NoError(t, err)
	sdkDir := filepath.Join(repoRoot, "sdk", "python")
	igrisHome := t.TempDir()
	markerPath := filepath.Join(t.TempDir(), "executions.txt")
	localPathSecret := filepath.Join(t.TempDir(), "must-not-leak")
	const secretArgument = "alpha-secret-argument-value"
	scriptPath := filepath.Join(t.TempDir(), "private_alpha_cross_slice.py")
	require.NoError(t, os.WriteFile(scriptPath, []byte(privateAlphaCrossSliceScript), 0o600))
	env := []string{
		"IGRIS_HOME=" + igrisHome,
		"IGRIS_API_URL=" + baseURL,
		"IGRIS_API_KEY=" + apiKey,
		"ALPHA_EXECUTION_MARKER=" + markerPath,
		"ALPHA_SECRET_ARGUMENT=" + secretArgument,
		"ALPHA_LOCAL_PATH=" + localPathSecret,
	}
	run := func(expectSuccess bool, args ...string) string {
		t.Helper()
		cmd := exec.Command(uvPath, args...)
		cmd.Dir = sdkDir
		cmd.Env = append(os.Environ(), env...)
		output, err := cmd.CombinedOutput()
		if expectSuccess {
			require.NoError(t, err, "uv %v failed:\n%s", args, output)
		} else {
			require.Error(t, err, "uv %v unexpectedly succeeded:\n%s", args, output)
		}
		return string(output)
	}

	output := run(true, "run", "python", scriptPath)
	require.Contains(t, output, "PRIVATE-ALPHA-CROSS-SLICE-OK")
	fields := strings.Fields(lastLine(output))
	require.Len(t, fields, 2)
	contractHash := fields[1]
	require.Equal(t, "executed\n", string(mustReadFile(t, markerPath)))

	// Guarded execution synchronized the contract but uploaded no evidence.
	var contractRows, batchRows int
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM action_contract_versions WHERE tenant_id = $1 AND action_name = 'alpha.customer.refund' AND contract_hash = $2`, tenantID, contractHash).Scan(&contractRows))
	require.Equal(t, 1, contractRows)
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM sdk_evidence_batches WHERE tenant_id = $1`, tenantID).Scan(&batchRows))
	require.Zero(t, batchRows, "guard must never upload evidence automatically")

	journalPath := filepath.Join(igrisHome, "journal.jsonl")
	journalBefore := mustReadFile(t, journalPath)
	journalDigest := sha256.Sum256(journalBefore)
	verifyOutput := run(true, "run", "igris", "verify")
	require.Contains(t, verifyOutput, "OK: 2 event(s) verified")
	syncOutput := run(true, "run", "igris", "evidence", "sync")
	require.Contains(t, syncOutput, "synced 2 event(s)")

	var batchID, storedTenant string
	require.NoError(t, db.QueryRow(`SELECT id, tenant_id FROM sdk_evidence_batches WHERE tenant_id = $1`, tenantID).Scan(&batchID, &storedTenant))
	require.Equal(t, tenantID, storedTenant)
	statusOutput := run(true, "run", "igris", "evidence", "status", batchID)
	require.Contains(t, statusOutput, "evidence_state: verified")
	require.Contains(t, statusOutput, "execution_provenance: embedded")

	var eventRows int
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM sdk_evidence_events WHERE tenant_id = $1 AND contract_hash = $2`, tenantID, contractHash).Scan(&eventRows))
	require.Equal(t, 2, eventRows, "stored evidence must reference the synchronized contract")
	repeatOutput := run(true, "run", "igris", "evidence", "sync")
	require.Contains(t, repeatOutput, "OK: local verification passed")
	require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM sdk_evidence_batches WHERE tenant_id = $1`, tenantID).Scan(&batchRows))
	require.Equal(t, 1, batchRows, "repeated evidence sync must replay without a duplicate batch")
	require.Equal(t, journalDigest, sha256.Sum256(mustReadFile(t, journalPath)))

	// An explicit evidence-sync auth failure neither mutates the journal nor
	// imports/executes the guarded function again.
	failedEnv := env
	for i := range failedEnv {
		if strings.HasPrefix(failedEnv[i], "IGRIS_API_KEY=") {
			failedEnv[i] = "IGRIS_API_KEY=igris_wrong_private_alpha_key"
		}
	}
	cmd := exec.Command(uvPath, "run", "igris", "evidence", "sync")
	cmd.Dir = sdkDir
	cmd.Env = append(os.Environ(), failedEnv...)
	_, err = cmd.CombinedOutput()
	require.Error(t, err)
	require.Equal(t, "executed\n", string(mustReadFile(t, markerPath)))
	require.Equal(t, journalDigest, sha256.Sum256(mustReadFile(t, journalPath)))

	// Connected storage contains no function value, credential, private key,
	// or local absolute path from this flow.
	for label, secret := range map[string]string{
		"function argument": "customer-secret-value",
		"SDK secret":        secretArgument,
		"API key":           apiKey,
		"private key":       "PRIVATE KEY",
		"local path":        localPathSecret,
	} {
		var leaked int
		require.NoError(t, db.QueryRow(`
			SELECT
				(SELECT COUNT(*) FROM action_contract_versions WHERE contract::text LIKE '%' || $1 || '%') +
				(SELECT COUNT(*) FROM sdk_evidence_events WHERE event::text LIKE '%' || $1 || '%') +
				(SELECT COUNT(*) FROM sdk_signing_keys WHERE public_key_pem LIKE '%' || $1 || '%')
		`, secret).Scan(&leaked))
		require.Zero(t, leaked, "%s must not be stored in Connected tables", label)
	}

	fmt.Println("private alpha cross-slice e2e verified")
}

func mustReadFile(t *testing.T, path string) []byte {
	t.Helper()
	data, err := os.ReadFile(path)
	require.NoError(t, err)
	return data
}
