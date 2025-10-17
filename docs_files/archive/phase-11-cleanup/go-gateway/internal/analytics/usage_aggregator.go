package analytics

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// UsageRecord represents a single API usage event
type UsageRecord struct {
	RecordID      string                 `json:"record_id"`
	Timestamp     time.Time              `json:"timestamp"`
	UserID        string                 `json:"user_id"`
	ModelID       string                 `json:"model_id"`
	ModelVersion  string                 `json:"model_version,omitempty"`
	Endpoint      string                 `json:"endpoint"`
	Method        string                 `json:"method"`
	StatusCode    int                    `json:"status_code"`
	LatencyMs     float64                `json:"latency_ms"`
	InputTokens   int                    `json:"input_tokens,omitempty"`
	OutputTokens  int                    `json:"output_tokens,omitempty"`
	CacheHit      bool                   `json:"cache_hit"`
	CostUSD       float64                `json:"cost_usd,omitempty"`
	Region        string                 `json:"region,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// UsageStats tracks aggregated usage statistics
type UsageStats struct {
	ModelID         string
	TotalRequests   int64
	SuccessRequests int64
	FailedRequests  int64
	TotalLatencyMs  float64
	AvgLatencyMs    float64
	P50LatencyMs    float64
	P95LatencyMs    float64
	P99LatencyMs    float64
	TotalCostUSD    float64
	AvgCostUSD      float64
	CacheHitRate    float64
	TotalCacheHits  int64
	TotalCacheMisses int64
	TotalInputTokens int64
	TotalOutputTokens int64
	UniqueUsers     int
	LastUpdated     time.Time
	LatencyHistory  []float64 // For percentile calculation
}

// UserUsageStats tracks per-user usage statistics
type UserUsageStats struct {
	UserID          string
	TotalRequests   int64
	TotalCostUSD    float64
	ModelsUsed      map[string]int64
	LastRequestTime time.Time
}

// UsageAggregator manages usage tracking and aggregation
type UsageAggregator struct {
	usageStore    map[string]*UsageRecord
	modelStats    map[string]*UsageStats
	userStats     map[string]*UserUsageStats
	storeMutex    sync.RWMutex
	modelMutex    sync.RWMutex
	userMutex     sync.RWMutex

	// Metrics
	usageTotal    *prometheus.CounterVec
	latencyHist   *prometheus.HistogramVec
	costTotal     *prometheus.CounterVec
	cacheHitRate  *prometheus.GaugeVec
	activeUsers   *prometheus.GaugeVec
}

// NewUsageAggregator creates a new usage aggregator
func NewUsageAggregator() *UsageAggregator {
	return &UsageAggregator{
		usageStore: make(map[string]*UsageRecord),
		modelStats: make(map[string]*UsageStats),
		userStats:  make(map[string]*UserUsageStats),
		usageTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "usage_requests_total",
				Help: "Total API requests by model and status",
			},
			[]string{"model_id", "status"},
		),
		latencyHist: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "usage_latency_ms",
				Help:    "Request latency distribution",
				Buckets: []float64{10, 25, 50, 75, 100, 150, 200, 300, 500, 1000},
			},
			[]string{"model_id"},
		),
		costTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "usage_cost_usd_total",
				Help: "Total cost in USD by model",
			},
			[]string{"model_id"},
		),
		cacheHitRate: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "usage_cache_hit_rate",
				Help: "Cache hit rate by model",
			},
			[]string{"model_id"},
		),
		activeUsers: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "usage_active_users",
				Help: "Number of active users by model",
			},
			[]string{"model_id"},
		),
	}
}

// RecordUsage records a usage event
func (ua *UsageAggregator) RecordUsage(ctx context.Context, record *UsageRecord) error {
	if record.RecordID == "" {
		record.RecordID = generateRecordID()
	}

	if record.Timestamp.IsZero() {
		record.Timestamp = time.Now()
	}

	// Validate record
	if err := ua.validateRecord(record); err != nil {
		return fmt.Errorf("invalid usage record: %w", err)
	}

	// Store record
	ua.storeMutex.Lock()
	ua.usageStore[record.RecordID] = record
	ua.storeMutex.Unlock()

	// Update model statistics
	ua.updateModelStats(record)

	// Update user statistics
	ua.updateUserStats(record)

	// Record Prometheus metrics
	status := "success"
	if record.StatusCode >= 400 {
		status = "error"
	}
	ua.usageTotal.WithLabelValues(record.ModelID, status).Inc()
	ua.latencyHist.WithLabelValues(record.ModelID).Observe(record.LatencyMs)
	if record.CostUSD > 0 {
		ua.costTotal.WithLabelValues(record.ModelID).Add(record.CostUSD)
	}

	return nil
}

// GetModelStats retrieves aggregated statistics for a model
func (ua *UsageAggregator) GetModelStats(modelID string) (*UsageStats, bool) {
	ua.modelMutex.RLock()
	defer ua.modelMutex.RUnlock()

	stats, exists := ua.modelStats[modelID]
	return stats, exists
}

// GetUserStats retrieves usage statistics for a user
func (ua *UsageAggregator) GetUserStats(userID string) (*UserUsageStats, bool) {
	ua.userMutex.RLock()
	defer ua.userMutex.RUnlock()

	stats, exists := ua.userStats[userID]
	return stats, exists
}

// GetAllModelStats retrieves all model statistics
func (ua *UsageAggregator) GetAllModelStats() map[string]*UsageStats {
	ua.modelMutex.RLock()
	defer ua.modelMutex.RUnlock()

	statsCopy := make(map[string]*UsageStats)
	for k, v := range ua.modelStats {
		statsCopy[k] = v
	}
	return statsCopy
}

// validateRecord validates usage record
func (ua *UsageAggregator) validateRecord(record *UsageRecord) error {
	if record.ModelID == "" {
		return fmt.Errorf("model_id is required")
	}

	if record.UserID == "" {
		return fmt.Errorf("user_id is required")
	}

	if record.LatencyMs < 0 {
		return fmt.Errorf("latency_ms cannot be negative")
	}

	return nil
}

// updateModelStats updates aggregated model statistics
func (ua *UsageAggregator) updateModelStats(record *UsageRecord) {
	ua.modelMutex.Lock()
	defer ua.modelMutex.Unlock()

	stats, exists := ua.modelStats[record.ModelID]
	if !exists {
		stats = &UsageStats{
			ModelID:        record.ModelID,
			LatencyHistory: make([]float64, 0, 1000),
		}
		ua.modelStats[record.ModelID] = stats
	}

	stats.TotalRequests++

	if record.StatusCode < 400 {
		stats.SuccessRequests++
	} else {
		stats.FailedRequests++
	}

	// Update latency
	stats.TotalLatencyMs += record.LatencyMs
	stats.AvgLatencyMs = stats.TotalLatencyMs / float64(stats.TotalRequests)

	// Update latency history (sliding window)
	stats.LatencyHistory = append(stats.LatencyHistory, record.LatencyMs)
	if len(stats.LatencyHistory) > 1000 {
		stats.LatencyHistory = stats.LatencyHistory[1:]
	}

	// Calculate percentiles
	stats.P50LatencyMs = calculatePercentile(stats.LatencyHistory, 0.50)
	stats.P95LatencyMs = calculatePercentile(stats.LatencyHistory, 0.95)
	stats.P99LatencyMs = calculatePercentile(stats.LatencyHistory, 0.99)

	// Update cost
	if record.CostUSD > 0 {
		stats.TotalCostUSD += record.CostUSD
		stats.AvgCostUSD = stats.TotalCostUSD / float64(stats.TotalRequests)
	}

	// Update cache hit rate
	if record.CacheHit {
		stats.TotalCacheHits++
	} else {
		stats.TotalCacheMisses++
	}

	if stats.TotalCacheHits+stats.TotalCacheMisses > 0 {
		stats.CacheHitRate = float64(stats.TotalCacheHits) / float64(stats.TotalCacheHits+stats.TotalCacheMisses)
		ua.cacheHitRate.WithLabelValues(record.ModelID).Set(stats.CacheHitRate)
	}

	// Update token counts
	stats.TotalInputTokens += int64(record.InputTokens)
	stats.TotalOutputTokens += int64(record.OutputTokens)

	stats.LastUpdated = time.Now()
}

// updateUserStats updates per-user statistics
func (ua *UsageAggregator) updateUserStats(record *UsageRecord) {
	ua.userMutex.Lock()
	defer ua.userMutex.Unlock()

	stats, exists := ua.userStats[record.UserID]
	if !exists {
		stats = &UserUsageStats{
			UserID:     record.UserID,
			ModelsUsed: make(map[string]int64),
		}
		ua.userStats[record.UserID] = stats
	}

	stats.TotalRequests++
	stats.TotalCostUSD += record.CostUSD
	stats.ModelsUsed[record.ModelID]++
	stats.LastRequestTime = record.Timestamp
}

// GenerateReport generates comprehensive usage report
func (ua *UsageAggregator) GenerateReport() map[string]interface{} {
	ua.modelMutex.RLock()
	defer ua.modelMutex.RUnlock()

	ua.userMutex.RLock()
	defer ua.userMutex.RUnlock()

	report := make(map[string]interface{})
	report["timestamp"] = time.Now()
	report["total_models"] = len(ua.modelStats)
	report["total_users"] = len(ua.userStats)

	var totalRequests int64
	var totalCost float64
	var avgCacheHitRate float64

	models := make([]map[string]interface{}, 0)

	for modelID, stats := range ua.modelStats {
		modelReport := map[string]interface{}{
			"model_id":          modelID,
			"total_requests":    stats.TotalRequests,
			"success_requests":  stats.SuccessRequests,
			"failed_requests":   stats.FailedRequests,
			"success_rate":      float64(stats.SuccessRequests) / float64(stats.TotalRequests),
			"avg_latency_ms":    stats.AvgLatencyMs,
			"p50_latency_ms":    stats.P50LatencyMs,
			"p95_latency_ms":    stats.P95LatencyMs,
			"p99_latency_ms":    stats.P99LatencyMs,
			"total_cost_usd":    stats.TotalCostUSD,
			"avg_cost_usd":      stats.AvgCostUSD,
			"cache_hit_rate":    stats.CacheHitRate,
			"total_input_tokens":  stats.TotalInputTokens,
			"total_output_tokens": stats.TotalOutputTokens,
			"unique_users":      stats.UniqueUsers,
			"last_updated":      stats.LastUpdated,
		}

		models = append(models, modelReport)
		totalRequests += stats.TotalRequests
		totalCost += stats.TotalCostUSD
		avgCacheHitRate += stats.CacheHitRate
	}

	if len(ua.modelStats) > 0 {
		avgCacheHitRate /= float64(len(ua.modelStats))
	}

	report["total_requests"] = totalRequests
	report["total_cost_usd"] = totalCost
	report["average_cache_hit_rate"] = avgCacheHitRate
	report["models"] = models

	return report
}

// ExportUsageData exports usage data for a time range
func (ua *UsageAggregator) ExportUsageData(modelID string, startTime, endTime time.Time) ([]*UsageRecord, error) {
	ua.storeMutex.RLock()
	defer ua.storeMutex.RUnlock()

	var records []*UsageRecord

	for _, record := range ua.usageStore {
		if (modelID == "" || record.ModelID == modelID) &&
			record.Timestamp.After(startTime) &&
			record.Timestamp.Before(endTime) {
			records = append(records, record)
		}
	}

	return records, nil
}

// ExportUsageJSON exports usage data as JSON
func (ua *UsageAggregator) ExportUsageJSON(modelID string, startTime, endTime time.Time) ([]byte, error) {
	records, err := ua.ExportUsageData(modelID, startTime, endTime)
	if err != nil {
		return nil, err
	}

	return json.MarshalIndent(records, "", "  ")
}

// PurgeUsageData removes usage data older than the specified duration
func (ua *UsageAggregator) PurgeUsageData(olderThan time.Duration) int {
	ua.storeMutex.Lock()
	defer ua.storeMutex.Unlock()

	cutoff := time.Now().Add(-olderThan)
	purged := 0

	for id, record := range ua.usageStore {
		if record.Timestamp.Before(cutoff) {
			delete(ua.usageStore, id)
			purged++
		}
	}

	return purged
}

// calculatePercentile computes the p-th percentile
func calculatePercentile(values []float64, p float64) float64 {
	if len(values) == 0 {
		return 0
	}

	// Create sorted copy
	sorted := make([]float64, len(values))
	copy(sorted, values)

	// Simple selection sort for small datasets
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[j] < sorted[i] {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	index := int(float64(len(sorted)) * p)
	if index >= len(sorted) {
		index = len(sorted) - 1
	}

	return sorted[index]
}

// generateRecordID generates a unique record ID
func generateRecordID() string {
	return fmt.Sprintf("ur_%d", time.Now().UnixNano())
}
