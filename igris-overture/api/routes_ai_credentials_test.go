package api

import (
	"crypto/ed25519"
	"database/sql"
	"database/sql/driver"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func aiCredentialReferenceRouteColumns() []string {
	return []string{
		"reference_id", "envelope_id", "task_id", "tenant_id",
		"tool", "capability", "scope", "expires_at_unix_ms",
		"revocable", "revoked_at", "persisted_at",
	}
}

func aiCredentialReferenceRouteRow(taskID uuid.UUID, revokedAt any) []driver.Value {
	return []driver.Value{
		"credref-route",
		"permission-envelope-route",
		taskID.String(),
		"tenant-robotics-policy",
		"github.issues.write",
		"tools.github.issues.write",
		"task",
		int64(1_900_310_030_000),
		true,
		revokedAt,
		time.Unix(1_900_301_000, 0).UTC(),
	}
}

func TestRevokeAICredentialReferenceRequiresSignedCommand(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedRouteDB(t, nil)
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Post("/v1/ai/credentials/:reference_id/revoke", revokeAICredentialReference(db))

	req, err := http.NewRequest(http.MethodPost, "/v1/ai/credentials/credref-route/revoke", nil)
	require.NoError(t, err)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestRevokeAICredentialReferenceWithSignedCommand(t *testing.T) {
	t.Parallel()

	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	taskID := uuid.New()
	revokedAt := time.Unix(1_900_301_100, 0).UTC()
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		roboticsPolicySignerKeyRouteRow(publicKey),
		{
			columns: aiCredentialReferenceRouteColumns(),
			rows:    [][]driver.Value{aiCredentialReferenceRouteRow(taskID, revokedAt)},
		},
	}, queuedRouteExecExpectation{rowsAffected: 1})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Post("/v1/ai/credentials/:reference_id/revoke", revokeAICredentialReference(db))

	req := signedRoboticsPolicyRouteRequest(t, http.MethodPost, "/v1/ai/credentials/credref-route/revoke", "", privateKey, "key-v2", "credential_revoke")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body struct {
		ReferenceID string     `json:"reference_id"`
		EnvelopeID  string     `json:"envelope_id"`
		TaskID      uuid.UUID  `json:"task_id"`
		TenantID    string     `json:"tenant_id"`
		Tool        string     `json:"tool"`
		Capability  string     `json:"capability"`
		RevokedAt   *time.Time `json:"revoked_at"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "credref-route", body.ReferenceID)
	require.Equal(t, "permission-envelope-route", body.EnvelopeID)
	require.Equal(t, taskID, body.TaskID)
	require.Equal(t, "tenant-robotics-policy", body.TenantID)
	require.Equal(t, "github.issues.write", body.Tool)
	require.Equal(t, "tools.github.issues.write", body.Capability)
	require.NotNil(t, body.RevokedAt)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestRevokeAICredentialReferenceRejectsNonceReplay(t *testing.T) {
	t.Parallel()

	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		roboticsPolicySignerKeyRouteRow(publicKey),
	}, queuedRouteExecExpectation{rowsAffected: 0})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Post("/v1/ai/credentials/:reference_id/revoke", revokeAICredentialReference(db))

	req := signedRoboticsPolicyRouteRequest(t, http.MethodPost, "/v1/ai/credentials/credref-route/revoke", "", privateKey, "key-v2", "credential_revoke")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)

	var body map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "policy_command_replay", body["error"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestRevokeAICredentialReferenceDeniesAlreadyRevokedReference(t *testing.T) {
	t.Parallel()

	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		roboticsPolicySignerKeyRouteRow(publicKey),
		{
			err: sql.ErrNoRows,
		},
		{
			columns: []string{"revoked_at"},
			rows:    [][]driver.Value{{time.Unix(1_900_301_100, 0).UTC()}},
		},
	}, queuedRouteExecExpectation{rowsAffected: 1})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Post("/v1/ai/credentials/:reference_id/revoke", revokeAICredentialReference(db))

	req := signedRoboticsPolicyRouteRequest(t, http.MethodPost, "/v1/ai/credentials/credref-route/revoke", "", privateKey, "key-v2", "credential_revoke")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)

	var body map[string]string
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "credential_reference_revoked", body["error"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestRevokeAICredentialReferenceRejectsWrongSigner(t *testing.T) {
	t.Parallel()

	publicKey, _, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	_, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		roboticsPolicySignerKeyRouteRow(publicKey),
	})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Post("/v1/ai/credentials/:reference_id/revoke", revokeAICredentialReference(db))

	req := signedRoboticsPolicyRouteRequest(t, http.MethodPost, "/v1/ai/credentials/credref-route/revoke", "", privateKey, "key-v2", "credential_revoke")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestAICredentialReferenceSignerKeyShape(t *testing.T) {
	publicKey, _, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	row := roboticsPolicySignerKeyRouteRow(publicKey)
	require.Equal(t, []string{"public_key_ed25519", "signer_identity"}, row.columns)
	require.Equal(t, hex.EncodeToString(publicKey), row.rows[0][0])
}
