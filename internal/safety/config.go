package safety

import (
	"log"
	"os"
	"strconv"
)

// SafetyConfig holds all safety control settings
// FUTURE: This will be exposed via Admin API for customer configuration
type SafetyConfig struct {
	// Test Mode - FUTURE: Customer "Sandbox Mode"
	TestMode bool

	// Budget Controls - FUTURE: Customer "Monthly Budget Cap"
	MaxMonthlyCostUSD float64
	EnableBudgetLimit bool

	// Token Limits - FUTURE: Customer "Usage Policy"
	MaxTokensPerRequest int
	EnableTokenLimit    bool

	// Failover Controls - FUTURE: Customer "Reliability Tier"
	EnableBenchmarkFallback bool
	FallbackOnBudgetBreach  bool

	// Key Validation - FUTURE: Customer "BYOK Validation"
	ValidateKeysOnStartup bool
	FailFastOnInvalidKey  bool
}

// DefaultSafetyConfig returns development-safe defaults
// FUTURE: Production defaults will be higher, customer-configurable
func DefaultSafetyConfig() *SafetyConfig {
	return &SafetyConfig{
		// Test Mode (default: false for production)
		TestMode: getEnvBool("PROVIDER_TEST_MODE", false),

		// Budget Controls (default: $5/month for dev protection)
		MaxMonthlyCostUSD: getEnvFloat("MAX_MONTHLY_COST_USD", 5.0),
		EnableBudgetLimit: getEnvBool("ENABLE_BUDGET_LIMIT", true),

		// Token Limits (default: 1024 tokens for safety)
		MaxTokensPerRequest: getEnvInt("MAX_TOKENS_PER_REQUEST", 1024),
		EnableTokenLimit:    getEnvBool("ENABLE_TOKEN_LIMIT", true),

		// Failover Controls (default: enabled for reliability)
		EnableBenchmarkFallback: getEnvBool("ENABLE_BENCHMARK_FALLBACK", true),
		FallbackOnBudgetBreach:  getEnvBool("FALLBACK_ON_BUDGET_BREACH", true),

		// Key Validation (default: enabled for fail-fast)
		ValidateKeysOnStartup: getEnvBool("VALIDATE_KEYS_ON_STARTUP", true),
		FailFastOnInvalidKey:  getEnvBool("FAIL_FAST_ON_INVALID_KEY", true),
	}
}

// LoadSafetyConfig loads safety configuration from environment
func LoadSafetyConfig() *SafetyConfig {
	config := DefaultSafetyConfig()

	// Log loaded configuration
	log.Printf("[Safety] Configuration loaded:")
	log.Printf("  Test Mode: %v", config.TestMode)
	log.Printf("  Max Monthly Cost: $%.2f", config.MaxMonthlyCostUSD)
	log.Printf("  Max Tokens Per Request: %d", config.MaxTokensPerRequest)
	log.Printf("  Budget Limit: %v", config.EnableBudgetLimit)
	log.Printf("  Token Limit: %v", config.EnableTokenLimit)
	log.Printf("  Benchmark Fallback: %v", config.EnableBenchmarkFallback)
	log.Printf("  Validate Keys on Startup: %v", config.ValidateKeysOnStartup)

	// Test Mode warning
	if config.TestMode {
		log.Printf("[Safety] ⚠️  TEST MODE ENABLED - Enhanced safety controls active (future: Sandbox Mode)")
	}

	return config
}

// Helper functions for environment variable parsing

func getEnvBool(key string, defaultValue bool) bool {
	val := os.Getenv(key)
	if val == "" {
		return defaultValue
	}
	result, err := strconv.ParseBool(val)
	if err != nil {
		log.Printf("[Safety] WARNING: Invalid boolean for %s=%s, using default %v", key, val, defaultValue)
		return defaultValue
	}
	return result
}

func getEnvFloat(key string, defaultValue float64) float64 {
	val := os.Getenv(key)
	if val == "" {
		return defaultValue
	}
	result, err := strconv.ParseFloat(val, 64)
	if err != nil {
		log.Printf("[Safety] WARNING: Invalid float for %s=%s, using default %.2f", key, val, defaultValue)
		return defaultValue
	}
	return result
}

func getEnvInt(key string, defaultValue int) int {
	val := os.Getenv(key)
	if val == "" {
		return defaultValue
	}
	result, err := strconv.Atoi(val)
	if err != nil {
		log.Printf("[Safety] WARNING: Invalid int for %s=%s, using default %d", key, val, defaultValue)
		return defaultValue
	}
	return result
}

// IsProductionSafe validates if configuration is safe for production
// FUTURE: This will validate customer-configured limits
func (c *SafetyConfig) IsProductionSafe() (bool, []string) {
	warnings := []string{}

	if !c.EnableBudgetLimit {
		warnings = append(warnings, "Budget limit is DISABLED - unlimited spending possible")
	}

	if c.MaxMonthlyCostUSD > 1000.0 {
		warnings = append(warnings, "Monthly cost limit is very high (>$1000)")
	}

	if c.MaxTokensPerRequest > 8192 {
		warnings = append(warnings, "Token limit is very high (>8192) - potential cost spike risk")
	}

	if !c.ValidateKeysOnStartup {
		warnings = append(warnings, "API key validation is DISABLED - runtime failures possible")
	}

	return len(warnings) == 0, warnings
}

// TODO Phase 14: Add methods for runtime configuration updates via Admin API
// TODO Phase 14: Add persistence layer for budget tracking across restarts
// TODO Phase 14: Add user/tenant-specific configuration overrides
// TODO Phase 15: Add UI endpoints for customer self-service configuration
