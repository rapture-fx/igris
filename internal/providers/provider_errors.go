package providers

import (
	"errors"
	"fmt"
)

// Common provider error codes
const (
	// Client errors (4xx equivalent)
	ErrCodeInvalidRequest    = "INVALID_REQUEST"
	ErrCodeAuthenticationErr = "AUTHENTICATION_ERROR"
	ErrCodeRateLimitExceeded = "RATE_LIMIT_EXCEEDED"
	ErrCodeQuotaExceeded     = "QUOTA_EXCEEDED"
	ErrCodeModelNotFound     = "MODEL_NOT_FOUND"
	ErrCodeInvalidModel      = "INVALID_MODEL"
	ErrCodeContextTooLong    = "CONTEXT_TOO_LONG"

	// Server errors (5xx equivalent)
	ErrCodeServiceUnavailable = "SERVICE_UNAVAILABLE"
	ErrCodeInternalError      = "INTERNAL_ERROR"
	ErrCodeTimeout            = "TIMEOUT"
	ErrCodeOverloaded         = "OVERLOADED"

	// Network errors
	ErrCodeNetworkError   = "NETWORK_ERROR"
	ErrCodeConnectionFail = "CONNECTION_FAILED"
	ErrCodeDNSError       = "DNS_ERROR"

	// Benchmark/simulation specific
	ErrCodeSimulatedError = "SIMULATED_ERROR"
)

// RetryableErrors defines which error codes support retry
var RetryableErrors = map[string]bool{
	ErrCodeRateLimitExceeded:  true,
	ErrCodeServiceUnavailable: true,
	ErrCodeTimeout:            true,
	ErrCodeOverloaded:         true,
	ErrCodeNetworkError:       true,
	ErrCodeConnectionFail:     true,
	ErrCodeSimulatedError:     true, // For testing retry logic
}

// IsRetryable checks if an error is retryable
func IsRetryable(err error) bool {
	var providerErr *ProviderError
	if errors.As(err, &providerErr) {
		return providerErr.Retryable
	}
	return false
}

// ErrorCategory categorizes errors for metrics and monitoring
type ErrorCategory string

const (
	ErrorCategoryClient  ErrorCategory = "client"
	ErrorCategoryServer  ErrorCategory = "server"
	ErrorCategoryNetwork ErrorCategory = "network"
	ErrorCategoryUnknown ErrorCategory = "unknown"
)

// GetErrorCategory returns the category for an error code
func GetErrorCategory(code string) ErrorCategory {
	clientErrors := map[string]bool{
		ErrCodeInvalidRequest:    true,
		ErrCodeAuthenticationErr: true,
		ErrCodeRateLimitExceeded: true,
		ErrCodeQuotaExceeded:     true,
		ErrCodeModelNotFound:     true,
		ErrCodeInvalidModel:      true,
		ErrCodeContextTooLong:    true,
	}

	serverErrors := map[string]bool{
		ErrCodeServiceUnavailable: true,
		ErrCodeInternalError:      true,
		ErrCodeTimeout:            true,
		ErrCodeOverloaded:         true,
	}

	networkErrors := map[string]bool{
		ErrCodeNetworkError:   true,
		ErrCodeConnectionFail: true,
		ErrCodeDNSError:       true,
	}

	if clientErrors[code] {
		return ErrorCategoryClient
	}
	if serverErrors[code] {
		return ErrorCategoryServer
	}
	if networkErrors[code] {
		return ErrorCategoryNetwork
	}

	return ErrorCategoryUnknown
}

// WrapProviderError wraps a generic error into a ProviderError
func WrapProviderError(provider string, err error) *ProviderError {
	if err == nil {
		return nil
	}

	// If already a ProviderError, return as-is
	var providerErr *ProviderError
	if errors.As(err, &providerErr) {
		return providerErr
	}

	// Wrap generic error
	return &ProviderError{
		Provider:  provider,
		Code:      ErrCodeInternalError,
		Message:   err.Error(),
		Retryable: false,
	}
}

// ProviderErrorDetail provides additional error context
type ProviderErrorDetail struct {
	HTTPStatus int               `json:"http_status,omitempty"`
	RequestID  string            `json:"request_id,omitempty"`
	Metadata   map[string]string `json:"metadata,omitempty"`
}

