package governance

import (
	"context"
	"database/sql"
	"fmt"
	"sort"
	"time"

	"github.com/lib/pq"
	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/observability"
)

// SLAManager tracks and enforces SLA compliance
type SLAManager struct {
	db                   *sql.DB
	measurementWindow    time.Duration
	violationThreshold   int
	criticalThreshold    int
}

// SLAConfig represents SLA configuration for a tenant
type SLAConfig struct {
	ID                       string
	TenantID                 string
	TargetUptimePercent      float64
	TargetLatencyP95Ms       int
	TargetLatencyP99Ms       int
	TargetCostPer1kRequests  float64
	MinSuccessRate           float64
	MaxErrorRate             float64
	ViolationThresholdPerDay int
	CriticalThreshold        int
	MeasurementWindowMinutes int
	Enabled                  bool
}

// SLAMetrics represents measured SLA metrics
type SLAMetrics struct {
	TenantID         string
	ProviderID       string
	WindowStart      time.Time
	WindowEnd        time.Time
	TotalRequests    int
	SuccessfulRequests int
	FailedRequests   int
	SuccessRate      float64
	Latencies        []int64 // For percentile calculation
	LatencyP50Ms     int
	LatencyP95Ms     int
	LatencyP99Ms     int
	AvgLatencyMs     int
	MaxLatencyMs     int
	TotalCostUSD     float64
	AvgCostPerRequest float64
	UptimePercent    float64
}

// SLAViolation represents an SLA violation
type SLAViolation struct {
	ID              string
	TenantID        string
	ProviderID      string
	SLAConfigID     string
	ViolationType   string
	MeasuredValue   float64
	TargetValue     float64
	DeviationPercent float64
	WindowStart     time.Time
	WindowEnd       time.Time
	Severity        string
	IsResolved      bool
	DegradedProvider bool
	AlertSent       bool
	CreatedAt       time.Time
}

// NewSLAManager creates a new SLA manager
func NewSLAManager(db *sql.DB) *SLAManager {
	return &SLAManager{
		db:                   db,
		measurementWindow:    10 * time.Minute,
		violationThreshold:   3,  // Mark degraded after 3 violations/day
		criticalThreshold:    10, // Escalate after 10 violations/day
	}
}

// CheckSLACompliance checks SLA compliance for a tenant and provider
func (sm *SLAManager) CheckSLACompliance(ctx context.Context, tenantID, providerID string) error {
	// Get SLA configuration
	config, err := sm.getSLAConfig(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("failed to get SLA config: %w", err)
	}

	if config == nil || !config.Enabled {
		return nil // No SLA configured or disabled
	}

	// Calculate metrics for the measurement window
	windowEnd := time.Now()
	windowStart := windowEnd.Add(-sm.measurementWindow)

	metrics, err := sm.calculateMetrics(ctx, tenantID, providerID, windowStart, windowEnd)
	if err != nil {
		return fmt.Errorf("failed to calculate metrics: %w", err)
	}

	if metrics.TotalRequests == 0 {
		return nil // No data to evaluate
	}

	// Check each SLA target
	violations := sm.detectViolations(config, metrics)

	// Record violations
	for _, violation := range violations {
		if err := sm.recordViolation(ctx, violation); err != nil {
			log.Error().Err(err).Msg("Failed to record SLA violation")
		}
	}

	// Update SLA compliance status
	status := sm.calculateComplianceStatus(ctx, tenantID)
	observability.RecordSLACompliance(tenantID, status)

	// Record measured values
	observability.RecordSLAMetrics(tenantID, providerID, "uptime", metrics.UptimePercent, config.TargetUptimePercent)
	observability.RecordSLAMetrics(tenantID, providerID, "latency_p95", float64(metrics.LatencyP95Ms), float64(config.TargetLatencyP95Ms))
	observability.RecordSLAMetrics(tenantID, providerID, "latency_p99", float64(metrics.LatencyP99Ms), float64(config.TargetLatencyP99Ms))
	observability.RecordSLAMetrics(tenantID, providerID, "success_rate", metrics.SuccessRate, config.MinSuccessRate)

	return nil
}

