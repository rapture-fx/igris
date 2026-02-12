package openai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/Igris-inertial/system/igris-overture/metrics"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/providers"
)

// OpenAIProvider implements the Provider interface for OpenAI API
type OpenAIProvider struct {
	config       *providers.ProviderConfig
	capabilities *providers.ProviderCapabilities
	client       *http.Client
	rateLimiter  *RateLimiter
}

// NewOpenAIProvider creates a new OpenAI provider instance
func NewOpenAIProvider(config *providers.ProviderConfig) (*OpenAIProvider, error) {
	if config.APIKey == "" {
		return nil, fmt.Errorf("OpenAI API key is required")
	}

	if config.BaseURL == "" {
		config.BaseURL = "https://api.openai.com/v1"
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

	provider := &OpenAIProvider{
		config:       config,
		capabilities: getOpenAICapabilities(),
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
func (p *OpenAIProvider) Name() string {
	return "openai"
}

// Infer performs a single inference request
func (p *OpenAIProvider) Infer(ctx context.Context, req *models.InferRequest) (*models.InferResponse, error) {
	startTime := time.Now()

	// Estimate tokens for rate limiting
	estimatedTokens := estimatePromptTokens(req)
	if req.MaxTokens > 0 {
		estimatedTokens += req.MaxTokens
	}

	var response *models.InferResponse

	// Execute with rate limiting and retry
	err := p.rateLimiter.ExecuteWithRetry(ctx, estimatedTokens, func() (bool, error) {
		// Convert to OpenAI format
		openaiReq := p.buildOpenAIRequest(req)

		// Marshal request
		reqBody, err := json.Marshal(openaiReq)
		if err != nil {
			return false, fmt.Errorf("failed to marshal request: %w", err)
		}

		// Create HTTP request
		httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/chat/completions", bytes.NewBuffer(reqBody))
		if err != nil {
			return false, fmt.Errorf("failed to create request: %w", err)
		}

		// Set headers
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+p.config.APIKey)

		// Execute request
		resp, err := p.client.Do(httpReq)
		if err != nil {
			return false, fmt.Errorf("request failed: %w", err)
		}
		defer resp.Body.Close()

		// Read response body
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return false, fmt.Errorf("failed to read response: %w", err)
		}

		// Check for rate limit error (HTTP 429)
		if resp.StatusCode == http.StatusTooManyRequests {
			var errResp OpenAIErrorResponse
			if err := json.Unmarshal(body, &errResp); err == nil && errResp.Error.Message != "" {
				return true, fmt.Errorf("rate limit exceeded: %s", errResp.Error.Message)
			}
			return true, fmt.Errorf("rate limit exceeded (status 429)")
		}

		// Handle other error responses
		if resp.StatusCode != http.StatusOK {
			var errResp OpenAIErrorResponse
			if err := json.Unmarshal(body, &errResp); err == nil && errResp.Error.Message != "" {
				return false, fmt.Errorf("OpenAI API error (status %d): %s", resp.StatusCode, errResp.Error.Message)
			}
			return false, fmt.Errorf("OpenAI API error (status %d): %s", resp.StatusCode, string(body))
		}

		// Parse success response
		var openaiResp OpenAIChatCompletionResponse
		if err := json.Unmarshal(body, &openaiResp); err != nil {
			return false, fmt.Errorf("failed to parse response: %w", err)
		}

		// Convert to unified format
		response = p.convertToInferResponse(&openaiResp, req.Model)
		response.CalculateLatency(startTime)
		response.Metadata.CostUSD = p.calculateCost(response.Usage, openaiResp.Model)

		return false, nil // Success, not a rate limit
	})

	if err != nil {
		return nil, err
	}

	return response, nil
}

// InferStream performs streaming inference
func (p *OpenAIProvider) InferStream(ctx context.Context, req *models.InferRequest) (<-chan *models.StreamChunk, <-chan error) {
	chunkChan := make(chan *models.StreamChunk, 10)
	errChan := make(chan error, 1)

	go func() {
		defer close(chunkChan)
		defer close(errChan)

		// Convert to OpenAI format with streaming enabled
		openaiReq := p.buildOpenAIRequest(req)
		openaiReq.Stream = true

		// Marshal request
		reqBody, err := json.Marshal(openaiReq)
		if err != nil {
			errChan <- fmt.Errorf("failed to marshal streaming request: %w", err)
			return
		}

		// Create HTTP request
		httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/chat/completions", bytes.NewBuffer(reqBody))
		if err != nil {
			errChan <- fmt.Errorf("failed to create streaming request: %w", err)
			return
		}

		// Set headers for SSE streaming
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+p.config.APIKey)
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
			errChan <- fmt.Errorf("OpenAI streaming error (status %d): %s", resp.StatusCode, string(body))
			return
		}

		// Parse SSE stream
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

			// SSE format: "data: {json}\n\n"
			if len(line) > 6 && line[:6] == "data: " {
				data := line[6:]

				// Check for stream termination
				if data == "[DONE]" || data == "[DONE]\n\n" {
					return
				}

				// Parse JSON chunk
				var streamResp OpenAIStreamResponse
				if err := json.Unmarshal([]byte(data), &streamResp); err != nil {
					// Skip malformed chunks but don't fail
					continue
				}

				// Extract request ID from first chunk
				if requestID == "" && streamResp.ID != "" {
					requestID = streamResp.ID
				}

				// Process choices
				if len(streamResp.Choices) > 0 {
					delta := streamResp.Choices[0].Delta
					finishReason := streamResp.Choices[0].FinishReason

					chunk := models.NewStreamChunk(
						requestID,
						req.Model,
						delta.Content,
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
			}
		}
	}()

	return chunkChan, errChan
}

