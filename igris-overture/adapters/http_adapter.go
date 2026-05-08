// Package adapters provides HTTP adapters for routing to different AI providers
package adapters

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/Igris-inertial/system/igris-overture/logging"
	"github.com/Igris-inertial/system/igris-overture/models"
)

const anthropicVersion = "2023-06-01"

// ChatCompletionRequest represents a standard OpenAI-style chat completion request
type ChatCompletionRequest struct {
	Model            string                 `json:"model"`
	Messages         []ChatMessage          `json:"messages"`
	Temperature      *float64               `json:"temperature,omitempty"`
	MaxTokens        *int                   `json:"max_tokens,omitempty"`
	TopP             *float64               `json:"top_p,omitempty"`
	N                *int                   `json:"n,omitempty"`
	Stream           *bool                  `json:"stream,omitempty"`
	Stop             interface{}            `json:"stop,omitempty"`
	PresencePenalty  *float64               `json:"presence_penalty,omitempty"`
	FrequencyPenalty *float64               `json:"frequency_penalty,omitempty"`
	User             string                 `json:"user,omitempty"`
	Extra            map[string]interface{} `json:"-"` // For provider-specific fields
}

// ChatMessage represents a single message in the conversation
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
	Name    string `json:"name,omitempty"`
}

// ChatCompletionResponse represents a standard OpenAI-style chat completion response
type ChatCompletionResponse struct {
	ID      string                 `json:"id"`
	Object  string                 `json:"object"`
	Created int64                  `json:"created"`
	Model   string                 `json:"model"`
	Choices []ChatCompletionChoice `json:"choices"`
	Usage   ChatCompletionUsage    `json:"usage"`
	Error   *ChatCompletionError   `json:"error,omitempty"`
}

// ChatCompletionChoice represents a completion choice
type ChatCompletionChoice struct {
	Index        int         `json:"index"`
	Message      ChatMessage `json:"message"`
	FinishReason string      `json:"finish_reason"`
}

