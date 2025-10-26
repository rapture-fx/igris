package safety

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// KeyValidator validates API keys at startup
// FUTURE: This will validate customer BYOK uploads via UI
type KeyValidator struct {
	config     *SafetyConfig
	httpClient *http.Client
}

// ValidationResult represents the result of key validation
type ValidationResult struct {
	Valid         bool
	Provider      string
	ErrorMessage  string
	Latency       time.Duration
	ModelsFound   int
}

// NewKeyValidator creates a new key validator
func NewKeyValidator(config *SafetyConfig) *KeyValidator {
	return &KeyValidator{
		config: config,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// ValidateOpenAIKey validates an OpenAI API key by making a test request
func (kv *KeyValidator) ValidateOpenAIKey(apiKey string) *ValidationResult {
	startTime := time.Now()

	log.Printf("[KeyValidator] Validating OpenAI API key...")

	// Make minimal request to /v1/models endpoint
	req, err := http.NewRequest("GET", "https://api.openai.com/v1/models", nil)
	if err != nil {
		return &ValidationResult{
			Valid:        false,
			Provider:     "openai",
			ErrorMessage: fmt.Sprintf("Failed to create request: %v", err),
		}
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	req = req.WithContext(ctx)

	resp, err := kv.httpClient.Do(req)
	if err != nil {
		return &ValidationResult{
			Valid:        false,
			Provider:     "openai",
			ErrorMessage: fmt.Sprintf("Request failed: %v", err),
			Latency:      time.Since(startTime),
		}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == 401 {
		return &ValidationResult{
			Valid:        false,
			Provider:     "openai",
			ErrorMessage: "Invalid API key (401 Unauthorized)",
			Latency:      time.Since(startTime),
		}
	}

	if resp.StatusCode != 200 {
		return &ValidationResult{
			Valid:        false,
			Provider:     "openai",
			ErrorMessage: fmt.Sprintf("Unexpected status: %d - %s", resp.StatusCode, string(body)),
			Latency:      time.Since(startTime),
		}
	}

	// Parse response to count models
	var modelsResp struct {
		Data []interface{} `json:"data"`
	}
	json.Unmarshal(body, &modelsResp)

	log.Printf("[KeyValidator] ✅ OpenAI key valid (found %d models, latency: %dms)",
		len(modelsResp.Data), time.Since(startTime).Milliseconds())

	return &ValidationResult{
		Valid:       true,
		Provider:    "openai",
		Latency:     time.Since(startTime),
		ModelsFound: len(modelsResp.Data),
	}
}

// ValidateAnthropicKey validates an Anthropic API key
func (kv *KeyValidator) ValidateAnthropicKey(apiKey string) *ValidationResult {
	startTime := time.Now()

	log.Printf("[KeyValidator] Validating Anthropic API key...")

	// Make minimal request to /v1/messages endpoint with very small input
	reqBody := map[string]interface{}{
		"model":      "claude-3-haiku-20240307", // Cheapest model
		"max_tokens": 1,
		"messages": []map[string]string{
			{"role": "user", "content": "Hi"},
		},
	}

	bodyBytes, _ := json.Marshal(reqBody)

	req, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return &ValidationResult{
			Valid:        false,
			Provider:     "anthropic",
			ErrorMessage: fmt.Sprintf("Failed to create request: %v", err),
		}
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	req = req.WithContext(ctx)

	resp, err := kv.httpClient.Do(req)
	if err != nil {
		return &ValidationResult{
			Valid:        false,
			Provider:     "anthropic",
			ErrorMessage: fmt.Sprintf("Request failed: %v", err),
			Latency:      time.Since(startTime),
		}
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == 401 {
		return &ValidationResult{
			Valid:        false,
			Provider:     "anthropic",
			ErrorMessage: "Invalid API key (401 Unauthorized)",
			Latency:      time.Since(startTime),
		}
	}

	if resp.StatusCode == 403 {
		return &ValidationResult{
			Valid:        false,
			Provider:     "anthropic",
			ErrorMessage: "Access forbidden (403) - key may lack permissions",
			Latency:      time.Since(startTime),
		}
	}

	// 200 or 429 (rate limit) both indicate valid key
	if resp.StatusCode == 200 || resp.StatusCode == 429 {
		log.Printf("[KeyValidator] ✅ Anthropic key valid (latency: %dms)",
			time.Since(startTime).Milliseconds())

		return &ValidationResult{
			Valid:    true,
			Provider: "anthropic",
			Latency:  time.Since(startTime),
		}
	}

	return &ValidationResult{
		Valid:        false,
		Provider:     "anthropic",
		ErrorMessage: fmt.Sprintf("Unexpected status: %d - %s", resp.StatusCode, string(body)),
		Latency:      time.Since(startTime),
	}
}

// ValidateAllKeys validates all configured API keys
// FUTURE: This will validate customer-uploaded BYOK credentials
func (kv *KeyValidator) ValidateAllKeys(openaiKey, anthropicKey string) error {
	if !kv.config.ValidateKeysOnStartup {
		log.Printf("[KeyValidator] Key validation disabled, skipping")
		return nil
	}

	hasValidKey := false
	validationErrors := []string{}

	// Validate OpenAI key if provided
	if openaiKey != "" {
		result := kv.ValidateOpenAIKey(openaiKey)
		if result.Valid {
			hasValidKey = true
		} else {
			errMsg := fmt.Sprintf("OpenAI key validation failed: %s", result.ErrorMessage)
			validationErrors = append(validationErrors, errMsg)
			log.Printf("[KeyValidator] ❌ %s", errMsg)

			if kv.config.FailFastOnInvalidKey {
				return fmt.Errorf("OpenAI key invalid: %s", result.ErrorMessage)
			}
		}
	}

	// Validate Anthropic key if provided
	if anthropicKey != "" {
		result := kv.ValidateAnthropicKey(anthropicKey)
		if result.Valid {
			hasValidKey = true
		} else {
			errMsg := fmt.Sprintf("Anthropic key validation failed: %s", result.ErrorMessage)
			validationErrors = append(validationErrors, errMsg)
			log.Printf("[KeyValidator] ❌ %s", errMsg)

			if kv.config.FailFastOnInvalidKey {
				return fmt.Errorf("Anthropic key invalid: %s", result.ErrorMessage)
			}
		}
	}

	// If fail-fast is enabled and no valid keys found
	if kv.config.FailFastOnInvalidKey && !hasValidKey && (openaiKey != "" || anthropicKey != "") {
		return fmt.Errorf("no valid API keys found - cannot start in real mode")
	}

	if len(validationErrors) > 0 {
		log.Printf("[KeyValidator] ⚠️  Some keys failed validation but continuing (fail_fast=false)")
	}

	return nil
}

// TODO Phase 14: Add key rotation support
// TODO Phase 14: Add key expiry detection and warnings
// TODO Phase 15: Add UI for customer BYOK key upload and validation
// TODO Phase 15: Add encrypted key storage
