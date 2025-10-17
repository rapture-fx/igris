package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all application configuration
type Config struct {
	// Server
	ServerPort        string
	ServerHost        string
	Environment       string
	AppVersion        string
	ShutdownTimeout   time.Duration
	ReadTimeout       time.Duration
	WriteTimeout      time.Duration
	IdleTimeout       time.Duration

	// Database
	DatabaseURL       string
	DBMaxOpenConns    int
	DBMaxIdleConns    int
	DBConnMaxLifetime time.Duration

	// Redis
	RedisURL          string
	RedisPassword     string
	RedisDB           int

	// Services
	MLServiceURL      string
	PythonAPIURL      string

	// Security
	JWTSecret         string
	JWTExpiration     time.Duration
	AllowedOrigins    []string

	// Rate Limiting
	RateLimitEnabled  bool
	RateLimitPerMin   int
	RateLimitPerHour  int

	// Observability
	EnableMetrics     bool
	EnableTracing     bool
	LogLevel          string
	LogFormat         string // "json" or "text"

	// Feature Flags
	EnableRustFFI     bool
	EnableMLService   bool
	RouteToPython     bool // Fallback to Python for non-migrated endpoints
}

// Load loads configuration from environment variables with sensible defaults
func Load() *Config {
	return &Config{
		// Server
		ServerPort:        getEnv("SERVER_PORT", "8080"),
		ServerHost:        getEnv("SERVER_HOST", "0.0.0.0"),
		Environment:       getEnv("ENVIRONMENT", "development"),
		AppVersion:        getEnv("APP_VERSION", "1.0.0"),
		ShutdownTimeout:   getDurationEnv("SHUTDOWN_TIMEOUT", 30*time.Second),
		ReadTimeout:       getDurationEnv("READ_TIMEOUT", 30*time.Second),
		WriteTimeout:      getDurationEnv("WRITE_TIMEOUT", 30*time.Second),
		IdleTimeout:       getDurationEnv("IDLE_TIMEOUT", 120*time.Second),

		// Database
		DatabaseURL:       getEnv("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/schlep_engine?sslmode=disable"),
		DBMaxOpenConns:    getIntEnv("DB_MAX_OPEN_CONNS", 25),
		DBMaxIdleConns:    getIntEnv("DB_MAX_IDLE_CONNS", 5),
		DBConnMaxLifetime: getDurationEnv("DB_CONN_MAX_LIFETIME", 5*time.Minute),

		// Redis
		RedisURL:          getEnv("REDIS_URL", "redis://redis:6379/0"),
		RedisPassword:     getEnv("REDIS_PASSWORD", ""),
		RedisDB:           getIntEnv("REDIS_DB", 0),

		// Services
		MLServiceURL:      getEnv("ML_SERVICE_URL", "python-ml:50051"),
		PythonAPIURL:      getEnv("PYTHON_API_URL", "http://python-api-legacy:8000"),

		// Security
		JWTSecret:         getEnv("JWT_SECRET", "your-secret-key-change-in-production"),
		JWTExpiration:     getDurationEnv("JWT_EXPIRATION", 24*time.Hour),
		AllowedOrigins:    []string{getEnv("ALLOWED_ORIGINS", "*")},

		// Rate Limiting
		RateLimitEnabled:  getBoolEnv("RATE_LIMIT_ENABLED", true),
		RateLimitPerMin:   getIntEnv("RATE_LIMIT_PER_MIN", 100),
		RateLimitPerHour:  getIntEnv("RATE_LIMIT_PER_HOUR", 1000),

		// Observability
		EnableMetrics:     getBoolEnv("ENABLE_METRICS", true),
		EnableTracing:     getBoolEnv("ENABLE_TRACING", true),
		LogLevel:          getEnv("LOG_LEVEL", "info"),
		LogFormat:         getEnv("LOG_FORMAT", "json"),

		// Feature Flags
		EnableRustFFI:     getBoolEnv("ENABLE_RUST_FFI", true),
		EnableMLService:   getBoolEnv("ENABLE_ML_SERVICE", true),
		RouteToPython:     getBoolEnv("ROUTE_TO_PYTHON", true),
	}
}

// Helper functions

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getIntEnv(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getBoolEnv(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolVal, err := strconv.ParseBool(value); err == nil {
			return boolVal
		}
	}
	return defaultValue
}

func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}

// IsDevelopment returns true if running in development environment
func (c *Config) IsDevelopment() bool {
	return c.Environment == "development"
}

// IsProduction returns true if running in production environment
func (c *Config) IsProduction() bool {
	return c.Environment == "production"
}
