package api

import (
	"crypto/ed25519"
	"database/sql"
	"database/sql/driver"
	"encoding/hex"
	"encoding/json"
	"io"
	"net"
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
)

func TestBuildActionTaskSubmitRequestHTTPAction(t *testing.T) {
	t.Parallel()

	deadline := time.Unix(1_700_000_000, 0).UTC()
	req, err := buildActionTaskSubmitRequest(actionRunRequest{
		Action: "github.create_issue",
		Input: map[string]interface{}{
			"method": "POST",
			"url":    "http://localhost:8787/issues",
			"body": map[string]interface{}{
				"title": "Bug from agent",
			},
		},
		Metadata: map[string]interface{}{
			"agent_id": "support-agent",
			"user_id":  "user_123",
		},
		RuntimeTarget: "http_request",
		DeadlineAt:    &deadline,
	}, "tenant-actions")
	require.NoError(t, err)
	require.Equal(t, "tenant-actions", req.TenantID)
	require.Equal(t, "execution_graph", req.TaskType)
	require.Equal(t, "support-agent", req.AgentIdentity.AgentID)
	require.Equal(t, "user_123", req.AgentIdentity.PrincipalID)
	require.Equal(t, &deadline, req.DeadlineAt)

	var def map[string]interface{}
	require.NoError(t, json.Unmarshal(req.TaskDefinition, &def))
	graph := def["graph"].(map[string]interface{})
	nodes := graph["nodes"].([]interface{})
	node := nodes[0].(map[string]interface{})
	require.Equal(t, "tool", node["kind"])
	require.Equal(t, "http_request", node["tool_name"])
	require.Equal(t, "github-create-issue-0", node["node_id"])
	args := node["args"].(map[string]interface{})
	require.Equal(t, "POST", args["method"])
	require.Equal(t, "http://localhost:8787/issues", args["url"])
	require.JSONEq(t, `{"title":"Bug from agent"}`, args["body"].(string))
}

func TestBuildActionTaskSubmitRequestRejectsUnmappedAction(t *testing.T) {
	t.Parallel()

	_, err := buildActionTaskSubmitRequest(actionRunRequest{
		Action: "github.create_issue",
		Input:  map[string]interface{}{"title": "Bug from agent"},
	}, "tenant-actions")
	require.Error(t, err)
	require.Contains(t, err.Error(), "runtime_target is required")
}

func TestBuildActionRunResponseDoesNotExposeRawProofOrSecrets(t *testing.T) {
	t.Parallel()

	taskID := uuid.New()
	verified := true
	resp := buildActionRunResponse(&coordinator.TaskRecord{
		TaskID: taskID,
		Status: coordinator.TaskStatusCompleted,
		Proof: &coordinator.TaskProofState{
			ExecutionID: "exec_123",
			Status:      "verified",
			Signature:   "raw-signature-not-returned",
			StoredHash:  "raw-hash-not-returned",
			Verified:    &verified,
		},
		CreatedAt: time.Now().UTC(),
	}, nil)

	require.Equal(t, taskID.String(), resp["task_id"])
	require.Equal(t, "exec_123", resp["execution_id"])
	require.Equal(t, "verified", resp["proof_status"])
	raw, err := json.Marshal(resp)
	require.NoError(t, err)
	require.NotContains(t, string(raw), "raw-signature-not-returned")
	require.NotContains(t, string(raw), "raw-hash-not-returned")
}

func TestBuildActionRunRequestFromDefinitionMockDemo(t *testing.T) {
	t.Parallel()

	req, err := buildActionRunRequestFromDefinition(actionDefinition{
		ID:               "action-1",
		Name:             "send_email",
		TargetType:       "mock_demo",
		PolicyPreset:     "Safe automation",
		ReplayClass:      "retryable",
		ApprovalRequired: false,
		Irreversible:     false,
	}, actionRunByNameRequest{Input: map[string]interface{}{"to": "user@example.com"}})
	require.NoError(t, err)
	require.Equal(t, "send_email", req.Action)
	require.Equal(t, "database_write", req.RuntimeTarget)
	require.Equal(t, "action_task_mock_demo", req.Input["table"])
	record := req.Input["record"].(map[string]interface{})
	require.Equal(t, true, record["demo"])
	require.Equal(t, "mock_demo target; no external API was called", record["demo_behavior"])
	require.Equal(t, "action-1", req.Metadata["action_definition_id"])

	taskReq, err := buildActionTaskSubmitRequest(req, "tenant-actions")
	require.NoError(t, err)
	require.Equal(t, "execution_graph", taskReq.TaskType)
	var graphDef map[string]interface{}
	require.NoError(t, json.Unmarshal(taskReq.TaskDefinition, &graphDef))
	nodes := graphDef["graph"].(map[string]interface{})["nodes"].([]interface{})
	node := nodes[0].(map[string]interface{})
	require.Equal(t, "database_write", node["tool_name"])
	metadata := node["metadata"].(map[string]interface{})
	require.Equal(t, "action-1", metadata["action_definition_id"])
}

func TestBuildActionRunRequestFromDefinitionWebhook(t *testing.T) {
	t.Parallel()

	req, err := buildActionRunRequestFromDefinition(actionDefinition{
		ID:           "action-2",
		Name:         "create_ticket",
		TargetType:   "webhook",
		TargetURL:    "https://example.com/tickets",
		Method:       "POST",
		PolicyPreset: "Non-replayable",
		ReplayClass:  "non_retryable",
		Irreversible: true,
	}, actionRunByNameRequest{Input: map[string]interface{}{"title": "bug"}})
	require.NoError(t, err)
	require.Equal(t, "http_request", req.RuntimeTarget)
	require.Equal(t, "https://example.com/tickets", req.Input["url"])
	require.Equal(t, "POST", req.Input["method"])
	require.Equal(t, "Non-replayable", req.Metadata["policy_preset"])
	require.Equal(t, true, req.Metadata["irreversible"])
}

