package router

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRouteCouncil_BasicExecution tests basic council mode functionality
func TestRouteCouncil_BasicExecution(t *testing.T) {
	// Setup
	registry := providers.NewProviderRegistry()

	// Register multiple mock providers
	for i := 1; i <= 3; i++ {
		providerID := fmt.Sprintf("mock-provider-%d", i)
		mockProvider := &CouncilMockProvider{
			ProviderID: providerID,
			InferFunc: func(ctx context.Context, req *models.InferRequest) (*models.InferResponse, error) {
				// Simulate different responses from each provider
				return &models.InferResponse{
					ID:      "test-council-response",
					Object:  "chat.completion",
					Created: time.Now().Unix(),
					Model:   req.Model,
					Choices: []models.Choice{
						{
							Index: 0,
							Message: &models.Message{
								Role:    "assistant",
								Content: fmt.Sprintf("Response from %s: This is a test answer", providerID),
							},
							FinishReason: "stop",
						},
					},
					Usage: &models.UsageStats{
						PromptTokens:     50,
						CompletionTokens: 100,
						TotalTokens:      150,
					},
					Metadata: &models.ResponseMetadata{
						Provider:  providerID,
						ModelUsed: req.Model,
					},
				}, nil
			},
		}
		registry.Register(mockProvider)
	}

	// Create speculative router with council config
	cfg := &config.SpeculativeConfig{
		Enabled:           true,
		MaxProviders:      3,
		FirstTokenTimeout: 5 * time.Second,
		ChairmanProvider:  "mock-provider-1", // Use first provider as chairman
		WasteThreshold:    0.3,
	}

	speculativeRouter := NewSpeculativeRouter(cfg, nil, registry)

	// Create test request
	req := &models.InferRequest{
		Model: "gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "What is the capital of France?"},
		},
		MaxTokens:   100,
		Temperature: 0.7,
	}

	// Execute council mode
	ctx := context.Background()
	resp, metadata, err := speculativeRouter.RouteCouncil(ctx, req)

	// Assertions
	require.NoError(t, err, "Council execution should not error")
	require.NotNil(t, resp, "Response should not be nil")
	require.NotNil(t, metadata, "Metadata should not be nil")

	assert.Equal(t, 3, len(metadata.ProvidersUsed), "Should use 3 providers")
	assert.Equal(t, "mock-provider-1", metadata.ChairmanProvider, "Chairman should be mock-provider-1")
	assert.Equal(t, 3, metadata.ResponseCount, "Should have 3 council responses")
	assert.Greater(t, metadata.TotalLatencyMs, int64(0), "Total latency should be positive")
	assert.Greater(t, metadata.SynthesisLatencyMs, int64(0), "Synthesis latency should be positive")

	assert.NotEmpty(t, resp.Choices, "Response should have choices")
	assert.NotEmpty(t, resp.Choices[0].Message.Content, "Response content should not be empty")

	t.Logf("Council mode test passed: %d providers, %dms latency, winner=%s",
		metadata.ResponseCount, metadata.TotalLatencyMs, metadata.WinnerProvider)
}

