package health

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// HealthStatus represents the health status of a component
type HealthStatus string

const (
	StatusHealthy   HealthStatus = "healthy"
	StatusDegraded  HealthStatus = "degraded"
	StatusUnhealthy HealthStatus = "unhealthy"
)

// ComponentHealth represents the health of a single component
type ComponentHealth struct {
	Status      HealthStatus       `json:"status"`
	Message     string             `json:"message,omitempty"`
	Latency     string             `json:"latency,omitempty"`
	LastChecked time.Time          `json:"last_checked"`
	Details     map[string]interface{} `json:"details,omitempty"`
}

// OverallHealth represents the overall system health
type OverallHealth struct {
	Status     HealthStatus               `json:"status"`
	Version    string                     `json:"version"`
	Uptime     string                     `json:"uptime"`
	Timestamp  time.Time                  `json:"timestamp"`
	Components map[string]ComponentHealth `json:"components"`
}

// HealthChecker provides health check functionality
type HealthChecker struct {
	db          *sql.DB
	redis       *redis.Client
	startTime   time.Time
	version     string
	dbEnabled   bool
	redisEnabled bool
}

// NewHealthChecker creates a new health checker
func NewHealthChecker(version string) *HealthChecker {
	return &HealthChecker{
		startTime: time.Now(),
		version:   version,
	}
}

// SetDatabase configures database for health checks
func (hc *HealthChecker) SetDatabase(db *sql.DB, enabled bool) {
	hc.db = db
	hc.dbEnabled = enabled
}

// SetRedis configures Redis for health checks
func (hc *HealthChecker) SetRedis(client *redis.Client, enabled bool) {
	hc.redis = client
	hc.redisEnabled = enabled
}

// CheckHealth performs all health checks and returns overall status
func (hc *HealthChecker) CheckHealth(ctx context.Context) *OverallHealth {
	health := &OverallHealth{
		Status:     StatusHealthy,
		Version:    hc.version,
		Uptime:     time.Since(hc.startTime).String(),
		Timestamp:  time.Now(),
		Components: make(map[string]ComponentHealth),
	}

	// Check database
	if hc.dbEnabled && hc.db != nil {
		health.Components["database"] = hc.checkDatabase(ctx)
	}

	// Check Redis
	if hc.redisEnabled && hc.redis != nil {
		health.Components["redis"] = hc.checkRedis(ctx)
	}

	// Always check memory and basic health
	health.Components["application"] = hc.checkApplication()

	// Determine overall status
	for _, component := range health.Components {
		if component.Status == StatusUnhealthy {
			health.Status = StatusUnhealthy
			break
		} else if component.Status == StatusDegraded && health.Status == StatusHealthy {
			health.Status = StatusDegraded
		}
	}

	return health
}

// CheckLiveness performs a basic liveness check
func (hc *HealthChecker) CheckLiveness() bool {
	// Liveness: Is the application running?
	// This is always true if we can execute this code
	return true
}

// CheckReadiness performs a readiness check
func (hc *HealthChecker) CheckReadiness(ctx context.Context) bool {
	// Readiness: Can the application serve traffic?
	// Check critical dependencies

	// Check database if enabled
	if hc.dbEnabled && hc.db != nil {
		if err := hc.db.PingContext(ctx); err != nil {
			return false
		}
	}

	// Check Redis if enabled
	if hc.redisEnabled && hc.redis != nil {
		if err := hc.redis.Ping(ctx).Err(); err != nil {
			return false
		}
	}

	return true
}

// checkDatabase checks database connectivity and performance
func (hc *HealthChecker) checkDatabase(ctx context.Context) ComponentHealth {
	start := time.Now()
	health := ComponentHealth{
		LastChecked: time.Now(),
		Details:     make(map[string]interface{}),
	}

	// Ping database
	err := hc.db.PingContext(ctx)
	latency := time.Since(start)
	health.Latency = latency.String()

	if err != nil {
		health.Status = StatusUnhealthy
		health.Message = fmt.Sprintf("Database ping failed: %v", err)
		return health
	}

	// Check connection stats
	stats := hc.db.Stats()
	health.Details["open_connections"] = stats.OpenConnections
	health.Details["in_use"] = stats.InUse
	health.Details["idle"] = stats.Idle
	health.Details["max_open_connections"] = stats.MaxOpenConnections

	// Degraded if latency > 100ms
	if latency > 100*time.Millisecond {
		health.Status = StatusDegraded
		health.Message = "Database responding slowly"
	} else {
		health.Status = StatusHealthy
		health.Message = "Database connection healthy"
	}

	return health
}

// checkRedis checks Redis connectivity and performance
func (hc *HealthChecker) checkRedis(ctx context.Context) ComponentHealth {
	start := time.Now()
	health := ComponentHealth{
		LastChecked: time.Now(),
		Details:     make(map[string]interface{}),
	}

	// Ping Redis
	err := hc.redis.Ping(ctx).Err()
	latency := time.Since(start)
	health.Latency = latency.String()

	if err != nil {
		health.Status = StatusUnhealthy
		health.Message = fmt.Sprintf("Redis ping failed: %v", err)
		return health
	}

	// Get info
	if info, err := hc.redis.Info(ctx, "stats").Result(); err == nil {
		health.Details["redis_info_available"] = true
		// Could parse info here if needed
		_ = info
	}

	// Degraded if latency > 50ms
	if latency > 50*time.Millisecond {
		health.Status = StatusDegraded
		health.Message = "Redis responding slowly"
	} else {
		health.Status = StatusHealthy
		health.Message = "Redis connection healthy"
	}

	return health
}

// checkApplication checks basic application health
func (hc *HealthChecker) checkApplication() ComponentHealth {
	health := ComponentHealth{
		Status:      StatusHealthy,
		Message:     "Application running",
		LastChecked: time.Now(),
		Details:     make(map[string]interface{}),
	}

	health.Details["uptime"] = time.Since(hc.startTime).String()
	health.Details["version"] = hc.version

	return health
}
