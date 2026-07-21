package api

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestValidateContractInputMappingExactAndInjective(t *testing.T) {
	t.Parallel()
	descriptors := []contractParameterDescriptor{
		{Name: "account_id", Kind: "POSITIONAL_OR_KEYWORD"},
		{Name: "amount_cents", Kind: "POSITIONAL_OR_KEYWORD"},
	}

	require.NoError(t, validateContractInputMapping(descriptors, map[string]string{
		"account_id": "account_id", "amount_cents": "amount_cents",
	}))
	require.Error(t, validateContractInputMapping(descriptors, map[string]string{
		"account_id": "account_id",
	}))
	require.Error(t, validateContractInputMapping(descriptors, map[string]string{
		"account_id": "value", "amount_cents": "value",
	}))
	require.Error(t, validateContractInputMapping(descriptors, map[string]string{
		"account_id": "account_id", "unknown": "unknown",
	}))
}

func TestMapBoundActionInputRejectsMissingExtraAndWrongType(t *testing.T) {
	t.Parallel()
	strAnnotation := "str"
	intAnnotation := "int"
	descriptors := []contractParameterDescriptor{
		{Name: "account_id", Annotation: &strAnnotation},
		{Name: "amount_cents", Annotation: &intAnnotation},
	}
	mapping := map[string]string{"account_id": "account_id", "amount_cents": "amount_cents"}

	mapped, err := mapBoundActionInput(descriptors, mapping, map[string]interface{}{
		"account_id": "acct-1", "amount_cents": float64(2500),
	})
	require.NoError(t, err)
	require.Equal(t, "acct-1", mapped["account_id"])
	require.Equal(t, float64(2500), mapped["amount_cents"])

	_, err = mapBoundActionInput(descriptors, mapping, map[string]interface{}{"account_id": "acct-1"})
	require.ErrorContains(t, err, "missing required")
	_, err = mapBoundActionInput(descriptors, mapping, map[string]interface{}{
		"account_id": "acct-1", "amount_cents": float64(1), "extra": true,
	})
	require.ErrorContains(t, err, "unexpected input")
	_, err = mapBoundActionInput(descriptors, mapping, map[string]interface{}{
		"account_id": "acct-1", "amount_cents": "2500",
	})
	require.ErrorContains(t, err, "incompatible")
}

func TestBuildBoundActionRunRequestProducesTwoStepRecoveryGraph(t *testing.T) {
	t.Setenv("IGRIS_CLOCK3B_ADAPTER_TOKEN", "test-token")
	contractHash := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	targetHash := "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	bindingID := uuid.New()
	targetID := uuid.New()
	snapshot, err := json.Marshal(boundTargetSnapshot{
		Name:         "clock3b_adapter_target",
		TargetType:   actionTargetWebhook,
		TargetURL:    "http://127.0.0.1:18099/v1/clock3b/consequential-transfer",
		Method:       "POST",
		PolicyPreset: "Safe automation",
		ReplayClass:  "retryable",
		TargetMetadata: map[string]interface{}{
			localWebhookAuthHeaderNameMetadata: "X-Igris-Adapter-Token",
			localWebhookAuthSecretEnvMetadata:  "IGRIS_CLOCK3B_ADAPTER_TOKEN",
		},
	})
	require.NoError(t, err)
	mapping, err := json.Marshal(map[string]string{
		"account_id": "account_id", "amount_cents": "amount_cents",
	})
	require.NoError(t, err)
	contract, err := json.Marshal(map[string]interface{}{
		"parameter_descriptors": []map[string]interface{}{
			{"name": "account_id", "kind": "POSITIONAL_OR_KEYWORD", "has_default": false, "annotation": "str"},
			{"name": "amount_cents", "kind": "POSITIONAL_OR_KEYWORD", "has_default": false, "annotation": "int"},
		},
	})
	require.NoError(t, err)

	run, _, err := buildBoundActionRunRequest(
		&contractExecutionBindingRecord{
			ID: bindingID, ActionName: "clock3b.consequential_transfer",
			ContractHash: contractHash, TargetActionID: targetID,
			TargetVersionHash: targetHash, TargetSnapshot: snapshot,
			InputMapping: mapping, ReplayClass: "retryable", TimeoutMS: 30_000,
		},
		&contractVersionRecord{Contract: contract, Risk: "high", ApprovalMode: "never"},
		actionRunByNameRequest{
			Input:          map[string]interface{}{"account_id": "acct-1", "amount_cents": float64(2500)},
			IdempotencyKey: "business-effect-1",
		},
	)
	require.NoError(t, err)
	require.NotNil(t, run.boundAction)
	require.Equal(t, contractHash, run.boundAction.ContractHash)
	require.NotEmpty(t, run.boundAction.RequestFingerprint)

	definition, err := buildBoundActionExecutionGraphDefinition(run)
	require.NoError(t, err)
	var decoded struct {
		CheckpointAfterSteps    uint32 `json:"checkpoint_after_steps"`
		ContinueAfterCheckpoint bool   `json:"continue_after_checkpoint"`
		Graph                   struct {
			Nodes []map[string]interface{} `json:"nodes"`
		} `json:"graph"`
	}
	require.NoError(t, json.Unmarshal(definition, &decoded))
	require.Equal(t, uint32(1), decoded.CheckpointAfterSteps)
	require.True(t, decoded.ContinueAfterCheckpoint)
	require.Len(t, decoded.Graph.Nodes, 2)
	require.Equal(t, "http_request", decoded.Graph.Nodes[0]["tool_name"])
	require.Equal(t, "database_write", decoded.Graph.Nodes[1]["tool_name"])
}

