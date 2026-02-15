// Package database provides database connection management and configuration
// for the Igris Inertial persistence layer (Phase 13+).
//
// This package enables optional PostgreSQL persistence for budget tracking,
// policy storage, and audit logging while maintaining backward compatibility
// with in-memory-only operation.
package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq" // PostgreSQL driver
)

// Config holds database configuration settings
type Config struct {
	// Database connection URL (e.g., "postgres://user:pass@localhost:5432/igris?sslmode=disable")
	DatabaseURL string

	// Connection pool settings
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	ConnMaxIdleTime time.Duration

	// Enable persistence (false = in-memory only mode)
	EnablePersistence bool

	// Fail if database connection cannot be established
	FailFastOnError bool

	// Enable query logging for debugging
	EnableQueryLogging bool
}

// DB wraps the database connection with additional helper methods
type DB struct {
	*sql.DB
	config *Config
	logger *log.Logger
}

// NewConfig creates a database configuration from environment variables
// Environment variables:
//   - DATABASE_URL or POSTGRES_URL: PostgreSQL connection string
//   - ENABLE_PERSISTENCE: Enable database persistence (default: false for backward compatibility)
//   - DB_MAX_OPEN_CONNS: Maximum open connections (default: 25)
//   - DB_MAX_IDLE_CONNS: Maximum idle connections (default: 5)
//   - DB_CONN_MAX_LIFETIME: Connection max lifetime in minutes (default: 15)
//   - DB_CONN_MAX_IDLE_TIME: Connection max idle time in minutes (default: 5)
//   - DB_FAIL_FAST: Fail on database connection error (default: false)
//   - DB_ENABLE_QUERY_LOGGING: Enable query logging (default: false)
func NewConfig() *Config {
	// Try DATABASE_URL first, then POSTGRES_URL for compatibility
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = os.Getenv("POSTGRES_URL")
	}

	// Default to disabled for backward compatibility
	enablePersistence := getEnvBool("ENABLE_PERSISTENCE", false)

	// Only enable persistence if URL is provided AND explicitly enabled
	if databaseURL == "" {
		enablePersistence = false
	}

	// P0-5 FIX: Increase connection pool limits for high concurrency (50k RPS)
	config := &Config{
		DatabaseURL:        databaseURL,
		MaxOpenConns:       getEnvInt("DB_MAX_OPEN_CONNS", 500),         // P0-5: Was 25, now 500
		MaxIdleConns:       getEnvInt("DB_MAX_IDLE_CONNS", 100),         // P0-5: Was 5, now 100
		ConnMaxLifetime:    time.Duration(getEnvInt("DB_CONN_MAX_LIFETIME", 5)) * time.Minute,  // P0-5: Was 15min, now 5min
		ConnMaxIdleTime:    time.Duration(getEnvInt("DB_CONN_MAX_IDLE_TIME", 30)) * time.Second, // P0-5: Was 5min, now 30sec
		EnablePersistence:  enablePersistence,
		FailFastOnError:    getEnvBool("DB_FAIL_FAST", false),
		EnableQueryLogging: getEnvBool("DB_ENABLE_QUERY_LOGGING", false),
	}

	return config
}

