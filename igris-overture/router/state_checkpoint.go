//go:build ignore
package router

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/policies"
	pb "github.com/Igris-inertial/system/proto/orchestration"
)

// PolicyEngine type alias for compatibility
type PolicyEngine = policies.PolicyEngine

// StateCheckpoint represents a snapshot of routing state
type StateCheckpoint struct {
	// Checkpoint metadata
	CheckpointID   string    `json:"checkpoint_id"`
	Timestamp      time.Time `json:"timestamp"`
	PolicyVersion  string    `json:"policy_version"`
	EngineVersion  string    `json:"engine_version"`

	// Active routing state
	ActiveDecisions  map[string]*RoutingDecisionSnapshot `json:"active_decisions"`
	InflightRequests map[string]*RequestSnapshot         `json:"inflight_requests"`

	// Circuit breaker states
	CircuitBreakerStates map[string]*CircuitBreakerSnapshot `json:"circuit_breaker_states"`

	// Metrics snapshot
	MetricsSnapshot *MetricsSnapshotData `json:"metrics_snapshot"`

	// Cache metadata
	CacheMetadata *CacheMetadata `json:"cache_metadata"`
}

// RoutingDecisionSnapshot captures a routing decision state
type RoutingDecisionSnapshot struct {
	RequestID       string    `json:"request_id"`
	PolicyID        string    `json:"policy_id"`
	ModelID         string    `json:"model_id"`
	Region          string    `json:"region"`
	DecisionTime    time.Time `json:"decision_time"`
	EstimatedCost   float64   `json:"estimated_cost"`
	CacheHit        bool      `json:"cache_hit"`
	BatchID         string    `json:"batch_id,omitempty"`
}

// RequestSnapshot captures an inflight request
type RequestSnapshot struct {
	RequestID       string                 `json:"request_id"`
	UserID          string                 `json:"user_id,omitempty"`
	CreatedAt       time.Time              `json:"created_at"`
	State           string                 `json:"state"` // ROUTING, IN_FLIGHT, COMPLETED
	RetryCount      int                    `json:"retry_count"`
	LastAttemptAt   time.Time              `json:"last_attempt_at,omitempty"`
	RoutingDecision *RoutingDecisionSnapshot `json:"routing_decision,omitempty"`
	Metadata        map[string]string      `json:"metadata,omitempty"`
}

// CircuitBreakerSnapshot captures circuit breaker state
type CircuitBreakerSnapshot struct {
	Name                 string    `json:"name"`
	State                string    `json:"state"`
	ConsecutiveFailures  int       `json:"consecutive_failures"`
	ConsecutiveSuccesses int       `json:"consecutive_successes"`
	LastStateChange      time.Time `json:"last_state_change"`
	OpenedAt             time.Time `json:"opened_at,omitempty"`
	ErrorRate            float64   `json:"error_rate"`
	LatencyP95Ms         int64     `json:"latency_p95_ms"`
}

// MetricsSnapshotData captures metrics state
type MetricsSnapshotData struct {
	TotalRequests      int64     `json:"total_requests"`
	SuccessfulRequests int64     `json:"successful_requests"`
	FailedRequests     int64     `json:"failed_requests"`
	AverageLatencyMs   int64     `json:"average_latency_ms"`
	P95LatencyMs       int64     `json:"p95_latency_ms"`
	P99LatencyMs       int64     `json:"p99_latency_ms"`
	CapturedAt         time.Time `json:"captured_at"`
}

// CacheMetadata captures cache state metadata
type CacheMetadata struct {
	TotalEntries int64     `json:"total_entries"`
	HitRate      float64   `json:"hit_rate"`
	Version      uint64    `json:"version"`
	LastSwept    time.Time `json:"last_swept"`
}

// CheckpointManager manages state checkpointing and recovery
type CheckpointManager struct {
	// Redis client
	redis *redis.Client

	// Configuration
	config CheckpointConfig

	// Policy engine reference
	engine *PolicyEngine

	// Circuit breaker manager reference
	cbManager *CircuitBreakerManager

	// Active state tracking
	activeDecisions  map[string]*RoutingDecisionSnapshot
	inflightRequests map[string]*RequestSnapshot
	stateMu          sync.RWMutex

	// Checkpoint tracking
	lastCheckpointID   string
	lastCheckpointTime time.Time
	checkpointMu       sync.RWMutex

	// Shutdown coordination
	stopChan chan struct{}
	wg       sync.WaitGroup
}

