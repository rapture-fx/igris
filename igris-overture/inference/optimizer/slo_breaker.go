// Package optimizer provides SLO guardrails for Rust optimizer activation.
package optimizer

import (
	"log"
	"sync"
	"time"

	"github.com/Igris-inertial/system/igris-overture/config"
	"github.com/Igris-inertial/system/igris-overture/inference/optimizer/shadow"
)

// SLOThresholds defines the thresholds for SLO guardrails
type SLOThresholds struct {
	P95LatencyDeltaThreshold float64 // Maximum acceptable p95 latency increase (e.g., 0.10 = 10%)
	CostDeltaThreshold       float64 // Maximum acceptable cost increase (e.g., 0.05 = 5%)
	ErrorRateDeltaThreshold  float64 // Maximum acceptable error rate increase (e.g., 0.005 = 0.5%)
	WindowDuration           time.Duration // Time window for calculating metrics
	MinSampleSize            int     // Minimum samples required before checking SLOs
}

// DefaultSLOThresholds returns default SLO thresholds
func DefaultSLOThresholds() SLOThresholds {
	return SLOThresholds{
		P95LatencyDeltaThreshold: 0.10,  // 10% latency increase
		CostDeltaThreshold:       0.05,  // 5% cost increase
		ErrorRateDeltaThreshold:  0.005, // 0.5% error rate increase
		WindowDuration:           5 * time.Minute,
		MinSampleSize:            100, // Need at least 100 samples
	}
}

// SLOBreaker monitors performance metrics and auto-reverts to Go mode on breach
type SLOBreaker struct {
	mu               sync.RWMutex
	thresholds       SLOThresholds
	runtimeConfig    *config.RuntimeOptimizerConfig
	shadowRunner     *shadow.ShadowRunner
	metricsRecorder  *ActivationMetricsRecorder

	// Sliding window metrics
	goLatencies      []float64
	rustLatencies    []float64
	goCosts          []float64
	rustCosts        []float64
	goErrors         int
	rustErrors       int
	goRequests       int
	rustRequests     int
	windowStart      time.Time

	// Breach tracking
	breachCount      int
	lastBreachTime   time.Time
	enabled          bool
}

// NewSLOBreaker creates a new SLO breaker
func NewSLOBreaker(
	thresholds SLOThresholds,
	runner *shadow.ShadowRunner,
) *SLOBreaker {
	return &SLOBreaker{
		thresholds:      thresholds,
		runtimeConfig:   config.GetRuntimeConfig(),
		shadowRunner:    runner,
		metricsRecorder: NewActivationMetricsRecorder(),
		goLatencies:     make([]float64, 0, 1000),
		rustLatencies:   make([]float64, 0, 1000),
		goCosts:         make([]float64, 0, 1000),
		rustCosts:       make([]float64, 0, 1000),
		windowStart:     time.Now(),
		enabled:         true,
	}
}

// RecordGoMetrics records metrics for a Go router decision
func (b *SLOBreaker) RecordGoMetrics(latencyMs float64, costUsd float64, hadError bool) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.resetWindowIfNeeded()

	b.goLatencies = append(b.goLatencies, latencyMs)
	b.goCosts = append(b.goCosts, costUsd)
	b.goRequests++

	if hadError {
		b.goErrors++
	}
}

// RecordRustMetrics records metrics for a Rust optimizer decision
func (b *SLOBreaker) RecordRustMetrics(latencyMs float64, costUsd float64, hadError bool) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.resetWindowIfNeeded()

	b.rustLatencies = append(b.rustLatencies, latencyMs)
	b.rustCosts = append(b.rustCosts, costUsd)
	b.rustRequests++

	if hadError {
		b.rustErrors++
	}
}

