package api

import (
	"crypto/ed25519"
	"database/sql"
	"database/sql/driver"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

type mcpRoundTripperFunc func(*http.Request) (*http.Response, error)

func (fn mcpRoundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func TestMCPListActionsIsTenantScoped(t *testing.T) {
	t.Parallel()

	const tenantA = "tenant-mcp-actions"
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantA, "Tenant A", "a@example.test"),
		{
			columns: scannerColumns,
			rows: [][]driver.Value{{
				"act-1", tenantA, "safe_ping", "Safe Ping", "health check",
				"hosted_api", "https://internal.example.local/ping", "POST",
				"Read-only", "read_only", false, false,
				[]byte(`["secret/ref"]`), []byte(`{"runtime_id":"runtime-secret","hostname":"host.local"}`), []byte(`{"enabled":false}`),
				now, now, nil,
			}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "WHERE tenant_id = $1")
				require.Equal(t, tenantA, args[0].Value)
			},
		},
	})

	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	resp := mcpPost(t, app, `{"jsonrpc":"2.0","id":1,"method":"list_actions","params":{}}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := readBody(t, resp)
	require.Contains(t, body, "safe_ping")
	require.NotContains(t, body, "secret/ref")
	require.NotContains(t, body, "internal.example.local")
	require.NotContains(t, body, "runtime-secret")
	require.Zero(t, drv.remainingQueries())
}

func TestMCPGetActionRedactsUnsafeFields(t *testing.T) {
	t.Parallel()

	const tenantA = "tenant-mcp-get-action"
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantA, "Tenant A", "a@example.test"),
		{
			columns: scannerColumns,
			rows: [][]driver.Value{{
				"act-secret", tenantA, "create_ticket", "Create Ticket", "opens a ticket",
				"webhook", "http://10.1.2.3:8080/hook?token=secret", "POST",
				"Approval required", "non_retryable", true, true,
				[]byte(`["vault/token"]`), []byte(`{"runtime_key":"rk_secret","ip_address":"10.1.2.3"}`), []byte(`{"enabled":false}`),
				now, now, nil,
			}},
		},
	})

	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	resp := mcpPost(t, app, `{"jsonrpc":"2.0","id":2,"method":"get_action","params":{"action_id":"act-secret"}}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := readBody(t, resp)
	require.Contains(t, body, "create_ticket")
	require.Contains(t, body, "endpoint_configured")
	require.NotContains(t, body, "10.1.2.3")
	require.NotContains(t, body, "token=secret")
	require.NotContains(t, body, "vault/token")
	require.NotContains(t, body, "rk_secret")
	require.Zero(t, drv.remainingQueries())
}

func TestMCPToolsListReturnsStrictSchemas(t *testing.T) {
	t.Parallel()

	const tenantA = "tenant-mcp-schema"
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantA, "Tenant A", "a@example.test"),
	})
	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	resp := mcpPost(t, app, `{"jsonrpc":"2.0","id":"schemas","method":"tools/list","params":{}}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := readBody(t, resp)

	var envelope struct {
		Result struct {
			Tools []struct {
				Name        string                 `json:"name"`
				InputSchema map[string]interface{} `json:"inputSchema"`
			} `json:"tools"`
		} `json:"result"`
	}
	require.NoError(t, json.Unmarshal([]byte(body), &envelope))
	require.Len(t, envelope.Result.Tools, 7)
	seen := map[string]bool{}
	for _, tool := range envelope.Result.Tools {
		seen[tool.Name] = true
		schema := tool.InputSchema
		require.Equal(t, "object", schema["type"], tool.Name)
		require.Equal(t, "2026-06-06", schema["schema_version"], tool.Name)
		require.Contains(t, schema, "properties", tool.Name)
		require.Contains(t, schema, "required", tool.Name)
		require.Equal(t, false, schema["additionalProperties"], tool.Name)
		props := schema["properties"].(map[string]interface{})
		require.Contains(t, props, "schema_version", tool.Name)
	}
	for _, name := range []string{"list_actions", "get_action", "call_action", "list_runs", "get_run", "get_run_evidence", "list_runtimes"} {
		require.True(t, seen[name], name)
	}
	var callSchema map[string]interface{}
	for _, tool := range envelope.Result.Tools {
		if tool.Name == "call_action" {
			callSchema = tool.InputSchema
			break
		}
	}
	require.NotNil(t, callSchema)
	callProps := callSchema["properties"].(map[string]interface{})
	for _, forbidden := range []string{"task_definition", "task_type", "runtime_target", "execution_graph", "tenant_id", "ciphertext", "nonce", "key_material"} {
		require.NotContains(t, callProps, forbidden)
	}
	require.Zero(t, drv.remainingQueries())
}

func TestMCPSafeRunResponsesDoNotExposeHistoricalCheckpointPayloads(t *testing.T) {
	t.Parallel()

	marker := "IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET"
	task := &coordinator.TaskRecord{
		TaskID:         uuid.New(),
		Status:         coordinator.TaskStatusCompleted,
		CreatedAt:      time.Now().UTC(),
		TaskDefinition: json.RawMessage(`{"type":"agent_workflow","steps":[{"model":"m","messages":[{"role":"user","content":"hi"}]}]}`),
		LastCheckpoint: &coordinator.CheckpointPayload{
			ResumeToken: coordinator.ResumeToken{LastCommittedStep: 1, CheckpointDigest: "digest-1", RuntimeID: "runtime-1"},
			Metadata: json.RawMessage(`{
				"graph_blackboard": {
					"nodes": {
						"tool-1": {
							"content": "IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET",
							"raw_body": "IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET",
							"authorization": "Bearer IGRIS_SHOULD_NEVER_PERSIST_THIS_SECRET"
						}
					}
				}
			}`),
		},
	}

	detail := safeMCPRunDetail(task)
	evidence := safeMCPRunEvidence(task, []coordinator.WalEntry{{
		EntryID:     uuid.New(),
		StepIndex:   1,
		Status:      "committed",
		InputDigest: "input-digest",
	}})
	encoded, err := json.Marshal(fiber.Map{"detail": detail, "evidence": evidence})
	require.NoError(t, err)
	require.NotContains(t, string(encoded), marker)
	require.NotContains(t, string(encoded), "raw_body")
	require.Contains(t, string(encoded), "input-digest")
}

func TestMCPCallActionUsesExistingActionRunPath(t *testing.T) {
	t.Parallel()

	const tenantA = "tenant-mcp-call-action"
	now := time.Now().UTC()
	taskID := uuid.New()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantA, "Tenant A", "a@example.test"),
		{
			columns: scannerColumns,
			rows: [][]driver.Value{{
				"act-1", tenantA, "demo_action", "Demo", "safe demo",
				"mock_demo", "", "",
				"Safe automation", "retryable", false, false,
				[]byte(`[]`), []byte(`{}`), []byte(`{"enabled":false}`),
				now, now, nil,
			}},
		},
	})

	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	var sawCompiledRun bool
	h.submitAction = func(_ *fiber.Ctx, tenantID string, def actionDefinition, req actionRunByNameRequest) (fiber.Map, int, error) {
		require.Equal(t, tenantA, tenantID)
		runReq, err := buildActionRunRequestFromDefinition(def, req)
		require.NoError(t, err)
		taskReq, err := buildActionTaskSubmitRequest(runReq, tenantID)
		require.NoError(t, err)
		require.Equal(t, "execution_graph", taskReq.TaskType)
		sawCompiledRun = true
		return fiber.Map{
			"task_id":     taskID.String(),
			"run_id":      taskID.String(),
			"status":      "dispatched",
			"created_at":  now,
			"inspect_url": "/v1/tasks/" + taskID.String(),
		}, http.StatusAccepted, nil
	}
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	resp := mcpPost(t, app, `{"jsonrpc":"2.0","id":3,"method":"call_action","params":{"action_id":"act-1","input":{"ok":true}}}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	require.True(t, sawCompiledRun, "call_action must compile through the existing action run builders")
	require.Contains(t, readBody(t, resp), taskID.String())
	require.Zero(t, drv.remainingQueries())
}

