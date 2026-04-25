//go:build cgo && igris_native

// Package ffi provides cgo bindings to the Rust optimizer library.
package ffi

/*
#cgo darwin LDFLAGS: -L${SRCDIR}/../../../../rust-core/rust_kernel/target/release -ligris_kernel
#cgo linux LDFLAGS: -L${SRCDIR}/../../../../rust-core/rust_kernel/target/release -ligris_kernel -ldl -lm
#include <stdlib.h>

typedef struct OptimizerHandle OptimizerHandle;

OptimizerHandle* optimizer_init(const char* config_json);
char* optimizer_select_action(OptimizerHandle* handle);
int optimizer_update_reward(OptimizerHandle* handle, const char* action_id, double reward);
int optimizer_update_metrics(OptimizerHandle* handle, const char* action_id, const char* metrics_json);
char* optimizer_export_state(OptimizerHandle* handle);
char* optimizer_get_stats(OptimizerHandle* handle);
void optimizer_free(OptimizerHandle* handle);
void optimizer_free_string(char* s);
*/
import "C"
import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"unsafe"

	"github.com/Igris-inertial/system/igris-overture/metrics"
)

// OptimizerHandle wraps the Rust optimizer handle
type OptimizerHandle struct {
	handle *C.OptimizerHandle
}

// OptimizerConfig represents the configuration for the optimizer
type OptimizerConfig struct {
	Arms              []string      `json:"arms"`
	SuccessThreshold  float64       `json:"success_threshold"`
	InitialAlpha      float64       `json:"initial_alpha"`
	InitialBeta       float64       `json:"initial_beta"`
	RewardPolicy      RewardPolicy  `json:"reward_policy"`
}

// RewardPolicy defines how rewards are calculated
type RewardPolicy struct {
	LatencyWeight     float64 `json:"latency_weight"`
	SuccessWeight     float64 `json:"success_weight"`
	CacheWeight       float64 `json:"cache_weight"`
	CostWeight        float64 `json:"cost_weight"`
	QualityWeight     float64 `json:"quality_weight"`
	TargetLatencyMs   float64 `json:"target_latency_ms"`
	MaxLatencyMs      float64 `json:"max_latency_ms"`
	TargetCostUsd     float64 `json:"target_cost_usd"`
	MaxCostUsd        float64 `json:"max_cost_usd"`
}

// Action represents a selected action from the optimizer
type Action struct {
	ActionID  string `json:"action_id"`
	Timestamp string `json:"timestamp"`
}

// RewardMetrics represents metrics for reward calculation
type RewardMetrics struct {
	LatencyMs    float64  `json:"latency_ms"`
	Success      bool     `json:"success"`
	CacheHit     bool     `json:"cache_hit"`
	CostUsd      float64  `json:"cost_usd"`
	QualityScore *float64 `json:"quality_score,omitempty"`
}

// ArmStats represents statistics for a bandit arm
type ArmStats struct {
	ActionID        string  `json:"action_id"`
	Alpha           float64 `json:"alpha"`
	Beta            float64 `json:"beta"`
	Pulls           int     `json:"pulls"`
	MeanReward      float64 `json:"mean_reward"`
	BetaMean        float64 `json:"beta_mean"`
	ConfidenceWidth float64 `json:"confidence_width"`
}

// NewOptimizer creates a new optimizer instance from configuration
func NewOptimizer(config OptimizerConfig) (*OptimizerHandle, error) {
	configJSON, err := json.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	cConfig := C.CString(string(configJSON))
	defer C.free(unsafe.Pointer(cConfig))

	handle := C.optimizer_init(cConfig)
	if handle == nil {
		return nil, fmt.Errorf("optimizer_init returned null - invalid configuration or initialization failure")
	}

	return &OptimizerHandle{handle: handle}, nil
}

// SelectAction selects the best action using Thompson Sampling
func (o *OptimizerHandle) SelectAction() (*Action, error) {
	if o.handle == nil {
		return nil, fmt.Errorf("optimizer handle is nil")
	}

	// Phase 4.3.1: Track selection timing
	startTime := time.Now()

	cResult := C.optimizer_select_action(o.handle)
	if cResult == nil {
		return nil, fmt.Errorf("optimizer_select_action returned null")
	}
	defer C.optimizer_free_string(cResult)

	result := C.GoString(cResult)
	var action Action
	if err := json.Unmarshal([]byte(result), &action); err != nil {
		return nil, fmt.Errorf("failed to unmarshal action: %w", err)
	}

	// Phase 4.3.1: Record optimizer decision metrics
	selectionTimeUs := time.Since(startTime).Microseconds()
	provider := extractProviderFromAction(action.ActionID)
	metrics.RecordOptimizerDecision(provider, "thompson_sampling", selectionTimeUs, -1) // -1 = no reward yet

	return &action, nil
}

