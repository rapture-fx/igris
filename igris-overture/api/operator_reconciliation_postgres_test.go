package api

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestOperatorReconciliationPostgresLifecycleAndConcurrency(t *testing.T) {
	db := openContractBindingPostgres(t)
	db.SetMaxOpenConns(8)
	store := coordinator.NewCheckpointStore(db)
	tenant := "tenant-reconciliation"
	bindingID, targetID, contractHash, targetVersion := seedReconciliationBinding(t, db, tenant)

	eligibleTask := createReconciliationTask(
		t, store, tenant, bindingID, targetID, contractHash, targetVersion, "business-eligible",
	)
	require.NoError(t, store.MarkDispatched(eligibleTask, "runtime-reconciliation", "http://runtime"))
	require.NoError(t, store.MarkFailedWithDetails(
		eligibleTask,
		"target reported an unknown consequential effect state; automatic replay refused",
		typedReconciliationFailure(),
	))

	state, err := loadOperatorReconciliationState(context.Background(), db, tenant, eligibleTask)
	require.NoError(t, err)
	require.True(t, state.Required)
	require.Equal(t, reconciliationRequired, state.CurrentState)
	require.Len(t, state.History, 1)
	require.Equal(t, "runtime", state.History[0].ActorType)
	err = store.MarkFailedWithDetails(
		eligibleTask, "synchronous Runtime response arrived after callback", typedReconciliationFailure(),
	)
	require.ErrorIs(t, err, coordinator.ErrTaskTransitionRejected)
	state, err = loadOperatorReconciliationState(context.Background(), db, tenant, eligibleTask)
	require.NoError(t, err)
	require.Len(t, state.History, 1, "callback/response race must not duplicate observation")

	ordinaryTask := createReconciliationTask(
		t, store, tenant, bindingID, targetID, contractHash, targetVersion, "business-ordinary",
	)
	require.NoError(t, store.MarkDispatched(ordinaryTask, "runtime-reconciliation", "http://runtime"))
	require.NoError(t, store.MarkFailedWithDetails(
		ordinaryTask,
		"ordinary failure",
		&coordinator.TaskFailureDetails{
			Source: "runtime", Operation: "execution", RejectionType: "step_failed",
			Message: "ordinary failure",
		},
	))
	_, err = loadOperatorReconciliationState(context.Background(), db, tenant, ordinaryTask)
	require.ErrorIs(t, err, sql.ErrNoRows)
	_, err = db.Exec(`
		INSERT INTO contract_bound_action_reconciliation_events (
			tenant_id, task_id, binding_id, contract_hash, target_action_id,
			target_version_hash, business_idempotency_digest, event_type,
			observed_effect_state, actor_type, actor_id, reason,
			external_reference_type, external_reference_value,
			target_host, source_status_code
		)
		SELECT r.tenant_id, r.task_id, r.binding_id, r.contract_hash,
		       r.target_action_id, r.target_version_hash,
		       encode(sha256(convert_to(r.business_idempotency_key, 'UTF8')), 'hex'),
		       'unresolved_effect_observed', 'unknown_effect_state',
		       'runtime', 'runtime-reconciliation',
		       'Runtime reported a typed unknown consequential effect; automatic replay is refused',
		       'runtime_response_digest', $3, 'adapter.internal', 409
		FROM contract_bound_action_runs r
		WHERE r.tenant_id = $1 AND r.task_id = $2`,
		tenant, ordinaryTask, strings.Repeat("a", 64),
	)
	require.Error(t, err, "ordinary failure must not manufacture eligibility via direct insert")
	_, _, err = appendOperatorReconciliation(
		context.Background(), db, tenant, ordinaryTask, "operator-1", "operator@example.test",
		uuid.New(), operatorRequest(reconciliationSucceeded, "Ordinary run must not be eligible"),
	)
	require.ErrorIs(t, err, errReconciliationNotRequired)

	completedTask := createReconciliationTask(
		t, store, tenant, bindingID, targetID, contractHash, targetVersion, "business-completed",
	)
	require.NoError(t, store.MarkDispatched(completedTask, "runtime-reconciliation", "http://runtime"))
	require.NoError(t, store.MarkCompleted(completedTask))
	_, _, err = appendOperatorReconciliation(
		context.Background(), db, tenant, completedTask, "operator-1", "operator@example.test",
		uuid.New(), operatorRequest(reconciliationFailed, "Completed run must not be rewritten"),
	)
	require.ErrorIs(t, err, errReconciliationNotRequired)

	remainsReq := operatorRequest(reconciliationRemainsUnknown, "Provider investigation is still pending")
	remainsID := uuid.New()
	remains, replayed, err := appendOperatorReconciliation(
		context.Background(), db, tenant, eligibleTask, "operator-1", "operator@example.test",
		remainsID, remainsReq,
	)
	require.NoError(t, err)
	require.False(t, replayed)
	require.Equal(t, reconciliationRemainsUnknown, remains.Resolution)

	replayedEvent, replayed, err := appendOperatorReconciliation(
		context.Background(), db, tenant, eligibleTask, "operator-1", "operator@example.test",
		remainsID, remainsReq,
	)
	require.NoError(t, err)
	require.True(t, replayed)
	require.Equal(t, remains.ID, replayedEvent.ID)

	finalReq := operatorRequest(reconciliationSucceeded, "Provider transaction was independently verified")
	finalEvent, replayed, err := appendOperatorReconciliation(
		context.Background(), db, tenant, eligibleTask, "operator-2", "operator2@example.test",
		uuid.New(), finalReq,
	)
	require.NoError(t, err)
	require.False(t, replayed)
	require.Equal(t, reconciliationSucceeded, finalEvent.Resolution)

	_, _, err = appendOperatorReconciliation(
		context.Background(), db, tenant, eligibleTask, "operator-3", "operator3@example.test",
		uuid.New(), operatorRequest(reconciliationFailed, "Provider confirmed no transaction"),
	)
	require.ErrorIs(t, err, errResolutionConflict)

	state, err = loadOperatorReconciliationState(context.Background(), db, tenant, eligibleTask)
	require.NoError(t, err)
	require.False(t, state.Required)
	require.Equal(t, reconciliationSucceeded, state.CurrentState)
	require.Len(t, state.History, 3)

	_, err = loadOperatorReconciliationState(
		context.Background(), db, "foreign-tenant", eligibleTask,
	)
	require.ErrorIs(t, err, sql.ErrNoRows)

	_, err = db.Exec(`
		UPDATE contract_bound_action_reconciliation_events
		SET reason = 'silently changed'
		WHERE id = $1`, finalEvent.ID)
	require.Error(t, err)
	_, err = db.Exec(`
		DELETE FROM contract_bound_action_reconciliation_events
		WHERE id = $1`, finalEvent.ID)
	require.Error(t, err)

	concurrentTask := createReconciliationTask(
		t, store, tenant, bindingID, targetID, contractHash, targetVersion, "business-concurrent",
	)
	require.NoError(t, store.MarkDispatched(concurrentTask, "runtime-reconciliation", "http://runtime"))
	require.NoError(t, store.MarkFailedWithDetails(
		concurrentTask, "unknown effect", typedReconciliationFailure(),
	))

	var wg sync.WaitGroup
	results := make(chan error, 2)
	for _, resolution := range []string{reconciliationSucceeded, reconciliationFailed} {
		resolution := resolution
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _, err := appendOperatorReconciliation(
				context.Background(), db, tenant, concurrentTask,
				"operator-"+resolution, resolution+"@example.test", uuid.New(),
				operatorRequest(resolution, "Independent provider verification completed"),
			)
			results <- err
		}()
	}
	wg.Wait()
	close(results)
	var successes, conflicts int
	for result := range results {
		switch {
		case result == nil:
			successes++
		case errors.Is(result, errResolutionConflict):
			conflicts++
		default:
			require.NoError(t, result)
		}
	}
	require.Equal(t, 1, successes)
	require.Equal(t, 1, conflicts)

	var terminalCount int
	require.NoError(t, db.QueryRow(`
		SELECT COUNT(*)
		FROM contract_bound_action_reconciliation_events
		WHERE tenant_id = $1 AND task_id = $2
		  AND resolution IN ('confirmed_succeeded', 'confirmed_failed')`,
		tenant, concurrentTask,
	).Scan(&terminalCount))
	require.Equal(t, 1, terminalCount)

	tc := coordinator.NewTaskCoordinator(db)
	foreignApp := fiber.New()
	foreignApp.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "foreign-tenant")
		c.Locals("clerk_email", "foreign@example.test")
		c.Locals("tenant", &middleware.TenantContext{
			TenantID: "foreign-tenant",
			Roles:    []string{"admin"},
			IsAdmin:  true,
		})
		return c.Next()
	})
	foreignApp.Get(
		"/v1/actions/runs/:id/reconciliation",
		handleActionReconciliationGet(db, tc),
	)
	foreignApp.Post(
		"/v1/actions/runs/:id/reconciliation",
		handleActionReconciliationAppend(db, tc),
	)
	foreignReq := httptest.NewRequest(
		http.MethodGet,
		"/v1/actions/runs/"+eligibleTask.String()+"/reconciliation",
		nil,
	)
	foreignResp, err := foreignApp.Test(foreignReq, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, foreignResp.StatusCode)
	var foreignBody map[string]interface{}
	require.NoError(t, json.NewDecoder(foreignResp.Body).Decode(&foreignBody))
	require.Equal(t, "run_not_found", foreignBody["error"])

	foreignReq = httptest.NewRequest(
		http.MethodPost,
		"/v1/actions/runs/"+eligibleTask.String()+"/reconciliation",
		strings.NewReader(`{
			"request_id":"`+uuid.NewString()+`",
			"resolution":"confirmed_failed",
			"reason":"Foreign tenant must not resolve this run"
		}`),
	)
	foreignReq.Header.Set("Content-Type", "application/json")
	foreignResp, err = foreignApp.Test(foreignReq, -1)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, foreignResp.StatusCode)
}

