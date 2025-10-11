// Package policy provides the Control Surface Interface for policy orchestration.
//
// Exposes REST endpoints for external orchestration and policy introspection:
// - POST /policy/update: Update active policy
// - GET /policy/inspect: Inspect current policy and metrics
// - POST /policy/rollback: Rollback to previous version
// - GET /policy/metrics: Get policy engine metrics
package policy

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

// PolicyUpdate represents a policy update request/response
type PolicyUpdate struct {
	Timestamp      int64          `json:"timestamp"`
	Routing        RoutingPolicy  `json:"routing"`
	Batching       BatchingPolicy `json:"batching"`
	Confidence     float64        `json:"confidence"`
	TriggerMetrics TelemetryData  `json:"trigger_metrics"`
	Version        uint32         `json:"version"`
}

// RoutingPolicy defines routing parameters
type RoutingPolicy struct {
	PrimaryEndpoint         string  `json:"primary_endpoint"`
	FallbackEndpoint        string  `json:"fallback_endpoint"`
	TrafficSplit            float64 `json:"traffic_split"`
	CircuitBreakerThreshold uint32  `json:"circuit_breaker_threshold"`
	TimeoutMS               uint64  `json:"timeout_ms"`
}

// BatchingPolicy defines batching parameters
type BatchingPolicy struct {
	BatchSize           int    `json:"batch_size"`
	MaxWaitMS           uint64 `json:"max_wait_ms"`
	DynamicSizing       bool   `json:"dynamic_sizing"`
	TimeoutThresholdMS  uint64 `json:"timeout_threshold_ms"`
}

// TelemetryData represents telemetry snapshot
type TelemetryData struct {
	AvgLatencyMS     float64 `json:"avg_latency_ms"`
	P95LatencyMS     float64 `json:"p95_latency_ms"`
	CacheHitRate     float64 `json:"cache_hit_rate"`
	ThroughputRPS    float64 `json:"throughput_rps"`
	ErrorRate        float64 `json:"error_rate"`
	CPUUtilization   float64 `json:"cpu_utilization"`
	MemoryUtilization float64 `json:"memory_utilization"`
	CostEfficiency   float64 `json:"cost_efficiency"`
}

// PolicyMetrics represents policy engine performance metrics
type PolicyMetrics struct {
	TotalUpdates        uint64  `json:"total_updates"`
	SuccessfulUpdates   uint64  `json:"successful_updates"`
	RejectedUpdates     uint64  `json:"rejected_updates"`
	Rollbacks           uint64  `json:"rollbacks"`
	AvgConfidence       float64 `json:"avg_confidence"`
	LastUpdateLatencyMS float64 `json:"last_update_latency_ms"`
}

// ControlSurfaceConfig configuration for the control surface
type ControlSurfaceConfig struct {
	Enabled          bool   `json:"enabled"`
	Port             int    `json:"port"`
	AuthEnabled      bool   `json:"auth_enabled"`
	HMACSecret       string `json:"hmac_secret"`
	MaxRequestSize   int64  `json:"max_request_size_bytes"`
	RateLimitRPS     int    `json:"rate_limit_rps"`
}

// DefaultControlSurfaceConfig returns default configuration
func DefaultControlSurfaceConfig() *ControlSurfaceConfig {
	return &ControlSurfaceConfig{
		Enabled:        true,
		Port:           8081,
		AuthEnabled:    true,
		HMACSecret:     "change-me-in-production",
		MaxRequestSize: 1024 * 1024, // 1MB
		RateLimitRPS:   100,
	}
}

// ControlSurface provides HTTP API for policy management
type ControlSurface struct {
	config         *ControlSurfaceConfig
	currentPolicy  *PolicyUpdate
	policyHistory  map[uint32]*PolicyUpdate
	mu             sync.RWMutex
	metrics        *PolicyMetrics
	metricsMu      sync.RWMutex
	server         *fiber.App
}

