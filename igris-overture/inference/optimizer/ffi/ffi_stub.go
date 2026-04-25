//go:build !cgo || !igris_native

// Stub implementation for builds without native Rust linkage.
// The Rust FFI optimizer is unavailable; all calls return errors so the caller falls back
// to the pure-Go Thompson Sampling implementation.
package ffi

import "fmt"

type OptimizerHandle struct{}

type OptimizerConfig struct {
	Arms             []string     `json:"arms"`
	SuccessThreshold float64      `json:"success_threshold"`
	InitialAlpha     float64      `json:"initial_alpha"`
	InitialBeta      float64      `json:"initial_beta"`
	RewardPolicy     RewardPolicy `json:"reward_policy"`
}

type RewardPolicy struct {
	LatencyWeight   float64 `json:"latency_weight"`
	SuccessWeight   float64 `json:"success_weight"`
	CacheWeight     float64 `json:"cache_weight"`
	CostWeight      float64 `json:"cost_weight"`
	QualityWeight   float64 `json:"quality_weight"`
	TargetLatencyMs float64 `json:"target_latency_ms"`
	MaxLatencyMs    float64 `json:"max_latency_ms"`
	TargetCostUsd   float64 `json:"target_cost_usd"`
	MaxCostUsd      float64 `json:"max_cost_usd"`
}

type Action struct {
	ActionID  string `json:"action_id"`
	Timestamp string `json:"timestamp"`
}

type RewardMetrics struct {
	LatencyMs    float64  `json:"latency_ms"`
	Success      bool     `json:"success"`
	CacheHit     bool     `json:"cache_hit"`
	CostUsd      float64  `json:"cost_usd"`
	QualityScore *float64 `json:"quality_score,omitempty"`
}

type ArmStats struct {
	ActionID        string  `json:"action_id"`
	Alpha           float64 `json:"alpha"`
	Beta            float64 `json:"beta"`
	Pulls           int     `json:"pulls"`
	MeanReward      float64 `json:"mean_reward"`
	BetaMean        float64 `json:"beta_mean"`
	ConfidenceWidth float64 `json:"confidence_width"`
}

var errNoFFI = fmt.Errorf("rust FFI optimizer unavailable (built without CGo)")

func NewOptimizer(_ OptimizerConfig) (*OptimizerHandle, error) { return nil, errNoFFI }
func (o *OptimizerHandle) SelectAction() (*Action, error)      { return nil, errNoFFI }
func (o *OptimizerHandle) UpdateReward(string, float64) error  { return errNoFFI }
func (o *OptimizerHandle) UpdateMetrics(string, RewardMetrics) error { return errNoFFI }
func (o *OptimizerHandle) ExportState() (string, error)        { return "", errNoFFI }
func (o *OptimizerHandle) GetStats() ([]ArmStats, error)       { return nil, errNoFFI }
func (o *OptimizerHandle) Close() error                        { return nil }

func DefaultConfig() OptimizerConfig {
	return OptimizerConfig{
		Arms:             []string{"openai/gpt-4", "anthropic/claude-3-5-sonnet"},
		SuccessThreshold: 0.6,
		InitialAlpha:     1.0,
		InitialBeta:      1.0,
	}
}
