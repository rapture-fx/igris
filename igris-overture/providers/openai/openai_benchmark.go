package openai

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// BenchmarkOpenAIProvider implements OpenAI provider for benchmark mode
// This provider simulates OpenAI API responses without making real API calls
// It provides realistic latency, token usage, and cost simulations based on official specs
type BenchmarkOpenAIProvider struct {
	config          *providers.ProviderConfig
	capabilities    *providers.ProviderCapabilities
	costModel       *providers.CostModel
	simulationCfg   *providers.SimulationConfig
	tokenEstimator  *providers.TokenEstimator
	errorSimulator  *providers.ErrorSimulator
	rng             *rand.Rand
}

// NewBenchmarkOpenAIProvider creates a new benchmark OpenAI provider
func NewBenchmarkOpenAIProvider(config *providers.ProviderConfig) (*BenchmarkOpenAIProvider, error) {
	if config == nil {
		config = &providers.ProviderConfig{
			BaseURL:       "https://api.openai.com/v1",
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

	provider := &BenchmarkOpenAIProvider{
		config:         config,
		capabilities:   getBenchmarkOpenAICapabilities(),
		costModel:      providers.NewCostModel(),
		simulationCfg:  simConfig,
		tokenEstimator: &providers.TokenEstimator{},
		errorSimulator: providers.NewErrorSimulator(nil, simConfig.ErrorRate > 0),
		rng:            rng,
	}

	return provider, nil
}

// Name returns the provider identifier
func (p *BenchmarkOpenAIProvider) Name() string {
	return "benchmark-openai"
}

// Infer performs a simulated OpenAI inference request
func (p *BenchmarkOpenAIProvider) Infer(ctx context.Context, req *models.InferRequest) (*models.InferResponse, error) {
	startTime := time.Now()

	// Validate request
	if err := req.Validate(); err != nil {
		return nil, providers.NewProviderError("benchmark-openai", providers.ErrCodeInvalidRequest, err.Error(), false)
	}

	// Check if we should simulate an error
	if errorScenario, shouldError := p.errorSimulator.ShouldSimulateError(p.rng.Float64); shouldError {
		// Simulate error delay
		if errorScenario.DelayMs > 0 {
			time.Sleep(time.Duration(errorScenario.DelayMs) * time.Millisecond)
		}
		return nil, providers.NewProviderError(
			"benchmark-openai",
			errorScenario.Code,
			errorScenario.Message,
			errorScenario.Retryable,
		)
	}

	// Simulate realistic latency based on model
	latencyProfile := providers.GetLatencyProfile("openai", p.normalizeModel(req.Model))
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
	costUSD, err := p.costModel.EstimateCost("openai", p.normalizeModel(req.Model), promptTokens, completionTokens)
	if err != nil {
		// Fallback to default pricing
		costUSD, _ = p.costModel.EstimateCost("benchmark-openai", "default", promptTokens, completionTokens)
	}

	// Generate response
	requestID := generateBenchmarkRequestID()
	response := models.NewInferResponse(requestID, req.Model)

	// Create response content
	content := p.generateBenchmarkContent(req, latencyMs, totalTokens, costUSD)

	response.AddChoice(0, &models.Message{
		Role:    "assistant",
		Content: content,
	}, "stop")

	// Set usage statistics
	response.SetUsage(promptTokens, completionTokens)

	// Set comprehensive metadata
	response.Metadata.Provider = "benchmark-openai"
	response.Metadata.ModelUsed = req.Model
	response.Metadata.LatencyMs = latencyMs
	response.Metadata.InferenceTimeMs = latencyMs - 10 // Simulate queue time
	response.Metadata.QueueTimeMs = 10
	response.Metadata.CostUSD = costUSD
	response.Metadata.QualityScore = p.simulationCfg.QualityScore
	response.Metadata.CacheHit = false
	response.Metadata.RouteDecision = "benchmark_openai_selected"
	response.Metadata.RequestID = requestID

	// Record actual elapsed time
	response.CalculateLatency(startTime)

	return response, nil
}

// InferStream performs simulated streaming inference
func (p *BenchmarkOpenAIProvider) InferStream(ctx context.Context, req *models.InferRequest) (<-chan *models.StreamChunk, <-chan error) {
	chunkChan := make(chan *models.StreamChunk, 10)
	errChan := make(chan error, 1)

	go func() {
		defer close(chunkChan)
		defer close(errChan)

		// Validate request
		if err := req.Validate(); err != nil {
			errChan <- providers.NewProviderError("benchmark-openai", providers.ErrCodeInvalidRequest, err.Error(), false)
			return
		}

		// Check for simulated error
		if errorScenario, shouldError := p.errorSimulator.ShouldSimulateError(p.rng.Float64); shouldError {
			if errorScenario.DelayMs > 0 {
				time.Sleep(time.Duration(errorScenario.DelayMs) * time.Millisecond)
			}
			errChan <- providers.NewProviderError(
				"benchmark-openai",
				errorScenario.Code,
				errorScenario.Message,
				errorScenario.Retryable,
			)
			return
		}

		requestID := generateBenchmarkRequestID()

		// Simulate TTFT (Time to First Token)
		latencyProfile := providers.GetLatencyProfile("openai", p.normalizeModel(req.Model))
		ttft := latencyProfile.TTFT
		if p.simulationCfg.EnableVariation {
			// Add ±30% variation
			variation := float64(ttft) * 0.3 * (p.rng.Float64()*2 - 1)
			ttft += time.Duration(variation)
		}
		time.Sleep(ttft)

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
				finishReason = "stop"
			}

			chunk := models.NewStreamChunk(requestID, req.Model, word, 0, finishReason)
			chunkChan <- chunk

			// Simulate inter-token delay (5-25ms for OpenAI)
			delay := time.Duration(p.rng.Intn(20)+5) * time.Millisecond
			time.Sleep(delay)
		}
	}()

	return chunkChan, errChan
}

