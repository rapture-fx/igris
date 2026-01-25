package scheduler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/bandit"
	"github.com/Igris-inertial/system/igris-overture/observability"
)

// SelfTunerConfig represents configurable settings
type SelfTunerConfig struct {
	TenantID             string
	Enabled              bool
	Interval             time.Duration
	AutoApplyEnabled     bool
	AutoApplyThreshold   float64
	MaxRiskScore         float64
	RollbackWindow       time.Duration
	LatencyDegradation   float64
	ErrorRateDegradation float64
	CostDegradation      float64
}

// DefaultSelfTunerConfig returns default configuration
func DefaultSelfTunerConfig() SelfTunerConfig {
	return SelfTunerConfig{
		Enabled:              true,
		Interval:             24 * time.Hour, // Changed from 7 days to 24 hours
		AutoApplyEnabled:     false,
		AutoApplyThreshold:   0.90,
		MaxRiskScore:         0.30,
		RollbackWindow:       1 * time.Hour,
		LatencyDegradation:   0.10,
		ErrorRateDegradation: 0.05,
		CostDegradation:      0.10,
	}
}

// SelfTuner performs automatic weight optimization for composite rewards
type SelfTuner struct {
	db                  *sql.DB
	rewardEngine        *bandit.RewardEngine
	interval            time.Duration // Default interval (used if no tenant config)
	minSampleSize       int
	confidenceThreshold float64
	done                chan struct{}

	// Phase 2: Per-tenant configuration
	configMu      sync.RWMutex
	tenantConfigs map[string]SelfTunerConfig

	// Callbacks for auto-apply integration
	onProposalApplied   func(tenantID, semanticClass string, result *TuningResult)
	onRollbackTriggered func(tenantID, semanticClass string, reason string)
}

// TuningResult represents the result of a tuning run
type TuningResult struct {
	SemanticClass             string
	TenantID                  string
	OldWeights                bandit.RewardWeights
	NewWeights                bandit.RewardWeights
	CorrelationMatrix         map[string]map[string]float64
	PerformanceImprovement    float64
	SampleSize                int
	Algorithm                 string
	ConfidenceScore           float64
	RiskScore                 float64 // 0-1, higher = more risky
	Applied                   bool
	AutoApplied               bool
}

// MetricData represents collected metric data for correlation analysis
type MetricData struct {
	Latencies        []float64
	Costs            []float64
	SuccessRates     []float64
	CompositeRewards []float64
}

// NewSelfTuner creates a new self-tuning scheduler
func NewSelfTuner(db *sql.DB, rewardEngine *bandit.RewardEngine) *SelfTuner {
	return &SelfTuner{
		db:                  db,
		rewardEngine:        rewardEngine,
		interval:            24 * time.Hour,    // Default: daily (configurable per-tenant)
		minSampleSize:       100,               // Minimum requests for analysis
		confidenceThreshold: 0.7,               // Minimum confidence to apply
		done:                make(chan struct{}),
		tenantConfigs:       make(map[string]SelfTunerConfig),
	}
}

// NewSelfTunerWithConfig creates a self-tuner with custom default configuration
func NewSelfTunerWithConfig(db *sql.DB, rewardEngine *bandit.RewardEngine, defaultConfig SelfTunerConfig) *SelfTuner {
	st := NewSelfTuner(db, rewardEngine)
	st.interval = defaultConfig.Interval
	return st
}

// SetTenantConfig sets the configuration for a specific tenant
func (st *SelfTuner) SetTenantConfig(config SelfTunerConfig) {
	st.configMu.Lock()
	defer st.configMu.Unlock()
	st.tenantConfigs[config.TenantID] = config
}

// GetTenantConfig retrieves the configuration for a tenant, with defaults
func (st *SelfTuner) GetTenantConfig(tenantID string) SelfTunerConfig {
	st.configMu.RLock()
	defer st.configMu.RUnlock()

	if config, ok := st.tenantConfigs[tenantID]; ok {
		return config
	}

	// Return default configuration
	config := DefaultSelfTunerConfig()
	config.TenantID = tenantID
	config.Interval = st.interval
	return config
}

