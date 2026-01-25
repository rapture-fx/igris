package openai

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// TestNewOpenAIProvider_MissingAPIKey tests BYOK validation
func TestNewOpenAIProvider_MissingAPIKey(t *testing.T) {
	config := &providers.ProviderConfig{
		APIKey:  "", // Missing BYOK key
		BaseURL: "https://api.openai.com/v1",
	}

	provider, err := NewOpenAIProvider(config)
	if err == nil {
		t.Fatal("Expected error for missing API key, got nil")
	}

	if provider != nil {
		t.Fatal("Expected nil provider when API key is missing")
	}

	expectedError := "OpenAI API key is required"
	if err.Error() != expectedError {
		t.Errorf("Expected error '%s', got '%s'", expectedError, err.Error())
	}

	t.Log("✅ BYOK validation passed: missing key triggers error")
}

// TestNewOpenAIProvider_Success tests successful initialization
func TestNewOpenAIProvider_Success(t *testing.T) {
	config := &providers.ProviderConfig{
		APIKey:     "sk-test-placeholder-key-for-testing",
		BaseURL:    "https://api.openai.com/v1",
		Timeout:    30,
		MaxRetries: 3,
	}

	provider, err := NewOpenAIProvider(config)
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}

	if provider == nil {
		t.Fatal("Provider is nil")
	}

	if provider.Name() != "openai" {
		t.Errorf("Expected provider name 'openai', got '%s'", provider.Name())
	}

	capabilities := provider.GetCapabilities()
	if capabilities == nil {
		t.Fatal("Capabilities are nil")
	}

	if !capabilities.SupportsStreaming {
		t.Error("Expected streaming support to be true")
	}

	t.Log("✅ Provider initialization succeeded with test key")
}

// TestInfer_MockServer tests the Infer method with a mock HTTP server
func TestInfer_MockServer(t *testing.T) {
	// Create mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify auth header
		authHeader := r.Header.Get("Authorization")
		if authHeader != "Bearer sk-test-mock" {
			t.Errorf("Expected auth header 'Bearer sk-test-mock', got '%s'", authHeader)
		}

		// Return mock response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{
			"id": "chatcmpl-test123",
			"object": "chat.completion",
			"created": 1234567890,
			"model": "gpt-3.5-turbo",
			"choices": [{
				"index": 0,
				"message": {
					"role": "assistant",
					"content": "Hello! This is a test response."
				},
				"finish_reason": "stop"
			}],
			"usage": {
				"prompt_tokens": 10,
				"completion_tokens": 20,
				"total_tokens": 30
			}
		}`))
	}))
	defer server.Close()

	// Create provider with mock server
	config := &providers.ProviderConfig{
		APIKey:     "sk-test-mock",
		BaseURL:    server.URL,
		Timeout:    10,
		MaxRetries: 1,
	}

	provider, err := NewOpenAIProvider(config)
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}

	// Create test request
	req := &models.InferRequest{
		Model: "gpt-3.5-turbo",
		Messages: []models.Message{
			{Role: "user", Content: "Hello"},
		},
		MaxTokens:   100,
		Temperature: 0.7,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Make inference call
	resp, err := provider.Infer(ctx, req)
	if err != nil {
		t.Fatalf("Inference failed: %v", err)
	}

	// Validate response
	if resp.ID != "chatcmpl-test123" {
		t.Errorf("Expected ID 'chatcmpl-test123', got '%s'", resp.ID)
	}

	if len(resp.Choices) != 1 {
		t.Fatalf("Expected 1 choice, got %d", len(resp.Choices))
	}

	if resp.Choices[0].Message.Content != "Hello! This is a test response." {
		t.Errorf("Unexpected response content: %s", resp.Choices[0].Message.Content)
	}

	if resp.Usage.PromptTokens != 10 {
		t.Errorf("Expected 10 prompt tokens, got %d", resp.Usage.PromptTokens)
	}

	if resp.Usage.CompletionTokens != 20 {
		t.Errorf("Expected 20 completion tokens, got %d", resp.Usage.CompletionTokens)
	}

	// Verify cost calculation
	if resp.Metadata.CostUSD == 0.0 {
		t.Error("Expected non-zero cost calculation")
	}

	t.Logf("✅ Mock inference succeeded: cost=$%.6f, latency=%dms",
		resp.Metadata.CostUSD, resp.Metadata.LatencyMs)
}

// TestInfer_AuthError tests authentication error handling
func TestInfer_AuthError(t *testing.T) {
	// Create mock server that returns 401
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{
			"error": {
				"message": "Invalid API key",
				"type": "invalid_request_error",
				"code": "invalid_api_key"
			}
		}`))
	}))
	defer server.Close()

	config := &providers.ProviderConfig{
		APIKey:     "sk-invalid-key",
		BaseURL:    server.URL,
		Timeout:    10,
		MaxRetries: 0, // No retries for auth errors
	}

	provider, err := NewOpenAIProvider(config)
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}

	req := &models.InferRequest{
		Model: "gpt-3.5-turbo",
		Messages: []models.Message{
			{Role: "user", Content: "Test"},
		},
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := provider.Infer(ctx, req)
	if err == nil {
		t.Fatal("Expected error for invalid API key, got nil")
	}

	if resp != nil {
		t.Error("Expected nil response on auth error")
	}

	t.Logf("✅ Auth error handled correctly: %v", err)
}

