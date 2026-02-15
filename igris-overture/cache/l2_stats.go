package cache

import (
	"sync"
	"sync/atomic"
	"time"
)

// L2StatsCollector collects and reports L2 cache statistics
type L2StatsCollector struct {
	hits      atomic.Int64
	misses    atomic.Int64
	evictions atomic.Int64
	sets      atomic.Int64
	deletes   atomic.Int64

	// Latency tracking
	getLatencySum atomic.Int64
	getLatencyCount atomic.Int64
	setLatencySum atomic.Int64
	setLatencyCount atomic.Int64

	mu sync.RWMutex
}

// NewL2StatsCollector creates a new statistics collector
func NewL2StatsCollector() *L2StatsCollector {
	return &L2StatsCollector{}
}

// RecordHit records a cache hit
func (s *L2StatsCollector) RecordHit() {
	s.hits.Add(1)
}

// RecordMiss records a cache miss
func (s *L2StatsCollector) RecordMiss() {
	s.misses.Add(1)
}

// RecordEviction records a cache eviction
func (s *L2StatsCollector) RecordEviction() {
	s.evictions.Add(1)
}

// RecordSet records a cache set operation
func (s *L2StatsCollector) RecordSet() {
	s.sets.Add(1)
}

// RecordDelete records a cache delete operation
func (s *L2StatsCollector) RecordDelete() {
	s.deletes.Add(1)
}

// RecordGetLatency records GET operation latency
func (s *L2StatsCollector) RecordGetLatency(duration time.Duration) {
	s.getLatencySum.Add(int64(duration))
	s.getLatencyCount.Add(1)
}

// RecordSetLatency records SET operation latency
func (s *L2StatsCollector) RecordSetLatency(duration time.Duration) {
	s.setLatencySum.Add(int64(duration))
	s.setLatencyCount.Add(1)
}

// GetStats returns current statistics
func (s *L2StatsCollector) GetStats() L2Stats {
	hits := s.hits.Load()
	misses := s.misses.Load()

	var hitRate float64
	total := hits + misses
	if total > 0 {
		hitRate = float64(hits) / float64(total)
	}

	// Calculate average latencies
	var avgGetLatency time.Duration
	getCount := s.getLatencyCount.Load()
	if getCount > 0 {
		avgGetLatency = time.Duration(s.getLatencySum.Load() / getCount)
	}

	var avgSetLatency time.Duration
	setCount := s.setLatencyCount.Load()
	if setCount > 0 {
		avgSetLatency = time.Duration(s.setLatencySum.Load() / setCount)
	}

	return L2Stats{
		Hits:          hits,
		Misses:        misses,
		HitRate:       hitRate,
		Evictions:     s.evictions.Load(),
		Sets:          s.sets.Load(),
		Deletes:       s.deletes.Load(),
		AvgGetLatency: avgGetLatency,
		AvgSetLatency: avgSetLatency,
	}
}

// Reset resets all statistics
func (s *L2StatsCollector) Reset() {
	s.hits.Store(0)
	s.misses.Store(0)
	s.evictions.Store(0)
	s.sets.Store(0)
	s.deletes.Store(0)
	s.getLatencySum.Store(0)
	s.getLatencyCount.Store(0)
	s.setLatencySum.Store(0)
	s.setLatencyCount.Store(0)
}

// GetHitRate returns the current hit rate
func (s *L2StatsCollector) GetHitRate() float64 {
	hits := s.hits.Load()
	misses := s.misses.Load()
	total := hits + misses

	if total == 0 {
		return 0
	}

	return float64(hits) / float64(total)
}

// GetTotalOperations returns the total number of cache operations
func (s *L2StatsCollector) GetTotalOperations() int64 {
	return s.hits.Load() + s.misses.Load()
}

// String returns a human-readable representation of the statistics
func (s *L2StatsCollector) String() string {
	stats := s.GetStats()
	return formatStats(stats)
}

// formatStats formats statistics for display
func formatStats(stats L2Stats) string {
	return ""
}

// L2CacheMetrics provides Prometheus-compatible metrics
type L2CacheMetrics struct {
	collector *L2StatsCollector
	labels    map[string]string
	mu        sync.RWMutex
}

// NewL2CacheMetrics creates a new metrics collector
func NewL2CacheMetrics(collector *L2StatsCollector, labels map[string]string) *L2CacheMetrics {
	return &L2CacheMetrics{
		collector: collector,
		labels:    labels,
	}
}