func TestBuildActionRunRequestFromDefinitionOverridesReservedCallerMetadata(t *testing.T) {
	t.Parallel()

	req, err := buildActionRunRequestFromDefinition(actionDefinition{
		ID:               "action-authoritative",
		Name:             "send_invoice",
		TargetType:       "webhook",
		TargetURL:        "https://example.test/invoice",
		Method:           "POST",
		PolicyPreset:     "Human-gated",
		ReplayClass:      "non_retryable",
		ApprovalRequired: true,
		Irreversible:     true,
	}, actionRunByNameRequest{
		Input: map[string]interface{}{"amount": 4200},
		Metadata: map[string]interface{}{
			"action_definition_id": "caller-action-id",
			"action_name":          "caller.action",
			"target_type":          "mock_demo",
			"policy_preset":        "Safe automation",
			"replay_class":         "retryable",
			"approval_required":    false,
			"irreversible":         false,
			"request_summary":      "send invoice",
		},
	})
	require.NoError(t, err)

	require.Equal(t, "action-authoritative", req.Metadata["action_definition_id"])
	require.Equal(t, "send_invoice", req.Metadata["action_name"])
	require.Equal(t, "webhook", req.Metadata["target_type"])
	require.Equal(t, "Human-gated", req.Metadata["policy_preset"])
	require.Equal(t, "non_retryable", req.Metadata["replay_class"])
	require.Equal(t, true, req.Metadata["approval_required"])
	require.Equal(t, true, req.Metadata["irreversible"])
	require.Equal(t, "send invoice", req.Metadata["request_summary"])

	taskReq, err := buildActionTaskSubmitRequest(req, "tenant-authoritative")
	require.NoError(t, err)
	var graphDef map[string]interface{}
	require.NoError(t, json.Unmarshal(taskReq.TaskDefinition, &graphDef))
	node := graphDef["graph"].(map[string]interface{})["nodes"].([]interface{})[0].(map[string]interface{})
	metadata := node["metadata"].(map[string]interface{})
	require.Equal(t, "action-authoritative", metadata["action_definition_id"])
	require.Equal(t, "send_invoice", metadata["action_name"])
	require.Equal(t, "webhook", metadata["target_type"])
	require.Equal(t, "Human-gated", metadata["policy_preset"])
	require.Equal(t, "non_retryable", metadata["replay_class"])
	require.Equal(t, true, metadata["approval_required"])
	require.Equal(t, true, metadata["irreversible"])
}

func TestBuildActionRunRequestFromDefinitionWebhookLocalAuthHeader(t *testing.T) {
	t.Setenv("IGRIS_TEST_DOGFOOD_WEBHOOK_SECRET", "test-local-shared-secret")

	req, err := buildActionRunRequestFromDefinition(actionDefinition{
		ID:           "action-local-webhook",
		Name:         "repo.run_tests",
		TargetType:   "webhook",
		TargetURL:    "http://127.0.0.1:18096/repo/run-tests",
		Method:       "POST",
		PolicyPreset: "Safe automation",
		ReplayClass:  "read_only",
		TargetMetadata: map[string]interface{}{
			localWebhookAuthHeaderNameMetadata: "X-Igris-Dogfood-Secret",
			localWebhookAuthSecretEnvMetadata:  "IGRIS_TEST_DOGFOOD_WEBHOOK_SECRET",
		},
	}, actionRunByNameRequest{Input: map[string]interface{}{"action": "repo.run_tests"}})
	require.NoError(t, err)
	headers := req.Input["headers"].(map[string]interface{})
	require.Equal(t, "test-local-shared-secret", headers["X-Igris-Dogfood-Secret"])

	taskReq, err := buildActionTaskSubmitRequest(req, "tenant-actions")
	require.NoError(t, err)
	var graphDef map[string]interface{}
	require.NoError(t, json.Unmarshal(taskReq.TaskDefinition, &graphDef))
	node := graphDef["graph"].(map[string]interface{})["nodes"].([]interface{})[0].(map[string]interface{})
	args := node["args"].(map[string]interface{})
	require.Equal(t, "http://127.0.0.1:18096/repo/run-tests", args["url"])
	require.Equal(t, "POST", args["method"])
	require.Contains(t, args, "headers", "local auth must be passed to the runtime request, then encrypted by input refs before persistence")
}

func TestBuildActionRunRequestFromDefinitionWebhookAuthRejectsPrivateHTTPS(t *testing.T) {
	t.Setenv("IGRIS_TEST_DOGFOOD_WEBHOOK_SECRET", "test-local-shared-secret")

	_, err := buildActionRunRequestFromDefinition(actionDefinition{
		ID:           "action-local-webhook",
		Name:         "repo.push_branch",
		TargetType:   "webhook",
		TargetURL:    "https://10.0.0.1/repo/push-branch",
		Method:       "POST",
		PolicyPreset: "Human-gated",
		ReplayClass:  "non_retryable",
		TargetMetadata: map[string]interface{}{
			localWebhookAuthHeaderNameMetadata: "X-Igris-Dogfood-Secret",
			localWebhookAuthSecretEnvMetadata:  "IGRIS_TEST_DOGFOOD_WEBHOOK_SECRET",
		},
	}, actionRunByNameRequest{Input: map[string]interface{}{"action": "repo.push_branch"}})
	require.Error(t, err)
	require.Contains(t, err.Error(), "denied address")
}

func TestBuildActionRunRequestFromDefinitionWebhookAuthAllowsExternalHTTPS(t *testing.T) {
	t.Setenv("IGRIS_TEST_DOGFOOD_WEBHOOK_SECRET", "test-local-shared-secret")
	prev := lookupIP
	lookupIP = func(host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("1.2.3.4")}, nil
	}
	t.Cleanup(func() { lookupIP = prev })

	req, err := buildActionRunRequestFromDefinition(actionDefinition{
		ID:           "action-external-webhook",
		Name:         "deploy.staging",
		TargetType:   "webhook",
		TargetURL:    "https://adapter.example.com/v1/deploy/staging",
		Method:       "POST",
		PolicyPreset: "Human-gated",
		ReplayClass:  "non_retryable",
		TargetMetadata: map[string]interface{}{
			localWebhookAuthHeaderNameMetadata: "X-Igris-Dogfood-Secret",
			localWebhookAuthSecretEnvMetadata:  "IGRIS_TEST_DOGFOOD_WEBHOOK_SECRET",
		},
	}, actionRunByNameRequest{Input: map[string]interface{}{"service": "api"}})
	require.NoError(t, err)
	require.Equal(t, "https://adapter.example.com/v1/deploy/staging", req.Input["url"])
	headers, ok := req.Input["headers"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, "test-local-shared-secret", headers["X-Igris-Dogfood-Secret"])
}

func TestBuildActionRunRequestFromDefinitionLocalAuthRequiresWebhookTarget(t *testing.T) {
	t.Setenv("IGRIS_TEST_DOGFOOD_WEBHOOK_SECRET", "test-local-shared-secret")

	_, err := buildActionRunRequestFromDefinition(actionDefinition{
		ID:           "action-local-hosted-api",
		Name:         "repo.run_tests",
		TargetType:   "hosted_api",
		TargetURL:    "http://127.0.0.1:18096/repo/run-tests",
		Method:       "POST",
		PolicyPreset: "Safe automation",
		ReplayClass:  "read_only",
		TargetMetadata: map[string]interface{}{
			localWebhookAuthHeaderNameMetadata: "X-Igris-Dogfood-Secret",
			localWebhookAuthSecretEnvMetadata:  "IGRIS_TEST_DOGFOOD_WEBHOOK_SECRET",
		},
	}, actionRunByNameRequest{Input: map[string]interface{}{"action": "repo.run_tests"}})
	require.Error(t, err)
	require.Contains(t, err.Error(), "webhook targets")
}

