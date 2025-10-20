package anthropic

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/schlep-engine/schlep-engine/internal/models"
	"github.com/schlep-engine/schlep-engine/internal/providers"
)

// AnthropicProvider implements the Provider interface for Anthropic API
type AnthropicProvider struct {
	config       *providers.ProviderConfig
	capabilities *providers.ProviderCapabilities
	client       *http.Client
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

	provider := &AnthropicProvider{
		config:       config,
		capabilities: getAnthropicCapabilities(),
		client:       httpClient,
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

	// Execute request with retry logic
	var resp *http.Response
	var lastErr error
	maxRetries := p.config.MaxRetries
	if maxRetries == 0 {
		maxRetries = 3
	}

	for attempt := 0; attempt <= maxRetries; attempt++ {
		resp, lastErr = p.client.Do(httpReq)
		if lastErr == nil && resp.StatusCode < 500 {
			break // Success or client error (don't retry)
		}

		if attempt < maxRetries {
			// Exponential backoff
			backoff := time.Duration(p.config.RetryDelay*(1<<uint(attempt))) * time.Millisecond
			if backoff == 0 {
				backoff = time.Duration(100*(1<<uint(attempt))) * time.Millisecond
			}
			time.Sleep(backoff)
		}
	}

	if lastErr != nil {
		return nil, fmt.Errorf("request failed after %d retries: %w", maxRetries, lastErr)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Handle error responses
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

	// TODO: Implement actual Anthropic streaming
	// Steps:
	// 1. Make streaming HTTP request to /v1/messages with stream=true
	// 2. Parse SSE stream (Anthropic format differs from OpenAI)
	// 3. Handle event types: message_start, content_block_start, content_block_delta, message_delta, message_stop
	// 4. Convert each delta to StreamChunk format

	go func() {
		defer close(chunkChan)
		defer close(errChan)

		// STUB: Send mock streaming chunks
		requestID := generateRequestID()
		mockContent := []string{"Greetings", " from", " Claude", " streaming", " interface", "!"}

		for i, word := range mockContent {
			select {
			case <-ctx.Done():
				errChan <- ctx.Err()
				return
			default:
			}

			finishReason := ""
			if i == len(mockContent)-1 {
				finishReason = "end_turn"
			}

			chunk := models.NewStreamChunk(requestID, req.Model, word, 0, finishReason)
			chunkChan <- chunk

			time.Sleep(60 * time.Millisecond) // Simulate streaming delay
		}
	}()

	return chunkChan, errChan
}

// HealthCheck verifies provider availability
func (p *AnthropicProvider) HealthCheck(ctx context.Context) error {
	// TODO: Implement actual health check
	// Note: Anthropic doesn't have a dedicated health endpoint
	// Options:
	// 1. Make a minimal messages API call with very short input
	// 2. Validate API key format
	// 3. Check rate limit headers from last request

	// STUB: Always return healthy for now
	return nil
}

// GetCapabilities returns provider capabilities
func (p *AnthropicProvider) GetCapabilities() *providers.ProviderCapabilities {
	return p.capabilities
}

// EstimateCost estimates the cost for a given request
func (p *AnthropicProvider) EstimateCost(req *models.InferRequest) (float64, error) {
	// TODO: Implement accurate cost estimation based on model and token count
	// Anthropic Pricing (as of 2024):
	// Claude 3 Opus:
	//   - $15/MTok input, $75/MTok output
	// Claude 3 Sonnet:
	//   - $3/MTok input, $15/MTok output
	// Claude 3 Haiku:
	//   - $0.25/MTok input, $1.25/MTok output

	promptTokens := estimatePromptTokens(req)
	maxCompletionTokens := req.MaxTokens
	if maxCompletionTokens == 0 {
		maxCompletionTokens = 200 // Default
	}

	// STUB: Use Sonnet pricing as default
	costPerPromptToken := 0.000003    // $3/1M tokens
	costPerCompletionToken := 0.000015 // $15/1M tokens

	cost := float64(promptTokens)*costPerPromptToken + float64(maxCompletionTokens)*costPerCompletionToken
	return cost, nil
}

// Close releases provider resources
func (p *AnthropicProvider) Close() error {
	// TODO: Close HTTP client connections
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
		totalChars += len(msg.Content)
	}
	return totalChars / 4
}

func (p *AnthropicProvider) calculateCost(usage *models.UsageStats, model string) float64 {
	if usage == nil {
		return 0.0
	}

	// TODO: Use actual model-specific pricing
	// STUB: Use Sonnet pricing for all models
	promptCost := float64(usage.PromptTokens) * 0.000003
	completionCost := float64(usage.CompletionTokens) * 0.000015

	return promptCost + completionCost
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
	Role    string `json:"role"`
	Content string `json:"content"`
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
			anthropicReq.System = msg.Content
		} else {
			anthropicReq.Messages = append(anthropicReq.Messages, AnthropicMessage{
				Role:    msg.Role,
				Content: msg.Content,
			})
		}
	}

	return anthropicReq
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
