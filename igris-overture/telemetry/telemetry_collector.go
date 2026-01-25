// Package telemetry provides request telemetry collection and storage
package telemetry

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/Igris-inertial/system/igris-overture/adapters"
	"github.com/Igris-inertial/system/igris-overture/logging"
	"github.com/Igris-inertial/system/igris-overture/metrics"
	"github.com/Igris-inertial/system/igris-overture/models"
	"github.com/Igris-inertial/system/igris-overture/routing"
)

// TelemetryCollector collects and stores routing telemetry
type TelemetryCollector struct {
	db            *sql.DB
	logger        *log.Logger
	telemetryQueue chan *RoutingTelemetry
	workerWg      sync.WaitGroup
	ctx           context.Context
	cancel        context.CancelFunc
}

// NewTelemetryCollector creates a new telemetry collector with async worker pool
func NewTelemetryCollector(db *sql.DB) *TelemetryCollector {
	ctx, cancel := context.WithCancel(context.Background())

	tc := &TelemetryCollector{
		db:            db,
		logger:        log.Default(),
		telemetryQueue: make(chan *RoutingTelemetry, 10000), // 10,000 item buffer
		ctx:           ctx,
		cancel:        cancel,
	}

	// Start 10 worker goroutines for async processing
	for i := 0; i < 10; i++ {
		tc.workerWg.Add(1)
		go tc.telemetryWorker(i)
	}

	tc.logger.Printf("[TelemetryCollector] Started 10 async workers with 10,000 item buffer")

	return tc
}

// telemetryWorker processes telemetry records from the queue
func (tc *TelemetryCollector) telemetryWorker(id int) {
	defer tc.workerWg.Done()

	for {
		select {
		case <-tc.ctx.Done():
			tc.logger.Printf("[TelemetryCollector] Worker %d shutting down", id)
			return
		case telemetry := <-tc.telemetryQueue:
			// Skip if database is not available
			if tc.db == nil {
				continue
			}

			// Record telemetry with timeout
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			if err := tc.recordTelemetrySync(ctx, telemetry); err != nil {
				tc.logger.Printf("[TelemetryCollector] Worker %d failed to record telemetry: %v", id, logging.SanitizeError(err))
				metrics.TelemetryErrors.Inc()
			} else {
				metrics.TelemetryRecorded.Inc()
			}
			cancel()
		}
	}
}

// Stop gracefully stops the telemetry collector and flushes the queue
func (tc *TelemetryCollector) Stop() {
	tc.logger.Println("[TelemetryCollector] Stopping telemetry collector...")

	// Stop accepting new telemetry
	tc.cancel()

	// Wait for queue to drain with timeout
	done := make(chan struct{})
	go func() {
		// Process remaining items in queue
		remaining := len(tc.telemetryQueue)
		if remaining > 0 {
			tc.logger.Printf("[TelemetryCollector] Flushing %d remaining telemetry records...", remaining)
		}

		// Wait for workers to finish
		tc.workerWg.Wait()
		close(done)
	}()

	// Wait up to 30 seconds for flush
	select {
	case <-done:
		tc.logger.Println("[TelemetryCollector] ✅ Telemetry collector stopped cleanly")
	case <-time.After(30 * time.Second):
		dropped := len(tc.telemetryQueue)
		tc.logger.Printf("[TelemetryCollector] ⚠️  Shutdown timeout - %d records may be lost", dropped)
		metrics.TelemetryDropped.Add(float64(dropped))
	}

	close(tc.telemetryQueue)
}

// RoutingTelemetry represents telemetry data for a routed request
type RoutingTelemetry struct {
	TenantID        string
	TraceID         uuid.UUID
	ProviderID      *string
	ProviderName    string
	Model           string
	LatencyMs       int
	TokensIn        *int
	TokensOut       *int
	Success         bool
	StatusCode      *int
	ErrorMessage    *string
	CostUSD         *float64
	FallbackCount   int
	SelectionReason string
}

// RecordTelemetry queues routing telemetry for async recording
// This method is non-blocking and returns immediately
func (tc *TelemetryCollector) RecordTelemetry(ctx context.Context, telemetry *RoutingTelemetry) error {
	select {
	case tc.telemetryQueue <- telemetry:
		// Successfully queued
		return nil
	default:
		// Queue is full - drop telemetry and increment metric
		metrics.TelemetryDropped.Inc()
		tc.logger.Printf("[TelemetryCollector] ⚠️  Telemetry queue full - dropping record for tenant %s", telemetry.TenantID)
		return fmt.Errorf("telemetry queue full - record dropped")
	}
}

