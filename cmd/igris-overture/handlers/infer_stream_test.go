package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"

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
