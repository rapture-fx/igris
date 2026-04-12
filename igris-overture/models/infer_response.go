package models

import (
	"encoding/json"
	"errors"
	"time"
)

// ErrRuntimeSecurity is returned by RuntimeExecutor implementations when the
// Runtime rejects a request with a security error (401/403 or execution envelope
// verification failure). Callers must NOT fall back to direct provider routing.
var ErrRuntimeSecurity = errors.New("runtime: security rejection")

// InferResponse represents the unified inference API response
type InferResponse struct {
	// Core response
	ID      string   `json:"id"`      // Unique request ID
	Object  string   `json:"object"`  // "chat.completion" for compatibility
	Created int64    `json:"created"` // Unix timestamp
	Model   string   `json:"model"`   // Model used for inference
	Choices []Choice `json:"choices"` // Response choices

	// Usage statistics
	Usage *UsageStats `json:"usage,omitempty"` // Token usage information

	// Igris-engine metadata
	Metadata *ResponseMetadata `json:"metadata,omitempty"` // Performance and routing metadata

	// Streaming support
	StreamID string `json:"stream_id,omitempty"` // For streaming responses

	// ExecutionEnvelope is the verified execution proof from the Runtime.
	// Included when IGRIS_RUNTIME_PUBLIC_KEY is set and verification succeeds.
	ExecutionEnvelope map[string]interface{} `json:"execution_envelope,omitempty"`

	// ExecutionReceipt is the verified resource-accounting receipt from the Runtime.
	// Carries transaction_id, cpu/wall/memory/fs metrics, violation_occurred, and
	// a hash-chained Ed25519 signature.  Included when the Runtime emits a receipt
	// and IGRIS_RUNTIME_PUBLIC_KEY verification passes.
	ExecutionReceipt map[string]interface{} `json:"execution_receipt,omitempty"`
}

// Choice represents a single completion choice
type Choice struct {
	Index        int      `json:"index"`                   // Choice index
	Message      *Message `json:"message,omitempty"`       // For non-streaming responses
	Delta        *Message `json:"delta,omitempty"`         // For streaming responses
	FinishReason string   `json:"finish_reason,omitempty"` // "stop", "length", "content_filter"
}

// UsageStats tracks token usage for billing and monitoring
type UsageStats struct {
	PromptTokens     int `json:"prompt_tokens"`     // Tokens in the prompt
	CompletionTokens int `json:"completion_tokens"` // Tokens in the completion
	TotalTokens      int `json:"total_tokens"`      // Total tokens used
}

// ResponseMetadata contains Igris-engine specific performance data
type ResponseMetadata struct {
	// Routing information
	Provider      string `json:"provider"`                 // Provider used ("openai", "anthropic", "python-adapter")
	Region        string `json:"region,omitempty"`         // Region served from
	ModelUsed     string `json:"model_used"`               // Actual model identifier used
	RouteDecision string `json:"route_decision,omitempty"` // Routing decision explanation

	// Performance metrics
	LatencyMs       int64 `json:"latency_ms"`                  // End-to-end latency
	QueueTimeMs     int64 `json:"queue_time_ms,omitempty"`     // Time spent in queue
	InferenceTimeMs int64 `json:"inference_time_ms,omitempty"` // Time spent in inference
	TTFTMs          int64 `json:"ttft_ms,omitempty"`           // Time to first token (streaming)

	// Cost and quality
	CostUSD      float64 `json:"cost_usd,omitempty"`      // Estimated cost in USD
	QualityScore float64 `json:"quality_score,omitempty"` // Model quality score
	CacheHit     bool    `json:"cache_hit,omitempty"`     // Whether response was cached
	CacheKey     string  `json:"cache_key,omitempty"`     // Cache key used

	// Optimizer feedback (for future Rust optimizer integration)
	OptimizerAction  string  `json:"optimizer_action,omitempty"`  // Action taken by optimizer
	RewardSignal     float64 `json:"reward_signal,omitempty"`     // Reward for reinforcement learning
	ExplorationBonus float64 `json:"exploration_bonus,omitempty"` // Exploration bonus applied

	// Request tracking
	RequestID                string    `json:"request_id"`                           // Original request ID
	Timestamp                time.Time `json:"timestamp"`                            // Response timestamp
	RetryCount               int       `json:"retry_count,omitempty"`                // Number of retries
	Fallback                 bool      `json:"fallback,omitempty"`                   // Whether fallback was used
	FallbackReason           string    `json:"fallback_reason,omitempty"`            // Reason for fallback
	StreamExecutionAuthority string    `json:"stream_execution_authority,omitempty"` // runtime | overture_fallback
	StreamFallbackAllowed    *bool     `json:"stream_fallback_allowed,omitempty"`    // Whether a weaker stream fallback contract is allowed
	StreamResumeSupported    *bool     `json:"stream_resume_supported,omitempty"`    // Whether the stream contract supports resume
	StreamReplayCondition    string    `json:"stream_replay_condition,omitempty"`    // Replay condition advertised to the client
}

