package tests

import (
	"testing"
	"time"

	"github.com/schlep-engine/schlep-engine/internal/config"
	"github.com/schlep-engine/schlep-engine/internal/inference/optimizer"
	"github.com/schlep-engine/schlep-engine/internal/inference/optimizer/shadow"
)

// TestRuntimeConfigHotReload tests runtime configuration hot-reload
func TestRuntimeConfigHotReload(t *testing.T) {
	// Initialize with default config
	optConfig := config.OptimizerConfig{
		Mode:       shadow.ShadowModeShadow,
		SampleRate: 0.1,
		LogDir:     "logs/test",
		AdminToken: "test-token",
	}

	config.InitRuntimeConfig(optConfig)
	runtimeConfig := config.GetRuntimeConfig()

	// Verify initial values
	if runtimeConfig.GetMode() != shadow.ShadowModeShadow {
		t.Errorf("Expected mode shadow, got %s", runtimeConfig.GetMode())
	}

	if runtimeConfig.GetSampleRate() != 0.1 {
		t.Errorf("Expected sample rate 0.1, got %.2f", runtimeConfig.GetSampleRate())
	}

	// Test hot-reload mode change
	runtimeConfig.SetMode(shadow.ShadowModeRust)
	if runtimeConfig.GetMode() != shadow.ShadowModeRust {
		t.Errorf("Expected mode rust after hot-reload, got %s", runtimeConfig.GetMode())
	}

	// Test hot-reload sample rate change
	runtimeConfig.SetSampleRate(0.5)
	if runtimeConfig.GetSampleRate() != 0.5 {
		t.Errorf("Expected sample rate 0.5 after hot-reload, got %.2f", runtimeConfig.GetSampleRate())
	}

	// Test sample rate clamping
	runtimeConfig.SetSampleRate(1.5)
	if runtimeConfig.GetSampleRate() != 1.0 {
		t.Errorf("Expected sample rate clamped to 1.0, got %.2f", runtimeConfig.GetSampleRate())
	}

	runtimeConfig.SetSampleRate(-0.5)
	if runtimeConfig.GetSampleRate() != 0.0 {
		t.Errorf("Expected sample rate clamped to 0.0, got %.2f", runtimeConfig.GetSampleRate())
	}
}

// TestActivationMetrics tests activation metrics recording
func TestActivationMetrics(t *testing.T) {
	recorder := optimizer.NewActivationMetricsRecorder()

	// Test mode update
	recorder.UpdateCurrentMode("rust")
	recorder.UpdateSampleRate(0.25)

	// Test decision recording
	recorder.RecordRustDecision()
	recorder.RecordGoFallback("error")

	// Test SLO break recording
	recorder.RecordSLOBreak("p95_latency")

	// Test request recording
	recorder.RecordRequest("rust", "rust_optimizer")
	recorder.RecordLatency("rust_optimizer", 150.0)
	recorder.RecordCost("rust_optimizer", 0.003)

	t.Log("Activation metrics recorded successfully")
}

// TestSLOBreakerBasic tests basic SLO breaker functionality
func TestSLOBreakerBasic(t *testing.T) {
	thresholds := optimizer.SLOThresholds{
		P95LatencyDeltaThreshold: 0.10,
		CostDeltaThreshold:       0.05,
		ErrorRateDeltaThreshold:  0.005,
		WindowDuration:           1 * time.Minute,
		MinSampleSize:            10,
	}

	breaker := optimizer.NewSLOBreaker(thresholds, nil)

	// Record Go metrics
	for i := 0; i < 15; i++ {
		breaker.RecordGoMetrics(100.0, 0.001, false)
	}

	// Record Rust metrics (within SLO)
	for i := 0; i < 15; i++ {
		breaker.RecordRustMetrics(105.0, 0.0011, false)
	}

	// Should not breach with minimal difference
	breached := breaker.CheckAndEnforce()
	if breached {
		t.Error("Expected no SLO breach with minimal difference")
	}

	breachCount, _ := breaker.GetBreachStats()
	if breachCount != 0 {
		t.Errorf("Expected 0 breaches, got %d", breachCount)
	}
}

// TestSLOBreakerLatencyBreach tests SLO breaker with latency breach
func TestSLOBreakerLatencyBreach(t *testing.T) {
	thresholds := optimizer.SLOThresholds{
		P95LatencyDeltaThreshold: 0.10, // 10% threshold
		CostDeltaThreshold:       0.05,
		ErrorRateDeltaThreshold:  0.005,
		WindowDuration:           1 * time.Minute,
		MinSampleSize:            10,
	}

	// Create mock shadow runner
	shadowConfig := shadow.ShadowConfig{
		Mode:       shadow.ShadowModeShadow,
		SampleRate: 0.0,
		LogDir:     "logs/test",
	}

	runner, err := shadow.NewShadowRunner(shadowConfig)
	if err != nil {
		t.Skipf("Skipping test, shadow runner init failed: %v", err)
		return
	}
	defer runner.Close()

	// Set to Rust mode for breach testing
	runner.SetMode(shadow.ShadowModeRust)

	breaker := optimizer.NewSLOBreaker(thresholds, runner)

	// Initialize runtime config
	config.InitRuntimeConfig(config.OptimizerConfig{
		Mode:       shadow.ShadowModeRust,
		SampleRate: 1.0,
		LogDir:     "logs/test",
	})

	// Record Go metrics (baseline)
	for i := 0; i < 15; i++ {
		breaker.RecordGoMetrics(100.0, 0.001, false)
	}

	// Record Rust metrics with significant latency increase (>10%)
	for i := 0; i < 15; i++ {
		breaker.RecordRustMetrics(120.0, 0.001, false) // 20% latency increase
	}

	// Should breach SLO
	breached := breaker.CheckAndEnforce()
	if !breached {
		t.Error("Expected SLO breach with 20% latency increase")
	}

	// Verify mode was reverted to Go
	currentMode := config.GetRuntimeConfig().GetMode()
	if currentMode != shadow.ShadowModeGo {
		t.Errorf("Expected mode reverted to 'go', got %s", currentMode)
	}

	// Verify sample rate was set to 0
	currentSampleRate := config.GetRuntimeConfig().GetSampleRate()
	if currentSampleRate != 0.0 {
		t.Errorf("Expected sample rate set to 0.0, got %.2f", currentSampleRate)
	}
}