// NewControlSurface creates a new control surface
func NewControlSurface(config *ControlSurfaceConfig) *ControlSurface {
	if config == nil {
		config = DefaultControlSurfaceConfig()
	}

	cs := &ControlSurface{
		config:        config,
		policyHistory: make(map[uint32]*PolicyUpdate),
		metrics:       &PolicyMetrics{},
	}

	// Initialize with default policy
	cs.currentPolicy = cs.defaultPolicy()
	cs.policyHistory[0] = cs.currentPolicy

	if config.Enabled {
		cs.setupServer()
	}

	return cs
}

// setupServer configures the Fiber HTTP server
func (cs *ControlSurface) setupServer() {
	cs.server = fiber.New(fiber.Config{
		DisableStartupMessage: false,
		BodyLimit:             int(cs.config.MaxRequestSize),
	})

	// Middleware
	cs.server.Use(cs.authMiddleware)
	cs.server.Use(cs.rateLimitMiddleware)

	// Routes
	cs.server.Post("/policy/update", cs.handlePolicyUpdate)
	cs.server.Get("/policy/inspect", cs.handlePolicyInspect)
	cs.server.Post("/policy/rollback", cs.handlePolicyRollback)
	cs.server.Get("/policy/metrics", cs.handlePolicyMetrics)
	cs.server.Get("/health", cs.handleHealth)
}

// Start starts the control surface HTTP server
func (cs *ControlSurface) Start() error {
	if !cs.config.Enabled {
		return fmt.Errorf("control surface is disabled")
	}

	addr := fmt.Sprintf(":%d", cs.config.Port)
	return cs.server.Listen(addr)
}

// Stop stops the control surface HTTP server
func (cs *ControlSurface) Stop() error {
	if cs.server != nil {
		return cs.server.Shutdown()
	}
	return nil
}

// handlePolicyUpdate handles POST /policy/update
func (cs *ControlSurface) handlePolicyUpdate(c *fiber.Ctx) error {
	start := time.Now()

	var update PolicyUpdate
	if err := c.BodyParser(&update); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid policy update format",
		})
	}

	// Validate policy update
	if err := cs.validatePolicyUpdate(&update); err != nil {
		cs.metricsMu.Lock()
		cs.metrics.RejectedUpdates++
		cs.metricsMu.Unlock()

		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	// Apply policy update
	cs.mu.Lock()
	update.Version = cs.currentPolicy.Version + 1
	update.Timestamp = time.Now().UnixMilli()
	cs.currentPolicy = &update
	cs.policyHistory[update.Version] = &update
	cs.mu.Unlock()

	// Update metrics
	latencyMS := float64(time.Since(start).Microseconds()) / 1000.0
	cs.metricsMu.Lock()
	cs.metrics.TotalUpdates++
	cs.metrics.SuccessfulUpdates++
	cs.metrics.LastUpdateLatencyMS = latencyMS
	cs.metrics.AvgConfidence = (cs.metrics.AvgConfidence*float64(cs.metrics.TotalUpdates-1) + update.Confidence) /
		float64(cs.metrics.TotalUpdates)
	cs.metricsMu.Unlock()

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":      "success",
		"version":     update.Version,
		"latency_ms":  latencyMS,
		"timestamp":   update.Timestamp,
	})
}

// handlePolicyInspect handles GET /policy/inspect
func (cs *ControlSurface) handlePolicyInspect(c *fiber.Ctx) error {
	cs.mu.RLock()
	current := cs.currentPolicy
	cs.mu.RUnlock()

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status": "success",
		"policy": current,
	})
}

