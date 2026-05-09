package api

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"database/sql/driver"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func roboticsPolicyRouteColumns() []string {
	return []string{
		"tenant_id",
		"policy_version",
		"status",
		"permit",
		"runtime_permitted",
		"robot_mode",
		"allowed_runtimes",
		"active",
		"expires_at",
		"activated_at",
		"expired_at",
		"revoked_at",
		"created_by",
		"updated_by",
		"revoked_by",
		"created_at",
		"updated_at",
	}
}

func roboticsPolicyRouteRow(status string, active bool) []driver.Value {
	now := time.Unix(1_900_100_000, 0).UTC()
	var activatedAt driver.Value
	if active {
		activatedAt = now
	}
	return []driver.Value{
		"tenant-robotics-policy",
		"robotics-policy.v2",
		status,
		true,
		true,
		"supervised",
		`["runtime-a","runtime-b"]`,
		active,
		nil,
		activatedAt,
		nil,
		nil,
		"tenant-robotics-policy",
		"tenant-robotics-policy",
		nil,
		now,
		now,
	}
}

func roboticsPolicyTestApp(tenantID string) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		c.Locals("clerk_email", tenantID+"@example.test")
		c.Locals("clerk_role", "admin")
		return c.Next()
	})
	return app
}

func roboticsPolicyTestAppWithRole(tenantID, role string) *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", tenantID)
		c.Locals("clerk_email", tenantID+"@example.test")
		c.Locals("clerk_role", role)
		return c.Next()
	})
	return app
}

func roboticsPolicySignerKeyRouteRow(publicKey ed25519.PublicKey) queuedRouteQueryExpectation {
	return queuedRouteQueryExpectation{
		columns: []string{"public_key_ed25519", "signer_identity"},
		rows: [][]driver.Value{{
			hex.EncodeToString(publicKey),
			"policy-admin@example.test",
		}},
	}
}

func roboticsPolicySigningKeyRouteColumns() []string {
	return []string{
		"tenant_id",
		"key_version",
		"signer_identity",
		"public_key_ed25519",
		"status",
		"not_before",
		"expires_at",
		"created_by",
		"revoked_by",
		"created_at",
		"updated_at",
	}
}

func roboticsPolicySigningKeyRouteRow(publicKey ed25519.PublicKey, status string) []driver.Value {
	now := time.Unix(1_900_400_000, 0).UTC()
	var revokedBy driver.Value
	if status == "revoked" {
		revokedBy = "tenant-robotics-policy"
	}
	return []driver.Value{
		"tenant-robotics-policy",
		"key-v2",
		"policy-admin@example.test",
		hex.EncodeToString(publicKey),
		status,
		now,
		nil,
		"tenant-robotics-policy",
		revokedBy,
		now,
		now,
	}
}

func signedRoboticsPolicyRouteRequest(t *testing.T, method, path, body string, privateKey ed25519.PrivateKey, keyVersion, action string) *http.Request {
	t.Helper()
	signedAt := strconv.FormatInt(time.Now().UnixMilli(), 10)
	nonce := uuid.NewString()
	canonical := canonicalRoboticsPolicyCommand(method, path, keyVersion, signedAt, nonce, action, []byte(body))
	sum := sha256.Sum256(canonical)
	signature := base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, sum[:]))

	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set(roboticsPolicyKeyVersionHeader, keyVersion)
	req.Header.Set(roboticsPolicySignedAtHeader, signedAt)
	req.Header.Set(roboticsPolicyNonceHeader, nonce)
	req.Header.Set(roboticsPolicySignatureHeader, signature)
	req.Header.Set(roboticsPolicySignerHeader, "policy-admin@example.test")
	return req
}

