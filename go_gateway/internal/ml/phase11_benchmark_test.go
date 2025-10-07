package ml

import (
	"testing"
	"time"
)

// Benchmark GPU Runtime Selection
func BenchmarkRuntimeSelection(b *testing.B) {
	router := NewMultiModelRouter()

	// Register models
	for i := 0; i < 5; i++ {
		metadata := ModelMetadata{
			ID:      "model_" + string(rune('0'+i)),
			Name:    "Benchmark Model",
			Version: "1.0",
			Runtime: RuntimePyTorch,
		}
		_ = router.RegisterModel(metadata)
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			router.SelectModel("")
		}
	})
}

// Benchmark Feedback Recording
func BenchmarkFeedbackRecording(b *testing.B) {
	router := NewMultiModelRouter()
	monitor := NewFeedbackMonitor(router)
	defer monitor.Shutdown()

	signal := FeedbackSignal{
		ModelID:    "model1",
		RequestID:  "req1",
		Timestamp:  time.Now(),
		Latency:    25 * time.Millisecond,
		Success:    true,
		Prediction: 0.85,
		Confidence: 0.92,
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			monitor.RecordFeedback(signal)
		}
	})
}

// Benchmark Thompson Sampling
func BenchmarkThompsonSampling(b *testing.B) {
	router := NewMultiModelRouter()

	// Register 10 models
	for i := 0; i < 10; i++ {
		metadata := ModelMetadata{
			ID:      "model_" + string(rune('0'+i)),
			Name:    "Test Model",
			Version: "1.0",
			Runtime: RuntimePyTorch,
		}
		_ = router.RegisterModel(metadata)

		// Add some performance history
		for j := 0; j < 20; j++ {
			router.UpdateModelPerformance(metadata.ID, j%2 == 0, time.Duration(10+j)*time.Millisecond)
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		router.SelectModel("")
	}
}

// Benchmark Drift Analysis
func BenchmarkDriftAnalysis(b *testing.B) {
	router := NewMultiModelRouter()
	monitor := NewFeedbackMonitor(router)
	defer monitor.Shutdown()

	// Pre-populate with 1000 signals
	for i := 0; i < 1000; i++ {
		signal := FeedbackSignal{
			ModelID:    "model1",
			RequestID:  "req",
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

// Benchmark Model Performance Update
func BenchmarkModelPerformanceUpdate(b *testing.B) {
	router := NewMultiModelRouter()

	metadata := ModelMetadata{
		ID:      "model1",
		Name:    "Test Model",
		Version: "1.0",
		Runtime: RuntimeONNX,
	}
	_ = router.RegisterModel(metadata)

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			router.UpdateModelPerformance("model1", i%2 == 0, time.Duration(i%100)*time.Millisecond)
			i++
		}
	})
}

// Benchmark Concurrent Model Selection
func BenchmarkConcurrentModelSelection(b *testing.B) {
	router := NewMultiModelRouter()

	for i := 0; i < 10; i++ {
		metadata := ModelMetadata{
			ID:      "model_" + string(rune('0'+i)),
			Name:    "Test Model",
			Version: "1.0",
			Runtime: RuntimePyTorch,
		}
		_ = router.RegisterModel(metadata)
	}

	b.ResetTimer()
	b.SetParallelism(100)
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			modelID, _ := router.SelectModel("")
			router.UpdateModelPerformance(modelID, true, 10*time.Millisecond)
		}
	})
}