func TestBuildActionRunRequestFromDefinitionWebhookLocalAuthRequiresSecretEnv(t *testing.T) {
	_, err := buildActionRunRequestFromDefinition(actionDefinition{
		ID:           "action-local-webhook",
		Name:         "repo.open_pr",
		TargetType:   "webhook",
		TargetURL:    "http://localhost:18096/repo/open-pr",
		Method:       "POST",
		PolicyPreset: "Human-gated",
		ReplayClass:  "non_retryable",
		TargetMetadata: map[string]interface{}{
			localWebhookAuthHeaderNameMetadata: "X-Igris-Dogfood-Secret",
			localWebhookAuthSecretEnvMetadata:  "IGRIS_TEST_MISSING_DOGFOOD_WEBHOOK_SECRET",
		},
	}, actionRunByNameRequest{Input: map[string]interface{}{"action": "repo.open_pr"}})
	require.Error(t, err)
	require.Contains(t, err.Error(), "not configured")
}

func TestNormalizeActionDefinitionPreservesLocalAuthSecretEnvName(t *testing.T) {
	t.Parallel()

	def, err := normalizeActionDefinitionRequest(actionDefinitionRequest{
		Name:         "repo.run_tests",
		TargetType:   "webhook",
		TargetURL:    "http://127.0.0.1:18096/repo/run-tests",
		PolicyPreset: "Safe automation",
		TargetMetadata: map[string]interface{}{
			localWebhookAuthHeaderNameMetadata: "X-Igris-Dogfood-Secret",
			localWebhookAuthSecretEnvMetadata:  "IGRIS_DOGFOOD_DEV_GATEWAY_SECRET",
		},
	}, nil)
	require.NoError(t, err)
	require.Equal(t, "IGRIS_DOGFOOD_DEV_GATEWAY_SECRET", def.TargetMetadata[localWebhookAuthSecretEnvMetadata])
}

func TestSanitizeResponseHeadersHandlesAlreadyRedactedEnvelope(t *testing.T) {
	t.Parallel()

	require.NotPanics(t, func() {
		out := sanitizeResponseHeaders(map[string]interface{}{
			"input_redacted":           true,
			"redaction_policy_version": responseRedactionPolicyVersion,
			"sensitive_fields_redacted": []interface{}{
				"sensitive_header",
			},
			"X-Igris-Dogfood-Secret": map[string]interface{}{
				"input_redacted":      true,
				"safe_summary":        "sensitive_header",
				"input_digest_sha256": "digest",
			},
		})
		raw, err := json.Marshal(out)
		require.NoError(t, err)
		require.NotContains(t, string(raw), "test-local-shared-secret")
	})
}

func TestNormalizeActionDefinitionAcceptsHostedAPI(t *testing.T) {
	t.Parallel()

	def, err := normalizeActionDefinitionRequest(actionDefinitionRequest{
		Name:         "send_email",
		TargetType:   "hosted_api",
		TargetURL:    "https://example.com/send",
		PolicyPreset: "Safe automation",
	}, nil)
	require.NoError(t, err)
	require.Equal(t, "hosted_api", def.TargetType)
	require.False(t, def.FallbackPolicy.Enabled)
}

func TestNormalizeActionDefinitionRewritesDeprecatedAPIAlias(t *testing.T) {
	t.Parallel()

	def, err := normalizeActionDefinitionRequest(actionDefinitionRequest{
		Name:         "send_email",
		TargetType:   "api",
		TargetURL:    "https://example.com/send",
		PolicyPreset: "Safe automation",
	}, nil)
	require.NoError(t, err)
	require.Equal(t, "hosted_api", def.TargetType, "legacy `api` must canonicalize to hosted_api")
}

func TestNormalizeActionDefinitionAcceptsWebhook(t *testing.T) {
	t.Parallel()

	def, err := normalizeActionDefinitionRequest(actionDefinitionRequest{
		Name:         "create_ticket",
		TargetType:   "webhook",
		TargetURL:    "https://example.com/tickets",
		PolicyPreset: "Safe automation",
	}, nil)
	require.NoError(t, err)
	require.Equal(t, "webhook", def.TargetType)
}

func TestNormalizeActionDefinitionAcceptsLocalRuntime(t *testing.T) {
	t.Parallel()

	// Slice 1 must accept local_runtime in the registry even though dispatch
	// onto the local runtime is still stubbed in buildActionRunRequestFromDefinition.
	def, err := normalizeActionDefinitionRequest(actionDefinitionRequest{
		Name:         "rebuild_index",
		TargetType:   "local_runtime",
		PolicyPreset: "Safe automation",
	}, nil)
	require.NoError(t, err)
	require.Equal(t, "local_runtime", def.TargetType)
}

func TestBuildActionRunRequestFromDefinitionLocalRuntimeHTTPInput(t *testing.T) {
	t.Parallel()

	// local_runtime actions execute the customer's tool call on a connected
	// runtime; the registered definition only configures runtime selection.
	req, err := buildActionRunRequestFromDefinition(actionDefinition{
		ID:           "action-local",
		Name:         "fetch_internal_doc",
		TargetType:   "local_runtime",
		PolicyPreset: "Read-only",
		ReplayClass:  "read_only",
	}, actionRunByNameRequest{Input: map[string]interface{}{
		"url":    "http://intranet.local/doc/42",
		"method": "GET",
	}})
	require.NoError(t, err, "local_runtime dispatch must no longer be stubbed")
	require.Equal(t, "fetch_internal_doc", req.Action)
	require.Equal(t, "local_runtime", req.Metadata["target_type"])
	// executedTarget is internal but governs the post-Submit stamp.
	require.Equal(t, "local_runtime", req.executedTarget)
	require.Empty(t, req.preferredRuntimeID, "no runtime_id selector → unpinned")

	// The execution-graph builder infers http_request from the input, giving
	// the runtime the same tool surface used by hosted_api/webhook actions.
	taskReq, err := buildActionTaskSubmitRequest(req, "tenant-local")
	require.NoError(t, err)
	require.Equal(t, "execution_graph", taskReq.TaskType)
	var def map[string]interface{}
	require.NoError(t, json.Unmarshal(taskReq.TaskDefinition, &def))
	node := def["graph"].(map[string]interface{})["nodes"].([]interface{})[0].(map[string]interface{})
	require.Equal(t, "http_request", node["tool_name"])
}

