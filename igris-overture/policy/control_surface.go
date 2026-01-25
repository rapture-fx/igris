// Package policy provides the Control Surface Interface for policy orchestration.
//
// Exposes REST endpoints for external orchestration and policy introspection:
// - POST /policy/update: Update active policy
// - GET /policy/inspect: Inspect current policy and metrics
// - POST /policy/rollback: Rollback to previous version
// - GET /policy/metrics: Get policy engine metrics
package policy

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/observability"
	"github.com/Igris-inertial/system/igris-overture/security"
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

	// Enhanced security options (Phase 1)
	StrictAuthMode         bool   `json:"strict_auth_mode"`          // If true, reject all invalid signatures (default: true)
	AllowHMACFallback      bool   `json:"allow_hmac_fallback"`       // Allow HMAC if Ed25519 not configured
	RedisURL               string `json:"redis_url"`                 // Redis URL for distributed rate limiting
	RateLimitWindow        int    `json:"rate_limit_window_seconds"` // Time window for rate limiting (default: 60s)
	RateLimitBurstMultiple int    `json:"rate_limit_burst_multiple"` // Burst multiplier (default: 2)

	// Ed25519 public keys for verification (base64 encoded)
	TrustedPublicKeys []string `json:"trusted_public_keys"`
}

// DefaultControlSurfaceConfig returns default configuration
func DefaultControlSurfaceConfig() *ControlSurfaceConfig {
	return &ControlSurfaceConfig{
		Enabled:                true,
		Port:                   8081,
		AuthEnabled:            true,
		HMACSecret:             "",
		MaxRequestSize:         1024 * 1024, // 1MB
		RateLimitRPS:           100,
		StrictAuthMode:         true,
		AllowHMACFallback:      true,
		RateLimitWindow:        60,
		RateLimitBurstMultiple: 2,
		TrustedPublicKeys:      []string{},
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

	// Rate limiting (Phase 1)
	rateLimiter      *RateLimiter
	redisClient      *redis.Client
	redisEnabled     bool
	redisFailed      bool
	redisFailedMu    sync.RWMutex
}

// RateLimiter implements Redis-backed token bucket with local fallback
type RateLimiter struct {
	mu              sync.Mutex
	buckets         map[string]*tokenBucket
	rate            int
	window          time.Duration
	burstMultiple   int
	cleanupInterval time.Duration
	redis           *redis.Client
	redisEnabled    bool
	redisFailed     bool
	redisCheckInterval time.Duration
}

type tokenBucket struct {
	tokens     int
	lastRefill time.Time
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

	// Initialize Redis client for rate limiting
	if config.RedisURL != "" {
		opt, err := redis.ParseURL(config.RedisURL)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to parse Redis URL for control surface, using local rate limiting")
		} else {
			client := redis.NewClient(opt)
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			if err := client.Ping(ctx).Err(); err != nil {
				log.Warn().Err(err).Msg("Failed to connect to Redis for control surface, using local rate limiting")
			} else {
				cs.redisClient = client
				cs.redisEnabled = true
				log.Info().Msg("Redis-backed rate limiting enabled for control surface")
			}
			cancel()
		}
	}

	// Initialize rate limiter
	window := time.Duration(config.RateLimitWindow) * time.Second
	if window == 0 {
		window = 60 * time.Second
	}
	burstMultiple := config.RateLimitBurstMultiple
	if burstMultiple == 0 {
		burstMultiple = 2
	}

	cs.rateLimiter = &RateLimiter{
		buckets:            make(map[string]*tokenBucket),
		rate:               config.RateLimitRPS,
		window:             window,
		burstMultiple:      burstMultiple,
		cleanupInterval:    5 * time.Minute,
		redis:              cs.redisClient,
		redisEnabled:       cs.redisEnabled,
		redisCheckInterval: 30 * time.Second,
	}

	// Start rate limiter cleanup and Redis health monitor
	go cs.rateLimiter.cleanup()
	if cs.redisEnabled {
		go cs.rateLimiter.monitorRedis()
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
	var errs []error

	if cs.server != nil {
		if err := cs.server.Shutdown(); err != nil {
			errs = append(errs, fmt.Errorf("server shutdown: %w", err))
		}
	}

	if cs.redisClient != nil {
		if err := cs.redisClient.Close(); err != nil {
			errs = append(errs, fmt.Errorf("redis close: %w", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("stop errors: %v", errs)
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

// authMiddleware validates Ed25519 or HMAC signatures
func (cs *ControlSurface) authMiddleware(c *fiber.Ctx) error {
	if !cs.config.AuthEnabled {
		return c.Next()
	}

	start := time.Now()
	tenantID := c.Get("X-Tenant-ID", "default")

	// Get authorization header
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		observability.RecordSignatureVerification(tenantID, "missing", 0)
		return c.Status(http.StatusUnauthorized).JSON(fiber.Map{
			"error": "Missing authorization header",
			"code":  "AUTH_MISSING",
		})
	}

	// Try Ed25519 signature verification first (Bearer Ed25519:<signature>)
	if strings.HasPrefix(authHeader, "Bearer Ed25519:") {
		signature := strings.TrimPrefix(authHeader, "Bearer Ed25519:")

		// Get the message (request body or canonical request representation)
		body := c.Body()
		message := cs.canonicalMessage(c.Method(), c.Path(), body)

		// Try each trusted public key
		verified := false
		for _, pubKeyBase64 := range cs.config.TrustedPublicKeys {
			if err := security.VerifyEd25519Signature(pubKeyBase64, signature, message); err == nil {
				verified = true
				break
			}
		}

		latencyUs := time.Since(start).Microseconds()

		if verified {
			observability.RecordSignatureVerification(tenantID, "valid", latencyUs)
			return c.Next()
		}

		// Ed25519 verification failed
		observability.RecordSignatureVerification(tenantID, "invalid", latencyUs)
		log.Warn().
			Str("tenant_id", tenantID).
			Str("path", c.Path()).
			Msg("Ed25519 signature verification failed")

		if cs.config.StrictAuthMode {
			return c.Status(http.StatusForbidden).JSON(fiber.Map{
				"error": "Invalid signature",
				"code":  "AUTH_INVALID_SIGNATURE",
			})
		}
	}

	// Try HMAC verification if Ed25519 not used or fallback allowed
	if cs.config.AllowHMACFallback && cs.config.HMACSecret != "" {
		if strings.HasPrefix(authHeader, "Bearer HMAC:") {
			parts := strings.SplitN(strings.TrimPrefix(authHeader, "Bearer HMAC:"), ":", 2)
			if len(parts) == 2 {
				timestamp := parts[0]
				providedSignature := parts[1]

				// Verify timestamp is within 5 minutes
				if err := cs.verifyTimestamp(timestamp); err != nil {
					observability.RecordSignatureVerification(tenantID, "invalid", time.Since(start).Microseconds())
					return c.Status(http.StatusForbidden).JSON(fiber.Map{
						"error": "Request timestamp expired or invalid",
						"code":  "AUTH_TIMESTAMP_EXPIRED",
					})
				}

				// Compute expected HMAC
				body := c.Body()
				message := cs.canonicalMessage(c.Method(), c.Path(), body)
				messageWithTimestamp := append([]byte(timestamp+":"), message...)

				mac := hmac.New(sha256.New, []byte(cs.config.HMACSecret))
				mac.Write(messageWithTimestamp)
				expectedSignature := base64.StdEncoding.EncodeToString(mac.Sum(nil))

				if hmac.Equal([]byte(expectedSignature), []byte(providedSignature)) {
					observability.RecordSignatureVerification(tenantID, "valid", time.Since(start).Microseconds())
					return c.Next()
				}
			}
		}
	}

	// If we get here and strict mode is enabled, reject
	if cs.config.StrictAuthMode {
		observability.RecordSignatureVerification(tenantID, "invalid", time.Since(start).Microseconds())
		return c.Status(http.StatusForbidden).JSON(fiber.Map{
			"error": "Authentication failed",
			"code":  "AUTH_FAILED",
		})
	}

	// Non-strict mode: allow request with warning
	log.Warn().
		Str("tenant_id", tenantID).
		Str("path", c.Path()).
		Msg("Authentication not verified (non-strict mode)")
	observability.RecordSignatureVerification(tenantID, "skipped", time.Since(start).Microseconds())
	return c.Next()
}

// canonicalMessage creates a canonical message for signing
func (cs *ControlSurface) canonicalMessage(method, path string, body []byte) []byte {
	canonical := fmt.Sprintf("%s\n%s\n%s", method, path, string(body))
	return []byte(canonical)
}

// verifyTimestamp checks if timestamp is within acceptable window (±5 minutes)
func (cs *ControlSurface) verifyTimestamp(timestamp string) error {
	// Parse timestamp (Unix seconds)
	var ts int64
	if _, err := fmt.Sscanf(timestamp, "%d", &ts); err != nil {
		return fmt.Errorf("invalid timestamp format")
	}

	now := time.Now().Unix()
	diff := now - ts
	if diff < 0 {
		diff = -diff
	}

	// 5-minute window
	if diff > 300 {
		return fmt.Errorf("timestamp outside acceptable window")
	}

	return nil
}

// rateLimitMiddleware implements Redis-backed token bucket rate limiting
func (cs *ControlSurface) rateLimitMiddleware(c *fiber.Ctx) error {
	if cs.rateLimiter == nil || cs.rateLimiter.rate == 0 {
		return c.Next()
	}

	// Use tenant ID as key for per-tenant rate limiting
	tenantID := c.Get("X-Tenant-ID", c.IP())
	endpoint := c.Path()
	key := fmt.Sprintf("control_surface:%s:%s", tenantID, endpoint)

	if !cs.rateLimiter.allow(key) {
		// Rate limit exceeded
		retryAfter := int(cs.rateLimiter.window.Seconds())

		c.Set("Retry-After", fmt.Sprintf("%d", retryAfter))
		c.Set("X-RateLimit-Limit", fmt.Sprintf("%d", cs.rateLimiter.rate))
		c.Set("X-RateLimit-Remaining", "0")
		c.Set("X-RateLimit-Reset", fmt.Sprintf("%d", time.Now().Add(cs.rateLimiter.window).Unix()))

		observability.RecordRateLimitExceeded(tenantID, endpoint)

		log.Warn().
			Str("tenant_id", tenantID).
			Str("endpoint", endpoint).
			Str("key", key).
			Msg("Rate limit exceeded on control surface")

		return c.Status(http.StatusTooManyRequests).JSON(fiber.Map{
			"error": "Rate limit exceeded. Please try again later.",
			"code":  "RATE_LIMIT_EXCEEDED",
			"retry_after_seconds": retryAfter,
		})
	}

	observability.RecordRateLimitAllowed(tenantID, endpoint)
	return c.Next()
}

// RateLimiter methods

// allow checks if request is allowed based on rate limit
func (rl *RateLimiter) allow(key string) bool {
	// Try Redis first if enabled
	if rl.redisEnabled && !rl.redisFailed {
		allowed, err := rl.allowRedis(key)
		if err == nil {
			return allowed
		}
		// Redis failed, fall back to local
		rl.redisFailed = true
		log.Warn().Err(err).Msg("Redis rate limiter failed, falling back to local")
	}

	return rl.allowLocal(key)
}

// allowRedis checks rate limit using Redis with sliding window
func (rl *RateLimiter) allowRedis(key string) (bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	redisKey := fmt.Sprintf("ratelimit:%s", key)
	now := time.Now()
	windowStart := now.Add(-rl.window)

	// Use Redis sorted set for sliding window rate limiting
	pipe := rl.redis.Pipeline()

	// Remove old entries outside the window
	pipe.ZRemRangeByScore(ctx, redisKey, "0", fmt.Sprintf("%d", windowStart.UnixNano()))

	// Count current requests in window
	countCmd := pipe.ZCard(ctx, redisKey)

	// Add current request
	pipe.ZAdd(ctx, redisKey, redis.Z{
		Score:  float64(now.UnixNano()),
		Member: fmt.Sprintf("%d", now.UnixNano()),
	})

	// Set expiry on the key
	pipe.Expire(ctx, redisKey, rl.window*2)

	if _, err := pipe.Exec(ctx); err != nil {
		return false, err
	}

	count := countCmd.Val()
	maxAllowed := int64(rl.rate * rl.burstMultiple)

	return count < maxAllowed, nil
}

// allowLocal checks rate limit using local token bucket
func (rl *RateLimiter) allowLocal(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	b, exists := rl.buckets[key]
	if !exists {
		b = &tokenBucket{
			tokens:     rl.rate * rl.burstMultiple - 1,
			lastRefill: time.Now(),
		}
		rl.buckets[key] = b
		return true
	}

	// Refill tokens based on time elapsed
	now := time.Now()
	elapsed := now.Sub(b.lastRefill)

	if elapsed >= rl.window {
		// Full refill
		b.tokens = rl.rate * rl.burstMultiple - 1
		b.lastRefill = now
		return true
	}

	// Partial refill based on elapsed time
	tokensToAdd := int(float64(rl.rate) * elapsed.Seconds() / rl.window.Seconds())
	if tokensToAdd > 0 {
		b.tokens += tokensToAdd
		maxTokens := rl.rate * rl.burstMultiple
		if b.tokens > maxTokens {
			b.tokens = maxTokens
		}
		b.lastRefill = now
	}

	// Check if tokens available
	if b.tokens > 0 {
		b.tokens--
		return true
	}

	return false
}

// cleanup removes old buckets periodically
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(rl.cleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for key, b := range rl.buckets {
			if now.Sub(b.lastRefill) > rl.window*2 {
				delete(rl.buckets, key)
			}
		}
		rl.mu.Unlock()
	}
}

// monitorRedis periodically checks Redis health and recovers if needed
func (rl *RateLimiter) monitorRedis() {
	ticker := time.NewTicker(rl.redisCheckInterval)
	defer ticker.Stop()

	for range ticker.C {
		if !rl.redisFailed {
			continue
		}

		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		err := rl.redis.Ping(ctx).Err()
		cancel()

		if err == nil {
			rl.redisFailed = false
			log.Info().Msg("Redis rate limiter recovered")
		}
	}
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
