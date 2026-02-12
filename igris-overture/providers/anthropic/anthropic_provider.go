package anthropic

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/Igris-inertial/system/igris-overture/metrics"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// AnthropicProvider implements the Provider interface for Anthropic API
type AnthropicProvider struct {
	config       *providers.ProviderConfig
	capabilities *providers.ProviderCapabilities
	client       *http.Client
	rateLimiter  *RateLimiter
}

// NewAnthropicProvider creates a new Anthropic provider instance
func NewAnthropicProvider(config *providers.ProviderConfig) (*AnthropicProvider, error) {
	if config.APIKey == "" {
		return nil, fmt.Errorf("Anthropic API key is required")
	}

	if config.BaseURL == "" {
		config.BaseURL = "https://api.anthropic.com/v1"
	}

	// Initialize HTTP client with timeout
	timeout := time.Duration(config.Timeout) * time.Second
	if timeout == 0 {
		timeout = 60 * time.Second // Default 60s timeout
	}

	httpClient := &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 10,
			IdleConnTimeout:     90 * time.Second,
		},
	}

	// Initialize rate limiter with config from Custom map or defaults
	rateLimiterConfig := extractRateLimiterConfig(config.Custom)
	rateLimiter := NewRateLimiter(rateLimiterConfig)

	provider := &AnthropicProvider{
		config:       config,
		capabilities: getAnthropicCapabilities(),
		client:       httpClient,
		rateLimiter:  rateLimiter,
	}

	// Start periodic metrics updater if metrics enabled
	if config.EnableMetrics {
		go provider.updateMetricsLoop()
	}

	return provider, nil
}

// Name returns the provider identifier
func (p *AnthropicProvider) Name() string {
	return "anthropic"
}

