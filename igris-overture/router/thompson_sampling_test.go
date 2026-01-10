package router

import (
	"testing"
)

func TestThompsonSamplingEngine_ColdStartBootstrap(t *testing.T) {
	config := DefaultThompsonSamplingConfig()
	config.BootstrapSamples = 5
	engine := NewThompsonSamplingEngine(config)

	// Create candidates
	backends := []*Backend{
		{ID: "backend-1", Type: BackendTypeMLPython, Capabilities: []string{"inference"}},
		{ID: "backend-2", Type: BackendTypeMLGPU, Capabilities: []string{"inference"}},
		{ID: "backend-3", Type: BackendTypeMLCPU, Capabilities: []string{"inference"}},
	}

	// First 15 selections should prioritize bootstrap (5 samples per backend)
	bootstrapCounts := make(map[string]int)

	for i := 0; i < 15; i++ {
		backend, reason, _ := engine.SelectBackend(backends)
		if backend == nil {
			t.Fatal("Expected backend selection")
		}

		// Should be bootstrap phase
		if len(reason) < 10 || reason[:30] != "Thompson Sampling: bootstrap (" {
			t.Errorf("Expected bootstrap selection, got: %s", reason)
		}

		bootstrapCounts[backend.ID]++

		// Record outcome
		engine.RecordOutcome(backend.ID, true, true)
	}

	// Each backend should have received bootstrap samples
	for id, count := range bootstrapCounts {
		if count != 5 {
			t.Errorf("Backend %s received %d bootstrap samples, expected 5", id, count)
		}
	}

	// Verify all backends transitioned out of bootstrap
	for _, backend := range backends {
		state, exists := engine.GetState(backend.ID)
		if !exists {
			t.Errorf("Backend %s should have state", backend.ID)
			continue
		}

		if state.Phase == PhaseBootstrap {
			t.Errorf("Backend %s still in bootstrap phase after %d samples", backend.ID, state.SamplesCollected)
		}
	}
}

func TestThompsonSamplingEngine_PessimisticPriors(t *testing.T) {
	config := DefaultThompsonSamplingConfig()
	config.PessimisticPriorAlpha = 1.0
	config.PessimisticPriorBeta = 3.0 // Assume 25% success rate
	engine := NewThompsonSamplingEngine(config)

	// Initialize a new backend
	state := engine.GetOrInitializeState("backend-new")

	// Should start with pessimistic priors
	if state.Alpha != 1.0 {
		t.Errorf("Expected pessimistic prior alpha=1.0, got %.1f", state.Alpha)
	}
	if state.Beta != 3.0 {
		t.Errorf("Expected pessimistic prior beta=3.0, got %.1f", state.Beta)
	}

	// Prior implies 25% success rate
	expectedRate := state.Alpha / (state.Alpha + state.Beta)
	if expectedRate != 0.25 {
		t.Errorf("Expected 25%% prior success rate, got %.2f%%", expectedRate*100)
	}
}

func TestThompsonSamplingEngine_MinSamplesForExploit(t *testing.T) {
	config := DefaultThompsonSamplingConfig()
	config.MinSamplesForExploit = 20
	config.BootstrapSamples = 0 // Disable bootstrap for this test
	engine := NewThompsonSamplingEngine(config)

	backends := []*Backend{
		{ID: "backend-cold", Type: BackendTypeMLPython, Capabilities: []string{"inference"}},
		{ID: "backend-warm", Type: BackendTypeMLGPU, Capabilities: []string{"inference"}},
	}

	// Warm up backend-warm with 30 successful samples
	for i := 0; i < 30; i++ {
		engine.RecordOutcome("backend-warm", true, false)
	}

	// backend-cold has 0 samples, backend-warm has 30 samples
	// Selection should prefer backend-cold for exploration (cold-start protection)
	selectionCounts := make(map[string]int)

	for i := 0; i < 50; i++ {
		backend, _, _ := engine.SelectBackend(backends)
		if backend != nil {
			selectionCounts[backend.ID]++
			// Simulate outcome
			engine.RecordOutcome(backend.ID, true, true)
		}
	}

	// backend-cold should receive more selections initially due to cold-start protection
	if selectionCounts["backend-cold"] == 0 {
		t.Error("Expected backend-cold to receive selections for cold-start protection")
	}
}

