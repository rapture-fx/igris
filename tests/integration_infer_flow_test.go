package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/schlep-engine/schlep-engine/cmd/schlep-api/handlers"
	"github.com/schlep-engine/schlep-engine/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/gofiber/fiber/v2"
)

// TestE2EInferenceFlow tests the complete inference flow from request to response
func TestE2EInferenceFlow(t *testing.T) {
	tests := []struct {
		name          string
		providerMode  string
		request       models.InferRequest
		expectError   bool
		validateResp  func(*testing.T, *models.InferResponse)
	}{
		{
			name:         "Benchmark Mode - OpenAI GPT-4",
			providerMode: "benchmark",
			request: models.InferRequest{
				Model: "gpt-4",
				Messages: []models.Message{
					{Role: "user", Content: "Say hello in one word"},
				},
				MaxTokens:   10,
				Temperature: 0.7,
			},
			expectError: false,
			validateResp: func(t *testing.T, resp *models.InferResponse) {
				assert.Equal(t, "gpt-4", resp.Model)
				assert.NotEmpty(t, resp.ID)
				assert.Len(t, resp.Choices, 1)
				assert.NotNil(t, resp.Usage)
				assert.Greater(t, resp.Usage.TotalTokens, 0)
				assert.Equal(t, "benchmark-openai", resp.Metadata.Provider)
				assert.Greater(t, resp.Metadata.CostUSD, 0.0)
			},
		},
		{
			name:         "Benchmark Mode - Anthropic Claude",
			providerMode: "benchmark",
			request: models.InferRequest{
				Model: "claude-3-5-sonnet-20240229",
				Messages: []models.Message{
					{Role: "user", Content: "Respond with OK"},
				},
				MaxTokens: 5,
			},
			expectError: false,
			validateResp: func(t *testing.T, resp *models.InferResponse) {
				assert.Equal(t, "claude-3-5-sonnet-20240229", resp.Model)
				assert.NotEmpty(t, resp.ID)
				assert.Equal(t, "benchmark-anthropic", resp.Metadata.Provider)
				assert.Greater(t, resp.Usage.TotalTokens, 0)
			},
		},
		{
			name:         "Validation Error - Empty Model",
			providerMode: "benchmark",
			request: models.InferRequest{
				Model:    "",
				Messages: []models.Message{{Role: "user", Content: "test"}},
			},
			expectError: true,
		},
		{
			name:         "Validation Error - Empty Messages",
			providerMode: "benchmark",
			request: models.InferRequest{
				Model:    "gpt-4",
				Messages: []models.Message{},
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set environment for provider mode
			t.Setenv("PROVIDER_MODE", tt.providerMode)

			// Create handler
			handler, err := handlers.NewInferHandler()
			require.NoError(t, err)

			// Create Fiber app
			app := fiber.New()
			app.Post("/v1/infer", handler.HandleInfer)

			// Marshal request
			reqBody, err := json.Marshal(tt.request)
			require.NoError(t, err)

			// Create HTTP request
			req := httptest.NewRequest("POST", "/v1/infer", bytes.NewBuffer(reqBody))
			req.Header.Set("Content-Type", "application/json")

			// Execute request
			resp, err := app.Test(req, 10000) // 10s timeout
			require.NoError(t, err)
			defer resp.Body.Close()

			if tt.expectError {
				assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
				return
			}

			// Verify success
			assert.Equal(t, http.StatusOK, resp.StatusCode)

			// Parse response
			var inferResp models.InferResponse
			err = json.NewDecoder(resp.Body).Decode(&inferResp)
			require.NoError(t, err)

			// Run custom validation
			if tt.validateResp != nil {
				tt.validateResp(t, &inferResp)
			}
		})
	}
}

// TestE2EFallbackBehavior tests automatic fallback on provider failure
func TestE2EFallbackBehavior(t *testing.T) {
	t.Skip("Requires mock provider failure injection - TODO for Phase 13")
	// TODO: Test fallback when primary provider fails
	// This would require injecting failures into providers
}

// TestE2ERustOptimizerIntegration tests Rust optimizer decision flow
func TestE2ERustOptimizerIntegration(t *testing.T) {
	t.Skip("Requires Rust optimizer initialization - TODO for Phase 13")
	// TODO: Test Rust optimizer mode with actual FFI calls
	// This requires proper Rust library compilation and linking
}

// TestE2ECostCalculation verifies cost tracking accuracy
func TestE2ECostCalculation(t *testing.T) {
	t.Setenv("PROVIDER_MODE", "benchmark")

	handler, err := handlers.NewInferHandler()
	require.NoError(t, err)

	app := fiber.New()
	app.Post("/v1/infer", handler.HandleInfer)

	request := models.InferRequest{
		Model: "gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Test message"},
		},
		MaxTokens: 100,
	}

	reqBody, err := json.Marshal(request)
	require.NoError(t, err)

	req := httptest.NewRequest("POST", "/v1/infer", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req, 10000)
	require.NoError(t, err)
	defer resp.Body.Close()

	var inferResp models.InferResponse
	err = json.NewDecoder(resp.Body).Decode(&inferResp)
	require.NoError(t, err)

	// Verify cost is calculated
	assert.Greater(t, inferResp.Metadata.CostUSD, 0.0)

	// Verify cost is reasonable (not absurdly high or low)
	assert.Less(t, inferResp.Metadata.CostUSD, 1.0) // Should be < $1
	assert.Greater(t, inferResp.Metadata.CostUSD, 0.000001) // Should be > $0.000001
}

