package anthropic

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// BenchmarkAnthropicProvider implements Anthropic provider for benchmark mode
// This provider simulates Anthropic Claude API responses without making real API calls
// It provides realistic latency, token usage, and cost simulations based on official specs
type BenchmarkAnthropicProvider struct {
	config         *providers.ProviderConfig
	capabilities   *providers.ProviderCapabilities
	costModel      *providers.CostModel
	simulationCfg  *providers.SimulationConfig
	tokenEstimator *providers.TokenEstimator
	errorSimulator *providers.ErrorSimulator
	rng            *rand.Rand
}

// NewBenchmarkAnthropicProvider creates a new benchmark Anthropic provider
func NewBenchmarkAnthropicProvider(config *providers.ProviderConfig) (*BenchmarkAnthropicProvider, error) {
	if config == nil {
		config = &providers.ProviderConfig{
			BaseURL:       "https://api.anthropic.com/v1",
			Timeout:       60,
			MaxRetries:    3,
			RetryDelay:    1000,
			EnableMetrics: true,
		}
	}

	// Initialize random number generator with time-based seed
	source := rand.NewSource(time.Now().UnixNano())
	rng := rand.New(source)

	// Get simulation config from custom config or use defaults
	simConfig := providers.DefaultSimulationConfig()
	if config.Custom != nil {
		if customSim, ok := config.Custom["simulation"].(*providers.SimulationConfig); ok {
			simConfig = customSim
		}
	}

	provider := &BenchmarkAnthropicProvider{
		config:         config,
		capabilities:   getBenchmarkAnthropicCapabilities(),
		costModel:      providers.NewCostModel(),
		simulationCfg:  simConfig,
		tokenEstimator: &providers.TokenEstimator{},
		errorSimulator: providers.NewErrorSimulator(nil, simConfig.ErrorRate > 0),
		rng:            rng,
	}

	return provider, nil
}

// Name returns the provider identifier
func (p *BenchmarkAnthropicProvider) Name() string {
	return "benchmark-anthropic"
}

// Infer performs a simulated Anthropic inference request
func (p *BenchmarkAnthropicProvider) Infer(ctx context.Context, req *models.InferRequest) (*models.InferResponse, error) {
	startTime := time.Now()

	// Validate request
	if err := req.Validate(); err != nil {
		return nil, providers.NewProviderError("benchmark-anthropic", providers.ErrCodeInvalidRequest, err.Error(), false)
	}

	// Check if we should simulate an error
	if errorScenario, shouldError := p.errorSimulator.ShouldSimulateError(p.rng.Float64); shouldError {
		// Simulate error delay
		if errorScenario.DelayMs > 0 {
			time.Sleep(time.Duration(errorScenario.DelayMs) * time.Millisecond)
		}
		return nil, providers.NewProviderError(
			"benchmark-anthropic",
			errorScenario.Code,
			errorScenario.Message,
			errorScenario.Retryable,
		)
	}

	// Simulate realistic latency based on model
	latencyProfile := providers.GetLatencyProfile("anthropic", p.normalizeModel(req.Model))
	latencyMs := p.simulateLatency(latencyProfile)

	// Estimate token usage
	promptTokens := p.tokenEstimator.EstimatePromptTokens(req)
	completionTokens := p.tokenEstimator.EstimateCompletionTokens(req, p.simulationCfg)
	totalTokens := promptTokens + completionTokens

	// Add random variation if enabled
	if p.simulationCfg.EnableVariation {
		variation := p.rng.Intn(100) - 50 // ±50 tokens
		completionTokens += variation
		if completionTokens < 1 {
			completionTokens = 1
		}
		totalTokens = promptTokens + completionTokens
	}

	// Calculate cost using official pricing
	costUSD, err := p.costModel.EstimateCost("anthropic", p.normalizeModel(req.Model), promptTokens, completionTokens)
	if err != nil {
		// Fallback to default pricing
		costUSD, _ = p.costModel.EstimateCost("benchmark-anthropic", "default", promptTokens, completionTokens)
	}

	// Generate response
	requestID := generateBenchmarkAnthropicRequestID()
	response := models.NewInferResponse(requestID, req.Model)

	// Create response content
	content := p.generateBenchmarkContent(req, latencyMs, totalTokens, costUSD)

	response.AddChoice(0, &models.Message{
		Role:    "assistant",
		Content: content,
	}, "end_turn") // Anthropic uses "end_turn" as stop reason

	// Set usage statistics
	response.SetUsage(promptTokens, completionTokens)

	// Set comprehensive metadata
	response.Metadata.Provider = "benchmark-anthropic"
	response.Metadata.ModelUsed = req.Model
	response.Metadata.LatencyMs = latencyMs
	response.Metadata.InferenceTimeMs = latencyMs - 15 // Simulate queue time
	response.Metadata.QueueTimeMs = 15
	response.Metadata.CostUSD = costUSD
	response.Metadata.QualityScore = p.simulationCfg.QualityScore
	response.Metadata.CacheHit = false
	response.Metadata.RouteDecision = "benchmark_anthropic_selected"
	response.Metadata.RequestID = requestID

	// Record actual elapsed time
	response.CalculateLatency(startTime)

	return response, nil
}

