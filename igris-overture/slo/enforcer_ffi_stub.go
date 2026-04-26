//go:build !cgo || !igris_native

// Stub for builds without native Rust linkage.
// The Rust SLO enforcer is unavailable; EvaluateAndAct returns a no-breach response.
package slo

import "fmt"

// MetricsInput represents Prometheus metrics to be evaluated
type MetricsInput struct {
	P99LatencyMs  *float64 `json:"p99_latency_ms,omitempty"`
	P95LatencyMs  *float64 `json:"p95_latency_ms,omitempty"`
	ErrorRate     *float64 `json:"error_rate,omitempty"`
	Availability  *float64 `json:"availability,omitempty"`
	ThroughputRPS *float64 `json:"throughput_rps,omitempty"`
}

// RemediationAction represents an action to take
type RemediationAction struct {
	ActionType     string  `json:"action_type"`
	Target         string  `json:"target"`
	Reason         string  `json:"reason"`
	SLOType        string  `json:"slo_type"`
	CurrentValue   float64 `json:"current_value"`
	ThresholdValue float64 `json:"threshold_value"`
}

// EvaluationResponse is the response from the FFI library
type EvaluationResponse struct {
	Breached  bool                `json:"breached"`
	Actions   []RemediationAction `json:"actions"`
	Timestamp uint64              `json:"timestamp"`
}

var errSLOFFIUnavailable = fmt.Errorf("rust SLO enforcer unavailable (built without igris_native)")

// EvaluateAndAct returns an explicit unavailable error when Rust FFI is unavailable.
func EvaluateAndAct(_ MetricsInput) (*EvaluationResponse, error) {
	return nil, errSLOFFIUnavailable
}

// GetVersion returns a stub version string.
func GetVersion() string {
	return "stub (no-cgo build)"
}

// NativeAvailable reports whether the Rust SLO enforcer is linked in this build.
func NativeAvailable() bool {
	return false
}

// Mode reports the active SLO enforcer linkage mode.
func Mode() string {
	return "stub"
}
