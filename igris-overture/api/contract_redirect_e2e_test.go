package api

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/require"
)

const contractRedirectE2EScript = `
import os

import igris
from igris import connected

executed = []
client = connected.HttpContractSyncClient(
    connected.ConnectedConfig(
        endpoint=os.environ["REDIRECT_ORIGIN"],
        token=os.environ["REDIRECT_TOKEN"],
    )
)

@igris.guard(action="redirect.security.proof", approval="never", sync_client=client)
def consequential():
    executed.append(True)

try:
    consequential()
    raise AssertionError("redirect response was accepted")
except igris.ContractSyncError as exc:
    assert exc.execution_occurred is False
    assert exc.error_code == "redirect_refused"
    assert exc.status_code == int(os.environ["REDIRECT_STATUS"])
    assert os.environ["REDIRECT_TOKEN"] not in str(exc)

assert executed == []
assert not os.path.exists(os.path.join(os.environ["IGRIS_HOME"], "journal.jsonl"))
print("REDIRECT-REFUSED")
`

func TestContractSyncRedirectsAreNeverFollowedEndToEnd(t *testing.T) {
	uvPath, err := exec.LookPath("uv")
	if err != nil {
		t.Skip("uv is required to drive the Python SDK redirect proof")
	}
	repoRoot, err := filepath.Abs(filepath.Join("..", ".."))
	require.NoError(t, err)
	sdkDir := filepath.Join(repoRoot, "sdk", "python")
	const token = "igris_redirect_test_token_not_real"

	for _, status := range []int{301, 302, 303, 307, 308} {
		t.Run(fmt.Sprintf("HTTP_%d", status), func(t *testing.T) {
			var targetCalls atomic.Int32
			var targetAuthorization atomic.Value
			var originAuthorization atomic.Value
			targetAuthorization.Store("")
			originAuthorization.Store("")
			target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				targetCalls.Add(1)
				targetAuthorization.Store(r.Header.Get("Authorization"))
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"version":{"contract_hash":"wrong","created":true}}`))
			}))
			defer target.Close()

			origin := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				originAuthorization.Store(r.Header.Get("Authorization"))
				w.Header().Set("Location", target.URL+"/credential-capture")
				w.WriteHeader(status)
			}))
			defer origin.Close()

			home := t.TempDir()
			scriptPath := filepath.Join(t.TempDir(), "redirect_proof.py")
			require.NoError(t, os.WriteFile(scriptPath, []byte(contractRedirectE2EScript), 0o600))
			cmd := exec.Command(uvPath, "run", "python", scriptPath)
			cmd.Dir = sdkDir
			cmd.Env = append(os.Environ(),
				"IGRIS_HOME="+home,
				"REDIRECT_ORIGIN="+origin.URL,
				"REDIRECT_STATUS="+fmt.Sprint(status),
				"REDIRECT_TOKEN="+token,
			)
			output, err := cmd.CombinedOutput()
			require.NoError(t, err, "redirect proof failed:\n%s", output)
			require.Contains(t, string(output), "REDIRECT-REFUSED")
			require.Equal(t, "Bearer "+token, originAuthorization.Load())
			require.Zero(t, targetCalls.Load(), "redirect target must never receive a request")
			require.Empty(t, targetAuthorization.Load(), "redirect target must never receive Authorization")
			_, err = os.Stat(filepath.Join(home, "journal.jsonl"))
			require.ErrorIs(t, err, os.ErrNotExist)
		})
	}
}