func TestBuildBoundActionExecutionGraphDefinitionYieldsWhenProofEnvSet(t *testing.T) {
	t.Setenv("IGRIS_CLOCK3B_ADAPTER_TOKEN", "test-token")
	t.Setenv("IGRIS_BOUND_ACTION_YIELD_AFTER_CHECKPOINT", "1")
	contractHash := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	targetHash := "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	snapshot, err := json.Marshal(boundTargetSnapshot{
		Name: "clock3b_adapter_target", TargetType: actionTargetWebhook,
		TargetURL: "http://127.0.0.1:18099/v1/clock3b/consequential-transfer",
		Method:    "POST", PolicyPreset: "Safe automation", ReplayClass: "retryable",
		TargetMetadata: map[string]interface{}{
			localWebhookAuthHeaderNameMetadata: "X-Igris-Adapter-Token",
			localWebhookAuthSecretEnvMetadata:  "IGRIS_CLOCK3B_ADAPTER_TOKEN",
		},
	})
	require.NoError(t, err)
	mapping, err := json.Marshal(map[string]string{"account_id": "account_id", "amount_cents": "amount_cents"})
	require.NoError(t, err)
	contract, err := json.Marshal(map[string]interface{}{
		"parameter_descriptors": []map[string]interface{}{
			{"name": "account_id", "kind": "POSITIONAL_OR_KEYWORD", "has_default": false, "annotation": "str"},
			{"name": "amount_cents", "kind": "POSITIONAL_OR_KEYWORD", "has_default": false, "annotation": "int"},
		},
	})
	require.NoError(t, err)

	run, _, err := buildBoundActionRunRequest(
		&contractExecutionBindingRecord{
			ID: uuid.New(), ActionName: "clock3b.consequential_transfer",
			ContractHash: contractHash, TargetActionID: uuid.New(),
			TargetVersionHash: targetHash, TargetSnapshot: snapshot,
			InputMapping: mapping, ReplayClass: "retryable", TimeoutMS: 30_000,
		},
		&contractVersionRecord{Contract: contract, Risk: "high", ApprovalMode: "never"},
		actionRunByNameRequest{
			Input:          map[string]interface{}{"account_id": "acct-1", "amount_cents": float64(2500)},
			IdempotencyKey: "business-effect-1",
		},
	)
	require.NoError(t, err)
	definition, err := buildBoundActionExecutionGraphDefinition(run)
	require.NoError(t, err)
	var decoded struct {
		CheckpointAfterSteps     uint32 `json:"checkpoint_after_steps"`
		ContinueAfterCheckpoint  bool   `json:"continue_after_checkpoint"`
	}
	require.NoError(t, json.Unmarshal(definition, &decoded))
	require.Equal(t, uint32(1), decoded.CheckpointAfterSteps)
	require.False(t, decoded.ContinueAfterCheckpoint)
}

