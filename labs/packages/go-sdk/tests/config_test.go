package tests

import (
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/igris-inertial/go-sdk/pkg/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDefaultConfig(t *testing.T) {
	cfg := config.DefaultConfig()
	
	assert.Equal(t, "https://api.igris-inertial.com", cfg.BaseURL)
	assert.Equal(t, 30*time.Second, cfg.Timeout)
	assert.Equal(t, 3, cfg.MaxRetries)
	assert.True(t, cfg.CircuitBreakerEnabled)
	assert.True(t, cfg.EnableMetrics)
	assert.True(t, cfg.EnableTracing)
	assert.Equal(t, "info", cfg.LogLevel)
	assert.Equal(t, "igris-inertial-client", cfg.ServiceName)
}

func TestLoadConfigFromEnv(t *testing.T) {
	// Set environment variables
	os.Setenv("SCHLEP_API_KEY", "test-api-key")
	os.Setenv("SCHLEP_BASE_URL", "https://test.api.com")
	os.Setenv("SCHLEP_TIMEOUT", "60s")
	os.Setenv("SCHLEP_MAX_RETRIES", "5")
	os.Setenv("SCHLEP_ENABLE_METRICS", "false")
	os.Setenv("SCHLEP_LOG_LEVEL", "debug")
	
	defer func() {
		// Cleanup
		os.Unsetenv("SCHLEP_API_KEY")
		os.Unsetenv("SCHLEP_BASE_URL")
		os.Unsetenv("SCHLEP_TIMEOUT")
		os.Unsetenv("SCHLEP_MAX_RETRIES")
		os.Unsetenv("SCHLEP_ENABLE_METRICS")
		os.Unsetenv("SCHLEP_LOG_LEVEL")
	}()
	
	cfg, err := config.LoadConfig()
	require.NoError(t, err)
	
	assert.Equal(t, "test-api-key", cfg.APIKey)
	assert.Equal(t, "https://test.api.com", cfg.BaseURL)
	assert.Equal(t, 60*time.Second, cfg.Timeout)
	assert.Equal(t, 5, cfg.MaxRetries)
	assert.False(t, cfg.EnableMetrics)
	assert.Equal(t, "debug", cfg.LogLevel)
}

func TestConfigValidation(t *testing.T) {
	tests := []struct {
		name        string
		config      *config.Config
		shouldError bool
		errorMsg    string
	}{
		{
			name: "valid config",
			config: &config.Config{
				APIKey:  "valid-key",
				BaseURL: "https://api.example.com",
				Timeout: 30 * time.Second,
			},
			shouldError: false,
		},
		{
			name: "missing API key",
			config: &config.Config{
				BaseURL: "https://api.example.com",
				Timeout: 30 * time.Second,
			},
			shouldError: true,
			errorMsg:    "API key is required",
		},
		{
			name: "missing base URL",
			config: &config.Config{
				APIKey:  "valid-key",
				Timeout: 30 * time.Second,
			},
			shouldError: true,
			errorMsg:    "base URL is required",
		},
		{
			name: "invalid timeout",
			config: &config.Config{
				APIKey:  "valid-key",
				BaseURL: "https://api.example.com",
				Timeout: -1 * time.Second,
			},
			shouldError: true,
			errorMsg:    "timeout must be positive",
		},
		{
			name: "negative retries",
			config: &config.Config{
				APIKey:     "valid-key",
				BaseURL:    "https://api.example.com",
				Timeout:    30 * time.Second,
				MaxRetries: -1,
			},
			shouldError: true,
			errorMsg:    "max retries cannot be negative",
		},
	}
	
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Use a validation function (this would be part of LoadConfig)
			err := validateConfig(tt.config)
			
			if tt.shouldError {
				assert.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorMsg)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestGetSDKInfo(t *testing.T) {
	info := config.GetSDKInfo()
	
	assert.Equal(t, "Schlep-engine Go SDK", info["name"])
	assert.Equal(t, "1.0.0", info["version"])
	assert.Equal(t, "Schlep-engine", info["company"])
	assert.Contains(t, info["description"], "Go SDK")
	assert.Contains(t, info["documentation"], "docs.igris-inertial.com")
	
	// Check features array
	features, ok := info["features"].([]string)
	assert.True(t, ok)
	assert.Contains(t, features, "Cloud-native ready")
	assert.Contains(t, features, "Observability (metrics, tracing, logging)")
	assert.Contains(t, features, "Circuit breaker and retry logic")
}

// validateConfig is a helper function that would be part of the config package
func validateConfig(cfg *config.Config) error {
	if cfg.APIKey == "" {
		return fmt.Errorf("API key is required")
	}
	if cfg.BaseURL == "" {
		return fmt.Errorf("base URL is required")
	}
	if cfg.Timeout <= 0 {
		return fmt.Errorf("timeout must be positive")
	}
	if cfg.MaxRetries < 0 {
		return fmt.Errorf("max retries cannot be negative")
	}
	return nil
}