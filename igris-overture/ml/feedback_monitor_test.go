package ml

import (
	"testing"
	"time"
)

func TestNewFeedbackMonitor(t *testing.T) {
	router := NewMultiModelRouter()
	monitor := NewFeedbackMonitor(router)

	if monitor == nil {
		t.Fatal("Monitor should not be nil")
	}

	defer monitor.Shutdown()

	stats := monitor.GetStats()
	if stats["total_signals"].(int64) != 0 {
		t.Error("New monitor should have 0 signals")
	}
}

func TestRecordFeedback(t *testing.T) {
	router := NewMultiModelRouter()
	monitor := NewFeedbackMonitor(router)
	defer monitor.Shutdown()

	signal := FeedbackSignal{
		ModelID:     "model1",
		RequestID:   "req1",
		Timestamp:   time.Now(),
		Latency:     25 * time.Millisecond,
		Success:     true,
		Prediction:  0.85,
		Confidence:  0.92,
		RuntimeUsed: string(RuntimePyTorch),
	}

	monitor.RecordFeedback(signal)

	stats := monitor.GetStats()
	totalSignals := stats["total_signals"].(int64)
	if totalSignals != 1 {
		t.Errorf("Expected 1 signal, got %d", totalSignals)
	}
}

func TestAnalyzeDrift(t *testing.T) {
	router := NewMultiModelRouter()
	monitor := NewFeedbackMonitor(router)
	defer monitor.Shutdown()

	// Record multiple signals for model1
	for i := 0; i < 10; i++ {
		signal := FeedbackSignal{
			ModelID:     "model1",
			RequestID:   "req" + string(rune('0'+i)),
			Timestamp:   time.Now(),
			Latency:     time.Duration(20+i) * time.Millisecond,
			Success:     true,
			Prediction:  0.8 + float64(i)*0.01,
			Confidence:  0.9,
			RuntimeUsed: string(RuntimePyTorch),
		}
		monitor.RecordFeedback(signal)
	}

	// Wait a bit for processing
	time.Sleep(100 * time.Millisecond)

	metrics, err := monitor.AnalyzeDrift("model1")
	if err != nil {
		t.Fatalf("Failed to analyze drift: %v", err)
	}

	if metrics.TotalSamples != 10 {
		t.Errorf("Expected 10 samples, got %d", metrics.TotalSamples)
	}

	if metrics.SuccessRate != 1.0 {
		t.Errorf("Expected 100%% success rate, got %.2f", metrics.SuccessRate)
	}

	if metrics.DriftScore < 0 || metrics.DriftScore > 1 {
		t.Errorf("Drift score should be 0-1, got %.3f", metrics.DriftScore)
	}
}

func TestDriftDetection(t *testing.T) {
	router := NewMultiModelRouter()
	monitor := NewFeedbackMonitor(router)
	defer monitor.Shutdown()

	monitor.SetDriftThreshold(0.2)

	// Record baseline data with mean around 0.5
	for i := 0; i < 20; i++ {
		signal := FeedbackSignal{
			ModelID:    "model1",
			RequestID:  "req" + string(rune('0'+i)),
			Timestamp:  time.Now(),
			Latency:    20 * time.Millisecond,
			Success:    true,
			Prediction: 0.5,
			Confidence: 0.9,
		}
		monitor.RecordFeedback(signal)
	}

	// Force window rotation by waiting
	time.Sleep(100 * time.Millisecond)

	// Simulate drift: predictions shift significantly
	// Note: Real drift requires window rotation
	_, err := monitor.AnalyzeDrift("model1")
	if err != nil {
		t.Fatalf("Drift analysis failed: %v", err)
	}
}

func TestGroundTruthTracking(t *testing.T) {
	router := NewMultiModelRouter()
	monitor := NewFeedbackMonitor(router)
	defer monitor.Shutdown()

	actualValue := 0.75
	signal := FeedbackSignal{
		ModelID:     "model1",
		RequestID:   "req1",
		Timestamp:   time.Now(),
		Latency:     20 * time.Millisecond,
		Success:     true,
		Prediction:  0.70,
		Confidence:  0.85,
		ActualValue: &actualValue,
	}

	monitor.RecordFeedback(signal)

	time.Sleep(100 * time.Millisecond)

	metrics, err := monitor.AnalyzeDrift("model1")
	if err != nil {
		t.Fatalf("Failed to analyze drift: %v", err)
	}

	if metrics.GroundTruthAvailable != 1 {
		t.Errorf("Expected 1 ground truth sample, got %d", metrics.GroundTruthAvailable)
	}
}

func TestUserFeedback(t *testing.T) {
	router := NewMultiModelRouter()
	monitor := NewFeedbackMonitor(router)
	defer monitor.Shutdown()

	userFeedback := &UserFeedback{
		Rating:   5,
		Helpful:  true,
		Accuracy: 0.95,
		Comments: "Great prediction",
	}

	signal := FeedbackSignal{
		ModelID:      "model1",
		RequestID:    "req1",
		Timestamp:    time.Now(),
		Latency:      20 * time.Millisecond,
		Success:      true,
		Prediction:   0.85,
		Confidence:   0.92,
		UserFeedback: userFeedback,
	}

	monitor.RecordFeedback(signal)

	signals := monitor.GetRecentSignals(1)
	if len(signals) != 1 {
		t.Fatalf("Expected 1 signal, got %d", len(signals))
	}

	if signals[0].UserFeedback == nil {
		t.Error("User feedback should be preserved")
	}

	if signals[0].UserFeedback.Rating != 5 {
		t.Errorf("Expected rating 5, got %d", signals[0].UserFeedback.Rating)
	}
}

