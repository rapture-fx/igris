package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/Igris-inertial/system/igris-overture/coordinator"
	infrarouter "github.com/Igris-inertial/system/igris-overture/inference/router"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
	"github.com/Igris-inertial/system/igris-overture/providers/openai"
)

type stubRuntimeExecutor struct {
	forwardResp *models.InferResponse
	forwardErr  error
	streamResp  *http.Response
	streamErr   error
}

func (s *stubRuntimeExecutor) ForwardExecution(context.Context, string, *models.InferRequest, string) (*models.InferResponse, error) {
	return s.forwardResp, s.forwardErr
}

func (s *stubRuntimeExecutor) OpenStreamingExecution(context.Context, string, *models.InferRequest, string) (*http.Response, error) {
	return s.streamResp, s.streamErr
}

func (s *stubRuntimeExecutor) Health(context.Context) error {
	return nil
}

func (s *stubRuntimeExecutor) BaseURL() string {
	return "http://runtime.test"
}

type queuedInferExecExpectation struct {
	rowsAffected int64
	err          error
	check        func(query string, args []driver.NamedValue)
}

type queuedInferExecDriver struct {
	execs []queuedInferExecExpectation
}

type queuedInferExecConn struct {
	driver *queuedInferExecDriver
}

type queuedInferExecTx struct {
	driver *queuedInferExecDriver
}

func newQueuedInferExecDB(t *testing.T, expectations ...queuedInferExecExpectation) (*sql.DB, *queuedInferExecDriver) {
	t.Helper()

	name := "queued-infer-" + uuid.NewString()
	driverImpl := &queuedInferExecDriver{execs: append([]queuedInferExecExpectation(nil), expectations...)}
	sql.Register(name, driverImpl)

	db, err := sql.Open(name, "")
	if err != nil {
		t.Fatalf("sql.Open() error = %v", err)
	}
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	t.Cleanup(func() {
		_ = db.Close()
	})

	return db, driverImpl
}

func (d *queuedInferExecDriver) Open(string) (driver.Conn, error) {
	return &queuedInferExecConn{driver: d}, nil
}

func (d *queuedInferExecDriver) nextExec(query string, args []driver.NamedValue) (driver.Result, error) {
	if len(d.execs) == 0 {
		return nil, errors.New("unexpected exec")
	}
	next := d.execs[0]
	d.execs = d.execs[1:]
	if next.check != nil {
		next.check(query, args)
	}
	if next.err != nil {
		return nil, next.err
	}
	return driver.RowsAffected(next.rowsAffected), nil
}

func (d *queuedInferExecDriver) remainingExecs() int {
	return len(d.execs)
}

func (c *queuedInferExecConn) Prepare(string) (driver.Stmt, error) {
	return nil, errors.New("prepare not implemented")
}

func (c *queuedInferExecConn) Close() error {
	return nil
}

func (c *queuedInferExecConn) Begin() (driver.Tx, error) {
	return queuedInferExecTx{driver: c.driver}, nil
}

func (c *queuedInferExecConn) BeginTx(context.Context, driver.TxOptions) (driver.Tx, error) {
	return queuedInferExecTx{driver: c.driver}, nil
}

func (c *queuedInferExecConn) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	return c.driver.nextExec(query, args)
}

func (c *queuedInferExecConn) QueryContext(_ context.Context, _ string, _ []driver.NamedValue) (driver.Rows, error) {
	return nil, errors.New("unexpected query")
}

func (tx queuedInferExecTx) Commit() error {
	return nil
}

func (tx queuedInferExecTx) Rollback() error {
	return nil
}

func (tx queuedInferExecTx) ExecContext(_ context.Context, query string, args []driver.NamedValue) (driver.Result, error) {
	return tx.driver.nextExec(query, args)
}

func (tx queuedInferExecTx) QueryContext(_ context.Context, _ string, _ []driver.NamedValue) (driver.Rows, error) {
	return nil, errors.New("unexpected query")
}

type failingStreamProvider struct{}

func (f failingStreamProvider) Name() string { return "failing-stream" }

func (f failingStreamProvider) Infer(context.Context, *models.InferRequest) (*models.InferResponse, error) {
	return nil, errors.New("unexpected non-stream infer")
}

func (f failingStreamProvider) InferStream(context.Context, *models.InferRequest) (<-chan *models.StreamChunk, <-chan error) {
	chunkChan := make(chan *models.StreamChunk)
	errChan := make(chan error, 1)
	close(chunkChan)
	errChan <- errors.New("provider stream failed")
	close(errChan)
	return chunkChan, errChan
}

func (f failingStreamProvider) HealthCheck(context.Context) error { return nil }

func (f failingStreamProvider) GetCapabilities() *providers.ProviderCapabilities {
	return &providers.ProviderCapabilities{SupportsStreaming: true}
}

func (f failingStreamProvider) EstimateCost(*models.InferRequest) (float64, error) { return 0, nil }

