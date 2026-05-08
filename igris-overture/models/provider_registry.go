// Package models provides data models for the Igris Inertial API
package models

import (
	"encoding/json"
	"time"
)

// CompatibilityClass defines explicit compatibility categories for providers
type CompatibilityClass string

const (
	// OpenAICompatible providers use OpenAI-compatible API format
	OpenAICompatible CompatibilityClass = "openai_compatible"
	// AnthropicCompatible providers use Anthropic Messages API format
	AnthropicCompatible CompatibilityClass = "anthropic"
	// CustomAdapter providers require custom transformation logic
	CustomAdapter CompatibilityClass = "custom_adapter"
	// Unsupported providers are not yet supported
	Unsupported CompatibilityClass = "unsupported"
)

// ProviderStatus tracks provider lifecycle and health states
type ProviderStatus string

const (
	// StatusPending indicates initial registration, validation pending
	StatusPending ProviderStatus = "pending"
	// StatusActive indicates validated and operational
	StatusActive ProviderStatus = "active"
	// StatusInvalid indicates failed validation
	StatusInvalid ProviderStatus = "invalid"
	// StatusDisabled indicates disabled due to repeated failures or manual action
	StatusDisabled ProviderStatus = "disabled"
)

// ProviderHealth contains health metrics for a provider
type ProviderHealth struct {
	LatencyMs           *int       `json:"latency_ms"`
	LastSuccess         *time.Time `json:"last_success"`
	LastFailure         *time.Time `json:"last_failure"`
	ConsecutiveFailures int        `json:"consecutive_failures"`
	UptimePercent       float64    `json:"uptime_percent"`
	TotalChecks         int        `json:"total_checks"`
	SuccessfulChecks    int        `json:"successful_checks"`
}

// ProviderPricing contains cost per token information
type ProviderPricing struct {
	Input  float64 `json:"input"`  // Cost per input token
	Output float64 `json:"output"` // Cost per output token
}

// ProviderRegistry represents a registered AI provider
type ProviderRegistry struct {
	// Identity
	ID       string `json:"id" db:"id"`
	TenantID string `json:"tenant_id" db:"tenant_id"`
	Name     string `json:"name" db:"name"`

	// Connection Configuration
	BaseURL            string  `json:"base_url" db:"base_url"`
	AuthHeaderTemplate string  `json:"auth_header_template" db:"auth_header_template"` // Static template e.g. "Authorization: Bearer {key}"
	KeyID              *string `json:"key_id,omitempty" db:"key_id"`                   // Reference to tenant_keys.id

	// Provider Metadata
	Models             []string           `json:"models" db:"models"`
	Pricing            ProviderPricing    `json:"pricing" db:"pricing"`
	CompatibilityClass CompatibilityClass `json:"compatibility_class" db:"compatibility_class"`
	Status             ProviderStatus     `json:"status" db:"status"`

	// Health Metrics
	Health ProviderHealth `json:"health" db:"health"`

	// Flags
	IsVerified bool `json:"is_verified" db:"is_verified"`
	IsOfficial bool `json:"is_official" db:"is_official"`

	// Audit Trail
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
	LastValidatedAt *time.Time `json:"last_validated_at" db:"last_validated_at"`
}

// ProviderValidationLog represents a validation attempt
type ProviderValidationLog struct {
	ID             string    `json:"id" db:"id"`
	ProviderID     string    `json:"provider_id" db:"provider_id"`
	Success        bool      `json:"success" db:"success"`
	StatusCode     *int      `json:"status_code" db:"status_code"`
	LatencyMs      *int      `json:"latency_ms" db:"latency_ms"`
	ErrorMessage   *string   `json:"error_message" db:"error_message"`
	ModelsDetected []string  `json:"models_detected" db:"models_detected"`
	ValidatedAt    time.Time `json:"validated_at" db:"validated_at"`
	TraceID        string    `json:"trace_id" db:"trace_id"`
}

// UnmarshalModelsJSON unmarshals models from JSONB
func UnmarshalModelsJSON(data []byte) ([]string, error) {
	var models []string
	if err := json.Unmarshal(data, &models); err != nil {
		return nil, err
	}
	return models, nil
}

// MarshalModelsJSON marshals models to JSONB
func MarshalModelsJSON(models []string) ([]byte, error) {
	return json.Marshal(models)
}

// UnmarshalPricingJSON unmarshals pricing from JSONB
func UnmarshalPricingJSON(data []byte) (ProviderPricing, error) {
	var pricing ProviderPricing
	if err := json.Unmarshal(data, &pricing); err != nil {
		return ProviderPricing{}, err
	}
	return pricing, nil
}

// MarshalPricingJSON marshals pricing to JSONB
func MarshalPricingJSON(pricing ProviderPricing) ([]byte, error) {
	return json.Marshal(pricing)
}

// UnmarshalHealthJSON unmarshals health from JSONB
func UnmarshalHealthJSON(data []byte) (ProviderHealth, error) {
	var health ProviderHealth
	if err := json.Unmarshal(data, &health); err != nil {
		return ProviderHealth{}, err
	}
	return health, nil
}

// MarshalHealthJSON marshals health to JSONB
func MarshalHealthJSON(health ProviderHealth) ([]byte, error) {
	return json.Marshal(health)
}

// ToPublicResponse converts a ProviderRegistry to a public response (hides sensitive data)
func (p *ProviderRegistry) ToPublicResponse() map[string]interface{} {
	return map[string]interface{}{
		"id":                  p.ID,
		"tenant_id":           p.TenantID,
		"name":                p.Name,
		"base_url":            p.BaseURL,
		"key_id":              p.KeyID,
		"models":              p.Models,
		"pricing":             p.Pricing,
		"compatibility_class": p.CompatibilityClass,
		"status":              p.Status,
		"health":              p.Health,
		"is_verified":         p.IsVerified,
		"is_official":         p.IsOfficial,
		"created_at":          p.CreatedAt,
		"updated_at":          p.UpdatedAt,
		"last_validated_at":   p.LastValidatedAt,
		// Note: auth_header_template excluded — contains sensitive template structure
	}
}
