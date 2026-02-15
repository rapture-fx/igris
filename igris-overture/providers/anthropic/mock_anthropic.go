package anthropic

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// MockAnthropicProvider implements a realistic mock for Anthropic API
// Simulates latency, token usage, and costs without making external API calls
type MockAnthropicProvider struct {
	config       *providers.ProviderConfig
	capabilities *providers.ProviderCapabilities
	rng          *rand.Rand
}

// MockAnthropicConfig holds mock-specific configuration for Anthropic
type MockAnthropicConfig struct {
	MinLatencyMs     int     // Minimum simulated latency (Anthropic tends to be slower)
	MaxLatencyMs     int     // Maximum simulated latency
	MinTokens        int     // Minimum token usage
	MaxTokens        int     // Maximum token usage
	CostPerToken     float64 // Cost per token in USD
	EnableVariation  bool    // Enable random variation in responses
}

// DefaultMockAnthropicConfig returns sensible defaults for Anthropic mock behavior
func DefaultMockAnthropicConfig() *MockAnthropicConfig {
	return &MockAnthropicConfig{
		MinLatencyMs:    120, // Anthropic typically 120-220ms
		MaxLatencyMs:    220,
		MinTokens:       100,
		MaxTokens:       1200,
		CostPerToken:    0.000003, // $0.003 per 1K tokens (Sonnet pricing)
		EnableVariation: true,
	}
}

// NewMockAnthropicProvider creates a new mock Anthropic provider instance
func NewMockAnthropicProvider(config *providers.ProviderConfig) (*MockAnthropicProvider, error) {
	// Mock provider doesn't require API key, but we validate config structure
	if config == nil {
		config = &providers.ProviderConfig{
			BaseURL:       "https://mock.anthropic.igris-inertial.local",
			Timeout:       30,
			MaxRetries:    3,
			EnableMetrics: true,
		}
	}

	// Initialize random number generator with time-based seed for realistic variation
	source := rand.NewSource(time.Now().UnixNano())
	rng := rand.New(source)

	provider := &MockAnthropicProvider{
		config:       config,
		capabilities: getMockAnthropicCapabilities(),
		rng:          rng,
	}

	return provider, nil
}

// Name returns the provider identifier
func (p *MockAnthropicProvider) Name() string {
	return "mock-anthropic"
}

// Infer performs a simulated inference request with realistic behavior
func (p *MockAnthropicProvider) Infer(ctx context.Context, req *models.InferRequest) (*models.InferResponse, error) {
	startTime := time.Now()

	// Get mock configuration from custom config or use defaults
	mockConfig := p.getMockConfig()

	// Validate request
	if err := req.Validate(); err != nil {
		return nil, providers.NewProviderError("mock-anthropic", "VALIDATION_ERROR", err.Error(), false)
	}

	// Simulate realistic latency (Anthropic tends to be slower)
	latencyMs := p.simulateLatency(mockConfig)

	// Simulate token usage
	promptTokens := p.simulatePromptTokens(req, mockConfig)
	completionTokens := p.simulateCompletionTokens(req, mockConfig)
	totalTokens := promptTokens + completionTokens

	// Calculate simulated cost
	costUSD := p.simulateCost(totalTokens, mockConfig)

	// Generate realistic mock response
	requestID := generateRequestID()
	response := models.NewInferResponse(requestID, req.Model)

	// Create response content with simulation metadata
	content := p.generateMockContent(req, latencyMs, totalTokens, costUSD)

	response.AddChoice(0, &models.Message{
		Role:    "assistant",
		Content: content,
	}, "stop")

	// Set usage statistics
	response.SetUsage(promptTokens, completionTokens)

	// Set comprehensive metadata
	response.Metadata.Provider = "mock-anthropic"
	response.Metadata.ModelUsed = "igris-mock-claude-3-sonnet"
	response.Metadata.LatencyMs = latencyMs
	response.Metadata.InferenceTimeMs = latencyMs - 8 // Simulate slightly higher queue time
	response.Metadata.QueueTimeMs = 8
	response.Metadata.CostUSD = costUSD
	response.Metadata.QualityScore = 0.97 // Mock quality score (slightly higher than OpenAI)
	response.Metadata.CacheHit = false
	response.Metadata.RouteDecision = "mock_provider_selected"
	response.Metadata.RequestID = requestID

	// Record actual elapsed time (should be close to simulated latency)
	response.CalculateLatency(startTime)

	return response, nil
}