func TestMCPCallActionRegisteredActionDispatchesToFakeRuntime(t *testing.T) {
	now := time.Now().UTC()
	_, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY", hex.EncodeToString(privateKey))
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY_VERSION", "mcp-route-runtime-test")

	type capturedDispatch struct {
		method       string
		path         string
		tenantHeader string
		body         map[string]interface{}
		rawBody      string
	}
	dispatches := make(chan capturedDispatch, 1)
	var dispatchCount int32
	originalTransport := http.DefaultTransport
	http.DefaultTransport = mcpRoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		atomic.AddInt32(&dispatchCount, 1)
		raw, readErr := io.ReadAll(req.Body)
		if readErr != nil {
			return &http.Response{
				StatusCode: http.StatusInternalServerError,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"error":"read_failed"}`)),
				Request:    req,
			}, nil
		}
		var payload map[string]interface{}
		if err := json.Unmarshal(raw, &payload); err != nil {
			return &http.Response{
				StatusCode: http.StatusBadRequest,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"error":"bad_json"}`)),
				Request:    req,
			}, nil
		}
		dispatches <- capturedDispatch{
			method:       req.Method,
			path:         req.URL.Path,
			tenantHeader: req.Header.Get("X-Igris-Tenant"),
			body:         payload,
			rawBody:      string(raw),
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{}`)),
			Request:    req,
		}, nil
	})
	t.Cleanup(func() {
		http.DefaultTransport = originalTransport
	})

	const (
		tenantA         = "tenant-mcp-dispatch"
		runtimeID       = "runtime-mcp-fake"
		runtimeEndpoint = "http://runtime.mcp.test"
	)
	var createdTaskID uuid.UUID
	var persistedDefinition map[string]interface{}
	var permissionAuditWrites int32
	var capabilityAuditWrites int32
	var stampWrites int32
	checkAuditOrStampExec := func(query string, args []driver.NamedValue) {
		switch {
		case strings.Contains(query, "INSERT INTO ai_task_permission_audit"):
			atomic.AddInt32(&permissionAuditWrites, 1)
			require.Equal(t, createdTaskID.String(), driverValueString(args[1].Value))
			require.Equal(t, tenantA, args[2].Value)
		case strings.Contains(query, "INSERT INTO ai_capability_decision_audit"):
			atomic.AddInt32(&capabilityAuditWrites, 1)
			require.Equal(t, createdTaskID.String(), driverValueString(args[1].Value))
			require.Equal(t, tenantA, args[2].Value)
			require.Equal(t, runtimeID, args[3].Value)
			require.Equal(t, "tools.database_write", args[4].Value)
		case strings.Contains(query, "SET executed_target = $3"):
			atomic.AddInt32(&stampWrites, 1)
			require.Equal(t, createdTaskID.String(), driverValueString(args[0].Value))
			require.Equal(t, tenantA, args[1].Value)
			require.Equal(t, actionTargetMockDemo, args[2].Value)
		default:
			require.Failf(t, "unexpected exec", "query: %s", query)
		}
	}
	db, drv := newQueuedExecRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantA, "Tenant MCP", "mcp@example.test"),
		{
			columns: actionDefinitionColumns(),
			rows: [][]driver.Value{{
				"act-mcp-dispatch",
				tenantA,
				"registered_mcp_action",
				"Registered MCP Action",
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
				require.Equal(t, tenantA, args[0].Value)
				require.Equal(t, "act-mcp-dispatch", args[1].Value)
			},
		},
		{
			columns: []string{"runtime_id", "endpoint"},
			rows:    [][]driver.Value{{runtimeID, runtimeEndpoint}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM runtime_instances")
				require.Contains(t, query, "WHERE ri.tenant_id = $1")
				require.Equal(t, tenantA, args[0].Value)
			},
		},
		{
			columns: []string{"policy"},
			rows: [][]driver.Value{{
				[]byte(`{"policy_version":"capabilities.mcp-route-test","allowed_capabilities":["tools.database_write"]}`),
			}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "ai_capability_policy_settings")
				require.Equal(t, tenantA, args[0].Value)
			},
		},
	},
		queuedRouteExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INSERT INTO task_records")
				require.Equal(t, tenantA, args[1].Value)
				require.Equal(t, string(coordinator.TaskStatusPending), args[2].Value)
				require.Equal(t, "mcp-idempotency-1", args[4].Value)

				createdTaskID = requireDriverUUID(t, args[0].Value)
				defBytes := requireDriverBytes(t, args[3].Value)
				require.NoError(t, json.Unmarshal(defBytes, &persistedDefinition))
			},
		},
		queuedRouteExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "UPDATE task_records")
				require.Contains(t, query, "runtime_id = $2")
				require.Equal(t, string(coordinator.TaskStatusDispatched), args[0].Value)
				require.Equal(t, runtimeID, args[1].Value)
				require.Equal(t, runtimeEndpoint, args[2].Value)
				require.Equal(t, createdTaskID.String(), driverValueString(args[4].Value))
			},
		},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec},
	)

	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	resp := mcpPost(t, app, `{
		"jsonrpc":"2.0",
		"id":"mcp-dispatch-1",
		"method":"tools/call",
		"params":{
			"name":"call_action",
			"arguments":{
				"action_id":"act-mcp-dispatch",
				"input":{"ok":true,"message":"mcp route-to-runtime"},
				"metadata":{"agent_id":"agent-mcp-route","user_id":"user-mcp-route"},
				"idempotency_key":"mcp-idempotency-1"
			}
		}
	}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := readBody(t, resp)
	require.Contains(t, body, `"jsonrpc":"2.0"`)
	require.Contains(t, body, createdTaskID.String())
	require.Contains(t, body, `"registered_mcp_action"`)
	require.NotContains(t, body, runtimeEndpoint)

	require.Equal(t, "execution_graph", persistedDefinition["type"])
	require.Equal(t, []interface{}{"tools.database_write"}, persistedDefinition["required_capabilities"])

	var captured capturedDispatch
	select {
	case captured = <-dispatches:
	case <-time.After(2 * time.Second):
		t.Fatal("fake runtime did not receive dispatch")
	}
	require.Equal(t, int32(1), atomic.LoadInt32(&dispatchCount))
	require.Equal(t, http.MethodPost, captured.method)
	require.Equal(t, "/v1/runtime/task/submit", captured.path)
	require.Equal(t, tenantA, captured.tenantHeader)
	require.Equal(t, createdTaskID.String(), captured.body["task_id"])
	require.Equal(t, tenantA, captured.body["tenant_id"])
	require.Equal(t, "mcp-idempotency-1", captured.body["idempotency_key"])

	taskType, ok := captured.body["task_type"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, "execution_graph", taskType["type"])
	graph, ok := taskType["graph"].(map[string]interface{})
	require.True(t, ok)
	nodes, ok := graph["nodes"].([]interface{})
	require.True(t, ok)
	require.Len(t, nodes, 1)
	node, ok := nodes[0].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, "tool", node["kind"])
	require.Equal(t, "database_write", node["tool_name"])
	nodeArgs, ok := node["args"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, "action_task_mock_demo", nodeArgs["table"])
	record, ok := nodeArgs["record"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, "registered_mcp_action", record["action"])
	require.Equal(t, "act-mcp-dispatch", record["action_definition_id"])
	require.Equal(t, true, record["created_by_gateway"])
	requestedInput, ok := record["requested_input"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, true, requestedInput["ok"])
	require.Equal(t, "mcp route-to-runtime", requestedInput["message"])

	require.Equal(t, int32(2), atomic.LoadInt32(&permissionAuditWrites))
	require.Equal(t, int32(2), atomic.LoadInt32(&capabilityAuditWrites))
	require.Equal(t, int32(1), atomic.LoadInt32(&stampWrites))
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestMCPCallActionSameTenantIdempotencyIgnoresBodyTenantOverrideAndDoesNotDoubleDispatch(t *testing.T) {
	now := time.Now().UTC()
	_, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY", hex.EncodeToString(privateKey))
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY_VERSION", "mcp-idempotency-test")

	type capturedDispatch struct {
		tenantHeader string
		body         map[string]interface{}
		rawBody      string
	}
	dispatches := make(chan capturedDispatch, 1)
	var dispatchCount int32
	originalTransport := http.DefaultTransport
	http.DefaultTransport = mcpRoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		atomic.AddInt32(&dispatchCount, 1)
		raw, readErr := io.ReadAll(req.Body)
		if readErr != nil {
			return &http.Response{
				StatusCode: http.StatusInternalServerError,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"error":"read_failed"}`)),
				Request:    req,
			}, nil
		}
		var payload map[string]interface{}
		if err := json.Unmarshal(raw, &payload); err != nil {
			return &http.Response{
				StatusCode: http.StatusBadRequest,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"error":"bad_json"}`)),
				Request:    req,
			}, nil
		}
		dispatches <- capturedDispatch{
			tenantHeader: req.Header.Get("X-Igris-Tenant"),
			body:         payload,
			rawBody:      string(raw),
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{}`)),
			Request:    req,
		}, nil
	})
	t.Cleanup(func() {
		http.DefaultTransport = originalTransport
	})

	const (
		tenantA         = "tenant-mcp-idem-a"
		runtimeID       = "runtime-mcp-idem-a"
		runtimeEndpoint = "http://runtime.mcp.idem-a.test"
		idempotencyKey  = "same-mcp-idempotency-key"
	)
	var createdTaskID uuid.UUID
	var persistedDefinition json.RawMessage
	var permissionAuditWrites int32
	var capabilityAuditWrites int32
	var stampWrites int32
	checkAuditOrStampExec := func(query string, args []driver.NamedValue) {
		switch {
		case strings.Contains(query, "INSERT INTO ai_task_permission_audit"):
			atomic.AddInt32(&permissionAuditWrites, 1)
			require.Equal(t, createdTaskID.String(), driverValueString(args[1].Value))
			require.Equal(t, tenantA, args[2].Value)
		case strings.Contains(query, "INSERT INTO ai_capability_decision_audit"):
			atomic.AddInt32(&capabilityAuditWrites, 1)
			require.Equal(t, createdTaskID.String(), driverValueString(args[1].Value))
			require.Equal(t, tenantA, args[2].Value)
			require.Equal(t, runtimeID, args[3].Value)
		case strings.Contains(query, "SET executed_target = $3"):
			atomic.AddInt32(&stampWrites, 1)
			require.Equal(t, createdTaskID.String(), driverValueString(args[0].Value))
			require.Equal(t, tenantA, args[1].Value)
			require.Equal(t, actionTargetMockDemo, args[2].Value)
		default:
			require.Failf(t, "unexpected exec", "query: %s", query)
		}
	}
	db, drv := newQueuedExecRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantA, "Tenant A", "a@example.test"),
		mcpActionDefinitionQuery(t, tenantA, "act-mcp-idem-a", "registered_mcp_idem_action", now),
		mcpRuntimeSelectionQuery(t, tenantA, runtimeID, runtimeEndpoint),
		mcpCapabilityPolicyQuery(t, tenantA),
		tenantLookupRowFor(tenantA, "Tenant A", "a@example.test"),
		mcpActionDefinitionQuery(t, tenantA, "act-mcp-idem-a", "registered_mcp_idem_action", now),
		{
			columns: taskRecordColumnsForMCPTest(),
			rowsFunc: func() [][]driver.Value {
				require.NotEqual(t, uuid.Nil, createdTaskID)
				require.NotEmpty(t, persistedDefinition)
				return [][]driver.Value{taskRecordRouteRow(
					createdTaskID, tenantA, coordinator.TaskStatusDispatched, runtimeID, runtimeEndpoint,
					persistedDefinition, nil, idempotencyKey, nil, nil, nil, now,
				)}
			},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM task_records")
				require.Contains(t, query, "WHERE tenant_id = $1 AND idempotency_key = $2")
				require.Equal(t, tenantA, args[0].Value)
				require.Equal(t, idempotencyKey, args[1].Value)
			},
		},
	},
		queuedRouteExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INSERT INTO task_records")
				require.Contains(t, query, "ON CONFLICT (tenant_id, idempotency_key) DO NOTHING")
				require.Equal(t, tenantA, args[1].Value)
				require.Equal(t, string(coordinator.TaskStatusPending), args[2].Value)
				require.Equal(t, idempotencyKey, args[4].Value)
				createdTaskID = requireDriverUUID(t, args[0].Value)
				persistedDefinition = append(persistedDefinition[:0], requireDriverBytes(t, args[3].Value)...)
				require.NotContains(t, string(persistedDefinition), "tenant-b")
			},
		},
		queuedRouteExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "UPDATE task_records")
				require.Equal(t, string(coordinator.TaskStatusDispatched), args[0].Value)
				require.Equal(t, runtimeID, args[1].Value)
				require.Equal(t, runtimeEndpoint, args[2].Value)
				require.Equal(t, createdTaskID.String(), driverValueString(args[4].Value))
			},
		},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec},
		queuedRouteExecExpectation{
			rowsAffected: 0,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INSERT INTO task_records")
				require.Contains(t, query, "ON CONFLICT (tenant_id, idempotency_key) DO NOTHING")
				require.Equal(t, tenantA, args[1].Value)
				require.Equal(t, idempotencyKey, args[4].Value)
			},
		},
	)

	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	firstResp := mcpPost(t, app, mcpCallActionBody("mcp-idem-1", "act-mcp-idem-a", idempotencyKey, "first idempotent call", "tenant-b"))
	require.Equal(t, http.StatusOK, firstResp.StatusCode)
	firstBody := readBody(t, firstResp)
	firstTaskID := mcpTaskIDFromBody(t, firstBody)
	require.Equal(t, createdTaskID.String(), firstTaskID)
	require.NotContains(t, firstBody, "tenant-b")

	var firstDispatch capturedDispatch
	select {
	case firstDispatch = <-dispatches:
	case <-time.After(2 * time.Second):
		t.Fatal("fake runtime did not receive first dispatch")
	}
	require.Equal(t, tenantA, firstDispatch.tenantHeader)
	require.Equal(t, tenantA, firstDispatch.body["tenant_id"])
	require.Equal(t, createdTaskID.String(), firstDispatch.body["task_id"])
	require.Equal(t, idempotencyKey, firstDispatch.body["idempotency_key"])
	require.NotContains(t, firstDispatch.rawBody, "tenant-b")
	require.Equal(t, int32(1), atomic.LoadInt32(&dispatchCount))

	secondResp := mcpPost(t, app, mcpCallActionBody("mcp-idem-2", "act-mcp-idem-a", idempotencyKey, "duplicate idempotent call", "tenant-b"))
	require.Equal(t, http.StatusOK, secondResp.StatusCode)
	secondBody := readBody(t, secondResp)
	require.Equal(t, firstTaskID, mcpTaskIDFromBody(t, secondBody))
	require.NotContains(t, secondBody, "tenant-b")
	require.Equal(t, int32(1), atomic.LoadInt32(&dispatchCount))
	select {
	case extra := <-dispatches:
		t.Fatalf("unexpected duplicate dispatch for tenant %s task %v", extra.tenantHeader, extra.body["task_id"])
	default:
	}

	require.Equal(t, int32(2), atomic.LoadInt32(&permissionAuditWrites))
	require.Equal(t, int32(2), atomic.LoadInt32(&capabilityAuditWrites))
	require.Equal(t, int32(1), atomic.LoadInt32(&stampWrites))
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestMCPCallActionCrossTenantSameIdempotencyKeyIsIsolated(t *testing.T) {
	now := time.Now().UTC()
	_, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY", hex.EncodeToString(privateKey))
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY_VERSION", "mcp-cross-tenant-idempotency-test")

	type capturedDispatch struct {
		tenantHeader string
		body         map[string]interface{}
		rawBody      string
	}
	dispatches := make(chan capturedDispatch, 2)
	var dispatchCount int32
	originalTransport := http.DefaultTransport
	http.DefaultTransport = mcpRoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		atomic.AddInt32(&dispatchCount, 1)
		raw, readErr := io.ReadAll(req.Body)
		if readErr != nil {
			return &http.Response{
				StatusCode: http.StatusInternalServerError,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"error":"read_failed"}`)),
				Request:    req,
			}, nil
		}
		var payload map[string]interface{}
		if err := json.Unmarshal(raw, &payload); err != nil {
			return &http.Response{
				StatusCode: http.StatusBadRequest,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"error":"bad_json"}`)),
				Request:    req,
			}, nil
		}
		dispatches <- capturedDispatch{
			tenantHeader: req.Header.Get("X-Igris-Tenant"),
			body:         payload,
			rawBody:      string(raw),
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{}`)),
			Request:    req,
		}, nil
	})
	t.Cleanup(func() {
		http.DefaultTransport = originalTransport
	})

	const (
		tenantA        = "tenant-mcp-cross-idem-a"
		tenantB        = "tenant-mcp-cross-idem-b"
		runtimeA       = "runtime-mcp-cross-a"
		runtimeB       = "runtime-mcp-cross-b"
		endpointA      = "http://runtime.mcp.cross-a.test"
		endpointB      = "http://runtime.mcp.cross-b.test"
		idempotencyKey = "shared-cross-tenant-idempotency-key"
	)
	var taskA uuid.UUID
	var taskB uuid.UUID
	var permissionAuditWrites int32
	var capabilityAuditWrites int32
	var stampWrites int32
	checkAuditOrStampExec := func(expectedTenant, expectedRuntime string, taskID *uuid.UUID) func(string, []driver.NamedValue) {
		return func(query string, args []driver.NamedValue) {
			switch {
			case strings.Contains(query, "INSERT INTO ai_task_permission_audit"):
				atomic.AddInt32(&permissionAuditWrites, 1)
				require.Equal(t, taskID.String(), driverValueString(args[1].Value))
				require.Equal(t, expectedTenant, args[2].Value)
			case strings.Contains(query, "INSERT INTO ai_capability_decision_audit"):
				atomic.AddInt32(&capabilityAuditWrites, 1)
				require.Equal(t, taskID.String(), driverValueString(args[1].Value))
				require.Equal(t, expectedTenant, args[2].Value)
				require.Equal(t, expectedRuntime, args[3].Value)
			case strings.Contains(query, "SET executed_target = $3"):
				atomic.AddInt32(&stampWrites, 1)
				require.Equal(t, taskID.String(), driverValueString(args[0].Value))
				require.Equal(t, expectedTenant, args[1].Value)
				require.Equal(t, actionTargetMockDemo, args[2].Value)
			default:
				require.Failf(t, "unexpected exec", "query: %s", query)
			}
		}
	}
	db, drv := newQueuedExecRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantA, "Tenant A", "a@example.test"),
		mcpActionDefinitionQuery(t, tenantA, "act-mcp-cross-a", "registered_cross_tenant_a", now),
		mcpRuntimeSelectionQuery(t, tenantA, runtimeA, endpointA),
		mcpCapabilityPolicyQuery(t, tenantA),
		tenantLookupRowFor(tenantB, "Tenant B", "b@example.test"),
		mcpActionDefinitionQuery(t, tenantB, "act-mcp-cross-b", "registered_cross_tenant_b", now),
		mcpRuntimeSelectionQuery(t, tenantB, runtimeB, endpointB),
		mcpCapabilityPolicyQuery(t, tenantB),
	},
		queuedRouteExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INSERT INTO task_records")
				require.Contains(t, query, "ON CONFLICT (tenant_id, idempotency_key) DO NOTHING")
				require.Equal(t, tenantA, args[1].Value)
				require.Equal(t, idempotencyKey, args[4].Value)
				taskA = requireDriverUUID(t, args[0].Value)
			},
		},
		queuedRouteExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "UPDATE task_records")
				require.Equal(t, string(coordinator.TaskStatusDispatched), args[0].Value)
				require.Equal(t, runtimeA, args[1].Value)
				require.Equal(t, endpointA, args[2].Value)
				require.Equal(t, taskA.String(), driverValueString(args[4].Value))
			},
		},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec(tenantA, runtimeA, &taskA)},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec(tenantA, runtimeA, &taskA)},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec(tenantA, runtimeA, &taskA)},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec(tenantA, runtimeA, &taskA)},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec(tenantA, runtimeA, &taskA)},
		queuedRouteExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INSERT INTO task_records")
				require.Contains(t, query, "ON CONFLICT (tenant_id, idempotency_key) DO NOTHING")
				require.Equal(t, tenantB, args[1].Value)
				require.Equal(t, idempotencyKey, args[4].Value)
				taskB = requireDriverUUID(t, args[0].Value)
				require.NotEqual(t, taskA, taskB)
			},
		},
		queuedRouteExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "UPDATE task_records")
				require.Equal(t, string(coordinator.TaskStatusDispatched), args[0].Value)
				require.Equal(t, runtimeB, args[1].Value)
				require.Equal(t, endpointB, args[2].Value)
				require.Equal(t, taskB.String(), driverValueString(args[4].Value))
			},
		},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec(tenantB, runtimeB, &taskB)},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec(tenantB, runtimeB, &taskB)},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec(tenantB, runtimeB, &taskB)},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec(tenantB, runtimeB, &taskB)},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec(tenantB, runtimeB, &taskB)},
	)

	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	respA := mcpPost(t, app, mcpCallActionBody("mcp-cross-a", "act-mcp-cross-a", idempotencyKey, "tenant a call", ""))
	require.Equal(t, http.StatusOK, respA.StatusCode)
	bodyA := readBody(t, respA)
	require.Equal(t, taskA.String(), mcpTaskIDFromBody(t, bodyA))
	require.Contains(t, bodyA, "registered_cross_tenant_a")
	require.NotContains(t, bodyA, "registered_cross_tenant_b")
	var dispatchA capturedDispatch
	select {
	case dispatchA = <-dispatches:
	case <-time.After(2 * time.Second):
		t.Fatal("fake runtime did not receive tenant A dispatch")
	}
	require.Equal(t, tenantA, dispatchA.tenantHeader)
	require.Equal(t, tenantA, dispatchA.body["tenant_id"])
	require.Equal(t, taskA.String(), dispatchA.body["task_id"])
	require.Equal(t, idempotencyKey, dispatchA.body["idempotency_key"])
	require.NotContains(t, dispatchA.rawBody, tenantB)

	respB := mcpPost(t, app, mcpCallActionBody("mcp-cross-b", "act-mcp-cross-b", idempotencyKey, "tenant b call", ""))
	require.Equal(t, http.StatusOK, respB.StatusCode)
	bodyB := readBody(t, respB)
	require.Equal(t, taskB.String(), mcpTaskIDFromBody(t, bodyB))
	require.NotEqual(t, mcpTaskIDFromBody(t, bodyA), mcpTaskIDFromBody(t, bodyB))
	require.Contains(t, bodyB, "registered_cross_tenant_b")
	require.NotContains(t, bodyB, "registered_cross_tenant_a")
	var dispatchB capturedDispatch
	select {
	case dispatchB = <-dispatches:
	case <-time.After(2 * time.Second):
		t.Fatal("fake runtime did not receive tenant B dispatch")
	}
	require.Equal(t, tenantB, dispatchB.tenantHeader)
	require.Equal(t, tenantB, dispatchB.body["tenant_id"])
	require.Equal(t, taskB.String(), dispatchB.body["task_id"])
	require.Equal(t, idempotencyKey, dispatchB.body["idempotency_key"])
	require.NotContains(t, dispatchB.rawBody, tenantA)

	require.Equal(t, int32(2), atomic.LoadInt32(&dispatchCount))
	require.Equal(t, int32(4), atomic.LoadInt32(&permissionAuditWrites))
	require.Equal(t, int32(4), atomic.LoadInt32(&capabilityAuditWrites))
	require.Equal(t, int32(2), atomic.LoadInt32(&stampWrites))
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestMCPCallActionIdempotentReplayReturnsExistingRecoveringTaskWithoutRedispatch(t *testing.T) {
	now := time.Now().UTC()
	var dispatchCount int32
	originalTransport := http.DefaultTransport
	http.DefaultTransport = mcpRoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		atomic.AddInt32(&dispatchCount, 1)
		return nil, errors.New("unexpected runtime dispatch during idempotent replay")
	})
	t.Cleanup(func() {
		http.DefaultTransport = originalTransport
	})

	const (
		tenantA         = "tenant-mcp-replay-a"
		runtimeID       = "runtime-mcp-replay-a"
		runtimeEndpoint = "http://runtime.mcp.replay-a.test"
		idempotencyKey  = "mcp-replay-idempotency-key"
		secretMarker    = "IGRIS_MCP_RECOVERY_REPLAY_SECRET_MARKER"
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
				"encrypted_input_ref_id":"33333333-3333-3333-3333-333333333333",
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
		ResumeToken: coordinator.ResumeToken{LastCommittedStep: 1, CheckpointDigest: "digest-replay-1", RuntimeID: runtimeID},
		Metadata:    json.RawMessage(`{"raw_body":"` + secretMarker + `","ciphertext":"ciphertext-should-not-return","nonce":"nonce-should-not-return"}`),
	}
	db, drv := newQueuedExecRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantA, "Tenant A", "a@example.test"),
		mcpActionDefinitionQuery(t, tenantA, "act-mcp-replay", "registered_replay_action", now),
		{
			columns: taskRecordColumnsForMCPTest(),
			rows: [][]driver.Value{taskRecordRouteRow(
				existingTaskID, tenantA, coordinator.TaskStatusRecovering, runtimeID, runtimeEndpoint,
				existingDefinition, checkpoint, idempotencyKey, nil, nil, nil, now,
			)},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM task_records")
				require.Contains(t, query, "WHERE tenant_id = $1 AND idempotency_key = $2")
				require.Equal(t, tenantA, args[0].Value)
				require.Equal(t, idempotencyKey, args[1].Value)
			},
		},
	},
		queuedRouteExecExpectation{
			rowsAffected: 0,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INSERT INTO task_records")
				require.Contains(t, query, "ON CONFLICT (tenant_id, idempotency_key) DO NOTHING")
				require.Equal(t, tenantA, args[1].Value)
				require.Equal(t, idempotencyKey, args[4].Value)
			},
		},
	)

	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	resp := mcpPost(t, app, mcpCallActionBody("mcp-replay", "act-mcp-replay", idempotencyKey, "replay call", "tenant-b"))
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := readBody(t, resp)
	require.Contains(t, body, `"jsonrpc":"2.0"`)
	require.Equal(t, existingTaskID.String(), mcpTaskIDFromBody(t, body))
	require.Contains(t, body, `"status":"recovering"`)
	require.Contains(t, body, "registered_replay_action")
	require.NotContains(t, body, "tenant-b")
	require.NotContains(t, body, secretMarker)
	require.NotContains(t, body, "ciphertext")
	require.NotContains(t, body, "nonce")
	require.NotContains(t, body, "key_material")
	require.NotContains(t, body, "key-should-not-return")
	require.Equal(t, int32(0), atomic.LoadInt32(&dispatchCount))
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestMCPCallActionCrossTenantReplaySameKeyIsIsolated(t *testing.T) {
	now := time.Now().UTC()
	_, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY", hex.EncodeToString(privateKey))
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY_VERSION", "mcp-cross-tenant-replay-test")

	type capturedDispatch struct {
		tenantHeader string
		body         map[string]interface{}
		rawBody      string
	}
	dispatches := make(chan capturedDispatch, 1)
	var dispatchCount int32
	originalTransport := http.DefaultTransport
	http.DefaultTransport = mcpRoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		atomic.AddInt32(&dispatchCount, 1)
		raw, readErr := io.ReadAll(req.Body)
		if readErr != nil {
			return &http.Response{
				StatusCode: http.StatusInternalServerError,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"error":"read_failed"}`)),
				Request:    req,
			}, nil
		}
		var payload map[string]interface{}
		if err := json.Unmarshal(raw, &payload); err != nil {
			return &http.Response{
				StatusCode: http.StatusBadRequest,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       io.NopCloser(strings.NewReader(`{"error":"bad_json"}`)),
				Request:    req,
			}, nil
		}
		dispatches <- capturedDispatch{
			tenantHeader: req.Header.Get("X-Igris-Tenant"),
			body:         payload,
			rawBody:      string(raw),
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(strings.NewReader(`{}`)),
			Request:    req,
		}, nil
	})
	t.Cleanup(func() {
		http.DefaultTransport = originalTransport
	})

	const (
		tenantA         = "tenant-mcp-replay-existing-a"
		tenantB         = "tenant-mcp-replay-caller-b"
		runtimeB        = "runtime-mcp-replay-b"
		endpointB       = "http://runtime.mcp.replay-b.test"
		idempotencyKey  = "shared-mcp-replay-key"
		tenantAAction   = "registered_replay_tenant_a"
		tenantBAction   = "registered_replay_tenant_b"
		tenantAEndpoint = "http://runtime.mcp.replay-a.test"
	)
	tenantATaskID := uuid.New()
	var tenantBTaskID uuid.UUID
	var permissionAuditWrites int32
	var capabilityAuditWrites int32
	var stampWrites int32
	checkAuditOrStampExec := func(query string, args []driver.NamedValue) {
		switch {
		case strings.Contains(query, "INSERT INTO ai_task_permission_audit"):
			atomic.AddInt32(&permissionAuditWrites, 1)
			require.Equal(t, tenantBTaskID.String(), driverValueString(args[1].Value))
			require.Equal(t, tenantB, args[2].Value)
		case strings.Contains(query, "INSERT INTO ai_capability_decision_audit"):
			atomic.AddInt32(&capabilityAuditWrites, 1)
			require.Equal(t, tenantBTaskID.String(), driverValueString(args[1].Value))
			require.Equal(t, tenantB, args[2].Value)
			require.Equal(t, runtimeB, args[3].Value)
		case strings.Contains(query, "SET executed_target = $3"):
			atomic.AddInt32(&stampWrites, 1)
			require.Equal(t, tenantBTaskID.String(), driverValueString(args[0].Value))
			require.Equal(t, tenantB, args[1].Value)
			require.Equal(t, actionTargetMockDemo, args[2].Value)
		default:
			require.Failf(t, "unexpected exec", "query: %s", query)
		}
	}
	db, drv := newQueuedExecRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantB, "Tenant B", "b@example.test"),
		mcpActionDefinitionQuery(t, tenantB, "act-mcp-replay-b", tenantBAction, now),
		mcpRuntimeSelectionQuery(t, tenantB, runtimeB, endpointB),
		mcpCapabilityPolicyQuery(t, tenantB),
	},
		queuedRouteExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INSERT INTO task_records")
				require.Contains(t, query, "ON CONFLICT (tenant_id, idempotency_key) DO NOTHING")
				require.Equal(t, tenantB, args[1].Value)
				require.Equal(t, idempotencyKey, args[4].Value)
				tenantBTaskID = requireDriverUUID(t, args[0].Value)
				require.NotEqual(t, tenantATaskID, tenantBTaskID)
			},
		},
		queuedRouteExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "UPDATE task_records")
				require.Equal(t, string(coordinator.TaskStatusDispatched), args[0].Value)
				require.Equal(t, runtimeB, args[1].Value)
				require.Equal(t, endpointB, args[2].Value)
				require.Equal(t, tenantBTaskID.String(), driverValueString(args[4].Value))
			},
		},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec},
		queuedRouteExecExpectation{rowsAffected: 1, check: checkAuditOrStampExec},
	)

	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	resp := mcpPost(t, app, mcpCallActionBody("mcp-cross-replay", "act-mcp-replay-b", idempotencyKey, "tenant b replay isolation", ""))
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := readBody(t, resp)
	require.Equal(t, tenantBTaskID.String(), mcpTaskIDFromBody(t, body))
	require.NotContains(t, body, tenantATaskID.String())
	require.NotContains(t, body, tenantA)
	require.NotContains(t, body, tenantAAction)
	require.NotContains(t, body, tenantAEndpoint)
	require.Contains(t, body, tenantBAction)
	var dispatch capturedDispatch
	select {
	case dispatch = <-dispatches:
	case <-time.After(2 * time.Second):
		t.Fatal("fake runtime did not receive tenant B replay dispatch")
	}
	require.Equal(t, tenantB, dispatch.tenantHeader)
	require.Equal(t, tenantB, dispatch.body["tenant_id"])
	require.Equal(t, tenantBTaskID.String(), dispatch.body["task_id"])
	require.Equal(t, idempotencyKey, dispatch.body["idempotency_key"])
	require.NotContains(t, dispatch.rawBody, tenantA)
	require.NotContains(t, dispatch.rawBody, tenantATaskID.String())
	require.Equal(t, int32(1), atomic.LoadInt32(&dispatchCount))
	require.Equal(t, int32(2), atomic.LoadInt32(&permissionAuditWrites))
	require.Equal(t, int32(2), atomic.LoadInt32(&capabilityAuditWrites))
	require.Equal(t, int32(1), atomic.LoadInt32(&stampWrites))
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestMCPCallActionUnknownActionDoesNotDispatch(t *testing.T) {
	var dispatchCount int32
	originalTransport := http.DefaultTransport
	http.DefaultTransport = mcpRoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		atomic.AddInt32(&dispatchCount, 1)
		return nil, errors.New("unexpected runtime dispatch")
	})
	t.Cleanup(func() {
		http.DefaultTransport = originalTransport
	})

	const tenantA = "tenant-mcp-unknown-action"
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantA, "Tenant MCP", "mcp@example.test"),
		{
			columns: actionDefinitionColumns(),
			err:     sql.ErrNoRows,
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM action_definitions")
				require.Contains(t, query, "WHERE tenant_id = $1 AND id = $2")
				require.Equal(t, tenantA, args[0].Value)
				require.Equal(t, "missing-action", args[1].Value)
			},
		},
	})
	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	resp := mcpPost(t, app, `{"jsonrpc":"2.0","id":"mcp-unknown","method":"call_action","params":{"action_id":"missing-action","input":{"ok":true}}}`)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
	body := readBody(t, resp)
	require.Contains(t, body, `"jsonrpc":"2.0"`)
	require.Contains(t, body, `"message":"not_found"`)
	require.Contains(t, body, `"detail":"action not found"`)
	require.Equal(t, int32(0), atomic.LoadInt32(&dispatchCount))
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestMCPCallActionCrossTenantActionDoesNotDispatch(t *testing.T) {
	var dispatchCount int32
	originalTransport := http.DefaultTransport
	http.DefaultTransport = mcpRoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		atomic.AddInt32(&dispatchCount, 1)
		return nil, errors.New("unexpected runtime dispatch")
	})
	t.Cleanup(func() {
		http.DefaultTransport = originalTransport
	})

	const tenantB = "tenant-mcp-cross-caller"
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantB, "Tenant B", "b@example.test"),
		{
			columns: actionDefinitionColumns(),
			err:     sql.ErrNoRows,
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM action_definitions")
				require.Contains(t, query, "WHERE tenant_id = $1 AND id = $2")
				require.Equal(t, tenantB, args[0].Value)
				require.Equal(t, "tenant-a-action", args[1].Value)
			},
		},
	})
	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	resp := mcpPost(t, app, `{"jsonrpc":"2.0","id":"mcp-cross","method":"call_action","params":{"action_id":"tenant-a-action","input":{"ok":true}}}`)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
	body := readBody(t, resp)
	require.Contains(t, body, `"jsonrpc":"2.0"`)
	require.Contains(t, body, `"message":"not_found"`)
	require.Contains(t, body, `"detail":"action not found"`)
	require.NotContains(t, body, "tenant-a")
	require.Equal(t, int32(0), atomic.LoadInt32(&dispatchCount))
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestMCPCallActionRawTaskPayloadDoesNotDispatch(t *testing.T) {
	var dispatchCount int32
	originalTransport := http.DefaultTransport
	http.DefaultTransport = mcpRoundTripperFunc(func(req *http.Request) (*http.Response, error) {
		atomic.AddInt32(&dispatchCount, 1)
		return nil, errors.New("unexpected runtime dispatch")
	})
	t.Cleanup(func() {
		http.DefaultTransport = originalTransport
	})

	const tenantA = "tenant-mcp-raw-payload"
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantA, "Tenant MCP", "mcp@example.test"),
	})
	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	resp := mcpPost(t, app, `{
		"jsonrpc":"2.0",
		"id":"mcp-raw",
		"method":"tools/call",
		"params":{
			"name":"call_action",
			"arguments":{
				"task_definition":{"type":"execution_graph","graph":{"nodes":[]}},
				"task_type":"execution_graph",
				"runtime_target":"filesystem",
				"input":{"path":"/tmp/should-not-run","operation":"read"}
			}
		}
	}`)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	body := readBody(t, resp)
	require.Contains(t, body, `"jsonrpc":"2.0"`)
	require.Contains(t, body, `"message":"validation_error"`)
	require.Contains(t, body, `"detail":"unsupported call_action field"`)
	require.NotContains(t, body, "/tmp/should-not-run")
	require.Equal(t, int32(0), atomic.LoadInt32(&dispatchCount))
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestMCPStrictValidationRejectsInvalidParamsBeforeHandlers(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		method string
		params string
		detail string
	}{
		{
			name:   "get_run missing id",
			method: "get_run",
			params: `{}`,
			detail: "exactly one action or run identifier is required",
		},
		{
			name:   "get_run wrong id type",
			method: "get_run",
			params: `{"task_id":123}`,
			detail: "task_id must be a string",
		},
		{
			name:   "get_run_evidence missing id",
			method: "get_run_evidence",
			params: `{}`,
			detail: "exactly one action or run identifier is required",
		},
		{
			name:   "unknown field",
			method: "list_actions",
			params: `{"tenant_id":"tenant-b"}`,
			detail: "unsupported MCP argument",
		},
		{
			name:   "get_action unknown field",
			method: "get_action",
			params: `{"action_id":"act-1","tenant_id":"tenant-b"}`,
			detail: "unsupported MCP argument",
		},
		{
			name:   "call_action missing action identifier",
			method: "call_action",
			params: `{"input":{"ok":true}}`,
			detail: "exactly one action or run identifier is required",
		},
		{
			name:   "call_action forbidden tenant override",
			method: "call_action",
			params: `{"action_id":"act-1","tenant_id":"tenant-b","input":{"ok":true}}`,
			detail: "unsupported call_action field",
		},
		{
			name:   "call_action forbidden raw task definition",
			method: "call_action",
			params: `{"action_id":"act-1","task_definition":{"type":"execution_graph"},"input":{"ok":true}}`,
			detail: "unsupported call_action field",
		},
		{
			name:   "list_runs wrong limit type",
			method: "list_runs",
			params: `{"limit":"100"}`,
			detail: "limit must be an integer",
		},
		{
			name:   "list_runtimes unknown field",
			method: "list_runtimes",
			params: `{"tenant_id":"tenant-b"}`,
			detail: "unsupported MCP argument",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
				tenantLookupRowFor("tenant-mcp-validation", "Tenant MCP", "mcp@example.test"),
			})
			app := fiber.New()
			h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
			app.Use(middleware.BetterAuth(db))
			app.Post("/v1/mcp", h.handle)

			resp := mcpPost(t, app, fmt.Sprintf(`{"jsonrpc":"2.0","id":%q,"method":%q,"params":%s}`, tc.name, tc.method, tc.params))
			require.Equal(t, http.StatusBadRequest, resp.StatusCode)
			body := readBody(t, resp)
			require.Contains(t, body, `"jsonrpc":"2.0"`)
			require.Contains(t, body, `"message":"validation_error"`)
			require.Contains(t, body, tc.detail)
			require.NotContains(t, body, "tenant-b")
			require.Zero(t, drv.remainingQueries())
			require.Zero(t, drv.remainingExecs())
		})
	}
}

func TestMCPListRunsOnlyReturnsTenantSafeRuns(t *testing.T) {
	t.Parallel()

	const tenantA = "tenant-mcp-runs"
	now := time.Now().UTC()
	taskID := uuid.New()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantA, "Tenant A", "a@example.test"),
		{
			columns: []string{"task_id", "proof_status", "proof_checked_at"},
			rows:    nil,
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "WHERE tenant_id = $1")
				require.Equal(t, tenantA, args[0].Value)
			},
		},
		{
			columns: taskRecordColumnsForMCPTest(),
			rows: [][]driver.Value{taskRecordRouteRow(
				taskID, tenantA, coordinator.TaskStatusCompleted, "runtime-1", "http://runtime.internal",
				json.RawMessage(`{"type":"execution_graph","graph":{"nodes":[{"metadata":{"action_definition_id":"act-1","action_name":"demo_action","target_type":"mock_demo","policy_preset":"Safe automation"}}]}}`),
				nil, "idem-1", nil, nil, &now, now,
			)},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "WHERE tenant_id = $1")
				require.Equal(t, tenantA, args[0].Value)
			},
		},
	})

	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	resp := mcpPost(t, app, `{"jsonrpc":"2.0","id":4,"method":"list_runs","params":{"limit":10}}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := readBody(t, resp)
	require.Contains(t, body, taskID.String())
	require.Contains(t, body, "demo_action")
	require.NotContains(t, body, "runtime.internal")
	require.Zero(t, drv.remainingQueries())
}

func TestMCPGetRunRecoveringTaskIsMetadataSafe(t *testing.T) {
	const (
		tenantA      = "tenant-mcp-inspect-a"
		tenantB      = "tenant-mcp-inspect-b"
		runtimeID    = "runtime-mcp-inspect"
		idemKey      = "mcp-inspect-idempotency"
		secretMarker = "IGRIS_MCP_INSPECTION_SECRET_MARKER"
	)
	now := time.Now().UTC()
	taskID := uuid.New()
	taskDefinition := mcpRecoveringTaskDefinition(secretMarker)
	checkpoint := mcpUnsafeCheckpointPayload(taskID, runtimeID, secretMarker)
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantA, "Tenant A", "a@example.test"),
		{
			columns: taskRecordColumnsForMCPTest(),
			rows: [][]driver.Value{taskRecordRouteRow(
				taskID, tenantA, coordinator.TaskStatusRecovering, runtimeID, "http://runtime.mcp.inspect.internal",
				taskDefinition, checkpoint, idemKey, nil, nil, nil, now,
			)},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "WHERE task_id = $1 AND tenant_id = $2")
				require.Equal(t, taskID.String(), driverValueString(args[0].Value))
				require.Equal(t, tenantA, args[1].Value)
			},
		},
		tenantLookupRowFor(tenantB, "Tenant B", "b@example.test"),
		{
			columns: taskRecordColumnsForMCPTest(),
			err:     sql.ErrNoRows,
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "WHERE task_id = $1 AND tenant_id = $2")
				require.Equal(t, taskID.String(), driverValueString(args[0].Value))
				require.Equal(t, tenantB, args[1].Value)
			},
		},
	})

	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	resp := mcpPost(t, app, `{"jsonrpc":"2.0","id":"get-run-safe","method":"get_run","params":{"run_id":"`+taskID.String()+`"}}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := readBody(t, resp)
	require.Contains(t, body, `"jsonrpc":"2.0"`)
	require.Contains(t, body, taskID.String())
	require.Contains(t, body, `"status":"recovering"`)
	require.Contains(t, body, "registered_inspection_action")
	require.Contains(t, body, "encrypted_input_refs")
	require.NotContains(t, body, tenantB)
	requireMCPInspectionBodySafe(t, body, secretMarker)

	crossResp := mcpPost(t, app, `{"jsonrpc":"2.0","id":"get-run-cross","method":"get_run","params":{"run_id":"`+taskID.String()+`"}}`)
	require.Equal(t, http.StatusNotFound, crossResp.StatusCode)
	crossBody := readBody(t, crossResp)
	require.Contains(t, crossBody, `"jsonrpc":"2.0"`)
	require.Contains(t, crossBody, `"message":"not_found"`)
	require.NotContains(t, crossBody, taskID.String())
	require.NotContains(t, crossBody, tenantA)
	require.NotContains(t, crossBody, "registered_inspection_action")
	requireMCPInspectionBodySafe(t, crossBody, secretMarker)
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestMCPGetRunEvidenceRecoveringTaskIsMetadataSafe(t *testing.T) {
	const (
		tenantA      = "tenant-mcp-evidence-a"
		tenantB      = "tenant-mcp-evidence-b"
		runtimeID    = "runtime-mcp-evidence"
		idemKey      = "mcp-evidence-idempotency"
		secretMarker = "IGRIS_MCP_EVIDENCE_SECRET_MARKER"
	)
	now := time.Now().UTC()
	taskID := uuid.New()
	outputDigest := strings.Repeat("b", 64)
	checkpoint := mcpUnsafeCheckpointPayload(taskID, runtimeID, secretMarker)
	checkpoint.WalEntries = []coordinator.WalEntry{{
		EntryID:      uuid.New(),
		TaskID:       taskID,
		StepIndex:    2,
		StepType:     map[string]interface{}{"raw_body": secretMarker, "private_path": "/Users/customer/private/evidence.txt"},
		Status:       "committed",
		InputDigest:  strings.Repeat("a", 64),
		OutputDigest: &outputDigest,
		RuntimeID:    runtimeID,
	}}
	checkpointBytes, err := json.Marshal(checkpoint)
	require.NoError(t, err)
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantA, "Tenant A", "a@example.test"),
		{
			columns: taskRecordColumnsForMCPTest(),
			rows: [][]driver.Value{taskRecordRouteRow(
				taskID, tenantA, coordinator.TaskStatusRecovering, runtimeID, "http://runtime.mcp.evidence.internal",
				mcpRecoveringTaskDefinition(secretMarker), checkpoint, idemKey, nil, nil, nil, now,
			)},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "WHERE task_id = $1 AND tenant_id = $2")
				require.Equal(t, taskID.String(), driverValueString(args[0].Value))
				require.Equal(t, tenantA, args[1].Value)
			},
		},
		{
			columns: []string{"wal_entries"},
			rows:    [][]driver.Value{{checkpointBytes}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM wal_checkpoints")
				require.Equal(t, taskID.String(), driverValueString(args[0].Value))
			},
		},
		tenantLookupRowFor(tenantB, "Tenant B", "b@example.test"),
		{
			columns: taskRecordColumnsForMCPTest(),
			err:     sql.ErrNoRows,
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "WHERE task_id = $1 AND tenant_id = $2")
				require.Equal(t, taskID.String(), driverValueString(args[0].Value))
				require.Equal(t, tenantB, args[1].Value)
			},
		},
	})

	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	resp := mcpPost(t, app, `{"jsonrpc":"2.0","id":"evidence-safe","method":"get_run_evidence","params":{"run_id":"`+taskID.String()+`"}}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := readBody(t, resp)
	require.Contains(t, body, `"jsonrpc":"2.0"`)
	require.Contains(t, body, `"safe_step_count":1`)
	require.Contains(t, body, strings.Repeat("a", 64))
	require.Contains(t, body, outputDigest)
	require.NotContains(t, body, taskID.String())
	require.NotContains(t, body, tenantB)
	requireMCPInspectionBodySafe(t, body, secretMarker)

	crossResp := mcpPost(t, app, `{"jsonrpc":"2.0","id":"evidence-cross","method":"get_run_evidence","params":{"run_id":"`+taskID.String()+`"}}`)
	require.Equal(t, http.StatusNotFound, crossResp.StatusCode)
	crossBody := readBody(t, crossResp)
	require.Contains(t, crossBody, `"jsonrpc":"2.0"`)
	require.Contains(t, crossBody, `"message":"not_found"`)
	require.NotContains(t, crossBody, taskID.String())
	require.NotContains(t, crossBody, tenantA)
	require.NotContains(t, crossBody, strings.Repeat("a", 64))
	requireMCPInspectionBodySafe(t, crossBody, secretMarker)
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
}