func TestHandleActionRunLocalRuntimeFailsSafelyWithNoRoutableRuntime(t *testing.T) {
	t.Parallel()

	now := time.Now().UTC()
	db, driver := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: actionDefinitionColumns(),
			rows: [][]driver.Value{{
				"action-local-runtime",
				"tenant-a",
				"read_private_doc",
				"Read Private Doc",
				"",
				"local_runtime",
				"",
				"",
				"read_only",
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
		},
		{
			columns: []string{"endpoint"},
			rows: [][]driver.Value{
				{" "},
				{"not-a-url"},
				{"ftp://runtime.internal"},
			},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM runtime_instances")
				require.Contains(t, query, "BTRIM(endpoint) <> ''")
				require.Equal(t, "tenant-a", args[0].Value)
			},
		},
	})
	app := actionTestApp()
	app.Post("/v1/actions/run", handleActionRun(db, coordinator.NewTaskCoordinator(db)))

	body := `{
		"action_id": "action-local-runtime",
		"input": {"tool_name":"filesystem","args":{"path":"/private/doc.txt"}},
		"idempotency_key": "local-runtime-no-route"
	}`
	req := httptest.NewRequest(http.MethodPost, "/v1/actions/run", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusServiceUnavailable, resp.StatusCode)

	raw, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Contains(t, string(raw), "runtime_unavailable")
	require.NotContains(t, string(raw), "not-a-url")
	require.NotContains(t, string(raw), "runtime.internal")
	require.Equal(t, 0, driver.remainingQueries())
	require.Equal(t, 0, driver.remainingExecs())
}

func TestBuildActionRunRequestFromDefinitionLocalRuntimePinsRuntime(t *testing.T) {
	t.Parallel()

	// target_metadata.runtime_id pins dispatch to a specific tenant runtime.
	// The pin survives onto the coordinator submit request as PreferredRuntimeID.
	req, err := buildActionRunRequestFromDefinition(actionDefinition{
		ID:           "action-local-pin",
		Name:         "list_local_files",
		TargetType:   "local_runtime",
		PolicyPreset: "Read-only",
		ReplayClass:  "read_only",
		TargetMetadata: map[string]interface{}{
			"runtime_id":              "runtime_pinned",
			"working_directory_label": "workspace",
		},
	}, actionRunByNameRequest{Input: map[string]interface{}{
		"path":      "/srv/data",
		"operation": "read",
	}})
	require.NoError(t, err)
	require.Equal(t, "runtime_pinned", req.preferredRuntimeID)
	taskReq, err := buildActionTaskSubmitRequest(req, "tenant-local")
	require.NoError(t, err)
	require.Equal(t, "runtime_pinned", taskReq.PreferredRuntimeID)
}

func TestBuildActionRunRequestFromDefinitionLocalRuntimeRequiresInput(t *testing.T) {
	t.Parallel()

	_, err := buildActionRunRequestFromDefinition(actionDefinition{
		Name:       "noop",
		TargetType: "local_runtime",
	}, actionRunByNameRequest{Input: nil})
	require.Error(t, err)
	require.Contains(t, err.Error(), "input is required")
}

func TestNormalizeActionDefinitionHybridFallbackRequiresPolicy(t *testing.T) {
	t.Parallel()

	// Missing policy → reject.
	_, err := normalizeActionDefinitionRequest(actionDefinitionRequest{
		Name:         "wire_transfer",
		TargetType:   "hybrid_fallback",
		PolicyPreset: "Safe automation",
	}, nil)
	require.Error(t, err)
	require.Contains(t, err.Error(), "fallback_policy.enabled")

	// Disabled policy → reject.
	disabled := actionFallbackPolicy{Enabled: false, PrimaryTarget: "local_runtime", SecondaryTarget: "hosted_api"}
	_, err = normalizeActionDefinitionRequest(actionDefinitionRequest{
		Name:           "wire_transfer",
		TargetType:     "hybrid_fallback",
		PolicyPreset:   "Safe automation",
		FallbackPolicy: &disabled,
	}, nil)
	require.Error(t, err)

	// Same primary/secondary → reject.
	same := actionFallbackPolicy{Enabled: true, PrimaryTarget: "hosted_api", SecondaryTarget: "hosted_api"}
	_, err = normalizeActionDefinitionRequest(actionDefinitionRequest{
		Name:           "wire_transfer",
		TargetType:     "hybrid_fallback",
		PolicyPreset:   "Safe automation",
		FallbackPolicy: &same,
	}, nil)
	require.Error(t, err)

	// Nested hybrid_fallback as a target → reject.
	nested := actionFallbackPolicy{Enabled: true, PrimaryTarget: "hybrid_fallback", SecondaryTarget: "hosted_api"}
	_, err = normalizeActionDefinitionRequest(actionDefinitionRequest{
		Name:           "wire_transfer",
		TargetType:     "hybrid_fallback",
		PolicyPreset:   "Safe automation",
		FallbackPolicy: &nested,
	}, nil)
	require.Error(t, err)

	// Valid explicit policy with deprecated `api` alias on secondary is
	// canonicalized to `hosted_api`.
	good := actionFallbackPolicy{Enabled: true, PrimaryTarget: "local_runtime", SecondaryTarget: "api"}
	def, err := normalizeActionDefinitionRequest(actionDefinitionRequest{
		Name:           "wire_transfer",
		TargetType:     "hybrid_fallback",
		PolicyPreset:   "Safe automation",
		FallbackPolicy: &good,
	}, nil)
	require.NoError(t, err)
	require.Equal(t, "hybrid_fallback", def.TargetType)
	require.True(t, def.FallbackPolicy.Enabled)
	require.Equal(t, "local_runtime", def.FallbackPolicy.PrimaryTarget)
	require.Equal(t, "hosted_api", def.FallbackPolicy.SecondaryTarget)

	// hybrid_fallback resolver itself is not wired in this slice.
	_, runErr := buildActionRunRequestFromDefinition(def, actionRunByNameRequest{Input: map[string]interface{}{"amount": 100}})
	require.Error(t, runErr)
	require.Contains(t, runErr.Error(), "hybrid_fallback")
}