// Connect establishes a connection to the database
func Connect(config *Config) (*DB, error) {
	if !config.EnablePersistence {
		log.Println("[Database] Persistence disabled - using in-memory mode only")
		return nil, nil
	}

	if config.DatabaseURL == "" {
		err := fmt.Errorf("database URL not configured")
		if config.FailFastOnError {
			return nil, err
		}
		log.Printf("[Database] Warning: %v - falling back to in-memory mode\n", err)
		return nil, nil
	}

	log.Println("[Database] Connecting to PostgreSQL...")

	// Open database connection
	sqlDB, err := sql.Open("postgres", config.DatabaseURL)
	if err != nil {
		if config.FailFastOnError {
			return nil, fmt.Errorf("failed to open database: %w", err)
		}
		log.Printf("[Database] Warning: Failed to open database: %v - falling back to in-memory mode\n", err)
		return nil, nil
	}

	// Configure connection pool
	sqlDB.SetMaxOpenConns(config.MaxOpenConns)
	sqlDB.SetMaxIdleConns(config.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(config.ConnMaxLifetime)
	sqlDB.SetConnMaxIdleTime(config.ConnMaxIdleTime)

	// Test connection with retry logic
	maxRetries := 3
	var pingErr error
	for i := 0; i < maxRetries; i++ {
		pingErr = sqlDB.Ping()
		if pingErr == nil {
			break
		}
		if i < maxRetries-1 {
			log.Printf("[Database] Connection attempt %d/%d failed: %v - retrying...\n", i+1, maxRetries, pingErr)
			time.Sleep(time.Second * time.Duration(i+1))
		}
	}

	if pingErr != nil {
		sqlDB.Close()
		if config.FailFastOnError {
			return nil, fmt.Errorf("failed to ping database after %d retries: %w", maxRetries, pingErr)
		}
		log.Printf("[Database] Warning: Failed to ping database after %d retries: %v - falling back to in-memory mode\n", maxRetries, pingErr)
		return nil, nil
	}

	db := &DB{
		DB:     sqlDB,
		config: config,
		logger: log.New(os.Stdout, "[Database] ", log.LstdFlags),
	}

	log.Printf("[Database] Connected successfully (max_open=%d, max_idle=%d)\n",
		config.MaxOpenConns, config.MaxIdleConns)

	return db, nil
}

// IsEnabled returns whether database persistence is enabled and connected
func (db *DB) IsEnabled() bool {
	return db != nil && db.DB != nil
}

// HealthCheck performs a database health check
func (db *DB) HealthCheck() error {
	if !db.IsEnabled() {
		return fmt.Errorf("database not enabled")
	}

	ctx, cancel := getContext(5 * time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return fmt.Errorf("database health check failed: %w", err)
	}

	return nil
}

// Stats returns database connection pool statistics
func (db *DB) Stats() sql.DBStats {
	if !db.IsEnabled() {
		return sql.DBStats{}
	}
	return db.DB.Stats()
}

// LogStats logs current database connection pool statistics
func (db *DB) LogStats() {
	if !db.IsEnabled() {
		return
	}

	stats := db.Stats()
	db.logger.Printf(
		"Pool stats: open=%d idle=%d in_use=%d wait_count=%d wait_duration=%s max_idle_closed=%d max_lifetime_closed=%d\n",
		stats.OpenConnections,
		stats.Idle,
		stats.InUse,
		stats.WaitCount,
		stats.WaitDuration,
		stats.MaxIdleClosed,
		stats.MaxLifetimeClosed,
	)
}

// Close gracefully closes the database connection
func (db *DB) Close() error {
	if !db.IsEnabled() {
		return nil
	}

	db.logger.Println("Closing database connection...")
	if err := db.DB.Close(); err != nil {
		return fmt.Errorf("failed to close database: %w", err)
	}

	db.logger.Println("Database connection closed successfully")
	return nil
}

// InitializeSchema initializes the database schema if needed
// This is a convenience method for development; in production, use migrations
func (db *DB) InitializeSchema(schemaPath string) error {
	if !db.IsEnabled() {
		return fmt.Errorf("database not enabled")
	}

	db.logger.Printf("Initializing schema from %s...\n", schemaPath)

	// Read schema file
	schemaSQL, err := os.ReadFile(schemaPath)
	if err != nil {
		return fmt.Errorf("failed to read schema file: %w", err)
	}

	// Execute schema
	ctx, cancel := getContext(30 * time.Second)
	defer cancel()

	if _, err := db.ExecContext(ctx, string(schemaSQL)); err != nil {
		return fmt.Errorf("failed to execute schema: %w", err)
	}

	db.logger.Println("Schema initialized successfully")
	return nil
}

// Transaction helpers

// WithTransaction executes a function within a database transaction
func (db *DB) WithTransaction(fn func(*sql.Tx) error) error {
	if !db.IsEnabled() {
		return fmt.Errorf("database not enabled")
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Execute function
	if err := fn(tx); err != nil {
		if rbErr := tx.Rollback(); rbErr != nil {
			return fmt.Errorf("transaction error: %w (rollback failed: %v)", err, rbErr)
		}
		return err
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// Helper functions

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		var intValue int
		if _, err := fmt.Sscanf(value, "%d", &intValue); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		return value == "true" || value == "1" || value == "yes"
	}
	return defaultValue
}

// getContext creates a context with timeout
func getContext(timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), timeout)
}