// getSLAConfig retrieves SLA configuration for a tenant
func (sm *SLAManager) getSLAConfig(ctx context.Context, tenantID string) (*SLAConfig, error) {
	query := `
		SELECT
			id, tenant_id, target_uptime_percent, target_latency_p95_ms,
			target_latency_p99_ms, target_cost_per_1k_requests_usd,
			min_success_rate, max_error_rate, violation_threshold_per_day,
			critical_violation_threshold, measurement_window_minutes, enabled
		FROM sla_configurations
		WHERE tenant_id = $1::UUID AND enabled = true
		LIMIT 1
	`

	var config SLAConfig
	err := sm.db.QueryRowContext(ctx, query, tenantID).Scan(
		&config.ID,
		&config.TenantID,
		&config.TargetUptimePercent,
		&config.TargetLatencyP95Ms,
		&config.TargetLatencyP99Ms,
		&config.TargetCostPer1kRequests,
		&config.MinSuccessRate,
		&config.MaxErrorRate,
		&config.ViolationThresholdPerDay,
		&config.CriticalThreshold,
		&config.MeasurementWindowMinutes,
		&config.Enabled,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	return &config, nil
}

// calculateMetrics calculates SLA metrics for a time window
func (sm *SLAManager) calculateMetrics(ctx context.Context, tenantID, providerID string, windowStart, windowEnd time.Time) (*SLAMetrics, error) {
	query := `
		SELECT
			COUNT(*) as total_requests,
			COUNT(*) FILTER (WHERE success = true) as successful_requests,
			COUNT(*) FILTER (WHERE success = false) as failed_requests,
			array_agg(latency_ms ORDER BY latency_ms) as latencies,
			COALESCE(SUM(cost_usd), 0) as total_cost_usd
		FROM routing_telemetry
		WHERE tenant_id = $1::UUID
		  AND provider_id = $2::UUID
		  AND created_at >= $3
		  AND created_at < $4
	`

	var metrics SLAMetrics
	var latenciesArray []int64
	var totalCostUSD sql.NullFloat64

	err := sm.db.QueryRowContext(ctx, query, tenantID, providerID, windowStart, windowEnd).Scan(
		&metrics.TotalRequests,
		&metrics.SuccessfulRequests,
		&metrics.FailedRequests,
		(*pq.Int64Array)(&latenciesArray),
		&totalCostUSD,
	)

	if err != nil {
		return nil, err
	}

	metrics.TenantID = tenantID
	metrics.ProviderID = providerID
	metrics.WindowStart = windowStart
	metrics.WindowEnd = windowEnd
	metrics.Latencies = latenciesArray

	if totalCostUSD.Valid {
		metrics.TotalCostUSD = totalCostUSD.Float64
	}

	// Calculate success rate
	if metrics.TotalRequests > 0 {
		metrics.SuccessRate = (float64(metrics.SuccessfulRequests) / float64(metrics.TotalRequests)) * 100.0
		metrics.AvgCostPerRequest = metrics.TotalCostUSD / float64(metrics.TotalRequests)
	}

	// Calculate uptime (based on successful requests)
	metrics.UptimePercent = metrics.SuccessRate

	// Calculate latency percentiles
	if len(latenciesArray) > 0 {
		metrics.LatencyP50Ms = calculatePercentile(latenciesArray, 50)
		metrics.LatencyP95Ms = calculatePercentile(latenciesArray, 95)
		metrics.LatencyP99Ms = calculatePercentile(latenciesArray, 99)
		metrics.MaxLatencyMs = int(latenciesArray[len(latenciesArray)-1])

		// Calculate average
		sum := int64(0)
		for _, lat := range latenciesArray {
			sum += lat
		}
		metrics.AvgLatencyMs = int(sum / int64(len(latenciesArray)))
	}

	return &metrics, nil
}

// calculatePercentile calculates the nth percentile from a sorted array
func calculatePercentile(sortedValues []int64, percentile int) int {
	if len(sortedValues) == 0 {
		return 0
	}

	// Values should already be sorted from SQL ORDER BY
	// If not, uncomment the following line:
	// sort.Slice(sortedValues, func(i, j int) bool { return sortedValues[i] < sortedValues[j] })

	index := (percentile * len(sortedValues)) / 100
	if index >= len(sortedValues) {
		index = len(sortedValues) - 1
	}

	return int(sortedValues[index])
}

// detectViolations detects SLA violations from metrics
func (sm *SLAManager) detectViolations(config *SLAConfig, metrics *SLAMetrics) []*SLAViolation {
	var violations []*SLAViolation

	// Check uptime
	if metrics.UptimePercent < config.TargetUptimePercent {
		severity := "warning"
		if config.TargetUptimePercent-metrics.UptimePercent > 5.0 {
			severity = "critical"
		}

		violations = append(violations, &SLAViolation{
			TenantID:         metrics.TenantID,
			ProviderID:       metrics.ProviderID,
			SLAConfigID:      config.ID,
			ViolationType:    "uptime",
			MeasuredValue:    metrics.UptimePercent,
			TargetValue:      config.TargetUptimePercent,
			DeviationPercent: ((config.TargetUptimePercent - metrics.UptimePercent) / config.TargetUptimePercent) * 100,
			WindowStart:      metrics.WindowStart,
			WindowEnd:        metrics.WindowEnd,
			Severity:         severity,
		})
	}

	// Check latency p95
	if metrics.LatencyP95Ms > config.TargetLatencyP95Ms {
		severity := "warning"
		if metrics.LatencyP95Ms > config.TargetLatencyP95Ms*2 {
			severity = "critical"
		}

		violations = append(violations, &SLAViolation{
			TenantID:         metrics.TenantID,
			ProviderID:       metrics.ProviderID,
			SLAConfigID:      config.ID,
			ViolationType:    "latency_p95",
			MeasuredValue:    float64(metrics.LatencyP95Ms),
			TargetValue:      float64(config.TargetLatencyP95Ms),
			DeviationPercent: ((float64(metrics.LatencyP95Ms) - float64(config.TargetLatencyP95Ms)) / float64(config.TargetLatencyP95Ms)) * 100,
			WindowStart:      metrics.WindowStart,
			WindowEnd:        metrics.WindowEnd,
			Severity:         severity,
		})
	}

	// Check latency p99
	if metrics.LatencyP99Ms > config.TargetLatencyP99Ms {
		severity := "warning"
		if metrics.LatencyP99Ms > config.TargetLatencyP99Ms*2 {
			severity = "critical"
		}

		violations = append(violations, &SLAViolation{
			TenantID:         metrics.TenantID,
			ProviderID:       metrics.ProviderID,
			SLAConfigID:      config.ID,
			ViolationType:    "latency_p99",
			MeasuredValue:    float64(metrics.LatencyP99Ms),
			TargetValue:      float64(config.TargetLatencyP99Ms),
			DeviationPercent: ((float64(metrics.LatencyP99Ms) - float64(config.TargetLatencyP99Ms)) / float64(config.TargetLatencyP99Ms)) * 100,
			WindowStart:      metrics.WindowStart,
			WindowEnd:        metrics.WindowEnd,
			Severity:         severity,
		})
	}

	// Check success rate
	if metrics.SuccessRate < config.MinSuccessRate {
		severity := "warning"
		if metrics.SuccessRate < config.MinSuccessRate-10.0 {
			severity = "critical"
		}

		violations = append(violations, &SLAViolation{
			TenantID:         metrics.TenantID,
			ProviderID:       metrics.ProviderID,
			SLAConfigID:      config.ID,
			ViolationType:    "success_rate",
			MeasuredValue:    metrics.SuccessRate,
			TargetValue:      config.MinSuccessRate,
			DeviationPercent: ((config.MinSuccessRate - metrics.SuccessRate) / config.MinSuccessRate) * 100,
			WindowStart:      metrics.WindowStart,
			WindowEnd:        metrics.WindowEnd,
			Severity:         severity,
		})
	}

	// Check cost (if configured)
	if config.TargetCostPer1kRequests > 0 {
		costPer1k := (metrics.TotalCostUSD / float64(metrics.TotalRequests)) * 1000
		if costPer1k > config.TargetCostPer1kRequests {
			violations = append(violations, &SLAViolation{
				TenantID:         metrics.TenantID,
				ProviderID:       metrics.ProviderID,
				SLAConfigID:      config.ID,
				ViolationType:    "cost",
				MeasuredValue:    costPer1k,
				TargetValue:      config.TargetCostPer1kRequests,
				DeviationPercent: ((costPer1k - config.TargetCostPer1kRequests) / config.TargetCostPer1kRequests) * 100,
				WindowStart:      metrics.WindowStart,
				WindowEnd:        metrics.WindowEnd,
				Severity:         "warning",
			})
		}
	}

	return violations
}

// recordViolation records an SLA violation in the database
func (sm *SLAManager) recordViolation(ctx context.Context, violation *SLAViolation) error {
	query := `
		SELECT record_sla_violation(
			$1::UUID,           -- tenant_id
			$2::UUID,           -- provider_id
			$3::VARCHAR,        -- violation_type
			$4::DECIMAL,        -- measured_value
			$5::DECIMAL,        -- target_value
			$6::TIMESTAMP,      -- window_start
			$7::TIMESTAMP,      -- window_end
			$8::VARCHAR         -- severity
		)
	`

	var violationID string
	err := sm.db.QueryRowContext(ctx, query,
		violation.TenantID,
		violation.ProviderID,
		violation.ViolationType,
		violation.MeasuredValue,
		violation.TargetValue,
		violation.WindowStart,
		violation.WindowEnd,
		violation.Severity,
	).Scan(&violationID)

	if err != nil {
		return err
	}

	// Record metrics
	observability.RecordSLAViolation(
		violation.TenantID,
		violation.ProviderID,
		violation.ViolationType,
		violation.Severity,
	)

	log.Warn().
		Str("violation_id", violationID).
		Str("tenant_id", violation.TenantID).
		Str("provider_id", violation.ProviderID).
		Str("type", violation.ViolationType).
		Float64("measured", violation.MeasuredValue).
		Float64("target", violation.TargetValue).
		Str("severity", violation.Severity).
		Msg("SLA violation detected")

	return nil
}

// calculateComplianceStatus determines overall compliance status
func (sm *SLAManager) calculateComplianceStatus(ctx context.Context, tenantID string) string {
	query := `
		SELECT COUNT(*) FILTER (WHERE severity = 'critical' AND is_resolved = false)
		FROM sla_violations
		WHERE tenant_id = $1::UUID
		  AND created_at > CURRENT_DATE
	`

	var criticalCount int
	err := sm.db.QueryRowContext(ctx, query, tenantID).Scan(&criticalCount)
	if err != nil {
		log.Error().Err(err).Msg("Failed to calculate compliance status")
		return "unknown"
	}

	if criticalCount > 0 {
		return "critical"
	}

	query2 := `
		SELECT COUNT(*) FILTER (WHERE is_resolved = false)
		FROM sla_violations
		WHERE tenant_id = $1::UUID
		  AND created_at > CURRENT_DATE
	`

	var totalViolations int
	err = sm.db.QueryRowContext(ctx, query2, tenantID).Scan(&totalViolations)
	if err != nil {
		return "unknown"
	}

	if totalViolations > 0 {
		return "warning"
	}

	return "compliant"
}

// GetViolationsToday retrieves violations for today
func (sm *SLAManager) GetViolationsToday(ctx context.Context, tenantID, providerID string) ([]*SLAViolation, error) {
	query := `
		SELECT
			id, tenant_id, provider_id, sla_config_id, violation_type,
			measured_value, target_value, deviation_percent,
			window_start, window_end, severity, is_resolved,
			degraded_provider, alert_sent, created_at
		FROM sla_violations
		WHERE tenant_id = $1::UUID
		  AND provider_id = $2::UUID
		  AND created_at > CURRENT_DATE
		ORDER BY created_at DESC
	`

	rows, err := sm.db.QueryContext(ctx, query, tenantID, providerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var violations []*SLAViolation
	for rows.Next() {
		var v SLAViolation
		if err := rows.Scan(
			&v.ID,
			&v.TenantID,
			&v.ProviderID,
			&v.SLAConfigID,
			&v.ViolationType,
			&v.MeasuredValue,
			&v.TargetValue,
			&v.DeviationPercent,
			&v.WindowStart,
			&v.WindowEnd,
			&v.Severity,
			&v.IsResolved,
			&v.DegradedProvider,
			&v.AlertSent,
			&v.CreatedAt,
		); err != nil {
			return nil, err
		}
		violations = append(violations, &v)
	}

	return violations, rows.Err()
}
