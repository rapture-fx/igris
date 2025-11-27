package escapevector

import (
	"sync"
	"sync/atomic"
	"time"
)

const (
	// TimeoutThreshold is the latency threshold to consider a request as timeout
	TimeoutThreshold = 500 * time.Millisecond

	// ConsecutiveTimeouts required before triggering EscapeVector Mode
	ConsecutiveTimeouts = 3
)

// ControlPlaneDetector monitors control plane health and triggers fallback
type ControlPlaneDetector struct {
	consecutiveTimeouts atomic.Int32
	isInEscapeMode      atomic.Bool
	lastSuccessTime     time.Time
	mu                  sync.RWMutex
}

// NewControlPlaneDetector creates a new detector
func NewControlPlaneDetector() *ControlPlaneDetector {
	return &ControlPlaneDetector{
		lastSuccessTime: time.Now(),
	}
}

// RecordSuccess records a successful control plane request
func (cpd *ControlPlaneDetector) RecordSuccess(latency time.Duration) {
	// Reset timeout counter if latency is acceptable
	if latency < TimeoutThreshold {
		cpd.consecutiveTimeouts.Store(0)
		cpd.isInEscapeMode.Store(false)

		cpd.mu.Lock()
		cpd.lastSuccessTime = time.Now()
		cpd.mu.Unlock()
	}
}

// RecordFailure records a failed or slow control plane request
func (cpd *ControlPlaneDetector) RecordFailure(latency time.Duration) bool {
	// Only count as timeout if latency exceeds threshold or request failed
	if latency >= TimeoutThreshold {
		timeouts := cpd.consecutiveTimeouts.Add(1)

		// Trigger EscapeVector Mode after N consecutive timeouts
		if timeouts >= ConsecutiveTimeouts {
			cpd.isInEscapeMode.Store(true)
			return true
		}
	}
	return false
}

// IsInEscapeMode returns true if EscapeVector Mode is active
func (cpd *ControlPlaneDetector) IsInEscapeMode() bool {
	return cpd.isInEscapeMode.Load()
}

// GetConsecutiveTimeouts returns current timeout count
func (cpd *ControlPlaneDetector) GetConsecutiveTimeouts() int {
	return int(cpd.consecutiveTimeouts.Load())
}

// GetLastSuccessTime returns the last successful request time
func (cpd *ControlPlaneDetector) GetLastSuccessTime() time.Time {
	cpd.mu.RLock()
	defer cpd.mu.RUnlock()
	return cpd.lastSuccessTime
}

// Reset forcibly resets the detector (for testing)
func (cpd *ControlPlaneDetector) Reset() {
	cpd.consecutiveTimeouts.Store(0)
	cpd.isInEscapeMode.Store(false)
	cpd.mu.Lock()
	cpd.lastSuccessTime = time.Now()
	cpd.mu.Unlock()
}