// CheckAndEnforce checks SLOs and auto-reverts to Go mode if breached
func (b *SLOBreaker) CheckAndEnforce() bool {
	b.mu.Lock()
	defer b.mu.Unlock()

	if !b.enabled {
		return false
	}

	// Only check if we're in Rust mode
	currentMode := b.runtimeConfig.GetMode()
	if currentMode != shadow.ShadowModeRust {
		return false
	}

	// Need minimum samples
	if b.rustRequests < b.thresholds.MinSampleSize || b.goRequests < b.thresholds.MinSampleSize {
		return false
	}

	breached := false
	breachType := ""

	// Check P95 latency delta
	goP95 := calculateP95(b.goLatencies)
	rustP95 := calculateP95(b.rustLatencies)
	if goP95 > 0 {
		latencyDelta := (rustP95 - goP95) / goP95
		if latencyDelta > b.thresholds.P95LatencyDeltaThreshold {
			breached = true
			breachType = "p95_latency"
			log.Printf("[SLO Breaker] P95 latency breach: Go=%.2fms, Rust=%.2fms, Delta=%.2f%%",
				goP95, rustP95, latencyDelta*100)
		}
	}

	// Check cost delta
	goAvgCost := calculateMean(b.goCosts)
	rustAvgCost := calculateMean(b.rustCosts)
	if goAvgCost > 0 {
		costDelta := (rustAvgCost - goAvgCost) / goAvgCost
		if costDelta > b.thresholds.CostDeltaThreshold {
			breached = true
			breachType = "cost_delta"
			log.Printf("[SLO Breaker] Cost breach: Go=$%.6f, Rust=$%.6f, Delta=%.2f%%",
				goAvgCost, rustAvgCost, costDelta*100)
		}
	}

	// Check error rate delta
	goErrorRate := float64(b.goErrors) / float64(b.goRequests)
	rustErrorRate := float64(b.rustErrors) / float64(b.rustRequests)
	errorRateDelta := rustErrorRate - goErrorRate
	if errorRateDelta > b.thresholds.ErrorRateDeltaThreshold {
		breached = true
		breachType = "error_rate"
		log.Printf("[SLO Breaker] Error rate breach: Go=%.4f, Rust=%.4f, Delta=%.4f",
			goErrorRate, rustErrorRate, errorRateDelta)
	}

	if breached {
		b.handleBreach(breachType)
		return true
	}

	return false
}

// handleBreach handles an SLO breach by reverting to Go mode
func (b *SLOBreaker) handleBreach(breachType string) {
	b.breachCount++
	b.lastBreachTime = time.Now()

	// Record breach metric
	b.metricsRecorder.RecordSLOBreak(breachType)

	// Revert to Go mode
	log.Printf("[SLO Breaker] SLO BREACH DETECTED (%s) - Reverting to Go mode (breach #%d)",
		breachType, b.breachCount)

	b.runtimeConfig.SetMode(shadow.ShadowModeGo)
	b.runtimeConfig.SetSampleRate(0.0)

	if b.shadowRunner != nil {
		b.shadowRunner.SetMode(shadow.ShadowModeGo)
		b.shadowRunner.SetSampleRate(0.0)
	}

	b.metricsRecorder.UpdateCurrentMode("go")
	b.metricsRecorder.UpdateSampleRate(0.0)

	// Reset window to start fresh comparison
	b.resetWindow()
}

// resetWindowIfNeeded resets the sliding window if duration exceeded
func (b *SLOBreaker) resetWindowIfNeeded() {
	if time.Since(b.windowStart) > b.thresholds.WindowDuration {
		b.resetWindow()
	}
}

// resetWindow resets the sliding window metrics
func (b *SLOBreaker) resetWindow() {
	b.goLatencies = b.goLatencies[:0]
	b.rustLatencies = b.rustLatencies[:0]
	b.goCosts = b.goCosts[:0]
	b.rustCosts = b.rustCosts[:0]
	b.goErrors = 0
	b.rustErrors = 0
	b.goRequests = 0
	b.rustRequests = 0
	b.windowStart = time.Now()
}

// GetBreachStats returns breach statistics
func (b *SLOBreaker) GetBreachStats() (breachCount int, lastBreachTime time.Time) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.breachCount, b.lastBreachTime
}

// Enable enables the SLO breaker
func (b *SLOBreaker) Enable() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.enabled = true
	log.Println("[SLO Breaker] Enabled")
}

// Disable disables the SLO breaker
func (b *SLOBreaker) Disable() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.enabled = false
	log.Println("[SLO Breaker] Disabled")
}

// IsEnabled returns whether the SLO breaker is enabled
func (b *SLOBreaker) IsEnabled() bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.enabled
}

// Helper functions

// calculateP95 calculates the 95th percentile of a slice of values
func calculateP95(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}

	// Simple implementation: sort and find 95th percentile
	sorted := make([]float64, len(values))
	copy(sorted, values)

	// Bubble sort (good enough for small samples)
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[i] > sorted[j] {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	p95Index := int(float64(len(sorted)) * 0.95)
	if p95Index >= len(sorted) {
		p95Index = len(sorted) - 1
	}

	return sorted[p95Index]
}

// calculateMean calculates the mean of a slice of values
func calculateMean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}

	sum := 0.0
	for _, v := range values {
		sum += v
	}

	return sum / float64(len(values))
}