// LoadTenantConfigsFromDB loads all tenant configurations from the database
func (st *SelfTuner) LoadTenantConfigsFromDB(ctx context.Context) error {
	query := `
		SELECT
			tenant_id,
			enabled,
			interval_seconds,
			auto_apply_enabled,
			auto_apply_threshold,
			max_risk_score,
			rollback_window_seconds,
			latency_degradation_threshold,
			error_rate_degradation_threshold,
			cost_degradation_threshold
		FROM tenant_self_tuner_config
		WHERE enabled = TRUE
	`

	rows, err := st.db.QueryContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to load tenant configs: %w", err)
	}
	defer rows.Close()

	st.configMu.Lock()
	defer st.configMu.Unlock()

	for rows.Next() {
		var config SelfTunerConfig
		var intervalSeconds, rollbackWindowSeconds int64

		if err := rows.Scan(
			&config.TenantID,
			&config.Enabled,
			&intervalSeconds,
			&config.AutoApplyEnabled,
			&config.AutoApplyThreshold,
			&config.MaxRiskScore,
			&rollbackWindowSeconds,
			&config.LatencyDegradation,
			&config.ErrorRateDegradation,
			&config.CostDegradation,
		); err != nil {
			log.Error().Err(err).Msg("Failed to scan tenant config")
			continue
		}

		config.Interval = time.Duration(intervalSeconds) * time.Second
		config.RollbackWindow = time.Duration(rollbackWindowSeconds) * time.Second
		st.tenantConfigs[config.TenantID] = config
	}

	log.Info().Int("tenant_count", len(st.tenantConfigs)).Msg("Loaded tenant self-tuner configurations")
	return rows.Err()
}

// SetOnProposalApplied sets a callback for when a proposal is auto-applied
func (st *SelfTuner) SetOnProposalApplied(fn func(tenantID, semanticClass string, result *TuningResult)) {
	st.onProposalApplied = fn
}

// SetOnRollbackTriggered sets a callback for when a rollback is triggered
func (st *SelfTuner) SetOnRollbackTriggered(fn func(tenantID, semanticClass string, reason string)) {
	st.onRollbackTriggered = fn
}

// Start begins the self-tuning scheduler
func (st *SelfTuner) Start(ctx context.Context) {
	ticker := time.NewTicker(st.interval)
	defer ticker.Stop()

	log.Info().
		Dur("interval", st.interval).
		Int("min_sample_size", st.minSampleSize).
		Float64("confidence_threshold", st.confidenceThreshold).
		Msg("Self-tuning scheduler started")

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Self-tuning scheduler stopped")
			close(st.done)
			return
		case <-ticker.C:
			st.runTuningCycle(ctx)
		}
	}
}

// runTuningCycle executes a complete tuning cycle
func (st *SelfTuner) runTuningCycle(ctx context.Context) {
	st.runTuningCycleForTenant(ctx, "default")
}

