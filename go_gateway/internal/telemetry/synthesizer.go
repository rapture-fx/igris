// Package telemetry provides telemetry aggregation and normalization
// for the Adaptive Orchestration Layer (Phase 10).
//
// The Telemetry Synthesizer aggregates and normalizes telemetry from
// Go, Rust, and Python services into a unified JSON schema for consumption
// by the Adaptive Policy Engine.
package telemetry

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"
)

// TelemetrySchema defines the unified telemetry format (v1.0.2)
type TelemetrySchema struct {
	MetricID   string                 `json:"metric_id"`
	Timestamp  int64                  `json:"timestamp"`
	Value      float64                `json:"value"`
	Tags       map[string]string      `json:"tags"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	SourceType string                 `json:"source_type"` // "rust", "go", "python"
}

// SynthesizerConfig configuration for the telemetry synthesizer
type SynthesizerConfig struct {
	Enabled           bool          `json:"enabled"`
	AggregationWindow time.Duration `json:"aggregation_window_ms"`
	BufferSize        int           `json:"buffer_size"`
	FlushInterval     time.Duration `json:"flush_interval_ms"`
	SchemaVersion     string        `json:"schema_version"`
}

// DefaultSynthesizerConfig returns default configuration
func DefaultSynthesizerConfig() *SynthesizerConfig {
	return &SynthesizerConfig{
		Enabled:           true,
		AggregationWindow: 10 * time.Second,
		BufferSize:        1000,
		FlushInterval:     5 * time.Second,
		SchemaVersion:     "1.0.2",
	}
}

// TelemetrySynthesizer aggregates and normalizes telemetry from multiple sources
type TelemetrySynthesizer struct {
	config        *SynthesizerConfig
	buffer        chan TelemetrySchema
	subscribers   []chan TelemetrySchema
	mu            sync.RWMutex
	ctx           context.Context
	cancel        context.CancelFunc
	stats         *SynthesizerStats
	aggregateData map[string]*AggregateMetric
	aggregateMu   sync.RWMutex
}

// SynthesizerStats tracks synthesizer performance
type SynthesizerStats struct {
	mu                 sync.RWMutex
	TotalEventsIngested uint64  `json:"total_events_ingested"`
	EventsNormalized   uint64  `json:"events_normalized"`
	EventsDropped      uint64  `json:"events_dropped"`
	SchemaViolations   uint64  `json:"schema_violations"`
	AvgLatencyMs       float64 `json:"avg_latency_ms"`
	LastFlushTime      int64   `json:"last_flush_time"`
}

// AggregateMetric stores aggregated metric data
type AggregateMetric struct {
	MetricID  string
	Values    []float64
	Count     int
	Sum       float64
	Min       float64
	Max       float64
	Timestamp int64
	Tags      map[string]string
}

// NewTelemetrySynthesizer creates a new telemetry synthesizer
func NewTelemetrySynthesizer(config *SynthesizerConfig) *TelemetrySynthesizer {
	if config == nil {
		config = DefaultSynthesizerConfig()
	}

	ctx, cancel := context.WithCancel(context.Background())

	ts := &TelemetrySynthesizer{
		config:        config,
		buffer:        make(chan TelemetrySchema, config.BufferSize),
		subscribers:   make([]chan TelemetrySchema, 0),
		ctx:           ctx,
		cancel:        cancel,
		stats:         &SynthesizerStats{},
		aggregateData: make(map[string]*AggregateMetric),
	}

	if config.Enabled {
		go ts.processTelemetry()
		go ts.flushAggregates()
	}

	return ts
}

// IngestRustTelemetry ingests telemetry from Rust services
func (ts *TelemetrySynthesizer) IngestRustTelemetry(data []byte) error {
	start := time.Now()

	var rustMetric map[string]interface{}
	if err := json.Unmarshal(data, &rustMetric); err != nil {
		ts.stats.mu.Lock()
		ts.stats.SchemaViolations++
		ts.stats.mu.Unlock()
		return fmt.Errorf("failed to parse Rust telemetry: %w", err)
	}

	normalized := ts.normalizeRustMetric(rustMetric)

	select {
	case ts.buffer <- normalized:
		ts.updateIngestStats(time.Since(start))
	default:
		ts.stats.mu.Lock()
		ts.stats.EventsDropped++
		ts.stats.mu.Unlock()
		return fmt.Errorf("buffer full, dropping event")
	}

	return nil
}

// IngestGoTelemetry ingests telemetry from Go services
func (ts *TelemetrySynthesizer) IngestGoTelemetry(data []byte) error {
	start := time.Now()

	var goMetric map[string]interface{}
	if err := json.Unmarshal(data, &goMetric); err != nil {
		ts.stats.mu.Lock()
		ts.stats.SchemaViolations++
		ts.stats.mu.Unlock()
		return fmt.Errorf("failed to parse Go telemetry: %w", err)
	}

	normalized := ts.normalizeGoMetric(goMetric)

	select {
	case ts.buffer <- normalized:
		ts.updateIngestStats(time.Since(start))
	default:
		ts.stats.mu.Lock()
		ts.stats.EventsDropped++
		ts.stats.mu.Unlock()
		return fmt.Errorf("buffer full, dropping event")
	}

	return nil
}

// IngestPythonTelemetry ingests telemetry from Python services
func (ts *TelemetrySynthesizer) IngestPythonTelemetry(data []byte) error {
	start := time.Now()

	var pythonMetric map[string]interface{}
	if err := json.Unmarshal(data, &pythonMetric); err != nil {
		ts.stats.mu.Lock()
		ts.stats.SchemaViolations++
		ts.stats.mu.Unlock()
		return fmt.Errorf("failed to parse Python telemetry: %w", err)
	}

	normalized := ts.normalizePythonMetric(pythonMetric)

	select {
	case ts.buffer <- normalized:
		ts.updateIngestStats(time.Since(start))
	default:
		ts.stats.mu.Lock()
		ts.stats.EventsDropped++
		ts.stats.mu.Unlock()
		return fmt.Errorf("buffer full, dropping event")
	}

	return nil
}

// normalizeRustMetric converts Rust-specific telemetry to unified schema
func (ts *TelemetrySynthesizer) normalizeRustMetric(data map[string]interface{}) TelemetrySchema {
	metricID := ts.extractString(data, "metric_id", "metric_name", "name")
	value := ts.extractFloat(data, "value", "val", "metric_value")
	timestamp := ts.extractTimestamp(data, "timestamp", "timestamp_ms", "ts")

	tags := make(map[string]string)
	if tagsData, ok := data["tags"].(map[string]interface{}); ok {
		for k, v := range tagsData {
			if strVal, ok := v.(string); ok {
				tags[k] = strVal
			}
		}
	}
	tags["service"] = "rust"

	return TelemetrySchema{
		MetricID:   metricID,
		Timestamp:  timestamp,
		Value:      value,
		Tags:       tags,
		Metadata:   data,
		SourceType: "rust",
	}
}

// normalizeGoMetric converts Go-specific telemetry to unified schema
func (ts *TelemetrySynthesizer) normalizeGoMetric(data map[string]interface{}) TelemetrySchema {
	metricID := ts.extractString(data, "metric_id", "name", "metric")
	value := ts.extractFloat(data, "value", "count", "metric_value")
	timestamp := ts.extractTimestamp(data, "timestamp", "time", "ts")

	tags := make(map[string]string)
	if tagsData, ok := data["tags"].(map[string]interface{}); ok {
		for k, v := range tagsData {
			if strVal, ok := v.(string); ok {
				tags[k] = strVal
			}
		}
	}
	tags["service"] = "go"

	return TelemetrySchema{
		MetricID:   metricID,
		Timestamp:  timestamp,
		Value:      value,
		Tags:       tags,
		Metadata:   data,
		SourceType: "go",
	}
}

// normalizePythonMetric converts Python-specific telemetry to unified schema
func (ts *TelemetrySynthesizer) normalizePythonMetric(data map[string]interface{}) TelemetrySchema {
	metricID := ts.extractString(data, "metric_id", "metric_name", "name")
	value := ts.extractFloat(data, "value", "metric_value", "val")
	timestamp := ts.extractTimestamp(data, "timestamp", "time", "timestamp_ms")

	tags := make(map[string]string)
	if tagsData, ok := data["tags"].(map[string]interface{}); ok {
		for k, v := range tagsData {
			if strVal, ok := v.(string); ok {
				tags[k] = strVal
			}
		}
	}
	tags["service"] = "python"

	return TelemetrySchema{
		MetricID:   metricID,
		Timestamp:  timestamp,
		Value:      value,
		Tags:       tags,
		Metadata:   data,
		SourceType: "python",
	}
}

// processTelemetry processes buffered telemetry events
func (ts *TelemetrySynthesizer) processTelemetry() {
	for {
		select {
		case <-ts.ctx.Done():
			return
		case event := <-ts.buffer:
			ts.stats.mu.Lock()
			ts.stats.EventsNormalized++
			ts.stats.mu.Unlock()

			// Update aggregate data
			ts.updateAggregate(event)

			// Broadcast to subscribers
			ts.mu.RLock()
			for _, sub := range ts.subscribers {
				select {
				case sub <- event:
				default:
					// Skip if subscriber is slow
				}
			}
			ts.mu.RUnlock()
		}
	}
}

// updateAggregate updates aggregated metric data
func (ts *TelemetrySynthesizer) updateAggregate(event TelemetrySchema) {
	ts.aggregateMu.Lock()
	defer ts.aggregateMu.Unlock()

	key := fmt.Sprintf("%s:%s", event.MetricID, event.SourceType)

	agg, exists := ts.aggregateData[key]
	if !exists {
		agg = &AggregateMetric{
			MetricID:  event.MetricID,
			Values:    make([]float64, 0, 100),
			Min:       event.Value,
			Max:       event.Value,
			Timestamp: event.Timestamp,
			Tags:      event.Tags,
		}
		ts.aggregateData[key] = agg
	}

	agg.Values = append(agg.Values, event.Value)
	agg.Count++
	agg.Sum += event.Value
	if event.Value < agg.Min {
		agg.Min = event.Value
	}
	if event.Value > agg.Max {
		agg.Max = event.Value
	}
}

// flushAggregates periodically flushes aggregated metrics
func (ts *TelemetrySynthesizer) flushAggregates() {
	ticker := time.NewTicker(ts.config.FlushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ts.ctx.Done():
			return
		case <-ticker.C:
			ts.performFlush()
		}
	}
}

// performFlush performs the actual flush operation
func (ts *TelemetrySynthesizer) performFlush() {
	ts.aggregateMu.Lock()
	defer ts.aggregateMu.Unlock()

	ts.stats.mu.Lock()
	ts.stats.LastFlushTime = time.Now().UnixMilli()
	ts.stats.mu.Unlock()

	// Clear aggregates after flush
	ts.aggregateData = make(map[string]*AggregateMetric)
}

// Subscribe subscribes to normalized telemetry stream
func (ts *TelemetrySynthesizer) Subscribe() chan TelemetrySchema {
	ts.mu.Lock()
	defer ts.mu.Unlock()

	ch := make(chan TelemetrySchema, 100)
	ts.subscribers = append(ts.subscribers, ch)
	return ch
}

// GetStats returns current synthesizer statistics
func (ts *TelemetrySynthesizer) GetStats() SynthesizerStats {
	ts.stats.mu.RLock()
	defer ts.stats.mu.RUnlock()

	return SynthesizerStats{
		TotalEventsIngested: ts.stats.TotalEventsIngested,
		EventsNormalized:    ts.stats.EventsNormalized,
		EventsDropped:       ts.stats.EventsDropped,
		SchemaViolations:    ts.stats.SchemaViolations,
		AvgLatencyMs:        ts.stats.AvgLatencyMs,
		LastFlushTime:       ts.stats.LastFlushTime,
	}
}

// GetAggregates returns current aggregate metrics
func (ts *TelemetrySynthesizer) GetAggregates() map[string]*AggregateMetric {
	ts.aggregateMu.RLock()
	defer ts.aggregateMu.RUnlock()

	// Return a copy
	result := make(map[string]*AggregateMetric, len(ts.aggregateData))
	for k, v := range ts.aggregateData {
		aggCopy := *v
		result[k] = &aggCopy
	}
	return result
}

// Close shuts down the synthesizer
func (ts *TelemetrySynthesizer) Close() error {
	ts.cancel()
	close(ts.buffer)
	return nil
}

// Helper methods

func (ts *TelemetrySynthesizer) extractString(data map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if val, ok := data[key].(string); ok {
			return val
		}
	}
	return "unknown"
}

func (ts *TelemetrySynthesizer) extractFloat(data map[string]interface{}, keys ...string) float64 {
	for _, key := range keys {
		if val, ok := data[key].(float64); ok {
			return val
		}
		if val, ok := data[key].(int); ok {
			return float64(val)
		}
		if val, ok := data[key].(int64); ok {
			return float64(val)
		}
	}
	return 0.0
}

func (ts *TelemetrySynthesizer) extractTimestamp(data map[string]interface{}, keys ...string) int64 {
	for _, key := range keys {
		if val, ok := data[key].(int64); ok {
			return val
		}
		if val, ok := data[key].(float64); ok {
			return int64(val)
		}
	}
	return time.Now().UnixMilli()
}

func (ts *TelemetrySynthesizer) updateIngestStats(latency time.Duration) {
	ts.stats.mu.Lock()
	defer ts.stats.mu.Unlock()

	ts.stats.TotalEventsIngested++
	latencyMs := float64(latency.Microseconds()) / 1000.0

	// Running average
	if ts.stats.AvgLatencyMs == 0 {
		ts.stats.AvgLatencyMs = latencyMs
	} else {
		ts.stats.AvgLatencyMs = (ts.stats.AvgLatencyMs*0.9 + latencyMs*0.1)
	}
}
