package safety

import (
	"fmt"
	"log"

	"github.com/Igris-inertial/system/igris-overture/models"
)

// TokenEnforcer enforces token limits on requests
// FUTURE: This will become Customer "Usage Policy" controls
type TokenEnforcer struct {
	config *SafetyConfig
}

// TokenCheckResult represents the result of a token limit check
type TokenCheckResult struct {
	Allowed         bool
	RequestedTokens int
	MaxAllowed      int
	Truncated       bool
	OriginalTokens  int
	Reason          string
}

// NewTokenEnforcer creates a new token enforcer
func NewTokenEnforcer(config *SafetyConfig) *TokenEnforcer {
	log.Printf("[TokenEnforcer] Initialized with max_tokens=%d", config.MaxTokensPerRequest)
	return &TokenEnforcer{
		config: config,
	}
}

// CheckAndEnforce checks token limits and enforces policy
// FUTURE: This will support per-tenant token policies
func (te *TokenEnforcer) CheckAndEnforce(req *models.InferRequest) (*TokenCheckResult, error) {
	if !te.config.EnableTokenLimit {
		return &TokenCheckResult{
			Allowed:         true,
			RequestedTokens: req.MaxTokens,
			MaxAllowed:      te.config.MaxTokensPerRequest,
			Reason:          "Token limit disabled",
		}, nil
	}

	// If MaxTokens not specified, use safe default
	if req.MaxTokens == 0 {
		req.MaxTokens = 150 // Safe default
		return &TokenCheckResult{
			Allowed:         true,
			RequestedTokens: 150,
			MaxAllowed:      te.config.MaxTokensPerRequest,
			Reason:          "Using safe default (150 tokens)",
		}, nil
	}

	// Check if requested tokens exceed limit
	if req.MaxTokens > te.config.MaxTokensPerRequest {
		// In test mode, truncate to limit
		if te.config.TestMode {
			originalTokens := req.MaxTokens
			req.MaxTokens = te.config.MaxTokensPerRequest

			log.Printf("[TokenEnforcer] ⚠️  Token limit exceeded: %d > %d (truncated to %d in TEST MODE)",
				originalTokens, te.config.MaxTokensPerRequest, req.MaxTokens)

			return &TokenCheckResult{
				Allowed:         true,
				RequestedTokens: req.MaxTokens,
				MaxAllowed:      te.config.MaxTokensPerRequest,
				Truncated:       true,
				OriginalTokens:  originalTokens,
				Reason:          fmt.Sprintf("Truncated from %d to %d (test mode)", originalTokens, te.config.MaxTokensPerRequest),
			}, nil
		}

		// In production mode, reject request
		return &TokenCheckResult{
			Allowed:         false,
			RequestedTokens: req.MaxTokens,
			MaxAllowed:      te.config.MaxTokensPerRequest,
			Truncated:       false,
			Reason:          fmt.Sprintf("Requested tokens (%d) exceeds limit (%d)", req.MaxTokens, te.config.MaxTokensPerRequest),
		}, fmt.Errorf("token limit exceeded: requested %d, max allowed %d", req.MaxTokens, te.config.MaxTokensPerRequest)
	}

	return &TokenCheckResult{
		Allowed:         true,
		RequestedTokens: req.MaxTokens,
		MaxAllowed:      te.config.MaxTokensPerRequest,
		Reason:          "Within token limit",
	}, nil
}

// EstimateTokens estimates token count for a request
// FUTURE: Use proper tokenizer (tiktoken for OpenAI, Claude tokenizer for Anthropic)
func (te *TokenEnforcer) EstimateTokens(req *models.InferRequest) int {
	totalChars := 0

	// Count characters in all messages
	for _, msg := range req.Messages {
		totalChars += len(msg.GetTextContent())
	}

	// Rough estimate: 1 token ≈ 4 characters
	estimatedTokens := totalChars / 4

	// Add requested completion tokens
	if req.MaxTokens > 0 {
		estimatedTokens += req.MaxTokens
	}

	return estimatedTokens
}

// ValidateRequest performs comprehensive request validation
// FUTURE: This will validate against customer-defined policies
func (te *TokenEnforcer) ValidateRequest(req *models.InferRequest) error {
	// Check token limits
	result, err := te.CheckAndEnforce(req)
	if err != nil {
		return err
	}

	if !result.Allowed {
		return fmt.Errorf("request validation failed: %s", result.Reason)
	}

	// Additional safety checks in test mode
	if te.config.TestMode {
		// Limit temperature to safe range
		if req.Temperature > 1.5 {
			log.Printf("[TokenEnforcer] ⚠️  High temperature detected: %.2f (limiting to 1.5 in TEST MODE)", req.Temperature)
			req.Temperature = 1.5
		}

		// Limit top_p
		if req.TopP > 0.95 {
			log.Printf("[TokenEnforcer] ⚠️  High top_p detected: %.2f (limiting to 0.95 in TEST MODE)", req.TopP)
			req.TopP = 0.95
		}
	}

	return nil
}

// TODO Phase 14: Add per-tenant token policies
// TODO Phase 14: Add token usage analytics and trends
// TODO Phase 15: Add dynamic token limits based on user tier (Free/Pro/Enterprise)
// TODO Phase 15: Add token reservation system for guaranteed throughput
