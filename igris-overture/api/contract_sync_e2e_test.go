package api

// True end-to-end proof for the first Connected slice: the REAL Python SDK
// (subprocess, via uv) guards functions with Connected mode explicitly
// configured, synchronizes contracts over real HTTP through the REAL
// BetterAuth API-key middleware into REAL Postgres, and continues executing
// locally under Embedded semantics with an offline-verifiable journal.
//
// Skipped unless a Postgres test DSN is set (see routes_contracts_postgres_test.go)
// AND `uv` is on PATH.

import (
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

const contractSyncE2EScript = `
import json
import os
import urllib.error
import urllib.request

import igris
from igris import connected
from igris.canonical import canonical_json_bytes, sha256_hex

calls = []


@igris.guard(action="e2e.customer.refund", risk="high", approval="never")
def refund(customer_id: str, amount: int, api_key: str):
    calls.append(amount)
    return {"ok": amount}


# First guarded execution syncs the contract, then executes locally.
assert refund("cus_1", 100, "secret-arg-value") == {"ok": 100}
# Second execution reuses the in-process sync cache.
assert refund("cus_2", 200, "secret-arg-value") == {"ok": 200}
assert calls == [100, 200], "local Embedded execution must continue working"
c1 = refund.__igris_contract__


# A changed declaration is a NEW contract version of the same logical action.
@igris.guard(action="e2e.customer.refund", risk="critical", approval="never")
def refund_v2(customer_id: str, amount: int):
    return {"ok": amount}


assert refund_v2("cus_3", 300) == {"ok": 300}
c2 = refund_v2.__igris_contract__
assert c1.contract_hash != c2.contract_hash

# Local Embedded evidence still exists and verifies offline (6 events).
from igris.identity import LocalSigningIdentity, default_journal_path, load_public_key
from igris.verification import verify_journal

identity = LocalSigningIdentity.load_or_create()
result = verify_journal(default_journal_path(), load_public_key(identity.public_key_path))
assert result.valid, result.issues
assert result.events_verified == 6, result.events_verified

# Idempotency conflict: reuse the SDK's derived key for c2 with a tampered
# contract (different fingerprint) -> the endpoint must refuse with 409.
tampered = connected.contract_wire_payload(c2)
tampered["risk"] = "low"
unsigned = {k: v for k, v in tampered.items() if k != "contract_hash"}
tampered["contract_hash"] = sha256_hex(canonical_json_bytes(unsigned))
request = urllib.request.Request(
    os.environ["IGRIS_API_URL"] + "/v1/contracts/sync",
    data=json.dumps({"contract": tampered}).encode("utf-8"),
    method="POST",
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer " + os.environ["IGRIS_API_KEY"],
        "Idempotency-Key": connected.derive_idempotency_key(c2),
    },
)
try:
    urllib.request.urlopen(request, timeout=10)
    raise AssertionError("expected 409 idempotency_key_conflict")
except urllib.error.HTTPError as exc:
    assert exc.code == 409, exc.code
    assert json.loads(exc.read())["error"] == "idempotency_key_conflict"

# Authentication failure prevents execution: real 401 from real middleware.
bad_client = connected.HttpContractSyncClient(
    connected.ConnectedConfig(endpoint=os.environ["IGRIS_API_URL"], token="igris_wrong_key")
)
executed = []


@igris.guard(action="e2e.failing.sync", risk="low", approval="never", sync_client=bad_client)
def never_runs():
    executed.append(1)


try:
    never_runs()
    raise AssertionError("expected ContractSyncError")
except igris.ContractSyncError as exc:
    assert exc.execution_occurred is False
    assert exc.status_code in (401, 403), exc.status_code
    assert "igris_wrong_key" not in str(exc)
assert executed == [], "the consequential function must not run after a sync failure"

print("E2E-OK", c1.contract_hash, c2.contract_hash)
`

func TestContractSyncEndToEndPythonSDK(t *testing.T) {
	uvPath, err := exec.LookPath("uv")
	if err != nil {
		t.Skip("uv is required to drive the Python SDK end-to-end")
	}
	db := openContractPostgres(t)

	// Minimal auth tables in the disposable schema: the exact columns the
	// BetterAuth API-key branch queries.
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

	const apiKey = "igris_e2e_test_key_not_real"
	_, err = db.Exec(`
		INSERT INTO tenants (tenant_id, tenant_name, tenant_email, api_key_hash)
		VALUES ('tenant-e2e', 'E2E', 'e2e@example.test', $1)
	`, security.HashAPIKey(apiKey))
	require.NoError(t, err)

	// Real registration: BetterAuth + rate limiter + handlers.
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	RegisterContractRoutes(app, db)

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
		return resp.StatusCode == http.StatusUnauthorized // reachable, auth enforced
	}, 5*time.Second, 50*time.Millisecond)

	repoRoot, err := filepath.Abs(filepath.Join("..", ".."))
	require.NoError(t, err)
	sdkDir := filepath.Join(repoRoot, "sdk", "python")
	scriptPath := filepath.Join(t.TempDir(), "contract_sync_e2e.py")
	require.NoError(t, os.WriteFile(scriptPath, []byte(contractSyncE2EScript), 0o644))

	cmd := exec.Command(uvPath, "run", "python", scriptPath)
	cmd.Dir = sdkDir
	cmd.Env = append(os.Environ(),
		"IGRIS_API_URL="+baseURL,
		"IGRIS_API_KEY="+apiKey,
		"IGRIS_HOME="+t.TempDir(),
	)
	output, err := cmd.CombinedOutput()
	require.NoError(t, err, "python SDK e2e failed:\n%s", output)
	require.Contains(t, string(output), "E2E-OK", "output:\n%s", output)

	fields := strings.Fields(strings.TrimSpace(lastLine(string(output))))
	require.Len(t, fields, 3, "expected 'E2E-OK <hash1> <hash2>', got: %s", output)
	hash1, hash2 := fields[1], fields[2]

	// The backend now holds exactly the two immutable versions the SDK
	// declared, with the server-recomputed (Python-equal) hashes, attached
	// to one auto-created, non-executable logical action.
	var versionCount int
	require.NoError(t, db.QueryRow(`
		SELECT COUNT(*) FROM action_contract_versions
		WHERE tenant_id = 'tenant-e2e' AND action_name = 'e2e.customer.refund'
	`).Scan(&versionCount))
	require.Equal(t, 2, versionCount)
	for _, hash := range []string{hash1, hash2} {
		var one int
		require.NoError(t, db.QueryRow(`
			SELECT COUNT(*) FROM action_contract_versions
			WHERE tenant_id = 'tenant-e2e' AND action_name = 'e2e.customer.refund' AND contract_hash = $1
		`, hash).Scan(&one), hash)
		require.Equal(t, 1, one, "server-side hash must equal the SDK-computed hash %s", hash)
	}

	var targetType, origin string
	require.NoError(t, db.QueryRow(`
		SELECT target_type, origin FROM action_definitions
		WHERE tenant_id = 'tenant-e2e' AND name = 'e2e.customer.refund' AND archived_at IS NULL
	`).Scan(&targetType, &origin))
	require.Equal(t, contractLogicalActionTargetType, targetType, "synced actions must not be executable")
	require.Equal(t, "sdk_sync", origin)

	// The failed-auth action registered NOTHING.
	var failingRows int
	require.NoError(t, db.QueryRow(`
		SELECT COUNT(*) FROM action_definitions WHERE name = 'e2e.failing.sync'
	`).Scan(&failingRows))
	require.Equal(t, 0, failingRows)

	// No argument value ever reaches the backend.
	var leaked int
	require.NoError(t, db.QueryRow(`
		SELECT COUNT(*) FROM action_contract_versions WHERE contract::text LIKE '%secret-arg-value%'
	`).Scan(&leaked))
	require.Equal(t, 0, leaked, "function arguments must never be stored centrally")

	fmt.Println("e2e verified: 2 versions, non-executable logical action, no leakage")
}

func lastLine(s string) string {
	lines := strings.Split(strings.TrimSpace(s), "\n")
	return lines[len(lines)-1]
}
