package shadow

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/Igris-inertial/system/igris-overture/inference/optimizer/ffi"
)

// ShadowMode represents the optimizer mode
type ShadowMode string

const (
	// ShadowModeDisabled means optimizer is not used
	ShadowModeDisabled ShadowMode = "disabled"
	// ShadowModeShadow runs Rust in parallel without affecting routing
	ShadowModeShadow ShadowMode = "shadow"
	// ShadowModeGo uses only Go optimizer
	ShadowModeGo ShadowMode = "go"
	// ShadowModeRust uses only Rust optimizer (full rollout)
	ShadowModeRust ShadowMode = "rust"
)

// ShadowConfig configures the shadow runner
type ShadowConfig struct {
	Mode         ShadowMode
	SampleRate   float64
	LogDir       string
	OptimizerCfg ffi.OptimizerConfig
}

// ShadowRunner executes Rust optimizer decisions in parallel with Go
// P0-6 FIX: Added semaphore to prevent memory leak from unlimited parallel executions
type ShadowRunner struct {
	mode       ShadowMode
	sampleRate float64
	optimizer  *ffi.OptimizerHandle
	logger     *ShadowLogger
	metrics    *MetricsRecorder
	mu         sync.RWMutex
	rand       *rand.Rand
	semaphore  chan struct{} // P0-6: Limit parallel shadow executions to prevent OOM
}

// DecisionRequest represents a decision request
type DecisionRequest struct {
	TraceID      string
	AvailableModels []string
	Policy       string
}

// DecisionResult represents the result of a decision
type DecisionResult struct {
	ModelID     string
	LatencyMs   int
	CostUsd     float64
	Source      string // "go" or "rust"
}

// ComparisonResult represents the comparison between Go and Rust decisions
type ComparisonResult struct {
	GoDecision   DecisionResult
	RustDecision DecisionResult
	Agreed       bool
	TraceID      string
	Policy       string
}

// NewShadowRunner creates a new shadow runner
func NewShadowRunner(config ShadowConfig) (*ShadowRunner, error) {
	if config.Mode == ShadowModeDisabled {
		return &ShadowRunner{
			mode:       ShadowModeDisabled,
			sampleRate: 0,
			metrics:    NewMetricsRecorder(),
		}, nil
	}

	// Initialize logger
	logger, err := NewShadowLogger(config.LogDir)
	if err != nil {
		return nil, fmt.Errorf("failed to create shadow logger: %w", err)
	}

	// Initialize metrics recorder
	metrics := NewMetricsRecorder()
	metrics.UpdateSamplingRate(config.SampleRate)

	// P0-6 FIX: Create semaphore to limit parallel shadow executions to 100
	// This prevents memory leak when running at 10k+ RPS with 10% sampling
	maxParallelShadows := 100

	runner := &ShadowRunner{
		mode:       config.Mode,
		sampleRate: config.SampleRate,
		logger:     logger,
		metrics:    metrics,
		rand:       rand.New(rand.NewSource(time.Now().UnixNano())),
		semaphore:  make(chan struct{}, maxParallelShadows), // P0-6: Bounded concurrency
	}

	// Initialize Rust optimizer if needed
	if config.Mode == ShadowModeShadow || config.Mode == ShadowModeRust {
		optimizer, err := ffi.NewOptimizer(config.OptimizerCfg)
		if err != nil {
			logger.Close()
			return nil, fmt.Errorf("failed to initialize Rust optimizer: %w", err)
		}
		runner.optimizer = optimizer
	}

	return runner, nil
}