// UpdateReward updates the optimizer with a reward value
func (o *OptimizerHandle) UpdateReward(actionID string, reward float64) error {
	if o.handle == nil {
		return fmt.Errorf("optimizer handle is nil")
	}

	cActionID := C.CString(actionID)
	defer C.free(unsafe.Pointer(cActionID))

	result := C.optimizer_update_reward(o.handle, cActionID, C.double(reward))
	if result != 0 {
		return fmt.Errorf("optimizer_update_reward failed with code %d", result)
	}

	return nil
}

// UpdateMetrics updates the optimizer with detailed metrics
func (o *OptimizerHandle) UpdateMetrics(actionID string, rewardMetrics RewardMetrics) error {
	if o.handle == nil {
		return fmt.Errorf("optimizer handle is nil")
	}

	metricsJSON, err := json.Marshal(rewardMetrics)
	if err != nil {
		return fmt.Errorf("failed to marshal metrics: %w", err)
	}

	cActionID := C.CString(actionID)
	defer C.free(unsafe.Pointer(cActionID))

	cMetrics := C.CString(string(metricsJSON))
	defer C.free(unsafe.Pointer(cMetrics))

	result := C.optimizer_update_metrics(o.handle, cActionID, cMetrics)
	if result != 0 {
		return fmt.Errorf("optimizer_update_metrics failed with code %d", result)
	}

	// Phase 4.3.1: After updating optimizer, refresh arm stats in Prometheus
	go o.updateArmStatsMetrics()

	return nil
}

// ExportState exports the optimizer state as JSON
func (o *OptimizerHandle) ExportState() (string, error) {
	if o.handle == nil {
		return "", fmt.Errorf("optimizer handle is nil")
	}

	cResult := C.optimizer_export_state(o.handle)
	if cResult == nil {
		return "", fmt.Errorf("optimizer_export_state returned null")
	}
	defer C.optimizer_free_string(cResult)

	return C.GoString(cResult), nil
}

// GetStats returns statistics for all arms
func (o *OptimizerHandle) GetStats() ([]ArmStats, error) {
	if o.handle == nil {
		return nil, fmt.Errorf("optimizer handle is nil")
	}

	cResult := C.optimizer_get_stats(o.handle)
	if cResult == nil {
		return nil, fmt.Errorf("optimizer_get_stats returned null")
	}
	defer C.optimizer_free_string(cResult)

	result := C.GoString(cResult)
	var stats []ArmStats
	if err := json.Unmarshal([]byte(result), &stats); err != nil {
		return nil, fmt.Errorf("failed to unmarshal stats: %w", err)
	}

	return stats, nil
}

// Close frees the Rust optimizer resources
func (o *OptimizerHandle) Close() error {
	if o.handle != nil {
		C.optimizer_free(o.handle)
		o.handle = nil
	}
	return nil
}

// updateArmStatsMetrics updates Prometheus metrics with current arm statistics
func (o *OptimizerHandle) updateArmStatsMetrics() {
	stats, err := o.GetStats()
	if err != nil {
		return // Silently fail for metrics updates
	}

	for _, armStat := range stats {
		provider := extractProviderFromAction(armStat.ActionID)

		// Calculate success rate from Beta distribution
		successRate := armStat.Alpha / (armStat.Alpha + armStat.Beta)

		// Update Prometheus metrics
		metrics.UpdateOptimizerArmStats(provider, armStat.Alpha, armStat.Beta, successRate)
	}
}

// extractProviderFromAction extracts provider name from action ID
// Action ID format: "provider/model" (e.g., "openai/gpt-4")
func extractProviderFromAction(actionID string) string {
	parts := strings.Split(actionID, "/")
	if len(parts) == 0 {
		return "unknown"
	}
	return parts[0]
}

// DefaultConfig returns a default optimizer configuration
func DefaultConfig() OptimizerConfig {
	return OptimizerConfig{
		Arms: []string{
			"openai/gpt-4",
			"anthropic/claude-3-5-sonnet",
			"anthropic/claude-3-opus",
		},
		SuccessThreshold: 0.6,
		InitialAlpha:     1.0,
		InitialBeta:      1.0,
		RewardPolicy: RewardPolicy{
			LatencyWeight:   0.4,
			SuccessWeight:   0.3,
			CacheWeight:     0.1,
			CostWeight:      0.15,
			QualityWeight:   0.05,
			TargetLatencyMs: 100.0,
			MaxLatencyMs:    2000.0,
			TargetCostUsd:   0.001,
			MaxCostUsd:      0.01,
		},
	}
}