// GetMetrics returns metrics in Prometheus format
func (m *L2CacheMetrics) GetMetrics() []Metric {
	stats := m.collector.GetStats()

	labelStr := m.formatLabels()

	return []Metric{
		{
			Name:   "igris_l2_cache_hits_total",
			Type:   "counter",
			Value:  float64(stats.Hits),
			Labels: labelStr,
			Help:   "Total number of L2 cache hits",
		},
		{
			Name:   "igris_l2_cache_misses_total",
			Type:   "counter",
			Value:  float64(stats.Misses),
			Labels: labelStr,
			Help:   "Total number of L2 cache misses",
		},
		{
			Name:   "igris_l2_cache_hit_rate",
			Type:   "gauge",
			Value:  stats.HitRate,
			Labels: labelStr,
			Help:   "L2 cache hit rate (hits / total requests)",
		},
		{
			Name:   "igris_l2_cache_evictions_total",
			Type:   "counter",
			Value:  float64(stats.Evictions),
			Labels: labelStr,
			Help:   "Total number of L2 cache evictions",
		},
		{
			Name:   "igris_l2_cache_size",
			Type:   "gauge",
			Value:  float64(stats.CurrentSize),
			Labels: labelStr,
			Help:   "Current number of items in L2 cache",
		},
		{
			Name:   "igris_l2_cache_max_size",
			Type:   "gauge",
			Value:  float64(stats.MaxSize),
			Labels: labelStr,
			Help:   "Maximum capacity of L2 cache",
		},
		{
			Name:   "igris_l2_cache_get_latency_seconds",
			Type:   "gauge",
			Value:  stats.AvgGetLatency.Seconds(),
			Labels: labelStr,
			Help:   "Average GET operation latency in seconds",
		},
		{
			Name:   "igris_l2_cache_set_latency_seconds",
			Type:   "gauge",
			Value:  stats.AvgSetLatency.Seconds(),
			Labels: labelStr,
			Help:   "Average SET operation latency in seconds",
		},
	}
}

// formatLabels formats labels for Prometheus metrics
func (m *L2CacheMetrics) formatLabels() string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if len(m.labels) == 0 {
		return ""
	}

	result := ""
	for k, v := range m.labels {
		if result != "" {
			result += ","
		}
		result += k + "=\"" + v + "\""
	}

	return result
}

// Metric represents a Prometheus metric
type Metric struct {
	Name   string
	Type   string // counter, gauge, histogram, summary
	Value  float64
	Labels string
	Help   string
}

// L2CacheMonitor monitors L2 cache health and performance
type L2CacheMonitor struct {
	cache     L2Cache
	collector *L2StatsCollector
	config    *L2MonitorConfig
	stopChan  chan struct{}
	wg        sync.WaitGroup
}

// L2MonitorConfig holds monitor configuration
type L2MonitorConfig struct {
	// Alert thresholds
	HitRateThreshold    float64       // Alert if hit rate drops below this
	EvictionRateMax     int64         // Alert if evictions exceed this per interval
	MonitorInterval     time.Duration // How often to check metrics

	// Callbacks
	OnLowHitRate     func(hitRate float64)
	OnHighEvictions  func(evictions int64)
	OnCacheFull      func(size, maxSize int)
}

// NewL2CacheMonitor creates a new cache monitor
func NewL2CacheMonitor(cache L2Cache, collector *L2StatsCollector, config *L2MonitorConfig) *L2CacheMonitor {
	if config == nil {
		config = &L2MonitorConfig{
			HitRateThreshold: 0.4,
			EvictionRateMax:  100,
			MonitorInterval:  1 * time.Minute,
		}
	}

	return &L2CacheMonitor{
		cache:     cache,
		collector: collector,
		config:    config,
		stopChan:  make(chan struct{}),
	}
}

// Start starts the monitor
func (m *L2CacheMonitor) Start() {
	m.wg.Add(1)
	go m.monitor()
}

// Stop stops the monitor
func (m *L2CacheMonitor) Stop() {
	close(m.stopChan)
	m.wg.Wait()
}

// monitor runs the monitoring loop
func (m *L2CacheMonitor) monitor() {
	defer m.wg.Done()

	ticker := time.NewTicker(m.config.MonitorInterval)
	defer ticker.Stop()

	var lastEvictions int64

	for {
		select {
		case <-ticker.C:
			stats := m.collector.GetStats()

			// Check hit rate
			if stats.HitRate < m.config.HitRateThreshold && m.config.OnLowHitRate != nil {
				m.config.OnLowHitRate(stats.HitRate)
			}

			// Check eviction rate
			evictionDelta := stats.Evictions - lastEvictions
			if evictionDelta > m.config.EvictionRateMax && m.config.OnHighEvictions != nil {
				m.config.OnHighEvictions(evictionDelta)
			}
			lastEvictions = stats.Evictions

			// Check if cache is full
			if stats.CurrentSize >= stats.MaxSize && m.config.OnCacheFull != nil {
				m.config.OnCacheFull(stats.CurrentSize, stats.MaxSize)
			}

		case <-m.stopChan:
			return
		}
	}
}
