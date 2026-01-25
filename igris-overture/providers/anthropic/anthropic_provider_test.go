package anthropic

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// TestNewAnthropicProvider_MissingAPIKey tests BYOK validation
func TestNewAnthropicProvider_MissingAPIKey(t *testing.T) {
	config := &providers.ProviderConfig{
		APIKey:  "", // Missing BYOK key
		BaseURL: "https://api.anthropic.com/v1",
	}

	provider, err := NewAnthropicProvider(config)
	if err == nil {
		t.Fatal("Expected error for missing API key, got nil")
	}

	if provider != nil {
		t.Fatal("Expected nil provider when API key is missing")
	}

	expectedError := "Anthropic API key is required"
	if err.Error() != expectedError {
		t.Errorf("Expected error '%s', got '%s'", expectedError, err.Error())
	}

	t.Log("✅ BYOK validation passed: missing key triggers error")
}

// TestNewAnthropicProvider_Success tests successful initialization
func TestNewAnthropicProvider_Success(t *testing.T) {
	config := &providers.ProviderConfig{
		APIKey:     "sk-ant-test-placeholder-key-for-testing",
		BaseURL:    "https://api.anthropic.com/v1",
		Timeout:    30,
		MaxRetries: 3,
	}

	provider, err := NewAnthropicProvider(config)
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}

	if provider == nil {
		t.Fatal("Provider is nil")
	}

	if provider.Name() != "anthropic" {
		t.Errorf("Expected provider name 'anthropic', got '%s'", provider.Name())
	}

	capabilities := provider.GetCapabilities()
	if capabilities == nil {
		t.Fatal("Capabilities are nil")
	}

	if !capabilities.SupportsStreaming {
		t.Error("Expected streaming support to be true")
	}

	if !capabilities.SupportsTopK {
		t.Error("Expected top_k support to be true (unique to Anthropic)")
	}

	t.Log("✅ Provider initialization succeeded with test key")
}

// TestInfer_MockServer tests the Infer method with a mock HTTP server
func TestInfer_MockServer(t *testing.T) {
	// Create mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify Anthropic-specific headers
		apiKey := r.Header.Get("x-api-key")
		if apiKey != "sk-ant-test-mock" {
			t.Errorf("Expected x-api-key header 'sk-ant-test-mock', got '%s'", apiKey)
		}

		version := r.Header.Get("anthropic-version")
		if version != "2023-06-01" {
			t.Errorf("Expected anthropic-version '2023-06-01', got '%s'", version)
		}

		// Return mock Claude response
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{
			"id": "msg-test123",
			"type": "message",
			"role": "assistant",
			"content": [{
				"type": "text",
				"text": "Hello! This is a test response from Claude."
			}],
			"model": "claude-3-sonnet-20240229",
			"stop_reason": "end_turn",
			"usage": {
				"input_tokens": 15,
				"output_tokens": 25
			}
		}`))
	}))
	defer server.Close()

	// Create provider with mock server
	config := &providers.ProviderConfig{
		APIKey:     "sk-ant-test-mock",
		BaseURL:    server.URL,
		Timeout:    10,
		MaxRetries: 1,
	}

	provider, err := NewAnthropicProvider(config)
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}

	// Create test request
	req := &models.InferRequest{
		Model: "claude-3-sonnet-20240229",
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
	if resp.ID != "msg-test123" {
		t.Errorf("Expected ID 'msg-test123', got '%s'", resp.ID)
	}

	if len(resp.Choices) != 1 {
		t.Fatalf("Expected 1 choice, got %d", len(resp.Choices))
	}

	if resp.Choices[0].Message.Content != "Hello! This is a test response from Claude." {
		t.Errorf("Unexpected response content: %s", resp.Choices[0].Message.Content)
	}

	if resp.Usage.PromptTokens != 15 {
		t.Errorf("Expected 15 input tokens, got %d", resp.Usage.PromptTokens)
	}

	if resp.Usage.CompletionTokens != 25 {
		t.Errorf("Expected 25 output tokens, got %d", resp.Usage.CompletionTokens)
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
			"type": "error",
			"error": {
				"type": "authentication_error",
				"message": "invalid x-api-key"
			}
		}`))
	}))
	defer server.Close()

	config := &providers.ProviderConfig{
		APIKey:     "sk-ant-invalid-key",
		BaseURL:    server.URL,
		Timeout:    10,
		MaxRetries: 0, // No retries for auth errors
	}

	provider, err := NewAnthropicProvider(config)
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}

	req := &models.InferRequest{
		Model: "claude-3-sonnet-20240229",
		Messages: []models.Message{
			{Role: "user", Content: "Test"},
		},
		MaxTokens: 100,
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
		// Verify it's a minimal request
		if r.URL.Path == "/messages" {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{
				"id": "msg-health",
				"type": "message",
				"role": "assistant",
				"content": [{"type": "text", "text": "Hi"}],
				"model": "claude-3-haiku-20240307",
				"usage": {"input_tokens": 1, "output_tokens": 1}
			}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	config := &providers.ProviderConfig{
		APIKey:  "sk-ant-test-health",
		BaseURL: server.URL,
		Timeout: 10,
	}

	provider, err := NewAnthropicProvider(config)
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
		w.Write([]byte(`{"type": "error", "error": {"message": "invalid x-api-key"}}`))
	}))
	defer server.Close()

	config := &providers.ProviderConfig{
		APIKey:  "sk-ant-invalid",
		BaseURL: server.URL,
		Timeout: 10,
	}

	provider, err := NewAnthropicProvider(config)
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err = provider.HealthCheck(ctx)
	if err == nil {
		t.Fatal("Expected health check to fail with invalid key")
	}

	expectedError := "invalid API key (status 401)"
	if err.Error() != expectedError {
		t.Errorf("Expected error '%s', got '%s'", expectedError, err.Error())
	}

	t.Logf("✅ Health check correctly detected invalid key: %v", err)
}