func TestNormalizeActionDefinitionRejectsIrreversibleFallbackByDefault(t *testing.T) {
	t.Parallel()

	irreversible := true
	policy := actionFallbackPolicy{Enabled: true, PrimaryTarget: "local_runtime", SecondaryTarget: "hosted_api"}
	_, err := normalizeActionDefinitionRequest(actionDefinitionRequest{
		Name:           "purge_user",
		TargetType:     "hybrid_fallback",
		PolicyPreset:   "Non-replayable",
		Irreversible:   &irreversible,
		FallbackPolicy: &policy,
	}, nil)
	require.Error(t, err)
	require.Contains(t, err.Error(), "irreversible")

	// Opt-in path: requires_replay_safe=true acknowledges the caller has
	// reasoned about replay safety, and the model accepts it.
	policy.RequiresReplaySafe = true
	_, err = normalizeActionDefinitionRequest(actionDefinitionRequest{
		Name:           "purge_user",
		TargetType:     "hybrid_fallback",
		PolicyPreset:   "Non-replayable",
		Irreversible:   &irreversible,
		FallbackPolicy: &policy,
	}, nil)
	require.NoError(t, err)
}

func TestNormalizeActionDefinitionRejectsInvalidTargetType(t *testing.T) {
	t.Parallel()

	_, err := normalizeActionDefinitionRequest(actionDefinitionRequest{
		Name:         "send_email",
		TargetType:   "rocket_ship",
		PolicyPreset: "Safe automation",
	}, nil)
	require.Error(t, err)
	require.Contains(t, err.Error(), "hosted_api")
}

func TestBuildActionRunRequestFromDefinitionHostedAPI(t *testing.T) {
	t.Parallel()

	// hosted_api dispatches identically to webhook, but stamps the canonical
	// target on run metadata so the inspector can render "Routed via hosted_api".
	req, err := buildActionRunRequestFromDefinition(actionDefinition{
		ID:           "action-hosted",
		Name:         "send_email",
		TargetType:   "hosted_api",
		TargetURL:    "https://example.com/send",
		Method:       "POST",
		PolicyPreset: "Safe automation",
		ReplayClass:  "retryable",
	}, actionRunByNameRequest{Input: map[string]interface{}{"to": "user@example.com"}})
	require.NoError(t, err)
	require.Equal(t, "http_request", req.RuntimeTarget)
	require.Equal(t, "https://example.com/send", req.Input["url"])
	require.Equal(t, "hosted_api", req.Metadata["target_type"])
}

func TestScanActionDefinitionCanonicalizesLegacyAPIRows(t *testing.T) {
	t.Parallel()

	// Simulate a row persisted before migration 055: target_type is still the
	// legacy `api` and fallback_policy carries the legacy alias on its targets.
	// The scanner must rewrite both so the API surface never exposes `api`.
	now := time.Now().UTC()
	actionID := uuid.NewString()
	db, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: actionDefinitionColumns(),
		rows: [][]driver.Value{{
			actionID, "tenant-a", "send_email", "send_email", "",
			"api", "https://example.com/send", "POST",
			"Safe automation", "retryable", false, false,
			[]byte(`[]`), []byte(`{}`),
			[]byte(`{"enabled": true, "primary_target": "local_runtime", "secondary_target": "api", "requires_replay_safe": true}`),
			now, now, nil,
		}},
	}})

	def, err := loadActionDefinitionByID(t.Context(), db, "tenant-a", actionID)
	require.NoError(t, err)
	require.Equal(t, "hosted_api", def.TargetType, "scanner must canonicalize legacy `api` on read")
	require.Equal(t, "hosted_api", def.FallbackPolicy.SecondaryTarget, "scanner must canonicalize nested policy targets on read")
	require.Equal(t, "local_runtime", def.FallbackPolicy.PrimaryTarget, "non-legacy targets must pass through unchanged")
}

func TestBuildActionRunRequestFromDefinitionLegacyAPIRouteAsHostedAPI(t *testing.T) {
	t.Parallel()

	// Persisted rows that still carry the legacy `api` value continue to
	// dispatch correctly and present as the canonical `hosted_api` on metadata.
	req, err := buildActionRunRequestFromDefinition(actionDefinition{
		ID:           "action-legacy",
		Name:         "send_email",
		TargetType:   "api",
		TargetURL:    "https://example.com/send",
		Method:       "POST",
		PolicyPreset: "Safe automation",
		ReplayClass:  "retryable",
	}, actionRunByNameRequest{Input: map[string]interface{}{"to": "user@example.com"}})
	require.NoError(t, err)
	require.Equal(t, "http_request", req.RuntimeTarget)
	require.Equal(t, "hosted_api", req.Metadata["target_type"])
}

func TestValidateActionName(t *testing.T) {
	t.Parallel()

	require.True(t, validActionName("send_email"))
	require.True(t, validActionName("a1"))
	require.False(t, validActionName("../secret"))
	require.False(t, validActionName("SendEmail"))
	require.False(t, validActionName("x"))
	require.False(t, validActionName("send-email"))
}

func TestNormalizeActionDefinitionDoesNotExposeSecretValues(t *testing.T) {
	t.Parallel()

	def, err := normalizeActionDefinitionRequest(actionDefinitionRequest{
		Name:         "send_email",
		TargetType:   "api",
		TargetURL:    "https://example.com/send",
		Method:       "POST",
		PolicyPreset: "Safe automation",
		SecretRefs:   []string{"vault:api-key"},
	}, nil)
	require.NoError(t, err)
	raw, err := json.Marshal(def)
	require.NoError(t, err)
	require.Contains(t, string(raw), "vault:api-key")
	require.NotContains(t, string(raw), "sk-live")
}

func TestNormalizeActionDefinitionRedactsSensitiveInputMetadata(t *testing.T) {
	t.Parallel()

	const marker = "IGRIS_SHOULD_NEVER_PERSIST_INPUT_SECRET"
	def, err := normalizeActionDefinitionRequest(actionDefinitionRequest{
		Name:         "send_email",
		TargetType:   "webhook",
		TargetURL:    "https://api.example.test/send?token=" + marker,
		Method:       "POST",
		PolicyPreset: "Safe automation",
		TargetMetadata: map[string]interface{}{
			"headers": map[string]interface{}{
				"Authorization": "Bearer " + marker,
				"Cookie":        "session=" + marker,
				"Content-Type":  "application/json",
			},
			"request_body": marker,
			"file_path":    "/Users/customer/private/" + marker + ".json",
		},
	}, nil)
	require.NoError(t, err)

	raw, err := json.Marshal(def)
	require.NoError(t, err)
	body := string(raw)
	require.NotContains(t, body, marker)
	require.NotContains(t, body, "?token=")
	require.NotContains(t, body, "Bearer")
	require.NotContains(t, body, "session=")
	require.NotContains(t, body, "/Users/customer/private")
	require.Contains(t, body, "https://api.example.test/send")
	require.Contains(t, body, "input_redacted")
	require.Contains(t, body, "input_digest_sha256")
}