func TestGetRecentSignals(t *testing.T) {
	router := NewMultiModelRouter()
	monitor := NewFeedbackMonitor(router)
	defer monitor.Shutdown()

	// Record 10 signals
	for i := 0; i < 10; i++ {
		signal := FeedbackSignal{
			ModelID:   "model1",
			RequestID: "req" + string(rune('0'+i)),
			Timestamp: time.Now(),
			Latency:   20 * time.Millisecond,
			Success:   true,
		}
		monitor.RecordFeedback(signal)
	}

	// Get last 5 signals
	signals := monitor.GetRecentSignals(5)
	if len(signals) != 5 {
		t.Errorf("Expected 5 signals, got %d", len(signals))
	}

	// Request more than available
	signals = monitor.GetRecentSignals(20)
	if len(signals) != 10 {
		t.Errorf("Expected 10 signals (all available), got %d", len(signals))
	}
}

func TestExportAndClearSignals(t *testing.T) {
	router := NewMultiModelRouter()
	monitor := NewFeedbackMonitor(router)
	defer monitor.Shutdown()

	// Record some signals
	for i := 0; i < 5; i++ {
		signal := FeedbackSignal{
			ModelID:   "model1",
			RequestID: "req" + string(rune('0'+i)),
			Timestamp: time.Now(),
			Latency:   20 * time.Millisecond,
			Success:   true,
		}
		monitor.RecordFeedback(signal)
	}

	// Export signals
	exported := monitor.ExportSignals()
	if len(exported) != 5 {
		t.Errorf("Expected 5 exported signals, got %d", len(exported))
	}

	// Clear signals
	monitor.ClearSignals()

	signals := monitor.GetRecentSignals(10)
	if len(signals) != 0 {
		t.Errorf("Expected 0 signals after clear, got %d", len(signals))
	}
}

func TestGetAllDriftMetrics(t *testing.T) {
	router := NewMultiModelRouter()
	monitor := NewFeedbackMonitor(router)
	defer monitor.Shutdown()

	// Record signals for multiple models
	models := []string{"model1", "model2", "model3"}
	for _, modelID := range models {
		for i := 0; i < 5; i++ {
			signal := FeedbackSignal{
				ModelID:   modelID,
				RequestID: "req" + string(rune('0'+i)),
				Timestamp: time.Now(),
				Latency:   20 * time.Millisecond,
				Success:   true,
			}
			monitor.RecordFeedback(signal)
		}
	}

	time.Sleep(100 * time.Millisecond)

	allMetrics := monitor.GetAllDriftMetrics()
	if len(allMetrics) != 3 {
		t.Errorf("Expected metrics for 3 models, got %d", len(allMetrics))
	}
}

func TestSetDriftThreshold(t *testing.T) {
	router := NewMultiModelRouter()
	monitor := NewFeedbackMonitor(router)
	defer monitor.Shutdown()

	monitor.SetDriftThreshold(0.25)
	if monitor.driftThreshold != 0.25 {
		t.Errorf("Expected threshold 0.25, got %.2f", monitor.driftThreshold)
	}

	// Test clamping
	monitor.SetDriftThreshold(-0.1)
	if monitor.driftThreshold != 0 {
		t.Errorf("Expected threshold 0 (clamped), got %.2f", monitor.driftThreshold)
	}

	monitor.SetDriftThreshold(1.5)
	if monitor.driftThreshold != 1.0 {
		t.Errorf("Expected threshold 1.0 (clamped), got %.2f", monitor.driftThreshold)
	}
}

func BenchmarkRecordFeedback(b *testing.B) {
	router := NewMultiModelRouter()
	monitor := NewFeedbackMonitor(router)
	defer monitor.Shutdown()

	signal := FeedbackSignal{
		ModelID:    "model1",
		RequestID:  "req1",
		Timestamp:  time.Now(),
		Latency:    20 * time.Millisecond,
		Success:    true,
		Prediction: 0.85,
		Confidence: 0.92,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		monitor.RecordFeedback(signal)
	}
}

func BenchmarkAnalyzeDrift(b *testing.B) {
	router := NewMultiModelRouter()
	monitor := NewFeedbackMonitor(router)
	defer monitor.Shutdown()

	// Pre-populate with data
	for i := 0; i < 100; i++ {
		signal := FeedbackSignal{
			ModelID:    "model1",
			RequestID:  "req" + string(rune('0'+i%10)),
			Timestamp:  time.Now(),
			Latency:    20 * time.Millisecond,
			Success:    true,
			Prediction: 0.8 + float64(i%10)*0.01,
			Confidence: 0.9,
		}
		monitor.RecordFeedback(signal)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = monitor.AnalyzeDrift("model1")
	}
}
