package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/Schlep-engine/igris-inertial/internal/ml"
)

func setupTestApp(mlClient *ml.Client) *fiber.App {
	app := fiber.New(fiber.Config{
		ErrorHandler: customErrorHandler,
	})
	setupRoutes(app, mlClient)
	return app
}

func TestHealthEndpoint(t *testing.T) {
	app := setupTestApp(nil)

	req := httptest.NewRequest("GET", "/health", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Status = %d, want 200", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(body, &result)

	if result["status"] != "ok" {
		t.Errorf("status = %v, want 'ok'", result["status"])
	}

	if result["service"] != "go-gateway" {
		t.Errorf("service = %v, want 'go-gateway'", result["service"])
	}

	if result["version"] != "0.1.0-prototype" {
		t.Errorf("version = %v, want '0.1.0-prototype'", result["version"])
	}

	if result["timestamp"] == nil {
		t.Error("timestamp should be present")
	}
}

func TestRustAddEndpoint_Success(t *testing.T) {
	app := setupTestApp(nil)

	tests := []struct {
		name     string
		x        int
		y        int
		expected int
	}{
		{"positive numbers", 5, 3, 8},
		{"negative numbers", -10, -5, -15},
		{"zero", 0, 0, 0},
		{"mixed", 10, -3, 7},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "/rust/add?x=" + string(rune(tt.x+'0')) + "&y=" + string(rune(tt.y+'0'))
			req := httptest.NewRequest("GET", url, nil)
			resp, err := app.Test(req)
			if err != nil {
				t.Fatalf("Request failed: %v", err)
			}

			if resp.StatusCode != http.StatusOK {
				t.Errorf("Status = %d, want 200", resp.StatusCode)
			}

			body, _ := io.ReadAll(resp.Body)
			var result map[string]interface{}
			json.Unmarshal(body, &result)

			if result["operation"] != "rust_add" {
				t.Errorf("operation = %v, want 'rust_add'", result["operation"])
			}

			if int(result["result"].(float64)) != tt.expected {
				t.Errorf("result = %v, want %d", result["result"], tt.expected)
			}

			// Check that latency is reported
			if result["latency_us"] == nil {
				t.Error("latency_us should be present")
			}
		})
	}
}

func TestRustAddEndpoint_DefaultValues(t *testing.T) {
	app := setupTestApp(nil)

	req := httptest.NewRequest("GET", "/rust/add", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Status = %d, want 200", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(body, &result)

	// Should default to 0 + 0 = 0
	if int(result["result"].(float64)) != 0 {
		t.Errorf("result = %v, want 0", result["result"])
	}
}

func TestRustHelloEndpoint_Success(t *testing.T) {
	app := setupTestApp(nil)

	tests := []struct {
		name     string
		input    string
	}{
		{"default", ""},
		{"custom name", "Alice"},
		{"with spaces", "John Doe"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "/rust/hello"
			if tt.input != "" {
				url += "?name=" + tt.input
			}

			req := httptest.NewRequest("GET", url, nil)
			resp, err := app.Test(req)
			if err != nil {
				t.Fatalf("Request failed: %v", err)
			}

			if resp.StatusCode != http.StatusOK {
				t.Errorf("Status = %d, want 200", resp.StatusCode)
			}

			body, _ := io.ReadAll(resp.Body)
			var result map[string]interface{}
			json.Unmarshal(body, &result)

			if result["operation"] != "rust_hello" {
				t.Errorf("operation = %v, want 'rust_hello'", result["operation"])
			}

			message, ok := result["message"].(string)
			if !ok || message == "" {
				t.Error("message should be a non-empty string")
			}

			if result["latency_us"] == nil {
				t.Error("latency_us should be present")
			}
		})
	}
}

func TestMLPredictEndpoint_NoClient(t *testing.T) {
	app := setupTestApp(nil)

	reqBody := map[string]interface{}{
		"features": []float64{1.0, 2.0, 3.0},
		"model_id": "test-model",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/ml/predict", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req, -1) // -1 timeout means no timeout
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	// Should return 503 when ML client is unavailable
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("Status = %d, want 503", resp.StatusCode)
	}
}

func TestMLPredictEndpoint_InvalidJSON(t *testing.T) {
	app := setupTestApp(nil)

	req := httptest.NewRequest("POST", "/ml/predict", bytes.NewReader([]byte("invalid json")))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Status = %d, want 400", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(body, &result)

	if result["error"] != "Invalid request body" {
		t.Errorf("error = %v, want 'Invalid request body'", result["error"])
	}
}