// HealthCheck verifies provider health
func (p *BenchmarkOpenAIProvider) HealthCheck(ctx context.Context) error {
	// Benchmark provider is always healthy (no external dependencies)
	return nil
}

// GetCapabilities returns provider capabilities
func (p *BenchmarkOpenAIProvider) GetCapabilities() *providers.ProviderCapabilities {
	return p.capabilities
}

// EstimateCost estimates the cost for a request
func (p *BenchmarkOpenAIProvider) EstimateCost(req *models.InferRequest) (float64, error) {
	promptTokens := p.tokenEstimator.EstimatePromptTokens(req)
	completionTokens := p.tokenEstimator.EstimateCompletionTokens(req, p.simulationCfg)

	cost, err := p.costModel.EstimateCost("openai", p.normalizeModel(req.Model), promptTokens, completionTokens)
	if err != nil {
		// Fallback to default
		return p.costModel.EstimateCost("benchmark-openai", "default", promptTokens, completionTokens)
	}

	return cost, nil
}

// Close releases provider resources
func (p *BenchmarkOpenAIProvider) Close() error {
	// No resources to clean up for benchmark provider
	return nil
}

// Helper functions

func (p *BenchmarkOpenAIProvider) normalizeModel(model string) string {
	// Normalize model names to match pricing table keys
	normalizations := map[string]string{
		"gpt-4-turbo-preview": "gpt-4-turbo-preview",
		"gpt-4-turbo":         "gpt-4-turbo",
		"gpt-4":               "gpt-4",
		"gpt-3.5-turbo":       "gpt-3.5-turbo",
		"gpt-3.5-turbo-16k":   "gpt-3.5-turbo-16k",
	}

	if normalized, ok := normalizations[model]; ok {
		return normalized
	}

	// Default to gpt-3.5-turbo for unknown models
	return "gpt-3.5-turbo"
}

func (p *BenchmarkOpenAIProvider) simulateLatency(profile *providers.LatencyProfile) int64 {
	// Simulate latency based on distribution (simplified normal distribution)
	// Use P50 as center, with range between min (P50/2) and P95
	minLatency := profile.P50LatencyMs / 2
	maxLatency := profile.P95LatencyMs

	latencyMs := minLatency + p.rng.Intn(maxLatency-minLatency+1)

	// Actually sleep to simulate real latency
	time.Sleep(time.Duration(latencyMs) * time.Millisecond)

	return int64(latencyMs)
}

func (p *BenchmarkOpenAIProvider) generateBenchmarkContent(req *models.InferRequest, latencyMs int64, tokens int, costUSD float64) string {
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
		"[Benchmark OpenAI Response]\n\n"+
			"This is a simulated OpenAI response for benchmark testing. "+
			"No actual API calls were made.\n\n"+
			"Model: %s\n"+
			"Tokens: %d (%d prompt + %d completion)\n"+
			"Latency: %dms\n"+
			"Cost: $%.6f\n\n"+
			"Query: \"%s\"\n\n"+
			"This benchmark provider uses official OpenAI pricing and realistic "+
			"latency profiles to simulate production behavior for optimization testing.",
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

func (p *BenchmarkOpenAIProvider) generateStreamingWords(targetTokens int) []string {
	// Generate realistic streaming words
	baseWords := []string{
		"Hello", " from", " the", " benchmark", " OpenAI", " provider.", " ",
		"This", " is", " a", " simulated", " streaming", " response", " that", " demonstrates",
		" realistic", " token-by-token", " generation.", " ",
	}

	additionalWords := []string{
		"The", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog.",
		"Benchmark", "testing", "provides", "accurate", "performance", "metrics",
		"without", "incurring", "external", "API", "costs.",
	}

	words := make([]string, 0, targetTokens)
	words = append(words, baseWords...)

	for len(words) < targetTokens {
		word := additionalWords[p.rng.Intn(len(additionalWords))]
		words = append(words, " "+word)
	}

	return words[:targetTokens]
}

func getBenchmarkOpenAICapabilities() *providers.ProviderCapabilities {
	return &providers.ProviderCapabilities{
		Models: []string{
			"gpt-4",
			"gpt-4-turbo",
			"gpt-4-turbo-preview",
			"gpt-3.5-turbo",
			"gpt-3.5-turbo-16k",
		},
		SupportsStreaming:        true,
		SupportsVision:           true,
		SupportsTools:            true,
		SupportsFunctionCall:     true,
		SupportsTemperature:      true,
		SupportsTopP:             true,
		SupportsTopK:             false, // OpenAI doesn't support top_k
		SupportsPresencePenalty:  true,
		SupportsFrequencyPenalty: true,
		SupportsStop:             true,
		MaxTokens:                4096,
		MaxContextWindow:         128000,
		RateLimitRPM:             10000,
		RateLimitTPM:             1000000,
		AverageLatencyMs:         800,  // Average between GPT-3.5 and GPT-4
		ReliabilityScore:         0.99, // High reliability for OpenAI
		CostPerToken:             0.00002, // Average cost
	}
}

func generateBenchmarkRequestID() string {
	return fmt.Sprintf("benchmark-req-%d", time.Now().UnixNano())
}
