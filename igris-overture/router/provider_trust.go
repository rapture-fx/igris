package router

import (
	"fmt"
	"math"
	"sync"
	"time"
)

// ProviderTrustTracker tracks observed provider behavior and calculates trust scores
//
// SECURITY: This implements fail-closed trust verification. Providers with insufficient
// trust confidence are penalized or blocked from routing decisions.
type ProviderTrustTracker struct {
	providers map[string]*ProviderTrust
	config    TrustConfig
	mu        sync.RWMutex
}

// ProviderTrust represents trust state for a single provider
type ProviderTrust struct {
	ProviderID string

	// Observed metrics (ground truth from actual requests)
	ObservedLatencyMs  float64 // Exponential moving average
	ObservedErrorRate  float64 // Errors / Total requests
	ObservedCostUSD    float64 // Actual cost per 1K tokens

	// Reported metrics (from provider claims/marketing)
	ReportedLatencyMs float64
	ReportedErrorRate float64
	ReportedCostUSD   float64

	// Trust scoring
	TrustScore       float64   // 0.0 (untrusted) to 1.0 (fully trusted)
	ConfidenceLevel  float64   // 0.0 (no data) to 1.0 (high confidence)
	LastDecayTime    time.Time // For time-based trust decay
	SampleCount      int64     // Number of observations
	ConsecutiveFails int       // Consecutive trust violations

	// Divergence tracking
	LatencyDivergence float64 // (Observed - Reported) / Reported
	ErrorRateDiverge  float64 // (Observed - Reported) / (Reported + epsilon)
	CostDivergence    float64 // (Observed - Reported) / Reported

	mu sync.RWMutex
}

// TrustConfig defines trust scoring parameters
type TrustConfig struct {
	// Minimum samples before trust score stabilizes
	MinSamplesForTrust int64 // Default: 100

	// Divergence thresholds (exceeding these decays trust)
	MaxLatencyDivergence  float64 // Default: 0.50 (50% worse than reported)
	MaxErrorRateDiverge   float64 // Default: 0.20 (20% higher error rate)
	MaxCostDivergence     float64 // Default: 0.30 (30% more expensive)

	// Trust decay parameters
	TrustDecayRate        float64       // Default: 0.10 (10% decay per violation)
	MinTrustScore         float64       // Default: 0.30 (block below this)
	TrustRecoveryRate     float64       // Default: 0.05 (5% recovery per success)
	TrustDecayInterval    time.Duration // Default: 24h (time-based decay)
	TimeBasedDecayRate    float64       // Default: 0.01 (1% decay per interval)

	// Confidence parameters
	ConfidenceGrowthRate  float64 // Default: 0.01 (1% per sample, max 100%)
	MaxConfidence         float64 // Default: 1.0

	// Fail-closed behavior
	BlockBelowTrustScore  float64 // Default: 0.30 (block routing)
	WarnBelowTrustScore   float64 // Default: 0.50 (warn but allow)
	BlockWithoutMinSamples bool   // Default: true (block cold providers)
}

// DefaultTrustConfig returns safe default trust parameters
func DefaultTrustConfig() TrustConfig {
	return TrustConfig{
		MinSamplesForTrust:     100,
		MaxLatencyDivergence:   0.50, // 50% worse than reported
		MaxErrorRateDiverge:    0.20, // 20% higher error rate
		MaxCostDivergence:      0.30, // 30% more expensive
		TrustDecayRate:         0.10, // 10% decay per violation
		MinTrustScore:          0.30, // Block below 30%
		TrustRecoveryRate:      0.05, // 5% recovery per success
		TrustDecayInterval:     24 * time.Hour,
		TimeBasedDecayRate:     0.01, // 1% per day without activity
		ConfidenceGrowthRate:   0.01, // 1% per sample
		MaxConfidence:          1.0,
		BlockBelowTrustScore:   0.30,
		WarnBelowTrustScore:    0.50,
		BlockWithoutMinSamples: true,
	}
}

// NewProviderTrustTracker creates a new trust tracker
func NewProviderTrustTracker(config TrustConfig) *ProviderTrustTracker {
	return &ProviderTrustTracker{
		providers: make(map[string]*ProviderTrust),
		config:    config,
	}
}

