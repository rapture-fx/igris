package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all application configuration
type Config struct {
	Server          ServerConfig
	TLS             TLSConfig
	MLService       MLServiceConfig
	CircuitBreaker  CircuitBreakerConfig
	Validation      ValidationConfig
	Observability   ObservabilityConfig
	RateLimit       RateLimitConfig
	Security        SecurityConfig
}

// ServerConfig holds server configuration
type ServerConfig struct {
	Port        string
	Host        string
	Environment string
}

// TLSConfig holds TLS configuration
type TLSConfig struct {
	Enabled  bool
	CertFile string
	KeyFile  string
}

// MLServiceConfig holds ML service configuration
type MLServiceConfig struct {
	Address    string
	Timeout    time.Duration
	MaxRetries int
}

// CircuitBreakerConfig holds circuit breaker configuration
type CircuitBreakerConfig struct {
	Name        string
	MaxRequests uint32
	Interval    time.Duration
	Timeout     time.Duration
	Threshold   float64
}

// ValidationConfig holds validation configuration
type ValidationConfig struct {
	MaxFeatures    int
	RequireTraceID bool
}

// ObservabilityConfig holds observability configuration
type ObservabilityConfig struct {
	MetricsEnabled bool
	MetricsPort    string
	TracingEnabled bool
	TracingEndpoint string
	LogLevel       string
	LogFormat      string
}

// RateLimitConfig holds rate limiting configuration
type RateLimitConfig struct {
	Enabled            bool
	RequestsPerSecond  int
	Burst              int
}

// SecurityConfig holds security configuration
type SecurityConfig struct {
	JWTSecret    string
	CORSEnabled  bool
	CORSOrigins  string
	AllowedHosts string
}

// LoadConfig loads configuration from environment variables
func LoadConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Port:        getEnv("PORT", "8080"),
			Host:        getEnv("HOST", "0.0.0.0"),
			Environment: getEnv("ENV", "development"),
		},
		TLS: TLSConfig{
			Enabled:  getEnvBool("TLS_ENABLED", false),
			CertFile: getEnv("TLS_CERT_FILE", ""),
			KeyFile:  getEnv("TLS_KEY_FILE", ""),
		},
		MLService: MLServiceConfig{
			Address:    getEnv("ML_SERVICE_ADDRESS", "python-ml:50051"),
			Timeout:    getEnvDuration("ML_SERVICE_TIMEOUT", 30*time.Second),
			MaxRetries: getEnvInt("ML_SERVICE_MAX_RETRIES", 3),
		},
		CircuitBreaker: CircuitBreakerConfig{
			Name:        getEnv("CIRCUIT_BREAKER_NAME", "ML-Service"),
			MaxRequests: uint32(getEnvInt("CIRCUIT_BREAKER_MAX_REQUESTS", 3)),
			Interval:    getEnvDuration("CIRCUIT_BREAKER_INTERVAL", 10*time.Second),
			Timeout:     getEnvDuration("CIRCUIT_BREAKER_TIMEOUT", 30*time.Second),
			Threshold:   getEnvFloat("CIRCUIT_BREAKER_THRESHOLD", 0.5),
		},
		Validation: ValidationConfig{
			MaxFeatures:    getEnvInt("VALIDATION_MAX_FEATURES", 10000),
			RequireTraceID: getEnvBool("VALIDATION_REQUIRE_TRACE_ID", true),
		},
		Observability: ObservabilityConfig{
			MetricsEnabled:  getEnvBool("METRICS_ENABLED", true),
			MetricsPort:     getEnv("METRICS_PORT", "9090"),
			TracingEnabled:  getEnvBool("TRACING_ENABLED", false),
			TracingEndpoint: getEnv("TRACING_ENDPOINT", ""),
			LogLevel:        getEnv("LOG_LEVEL", "info"),
			LogFormat:       getEnv("LOG_FORMAT", "json"),
		},
		RateLimit: RateLimitConfig{
			Enabled:           getEnvBool("RATE_LIMIT_ENABLED", true),
			RequestsPerSecond: getEnvInt("RATE_LIMIT_REQUESTS_PER_SECOND", 100),
			Burst:             getEnvInt("RATE_LIMIT_BURST", 200),
		},
		Security: SecurityConfig{
			JWTSecret:    getEnv("JWT_SECRET", "change-this-secret"),
			CORSEnabled:  getEnvBool("CORS_ENABLED", true),
			CORSOrigins:  getEnv("CORS_ORIGINS", "*"),
			AllowedHosts: getEnv("ALLOWED_HOSTS", "localhost"),
		},
	}
}

// Helper functions for environment variable parsing

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolVal, err := strconv.ParseBool(value); err == nil {
			return boolVal
		}
	}
	return defaultValue
}

func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatVal, err := strconv.ParseFloat(value, 64); err == nil {
			return floatVal
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
