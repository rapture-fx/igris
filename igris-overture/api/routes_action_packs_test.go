package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/actionpack"
)

func TestHandleActionPackListReturnsStarter(t *testing.T) {
	t.Parallel()
	app := actionTestApp()
	app.Get("/v1/action-packs", handleActionPackList())

	req := httptest.NewRequest(http.MethodGet, "/v1/action-packs", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	packs := body["packs"].([]interface{})
	require.NotEmpty(t, packs)
	first := packs[0].(map[string]interface{})
	require.Equal(t, "starter", first["name"])
}

func TestHandleActionPackInstallCreatesRegisteredActions(t *testing.T) {
	t.Parallel()
	db, driver := newQueuedRouteDB(t, nil,
		queuedRouteExecExpectation{rowsAffected: 1},
		queuedRouteExecExpectation{rowsAffected: 1},
		queuedRouteExecExpectation{rowsAffected: 1},
	)
	app := actionTestApp()
	app.Post("/v1/action-packs/:name/install", handleActionPackInstall(db))

	req := httptest.NewRequest(http.MethodPost, "/v1/action-packs/starter/install", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	require.Equal(t, 0, driver.remainingExecs())

	var body map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	created := body["created"].([]interface{})
	require.Len(t, created, 3)
}

func TestHandleActionPackInstallRejectsSmuggledManifestFields(t *testing.T) {
	t.Parallel()
	pack := actionpack.StarterPack()
	pack.Actions[0].TargetMetadata["runtime_endpoint"] = "http://evil.example"
	err := actionpack.ValidateManifest(pack)
	require.Error(t, err)
}

func TestMockDemoFailOnceFirstAttemptDetectsStarterAction(t *testing.T) {
	t.Parallel()
	def := &actionDefinition{
		TargetType: "mock_demo",
		TargetMetadata: map[string]interface{}{
			"demo_variant": "fail_once",
		},
	}
	require.True(t, mockDemoFailOnceFirstAttempt(def, actionRunRequest{
		Input: map[string]interface{}{"message": "x"},
	}))
	require.False(t, mockDemoFailOnceFirstAttempt(def, actionRunRequest{
		Input: map[string]interface{}{"message": "x", "retry": true},
	}))
}

func TestBuildActionRunRequestFromDefinitionFailOnceSetsDemoBehavior(t *testing.T) {
	t.Parallel()
	req, err := buildActionRunRequestFromDefinition(actionDefinition{
		ID:           "action-fail-once",
		Name:         "demo.fail_once",
		TargetType:   "mock_demo",
		TargetMetadata: map[string]interface{}{"demo_variant": "fail_once"},
		PolicyPreset: "Safe automation",
		ReplayClass:  "retryable",
	}, actionRunByNameRequest{Input: map[string]interface{}{"message": "fail"}})
	require.NoError(t, err)
	record := req.Input["record"].(map[string]interface{})
	require.Equal(t, "fail_once", record["demo_variant"])
	require.Contains(t, record["demo_behavior"], "simulated failure")
}