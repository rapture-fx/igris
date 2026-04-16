package api

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