func TestNormalizeActionDefinitionRejectsRawSecretRefs(t *testing.T) {
	t.Parallel()

	_, err := normalizeActionDefinitionRequest(actionDefinitionRequest{
		Name:         "send_email",
		TargetType:   "webhook",
		TargetURL:    "https://api.example.test/send",
		Method:       "POST",
		PolicyPreset: "Safe automation",
		SecretRefs:   []string{"sk-live-IGRIS_SHOULD_NEVER_PERSIST_INPUT_SECRET"},
	}, nil)
	require.Error(t, err)
	require.Contains(t, err.Error(), "secret_refs must contain references")
	require.NotContains(t, err.Error(), "IGRIS_SHOULD_NEVER_PERSIST_INPUT_SECRET")
}

func TestScanActionDefinitionRedactsHistoricalUnsafeMetadata(t *testing.T) {
	t.Parallel()

	const marker = "IGRIS_SHOULD_NEVER_PERSIST_INPUT_SECRET"
	now := time.Now().UTC()
	actionID := uuid.NewString()
	db, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: actionDefinitionColumns(),
		rows: [][]driver.Value{{
			actionID, "tenant-a", "send_email", "send_email", "",
			"webhook", "https://api.example.test/send?token=" + marker, "POST",
			"Safe automation", "retryable", false, false,
			[]byte(`[]`),
			[]byte(`{"headers":{"Authorization":"Bearer ` + marker + `"},"path":"/Users/customer/private/` + marker + `.txt","body":"` + marker + `"}`),
			[]byte(`{"enabled": false}`),
			now, now, nil,
		}},
	}})

	def, err := loadActionDefinitionByID(t.Context(), db, "tenant-a", actionID)
	require.NoError(t, err)
	raw, err := json.Marshal(def)
	require.NoError(t, err)
	body := string(raw)
	require.NotContains(t, body, marker)
	require.NotContains(t, body, "?token=")
	require.NotContains(t, body, "Bearer")
	require.NotContains(t, body, "/Users/customer/private")
	require.Contains(t, body, "input_redacted")
}

func TestScanActionDefinitionRedactsHistoricalUnsafeSecretRefs(t *testing.T) {
	t.Parallel()

	const marker = "IGRIS_SHOULD_NEVER_PERSIST_INPUT_SECRET"
	now := time.Now().UTC()
	actionID := uuid.NewString()
	db, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: actionDefinitionColumns(),
		rows: [][]driver.Value{{
			actionID, "tenant-a", "send_email", "send_email", "",
			"webhook", "https://api.example.test/send", "POST",
			"Safe automation", "retryable", false, false,
			[]byte(`["vault:send-email","sk-live-` + marker + `"]`),
			[]byte(`{}`),
			[]byte(`{"enabled": false}`),
			now, now, nil,
		}},
	}})

	def, err := loadActionDefinitionByID(t.Context(), db, "tenant-a", actionID)
	require.NoError(t, err)
	raw, err := json.Marshal(def)
	require.NoError(t, err)
	body := string(raw)
	require.Contains(t, body, "vault:send-email")
	require.Contains(t, body, "redacted:")
	require.NotContains(t, body, marker)
	require.NotContains(t, body, "sk-live")
}

func TestHandleActionCreatePersistsDefinition(t *testing.T) {
	t.Parallel()

	actionID := uuid.NewString()
	now := time.Now().UTC()
	db, driver := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: actionDefinitionColumns(),
			rows: [][]driver.Value{{
				actionID,
				"tenant-a",
				"send_email",
				"send_email",
				"Let the agent request an email send.",
				"mock_demo",
				"",
				"POST",
				"Safe automation",
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
		},
	})
	app := actionTestApp()
	app.Post("/v1/actions", handleActionCreate(db))

	body := `{"name":"send_email","description":"Let the agent request an email send.","target_type":"mock_demo","policy_preset":"Safe automation"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/actions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	require.Equal(t, 0, driver.remainingQueries())
}

func TestHandleActionCreateDoesNotPersistRawSensitiveInputMetadata(t *testing.T) {
	t.Parallel()

	const marker = "IGRIS_SHOULD_NEVER_PERSIST_INPUT_SECRET"
	actionID := uuid.NewString()
	now := time.Now().UTC()
	db, driver := newQueuedRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: actionDefinitionColumns(),
			rows: [][]driver.Value{{
				actionID,
				"tenant-a",
				"unsafe_action",
				"unsafe_action",
				"",
				"webhook",
				"https://api.example.test/hook",
				"POST",
				"Safe automation",
				"retryable",
				false,
				false,
				[]byte(`["vault:send-email"]`),
				[]byte(`{"headers":{"Content-Type":"application/json"},"request_body":{"input_redacted":true,"input_digest_sha256":"digest","input_bytes":64,"redaction_policy_version":"api-response-redaction-v1"}}`),
				[]byte(`{"enabled": false}`),
				now,
				now,
				nil,
			}},
			checkArgs: func(_ string, args []driver.NamedValue) {
				require.Len(t, args, 15)
				targetURL := args[6].Value.(string)
				secretRefs := args[12].Value.(string)
				targetMetadata := args[13].Value.(string)
				combined := targetURL + " " + secretRefs + " " + targetMetadata
				require.NotContains(t, combined, marker)
				require.NotContains(t, combined, "?token=")
				require.NotContains(t, combined, "Bearer")
				require.NotContains(t, combined, "session=")
				require.NotContains(t, combined, "/Users/customer/private")
				require.Contains(t, targetURL, "https://api.example.test/hook")
				require.Contains(t, targetMetadata, "input_redacted")
				require.Contains(t, targetMetadata, "input_digest_sha256")
			},
		},
	})
	app := actionTestApp()
	app.Post("/v1/actions", handleActionCreate(db))

	body := `{
		"name":"unsafe_action",
		"target_type":"webhook",
		"target_url":"https://api.example.test/hook?token=` + marker + `",
		"method":"POST",
		"policy_preset":"Safe automation",
		"secret_refs":["vault:send-email"],
		"target_metadata":{
			"headers":{
				"Authorization":"Bearer ` + marker + `",
				"Cookie":"session=` + marker + `",
				"Content-Type":"application/json"
			},
			"request_body":"` + marker + `",
			"file_path":"/Users/customer/private/` + marker + `.json"
		}
	}`
	req := httptest.NewRequest(http.MethodPost, "/v1/actions", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	require.Equal(t, 0, driver.remainingQueries())
}

func TestHandleActionGetIsTenantScoped(t *testing.T) {
	t.Parallel()

	db, _ := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{columns: actionDefinitionColumns(), err: sql.ErrNoRows}})
	app := actionTestApp()
	app.Get("/v1/actions/:id", handleActionGet(db))

	req := httptest.NewRequest(http.MethodGet, "/v1/actions/action-other-tenant", nil)
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
}

func TestHandleActionRunByNameRejectsInvalidName(t *testing.T) {
	t.Parallel()

	db, driver := newQueuedRouteDB(t, nil)
	app := actionTestApp()
	app.Post("/v1/actions/:name/run", handleActionRunByName(db, nil))

	req := httptest.NewRequest(http.MethodPost, "/v1/actions/SendEmail/run", strings.NewReader(`{}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Equal(t, 0, driver.remainingQueries())
}

