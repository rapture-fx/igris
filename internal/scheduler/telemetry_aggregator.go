// Package scheduler provides background jobs for telemetry aggregation
package scheduler

import (
	"context"
	"database/sql"
	"log"
	"sync"
	"time"
)

// TelemetryAggregator aggregates routing telemetry and updates provider health
type TelemetryAggregator struct {
	db       *sql.DB
	interval time.Duration
	ctx      context.Context
	cancel   context.CancelFunc
	wg       sync.WaitGroup
	logger   *log.Logger
	running  bool
	mu       sync.RWMutex
}

// TelemetryAggregatorConfig holds configuration for the telemetry aggregator
type TelemetryAggregatorConfig struct {
	Interval time.Duration // How often to aggregate (default: 10 minutes)
}

// DefaultTelemetryAggregatorConfig returns default configuration
func DefaultTelemetryAggregatorConfig() *TelemetryAggregatorConfig {
	return &TelemetryAggregatorConfig{
		Interval: 10 * time.Minute,
	}
}

// NewTelemetryAggregator creates a new telemetry aggregator
func NewTelemetryAggregator(db *sql.DB, config *TelemetryAggregatorConfig) *TelemetryAggregator {
	if config == nil {
		config = DefaultTelemetryAggregatorConfig()
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &TelemetryAggregator{
		db:       db,
		interval: config.Interval,
		ctx:      ctx,
		cancel:   cancel,
		logger:   log.Default(),
		running:  false,
	}
}

// Start starts the aggregation background job
func (a *TelemetryAggregator) Start() {
	a.mu.Lock()
	if a.running {
		a.mu.Unlock()
		a.logger.Println("[TelemetryAggregator] Already running")
		return
	}
	a.running = true
	a.mu.Unlock()

	a.logger.Printf("[TelemetryAggregator] Starting telemetry aggregator (interval: %v)", a.interval)

	a.wg.Add(1)
	go a.aggregationLoop()
}

// Stop stops the aggregation background job
func (a *TelemetryAggregator) Stop() {
	a.mu.Lock()
	if !a.running {
		a.mu.Unlock()
		a.logger.Println("[TelemetryAggregator] Not running")
		return
	}
	a.mu.Unlock()

	a.logger.Println("[TelemetryAggregator] Stopping telemetry aggregator...")
	a.cancel()
	a.wg.Wait()

	a.mu.Lock()
	a.running = false
	a.mu.Unlock()

	a.logger.Println("[TelemetryAggregator] Telemetry aggregator stopped")
}

// IsRunning returns whether the aggregator is currently running
func (a *TelemetryAggregator) IsRunning() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.running
}

// aggregationLoop is the main aggregation loop
func (a *TelemetryAggregator) aggregationLoop() {
	defer a.wg.Done()

	ticker := time.NewTicker(a.interval)
	defer ticker.Stop()

	// Run initial aggregation immediately
	a.aggregateMetrics()

	for {
		select {
		case <-a.ctx.Done():
			return
		case <-ticker.C:
			a.aggregateMetrics()
		}
	}
}

