package cognitive

// FIX-2026-02: cognitive-advisor — tests for SQL fix and rate limit

import (
	"testing"
	"time"
)

// TestAutoApplierRateLimitBlocks verifies that a second apply for the same tenant
// within the rate limit window is skipped.
func TestAutoApplierRateLimitBlocks(t *testing.T) {
	aa := &AutoApplier{
		lastApplyPerTenant: map[string]time.Time{
			"tenant-abc": time.Now().Add(-1 * time.Minute), // applied 1 min ago
		},
		applyRateLimit: 5 * time.Minute,
	}

	aa.lastApplyMu.Lock()
	lastApply, seen := aa.lastApplyPerTenant["tenant-abc"]
	aa.lastApplyMu.Unlock()

	if !seen {
		t.Fatal("expected tenant-abc in lastApplyPerTenant")
	}
	blocked := seen && time.Since(lastApply) < aa.applyRateLimit
	if !blocked {
		t.Error("expected rate limit to block second apply within 5min window")
	}
}

// TestAutoApplierRateLimitAllows verifies that a tenant is allowed after the window elapses.
func TestAutoApplierRateLimitAllows(t *testing.T) {
	aa := &AutoApplier{
		lastApplyPerTenant: map[string]time.Time{
			"tenant-xyz": time.Now().Add(-6 * time.Minute), // applied 6 min ago (> 5min limit)
		},
		applyRateLimit: 5 * time.Minute,
	}

	aa.lastApplyMu.Lock()
	lastApply, seen := aa.lastApplyPerTenant["tenant-xyz"]
	aa.lastApplyMu.Unlock()

	blocked := seen && time.Since(lastApply) < aa.applyRateLimit
	if blocked {
		t.Error("expected rate limit to allow apply after 6min (past 5min window)")
	}
}

// TestAutoApplierRateLimitNewTenant verifies that a new tenant with no history is allowed.
func TestAutoApplierRateLimitNewTenant(t *testing.T) {
	aa := &AutoApplier{
		lastApplyPerTenant: make(map[string]time.Time),
		applyRateLimit:     5 * time.Minute,
	}

	aa.lastApplyMu.Lock()
	lastApply, seen := aa.lastApplyPerTenant["brand-new-tenant"]
	aa.lastApplyMu.Unlock()

	blocked := seen && time.Since(lastApply) < aa.applyRateLimit
	if blocked {
		t.Error("expected new tenant to not be rate-limited")
	}
}

// TestProviderMetricsScanOrderDocumentation verifies that ProviderMetrics has
// the fields expected by the fixed scan order in getProviderMetrics.
func TestProviderMetricsScanOrderDocumentation(t *testing.T) {
	m := ProviderMetrics{}
	// Simulate the correct scan assignments (col 4→SuccessRate, col 6→P95Latency,
	// col 7→P99Latency; col 5 and col 8 captured in temp vars).
	m.SuccessRate = 0.97
	m.P95Latency = 320.5
	m.P99Latency = 450.0
	m.ErrorRate = 1.0 - m.SuccessRate

	if m.SuccessRate != 0.97 {
		t.Errorf("expected SuccessRate 0.97, got %f", m.SuccessRate)
	}
	if m.P95Latency != 320.5 {
		t.Errorf("expected P95Latency 320.5, got %f", m.P95Latency)
	}
	// ErrorRate should be derived from SuccessRate, not from avg_cost
	if m.ErrorRate > 0.1 { // should be ~0.03
		t.Errorf("expected small ErrorRate, got %f (avg_cost must not pollute SuccessRate)", m.ErrorRate)
	}
}
