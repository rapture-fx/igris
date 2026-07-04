package coordinator

import (
	"context"
	"database/sql/driver"
	"encoding/base64"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

const encryptedInputSecretMarker = "IGRIS_ENCRYPTED_INPUT_SECRET_MARKER"

func TestInsertExecutionInputRefStoresNoPlaintextAndAuditsCreate(t *testing.T) {
	clearExecutionInputRefEnv(t)
	t.Setenv(executionInputRefKeyEnv, base64.StdEncoding.EncodeToString([]byte("0123456789abcdef0123456789abcdef")))
	t.Setenv(executionInputRefKeyVersionEnv, "test:create")

	taskID := uuid.New()
	tenantID := "tenant-input-ref-create"
	protected, err := protectTaskDefinitionInputs(json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{
			"kind":"tool",
			"node_id":"unsafe-http",
			"tool_name":"http_request",
			"args":{"method":"POST","url":"https://api.example.test/hook","body":"`+encryptedInputSecretMarker+`"}
		}]}
	}`), tenantID, taskID)
	require.NoError(t, err)
	require.Len(t, protected.Refs, 1)
	require.NotContains(t, string(protected.Definition), encryptedInputSecretMarker)

	ref := protected.Refs[0]
	require.Contains(t, string(protected.Definition), "encrypted_input_ref_id")
	require.NotContains(t, string(protected.Definition), "ciphertext")

	db, queued := newQueuedExecDB(t,
		queuedExecExpectation{rowsAffected: 1, check: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "INSERT INTO execution_input_refs")
			blob := stringifyNamedValues(args)
			require.NotContains(t, blob, encryptedInputSecretMarker)
			require.NotContains(t, blob, "body")
			require.Equal(t, ref.ID.String(), args[0].Value)
			require.Equal(t, tenantID, args[1].Value)
			require.Equal(t, taskID.String(), args[2].Value)
			require.Equal(t, "execution_payload", args[4].Value)
			require.Equal(t, ref.Ciphertext, args[5].Value)
			require.Equal(t, ref.Nonce, args[6].Value)
			require.Equal(t, ref.DigestSHA256, args[8].Value)
			require.EqualValues(t, ref.PlaintextBytes, args[9].Value)
			require.Equal(t, "test:create", args[12].Value)
		}},
		queuedExecExpectation{rowsAffected: 1, check: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "INSERT INTO execution_input_ref_audit")
			blob := stringifyNamedValues(args)
			require.NotContains(t, blob, encryptedInputSecretMarker)
			require.NotContains(t, blob, base64.StdEncoding.EncodeToString(ref.Ciphertext))
			require.Equal(t, "input_ref_created", args[7].Value)
			require.Equal(t, true, args[9].Value)
			require.Equal(t, "", args[10].Value)
			require.Equal(t, ref.KeyVersion, args[11].Value)
		}},
	)

	require.NoError(t, insertExecutionInputRef(context.Background(), db, ref))
	require.NoError(t, insertExecutionInputRefAudit(context.Background(), db, ExecutionInputRefAuditEvent{
		TenantID: tenantID, TaskID: taskID, InputRefID: ref.ID, Purpose: ref.Purpose,
		KeyVersion: ref.KeyVersion, ActorType: "system", EventType: "input_ref_created",
		Reason: "task submission stored encrypted execution input reference", Success: true,
	}))
	require.Equal(t, 0, queued.remainingExecs())
}

func TestDecryptExecutionInputRefAuditsRecoveryWithoutSensitiveMaterial(t *testing.T) {
	clearExecutionInputRefEnv(t)
	t.Setenv(executionInputRefKeyEnv, base64.StdEncoding.EncodeToString([]byte("22222222222222222222222222222222")))
	t.Setenv(executionInputRefKeyVersionEnv, "test:decrypt")

	tenantID := "tenant-input-ref-decrypt"
	taskID := uuid.New()
	protected, err := protectTaskDefinitionInputs(json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{
			"kind":"tool",
			"node_id":"unsafe-http",
			"tool_name":"http_request",
			"args":{"method":"POST","url":"https://api.example.test/hook","body":"`+encryptedInputSecretMarker+`"}
		}]}
	}`), tenantID, taskID)
	require.NoError(t, err)
	ref := protected.Refs[0]
	db, queued := newQueuedCheckpointDB(t,
		[]queuedQueryExpectation{{columns: executionInputRefQueryColumns(), values: executionInputRefQueryValues(ref, nil, nil)}},
	)

	plaintext, err := NewCheckpointStore(db).DecryptExecutionInputRef(
		context.Background(), tenantID, taskID, ref.ID, ref.Purpose, "runtime recovery redispatch",
	)
	require.NoError(t, err)
	require.Equal(t, encryptedInputSecretMarker, string(plaintext))
	require.Equal(t, 0, queued.remainingQueries())

	auditDB, auditQueued := newQueuedExecDB(t, queuedExecExpectation{rowsAffected: 1, check: func(query string, args []driver.NamedValue) {
		require.Contains(t, query, "INSERT INTO execution_input_ref_audit")
		blob := stringifyNamedValues(args)
		require.NotContains(t, blob, encryptedInputSecretMarker)
		require.NotContains(t, blob, base64.StdEncoding.EncodeToString(ref.Ciphertext))
		require.Equal(t, ref.ID.String(), args[4].Value)
		require.Equal(t, ref.Purpose, args[5].Value)
		require.Equal(t, "input_ref_decrypted_for_recovery", args[7].Value)
		require.Equal(t, "runtime recovery redispatch", args[8].Value)
		require.Equal(t, true, args[9].Value)
		require.Equal(t, "", args[10].Value)
		require.Equal(t, ref.KeyVersion, args[11].Value)
	}})
	require.NoError(t, insertExecutionInputRefAudit(context.Background(), auditDB, ExecutionInputRefAuditEvent{
		TenantID: tenantID, TaskID: taskID, InputRefID: ref.ID, Purpose: ref.Purpose,
		KeyVersion: ref.KeyVersion, ActorType: "system", EventType: "input_ref_decrypted_for_recovery",
		Reason: "runtime recovery redispatch", Success: true,
	}))
	require.Equal(t, 0, auditQueued.remainingExecs())
}