// RecordObservation records an actual request outcome
func (ptt *ProviderTrustTracker) RecordObservation(providerID string, latencyMs float64, failed bool, costUSD float64) {
	ptt.mu.Lock()
	pt, exists := ptt.providers[providerID]
	if !exists {
		pt = &ProviderTrust{
			ProviderID:      providerID,
			TrustScore:      1.0, // Start with full trust (innocent until proven guilty)
			ConfidenceLevel: 0.0, // But no confidence yet
			LastDecayTime:   time.Now(),
			SampleCount:     0,
		}
		ptt.providers[providerID] = pt
	}
	ptt.mu.Unlock()

	pt.mu.Lock()
	defer pt.mu.Unlock()

	// Update sample count
	pt.SampleCount++

	// Update observed error rate
	if failed {
		pt.ObservedErrorRate = ((pt.ObservedErrorRate * float64(pt.SampleCount-1)) + 1.0) / float64(pt.SampleCount)
		pt.ConsecutiveFails++
	} else {
		pt.ObservedErrorRate = (pt.ObservedErrorRate * float64(pt.SampleCount-1)) / float64(pt.SampleCount)
		pt.ConsecutiveFails = 0 // Reset on success
	}

	// Update observed latency (exponential moving average)
	alpha := 0.1 // Smoothing factor
	if pt.ObservedLatencyMs == 0 {
		pt.ObservedLatencyMs = latencyMs
	} else {
		pt.ObservedLatencyMs = alpha*latencyMs + (1-alpha)*pt.ObservedLatencyMs
	}

	// Update observed cost (exponential moving average)
	if costUSD > 0 {
		if pt.ObservedCostUSD == 0 {
			pt.ObservedCostUSD = costUSD
		} else {
			pt.ObservedCostUSD = alpha*costUSD + (1-alpha)*pt.ObservedCostUSD
		}
	}

	// Update confidence level (grows with samples, caps at MaxConfidence)
	confidenceGrowth := ptt.config.ConfidenceGrowthRate
	pt.ConfidenceLevel = math.Min(pt.ConfidenceLevel+confidenceGrowth, ptt.config.MaxConfidence)

	// Calculate divergence if reported metrics exist
	if pt.ReportedLatencyMs > 0 {
		pt.LatencyDivergence = (pt.ObservedLatencyMs - pt.ReportedLatencyMs) / pt.ReportedLatencyMs
	}
	if pt.ReportedErrorRate >= 0 {
		epsilon := 0.001 // Avoid division by zero
		pt.ErrorRateDiverge = (pt.ObservedErrorRate - pt.ReportedErrorRate) / (pt.ReportedErrorRate + epsilon)
	}
	if pt.ReportedCostUSD > 0 {
		pt.CostDivergence = (pt.ObservedCostUSD - pt.ReportedCostUSD) / pt.ReportedCostUSD
	}

	// Apply trust updates
	ptt.updateTrustScore(pt, failed)
}

// updateTrustScore updates trust score based on divergence and failures
func (ptt *ProviderTrustTracker) updateTrustScore(pt *ProviderTrust, failed bool) {
	// Trust decay for divergence violations
	violated := false

	if pt.LatencyDivergence > ptt.config.MaxLatencyDivergence {
		violated = true
	}
	if pt.ErrorRateDiverge > ptt.config.MaxErrorRateDiverge {
		violated = true
	}
	if pt.CostDivergence > ptt.config.MaxCostDivergence {
		violated = true
	}

	if violated {
		// Decay trust
		pt.TrustScore = math.Max(0.0, pt.TrustScore-ptt.config.TrustDecayRate)
	} else if !failed {
		// Recover trust on successful, compliant requests
		pt.TrustScore = math.Min(1.0, pt.TrustScore+ptt.config.TrustRecoveryRate)
	}

	// Time-based decay (trust erodes without recent activity)
	timeSinceDecay := time.Since(pt.LastDecayTime)
	if timeSinceDecay > ptt.config.TrustDecayInterval {
		intervals := int(timeSinceDecay / ptt.config.TrustDecayInterval)
		decay := math.Pow(1.0-ptt.config.TimeBasedDecayRate, float64(intervals))
		pt.TrustScore *= decay
		pt.LastDecayTime = time.Now()
	}

	// Ensure trust stays in [0, 1]
	pt.TrustScore = math.Max(0.0, math.Min(1.0, pt.TrustScore))
}

// SetReportedMetrics sets provider's claimed/advertised metrics
func (ptt *ProviderTrustTracker) SetReportedMetrics(providerID string, latencyMs, errorRate, costUSD float64) {
	ptt.mu.Lock()
	pt, exists := ptt.providers[providerID]
	if !exists {
		pt = &ProviderTrust{
			ProviderID:      providerID,
			TrustScore:      1.0,
			ConfidenceLevel: 0.0,
			LastDecayTime:   time.Now(),
		}
		ptt.providers[providerID] = pt
	}
	ptt.mu.Unlock()

	pt.mu.Lock()
	defer pt.mu.Unlock()

	pt.ReportedLatencyMs = latencyMs
	pt.ReportedErrorRate = errorRate
	pt.ReportedCostUSD = costUSD
}