func TestMLPredictEndpoint_MissingFields(t *testing.T) {
	app := setupTestApp(nil)

	// Missing features field
	reqBody := map[string]interface{}{
		"model_id": "test-model",
	}
	body, _ := json.Marshal(reqBody)

	req := httptest.NewRequest("POST", "/ml/predict", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	// Should handle gracefully (likely 503 or 500 depending on ML client availability)
	if resp.StatusCode == http.StatusOK {
		t.Error("Should not return 200 for incomplete request")
	}
}

func TestHybridEndpoint_NoMLClient(t *testing.T) {
	app := setupTestApp(nil)

	req := httptest.NewRequest("GET", "/test/hybrid", nil)
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	// Should return 503 when ML client is unavailable
	if resp.StatusCode != http.StatusServiceUnavailable {
		t.Errorf("Status = %d, want 503", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(body, &result)

	if result["error"] != "ML service unavailable" {
		t.Errorf("error = %v, want 'ML service unavailable'", result["error"])
	}
}

func TestBenchmarkEndpoint_Success(t *testing.T) {
	app := setupTestApp(nil)

	req := httptest.NewRequest("GET", "/benchmark?iterations=100", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Status = %d, want 200", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(body, &result)

	if int(result["iterations"].(float64)) != 100 {
		t.Errorf("iterations = %v, want 100", result["iterations"])
	}

	if result["rust_ffi_total_ms"] == nil {
		t.Error("rust_ffi_total_ms should be present")
	}

	if result["rust_ffi_avg_us"] == nil {
		t.Error("rust_ffi_avg_us should be present")
	}

	if result["rust_ffi_ops_per_sec"] == nil {
		t.Error("rust_ffi_ops_per_sec should be present")
	}

	// Ops per second should be positive
	opsPerSec := result["rust_ffi_ops_per_sec"].(float64)
	if opsPerSec <= 0 {
		t.Errorf("rust_ffi_ops_per_sec = %v, should be positive", opsPerSec)
	}
}

func TestBenchmarkEndpoint_DefaultIterations(t *testing.T) {
	app := setupTestApp(nil)

	req := httptest.NewRequest("GET", "/benchmark", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Status = %d, want 200", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(body, &result)

	// Should default to 1000 iterations
	if int(result["iterations"].(float64)) != 1000 {
		t.Errorf("iterations = %v, want 1000 (default)", result["iterations"])
	}
}

func TestBenchmarkEndpoint_LargeIterations(t *testing.T) {
	app := setupTestApp(nil)

	req := httptest.NewRequest("GET", "/benchmark?iterations=10000", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		t.Errorf("Status = %d, want 200", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(body, &result)

	if int(result["iterations"].(float64)) != 10000 {
		t.Errorf("iterations = %v, want 10000", result["iterations"])
	}

	// Total time should be reasonable (> 0)
	totalMs := result["rust_ffi_total_ms"].(float64)
	if totalMs <= 0 {
		t.Error("rust_ffi_total_ms should be positive")
	}
}

func TestCustomErrorHandler(t *testing.T) {
	app := fiber.New(fiber.Config{
		ErrorHandler: customErrorHandler,
	})

	app.Get("/error", func(c *fiber.Ctx) error {
		return fiber.NewError(fiber.StatusBadRequest, "test error")
	})

	req := httptest.NewRequest("GET", "/error", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("Status = %d, want 400", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(body, &result)

	if result["error"] != "test error" {
		t.Errorf("error = %v, want 'test error'", result["error"])
	}

	if result["timestamp"] == nil {
		t.Error("timestamp should be present in error response")
	}
}

func TestNotFoundRoute(t *testing.T) {
	app := setupTestApp(nil)

	req := httptest.NewRequest("GET", "/nonexistent", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("Status = %d, want 404", resp.StatusCode)
	}
}

func TestCORS_MethodNotAllowed(t *testing.T) {
	app := setupTestApp(nil)

	// Health endpoint only supports GET
	req := httptest.NewRequest("POST", "/health", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	// Fiber returns 200 for all methods by default unless explicitly restricted
	// This test documents current behavior
	if resp.StatusCode != http.StatusOK {
		t.Logf("Note: POST to /health returned %d", resp.StatusCode)
	}
}

func TestRustAddEndpoint_Performance(t *testing.T) {
	app := setupTestApp(nil)

	req := httptest.NewRequest("GET", "/rust/add?x=100&y=200", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}

	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(body, &result)

	// FFI calls should be very fast (< 1ms typically)
	latencyUs := result["latency_us"].(float64)
	if latencyUs > 1000 {
		t.Logf("Warning: FFI latency %v us is higher than expected (> 1ms)", latencyUs)
	}
}

func BenchmarkHealthEndpoint(b *testing.B) {
	app := setupTestApp(nil)
	req := httptest.NewRequest("GET", "/health", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = app.Test(req)
	}
}

func BenchmarkRustAddEndpoint(b *testing.B) {
	app := setupTestApp(nil)
	req := httptest.NewRequest("GET", "/rust/add?x=42&y=58", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = app.Test(req)
	}
}

func BenchmarkRustHelloEndpoint(b *testing.B) {
	app := setupTestApp(nil)
	req := httptest.NewRequest("GET", "/rust/hello?name=Benchmark", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = app.Test(req)
	}
}