func TestTypedUnknownEffectStillTerminatesTaskWhenManualMigrationIsMissing(t *testing.T) {
	db := openContractBindingPostgres(t)
	store := coordinator.NewCheckpointStore(db)
	tenant := "tenant-reconciliation-migration-missing"
	bindingID, targetID, contractHash, targetVersion := seedReconciliationBinding(t, db, tenant)
	taskID := createReconciliationTask(
		t, store, tenant, bindingID, targetID, contractHash, targetVersion, "business-no-072",
	)
	require.NoError(t, store.MarkDispatched(taskID, "runtime-reconciliation", "http://runtime"))
	_, err := db.Exec(`DROP TABLE contract_bound_action_reconciliation_events`)
	require.NoError(t, err)

	require.NoError(t, store.MarkFailedWithDetails(
		taskID, "unknown effect with migration unavailable", typedReconciliationFailure(),
	))
	var status string
	var failureDetails []byte
	require.NoError(t, db.QueryRow(`
		SELECT status, failure_details
		FROM task_records
		WHERE task_id = $1`, taskID,
	).Scan(&status, &failureDetails))
	require.Equal(t, "failed", status)
	var persistedDetails map[string]interface{}
	require.NoError(t, json.Unmarshal(failureDetails, &persistedDetails))
	require.Equal(t, true, persistedDetails["reconciliation_required"])
}

