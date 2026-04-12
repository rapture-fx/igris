package models

import (
	"encoding/json"
	"fmt"
	"strings"
)

// Message represents a chat message in the inference request
type Message struct {
	Role         string        `json:"role"`                    // "system", "user", "assistant"
	Content      string        `json:"content"`                 // Text-only content (backward compatible)
	ContentParts []ContentPart `json:"content_parts,omitempty"` // Multimodal content parts
}

// ContentPart represents a single part of multimodal content
type ContentPart struct {
	Type     string    `json:"type"`                // "text" or "image_url"
	Text     string    `json:"text,omitempty"`      // For type "text"
	ImageURL *ImageURL `json:"image_url,omitempty"` // For type "image_url"
}

// ImageURL represents an image reference in a multimodal message
type ImageURL struct {
	URL    string `json:"url"`              // URL or base64 data URI (data:image/jpeg;base64,...)
	Detail string `json:"detail,omitempty"` // "auto", "low", "high" (OpenAI-specific)
}

// GetTextContent returns the text content of the message, handling both
// simple Content string and multimodal ContentParts
func (m *Message) GetTextContent() string {
	if len(m.ContentParts) > 0 {
		var text strings.Builder
		for _, part := range m.ContentParts {
			if part.Type == "text" {
				text.WriteString(part.Text)
			}
		}
		return text.String()
	}
	return m.Content
}

// HasImages returns true if the message contains image content parts
func (m *Message) HasImages() bool {
	for _, part := range m.ContentParts {
		if part.Type == "image_url" && part.ImageURL != nil {
			return true
		}
	}
	return false
}

// IsMultimodal returns true if the message uses content parts
func (m *Message) IsMultimodal() bool {
	return len(m.ContentParts) > 0
}

// InferRequest represents a unified inference API request
// Compatible with OpenAI and Anthropic chat completion formats
type InferRequest struct {
	// Core fields
	Model    string    `json:"model"`            // Model identifier (e.g., "gpt-4", "claude-3-opus")
	Messages []Message `json:"messages"`         // Conversation messages
	Stream   bool      `json:"stream,omitempty"` // Enable streaming responses

	// Generation parameters
	MaxTokens        int      `json:"max_tokens,omitempty"`        // Maximum tokens to generate
	Temperature      float64  `json:"temperature,omitempty"`       // Sampling temperature (0.0-2.0)
	TopP             float64  `json:"top_p,omitempty"`             // Nucleus sampling threshold
	TopK             int      `json:"top_k,omitempty"`             // Top-K sampling (Anthropic)
	PresencePenalty  float64  `json:"presence_penalty,omitempty"`  // Presence penalty (OpenAI)
	FrequencyPenalty float64  `json:"frequency_penalty,omitempty"` // Frequency penalty (OpenAI)
	Stop             []string `json:"stop,omitempty"`              // Stop sequences

	// Routing and optimization (Igris-engine specific)
	Policy              *PolicyOverride   `json:"policy,omitempty"`                // Routing policy override
	EnableCaching       bool              `json:"enable_caching,omitempty"`        // Enable response caching
	CacheTTL            int               `json:"cache_ttl,omitempty"`             // Cache TTL in seconds
	PreferredRegion     string            `json:"preferred_region,omitempty"`      // Preferred edge region
	SpeculativeMode     string            `json:"speculative_mode,omitempty"`      // Speculative execution mode: "latency", "balanced", "quality", "cost", or "" (disabled)
	CouncilMode         bool              `json:"council_mode,omitempty"`          // Council mode: Multi-model ensemble with peer ranking and chairman synthesis
	AllowStreamFallback bool              `json:"allow_stream_fallback,omitempty"` // Explicitly allow Overture-local fallback when runtime-backed streaming is unavailable
	Metadata            map[string]string `json:"metadata,omitempty"`              // Request metadata for tracking

	// Provider-specific extensions
	ProviderConfig map[string]interface{} `json:"provider_config,omitempty"` // Provider-specific parameters
}

// PolicyOverride allows per-request routing policy customization
type PolicyOverride struct {
	Provider        string `json:"provider,omitempty"`         // Force specific provider ("openai", "anthropic", "python-adapter")
	Region          string `json:"region,omitempty"`           // Force specific region
	OptimizeFor     string `json:"optimize_for,omitempty"`     // "latency", "cost", "quality"
	FallbackEnabled bool   `json:"fallback_enabled,omitempty"` // Enable fallback on failure
	TimeoutMs       int    `json:"timeout_ms,omitempty"`       // Request timeout in milliseconds
}

