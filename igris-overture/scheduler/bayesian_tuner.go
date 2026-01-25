package scheduler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/Igris-inertial/system/igris-overture/bandit"
)

// BayesianTuner performs Bayesian optimization for reward weight tuning
type BayesianTuner struct {
	db                  *sql.DB
	rewardEngine        *bandit.RewardEngine
	interval            time.Duration
	minSampleSize       int
	posteriorConfidence float64 // Minimum posterior probability to apply (95%)
	canaryPercentage    float64 // Percentage of tenants for canary testing (1%)
	done                chan struct{}
}

// BayesianTuningResult represents the result of Bayesian optimization
type BayesianTuningResult struct {
	SemanticClass             string
	OldWeights                bandit.RewardWeights
	NewWeights                bandit.RewardWeights
	PosteriorMean             map[string]float64
	PosteriorStd              map[string]float64
	ExpectedImprovement       float64
	PosteriorConfidence       float64
	SampleSize                int
	Algorithm                 string
	Applied                   bool
	CanaryOnly                bool
}

// WeightPrior represents the Bayesian prior for a weight parameter
type WeightPrior struct {
	Mean float64 // Prior mean
	Std  float64 // Prior standard deviation
}

// PosteriorDistribution represents the posterior after observing data
type PosteriorDistribution struct {
	Mean       float64
	Std        float64
	Confidence float64
}

// NewBayesianTuner creates a new Bayesian optimization tuner
func NewBayesianTuner(db *sql.DB, rewardEngine *bandit.RewardEngine) *BayesianTuner {
	return &BayesianTuner{
		db:                  db,
		rewardEngine:        rewardEngine,
		interval:            7 * 24 * time.Hour, // Weekly tuning
		minSampleSize:       100,
		posteriorConfidence: 0.95, // 95% confidence threshold
		canaryPercentage:    0.01, // 1% canary rollout
		done:                make(chan struct{}),
	}
}

// Start begins the Bayesian tuning scheduler
func (bt *BayesianTuner) Start(ctx context.Context) {
	ticker := time.NewTicker(bt.interval)
	defer ticker.Stop()

	log.Info().
		Dur("interval", bt.interval).
		Int("min_sample_size", bt.minSampleSize).
		Float64("posterior_confidence", bt.posteriorConfidence).
		Float64("canary_percentage", bt.canaryPercentage).
		Msg("Bayesian tuner started")

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Bayesian tuner stopped")
			close(bt.done)
			return
		case <-ticker.C:
			bt.runBayesianOptimization(ctx)
		}
	}
}

// runBayesianOptimization executes Bayesian optimization cycle
func (bt *BayesianTuner) runBayesianOptimization(ctx context.Context) {
	log.Info().Msg("Starting Bayesian optimization cycle")

	classes, err := bt.getSemanticClasses(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get semantic classes")
		return
	}

	totalOptimizations := 0
	_ = 0 // appliedOptimizations - unused for now
	canaryDeployments := 0

	for _, class := range classes {
		result, err := bt.optimizeWeightsBayesian(ctx, class)
		if err != nil {
			log.Error().Err(err).Str("class", class).Msg("Failed to optimize weights")
			continue
		}

		if result == nil {
			continue // Insufficient data
		}

		totalOptimizations++

		// Record tuning history
		if err := bt.recordBayesianTuning(ctx, result); err != nil {
			log.Error().Err(err).Msg("Failed to record tuning history")
		}

		// Apply if posterior confidence meets threshold
		if result.PosteriorConfidence >= bt.posteriorConfidence && result.ExpectedImprovement > 0 {
			// Stage 1: Canary rollout to 1% of tenants
			if err := bt.applyCanaryWeights(ctx, class, result); err != nil {
				log.Error().Err(err).Msg("Failed to apply canary weights")
				continue
			}

			canaryDeployments++
			result.CanaryOnly = true
			result.Applied = true

			// observability.RecordBayesianTuningApplied(class, result.ExpectedImprovement, result.PosteriorConfidence, true) // TODO: Implement

			log.Info().
				Str("class", class).
				Float64("expected_improvement", result.ExpectedImprovement).
				Float64("posterior_confidence", result.PosteriorConfidence).
				Msg("Weights applied to canary tenants (1%)")
		} else {
			// observability.RecordBayesianTuningApplied(class, result.ExpectedImprovement, result.PosteriorConfidence, false) // TODO: Implement

			log.Info().
				Str("class", class).
				Float64("expected_improvement", result.ExpectedImprovement).
				Float64("posterior_confidence", result.PosteriorConfidence).
				Msg("Weights not applied (low confidence or negative improvement)")
		}
	}

	log.Info().
		Int("total_optimizations", totalOptimizations).
		Int("applied_to_canary", canaryDeployments).
		Msg("Bayesian optimization cycle completed")
}

