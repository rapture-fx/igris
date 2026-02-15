package openai

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// MockOpenAIProvider implements a realistic mock for OpenAI API
// Simulates latency, token usage, and costs without making external API calls
type MockOpenAIProvider struct {
	config       *providers.ProviderConfig
	capabilities *providers.ProviderCapabilities
	rng          *rand.Rand
}

// MockConfig holds mock-specific configuration
type MockConfig struct {
	MinLatencyMs     int     // Minimum simulated latency
	MaxLatencyMs     int     // Maximum simulated latency
	MinTokens        int     // Minimum token usage
	MaxTokens        int     // Maximum token usage
	CostPerToken     float64 // Cost per token in USD
	EnableVariation  bool    // Enable random variation in responses
}

// DefaultMockConfig returns sensible defaults for mock behavior
func DefaultMockConfig() *MockConfig {
	return &MockConfig{
		MinLatencyMs:    50,
		MaxLatencyMs:    200,
		MinTokens:       100,
		MaxTokens:       1200,
		CostPerToken:    0.000002, // $0.002 per 1K tokens
		EnableVariation: true,
	}
}

// NewMockOpenAIProvider creates a new mock OpenAI provider instance
func NewMockOpenAIProvider(config *providers.ProviderConfig) (*MockOpenAIProvider, error) {
	// Mock provider doesn't require API key, but we validate config structure
	if config == nil {
		config = &providers.ProviderConfig{
			BaseURL:       "https://mock.igris-inertial.local",
			Timeout:       30,
			MaxRetries:    3,
			EnableMetrics: true,
		}
	}

	// Initialize random number generator with time-based seed for realistic variation
	source := rand.NewSource(time.Now().UnixNano())
	rng := rand.New(source)

	provider := &MockOpenAIProvider{
		config:       config,
		capabilities: getMockOpenAICapabilities(),
		rng:          rng,
	}

	return provider, nil
}

// Name returns the provider identifier
func (p *MockOpenAIProvider) Name() string {
	return "mock-openai"
}

// Infer performs a simulated inference request with realistic behavior
func (p *MockOpenAIProvider) Infer(ctx context.Context, req *models.InferRequest) (*models.InferResponse, error) {
	startTime := time.Now()

	// Get mock configuration from custom config or use defaults
	mockConfig := p.getMockConfig()

	// Validate request
	if err := req.Validate(); err != nil {
		return nil, providers.NewProviderError("mock-openai", "VALIDATION_ERROR", err.Error(), false)
	}

	// Simulate realistic latency
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
	response.Metadata.Provider = "mock-openai"
	response.Metadata.ModelUsed = "igris-mock-gpt-4"
	response.Metadata.LatencyMs = latencyMs
	response.Metadata.InferenceTimeMs = latencyMs - 5 // Simulate queue time
	response.Metadata.QueueTimeMs = 5
	response.Metadata.CostUSD = costUSD
	response.Metadata.QualityScore = 0.95 // Mock quality score
	response.Metadata.CacheHit = false
	response.Metadata.RouteDecision = "mock_provider_selected"
	response.Metadata.RequestID = requestID

	// Record actual elapsed time (should be close to simulated latency)
	response.CalculateLatency(startTime)

	return response, nil
}

// InferStream performs simulated streaming inference
func (p *MockOpenAIProvider) InferStream(ctx context.Context, req *models.InferRequest) (<-chan *models.StreamChunk, <-chan error) {
	chunkChan := make(chan *models.StreamChunk, 10)
	errChan := make(chan error, 1)

	go func() {
		defer close(chunkChan)
		defer close(errChan)

		mockConfig := p.getMockConfig()
		requestID := generateRequestID()

		// Simulate TTFT (Time to First Token)
		ttft := time.Duration(p.rng.Intn(50)+20) * time.Millisecond
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

			// Simulate inter-token delay (5-20ms)
			delay := time.Duration(p.rng.Intn(15)+5) * time.Millisecond
			time.Sleep(delay)
		}
	}()

	return chunkChan, errChan
}

// HealthCheck always returns healthy for mock provider
func (p *MockOpenAIProvider) HealthCheck(ctx context.Context) error {
	// Mock provider is always healthy
	return nil
}

// GetCapabilities returns mock provider capabilities
func (p *MockOpenAIProvider) GetCapabilities() *providers.ProviderCapabilities {
	return p.capabilities
}