// ChatCompletionUsage represents token usage information
type ChatCompletionUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type anthropicMessageRequest struct {
	Model       string             `json:"model"`
	System      string             `json:"system,omitempty"`
	Messages    []anthropicMessage `json:"messages"`
	MaxTokens   int                `json:"max_tokens"`
	Temperature *float64           `json:"temperature,omitempty"`
	Stream      bool               `json:"stream"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicMessageResponse struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Role    string `json:"role"`
	Model   string `json:"model"`
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	StopReason string `json:"stop_reason"`
	Usage      struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
	Error *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// ChatCompletionError represents an error response
type ChatCompletionError struct {
	Message string `json:"message"`
	Type    string `json:"type"`
	Code    string `json:"code,omitempty"`
}

// AdapterResult contains the response and metrics from an adapter request
type AdapterResult struct {
	Response   *ChatCompletionResponse
	LatencyMs  int
	StatusCode int
	Success    bool
	Error      error
}

// HTTPAdapter handles requests to OpenAI-compatible APIs
type HTTPAdapter struct {
	httpClient *http.Client
	timeout    time.Duration
	logger     *log.Logger
}

// NewHTTPAdapter creates a new HTTP adapter
func NewHTTPAdapter(timeout time.Duration) *HTTPAdapter {
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	return &HTTPAdapter{
		httpClient: &http.Client{
			Timeout: timeout,
		},
		timeout: timeout,
		logger:  log.Default(),
	}
}

// SendChatCompletion sends a chat completion request to a provider
func (a *HTTPAdapter) SendChatCompletion(
	ctx context.Context,
	provider *models.ProviderRegistry,
	apiKey string,
	request *ChatCompletionRequest,
) *AdapterResult {
	if provider.CompatibilityClass == models.AnthropicCompatible {
		return a.sendAnthropicMessage(ctx, provider, apiKey, request)
	}
	return a.sendOpenAICompatibleChatCompletion(ctx, provider, apiKey, request)
}

func (a *HTTPAdapter) sendOpenAICompatibleChatCompletion(
	ctx context.Context,
	provider *models.ProviderRegistry,
	apiKey string,
	request *ChatCompletionRequest,
) *AdapterResult {
	startTime := time.Now()

	// Build the full URL
	url := fmt.Sprintf("%s/chat/completions", strings.TrimSuffix(provider.BaseURL, "/"))

	// Marshal request to JSON
	requestBody, err := json.Marshal(request)
	if err != nil {
		return &AdapterResult{
			Success:   false,
			Error:     fmt.Errorf("failed to marshal request: %w", err),
			LatencyMs: int(time.Since(startTime).Milliseconds()),
		}
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		return &AdapterResult{
			Success:   false,
			Error:     fmt.Errorf("failed to create request: %w", err),
			LatencyMs: int(time.Since(startTime).Milliseconds()),
		}
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Igris-Inertial/1.0")

	// Set authentication header
	authHeader := strings.Replace(provider.AuthHeaderTemplate, "{key}", apiKey, 1)
	parts := strings.SplitN(authHeader, ":", 2)
	if len(parts) == 2 {
		req.Header.Set(strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]))
	} else {
		a.logger.Printf("[HTTPAdapter] Warning: Invalid auth header template for provider %s (ID: %s)",
			provider.Name, logging.MaskProviderID(provider.ID))
	}

	// Add trace headers (REMOVED x-igris-tenant-id for security - don't leak tenant info to external providers)
	req.Header.Set("x-igris-provider-id", logging.MaskProviderID(provider.ID))

	// Send request
	resp, err := a.httpClient.Do(req)
	if err != nil {
		latencyMs := int(time.Since(startTime).Milliseconds())
		return &AdapterResult{
			Success:   false,
			Error:     fmt.Errorf("request failed: %w", err),
			LatencyMs: latencyMs,
		}
	}
	defer resp.Body.Close()

	latencyMs := int(time.Since(startTime).Milliseconds())
	statusCode := resp.StatusCode

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &AdapterResult{
			Success:    false,
			StatusCode: statusCode,
			Error:      fmt.Errorf("failed to read response: %w", err),
			LatencyMs:  latencyMs,
		}
	}

	// Check for non-2xx status codes
	if statusCode < 200 || statusCode >= 300 {
		// Try to parse error response
		var errorResp ChatCompletionResponse
		if err := json.Unmarshal(body, &errorResp); err == nil && errorResp.Error != nil {
			return &AdapterResult{
				Response:   &errorResp,
				Success:    false,
				StatusCode: statusCode,
				Error:      fmt.Errorf("provider error: %s", errorResp.Error.Message),
				LatencyMs:  latencyMs,
			}
		}

		return &AdapterResult{
			Success:    false,
			StatusCode: statusCode,
			Error:      fmt.Errorf("HTTP %d: %s", statusCode, string(body)),
			LatencyMs:  latencyMs,
		}
	}

	// Parse successful response
	var response ChatCompletionResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return &AdapterResult{
			Success:    false,
			StatusCode: statusCode,
			Error:      fmt.Errorf("failed to parse response: %w", err),
			LatencyMs:  latencyMs,
		}
	}

	a.logger.Printf("[HTTPAdapter] Success: provider=%s, provider_id=%s, model=%s, latency=%dms, tokens=%d",
		provider.Name, logging.MaskProviderID(provider.ID), request.Model, latencyMs, response.Usage.TotalTokens)

	return &AdapterResult{
		Response:   &response,
		Success:    true,
		StatusCode: statusCode,
		LatencyMs:  latencyMs,
	}
}

func (a *HTTPAdapter) sendAnthropicMessage(
	ctx context.Context,
	provider *models.ProviderRegistry,
	apiKey string,
	request *ChatCompletionRequest,
) *AdapterResult {
	startTime := time.Now()
	url := fmt.Sprintf("%s/messages", strings.TrimSuffix(provider.BaseURL, "/"))

	anthropicReq := toAnthropicMessageRequest(request)
	requestBody, err := json.Marshal(anthropicReq)
	if err != nil {
		return &AdapterResult{
			Success:   false,
			Error:     fmt.Errorf("failed to marshal Anthropic request: %w", err),
			LatencyMs: int(time.Since(startTime).Milliseconds()),
		}
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		return &AdapterResult{
			Success:   false,
			Error:     fmt.Errorf("failed to create Anthropic request: %w", err),
			LatencyMs: int(time.Since(startTime).Milliseconds()),
		}
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("anthropic-version", anthropicVersion)
	req.Header.Set("User-Agent", "Igris-Inertial/1.0")

	authHeader := strings.Replace(provider.AuthHeaderTemplate, "{key}", apiKey, 1)
	parts := strings.SplitN(authHeader, ":", 2)
	if len(parts) == 2 {
		req.Header.Set(strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]))
	} else {
		req.Header.Set("x-api-key", apiKey)
	}
	req.Header.Set("x-igris-provider-id", logging.MaskProviderID(provider.ID))

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return &AdapterResult{
			Success:   false,
			Error:     fmt.Errorf("Anthropic request failed: %w", err),
			LatencyMs: int(time.Since(startTime).Milliseconds()),
		}
	}
	defer resp.Body.Close()

	latencyMs := int(time.Since(startTime).Milliseconds())
	statusCode := resp.StatusCode
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return &AdapterResult{
			Success:    false,
			StatusCode: statusCode,
			Error:      fmt.Errorf("failed to read Anthropic response: %w", err),
			LatencyMs:  latencyMs,
		}
	}

	var anthropicResp anthropicMessageResponse
	if err := json.Unmarshal(body, &anthropicResp); err != nil {
		return &AdapterResult{
			Success:    false,
			StatusCode: statusCode,
			Error:      fmt.Errorf("failed to parse Anthropic response: %w", err),
			LatencyMs:  latencyMs,
		}
	}

	if statusCode < 200 || statusCode >= 300 {
		message := string(body)
		errorType := "provider_error"
		if anthropicResp.Error != nil {
			message = anthropicResp.Error.Message
			errorType = anthropicResp.Error.Type
		}
		errorResp := &ChatCompletionResponse{
			Error: &ChatCompletionError{
				Message: message,
				Type:    errorType,
			},
		}
		return &AdapterResult{
			Response:   errorResp,
			Success:    false,
			StatusCode: statusCode,
			Error:      fmt.Errorf("provider error: %s", message),
			LatencyMs:  latencyMs,
		}
	}

	content := ""
	for _, block := range anthropicResp.Content {
		if block.Type == "text" {
			content += block.Text
		}
	}
	response := &ChatCompletionResponse{
		ID:      anthropicResp.ID,
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   anthropicResp.Model,
		Choices: []ChatCompletionChoice{
			{
				Index: 0,
				Message: ChatMessage{
					Role:    "assistant",
					Content: content,
				},
				FinishReason: normalizeAnthropicStopReason(anthropicResp.StopReason),
			},
		},
		Usage: ChatCompletionUsage{
			PromptTokens:     anthropicResp.Usage.InputTokens,
			CompletionTokens: anthropicResp.Usage.OutputTokens,
			TotalTokens:      anthropicResp.Usage.InputTokens + anthropicResp.Usage.OutputTokens,
		},
	}

	a.logger.Printf("[HTTPAdapter] Success: provider=%s, provider_id=%s, model=%s, latency=%dms, tokens=%d",
		provider.Name, logging.MaskProviderID(provider.ID), request.Model, latencyMs, response.Usage.TotalTokens)

	return &AdapterResult{
		Response:   response,
		Success:    true,
		StatusCode: statusCode,
		LatencyMs:  latencyMs,
	}
}

func toAnthropicMessageRequest(request *ChatCompletionRequest) anthropicMessageRequest {
	messages := make([]anthropicMessage, 0, len(request.Messages))
	var systemParts []string
	for _, message := range request.Messages {
		switch message.Role {
		case "system":
			systemParts = append(systemParts, message.Content)
		case "assistant":
			messages = append(messages, anthropicMessage{Role: "assistant", Content: message.Content})
		default:
			messages = append(messages, anthropicMessage{Role: "user", Content: message.Content})
		}
	}

	maxTokens := 512
	if request.MaxTokens != nil && *request.MaxTokens > 0 {
		maxTokens = *request.MaxTokens
	}
	stream := false

	return anthropicMessageRequest{
		Model:       request.Model,
		System:      strings.Join(systemParts, "\n\n"),
		Messages:    messages,
		MaxTokens:   maxTokens,
		Temperature: request.Temperature,
		Stream:      stream,
	}
}

func normalizeAnthropicStopReason(reason string) string {
	switch reason {
	case "end_turn":
		return "stop"
	case "max_tokens":
		return "length"
	case "":
		return "stop"
	default:
		return reason
	}
}

// EstimateCost estimates the cost of a request based on provider pricing
func (a *HTTPAdapter) EstimateCost(provider *models.ProviderRegistry, tokensIn, tokensOut int) float64 {
	inputCost := float64(tokensIn) * provider.Pricing.Input
	outputCost := float64(tokensOut) * provider.Pricing.Output
	return inputCost + outputCost
}

// ValidateRequest validates a chat completion request
func ValidateRequest(request *ChatCompletionRequest) error {
	if request.Model == "" {
		return fmt.Errorf("model is required")
	}

	if len(request.Messages) == 0 {
		return fmt.Errorf("messages array cannot be empty")
	}

	// Validate messages
	for i, msg := range request.Messages {
		if msg.Role == "" {
			return fmt.Errorf("message[%d].role is required", i)
		}
		if msg.Content == "" {
			return fmt.Errorf("message[%d].content is required", i)
		}
		// Validate role
		validRoles := map[string]bool{"system": true, "user": true, "assistant": true, "function": true}
		if !validRoles[msg.Role] {
			return fmt.Errorf("message[%d].role must be one of: system, user, assistant, function", i)
		}
	}

	return nil
}

// CountTokens provides a rough estimate of token count
// TODO: Replace with actual tokenizer for accurate counting
func CountTokens(text string) int {
	// Rough estimate: ~4 characters per token
	return len(text) / 4
}

// EstimateRequestTokens estimates the total input tokens for a request
func EstimateRequestTokens(request *ChatCompletionRequest) int {
	total := 0
	for _, msg := range request.Messages {
		total += CountTokens(msg.Content)
		total += 4 // Overhead per message
	}
	total += 3 // Format overhead
	return total
}