func TestHandleActionRunByNameReturnsActionNotFound(t *testing.T) {
	t.Parallel()

	db, driver := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{columns: actionDefinitionColumns(), err: sql.ErrNoRows}})
	app := actionTestApp()
	app.Post("/v1/actions/:name/run", handleActionRunByName(db, nil))

	req := httptest.NewRequest(http.MethodPost, "/v1/actions/send_email/run", strings.NewReader(`{"input":{"demo":true}}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
	require.Equal(t, 0, driver.remainingQueries())
}

func TestHandleActionRunRejectsRawTaskPayloadWithoutRegisteredAction(t *testing.T) {
	t.Parallel()

	db, driver := newQueuedRouteDB(t, nil)
	app := actionTestApp()
	app.Post("/v1/actions/run", handleActionRun(db, nil))

	body := `{
		"task_type":"execution_graph",
		"task_definition":{"graph":{"nodes":[{"kind":"tool","tool_name":"http_request","args":{"url":"https://example.test"}}]}},
		"runtime_target":"http_request",
		"input":{"url":"https://example.test"}
	}`
	req := httptest.NewRequest(http.MethodPost, "/v1/actions/run", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	require.Equal(t, 0, driver.remainingQueries(), "raw payload must be rejected before action lookup")
	require.Equal(t, 0, driver.remainingExecs(), "raw payload must not create a task")
}

func TestHandleActionRunRequiresRegisteredAction(t *testing.T) {
	t.Parallel()

	db, driver := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: actionDefinitionColumns(),
		err:     sql.ErrNoRows,
		checkArgs: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "FROM action_definitions")
			require.Contains(t, query, "WHERE tenant_id = $1")
			require.Equal(t, "tenant-a", args[0].Value)
			require.Equal(t, "missing_action", args[1].Value)
		},
	}})
	app := actionTestApp()
	app.Post("/v1/actions/run", handleActionRun(db, nil))

	req := httptest.NewRequest(http.MethodPost, "/v1/actions/run", strings.NewReader(`{"action":"missing_action","input":{"ok":true}}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
	require.Equal(t, 0, driver.remainingQueries())
	require.Equal(t, 0, driver.remainingExecs())
}

func TestHandleActionRunDoesNotRevealCrossTenantActionID(t *testing.T) {
	t.Parallel()

	db, driver := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: actionDefinitionColumns(),
		err:     sql.ErrNoRows,
		checkArgs: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "WHERE tenant_id = $1 AND id = $2")
			require.Equal(t, "tenant-a", args[0].Value)
			require.Equal(t, "action-owned-by-tenant-b", args[1].Value)
		},
	}})
	app := actionTestApp()
	app.Post("/v1/actions/run", handleActionRun(db, nil))

	req := httptest.NewRequest(http.MethodPost, "/v1/actions/run", strings.NewReader(`{"action_id":"action-owned-by-tenant-b","input":{"ok":true}}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
	require.Equal(t, 0, driver.remainingQueries())
	require.Equal(t, 0, driver.remainingExecs())
}

func TestHandleActionRunUsesRegisteredActionDefinition(t *testing.T) {
	t.Parallel()

	now := time.Now().UTC()
	db, driver := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: actionDefinitionColumns(),
		rows: [][]driver.Value{{
			"action-webhook",
			"tenant-a",
			"send_webhook",
			"send_webhook",
			"",
			"webhook",
			"",
			"POST",
			"Safe automation",
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
			require.Contains(t, query, "WHERE tenant_id = $1 AND id = $2")
			require.Equal(t, "tenant-a", args[0].Value)
			require.Equal(t, "action-webhook", args[1].Value)
		},
	}})
	app := actionTestApp()
	app.Post("/v1/actions/run", handleActionRun(db, nil))

	body := `{
		"action_id":"action-webhook",
		"runtime_target":"database_write",
		"input":{"raw":"caller input"}
	}`
	req := httptest.NewRequest(http.MethodPost, "/v1/actions/run", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusConflict, resp.StatusCode)
	require.Equal(t, 0, driver.remainingQueries())
	require.Equal(t, 0, driver.remainingExecs(), "registered-action validation must happen before task creation")
}

func TestHandleActionRunRegisteredActionDispatchesToFakeRuntime(t *testing.T) {
	now := time.Now().UTC()
	_, privateKey, err := ed25519.GenerateKey(nil)
	require.NoError(t, err)
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY", hex.EncodeToString(privateKey))
	t.Setenv("IGRIS_OVERTURE_SIGNING_KEY_VERSION", "action-route-runtime-test")

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
	http.DefaultTransport = actionRunRoundTripperFunc(func(req *http.Request) (*http.Response, error) {
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
			require.Equal(t, "tenant-a", args[2].Value)
		case strings.Contains(query, "INSERT INTO ai_capability_decision_audit"):
			atomic.AddInt32(&capabilityAuditWrites, 1)
			require.Equal(t, createdTaskID.String(), driverValueString(args[1].Value))
			require.Equal(t, "tenant-a", args[2].Value)
			require.Equal(t, "runtime-actions-fake", args[3].Value)
			require.Equal(t, "tools.database_write", args[4].Value)
		case strings.Contains(query, "SET executed_target = $3"):
			atomic.AddInt32(&stampWrites, 1)
			require.Equal(t, createdTaskID.String(), driverValueString(args[0].Value))
			require.Equal(t, "tenant-a", args[1].Value)
			require.Equal(t, actionTargetMockDemo, args[2].Value)
		default:
			require.Failf(t, "unexpected exec", "query: %s", query)
		}
	}
	const runtimeEndpoint = "http://runtime.actions.test"
	db, driver := newQueuedExecRouteDB(t, []queuedRouteQueryExpectation{
		{
			columns: actionDefinitionColumns(),
			rows: [][]driver.Value{{
				"action-mock-dispatch",
				"tenant-a",
				"registered_mock_action",
				"Registered Mock Action",
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
				require.Equal(t, "tenant-a", args[0].Value)
				require.Equal(t, "action-mock-dispatch", args[1].Value)
			},
		},
		{
			columns: []string{"runtime_id", "endpoint"},
			rows:    [][]driver.Value{{"runtime-actions-fake", runtimeEndpoint}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "FROM runtime_instances")
				require.Contains(t, query, "WHERE ri.tenant_id = $1")
				require.Equal(t, "tenant-a", args[0].Value)
			},
		},
		{
			columns: []string{"policy"},
			rows: [][]driver.Value{{
				[]byte(`{"policy_version":"capabilities.action-route-test","allowed_capabilities":["tools.database_write"]}`),
			}},
			checkArgs: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "ai_capability_policy_settings")
				require.Equal(t, "tenant-a", args[0].Value)
			},
		},
	},
		queuedRouteExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				require.Contains(t, query, "INSERT INTO task_records")
				require.Equal(t, "tenant-a", args[1].Value)
				require.Equal(t, string(coordinator.TaskStatusPending), args[2].Value)
				require.Equal(t, "action-run-idempotency-1", args[4].Value)

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
				require.Equal(t, "runtime-actions-fake", args[1].Value)
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
	app := actionTestApp()
	app.Post("/v1/actions/run", handleActionRun(db, coordinator.NewTaskCoordinator(db)))

	body := `{
		"tenant_id": "tenant-b",
		"action_id": "action-mock-dispatch",
		"runtime_target": "caller-filesystem-override",
		"input": {"ok": true, "message": "route-to-runtime"},
		"metadata": {"agent_id": "agent-route-test", "user_id": "user-route-test"},
		"idempotency_key": "action-run-idempotency-1"
	}`
	req := httptest.NewRequest(http.MethodPost, "/v1/actions/run", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusAccepted, resp.StatusCode)

	var apiResp map[string]interface{}
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&apiResp))
	require.Equal(t, createdTaskID.String(), apiResp["task_id"])
	require.Equal(t, "dispatched", apiResp["status"])
	require.Equal(t, "registered_mock_action", apiResp["action_name"])
	require.Equal(t, "mock_demo", apiResp["target_type"])
	require.Equal(t, actionTargetMockDemo, apiResp["selected_target"])

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
	require.Equal(t, "tenant-a", captured.tenantHeader)
	require.Equal(t, createdTaskID.String(), captured.body["task_id"])
	require.Equal(t, "tenant-a", captured.body["tenant_id"])
	require.Equal(t, "action-run-idempotency-1", captured.body["idempotency_key"])
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
	require.Equal(t, "registered_mock_action", record["action"])
	require.Equal(t, "action-mock-dispatch", record["action_definition_id"])
	require.Equal(t, true, record["created_by_gateway"])
	requestedInput, ok := record["requested_input"].(map[string]interface{})
	require.True(t, ok)
	require.Equal(t, true, requestedInput["ok"])
	require.Equal(t, "route-to-runtime", requestedInput["message"])
	require.Equal(t, int32(2), atomic.LoadInt32(&permissionAuditWrites))
	require.Equal(t, int32(2), atomic.LoadInt32(&capabilityAuditWrites))
	require.Equal(t, int32(1), atomic.LoadInt32(&stampWrites))

	require.Equal(t, 0, driver.remainingQueries())
	require.Equal(t, 0, driver.remainingExecs())
}

func TestHandleActionRunIgnoresBodyTenantOverride(t *testing.T) {
	t.Parallel()

	db, driver := newQueuedRouteDB(t, []queuedRouteQueryExpectation{{
		columns: actionDefinitionColumns(),
		err:     sql.ErrNoRows,
		checkArgs: func(query string, args []driver.NamedValue) {
			require.Contains(t, query, "WHERE tenant_id = $1 AND id = $2")
			require.Equal(t, "tenant-a", args[0].Value)
			require.Equal(t, "action-1", args[1].Value)
		},
	}})
	app := actionTestApp()
	app.Post("/v1/actions/run", handleActionRun(db, nil))

	req := httptest.NewRequest(http.MethodPost, "/v1/actions/run", strings.NewReader(`{"tenant_id":"tenant-b","action_id":"action-1","input":{"ok":true}}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err := app.Test(req)
	require.NoError(t, err)
	require.Equal(t, http.StatusNotFound, resp.StatusCode)
	require.Equal(t, 0, driver.remainingQueries())
	require.Equal(t, 0, driver.remainingExecs())
}

func actionTestApp() *fiber.App {
	app := fiber.New()
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("clerk_user_id", "tenant-a")
		return c.Next()
	})
	return app
}