// NewInferResponse creates a new InferResponse with default values
func NewInferResponse(requestID, model string) *InferResponse {
	return &InferResponse{
		ID:      requestID,
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   model,
		Choices: []Choice{},
		Usage:   &UsageStats{},
		Metadata: &ResponseMetadata{
			RequestID: requestID,
			Timestamp: time.Now(),
		},
	}
}

// AddChoice adds a completion choice to the response
func (r *InferResponse) AddChoice(index int, message *Message, finishReason string) {
	r.Choices = append(r.Choices, Choice{
		Index:        index,
		Message:      message,
		FinishReason: finishReason,
	})
}

// SetUsage sets the token usage statistics
func (r *InferResponse) SetUsage(promptTokens, completionTokens int) {
	r.Usage = &UsageStats{
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		TotalTokens:      promptTokens + completionTokens,
	}
}

// SetMetadata updates the response metadata
func (r *InferResponse) SetMetadata(metadata *ResponseMetadata) {
	r.Metadata = metadata
}

// CalculateLatency calculates and sets the latency in metadata
func (r *InferResponse) CalculateLatency(startTime time.Time) {
	if r.Metadata != nil {
		r.Metadata.LatencyMs = time.Since(startTime).Milliseconds()
	}
}

// ToJSON serializes the response to JSON
func (r *InferResponse) ToJSON() ([]byte, error) {
	return json.Marshal(r)
}

// GetContent returns the content of the first choice
func (r *InferResponse) GetContent() string {
	if len(r.Choices) > 0 && r.Choices[0].Message != nil {
		return r.Choices[0].Message.Content
	}
	return ""
}

// IsSuccess checks if the response indicates a successful inference
func (r *InferResponse) IsSuccess() bool {
	return len(r.Choices) > 0 && r.Choices[0].Message != nil
}

// ErrorResponse creates an error response
func ErrorResponse(requestID, errorMsg string) *InferResponse {
	resp := NewInferResponse(requestID, "error")
	resp.AddChoice(0, &Message{
		Role:    "assistant",
		Content: errorMsg,
	}, "error")
	return resp
}

// StreamChunk represents a streaming response chunk
type StreamChunk struct {
	ID      string   `json:"id"`
	Object  string   `json:"object"` // "chat.completion.chunk"
	Created int64    `json:"created"`
	Model   string   `json:"model"`
	Choices []Choice `json:"choices"`
}

// NewStreamChunk creates a new streaming chunk
func NewStreamChunk(requestID, model, deltaContent string, index int, finishReason string) *StreamChunk {
	return &StreamChunk{
		ID:      requestID,
		Object:  "chat.completion.chunk",
		Created: time.Now().Unix(),
		Model:   model,
		Choices: []Choice{
			{
				Index: index,
				Delta: &Message{
					Role:    "assistant",
					Content: deltaContent,
				},
				FinishReason: finishReason,
			},
		},
	}
}

// ToSSE formats the chunk as Server-Sent Event
func (c *StreamChunk) ToSSE() ([]byte, error) {
	data, err := json.Marshal(c)
	if err != nil {
		return nil, err
	}
	return append([]byte("data: "), append(data, []byte("\n\n")...)...), nil
}