// InferStream performs simulated streaming inference
func (p *MockAnthropicProvider) InferStream(ctx context.Context, req *models.InferRequest) (<-chan *models.StreamChunk, <-chan error) {
	chunkChan := make(chan *models.StreamChunk, 10)
	errChan := make(chan error, 1)

	go func() {
		defer close(chunkChan)
		defer close(errChan)

		mockConfig := p.getMockConfig()
		requestID := generateRequestID()

		// Simulate TTFT (Time to First Token) - Anthropic is typically slower
		ttft := time.Duration(p.rng.Intn(80)+40) * time.Millisecond // 40-120ms
		time.Sleep(ttft)

		// Generate streaming response chunks
		tokens := p.simulateCompletionTokens(req, mockConfig)
		words := p.generateStreamingWords(tokens)

		for i, word := range words {
			select {
			case <-ctx.Done():
				errChan <- ctx.Err()
				return
			default:
			}

			finishReason := ""
			if i == len(words)-1 {
				finishReason = "stop"
			}

			chunk := models.NewStreamChunk(requestID, req.Model, word, 0, finishReason)
			chunkChan <- chunk

			// Simulate inter-token delay (8-25ms) - Anthropic has more variable streaming
			delay := time.Duration(p.rng.Intn(17)+8) * time.Millisecond
			time.Sleep(delay)
		}
	}()

	return chunkChan, errChan
}

// HealthCheck always returns healthy for mock provider
func (p *MockAnthropicProvider) HealthCheck(ctx context.Context) error {
	// Mock provider is always healthy
	return nil
}

// GetCapabilities returns mock provider capabilities
func (p *MockAnthropicProvider) GetCapabilities() *providers.ProviderCapabilities {
	return p.capabilities
}

// EstimateCost estimates the cost for a mock inference request
func (p *MockAnthropicProvider) EstimateCost(req *models.InferRequest) (float64, error) {
	mockConfig := p.getMockConfig()

	// Estimate token usage
	promptTokens := p.simulatePromptTokens(req, mockConfig)
	completionTokens := p.simulateCompletionTokens(req, mockConfig)
	totalTokens := promptTokens + completionTokens

	// Calculate cost
	cost := float64(totalTokens) * mockConfig.CostPerToken
	return cost, nil
}

// Close releases provider resources (no-op for mock)
func (p *MockAnthropicProvider) Close() error {
	return nil
}

// Helper functions

func (p *MockAnthropicProvider) getMockConfig() *MockAnthropicConfig {
	// Check if custom mock config exists in provider config
	if p.config.Custom != nil {
		if mockCfg, ok := p.config.Custom["mock"]; ok {
			if cfg, ok := mockCfg.(*MockAnthropicConfig); ok {
				return cfg
			}
		}
	}
	return DefaultMockAnthropicConfig()
}

func (p *MockAnthropicProvider) simulateLatency(config *MockAnthropicConfig) int64 {
	// Generate random latency within specified range
	latencyMs := config.MinLatencyMs + p.rng.Intn(config.MaxLatencyMs-config.MinLatencyMs+1)

	// Actually sleep to simulate real latency
	time.Sleep(time.Duration(latencyMs) * time.Millisecond)

	return int64(latencyMs)
}

func (p *MockAnthropicProvider) simulatePromptTokens(req *models.InferRequest, config *MockAnthropicConfig) int {
	// Estimate based on message content length
	totalChars := 0
	for _, msg := range req.Messages {
		totalChars += len(msg.GetTextContent())
	}

	// Rough estimate: 1 token ≈ 4 characters (similar to OpenAI)
	baseTokens := totalChars / 4

	// Add some random variation if enabled
	if config.EnableVariation {
		variation := p.rng.Intn(20) - 10 // ±10 tokens
		baseTokens += variation
	}

	// Ensure minimum
	if baseTokens < 10 {
		baseTokens = 10
	}

	return baseTokens
}

