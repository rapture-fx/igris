// Package igris provides the official Go SDK for Igris Overture.
//
// Igris Overture is an intelligent AI routing and cost optimization platform
// that provides a unified interface to multiple LLM providers.
package igris

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/cenkalti/backoff/v4"

	"github.com/Igris-inertial/system/igris-overture/sdk/go/igris/escapevector"
)

const (
	// DefaultBaseURL is the default API base URL
	DefaultBaseURL = "http://localhost:8081"

	// DefaultTimeout is the default request timeout
	DefaultTimeout = 30 * time.Second

	// SDKVersion is the current SDK version
	SDKVersion = "1.0.0-rc1"
)

// Client is the main Igris Overture SDK client.
//
// It provides methods to interact with the Igris Overture API including
// inference requests, model listing, and health checks.
//
// Features EscapeVector Mode - Thompson Sampling-powered resilience that
// continues Bayesian optimization even during total control plane outages.
//
// Example usage:
//
//	client := igris.NewClient(&igris.Config{
//		BaseURL: "http://localhost:8081",
//		APIKey:  "your-api-key", // optional
//	})
//
//	response, err := client.Infer(context.Background(), &igris.InferRequest{
//		Model: "gpt-4",
//		Messages: []igris.Message{
//			{Role: "user", Content: "Hello!"},
//		},
//	})
type Client struct {
	baseURL      string
	apiKey       string
	httpClient   *http.Client
	userAgent    string
	escapeVector *escapevector.EscapeVectorMode
}

// Config holds configuration options for the Client.
type Config struct {
	// BaseURL is the API base URL (default: http://localhost:8081)
	BaseURL string

	// APIKey is the optional API key for authentication
	APIKey string

	// Timeout is the request timeout (default: 30 seconds)
	Timeout time.Duration

	// HTTPClient is an optional custom HTTP client
	HTTPClient *http.Client
}

// NewClient creates a new Igris Overture client.
//
// If cfg is nil, default configuration is used. The BaseURL defaults to
// http://localhost:8081 and can be overridden with the IGRIS_BASE_URL
// environment variable. The API key can be set via IGRIS_API_KEY.
//
// Example:
//
//	client := igris.NewClient(&igris.Config{
//		BaseURL: "http://localhost:8081",
//		APIKey:  os.Getenv("IGRIS_API_KEY"),
//		Timeout: 60 * time.Second,
//	})
func NewClient(cfg *Config) *Client {
	if cfg == nil {
		cfg = &Config{}
	}

	// Set defaults
	baseURL := cfg.BaseURL
	if baseURL == "" {
		baseURL = os.Getenv("IGRIS_BASE_URL")
		if baseURL == "" {
			baseURL = DefaultBaseURL
		}
	}

	apiKey := cfg.APIKey
	if apiKey == "" {
		apiKey = os.Getenv("IGRIS_API_KEY")
	}

	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = DefaultTimeout
	}

	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{
			Timeout: timeout,
		}
	}

	// Initialize EscapeVector Mode for Thompson Sampling-powered resilience
	escapeVectorMode, err := escapevector.NewEscapeVectorMode()
	if err != nil {
		// Log warning but continue - EscapeVector is optional resilience layer
		fmt.Fprintf(os.Stderr, "Warning: Failed to initialize EscapeVector Mode: %v\n", err)
	}

	return &Client{
		baseURL:      baseURL,
		apiKey:       apiKey,
		httpClient:   httpClient,
		userAgent:    fmt.Sprintf("igris-go-sdk/%s", SDKVersion),
		escapeVector: escapeVectorMode,
	}
}

// Message represents a chat message in the conversation.
type Message struct {
	// Role is the message role (system, user, or assistant)
	Role string `json:"role"`

	// Content is the message content
	Content string `json:"content"`
}

// InferRequest represents a request to the inference endpoint.
type InferRequest struct {
	// Model is the model identifier (e.g., "gpt-4", "claude-3-opus")
	Model string `json:"model"`

	// Messages is the list of conversation messages
	Messages []Message `json:"messages"`

	// MaxTokens is the maximum number of tokens in the response (optional)
	MaxTokens *int `json:"max_tokens,omitempty"`

	// Temperature controls randomness (0.0 to 2.0, optional)
	Temperature *float64 `json:"temperature,omitempty"`

	// TopP controls nucleus sampling (optional)
	TopP *float64 `json:"top_p,omitempty"`
}

// Choice represents a single response choice.
type Choice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finish_reason,omitempty"`
}