func TestHandleActionRunByNameRequiresExactContractBinding(t *testing.T) {
	t.Parallel()
	now := time.Now().UTC()
	contractHash := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	db, driver := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: actionDefinitionColumns(),
			rows: [][]driver.Value{{
				"action-sdk-sync", "tenant-a", "clock3b.consequential_transfer",
				"clock3b.consequential_transfer", "", "embedded_sdk", "", "POST",
				"Safe automation", "retryable", false, false, []byte(`[]`), []byte(`{}`),
				[]byte(`{"enabled": false}`), now, now, nil,
			}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM action_definitions")
				require.Equal(t, "tenant-a", args[0].Value)
				require.Equal(t, "clock3b.consequential_transfer", args[1].Value)
			},
		},
		{
			err: sql.ErrNoRows,
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM action_contract_execution_bindings")
				require.Equal(t, "tenant-a", args[0].Value)
				require.Equal(t, "clock3b.consequential_transfer", args[1].Value)
				require.Equal(t, contractHash, args[2].Value)
			},
		},
	})

	app := actionTestApp()
	app.Post("/v1/actions/:name/run", handleActionRunByName(db, nil))
	body := `{"contract_hash":"` + contractHash + `","idempotency_key":"business-1","input":{"account_id":"acct-1","amount_cents":2500}}`
	req := httptest.NewRequest(http.MethodPost, "/v1/actions/clock3b.consequential_transfer/run", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)
	var decoded map[string]any
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&decoded))
	require.Equal(t, "binding_required", decoded["error"])
	require.Equal(t, 0, driver.remainingQueries())
}

func TestBuildBoundActionRunRequestNilAuthHeadersStillInjectsIdempotencyKey(t *testing.T) {
	contractHash := "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	snapshot, err := json.Marshal(boundTargetSnapshot{
		Name: "clock3b_adapter_target", TargetType: actionTargetWebhook,
		TargetURL: "http://127.0.0.1:18099/v1/clock3b/consequential-transfer",
		Method:    "POST", PolicyPreset: "Safe automation", ReplayClass: "retryable",
		// Auth metadata intentionally absent — headers must still be non-nil.
		TargetMetadata: map[string]interface{}{},
	})
	require.NoError(t, err)
	mapping, err := json.Marshal(map[string]string{"account_id": "account_id"})
	require.NoError(t, err)
	contract, err := json.Marshal(map[string]interface{}{
		"parameter_descriptors": []map[string]interface{}{
			{"name": "account_id", "kind": "POSITIONAL_OR_KEYWORD", "has_default": false, "annotation": "str"},
		},
	})
	require.NoError(t, err)

	run, _, err := buildBoundActionRunRequest(
		&contractExecutionBindingRecord{
			ID: uuid.New(), ActionName: "clock3b.consequential_transfer",
			ContractHash: contractHash, TargetActionID: uuid.New(),
			TargetVersionHash: strings.Repeat("b", 64), TargetSnapshot: snapshot,
			InputMapping: mapping, ReplayClass: "retryable", TimeoutMS: 30_000,
		},
		&contractVersionRecord{Contract: contract, Risk: "high", ApprovalMode: "never"},
		actionRunByNameRequest{
			Input:          map[string]interface{}{"account_id": "acct-1"},
			IdempotencyKey: "business-effect-1",
		},
	)
	require.NoError(t, err)
	headers, ok := run.Input["headers"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, "business-effect-1", headers["Idempotency-Key"])
}