// runTuningCycleForTenant executes tuning for a specific tenant
func (st *SelfTuner) runTuningCycleForTenant(ctx context.Context, tenantID string) {
	config := st.GetTenantConfig(tenantID)

	if !config.Enabled {
		log.Debug().Str("tenant_id", tenantID).Msg("Self-tuning disabled for tenant")
		observability.RecordSelfTunerRun(tenantID, "skipped")
		return
	}

	log.Info().
		Str("tenant_id", tenantID).
		Bool("auto_apply_enabled", config.AutoApplyEnabled).
		Float64("auto_apply_threshold", config.AutoApplyThreshold).
		Float64("max_risk_score", config.MaxRiskScore).
		Msg("Starting self-tuning cycle")

	// Get all semantic classes for this tenant
	classes, err := st.getSemanticClassesForTenant(ctx, tenantID)
	if err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("Failed to get semantic classes")
		observability.RecordSelfTunerRun(tenantID, "error")
		return
	}

	totalOptimizations := 0
	appliedOptimizations := 0
	autoAppliedCount := 0

	for _, class := range classes {
		result, err := st.optimizeClassWeightsForTenant(ctx, tenantID, class)
		if err != nil {
			log.Error().Err(err).Str("class", class).Msg("Failed to optimize class weights")
			continue
		}

		if result == nil {
			continue // Not enough data
		}

		totalOptimizations++
		result.TenantID = tenantID

		// Record tuning history
		if err := st.recordTuningHistory(ctx, result); err != nil {
			log.Error().Err(err).Msg("Failed to record tuning history")
		}

		// Check if we should auto-apply
		shouldAutoApply := config.AutoApplyEnabled &&
			result.ConfidenceScore >= config.AutoApplyThreshold &&
			result.RiskScore <= config.MaxRiskScore &&
			result.PerformanceImprovement > 0

		// Apply if confidence is high enough (manual threshold or auto-apply threshold)
		if result.ConfidenceScore >= st.confidenceThreshold && result.PerformanceImprovement > 0 {
			if err := st.rewardEngine.SetWeights(class, result.NewWeights); err != nil {
				log.Error().Err(err).Str("class", class).Msg("Failed to apply new weights")
				observability.RecordSelfTuningOptimization(class, result.PerformanceImprovement, result.ConfidenceScore, false)
				continue
			}

			appliedOptimizations++
			result.Applied = true

			// If this was an auto-apply, record baseline for rollback monitoring
			if shouldAutoApply {
				autoAppliedCount++
				if err := st.recordBaselineForRollback(ctx, tenantID, class, result, config.RollbackWindow); err != nil {
					log.Error().Err(err).Msg("Failed to record baseline for rollback")
				}

				observability.RecordAutoAppliedProposal(tenantID, "applied")

				// Trigger callback if set
				if st.onProposalApplied != nil {
					st.onProposalApplied(tenantID, class, result)
				}
			}

			// Update database
			_ = st.markTuningApplied(ctx, result)

			observability.RecordSelfTuningOptimization(class, result.PerformanceImprovement, result.ConfidenceScore, true)

			log.Info().
				Str("tenant_id", tenantID).
				Str("class", class).
				Bool("auto_applied", shouldAutoApply).
				Float64("old_latency_weight", result.OldWeights.Latency).
				Float64("old_cost_weight", result.OldWeights.Cost).
				Float64("old_success_weight", result.OldWeights.Success).
				Float64("new_latency_weight", result.NewWeights.Latency).
				Float64("new_cost_weight", result.NewWeights.Cost).
				Float64("new_success_weight", result.NewWeights.Success).
				Float64("improvement", result.PerformanceImprovement).
				Float64("confidence", result.ConfidenceScore).
				Float64("risk_score", result.RiskScore).
				Msg("Weights optimized and applied")
		} else {
			observability.RecordSelfTuningOptimization(class, result.PerformanceImprovement, result.ConfidenceScore, false)

			if config.AutoApplyEnabled {
				observability.RecordAutoAppliedProposal(tenantID, "skipped")
			}

			log.Info().
				Str("tenant_id", tenantID).
				Str("class", class).
				Float64("improvement", result.PerformanceImprovement).
				Float64("confidence", result.ConfidenceScore).
				Float64("risk_score", result.RiskScore).
				Msg("Weights optimized but not applied (low confidence, high risk, or negative improvement)")
		}
	}

	// Update last run timestamp
	if err := st.updateLastRun(ctx, tenantID); err != nil {
		log.Error().Err(err).Str("tenant_id", tenantID).Msg("Failed to update last run timestamp")
	}

	observability.RecordSelfTunerRun(tenantID, "success")

	log.Info().
		Str("tenant_id", tenantID).
		Int("total_optimizations", totalOptimizations).
		Int("applied_optimizations", appliedOptimizations).
		Int("auto_applied", autoAppliedCount).
		Msg("Self-tuning cycle completed")
}

// getSemanticClassesForTenant retrieves semantic classes for a specific tenant
func (st *SelfTuner) getSemanticClassesForTenant(ctx context.Context, tenantID string) ([]string, error) {
	query := `
		SELECT DISTINCT semantic_class
		FROM feedback_events
		WHERE tenant_id = $1
		  AND created_at > NOW() - INTERVAL '7 days'
		GROUP BY semantic_class
		HAVING COUNT(*) >= $2
		ORDER BY semantic_class
	`

	rows, err := st.db.QueryContext(ctx, query, tenantID, st.minSampleSize)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var classes []string
	for rows.Next() {
		var class string
		if err := rows.Scan(&class); err != nil {
			return nil, err
		}
		classes = append(classes, class)
	}

	return classes, rows.Err()
}

