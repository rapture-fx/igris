package api

import (
	"context"
	"crypto/ed25519"
	"database/sql"
	"database/sql/driver"
	"encoding/hex"
	"encoding/json"
	"errors"
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

type failingReader struct{}

func (f failingReader) Read([]byte) (int, error) {
	return 0, errors.New("runtime body read failed")
}

func (f failingReader) Close() error {
	return nil
}

func TestMcpProxyErrorResponseIncludesFailureSchema(t *testing.T) {
	t.Parallel()

	resp := mcpProxyErrorResponse("runtime", "runtime_unreachable", "Runtime unreachable", "dial tcp timeout")

	errorBody, ok := resp["error"].(fiber.Map)
	if !ok {
		t.Fatalf("error body type = %T, want fiber.Map", resp["error"])
	}
	if got := errorBody["message"]; got != "Runtime unreachable" {
		t.Fatalf("error.message = %v, want Runtime unreachable", got)
	}
	failure, ok := resp["failure"].(map[string]interface{})
	if !ok {
		t.Fatalf("failure body type = %T, want map[string]interface{}", resp["failure"])
	}
	if got := failure["source"]; got != "runtime" {
		t.Fatalf("failure.source = %v, want runtime", got)
	}
	if got := failure["operation"]; got != "mcp_proxy" {
		t.Fatalf("failure.operation = %v, want mcp_proxy", got)
	}
	if got := failure["type"]; got != "runtime_unreachable" {
		t.Fatalf("failure.type = %v, want runtime_unreachable", got)
	}
	if got := failure["reason"]; got != "dial tcp timeout" {
		t.Fatalf("failure.reason = %v, want dial tcp timeout", got)
	}
}

func TestMcpProxyReportsRequestBuildFailureWithFailureSchema(t *testing.T) {
	t.Parallel()

	handler := &mcpProxyHandler{
		runtimeURL: "://bad-runtime-url",
		httpClient: http.DefaultClient,
	}
	app := fiber.New()
	app.Post("/v1/mcp", handler.handleMcp)

	resp, err := app.Test(httptest.NewRequest(http.MethodPost, "/v1/mcp", strings.NewReader(`{}`)))
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusInternalServerError)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	failure, ok := body["failure"].(map[string]any)
	if !ok {
		t.Fatalf("failure body type = %T, want map[string]any", body["failure"])
	}
	if got := failure["source"]; got != "overture" {
		t.Fatalf("failure.source = %v, want overture", got)
	}
	if got := failure["type"]; got != "mcp_proxy_request_build_failed" {
		t.Fatalf("failure.type = %v, want mcp_proxy_request_build_failed", got)
	}
}

func TestMcpProxyReportsRuntimeUnreachableWithFailureSchema(t *testing.T) {
	t.Parallel()

	handler := &mcpProxyHandler{
		runtimeURL: "http://runtime.test",
		httpClient: &http.Client{Transport: mcpRoundTripperFunc(func(*http.Request) (*http.Response, error) {
			return nil, errors.New("dial tcp timeout")
		})},
	}
	app := fiber.New()
	app.Post("/v1/mcp", handler.handleMcp)

	resp, err := app.Test(httptest.NewRequest(http.MethodPost, "/v1/mcp", strings.NewReader(`{}`)))
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusBadGateway {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusBadGateway)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	failure, ok := body["failure"].(map[string]any)
	if !ok {
		t.Fatalf("failure body type = %T, want map[string]any", body["failure"])
	}
	if got := failure["source"]; got != "runtime" {
		t.Fatalf("failure.source = %v, want runtime", got)
	}
	if got := failure["operation"]; got != "mcp_proxy" {
		t.Fatalf("failure.operation = %v, want mcp_proxy", got)
	}
	if got := failure["type"]; got != "runtime_unreachable" {
		t.Fatalf("failure.type = %v, want runtime_unreachable", got)
	}
}

func TestMcpProxyReportsRuntimeReadFailureWithFailureSchema(t *testing.T) {
	t.Parallel()

	handler := &mcpProxyHandler{
		runtimeURL: "http://runtime.test",
		httpClient: &http.Client{Transport: mcpRoundTripperFunc(func(*http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     http.Header{"Content-Type": []string{"application/json"}},
				Body:       failingReader{},
			}, nil
		})},
	}
	app := fiber.New()
	app.Post("/v1/mcp", handler.handleMcp)

	req := httptest.NewRequest(http.MethodPost, "/v1/mcp", strings.NewReader(`{}`))
	req = req.WithContext(context.Background())
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusBadGateway {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusBadGateway)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	failure, ok := body["failure"].(map[string]any)
	if !ok {
		t.Fatalf("failure body type = %T, want map[string]any", body["failure"])
	}
	if got := failure["type"]; got != "runtime_response_read_failed" {
		t.Fatalf("failure.type = %v, want runtime_response_read_failed", got)
	}
	if got := failure["reason"]; got != "runtime body read failed" {
		t.Fatalf("failure.reason = %v, want runtime body read failed", got)
	}
}

var _ io.ReadCloser = failingReader{}

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
				require.NotContains(t, string(defBytes), "caller-filesystem-override")
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
				"tenant_id":"tenant-b",
				"action_id":"act-mcp-dispatch",
				"runtime_target":"caller-filesystem-override",
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
	require.NotContains(t, body, "caller-filesystem-override")
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
	require.NotContains(t, captured.rawBody, "caller-filesystem-override")

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
	require.Contains(t, body, `"detail":"action_id or action_name is required"`)
	require.NotContains(t, body, "/tmp/should-not-run")
	require.Equal(t, int32(0), atomic.LoadInt32(&dispatchCount))
	require.Zero(t, drv.remainingQueries())
	require.Zero(t, drv.remainingExecs())
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
			columns: []string{"runtime_id", "status", "capabilities", "last_seen_at"},
			rows: [][]driver.Value{{
				"runtime-1", "active", []byte(`["filesystem","http_request"]`), now,
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

func taskRecordColumnsForMCPTest() []string {
	return []string{
		"task_id", "tenant_id", "status", "runtime_id", "runtime_endpoint",
		"task_definition", "last_checkpoint", "execution_envelope", "execution_receipt",
		"proof_execution_id", "proof_expected_hash", "proof_stored_hash", "proof_signature", "proof_status", "proof_checked_at",
		"proof_verified", "proof_hash_valid", "proof_signature_matches", "proof_runtime_key_found", "proof_chain_link_valid", "proof_verification_reason", "proof_verified_at",
		"idempotency_key", "failure_reason", "failure_details",
		"deadline_at", "dispatched_at", "completed_at", "canceled_at", "created_at", "executed_target", "fallback_reason",
	}
}
