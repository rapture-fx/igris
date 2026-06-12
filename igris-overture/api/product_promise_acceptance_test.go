package api

// Product-promise acceptance tests.
//
// These tests close the two gaps in the journey-level acceptance map
// (see ops/launch/product_promise_acceptance.md). Everything else in the
// promised journey — REST happy path, MCP call_action shared path, tenant
// isolation, runtime_unavailable, signed runtime callbacks, failure and
// recovery visibility, safe evidence — is proven by the named suites that
// scripts/product_promise_acceptance.sh selects per stage.
//
// Gap 1: idempotent replay was only proven through MCP call_action. The REST
// gateway shares the same submit path, but a refactor could split them; this
// pins the REST surface directly.
//
// Gap 2: the forbidden call_action field list (forbiddenMCPCallActionFields)
// was only exercised for tenant_id and task_definition. An agent must not be
// able to smuggle raw execution material (runtime routing, ciphertext, key
// material, raw bodies) through MCP arguments; this pins every field.

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/middleware"
)

func TestProductPromiseRESTIdempotentReplayReturnsExistingRunWithoutRedispatch(t *testing.T) {
	now := time.Now().UTC()
	var dispatchCount int32
	originalTransport := http.DefaultTransport
	http.DefaultTransport = actionRunRoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		atomic.AddInt32(&dispatchCount, 1)
		return nil, errors.New("unexpected runtime dispatch during idempotent replay")
	})
	t.Cleanup(func() {
		http.DefaultTransport = originalTransport
	})

	const (
		tenantID       = "tenant-a"
		runtimeID      = "runtime-rest-replay"
		idempotencyKey = "rest-replay-idempotency-key"
		secretMarker   = "IGRIS_REST_REPLAY_SECRET_MARKER"
	)
	existingTaskID := uuid.New()
	existingDefinition := json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{
			"kind":"tool",
			"node_id":"safe-action-0",
			"tool_name":"database_write",
			"metadata":{"action_name":"registered_replay_action","policy_preset":"safe_automation"},
			"args":{"body":{
				"input_redacted":true,
				"encrypted_input_ref":true,
				"encrypted_input_ref_id":"44444444-4444-4444-4444-444444444444",
				"purpose":"execution_payload",
				"input_digest_sha256":"abc123",
				"input_bytes":32,
				"key_version":"test:v2",
				"redaction_policy_version":"input-reference-redaction-v1",
				"ciphertext":"` + secretMarker + `",
				"nonce":"nonce-should-not-return",
				"key_material":"key-should-not-return"
			}}
		}]}
	}`)
	checkpoint := &coordinator.CheckpointPayload{
		ResumeToken: coordinator.ResumeToken{LastCommittedStep: 1, CheckpointDigest: "digest-rest-replay-1", RuntimeID: runtimeID},
		Metadata:    json.RawMessage(`{"raw_body":"` + secretMarker + `","ciphertext":"ciphertext-should-not-return"}`),
	}

	db, drv := newQueuedExecRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: actionDefinitionColumns(),
			rows: [][]driver.Value{{
				"action-rest-replay",
				tenantID,
				"registered_replay_action",
				"Registered Replay Action",
				"",
				"mock_demo",
				"",
				"",
				"safe_automation",
				"retryable",
				false,
				false,
				[]byte(`[]`),
				[]byte(`{}`),
				[]byte(`{"enabled": false}`),
				now,
				now,
				nil,
			}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM action_definitions")
				require.Contains(t, query, "WHERE tenant_id = $1 AND id = $2")
				require.Equal(t, tenantID, args[0].Value)
				require.Equal(t, "action-rest-replay", args[1].Value)
			},
		},
		{
			columns: taskRecordColumnsForMCPTest(),
			rows: [][]driver.Value{taskRecordRouteRow(
				existingTaskID, tenantID, coordinator.TaskStatusRecovering, runtimeID, "http://runtime.rest.replay.test",
				existingDefinition, checkpoint, idempotencyKey, nil, nil, nil, now,
			)},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM task_records")
				require.Contains(t, query, "WHERE tenant_id = $1 AND idempotency_key = $2")
				require.Equal(t, tenantID, args[0].Value)
				require.Equal(t, idempotencyKey, args[1].Value)
			},
		},
	},
		queuedRouteExecExpectation{
			rowsAffected: 0,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INSERT INTO task_records")
				require.Contains(t, query, "ON CONFLICT (tenant_id, idempotency_key) DO NOTHING")
				require.Equal(t, tenantID, args[1].Value)
				require.Equal(t, idempotencyKey, args[4].Value)
			},
		},
		queuedRouteExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "SET executed_target = $3")
				require.Equal(t, existingTaskID.String(), driverValueString(args[0].Value))
				require.Equal(t, tenantID, args[1].Value)
				require.Equal(t, actionTargetMockDemo, args[2].Value)
			},
		},
	)

	app := actionTestApp()
	app.Post("/v1/actions/run", handleActionRun(db, coordinator.NewTaskCoordinator(db)))

	body := `{
		"action_id": "action-rest-replay",
		"input": {"ok": true, "message": "replay through REST"},
		"idempotency_key": "` + idempotencyKey + `"
	}`
	req := httptest.NewRequest(http.MethodPost, "/v1/actions/run", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusAccepted, resp.StatusCode)

	respBody := readBody(t, resp)
	var apiResp map[string]interface{}
	require.NoError(t, json.Unmarshal([]byte(respBody), &apiResp))
	require.Equal(t, existingTaskID.String(), apiResp["task_id"], "replay must reuse the existing run, not create a new one")
	require.Equal(t, existingTaskID.String(), apiResp["run_id"])
	require.Equal(t, string(coordinator.TaskStatusRecovering), apiResp["status"])
	require.Equal(t, "registered_replay_action", apiResp["action_name"])

	require.NotContains(t, respBody, secretMarker)
	require.NotContains(t, respBody, "ciphertext")
	require.NotContains(t, respBody, "nonce")
	require.NotContains(t, respBody, "key_material")
	require.NotContains(t, respBody, "key-should-not-return")

	require.Equal(t, int32(0), atomic.LoadInt32(&dispatchCount), "idempotent replay must not redispatch to a runtime")
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestProductPromiseMCPCallActionRejectsRawExecutionOverrideFields(t *testing.T) {
	t.Parallel()

	forbidden := []string{
		"tenant_id", "task_definition", "task_type", "runtime_target", "execution_graph",
		"ciphertext", "nonce", "key_material", "private_key", "raw_body", "request_body",
		"response_body", "runtime_endpoint", "runtime_id",
	}

	for _, field := range forbidden {
		field := field
		t.Run(field, func(t *testing.T) {
			t.Parallel()
			db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
				tenantLookupRowFor("tenant-promise-forbidden", "Tenant Promise", "promise@example.test"),
			})
			app := fiber.New()
			h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
			app.Use(middleware.BetterAuth(db))
			app.Post("/v1/mcp", h.handle)

			params := fmt.Sprintf(`{
				"name":"call_action",
				"arguments":{
					"action_id":"act-promise",
					"input":{"ok":true},
					%q:"forbidden-value-must-not-pass"
				}
			}`, field)
			resp := mcpPost(t, app, fmt.Sprintf(`{"jsonrpc":"2.0","id":"forbidden-%s","method":"tools/call","params":%s}`, field, params))
			require.Equal(t, http.StatusBadRequest, resp.StatusCode)
			body := readBody(t, resp)
			require.Contains(t, body, `"message":"validation_error"`)
			require.Contains(t, body, "unsupported call_action field")
			require.NotContains(t, body, "forbidden-value-must-not-pass")

			require.Zero(t, drv.remainingQueries(), "validation must reject before any action lookup")
			require.Zero(t, drv.remainingExecs(), "validation must reject before any task write")
		})
	}
}