// TestRouteCouncil_OneModelFailure tests council mode with one provider failure
func TestRouteCouncil_OneModelFailure(t *testing.T) {
	// Setup
	registry := providers.NewProviderRegistry()

	// Register 4 providers, one will fail
	for i := 1; i <= 4; i++ {
		providerID := fmt.Sprintf("mock-provider-%d", i)
		shouldFail := (i == 2) // Provider 2 will fail

		mockProvider := &CouncilMockProvider{
			ProviderID: providerID,
			InferFunc: func(ctx context.Context, req *models.InferRequest) (*models.InferResponse, error) {
				if shouldFail {
					return nil, fmt.Errorf("provider %s failed intentionally", providerID)
				}

				return &models.InferResponse{
					ID:      "test-response",
					Object:  "chat.completion",
					Created: time.Now().Unix(),
					Model:   req.Model,
					Choices: []models.Choice{
						{
							Index: 0,
							Message: &models.Message{
								Role:    "assistant",
								Content: fmt.Sprintf("Response from %s", providerID),
							},
							FinishReason: "stop",
						},
					},
					Usage: &models.UsageStats{
						PromptTokens:     50,
						CompletionTokens: 100,
						TotalTokens:      150,
					},
					Metadata: &models.ResponseMetadata{
						Provider:  providerID,
						ModelUsed: req.Model,
					},
				}, nil
			},
		}
		registry.Register(mockProvider)
	}

	// Create speculative router
	cfg := &config.SpeculativeConfig{
		Enabled:           true,
		MaxProviders:      4,
		FirstTokenTimeout: 5 * time.Second,
		ChairmanProvider:  "mock-provider-1",
		WasteThreshold:    0.3,
	}

	speculativeRouter := NewSpeculativeRouter(cfg, nil, registry)

	// Create test request
	req := &models.InferRequest{
		Model: "gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Explain quantum computing"},
		},
		MaxTokens: 200,
	}

	// Execute council mode
	ctx := context.Background()
	resp, metadata, err := speculativeRouter.RouteCouncil(ctx, req)

	// Assertions - should still succeed with 3 providers
	require.NoError(t, err, "Council should succeed even with one failure")
	require.NotNil(t, resp, "Response should not be nil")
	require.NotNil(t, metadata, "Metadata should not be nil")

	// Should have 3 responses (4 providers - 1 failure)
	assert.GreaterOrEqual(t, metadata.ResponseCount, 2, "Should have at least 2 responses despite one failure")
	assert.LessOrEqual(t, metadata.ResponseCount, 3, "Should have at most 3 responses (one failed)")

	assert.NotEmpty(t, resp.Choices, "Response should have choices")

	t.Logf("Council with failure test passed: %d/%d providers succeeded",
		metadata.ResponseCount, len(metadata.ProvidersUsed))
}