// TestSLOBreakerCostBreach tests SLO breaker with cost breach
func TestSLOBreakerCostBreach(t *testing.T) {
	thresholds := optimizer.SLOThresholds{
		P95LatencyDeltaThreshold: 0.10,
		CostDeltaThreshold:       0.05, // 5% threshold
		ErrorRateDeltaThreshold:  0.005,
		WindowDuration:           1 * time.Minute,
		MinSampleSize:            10,
	}

	breaker := optimizer.NewSLOBreaker(thresholds, nil)

	// Record Go metrics (baseline)
	for i := 0; i < 15; i++ {
		breaker.RecordGoMetrics(100.0, 0.001, false)
	}

	// Record Rust metrics with significant cost increase (>5%)
	for i := 0; i < 15; i++ {
		breaker.RecordRustMetrics(100.0, 0.0012, false) // 20% cost increase
	}

	// Note: Without a shadow runner, CheckAndEnforce won't revert mode
	// but it will still detect the breach
	breached := breaker.CheckAndEnforce()
	if !breached {
		t.Error("Expected SLO breach detection with 20% cost increase")
	}
}

// TestSLOBreakerErrorRateBreach tests SLO breaker with error rate breach
func TestSLOBreakerErrorRateBreach(t *testing.T) {
	thresholds := optimizer.SLOThresholds{
		P95LatencyDeltaThreshold: 0.10,
		CostDeltaThreshold:       0.05,
		ErrorRateDeltaThreshold:  0.01, // 1% threshold
		WindowDuration:           1 * time.Minute,
		MinSampleSize:            10,
	}

	breaker := optimizer.NewSLOBreaker(thresholds, nil)

	// Record Go metrics (baseline - no errors)
	for i := 0; i < 20; i++ {
		breaker.RecordGoMetrics(100.0, 0.001, false)
	}

	// Record Rust metrics with errors (5% error rate)
	for i := 0; i < 20; i++ {
		hasError := i < 1 // 5% error rate (1 out of 20)
		breaker.RecordRustMetrics(100.0, 0.001, hasError)
	}

	// Should breach SLO with >1% error rate increase
	breached := breaker.CheckAndEnforce()
	if !breached {
		t.Error("Expected SLO breach detection with error rate increase")
	}
}

// TestSLOBreakerEnableDisable tests enabling/disabling SLO breaker
func TestSLOBreakerEnableDisable(t *testing.T) {
	breaker := optimizer.NewSLOBreaker(optimizer.DefaultSLOThresholds(), nil)

	// Test initial state (should be enabled)
	if !breaker.IsEnabled() {
		t.Error("Expected SLO breaker to be enabled by default")
	}

	// Test disable
	breaker.Disable()
	if breaker.IsEnabled() {
		t.Error("Expected SLO breaker to be disabled")
	}

	// Test enable
	breaker.Enable()
	if !breaker.IsEnabled() {
		t.Error("Expected SLO breaker to be enabled")
	}
}

// TestSampleRateRollout tests phased rollout with different sample rates
func TestSampleRateRollout(t *testing.T) {
	testCases := []struct {
		sampleRate      float64
		iterations      int
		expectedSampled int
		tolerance       float64
	}{
		{0.01, 10000, 100, 0.3},   // 1% sample rate, expect ~100 samples
		{0.10, 1000, 100, 0.2},    // 10% sample rate, expect ~100 samples
		{0.25, 1000, 250, 0.15},   // 25% sample rate, expect ~250 samples
		{1.00, 1000, 1000, 0.001}, // 100% sample rate, expect all samples
	}

	for _, tc := range testCases {
		t.Run("SampleRate_"+string(rune(tc.sampleRate*100)), func(t *testing.T) {
			shadowConfig := shadow.ShadowConfig{
				Mode:       shadow.ShadowModeShadow,
				SampleRate: tc.sampleRate,
				LogDir:     "logs/test",
			}

			runner, err := shadow.NewShadowRunner(shadowConfig)
			if err != nil {
				t.Skipf("Skipping test, shadow runner init failed: %v", err)
				return
			}
			defer runner.Close()

			sampled := 0
			for i := 0; i < tc.iterations; i++ {
				if runner.ShouldSample() {
					sampled++
				}
			}

			// Check if sampled count is within tolerance
			expectedMin := int(float64(tc.expectedSampled) * (1 - tc.tolerance))
			expectedMax := int(float64(tc.expectedSampled) * (1 + tc.tolerance))

			if sampled < expectedMin || sampled > expectedMax {
				t.Errorf("Sample rate %.2f: expected %d-%d samples, got %d",
					tc.sampleRate, expectedMin, expectedMax, sampled)
			} else {
				t.Logf("Sample rate %.2f: got %d samples (expected ~%d)",
					tc.sampleRate, sampled, tc.expectedSampled)
			}
		})
	}
}
