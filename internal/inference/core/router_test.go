package core

import (
	"testing"
	"time"
)

func TestNewMultiModelRouter(t *testing.T) {
	router := NewMultiModelRouter()
	if router == nil {
		t.Fatal("Router should not be nil")
	}

	if len(router.models) != 0 {
		t.Error("New router should have no models")
	}
}

func TestRegisterModel(t *testing.T) {
	router := NewMultiModelRouter()

	metadata := ModelMetadata{
		ID:       "model1",
		Name:     "Test Model",
		Version:  "1.0",
		Runtime:  RuntimePyTorch,
		Priority: 1,
	}

	err := router.RegisterModel(metadata)
	if err != nil {
		t.Fatalf("Failed to register model: %v", err)
	}

	// Try registering the same model again
	err = router.RegisterModel(metadata)
	if err == nil {
		t.Error("Should not allow duplicate model registration")
	}

	stats := router.GetModelStats("model1")
	if stats == nil {
		t.Fatal("Should have stats for registered model")
	}

	if stats.ModelID != "model1" {
		t.Errorf("Expected model1, got %s", stats.ModelID)
	}
}

func TestSelectModel(t *testing.T) {
	router := NewMultiModelRouter()

	// Register multiple models
	for i := 1; i <= 3; i++ {
		metadata := ModelMetadata{
			ID:      "model" + string(rune('0'+i)),
			Name:    "Test Model",
			Version: "1.0",
			Runtime: RuntimePyTorch,
		}
		_ = router.RegisterModel(metadata)
	}

	// Test direct selection
	modelID, runtime := router.SelectModel("model1")
	if modelID != "model1" {
		t.Errorf("Expected model1, got %s", modelID)
	}

	if runtime != RuntimePyTorch {
		t.Errorf("Expected PyTorch runtime, got %s", runtime)
	}

	// Test selection without preference (should use Thompson Sampling)
	modelID, _ = router.SelectModel("")
	if modelID == "" {
		t.Error("Should select a model when no preference given")
	}
}

func TestUpdateModelPerformance(t *testing.T) {
	router := NewMultiModelRouter()

	metadata := ModelMetadata{
		ID:      "model1",
		Name:    "Test Model",
		Version: "1.0",
		Runtime: RuntimeONNX,
	}
	_ = router.RegisterModel(metadata)

	// Update with successful inference
	router.UpdateModelPerformance("model1", true, 25*time.Millisecond)

	stats := router.GetModelStats("model1")
	if stats.SuccessCount != 1 {
		t.Errorf("Expected 1 success, got %d", stats.SuccessCount)
	}

	// Update with failure
	router.UpdateModelPerformance("model1", false, 50*time.Millisecond)

	stats = router.GetModelStats("model1")
	if stats.FailureCount != 1 {
		t.Errorf("Expected 1 failure, got %d", stats.FailureCount)
	}

	if stats.SuccessRate < 0 || stats.SuccessRate > 1 {
		t.Errorf("Success rate should be 0-1, got %.2f", stats.SuccessRate)
	}
}

func TestEnableDisableModel(t *testing.T) {
	router := NewMultiModelRouter()

	metadata := ModelMetadata{
		ID:      "model1",
		Name:    "Test Model",
		Version: "1.0",
		Runtime: RuntimePyTorch,
	}
	_ = router.RegisterModel(metadata)

	// Model should be enabled by default
	stats := router.GetModelStats("model1")
	if !stats.Enabled {
		t.Error("Model should be enabled by default")
	}

	// Disable model
	err := router.DisableModel("model1")
	if err != nil {
		t.Fatalf("Failed to disable model: %v", err)
	}

	stats = router.GetModelStats("model1")
	if stats.Enabled {
		t.Error("Model should be disabled")
	}

	// Re-enable model
	err = router.EnableModel("model1")
	if err != nil {
		t.Fatalf("Failed to enable model: %v", err)
	}

	stats = router.GetModelStats("model1")
	if !stats.Enabled {
		t.Error("Model should be enabled")
	}
}