// TestRouteCouncil_RankingValidation tests peer ranking functionality
func TestRouteCouncil_RankingValidation(t *testing.T) {
	// Setup
	registry := providers.NewProviderRegistry()

	// Register 3 providers with mock ranking responses
	for i := 1; i <= 3; i++ {
		providerID := fmt.Sprintf("mock-provider-%d", i)

		mockProvider := &CouncilMockProvider{
			ProviderID: providerID,
			InferFunc: func(ctx context.Context, req *models.InferRequest) (*models.InferResponse, error) {
				// Check if this is a ranking request (contains "Rank these" in prompt)
				isRankingRequest := false
				for _, msg := range req.Messages {
					if len(msg.Content) > 100 && contains(msg.Content, "Rank these") {
						isRankingRequest = true
						break
					}
				}

				if isRankingRequest {
					// Return mock ranking JSON
					rankingJSON := `{
						"rankings": [
							{"response_id": 1, "rank": 1, "justification": "Clear and accurate"},
							{"response_id": 2, "rank": 2, "justification": "Good but verbose"},
							{"response_id": 3, "rank": 3, "justification": "Incomplete"}
						]
					}`

					return &models.InferResponse{
						ID:      "ranking-response",
						Object:  "chat.completion",
						Created: time.Now().Unix(),
						Model:   req.Model,
						Choices: []models.Choice{
							{
								Index: 0,
								Message: &models.Message{
									Role:    "assistant",
									Content: rankingJSON,
								},
								FinishReason: "stop",
							},
						},
						Usage: &models.UsageStats{
							PromptTokens:     100,
							CompletionTokens: 50,
							TotalTokens:      150,
						},
					}, nil
				}

				// Regular inference response
				return &models.InferResponse{
					ID:      "test-response",
					Object:  "chat.completion",
					Created: time.Now().Unix(),
					Model:   req.Model,
					Choices: []models.Choice{
						{
							Index: 0,
							Message: &models.Message{
								Role:    "assistant",
								Content: fmt.Sprintf("Provider %s response with quality content", providerID),
							},
							FinishReason: "stop",
						},
					},
					Usage: &models.UsageStats{
						PromptTokens:     50,
						CompletionTokens: 150,
						TotalTokens:      200,
					},
					Metadata: &models.ResponseMetadata{
						Provider:  providerID,
						ModelUsed: req.Model,
					},
				}, nil
			},
		}
		registry.Register(mockProvider)
	}

	// Create speculative router
	cfg := &config.SpeculativeConfig{
		Enabled:           true,
		MaxProviders:      3,
		FirstTokenTimeout: 5 * time.Second,
		ChairmanProvider:  "mock-provider-1",
		WasteThreshold:    0.3,
	}

	speculativeRouter := NewSpeculativeRouter(cfg, nil, registry)

	// Create test request
	req := &models.InferRequest{
		Model: "gpt-4",
		Messages: []models.Message{
			{Role: "user", Content: "Compare different approaches to machine learning"},
		},
		MaxTokens: 300,
	}

	// Execute council mode
	ctx := context.Background()
	resp, metadata, err := speculativeRouter.RouteCouncil(ctx, req)

	// Assertions
	require.NoError(t, err, "Council with ranking should succeed")
	require.NotNil(t, resp, "Response should not be nil")
	require.NotNil(t, metadata, "Metadata should not be nil")

	assert.Equal(t, 3, metadata.ResponseCount, "Should have 3 council responses")
	assert.True(t, metadata.RankingEnabled, "Ranking should be enabled")
	assert.Greater(t, metadata.RankingLatencyMs, int64(0), "Ranking latency should be measured")
	assert.NotEmpty(t, metadata.WinnerProvider, "Should have a winner provider based on rankings")

	assert.NotEmpty(t, resp.Choices, "Response should have choices")
	assert.Greater(t, len(resp.Choices[0].Message.Content), 10, "Synthesized response should have content")

	t.Logf("Ranking validation test passed: ranking_latency=%dms, winner=%s",
		metadata.RankingLatencyMs, metadata.WinnerProvider)
}

// CouncilMockProvider for testing council mode (different from MockProvider in speculative tests)
type CouncilMockProvider struct {
	ProviderID string
	InferFunc  func(ctx context.Context, req *models.InferRequest) (*models.InferResponse, error)
}

func (m *CouncilMockProvider) Name() string {
	return m.ProviderID
}

func (m *CouncilMockProvider) Infer(ctx context.Context, req *models.InferRequest) (*models.InferResponse, error) {
	if m.InferFunc != nil {
		return m.InferFunc(ctx, req)
	}
	return nil, fmt.Errorf("InferFunc not implemented")
}

func (m *CouncilMockProvider) InferStream(ctx context.Context, req *models.InferRequest) (<-chan *models.StreamChunk, <-chan error) {
	// Not used in council mode
	chunkChan := make(chan *models.StreamChunk)
	errChan := make(chan error, 1)
	close(chunkChan)
	close(errChan)
	return chunkChan, errChan
}

func (m *CouncilMockProvider) HealthCheck(ctx context.Context) error {
	return nil
}

func (m *CouncilMockProvider) Close() error {
	return nil
}

func (m *CouncilMockProvider) EstimateCost(req *models.InferRequest) (float64, error) {
	// Simple mock cost estimation
	return 0.001, nil
}

func (m *CouncilMockProvider) GetCapabilities() *providers.ProviderCapabilities {
	return &providers.ProviderCapabilities{
		SupportsStreaming: true,
		SupportsVision:    false,
		MaxTokens:         4096,
	}
}

// Helper function
func contains(s, substr string) bool {
	return len(s) >= len(substr) && findSubstring(s, substr)
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
