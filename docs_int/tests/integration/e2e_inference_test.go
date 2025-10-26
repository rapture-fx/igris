package integration

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/schlep-engine/schlep-engine/internal/api"
	"github.com/schlep-engine/schlep-engine/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestE2E_InferenceBasic tests the complete inference flow
func TestE2E_InferenceBasic(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	// Set up test environment
	os.Setenv("PROVIDER_MODE", "benchmark") // Use benchmark providers (no real API calls)
	defer os.Unsetenv("PROVIDER_MODE")

	// Create Fiber app
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true,
	})

	// Initialize metrics and register routes
	api.InitializeMetricsMiddleware(app)
	err := api.RegisterAllRoutes(app, nil) // No tenant auth for this test
	require.NoError(t, err)

	t.Run("POST /v1/infer returns valid response", func(t *testing.T) {
		// Create request
		reqBody := models.InferRequest{
			Model: "gpt-4",
			Messages: []models.Message{
				{
					Role:    "user",
					Content: "What is 2+2?",
				},
			},
			MaxTokens:   50,
			Temperature: 0.7,
			Stream:      false,
		}

		bodyBytes, err := json.Marshal(reqBody)
		require.NoError(t, err)

		req := httptest.NewRequest("POST", "/v1/infer", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")

		// Execute request
		resp, err := app.Test(req, 30000) // 30 second timeout
		require.NoError(t, err)
		defer resp.Body.Close()

		// Verify status code
		assert.Equal(t, http.StatusOK, resp.StatusCode, "Expected 200 OK")

		// Read response
		respBody, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		var inferResp models.InferResponse
		err = json.Unmarshal(respBody, &inferResp)
		require.NoError(t, err, "Response should be valid JSON")

		// Verify response structure
		assert.NotEmpty(t, inferResp.ID, "Response should have an ID")
		assert.Equal(t, "chat.completion", inferResp.Object)
		assert.NotNil(t, inferResp.Created)
		assert.NotEmpty(t, inferResp.Model)
		assert.NotEmpty(t, inferResp.Choices, "Response should have at least one choice")

		// Verify first choice
		if len(inferResp.Choices) > 0 {
			choice := inferResp.Choices[0]
			assert.NotNil(t, choice.Message)
			assert.NotEmpty(t, choice.Message.Content, "Message should have content")
			assert.Equal(t, "assistant", choice.Message.Role)
		}

		// Verify usage information
		assert.NotNil(t, inferResp.Usage, "Response should include usage information")
		assert.Greater(t, inferResp.Usage.TotalTokens, 0, "Total tokens should be > 0")
	})

	t.Run("response includes metadata", func(t *testing.T) {
		reqBody := models.InferRequest{
			Model: "gpt-3.5-turbo",
			Messages: []models.Message{
				{Role: "user", Content: "Test message"},
			},
			MaxTokens: 10,
		}

		bodyBytes, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/v1/infer", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req, 30000)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		// Check for trace ID header
		traceID := resp.Header.Get("X-Trace-ID")
		assert.NotEmpty(t, traceID, "Response should include X-Trace-ID header")

		// Parse response
		var inferResp models.InferResponse
		bodyBytes, _ = io.ReadAll(resp.Body)
		json.Unmarshal(bodyBytes, &inferResp)

		// Verify metadata exists
		if inferResp.Metadata != nil {
			assert.NotNil(t, inferResp.Metadata.LatencyMs, "Metadata should include latency")
			assert.NotNil(t, inferResp.Metadata.Provider, "Metadata should include provider")
			assert.NotNil(t, inferResp.Metadata.CostUSD, "Metadata should include cost")
		}
	})
}

// TestE2E_InferenceValidation tests request validation
func TestE2E_InferenceValidation(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E test in short mode")
	}

	os.Setenv("PROVIDER_MODE", "benchmark")
	defer os.Unsetenv("PROVIDER_MODE")

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	api.InitializeMetricsMiddleware(app)
	api.RegisterAllRoutes(app, nil)

	t.Run("empty messages array rejected", func(t *testing.T) {
		reqBody := models.InferRequest{
			Model:    "gpt-4",
			Messages: []models.Message{}, // Empty
		}

		bodyBytes, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/v1/infer", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req, 10000)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("missing model rejected", func(t *testing.T) {
		reqBody := models.InferRequest{
			Model: "", // Empty model
			Messages: []models.Message{
				{Role: "user", Content: "Test"},
			},
		}

		bodyBytes, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/v1/infer", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req, 10000)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("invalid JSON rejected", func(t *testing.T) {
		invalidJSON := []byte(`{"model": "gpt-4", "messages": [invalid]}`)

		req := httptest.NewRequest("POST", "/v1/infer", bytes.NewReader(invalidJSON))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req, 10000)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}