// Usage represents token usage statistics.
type Usage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// InferResponse represents the response from the inference endpoint.
type InferResponse struct {
	ID      string   `json:"id,omitempty"`
	Object  string   `json:"object,omitempty"`
	Created int64    `json:"created,omitempty"`
	Model   string   `json:"model"`
	Choices []Choice `json:"choices"`
	Usage   *Usage   `json:"usage,omitempty"`
}

// Model represents an available model.
type Model struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created,omitempty"`
	OwnedBy string `json:"owned_by,omitempty"`
}

// ModelsResponse represents the response from the models endpoint.
type ModelsResponse struct {
	Object string  `json:"object"`
	Data   []Model `json:"data"`
}

// HealthResponse represents the response from the health endpoint.
type HealthResponse struct {
	Status    string `json:"status"`
	Version   string `json:"version,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
}

// ProviderStats represents provider statistics.
type ProviderStats map[string]interface{}

// APIError represents an API error response.
type APIError struct {
	StatusCode int
	Message    string
	Response   interface{}
}

// Error implements the error interface.
func (e *APIError) Error() string {
	if e.StatusCode > 0 {
		return fmt.Sprintf("API error %d: %s", e.StatusCode, e.Message)
	}
	return fmt.Sprintf("API error: %s", e.Message)
}

// doRequest performs an HTTP request with retry logic.
func (c *Client) doRequest(ctx context.Context, method, endpoint string, body interface{}) (*http.Response, error) {
	operation := func() (*http.Response, error) {
		url := c.baseURL + endpoint

		var bodyReader io.Reader
		if body != nil {
			jsonData, err := json.Marshal(body)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal request body: %w", err)
			}
			bodyReader = bytes.NewReader(jsonData)
		}

		req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}

		// Set headers
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", c.userAgent)
		if c.apiKey != "" {
			req.Header.Set("Authorization", "Bearer "+c.apiKey)
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, err
		}

		// Check for retryable status codes
		if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
			resp.Body.Close()
			return nil, fmt.Errorf("retryable error: %d", resp.StatusCode)
		}

		return resp, nil
	}

	// Configure exponential backoff
	b := backoff.NewExponentialBackOff()
	b.MaxElapsedTime = 30 * time.Second

	var resp *http.Response
	err := backoff.Retry(func() error {
		var err error
		resp, err = operation()
		return err
	}, backoff.WithContext(b, ctx))

	return resp, err
}

// parseResponse parses an HTTP response into the target structure.
func (c *Client) parseResponse(resp *http.Response, v interface{}) error {
	defer resp.Body.Close()

	// Handle error responses
	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)

		var errorResp struct {
			Error string `json:"error"`
		}

		if json.Unmarshal(body, &errorResp) == nil && errorResp.Error != "" {
			return &APIError{
				StatusCode: resp.StatusCode,
				Message:    errorResp.Error,
			}
		}

		return &APIError{
			StatusCode: resp.StatusCode,
			Message:    string(body),
		}
	}

	// Decode success response
	if err := json.NewDecoder(resp.Body).Decode(v); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}

	return nil
}

// Infer makes an inference request using Igris Overture's intelligent routing.
//
// This method sends a request to the /v1/infer endpoint and returns the
// model's response. The request is automatically routed to the best available
// provider based on the configured routing policies.
//
// EscapeVector Mode: If the control plane is unreachable (3 consecutive timeouts > 500ms),
// the SDK automatically switches to local Thompson Sampling fallback using cached
// Bayesian parameters. This ensures zero dropped tokens during outages.
//
// Example:
//
//	ctx := context.Background()
//	response, err := client.Infer(ctx, &igris.InferRequest{
//		Model: "gpt-4",
//		Messages: []igris.Message{
//			{Role: "system", Content: "You are a helpful assistant."},
//			{Role: "user", Content: "Explain quantum computing."},
//		},
//		MaxTokens: igris.Int(200),
//		Temperature: igris.Float64(0.7),
//	})
//	if err != nil {
//		log.Fatal(err)
//	}
//	fmt.Println(response.Choices[0].Message.Content)
func (c *Client) Infer(ctx context.Context, req *InferRequest) (*InferResponse, error) {
	// Check if EscapeVector Mode should be used
	if c.escapeVector != nil && c.escapeVector.ShouldUseEscapeVector() {
		// Use local Thompson Sampling fallback
		evReq := &escapevector.InferRequest{
			Model:       req.Model,
			Messages:    convertMessages(req.Messages),
			MaxTokens:   req.MaxTokens,
			Temperature: req.Temperature,
			TopP:        req.TopP,
		}
		evResp, err := c.escapeVector.Infer(ctx, evReq)
		if err != nil {
			return nil, fmt.Errorf("EscapeVector Mode failed: %w", err)
		}
		return convertEscapeVectorResponse(evResp), nil
	}

	// Normal control plane request
	startTime := time.Now()
	resp, err := c.doRequest(ctx, "POST", "/v1/infer", req)
	latency := time.Since(startTime)

	// Record control plane health
	if c.escapeVector != nil {
		c.escapeVector.RecordControlPlaneRequest(latency, err)
	}

	if err != nil {
		// If EscapeVector available, retry with fallback
		if c.escapeVector != nil && c.escapeVector.ShouldUseEscapeVector() {
			evReq := &escapevector.InferRequest{
				Model:       req.Model,
				Messages:    convertMessages(req.Messages),
				MaxTokens:   req.MaxTokens,
				Temperature: req.Temperature,
				TopP:        req.TopP,
			}
			evResp, evErr := c.escapeVector.Infer(ctx, evReq)
			if evErr == nil {
				return convertEscapeVectorResponse(evResp), nil
			}
		}
		return nil, err
	}

	var result InferResponse
	if err := c.parseResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// convertMessages converts SDK messages to EscapeVector messages
func convertMessages(msgs []Message) []escapevector.Message {
	evMsgs := make([]escapevector.Message, len(msgs))
	for i, msg := range msgs {
		evMsgs[i] = escapevector.Message{
			Role:    msg.Role,
			Content: msg.Content,
		}
	}
	return evMsgs
}

// convertEscapeVectorResponse converts EscapeVector response to SDK response
func convertEscapeVectorResponse(evResp *escapevector.InferResponse) *InferResponse {
	choices := make([]Choice, len(evResp.Choices))
	for i, evChoice := range evResp.Choices {
		choices[i] = Choice{
			Index: evChoice.Index,
			Message: Message{
				Role:    evChoice.Message.Role,
				Content: evChoice.Message.Content,
			},
			FinishReason: evChoice.FinishReason,
		}
	}

	var usage *Usage
	if evResp.Usage != nil {
		usage = &Usage{
			PromptTokens:     evResp.Usage.PromptTokens,
			CompletionTokens: evResp.Usage.CompletionTokens,
			TotalTokens:      evResp.Usage.TotalTokens,
		}
	}

	return &InferResponse{
		ID:      evResp.ID,
		Object:  evResp.Object,
		Created: evResp.Created,
		Model:   evResp.Model,
		Choices: choices,
		Usage:   usage,
	}
}

// ListModels lists all available models.
//
// Example:
//
//	ctx := context.Background()
//	models, err := client.ListModels(ctx)
//	if err != nil {
//		log.Fatal(err)
//	}
//	for _, model := range models.Data {
//		fmt.Println(model.ID)
//	}
func (c *Client) ListModels(ctx context.Context) (*ModelsResponse, error) {
	resp, err := c.doRequest(ctx, "GET", "/v1/models", nil)
	if err != nil {
		return nil, err
	}

	var result ModelsResponse
	if err := c.parseResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// Health checks the API health status.
//
// Example:
//
//	ctx := context.Background()
//	health, err := client.Health(ctx)
//	if err != nil {
//		log.Fatal(err)
//	}
//	if health.Status == "healthy" {
//		fmt.Println("API is operational")
//	}
func (c *Client) Health(ctx context.Context) (*HealthResponse, error) {
	resp, err := c.doRequest(ctx, "GET", "/v1/health", nil)
	if err != nil {
		return nil, err
	}

	var result HealthResponse
	if err := c.parseResponse(resp, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// ProviderStats returns provider statistics.
//
// Example:
//
//	ctx := context.Background()
//	stats, err := client.ProviderStats(ctx)
//	if err != nil {
//		log.Fatal(err)
//	}
//	fmt.Printf("Stats: %+v\n", stats)
func (c *Client) ProviderStats(ctx context.Context) (ProviderStats, error) {
	resp, err := c.doRequest(ctx, "GET", "/v1/providers/stats", nil)
	if err != nil {
		return nil, err
	}

	var result ProviderStats
	if err := c.parseResponse(resp, &result); err != nil {
		return nil, err
	}

	return result, nil
}

// Helper functions for creating pointers to basic types

// Int returns a pointer to the int value passed in.
func Int(v int) *int {
	return &v
}

// Float64 returns a pointer to the float64 value passed in.
func Float64(v float64) *float64 {
	return &v
}
