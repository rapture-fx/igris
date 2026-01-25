package config

import (
	"sync"
	"time"

	"github.com/Igris-inertial/system/igris-overture/inference/optimizer/ffi"
	"github.com/Igris-inertial/system/igris-overture/inference/optimizer/shadow"
)

// OptimizerConfig holds configuration for the optimizer
type OptimizerConfig struct {
	Mode       shadow.ShadowMode
	SampleRate float64
	LogDir     string
	AdminToken string // Required for admin API authentication
}

// RuntimeOptimizerConfig holds the runtime configuration with hot-reload support
type RuntimeOptimizerConfig struct {
	mu         sync.RWMutex
	mode       shadow.ShadowMode
	sampleRate float64
	logDir     string
	adminToken string
	updatedAt  time.Time
}

// Global runtime configuration instance
var globalRuntimeConfig *RuntimeOptimizerConfig
var configInitOnce sync.Once

// LoadOptimizerConfig loads optimizer configuration from environment variables
func LoadOptimizerConfig() OptimizerConfig {
	config := OptimizerConfig{
		Mode:       shadow.ShadowMode(getEnv("OPTIMIZER_MODE", "shadow")),
		SampleRate: getEnvFloat("OPTIMIZER_SAMPLE_RATE", 0.0),
		LogDir:     getEnv("OPTIMIZER_LOG_DIR", "logs/optimizer"),
		AdminToken: getEnv("ADMIN_TOKEN", ""),
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

// InitRuntimeConfig initializes the global runtime configuration
func InitRuntimeConfig(config OptimizerConfig) {
	configInitOnce.Do(func() {
		globalRuntimeConfig = &RuntimeOptimizerConfig{
			mode:       config.Mode,
			sampleRate: config.SampleRate,
			logDir:     config.LogDir,
			adminToken: config.AdminToken,
			updatedAt:  time.Now(),
		}
	})
}

// GetRuntimeConfig returns the global runtime configuration
func GetRuntimeConfig() *RuntimeOptimizerConfig {
	if globalRuntimeConfig == nil {
		// Initialize with defaults if not yet initialized
		InitRuntimeConfig(LoadOptimizerConfig())
	}
	return globalRuntimeConfig
}

// GetMode returns the current optimizer mode
func (r *RuntimeOptimizerConfig) GetMode() shadow.ShadowMode {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.mode
}

// SetMode sets the optimizer mode (hot-reload)
func (r *RuntimeOptimizerConfig) SetMode(mode shadow.ShadowMode) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.mode = mode
	r.updatedAt = time.Now()
}

// GetSampleRate returns the current sample rate
func (r *RuntimeOptimizerConfig) GetSampleRate() float64 {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.sampleRate
}

// SetSampleRate sets the sample rate (hot-reload)
func (r *RuntimeOptimizerConfig) SetSampleRate(rate float64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	// Clamp to [0, 1]
	if rate < 0 {
		rate = 0
	} else if rate > 1 {
		rate = 1
	}
	r.sampleRate = rate
	r.updatedAt = time.Now()
}

// GetAdminToken returns the admin API token
func (r *RuntimeOptimizerConfig) GetAdminToken() string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.adminToken
}

// GetUpdatedAt returns the last update timestamp
func (r *RuntimeOptimizerConfig) GetUpdatedAt() time.Time {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.updatedAt
}

// Snapshot returns a snapshot of the current configuration
func (r *RuntimeOptimizerConfig) Snapshot() OptimizerConfig {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return OptimizerConfig{
		Mode:       r.mode,
		SampleRate: r.sampleRate,
		LogDir:     r.logDir,
		AdminToken: r.adminToken,
	}
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