// TestE2E_HealthEndpoints tests health and monitoring endpoints
func TestE2E_HealthEndpoints(t *testing.T) {
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	api.InitializeMetricsMiddleware(app)
	api.RegisterAllRoutes(app, nil)

	t.Run("GET /v1/health returns healthy", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/v1/health", nil)
		resp, err := app.Test(req, 5000)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var health map[string]interface{}
		bodyBytes, _ := io.ReadAll(resp.Body)
		json.Unmarshal(bodyBytes, &health)

		assert.Equal(t, "healthy", health["status"])
	})

	t.Run("GET /v1/models returns model list", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/v1/models", nil)
		resp, err := app.Test(req, 5000)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var modelResp map[string]interface{}
		bodyBytes, _ := io.ReadAll(resp.Body)
		json.Unmarshal(bodyBytes, &modelResp)

		assert.Equal(t, "list", modelResp["object"])
		assert.NotNil(t, modelResp["data"])
	})

	t.Run("GET /metrics returns Prometheus metrics", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/metrics", nil)
		resp, err := app.Test(req, 5000)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		bodyBytes, _ := io.ReadAll(resp.Body)
		body := string(bodyBytes)

		// Should contain Prometheus format metrics
		assert.Contains(t, body, "# HELP")
		assert.Contains(t, body, "# TYPE")
	})
}

// TestE2E_PerformanceMetrics verifies that performance is within acceptable bounds
func TestE2E_PerformanceMetrics(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping performance test in short mode")
	}

	os.Setenv("PROVIDER_MODE", "benchmark")
	defer os.Unsetenv("PROVIDER_MODE")

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	api.InitializeMetricsMiddleware(app)
	api.RegisterAllRoutes(app, nil)

	t.Run("benchmark provider responds within timeout", func(t *testing.T) {
		reqBody := models.InferRequest{
			Model: "gpt-4",
			Messages: []models.Message{
				{Role: "user", Content: "Quick test"},
			},
			MaxTokens: 10,
		}

		bodyBytes, _ := json.Marshal(reqBody)
		req := httptest.NewRequest("POST", "/v1/infer", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")

		start := time.Now()
		resp, err := app.Test(req, 30000)
		latency := time.Since(start)

		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Less(t, latency.Milliseconds(), int64(5000), "Request should complete within 5 seconds")

		t.Logf("Request latency: %dms", latency.Milliseconds())
	})

	t.Run("multiple sequential requests succeed", func(t *testing.T) {
		successCount := 0
		iterations := 5

		for i := 0; i < iterations; i++ {
			reqBody := models.InferRequest{
				Model: "gpt-3.5-turbo",
				Messages: []models.Message{
					{Role: "user", Content: "Test message"},
				},
				MaxTokens: 5,
			}

			bodyBytes, _ := json.Marshal(reqBody)
			req := httptest.NewRequest("POST", "/v1/infer", bytes.NewReader(bodyBytes))
			req.Header.Set("Content-Type", "application/json")

			resp, err := app.Test(req, 30000)
			if err == nil && resp.StatusCode == http.StatusOK {
				successCount++
			}
			if resp != nil {
				resp.Body.Close()
			}
		}

		assert.Equal(t, iterations, successCount, "All requests should succeed")
		t.Logf("Success rate: %d/%d (%.1f%%)", successCount, iterations, float64(successCount)/float64(iterations)*100)
	})
}

// BenchmarkE2E_InferenceLatency benchmarks inference latency
func BenchmarkE2E_InferenceLatency(b *testing.B) {
	os.Setenv("PROVIDER_MODE", "benchmark")
	defer os.Unsetenv("PROVIDER_MODE")

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	api.InitializeMetricsMiddleware(app)
	api.RegisterAllRoutes(app, nil)

	reqBody := models.InferRequest{
		Model: "gpt-3.5-turbo",
		Messages: []models.Message{
			{Role: "user", Content: "Benchmark test"},
		},
		MaxTokens: 5,
	}

	bodyBytes, _ := json.Marshal(reqBody)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("POST", "/v1/infer", bytes.NewReader(bodyBytes))
		req.Header.Set("Content-Type", "application/json")

		resp, err := app.Test(req, 30000)
		if err != nil {
			b.Fatal(err)
		}
		resp.Body.Close()
	}
}
