package providers

import (
	"context"
	"io"

	"github.com/Igris-inertial/system/igris-overture/models"
)

// Provider defines the interface for LLM inference providers
// Implementations: OpenAI, Anthropic, Python ML Adapter, future providers
type Provider interface {
	// Name returns the provider identifier ("openai", "anthropic", "python-adapter")
	Name() string

	// Infer performs a single inference request
	// Returns response or error
	Infer(ctx context.Context, req *models.InferRequest) (*models.InferResponse, error)

	// InferStream performs streaming inference
	// Returns a channel of response chunks
	InferStream(ctx context.Context, req *models.InferRequest) (<-chan *models.StreamChunk, <-chan error)

	// HealthCheck verifies provider availability
	// Returns true if provider is healthy and ready
	HealthCheck(ctx context.Context) error

	// GetCapabilities returns provider capabilities
	GetCapabilities() *ProviderCapabilities

	// EstimateCost estimates the cost for a given request
	// Returns estimated cost in USD
	EstimateCost(req *models.InferRequest) (float64, error)

	// Close releases provider resources
	Close() error
}

// ProviderCapabilities describes what a provider supports
type ProviderCapabilities struct {
	// Supported models
	Models []string `json:"models"`

	// Feature support
	SupportsStreaming    bool `json:"supports_streaming"`
	SupportsVision       bool `json:"supports_vision"`
	SupportsTools        bool `json:"supports_tools"`
	SupportsFunctionCall bool `json:"supports_function_call"`

	// Parameter support
	SupportsTemperature      bool `json:"supports_temperature"`
	SupportsTopP             bool `json:"supports_top_p"`
	SupportsTopK             bool `json:"supports_top_k"`
	SupportsPresencePenalty  bool `json:"supports_presence_penalty"`
	SupportsFrequencyPenalty bool `json:"supports_frequency_penalty"`
	SupportsStop             bool `json:"supports_stop"`

	// Limits
	MaxTokens          int `json:"max_tokens"`           // Maximum tokens per request
	MaxContextWindow   int `json:"max_context_window"`   // Maximum context window
	RateLimitRPM       int `json:"rate_limit_rpm"`       // Requests per minute
	RateLimitTPM       int `json:"rate_limit_tpm"`       // Tokens per minute

	// Performance characteristics
	AverageLatencyMs int     `json:"average_latency_ms"` // Average response latency
	ReliabilityScore float64 `json:"reliability_score"`  // 0.0-1.0 reliability score
	CostPerToken     float64 `json:"cost_per_token"`     // USD per token
}

// ProviderConfig holds provider-specific configuration
type ProviderConfig struct {
	// Common fields
	APIKey        string            `json:"api_key"`
	BaseURL       string            `json:"base_url"`
	Timeout       int               `json:"timeout"`        // Timeout in seconds
	MaxRetries    int               `json:"max_retries"`
	RetryDelay    int               `json:"retry_delay"`    // Delay between retries in milliseconds
	EnableMetrics bool              `json:"enable_metrics"`

	// Provider-specific extensions
	Custom map[string]interface{} `json:"custom,omitempty"`
}

// ProviderRegistry manages provider instances
type ProviderRegistry struct {
	providers map[string]Provider
}

// NewProviderRegistry creates a new provider registry
func NewProviderRegistry() *ProviderRegistry {
	return &ProviderRegistry{
		providers: make(map[string]Provider),
	}
}

// Register adds a provider to the registry
func (r *ProviderRegistry) Register(provider Provider) {
	r.providers[provider.Name()] = provider
}

// Get retrieves a provider by name
func (r *ProviderRegistry) Get(name string) (Provider, bool) {
	provider, exists := r.providers[name]
	return provider, exists
}

// List returns all registered provider names
func (r *ProviderRegistry) List() []string {
	names := make([]string, 0, len(r.providers))
	for name := range r.providers {
		names = append(names, name)
	}
	return names
}

// CloseAll closes all registered providers
func (r *ProviderRegistry) CloseAll() error {
	var lastErr error
	for _, provider := range r.providers {
		if err := provider.Close(); err != nil {
			lastErr = err
		}
	}
	return lastErr
}

// StreamReader wraps a streaming channel for easier consumption
type StreamReader struct {
	chunkChan <-chan *models.StreamChunk
	errChan   <-chan error
}

// NewStreamReader creates a new StreamReader
func NewStreamReader(chunkChan <-chan *models.StreamChunk, errChan <-chan error) *StreamReader {
	return &StreamReader{
		chunkChan: chunkChan,
		errChan:   errChan,
	}
}

// Read implements io.Reader interface for streaming chunks
func (sr *StreamReader) Read(p []byte) (n int, err error) {
	select {
	case chunk, ok := <-sr.chunkChan:
		if !ok {
			return 0, io.EOF
		}
		data, err := chunk.ToSSE()
		if err != nil {
			return 0, err
		}
		n = copy(p, data)
		return n, nil
	case err := <-sr.errChan:
		return 0, err
	}
}

// ProviderError represents a provider-specific error
type ProviderError struct {
	Provider string // Provider name
	Code     string // Error code
	Message  string // Error message
	Retryable bool  // Whether the error is retryable
}

func (e *ProviderError) Error() string {
	return e.Provider + ": " + e.Message
}

// NewProviderError creates a new ProviderError
func NewProviderError(provider, code, message string, retryable bool) *ProviderError {
	return &ProviderError{
		Provider:  provider,
		Code:      code,
		Message:   message,
		Retryable: retryable,
	}
}