func TestThompsonSamplingEngine_ExplorationBudget(t *testing.T) {
	config := DefaultThompsonSamplingConfig()
	config.MaxExplorationBudget = 20
	config.BootstrapSamples = 0
	config.MinSamplesForExploit = 5
	engine := NewThompsonSamplingEngine(config)

	backends := []*Backend{
		{ID: "backend-1", Type: BackendTypeMLPython, Capabilities: []string{"inference"}},
		{ID: "backend-2", Type: BackendTypeMLGPU, Capabilities: []string{"inference"}},
	}

	// Warm up both backends
	for i := 0; i < 10; i++ {
		engine.RecordOutcome("backend-1", true, false)
		engine.RecordOutcome("backend-2", true, false)
	}

	// Exhaust exploration budget
	for i := 0; i < 25; i++ {
		backend, _, _ := engine.SelectBackend(backends)
		if backend != nil {
			engine.RecordOutcome(backend.ID, true, true) // Mark as exploration
		}
	}

	stats := engine.GetGlobalStats()
	if stats.ExplorationBudgetRemaining > 0 {
		t.Errorf("Expected exploration budget exhausted, remaining: %d", stats.ExplorationBudgetRemaining)
	}

	// After budget exhausted, should only do exploitation
	for i := 0; i < 10; i++ {
		backend, reason, _ := engine.SelectBackend(backends)
		if backend != nil {
			// Reason should indicate exploitation (not exploration)
			if len(reason) > 20 && reason[:20] == "Thompson Sampling: e" && reason[20] == 'x' && reason[21] == 'p' && reason[22] == 'l' && reason[23] == 'o' {
				if reason[24] == 'r' {
					t.Errorf("Expected exploitation after budget exhausted, got: %s", reason)
				}
			}
		}
	}
}

func TestThompsonSamplingEngine_ExplorationDecay(t *testing.T) {
	config := DefaultThompsonSamplingConfig()
	config.InitialExplorationRate = 0.50
	config.ExplorationDecayRate = 0.90 // 10% decay per exploration
	config.MinExplorationRate = 0.05
	config.BootstrapSamples = 0
	engine := NewThompsonSamplingEngine(config)

	initialRate := engine.currentExplorationRate
	if initialRate != 0.50 {
		t.Errorf("Expected initial exploration rate 0.50, got %.2f", initialRate)
	}

	// Simulate 20 exploration events
	for i := 0; i < 20; i++ {
		engine.RecordOutcome("backend-test", true, true)
	}

	// Rate should have decayed
	stats := engine.GetGlobalStats()
	if stats.CurrentExplorationRate >= initialRate {
		t.Errorf("Expected exploration rate decay, initial=%.2f current=%.2f", initialRate, stats.CurrentExplorationRate)
	}

	// Should not decay below minimum
	if stats.CurrentExplorationRate < config.MinExplorationRate {
		t.Errorf("Exploration rate decayed below minimum: %.3f < %.3f", stats.CurrentExplorationRate, config.MinExplorationRate)
	}
}