// optimizeClassWeightsForTenant optimizes weights for a tenant's semantic class
func (st *SelfTuner) optimizeClassWeightsForTenant(ctx context.Context, tenantID, class string) (*TuningResult, error) {
	// Collect metric data from the configurable window
	config := st.GetTenantConfig(tenantID)
	windowDuration := config.Interval
	if windowDuration < 24*time.Hour {
		windowDuration = 24 * time.Hour // Minimum 1 day of data
	}

	endTime := time.Now()
	startTime := endTime.Add(-windowDuration)

	data, err := st.collectMetricDataForTenant(ctx, tenantID, class, startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("failed to collect metric data: %w", err)
	}

	if len(data.Latencies) < st.minSampleSize {
		log.Debug().
			Str("tenant_id", tenantID).
			Str("class", class).
			Int("sample_size", len(data.Latencies)).
			Int("min_required", st.minSampleSize).
			Msg("Insufficient data for optimization")
		return nil, nil // Not enough data
	}

	// Get current weights
	oldWeights := st.rewardEngine.GetWeights(class)

	// Calculate correlation matrix
	correlationMatrix := st.calculateCorrelationMatrix(data)

	// Optimize weights based on correlations
	newWeights, improvement, confidence := st.optimizeWeights(data, correlationMatrix, oldWeights)

	// Calculate risk score based on the magnitude of changes
	riskScore := st.calculateRiskScore(oldWeights, newWeights, data)

	return &TuningResult{
		SemanticClass:          class,
		TenantID:               tenantID,
		OldWeights:             oldWeights,
		NewWeights:             newWeights,
		CorrelationMatrix:      correlationMatrix,
		PerformanceImprovement: improvement,
		SampleSize:             len(data.Latencies),
		Algorithm:              "correlation_analysis",
		ConfidenceScore:        confidence,
		RiskScore:              riskScore,
		Applied:                false,
	}, nil
}

