package models

import (
	"os"
	"strings"
	"testing"
	"time"
)

func TestMetricsCollector_RecordInference(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)
	collector := NewMetricsCollector(registry, reloader)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}
	registry.Register(metadata)

	// Record some inferences
	collector.RecordInference("test_model", 45, true)
	collector.RecordInference("test_model", 50, true)
	collector.RecordInference("test_model", 55, true)

	// Get metrics
	metrics := collector.GetModelMetrics("test_model")

	if metrics.InferenceLatencyMs == nil {
		t.Fatal("Expected latency metrics to be set")
	}

	if metrics.InferenceLatencyMs.Count != 3 {
		t.Errorf("Expected 3 requests, got %d", metrics.InferenceLatencyMs.Count)
	}

	expectedAvg := int64((45 + 50 + 55) / 3)
	if metrics.InferenceLatencyMs.Average != expectedAvg {
		t.Errorf("Expected average %d, got %d", expectedAvg, metrics.InferenceLatencyMs.Average)
	}

	if metrics.InferenceLatencyMs.Min != 45 {
		t.Errorf("Expected min 45, got %d", metrics.InferenceLatencyMs.Min)
	}

	if metrics.InferenceLatencyMs.Max != 55 {
		t.Errorf("Expected max 55, got %d", metrics.InferenceLatencyMs.Max)
	}
}

func TestMetricsCollector_RecordInferenceWithErrors(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)
	collector := NewMetricsCollector(registry, reloader)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}
	registry.Register(metadata)

	// Record successful and failed inferences
	collector.RecordInference("test_model", 45, true)
	collector.RecordInference("test_model", 50, false) // Error
	collector.RecordInference("test_model", 55, false) // Error

	metrics := collector.GetModelMetrics("test_model")

	if metrics.ErrorCount != 2 {
		t.Errorf("Expected 2 errors, got %d", metrics.ErrorCount)
	}

	if metrics.InferenceLatencyMs.Count != 3 {
		t.Errorf("Expected 3 total requests, got %d", metrics.InferenceLatencyMs.Count)
	}
}

func TestMetricsCollector_Throughput(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)
	collector := NewMetricsCollector(registry, reloader)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}
	registry.Register(metadata)

	// Record inferences over time
	for i := 0; i < 10; i++ {
		collector.RecordInference("test_model", 50, true)
		time.Sleep(10 * time.Millisecond)
	}

	metrics := collector.GetModelMetrics("test_model")

	if metrics.Throughput == nil {
		t.Fatal("Expected throughput metrics to be set")
	}

	if metrics.Throughput.RequestCount != 10 {
		t.Errorf("Expected 10 requests, got %d", metrics.Throughput.RequestCount)
	}

	if metrics.Throughput.CurrentRPS <= 0 {
		t.Error("Expected positive RPS")
	}

	if metrics.Throughput.Uptime <= 0 {
		t.Error("Expected positive uptime")
	}
}

func TestMetricsCollector_RecordModelLoad(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)
	collector := NewMetricsCollector(registry, reloader)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}
	registry.Register(metadata)

	// Record load time
	loadDuration := 250 * time.Millisecond
	collector.RecordModelLoad("test_model", loadDuration)

	metrics := collector.GetModelMetrics("test_model")

	if metrics.LoadTimeMs != 250 {
		t.Errorf("Expected load time 250ms, got %d", metrics.LoadTimeMs)
	}
}

func TestMetricsCollector_Percentiles(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)
	collector := NewMetricsCollector(registry, reloader)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}
	registry.Register(metadata)

	// Record 100 samples with known distribution
	for i := 1; i <= 100; i++ {
		collector.RecordInference("test_model", int64(i), true)
	}

	metrics := collector.GetModelMetrics("test_model")

	// P50 should be around 50
	if metrics.InferenceLatencyMs.P50 < 48 || metrics.InferenceLatencyMs.P50 > 52 {
		t.Errorf("P50 out of expected range, got %d", metrics.InferenceLatencyMs.P50)
	}

	// P95 should be around 95
	if metrics.InferenceLatencyMs.P95 < 93 || metrics.InferenceLatencyMs.P95 > 97 {
		t.Errorf("P95 out of expected range, got %d", metrics.InferenceLatencyMs.P95)
	}

	// P99 should be around 99
	if metrics.InferenceLatencyMs.P99 < 97 || metrics.InferenceLatencyMs.P99 > 100 {
		t.Errorf("P99 out of expected range, got %d", metrics.InferenceLatencyMs.P99)
	}
}

