package cache

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// PrometheusMetricsExporter exports cache metrics in Prometheus format
type PrometheusMetricsExporter struct {
	cache *MultiTierCache
	mu    sync.RWMutex
}

// NewPrometheusMetricsExporter creates a new Prometheus metrics exporter
func NewPrometheusMetricsExporter(cache *MultiTierCache) *PrometheusMetricsExporter {
	return &PrometheusMetricsExporter{
		cache: cache,
	}
}

// ExportMetrics returns cache metrics in Prometheus exposition format
func (pme *PrometheusMetricsExporter) ExportMetrics(ctx context.Context) (string, error) {
	pme.mu.RLock()
	defer pme.mu.RUnlock()

	stats, err := pme.cache.GetStats(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get cache stats: %w", err)
	}

	timestamp := time.Now().Unix()
	var output string

	// Overall metrics
	if overall, ok := stats["overall"].(map[string]interface{}); ok {
		output += "# HELP cache_requests_total Total number of cache requests\n"
		output += "# TYPE cache_requests_total counter\n"
		output += fmt.Sprintf("cache_requests_total %v %d\n",
			overall["total_requests"], timestamp)

		output += "# HELP cache_hits_total Total number of cache hits\n"
		output += "# TYPE cache_hits_total counter\n"
		output += fmt.Sprintf("cache_hits_total %v %d\n",
			overall["total_hits"], timestamp)

		output += "# HELP cache_misses_total Total number of cache misses\n"
		output += "# TYPE cache_misses_total counter\n"
		output += fmt.Sprintf("cache_misses_total %v %d\n",
			overall["total_misses"], timestamp)

		output += "# HELP cache_hit_ratio Current cache hit ratio (0.0-1.0)\n"
		output += "# TYPE cache_hit_ratio gauge\n"
		output += fmt.Sprintf("cache_hit_ratio %.4f %d\n",
			overall["overall_hit_ratio"], timestamp)

		output += "# HELP cache_miss_rate Current cache miss rate (0.0-1.0)\n"
		output += "# TYPE cache_miss_rate gauge\n"
		output += fmt.Sprintf("cache_miss_rate %.4f %d\n",
			overall["cache_miss_rate"], timestamp)
	}

	// L1 (LRU) metrics
	if l1Stats, ok := stats["l1_lru"].(map[string]interface{}); ok {
		output += "\n# L1 (LRU) Cache Metrics\n"

		output += "# HELP cache_l1_entry_count Current number of entries in L1 cache\n"
		output += "# TYPE cache_l1_entry_count gauge\n"
		output += fmt.Sprintf("cache_l1_entry_count %v %d\n",
			l1Stats["size"], timestamp)

		output += "# HELP cache_l1_capacity Maximum capacity of L1 cache\n"
		output += "# TYPE cache_l1_capacity gauge\n"
		output += fmt.Sprintf("cache_l1_capacity %v %d\n",
			l1Stats["capacity"], timestamp)

		output += "# HELP cache_l1_hits_total Total number of L1 cache hits\n"
		output += "# TYPE cache_l1_hits_total counter\n"
		output += fmt.Sprintf("cache_l1_hits_total %v %d\n",
			l1Stats["tier_hits"], timestamp)

		output += "# HELP cache_l1_misses_total Total number of L1 cache misses\n"
		output += "# TYPE cache_l1_misses_total counter\n"
		output += fmt.Sprintf("cache_l1_misses_total %v %d\n",
			l1Stats["tier_misses"], timestamp)

		output += "# HELP cache_l1_evictions_total Total number of L1 cache evictions\n"
		output += "# TYPE cache_l1_evictions_total counter\n"
		output += fmt.Sprintf("cache_l1_evictions_total %v %d\n",
			l1Stats["evictions"], timestamp)

		output += "# HELP cache_l1_expirations_total Total number of L1 cache expirations\n"
		output += "# TYPE cache_l1_expirations_total counter\n"
		output += fmt.Sprintf("cache_l1_expirations_total %v %d\n",
			l1Stats["expirations"], timestamp)

		output += "# HELP cache_l1_hit_ratio L1 cache hit ratio (0.0-1.0)\n"
		output += "# TYPE cache_l1_hit_ratio gauge\n"
		output += fmt.Sprintf("cache_l1_hit_ratio %.4f %d\n",
			l1Stats["tier_hit_ratio"], timestamp)

		output += "# HELP cache_l1_utilization L1 cache utilization (0.0-1.0)\n"
		output += "# TYPE cache_l1_utilization gauge\n"
		output += fmt.Sprintf("cache_l1_utilization %.4f %d\n",
			l1Stats["utilization"], timestamp)
	}

	// L2 (Redis) metrics
	if l2Stats, ok := stats["l2_redis"].(map[string]interface{}); ok {
		output += "\n# L2 (Redis) Cache Metrics\n"

		output += "# HELP cache_l2_hits_total Total number of L2 cache hits\n"
		output += "# TYPE cache_l2_hits_total counter\n"
		output += fmt.Sprintf("cache_l2_hits_total %v %d\n",
			l2Stats["tier_hits"], timestamp)

		output += "# HELP cache_l2_misses_total Total number of L2 cache misses\n"
		output += "# TYPE cache_l2_misses_total counter\n"
		output += fmt.Sprintf("cache_l2_misses_total %v %d\n",
			l2Stats["tier_misses"], timestamp)

		output += "# HELP cache_l2_hit_ratio L2 cache hit ratio (0.0-1.0)\n"
		output += "# TYPE cache_l2_hit_ratio gauge\n"
		output += fmt.Sprintf("cache_l2_hit_ratio %.4f %d\n",
			l2Stats["tier_hit_ratio"], timestamp)

		if dbSize, ok := l2Stats["db_size"]; ok {
			output += "# HELP cache_l2_db_size Number of keys in Redis database\n"
			output += "# TYPE cache_l2_db_size gauge\n"
			output += fmt.Sprintf("cache_l2_db_size %v %d\n", dbSize, timestamp)
		}

		if ttlSec, ok := l2Stats["ttl_sec"]; ok {
			output += "# HELP cache_l2_ttl_seconds TTL for L2 cache entries in seconds\n"
			output += "# TYPE cache_l2_ttl_seconds gauge\n"
			output += fmt.Sprintf("cache_l2_ttl_seconds %v %d\n", ttlSec, timestamp)
		}
	}

	return output, nil
}

// ExportMetricsJSON returns cache metrics in JSON format
func (pme *PrometheusMetricsExporter) ExportMetricsJSON(ctx context.Context) (map[string]interface{}, error) {
	return pme.cache.GetStats(ctx)
}