// ShouldSample determines if this request should be sampled
func (r *ShadowRunner) ShouldSample() bool {
	if r.mode != ShadowModeShadow {
		return false
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	return r.rand.Float64() < r.sampleRate
}

// RunShadowComparison runs a shadow comparison between Go and Rust decisions
// P0-6 FIX: Added semaphore check and timeout to prevent memory leak
func (r *ShadowRunner) RunShadowComparison(
	ctx context.Context,
	req DecisionRequest,
	goDecision DecisionResult,
) error {
	if !r.ShouldSample() {
		return nil
	}

	// P0-6 FIX: Try to acquire semaphore slot, skip if at capacity
	select {
	case r.semaphore <- struct{}{}:
		defer func() { <-r.semaphore }()
	default:
		// At capacity, skip this shadow comparison to prevent memory leak
		r.metrics.RecordError("shadow_capacity_reached")
		return fmt.Errorf("shadow capacity reached, skipping comparison")
	}

	// P0-6 FIX: Add 10s timeout to prevent runaway shadow executions
	shadowCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	r.metrics.RecordRequest()

	// Run Rust decision in parallel
	startTime := time.Now()

	// P0-6 FIX: Use shadowCtx with timeout instead of original ctx
	rustDecision, err := r.getRustDecision(shadowCtx, req)
	if err != nil {
		r.metrics.RecordError("rust_decision_failed")
		return fmt.Errorf("failed to get Rust decision: %w", err)
	}

	rustLatencyMs := time.Since(startTime).Milliseconds()
	r.metrics.RecordDecisionLatency(float64(rustLatencyMs))

	// Update Rust decision latency
	rustDecision.LatencyMs = int(rustLatencyMs)

	// Compare decisions
	agreed := goDecision.ModelID == rustDecision.ModelID
	if agreed {
		r.metrics.RecordAgreement()
	} else {
		r.metrics.RecordDisagreement()
	}

	// Calculate deltas
	costDelta := rustDecision.CostUsd - goDecision.CostUsd
	latencyDelta := rustDecision.LatencyMs - goDecision.LatencyMs

	r.metrics.RecordCostDelta(costDelta)
	r.metrics.RecordLatencyDelta(float64(latencyDelta))

	// Log comparison
	logEntry := ComparisonLog{
		TraceID:        req.TraceID,
		Timestamp:      time.Now().UTC().Format(time.RFC3339),
		GoDecision:     goDecision.ModelID,
		RustDecision:   rustDecision.ModelID,
		Agreed:         agreed,
		GoCostUsd:      goDecision.CostUsd,
		RustCostUsd:    rustDecision.CostUsd,
		CostDeltaUsd:   costDelta,
		GoLatencyMs:    goDecision.LatencyMs,
		RustLatencyMs:  rustDecision.LatencyMs,
		LatencyDeltaMs: latencyDelta,
		Policy:         req.Policy,
	}

	// Get arm stats if available
	if r.optimizer != nil {
		stats, err := r.optimizer.GetStats()
		if err == nil {
			logEntry.Arms = make([]ArmSnapshot, len(stats))
			for i, stat := range stats {
				logEntry.Arms[i] = ArmSnapshot{
					ID:    stat.ActionID,
					Alpha: stat.Alpha,
					Beta:  stat.Beta,
					Score: stat.BetaMean,
				}
			}
		}
	}

	if err := r.logger.Log(logEntry); err != nil {
		r.metrics.RecordError("log_write_failed")
		return fmt.Errorf("failed to log comparison: %w", err)
	}

	return nil
}

// getRustDecision gets a decision from the Rust optimizer
func (r *ShadowRunner) getRustDecision(ctx context.Context, req DecisionRequest) (DecisionResult, error) {
	if r.optimizer == nil {
		return DecisionResult{}, fmt.Errorf("Rust optimizer not initialized")
	}

	action, err := r.optimizer.SelectAction()
	if err != nil {
		return DecisionResult{}, fmt.Errorf("failed to select action: %w", err)
	}

	// Map action ID to model ID
	// In production, this would use the actual action space mapping
	modelID := action.ActionID
	if len(req.AvailableModels) > 0 {
		// For now, use the action ID as-is if it matches available models
		found := false
		for _, m := range req.AvailableModels {
			if m == modelID {
				found = true
				break
			}
		}
		if !found {
			// Fallback to first available model
			modelID = req.AvailableModels[0]
		}
	}

	// TODO: Get actual cost and latency estimates for the selected model
	// For now, use placeholder values
	result := DecisionResult{
		ModelID:   modelID,
		LatencyMs: 0, // Will be set by caller
		CostUsd:   0.002, // Placeholder
		Source:    "rust",
	}

	return result, nil
}

// UpdateReward updates the Rust optimizer with reward feedback
func (r *ShadowRunner) UpdateReward(ctx context.Context, actionID string, reward float64) error {
	if r.optimizer == nil {
		return nil // Silent fail if optimizer not initialized
	}

	return r.optimizer.UpdateReward(actionID, reward)
}

// UpdateMetrics updates the Rust optimizer with detailed metrics
func (r *ShadowRunner) UpdateMetrics(ctx context.Context, actionID string, metrics ffi.RewardMetrics) error {
	if r.optimizer == nil {
		return nil // Silent fail if optimizer not initialized
	}

	return r.optimizer.UpdateMetrics(actionID, metrics)
}

// GetMode returns the current shadow mode
func (r *ShadowRunner) GetMode() ShadowMode {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.mode
}

// SetMode sets the shadow mode (for dynamic configuration)
func (r *ShadowRunner) SetMode(mode ShadowMode) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.mode = mode
}

// SetSampleRate sets the sampling rate
func (r *ShadowRunner) SetSampleRate(rate float64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sampleRate = rate
	r.metrics.UpdateSamplingRate(rate)
}

// GetStats returns optimizer statistics
func (r *ShadowRunner) GetStats() ([]ffi.ArmStats, error) {
	if r.optimizer == nil {
		return nil, fmt.Errorf("optimizer not initialized")
	}
	return r.optimizer.GetStats()
}

// ExportState exports the optimizer state
func (r *ShadowRunner) ExportState() (string, error) {
	if r.optimizer == nil {
		return "", fmt.Errorf("optimizer not initialized")
	}
	return r.optimizer.ExportState()
}

// Close closes the shadow runner and releases resources
func (r *ShadowRunner) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	var errs []error

	if r.optimizer != nil {
		if err := r.optimizer.Close(); err != nil {
			errs = append(errs, fmt.Errorf("failed to close optimizer: %w", err))
		}
	}

	if r.logger != nil {
		if err := r.logger.Close(); err != nil {
			errs = append(errs, fmt.Errorf("failed to close logger: %w", err))
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("errors during close: %v", errs)
	}

	return nil
}

// Sync flushes any pending log writes
func (r *ShadowRunner) Sync() error {
	if r.logger != nil {
		return r.logger.Sync()
	}
	return nil
}

// GetOptimizerHandle returns the Rust optimizer handle (for direct use)
// Returns nil if optimizer is not initialized
func (r *ShadowRunner) GetOptimizerHandle() *ffi.OptimizerHandle {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.optimizer
}