func TestMCPGetRunEvidenceDoesNotLeakUnsafeBodies(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	runtimeID := "runtime-safe"
	outputDigest := strings.Repeat("b", 64)
	task := &coordinator.TaskRecord{
		TaskID:    taskID,
		TenantID:  "tenant-evidence",
		Status:    coordinator.TaskStatusCompleted,
		RuntimeID: &runtimeID,
		ExecutionReceipt: json.RawMessage(`{
			"hash":"receipt-hash-1",
			"signature":"raw-signature-secret",
			"raw_request_body":"password=secret",
			"raw_response_body":"token=secret",
			"hostname":"host.internal",
			"database_url":"postgres://user:pass@db.internal/app"
		}`),
		Proof: &coordinator.TaskProofState{Status: "verified", Signature: "raw-proof-signature", StoredHash: "stored-hash"},
	}
	evidence := safeMCPRunEvidence(task, []coordinator.WalEntry{{
		EntryID:      uuid.New(),
		TaskID:       taskID,
		StepIndex:    1,
		Status:       "committed",
		InputDigest:  strings.Repeat("a", 64),
		OutputDigest: &outputDigest,
		RuntimeID:    runtimeID,
	}})
	raw, err := json.Marshal(evidence)
	require.NoError(t, err)
	body := string(raw)
	require.Contains(t, body, "receipt-hash-1")
	require.Contains(t, body, outputDigest)
	require.NotContains(t, body, "raw-signature-secret")
	require.NotContains(t, body, "raw-proof-signature")
	require.NotContains(t, body, "password=secret")
	require.NotContains(t, body, "token=secret")
	require.NotContains(t, body, "host.internal")
	require.NotContains(t, body, "postgres://")
}

