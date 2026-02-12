package providers

import (
	"fmt"
	"strings"

	"github.com/Igris-inertial/system/igris-overture/models"
)

// ProviderAdapter abstracts provider-specific behavior for normalization and error handling
type ProviderAdapter interface {
	// NormalizeUsage converts provider-specific usage data to standardized format
	NormalizeUsage(resp *models.InferResponse) (*NormalizedUsage, error)

	// ClassifyError categorizes provider errors into standardized error types
	ClassifyError(err error) *ClassifiedError

	// GetProviderName returns the provider identifier
	GetProviderName() string

	// EstimateInputTokens estimates input tokens from request
	EstimateInputTokens(req *models.InferRequest) int

	// EstimateOutputTokens estimates output tokens from request parameters
	EstimateOutputTokens(req *models.InferRequest) int
}

// NormalizedUsage represents standardized token usage across providers
type NormalizedUsage struct {
	ProviderName      string  `json:"provider_name"`
	Model             string  `json:"model"`
	InputTokens       int     `json:"input_tokens"`
	OutputTokens      int     `json:"output_tokens"`
	TotalTokens       int     `json:"total_tokens"`
	CachedTokens      int     `json:"cached_tokens,omitempty"`      // For providers that support caching
	ReasoningTokens   int     `json:"reasoning_tokens,omitempty"`   // For o1-style models
	EstimatedCostUSD  float64 `json:"estimated_cost_usd"`
	ActualCostUSD     float64 `json:"actual_cost_usd,omitempty"`    // If provider returns actual cost
}

// ClassifiedError represents a categorized provider error
type ClassifiedError struct {
	ProviderName  string         `json:"provider_name"`
	ErrorType     ErrorType      `json:"error_type"`
	ErrorCode     string         `json:"error_code"`
	ErrorMessage  string         `json:"error_message"`
	HTTPStatus    int            `json:"http_status,omitempty"`
	Retryable     bool           `json:"retryable"`
	RetryAfter    int            `json:"retry_after,omitempty"` // Seconds to wait before retry
	SuggestedAction string       `json:"suggested_action,omitempty"`
	OriginalError error          `json:"-"`
}

// ErrorType categorizes errors into standard types
type ErrorType string

const (
	// Client errors (4xx - user's fault)
	ErrorTypeInvalidRequest     ErrorType = "invalid_request"      // 400
	ErrorTypeAuthentication     ErrorType = "authentication"       // 401
	ErrorTypePermissionDenied   ErrorType = "permission_denied"    // 403
	ErrorTypeNotFound           ErrorType = "not_found"            // 404
	ErrorTypeRateLimit          ErrorType = "rate_limit"           // 429
	ErrorTypeQuotaExceeded      ErrorType = "quota_exceeded"       // 429
	ErrorTypeContentFilter      ErrorType = "content_filter"       // 400

	// Server errors (5xx - provider's fault)
	ErrorTypeServerError        ErrorType = "server_error"         // 500
	ErrorTypeServiceUnavailable ErrorType = "service_unavailable"  // 503
	ErrorTypeTimeout            ErrorType = "timeout"              // 504
	ErrorTypeOverloaded         ErrorType = "overloaded"           // 503

	// Network errors
	ErrorTypeNetworkError       ErrorType = "network_error"
	ErrorTypeConnectionRefused  ErrorType = "connection_refused"

	// Unknown
	ErrorTypeUnknown            ErrorType = "unknown"
)

// IsRetryable returns whether this error type should be retried
func (et ErrorType) IsRetryable() bool {
	switch et {
	case ErrorTypeRateLimit, ErrorTypeServiceUnavailable, ErrorTypeTimeout,
		ErrorTypeOverloaded, ErrorTypeNetworkError, ErrorTypeServerError:
		return true
	default:
		return false
	}
}

// IsClientError returns whether this is a client-side error (4xx)
func (et ErrorType) IsClientError() bool {
	switch et {
	case ErrorTypeInvalidRequest, ErrorTypeAuthentication, ErrorTypePermissionDenied,
		ErrorTypeNotFound, ErrorTypeContentFilter:
		return true
	default:
		return false
	}
}