// CheckpointConfig holds checkpointing configuration
type CheckpointConfig struct {
	// Redis configuration
	RedisAddr     string
	RedisPassword string
	RedisDB       int

	// Checkpointing settings
	CheckpointInterval time.Duration // How often to checkpoint (e.g., 1s)
	CheckpointTTL      time.Duration // How long to keep checkpoints (e.g., 5m)
	MaxCheckpoints     int           // Maximum checkpoints to retain

	// Recovery settings
	EnableAutoRecovery bool          // Automatically recover on startup
	RecoveryTimeout    time.Duration // Max time to wait for recovery

	// Performance settings
	EnableCompression bool // Compress checkpoint data
	EnableAsync       bool // Checkpoint asynchronously
}

// DefaultCheckpointConfig returns default configuration
func DefaultCheckpointConfig() CheckpointConfig {
	return CheckpointConfig{
		RedisAddr:          "localhost:6379",
		RedisPassword:      "",
		RedisDB:            0,
		CheckpointInterval: 1 * time.Second,
		CheckpointTTL:      5 * time.Minute,
		MaxCheckpoints:     300,
		EnableAutoRecovery: true,
		RecoveryTimeout:    10 * time.Second,
		EnableCompression:  true,
		EnableAsync:        true,
	}
}

// NewCheckpointManager creates a new checkpoint manager
func NewCheckpointManager(
	config CheckpointConfig,
	engine *PolicyEngine,
	cbManager *CircuitBreakerManager,
) (*CheckpointManager, error) {
	// Create Redis client
	redisClient := redis.NewClient(&redis.Options{
		Addr:     config.RedisAddr,
		Password: config.RedisPassword,
		DB:       config.RedisDB,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := redisClient.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	cm := &CheckpointManager{
		redis:            redisClient,
		config:           config,
		engine:           engine,
		cbManager:        cbManager,
		activeDecisions:  make(map[string]*RoutingDecisionSnapshot),
		inflightRequests: make(map[string]*RequestSnapshot),
		stopChan:         make(chan struct{}),
	}

	// Attempt recovery if enabled
	if config.EnableAutoRecovery {
		if err := cm.Recover(context.Background()); err != nil {
			log.Warn().Err(err).Msg("Failed to recover from checkpoint, starting fresh")
		}
	}

	// Start checkpointing loop
	cm.wg.Add(1)
	go cm.checkpointLoop()

	log.Info().
		Dur("interval", config.CheckpointInterval).
		Bool("auto_recovery", config.EnableAutoRecovery).
		Msg("Checkpoint manager started")

	return cm, nil
}

// TrackRoutingDecision tracks a routing decision for checkpointing
func (cm *CheckpointManager) TrackRoutingDecision(
	requestID string,
	decision *pb.RouteInferenceResponse,
) {
	cm.stateMu.Lock()
	defer cm.stateMu.Unlock()

	snapshot := &RoutingDecisionSnapshot{
		RequestID:     requestID,
		PolicyID:      decision.PolicyId,
		ModelID:       decision.ModelId,
		Region:        "", // Would extract from decision
		DecisionTime:  time.Now(),
		EstimatedCost: decision.CostEstimate.EstimatedCost,
		CacheHit:      false,
		BatchID:       "",
	}

	cm.activeDecisions[requestID] = snapshot
}

// TrackInflightRequest tracks an inflight request
func (cm *CheckpointManager) TrackInflightRequest(
	requestID string,
	userID string,
	state string,
) {
	cm.stateMu.Lock()
	defer cm.stateMu.Unlock()

	req := &RequestSnapshot{
		RequestID:     requestID,
		UserID:        userID,
		CreatedAt:     time.Now(),
		State:         state,
		RetryCount:    0,
		LastAttemptAt: time.Now(),
		Metadata:      make(map[string]string),
	}

	cm.inflightRequests[requestID] = req
}

// CompleteRequest removes a request from tracking
func (cm *CheckpointManager) CompleteRequest(requestID string) {
	cm.stateMu.Lock()
	defer cm.stateMu.Unlock()

	delete(cm.activeDecisions, requestID)
	delete(cm.inflightRequests, requestID)
}

// CreateCheckpoint creates a new checkpoint
func (cm *CheckpointManager) CreateCheckpoint(ctx context.Context) (*StateCheckpoint, error) {
	checkpointID := fmt.Sprintf("ckpt-%d", time.Now().UnixNano())

	cm.stateMu.RLock()
	activeDecisions := make(map[string]*RoutingDecisionSnapshot, len(cm.activeDecisions))
	for k, v := range cm.activeDecisions {
		activeDecisions[k] = v
	}

	inflightRequests := make(map[string]*RequestSnapshot, len(cm.inflightRequests))
	for k, v := range cm.inflightRequests {
		inflightRequests[k] = v
	}
	cm.stateMu.RUnlock()

	// Capture circuit breaker states
	cbStates := make(map[string]*CircuitBreakerSnapshot)
	if cm.cbManager != nil {
		for name, cb := range cm.cbManager.GetAll() {
			stats := cb.GetStats()
			cbStates[name] = &CircuitBreakerSnapshot{
				Name:                 name,
				State:                stats.State,
				ConsecutiveFailures:  stats.ConsecutiveFailures,
				ConsecutiveSuccesses: stats.ConsecutiveSuccesses,
				LastStateChange:      stats.LastStateChange,
				ErrorRate:            stats.ErrorRate,
				LatencyP95Ms:         stats.LatencyP95Ms,
			}
		}
	}

	checkpoint := &StateCheckpoint{
		CheckpointID:         checkpointID,
		Timestamp:            time.Now(),
		PolicyVersion:        cm.engine.getPolicyVersion(),
		EngineVersion:        "1.0.0", // Would come from build info
		ActiveDecisions:      activeDecisions,
		InflightRequests:     inflightRequests,
		CircuitBreakerStates: cbStates,
		MetricsSnapshot: &MetricsSnapshotData{
			CapturedAt: time.Now(),
		},
		CacheMetadata: &CacheMetadata{
			Version: 0, // Would get from cache adapter
		},
	}

	// Serialize checkpoint
	data, err := json.Marshal(checkpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal checkpoint: %w", err)
	}

	// Store in Redis
	checkpointKey := fmt.Sprintf("routing:checkpoint:%s", checkpointID)

	if err := cm.redis.Set(ctx, checkpointKey, data, cm.config.CheckpointTTL).Err(); err != nil {
		return nil, fmt.Errorf("failed to store checkpoint: %w", err)
	}

	// Update latest pointer
	if err := cm.redis.Set(ctx, "routing:checkpoint:latest", checkpointID, 0).Err(); err != nil {
		return nil, fmt.Errorf("failed to update latest pointer: %w", err)
	}

	// Track checkpoint
	cm.checkpointMu.Lock()
	cm.lastCheckpointID = checkpointID
	cm.lastCheckpointTime = time.Now()
	cm.checkpointMu.Unlock()

	log.Debug().
		Str("checkpoint_id", checkpointID).
		Int("active_decisions", len(activeDecisions)).
		Int("inflight_requests", len(inflightRequests)).
		Int("circuit_breakers", len(cbStates)).
		Msg("Checkpoint created")

	// Clean up old checkpoints
	go cm.cleanupOldCheckpoints(ctx)

	return checkpoint, nil
}

// Recover attempts to recover from the latest checkpoint
func (cm *CheckpointManager) Recover(ctx context.Context) error {
	startTime := time.Now()

	// Get latest checkpoint ID
	checkpointID, err := cm.redis.Get(ctx, "routing:checkpoint:latest").Result()
	if err == redis.Nil {
		return fmt.Errorf("no checkpoint found")
	} else if err != nil {
		return fmt.Errorf("failed to get latest checkpoint ID: %w", err)
	}

	// Load checkpoint data
	checkpointKey := fmt.Sprintf("routing:checkpoint:%s", checkpointID)
	data, err := cm.redis.Get(ctx, checkpointKey).Result()
	if err != nil {
		return fmt.Errorf("failed to load checkpoint %s: %w", checkpointID, err)
	}

	// Deserialize checkpoint
	var checkpoint StateCheckpoint
	if err := json.Unmarshal([]byte(data), &checkpoint); err != nil {
		return fmt.Errorf("failed to unmarshal checkpoint: %w", err)
	}

	// Restore state
	cm.stateMu.Lock()
	cm.activeDecisions = checkpoint.ActiveDecisions
	cm.inflightRequests = checkpoint.InflightRequests
	cm.stateMu.Unlock()

	// Restore circuit breaker states
	if cm.cbManager != nil {
		for name, snapshot := range checkpoint.CircuitBreakerStates {
			cb, exists := cm.cbManager.Get(name)
			if !exists {
				config := DefaultCircuitBreakerConfig(name)
				cb = cm.cbManager.GetOrCreate(name, config)
			}

			// Restore state (simplified - would need proper state restoration)
			cb.stateMu.Lock()
			switch snapshot.State {
			case "OPEN":
				cb.state = StateOpen
				cb.openedAt = snapshot.OpenedAt
			case "HALF_OPEN":
				cb.state = StateHalfOpen
			case "CLOSED":
				cb.state = StateClosed
			}
			cb.consecutiveFailures = snapshot.ConsecutiveFailures
			cb.consecutiveSuccesses = snapshot.ConsecutiveSuccesses
			cb.lastStateChange = snapshot.LastStateChange
			cb.stateMu.Unlock()
		}
	}

	recoveryTime := time.Since(startTime)

	log.Info().
		Str("checkpoint_id", checkpointID).
		Dur("recovery_time", recoveryTime).
		Int("active_decisions", len(checkpoint.ActiveDecisions)).
		Int("inflight_requests", len(checkpoint.InflightRequests)).
		Int("circuit_breakers", len(checkpoint.CircuitBreakerStates)).
		Msg("Successfully recovered from checkpoint")

	// Export metric
	checkpointRecoveryDuration.Observe(recoveryTime.Seconds())
	checkpointRecoveryTotal.Inc()

	return nil
}

// checkpointLoop periodically creates checkpoints
func (cm *CheckpointManager) checkpointLoop() {
	defer cm.wg.Done()

	ticker := time.NewTicker(cm.config.CheckpointInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)

			if _, err := cm.CreateCheckpoint(ctx); err != nil {
				log.Error().Err(err).Msg("Failed to create checkpoint")
				checkpointErrorsTotal.Inc()
			} else {
				checkpointTotal.Inc()
			}

			cancel()

		case <-cm.stopChan:
			log.Info().Msg("Checkpointing stopped")
			return
		}
	}
}

