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
	})

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

	// Behavior must not change yet — the run builder still refuses to dispatch.
	_, runErr := buildActionRunRequestFromDefinition(def, actionRunByNameRequest{Input: map[string]interface{}{"x": 1}})
	require.Error(t, runErr)
	require.Contains(t, runErr.Error(), "local runtime")
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