func TestResetModelStats(t *testing.T) {
	router := NewMultiModelRouter()

	metadata := ModelMetadata{
		ID:      "model1",
		Name:    "Test Model",
		Version: "1.0",
		Runtime: RuntimePyTorch,
	}
	_ = router.RegisterModel(metadata)

	// Add some performance data
	router.UpdateModelPerformance("model1", true, 10*time.Millisecond)
	router.UpdateModelPerformance("model1", true, 15*time.Millisecond)

	stats := router.GetModelStats("model1")
	if stats.SuccessCount != 2 {
		t.Errorf("Expected 2 successes before reset, got %d", stats.SuccessCount)
	}

	// Reset stats
	err := router.ResetModelStats("model1")
	if err != nil {
		t.Fatalf("Failed to reset stats: %v", err)
	}

	stats = router.GetModelStats("model1")
	if stats.SuccessCount != 0 {
		t.Errorf("Expected 0 successes after reset, got %d", stats.SuccessCount)
	}
}

func TestGetAllModelStats(t *testing.T) {
	router := NewMultiModelRouter()

	// Register multiple models
	for i := 1; i <= 3; i++ {
		metadata := ModelMetadata{
			ID:      "model" + string(rune('0'+i)),
			Name:    "Test Model " + string(rune('0'+i)),
			Version: "1.0",
			Runtime: RuntimePyTorch,
		}
		_ = router.RegisterModel(metadata)
	}

	allStats := router.GetAllModelStats()
	if len(allStats) != 3 {
		t.Errorf("Expected 3 model stats, got %d", len(allStats))
	}
}

func TestSetExplorationRate(t *testing.T) {
	router := NewMultiModelRouter()

	router.SetExplorationRate(0.2)
	if router.explorationRate != 0.2 {
		t.Errorf("Expected exploration rate 0.2, got %.2f", router.explorationRate)
	}

	// Test clamping
	router.SetExplorationRate(-0.1)
	if router.explorationRate != 0 {
		t.Errorf("Expected exploration rate 0 (clamped), got %.2f", router.explorationRate)
	}

	router.SetExplorationRate(1.5)
	if router.explorationRate != 1.0 {
		t.Errorf("Expected exploration rate 1.0 (clamped), got %.2f", router.explorationRate)
	}
}

func TestThompsonSampling(t *testing.T) {
	router := NewMultiModelRouter()

	// Register models with different performance
	for i := 1; i <= 3; i++ {
		metadata := ModelMetadata{
			ID:      "model" + string(rune('0'+i)),
			Name:    "Test Model",
			Version: "1.0",
			Runtime: RuntimePyTorch,
		}
		_ = router.RegisterModel(metadata)
	}

	// Simulate different performance levels
	for i := 0; i < 10; i++ {
		router.UpdateModelPerformance("model1", true, 10*time.Millisecond)
	}

	for i := 0; i < 10; i++ {
		router.UpdateModelPerformance("model2", i%2 == 0, 20*time.Millisecond)
	}

	for i := 0; i < 10; i++ {
		router.UpdateModelPerformance("model3", false, 30*time.Millisecond)
	}

	// model1 should be selected more often due to better performance
	selections := make(map[string]int)
	for i := 0; i < 100; i++ {
		modelID, _ := router.SelectModel("")
		selections[modelID]++
	}

	// model1 should have more selections (not guaranteed but highly likely)
	if selections["model1"] == 0 {
		t.Error("Model1 should be selected at least once")
	}
}

func TestModelStatsString(t *testing.T) {
	stats := ModelStats{
		ModelID:         "model1",
		ModelName:       "Test Model",
		Version:         "1.0",
		Runtime:         "pytorch",
		Enabled:         true,
		TotalSelections: 100,
		SuccessCount:    95,
		FailureCount:    5,
		SuccessRate:     0.95,
		AvgLatencyMs:    25.5,
	}

	str := stats.String()
	if str == "" {
		t.Error("Stats string should not be empty")
	}
}

func BenchmarkModelSelection(b *testing.B) {
	router := NewMultiModelRouter()

	for i := 1; i <= 5; i++ {
		metadata := ModelMetadata{
			ID:      "model" + string(rune('0'+i)),
			Name:    "Test Model",
			Version: "1.0",
			Runtime: RuntimePyTorch,
		}
		_ = router.RegisterModel(metadata)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		router.SelectModel("")
	}
}

func BenchmarkUpdateModelPerformance(b *testing.B) {
	router := NewMultiModelRouter()

	metadata := ModelMetadata{
		ID:      "model1",
		Name:    "Test Model",
		Version: "1.0",
		Runtime: RuntimePyTorch,
	}
	_ = router.RegisterModel(metadata)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		router.UpdateModelPerformance("model1", i%2 == 0, time.Duration(i%100)*time.Millisecond)
	}
}