// TestCalculateCost tests model-specific pricing
func TestCalculateCost(t *testing.T) {
	testCases := []struct {
		name             string
		model            string
		inputTokens      int
		outputTokens     int
		expectedMinCost  float64
		expectedMaxCost  float64
	}{
		{
			name:            "Claude 3 Haiku",
			model:           "claude-3-haiku-20240307",
			inputTokens:     1000,
			outputTokens:    500,
			expectedMinCost: 0.0,
			expectedMaxCost: 0.002, // Very cheap model
		},
		{
			name:            "Claude 3 Sonnet",
			model:           "claude-3-sonnet-20240229",
			inputTokens:     1000,
			outputTokens:    500,
			expectedMinCost: 0.005,
			expectedMaxCost: 0.020,
		},
		{
			name:            "Claude 3 Opus",
			model:           "claude-3-opus-20240229",
			inputTokens:     1000,
			outputTokens:    500,
			expectedMinCost: 0.030, // Most expensive
			expectedMaxCost: 0.100,
		},
		{
			name:            "Claude 2.1",
			model:           "claude-2.1",
			inputTokens:     1000,
			outputTokens:    500,
			expectedMinCost: 0.010,
			expectedMaxCost: 0.030,
		},
	}

	config := &providers.ProviderConfig{
		APIKey:  "sk-ant-test",
		BaseURL: "https://api.anthropic.com/v1",
	}

	provider, _ := NewAnthropicProvider(config)

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			usage := &models.UsageStats{
				PromptTokens:     tc.inputTokens,
				CompletionTokens: tc.outputTokens,
				TotalTokens:      tc.inputTokens + tc.outputTokens,
			}

			cost := provider.calculateCost(usage, tc.model)

			if cost < tc.expectedMinCost || cost > tc.expectedMaxCost {
				t.Errorf("Cost $%.6f outside expected range [$%.6f, $%.6f]",
					cost, tc.expectedMinCost, tc.expectedMaxCost)
			}

			t.Logf("✅ %s: %d input + %d output tokens = $%.6f",
				tc.model, tc.inputTokens, tc.outputTokens, cost)
		})
	}
}

// TestSystemMessageHandling tests Anthropic's unique system message handling
func TestSystemMessageHandling(t *testing.T) {
	config := &providers.ProviderConfig{
		APIKey:  "sk-ant-test",
		BaseURL: "https://api.anthropic.com/v1",
	}

	provider, _ := NewAnthropicProvider(config)

	req := &models.InferRequest{
		Model: "claude-3-sonnet-20240229",
		Messages: []models.Message{
			{Role: "system", Content: "You are a helpful assistant."},
			{Role: "user", Content: "Hello"},
		},
		MaxTokens: 100,
	}

	anthropicReq := provider.buildAnthropicRequest(req)

	// Verify system message is extracted
	if anthropicReq.System != "You are a helpful assistant." {
		t.Errorf("Expected system message in System field, got: %s", anthropicReq.System)
	}

	// Verify system message not in Messages array
	for _, msg := range anthropicReq.Messages {
		if msg.Role == "system" {
			t.Error("System message should not be in Messages array for Anthropic")
		}
	}

	if len(anthropicReq.Messages) != 1 {
		t.Errorf("Expected 1 user message, got %d", len(anthropicReq.Messages))
	}

	t.Log("✅ System message correctly extracted to separate field")
}

// TestClose tests resource cleanup
func TestClose(t *testing.T) {
	config := &providers.ProviderConfig{
		APIKey:  "sk-ant-test",
		BaseURL: "https://api.anthropic.com/v1",
	}

	provider, err := NewAnthropicProvider(config)
	if err != nil {
		t.Fatalf("Failed to create provider: %v", err)
	}

	err = provider.Close()
	if err != nil {
		t.Errorf("Close failed: %v", err)
	}

	t.Log("✅ Resource cleanup succeeded")
}