func TestMetricsCollector_GetAllMetrics(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)
	collector := NewMetricsCollector(registry, reloader)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	// Register multiple models
	for i := 1; i <= 3; i++ {
		metadata := &ModelMetadata{
			ModelID:  fmt.Sprintf("model_%d", i),
			Version:  "1.0.0",
			LoadPath: tmpFile.Name(),
		}
		registry.Register(metadata)
		collector.RecordInference(metadata.ModelID, int64(i*10), true)
	}

	allMetrics := collector.GetAllMetrics()

	if len(allMetrics) != 3 {
		t.Errorf("Expected 3 model metrics, got %d", len(allMetrics))
	}

	for i := 1; i <= 3; i++ {
		modelID := fmt.Sprintf("model_%d", i)
		if _, exists := allMetrics[modelID]; !exists {
			t.Errorf("Expected metrics for %s", modelID)
		}
	}
}

func TestMetricsCollector_ExportPrometheusMetrics(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)
	collector := NewMetricsCollector(registry, reloader)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
		Status:   StatusActive,
	}
	registry.Register(metadata)

	// Record some metrics
	collector.RecordInference("test_model", 45, true)
	collector.RecordInference("test_model", 50, true)
	collector.RecordModelLoad("test_model", 200*time.Millisecond)

	prometheus := collector.ExportPrometheusMetrics()

	// Verify Prometheus format
	if !strings.Contains(prometheus, "# HELP model_inference_latency_ms") {
		t.Error("Missing HELP declaration for latency")
	}

	if !strings.Contains(prometheus, "# TYPE model_inference_latency_ms gauge") {
		t.Error("Missing TYPE declaration for latency")
	}

	if !strings.Contains(prometheus, "model_inference_latency_ms{model=\"test_model\",version=\"1.0.0\",quantile=\"0.99\"}") {
		t.Error("Missing P99 latency metric")
	}

	if !strings.Contains(prometheus, "model_load_time_ms{model=\"test_model\",version=\"1.0.0\"} 200") {
		t.Error("Missing or incorrect load time metric")
	}

	if !strings.Contains(prometheus, "model_active_version{model=\"test_model\",version=\"1.0.0\"} 1") {
		t.Error("Missing active version indicator")
	}
}

func TestMetricsCollector_ConcurrentRecording(t *testing.T) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)
	collector := NewMetricsCollector(registry, reloader)

	tmpFile, _ := os.CreateTemp("", "test_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "test_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}
	registry.Register(metadata)

	// Record inferences concurrently
	done := make(chan bool)
	for i := 0; i < 100; i++ {
		go func() {
			collector.RecordInference("test_model", 50, true)
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 100; i++ {
		<-done
	}

	metrics := collector.GetModelMetrics("test_model")

	if metrics.InferenceLatencyMs.Count != 100 {
		t.Errorf("Expected 100 requests, got %d", metrics.InferenceLatencyMs.Count)
	}
}

func BenchmarkMetricsCollector_RecordInference(b *testing.B) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)
	collector := NewMetricsCollector(registry, reloader)

	tmpFile, _ := os.CreateTemp("", "bench_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "bench_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}
	registry.Register(metadata)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		collector.RecordInference("bench_model", 50, true)
	}
}

func BenchmarkMetricsCollector_GetModelMetrics(b *testing.B) {
	store := NewInMemoryStore()
	registry := NewModelRegistry(store)
	reloader := NewModelReloader(registry)
	collector := NewMetricsCollector(registry, reloader)

	tmpFile, _ := os.CreateTemp("", "bench_model_*.pkl")
	defer os.Remove(tmpFile.Name())
	tmpFile.Close()

	metadata := &ModelMetadata{
		ModelID:  "bench_model",
		Version:  "1.0.0",
		LoadPath: tmpFile.Name(),
	}
	registry.Register(metadata)

	// Pre-populate metrics
	for i := 0; i < 1000; i++ {
		collector.RecordInference("bench_model", 50, true)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		collector.GetModelMetrics("bench_model")
	}
}