func (f failingStreamProvider) Close() error { return nil }

func TestHandleStreamingInferPropagatesRuntimeDurabilityHeaders(t *testing.T) {
	t.Parallel()

	handler := &InferHandler{
		runtimeExecutor: &stubRuntimeExecutor{
			streamResp: &http.Response{
				StatusCode: http.StatusOK,
				Header: http.Header{
					"Content-Type":                            []string{"text/event-stream"},
					"X-Igris-Runtime-Task-Id":                 []string{"stream-task-1"},
					"X-Igris-Runtime-Stream-Resume-Supported": []string{"false"},
					"X-Igris-Runtime-Stream-Replay-Condition": []string{"completed-final-output"},
				},
				Body: io.NopCloser(strings.NewReader(strings.Join([]string{
					"data: {\"id\":\"chunk-1\"}",
					"",
					"event: task_result",
					"data: {\"durability\":{\"mode\":\"streaming\",\"resume_supported\":false,\"replay_supported\":true,\"replay_condition\":\"completed-final-output\",\"checkpoint_persisted\":false}}",
					"",
				}, "\n"))),
			},
		},
	}

	app := fiber.New()
	app.Post("/v1/infer", func(c *fiber.Ctx) error {
		return handler.handleStreamingInfer(c, &models.InferRequest{
			Model:    "gpt-4.1-mini",
			Stream:   true,
			Messages: []models.Message{{Role: "user", Content: "hello"}},
		})
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/infer", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}

	if got := resp.Header.Get("X-Igris-Runtime-Task-Id"); got != "stream-task-1" {
		t.Fatalf("X-Igris-Runtime-Task-Id = %q, want %q", got, "stream-task-1")
	}
	if got := resp.Header.Get("X-Igris-Stream-Execution-Authority"); got != "runtime" {
		t.Fatalf("X-Igris-Stream-Execution-Authority = %q, want %q", got, "runtime")
	}
	if got := resp.Header.Get("X-Igris-Stream-Resume-Supported"); got != "false" {
		t.Fatalf("X-Igris-Stream-Resume-Supported = %q, want %q", got, "false")
	}
	if got := resp.Header.Get("X-Igris-Stream-Replay-Condition"); got != "completed-final-output" {
		t.Fatalf("X-Igris-Stream-Replay-Condition = %q, want %q", got, "completed-final-output")
	}
	if got := resp.Header.Get("X-Igris-Runtime-Stream-Resume-Supported"); got != "false" {
		t.Fatalf("X-Igris-Runtime-Stream-Resume-Supported = %q, want %q", got, "false")
	}
	if got := resp.Header.Get("X-Igris-Runtime-Stream-Replay-Condition"); got != "completed-final-output" {
		t.Fatalf("X-Igris-Runtime-Stream-Replay-Condition = %q, want %q", got, "completed-final-output")
	}
	if got := resp.Header.Get("Content-Type"); !strings.Contains(got, "text/event-stream") {
		t.Fatalf("Content-Type = %q, want text/event-stream", got)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}
	body := string(bodyBytes)
	if !strings.Contains(body, "event: task_result") {
		t.Fatalf("body missing task_result event: %q", body)
	}
	if !strings.Contains(body, `"mode":"streaming"`) {
		t.Fatalf("body missing streaming durability mode: %q", body)
	}
	if !strings.Contains(body, `"resume_supported":false`) {
		t.Fatalf("body missing resume_supported=false: %q", body)
	}
	if !strings.Contains(body, `"replay_supported":true`) {
		t.Fatalf("body missing replay_supported=true: %q", body)
	}
	if !strings.Contains(body, `"replay_condition":"completed-final-output"`) {
		t.Fatalf("body missing completed-output replay condition: %q", body)
	}
}

func TestHandleInferDoesNotFallbackAfterStructuredRuntimeTaskError(t *testing.T) {
	t.Parallel()

	handler, err := NewInferHandler(nil)
	if err != nil {
		t.Fatalf("NewInferHandler() error = %v", err)
	}
	handler.runtimeExecutor = &stubRuntimeExecutor{
		forwardErr: &models.RuntimeTaskError{
			StatusCode: http.StatusOK,
			Payload: map[string]interface{}{
				"task_id": "runtime-task-1",
				"status": map[string]interface{}{
					"status": "failed",
					"reason": "provider stream failed",
				},
			},
			Body: "provider stream failed",
		},
	}

	app := fiber.New()
	app.Post("/v1/infer", handler.HandleInfer)

	req := httptest.NewRequest(http.MethodPost, "/v1/infer", bytes.NewBufferString(`{
		"model":"mock-model",
		"messages":[{"role":"user","content":"hello"}]
	}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != fiber.StatusBadGateway {
		t.Fatalf("status = %d, want %d", resp.StatusCode, fiber.StatusBadGateway)
	}

	var payload map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("Decode response error = %v", err)
	}
	runtimePayload, ok := payload["runtime_payload"].(map[string]interface{})
	if !ok {
		t.Fatalf("runtime_payload type = %T, want map[string]interface{}", payload["runtime_payload"])
	}
	statusBody, ok := runtimePayload["status"].(map[string]interface{})
	if !ok {
		t.Fatalf("runtime_payload.status type = %T, want map[string]interface{}", runtimePayload["status"])
	}
	if got := statusBody["status"]; got != "failed" {
		t.Fatalf("runtime_payload.status.status = %v, want failed", got)
	}
}

func TestHandleInferPersistsVerifiedRuntimeExecutionArtifacts(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedInferExecDB(t,
		queuedInferExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				if !strings.Contains(query, "INSERT INTO execution_lineage") {
					t.Fatalf("expected execution_lineage insert query, got %q", query)
				}
				if got := args[0].Value; got != "exec-runtime-1" {
					t.Fatalf("execution_id = %v, want exec-runtime-1", got)
				}
				if got := args[10].Value; got != "receipt-hash-runtime-1" {
					t.Fatalf("receipt_hash = %v, want receipt-hash-runtime-1", got)
				}
				if got := args[13].Value; got != "runtime-infer-1" {
					t.Fatalf("runtime_id = %v, want runtime-infer-1", got)
				}
			},
		},
		queuedInferExecExpectation{
			rowsAffected: 1,
			check: func(query string, args []driver.NamedValue) {
				if !strings.Contains(query, "INSERT INTO execution_context") {
					t.Fatalf("expected execution_context insert query, got %q", query)
				}
				if got := args[0].Value; got != "exec-runtime-1" {
					t.Fatalf("execution_context.execution_id = %v, want exec-runtime-1", got)
				}
				if got := args[3].Value; got != "runtime-infer-1" {
					t.Fatalf("execution_context.runtime_id = %v, want runtime-infer-1", got)
				}
				if got := args[14].Value; got != "verified" {
					t.Fatalf("verification_status = %v, want verified", got)
				}
			},
		},
	)

	handler, err := NewInferHandler(nil)
	if err != nil {
		t.Fatalf("NewInferHandler() error = %v", err)
	}
	handler.executionStore = coordinator.NewCheckpointStore(db)
	response := models.NewInferResponse("runtime-task-1", "mock-model")
	response.AddChoice(0, &models.Message{Role: "assistant", Content: "hello unified path"}, "stop")
	response.SetUsage(4, 7)
	response.ExecutionEnvelope = map[string]interface{}{
		"execution_id":     "exec-runtime-1",
		"runtime_id":       "runtime-infer-1",
		"routing_decision": "runtime:test",
		"provider":         "local-mock-cloud",
		"tenant_id":        "tenant-runtime",
	}
	response.ExecutionReceipt = map[string]interface{}{
		"execution_id":       "exec-runtime-1",
		"agent_id":           "tenant-runtime",
		"cpu_time_ms":        0,
		"wall_time_ms":       36,
		"memory_peak_mb":     0,
		"fs_bytes_written":   0,
		"tool_calls":         0,
		"previous_hash":      "prev-hash-runtime-0",
		"runtime_id":         "runtime-infer-1",
		"timestamp_utc":      "2026-05-03T13:00:00Z",
		"transaction_id":     "tx-runtime-1",
		"transaction_hash":   "tx-hash-runtime-1",
		"violation_occurred": false,
		"hash":               "receipt-hash-runtime-1",
		"signature":          "receipt-sig-runtime-1",
	}
	response.Metadata = &models.ResponseMetadata{
		Provider:      "local-mock-cloud",
		RouteDecision: "forwarded_to_runtime_task",
		Timestamp:     time.Date(2026, 5, 3, 13, 0, 0, 0, time.UTC),
	}
	handler.runtimeExecutor = &stubRuntimeExecutor{forwardResp: response}

	app := fiber.New()
	app.Post("/v1/infer", handler.HandleInfer)

	req := httptest.NewRequest(http.MethodPost, "/v1/infer", bytes.NewBufferString(`{
		"model":"mock-model",
		"messages":[{"role":"user","content":"hello runtime"}]
	}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	if queued.remainingExecs() != 0 {
		t.Fatalf("remaining exec expectations = %d, want 0", queued.remainingExecs())
	}
}

func TestHandleInferFallbackWithoutRuntimeProofDoesNotPersistExecutionArtifacts(t *testing.T) {
	t.Parallel()

	db, queued := newQueuedInferExecDB(t)

	handler, err := NewInferHandler(nil)
	if err != nil {
		t.Fatalf("NewInferHandler() error = %v", err)
	}
	handler.executionStore = coordinator.NewCheckpointStore(db)
	handler.runtimeExecutor = &stubRuntimeExecutor{forwardErr: errors.New("runtime unavailable")}

	app := fiber.New()
	app.Post("/v1/infer", handler.HandleInfer)

	req := httptest.NewRequest(http.MethodPost, "/v1/infer", bytes.NewBufferString(`{
		"model":"mock-model",
		"messages":[{"role":"user","content":"hello fallback"}]
	}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	if queued.remainingExecs() != 0 {
		t.Fatalf("remaining exec expectations = %d, want 0", queued.remainingExecs())
	}
}

func TestHandleStreamingInferPropagatesRuntimeFailureEvents(t *testing.T) {
	t.Parallel()

	handler := &InferHandler{
		runtimeExecutor: &stubRuntimeExecutor{
			streamResp: &http.Response{
				StatusCode: http.StatusOK,
				Header: http.Header{
					"Content-Type":                            []string{"text/event-stream"},
					"X-Igris-Runtime-Task-Id":                 []string{"stream-task-failed"},
					"X-Igris-Runtime-Stream-Resume-Supported": []string{"false"},
					"X-Igris-Runtime-Stream-Replay-Condition": []string{"completed-final-output"},
				},
				Body: io.NopCloser(strings.NewReader(strings.Join([]string{
					"event: task_result",
					"data: {\"task_id\":\"stream-task-failed\",\"status\":{\"status\":\"failed\",\"reason\":\"provider stream failed\"},\"failure_details\":{\"source\":\"runtime\",\"operation\":\"execution\",\"rejection_type\":\"step_failed\",\"message\":\"provider stream failed\",\"step_index\":0,\"domain\":\"agent\",\"node_id\":\"agent-0\"},\"durability\":{\"mode\":\"streaming\",\"resume_supported\":false,\"replay_supported\":false,\"replay_condition\":\"completed-final-output\",\"checkpoint_persisted\":false}}",
					"",
					"data: {\"error\":{\"message\":\"provider stream failed\",\"type\":\"stream_error\"}}",
					"",
					"data: [DONE]",
					"",
				}, "\n"))),
			},
		},
	}

	app := fiber.New()
	app.Post("/v1/infer", func(c *fiber.Ctx) error {
		return handler.handleStreamingInfer(c, &models.InferRequest{
			Model:    "gpt-4.1-mini",
			Stream:   true,
			Messages: []models.Message{{Role: "user", Content: "hello"}},
		})
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/infer", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	if got := resp.Header.Get("X-Igris-Stream-Execution-Authority"); got != "runtime" {
		t.Fatalf("X-Igris-Stream-Execution-Authority = %q, want %q", got, "runtime")
	}
	if got := resp.Header.Get("X-Igris-Runtime-Task-Id"); got != "stream-task-failed" {
		t.Fatalf("X-Igris-Runtime-Task-Id = %q, want %q", got, "stream-task-failed")
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("ReadAll() error = %v", err)
	}
	body := string(bodyBytes)
	for _, want := range []string{
		"event: task_result",
		`"status":"failed"`,
		`"failure_details"`,
		`"source":"runtime"`,
		`"operation":"execution"`,
		`"rejection_type":"step_failed"`,
		`"step_index":0`,
		`"domain":"agent"`,
		`"node_id":"agent-0"`,
		`"type":"stream_error"`,
		`"replay_supported":false`,
		"data: [DONE]",
	} {
		if !strings.Contains(body, want) {
			t.Fatalf("body missing %s: %q", want, body)
		}
	}
}

func TestApplyFallbackStreamContractHeaders(t *testing.T) {
	t.Parallel()

	app := fiber.New()
	app.Get("/stream", func(c *fiber.Ctx) error {
		setStreamingSSEHeaders(c, "trace-1")
		applyFallbackStreamContractHeaders(c)
		return c.SendStatus(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/stream", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}

	if got := resp.Header.Get("X-Igris-Stream-Execution-Authority"); got != "overture_fallback" {
		t.Fatalf("X-Igris-Stream-Execution-Authority = %q, want %q", got, "overture_fallback")
	}
	if got := resp.Header.Get("X-Igris-Stream-Resume-Supported"); got != "false" {
		t.Fatalf("X-Igris-Stream-Resume-Supported = %q, want %q", got, "false")
	}
	if got := resp.Header.Get("X-Igris-Stream-Replay-Condition"); got != "none" {
		t.Fatalf("X-Igris-Stream-Replay-Condition = %q, want %q", got, "none")
	}
	if got := resp.Header.Get("Content-Type"); !strings.Contains(got, "text/event-stream") {
		t.Fatalf("Content-Type = %q, want text/event-stream", got)
	}
}

func TestBuildInferFailureResponseNormalizesRuntimeSecurityFailure(t *testing.T) {
	t.Parallel()

	resp := models.BuildSimpleFailureResponse(
		"runtime",
		"infer",
		"runtime_security_rejected",
		"upstream security rejection",
		models.ErrRuntimeSecurity.Error(),
	)

	if got := resp["source"]; got != "runtime" {
		t.Fatalf("failure.source = %v, want runtime", got)
	}
	if got := resp["operation"]; got != "infer" {
		t.Fatalf("failure.operation = %v, want infer", got)
	}
	if got := resp["type"]; got != "runtime_security_rejected" {
		t.Fatalf("failure.type = %v, want runtime_security_rejected", got)
	}
	if got := resp["message"]; got != "upstream security rejection" {
		t.Fatalf("failure.message = %v, want upstream security rejection", got)
	}
	if got := resp["reason"]; got != models.ErrRuntimeSecurity.Error() {
		t.Fatalf("failure.reason = %v, want %q", got, models.ErrRuntimeSecurity.Error())
	}
}

func TestHandleStreamingInferRejectsFallbackWhenRuntimeUnavailable(t *testing.T) {
	t.Parallel()

	handler := &InferHandler{
		runtimeExecutor: &stubRuntimeExecutor{
			streamErr: errors.New("runtime selector: no healthy runtime available for streaming"),
		},
	}

	app := fiber.New()
	app.Post("/v1/infer", func(c *fiber.Ctx) error {
		return handler.handleStreamingInfer(c, &models.InferRequest{
			Model:    "gpt-4.1-mini",
			Stream:   true,
			Messages: []models.Message{{Role: "user", Content: "hello"}},
		})
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/infer", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusServiceUnavailable)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	errorBody, ok := body["error"].(map[string]any)
	if !ok {
		t.Fatalf("error body type = %T, want map[string]any", body["error"])
	}
	if got := errorBody["type"]; got != "stream_execution_unavailable" {
		t.Fatalf("error.type = %v, want %q", got, "stream_execution_unavailable")
	}
	if got := body["detail"]; got != "runtime selector: no healthy runtime available for streaming" {
		t.Fatalf("detail = %v, want runtime error detail", got)
	}
	failureBody, ok := body["failure"].(map[string]any)
	if !ok {
		t.Fatalf("failure body type = %T, want map[string]any", body["failure"])
	}
	if got := failureBody["source"]; got != "runtime" {
		t.Fatalf("failure.source = %v, want runtime", got)
	}
	if got := failureBody["operation"]; got != "stream" {
		t.Fatalf("failure.operation = %v, want stream", got)
	}
	if got := failureBody["type"]; got != "stream_execution_unavailable" {
		t.Fatalf("failure.type = %v, want stream_execution_unavailable", got)
	}
	if got := failureBody["reason"]; got != "runtime selector: no healthy runtime available for streaming" {
		t.Fatalf("failure.reason = %v, want runtime error detail", got)
	}
	streamBody, ok := body["stream"].(map[string]any)
	if !ok {
		t.Fatalf("stream body type = %T, want map[string]any", body["stream"])
	}
	if got := streamBody["execution_authority"]; got != "runtime" {
		t.Fatalf("stream.execution_authority = %v, want %q", got, "runtime")
	}
	if got := streamBody["fallback_allowed"]; got != false {
		t.Fatalf("stream.fallback_allowed = %v, want false", got)
	}
	if got := streamBody["resume_supported"]; got != false {
		t.Fatalf("stream.resume_supported = %v, want false", got)
	}
	if got := streamBody["replay_condition"]; got != "completed-final-output" {
		t.Fatalf("stream.replay_condition = %v, want %q", got, "completed-final-output")
	}
	if got := streamBody["fallback_opt_in_field"]; got != "allow_stream_fallback" {
		t.Fatalf("stream.fallback_opt_in_field = %v, want %q", got, "allow_stream_fallback")
	}
}

func TestHandleStreamingInferSurfacesRuntimeStreamErrorPayload(t *testing.T) {
	t.Parallel()

	handler := &InferHandler{
		runtimeExecutor: &stubRuntimeExecutor{
			streamErr: &models.RuntimeStreamError{
				StatusCode: http.StatusConflict,
				Payload: map[string]interface{}{
					"error": map[string]interface{}{
						"message": "Streaming replay is only available for completed task submissions with final output",
						"type":    "stream_replay_unavailable",
					},
					"task": map[string]interface{}{
						"status": map[string]interface{}{
							"status": "failed",
							"reason": "provider stream failed",
						},
						"failure_details": map[string]interface{}{
							"source":         "runtime",
							"operation":      "execution",
							"rejection_type": "step_failed",
							"message":        "provider stream failed",
							"step_index":     float64(0),
							"domain":         "agent",
							"node_id":        "agent-0",
						},
					},
					"durability": map[string]interface{}{
						"mode":                 "streaming",
						"resume_supported":     false,
						"replay_supported":     false,
						"checkpoint_persisted": false,
					},
				},
			},
		},
	}

	app := fiber.New()
	app.Post("/v1/infer", func(c *fiber.Ctx) error {
		return handler.handleStreamingInfer(c, &models.InferRequest{
			Model:    "gpt-4.1-mini",
			Stream:   true,
			Messages: []models.Message{{Role: "user", Content: "hello"}},
		})
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/infer", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusConflict)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	errorBody, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatalf("error body type = %T, want map[string]interface{}", body["error"])
	}
	if got := errorBody["type"]; got != "stream_replay_unavailable" {
		t.Fatalf("error.type = %v, want stream_replay_unavailable", got)
	}
	if got := body["runtime_status_code"]; got != float64(http.StatusConflict) {
		t.Fatalf("runtime_status_code = %v, want %d", got, http.StatusConflict)
	}
	failureBody, ok := body["failure"].(map[string]interface{})
	if !ok {
		t.Fatalf("failure body type = %T, want map[string]interface{}", body["failure"])
	}
	if got := failureBody["source"]; got != "runtime" {
		t.Fatalf("failure.source = %v, want runtime", got)
	}
	if got := failureBody["operation"]; got != "stream" {
		t.Fatalf("failure.operation = %v, want stream", got)
	}
	if got := failureBody["type"]; got != "stream_replay_unavailable" {
		t.Fatalf("failure.type = %v, want stream_replay_unavailable", got)
	}
	if got := failureBody["status_code"]; got != float64(http.StatusConflict) {
		t.Fatalf("failure.status_code = %v, want %d", got, http.StatusConflict)
	}
	execution, ok := failureBody["execution"].(map[string]interface{})
	if !ok {
		t.Fatalf("failure.execution type = %T, want map[string]interface{}", failureBody["execution"])
	}
	if got := execution["node_id"]; got != "agent-0" {
		t.Fatalf("failure.execution.node_id = %v, want agent-0", got)
	}
	runtimePayload, ok := body["runtime_payload"].(map[string]interface{})
	if !ok {
		t.Fatalf("runtime_payload type = %T, want map[string]interface{}", body["runtime_payload"])
	}
	taskBody, ok := runtimePayload["task"].(map[string]interface{})
	if !ok {
		t.Fatalf("runtime_payload.task type = %T, want map[string]interface{}", runtimePayload["task"])
	}
	failureDetails, ok := taskBody["failure_details"].(map[string]interface{})
	if !ok {
		t.Fatalf("runtime_payload.task.failure_details type = %T, want map[string]interface{}", taskBody["failure_details"])
	}
	if got := failureDetails["operation"]; got != "execution" {
		t.Fatalf("runtime failure_details.operation = %v, want execution", got)
	}
}

func TestHandleStreamingInferDoesNotFallbackAfterStructuredRuntimeStreamError(t *testing.T) {
	t.Parallel()

	registry := providers.NewProviderRegistry()
	mockProvider, err := openai.NewMockOpenAIProvider(nil)
	if err != nil {
		t.Fatalf("NewMockOpenAIProvider() error = %v", err)
	}
	registry.Register(mockProvider)

	handler := &InferHandler{
		router: infrarouter.NewInferenceRouter(registry, nil),
		runtimeExecutor: &stubRuntimeExecutor{
			streamErr: &models.RuntimeStreamError{
				StatusCode: http.StatusConflict,
				Payload: map[string]interface{}{
					"error": map[string]interface{}{
						"message": "Streaming replay is only available for completed task submissions with final output",
						"type":    "stream_replay_unavailable",
					},
					"task": map[string]interface{}{
						"failure_details": map[string]interface{}{
							"source":         "runtime",
							"operation":      "execution",
							"rejection_type": "step_failed",
							"message":        "provider stream failed",
							"step_index":     float64(0),
							"domain":         "agent",
							"node_id":        "agent-0",
						},
					},
				},
			},
		},
	}

	app := fiber.New()
	app.Post("/v1/infer", func(c *fiber.Ctx) error {
		return handler.handleStreamingInfer(c, &models.InferRequest{
			Model:               "igris-mock-gpt-4",
			Stream:              true,
			AllowStreamFallback: true,
			MaxTokens:           5,
			Messages:            []models.Message{{Role: "user", Content: "hello"}},
		})
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/infer", nil)
	resp, err := app.Test(req, 5000)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusConflict)
	}
	if got := resp.Header.Get("X-Igris-Stream-Execution-Authority"); got != "" {
		t.Fatalf("X-Igris-Stream-Execution-Authority = %q, want empty JSON error response header", got)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if _, ok := body["choices"]; ok {
		t.Fatalf("response unexpectedly used Overture fallback choices: %v", body["choices"])
	}
	errorBody, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatalf("error body type = %T, want map[string]interface{}", body["error"])
	}
	if got := errorBody["type"]; got != "stream_replay_unavailable" {
		t.Fatalf("error.type = %v, want stream_replay_unavailable", got)
	}
	streamBody, ok := body["stream"].(map[string]interface{})
	if !ok {
		t.Fatalf("stream body type = %T, want map[string]interface{}", body["stream"])
	}
	if got := streamBody["execution_authority"]; got != "runtime" {
		t.Fatalf("stream.execution_authority = %v, want runtime", got)
	}
	if got := streamBody["fallback_allowed"]; got != false {
		t.Fatalf("stream.fallback_allowed = %v, want false", got)
	}
}

func TestHandleStreamingInferReportsSecurityRejectionWithRuntimeContract(t *testing.T) {
	t.Parallel()

	handler := &InferHandler{
		runtimeExecutor: &stubRuntimeExecutor{
			streamErr: models.ErrRuntimeSecurity,
		},
	}

	app := fiber.New()
	app.Post("/v1/infer", func(c *fiber.Ctx) error {
		return handler.handleStreamingInfer(c, &models.InferRequest{
			Model:    "gpt-4.1-mini",
			Stream:   true,
			Messages: []models.Message{{Role: "user", Content: "hello"}},
		})
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/infer", nil)
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
	errorBody, ok := body["error"].(map[string]any)
	if !ok {
		t.Fatalf("error body type = %T, want map[string]any", body["error"])
	}
	if got := errorBody["type"]; got != "stream_execution_security_rejected" {
		t.Fatalf("error.type = %v, want %q", got, "stream_execution_security_rejected")
	}
	failureBody, ok := body["failure"].(map[string]any)
	if !ok {
		t.Fatalf("failure body type = %T, want map[string]any", body["failure"])
	}
	if got := failureBody["source"]; got != "runtime" {
		t.Fatalf("failure.source = %v, want runtime", got)
	}
	if got := failureBody["operation"]; got != "stream" {
		t.Fatalf("failure.operation = %v, want stream", got)
	}
	if got := failureBody["type"]; got != "stream_execution_security_rejected" {
		t.Fatalf("failure.type = %v, want stream_execution_security_rejected", got)
	}
	streamBody, ok := body["stream"].(map[string]any)
	if !ok {
		t.Fatalf("stream body type = %T, want map[string]any", body["stream"])
	}
	if got := streamBody["execution_authority"]; got != "runtime" {
		t.Fatalf("stream.execution_authority = %v, want %q", got, "runtime")
	}
	if got := streamBody["fallback_allowed"]; got != false {
		t.Fatalf("stream.fallback_allowed = %v, want false", got)
	}
}

func TestHandleStreamingInferRejectsCouncilFallbackWhenRuntimeUnavailable(t *testing.T) {
	t.Parallel()

	handler := &InferHandler{
		runtimeExecutor: &stubRuntimeExecutor{
			streamErr: errors.New("runtime selector: no healthy runtime available for streaming"),
		},
	}

	app := fiber.New()
	app.Post("/v1/infer", func(c *fiber.Ctx) error {
		return handler.handleStreamingInfer(c, &models.InferRequest{
			Model:       "gpt-4.1-mini",
			Stream:      true,
			CouncilMode: true,
			Messages:    []models.Message{{Role: "user", Content: "hello"}},
		})
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/infer", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusServiceUnavailable)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	streamBody, ok := body["stream"].(map[string]any)
	if !ok {
		t.Fatalf("stream body type = %T, want map[string]any", body["stream"])
	}
	if got := streamBody["execution_authority"]; got != "runtime" {
		t.Fatalf("stream.execution_authority = %v, want %q", got, "runtime")
	}
	if got := streamBody["fallback_allowed"]; got != false {
		t.Fatalf("stream.fallback_allowed = %v, want false", got)
	}
}

func TestHandleStreamingInferRejectsSpeculativeFallbackWhenRuntimeUnavailable(t *testing.T) {
	t.Parallel()

	handler := &InferHandler{
		runtimeExecutor: &stubRuntimeExecutor{
			streamErr: errors.New("runtime selector: no healthy runtime available for streaming"),
		},
	}

	app := fiber.New()
	app.Post("/v1/infer", func(c *fiber.Ctx) error {
		return handler.handleStreamingInfer(c, &models.InferRequest{
			Model:           "gpt-4.1-mini",
			Stream:          true,
			SpeculativeMode: "latency",
			Messages:        []models.Message{{Role: "user", Content: "hello"}},
		})
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/infer", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusServiceUnavailable)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	streamBody, ok := body["stream"].(map[string]any)
	if !ok {
		t.Fatalf("stream body type = %T, want map[string]any", body["stream"])
	}
	if got := streamBody["execution_authority"]; got != "runtime" {
		t.Fatalf("stream.execution_authority = %v, want %q", got, "runtime")
	}
	if got := streamBody["fallback_allowed"]; got != false {
		t.Fatalf("stream.fallback_allowed = %v, want false", got)
	}
}

func TestHandleStreamingInferAllowsExplicitFallbackOptIn(t *testing.T) {
	t.Parallel()

	registry := providers.NewProviderRegistry()
	mockProvider, err := openai.NewMockOpenAIProvider(nil)
	if err != nil {
		t.Fatalf("NewMockOpenAIProvider() error = %v", err)
	}
	registry.Register(mockProvider)

	handler := &InferHandler{
		router: infrarouter.NewInferenceRouter(registry, nil),
		runtimeExecutor: &stubRuntimeExecutor{
			streamErr: errors.New("runtime selector: no healthy runtime available for streaming"),
		},
	}

	app := fiber.New()
	app.Post("/v1/infer", func(c *fiber.Ctx) error {
		return handler.handleStreamingInfer(c, &models.InferRequest{
			Model:               "igris-mock-gpt-4",
			Stream:              true,
			AllowStreamFallback: true,
			MaxTokens:           5,
			Messages:            []models.Message{{Role: "user", Content: "hello"}},
		})
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/infer", nil)
	resp, err := app.Test(req, 5000)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusOK)
	}
	if got := resp.Header.Get("X-Igris-Stream-Execution-Authority"); got != "overture_fallback" {
		t.Fatalf("X-Igris-Stream-Execution-Authority = %q, want %q", got, "overture_fallback")
	}
	if got := resp.Header.Get("X-Igris-Stream-Resume-Supported"); got != "false" {
		t.Fatalf("X-Igris-Stream-Resume-Supported = %q, want %q", got, "false")
	}
	if got := resp.Header.Get("X-Igris-Stream-Replay-Condition"); got != "none" {
		t.Fatalf("X-Igris-Stream-Replay-Condition = %q, want %q", got, "none")
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	if _, ok := body["choices"]; !ok {
		t.Fatalf("response missing choices: %v", body)
	}
	metadata, ok := body["metadata"].(map[string]any)
	if !ok {
		t.Fatalf("metadata type = %T, want map[string]any", body["metadata"])
	}
	streamMetadata, ok := metadata["stream"].(map[string]any)
	if !ok {
		t.Fatalf("metadata.stream type = %T, want map[string]any", metadata["stream"])
	}
	if got := streamMetadata["execution_authority"]; got != "overture_fallback" {
		t.Fatalf("metadata.stream.execution_authority = %v, want %q", got, "overture_fallback")
	}
	if got := streamMetadata["fallback_allowed"]; got != true {
		t.Fatalf("metadata.stream.fallback_allowed = %v, want true", got)
	}
	if got := streamMetadata["resume_supported"]; got != false {
		t.Fatalf("metadata.stream.resume_supported = %v, want false", got)
	}
	if got := streamMetadata["replay_condition"]; got != "none" {
		t.Fatalf("metadata.stream.replay_condition = %v, want %q", got, "none")
	}
}

func TestHandleStreamingInferReportsFallbackExecutionErrorWithFallbackContract(t *testing.T) {
	t.Parallel()

	registry := providers.NewProviderRegistry()
	registry.Register(failingStreamProvider{})

	handler := &InferHandler{
		router: infrarouter.NewInferenceRouter(registry, nil),
		runtimeExecutor: &stubRuntimeExecutor{
			streamErr: errors.New("runtime selector: no healthy runtime available for streaming"),
		},
	}

	app := fiber.New()
	app.Post("/v1/infer", func(c *fiber.Ctx) error {
		return handler.handleStreamingInfer(c, &models.InferRequest{
			Model:               "failing-model",
			Stream:              true,
			AllowStreamFallback: true,
			Policy:              &models.PolicyOverride{Provider: "failing-stream"},
			Messages:            []models.Message{{Role: "user", Content: "hello"}},
		})
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/infer", nil)
	resp, err := app.Test(req)
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
	errorBody, ok := body["error"].(map[string]any)
	if !ok {
		t.Fatalf("error body type = %T, want map[string]any", body["error"])
	}
	if got := errorBody["type"]; got != "stream_execution_failed" {
		t.Fatalf("error.type = %v, want %q", got, "stream_execution_failed")
	}
	if got := body["detail"]; got != "provider stream failed" {
		t.Fatalf("detail = %v, want provider stream failed", got)
	}
	failureBody, ok := body["failure"].(map[string]any)
	if !ok {
		t.Fatalf("failure body type = %T, want map[string]any", body["failure"])
	}
	if got := failureBody["source"]; got != "overture" {
		t.Fatalf("failure.source = %v, want overture", got)
	}
	if got := failureBody["operation"]; got != "stream" {
		t.Fatalf("failure.operation = %v, want stream", got)
	}
	if got := failureBody["type"]; got != "stream_execution_failed" {
		t.Fatalf("failure.type = %v, want stream_execution_failed", got)
	}
	if got := failureBody["reason"]; got != "provider stream failed" {
		t.Fatalf("failure.reason = %v, want provider stream failed", got)
	}
	streamBody, ok := body["stream"].(map[string]any)
	if !ok {
		t.Fatalf("stream body type = %T, want map[string]any", body["stream"])
	}
	if got := streamBody["execution_authority"]; got != "overture_fallback" {
		t.Fatalf("stream.execution_authority = %v, want %q", got, "overture_fallback")
	}
	if got := streamBody["fallback_allowed"]; got != true {
		t.Fatalf("stream.fallback_allowed = %v, want true", got)
	}
}