func (p *MockAnthropicProvider) simulateCompletionTokens(req *models.InferRequest, config *MockAnthropicConfig) int {
	// Use requested MaxTokens if specified, otherwise use random value in range
	if req.MaxTokens > 0 {
		// Use 60-90% of max tokens to simulate realistic completion
		percentage := 0.6 + p.rng.Float64()*0.3
		return int(float64(req.MaxTokens) * percentage)
	}

	// Generate random token count within configured range
	tokens := config.MinTokens + p.rng.Intn(config.MaxTokens-config.MinTokens+1)
	return tokens
}

func (p *MockAnthropicProvider) simulateCost(totalTokens int, config *MockAnthropicConfig) float64 {
	// Calculate cost based on total tokens
	cost := float64(totalTokens) * config.CostPerToken
	return cost
}

func (p *MockAnthropicProvider) generateMockContent(req *models.InferRequest, latencyMs int64, tokens int, costUSD float64) string {
	// Extract user's last message for context-aware response
	userMessage := "there"
	if len(req.Messages) > 0 {
		lastMsg := req.Messages[len(req.Messages)-1]
		if len(lastMsg.Content) > 0 {
			userMessage = lastMsg.Content
			// Truncate if too long
			if len(userMessage) > 100 {
				userMessage = userMessage[:100] + "..."
			}
		}
	}

	content := fmt.Sprintf(
		"Hello from Igris Mock Anthropic!\n\n"+
			"Your request has been simulated successfully.\n\n"+
			"**Simulation Metrics:**\n"+
			"- Model: igris-mock-claude-3-sonnet\n"+
			"- Tokens Used: %d tokens\n"+
			"- Latency: %dms\n"+
			"- Estimated Cost: $%.6f\n\n"+
			"**Your Query:** \"%s\"\n\n"+
			"This is a realistic mock response that simulates Anthropic Claude's behavior "+
			"without incurring external API costs. All latency, token counts, and costs are simulated "+
			"to provide an accurate development and testing environment. Anthropic's models typically "+
			"have slightly higher latency but excellent quality.",
		tokens,
		latencyMs,
		costUSD,
		userMessage,
	)

	return content
}

func (p *MockAnthropicProvider) generateStreamingWords(targetTokens int) []string {
	// Generate a sequence of words that approximates the target token count
	// Roughly 1 token per word for simplicity
	words := []string{
		"Hello", " from", " Igris", " Mock", " Anthropic!", " ",
		"This", " is", " a", " simulated", " streaming", " response", " from", " Claude.", " ",
	}

	// Extend words to meet target token count
	additionalWords := []string{
		"The", "thoughtful", "assistant", "provides", "detailed", "responses", "with", "careful", "reasoning.",
		"Streaming", "simulation", "demonstrates", "realistic", "behavior", "for", "comprehensive", "testing.",
		"Claude", "models", "excel", "at", "nuanced", "understanding", "and", "balanced", "perspectives.",
	}

	for len(words) < targetTokens {
		word := additionalWords[p.rng.Intn(len(additionalWords))]
		words = append(words, " "+word)
	}

	return words[:targetTokens]
}

func getMockAnthropicCapabilities() *providers.ProviderCapabilities {
	return &providers.ProviderCapabilities{
		Models: []string{
			"igris-mock-claude-3-opus",
			"igris-mock-claude-3-sonnet",
			"igris-mock-claude-3-haiku",
		},
		SupportsStreaming:        true,
		SupportsVision:           true,
		SupportsTools:            true,
		SupportsFunctionCall:     false, // Anthropic uses tools, not function_call
		SupportsTemperature:      true,
		SupportsTopP:             true,
		SupportsTopK:             true, // Anthropic supports top_k
		SupportsPresencePenalty:  false,
		SupportsFrequencyPenalty: false,
		SupportsStop:             true, // stop_sequences
		MaxTokens:                4096,
		MaxContextWindow:         200000, // Claude 3 models
		RateLimitRPM:             10000,  // Mock has high limits
		RateLimitTPM:             1000000,
		AverageLatencyMs:         170, // Average of 120-220ms range
		ReliabilityScore:         1.0,  // Mock is always reliable
		CostPerToken:             0.000003,
	}
}
