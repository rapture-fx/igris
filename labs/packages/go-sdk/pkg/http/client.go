package http

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/sony/gobreaker"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/time/rate"

	"github.com/igris-inertial/go-sdk/pkg/config"
)

// Client is a resilient HTTP client with observability features
type Client struct {
	client         *resty.Client
	config         *config.Config
	circuitBreaker *gobreaker.CircuitBreaker
	rateLimiter    *rate.Limiter
	tracer         trace.Tracer
}

// Response represents an API response
type Response struct {
	StatusCode int
	Body       []byte
	Headers    http.Header
}

// ErrorResponse represents an API error response
type ErrorResponse struct {
	Error   string                 `json:"error"`
	Message string                 `json:"message"`
	Code    string                 `json:"code"`
	Details map[string]interface{} `json:"details,omitempty"`
}

// NewClient creates a new HTTP client with the given configuration
func NewClient(cfg *config.Config) (*Client, error) {
	client := resty.New()

	// Configure basic settings
	client.SetTimeout(cfg.Timeout)
	client.SetRetryCount(cfg.MaxRetries)
	client.SetRetryWaitTime(cfg.RetryWaitTime)
	client.SetRetryMaxWaitTime(cfg.RetryMaxWaitTime)

	// User Agent
	client.SetHeader("User-Agent", cfg.UserAgent)

	// Custom headers
	for key, value := range cfg.CustomHeaders {
		client.SetHeader(key, value)
	}

	// Configure retry conditions
	client.AddRetryCondition(func(r *resty.Response, err error) bool {
		// Retry on network errors
		if err != nil {
			return true
		}
		
		// Retry on server errors (5xx) and rate limits (429)
		return r.StatusCode() >= 500 || r.StatusCode() == 429
	})

	// Configure HTTP transport
	transport := &http.Transport{
		MaxIdleConns:        cfg.MaxIdleConns,
		MaxIdleConnsPerHost: cfg.MaxIdleConnsPerHost,
		IdleConnTimeout:     cfg.IdleConnTimeout,
		DisableKeepAlives:   cfg.DisableKeepAlives,
	}

	// Add OpenTelemetry instrumentation if tracing is enabled
	if cfg.EnableTracing {
		transport = otelhttp.NewTransport(transport)
	}

	client.SetTransport(transport)

	// Setup circuit breaker if enabled
	var cb *gobreaker.CircuitBreaker
	if cfg.CircuitBreakerEnabled {
		cbSettings := gobreaker.Settings{
			Name:        "igris-overture",
			MaxRequests: cfg.CircuitBreakerMaxRequests,
			Interval:    cfg.CircuitBreakerTimeout,
			Timeout:     cfg.CircuitBreakerTimeout,
			ReadyToTrip: func(counts gobreaker.Counts) bool {
				return counts.ConsecutiveFailures >= cfg.CircuitBreakerFailureThreshold
			},
			OnStateChange: func(name string, from, to gobreaker.State) {
				if cfg.Debug {
					fmt.Printf("Circuit breaker '%s' changed from '%s' to '%s'\n", name, from, to)
				}
			},
		}
		cb = gobreaker.NewCircuitBreaker(cbSettings)
	}

	// Setup rate limiter if enabled
	var rl *rate.Limiter
	if cfg.EnableRateLimit {
		rl = rate.NewLimiter(rate.Limit(cfg.RateLimit), cfg.RateBurst)
	}

	// Setup tracer if tracing is enabled
	var tracer trace.Tracer
	if cfg.EnableTracing {
		tracer = otel.Tracer("igris-inertial-go-sdk")
	}

	return &Client{
		client:         client,
		config:         cfg,
		circuitBreaker: cb,
		rateLimiter:    rl,
		tracer:         tracer,
	}, nil
}

// Get performs a GET request
func (c *Client) Get(ctx context.Context, path string) (*Response, error) {
	return c.request(ctx, "GET", path, nil)
}

// Post performs a POST request
func (c *Client) Post(ctx context.Context, path string, body interface{}) (*Response, error) {
	return c.request(ctx, "POST", path, body)
}

// Put performs a PUT request
func (c *Client) Put(ctx context.Context, path string, body interface{}) (*Response, error) {
	return c.request(ctx, "PUT", path, body)
}

// Patch performs a PATCH request
func (c *Client) Patch(ctx context.Context, path string, body interface{}) (*Response, error) {
	return c.request(ctx, "PATCH", path, body)
}

// Delete performs a DELETE request
func (c *Client) Delete(ctx context.Context, path string) (*Response, error) {
	return c.request(ctx, "DELETE", path, nil)
}

// request is the core request method that handles all HTTP operations
func (c *Client) request(ctx context.Context, method, path string, body interface{}) (*Response, error) {
	// Start tracing if enabled
	var span trace.Span
	if c.tracer != nil {
		ctx, span = c.tracer.Start(ctx, fmt.Sprintf("HTTP %s", method))
		defer span.End()

		span.SetAttributes(
			attribute.String("http.method", method),
			attribute.String("http.url", c.buildURL(path)),
		)
	}

	// Apply rate limiting if enabled
	if c.rateLimiter != nil {
		if err := c.rateLimiter.Wait(ctx); err != nil {
			return nil, fmt.Errorf("rate limit wait failed: %w", err)
		}
	}

	// Execute request with circuit breaker if enabled
	if c.circuitBreaker != nil {
		result, err := c.circuitBreaker.Execute(func() (interface{}, error) {
			return c.executeRequest(ctx, method, path, body)
		})
		if err != nil {
			if span != nil {
				span.SetAttributes(attribute.Bool("error", true))
				span.RecordError(err)
			}
			return nil, err
		}
		return result.(*Response), nil
	}

	// Execute request directly if no circuit breaker
	resp, err := c.executeRequest(ctx, method, path, body)
	if err != nil && span != nil {
		span.SetAttributes(attribute.Bool("error", true))
		span.RecordError(err)
	}
	return resp, err
}