// cleanupOldCheckpoints removes old checkpoints beyond MaxCheckpoints
func (cm *CheckpointManager) cleanupOldCheckpoints(ctx context.Context) {
	// Scan for checkpoint keys
	iter := cm.redis.Scan(ctx, 0, "routing:checkpoint:ckpt-*", int64(cm.config.MaxCheckpoints+100)).Iterator()

	var keys []string
	for iter.Next(ctx) {
		keys = append(keys, iter.Val())
	}

	if err := iter.Err(); err != nil {
		log.Error().Err(err).Msg("Failed to scan checkpoints")
		return
	}

	// Keep only the latest MaxCheckpoints
	if len(keys) > cm.config.MaxCheckpoints {
		// Sort by timestamp (keys are in format routing:checkpoint:ckpt-{timestamp})
		toDelete := keys[:len(keys)-cm.config.MaxCheckpoints]

		for _, key := range toDelete {
			if err := cm.redis.Del(ctx, key).Err(); err != nil {
				log.Error().Err(err).Str("key", key).Msg("Failed to delete old checkpoint")
			}
		}

		log.Debug().Int("deleted", len(toDelete)).Msg("Cleaned up old checkpoints")
	}
}

// GetCheckpointStats returns checkpoint statistics
func (cm *CheckpointManager) GetCheckpointStats() CheckpointStats {
	cm.checkpointMu.RLock()
	defer cm.checkpointMu.RUnlock()

	cm.stateMu.RLock()
	activeDecisions := len(cm.activeDecisions)
	inflightRequests := len(cm.inflightRequests)
	cm.stateMu.RUnlock()

	return CheckpointStats{
		LastCheckpointID:   cm.lastCheckpointID,
		LastCheckpointTime: cm.lastCheckpointTime,
		ActiveDecisions:    activeDecisions,
		InflightRequests:   inflightRequests,
		CheckpointInterval: cm.config.CheckpointInterval,
	}
}