// Infer performs a single inference request
func (p *AnthropicProvider) Infer(ctx context.Context, req *models.InferRequest) (*models.InferResponse, error) {
	startTime := time.Now()

	// Convert to Anthropic format
	anthropicReq := p.buildAnthropicRequest(req)

	// Marshal request
	reqBody, err := json.Marshal(anthropicReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/messages", bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set Anthropic-specific headers
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", p.config.APIKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01") // Required by Anthropic API

	// Estimate tokens for rate limiting (use max_tokens as upper bound)
	estimatedTokens := req.MaxTokens
	if estimatedTokens == 0 {
		estimatedTokens = 1000 // Default estimate
	}

	// Execute request with rate-limit-aware retry logic
	var resp *http.Response
	var body []byte
	err = p.rateLimiter.ExecuteWithRetry(ctx, estimatedTokens, func() (bool, error) {
		// Execute HTTP request
		var execErr error
		resp, execErr = p.client.Do(httpReq)
		if execErr != nil {
			// Network error - not a rate limit
			return false, execErr
		}

		// Read response body
		body, execErr = io.ReadAll(resp.Body)
		resp.Body.Close()
		if execErr != nil {
			return false, fmt.Errorf("failed to read response: %w", execErr)
		}

		// Check for rate limit (HTTP 429)
		if resp.StatusCode == http.StatusTooManyRequests {
			metrics.RecordRateLimitHit("anthropic")
			metrics.RecordRetryAttempt("anthropic", "rate_limit")
			return true, fmt.Errorf("rate limit exceeded (429)")
		}

		// Check for server errors (5xx) - retryable but not rate limit
		if resp.StatusCode >= 500 {
			metrics.RecordRetryAttempt("anthropic", "server_error")
			return false, fmt.Errorf("server error (status %d)", resp.StatusCode)
		}

		// Success or client error
		return false, nil
	})

	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	// Handle error responses (body already read in ExecuteWithRetry)
	if resp.StatusCode != http.StatusOK {
		var errResp AnthropicErrorResponse
		if err := json.Unmarshal(body, &errResp); err == nil && errResp.Error.Message != "" {
			return nil, fmt.Errorf("Anthropic API error (status %d): %s", resp.StatusCode, errResp.Error.Message)
		}
		return nil, fmt.Errorf("Anthropic API error (status %d): %s", resp.StatusCode, string(body))
	}

	// Parse success response
	var anthropicResp AnthropicMessageResponse
	if err := json.Unmarshal(body, &anthropicResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Convert to unified format
	response := p.convertToInferResponse(&anthropicResp, req.Model)
	response.CalculateLatency(startTime)
	response.Metadata.CostUSD = p.calculateCost(response.Usage, req.Model)

	return response, nil
}

// InferStream performs streaming inference
func (p *AnthropicProvider) InferStream(ctx context.Context, req *models.InferRequest) (<-chan *models.StreamChunk, <-chan error) {
	chunkChan := make(chan *models.StreamChunk, 10)
	errChan := make(chan error, 1)

	go func() {
		defer close(chunkChan)
		defer close(errChan)

		// Convert to Anthropic format with streaming enabled
		anthropicReq := p.buildAnthropicRequest(req)
		anthropicReq.Stream = true

		// Marshal request
		reqBody, err := json.Marshal(anthropicReq)
		if err != nil {
			errChan <- fmt.Errorf("failed to marshal streaming request: %w", err)
			return
		}

		// Create HTTP request
		httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/messages", bytes.NewBuffer(reqBody))
		if err != nil {
			errChan <- fmt.Errorf("failed to create streaming request: %w", err)
			return
		}

		// Set Anthropic-specific headers for streaming
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("x-api-key", p.config.APIKey)
		httpReq.Header.Set("anthropic-version", "2023-06-01")
		httpReq.Header.Set("Accept", "text/event-stream")

		// Execute streaming request
		resp, err := p.client.Do(httpReq)
		if err != nil {
			errChan <- fmt.Errorf("streaming request failed: %w", err)
			return
		}
		defer resp.Body.Close()

		// Handle non-200 responses
		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			errChan <- fmt.Errorf("Anthropic streaming error (status %d): %s", resp.StatusCode, string(body))
			return
		}

		// Parse SSE stream (Anthropic format)
		buffer := make([]byte, 4096)
		var requestID string

		for {
			// Check context cancellation
			select {
			case <-ctx.Done():
				errChan <- ctx.Err()
				return
			default:
			}

			// Read line from stream
			n, err := resp.Body.Read(buffer)
			if err != nil {
				if err == io.EOF {
					return // Stream ended normally
				}
				errChan <- fmt.Errorf("error reading stream: %w", err)
				return
			}

			line := string(buffer[:n])

			// Anthropic SSE format: "event: {type}\ndata: {json}\n\n"
			if len(line) > 6 && line[:6] == "data: " {
				data := line[6:]

				// Parse JSON event
				var streamEvent AnthropicStreamEvent
				if err := json.Unmarshal([]byte(data), &streamEvent); err != nil {
					// Skip malformed chunks
					continue
				}

				// Handle different event types
				switch streamEvent.Type {
				case "message_start":
					// Extract request ID
					if streamEvent.Message.ID != "" {
						requestID = streamEvent.Message.ID
					}

				case "content_block_delta":
					// Content delta contains the actual text
					if streamEvent.Delta.Type == "text_delta" {
						chunk := models.NewStreamChunk(
							requestID,
							req.Model,
							streamEvent.Delta.Text,
							streamEvent.Index,
							"",
						)
						// Send chunk with context cancellation check to prevent goroutine leak
						select {
						case chunkChan <- chunk:
							// Successfully sent
						case <-ctx.Done():
							errChan <- ctx.Err()
							return
						}
					}

				case "message_delta":
					// Message delta might contain stop reason
					finishReason := ""
					if streamEvent.Delta.StopReason != "" {
						finishReason = streamEvent.Delta.StopReason
					}
					if finishReason != "" {
						chunk := models.NewStreamChunk(
							requestID,
							req.Model,
							"",
							0,
							finishReason,
						)
						// Send chunk with context cancellation check to prevent goroutine leak
						select {
						case chunkChan <- chunk:
							// Successfully sent
						case <-ctx.Done():
							errChan <- ctx.Err()
							return
						}
					}

				case "message_stop":
					// Stream completed
					return
				}
			}
		}
	}()

	return chunkChan, errChan
}