func TestThompsonSamplingEngine_PhaseTransitions(t *testing.T) {
	config := DefaultThompsonSamplingConfig()
	config.BootstrapSamples = 5
	config.ExploreToExploitSamples = 15
	engine := NewThompsonSamplingEngine(config)

	backendID := "backend-phases"

	// Initial state: Bootstrap
	state := engine.GetOrInitializeState(backendID)
	if state.Phase != PhaseBootstrap {
		t.Errorf("Expected initial phase Bootstrap, got %s", state.Phase)
	}

	// Record 5 samples -> should transition to Explore
	for i := 0; i < 5; i++ {
		engine.RecordOutcome(backendID, true, true)
	}

	state, _ = engine.GetState(backendID)
	if state.Phase != PhaseExplore {
		t.Errorf("Expected phase Explore after %d samples, got %s", state.SamplesCollected, state.Phase)
	}

	// Record 10 more samples (total 15) -> should transition to Exploit
	for i := 0; i < 10; i++ {
		engine.RecordOutcome(backendID, true, false)
	}

	state, _ = engine.GetState(backendID)
	if state.Phase != PhaseExploit {
		t.Errorf("Expected phase Exploit after %d samples, got %s", state.SamplesCollected, state.Phase)
	}
}

func TestThompsonSamplingEngine_BetaDistributionUpdates(t *testing.T) {
	config := DefaultThompsonSamplingConfig()
	config.PessimisticPriorAlpha = 1.0
	config.PessimisticPriorBeta = 1.0
	engine := NewThompsonSamplingEngine(config)

	backendID := "backend-beta"
	state := engine.GetOrInitializeState(backendID)

	// Initial priors
	if state.Alpha != 1.0 || state.Beta != 1.0 {
		t.Fatalf("Expected initial priors (1.0, 1.0), got (%.1f, %.1f)", state.Alpha, state.Beta)
	}

	// Record 5 successes
	for i := 0; i < 5; i++ {
		engine.RecordOutcome(backendID, true, false)
	}

	state, _ = engine.GetState(backendID)
	if state.Alpha != 6.0 {
		t.Errorf("Expected alpha=6.0 after 5 successes, got %.1f", state.Alpha)
	}
	if state.Beta != 1.0 {
		t.Errorf("Expected beta=1.0 (no failures), got %.1f", state.Beta)
	}

	// Record 3 failures
	for i := 0; i < 3; i++ {
		engine.RecordOutcome(backendID, false, false)
	}

	state, _ = engine.GetState(backendID)
	if state.Alpha != 6.0 {
		t.Errorf("Expected alpha=6.0 (no new successes), got %.1f", state.Alpha)
	}
	if state.Beta != 4.0 {
		t.Errorf("Expected beta=4.0 after 3 failures, got %.1f", state.Beta)
	}

	// Total: 5 successes, 3 failures -> 62.5% success rate
	successRate := state.Alpha / (state.Alpha + state.Beta)
	expectedRate := 6.0 / 10.0
	if successRate != expectedRate {
		t.Errorf("Expected success rate %.2f%%, got %.2f%%", expectedRate*100, successRate*100)
	}
}

func TestThompsonSamplingEngine_GlobalStats(t *testing.T) {
	config := DefaultThompsonSamplingConfig()
	config.BootstrapSamples = 3
	config.ExploreToExploitSamples = 10
	engine := NewThompsonSamplingEngine(config)

	// Initialize multiple backends in different phases
	// backend-1: Bootstrap (2 samples)
	engine.RecordOutcome("backend-1", true, true)
	engine.RecordOutcome("backend-1", true, true)

	// backend-2: Explore (8 samples)
	for i := 0; i < 8; i++ {
		engine.RecordOutcome("backend-2", true, true)
	}

	// backend-3: Exploit (15 samples)
	for i := 0; i < 15; i++ {
		engine.RecordOutcome("backend-3", true, false)
	}

	stats := engine.GetGlobalStats()

	if stats.TotalBackends != 3 {
		t.Errorf("Expected 3 total backends, got %d", stats.TotalBackends)
	}

	if stats.BootstrapPhaseCount != 1 {
		t.Errorf("Expected 1 backend in bootstrap, got %d", stats.BootstrapPhaseCount)
	}

	if stats.ExplorePhaseCount != 1 {
		t.Errorf("Expected 1 backend in explore, got %d", stats.ExplorePhaseCount)
	}

	if stats.ExploitPhaseCount != 1 {
		t.Errorf("Expected 1 backend in exploit, got %d", stats.ExploitPhaseCount)
	}

	// Global exploration count should be 10 (2 + 8 + 0)
	if stats.GlobalExplorationCount != 10 {
		t.Errorf("Expected 10 global explorations, got %d", stats.GlobalExplorationCount)
	}
}