// executeRequest executes the actual HTTP request
func (c *Client) executeRequest(ctx context.Context, method, path string, body interface{}) (*Response, error) {
	url := c.buildURL(path)
	
	req := c.client.R().SetContext(ctx)

	// Set request body if provided
	if body != nil {
		req.SetBody(body)
		req.SetHeader("Content-Type", "application/json")
	}

	// Execute the request
	resp, err := req.Execute(method, url)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %w", err)
	}

	// Build response
	response := &Response{
		StatusCode: resp.StatusCode(),
		Body:       resp.Body(),
		Headers:    resp.Header(),
	}

	// Check for API errors
	if resp.StatusCode() >= 400 {
		apiError := c.parseErrorResponse(resp.Body())
		return response, &APIError{
			StatusCode: resp.StatusCode(),
			Response:   apiError,
			RawBody:    resp.Body(),
		}
	}

	return response, nil
}

// buildURL constructs the full URL from the base URL and path
func (c *Client) buildURL(path string) string {
	baseURL := strings.TrimSuffix(c.config.BaseURL, "/")
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return baseURL + path
}

// parseErrorResponse parses an error response from the API
func (c *Client) parseErrorResponse(body []byte) *ErrorResponse {
	var errorResp ErrorResponse
	if err := json.Unmarshal(body, &errorResp); err != nil {
		// Fallback for non-JSON error responses
		return &ErrorResponse{
			Error:   "API Error",
			Message: string(body),
		}
	}
	return &errorResp
}

// UploadFile uploads a file to the API
func (c *Client) UploadFile(ctx context.Context, path string, file io.Reader, filename string, additionalFields map[string]string) (*Response, error) {
	var span trace.Span
	if c.tracer != nil {
		ctx, span = c.tracer.Start(ctx, "HTTP Upload")
		defer span.End()
		span.SetAttributes(
			attribute.String("http.method", "POST"),
			attribute.String("http.url", c.buildURL(path)),
			attribute.String("file.name", filename),
		)
	}

	// Apply rate limiting
	if c.rateLimiter != nil {
		if err := c.rateLimiter.Wait(ctx); err != nil {
			return nil, fmt.Errorf("rate limit wait failed: %w", err)
		}
	}

	url := c.buildURL(path)
	req := c.client.R().SetContext(ctx)
	
	// Set file
	req.SetFileReader("file", filename, file)
	
	// Add additional fields
	for key, value := range additionalFields {
		req.SetFormData(map[string]string{key: value})
	}

	// Execute with circuit breaker if enabled
	if c.circuitBreaker != nil {
		result, err := c.circuitBreaker.Execute(func() (interface{}, error) {
			resp, err := req.Post(url)
			if err != nil {
				return nil, err
			}
			
			response := &Response{
				StatusCode: resp.StatusCode(),
				Body:       resp.Body(),
				Headers:    resp.Header(),
			}
			
			if resp.StatusCode() >= 400 {
				apiError := c.parseErrorResponse(resp.Body())
				return response, &APIError{
					StatusCode: resp.StatusCode(),
					Response:   apiError,
					RawBody:    resp.Body(),
				}
			}
			
			return response, nil
		})
		
		if err != nil {
			if span != nil {
				span.SetAttributes(attribute.Bool("error", true))
				span.RecordError(err)
			}
			return nil, err
		}
		return result.(*Response), nil
	}

	// Execute directly
	resp, err := req.Post(url)
	if err != nil {
		if span != nil {
			span.SetAttributes(attribute.Bool("error", true))
			span.RecordError(err)
		}
		return nil, fmt.Errorf("file upload failed: %w", err)
	}

	response := &Response{
		StatusCode: resp.StatusCode(),
		Body:       resp.Body(),
		Headers:    resp.Header(),
	}

	if resp.StatusCode() >= 400 {
		apiError := c.parseErrorResponse(resp.Body())
		return response, &APIError{
			StatusCode: resp.StatusCode(),
			Response:   apiError,
			RawBody:    resp.Body(),
		}
	}

	return response, nil
}

// Close closes the HTTP client
func (c *Client) Close() error {
	// Nothing specific to close for resty client
	return nil
}

// APIError represents an API error
type APIError struct {
	StatusCode int
	Response   *ErrorResponse
	RawBody    []byte
}

func (e *APIError) Error() string {
	if e.Response != nil && e.Response.Message != "" {
		return fmt.Sprintf("API error (status %d): %s", e.StatusCode, e.Response.Message)
	}
	return fmt.Sprintf("API error (status %d): %s", e.StatusCode, string(e.RawBody))
}

// IsRetryable returns true if the error is retryable
func (e *APIError) IsRetryable() bool {
	return e.StatusCode >= 500 || e.StatusCode == 429
}