// InferStream performs simulated streaming inference
func (p *BenchmarkAnthropicProvider) InferStream(ctx context.Context, req *models.InferRequest) (<-chan *models.StreamChunk, <-chan error) {
	chunkChan := make(chan *models.StreamChunk, 10)
	errChan := make(chan error, 1)

	go func() {
		defer close(chunkChan)
		defer close(errChan)

		// Validate request
		if err := req.Validate(); err != nil {
			errChan <- providers.NewProviderError("benchmark-anthropic", providers.ErrCodeInvalidRequest, err.Error(), false)
			return
		}

		// Check for simulated error
		if errorScenario, shouldError := p.errorSimulator.ShouldSimulateError(p.rng.Float64); shouldError {
			if errorScenario.DelayMs > 0 {
				time.Sleep(time.Duration(errorScenario.DelayMs) * time.Millisecond)
			}
			errChan <- providers.NewProviderError(
				"benchmark-anthropic",
				errorScenario.Code,
				errorScenario.Message,
				errorScenario.Retryable,
			)
			return
		}

		requestID := generateBenchmarkAnthropicRequestID()

		// Simulate TTFT (Time to First Token)
		latencyProfile := providers.GetLatencyProfile("anthropic", p.normalizeModel(req.Model))
		ttft := latencyProfile.TTFT
		if p.simulationCfg.EnableVariation {
			// Add ±30% variation
			variation := float64(ttft) * 0.3 * (p.rng.Float64()*2 - 1)
			ttft += time.Duration(variation)
		}
		time.Sleep(ttft)

		// Send message_start event (Anthropic-specific)
		startChunk := models.NewStreamChunk(requestID, req.Model, "", 0, "")
		chunkChan <- startChunk
		time.Sleep(5 * time.Millisecond)

		// Generate streaming response chunks
		completionTokens := p.tokenEstimator.EstimateCompletionTokens(req, p.simulationCfg)
		words := p.generateStreamingWords(completionTokens)

		for i, word := range words {
			select {
			case <-ctx.Done():
				errChan <- ctx.Err()
				return
			default:
			}

			finishReason := ""
			if i == len(words)-1 {
				finishReason = "end_turn" // Anthropic uses "end_turn"
			}

			chunk := models.NewStreamChunk(requestID, req.Model, word, 0, finishReason)
			chunkChan <- chunk

			// Simulate inter-token delay (Anthropic is slightly slower than OpenAI)
			delay := time.Duration(p.rng.Intn(25)+10) * time.Millisecond
			time.Sleep(delay)
		}

		// Send message_stop event (Anthropic-specific)
		stopChunk := models.NewStreamChunk(requestID, req.Model, "", 0, "end_turn")
		chunkChan <- stopChunk
	}()

	return chunkChan, errChan
}

// HealthCheck verifies provider health
func (p *BenchmarkAnthropicProvider) HealthCheck(ctx context.Context) error {
	// Benchmark provider is always healthy (no external dependencies)
	return nil
}

// GetCapabilities returns provider capabilities
func (p *BenchmarkAnthropicProvider) GetCapabilities() *providers.ProviderCapabilities {
	return p.capabilities
}

// EstimateCost estimates the cost for a request
func (p *BenchmarkAnthropicProvider) EstimateCost(req *models.InferRequest) (float64, error) {
	promptTokens := p.tokenEstimator.EstimatePromptTokens(req)
	completionTokens := p.tokenEstimator.EstimateCompletionTokens(req, p.simulationCfg)

	cost, err := p.costModel.EstimateCost("anthropic", p.normalizeModel(req.Model), promptTokens, completionTokens)
	if err != nil {
		// Fallback to default
		return p.costModel.EstimateCost("benchmark-anthropic", "default", promptTokens, completionTokens)
	}

	return cost, nil
}

// Close releases provider resources
func (p *BenchmarkAnthropicProvider) Close() error {
	// No resources to clean up for benchmark provider
	return nil
}

// Helper functions

func (p *BenchmarkAnthropicProvider) normalizeModel(model string) string {
	// Normalize model names to match pricing table keys
	normalizations := map[string]string{
		"claude-3-opus":           "claude-3-opus",
		"claude-3-opus-20240229":  "claude-3-opus-20240229",
		"claude-3-sonnet":         "claude-3-sonnet",
		"claude-3-sonnet-20240229": "claude-3-sonnet-20240229",
		"claude-3-haiku":          "claude-3-haiku",
		"claude-3-haiku-20240307": "claude-3-haiku-20240307",
	}

	if normalized, ok := normalizations[model]; ok {
		return normalized
	}

	// Default to haiku for unknown models (most cost-effective)
	return "claude-3-haiku"
}