func typedReconciliationFailure() *coordinator.TaskFailureDetails {
	return &coordinator.TaskFailureDetails{
		Source:                 "runtime",
		Operation:              "execution",
		StatusCode:             409,
		RejectionType:          "step_failed",
		Message:                "target reported an unknown consequential effect state",
		EffectState:            "unknown_effect_state",
		ReconciliationRequired: true,
		TargetErrorCode:        "idempotency_unresolved",
		TargetHost:             "adapter.internal",
		TargetResponseDigest:   strings.Repeat("a", 64),
	}
}

func operatorRequest(resolution, reason string) operatorReconciliationRequest {
	req := operatorReconciliationRequest{
		Resolution: resolution,
		Reason:     reason,
	}
	req.ExternalReference = &struct {
		Type  string `json:"type"`
		Value string `json:"value"`
	}{
		Type:  "provider_reference",
		Value: "provider-ref-123",
	}
	return req
}

func seedReconciliationBinding(
	t *testing.T,
	db *sql.DB,
	tenant string,
) (bindingID, targetID uuid.UUID, contractHash, targetVersion string) {
	t.Helper()
	targetID = uuid.New()
	bindingID = uuid.New()
	contractVersionID := uuid.New()
	contractHash = strings.Repeat("a", 64)
	targetVersion = strings.Repeat("b", 64)
	actionName := "clock3d.consequential_transfer"
	_, err := db.Exec(`
		INSERT INTO action_definitions (
			id, tenant_id, name, display_name, target_type, target_url, method,
			policy_preset, replay_class, approval_required, irreversible,
			secret_refs, target_metadata, fallback_policy, origin
		) VALUES (
			$1, $2, 'clock3d_adapter_target', 'Clock 3D Adapter',
			'webhook', 'http://adapter.internal/consequential',
			'POST', 'Safe automation', 'retryable', false, true, '[]'::jsonb,
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
			'{"name":"clock3d_adapter_target","target_type":"webhook"}'::jsonb,
			'{"account_id":"account_id"}'::jsonb,
			'local', 30000, 'retryable', true
		)`, bindingID, tenant, actionName, contractVersionID, contractHash, targetID, targetVersion)
	require.NoError(t, err)
	return bindingID, targetID, contractHash, targetVersion
}

func createReconciliationTask(
	t *testing.T,
	store *coordinator.CheckpointStore,
	tenant string,
	bindingID, targetID uuid.UUID,
	contractHash, targetVersion, businessKey string,
) uuid.UUID {
	t.Helper()
	taskID := uuid.New()
	definition := json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[{"kind":"tool","node_id":"contract-bound-http-0","tool_name":"http_request","args":{"method":"POST","url":"http://adapter.internal/consequential","body":"{}"}}]}}`)
	inserted, err := store.CreateTask(&coordinator.TaskRecord{
		TaskID:         taskID,
		TenantID:       tenant,
		Status:         coordinator.TaskStatusPending,
		TaskDefinition: definition,
		IdempotencyKey: businessKey,
		BoundAction: &coordinator.BoundActionRunIdentity{
			BindingID:              bindingID,
			ContractHash:           contractHash,
			TargetActionID:         targetID,
			TargetVersionHash:      targetVersion,
			BusinessIdempotencyKey: businessKey,
			RequestFingerprint:     strings.Repeat("c", 64),
		},
	})
	require.NoError(t, err)
	require.True(t, inserted)
	return taskID
}
