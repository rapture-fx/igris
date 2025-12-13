package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/spf13/viper"
)

// Config holds the configuration for the Schlep-engine client
type Config struct {
	// Authentication
	APIKey string `mapstructure:"api_key" json:"api_key"`

	// Connection settings
	BaseURL string        `mapstructure:"base_url" json:"base_url"`
	Timeout time.Duration `mapstructure:"timeout" json:"timeout"`

	// Retry configuration
	MaxRetries         int           `mapstructure:"max_retries" json:"max_retries"`
	RetryWaitTime      time.Duration `mapstructure:"retry_wait_time" json:"retry_wait_time"`
	RetryMaxWaitTime   time.Duration `mapstructure:"retry_max_wait_time" json:"retry_max_wait_time"`
	RetryBackoffFactor float64       `mapstructure:"retry_backoff_factor" json:"retry_backoff_factor"`

	// Circuit breaker configuration
	CircuitBreakerEnabled        bool          `mapstructure:"circuit_breaker_enabled" json:"circuit_breaker_enabled"`
	CircuitBreakerFailureThreshold uint32        `mapstructure:"circuit_breaker_failure_threshold" json:"circuit_breaker_failure_threshold"`
	CircuitBreakerTimeout        time.Duration `mapstructure:"circuit_breaker_timeout" json:"circuit_breaker_timeout"`
	CircuitBreakerMaxRequests    uint32        `mapstructure:"circuit_breaker_max_requests" json:"circuit_breaker_max_requests"`

	// Observability
	EnableMetrics      bool   `mapstructure:"enable_metrics" json:"enable_metrics"`
	EnableTracing      bool   `mapstructure:"enable_tracing" json:"enable_tracing"`
	EnableLogging      bool   `mapstructure:"enable_logging" json:"enable_logging"`
	LogLevel          string `mapstructure:"log_level" json:"log_level"`
	ServiceName       string `mapstructure:"service_name" json:"service_name"`
	ServiceVersion    string `mapstructure:"service_version" json:"service_version"`

	// HTTP Client configuration
	MaxIdleConns        int           `mapstructure:"max_idle_conns" json:"max_idle_conns"`
	MaxIdleConnsPerHost int           `mapstructure:"max_idle_conns_per_host" json:"max_idle_conns_per_host"`
	IdleConnTimeout     time.Duration `mapstructure:"idle_conn_timeout" json:"idle_conn_timeout"`
	DisableKeepAlives   bool          `mapstructure:"disable_keep_alives" json:"disable_keep_alives"`

	// Health checks
	EnableHealthChecks     bool          `mapstructure:"enable_health_checks" json:"enable_health_checks"`
	HealthCheckInterval    time.Duration `mapstructure:"health_check_interval" json:"health_check_interval"`
	HealthCheckTimeout     time.Duration `mapstructure:"health_check_timeout" json:"health_check_timeout"`

	// Rate limiting (client-side)
	EnableRateLimit bool `mapstructure:"enable_rate_limit" json:"enable_rate_limit"`
	RateLimit      int  `mapstructure:"rate_limit" json:"rate_limit"`     // requests per second
	RateBurst      int  `mapstructure:"rate_burst" json:"rate_burst"`     // burst capacity

	// User Agent
	UserAgent string `mapstructure:"user_agent" json:"user_agent"`

	// Custom headers
	CustomHeaders map[string]string `mapstructure:"custom_headers" json:"custom_headers"`

	// Development/Debug
	Debug                bool `mapstructure:"debug" json:"debug"`
	InsecureSkipVerify   bool `mapstructure:"insecure_skip_verify" json:"insecure_skip_verify"`
}

// DefaultConfig returns a configuration with sensible defaults for cloud-native applications
func DefaultConfig() *Config {
	return &Config{
		BaseURL:                      "https://api.igris-inertial.com",
		Timeout:                      30 * time.Second,
		MaxRetries:                   3,
		RetryWaitTime:               1 * time.Second,
		RetryMaxWaitTime:            30 * time.Second,
		RetryBackoffFactor:          2.0,
		CircuitBreakerEnabled:        true,
		CircuitBreakerFailureThreshold: 5,
		CircuitBreakerTimeout:        60 * time.Second,
		CircuitBreakerMaxRequests:    3,
		EnableMetrics:               true,
		EnableTracing:               true,
		EnableLogging:               true,
		LogLevel:                    "info",
		ServiceName:                 "igris-inertial-client",
		ServiceVersion:              "1.0.0",
		MaxIdleConns:                100,
		MaxIdleConnsPerHost:         10,
		IdleConnTimeout:             90 * time.Second,
		DisableKeepAlives:           false,
		EnableHealthChecks:          true,
		HealthCheckInterval:         30 * time.Second,
		HealthCheckTimeout:          5 * time.Second,
		EnableRateLimit:             false,
		RateLimit:                   100, // 100 requests per second
		RateBurst:                   200, // burst up to 200
		UserAgent:                   "igris-inertial-go-sdk/1.0.0",
		CustomHeaders:               make(map[string]string),
		Debug:                       false,
		InsecureSkipVerify:          false,
	}
}