// EnhancedProviderError extends ProviderError with additional context
type EnhancedProviderError struct {
	*ProviderError
	Detail *ProviderErrorDetail
}

func (e *EnhancedProviderError) Error() string {
	if e.Detail != nil && e.Detail.RequestID != "" {
		return fmt.Sprintf("%s (request_id: %s)", e.ProviderError.Error(), e.Detail.RequestID)
	}
	return e.ProviderError.Error()
}

// NewEnhancedProviderError creates an enhanced provider error with details
func NewEnhancedProviderError(provider, code, message string, retryable bool, detail *ProviderErrorDetail) *EnhancedProviderError {
	return &EnhancedProviderError{
		ProviderError: NewProviderError(provider, code, message, retryable),
		Detail:        detail,
	}
}

// SimulatedErrorScenario defines an error scenario for benchmark testing
type SimulatedErrorScenario struct {
	Code        string  `json:"code"`
	Message     string  `json:"message"`
	Probability float64 `json:"probability"` // 0.0-1.0
	Retryable   bool    `json:"retryable"`
	DelayMs     int     `json:"delay_ms"` // Simulated delay before error
}

// DefaultErrorScenarios returns common error scenarios for testing
func DefaultErrorScenarios() []*SimulatedErrorScenario {
	return []*SimulatedErrorScenario{
		{
			Code:        ErrCodeRateLimitExceeded,
			Message:     "Rate limit exceeded, please retry after delay",
			Probability: 0.05, // 5% of requests
			Retryable:   true,
			DelayMs:     100,
		},
		{
			Code:        ErrCodeServiceUnavailable,
			Message:     "Service temporarily unavailable",
			Probability: 0.02, // 2% of requests
			Retryable:   true,
			DelayMs:     50,
		},
		{
			Code:        ErrCodeTimeout,
			Message:     "Request timeout",
			Probability: 0.01, // 1% of requests
			Retryable:   true,
			DelayMs:     5000, // Simulate actual timeout
		},
		{
			Code:        ErrCodeInvalidRequest,
			Message:     "Invalid request parameters",
			Probability: 0.005, // 0.5% of requests
			Retryable:   false,
			DelayMs:     10,
		},
	}
}

// ErrorSimulator helps simulate realistic error scenarios for testing
type ErrorSimulator struct {
	scenarios []*SimulatedErrorScenario
	enabled   bool
}

// NewErrorSimulator creates a new error simulator
func NewErrorSimulator(scenarios []*SimulatedErrorScenario, enabled bool) *ErrorSimulator {
	if scenarios == nil {
		scenarios = DefaultErrorScenarios()
	}
	return &ErrorSimulator{
		scenarios: scenarios,
		enabled:   enabled,
	}
}

// ShouldSimulateError determines if an error should be simulated based on probability
func (es *ErrorSimulator) ShouldSimulateError(rng func() float64) (*SimulatedErrorScenario, bool) {
	if !es.enabled {
		return nil, false
	}

	for _, scenario := range es.scenarios {
		if rng() < scenario.Probability {
			return scenario, true
		}
	}

	return nil, false
}

// Common error constructors for convenience

// NewRateLimitError creates a rate limit error
func NewRateLimitError(provider string) *ProviderError {
	return NewProviderError(
		provider,
		ErrCodeRateLimitExceeded,
		"Rate limit exceeded",
		true,
	)
}

// NewTimeoutError creates a timeout error
func NewTimeoutError(provider string) *ProviderError {
	return NewProviderError(
		provider,
		ErrCodeTimeout,
		"Request timeout",
		true,
	)
}

// NewInvalidModelError creates an invalid model error
func NewInvalidModelError(provider, model string) *ProviderError {
	return NewProviderError(
		provider,
		ErrCodeInvalidModel,
		fmt.Sprintf("Model not supported: %s", model),
		false,
	)
}

// NewServiceUnavailableError creates a service unavailable error
func NewServiceUnavailableError(provider string) *ProviderError {
	return NewProviderError(
		provider,
		ErrCodeServiceUnavailable,
		"Service temporarily unavailable",
		true,
	)
}