func TestCreateRoboticsPolicySigningKeyBootstrapsAndAudits(t *testing.T) {
	t.Parallel()

	publicKey, _, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	body := `{
		"key_version":"key-v2",
		"signer_identity":"policy-admin@example.test",
		"public_key_ed25519":"` + hex.EncodeToString(publicKey) + `"
	}`
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{"exists"},
			rows:    [][]driver.Value{{false}},
		},
		{
			columns: roboticsPolicySigningKeyRouteColumns(),
			rows:    [][]driver.Value{roboticsPolicySigningKeyRouteRow(publicKey, "draft")},
		},
	}, queuedRouteExecExpectation{rowsAffected: 1})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Post("/v1/robotics/policies/signing-keys", createRoboticsPolicySigningKey(db))

	req := httptest.NewRequest(http.MethodPost, "/v1/robotics/policies/signing-keys", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var result roboticsPolicySigningKeyResponse
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&result))
	require.Equal(t, "key-v2", result.KeyVersion)
	require.Equal(t, "draft", result.Status)
	require.Equal(t, hex.EncodeToString(publicKey), result.PublicKeyEd25519)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestListRoboticsPolicySigningKeys(t *testing.T) {
	t.Parallel()

	publicKey, _, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: roboticsPolicySigningKeyRouteColumns(),
		rows:    [][]driver.Value{roboticsPolicySigningKeyRouteRow(publicKey, "active")},
	}})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Get("/v1/robotics/policies/signing-keys", listRoboticsPolicySigningKeys(db))

	req := httptest.NewRequest(http.MethodGet, "/v1/robotics/policies/signing-keys", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body struct {
		SigningKeys []roboticsPolicySigningKeyResponse `json:"signing_keys"`
		Total       int                                `json:"total"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, 1, body.Total)
	require.Len(t, body.SigningKeys, 1)
	require.Equal(t, "active", body.SigningKeys[0].Status)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestActivateRoboticsPolicySigningKeyRequiresSignedCommandAndAudits(t *testing.T) {
	t.Parallel()

	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		roboticsPolicySignerKeyRouteRow(publicKey),
		{
			columns: []string{"status"},
			rows:    [][]driver.Value{{"draft"}},
		},
		{
			columns: roboticsPolicySigningKeyRouteColumns(),
			rows:    [][]driver.Value{roboticsPolicySigningKeyRouteRow(publicKey, "active")},
		},
	}, queuedRouteExecExpectation{rowsAffected: 1}, queuedRouteExecExpectation{rowsAffected: 1})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Post("/v1/robotics/policies/signing-keys/:version/activate", roboticsPolicySigningKeyLifecycleUpdate(db, "active"))

	req := signedRoboticsPolicyRouteRequest(t, http.MethodPost, "/v1/robotics/policies/signing-keys/key-v2/activate", "", privateKey, "key-v2", "signing_key_activate")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var result roboticsPolicySigningKeyResponse
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&result))
	require.Equal(t, "active", result.Status)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestRoboticsPolicySigningKeyRevokeAndExpireAudit(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name       string
		status     string
		pathSuffix string
		action     string
	}{
		{name: "revoke", status: "revoked", pathSuffix: "revoke", action: "signing_key_revoke"},
		{name: "expire", status: "expired", pathSuffix: "expire", action: "signing_key_expire"},
	} {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			publicKey, privateKey, err := ed25519.GenerateKey(nil)
			require.NoError(t, err)
			db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
				roboticsPolicySignerKeyRouteRow(publicKey),
				{
					columns: []string{"status"},
					rows:    [][]driver.Value{{"active"}},
				},
				{
					columns: roboticsPolicySigningKeyRouteColumns(),
					rows:    [][]driver.Value{roboticsPolicySigningKeyRouteRow(publicKey, tc.status)},
				},
			}, queuedRouteExecExpectation{rowsAffected: 1}, queuedRouteExecExpectation{rowsAffected: 1})
			app := roboticsPolicyTestApp("tenant-robotics-policy")
			app.Post("/v1/robotics/policies/signing-keys/:version/"+tc.pathSuffix, roboticsPolicySigningKeyLifecycleUpdate(db, tc.status))

			path := "/v1/robotics/policies/signing-keys/key-v2/" + tc.pathSuffix
			req := signedRoboticsPolicyRouteRequest(t, http.MethodPost, path, "", privateKey, "key-v2", tc.action)
			resp, err := app.Test(req)
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, resp.StatusCode)

			var result roboticsPolicySigningKeyResponse
			require.NoError(t, json.NewDecoder(resp.Body).Decode(&result))
			require.Equal(t, tc.status, result.Status)
			require.Equal(t, 0, queued.remainingQueries())
			require.Equal(t, 0, queued.remainingExecs())
		})
	}
}

func TestCreateDraftRoboticsPolicyRoute(t *testing.T) {
	t.Parallel()

	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	requestBody := `{
		"policy_version":"robotics-policy.v2",
		"permit":true,
		"runtime_permitted":true,
		"robot_mode":"supervised",
		"allowed_runtimes":["runtime-a","runtime-b","runtime-a"]
	}`
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		roboticsPolicySignerKeyRouteRow(publicKey),
		{
			columns: roboticsPolicyRouteColumns(),
			rows:    [][]driver.Value{roboticsPolicyRouteRow("draft", false)},
		},
	}, queuedRouteExecExpectation{rowsAffected: 1}, queuedRouteExecExpectation{rowsAffected: 1})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Post("/v1/robotics/policies", createDraftRoboticsPolicy(db))

	req := signedRoboticsPolicyRouteRequest(t, http.MethodPost, "/v1/robotics/policies", requestBody, privateKey, "key-v2", "draft")

	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var body roboticsPolicyResponse
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "tenant-robotics-policy", body.TenantID)
	require.Equal(t, "robotics-policy.v2", body.PolicyVersion)
	require.Equal(t, "draft", body.Status)
	require.False(t, body.Active)
	require.Equal(t, []string{"runtime-a", "runtime-b"}, body.AllowedRuntimes)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestActivateRoboticsPolicyRoute(t *testing.T) {
	t.Parallel()

	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		roboticsPolicySignerKeyRouteRow(publicKey),
		{
			columns: roboticsPolicyRouteColumns(),
			rows:    [][]driver.Value{roboticsPolicyRouteRow("active", true)},
		},
	}, queuedRouteExecExpectation{rowsAffected: 1}, queuedRouteExecExpectation{rowsAffected: 1}, queuedRouteExecExpectation{rowsAffected: 1})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Post("/v1/robotics/policies/:version/activate", activateRoboticsPolicy(db))

	req := signedRoboticsPolicyRouteRequest(t, http.MethodPost, "/v1/robotics/policies/robotics-policy.v2/activate", "", privateKey, "key-v2", "activate")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body roboticsPolicyResponse
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "active", body.Status)
	require.True(t, body.Active)
	require.NotNil(t, body.ActivatedAt)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestRoboticsPolicyWriteRejectsRevokedSignerKey(t *testing.T) {
	t.Parallel()

	_, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	body := `{"permit":true}`
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{"public_key_ed25519", "signer_identity"},
		rows:    nil,
	}})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Post("/v1/robotics/policies", createDraftRoboticsPolicy(db))

	req := signedRoboticsPolicyRouteRequest(t, http.MethodPost, "/v1/robotics/policies", body, privateKey, "revoked-key", "draft")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestRoboticsPolicyWriteRequiresSignature(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedRouteDB(t, nil)
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Post("/v1/robotics/policies", createDraftRoboticsPolicy(db))

	req := httptest.NewRequest(http.MethodPost, "/v1/robotics/policies", strings.NewReader(`{"permit":true}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestRoboticsPolicyWriteRequiresAdmin(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedRouteDB(t, nil)
	app := roboticsPolicyTestAppWithRole("tenant-robotics-policy", "operator")
	app.Post("/v1/robotics/policies", createDraftRoboticsPolicy(db))

	req := httptest.NewRequest(http.MethodPost, "/v1/robotics/policies", strings.NewReader(`{"permit":true}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusForbidden, resp.StatusCode)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestListRoboticsReceiptsRouteFiltersAuditIndex(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	persistedAt := time.Unix(1_900_200_000, 0).UTC()
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{
			"task_id",
			"tenant_id",
			"runtime_id",
			"execution_id",
			"policy_decision_id",
			"policy_decision_hash",
			"governed_action_hash",
			"robot_action",
			"routing_decision",
			"receipt_hash",
			"receipt_signature",
			"envelope_signature",
			"violation_occurred",
			"violation",
			"execution_envelope",
			"execution_receipt",
			"persisted_at",
		},
		rows: [][]driver.Value{{
			taskID.String(),
			"tenant-robotics-policy",
			"runtime-a",
			"exec-robotics-1",
			"decision-1",
			"policy-hash-1",
			"action-hash-1",
			"publish_zero_velocity",
			"ros2:publish_zero_velocity",
			"receipt-hash-1",
			"receipt-sig",
			"env-sig",
			false,
			"",
			[]byte(`{"execution_id":"exec-robotics-1"}`),
			[]byte(`{"execution_id":"exec-robotics-1"}`),
			persistedAt,
		}},
	}})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Get("/v1/receipts/robotics", listRoboticsReceipts(db))

	req := httptest.NewRequest(http.MethodGet, "/v1/receipts/robotics?task_id="+taskID.String()+"&policy_decision_id=decision-1&robot_action=publish_zero_velocity", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body struct {
		Receipts []struct {
			TaskID           uuid.UUID `json:"task_id"`
			PolicyDecisionID string    `json:"policy_decision_id"`
			RobotAction      string    `json:"robot_action"`
			ReceiptHash      string    `json:"receipt_hash"`
		} `json:"receipts"`
		Total int `json:"total"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, 1, body.Total)
	require.Len(t, body.Receipts, 1)
	require.Equal(t, taskID, body.Receipts[0].TaskID)
	require.Equal(t, "decision-1", body.Receipts[0].PolicyDecisionID)
	require.Equal(t, "publish_zero_velocity", body.Receipts[0].RobotAction)
	require.Equal(t, "receipt-hash-1", body.Receipts[0].ReceiptHash)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestReplayRoboticsReceiptsRouteReconstructsAuditTrail(t *testing.T) {
	taskID := uuid.New()
	persistedAt := time.Unix(1_900_300_000, 0).UTC()
	decision := []byte(`{
		"schema_version":"governed_policy_decision.v1",
		"decision_id":"decision-replay-route",
		"tenant_id":"tenant-robotics-policy",
		"task_id":"` + taskID.String() + `",
		"runtime_id":"runtime-a",
		"action":{
			"schema_version":"governed_action.v1",
			"domain":"robotics",
			"action_type":"ros2_action",
			"action_name":"cancel_navigation",
			"node_id":"robotics-step-0",
			"step_index":0,
			"requires_policy":true,
			"safety_mode_required":true
		},
		"permit":true,
		"reason":"permitted",
		"policy_version":"robotics-policy.active",
		"runtime_permitted":true,
		"tenant_permitted":true,
		"policy_permitted":true,
		"robot_mode_permitted":true,
		"issued_at_unix_ms":1900300000000,
		"expires_at_unix_ms":1900300030000,
		"signature":"policy-sig"
	}`)
	envelope := []byte(`{
		"execution_id":"exec-replay-route",
		"tenant_id":"tenant-robotics-policy",
		"policy_decision_id":"decision-replay-route",
		"routing_decision":"runtime:robotics:failed",
		"signature":"env-sig"
	}`)
	receipt := []byte(`{
		"execution_id":"exec-replay-route",
		"receipt_hash":"receipt-hash-route",
		"signature":"receipt-sig",
		"violation_occurred":true
	}`)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{
			"task_id",
			"tenant_id",
			"runtime_id",
			"execution_id",
			"policy_decision_id",
			"policy_version",
			"robot_action",
			"robot_node_id",
			"robot_target",
			"permit",
			"reason",
			"routing_decision",
			"policy_decision_hash",
			"governed_action_hash",
			"receipt_hash",
			"receipt_signature",
			"envelope_signature",
			"policy_signature",
			"violation_occurred",
			"violation",
			"signed_policy_decision",
			"execution_envelope",
			"execution_receipt",
			"persisted_at",
			"runtime_public_key_ed25519",
		},
		rows: [][]driver.Value{{
			taskID.String(),
			"tenant-robotics-policy",
			"runtime-a",
			"exec-replay-route",
			"decision-replay-route",
			"robotics-policy.active",
			"cancel_navigation",
			"robotics-step-0",
			"",
			true,
			"permitted",
			"runtime:robotics:failed",
			"",
			"",
			"receipt-hash-route",
			"receipt-sig",
			"env-sig",
			"policy-sig",
			true,
			"navigation canceled",
			decision,
			envelope,
			receipt,
			persistedAt,
			"",
		}},
	}})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Get("/v1/receipts/robotics/replay", replayRoboticsReceipts(db))

	req := httptest.NewRequest(http.MethodGet, "/v1/receipts/robotics/replay?policy_decision_id=decision-replay-route", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body struct {
		Replays []struct {
			Valid                    bool     `json:"valid"`
			ValidationErrors         []string `json:"validation_errors"`
			PolicyVersion            string   `json:"policy_version"`
			RobotAction              string   `json:"robot_action"`
			RuntimeSignaturePresent  bool     `json:"runtime_signature_present"`
			RuntimeSignatureVerified bool     `json:"runtime_signature_verified"`
		} `json:"replays"`
		Total int `json:"total"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, 1, body.Total)
	require.Len(t, body.Replays, 1)
	require.True(t, body.Replays[0].Valid, body.Replays[0].ValidationErrors)
	require.Equal(t, "robotics-policy.active", body.Replays[0].PolicyVersion)
	require.Equal(t, "cancel_navigation", body.Replays[0].RobotAction)
	require.True(t, body.Replays[0].RuntimeSignaturePresent)
	require.False(t, body.Replays[0].RuntimeSignatureVerified)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func signedRouteRuntimeArtifact(t *testing.T, privateKey ed25519.PrivateKey, fields map[string]any) []byte {
	t.Helper()
	canonical, err := json.Marshal(fields)
	require.NoError(t, err)
	sum := sha256.Sum256(canonical)
	fields["signature"] = base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, sum[:]))
	raw, err := json.Marshal(fields)
	require.NoError(t, err)
	return raw
}

func signedRouteRuntimeReceipt(t *testing.T, privateKey ed25519.PrivateKey, fields map[string]any) []byte {
	t.Helper()
	canonical := map[string]string{
		"agent_id":           routeReceiptFieldString(fields, "agent_id"),
		"cpu_time_ms":        routeReceiptFieldString(fields, "cpu_time_ms"),
		"execution_id":       routeReceiptFieldString(fields, "execution_id"),
		"fs_bytes_written":   routeReceiptFieldString(fields, "fs_bytes_written"),
		"memory_peak_mb":     routeReceiptFieldString(fields, "memory_peak_mb"),
		"previous_hash":      routeReceiptFieldString(fields, "previous_hash"),
		"timestamp_utc":      routeReceiptFieldString(fields, "timestamp_utc"),
		"tool_calls":         routeReceiptFieldString(fields, "tool_calls"),
		"violation_occurred": routeReceiptFieldString(fields, "violation_occurred"),
		"wall_time_ms":       routeReceiptFieldString(fields, "wall_time_ms"),
	}
	if runtimeID := routeReceiptFieldString(fields, "runtime_id"); runtimeID != "" {
		canonical["runtime_id"] = runtimeID
	}
	if txHash := routeReceiptFieldString(fields, "transaction_hash"); txHash != "" {
		canonical["transaction_hash"] = txHash
	}
	if txID := routeReceiptFieldString(fields, "transaction_id"); txID != "" {
		canonical["transaction_id"] = txID
	}
	canonicalBytes, err := json.Marshal(canonical)
	require.NoError(t, err)
	sum := sha256.Sum256(canonicalBytes)
	fields["hash"] = hex.EncodeToString(sum[:])
	fields["signature"] = base64.StdEncoding.EncodeToString(ed25519.Sign(privateKey, sum[:]))
	raw, err := json.Marshal(fields)
	require.NoError(t, err)
	return raw
}

func routeReceiptFieldString(receipt map[string]any, key string) string {
	value, ok := receipt[key]
	if !ok || value == nil {
		return ""
	}
	switch v := value.(type) {
	case string:
		return v
	case bool:
		return strconv.FormatBool(v)
	case float64:
		if v == math.Trunc(v) {
			return strconv.FormatInt(int64(v), 10)
		}
		return strconv.FormatFloat(v, 'f', -1, 64)
	case float32:
		if v == float32(math.Trunc(float64(v))) {
			return strconv.FormatInt(int64(v), 10)
		}
		return strconv.FormatFloat(float64(v), 'f', -1, 32)
	case int:
		return strconv.Itoa(v)
	case int64:
		return strconv.FormatInt(v, 10)
	case int32:
		return strconv.FormatInt(int64(v), 10)
	case uint64:
		return strconv.FormatUint(v, 10)
	case uint32:
		return strconv.FormatUint(uint64(v), 10)
	case uint:
		return strconv.FormatUint(uint64(v), 10)
	case json.Number:
		return v.String()
	default:
		return fmt.Sprintf("%v", v)
	}
}

func jsonFieldString(t *testing.T, raw []byte, field string) string {
	t.Helper()
	var value map[string]any
	require.NoError(t, json.Unmarshal(raw, &value))
	got, ok := value[field].(string)
	require.True(t, ok)
	return got
}

func aiToolReplayRouteColumns() []string {
	return []string{
		"task_id", "tenant_id", "runtime_id", "execution_id",
		"envelope_id", "capability", "tool_name",
		"tool_action_hash", "routing_decision",
		"request_hash", "response_hash",
		"receipt_hash", "receipt_signature",
		"envelope_signature", "violation_occurred",
		"violation", "execution_envelope", "execution_receipt",
		"persisted_at", "runtime_public_key_ed25519",
	}
}

func TestReplayRoboticsReceiptsRouteVerifiesRuntimeSignatureWithPublicKey(t *testing.T) {
	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	t.Setenv("IGRIS_RUNTIME_PUBLIC_KEY", hex.EncodeToString(publicKey))

	taskID := uuid.New()
	persistedAt := time.Unix(1_900_300_500, 0).UTC()
	decision := []byte(`{
		"schema_version":"governed_policy_decision.v1",
		"decision_id":"decision-route-verified",
		"tenant_id":"tenant-robotics-policy",
		"task_id":"` + taskID.String() + `",
		"runtime_id":"runtime-a",
		"action":{
			"schema_version":"governed_action.v1",
			"domain":"robotics",
			"action_type":"ros2_action",
			"action_name":"publish_zero_velocity",
			"node_id":"robotics-step-0",
			"step_index":0,
			"requires_policy":true,
			"safety_mode_required":true
		},
		"permit":true,
		"reason":"permitted",
		"policy_version":"robotics-policy.active",
		"runtime_permitted":true,
		"tenant_permitted":true,
		"policy_permitted":true,
		"robot_mode_permitted":true,
		"issued_at_unix_ms":1900300500000,
		"expires_at_unix_ms":1900300530000,
		"signature":"policy-sig"
	}`)
	envelope := signedRouteRuntimeArtifact(t, privateKey, map[string]any{
		"execution_id":       "exec-route-verified",
		"tenant_id":          "tenant-robotics-policy",
		"policy_decision_id": "decision-route-verified",
		"routing_decision":   "ros2:publish_zero_velocity",
	})
	receipt := signedRouteRuntimeReceipt(t, privateKey, map[string]any{
		"execution_id":       "exec-route-verified",
		"violation_occurred": false,
	})
	receiptHash := jsonFieldString(t, receipt, "hash")
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: []string{
			"task_id", "tenant_id", "runtime_id", "execution_id",
			"policy_decision_id", "policy_version", "robot_action",
			"robot_node_id", "robot_target", "permit", "reason",
			"routing_decision", "policy_decision_hash", "governed_action_hash",
			"receipt_hash", "receipt_signature", "envelope_signature",
			"policy_signature", "violation_occurred", "violation",
			"signed_policy_decision", "execution_envelope", "execution_receipt",
			"persisted_at", "runtime_public_key_ed25519",
		},
		rows: [][]driver.Value{{
			taskID.String(), "tenant-robotics-policy", "runtime-a", "exec-route-verified",
			"decision-route-verified", "robotics-policy.active", "publish_zero_velocity",
			"robotics-step-0", "", true, "permitted", "ros2:publish_zero_velocity",
			"", "", receiptHash, jsonFieldString(t, receipt, "signature"),
			jsonFieldString(t, envelope, "signature"), "policy-sig", false, "",
			decision, envelope, receipt, persistedAt, hex.EncodeToString(publicKey),
		}},
	}})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Get("/v1/receipts/robotics/replay", replayRoboticsReceipts(db))

	req := httptest.NewRequest(http.MethodGet, "/v1/receipts/robotics/replay?policy_decision_id=decision-route-verified", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body struct {
		Replays []struct {
			Valid                     bool     `json:"valid"`
			ValidationErrors          []string `json:"validation_errors"`
			RuntimeSignaturePresent   bool     `json:"runtime_signature_present"`
			RuntimeSignatureVerified  bool     `json:"runtime_signature_verified"`
			RuntimeSignatureKeySource string   `json:"runtime_signature_key_source"`
		} `json:"replays"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Len(t, body.Replays, 1)
	require.True(t, body.Replays[0].Valid, body.Replays[0].ValidationErrors)
	require.True(t, body.Replays[0].RuntimeSignaturePresent)
	require.True(t, body.Replays[0].RuntimeSignatureVerified)
	require.Equal(t, "runtime_registry", body.Replays[0].RuntimeSignatureKeySource)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestExportRoboticsAuditBundleIncludesKeyLifecycleAndReplay(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	persistedAt := time.Unix(1_900_301_000, 0).UTC()
	keyAuditAt := time.Unix(1_900_401_000, 0).UTC()
	decision := []byte(`{
		"schema_version":"governed_policy_decision.v1",
		"decision_id":"decision-export-route",
		"tenant_id":"tenant-robotics-policy",
		"task_id":"` + taskID.String() + `",
		"runtime_id":"runtime-a",
		"action":{
			"schema_version":"governed_action.v1",
			"domain":"robotics",
			"action_type":"ros2_action",
			"action_name":"publish_zero_velocity",
			"node_id":"robotics-step-0",
			"step_index":0,
			"requires_policy":true,
			"safety_mode_required":true
		},
		"permit":true,
		"reason":"permitted",
		"policy_version":"robotics-policy.active",
		"runtime_permitted":true,
		"tenant_permitted":true,
		"policy_permitted":true,
		"robot_mode_permitted":true,
		"issued_at_unix_ms":1900301000000,
		"expires_at_unix_ms":1900301030000,
		"signature":"policy-sig"
	}`)
	envelope := []byte(`{
		"execution_id":"exec-export-route",
		"tenant_id":"tenant-robotics-policy",
		"policy_decision_id":"decision-export-route",
		"routing_decision":"ros2:publish_zero_velocity",
		"signature":"env-sig"
	}`)
	receipt := []byte(`{
		"execution_id":"exec-export-route",
		"receipt_hash":"receipt-hash-export",
		"signature":"receipt-sig",
		"violation_occurred":false
	}`)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{
				"task_id", "tenant_id", "runtime_id", "execution_id",
				"policy_decision_id", "policy_version", "robot_action",
				"robot_node_id", "robot_target", "permit", "reason",
				"routing_decision", "policy_decision_hash", "governed_action_hash",
				"receipt_hash", "receipt_signature", "envelope_signature",
				"policy_signature", "violation_occurred", "violation",
				"signed_policy_decision", "execution_envelope", "execution_receipt",
				"persisted_at", "runtime_public_key_ed25519",
			},
			rows: [][]driver.Value{{
				taskID.String(), "tenant-robotics-policy", "runtime-a", "exec-export-route",
				"decision-export-route", "robotics-policy.active", "publish_zero_velocity",
				"robotics-step-0", "", true, "permitted", "ros2:publish_zero_velocity",
				"", "", "receipt-hash-export", "receipt-sig", "env-sig", "policy-sig",
				false, "", decision, envelope, receipt, persistedAt, "",
			}},
		},
		{
			columns: aiToolReplayRouteColumns(),
			rows:    nil,
		},
		{
			columns: []string{
				"tenant_id", "key_version", "action", "actor_id",
				"actor_email", "signer_identity", "signer_key_version",
				"command_nonce", "command_hash", "command_signature",
				"previous_status", "new_status", "key_snapshot", "occurred_at",
			},
			rows: [][]driver.Value{{
				"tenant-robotics-policy", "key-v2", "activate", "tenant-robotics-policy",
				"tenant-robotics-policy@example.test", "policy-admin@example.test", "key-v1",
				"nonce-export", "command-hash-export", "signature-export",
				"draft", "active", []byte(`{"key_version":"key-v2","status":"active"}`), keyAuditAt,
			}},
		},
	})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Get("/v1/receipts/robotics/audit-export", exportRoboticsAuditBundle(db))

	req := httptest.NewRequest(http.MethodGet, "/v1/receipts/robotics/audit-export?policy_decision_id=decision-export-route&key_version=key-v2", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.Equal(t, "attachment; filename=\"robotics-audit-bundle.json\"", resp.Header.Get("Content-Disposition"))

	var body struct {
		TenantID           string `json:"tenant_id"`
		PolicyKeyLifecycle []struct {
			KeyVersion   string          `json:"key_version"`
			Action       string          `json:"action"`
			CommandNonce string          `json:"command_nonce"`
			CommandHash  string          `json:"command_hash"`
			KeySnapshot  json.RawMessage `json:"key_snapshot"`
		} `json:"policy_key_lifecycle"`
		RobotExecutionReplays []struct {
			PolicyDecisionID string `json:"policy_decision_id"`
			RobotAction      string `json:"robot_action"`
			ReceiptHash      string `json:"receipt_hash"`
		} `json:"robot_execution_replays"`
		AIToolExecutionReplays []struct {
			ExecutionID string `json:"execution_id"`
		} `json:"ai_tool_execution_replays"`
		Totals map[string]int `json:"totals"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "tenant-robotics-policy", body.TenantID)
	require.Len(t, body.PolicyKeyLifecycle, 1)
	require.Equal(t, "key-v2", body.PolicyKeyLifecycle[0].KeyVersion)
	require.Equal(t, "activate", body.PolicyKeyLifecycle[0].Action)
	require.Equal(t, "nonce-export", body.PolicyKeyLifecycle[0].CommandNonce)
	require.Equal(t, "command-hash-export", body.PolicyKeyLifecycle[0].CommandHash)
	require.JSONEq(t, `{"key_version":"key-v2","status":"active"}`, string(body.PolicyKeyLifecycle[0].KeySnapshot))
	require.Len(t, body.RobotExecutionReplays, 1)
	require.Equal(t, "decision-export-route", body.RobotExecutionReplays[0].PolicyDecisionID)
	require.Equal(t, "publish_zero_velocity", body.RobotExecutionReplays[0].RobotAction)
	require.Equal(t, "receipt-hash-export", body.RobotExecutionReplays[0].ReceiptHash)
	require.Equal(t, 1, body.Totals["policy_key_lifecycle"])
	require.Equal(t, 1, body.Totals["robot_execution_replay"])
	require.Equal(t, 0, body.Totals["ai_tool_execution_replay"])
	require.Empty(t, body.AIToolExecutionReplays)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestExportRoboticsAuditBundleIncludesAIToolReplay(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	persistedAt := time.Unix(1_900_301_500, 0).UTC()
	envelope := []byte(`{
		"execution_id":"exec-ai-tool-export",
		"tenant_id":"tenant-robotics-policy",
		"policy_decision_id":"permission-envelope-export",
		"governed_action_hash":"tool-action-hash-export",
		"routing_decision":"tool:github.issues.write",
		"request_hash":"args-hash-export",
		"response_hash":"result-hash-export",
		"signature":"env-sig-ai-tool"
	}`)
	receipt := []byte(`{
		"execution_id":"exec-ai-tool-export",
		"hash":"receipt-hash-ai-tool-export",
		"signature":"receipt-sig-ai-tool",
		"violation_occurred":false
	}`)
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: []string{
				"task_id", "tenant_id", "runtime_id", "execution_id",
				"policy_decision_id", "policy_version", "robot_action",
				"robot_node_id", "robot_target", "permit", "reason",
				"routing_decision", "policy_decision_hash", "governed_action_hash",
				"receipt_hash", "receipt_signature", "envelope_signature",
				"policy_signature", "violation_occurred", "violation",
				"signed_policy_decision", "execution_envelope", "execution_receipt",
				"persisted_at", "runtime_public_key_ed25519",
			},
			rows: nil,
		},
		{
			columns: aiToolReplayRouteColumns(),
			rows: [][]driver.Value{{
				taskID.String(), "tenant-robotics-policy", "runtime-tools", "exec-ai-tool-export",
				"permission-envelope-export", "tools.github.issues.write", "github.issues.write",
				"tool-action-hash-export", "tool:github.issues.write",
				"args-hash-export", "result-hash-export",
				"receipt-hash-ai-tool-export", "receipt-sig-ai-tool",
				"env-sig-ai-tool", false, "", envelope, receipt, persistedAt, "",
			}},
		},
		{
			columns: []string{
				"tenant_id", "key_version", "action", "actor_id",
				"actor_email", "signer_identity", "signer_key_version",
				"command_nonce", "command_hash", "command_signature",
				"previous_status", "new_status", "key_snapshot", "occurred_at",
			},
			rows: nil,
		},
	})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Get("/v1/receipts/robotics/audit-export", exportRoboticsAuditBundle(db))

	req := httptest.NewRequest(http.MethodGet, "/v1/receipts/robotics/audit-export?tool_name=github.issues.write&envelope_id=permission-envelope-export", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body struct {
		AIToolExecutionReplays []struct {
			ExecutionID string `json:"execution_id"`
			EnvelopeID  string `json:"envelope_id"`
			Capability  string `json:"capability"`
			ToolName    string `json:"tool_name"`
			ReceiptHash string `json:"receipt_hash"`
		} `json:"ai_tool_execution_replays"`
		Totals map[string]int `json:"totals"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Len(t, body.AIToolExecutionReplays, 1)
	require.Equal(t, "exec-ai-tool-export", body.AIToolExecutionReplays[0].ExecutionID)
	require.Equal(t, "permission-envelope-export", body.AIToolExecutionReplays[0].EnvelopeID)
	require.Equal(t, "tools.github.issues.write", body.AIToolExecutionReplays[0].Capability)
	require.Equal(t, "github.issues.write", body.AIToolExecutionReplays[0].ToolName)
	require.Equal(t, "receipt-hash-ai-tool-export", body.AIToolExecutionReplays[0].ReceiptHash)
	require.Equal(t, 1, body.Totals["ai_tool_execution_replay"])
	require.Equal(t, 0, body.Totals["robot_execution_replay"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestHILRoboticsStopAndCancelEvidenceExportsThroughAuditBundle(t *testing.T) {
	t.Parallel()

	publicKey, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	publicKeyHex := hex.EncodeToString(publicKey)
	taskIDStop := uuid.New()
	taskIDCancel := uuid.New()
	persistedAt := time.Unix(1_900_302_000, 0).UTC()
	stopEnvelope := signedRouteRuntimeArtifact(t, privateKey, map[string]any{
		"execution_id":       "exec-hil-stop-timeout",
		"tenant_id":          "tenant-robotics-policy",
		"policy_decision_id": "decision-hil-stop-timeout",
		"routing_decision":   "ros2:emergency_stop:timeout",
	})
	stopReceipt := signedRouteRuntimeReceipt(t, privateKey, map[string]any{
		"execution_id":       "exec-hil-stop-timeout",
		"violation_occurred": true,
	})
	cancelEnvelope := signedRouteRuntimeArtifact(t, privateKey, map[string]any{
		"execution_id":       "exec-hil-cancel-failed",
		"tenant_id":          "tenant-robotics-policy",
		"policy_decision_id": "decision-hil-cancel-failed",
		"routing_decision":   "ros2:cancel_navigation:failed",
	})
	cancelReceipt := signedRouteRuntimeReceipt(t, privateKey, map[string]any{
		"execution_id":       "exec-hil-cancel-failed",
		"violation_occurred": true,
	})
	stopReceiptHash := jsonFieldString(t, stopReceipt, "hash")
	cancelReceiptHash := jsonFieldString(t, cancelReceipt, "hash")
	stopDecision := []byte(`{
		"schema_version":"governed_policy_decision.v1",
		"decision_id":"decision-hil-stop-timeout",
		"tenant_id":"tenant-robotics-policy",
		"task_id":"` + taskIDStop.String() + `",
		"runtime_id":"runtime-hil",
		"action":{
			"schema_version":"governed_action.v1",
			"domain":"robotics",
			"action_type":"ros2_action",
			"action_name":"emergency_stop",
			"node_id":"hil-stop-node",
			"step_index":0,
			"target":"hardware-loop-base",
			"requires_policy":true,
			"safety_mode_required":true
		},
		"permit":true,
		"reason":"timeout",
		"policy_version":"robotics-policy.hil",
		"runtime_permitted":true,
		"tenant_permitted":true,
		"policy_permitted":true,
		"robot_mode_permitted":true,
		"issued_at_unix_ms":1900302000000,
		"expires_at_unix_ms":1900302030000,
		"signature":"policy-sig-hil-stop"
	}`)
	cancelDecision := []byte(`{
		"schema_version":"governed_policy_decision.v1",
		"decision_id":"decision-hil-cancel-failed",
		"tenant_id":"tenant-robotics-policy",
		"task_id":"` + taskIDCancel.String() + `",
		"runtime_id":"runtime-hil",
		"action":{
			"schema_version":"governed_action.v1",
			"domain":"robotics",
			"action_type":"ros2_action",
			"action_name":"cancel_navigation",
			"node_id":"hil-cancel-node",
			"step_index":1,
			"target":"hardware-loop-base",
			"requires_policy":true,
			"safety_mode_required":true
		},
		"permit":true,
		"reason":"runtime failure",
		"policy_version":"robotics-policy.hil",
		"runtime_permitted":true,
		"tenant_permitted":true,
		"policy_permitted":true,
		"robot_mode_permitted":true,
		"issued_at_unix_ms":1900302001000,
		"expires_at_unix_ms":1900302031000,
		"signature":"policy-sig-hil-cancel"
	}`)
	replayColumns := []string{
		"task_id", "tenant_id", "runtime_id", "execution_id",
		"policy_decision_id", "policy_version", "robot_action",
		"robot_node_id", "robot_target", "permit", "reason",
		"routing_decision", "policy_decision_hash", "governed_action_hash",
		"receipt_hash", "receipt_signature", "envelope_signature",
		"policy_signature", "violation_occurred", "violation",
		"signed_policy_decision", "execution_envelope", "execution_receipt",
		"persisted_at", "runtime_public_key_ed25519",
	}
	db, queued := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: replayColumns,
			rows: [][]driver.Value{
				{
					taskIDStop.String(), "tenant-robotics-policy", "runtime-hil", "exec-hil-stop-timeout",
					"decision-hil-stop-timeout", "robotics-policy.hil", "emergency_stop",
					"hil-stop-node", "hardware-loop-base", true, "timeout", "ros2:emergency_stop:timeout",
					"", "", stopReceiptHash, jsonFieldString(t, stopReceipt, "signature"),
					jsonFieldString(t, stopEnvelope, "signature"), "policy-sig-hil-stop", true, "stop timeout",
					stopDecision, stopEnvelope, stopReceipt, persistedAt, publicKeyHex,
				},
				{
					taskIDCancel.String(), "tenant-robotics-policy", "runtime-hil", "exec-hil-cancel-failed",
					"decision-hil-cancel-failed", "robotics-policy.hil", "cancel_navigation",
					"hil-cancel-node", "hardware-loop-base", true, "runtime failure", "ros2:cancel_navigation:failed",
					"", "", cancelReceiptHash, jsonFieldString(t, cancelReceipt, "signature"),
					jsonFieldString(t, cancelEnvelope, "signature"), "policy-sig-hil-cancel", true, "cancel failed",
					cancelDecision, cancelEnvelope, cancelReceipt, persistedAt.Add(time.Second), publicKeyHex,
				},
			},
		},
		{
			columns: aiToolReplayRouteColumns(),
			rows:    nil,
		},
		{
			columns: []string{
				"tenant_id", "key_version", "action", "actor_id",
				"actor_email", "signer_identity", "signer_key_version",
				"command_nonce", "command_hash", "command_signature",
				"previous_status", "new_status", "key_snapshot", "occurred_at",
			},
			rows: nil,
		},
	})
	app := roboticsPolicyTestApp("tenant-robotics-policy")
	app.Get("/v1/receipts/robotics/audit-export", exportRoboticsAuditBundle(db))

	req := httptest.NewRequest(http.MethodGet, "/v1/receipts/robotics/audit-export?limit=10", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body struct {
		RobotExecutionReplays []struct {
			PolicyDecisionID          string `json:"policy_decision_id"`
			RobotAction               string `json:"robot_action"`
			Reason                    string `json:"reason"`
			ViolationOccurred         bool   `json:"violation_occurred"`
			RuntimeSignatureVerified  bool   `json:"runtime_signature_verified"`
			RuntimeSignatureKeySource string `json:"runtime_signature_key_source"`
		} `json:"robot_execution_replays"`
		Totals map[string]int `json:"totals"`
	}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Len(t, body.RobotExecutionReplays, 2)
	byAction := map[string]struct {
		Reason                    string
		ViolationOccurred         bool
		RuntimeSignatureVerified  bool
		RuntimeSignatureKeySource string
	}{}
	for _, replay := range body.RobotExecutionReplays {
		byAction[replay.RobotAction] = struct {
			Reason                    string
			ViolationOccurred         bool
			RuntimeSignatureVerified  bool
			RuntimeSignatureKeySource string
		}{
			Reason:                    replay.Reason,
			ViolationOccurred:         replay.ViolationOccurred,
			RuntimeSignatureVerified:  replay.RuntimeSignatureVerified,
			RuntimeSignatureKeySource: replay.RuntimeSignatureKeySource,
		}
	}
	require.Equal(t, "timeout", byAction["emergency_stop"].Reason)
	require.True(t, byAction["emergency_stop"].ViolationOccurred)
	require.True(t, byAction["emergency_stop"].RuntimeSignatureVerified)
	require.Equal(t, "runtime_registry", byAction["emergency_stop"].RuntimeSignatureKeySource)
	require.Equal(t, "runtime failure", byAction["cancel_navigation"].Reason)
	require.True(t, byAction["cancel_navigation"].ViolationOccurred)
	require.True(t, byAction["cancel_navigation"].RuntimeSignatureVerified)
	require.Equal(t, "runtime_registry", byAction["cancel_navigation"].RuntimeSignatureKeySource)
	require.Equal(t, 2, body.Totals["robot_execution_replay"])
	require.Equal(t, 0, body.Totals["ai_tool_execution_replay"])
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}

func TestCleanupExpiredRoboticsPolicyCommandNonces(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedRouteDB(t, nil, queuedRouteExecExpectation{rowsAffected: 3})
	deleted, err := CleanupExpiredRoboticsPolicyCommandNonces(context.Background(), db)
	require.NoError(t, err)
	require.Equal(t, int64(3), deleted)
	require.Equal(t, 0, queued.remainingQueries())
	require.Equal(t, 0, queued.remainingExecs())
}