// HealthCheck verifies provider availability
func (p *AnthropicProvider) HealthCheck(ctx context.Context) error {
	// Anthropic doesn't have a dedicated health endpoint like OpenAI's /models
	// We'll make a minimal messages API call to verify API key and connectivity

	// Create minimal request
	minimalReq := &AnthropicMessageRequest{
		Model:     "claude-3-haiku-20240307", // Use cheapest model for health check
		Messages:  []AnthropicMessage{{Role: "user", Content: "Hi"}},
		MaxTokens: 10, // Minimal tokens
	}

	reqBody, err := json.Marshal(minimalReq)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/messages", bytes.NewBuffer(reqBody))
	if err != nil {
		return fmt.Errorf("failed to create health check HTTP request: %w", err)
	}

	// Set headers
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", p.config.APIKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("health check request failed: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("invalid API key (status %d)", resp.StatusCode)
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("health check failed (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// GetCapabilities returns provider capabilities
func (p *AnthropicProvider) GetCapabilities() *providers.ProviderCapabilities {
	return p.capabilities
}

// EstimateCost estimates the cost for a given request
func (p *AnthropicProvider) EstimateCost(req *models.InferRequest) (float64, error) {
	// Get model-specific pricing
	pricing := getClaudeModelPricing(req.Model)

	// Estimate token counts
	promptTokens := estimatePromptTokens(req)
	maxCompletionTokens := req.MaxTokens
	if maxCompletionTokens == 0 {
		maxCompletionTokens = 200 // Default
	}

	// Calculate estimated cost
	inputCost := float64(promptTokens) * pricing.InputPrice / 1000000.0
	outputCost := float64(maxCompletionTokens) * pricing.OutputPrice / 1000000.0

	return inputCost + outputCost, nil
}

// Close releases provider resources
func (p *AnthropicProvider) Close() error {
	// Close idle connections in the HTTP client
	if p.client != nil {
		p.client.CloseIdleConnections()
	}
	// Close rate limiter
	if p.rateLimiter != nil {
		p.rateLimiter.Close()
	}
	return nil
}

// getAnthropicCapabilities returns Anthropic provider capabilities
func getAnthropicCapabilities() *providers.ProviderCapabilities {
	return &providers.ProviderCapabilities{
		Models: []string{
			"claude-3-opus-20240229",
			"claude-3-sonnet-20240229",
			"claude-3-haiku-20240307",
			"claude-2.1",
			"claude-2.0",
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
		RateLimitRPM:             1000,
		RateLimitTPM:             400000,
		AverageLatencyMs:         1000,
		ReliabilityScore:         0.97,
		CostPerToken:             0.000003, // Sonnet input pricing
	}
}

// Helper functions

func generateRequestID() string {
	return fmt.Sprintf("msg-%d", time.Now().UnixNano())
}

func estimatePromptTokens(req *models.InferRequest) int {
	// TODO: Implement accurate token counting for Anthropic
	// Anthropic uses a different tokenizer than OpenAI
	// Should use Anthropic's token counting API or library

	// STUB: Rough estimate (1 token ≈ 4 characters)
	totalChars := 0
	for _, msg := range req.Messages {
		totalChars += len(msg.GetTextContent())
	}
	return totalChars / 4
}

func (p *AnthropicProvider) calculateCost(usage *models.UsageStats, model string) float64 {
	if usage == nil {
		return 0.0
	}

	// Get model-specific pricing (prices per 1M tokens as of January 2025)
	pricing := getClaudeModelPricing(model)

	inputCost := float64(usage.PromptTokens) * pricing.InputPrice / 1000000.0
	outputCost := float64(usage.CompletionTokens) * pricing.OutputPrice / 1000000.0

	return inputCost + outputCost
}

// ClaudeModelPricing represents pricing for a Claude model
type ClaudeModelPricing struct {
	InputPrice  float64 // Price per 1M input tokens
	OutputPrice float64 // Price per 1M output tokens
}

// getClaudeModelPricing returns pricing based on model name
// Prices as of January 2025
func getClaudeModelPricing(model string) ClaudeModelPricing {
	switch {
	case model == "claude-3-opus-20240229" || model == "claude-3-opus":
		return ClaudeModelPricing{
			InputPrice:  15.0,  // $15/1M tokens
			OutputPrice: 75.0,  // $75/1M tokens
		}
	case model == "claude-3-sonnet-20240229" || model == "claude-3-sonnet" || model == "claude-3.5-sonnet" || model == "claude-3-5-sonnet-20240620":
		return ClaudeModelPricing{
			InputPrice:  3.0,   // $3/1M tokens
			OutputPrice: 15.0,  // $15/1M tokens
		}
	case model == "claude-3-haiku-20240307" || model == "claude-3-haiku":
		return ClaudeModelPricing{
			InputPrice:  0.25,  // $0.25/1M tokens
			OutputPrice: 1.25,  // $1.25/1M tokens
		}
	case model == "claude-2.1" || model == "claude-2.0":
		return ClaudeModelPricing{
			InputPrice:  8.0,   // $8/1M tokens
			OutputPrice: 24.0,  // $24/1M tokens
		}
	default:
		// Default to Sonnet pricing for unknown models
		return ClaudeModelPricing{
			InputPrice:  3.0,
			OutputPrice: 15.0,
		}
	}
}

// Anthropic API request/response types

type AnthropicMessageRequest struct {
	Model       string             `json:"model"`
	Messages    []AnthropicMessage `json:"messages"`
	MaxTokens   int                `json:"max_tokens"`
	System      string             `json:"system,omitempty"`
	Temperature float64            `json:"temperature,omitempty"`
	TopP        float64            `json:"top_p,omitempty"`
	TopK        int                `json:"top_k,omitempty"`
	Stream      bool               `json:"stream,omitempty"`
	StopSequences []string         `json:"stop_sequences,omitempty"`
}

type AnthropicMessage struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"` // string or []AnthropicContentBlock for vision
}

// AnthropicContentBlock represents a content block in Anthropic's multimodal format
type AnthropicContentBlock struct {
	Type   string                `json:"type"`             // "text" or "image"
	Text   string                `json:"text,omitempty"`   // For type "text"
	Source *AnthropicImageSource `json:"source,omitempty"` // For type "image"
}

// AnthropicImageSource represents an image source in Anthropic format
type AnthropicImageSource struct {
	Type      string `json:"type"`       // "base64" or "url"
	MediaType string `json:"media_type"` // "image/jpeg", "image/png", etc.
	Data      string `json:"data"`       // base64-encoded data or URL
}

type AnthropicMessageResponse struct {
	ID           string                `json:"id"`
	Type         string                `json:"type"`
	Role         string                `json:"role"`
	Content      []AnthropicContent    `json:"content"`
	Model        string                `json:"model"`
	StopReason   string                `json:"stop_reason"`
	Usage        AnthropicUsage        `json:"usage"`
}

type AnthropicContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type AnthropicUsage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

type AnthropicErrorResponse struct {
	Type  string `json:"type"`
	Error struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error"`
}

// Anthropic streaming event types
type AnthropicStreamEvent struct {
	Type    string                    `json:"type"`
	Index   int                       `json:"index,omitempty"`
	Message *AnthropicMessageResponse `json:"message,omitempty"`
	Delta   *AnthropicStreamDelta     `json:"delta,omitempty"`
}

type AnthropicStreamDelta struct {
	Type       string `json:"type,omitempty"`
	Text       string `json:"text,omitempty"`
	StopReason string `json:"stop_reason,omitempty"`
}

// buildAnthropicRequest converts unified request to Anthropic format
func (p *AnthropicProvider) buildAnthropicRequest(req *models.InferRequest) *AnthropicMessageRequest {
	anthropicReq := &AnthropicMessageRequest{
		Model:         req.Model,
		Messages:      make([]AnthropicMessage, 0, len(req.Messages)),
		MaxTokens:     req.MaxTokens,
		Temperature:   req.Temperature,
		TopP:          req.TopP,
		TopK:          req.TopK,
		Stream:        req.Stream,
		StopSequences: req.Stop,
	}

	// Default max tokens if not specified
	if anthropicReq.MaxTokens == 0 {
		anthropicReq.MaxTokens = 1024
	}

	// Extract system message and convert messages
	// Anthropic requires system message as separate parameter
	for _, msg := range req.Messages {
		if msg.Role == "system" {
			anthropicReq.System = msg.GetTextContent()
		} else if msg.IsMultimodal() {
			// Build multimodal content blocks for vision
			blocks := make([]AnthropicContentBlock, 0, len(msg.ContentParts))
			for _, part := range msg.ContentParts {
				switch part.Type {
				case "text":
					blocks = append(blocks, AnthropicContentBlock{
						Type: "text",
						Text: part.Text,
					})
				case "image_url":
					if part.ImageURL != nil {
						source := convertToAnthropicImageSource(part.ImageURL.URL)
						blocks = append(blocks, AnthropicContentBlock{
							Type:   "image",
							Source: source,
						})
					}
				}
			}
			anthropicReq.Messages = append(anthropicReq.Messages, AnthropicMessage{
				Role:    msg.Role,
				Content: blocks,
			})
		} else {
			anthropicReq.Messages = append(anthropicReq.Messages, AnthropicMessage{
				Role:    msg.Role,
				Content: msg.Content,
			})
		}
	}

	return anthropicReq
}

// convertToAnthropicImageSource converts an image URL or data URI to Anthropic's format
func convertToAnthropicImageSource(url string) *AnthropicImageSource {
	// Check if it's a base64 data URI: data:image/jpeg;base64,/9j/4AAQ...
	if strings.HasPrefix(url, "data:") {
		parts := strings.SplitN(url, ",", 2)
		if len(parts) == 2 {
			// Extract media type from "data:image/jpeg;base64"
			mediaTypePart := strings.TrimPrefix(parts[0], "data:")
			mediaType := strings.SplitN(mediaTypePart, ";", 2)[0]
			return &AnthropicImageSource{
				Type:      "base64",
				MediaType: mediaType,
				Data:      parts[1],
			}
		}
	}

	// For remote URLs, pass as URL type
	return &AnthropicImageSource{
		Type:      "url",
		MediaType: "image/jpeg",
		Data:      url,
	}
}

// convertToInferResponse converts Anthropic response to unified format
func (p *AnthropicProvider) convertToInferResponse(anthropicResp *AnthropicMessageResponse, model string) *models.InferResponse {
	response := models.NewInferResponse(anthropicResp.ID, model)

	// Convert content blocks to single message
	var content string
	if len(anthropicResp.Content) > 0 {
		for _, block := range anthropicResp.Content {
			if block.Type == "text" {
				content += block.Text
			}
		}
	}

	response.AddChoice(0, &models.Message{
		Role:    anthropicResp.Role,
		Content: content,
	}, anthropicResp.StopReason)

	// Set usage
	response.SetUsage(
		anthropicResp.Usage.InputTokens,
		anthropicResp.Usage.OutputTokens,
	)

	// Set metadata
	response.Metadata.Provider = "anthropic"
	response.Metadata.ModelUsed = anthropicResp.Model

	return response
}

// extractRateLimiterConfig extracts rate limiter config from Custom map or returns defaults
func extractRateLimiterConfig(custom map[string]interface{}) *RateLimiterConfig {
	config := DefaultRateLimiterConfig()

	if custom == nil {
		return config
	}

	// Extract configuration values if present
	if rpm, ok := custom["rate_limit_rpm"].(int); ok {
		config.RequestsPerMinute = rpm
	} else if rpm, ok := custom["rate_limit_rpm"].(float64); ok {
		config.RequestsPerMinute = int(rpm)
	}

	if tpm, ok := custom["rate_limit_tpm"].(int); ok {
		config.TokensPerMinute = tpm
	} else if tpm, ok := custom["rate_limit_tpm"].(float64); ok {
		config.TokensPerMinute = int(tpm)
	}

	if queueSize, ok := custom["rate_limit_queue_size"].(int); ok {
		config.MaxQueueSize = queueSize
	} else if queueSize, ok := custom["rate_limit_queue_size"].(float64); ok {
		config.MaxQueueSize = int(queueSize)
	}

	if backoffMs, ok := custom["rate_limit_backoff_ms"].(int); ok {
		config.BackoffBaseMs = backoffMs
	} else if backoffMs, ok := custom["rate_limit_backoff_ms"].(float64); ok {
		config.BackoffBaseMs = int(backoffMs)
	}

	if maxRetries, ok := custom["rate_limit_max_retries"].(int); ok {
		config.MaxRetries = maxRetries
	} else if maxRetries, ok := custom["rate_limit_max_retries"].(float64); ok {
		config.MaxRetries = int(maxRetries)
	}

	if jitterMs, ok := custom["rate_limit_jitter_ms"].(int); ok {
		config.JitterMaxMs = jitterMs
	} else if jitterMs, ok := custom["rate_limit_jitter_ms"].(float64); ok {
		config.JitterMaxMs = int(jitterMs)
	}

	if enabled, ok := custom["rate_limit_enabled"].(bool); ok {
		config.Enabled = enabled
	}

	return config
}

// updateMetricsLoop periodically updates rate limiter metrics
func (p *AnthropicProvider) updateMetricsLoop() {
	ticker := time.NewTicker(5 * time.Second) // Update every 5 seconds
	defer ticker.Stop()

	for range ticker.C {
		if p.rateLimiter == nil {
			return
		}

		// Get current metrics from rate limiter
		rlMetrics := p.rateLimiter.GetMetrics()

		// Update Prometheus metrics
		metrics.UpdateQueueLength("anthropic", rlMetrics.QueueLength)
		metrics.UpdateRateLimiterTokens("anthropic", rlMetrics.RequestTokens, rlMetrics.TokenBudget)

		// Record queue wait time if there are queued requests
		if rlMetrics.QueueWaitTimeMs > 0 {
			metrics.RecordQueueWait("anthropic", rlMetrics.QueueWaitTimeMs)
		}
	}
}