// The aad column is jsonb: Postgres rewrites the stored document (key order,
// whitespace), so the bytes read back are never byte-equal to the compact
// encrypt-time marshal. Decrypt must still succeed against a normalized AAD —
// this is what approval-dispatch rehydration sees on every real database.
func TestDecryptExecutionInputRefAcceptsJSONBNormalizedAAD(t *testing.T) {
	clearExecutionInputRefEnv(t)
	t.Setenv(executionInputRefKeyEnv, base64.StdEncoding.EncodeToString([]byte("44444444444444444444444444444444")))
	t.Setenv(executionInputRefKeyVersionEnv, "test:jsonb-aad")

	tenantID := "tenant-input-ref-jsonb-aad"
	taskID := uuid.New()
	protected, err := protectTaskDefinitionInputs(json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{
			"kind":"tool",
			"node_id":"gated-webhook",
			"tool_name":"http_request",
			"args":{"method":"POST","url":"https://gateway.example.test/apply","body":"`+encryptedInputSecretMarker+`"}
		}]}
	}`), tenantID, taskID)
	require.NoError(t, err)
	ref := protected.Refs[0]

	// Simulate the jsonb roundtrip: same JSON value, different bytes.
	var aadValue map[string]interface{}
	require.NoError(t, json.Unmarshal(ref.AAD, &aadValue))
	normalized, err := json.MarshalIndent(aadValue, "", "  ")
	require.NoError(t, err)
	require.NotEqual(t, string(ref.AAD), string(normalized))
	roundtripped := ref
	roundtripped.AAD = normalized

	db, queued := newQueuedCheckpointDB(t,
		[]queuedQueryExpectation{{columns: executionInputRefQueryColumns(), values: executionInputRefQueryValues(roundtripped, nil, nil)}},
	)
	plaintext, err := NewCheckpointStore(db).DecryptExecutionInputRef(
		context.Background(), tenantID, taskID, ref.ID, ref.Purpose, "approved action dispatch",
	)
	require.NoError(t, err)
	require.Equal(t, encryptedInputSecretMarker, string(plaintext))
	require.Equal(t, 0, queued.remainingQueries())

	// A structurally different AAD (wrong task scope) must still fail closed.
	foreign := ref
	foreignAAD, err := executionInputAssociatedData(tenantID, uuid.New(), ref.ID, ref.Purpose, ref.KeyVersion)
	require.NoError(t, err)
	foreign.AAD = foreignAAD
	foreignDB, foreignQueued := newQueuedCheckpointDB(t,
		[]queuedQueryExpectation{{columns: executionInputRefQueryColumns(), values: executionInputRefQueryValues(foreign, nil, nil)}},
	)
	_, err = NewCheckpointStore(foreignDB).DecryptExecutionInputRef(
		context.Background(), tenantID, taskID, ref.ID, ref.Purpose, "approved action dispatch",
	)
	require.ErrorIs(t, err, ErrExecutionInputRefScope)
	require.Equal(t, 0, foreignQueued.remainingQueries())
}

func TestExpiredOrRevokedInputRefsFailClosedAndAudit(t *testing.T) {
	clearExecutionInputRefEnv(t)
	t.Setenv(executionInputRefKeyEnv, base64.StdEncoding.EncodeToString([]byte("33333333333333333333333333333333")))
	t.Setenv(executionInputRefKeyVersionEnv, "test:failclosed")

	tenantID := "tenant-input-ref-failclosed"
	taskID := uuid.New()
	protected, err := protectTaskDefinitionInputs(json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{
			"kind":"tool",
			"node_id":"unsafe-http",
			"tool_name":"http_request",
			"args":{"method":"POST","url":"https://api.example.test/hook","body":"`+encryptedInputSecretMarker+`"}
		}]}
	}`), tenantID, taskID)
	require.NoError(t, err)
	ref := protected.Refs[0]

	now := time.Now().UTC()
	cases := []struct {
		name        string
		expiresAt   *time.Time
		revokedAt   *time.Time
		wantErr     error
		failureCode string
	}{
		{name: "expired", expiresAt: ptrInputRefTime(now.Add(-time.Minute)), wantErr: ErrExecutionInputRefExpired, failureCode: "expired"},
		{name: "revoked", revokedAt: ptrInputRefTime(now.Add(-time.Minute)), wantErr: ErrExecutionInputRefRevoked, failureCode: "revoked"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			db, queued := newQueuedCheckpointDB(t,
				[]queuedQueryExpectation{{columns: executionInputRefQueryColumns(), values: executionInputRefQueryValues(ref, tc.expiresAt, tc.revokedAt)}},
			)

			plaintext, err := NewCheckpointStore(db).DecryptExecutionInputRef(
				context.Background(), tenantID, taskID, ref.ID, ref.Purpose, "runtime recovery redispatch",
			)
			require.ErrorIs(t, err, tc.wantErr)
			require.Equal(t, tc.failureCode, safeInputRefFailureCode(err))
			require.Nil(t, plaintext)
			require.Equal(t, 0, queued.remainingQueries())

			auditDB, auditQueued := newQueuedExecDB(t, queuedExecExpectation{rowsAffected: 1, check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INSERT INTO execution_input_ref_audit")
				blob := stringifyNamedValues(args)
				require.NotContains(t, blob, encryptedInputSecretMarker)
				require.NotContains(t, blob, base64.StdEncoding.EncodeToString(ref.Ciphertext))
				require.Equal(t, "input_ref_decrypt_denied", args[7].Value)
				require.Equal(t, false, args[9].Value)
				require.Equal(t, tc.failureCode, args[10].Value)
				require.Equal(t, ref.KeyVersion, args[11].Value)
			}})
			require.NoError(t, insertExecutionInputRefAudit(context.Background(), auditDB, ExecutionInputRefAuditEvent{
				TenantID: tenantID, TaskID: taskID, InputRefID: ref.ID, Purpose: ref.Purpose,
				KeyVersion: ref.KeyVersion, ActorType: "system", EventType: "input_ref_decrypt_denied",
				Reason: "runtime recovery redispatch", Success: false, FailureCode: tc.failureCode,
			}))
			require.Equal(t, 0, auditQueued.remainingExecs())
		})
	}
}

func executionInputRefQueryColumns() []string {
	return []string{
		"id", "tenant_id", "task_id", "action_id", "purpose",
		"ciphertext", "nonce", "aad", "digest_sha256", "plaintext_bytes", "content_type",
		"redaction_policy_version", "key_version", "created_at", "expires_at", "revoked_at", "last_decrypted_at",
	}
}

func executionInputRefQueryValues(ref ExecutionInputRef, expiresAt, revokedAt *time.Time) []driver.Value {
	return []driver.Value{
		ref.ID.String(),
		ref.TenantID,
		ref.TaskID.String(),
		nil,
		ref.Purpose,
		ref.Ciphertext,
		ref.Nonce,
		[]byte(ref.AAD),
		ref.DigestSHA256,
		ref.PlaintextBytes,
		ref.ContentType,
		ref.RedactionPolicyVersion,
		ref.KeyVersion,
		time.Now().UTC(),
		expiresAt,
		revokedAt,
		nil,
	}
}

func stringifyNamedValues(args []driver.NamedValue) string {
	raw, _ := json.Marshal(args)
	return string(raw)
}

func ptrInputRefTime(t time.Time) *time.Time {
	return &t
}
