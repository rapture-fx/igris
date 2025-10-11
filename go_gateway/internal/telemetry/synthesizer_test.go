package telemetry

import (
	"encoding/json"
	"testing"
	"time"
)

func TestNewTelemetrySynthesizer(t *testing.T) {
	config := DefaultSynthesizerConfig()
	ts := NewTelemetrySynthesizer(config)
	defer ts.Close()

	if ts == nil {
		t.Fatal("Expected non-nil synthesizer")
	}

	if ts.config.SchemaVersion != "1.0.2" {
		t.Errorf("Expected schema version 1.0.2, got %s", ts.config.SchemaVersion)
	}
}

func TestIngestRustTelemetry(t *testing.T) {
	config := DefaultSynthesizerConfig()
	ts := NewTelemetrySynthesizer(config)
	defer ts.Close()

	rustData := map[string]interface{}{
		"metric_id":   "latency",
		"value":       100.5,
		"timestamp":   time.Now().UnixMilli(),
		"tags": map[string]interface{}{
			"region": "us-east-1",
		},
	}

	data, err := json.Marshal(rustData)
	if err != nil {
		t.Fatal(err)
	}

	err = ts.IngestRustTelemetry(data)
	if err != nil {
		t.Errorf("Failed to ingest Rust telemetry: %v", err)
	}

	time.Sleep(100 * time.Millisecond)

	stats := ts.GetStats()
	if stats.TotalEventsIngested == 0 {
		t.Error("Expected events to be ingested")
	}
}

func TestIngestGoTelemetry(t *testing.T) {
	config := DefaultSynthesizerConfig()
	ts := NewTelemetrySynthesizer(config)
	defer ts.Close()

	goData := map[string]interface{}{
		"metric_id": "throughput",
		"value":     500.0,
		"timestamp": time.Now().UnixMilli(),
		"tags": map[string]interface{}{
			"service": "gateway",
		},
	}

	data, err := json.Marshal(goData)
	if err != nil {
		t.Fatal(err)
	}

	err = ts.IngestGoTelemetry(data)
	if err != nil {
		t.Errorf("Failed to ingest Go telemetry: %v", err)
	}

	time.Sleep(100 * time.Millisecond)

	stats := ts.GetStats()
	if stats.EventsNormalized == 0 {
		t.Error("Expected events to be normalized")
	}
}

func TestIngestPythonTelemetry(t *testing.T) {
	config := DefaultSynthesizerConfig()
	ts := NewTelemetrySynthesizer(config)
	defer ts.Close()

	pythonData := map[string]interface{}{
		"metric_name": "prediction_accuracy",
		"value":       0.95,
		"timestamp":   time.Now().UnixMilli(),
	}

	data, err := json.Marshal(pythonData)
	if err != nil {
		t.Fatal(err)
	}

	err = ts.IngestPythonTelemetry(data)
	if err != nil {
		t.Errorf("Failed to ingest Python telemetry: %v", err)
	}

	time.Sleep(100 * time.Millisecond)

	stats := ts.GetStats()
	if stats.TotalEventsIngested == 0 {
		t.Error("Expected events to be ingested")
	}
}

func TestSchemaConsistency(t *testing.T) {
	config := DefaultSynthesizerConfig()
	ts := NewTelemetrySynthesizer(config)
	defer ts.Close()

	// Subscribe to normalized stream
	sub := ts.Subscribe()

	// Ingest from different sources
	sources := []struct {
		name string
		data map[string]interface{}
		fn   func([]byte) error
	}{
		{
			"rust",
			map[string]interface{}{
				"metric_id": "test",
				"value":     100.0,
				"timestamp": time.Now().UnixMilli(),
			},
			ts.IngestRustTelemetry,
		},
		{
			"go",
			map[string]interface{}{
				"metric_id": "test",
				"value":     200.0,
				"timestamp": time.Now().UnixMilli(),
			},
			ts.IngestGoTelemetry,
		},
		{
			"python",
			map[string]interface{}{
				"metric_name": "test",
				"value":       300.0,
				"timestamp":   time.Now().UnixMilli(),
			},
			ts.IngestPythonTelemetry,
		},
	}

	for _, source := range sources {
		data, _ := json.Marshal(source.data)
		source.fn(data)
	}

	// Validate all events have consistent schema
	timeout := time.After(1 * time.Second)
	eventsReceived := 0

	for eventsReceived < 3 {
		select {
		case event := <-sub:
			if event.MetricID == "" {
				t.Error("MetricID should not be empty")
			}
			if event.Timestamp == 0 {
				t.Error("Timestamp should not be zero")
			}
			if event.SourceType == "" {
				t.Error("SourceType should not be empty")
			}
			eventsReceived++
		case <-timeout:
			t.Fatalf("Timeout waiting for events, received %d/3", eventsReceived)
		}
	}
}

func TestAggregation(t *testing.T) {
	config := DefaultSynthesizerConfig()
	ts := NewTelemetrySynthesizer(config)
	defer ts.Close()

	// Ingest multiple events for the same metric
	for i := 0; i < 10; i++ {
		rustData := map[string]interface{}{
			"metric_id": "cpu_usage",
			"value":     float64(50 + i),
			"timestamp": time.Now().UnixMilli(),
		}
		data, _ := json.Marshal(rustData)
		ts.IngestRustTelemetry(data)
	}

	time.Sleep(200 * time.Millisecond)

	aggregates := ts.GetAggregates()
	if len(aggregates) == 0 {
		t.Error("Expected aggregates to be created")
	}

	key := "cpu_usage:rust"
	agg, ok := aggregates[key]
	if !ok {
		t.Fatalf("Expected aggregate for key %s", key)
	}

	if agg.Count != 10 {
		t.Errorf("Expected count 10, got %d", agg.Count)
	}

	if agg.Min != 50.0 {
		t.Errorf("Expected min 50.0, got %f", agg.Min)
	}

	if agg.Max != 59.0 {
		t.Errorf("Expected max 59.0, got %f", agg.Max)
	}
}