// handlePolicyRollback handles POST /policy/rollback
func (cs *ControlSurface) handlePolicyRollback(c *fiber.Ctx) error {
	var req struct {
		Version uint32 `json:"version"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(http.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid rollback request",
		})
	}

	cs.mu.Lock()
	defer cs.mu.Unlock()

	// Find policy version in history
	targetPolicy, exists := cs.policyHistory[req.Version]
	if !exists {
		return c.Status(http.StatusNotFound).JSON(fiber.Map{
			"error": fmt.Sprintf("Policy version %d not found", req.Version),
		})
	}

	// Rollback to target version
	cs.currentPolicy = targetPolicy

	// Update metrics
	cs.metricsMu.Lock()
	cs.metrics.Rollbacks++
	cs.metricsMu.Unlock()

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":           "success",
		"rolled_back_to":   req.Version,
		"timestamp":        time.Now().UnixMilli(),
	})
}

// handlePolicyMetrics handles GET /policy/metrics
func (cs *ControlSurface) handlePolicyMetrics(c *fiber.Ctx) error {
	cs.metricsMu.RLock()
	metrics := *cs.metrics
	cs.metricsMu.RUnlock()

	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":  "success",
		"metrics": metrics,
	})
}

// handleHealth handles GET /health
func (cs *ControlSurface) handleHealth(c *fiber.Ctx) error {
	return c.Status(http.StatusOK).JSON(fiber.Map{
		"status":    "healthy",
		"timestamp": time.Now().UnixMilli(),
	})
}

// validatePolicyUpdate validates a policy update
func (cs *ControlSurface) validatePolicyUpdate(update *PolicyUpdate) error {
	// Validate routing policy
	if update.Routing.TrafficSplit < 0.0 || update.Routing.TrafficSplit > 1.0 {
		return fmt.Errorf("invalid traffic_split: must be between 0.0 and 1.0")
	}

	if update.Routing.TimeoutMS == 0 || update.Routing.TimeoutMS > 30000 {
		return fmt.Errorf("invalid timeout_ms: must be between 1 and 30000")
	}

	// Validate batching policy
	if update.Batching.BatchSize < 1 || update.Batching.BatchSize > 256 {
		return fmt.Errorf("invalid batch_size: must be between 1 and 256")
	}

	if update.Batching.MaxWaitMS > 1000 {
		return fmt.Errorf("invalid max_wait_ms: must be <= 1000")
	}

	// Validate confidence
	if update.Confidence < 0.0 || update.Confidence > 1.0 {
		return fmt.Errorf("invalid confidence: must be between 0.0 and 1.0")
	}

	return nil
}

// authMiddleware validates HMAC authentication
func (cs *ControlSurface) authMiddleware(c *fiber.Ctx) error {
	if !cs.config.AuthEnabled {
		return c.Next()
	}

	// Simple HMAC validation (production should use proper JWT/HMAC)
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{
			"error": "Missing authorization header",
		})
	}

	// In production, validate HMAC signature
	// For now, just check for presence
	return c.Next()
}

// rateLimitMiddleware implements simple rate limiting
func (cs *ControlSurface) rateLimitMiddleware(c *fiber.Ctx) error {
	// In production, implement proper rate limiting
	return c.Next()
}

// defaultPolicy returns the default policy configuration
func (cs *ControlSurface) defaultPolicy() *PolicyUpdate {
	return &PolicyUpdate{
		Timestamp: time.Now().UnixMilli(),
		Routing: RoutingPolicy{
			PrimaryEndpoint:         "default",
			FallbackEndpoint:        "fallback",
			TrafficSplit:            0.8,
			CircuitBreakerThreshold: 10,
			TimeoutMS:               5000,
		},
		Batching: BatchingPolicy{
			BatchSize:          32,
			MaxWaitMS:          10,
			DynamicSizing:      true,
			TimeoutThresholdMS: 50,
		},
		Confidence: 1.0,
		TriggerMetrics: TelemetryData{
			AvgLatencyMS:      100.0,
			P95LatencyMS:      150.0,
			CacheHitRate:      0.95,
			ThroughputRPS:     100.0,
			ErrorRate:         0.01,
			CPUUtilization:    0.5,
			MemoryUtilization: 0.5,
			CostEfficiency:    0.8,
		},
		Version: 0,
	}
}

// GetCurrentPolicy returns the current active policy
func (cs *ControlSurface) GetCurrentPolicy() *PolicyUpdate {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	return cs.currentPolicy
}

// GetMetrics returns current policy metrics
func (cs *ControlSurface) GetMetrics() PolicyMetrics {
	cs.metricsMu.RLock()
	defer cs.metricsMu.RUnlock()
	return *cs.metrics
}
