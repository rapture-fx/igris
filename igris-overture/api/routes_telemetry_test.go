package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
)

func TestTelemetryFailureUsesSharedFailureSchema(t *testing.T) {
	t.Parallel()

	resp := telemetryFailure("runtime", "runtime_heartbeat", "heartbeat_failed", "Runtime heartbeat failed", "runtime missing")

	if got := resp["source"]; got != "runtime" {
		t.Fatalf("failure.source = %v, want runtime", got)
	}
	if got := resp["operation"]; got != "runtime_heartbeat" {
		t.Fatalf("failure.operation = %v, want runtime_heartbeat", got)
	}
	if got := resp["type"]; got != "heartbeat_failed" {
		t.Fatalf("failure.type = %v, want heartbeat_failed", got)
	}
	if got := resp["reason"]; got != "runtime missing" {
		t.Fatalf("failure.reason = %v, want runtime missing", got)
	}
}

func TestHandleRuntimeRegisterReportsRegistrationFailureSchema(t *testing.T) {
	t.Parallel()

	handler := NewTelemetryHandler(nil, nil)
	app := fiber.New()
	app.Post("/api/v1/runtime/register", handler.HandleRuntimeRegister)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/runtime/register", strings.NewReader(`{
		"runtime_id":"runtime-invalid",
		"tenant_id":"tenant-1",
		"public_key":"not-base64",
		"signature":"bad"
	}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusUnauthorized)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	assertTelemetryFailure(t, body, "runtime_register", "registration_failed")
}

func TestHandleRuntimeHeartbeatReportsHeartbeatFailureSchema(t *testing.T) {
	t.Parallel()

	handler := NewTelemetryHandler(nil, nil)
	app := fiber.New()
	app.Post("/api/v1/runtime/heartbeat", handler.HandleRuntimeHeartbeat)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/runtime/heartbeat", strings.NewReader(`{
		"runtime_id":"runtime-missing",
		"tenant_id":"tenant-1",
		"signature":"bad"
	}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusNotFound)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	assertTelemetryFailure(t, body, "runtime_heartbeat", "heartbeat_failed")
}

func TestHandleExecutionFeedbackReportsRuntimeNotRegisteredFailureSchema(t *testing.T) {
	t.Parallel()

	handler := NewTelemetryHandler(nil, nil)
	app := fiber.New()
	app.Post("/api/v1/telemetry/execution", handler.HandleExecutionFeedback)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/telemetry/execution", strings.NewReader(`{
		"runtime_id":"runtime-missing",
		"signed_decision":{
			"decision":{
				"tenant_id":"tenant-1",
				"decision_id":"decision-1"
			},
			"signature":"sig"
		},
		"execution_envelope":{
			"envelope":{
				"success":true
			},
			"signature":"sig"
		}
	}`))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("app.Test() error = %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("StatusCode = %d, want %d", resp.StatusCode, http.StatusUnauthorized)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("Decode() error = %v", err)
	}
	assertTelemetryFailure(t, body, "execution_feedback", "runtime_not_registered")
}

func assertTelemetryFailure(t *testing.T, body map[string]any, operation, failureType string) {
	t.Helper()

	failure, ok := body["failure"].(map[string]any)
	if !ok {
		t.Fatalf("failure body type = %T, want map[string]any", body["failure"])
	}
	if got := failure["source"]; got != "runtime" {
		t.Fatalf("failure.source = %v, want runtime", got)
	}
	if got := failure["operation"]; got != operation {
		t.Fatalf("failure.operation = %v, want %s", got, operation)
	}
	if got := failure["type"]; got != failureType {
		t.Fatalf("failure.type = %v, want %s", got, failureType)
	}
	if got := failure["reason"]; got == "" {
		t.Fatalf("failure.reason is empty")
	}
}
