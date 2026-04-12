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

	"github.com/Igris-inertial/system/igris-overture/models"
)

type stubRuntimeExecutor struct {
	streamResp *http.Response
	streamErr  error
}

func (s *stubRuntimeExecutor) ForwardExecution(context.Context, string, *models.InferRequest, string) (*models.InferResponse, error) {
	return nil, nil
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
				Body: io.NopCloser(strings.NewReader("data: {\"id\":\"chunk-1\"}\n\n")),
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
}