// TestE2EMetadataTracking verifies response metadata completeness
func TestE2EMetadataTracking(t *testing.T) {
	t.Setenv("PROVIDER_MODE", "benchmark")

	handler, err := handlers.NewInferHandler()
	require.NoError(t, err)

	app := fiber.New()
	app.Post("/v1/infer", handler.HandleInfer)

	request := models.InferRequest{
		Model: "claude-3-5-sonnet-20240229",
		Messages: []models.Message{
			{Role: "user", Content: "Hello"},
		},
	}

	reqBody, err := json.Marshal(request)
	require.NoError(t, err)

	req := httptest.NewRequest("POST", "/v1/infer", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req, 10000)
	require.NoError(t, err)
	defer resp.Body.Close()

	var inferResp models.InferResponse
	err = json.NewDecoder(resp.Body).Decode(&inferResp)
	require.NoError(t, err)

	// Verify metadata fields
	assert.NotNil(t, inferResp.Metadata)
	assert.NotEmpty(t, inferResp.Metadata.Provider)
	assert.NotEmpty(t, inferResp.Metadata.ModelUsed)
	assert.Greater(t, inferResp.Metadata.LatencyMs, int64(0))
	assert.NotEmpty(t, inferResp.Metadata.RouteDecision)
}

// TestE2ERequestValidation tests various validation scenarios
func TestE2ERequestValidation(t *testing.T) {
	validationTests := []struct {
		name    string
		request models.InferRequest
		wantErr bool
		errMsg  string
	}{
		{
			name: "Valid Request",
			request: models.InferRequest{
				Model:    "gpt-4",
				Messages: []models.Message{{Role: "user", Content: "test"}},
			},
			wantErr: false,
		},
		{
			name: "Invalid Temperature - Too High",
			request: models.InferRequest{
				Model:       "gpt-4",
				Messages:    []models.Message{{Role: "user", Content: "test"}},
				Temperature: 3.0,
			},
			wantErr: true,
		},
		{
			name: "Invalid Temperature - Negative",
			request: models.InferRequest{
				Model:       "gpt-4",
				Messages:    []models.Message{{Role: "user", Content: "test"}},
				Temperature: -0.1,
			},
			wantErr: true,
		},
		{
			name: "Invalid TopP",
			request: models.InferRequest{
				Model:    "gpt-4",
				Messages: []models.Message{{Role: "user", Content: "test"}},
				TopP:     1.5,
			},
			wantErr: true,
		},
		{
			name: "Empty Message Content",
			request: models.InferRequest{
				Model:    "gpt-4",
				Messages: []models.Message{{Role: "user", Content: ""}},
			},
			wantErr: true,
		},
		{
			name: "Invalid Message Role",
			request: models.InferRequest{
				Model:    "gpt-4",
				Messages: []models.Message{{Role: "invalid", Content: "test"}},
			},
			wantErr: true,
		},
	}

	t.Setenv("PROVIDER_MODE", "benchmark")

	handler, err := handlers.NewInferHandler()
	require.NoError(t, err)

	app := fiber.New()
	app.Post("/v1/infer", handler.HandleInfer)

	for _, tt := range validationTests {
		t.Run(tt.name, func(t *testing.T) {
			reqBody, err := json.Marshal(tt.request)
			require.NoError(t, err)

			req := httptest.NewRequest("POST", "/v1/infer", bytes.NewBuffer(reqBody))
			req.Header.Set("Content-Type", "application/json")

			resp, err := app.Test(req, 5000)
			require.NoError(t, err)
			defer resp.Body.Close()

			if tt.wantErr {
				assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
			} else {
				assert.Equal(t, http.StatusOK, resp.StatusCode)
			}
		})
	}
}

// TestE2EHealthCheck verifies health endpoint
func TestE2EHealthCheck(t *testing.T) {
	t.Setenv("PROVIDER_MODE", "benchmark")

	handler, err := handlers.NewInferHandler()
	require.NoError(t, err)

	app := fiber.New()
	app.Get("/v1/health", handler.HandleHealth)

	req := httptest.NewRequest("GET", "/v1/health", nil)
	resp, err := app.Test(req, 5000)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var healthResp map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&healthResp)
	require.NoError(t, err)

	assert.Equal(t, "healthy", healthResp["status"])
	assert.NotNil(t, healthResp["stats"])
}

// TestE2EConcurrentRequests tests handling of concurrent requests
func TestE2EConcurrentRequests(t *testing.T) {
	t.Setenv("PROVIDER_MODE", "benchmark")

	handler, err := handlers.NewInferHandler()
	require.NoError(t, err)

	app := fiber.New()
	app.Post("/v1/infer", handler.HandleInfer)

	concurrency := 10
	doneChan := make(chan bool, concurrency)

	for i := 0; i < concurrency; i++ {
		go func(id int) {
			request := models.InferRequest{
				Model: "gpt-4",
				Messages: []models.Message{
					{Role: "user", Content: "Test concurrent request"},
				},
			}

			reqBody, _ := json.Marshal(request)
			req := httptest.NewRequest("POST", "/v1/infer", bytes.NewBuffer(reqBody))
			req.Header.Set("Content-Type", "application/json")

			resp, err := app.Test(req, 10000)
			assert.NoError(t, err)
			if resp != nil {
				resp.Body.Close()
				assert.Equal(t, http.StatusOK, resp.StatusCode)
			}

			doneChan <- true
		}(i)
	}

	// Wait for all requests to complete
	timeout := time.After(30 * time.Second)
	completed := 0

	for completed < concurrency {
		select {
		case <-doneChan:
			completed++
		case <-timeout:
			t.Fatalf("Timeout waiting for concurrent requests to complete. Completed: %d/%d", completed, concurrency)
		}
	}
}