// TestHealthCheck tests the health check implementation
func TestHealthCheck_MockServer(t *testing.T) {
	// Create mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/models" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"data": []}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	config := &providers.ProviderConfig{
		APIKey:  "sk-test-health",
		BaseURL: server.URL,
		Timeout: 10,
	}

	provider, err := NewOpenAIProvider(config)
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = provider.HealthCheck(ctx)
	if err != nil {
		t.Errorf("Health check failed: %v", err)
	}

	t.Log("✅ Health check passed")
}

// TestHealthCheck_InvalidKey tests health check with invalid API key
func TestHealthCheck_InvalidKey(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error": {"message": "Invalid API key"}}`))
	}))
	defer server.Close()

	config := &providers.ProviderConfig{
		APIKey:  "sk-invalid",
		BaseURL: server.URL,
		Timeout: 10,
	}

	provider, err := NewOpenAIProvider(config)
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = provider.HealthCheck(ctx)
	if err == nil {
		t.Fatal("Expected health check to fail with invalid key")
	}

	expectedError := "invalid API key (401 Unauthorized)"
	if err.Error() != expectedError {
		t.Errorf("Expected error '%s', got '%s'", expectedError, err.Error())
	}

	t.Logf("✅ Health check correctly detected invalid key: %v", err)
}

// TestCalculateCost tests model-specific pricing
func TestCalculateCost(t *testing.T) {
	testCases := []struct {
		name              string
		model             string
		promptTokens      int
		completionTokens  int
		expectedMinCost   float64 // Approximate minimum
		expectedMaxCost   float64 // Approximate maximum
	}{
		{
			name:             "GPT-3.5 Turbo",
			model:            "gpt-3.5-turbo",
			promptTokens:     1000,
			completionTokens: 500,
			expectedMinCost:  0.0,
			expectedMaxCost:  0.002, // Very cheap model
		},
		{
			name:             "GPT-4",
			model:            "gpt-4",
			promptTokens:     1000,
			completionTokens: 500,
			expectedMinCost:  0.05,  // More expensive
			expectedMaxCost:  0.10,
		},
		{
			name:             "GPT-4 Turbo",
			model:            "gpt-4-turbo",
			promptTokens:     1000,
			completionTokens: 500,
			expectedMinCost:  0.01,
			expectedMaxCost:  0.05,
		},
	}

	config := &providers.ProviderConfig{
		APIKey:  "sk-test",
		BaseURL: "https://api.openai.com/v1",
	}

	provider, _ := NewOpenAIProvider(config)

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			usage := &models.UsageStats{
				PromptTokens:     tc.promptTokens,
				CompletionTokens: tc.completionTokens,
				TotalTokens:      tc.promptTokens + tc.completionTokens,
			}

			cost := provider.calculateCost(usage, tc.model)

			if cost < tc.expectedMinCost || cost > tc.expectedMaxCost {
				t.Errorf("Cost $%.6f outside expected range [$%.6f, $%.6f]",
					cost, tc.expectedMinCost, tc.expectedMaxCost)
			}

			t.Logf("✅ %s: %d prompt + %d completion tokens = $%.6f",
				tc.model, tc.promptTokens, tc.completionTokens, cost)
		})
	}
}

// TestClose tests resource cleanup
func TestClose(t *testing.T) {
	config := &providers.ProviderConfig{
		APIKey:  "sk-test",
		BaseURL: "https://api.openai.com/v1",
	}

	provider, err := NewOpenAIProvider(config)
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}

	err = provider.Close()
	if err != nil {
		t.Errorf("Close failed: %v", err)
	}

	t.Log("✅ Resource cleanup succeeded")
}