// collectMetricDataForTenant collects metric data for a specific tenant
func (st *SelfTuner) collectMetricDataForTenant(ctx context.Context, tenantID, class string, startTime, endTime time.Time) (*MetricData, error) {
	query := `
		SELECT
			latency_score,
			cost_efficiency,
			success_rate,
			composite_reward
		FROM feedback_events
		WHERE tenant_id = $1
		  AND semantic_class = $2
		  AND created_at >= $3
		  AND created_at < $4
		  AND processed = true
		ORDER BY created_at
	`

	rows, err := st.db.QueryContext(ctx, query, tenantID, class, startTime, endTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	data := &MetricData{
		Latencies:        make([]float64, 0),
		Costs:            make([]float64, 0),
		SuccessRates:     make([]float64, 0),
		CompositeRewards: make([]float64, 0),
	}

	for rows.Next() {
		var latency, cost, success, reward sql.NullFloat64

		if err := rows.Scan(&latency, &cost, &success, &reward); err != nil {
			return nil, err
		}

		if latency.Valid && cost.Valid && success.Valid && reward.Valid {
			data.Latencies = append(data.Latencies, latency.Float64)
			data.Costs = append(data.Costs, cost.Float64)
			data.SuccessRates = append(data.SuccessRates, success.Float64)
			data.CompositeRewards = append(data.CompositeRewards, reward.Float64)
		}
	}

	return data, rows.Err()
}

// calculateRiskScore computes risk based on weight changes and data variance
func (st *SelfTuner) calculateRiskScore(oldWeights, newWeights bandit.RewardWeights, data *MetricData) float64 {
	// Risk factors:
	// 1. Magnitude of weight changes (larger changes = higher risk)
	// 2. Variance in data (higher variance = higher risk)
	// 3. Sample size (smaller samples = higher risk)

	// Calculate weight change magnitude
	latencyDiff := math.Abs(newWeights.Latency - oldWeights.Latency)
	costDiff := math.Abs(newWeights.Cost - oldWeights.Cost)
	successDiff := math.Abs(newWeights.Success - oldWeights.Success)
	totalDiff := (latencyDiff + costDiff + successDiff) / 3.0

	// Weight change risk (0-0.4)
	changeRisk := math.Min(totalDiff*2, 0.4)

	// Calculate variance risk (0-0.3)
	rewardVariance := st.variance(data.CompositeRewards)
	varianceRisk := math.Min(rewardVariance, 0.3)

	// Sample size risk (0-0.3)
	sampleRisk := 0.3 * math.Max(0, 1.0-float64(len(data.Latencies))/float64(st.minSampleSize*5))

	return changeRisk + varianceRisk + sampleRisk
}

// variance calculates the variance of a slice
func (st *SelfTuner) variance(values []float64) float64 {
	if len(values) == 0 {
		return 0.0
	}

	mean := st.mean(values)
	var sum float64
	for _, v := range values {
		diff := v - mean
		sum += diff * diff
	}
	return sum / float64(len(values))
}

// recordBaselineForRollback stores baseline metrics for rollback monitoring
func (st *SelfTuner) recordBaselineForRollback(ctx context.Context, tenantID, class string, result *TuningResult, rollbackWindow time.Duration) error {
	// Get current performance metrics as baseline
	query := `
		SELECT
			PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
			AVG(CASE WHEN success THEN 0.0 ELSE 1.0 END) as error_rate,
			AVG(cost_usd) as avg_cost,
			COUNT(*) as request_count
		FROM semantic_bandit_rewards
		WHERE tenant_id = $1
		  AND semantic_class = $2
		  AND created_at > NOW() - INTERVAL '1 hour'
	`

	var p95Latency, errorRate, avgCost sql.NullFloat64
	var requestCount int

	if err := st.db.QueryRowContext(ctx, query, tenantID, class).Scan(
		&p95Latency, &errorRate, &avgCost, &requestCount,
	); err != nil {
		return fmt.Errorf("failed to get baseline metrics: %w", err)
	}

	// Insert baseline record
	insertQuery := `
		INSERT INTO self_tuner_baselines (
			tenant_id,
			proposal_id,
			semantic_class,
			baseline_p95_latency_ms,
			baseline_error_rate,
			baseline_avg_cost_usd,
			baseline_request_count,
			rollback_deadline
		) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + $8::INTERVAL)
		ON CONFLICT (tenant_id, semantic_class, rolled_back)
		WHERE rolled_back = FALSE
		DO UPDATE SET
			proposal_id = EXCLUDED.proposal_id,
			baseline_p95_latency_ms = EXCLUDED.baseline_p95_latency_ms,
			baseline_error_rate = EXCLUDED.baseline_error_rate,
			baseline_avg_cost_usd = EXCLUDED.baseline_avg_cost_usd,
			baseline_request_count = EXCLUDED.baseline_request_count,
			applied_at = NOW(),
			rollback_deadline = NOW() + $8::INTERVAL
	`

	_, err := st.db.ExecContext(ctx, insertQuery,
		tenantID,
		fmt.Sprintf("auto_%s_%d", class, time.Now().Unix()),
		class,
		p95Latency.Float64,
		errorRate.Float64,
		avgCost.Float64,
		requestCount,
		fmt.Sprintf("%d seconds", int64(rollbackWindow.Seconds())),
	)

	return err
}

// updateLastRun updates the last run timestamp for a tenant
func (st *SelfTuner) updateLastRun(ctx context.Context, tenantID string) error {
	query := `
		UPDATE tenant_self_tuner_config
		SET last_run = NOW()
		WHERE tenant_id = $1
	`
	_, err := st.db.ExecContext(ctx, query, tenantID)
	return err
}

// optimizeClassWeights optimizes weights for a semantic class
func (st *SelfTuner) optimizeClassWeights(ctx context.Context, class string) (*TuningResult, error) {
	// Collect metric data from the past week
	endTime := time.Now()
	startTime := endTime.Add(-7 * 24 * time.Hour)

	data, err := st.collectMetricData(ctx, class, startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("failed to collect metric data: %w", err)
	}

	if len(data.Latencies) < st.minSampleSize {
		log.Debug().
			Str("class", class).
			Int("sample_size", len(data.Latencies)).
			Int("min_required", st.minSampleSize).
			Msg("Insufficient data for optimization")
		return nil, nil // Not enough data
	}

	// Get current weights
	oldWeights := st.rewardEngine.GetWeights(class)

	// Calculate correlation matrix
	correlationMatrix := st.calculateCorrelationMatrix(data)

	// Optimize weights based on correlations
	newWeights, improvement, confidence := st.optimizeWeights(data, correlationMatrix, oldWeights)

	return &TuningResult{
		SemanticClass:          class,
		OldWeights:             oldWeights,
		NewWeights:             newWeights,
		CorrelationMatrix:      correlationMatrix,
		PerformanceImprovement: improvement,
		SampleSize:             len(data.Latencies),
		Algorithm:              "correlation_analysis",
		ConfidenceScore:        confidence,
		Applied:                false,
	}, nil
}

// collectMetricData collects metric data for correlation analysis
func (st *SelfTuner) collectMetricData(ctx context.Context, class string, startTime, endTime time.Time) (*MetricData, error) {
	query := `
		SELECT
			latency_score,
			cost_efficiency,
			success_rate,
			composite_reward
		FROM feedback_events
		WHERE semantic_class = $1
		  AND created_at >= $2
		  AND created_at < $3
		  AND processed = true
		ORDER BY created_at
	`

	rows, err := st.db.QueryContext(ctx, query, class, startTime, endTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	data := &MetricData{
		Latencies:        make([]float64, 0),
		Costs:            make([]float64, 0),
		SuccessRates:     make([]float64, 0),
		CompositeRewards: make([]float64, 0),
	}

	for rows.Next() {
		var latency, cost, success, reward sql.NullFloat64

		if err := rows.Scan(&latency, &cost, &success, &reward); err != nil {
			return nil, err
		}

		if latency.Valid && cost.Valid && success.Valid && reward.Valid {
			data.Latencies = append(data.Latencies, latency.Float64)
			data.Costs = append(data.Costs, cost.Float64)
			data.SuccessRates = append(data.SuccessRates, success.Float64)
			data.CompositeRewards = append(data.CompositeRewards, reward.Float64)
		}
	}

	return data, rows.Err()
}

// calculateCorrelationMatrix calculates Pearson correlation coefficients
func (st *SelfTuner) calculateCorrelationMatrix(data *MetricData) map[string]map[string]float64 {
	matrix := make(map[string]map[string]float64)

	// Initialize matrix
	metrics := []string{"latency", "cost", "success"}
	for _, m1 := range metrics {
		matrix[m1] = make(map[string]float64)
		for _, m2 := range metrics {
			matrix[m1][m2] = 0.0
		}
	}

	// Calculate correlations
	matrix["latency"]["reward"] = st.pearsonCorrelation(data.Latencies, data.CompositeRewards)
	matrix["cost"]["reward"] = st.pearsonCorrelation(data.Costs, data.CompositeRewards)
	matrix["success"]["reward"] = st.pearsonCorrelation(data.SuccessRates, data.CompositeRewards)

	// Cross-correlations
	matrix["latency"]["cost"] = st.pearsonCorrelation(data.Latencies, data.Costs)
	matrix["latency"]["success"] = st.pearsonCorrelation(data.Latencies, data.SuccessRates)
	matrix["cost"]["success"] = st.pearsonCorrelation(data.Costs, data.SuccessRates)

	return matrix
}

// pearsonCorrelation calculates Pearson correlation coefficient
func (st *SelfTuner) pearsonCorrelation(x, y []float64) float64 {
	if len(x) != len(y) || len(x) == 0 {
		return 0.0
	}

	_ = float64(len(x)) // n - unused for now

	// Calculate means
	meanX := st.mean(x)
	meanY := st.mean(y)

	// Calculate covariance and standard deviations
	var covariance, varX, varY float64

	for i := 0; i < len(x); i++ {
		dx := x[i] - meanX
		dy := y[i] - meanY
		covariance += dx * dy
		varX += dx * dx
		varY += dy * dy
	}

	if varX == 0 || varY == 0 {
		return 0.0
	}

	return covariance / math.Sqrt(varX*varY)
}

// mean calculates the arithmetic mean
func (st *SelfTuner) mean(values []float64) float64 {
	if len(values) == 0 {
		return 0.0
	}

	sum := 0.0
	for _, v := range values {
		sum += v
	}

	return sum / float64(len(values))
}

// optimizeWeights calculates optimal weights based on correlation analysis
func (st *SelfTuner) optimizeWeights(
	data *MetricData,
	correlations map[string]map[string]float64,
	oldWeights bandit.RewardWeights,
) (bandit.RewardWeights, float64, float64) {
	// Get correlation strengths with reward
	latencyCorr := math.Abs(correlations["latency"]["reward"])
	costCorr := math.Abs(correlations["cost"]["reward"])
	successCorr := math.Abs(correlations["success"]["reward"])

	totalCorr := latencyCorr + costCorr + successCorr

	if totalCorr == 0 {
		// No meaningful correlations, keep old weights
		return oldWeights, 0.0, 0.5
	}

	// New weights proportional to correlation strength
	newWeights := bandit.RewardWeights{
		Latency: latencyCorr / totalCorr,
		Cost:    costCorr / totalCorr,
		Success: successCorr / totalCorr,
	}

	// Calculate expected improvement using historical data
	oldRewardMean := st.mean(data.CompositeRewards)

	// Simulate new rewards with new weights
	simulatedRewards := make([]float64, len(data.Latencies))
	for i := range data.Latencies {
		simulatedRewards[i] = (newWeights.Latency * data.Latencies[i]) +
			(newWeights.Cost * data.Costs[i]) +
			(newWeights.Success * data.SuccessRates[i])
	}

	newRewardMean := st.mean(simulatedRewards)

	// Calculate improvement percentage
	improvement := 0.0
	if oldRewardMean > 0 {
		improvement = ((newRewardMean - oldRewardMean) / oldRewardMean) * 100.0
	}

	// Calculate confidence based on sample size and correlation strength
	sampleFactor := math.Min(float64(len(data.Latencies))/float64(st.minSampleSize*2), 1.0)
	correlationFactor := (latencyCorr + costCorr + successCorr) / 3.0
	confidence := (sampleFactor * 0.5) + (correlationFactor * 0.5)

	return newWeights, improvement, confidence
}

// getSemanticClasses retrieves all semantic classes with sufficient data
func (st *SelfTuner) getSemanticClasses(ctx context.Context) ([]string, error) {
	query := `
		SELECT DISTINCT semantic_class
		FROM feedback_events
		WHERE created_at > NOW() - INTERVAL '7 days'
		GROUP BY semantic_class
		HAVING COUNT(*) >= $1
		ORDER BY semantic_class
	`

	rows, err := st.db.QueryContext(ctx, query, st.minSampleSize)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var classes []string
	for rows.Next() {
		var class string
		if err := rows.Scan(&class); err != nil {
			return nil, err
		}
		classes = append(classes, class)
	}

	return classes, rows.Err()
}

// recordTuningHistory records a tuning result in the database
func (st *SelfTuner) recordTuningHistory(ctx context.Context, result *TuningResult) error {
	correlationJSON, err := st.serializeCorrelationMatrix(result.CorrelationMatrix)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO self_tuning_history (
			semantic_class,
			old_weight_latency, old_weight_cost, old_weight_success,
			new_weight_latency, new_weight_cost, new_weight_success,
			correlation_matrix, performance_improvement, sample_size,
			algorithm, confidence_score, applied
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8::JSONB, $9, $10, $11, $12, $13
		)
	`

	_, err = st.db.ExecContext(ctx, query,
		result.SemanticClass,
		result.OldWeights.Latency,
		result.OldWeights.Cost,
		result.OldWeights.Success,
		result.NewWeights.Latency,
		result.NewWeights.Cost,
		result.NewWeights.Success,
		correlationJSON,
		result.PerformanceImprovement,
		result.SampleSize,
		result.Algorithm,
		result.ConfidenceScore,
		result.Applied,
	)

	return err
}

// markTuningApplied marks a tuning result as applied
func (st *SelfTuner) markTuningApplied(ctx context.Context, result *TuningResult) error {
	query := `
		UPDATE self_tuning_history
		SET applied = true, applied_at = CURRENT_TIMESTAMP
		WHERE semantic_class = $1
		  AND applied = false
		ORDER BY created_at DESC
		LIMIT 1
	`

	_, err := st.db.ExecContext(ctx, query, result.SemanticClass)
	return err
}

// serializeCorrelationMatrix converts correlation matrix to JSON string
func (st *SelfTuner) serializeCorrelationMatrix(matrix map[string]map[string]float64) (string, error) {
	// Convert to JSON-compatible format
	jsonMap := make(map[string]interface{})
	for k, v := range matrix {
		jsonMap[k] = v
	}

	bytes, err := json.Marshal(jsonMap)
	if err != nil {
		return "", err
	}

	return string(bytes), nil
}

// Stop stops the self-tuning scheduler
func (st *SelfTuner) Stop() {
	<-st.done
}

// SetInterval sets the tuning interval
func (st *SelfTuner) SetInterval(interval time.Duration) {
	st.interval = interval
}

// SetMinSampleSize sets the minimum sample size for optimization
func (st *SelfTuner) SetMinSampleSize(size int) {
	st.minSampleSize = size
}

// SetConfidenceThreshold sets the confidence threshold for applying optimizations
func (st *SelfTuner) SetConfidenceThreshold(threshold float64) error {
	if threshold < 0 || threshold > 1 {
		return fmt.Errorf("confidence threshold must be between 0 and 1")
	}
	st.confidenceThreshold = threshold
	return nil
}
