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

// TransactionState represents the state of a transaction
type TransactionState string

const (
	// StateRouting - Request is being routed
	StateRouting TransactionState = "ROUTING"

	// StateInFlight - Request is being processed by model
	StateInFlight TransactionState = "IN_FLIGHT"

	// StateCompleted - Request completed successfully
	StateCompleted TransactionState = "COMPLETED"

	// StateFailed - Request failed
	StateFailed TransactionState = "FAILED"

	// StateRetrying - Request is being retried
	StateRetrying TransactionState = "RETRYING"
)

// WALEntry represents a Write-Ahead Log entry
type WALEntry struct {
	// Entry metadata
	RequestID    string           `json:"request_id"`
	Timestamp    time.Time        `json:"timestamp"`
	State        TransactionState `json:"state"`
	CheckpointID string           `json:"checkpoint_id"`

	// Request data
	OriginalRequest  *InferenceRequestSnapshot `json:"original_request,omitempty"`
	RoutingDecision  *RoutingDecisionSnapshot  `json:"routing_decision,omitempty"`

	// Execution tracking
	RetryCount       int       `json:"retry_count"`
	LastAttemptAt    time.Time `json:"last_attempt_at,omitempty"`
	ModelCallStarted time.Time `json:"model_call_started,omitempty"`

	// Error tracking
	LastError        string    `json:"last_error,omitempty"`
	ErrorCount       int       `json:"error_count"`

	// Replay metadata
	ReplayCount      int       `json:"replay_count"`
	LastReplayAt     time.Time `json:"last_replay_at,omitempty"`
}

