package tests

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/schlep-engine/schlep-engine/internal/api"
	"github.com/schlep-engine/schlep-engine/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupTestApp creates a test Fiber app with /v1/infer routes
func setupTestApp(t *testing.T) *fiber.App {
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": err.Error(),
			})
		},
	})

	err := api.RegisterV1Routes(app)
	require.NoError(t, err, "Failed to register routes")

	return app
}

// TestInferEndpoint_BasicRequest tests basic inference request
func TestInferEndpoint_BasicRequest(t *testing.T) {
	app := setupTestApp(t)

	// Create test request
	req := models.InferRequest{
		Model: "gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Hello, how are you?"},
		},
		MaxTokens: 100,
	}

	reqBody, err := json.Marshal(req)
	require.NoError(t, err)

	// Make HTTP request
	httpReq := httptest.NewRequest("POST", "/v1/infer", bytes.NewReader(reqBody))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(httpReq, -1)
	require.NoError(t, err)
	defer resp.Body.Close()

	// Assert response
	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var inferResp models.InferResponse
	body, _ := io.ReadAll(resp.Body)
	err = json.Unmarshal(body, &inferResp)
	require.NoError(t, err)

	assert.NotEmpty(t, inferResp.ID)
	assert.Equal(t, "chat.completion", inferResp.Object)
	assert.Equal(t, req.Model, inferResp.Model)
	assert.NotEmpty(t, inferResp.Choices)
	assert.NotNil(t, inferResp.Metadata)
}

// TestInferEndpoint_ValidationErrors tests request validation
func TestInferEndpoint_ValidationErrors(t *testing.T) {
	app := setupTestApp(t)

	testCases := []struct {
		name    string
		request models.InferRequest
		wantErr string
	}{
		{
			name: "missing_model",
			request: models.InferRequest{
				Messages: []models.Message{
					{Role: "user", Content: "Hello"},
				},
			},
			wantErr: "model is required",
		},
		{
			name: "empty_messages",
			request: models.InferRequest{
				Model:    "gpt-4",
				Messages: []models.Message{},
			},
			wantErr: "messages cannot be empty",
		},
		{
			name: "invalid_role",
			request: models.InferRequest{
				Model: "gpt-4",
				Messages: []models.Message{
					{Role: "invalid", Content: "Hello"},
				},
			},
			wantErr: "invalid role",
		},
		{
			name: "invalid_temperature",
			request: models.InferRequest{
				Model: "gpt-4",
				Messages: []models.Message{
					{Role: "user", Content: "Hello"},
				},
				Temperature: 3.0,
			},
			wantErr: "temperature must be between 0.0 and 2.0",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			reqBody, err := json.Marshal(tc.request)
			require.NoError(t, err)

			httpReq := httptest.NewRequest("POST", "/v1/infer", bytes.NewReader(reqBody))
			httpReq.Header.Set("Content-Type", "application/json")

			resp, err := app.Test(httpReq, -1)
			require.NoError(t, err)
			defer resp.Body.Close()

			assert.Equal(t, fiber.StatusBadRequest, resp.StatusCode)

			var errResp map[string]interface{}
			body, _ := io.ReadAll(resp.Body)
			err = json.Unmarshal(body, &errResp)
			require.NoError(t, err)

			assert.Contains(t, errResp, "error")
		})
	}
}

// TestInferEndpoint_ProviderSelection tests provider routing
func TestInferEndpoint_ProviderSelection(t *testing.T) {
	app := setupTestApp(t)

	testCases := []struct {
		name             string
		model            string
		expectedProvider string
	}{
		{
			name:             "openai_model",
			model:            "gpt-4",
			expectedProvider: "openai",
		},
		{
			name:             "anthropic_model",
			model:            "claude-3-opus-20240229",
			expectedProvider: "anthropic",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := models.InferRequest{
				Model: tc.model,
				Messages: []models.Message{
					{Role: "user", Content: "Test message"},
				},
			}

			reqBody, err := json.Marshal(req)
			require.NoError(t, err)

			httpReq := httptest.NewRequest("POST", "/v1/infer", bytes.NewReader(reqBody))
			httpReq.Header.Set("Content-Type", "application/json")

			resp, err := app.Test(httpReq, -1)
			require.NoError(t, err)
			defer resp.Body.Close()

			assert.Equal(t, fiber.StatusOK, resp.StatusCode)

			var inferResp models.InferResponse
			body, _ := io.ReadAll(resp.Body)
			err = json.Unmarshal(body, &inferResp)
			require.NoError(t, err)

			assert.Equal(t, tc.expectedProvider, inferResp.Metadata.Provider)
		})
	}
}

// TestInferEndpoint_PolicyOverride tests explicit provider override
func TestInferEndpoint_PolicyOverride(t *testing.T) {
	app := setupTestApp(t)

	req := models.InferRequest{
		Model: "gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Test"},
		},
		Policy: &models.PolicyOverride{
			Provider: "anthropic",
		},
	}

	reqBody, err := json.Marshal(req)
	require.NoError(t, err)

	httpReq := httptest.NewRequest("POST", "/v1/infer", bytes.NewReader(reqBody))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(httpReq, -1)
	require.NoError(t, err)
	defer resp.Body.Close()

	var inferResp models.InferResponse
	body, _ := io.ReadAll(resp.Body)
	err = json.Unmarshal(body, &inferResp)
	require.NoError(t, err)

	assert.Equal(t, "anthropic", inferResp.Metadata.Provider)
}

// TestHealthEndpoint tests /v1/health
func TestHealthEndpoint(t *testing.T) {
	app := setupTestApp(t)

	httpReq := httptest.NewRequest("GET", "/v1/health", nil)
	resp, err := app.Test(httpReq, -1)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var healthResp map[string]interface{}
	body, _ := io.ReadAll(resp.Body)
	err = json.Unmarshal(body, &healthResp)
	require.NoError(t, err)

	assert.Equal(t, "healthy", healthResp["status"])
	assert.Contains(t, healthResp, "providers")
}

// TestModelsEndpoint tests /v1/models
func TestModelsEndpoint(t *testing.T) {
	app := setupTestApp(t)

	httpReq := httptest.NewRequest("GET", "/v1/models", nil)
	resp, err := app.Test(httpReq, -1)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var modelsResp map[string]interface{}
	body, _ := io.ReadAll(resp.Body)
	err = json.Unmarshal(body, &modelsResp)
	require.NoError(t, err)

	assert.Equal(t, "list", modelsResp["object"])
	assert.Contains(t, modelsResp, "data")
}

// TestOpenAICompatibility tests OpenAI-compatible endpoint
func TestOpenAICompatibility(t *testing.T) {
	app := setupTestApp(t)

	req := models.InferRequest{
		Model: "gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Hello"},
		},
	}

	reqBody, err := json.Marshal(req)
	require.NoError(t, err)

	// Test OpenAI-compatible endpoint
	httpReq := httptest.NewRequest("POST", "/v1/chat/completions", bytes.NewReader(reqBody))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(httpReq, -1)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, fiber.StatusOK, resp.StatusCode)

	var inferResp models.InferResponse
	body, _ := io.ReadAll(resp.Body)
	err = json.Unmarshal(body, &inferResp)
	require.NoError(t, err)

	assert.Equal(t, "chat.completion", inferResp.Object)
}

// TODO: Add streaming tests
// func TestInferEndpoint_Streaming(t *testing.T) { ... }

// TODO: Add performance benchmarks
// func BenchmarkInferEndpoint(b *testing.B) { ... }

// TODO: Add concurrency tests
// func TestInferEndpoint_Concurrent(t *testing.T) { ... }
