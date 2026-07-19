package api

// Real-Postgres tests for Clock 3C run-scoped evidence linkage.

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/internal/canonicaljson"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestRunScopedEvidenceLinkPostgresEligibilityAndExclusivity(t *testing.T) {
	db := openContractBindingPostgres(t)
	store := coordinator.NewCheckpointStore(db)
	tenant := "tenant-proof-3c"
	actionName := "clock3b.consequential_transfer"
	contractHash := strings.Repeat("a", 64)
	targetVersion := strings.Repeat("b", 64)

	targetID := uuid.New()
	bindingID := uuid.New()
	contractVersionID := uuid.New()
	_, err := db.Exec(`
		INSERT INTO action_definitions (
			id, tenant_id, name, display_name, target_type, target_url, method,
			policy_preset, replay_class, approval_required, irreversible,
			secret_refs, target_metadata, fallback_policy, origin
		) VALUES (
			$1, $2, 'clock3b_adapter_target', 'Clock 3B Adapter',
			'webhook', 'http://127.0.0.1:18099/v1/clock3b/consequential-transfer',
			'POST', 'Safe automation', 'retryable', false, false, '[]'::jsonb,
			'{}'::jsonb, '{"enabled":false}'::jsonb, 'manual'
		)`, targetID, tenant)
	require.NoError(t, err)
	_, err = db.Exec(`
		INSERT INTO action_contract_versions (
			id, tenant_id, action_name, contract_hash, schema_version, contract,
			risk, approval_mode, execution_mode, source
		) VALUES (
			$1, $2, $3, $4, '1', '{}'::jsonb, 'high', 'never', 'embedded', 'sdk_sync'
		)`, contractVersionID, tenant, actionName, contractHash)
	require.NoError(t, err)
	_, err = db.Exec(`
		INSERT INTO action_contract_execution_bindings (
			id, tenant_id, action_name, contract_version_id, contract_hash,
			target_action_id, target_version_hash, target_snapshot, input_mapping,
			endpoint_config_ref, timeout_ms, replay_class, idempotency_required
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7,
			'{"name":"clock3b_adapter_target","target_type":"webhook","target_url":"http://127.0.0.1:18099/v1/clock3b/consequential-transfer","method":"POST","policy_preset":"Safe automation","replay_class":"retryable"}'::jsonb,
			'{"account_id":"account_id","amount_cents":"amount_cents"}'::jsonb,
			'local', 30000, 'retryable', true
		)`, bindingID, tenant, actionName, contractVersionID, contractHash, targetID, targetVersion)
	require.NoError(t, err)

	toolInputA := map[string]interface{}{"account_id": "acct-a", "amount_cents": int64(100)}
	toolInputB := map[string]interface{}{"account_id": "acct-b", "amount_cents": int64(200)}
	hashA := mustToolInputHash(t, toolInputA)
	hashB := mustToolInputHash(t, toolInputB)
	defA := sampleBoundTaskDefinition(t, actionName, map[string]interface{}{"account_id": "acct-a", "amount_cents": 100})
	defB := sampleBoundTaskDefinition(t, actionName, map[string]interface{}{"account_id": "acct-b", "amount_cents": 200})

	taskA := createBoundTaskForProof(t, store, tenant, bindingID, targetID, contractHash, targetVersion, "biz-a", strings.Repeat("c", 64), defA)
	taskB := createBoundTaskForProof(t, store, tenant, bindingID, targetID, contractHash, targetVersion, "biz-b", strings.Repeat("d", 64), defB)

	batchForA := seedVerifiedEvidenceBatch(t, db, tenant, actionName, contractHash, hashA, "c"+strings.Repeat("1", 63))
	batchForB := seedVerifiedEvidenceBatch(t, db, tenant, actionName, contractHash, hashB, "c"+strings.Repeat("2", 63))
	batchOtherContract := seedVerifiedEvidenceBatch(t, db, tenant, actionName, strings.Repeat("f", 64), hashA, "c"+strings.Repeat("3", 63))
	batchOtherTenant := seedVerifiedEvidenceBatch(t, db, "tenant-other", actionName, contractHash, hashA, "c"+strings.Repeat("4", 63))

	boundA := &coordinator.BoundActionRunIdentity{
		BindingID: bindingID, ContractHash: contractHash, TargetActionID: targetID,
		TargetVersionHash: targetVersion, BusinessIdempotencyKey: "biz-a",
		RequestFingerprint: strings.Repeat("c", 64),
	}
	boundB := &coordinator.BoundActionRunIdentity{
		BindingID: bindingID, ContractHash: contractHash, TargetActionID: targetID,
		TargetVersionHash: targetVersion, BusinessIdempotencyKey: "biz-b",
		RequestFingerprint: strings.Repeat("d", 64),
	}

	// Same contract + same run tool input accepted.
	elig, err := evaluateEvidenceLinkEligibility(context.Background(), db, tenant, taskA, boundA, defA, batchForA)
	require.NoError(t, err)
	require.Equal(t, hashA, elig.InputHash)
	link, err := insertEvidenceLinkExclusive(context.Background(), db, taskA, tenant, elig)
	require.NoError(t, err)
	require.Equal(t, batchForA, link.BatchID)

	// Existing correct link remains stable (idempotent re-link).
	link2, err := insertEvidenceLinkExclusive(context.Background(), db, taskA, tenant, elig)
	require.NoError(t, err)
	require.Equal(t, link.ID, link2.ID)

	// Same contract, different run (batch input belongs to A, not B) rejected.
	_, err = evaluateEvidenceLinkEligibility(context.Background(), db, tenant, taskB, boundB, defB, batchForA)
	require.True(t, isEvidenceNotLinkable(err), "expected reject for different-run evidence: %v", err)

	// B can link its own matching evidence.
	eligB, err := evaluateEvidenceLinkEligibility(context.Background(), db, tenant, taskB, boundB, defB, batchForB)
	require.NoError(t, err)
	_, err = insertEvidenceLinkExclusive(context.Background(), db, taskB, tenant, eligB)
	require.NoError(t, err)

	// Exclusive ownership: batch already linked to A cannot attach to B.
	_, err = insertEvidenceLinkExclusive(context.Background(), db, taskB, tenant, &evidenceLinkEligibility{
		ChainDigest: elig.ChainDigest, BatchID: batchForA, InputHash: hashB, ActionName: actionName,
	})
	require.True(t, isEvidenceNotLinkable(err), "exclusive batch ownership must reject: %v", err)

	// Different contract rejected.
	_, err = evaluateEvidenceLinkEligibility(context.Background(), db, tenant, taskA, boundA, defA, batchOtherContract)
	require.True(t, isEvidenceNotLinkable(err))

	// Cross-tenant batch rejected.
	_, err = evaluateEvidenceLinkEligibility(context.Background(), db, tenant, taskA, boundA, defA, batchOtherTenant)
	require.True(t, isEvidenceNotLinkable(err))

	loaded, err := loadActionEvidenceLink(context.Background(), db, taskA, tenant)
	require.NoError(t, err)
	require.Equal(t, link.BatchID, loaded.BatchID)
	require.Equal(t, link.ChainDigest, loaded.ChainDigest)

	// Handler fails closed without tenant auth.
	tc := coordinator.NewTaskCoordinator(db)
	app := fiber.New()
	app.Post("/v1/actions/runs/:id/evidence-links", handleActionEvidenceLinkCreate(db, tc))
	req := httptest.NewRequest(
		http.MethodPost,
		"/v1/actions/runs/"+taskA.String()+"/evidence-links",
		strings.NewReader(`{"batch_id":"`+batchForA.String()+`"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusUnauthorized, resp.StatusCode)
}

func mustToolInputHash(t *testing.T, input map[string]interface{}) string {
	t.Helper()
	canonical, err := canonicaljson.Encode(input)
	require.NoError(t, err)
	return canonicaljson.SHA256Hex(canonical)
}

func createBoundTaskForProof(
	t *testing.T,
	store *coordinator.CheckpointStore,
	tenant string,
	bindingID, targetID uuid.UUID,
	contractHash, targetVersion, bizKey, fingerprint string,
	def json.RawMessage,
) uuid.UUID {
	t.Helper()
	taskID := uuid.New()
	task := &coordinator.TaskRecord{
		TaskID: taskID, TenantID: tenant, Status: coordinator.TaskStatusPending,
		TaskDefinition: def, IdempotencyKey: bizKey,
		BoundAction: &coordinator.BoundActionRunIdentity{
			BindingID: bindingID, ContractHash: contractHash, TargetActionID: targetID,
			TargetVersionHash: targetVersion, BusinessIdempotencyKey: bizKey, RequestFingerprint: fingerprint,
		},
	}
	inserted, err := store.CreateTask(task)
	require.NoError(t, err)
	require.True(t, inserted)
	return taskID
}

func seedVerifiedEvidenceBatch(
	t *testing.T,
	db *sql.DB,
	tenant, actionName, contractHash, inputHash, chainHead string,
) uuid.UUID {
	t.Helper()
	batchID := uuid.New()
	eventID := uuid.NewString()
	eventHash := chainHead
	// Unique key_id per batch so verified genesis chain slots do not collide
	// on sdk_evidence_batches_chain_slot_idx (tenant, key_id, genesis).
	keySuffix := strings.ReplaceAll(batchID.String(), "-", "")[:16]
	keyID := "ed25519:" + keySuffix
	contentHash := strings.ReplaceAll(uuid.NewString(), "-", "") + strings.ReplaceAll(uuid.NewString(), "-", "")
	contentHash = contentHash[:64]

	event := map[string]any{
		"schema_version":         "1",
		"event_type":             "decision",
		"event_id":               eventID,
		"action_id":              actionName,
		"action_name":            actionName,
		"contract_hash":          contractHash,
		"input_hash":             inputHash,
		"decision":               "allowed",
		"risk":                   "high",
		"approval_mode":          "never",
		"redacted_input_summary": "test",
		"timestamp_utc":          time.Now().UTC().Format(time.RFC3339Nano),
		"key_id":                 keyID,
		"event_hash":             eventHash,
		"signature":              "dGVzdA==",
		"previous_event_hash":    nil,
	}
	eventJSON, err := json.Marshal(event)
	require.NoError(t, err)

	_, err = db.Exec(`
		INSERT INTO sdk_signing_keys (tenant_id, key_id, public_key_pem, fingerprint_sha256)
		VALUES ($1, $2, $3, $4)`,
		tenant, keyID, "PUBLIC KEY ONLY", strings.Repeat("e", 64),
	)
	require.NoError(t, err)

	_, err = db.Exec(`
		INSERT INTO sdk_evidence_batches (
			id, tenant_id, key_id, evidence_state, execution_provenance,
			content_hash, chain_head, events_accepted, events_verified, verified_at
		) VALUES (
			$1, $2, $3, 'verified', 'embedded', $4, $5, 1, 1, NOW()
		)`, batchID, tenant, keyID, contentHash, chainHead)
	require.NoError(t, err)

	_, err = db.Exec(`
		INSERT INTO sdk_evidence_events (
			tenant_id, key_id, event_hash, batch_id, event, event_id, event_type,
			action_name, contract_hash, execution_provenance, timestamp_utc
		) VALUES (
			$1, $2, $3, $4, $5::jsonb, $6, 'decision', $7, $8, 'embedded', NOW()
		)`, tenant, keyID, eventHash, batchID, string(eventJSON), eventID, actionName, contractHash)
	require.NoError(t, err)
	return batchID
}