// aggregateMetrics aggregates telemetry and updates provider health
func (a *TelemetryAggregator) aggregateMetrics() {
	a.logger.Println("[TelemetryAggregator] Starting aggregation cycle...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	// Define aggregation window (last 10 minutes)
	windowEnd := time.Now()
	windowStart := windowEnd.Add(-a.interval)

	// Aggregate metrics per provider
	query := `
		INSERT INTO provider_performance_aggregates (
			provider_id, window_start, window_end,
			total_requests, successful_requests, failed_requests, success_rate,
			avg_latency_ms, p50_latency_ms, p95_latency_ms, p99_latency_ms, max_latency_ms,
			total_tokens_in, total_tokens_out, total_tokens,
			total_cost_usd, avg_cost_per_request_usd,
			is_degraded
		)
		SELECT
			provider_id,
			$1 as window_start,
			$2 as window_end,
			COUNT(*) as total_requests,
			COUNT(*) FILTER (WHERE success = true) as successful_requests,
			COUNT(*) FILTER (WHERE success = false) as failed_requests,
			ROUND((COUNT(*) FILTER (WHERE success = true)::DECIMAL / NULLIF(COUNT(*), 0) * 100), 2) as success_rate,
			ROUND(AVG(latency_ms) FILTER (WHERE success = true)) as avg_latency_ms,
			PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE success = true) as p50_latency_ms,
			PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE success = true) as p95_latency_ms,
			PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE success = true) as p99_latency_ms,
			MAX(latency_ms) FILTER (WHERE success = true) as max_latency_ms,
			SUM(tokens_in) as total_tokens_in,
			SUM(tokens_out) as total_tokens_out,
			SUM(total_tokens) as total_tokens,
			SUM(cost_usd) as total_cost_usd,
			AVG(cost_usd) as avg_cost_per_request_usd,
			(
				(COUNT(*) FILTER (WHERE success = true)::DECIMAL / NULLIF(COUNT(*), 0) * 100) < 80 OR
				AVG(latency_ms) FILTER (WHERE success = true) > 5000
			) as is_degraded
		FROM routing_telemetry
		WHERE created_at >= $1
		  AND created_at < $2
		  AND provider_id IS NOT NULL
		GROUP BY provider_id
		ON CONFLICT (provider_id, window_start, window_end) DO UPDATE
		SET
			total_requests = EXCLUDED.total_requests,
			successful_requests = EXCLUDED.successful_requests,
			failed_requests = EXCLUDED.failed_requests,
			success_rate = EXCLUDED.success_rate,
			avg_latency_ms = EXCLUDED.avg_latency_ms,
			p50_latency_ms = EXCLUDED.p50_latency_ms,
			p95_latency_ms = EXCLUDED.p95_latency_ms,
			p99_latency_ms = EXCLUDED.p99_latency_ms,
			max_latency_ms = EXCLUDED.max_latency_ms,
			total_tokens_in = EXCLUDED.total_tokens_in,
			total_tokens_out = EXCLUDED.total_tokens_out,
			total_tokens = EXCLUDED.total_tokens,
			total_cost_usd = EXCLUDED.total_cost_usd,
			avg_cost_per_request_usd = EXCLUDED.avg_cost_per_request_usd,
			is_degraded = EXCLUDED.is_degraded
	`

	result, err := a.db.ExecContext(ctx, query, windowStart, windowEnd)
	if err != nil {
		a.logger.Printf("[TelemetryAggregator] Failed to aggregate metrics: %v", err)
		return
	}

	rows, _ := result.RowsAffected()
	a.logger.Printf("[TelemetryAggregator] Aggregated metrics for %d providers", rows)

	// Update degraded providers status
	a.updateDegradedProviders(ctx)

	// Refresh provider leaderboard
	a.refreshLeaderboard(ctx)

	a.logger.Println("[TelemetryAggregator] Aggregation cycle complete")
}

// updateDegradedProviders marks providers as degraded if recent performance is poor
func (a *TelemetryAggregator) updateDegradedProviders(ctx context.Context) {
	// Get providers that are degraded in the last window
	query := `
		WITH recent_degraded AS (
			SELECT DISTINCT provider_id
			FROM provider_performance_aggregates
			WHERE window_end > NOW() - INTERVAL '30 minutes'
			  AND is_degraded = true
		)
		UPDATE provider_registry pr
		SET status = 'disabled'
		FROM recent_degraded rd
		WHERE pr.id = rd.provider_id
		  AND pr.status = 'active'
		RETURNING pr.id, pr.name
	`

	rows, err := a.db.QueryContext(ctx, query)
	if err != nil {
		a.logger.Printf("[TelemetryAggregator] Failed to update degraded providers: %v", err)
		return
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var providerID, providerName string
		if err := rows.Scan(&providerID, &providerName); err != nil {
			continue
		}
		a.logger.Printf("[TelemetryAggregator] Disabled degraded provider: %s (%s)", providerName, providerID)
		count++
	}

	if count > 0 {
		a.logger.Printf("[TelemetryAggregator] Disabled %d degraded providers", count)
	}
}

// refreshLeaderboard refreshes the provider leaderboard materialized view
func (a *TelemetryAggregator) refreshLeaderboard(ctx context.Context) {
	_, err := a.db.ExecContext(ctx, "SELECT refresh_provider_leaderboard()")
	if err != nil {
		a.logger.Printf("[TelemetryAggregator] Failed to refresh leaderboard: %v", err)
		return
	}

	a.logger.Println("[TelemetryAggregator] Refreshed provider leaderboard")
}

// TriggerAggregation manually triggers an aggregation (useful for testing)
func (a *TelemetryAggregator) TriggerAggregation() {
	a.logger.Println("[TelemetryAggregator] Manual aggregation triggered")
	go a.aggregateMetrics()
}