// optimizeWeightsBayesian performs Bayesian optimization for weight tuning
func (bt *BayesianTuner) optimizeWeightsBayesian(ctx context.Context, class string) (*BayesianTuningResult, error) {
	// Collect recent reward data
	endTime := time.Now()
	startTime := endTime.Add(-7 * 24 * time.Hour)

	data, err := bt.collectRewardData(ctx, class, startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("failed to collect reward data: %w", err)
	}

	if len(data.CompositeRewards) < bt.minSampleSize {
		log.Debug().
			Str("class", class).
			Int("sample_size", len(data.CompositeRewards)).
			Msg("Insufficient data for Bayesian optimization")
		return nil, nil
	}

	// Get current weights
	oldWeights := bt.rewardEngine.GetWeights(class)

	// Define priors (current weights as prior mean, with uncertainty)
	priors := map[string]WeightPrior{
		"latency": {Mean: oldWeights.Latency, Std: 0.1},
		"cost":    {Mean: oldWeights.Cost, Std: 0.1},
		"success": {Mean: oldWeights.Success, Std: 0.1},
	}

	// Compute posterior distributions via Bayesian updating
	posteriors := bt.computePosteriors(data, priors)

	// Sample from posteriors to get new weights
	newWeights := bt.sampleOptimalWeights(posteriors)

	// Ensure weights sum to 1.0
	newWeights = bt.normalizeWeights(newWeights)

	// Estimate expected improvement
	expectedImprovement := bt.estimateImprovement(data, oldWeights, newWeights)

	// Calculate overall posterior confidence (min of individual confidences)
	posteriorConfidence := bt.calculatePosteriorConfidence(posteriors)

	return &BayesianTuningResult{
		SemanticClass:       class,
		OldWeights:          oldWeights,
		NewWeights:          newWeights,
		PosteriorMean:       extractMeans(posteriors),
		PosteriorStd:        extractStds(posteriors),
		ExpectedImprovement: expectedImprovement,
		PosteriorConfidence: posteriorConfidence,
		SampleSize:          len(data.CompositeRewards),
		Algorithm:           "bayesian_optimization",
		Applied:             false,
		CanaryOnly:          false,
	}, nil
}

// computePosteriors computes posterior distributions using Bayesian updating
func (bt *BayesianTuner) computePosteriors(data *MetricData, priors map[string]WeightPrior) map[string]PosteriorDistribution {
	posteriors := make(map[string]PosteriorDistribution)

	// For each weight parameter, compute posterior via conjugate prior update
	// Using Normal-Normal conjugate model (simplified Bayesian update)

	// Analyze reward sensitivity to each metric
	latencySensitivity := bt.computeSensitivity(data.Latencies, data.CompositeRewards)
	costSensitivity := bt.computeSensitivity(data.Costs, data.CompositeRewards)
	successSensitivity := bt.computeSensitivity(data.SuccessRates, data.CompositeRewards)

	// Update priors with observed sensitivities
	posteriors["latency"] = bt.updatePosterior(priors["latency"], latencySensitivity, len(data.Latencies))
	posteriors["cost"] = bt.updatePosterior(priors["cost"], costSensitivity, len(data.Costs))
	posteriors["success"] = bt.updatePosterior(priors["success"], successSensitivity, len(data.SuccessRates))

	return posteriors
}

// updatePosterior performs Bayesian update: Prior + Likelihood → Posterior
func (bt *BayesianTuner) updatePosterior(prior WeightPrior, observedSensitivity float64, sampleSize int) PosteriorDistribution {
	// Normal-Normal conjugate prior update
	// Posterior precision = Prior precision + Data precision
	priorPrecision := 1.0 / (prior.Std * prior.Std)
	dataPrecision := float64(sampleSize) / 0.01 // Assuming data std = 0.1

	posteriorPrecision := priorPrecision + dataPrecision
	posteriorVariance := 1.0 / posteriorPrecision
	posteriorStd := math.Sqrt(posteriorVariance)

	// Posterior mean is weighted average of prior mean and observed sensitivity
	posteriorMean := (priorPrecision*prior.Mean + dataPrecision*observedSensitivity) / posteriorPrecision

	// Confidence based on effective sample size and posterior narrowing
	confidence := 1.0 - (posteriorStd / prior.Std)

	return PosteriorDistribution{
		Mean:       posteriorMean,
		Std:        posteriorStd,
		Confidence: math.Max(0, math.Min(1.0, confidence)),
	}
}

