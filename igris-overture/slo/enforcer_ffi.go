//go:build cgo && igris_native

// Package slo provides Go bindings for the Rust SLO Enforcer FFI library
package slo

/*
#cgo LDFLAGS: -L${SRCDIR}/../../rust-core/production_slo_enforcer/target/release -ligris_slo_enforcer
#include "../../rust-core/production_slo_enforcer/slo_enforcer.h"
#include <stdlib.h>
*/
import "C"
import (
	"encoding/json"
	"fmt"
	"unsafe"
)

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

// EvaluateAndAct calls the Rust FFI library to evaluate metrics
func EvaluateAndAct(metrics MetricsInput) (*EvaluationResponse, error) {
	// Marshal metrics to JSON
	metricsJSON, err := json.Marshal(metrics)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal metrics: %w", err)
	}

	// Convert to C string
	cMetrics := C.CString(string(metricsJSON))
	defer C.free(unsafe.Pointer(cMetrics))

	// Call FFI function
	result := C.evaluate_and_act(cMetrics)

	// Check for errors
	if result.error != nil {
		errorStr := C.GoString(result.error)
		C.free_string(result.error)
		return nil, fmt.Errorf("SLO enforcer error: %s", errorStr)
	}

	// Parse JSON output
	if result.json_output == nil {
		return nil, fmt.Errorf("SLO enforcer returned null output")
	}

	outputStr := C.GoString(result.json_output)
	C.free_string(result.json_output)

	var response EvaluationResponse
	if err := json.Unmarshal([]byte(outputStr), &response); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &response, nil
}

// GetVersion returns the SLO enforcer library version
func GetVersion() string {
	cVersion := C.get_version()
	if cVersion == nil {
		return "unknown"
	}
	defer C.free_string(cVersion)
	return C.GoString(cVersion)
}

// NativeAvailable reports whether the Rust SLO enforcer is linked in this build.
func NativeAvailable() bool {
	return true
}

// Mode reports the active SLO enforcer linkage mode.
func Mode() string {
	return "native"
}