func (p *BenchmarkAnthropicProvider) simulateLatency(profile *providers.LatencyProfile) int64 {
	// Simulate latency based on distribution
	minLatency := profile.P50LatencyMs / 2
	maxLatency := profile.P95LatencyMs

	latencyMs := minLatency + p.rng.Intn(maxLatency-minLatency+1)

	// Actually sleep to simulate real latency
	time.Sleep(time.Duration(latencyMs) * time.Millisecond)

	return int64(latencyMs)
}

func (p *BenchmarkAnthropicProvider) generateBenchmarkContent(req *models.InferRequest, latencyMs int64, tokens int, costUSD float64) string {
	// Extract user's last message for context
	userMessage := "your request"
	if len(req.Messages) > 0 {
		lastMsg := req.Messages[len(req.Messages)-1]
		if len(lastMsg.Content) > 0 {
			userMessage = lastMsg.Content
			if len(userMessage) > 100 {
				userMessage = userMessage[:100] + "..."
			}
		}
	}

	content := fmt.Sprintf(
		"[Benchmark Anthropic Response]\n\n"+
			"This is a simulated Claude response for benchmark testing. "+
			"No actual API calls were made to Anthropic.\n\n"+
			"Model: %s\n"+
			"Tokens: %d (%d prompt + %d completion)\n"+
			"Latency: %dms\n"+
			"Cost: $%.6f\n\n"+
			"Query: \"%s\"\n\n"+
			"This benchmark provider uses official Anthropic pricing and realistic "+
			"latency profiles to simulate Claude's behavior for optimization testing. "+
			"Claude models are known for their high quality, strong reasoning capabilities, "+
			"and thoughtful responses.",
		req.Model,
		tokens,
		tokens-p.tokenEstimator.EstimateCompletionTokens(req, p.simulationCfg),
		p.tokenEstimator.EstimateCompletionTokens(req, p.simulationCfg),
		latencyMs,
		costUSD,
		userMessage,
	)

	return content
}

func (p *BenchmarkAnthropicProvider) generateStreamingWords(targetTokens int) []string {
	// Generate realistic streaming words with Claude's characteristic style
	baseWords := []string{
		"Hello!", " I'm", " Claude,", " simulated", " in", " benchmark", " mode.", " ",
		"This", " streaming", " response", " demonstrates", " realistic", " token", " generation", " ",
		"patterns", " similar", " to", " the", " actual", " Claude", " API.", " ",
	}

	additionalWords := []string{
		"I", "understand", "your", "question", "and", "would", "be", "happy", "to", "help.",
		"Let", "me", "think", "about", "this", "carefully.", "Based", "on", "the", "context",
		"provided,", "I", "can", "offer", "some", "insights.", "This", "benchmark", "simulation",
		"provides", "accurate", "testing", "without", "external", "API", "dependencies.",
	}

	words := make([]string, 0, targetTokens)
	words = append(words, baseWords...)

	for len(words) < targetTokens {
		word := additionalWords[p.rng.Intn(len(additionalWords))]
		words = append(words, " "+word)
	}

	return words[:targetTokens]
}

func getBenchmarkAnthropicCapabilities() *providers.ProviderCapabilities {
	return &providers.ProviderCapabilities{
		Models: []string{
			"claude-3-opus",
			"claude-3-opus-20240229",
			"claude-3-sonnet",
			"claude-3-sonnet-20240229",
			"claude-3-haiku",
			"claude-3-haiku-20240307",
		},
		SupportsStreaming:        true,
		SupportsVision:           true,
		SupportsTools:            true,
		SupportsFunctionCall:     true,
		SupportsTemperature:      true,
		SupportsTopP:             true,
		SupportsTopK:             true, // Anthropic supports top_k
		SupportsPresencePenalty:  false, // Anthropic doesn't use presence/frequency penalties
		SupportsFrequencyPenalty: false,
		SupportsStop:             true,
		MaxTokens:                4096,
		MaxContextWindow:         200000, // Claude 3 has 200K context window
		RateLimitRPM:             5000,
		RateLimitTPM:             500000,
		AverageLatencyMs:         1000, // Average across Claude models
		ReliabilityScore:         0.98, // High reliability
		CostPerToken:             0.00001, // Average cost (varies by model)
	}
}

func generateBenchmarkAnthropicRequestID() string {
	return fmt.Sprintf("benchmark-anthropic-req-%d", time.Now().UnixNano())
}