// LoadConfig loads configuration from environment variables, config files, and defaults
func LoadConfig() (*Config, error) {
	config := DefaultConfig()

	// Load from environment variables first
	if err := loadFromEnv(config); err != nil {
		return nil, fmt.Errorf("failed to load environment variables: %w", err)
	}

	// Try to load from config file
	viper.SetConfigName("igris-inertial")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("$HOME/.igris-inertial")
	viper.AddConfigPath("/etc/igris-inertial")

	// Read config file if it exists
	if err := viper.ReadInConfig(); err == nil {
		if err := viper.Unmarshal(config); err != nil {
			return nil, fmt.Errorf("failed to unmarshal config file: %w", err)
		}
	}

	// Validate configuration
	if err := validateConfig(config); err != nil {
		return nil, fmt.Errorf("invalid configuration: %w", err)
	}

	return config, nil
}

// loadFromEnv loads configuration from environment variables
func loadFromEnv(config *Config) error {
	// Authentication
	if apiKey := os.Getenv("SCHLEP_API_KEY"); apiKey != "" {
		config.APIKey = apiKey
	}

	// Connection settings
	if baseURL := os.Getenv("SCHLEP_BASE_URL"); baseURL != "" {
		config.BaseURL = baseURL
	}

	if timeout := os.Getenv("SCHLEP_TIMEOUT"); timeout != "" {
		if d, err := time.ParseDuration(timeout); err == nil {
			config.Timeout = d
		}
	} else if timeoutSeconds := os.Getenv("SCHLEP_TIMEOUT_SECONDS"); timeoutSeconds != "" {
		if n, err := strconv.Atoi(timeoutSeconds); err == nil && n > 0 {
			config.Timeout = time.Duration(n) * time.Second
		}
	}

	// Retry configuration
	if maxRetries := os.Getenv("SCHLEP_MAX_RETRIES"); maxRetries != "" {
		if n, err := strconv.Atoi(maxRetries); err == nil && n >= 0 {
			config.MaxRetries = n
		}
	}

	if retryWait := os.Getenv("SCHLEP_RETRY_WAIT_TIME"); retryWait != "" {
		if d, err := time.ParseDuration(retryWait); err == nil {
			config.RetryWaitTime = d
		}
	} else if retryWaitSeconds := os.Getenv("SCHLEP_RETRY_WAIT_SECONDS"); retryWaitSeconds != "" {
		if n, err := strconv.Atoi(retryWaitSeconds); err == nil && n > 0 {
			config.RetryWaitTime = time.Duration(n) * time.Second
		}
	}

	if retryMaxWait := os.Getenv("SCHLEP_RETRY_MAX_WAIT_TIME"); retryMaxWait != "" {
		if d, err := time.ParseDuration(retryMaxWait); err == nil {
			config.RetryMaxWaitTime = d
		}
	} else if retryMaxWaitSeconds := os.Getenv("SCHLEP_RETRY_MAX_WAIT_SECONDS"); retryMaxWaitSeconds != "" {
		if n, err := strconv.Atoi(retryMaxWaitSeconds); err == nil && n > 0 {
			config.RetryMaxWaitTime = time.Duration(n) * time.Second
		}
	}

	if backoffFactor := os.Getenv("SCHLEP_RETRY_BACKOFF_FACTOR"); backoffFactor != "" {
		if f, err := strconv.ParseFloat(backoffFactor, 64); err == nil && f > 0 {
			config.RetryBackoffFactor = f
		}
	}

	// Circuit breaker configuration
	if cbEnabled := os.Getenv("SCHLEP_CIRCUIT_BREAKER_ENABLED"); cbEnabled != "" {
		if b, err := strconv.ParseBool(cbEnabled); err == nil {
			config.CircuitBreakerEnabled = b
		}
	}

	if cbThreshold := os.Getenv("SCHLEP_CB_FAILURE_THRESHOLD"); cbThreshold != "" {
		if n, err := strconv.ParseUint(cbThreshold, 10, 32); err == nil && n > 0 {
			config.CircuitBreakerFailureThreshold = uint32(n)
		}
	}

	if cbTimeout := os.Getenv("SCHLEP_CB_TIMEOUT"); cbTimeout != "" {
		if d, err := time.ParseDuration(cbTimeout); err == nil {
			config.CircuitBreakerTimeout = d
		}
	} else if cbTimeoutSeconds := os.Getenv("SCHLEP_CB_TIMEOUT_SECONDS"); cbTimeoutSeconds != "" {
		if n, err := strconv.Atoi(cbTimeoutSeconds); err == nil && n > 0 {
			config.CircuitBreakerTimeout = time.Duration(n) * time.Second
		}
	}

	if cbMaxRequests := os.Getenv("SCHLEP_CB_MAX_REQUESTS"); cbMaxRequests != "" {
		if n, err := strconv.ParseUint(cbMaxRequests, 10, 32); err == nil && n > 0 {
			config.CircuitBreakerMaxRequests = uint32(n)
		}
	}

	// Observability
	if enableMetrics := os.Getenv("SCHLEP_ENABLE_METRICS"); enableMetrics != "" {
		if b, err := strconv.ParseBool(enableMetrics); err == nil {
			config.EnableMetrics = b
		}
	}

	if enableTracing := os.Getenv("SCHLEP_ENABLE_TRACING"); enableTracing != "" {
		if b, err := strconv.ParseBool(enableTracing); err == nil {
			config.EnableTracing = b
		}
	}

	if enableLogging := os.Getenv("SCHLEP_ENABLE_LOGGING"); enableLogging != "" {
		if b, err := strconv.ParseBool(enableLogging); err == nil {
			config.EnableLogging = b
		}
	}

	if logLevel := os.Getenv("SCHLEP_LOG_LEVEL"); logLevel != "" {
		config.LogLevel = logLevel
	} else if logLevel := os.Getenv("LOG_LEVEL"); logLevel != "" {
		config.LogLevel = logLevel
	}

	if serviceName := os.Getenv("SCHLEP_SERVICE_NAME"); serviceName != "" {
		config.ServiceName = serviceName
	} else if serviceName := os.Getenv("SERVICE_NAME"); serviceName != "" {
		config.ServiceName = serviceName
	}

	if serviceVersion := os.Getenv("SCHLEP_SERVICE_VERSION"); serviceVersion != "" {
		config.ServiceVersion = serviceVersion
	} else if serviceVersion := os.Getenv("SERVICE_VERSION"); serviceVersion != "" {
		config.ServiceVersion = serviceVersion
	}

	// HTTP Client configuration
	if maxIdleConns := os.Getenv("SCHLEP_MAX_IDLE_CONNS"); maxIdleConns != "" {
		if n, err := strconv.Atoi(maxIdleConns); err == nil && n > 0 {
			config.MaxIdleConns = n
		}
	}

	if maxIdleConnsPerHost := os.Getenv("SCHLEP_MAX_IDLE_CONNS_PER_HOST"); maxIdleConnsPerHost != "" {
		if n, err := strconv.Atoi(maxIdleConnsPerHost); err == nil && n > 0 {
			config.MaxIdleConnsPerHost = n
		}
	}

	if idleConnTimeout := os.Getenv("SCHLEP_IDLE_CONN_TIMEOUT"); idleConnTimeout != "" {
		if d, err := time.ParseDuration(idleConnTimeout); err == nil {
			config.IdleConnTimeout = d
		}
	} else if idleConnTimeoutSeconds := os.Getenv("SCHLEP_IDLE_CONN_TIMEOUT_SECONDS"); idleConnTimeoutSeconds != "" {
		if n, err := strconv.Atoi(idleConnTimeoutSeconds); err == nil && n > 0 {
			config.IdleConnTimeout = time.Duration(n) * time.Second
		}
	}

	if disableKeepAlives := os.Getenv("SCHLEP_DISABLE_KEEP_ALIVES"); disableKeepAlives != "" {
		if b, err := strconv.ParseBool(disableKeepAlives); err == nil {
			config.DisableKeepAlives = b
		}
	}

	// Health checks
	if enableHealthChecks := os.Getenv("SCHLEP_ENABLE_HEALTH_CHECKS"); enableHealthChecks != "" {
		if b, err := strconv.ParseBool(enableHealthChecks); err == nil {
			config.EnableHealthChecks = b
		}
	}

	if healthCheckInterval := os.Getenv("SCHLEP_HEALTH_CHECK_INTERVAL"); healthCheckInterval != "" {
		if d, err := time.ParseDuration(healthCheckInterval); err == nil {
			config.HealthCheckInterval = d
		}
	} else if healthCheckIntervalSeconds := os.Getenv("SCHLEP_HEALTH_CHECK_INTERVAL_SECONDS"); healthCheckIntervalSeconds != "" {
		if n, err := strconv.Atoi(healthCheckIntervalSeconds); err == nil && n > 0 {
			config.HealthCheckInterval = time.Duration(n) * time.Second
		}
	}

	if healthCheckTimeout := os.Getenv("SCHLEP_HEALTH_CHECK_TIMEOUT"); healthCheckTimeout != "" {
		if d, err := time.ParseDuration(healthCheckTimeout); err == nil {
			config.HealthCheckTimeout = d
		}
	} else if healthCheckTimeoutSeconds := os.Getenv("SCHLEP_HEALTH_CHECK_TIMEOUT_SECONDS"); healthCheckTimeoutSeconds != "" {
		if n, err := strconv.Atoi(healthCheckTimeoutSeconds); err == nil && n > 0 {
			config.HealthCheckTimeout = time.Duration(n) * time.Second
		}
	}

	// Rate limiting
	if enableRateLimit := os.Getenv("SCHLEP_ENABLE_RATE_LIMIT"); enableRateLimit != "" {
		if b, err := strconv.ParseBool(enableRateLimit); err == nil {
			config.EnableRateLimit = b
		}
	}

	if rateLimit := os.Getenv("SCHLEP_RATE_LIMIT"); rateLimit != "" {
		if n, err := strconv.Atoi(rateLimit); err == nil && n > 0 {
			config.RateLimit = n
		}
	} else if rateLimitRPS := os.Getenv("SCHLEP_RATE_LIMIT_RPS"); rateLimitRPS != "" {
		if n, err := strconv.Atoi(rateLimitRPS); err == nil && n > 0 {
			config.RateLimit = n
		}
	}

	if rateBurst := os.Getenv("SCHLEP_RATE_BURST"); rateBurst != "" {
		if n, err := strconv.Atoi(rateBurst); err == nil && n > 0 {
			config.RateBurst = n
		}
	}

	// User Agent
	if userAgent := os.Getenv("SCHLEP_USER_AGENT"); userAgent != "" {
		config.UserAgent = userAgent
	}

	// Development/Debug
	if debug := os.Getenv("SCHLEP_DEBUG"); debug != "" {
		if b, err := strconv.ParseBool(debug); err == nil {
			config.Debug = b
		}
	} else if debug := os.Getenv("DEBUG"); debug != "" {
		if b, err := strconv.ParseBool(debug); err == nil {
			config.Debug = b
		}
	}

	if insecureSkipVerify := os.Getenv("SCHLEP_INSECURE_SKIP_VERIFY"); insecureSkipVerify != "" {
		if b, err := strconv.ParseBool(insecureSkipVerify); err == nil {
			config.InsecureSkipVerify = b
		}
	}

	return nil
}