// computeSensitivity calculates sensitivity (correlation) between metric and reward
func (bt *BayesianTuner) computeSensitivity(metric []float64, rewards []float64) float64 {
	if len(metric) != len(rewards) || len(metric) == 0 {
		return 0.0
	}

	// Compute Pearson correlation coefficient
	meanMetric := mean(metric)
	meanReward := mean(rewards)

	var numerator, denomMetric, denomReward float64
	for i := range metric {
		diffMetric := metric[i] - meanMetric
		diffReward := rewards[i] - meanReward

		numerator += diffMetric * diffReward
		denomMetric += diffMetric * diffMetric
		denomReward += diffReward * diffReward
	}

	if denomMetric == 0 || denomReward == 0 {
		return 0.0
	}

	correlation := numerator / math.Sqrt(denomMetric*denomReward)

	// Convert correlation to weight sensitivity (absolute value, normalized)
	sensitivity := math.Abs(correlation)

	return sensitivity
}

// sampleOptimalWeights samples from posteriors to get optimized weights
func (bt *BayesianTuner) sampleOptimalWeights(posteriors map[string]PosteriorDistribution) bandit.RewardWeights {
	// Use posterior means as the optimal point (maximum a posteriori estimate)
	return bandit.RewardWeights{
		Latency: posteriors["latency"].Mean,
		Cost:    posteriors["cost"].Mean,
		Success: posteriors["success"].Mean,
	}
}

// normalizeWeights ensures weights sum to 1.0
func (bt *BayesianTuner) normalizeWeights(weights bandit.RewardWeights) bandit.RewardWeights {
	sum := weights.Latency + weights.Cost + weights.Success

	if sum == 0 {
		// Return default equal weights
		return bandit.RewardWeights{Latency: 0.333, Cost: 0.333, Success: 0.334}
	}

	return bandit.RewardWeights{
		Latency: weights.Latency / sum,
		Cost:    weights.Cost / sum,
		Success: weights.Success / sum,
	}
}

// estimateImprovement estimates expected performance improvement
func (bt *BayesianTuner) estimateImprovement(data *MetricData, oldWeights, newWeights bandit.RewardWeights) float64 {
	if len(data.CompositeRewards) == 0 {
		return 0.0
	}

	// Simulate reward with new weights
	var oldRewardSum, newRewardSum float64

	for i := range data.Latencies {
		// Normalize metrics (simplified)
		normalizedLatency := 1.0 - math.Min(data.Latencies[i]/500.0, 1.0)
		normalizedCost := 1.0 - math.Min(data.Costs[i]/0.01, 1.0)
		normalizedSuccess := data.SuccessRates[i]

		oldReward := oldWeights.Latency*normalizedLatency +
			oldWeights.Cost*normalizedCost +
			oldWeights.Success*normalizedSuccess

		newReward := newWeights.Latency*normalizedLatency +
			newWeights.Cost*normalizedCost +
			newWeights.Success*normalizedSuccess

		oldRewardSum += oldReward
		newRewardSum += newReward
	}

	oldAvg := oldRewardSum / float64(len(data.Latencies))
	newAvg := newRewardSum / float64(len(data.Latencies))

	improvement := ((newAvg - oldAvg) / oldAvg) * 100.0 // Percentage improvement

	return improvement
}

// calculatePosteriorConfidence computes overall confidence from posteriors
func (bt *BayesianTuner) calculatePosteriorConfidence(posteriors map[string]PosteriorDistribution) float64 {
	// Use minimum confidence across all parameters (conservative approach)
	minConfidence := 1.0

	for _, posterior := range posteriors {
		if posterior.Confidence < minConfidence {
			minConfidence = posterior.Confidence
		}
	}

	return minConfidence
}

// applyCanaryWeights applies new weights to canary tenants only
func (bt *BayesianTuner) applyCanaryWeights(ctx context.Context, class string, result *BayesianTuningResult) error {
	// Get canary tenant list (1% random sample)
	canaryTenants, err := bt.selectCanaryTenants(ctx)
	if err != nil {
		return fmt.Errorf("failed to select canary tenants: %w", err)
	}

	log.Info().
		Str("class", class).
		Int("canary_count", len(canaryTenants)).
		Msg("Applying weights to canary tenants")

	// Store canary weights in separate table for gradual rollout
	for _, tenantID := range canaryTenants {
		err := bt.storeCanaryWeights(ctx, tenantID, class, result.NewWeights)
		if err != nil {
			log.Error().Err(err).Str("tenant", tenantID).Msg("Failed to store canary weights")
		}
	}

	// Record canary deployment
	// observability.RecordCanaryDeployment(class, len(canaryTenants)) // TODO: Implement
	_ = len(canaryTenants) // Silence unused warning

	return nil
}