// EstimateCost estimates the cost for a mock inference request
func (p *MockOpenAIProvider) EstimateCost(req *models.InferRequest) (float64, error) {
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
func (p *MockOpenAIProvider) Close() error {
	return nil
}

// Helper functions

func (p *MockOpenAIProvider) getMockConfig() *MockConfig {
	// Check if custom mock config exists in provider config
	if p.config.Custom != nil {
		if mockCfg, ok := p.config.Custom["mock"]; ok {
			if cfg, ok := mockCfg.(*MockConfig); ok {
				return cfg
			}
		}
	}
	return DefaultMockConfig()
}

func (p *MockOpenAIProvider) simulateLatency(config *MockConfig) int64 {
	// Generate random latency within specified range
	latencyMs := config.MinLatencyMs + p.rng.Intn(config.MaxLatencyMs-config.MinLatencyMs+1)

	// Actually sleep to simulate real latency
	time.Sleep(time.Duration(latencyMs) * time.Millisecond)

	return int64(latencyMs)
}

func (p *MockOpenAIProvider) simulatePromptTokens(req *models.InferRequest, config *MockConfig) int {
	// Estimate based on message content length
	totalChars := 0
	for _, msg := range req.Messages {
		totalChars += len(msg.GetTextContent())
	}

	// Rough estimate: 1 token ≈ 4 characters
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

func (p *MockOpenAIProvider) simulateCompletionTokens(req *models.InferRequest, config *MockConfig) int {
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

func (p *MockOpenAIProvider) simulateCost(totalTokens int, config *MockConfig) float64 {
	// Calculate cost based on total tokens
	cost := float64(totalTokens) * config.CostPerToken
	return cost
}

func (p *MockOpenAIProvider) generateMockContent(req *models.InferRequest, latencyMs int64, tokens int, costUSD float64) string {
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
		"Hello from Igris Mock OpenAI! 🎭\n\n"+
			"Your request has been simulated successfully.\n\n"+
			"📊 **Simulation Metrics:**\n"+
			"- Model: igris-mock-gpt-4\n"+
			"- Tokens Used: %d tokens\n"+
			"- Latency: %dms\n"+
			"- Estimated Cost: $%.6f\n\n"+
			"💬 **Your Query:** \"%s\"\n\n"+
			"✨ This is a realistic mock response that simulates production-like behavior "+
			"without incurring external API costs. All latency, token counts, and costs are simulated "+
			"to provide an accurate development and testing environment.",
		tokens,
		latencyMs,
		costUSD,
		userMessage,
	)

	return content
}

func (p *MockOpenAIProvider) generateStreamingWords(targetTokens int) []string {
	// Generate a sequence of words that approximates the target token count
	// Roughly 1 token per word for simplicity
	words := []string{
		"Hello", " from", " Igris", " Mock", " OpenAI!", " ",
		"This", " is", " a", " simulated", " streaming", " response.", " ",
	}

	// Extend words to meet target token count
	additionalWords := []string{
		"The", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog.",
		"Streaming", "simulation", "provides", "realistic", "behavior", "for", "testing.",
	}

	for len(words) < targetTokens {
		word := additionalWords[p.rng.Intn(len(additionalWords))]
		words = append(words, " "+word)
	}

	return words[:targetTokens]
}

func getMockOpenAICapabilities() *providers.ProviderCapabilities {
	return &providers.ProviderCapabilities{
		Models: []string{
			"igris-mock-gpt-4",
			"igris-mock-gpt-3.5-turbo",
		},
		SupportsStreaming:        true,
		SupportsVision:           true,
		SupportsTools:            true,
		SupportsFunctionCall:     true,
		SupportsTemperature:      true,
		SupportsTopP:             true,
		SupportsTopK:             false,
		SupportsPresencePenalty:  true,
		SupportsFrequencyPenalty: true,
		SupportsStop:             true,
		MaxTokens:                4096,
		MaxContextWindow:         128000,
		RateLimitRPM:             10000, // Mock has high limits
		RateLimitTPM:             1000000,
		AverageLatencyMs:         125, // Average of 50-200ms range
		ReliabilityScore:         1.0,  // Mock is always reliable
		CostPerToken:             0.000002,
	}
}