func actionDefinitionColumns() []string {
	return []string{
		"id",
		"tenant_id",
		"name",
		"display_name",
		"description",
		"target_type",
		"target_url",
		"method",
		"policy_preset",
		"replay_class",
		"approval_required",
		"irreversible",
		"secret_refs",
		"target_metadata",
		"fallback_policy",
		"created_at",
		"updated_at",
		"archived_at",
	}
}

type queuedExecDriver struct {
	inner *queuedRouteDriver
}

func newQueuedExecRouteDB(t *testing.T, queries []queuedRouteQueryExpectation, execs ...queuedRouteExecExpectation) (*sql.DB, *queuedRouteDriver) {
	t.Helper()

	name := "queued-exec-route-" + uuid.NewString()
	inner := &queuedRouteDriver{
		queries: append([]queuedRouteQueryExpectation(nil), queries...),
		execs:   append([]queuedRouteExecExpectation(nil), execs...),
	}
	sql.Register(name, &queuedExecDriver{inner: inner})

	db, err := sql.Open(name, "")
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	t.Cleanup(func() {
		_ = db.Close()
	})

	return db, inner
}

func (d *queuedExecDriver) Open(string) (driver.Conn, error) {
	return &queuedRouteConn{driver: d.inner}, nil
}

type actionRunRoundTripperFunc func(*http.Request) (*http.Response, error)

func (fn actionRunRoundTripperFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return fn(req)
}

func requireDriverUUID(t *testing.T, value interface{}) uuid.UUID {
	t.Helper()
	id, err := uuid.Parse(driverValueString(value))
	require.NoError(t, err)
	return id
}

func requireDriverBytes(t *testing.T, value interface{}) []byte {
	t.Helper()
	switch typed := value.(type) {
	case []byte:
		return typed
	case string:
		return []byte(typed)
	default:
		require.Failf(t, "unexpected driver value", "type %T cannot be converted to bytes", value)
		return nil
	}
}

func driverValueString(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return typed
	case []byte:
		return string(typed)
	case uuid.UUID:
		return typed.String()
	default:
		return ""
	}
}