// CheckpointStats holds checkpoint statistics
type CheckpointStats struct {
	LastCheckpointID   string
	LastCheckpointTime time.Time
	ActiveDecisions    int
	InflightRequests   int
	CheckpointInterval time.Duration
}

// Stop stops the checkpoint manager
func (cm *CheckpointManager) Stop() {
	close(cm.stopChan)
	cm.wg.Wait()

	// Create final checkpoint
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if _, err := cm.CreateCheckpoint(ctx); err != nil {
		log.Error().Err(err).Msg("Failed to create final checkpoint")
	}

	if err := cm.redis.Close(); err != nil {
		log.Error().Err(err).Msg("Failed to close Redis connection")
	}

	log.Info().Msg("Checkpoint manager stopped")
}

// Helper method for PolicyEngine
func (e *PolicyEngine) getPolicyVersion() string {
	e.mu.RLock()
	defer e.mu.RUnlock()

	// Would return actual policy version hash
	return fmt.Sprintf("v%d", len(e.policies))
}

// Prometheus metrics for checkpointing
var (
	checkpointTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "checkpoint_total",
			Help: "Total number of checkpoints created",
		},
	)

	checkpointErrorsTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "checkpoint_errors_total",
			Help: "Total number of checkpoint errors",
		},
	)

	checkpointRecoveryTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "checkpoint_recovery_total",
			Help: "Total number of checkpoint recoveries",
		},
	)

	checkpointRecoveryDuration = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "checkpoint_recovery_duration_seconds",
			Help:    "Time taken to recover from checkpoint",
			Buckets: []float64{0.1, 0.5, 1, 2, 5, 10},
		},
	)
)

func init() {
	prometheus.MustRegister(checkpointTotal)
	prometheus.MustRegister(checkpointErrorsTotal)
	prometheus.MustRegister(checkpointRecoveryTotal)
	prometheus.MustRegister(checkpointRecoveryDuration)
}