func TestThompsonSamplingEngine_StateReset(t *testing.T) {
	config := DefaultThompsonSamplingConfig()
	engine := NewThompsonSamplingEngine(config)

	backendID := "backend-reset"

	// Record some samples
	for i := 0; i < 10; i++ {
		engine.RecordOutcome(backendID, true, false)
	}

	// Verify state exists
	state, exists := engine.GetState(backendID)
	if !exists {
		t.Fatal("Backend state should exist before reset")
	}
	if state.SamplesCollected != 10 {
		t.Errorf("Expected 10 samples, got %d", state.SamplesCollected)
	}

	// Reset state
	engine.ResetBackendState(backendID)

	// Verify state no longer exists
	_, exists = engine.GetState(backendID)
	if exists {
		t.Error("Backend state should not exist after reset")
	}
}

func TestThompsonSamplingEngine_SingleCandidate(t *testing.T) {
	config := DefaultThompsonSamplingConfig()
	engine := NewThompsonSamplingEngine(config)

	backends := []*Backend{
		{ID: "backend-only", Type: BackendTypeMLPython, Capabilities: []string{"inference"}},
	}

	backend, reason, confidence := engine.SelectBackend(backends)

	if backend == nil {
		t.Fatal("Expected backend selection with single candidate")
	}

	if backend.ID != "backend-only" {
		t.Errorf("Expected backend-only, got %s", backend.ID)
	}

	if reason != "only one candidate" {
		t.Errorf("Expected 'only one candidate' reason, got: %s", reason)
	}

	if confidence != 1.0 {
		t.Errorf("Expected confidence 1.0 for single candidate, got %.2f", confidence)
	}
}

func TestThompsonSamplingEngine_NoCandidates(t *testing.T) {
	config := DefaultThompsonSamplingConfig()
	engine := NewThompsonSamplingEngine(config)

	backends := []*Backend{}

	backend, reason, confidence := engine.SelectBackend(backends)

	if backend != nil {
		t.Error("Expected nil backend with no candidates")
	}

	if reason != "no candidates available" {
		t.Errorf("Expected 'no candidates available' reason, got: %s", reason)
	}

	if confidence != 0.0 {
		t.Errorf("Expected confidence 0.0 for no candidates, got %.2f", confidence)
	}
}

func TestThompsonSamplingEngine_ForcedExploration(t *testing.T) {
	config := DefaultThompsonSamplingConfig()
	config.MinSamplesForExploit = 50
	config.BootstrapSamples = 0
	engine := NewThompsonSamplingEngine(config)

	backends := []*Backend{
		{ID: "backend-1", Type: BackendTypeMLPython, Capabilities: []string{"inference"}},
		{ID: "backend-2", Type: BackendTypeMLGPU, Capabilities: []string{"inference"}},
	}

	// Record only 10 samples for each backend (below minimum of 50)
	for i := 0; i < 10; i++ {
		engine.RecordOutcome("backend-1", true, false)
		engine.RecordOutcome("backend-2", true, false)
	}

	// All selections should be forced exploration since no backend meets minimum
	for i := 0; i < 20; i++ {
		backend, reason, _ := engine.SelectBackend(backends)
		if backend == nil {
			t.Fatal("Expected backend selection")
		}

		// Should indicate forced exploration
		if len(reason) < 30 || reason[:29] != "Thompson Sampling: forced exp" {
			t.Errorf("Expected forced exploration, got: %s", reason)
		}
	}
}