// HealthCheck verifies provider availability
func (p *OpenAIProvider) HealthCheck(ctx context.Context) error {
	// Make a lightweight API call to verify connectivity and API key validity
	// Using the models endpoint as it's a simple GET request
	httpReq, err := http.NewRequestWithContext(ctx, "GET", p.config.BaseURL+"/models", nil)
	if err != nil {
		return fmt.Errorf("failed to create health check request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Bearer "+p.config.APIKey)

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("health check request failed: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("invalid API key (401 Unauthorized)")
	}

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("health check failed (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// GetCapabilities returns provider capabilities
func (p *OpenAIProvider) GetCapabilities() *providers.ProviderCapabilities {
	return p.capabilities
}

// EstimateCost estimates the cost for a given request
func (p *OpenAIProvider) EstimateCost(req *models.InferRequest) (float64, error) {
	// Get model-specific pricing
	pricing := getModelPricing(req.Model)

	// Estimate token counts
	promptTokens := estimatePromptTokens(req)
	maxCompletionTokens := req.MaxTokens
	if maxCompletionTokens == 0 {
		maxCompletionTokens = 150 // Default
	}

	// Calculate estimated cost
	promptCost := float64(promptTokens) * pricing.PromptPrice / 1000000.0
	completionCost := float64(maxCompletionTokens) * pricing.CompletionPrice / 1000000.0

	return promptCost + completionCost, nil
}

// Close releases provider resources
func (p *OpenAIProvider) Close() error {
	// Close the rate limiter
	if p.rateLimiter != nil {
		p.rateLimiter.Close()
	}

	// Close idle connections in the HTTP client
	if p.client != nil {
		p.client.CloseIdleConnections()
	}
	return nil
}

// GetRateLimiterMetrics returns current rate limiter metrics
func (p *OpenAIProvider) GetRateLimiterMetrics() RateLimiterMetrics {
	if p.rateLimiter != nil {
		return p.rateLimiter.GetMetrics()
	}
	return RateLimiterMetrics{}
}

// getOpenAICapabilities returns OpenAI provider capabilities
func getOpenAICapabilities() *providers.ProviderCapabilities {
	return &providers.ProviderCapabilities{
		Models: []string{
			"gpt-4", "gpt-4-turbo", "gpt-4-turbo-preview",
			"gpt-3.5-turbo", "gpt-3.5-turbo-16k",
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
		MaxContextWindow:         128000, // GPT-4 Turbo
		RateLimitRPM:             500,
		RateLimitTPM:             150000,
		AverageLatencyMs:         800,
		ReliabilityScore:         0.98,
		CostPerToken:             0.00001,
	}
}

// Helper functions

func generateRequestID() string {
	return fmt.Sprintf("chatcmpl-%d", time.Now().UnixNano())
}

func estimatePromptTokens(req *models.InferRequest) int {
	// TODO: Implement accurate token counting
	// Use tiktoken library or similar

	// STUB: Rough estimate (1 token ≈ 4 characters)
	totalChars := 0
	for _, msg := range req.Messages {
		totalChars += len(msg.GetTextContent())
	}
	return totalChars / 4
}

func (p *OpenAIProvider) calculateCost(usage *models.UsageStats, model string) float64 {
	if usage == nil {
		return 0.0
	}

	// Get model-specific pricing (prices per 1M tokens as of January 2025)
	pricing := getModelPricing(model)

	promptCost := float64(usage.PromptTokens) * pricing.PromptPrice / 1000000.0
	completionCost := float64(usage.CompletionTokens) * pricing.CompletionPrice / 1000000.0

	return promptCost + completionCost
}

// ModelPricing represents pricing for a model
type ModelPricing struct {
	PromptPrice     float64 // Price per 1M prompt tokens
	CompletionPrice float64 // Price per 1M completion tokens
}

// getModelPricing returns pricing based on model name
// Prices as of January 2025
func getModelPricing(model string) ModelPricing {
	switch model {
	case "gpt-4", "gpt-4-0613":
		return ModelPricing{
			PromptPrice:     30.0,  // $30/1M tokens
			CompletionPrice: 60.0,  // $60/1M tokens
		}
	case "gpt-4-turbo", "gpt-4-turbo-preview", "gpt-4-1106-preview", "gpt-4-0125-preview":
		return ModelPricing{
			PromptPrice:     10.0,  // $10/1M tokens
			CompletionPrice: 30.0,  // $30/1M tokens
		}
	case "gpt-3.5-turbo", "gpt-3.5-turbo-0125", "gpt-3.5-turbo-1106":
		return ModelPricing{
			PromptPrice:     0.5,   // $0.50/1M tokens
			CompletionPrice: 1.5,   // $1.50/1M tokens
		}
	case "gpt-3.5-turbo-16k":
		return ModelPricing{
			PromptPrice:     3.0,   // $3/1M tokens
			CompletionPrice: 4.0,   // $4/1M tokens
		}
	default:
		// Default to GPT-3.5 Turbo pricing for unknown models
		return ModelPricing{
			PromptPrice:     0.5,
			CompletionPrice: 1.5,
		}
	}
}

// OpenAI API request/response types

type OpenAIChatCompletionRequest struct {
	Model            string                   `json:"model"`
	Messages         []OpenAIMessage          `json:"messages"`
	MaxTokens        int                      `json:"max_tokens,omitempty"`
	Temperature      float64                  `json:"temperature,omitempty"`
	TopP             float64                  `json:"top_p,omitempty"`
	N                int                      `json:"n,omitempty"`
	Stream           bool                     `json:"stream,omitempty"`
	Stop             []string                 `json:"stop,omitempty"`
	PresencePenalty  float64                  `json:"presence_penalty,omitempty"`
	FrequencyPenalty float64                  `json:"frequency_penalty,omitempty"`
	User             string                   `json:"user,omitempty"`
}

type OpenAIMessage struct {
	Role    string      `json:"role"`
	Content interface{} `json:"content"` // string or []OpenAIContentPart for vision
}

// OpenAIContentPart represents a content part in OpenAI's multimodal format
type OpenAIContentPart struct {
	Type     string          `json:"type"`                // "text" or "image_url"
	Text     string          `json:"text,omitempty"`      // For type "text"
	ImageURL *OpenAIImageURL `json:"image_url,omitempty"` // For type "image_url"
}

// OpenAIImageURL represents an image URL in OpenAI format
type OpenAIImageURL struct {
	URL    string `json:"url"`
	Detail string `json:"detail,omitempty"` // "auto", "low", "high"
}

type OpenAIChatCompletionResponse struct {
	ID      string                `json:"id"`
	Object  string                `json:"object"`
	Created int64                 `json:"created"`
	Model   string                `json:"model"`
	Choices []OpenAIChoice        `json:"choices"`
	Usage   OpenAIUsage           `json:"usage"`
}

type OpenAIChoice struct {
	Index        int           `json:"index"`
	Message      OpenAIMessage `json:"message"`
	FinishReason string        `json:"finish_reason"`
}

type OpenAIUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type OpenAIErrorResponse struct {
	Error struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    string `json:"code"`
	} `json:"error"`
}

// OpenAI streaming response types
type OpenAIStreamResponse struct {
	ID      string                  `json:"id"`
	Object  string                  `json:"object"`
	Created int64                   `json:"created"`
	Model   string                  `json:"model"`
	Choices []OpenAIStreamChoice    `json:"choices"`
}

type OpenAIStreamChoice struct {
	Index        int                `json:"index"`
	Delta        OpenAIMessageDelta `json:"delta"`
	FinishReason string             `json:"finish_reason"`
}

type OpenAIMessageDelta struct {
	Role    string `json:"role,omitempty"`
	Content string `json:"content,omitempty"`
}

// buildOpenAIRequest converts unified request to OpenAI format
func (p *OpenAIProvider) buildOpenAIRequest(req *models.InferRequest) *OpenAIChatCompletionRequest {
	openaiReq := &OpenAIChatCompletionRequest{
		Model:            req.Model,
		Messages:         make([]OpenAIMessage, len(req.Messages)),
		Stream:           req.Stream,
		MaxTokens:        req.MaxTokens,
		Temperature:      req.Temperature,
		TopP:             req.TopP,
		Stop:             req.Stop,
		PresencePenalty:  req.PresencePenalty,
		FrequencyPenalty: req.FrequencyPenalty,
		N:                1,
	}

	// Convert messages
	for i, msg := range req.Messages {
		if msg.IsMultimodal() {
			// Build multimodal content parts for vision
			parts := make([]OpenAIContentPart, 0, len(msg.ContentParts))
			for _, part := range msg.ContentParts {
				switch part.Type {
				case "text":
					parts = append(parts, OpenAIContentPart{
						Type: "text",
						Text: part.Text,
					})
				case "image_url":
					if part.ImageURL != nil {
						parts = append(parts, OpenAIContentPart{
							Type: "image_url",
							ImageURL: &OpenAIImageURL{
								URL:    part.ImageURL.URL,
								Detail: part.ImageURL.Detail,
							},
						})
					}
				}
			}
			openaiReq.Messages[i] = OpenAIMessage{
				Role:    msg.Role,
				Content: parts,
			}
		} else {
			openaiReq.Messages[i] = OpenAIMessage{
				Role:    msg.Role,
				Content: msg.Content,
			}
		}
	}

	return openaiReq
}

// convertToInferResponse converts OpenAI response to unified format
func (p *OpenAIProvider) convertToInferResponse(openaiResp *OpenAIChatCompletionResponse, model string) *models.InferResponse {
	response := models.NewInferResponse(openaiResp.ID, model)

	// Convert choices
	if len(openaiResp.Choices) > 0 {
		choice := openaiResp.Choices[0]
		// Extract string content from interface{} (responses are always text)
		content := ""
		switch v := choice.Message.Content.(type) {
		case string:
			content = v
		}
		response.AddChoice(choice.Index, &models.Message{
			Role:    choice.Message.Role,
			Content: content,
		}, choice.FinishReason)
	}

	// Set usage
	response.SetUsage(
		openaiResp.Usage.PromptTokens,
		openaiResp.Usage.CompletionTokens,
	)

	// Set metadata
	response.Metadata.Provider = "openai"
	response.Metadata.ModelUsed = openaiResp.Model
	response.Created = openaiResp.Created

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
func (p *OpenAIProvider) updateMetricsLoop() {
	ticker := time.NewTicker(5 * time.Second) // Update every 5 seconds
	defer ticker.Stop()

	for range ticker.C {
		if p.rateLimiter == nil {
			return
		}

		// Get current metrics from rate limiter
		rlMetrics := p.rateLimiter.GetMetrics()

		// Update Prometheus metrics
		metrics.UpdateQueueLength("openai", rlMetrics.QueueLength)
		metrics.UpdateRateLimiterTokens("openai", rlMetrics.RequestTokens, rlMetrics.TokenBudget)

		// Record queue wait time if there are queued requests
		if rlMetrics.QueueWaitTimeMs > 0 {
			metrics.RecordQueueWait("openai", rlMetrics.QueueWaitTimeMs)
		}
	}
}