// selectCanaryTenants selects 1% of tenants for canary testing
func (bt *BayesianTuner) selectCanaryTenants(ctx context.Context) ([]string, error) {
	query := `
		SELECT tenant_id
		FROM tenants
		WHERE active = true
		ORDER BY RANDOM()
		LIMIT (SELECT CEIL(COUNT(*) * $1) FROM tenants WHERE active = true)
	`

	rows, err := bt.db.QueryContext(ctx, query, bt.canaryPercentage)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tenants := []string{}
	for rows.Next() {
		var tenantID string
		if err := rows.Scan(&tenantID); err != nil {
			return nil, err
		}
		tenants = append(tenants, tenantID)
	}

	return tenants, rows.Err()
}

// storeCanaryWeights stores canary weights for gradual rollout
func (bt *BayesianTuner) storeCanaryWeights(ctx context.Context, tenantID, class string, weights bandit.RewardWeights) error {
	weightsJSON, _ := json.Marshal(map[string]float64{
		"latency": weights.Latency,
		"cost":    weights.Cost,
		"success": weights.Success,
	})

	query := `
		INSERT INTO canary_weights (tenant_id, semantic_class, weights, deployed_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (tenant_id, semantic_class)
		DO UPDATE SET weights = EXCLUDED.weights, deployed_at = NOW()
	`

	_, err := bt.db.ExecContext(ctx, query, tenantID, class, weightsJSON)
	return err
}

// Helper functions

func (bt *BayesianTuner) collectRewardData(ctx context.Context, class string, start, end time.Time) (*MetricData, error) {
	// Reuse existing collectMetricData implementation
	query := `
		SELECT latency_ms, cost_usd, success, reward
		FROM feedback_events
		WHERE semantic_class = $1
		  AND created_at >= $2
		  AND created_at < $3
		ORDER BY created_at
	`

	rows, err := bt.db.QueryContext(ctx, query, class, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	data := &MetricData{
		Latencies:        []float64{},
		Costs:            []float64{},
		SuccessRates:     []float64{},
		CompositeRewards: []float64{},
	}

	for rows.Next() {
		var latency, cost, reward float64
		var success bool

		if err := rows.Scan(&latency, &cost, &success, &reward); err != nil {
			return nil, err
		}

		data.Latencies = append(data.Latencies, latency)
		data.Costs = append(data.Costs, cost)
		if success {
			data.SuccessRates = append(data.SuccessRates, 1.0)
		} else {
			data.SuccessRates = append(data.SuccessRates, 0.0)
		}
		data.CompositeRewards = append(data.CompositeRewards, reward)
	}

	return data, rows.Err()
}

func (bt *BayesianTuner) getSemanticClasses(ctx context.Context) ([]string, error) {
	query := `SELECT DISTINCT semantic_class FROM feedback_events WHERE created_at >= NOW() - INTERVAL '7 days'`

	rows, err := bt.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	classes := []string{}
	for rows.Next() {
		var class string
		if err := rows.Scan(&class); err != nil {
			return nil, err
		}
		classes = append(classes, class)
	}

	return classes, rows.Err()
}

func (bt *BayesianTuner) recordBayesianTuning(ctx context.Context, result *BayesianTuningResult) error {
	oldWeightsJSON, _ := json.Marshal(result.OldWeights)
	newWeightsJSON, _ := json.Marshal(result.NewWeights)
	posteriorMeanJSON, _ := json.Marshal(result.PosteriorMean)
	posteriorStdJSON, _ := json.Marshal(result.PosteriorStd)

	query := `
		INSERT INTO self_tuning_history (
			semantic_class, old_weights, new_weights, posterior_mean, posterior_std,
			expected_improvement_percent, posterior_confidence, sample_size,
			algorithm, applied, canary_only, tuned_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
	`

	_, err := bt.db.ExecContext(ctx, query,
		result.SemanticClass,
		oldWeightsJSON,
		newWeightsJSON,
		posteriorMeanJSON,
		posteriorStdJSON,
		result.ExpectedImprovement,
		result.PosteriorConfidence,
		result.SampleSize,
		result.Algorithm,
		result.Applied,
		result.CanaryOnly,
	)

	return err
}

func mean(values []float64) float64 {
	if len(values) == 0 {
		return 0.0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func extractMeans(posteriors map[string]PosteriorDistribution) map[string]float64 {
	means := make(map[string]float64)
	for key, dist := range posteriors {
		means[key] = dist.Mean
	}
	return means
}

func extractStds(posteriors map[string]PosteriorDistribution) map[string]float64 {
	stds := make(map[string]float64)
	for key, dist := range posteriors {
		stds[key] = dist.Std
	}
	return stds
}