// GetTrustScore returns the current trust score for a provider
func (ptt *ProviderTrustTracker) GetTrustScore(providerID string) (float64, float64, bool) {
	ptt.mu.RLock()
	pt, exists := ptt.providers[providerID]
	ptt.mu.RUnlock()

	if !exists {
		return 0.0, 0.0, false
	}

	pt.mu.RLock()
	defer pt.mu.RUnlock()

	return pt.TrustScore, pt.ConfidenceLevel, true
}

// IsProviderTrusted checks if a provider should be allowed for routing
//
// SECURITY: This implements fail-closed behavior. Returns false if:
// - Trust score is below threshold
// - Insufficient samples (cold start)
// - Provider not registered
func (ptt *ProviderTrustTracker) IsProviderTrusted(providerID string) (bool, string) {
	ptt.mu.RLock()
	pt, exists := ptt.providers[providerID]
	ptt.mu.RUnlock()

	// FAIL-CLOSED: Unknown provider = deny
	if !exists {
		return false, fmt.Sprintf("Provider %s not registered in trust tracker", providerID)
	}

	pt.mu.RLock()
	defer pt.mu.RUnlock()

	// FAIL-CLOSED: Block providers without minimum samples
	if ptt.config.BlockWithoutMinSamples && pt.SampleCount < ptt.config.MinSamplesForTrust {
		return false, fmt.Sprintf("Provider %s has insufficient samples (%d < %d) - cold start protection",
			providerID, pt.SampleCount, ptt.config.MinSamplesForTrust)
	}

	// FAIL-CLOSED: Block providers below trust threshold
	if pt.TrustScore < ptt.config.BlockBelowTrustScore {
		return false, fmt.Sprintf("Provider %s trust score %.3f below threshold %.3f (observed divergence: latency=%.1f%%, error=%.1f%%, cost=%.1f%%)",
			providerID, pt.TrustScore, ptt.config.BlockBelowTrustScore,
			pt.LatencyDivergence*100, pt.ErrorRateDiverge*100, pt.CostDivergence*100)
	}

	// Warn for low but acceptable trust
	if pt.TrustScore < ptt.config.WarnBelowTrustScore {
		return true, fmt.Sprintf("Provider %s trust score %.3f below warning threshold %.3f",
			providerID, pt.TrustScore, ptt.config.WarnBelowTrustScore)
	}

	return true, ""
}

// GetProviderTrustDetails returns detailed trust information for observability
func (ptt *ProviderTrustTracker) GetProviderTrustDetails(providerID string) (*ProviderTrust, error) {
	ptt.mu.RLock()
	pt, exists := ptt.providers[providerID]
	ptt.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("provider %s not found in trust tracker", providerID)
	}

	pt.mu.RLock()
	defer pt.mu.RUnlock()

	// Return a copy to avoid race conditions
	return &ProviderTrust{
		ProviderID:         pt.ProviderID,
		ObservedLatencyMs:  pt.ObservedLatencyMs,
		ObservedErrorRate:  pt.ObservedErrorRate,
		ObservedCostUSD:    pt.ObservedCostUSD,
		ReportedLatencyMs:  pt.ReportedLatencyMs,
		ReportedErrorRate:  pt.ReportedErrorRate,
		ReportedCostUSD:    pt.ReportedCostUSD,
		TrustScore:         pt.TrustScore,
		ConfidenceLevel:    pt.ConfidenceLevel,
		LastDecayTime:      pt.LastDecayTime,
		SampleCount:        pt.SampleCount,
		ConsecutiveFails:   pt.ConsecutiveFails,
		LatencyDivergence:  pt.LatencyDivergence,
		ErrorRateDiverge:   pt.ErrorRateDiverge,
		CostDivergence:     pt.CostDivergence,
	}, nil
}

// FilterTrustedProviders filters a list of providers to only trusted ones
//
// SECURITY: This is the primary enforcement point for trust-based routing.
// Untrusted providers are excluded from routing decisions.
func (ptt *ProviderTrustTracker) FilterTrustedProviders(providerIDs []string) ([]string, []string) {
	trusted := make([]string, 0, len(providerIDs))
	blocked := make([]string, 0)

	for _, providerID := range providerIDs {
		if isTrusted, reason := ptt.IsProviderTrusted(providerID); isTrusted {
			trusted = append(trusted, providerID)
		} else {
			blocked = append(blocked, fmt.Sprintf("%s (%s)", providerID, reason))
		}
	}

	return trusted, blocked
}

// ResetProviderTrust resets trust for a provider (e.g., after manual verification)
func (ptt *ProviderTrustTracker) ResetProviderTrust(providerID string) {
	ptt.mu.Lock()
	pt, exists := ptt.providers[providerID]
	ptt.mu.Unlock()

	if !exists {
		return
	}

	pt.mu.Lock()
	defer pt.mu.Unlock()

	pt.TrustScore = 1.0
	pt.ConsecutiveFails = 0
	pt.LastDecayTime = time.Now()
	// Keep observed metrics and confidence level
}