// Validate performs validation on the InferRequest
func (r *InferRequest) Validate() error {
	if r.Model == "" {
		return fmt.Errorf("model is required")
	}

	if len(r.Messages) == 0 {
		return fmt.Errorf("messages cannot be empty")
	}

	// Validate message roles
	validRoles := map[string]bool{"system": true, "user": true, "assistant": true}
	for i, msg := range r.Messages {
		if msg.Content == "" && len(msg.ContentParts) == 0 {
			return fmt.Errorf("message[%d]: content cannot be empty", i)
		}
		if !validRoles[msg.Role] {
			return fmt.Errorf("message[%d]: invalid role '%s', must be system/user/assistant", i, msg.Role)
		}
		// Validate content parts if present
		for j, part := range msg.ContentParts {
			if part.Type == "" {
				return fmt.Errorf("message[%d].content_parts[%d]: type is required", i, j)
			}
			switch part.Type {
			case "text":
				if part.Text == "" {
					return fmt.Errorf("message[%d].content_parts[%d]: text cannot be empty", i, j)
				}
			case "image_url":
				if part.ImageURL == nil || part.ImageURL.URL == "" {
					return fmt.Errorf("message[%d].content_parts[%d]: image_url.url is required", i, j)
				}
			default:
				return fmt.Errorf("message[%d].content_parts[%d]: unsupported type '%s'", i, j, part.Type)
			}
		}
	}

	// Validate generation parameters
	if r.Temperature < 0 || r.Temperature > 2.0 {
		return fmt.Errorf("temperature must be between 0.0 and 2.0")
	}

	if r.TopP < 0 || r.TopP > 1.0 {
		return fmt.Errorf("top_p must be between 0.0 and 1.0")
	}

	if r.MaxTokens < 0 {
		return fmt.Errorf("max_tokens cannot be negative")
	}

	return nil
}

// GetProvider extracts the target provider from the model name or policy
// Returns provider name and model identifier
func (r *InferRequest) GetProvider() (string, string) {
	// Priority 1: Explicit provider override in policy
	if r.Policy != nil && r.Policy.Provider != "" {
		return r.Policy.Provider, r.Model
	}

	// Priority 2: Model-based provider detection
	if len(r.Model) > 0 {
		switch {
		// Mock provider models
		case len(r.Model) >= 12 && r.Model[:12] == "igris-mock-":
			return "mock-openai", r.Model
		// OpenAI models
		case len(r.Model) >= 3 && r.Model[:3] == "gpt":
			return "openai", r.Model
		// Anthropic models
		case len(r.Model) >= 6 && r.Model[:6] == "claude":
			return "anthropic", r.Model
		// Python adapter for custom models
		default:
			return "python-adapter", r.Model
		}
	}

	return "python-adapter", r.Model
}

// ToJSON serializes the request to JSON
func (r *InferRequest) ToJSON() ([]byte, error) {
	return json.Marshal(r)
}

// FromJSON deserializes the request from JSON
func FromJSON(data []byte) (*InferRequest, error) {
	var req InferRequest
	if err := json.Unmarshal(data, &req); err != nil {
		return nil, err
	}
	return &req, nil
}

// Clone creates a deep copy of the InferRequest
func (r *InferRequest) Clone() *InferRequest {
	clone := &InferRequest{
		Model:               r.Model,
		Stream:              r.Stream,
		MaxTokens:           r.MaxTokens,
		Temperature:         r.Temperature,
		TopP:                r.TopP,
		TopK:                r.TopK,
		PresencePenalty:     r.PresencePenalty,
		FrequencyPenalty:    r.FrequencyPenalty,
		EnableCaching:       r.EnableCaching,
		CacheTTL:            r.CacheTTL,
		PreferredRegion:     r.PreferredRegion,
		SpeculativeMode:     r.SpeculativeMode,
		CouncilMode:         r.CouncilMode,
		AllowStreamFallback: r.AllowStreamFallback,
	}

	// Deep copy messages (including ContentParts)
	clone.Messages = make([]Message, len(r.Messages))
	for i, msg := range r.Messages {
		clone.Messages[i] = Message{
			Role:    msg.Role,
			Content: msg.Content,
		}
		if len(msg.ContentParts) > 0 {
			clone.Messages[i].ContentParts = make([]ContentPart, len(msg.ContentParts))
			for j, part := range msg.ContentParts {
				clone.Messages[i].ContentParts[j] = ContentPart{
					Type: part.Type,
					Text: part.Text,
				}
				if part.ImageURL != nil {
					clone.Messages[i].ContentParts[j].ImageURL = &ImageURL{
						URL:    part.ImageURL.URL,
						Detail: part.ImageURL.Detail,
					}
				}
			}
		}
	}

	// Deep copy stop sequences
	if r.Stop != nil {
		clone.Stop = make([]string, len(r.Stop))
		copy(clone.Stop, r.Stop)
	}

	// Deep copy metadata
	if r.Metadata != nil {
		clone.Metadata = make(map[string]string)
		for k, v := range r.Metadata {
			clone.Metadata[k] = v
		}
	}

	// Deep copy policy
	if r.Policy != nil {
		clone.Policy = &PolicyOverride{
			Provider:        r.Policy.Provider,
			Region:          r.Policy.Region,
			OptimizeFor:     r.Policy.OptimizeFor,
			FallbackEnabled: r.Policy.FallbackEnabled,
			TimeoutMs:       r.Policy.TimeoutMs,
		}
	}

	return clone
}
