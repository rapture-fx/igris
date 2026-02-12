package providers

import (
	"fmt"
	"time"

	"github.com/Igris-inertial/system/igris-overture/models"
)

// CostModel provides centralized pricing and cost estimation for all providers
type CostModel struct {
	pricingTable map[string]*ModelPricing
}

// ModelPricing defines pricing structure for a specific model
type ModelPricing struct {
	Provider         string  `json:"provider"`
	Model            string  `json:"model"`
	InputPer1kTokens float64 `json:"input_per_1k_tokens"`  // USD per 1K input tokens
	OutputPer1kTokens float64 `json:"output_per_1k_tokens"` // USD per 1K output tokens
	// For models with single pricing
	Per1kTokens float64 `json:"per_1k_tokens,omitempty"`
}

// NewCostModel creates a cost model with official pricing tables
func NewCostModel() *CostModel {
	return &CostModel{
		pricingTable: getOfficialPricingTable(),
	}
}

// EstimateCost calculates the estimated cost for a request
func (cm *CostModel) EstimateCost(provider, model string, inputTokens, outputTokens int) (float64, error) {
	key := fmt.Sprintf("%s:%s", provider, model)
	pricing, exists := cm.pricingTable[key]

	if !exists {
		// Try to find a default pricing for the provider
		defaultKey := fmt.Sprintf("%s:default", provider)
		if defaultPricing, ok := cm.pricingTable[defaultKey]; ok {
			pricing = defaultPricing
		} else {
			return 0, fmt.Errorf("no pricing information for provider=%s model=%s", provider, model)
		}
	}

	var cost float64
	if pricing.InputPer1kTokens > 0 && pricing.OutputPer1kTokens > 0 {
		// Separate input/output pricing
		cost = (float64(inputTokens)/1000.0)*pricing.InputPer1kTokens +
			(float64(outputTokens)/1000.0)*pricing.OutputPer1kTokens
	} else {
		// Single pricing
		totalTokens := inputTokens + outputTokens
		cost = (float64(totalTokens) / 1000.0) * pricing.Per1kTokens
	}

	return cost, nil
}

// GetPricing returns the pricing information for a model
func (cm *CostModel) GetPricing(provider, model string) (*ModelPricing, bool) {
	key := fmt.Sprintf("%s:%s", provider, model)
	pricing, exists := cm.pricingTable[key]
	return pricing, exists
}

// getOfficialPricingTable returns pricing based on official provider rates
// Source: OpenAI and Anthropic official pricing pages (as of Jan 2025)
func getOfficialPricingTable() map[string]*ModelPricing {
	return map[string]*ModelPricing{
		// OpenAI GPT-4 family
		"openai:gpt-4": {
			Provider:          "openai",
			Model:             "gpt-4",
			InputPer1kTokens:  0.03,  // $0.03 per 1K input tokens
			OutputPer1kTokens: 0.06,  // $0.06 per 1K output tokens
		},
		"openai:gpt-4-turbo": {
			Provider:          "openai",
			Model:             "gpt-4-turbo",
			InputPer1kTokens:  0.01,  // $0.01 per 1K input tokens
			OutputPer1kTokens: 0.03,  // $0.03 per 1K output tokens
		},
		"openai:gpt-4-turbo-preview": {
			Provider:          "openai",
			Model:             "gpt-4-turbo-preview",
			InputPer1kTokens:  0.01,
			OutputPer1kTokens: 0.03,
		},

		// OpenAI GPT-3.5 family
		"openai:gpt-3.5-turbo": {
			Provider:          "openai",
			Model:             "gpt-3.5-turbo",
			InputPer1kTokens:  0.0005, // $0.0005 per 1K input tokens
			OutputPer1kTokens: 0.0015, // $0.0015 per 1K output tokens
		},
		"openai:gpt-3.5-turbo-16k": {
			Provider:          "openai",
			Model:             "gpt-3.5-turbo-16k",
			InputPer1kTokens:  0.001,
			OutputPer1kTokens: 0.002,
		},

		// Anthropic Claude 3 family
		"anthropic:claude-3-opus-20240229": {
			Provider:          "anthropic",
			Model:             "claude-3-opus-20240229",
			InputPer1kTokens:  0.015, // $15 per 1M input tokens = $0.015 per 1K
			OutputPer1kTokens: 0.075, // $75 per 1M output tokens = $0.075 per 1K
		},
		"anthropic:claude-3-opus": {
			Provider:          "anthropic",
			Model:             "claude-3-opus",
			InputPer1kTokens:  0.015,
			OutputPer1kTokens: 0.075,
		},
		"anthropic:claude-3-sonnet-20240229": {
			Provider:          "anthropic",
			Model:             "claude-3-sonnet-20240229",
			InputPer1kTokens:  0.003, // $3 per 1M input tokens
			OutputPer1kTokens: 0.015, // $15 per 1M output tokens
		},
		"anthropic:claude-3-sonnet": {
			Provider:          "anthropic",
			Model:             "claude-3-sonnet",
			InputPer1kTokens:  0.003,
			OutputPer1kTokens: 0.015,
		},
		"anthropic:claude-3-haiku-20240307": {
			Provider:          "anthropic",
			Model:             "claude-3-haiku-20240307",
			InputPer1kTokens:  0.00025, // $0.25 per 1M input tokens
			OutputPer1kTokens: 0.00125, // $1.25 per 1M output tokens
		},
		"anthropic:claude-3-haiku": {
			Provider:          "anthropic",
			Model:             "claude-3-haiku",
			InputPer1kTokens:  0.00025,
			OutputPer1kTokens: 0.00125,
		},

		// Benchmark defaults (simplified unified pricing)
		"benchmark-openai:default": {
			Provider:    "benchmark-openai",
			Model:       "default",
			Per1kTokens: 0.002, // Average GPT-3.5 pricing
		},
		"benchmark-anthropic:default": {
			Provider:    "benchmark-anthropic",
			Model:       "default",
			Per1kTokens: 0.005, // Average Claude Haiku pricing
		},
	}
}