func TestMCPGetRunDoesNotReturnRawHistoricalInputs(t *testing.T) {
	t.Parallel()

	const marker = "IGRIS_SHOULD_NEVER_PERSIST_INPUT_SECRET"
	taskID := uuid.New()
	task := &coordinator.TaskRecord{
		TaskID:   taskID,
		TenantID: "tenant-inputs",
		Status:   coordinator.TaskStatusCompleted,
		TaskDefinition: json.RawMessage(`{
			"type":"execution_graph",
			"graph":{"nodes":[{
				"metadata":{"action_name":"unsafe_action","policy_preset":"Safe automation"},
				"kind":"tool",
				"node_id":"unsafe-http",
				"tool_name":"http_request",
				"args":{"body":"` + marker + `","path":"/Users/customer/private/` + marker + `.txt"}
			}]}
		}`),
		Proof: &coordinator.TaskProofState{Status: "verified"},
	}
	detail := safeMCPRunDetail(task)
	raw, err := json.Marshal(detail)
	require.NoError(t, err)
	body := string(raw)
	require.NotContains(t, body, marker)
	require.NotContains(t, body, "/Users/customer/private")
	require.NotContains(t, body, "body")
	require.Contains(t, body, "input_summary")
	require.Contains(t, body, "input_redacted")
	require.Contains(t, body, "input_digest_sha256")
}