// recordTelemetrySync synchronously records telemetry to the database
// This is called by worker goroutines
func (tc *TelemetryCollector) recordTelemetrySync(ctx context.Context, telemetry *RoutingTelemetry) error {
	// Use the stored procedure for efficient insertion and health update
	query := `
		SELECT record_routing_telemetry($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`

	var telemetryID string
	err := tc.db.QueryRowContext(ctx, query,
		telemetry.TenantID,
		telemetry.TraceID,
		telemetry.ProviderID,
		telemetry.ProviderName,
		telemetry.Model,
		telemetry.LatencyMs,
		telemetry.TokensIn,
		telemetry.TokensOut,
		telemetry.Success,
		telemetry.StatusCode,
		telemetry.ErrorMessage,
		telemetry.CostUSD,
		telemetry.FallbackCount,
		telemetry.SelectionReason,
	).Scan(&telemetryID)

	if err != nil {
		return fmt.Errorf("failed to record telemetry: %w", err)
	}

	providerID := "none"
	if telemetry.ProviderID != nil {
		providerID = logging.MaskProviderID(*telemetry.ProviderID)
	}
	tc.logger.Printf("[TelemetryCollector] Recorded telemetry: id=%s, provider=%s, provider_id=%s, latency=%dms, success=%v",
		telemetryID, telemetry.ProviderName, providerID, telemetry.LatencyMs, telemetry.Success)

	return nil
}

// RecordFromAdapterResult creates telemetry from an adapter result
func (tc *TelemetryCollector) RecordFromAdapterResult(
	ctx context.Context,
	tenantID string,
	traceID uuid.UUID,
	provider *models.ProviderRegistry,
	request *adapters.ChatCompletionRequest,
	result *adapters.AdapterResult,
	fallbackCount int,
	selectionReason routing.SelectionReason,
) error {
	telemetry := &RoutingTelemetry{
		TenantID:        tenantID,
		TraceID:         traceID,
		ProviderID:      &provider.ID,
		ProviderName:    provider.Name,
		Model:           request.Model,
		LatencyMs:       result.LatencyMs,
		Success:         result.Success,
		FallbackCount:   fallbackCount,
		SelectionReason: string(selectionReason),
	}

	// Add status code if available
	if result.StatusCode > 0 {
		telemetry.StatusCode = &result.StatusCode
	}

	// Add error message if failed
	if !result.Success && result.Error != nil {
		errorMsg := result.Error.Error()
		telemetry.ErrorMessage = &errorMsg
	}

	// Add token counts if successful
	if result.Success && result.Response != nil {
		tokensIn := result.Response.Usage.PromptTokens
		tokensOut := result.Response.Usage.CompletionTokens
		telemetry.TokensIn = &tokensIn
		telemetry.TokensOut = &tokensOut

		// Estimate cost
		cost := (float64(tokensIn) * provider.Pricing.Input) + (float64(tokensOut) * provider.Pricing.Output)
		telemetry.CostUSD = &cost
	}

	return tc.RecordTelemetry(ctx, telemetry)
}

// GetTenantUsage retrieves usage statistics for a tenant
func (tc *TelemetryCollector) GetTenantUsage(ctx context.Context, tenantID string, hours int) (map[string]interface{}, error) {
	query := `
		SELECT
			COUNT(*) as total_requests,
			COUNT(*) FILTER (WHERE success = true) as successful_requests,
			COUNT(*) FILTER (WHERE success = false) as failed_requests,
			ROUND(AVG(latency_ms)) as avg_latency_ms,
			SUM(tokens_in) as total_tokens_in,
			SUM(tokens_out) as total_tokens_out,
			SUM(total_tokens) as total_tokens,
			SUM(cost_usd) as total_cost_usd,
			COUNT(DISTINCT provider_name) as unique_providers_used
		FROM routing_telemetry
		WHERE tenant_id = $1
		  AND created_at > NOW() - INTERVAL '1 hour' * $2
	`

	var stats struct {
		TotalRequests       int
		SuccessfulRequests  int
		FailedRequests      int
		AvgLatencyMs        sql.NullInt64
		TotalTokensIn       sql.NullInt64
		TotalTokensOut      sql.NullInt64
		TotalTokens         sql.NullInt64
		TotalCostUSD        sql.NullFloat64
		UniqueProvidersUsed int
	}

	err := tc.db.QueryRowContext(ctx, query, tenantID, hours).Scan(
		&stats.TotalRequests,
		&stats.SuccessfulRequests,
		&stats.FailedRequests,
		&stats.AvgLatencyMs,
		&stats.TotalTokensIn,
		&stats.TotalTokensOut,
		&stats.TotalTokens,
		&stats.TotalCostUSD,
		&stats.UniqueProvidersUsed,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get tenant usage: %w", err)
	}

	successRate := 0.0
	if stats.TotalRequests > 0 {
		successRate = (float64(stats.SuccessfulRequests) / float64(stats.TotalRequests)) * 100.0
	}

	return map[string]interface{}{
		"time_window_hours":     hours,
		"total_requests":        stats.TotalRequests,
		"successful_requests":   stats.SuccessfulRequests,
		"failed_requests":       stats.FailedRequests,
		"success_rate_percent":  successRate,
		"avg_latency_ms":        stats.AvgLatencyMs.Int64,
		"total_tokens_in":       stats.TotalTokensIn.Int64,
		"total_tokens_out":      stats.TotalTokensOut.Int64,
		"total_tokens":          stats.TotalTokens.Int64,
		"total_cost_usd":        stats.TotalCostUSD.Float64,
		"unique_providers_used": stats.UniqueProvidersUsed,
	}, nil
}