// SimulationConfig holds configuration for benchmark provider simulations
type SimulationConfig struct {
	// Latency simulation
	MinLatencyMs int `json:"min_latency_ms"`
	MaxLatencyMs int `json:"max_latency_ms"`

	// Token usage simulation
	MinCompletionTokens int `json:"min_completion_tokens"`
	MaxCompletionTokens int `json:"max_completion_tokens"`

	// Error simulation
	ErrorRate float64 `json:"error_rate"` // 0.0-1.0, probability of simulated error

	// Quality simulation
	QualityScore float64 `json:"quality_score"` // 0.0-1.0

	// Enable realistic variation
	EnableVariation bool `json:"enable_variation"`
}

// DefaultSimulationConfig returns sensible defaults for benchmark simulations
func DefaultSimulationConfig() *SimulationConfig {
	return &SimulationConfig{
		MinLatencyMs:        80,
		MaxLatencyMs:        300,
		MinCompletionTokens: 200,
		MaxCompletionTokens: 1200,
		ErrorRate:           0.0, // No simulated errors by default
		QualityScore:        0.90,
		EnableVariation:     true,
	}
}

// LatencyProfile defines latency characteristics for a provider
type LatencyProfile struct {
	Provider      string        `json:"provider"`
	Model         string        `json:"model"`
	AvgLatencyMs  int           `json:"avg_latency_ms"`
	P50LatencyMs  int           `json:"p50_latency_ms"`
	P95LatencyMs  int           `json:"p95_latency_ms"`
	P99LatencyMs  int           `json:"p99_latency_ms"`
	TTFT          time.Duration `json:"ttft"` // Time to first token (streaming)
}

// GetLatencyProfile returns typical latency characteristics for a provider/model
func GetLatencyProfile(provider, model string) *LatencyProfile {
	profiles := map[string]*LatencyProfile{
		"openai:gpt-4": {
			Provider:     "openai",
			Model:        "gpt-4",
			AvgLatencyMs: 1500,
			P50LatencyMs: 1200,
			P95LatencyMs: 3000,
			P99LatencyMs: 5000,
			TTFT:         400 * time.Millisecond,
		},
		"openai:gpt-3.5-turbo": {
			Provider:     "openai",
			Model:        "gpt-3.5-turbo",
			AvgLatencyMs: 800,
			P50LatencyMs: 600,
			P95LatencyMs: 1500,
			P99LatencyMs: 2500,
			TTFT:         200 * time.Millisecond,
		},
		"anthropic:claude-3-opus": {
			Provider:     "anthropic",
			Model:        "claude-3-opus",
			AvgLatencyMs: 2000,
			P50LatencyMs: 1800,
			P95LatencyMs: 4000,
			P99LatencyMs: 6000,
			TTFT:         500 * time.Millisecond,
		},
		"anthropic:claude-3-haiku": {
			Provider:     "anthropic",
			Model:        "claude-3-haiku",
			AvgLatencyMs: 500,
			P50LatencyMs: 400,
			P95LatencyMs: 1000,
			P99LatencyMs: 1500,
			TTFT:         150 * time.Millisecond,
		},
	}

	key := fmt.Sprintf("%s:%s", provider, model)
	if profile, ok := profiles[key]; ok {
		return profile
	}

	// Return default profile
	return &LatencyProfile{
		Provider:     provider,
		Model:        model,
		AvgLatencyMs: 1000,
		P50LatencyMs: 800,
		P95LatencyMs: 2000,
		P99LatencyMs: 3500,
		TTFT:         300 * time.Millisecond,
	}
}

// TokenEstimator provides token estimation utilities
type TokenEstimator struct{}

// EstimatePromptTokens estimates input tokens from a request
// This is a rough approximation: ~1 token per 4 characters
func (te *TokenEstimator) EstimatePromptTokens(req *models.InferRequest) int {
	totalChars := 0
	for _, msg := range req.Messages {
		totalChars += len(msg.GetTextContent())
		totalChars += len(msg.Role) + 10 // Account for role and formatting
	}

	// Rough approximation: 1 token ≈ 4 characters
	tokens := totalChars / 4

	// Add overhead for chat formatting
	tokens += len(req.Messages) * 3

	// Minimum tokens
	if tokens < 10 {
		tokens = 10
	}

	return tokens
}

// EstimateCompletionTokens estimates output tokens
func (te *TokenEstimator) EstimateCompletionTokens(req *models.InferRequest, config *SimulationConfig) int {
	// If MaxTokens is specified, use a percentage of it
	if req.MaxTokens > 0 {
		// Simulate 60-90% of max tokens
		percentage := 0.6 + (0.3 * 0.5) // Midpoint
		return int(float64(req.MaxTokens) * percentage)
	}

	// Otherwise use config range (midpoint)
	if config == nil {
		config = DefaultSimulationConfig()
	}

	return (config.MinCompletionTokens + config.MaxCompletionTokens) / 2
}