func TestMCPGetRunReturnsEncryptedInputRefMetadataOnly(t *testing.T) {
	t.Parallel()

	const marker = "IGRIS_ENCRYPTED_INPUT_SECRET_MARKER"
	task := &coordinator.TaskRecord{
		TaskID:   uuid.New(),
		TenantID: "tenant-inputs",
		Status:   coordinator.TaskStatusCompleted,
		TaskDefinition: json.RawMessage(`{
			"type":"execution_graph",
			"graph":{"nodes":[{
				"metadata":{"action_name":"unsafe_action","policy_preset":"Safe automation"},
				"kind":"tool",
				"node_id":"unsafe-http",
				"tool_name":"http_request",
				"args":{"body":{
					"input_redacted":true,
					"encrypted_input_ref":true,
					"encrypted_input_ref_id":"22222222-2222-2222-2222-222222222222",
					"purpose":"execution_payload",
					"input_digest_sha256":"def456",
					"input_bytes":24,
					"key_version":"test:v1",
					"redaction_policy_version":"input-reference-redaction-v1"
				}}
			}]}
		}`),
		ExecutionReceipt: json.RawMessage(`{"ciphertext":"` + marker + `"}`),
		Proof:            &coordinator.TaskProofState{Status: "verified"},
	}
	detail := safeMCPRunDetail(task)
	raw, err := json.Marshal(detail)
	require.NoError(t, err)
	body := string(raw)
	require.NotContains(t, body, marker)
	require.NotContains(t, body, "ciphertext")
	require.Contains(t, body, "encrypted_input_refs")
	require.Contains(t, body, "22222222-2222-2222-2222-222222222222")
	require.Contains(t, body, "execution_payload")
}