// BaseProviderAdapter provides common functionality for all adapters
type BaseProviderAdapter struct {
	providerName string
}

// GetProviderName returns the provider identifier
func (b *BaseProviderAdapter) GetProviderName() string {
	return b.providerName
}

// EstimateInputTokens provides a basic token estimation (override in specific adapters)
func (b *BaseProviderAdapter) EstimateInputTokens(req *models.InferRequest) int {
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

// EstimateOutputTokens estimates output tokens from request parameters
func (b *BaseProviderAdapter) EstimateOutputTokens(req *models.InferRequest) int {
	// If MaxTokens is specified, use 70% of it as estimate
	if req.MaxTokens > 0 {
		return int(float64(req.MaxTokens) * 0.7)
	}

	// Default estimate
	return 200
}

// =============================================================================
// OpenAI Adapter
// =============================================================================

// OpenAIAdapter implements ProviderAdapter for OpenAI
type OpenAIAdapter struct {
	BaseProviderAdapter
}

// NewOpenAIAdapter creates a new OpenAI provider adapter
func NewOpenAIAdapter() *OpenAIAdapter {
	return &OpenAIAdapter{
		BaseProviderAdapter: BaseProviderAdapter{providerName: "openai"},
	}
}

// NormalizeUsage converts OpenAI usage data to normalized format
func (a *OpenAIAdapter) NormalizeUsage(resp *models.InferResponse) (*NormalizedUsage, error) {
	if resp.Usage == nil {
		return nil, fmt.Errorf("response missing usage data")
	}

	usage := &NormalizedUsage{
		ProviderName: a.providerName,
		Model:        resp.Model,
		InputTokens:  resp.Usage.PromptTokens,
		OutputTokens: resp.Usage.CompletionTokens,
		TotalTokens:  resp.Usage.TotalTokens,
	}

	// OpenAI-specific: handle cached tokens if present (future enhancement)
	// CachedTokens field not yet in UsageStats model

	return usage, nil
}

// ClassifyError categorizes OpenAI errors
func (a *OpenAIAdapter) ClassifyError(err error) *ClassifiedError {
	if err == nil {
		return nil
	}

	errMsg := err.Error()
	errMsgLower := strings.ToLower(errMsg)

	classified := &ClassifiedError{
		ProviderName:  a.providerName,
		ErrorMessage:  errMsg,
		OriginalError: err,
	}

	// Check for specific OpenAI error patterns
	switch {
	case strings.Contains(errMsgLower, "rate limit"):
		classified.ErrorType = ErrorTypeRateLimit
		classified.ErrorCode = "rate_limit_exceeded"
		classified.Retryable = true
		classified.RetryAfter = 60 // Default 60 seconds
		classified.SuggestedAction = "Wait and retry, or reduce request rate"

	case strings.Contains(errMsgLower, "quota"):
		classified.ErrorType = ErrorTypeQuotaExceeded
		classified.ErrorCode = "quota_exceeded"
		classified.Retryable = false
		classified.SuggestedAction = "Check billing and quota limits"

	case strings.Contains(errMsgLower, "invalid api key") || strings.Contains(errMsgLower, "unauthorized"):
		classified.ErrorType = ErrorTypeAuthentication
		classified.ErrorCode = "invalid_api_key"
		classified.HTTPStatus = 401
		classified.Retryable = false
		classified.SuggestedAction = "Verify API key configuration"

	case strings.Contains(errMsgLower, "content policy") || strings.Contains(errMsgLower, "content filter"):
		classified.ErrorType = ErrorTypeContentFilter
		classified.ErrorCode = "content_policy_violation"
		classified.HTTPStatus = 400
		classified.Retryable = false
		classified.SuggestedAction = "Modify request to comply with content policy"

	case strings.Contains(errMsgLower, "model not found") || strings.Contains(errMsgLower, "invalid model"):
		classified.ErrorType = ErrorTypeNotFound
		classified.ErrorCode = "model_not_found"
		classified.HTTPStatus = 404
		classified.Retryable = false
		classified.SuggestedAction = "Check model name and availability"

	case strings.Contains(errMsgLower, "timeout"):
		classified.ErrorType = ErrorTypeTimeout
		classified.ErrorCode = "request_timeout"
		classified.HTTPStatus = 504
		classified.Retryable = true
		classified.RetryAfter = 5
		classified.SuggestedAction = "Retry with shorter max_tokens or reduce request size"

	case strings.Contains(errMsgLower, "service unavailable") || strings.Contains(errMsgLower, "503"):
		classified.ErrorType = ErrorTypeServiceUnavailable
		classified.ErrorCode = "service_unavailable"
		classified.HTTPStatus = 503
		classified.Retryable = true
		classified.RetryAfter = 10
		classified.SuggestedAction = "Wait and retry"

	case strings.Contains(errMsgLower, "overloaded") || strings.Contains(errMsgLower, "too many requests"):
		classified.ErrorType = ErrorTypeOverloaded
		classified.ErrorCode = "server_overloaded"
		classified.HTTPStatus = 503
		classified.Retryable = true
		classified.RetryAfter = 30
		classified.SuggestedAction = "Implement exponential backoff"

	case strings.Contains(errMsgLower, "bad request") || strings.Contains(errMsgLower, "invalid"):
		classified.ErrorType = ErrorTypeInvalidRequest
		classified.ErrorCode = "invalid_request"
		classified.HTTPStatus = 400
		classified.Retryable = false
		classified.SuggestedAction = "Check request parameters"

	default:
		classified.ErrorType = ErrorTypeUnknown
		classified.ErrorCode = "unknown_error"
		classified.Retryable = false
		classified.SuggestedAction = "Check error details and provider status"
	}

	return classified
}

// =============================================================================
// Anthropic Adapter
// =============================================================================

// AnthropicAdapter implements ProviderAdapter for Anthropic
type AnthropicAdapter struct {
	BaseProviderAdapter
}

// NewAnthropicAdapter creates a new Anthropic provider adapter
func NewAnthropicAdapter() *AnthropicAdapter {
	return &AnthropicAdapter{
		BaseProviderAdapter: BaseProviderAdapter{providerName: "anthropic"},
	}
}

// NormalizeUsage converts Anthropic usage data to normalized format
func (a *AnthropicAdapter) NormalizeUsage(resp *models.InferResponse) (*NormalizedUsage, error) {
	if resp.Usage == nil {
		return nil, fmt.Errorf("response missing usage data")
	}

	usage := &NormalizedUsage{
		ProviderName: a.providerName,
		Model:        resp.Model,
		InputTokens:  resp.Usage.PromptTokens,
		OutputTokens: resp.Usage.CompletionTokens,
		TotalTokens:  resp.Usage.TotalTokens,
	}

	return usage, nil
}

// ClassifyError categorizes Anthropic errors
func (a *AnthropicAdapter) ClassifyError(err error) *ClassifiedError {
	if err == nil {
		return nil
	}

	errMsg := err.Error()
	errMsgLower := strings.ToLower(errMsg)

	classified := &ClassifiedError{
		ProviderName:  a.providerName,
		ErrorMessage:  errMsg,
		OriginalError: err,
	}

	// Check for specific Anthropic error patterns
	switch {
	case strings.Contains(errMsgLower, "rate limit") || strings.Contains(errMsgLower, "rate_limit"):
		classified.ErrorType = ErrorTypeRateLimit
		classified.ErrorCode = "rate_limit_error"
		classified.HTTPStatus = 429
		classified.Retryable = true
		classified.RetryAfter = 60
		classified.SuggestedAction = "Implement rate limiting and exponential backoff"

	case strings.Contains(errMsgLower, "authentication") || strings.Contains(errMsgLower, "invalid_x_api_key"):
		classified.ErrorType = ErrorTypeAuthentication
		classified.ErrorCode = "authentication_error"
		classified.HTTPStatus = 401
		classified.Retryable = false
		classified.SuggestedAction = "Verify Anthropic API key in x-api-key header"

	case strings.Contains(errMsgLower, "permission_error"):
		classified.ErrorType = ErrorTypePermissionDenied
		classified.ErrorCode = "permission_denied"
		classified.HTTPStatus = 403
		classified.Retryable = false
		classified.SuggestedAction = "Check API key permissions and model access"

	case strings.Contains(errMsgLower, "overloaded"):
		classified.ErrorType = ErrorTypeOverloaded
		classified.ErrorCode = "overloaded_error"
		classified.HTTPStatus = 529
		classified.Retryable = true
		classified.RetryAfter = 60
		classified.SuggestedAction = "Retry with exponential backoff"

	case strings.Contains(errMsgLower, "timeout"):
		classified.ErrorType = ErrorTypeTimeout
		classified.ErrorCode = "request_timeout"
		classified.HTTPStatus = 504
		classified.Retryable = true
		classified.RetryAfter = 5
		classified.SuggestedAction = "Retry or reduce max_tokens parameter"

	case strings.Contains(errMsgLower, "not_found_error"):
		classified.ErrorType = ErrorTypeNotFound
		classified.ErrorCode = "not_found"
		classified.HTTPStatus = 404
		classified.Retryable = false
		classified.SuggestedAction = "Verify model name and endpoint"

	case strings.Contains(errMsgLower, "invalid_request"):
		classified.ErrorType = ErrorTypeInvalidRequest
		classified.ErrorCode = "invalid_request_error"
		classified.HTTPStatus = 400
		classified.Retryable = false
		classified.SuggestedAction = "Review request format and required parameters"

	case strings.Contains(errMsgLower, "service_unavailable") || strings.Contains(errMsgLower, "503"):
		classified.ErrorType = ErrorTypeServiceUnavailable
		classified.ErrorCode = "service_unavailable"
		classified.HTTPStatus = 503
		classified.Retryable = true
		classified.RetryAfter = 10
		classified.SuggestedAction = "Wait and retry"

	default:
		classified.ErrorType = ErrorTypeUnknown
		classified.ErrorCode = "unknown_error"
		classified.Retryable = false
		classified.SuggestedAction = "Check Anthropic API status and error details"
	}

	return classified
}

// =============================================================================
// Adapter Registry
// =============================================================================

// AdapterRegistry manages provider adapters
type AdapterRegistry struct {
	adapters map[string]ProviderAdapter
}

// NewAdapterRegistry creates a new adapter registry
func NewAdapterRegistry() *AdapterRegistry {
	registry := &AdapterRegistry{
		adapters: make(map[string]ProviderAdapter),
	}

	// Register default adapters
	registry.Register(NewOpenAIAdapter())
	registry.Register(NewAnthropicAdapter())

	return registry
}

// Register adds an adapter to the registry
func (r *AdapterRegistry) Register(adapter ProviderAdapter) {
	r.adapters[adapter.GetProviderName()] = adapter
}

// Get retrieves an adapter by provider name
func (r *AdapterRegistry) Get(providerName string) (ProviderAdapter, bool) {
	adapter, exists := r.adapters[providerName]
	return adapter, exists
}

// NormalizeUsage normalizes usage from any provider
func (r *AdapterRegistry) NormalizeUsage(providerName string, resp *models.InferResponse) (*NormalizedUsage, error) {
	adapter, exists := r.Get(providerName)
	if !exists {
		return nil, fmt.Errorf("no adapter registered for provider: %s", providerName)
	}

	return adapter.NormalizeUsage(resp)
}

// ClassifyError classifies an error from any provider
func (r *AdapterRegistry) ClassifyError(providerName string, err error) *ClassifiedError {
	adapter, exists := r.Get(providerName)
	if !exists {
		return &ClassifiedError{
			ProviderName:  providerName,
			ErrorType:     ErrorTypeUnknown,
			ErrorMessage:  err.Error(),
			OriginalError: err,
		}
	}

	return adapter.ClassifyError(err)
}
