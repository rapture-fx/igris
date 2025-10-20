package openai

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

// OpenAIProvider implements the Provider interface for OpenAI API
type OpenAIProvider struct {
	config       *providers.ProviderConfig
	capabilities *providers.ProviderCapabilities
	client       *http.Client
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

	provider := &OpenAIProvider{
		config:       config,
		capabilities: getOpenAICapabilities(),
		client:       httpClient,
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

	// Convert to OpenAI format
	openaiReq := p.buildOpenAIRequest(req)

	// Marshal request
	reqBody, err := json.Marshal(openaiReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+"/chat/completions", bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.config.APIKey)

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
		var errResp OpenAIErrorResponse
		if err := json.Unmarshal(body, &errResp); err == nil && errResp.Error.Message != "" {
			return nil, fmt.Errorf("OpenAI API error (status %d): %s", resp.StatusCode, errResp.Error.Message)
		}
		return nil, fmt.Errorf("OpenAI API error (status %d): %s", resp.StatusCode, string(body))
	}

	// Parse success response
	var openaiResp OpenAIChatCompletionResponse
	if err := json.Unmarshal(body, &openaiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	// Convert to unified format
	response := p.convertToInferResponse(&openaiResp, req.Model)
	response.CalculateLatency(startTime)
	response.Metadata.CostUSD = p.calculateCost(response.Usage)

	return response, nil
}

// InferStream performs streaming inference
func (p *OpenAIProvider) InferStream(ctx context.Context, req *models.InferRequest) (<-chan *models.StreamChunk, <-chan error) {
	chunkChan := make(chan *models.StreamChunk, 10)
	errChan := make(chan error, 1)

	// TODO: Implement actual OpenAI streaming
	// Steps:
	// 1. Make streaming HTTP request to /v1/chat/completions with stream=true
	// 2. Parse SSE stream
	// 3. Convert each chunk to StreamChunk format
	// 4. Send via channel

	go func() {
		defer close(chunkChan)
		defer close(errChan)

		// STUB: Send mock streaming chunks
		requestID := generateRequestID()
		mockContent := []string{"Hello", " from", " OpenAI", " streaming", " stub", "!"}

		for i, word := range mockContent {
			select {
			case <-ctx.Done():
				errChan <- ctx.Err()
				return
			default:
			}

			finishReason := ""
			if i == len(mockContent)-1 {
				finishReason = "stop"
			}

			chunk := models.NewStreamChunk(requestID, req.Model, word, 0, finishReason)
			chunkChan <- chunk

			time.Sleep(50 * time.Millisecond) // Simulate streaming delay
		}
	}()

	return chunkChan, errChan
}

// HealthCheck verifies provider availability
func (p *OpenAIProvider) HealthCheck(ctx context.Context) error {
	// TODO: Implement actual health check
	// Options:
	// 1. Make lightweight API call (e.g., list models)
	// 2. Validate API key
	// 3. Check rate limits

	// STUB: Always return healthy for now
	return nil
}

// GetCapabilities returns provider capabilities
func (p *OpenAIProvider) GetCapabilities() *providers.ProviderCapabilities {
	return p.capabilities
}

// EstimateCost estimates the cost for a given request
func (p *OpenAIProvider) EstimateCost(req *models.InferRequest) (float64, error) {
	// TODO: Implement accurate cost estimation based on model and token count
	// Pricing (as of 2024):
	// - GPT-4: $0.03/1K prompt tokens, $0.06/1K completion tokens
	// - GPT-4 Turbo: $0.01/1K prompt, $0.03/1K completion
	// - GPT-3.5 Turbo: $0.0005/1K prompt, $0.0015/1K completion

	promptTokens := estimatePromptTokens(req)
	maxCompletionTokens := req.MaxTokens
	if maxCompletionTokens == 0 {
		maxCompletionTokens = 150 // Default
	}

	// STUB: Use generic pricing
	costPerPromptToken := 0.00001  // $0.01/1K tokens
	costPerCompletionToken := 0.00003 // $0.03/1K tokens

	cost := float64(promptTokens)*costPerPromptToken + float64(maxCompletionTokens)*costPerCompletionToken
	return cost, nil
}

// Close releases provider resources
func (p *OpenAIProvider) Close() error {
	// TODO: Close HTTP client connections
	return nil
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
		totalChars += len(msg.Content)
	}
	return totalChars / 4
}

func (p *OpenAIProvider) calculateCost(usage *models.UsageStats) float64 {
	if usage == nil {
		return 0.0
	}

	// TODO: Use model-specific pricing
	// STUB: Generic pricing
	promptCost := float64(usage.PromptTokens) * 0.00001
	completionCost := float64(usage.CompletionTokens) * 0.00003

	return promptCost + completionCost
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
	Role    string `json:"role"`
	Content string `json:"content"`
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
		openaiReq.Messages[i] = OpenAIMessage{
			Role:    msg.Role,
			Content: msg.Content,
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
		response.AddChoice(choice.Index, &models.Message{
			Role:    choice.Message.Role,
			Content: choice.Message.Content,
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