func TestMCPListRuntimesDoesNotLeakHostnamesIPsOrKeys(t *testing.T) {
	t.Parallel()

	const tenantA = "tenant-mcp-runtimes"
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantA, "Tenant A", "a@example.test"),
		{
			columns: []string{"runtime_id", "status", "capabilities", "last_seen_at", "endpoint", "is_healthy"},
			rows: [][]driver.Value{{
				"runtime-1", "active", []byte(`["filesystem","http_request"]`), now, "https://runtime.test", true,
			}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "WHERE tenant_id = $1")
				require.NotContains(t, query, "hostname")
				require.NotContains(t, query, "ip_address")
				require.NotContains(t, query, "public_key_ed25519")
				require.Equal(t, tenantA, args[0].Value)
			},
		},
	})

	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	resp := mcpPost(t, app, `{"jsonrpc":"2.0","id":5,"method":"list_runtimes","params":{}}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := readBody(t, resp)
	require.Contains(t, body, "runtime-1")
	require.Contains(t, body, "filesystem")
	require.NotContains(t, body, "hostname")
	require.NotContains(t, body, "ip_address")
	require.NotContains(t, body, "public_key")
	require.Contains(t, body, `"routable":true`)
	require.Zero(t, drv.remainingQueries())
}

func TestMCPListRuntimesDoesNotMarkEndpointlessRuntimeRoutable(t *testing.T) {
	t.Parallel()

	const tenantA = "tenant-mcp-runtimes-unroutable"
	now := time.Now().UTC()
	db, drv := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		tenantLookupRowFor(tenantA, "Tenant A", "a@example.test"),
		{
			columns: []string{"runtime_id", "status", "capabilities", "last_seen_at", "endpoint", "is_healthy"},
			rows: [][]driver.Value{
				{"runtime-empty", "active", []byte(`["filesystem"]`), now, "", true},
				{"runtime-invalid", "active", []byte(`["http_request"]`), now, "not-a-url", true},
			},
		},
	})

	app := fiber.New()
	h := newAgentMcpHandler(db, coordinator.NewTaskCoordinator(db))
	app.Use(middleware.BetterAuth(db))
	app.Post("/v1/mcp", h.handle)

	resp := mcpPost(t, app, `{"jsonrpc":"2.0","id":6,"method":"list_runtimes","params":{}}`)
	require.Equal(t, http.StatusOK, resp.StatusCode)
	body := readBody(t, resp)
	require.Contains(t, body, "runtime-empty")
	require.Contains(t, body, "runtime-invalid")
	require.Contains(t, body, `"routable":false`)
	require.Contains(t, body, `"status":"unroutable"`)
	require.NotContains(t, body, "not-a-url")
	require.Zero(t, drv.remainingQueries())
}

func mcpPost(t *testing.T, app *fiber.App, body string) *http.Response {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/v1/mcp", strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+testAPIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	t.Cleanup(func() { _ = resp.Body.Close() })
	return resp
}

func readBody(t *testing.T, resp *http.Response) string {
	t.Helper()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	return string(body)
}

func mcpActionDefinitionQuery(t *testing.T, tenantID, actionID, actionName string, now time.Time) queuedRouteQueryExpectation {
	t.Helper()
	return queuedRouteQueryExpectation{
		columns: actionDefinitionColumns(),
		rows: [][]driver.Value{{
			actionID,
			tenantID,
			actionName,
			"Registered MCP Action",
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
			require.Equal(t, actionID, args[1].Value)
		},
	}
}

func mcpRuntimeSelectionQuery(t *testing.T, tenantID, runtimeID, endpoint string) queuedRouteQueryExpectation {
	t.Helper()
	return queuedRouteQueryExpectation{
		columns: []string{"runtime_id", "endpoint"},
		rows:    [][]driver.Value{{runtimeID, endpoint}},
		checkArgs: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "FROM runtime_instances")
			require.Contains(t, query, "WHERE ri.tenant_id = $1")
			require.Equal(t, tenantID, args[0].Value)
		},
	}
}

func mcpCapabilityPolicyQuery(t *testing.T, tenantID string) queuedRouteQueryExpectation {
	t.Helper()
	return queuedRouteQueryExpectation{
		columns: []string{"policy"},
		rows: [][]driver.Value{{
			[]byte(`{"policy_version":"capabilities.mcp-idempotency-test","allowed_capabilities":["tools.database_write"]}`),
		}},
		checkArgs: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "ai_capability_policy_settings")
			require.Equal(t, tenantID, args[0].Value)
		},
	}
}

func mcpCallActionBody(id, actionID, idempotencyKey, message, bodyTenantID string) string {
	_ = bodyTenantID
	return fmt.Sprintf(`{
		"jsonrpc":"2.0",
		"id":%q,
		"method":"tools/call",
		"params":{
			"name":"call_action",
			"arguments":{
				"action_id":%q,
				"input":{"ok":true,"message":%q},
				"idempotency_key":%q
			}
		}
	}`, id, actionID, message, idempotencyKey)
}

func mcpTaskIDFromBody(t *testing.T, body string) string {
	t.Helper()
	var envelope map[string]interface{}
	require.NoError(t, json.Unmarshal([]byte(body), &envelope))
	result, ok := envelope["result"].(map[string]interface{})
	require.True(t, ok, "MCP response must contain an object result: %s", body)
	content, ok := result["structuredContent"].(map[string]interface{})
	if !ok {
		content = result
	}
	taskID, ok := content["task_id"].(string)
	require.True(t, ok, "MCP result must include task_id: %s", body)
	require.NotEmpty(t, taskID)
	return taskID
}

func mcpRecoveringTaskDefinition(marker string) json.RawMessage {
	return json.RawMessage(`{
		"type":"execution_graph",
		"graph":{"nodes":[{
			"kind":"tool",
			"node_id":"inspect-action-0",
			"tool_name":"database_write",
			"metadata":{
				"action_definition_id":"act-mcp-inspection",
				"action_name":"registered_inspection_action",
				"target_type":"mock_demo",
				"policy_preset":"safe_automation",
				"replay_class":"retryable",
				"approval_required":false
			},
			"args":{
				"body":{
					"input_redacted":true,
					"encrypted_input_ref":true,
					"encrypted_input_ref_id":"44444444-4444-4444-4444-444444444444",
					"purpose":"execution_payload",
					"input_digest_sha256":"input-digest-4444",
					"input_bytes":64,
					"key_version":"test:v3",
					"redaction_policy_version":"input-reference-redaction-v1",
					"ciphertext":"` + marker + `",
					"nonce":"nonce-should-not-return",
					"key_material":"key-should-not-return",
					"raw_body":"raw-body-should-not-return",
					"request_body":"request-body-should-not-return",
					"response_body":"response-body-should-not-return",
					"private_path":"/Users/customer/private/should-not-return.txt"
				}
			}
		}]}
	}`)
}

func mcpUnsafeCheckpointPayload(taskID uuid.UUID, runtimeID, marker string) *coordinator.CheckpointPayload {
	return &coordinator.CheckpointPayload{
		TaskID: taskID,
		ResumeToken: coordinator.ResumeToken{
			LastCommittedStep: 1,
			CheckpointDigest:  "digest-inspection-1",
			RuntimeID:         runtimeID,
		},
		Metadata: json.RawMessage(`{
			"raw_body":"` + marker + `",
			"request_body":"request-body-should-not-return",
			"response_body":"response-body-should-not-return",
			"ciphertext":"ciphertext-should-not-return",
			"nonce":"nonce-should-not-return",
			"key_material":"key-should-not-return",
			"private_path":"/Users/customer/private/checkpoint.txt"
		}`),
		CapturedAt: time.Now().UTC(),
	}
}

func requireMCPInspectionBodySafe(t *testing.T, body, marker string) {
	t.Helper()
	require.NotContains(t, body, marker)
	require.NotContains(t, body, "ciphertext")
	require.NotContains(t, body, "nonce")
	require.NotContains(t, body, "key_material")
	require.NotContains(t, body, "key-should-not-return")
	require.NotContains(t, body, "raw_body")
	require.NotContains(t, body, "request_body")
	require.NotContains(t, body, "response_body")
	require.NotContains(t, body, "raw-body-should-not-return")
	require.NotContains(t, body, "request-body-should-not-return")
	require.NotContains(t, body, "response-body-should-not-return")
	require.NotContains(t, body, "/Users/customer/private")
	require.NotContains(t, body, "private_path")
}

func taskRecordColumnsForMCPTest() []string {
	return []string{
		"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
		"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
		"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
		"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
		"idempotency_key", "failure_reason", "failure_details",
		"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason",
		"registered_agent_id", "registered_agent_name",
	}
}