// InferenceRequestSnapshot captures request data for replay
type InferenceRequestSnapshot struct {
	RequestID   string            `json:"request_id"`
	UserID      string            `json:"user_id,omitempty"`
	ModelID     string            `json:"model_id,omitempty"`
	InputData   string            `json:"input_data"` // Serialized input
	Parameters  map[string]string `json:"parameters,omitempty"`
	Priority    string            `json:"priority,omitempty"`
	Deadline    time.Time         `json:"deadline,omitempty"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// TransactionReplayer handles Write-Ahead Log and transaction replay
type TransactionReplayer struct {
	// Redis client for WAL
	redis *redis.Client

	// Configuration
	config ReplayConfig

	// Checkpoint manager reference
	checkpointMgr *CheckpointManager

	// Policy engine reference (for re-routing)
	engine *PolicyEngine

	// Model executor (for retries)
	modelExecutor ModelExecutor

	// Active WAL entries
	activeEntries map[string]*WALEntry
	entriesMu     sync.RWMutex

	// Replay tracking
	replayStats   ReplayStats
	statsMu       sync.RWMutex

	// Shutdown coordination
	stopChan chan struct{}
	wg       sync.WaitGroup
}

// ReplayConfig holds replay configuration
type ReplayConfig struct {
	// WAL settings
	WALEnabled         bool
	WALTTLSeconds      int64 // How long to keep WAL entries
	TimelineMaxEntries int64 // Max entries in timeline sorted set

	// Replay settings
	MaxReplayAttempts  int           // Max times to replay a transaction
	ReplayTimeout      time.Duration // Max time for replay operation
	ReplayBatchSize    int           // Batch size for parallel replay

	// Retry settings
	RetryEnabled       bool
	MaxRetries         int
	RetryBackoffBase   time.Duration
	RetryBackoffMax    time.Duration

	// Cleanup settings
	CleanupInterval    time.Duration
	CleanupBatchSize   int
}

// DefaultReplayConfig returns default configuration
func DefaultReplayConfig() ReplayConfig {
	return ReplayConfig{
		WALEnabled:         true,
		WALTTLSeconds:      3600, // 1 hour
		TimelineMaxEntries: 100000,
		MaxReplayAttempts:  3,
		ReplayTimeout:      30 * time.Second,
		ReplayBatchSize:    10,
		RetryEnabled:       true,
		MaxRetries:         3,
		RetryBackoffBase:   1 * time.Second,
		RetryBackoffMax:    30 * time.Second,
		CleanupInterval:    5 * time.Minute,
		CleanupBatchSize:   1000,
	}
}

// ModelExecutor interface for executing model calls
type ModelExecutor interface {
	Execute(ctx context.Context, request *InferenceRequestSnapshot, decision *RoutingDecisionSnapshot) error
}

// ReplayStats tracks replay statistics
type ReplayStats struct {
	TotalReplays       int64
	SuccessfulReplays  int64
	FailedReplays      int64
	RetriedRequests    int64
	DroppedRequests    int64
	AverageReplayTime  time.Duration
	LastReplayAt       time.Time
}

// NewTransactionReplayer creates a new transaction replayer
func NewTransactionReplayer(
	redisClient *redis.Client,
	config ReplayConfig,
	checkpointMgr *CheckpointManager,
	engine *PolicyEngine,
	executor ModelExecutor,
) *TransactionReplayer {
	tr := &TransactionReplayer{
		redis:         redisClient,
		config:        config,
		checkpointMgr: checkpointMgr,
		engine:        engine,
		modelExecutor: executor,
		activeEntries: make(map[string]*WALEntry),
		stopChan:      make(chan struct{}),
	}

	// Start cleanup loop
	tr.wg.Add(1)
	go tr.cleanupLoop()

	log.Info().
		Bool("wal_enabled", config.WALEnabled).
		Int("max_replay_attempts", config.MaxReplayAttempts).
		Msg("Transaction replayer initialized")

	return tr
}

// WriteWALEntry writes a WAL entry for a transaction
func (tr *TransactionReplayer) WriteWALEntry(ctx context.Context, entry *WALEntry) error {
	if !tr.config.WALEnabled {
		return nil
	}

	// Serialize entry
	data, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("failed to marshal WAL entry: %w", err)
	}

	// Store entry
	walKey := fmt.Sprintf("routing:wal:%s", entry.RequestID)
	if err := tr.redis.Set(ctx, walKey, data, time.Duration(tr.config.WALTTLSeconds)*time.Second).Err(); err != nil {
		return fmt.Errorf("failed to write WAL entry: %w", err)
	}

	// Add to timeline (sorted by timestamp)
	timelineKey := "routing:wal:timeline"
	score := float64(entry.Timestamp.Unix())
	if err := tr.redis.ZAdd(ctx, timelineKey, &redis.Z{
		Score:  score,
		Member: entry.RequestID,
	}).Err(); err != nil {
		return fmt.Errorf("failed to add to WAL timeline: %w", err)
	}

	// Track in memory
	tr.entriesMu.Lock()
	tr.activeEntries[entry.RequestID] = entry
	tr.entriesMu.Unlock()

	log.Debug().
		Str("request_id", entry.RequestID).
		Str("state", string(entry.State)).
		Msg("WAL entry written")

	walEntriesWritten.Inc()

	return nil
}

// UpdateWALEntry updates an existing WAL entry
func (tr *TransactionReplayer) UpdateWALEntry(ctx context.Context, requestID string, newState TransactionState, updateFunc func(*WALEntry)) error {
	if !tr.config.WALEnabled {
		return nil
	}

	// Get existing entry
	entry, err := tr.GetWALEntry(ctx, requestID)
	if err != nil {
		return err
	}

	// Update fields
	entry.State = newState
	entry.Timestamp = time.Now()
	if updateFunc != nil {
		updateFunc(entry)
	}

	// Write updated entry
	return tr.WriteWALEntry(ctx, entry)
}

// GetWALEntry retrieves a WAL entry
func (tr *TransactionReplayer) GetWALEntry(ctx context.Context, requestID string) (*WALEntry, error) {
	// Check memory first
	tr.entriesMu.RLock()
	if entry, exists := tr.activeEntries[requestID]; exists {
		tr.entriesMu.RUnlock()
		return entry, nil
	}
	tr.entriesMu.RUnlock()

	// Load from Redis
	walKey := fmt.Sprintf("routing:wal:%s", requestID)
	data, err := tr.redis.Get(ctx, walKey).Result()
	if err == redis.Nil {
		return nil, fmt.Errorf("WAL entry not found: %s", requestID)
	} else if err != nil {
		return nil, fmt.Errorf("failed to get WAL entry: %w", err)
	}

	var entry WALEntry
	if err := json.Unmarshal([]byte(data), &entry); err != nil {
		return nil, fmt.Errorf("failed to unmarshal WAL entry: %w", err)
	}

	return &entry, nil
}

// DeleteWALEntry removes a WAL entry (when completed)
func (tr *TransactionReplayer) DeleteWALEntry(ctx context.Context, requestID string) error {
	if !tr.config.WALEnabled {
		return nil
	}

	// Remove from Redis
	walKey := fmt.Sprintf("routing:wal:%s", requestID)
	if err := tr.redis.Del(ctx, walKey).Err(); err != nil {
		return fmt.Errorf("failed to delete WAL entry: %w", err)
	}

	// Remove from timeline
	timelineKey := "routing:wal:timeline"
	if err := tr.redis.ZRem(ctx, timelineKey, requestID).Err(); err != nil {
		return fmt.Errorf("failed to remove from timeline: %w", err)
	}

	// Remove from memory
	tr.entriesMu.Lock()
	delete(tr.activeEntries, requestID)
	tr.entriesMu.Unlock()

	log.Debug().Str("request_id", requestID).Msg("WAL entry deleted")

	return nil
}

// ReplayTransactions replays transactions from WAL after crash recovery
func (tr *TransactionReplayer) ReplayTransactions(ctx context.Context, sinceCheckpoint time.Time) (*ReplayResult, error) {
	startTime := time.Now()

	log.Info().
		Time("since_checkpoint", sinceCheckpoint).
		Msg("Starting transaction replay")

	// Get all WAL entries since checkpoint
	entries, err := tr.getWALEntriesSince(ctx, sinceCheckpoint)
	if err != nil {
		return nil, fmt.Errorf("failed to get WAL entries: %w", err)
	}

	if len(entries) == 0 {
		log.Info().Msg("No transactions to replay")
		return &ReplayResult{
			TotalEntries: 0,
			Duration:     time.Since(startTime),
		}, nil
	}

	log.Info().Int("entries", len(entries)).Msg("Found transactions to replay")

	// Replay in batches
	result := &ReplayResult{
		TotalEntries:  len(entries),
		StartTime:     startTime,
		ReplayedByState: make(map[TransactionState]int),
	}

	for i := 0; i < len(entries); i += tr.config.ReplayBatchSize {
		end := i + tr.config.ReplayBatchSize
		if end > len(entries) {
			end = len(entries)
		}

		batch := entries[i:end]
		batchResults := tr.replayBatch(ctx, batch)

		// Aggregate results
		result.Successful += batchResults.Successful
		result.Failed += batchResults.Failed
		result.Skipped += batchResults.Skipped

		for state, count := range batchResults.ReplayedByState {
			result.ReplayedByState[state] += count
		}
	}

	result.Duration = time.Since(startTime)

	// Update stats
	tr.statsMu.Lock()
	tr.replayStats.TotalReplays += int64(result.TotalEntries)
	tr.replayStats.SuccessfulReplays += int64(result.Successful)
	tr.replayStats.FailedReplays += int64(result.Failed)
	tr.replayStats.LastReplayAt = time.Now()
	tr.replayStats.AverageReplayTime = result.Duration / time.Duration(result.TotalEntries)
	tr.statsMu.Unlock()

	log.Info().
		Int("total", result.TotalEntries).
		Int("successful", result.Successful).
		Int("failed", result.Failed).
		Int("skipped", result.Skipped).
		Dur("duration", result.Duration).
		Msg("Transaction replay completed")

	// Export metrics
	transactionReplayTotal.Add(float64(result.TotalEntries))
	transactionReplaySuccessful.Add(float64(result.Successful))
	transactionReplayFailed.Add(float64(result.Failed))
	transactionReplayDuration.Observe(result.Duration.Seconds())

	return result, nil
}

// getWALEntriesSince retrieves WAL entries since a given time
func (tr *TransactionReplayer) getWALEntriesSince(ctx context.Context, since time.Time) ([]*WALEntry, error) {
	timelineKey := "routing:wal:timeline"
	minScore := float64(since.Unix())
	maxScore := float64(time.Now().Unix())

	// Get request IDs from timeline
	requestIDs, err := tr.redis.ZRangeByScore(ctx, timelineKey, &redis.ZRangeBy{
		Min: fmt.Sprintf("%f", minScore),
		Max: fmt.Sprintf("%f", maxScore),
	}).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get timeline range: %w", err)
	}

	// Load entries
	entries := make([]*WALEntry, 0, len(requestIDs))
	for _, requestID := range requestIDs {
		entry, err := tr.GetWALEntry(ctx, requestID)
		if err != nil {
			log.Warn().Err(err).Str("request_id", requestID).Msg("Failed to load WAL entry")
			continue
		}
		entries = append(entries, entry)
	}

	return entries, nil
}

// replayBatch replays a batch of transactions
func (tr *TransactionReplayer) replayBatch(ctx context.Context, entries []*WALEntry) *ReplayResult {
	result := &ReplayResult{
		ReplayedByState: make(map[TransactionState]int),
	}

	var wg sync.WaitGroup
	resultChan := make(chan *replayOutcome, len(entries))

	for _, entry := range entries {
		wg.Add(1)
		go func(e *WALEntry) {
			defer wg.Done()
			outcome := tr.replayEntry(ctx, e)
			resultChan <- outcome
		}(entry)
	}

	// Wait for all replays
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// Collect results
	for outcome := range resultChan {
		if outcome.Success {
			result.Successful++
		} else if outcome.Skipped {
			result.Skipped++
		} else {
			result.Failed++
		}

		if outcome.State != "" {
			result.ReplayedByState[outcome.State]++
		}
	}

	return result
}

// replayEntry replays a single WAL entry
func (tr *TransactionReplayer) replayEntry(ctx context.Context, entry *WALEntry) *replayOutcome {
	outcome := &replayOutcome{State: entry.State}

	// Check replay limit
	if entry.ReplayCount >= tr.config.MaxReplayAttempts {
		log.Warn().
			Str("request_id", entry.RequestID).
			Int("replay_count", entry.ReplayCount).
			Msg("Max replay attempts reached, dropping request")

		tr.statsMu.Lock()
		tr.replayStats.DroppedRequests++
		tr.statsMu.Unlock()

		// Delete WAL entry
		_ = tr.DeleteWALEntry(ctx, entry.RequestID)

		outcome.Skipped = true
		return outcome
	}

	// Update replay metadata
	entry.ReplayCount++
	entry.LastReplayAt = time.Now()

	// Replay based on state
	switch entry.State {
	case StateRouting:
		outcome.Success = tr.replayRouting(ctx, entry)

	case StateInFlight:
		outcome.Success = tr.replayInFlight(ctx, entry)

	case StateCompleted:
		// Already completed, skip
		_ = tr.DeleteWALEntry(ctx, entry.RequestID)
		outcome.Skipped = true
		outcome.Success = true

	case StateFailed:
		// Retry if enabled
		if tr.config.RetryEnabled && entry.RetryCount < tr.config.MaxRetries {
			outcome.Success = tr.retryRequest(ctx, entry)
		} else {
			_ = tr.DeleteWALEntry(ctx, entry.RequestID)
			outcome.Skipped = true
		}

	default:
		log.Warn().
			Str("request_id", entry.RequestID).
			Str("state", string(entry.State)).
			Msg("Unknown WAL entry state")
		outcome.Skipped = true
	}

	// Update WAL entry
	if outcome.Success {
		_ = tr.UpdateWALEntry(ctx, entry.RequestID, StateCompleted, nil)
	}

	return outcome
}

// replayRouting re-evaluates routing for a request
func (tr *TransactionReplayer) replayRouting(ctx context.Context, entry *WALEntry) bool {
	log.Debug().
		Str("request_id", entry.RequestID).
		Msg("Replaying routing decision")

	// Re-route request through policy engine
	// In production, this would actually re-evaluate the routing
	// For now, we'll use the cached decision if available

	if entry.RoutingDecision != nil {
		// Submit to model with cached decision
		return tr.submitToModel(ctx, entry)
	}

	log.Warn().
		Str("request_id", entry.RequestID).
		Msg("No routing decision available for replay")

	return false
}

// replayInFlight resubmits an inflight request
func (tr *TransactionReplayer) replayInFlight(ctx context.Context, entry *WALEntry) bool {
	log.Debug().
		Str("request_id", entry.RequestID).
		Msg("Replaying inflight request")

	// Resubmit to model
	return tr.submitToModel(ctx, entry)
}

// retryRequest retries a failed request
func (tr *TransactionReplayer) retryRequest(ctx context.Context, entry *WALEntry) bool {
	log.Debug().
		Str("request_id", entry.RequestID).
		Int("retry_count", entry.RetryCount).
		Msg("Retrying failed request")

	entry.RetryCount++

	tr.statsMu.Lock()
	tr.replayStats.RetriedRequests++
	tr.statsMu.Unlock()

	// Calculate backoff
	backoff := tr.calculateBackoff(entry.RetryCount)
	time.Sleep(backoff)

	// Retry submission
	return tr.submitToModel(ctx, entry)
}

// submitToModel submits a request to the model
func (tr *TransactionReplayer) submitToModel(ctx context.Context, entry *WALEntry) bool {
	if tr.modelExecutor == nil {
		log.Warn().Msg("No model executor configured")
		return false
	}

	// Execute model call
	if err := tr.modelExecutor.Execute(ctx, entry.OriginalRequest, entry.RoutingDecision); err != nil {
		log.Error().
			Err(err).
			Str("request_id", entry.RequestID).
			Msg("Model execution failed during replay")

		// Update error tracking
		entry.LastError = err.Error()
		entry.ErrorCount++

		return false
	}

	return true
}

// calculateBackoff calculates exponential backoff
func (tr *TransactionReplayer) calculateBackoff(retryCount int) time.Duration {
	backoff := tr.config.RetryBackoffBase * time.Duration(1<<uint(retryCount))
	if backoff > tr.config.RetryBackoffMax {
		backoff = tr.config.RetryBackoffMax
	}
	return backoff
}

// cleanupLoop periodically cleans up old WAL entries
func (tr *TransactionReplayer) cleanupLoop() {
	defer tr.wg.Done()

	ticker := time.NewTicker(tr.config.CleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			ctx := context.Background()
			if err := tr.cleanupOldEntries(ctx); err != nil {
				log.Error().Err(err).Msg("Failed to cleanup old WAL entries")
			}

		case <-tr.stopChan:
			return
		}
	}
}

// cleanupOldEntries removes old completed/failed entries
func (tr *TransactionReplayer) cleanupOldEntries(ctx context.Context) error {
	cutoffTime := time.Now().Add(-time.Duration(tr.config.WALTTLSeconds) * time.Second)
	timelineKey := "routing:wal:timeline"

	// Get old entries
	oldIDs, err := tr.redis.ZRangeByScore(ctx, timelineKey, &redis.ZRangeBy{
		Min: "0",
		Max: fmt.Sprintf("%f", float64(cutoffTime.Unix())),
	}).Result()
	if err != nil {
		return err
	}

	if len(oldIDs) == 0 {
		return nil
	}

	// Delete in batches
	for i := 0; i < len(oldIDs); i += tr.config.CleanupBatchSize {
		end := i + tr.config.CleanupBatchSize
		if end > len(oldIDs) {
			end = len(oldIDs)
		}

		batch := oldIDs[i:end]
		for _, id := range batch {
			_ = tr.DeleteWALEntry(ctx, id)
		}
	}

	log.Debug().Int("cleaned", len(oldIDs)).Msg("Cleaned up old WAL entries")

	return nil
}

// GetStats returns replay statistics
func (tr *TransactionReplayer) GetStats() ReplayStats {
	tr.statsMu.RLock()
	defer tr.statsMu.RUnlock()
	return tr.replayStats
}

// Stop stops the transaction replayer
func (tr *TransactionReplayer) Stop() {
	close(tr.stopChan)
	tr.wg.Wait()
	log.Info().Msg("Transaction replayer stopped")
}

// ReplayResult holds the result of a replay operation
type ReplayResult struct {
	TotalEntries    int
	Successful      int
	Failed          int
	Skipped         int
	StartTime       time.Time
	Duration        time.Duration
	ReplayedByState map[TransactionState]int
}

// replayOutcome represents the outcome of replaying a single entry
type replayOutcome struct {
	Success bool
	Skipped bool
	State   TransactionState
}

// Prometheus metrics
var (
	transactionReplayTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "transaction_replay_total",
			Help: "Total number of transactions replayed",
		},
	)

	transactionReplaySuccessful = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "transaction_replay_successful",
			Help: "Number of successful transaction replays",
		},
	)

	transactionReplayFailed = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "transaction_replay_failed",
			Help: "Number of failed transaction replays",
		},
	)

	transactionReplayDuration = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "transaction_replay_duration_seconds",
			Help:    "Time taken to replay transactions",
			Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30},
		},
	)

	walEntriesWritten = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "wal_entries_written_total",
			Help: "Total number of WAL entries written",
		},
	)
)

func init() {
	prometheus.MustRegister(transactionReplayTotal)
	prometheus.MustRegister(transactionReplaySuccessful)
	prometheus.MustRegister(transactionReplayFailed)
	prometheus.MustRegister(transactionReplayDuration)
	prometheus.MustRegister(walEntriesWritten)
}