// validateConfig validates the configuration
func validateConfig(config *Config) error {
	if config.APIKey == "" {
		return fmt.Errorf("API key is required")
	}

	if config.BaseURL == "" {
		return fmt.Errorf("base URL is required")
	}

	if config.Timeout <= 0 {
		return fmt.Errorf("timeout must be positive")
	}

	if config.MaxRetries < 0 {
		return fmt.Errorf("max retries cannot be negative")
	}

	if config.CircuitBreakerFailureThreshold == 0 {
		return fmt.Errorf("circuit breaker failure threshold must be positive")
	}

	return nil
}

// GetSDKInfo returns SDK information for debugging and support
func GetSDKInfo() map[string]interface{} {
	return map[string]interface{}{
		"name":         "Schlep-engine Go SDK",
		"version":      "1.0.0",
		"company":      "Schlep-engine",
		"description":  "Official Go SDK for Schlep-engine API - Cloud-native data processing platform",
		"documentation": "https://docs.igris-inertial.com/sdk/go",
		"support":      "https://support.igris-inertial.com",
		"github":       "https://github.com/igris-inertial/go-sdk",
		"go_version":   "1.21+",
		"features": []string{
			"Cloud-native ready",
			"Observability (metrics, tracing, logging)",
			"Circuit breaker and retry logic",
			"Context support",
			"Health checks",
			"Configuration management",
		},
	}
}