// GetProviderUsage retrieves usage statistics for a specific provider
func (tc *TelemetryCollector) GetProviderUsage(ctx context.Context, providerID string, hours int) (map[string]interface{}, error) {
	query := `
		SELECT
			COUNT(*) as total_requests,
			COUNT(*) FILTER (WHERE success = true) as successful_requests,
			COUNT(*) FILTER (WHERE success = false) as failed_requests,
			ROUND(AVG(latency_ms)) as avg_latency_ms,
			MIN(latency_ms) as min_latency_ms,
			MAX(latency_ms) as max_latency_ms,
			SUM(tokens_in) as total_tokens_in,
			SUM(tokens_out) as total_tokens_out,
			SUM(cost_usd) as total_cost_usd
		FROM routing_telemetry
		WHERE provider_id = $1
		  AND created_at > NOW() - INTERVAL '1 hour' * $2
	`

	var stats struct {
		TotalRequests      int
		SuccessfulRequests int
		FailedRequests     int
		AvgLatencyMs       sql.NullInt64
		MinLatencyMs       sql.NullInt64
		MaxLatencyMs       sql.NullInt64
		TotalTokensIn      sql.NullInt64
		TotalTokensOut     sql.NullInt64
		TotalCostUSD       sql.NullFloat64
	}

	err := tc.db.QueryRowContext(ctx, query, providerID, hours).Scan(
		&stats.TotalRequests,
		&stats.SuccessfulRequests,
		&stats.FailedRequests,
		&stats.AvgLatencyMs,
		&stats.MinLatencyMs,
		&stats.MaxLatencyMs,
		&stats.TotalTokensIn,
		&stats.TotalTokensOut,
		&stats.TotalCostUSD,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get provider usage: %w", err)
	}

	successRate := 0.0
	if stats.TotalRequests > 0 {
		successRate = (float64(stats.SuccessfulRequests) / float64(stats.TotalRequests)) * 100.0
	}

	return map[string]interface{}{
		"time_window_hours":    hours,
		"total_requests":       stats.TotalRequests,
		"successful_requests":  stats.SuccessfulRequests,
		"failed_requests":      stats.FailedRequests,
		"success_rate_percent": successRate,
		"avg_latency_ms":       stats.AvgLatencyMs.Int64,
		"min_latency_ms":       stats.MinLatencyMs.Int64,
		"max_latency_ms":       stats.MaxLatencyMs.Int64,
		"total_tokens_in":      stats.TotalTokensIn.Int64,
		"total_tokens_out":     stats.TotalTokensOut.Int64,
		"total_cost_usd":       stats.TotalCostUSD.Float64,
	}, nil
}

// GetRecentRequests retrieves recent routing requests for a tenant
func (tc *TelemetryCollector) GetRecentRequests(ctx context.Context, tenantID string, limit int) ([]map[string]interface{}, error) {
	query := `
		SELECT
			id, trace_id, provider_name, model, latency_ms,
			tokens_in, tokens_out, success, status_code,
			error_message, cost_usd, created_at
		FROM routing_telemetry
		WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`

	rows, err := tc.db.QueryContext(ctx, query, tenantID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get recent requests: %w", err)
	}
	defer rows.Close()

	requests := make([]map[string]interface{}, 0, limit)

	for rows.Next() {
		var (
			id            string
			traceID       string
			providerName  string
			model         string
			latencyMs     int
			tokensIn      sql.NullInt64
			tokensOut     sql.NullInt64
			success       bool
			statusCode    sql.NullInt64
			errorMessage  sql.NullString
			costUSD       sql.NullFloat64
			createdAt     string
		)

		err := rows.Scan(
			&id, &traceID, &providerName, &model, &latencyMs,
			&tokensIn, &tokensOut, &success, &statusCode,
			&errorMessage, &costUSD, &createdAt,
		)
		if err != nil {
			tc.logger.Printf("[TelemetryCollector] Error scanning row: %v", err)
			continue
		}

		request := map[string]interface{}{
			"id":            id,
			"trace_id":      traceID,
			"provider_name": providerName,
			"model":         model,
			"latency_ms":    latencyMs,
			"success":       success,
			"created_at":    createdAt,
		}

		if tokensIn.Valid {
			request["tokens_in"] = tokensIn.Int64
		}
		if tokensOut.Valid {
			request["tokens_out"] = tokensOut.Int64
		}
		if statusCode.Valid {
			request["status_code"] = statusCode.Int64
		}
		if errorMessage.Valid {
			request["error_message"] = errorMessage.String
		}
		if costUSD.Valid {
			request["cost_usd"] = costUSD.Float64
		}

		requests = append(requests, request)
	}

	return requests, nil
}
