package config

import (
	"os"
	"strconv"

	"github.com/schlep-engine/schlep-engine/internal/inference/optimizer/ffi"
	"github.com/schlep-engine/schlep-engine/internal/inference/optimizer/shadow"
)

// OptimizerConfig holds configuration for the optimizer
type OptimizerConfig struct {
	Mode       shadow.ShadowMode
	SampleRate float64
	LogDir     string
}

// LoadOptimizerConfig loads optimizer configuration from environment variables
func LoadOptimizerConfig() OptimizerConfig {
	config := OptimizerConfig{
		Mode:       shadow.ShadowMode(getEnv("OPTIMIZER_MODE", "shadow")),
		SampleRate: getEnvFloat("OPTIMIZER_SAMPLE_RATE", 1.0),
		LogDir:     getEnv("OPTIMIZER_LOG_DIR", "logs/optimizer"),
	}

	// Validate mode
	switch config.Mode {
	case shadow.ShadowModeDisabled, shadow.ShadowModeShadow, shadow.ShadowModeGo, shadow.ShadowModeRust:
		// Valid mode
	default:
		// Default to shadow mode for invalid values
		config.Mode = shadow.ShadowModeShadow
	}

	// Clamp sample rate to [0, 1]
	if config.SampleRate < 0 {
		config.SampleRate = 0
	} else if config.SampleRate > 1 {
		config.SampleRate = 1
	}

	return config
}

// CreateShadowConfig creates a shadow config from optimizer config
func CreateShadowConfig(optConfig OptimizerConfig) shadow.ShadowConfig {
	return shadow.ShadowConfig{
		Mode:         optConfig.Mode,
		SampleRate:   optConfig.SampleRate,
		LogDir:       optConfig.LogDir,
		OptimizerCfg: ffi.DefaultConfig(),
	}
}

// getEnv gets an environment variable with a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvFloat gets a float environment variable with a default value
func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseFloat(value, 64); err == nil {
			return parsed
		}
	}
	return defaultValue
}
