package bandit

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"sync"
	"time"

	exprand "golang.org/x/exp/rand"

	"github.com/Igris-inertial/system/igris-overture/observability"
	"gonum.org/v1/gonum/stat/distuv"
)

// Thread-safe random source for Thompson Sampling
var rng = exprand.New(exprand.NewSource(uint64(time.Now().UnixNano())))

// RewardEngine implements composite reward calculation for Thompson Sampling
type RewardEngine struct {
	db                *sql.DB
	mu                sync.RWMutex
	defaultWeights    RewardWeights
	classWeights      map[string]RewardWeights
	normalizationMax  NormalizationParams
}

// RewardWeights represents the α, β, γ weights for composite reward
type RewardWeights struct {
	Latency float64 // α - weight for latency score
	Cost    float64 // β - weight for cost efficiency
	Success float64 // γ - weight for success rate
}

// NormalizationParams defines the maximum values for normalization
type NormalizationParams struct {
	MaxLatencyMs float64 // Maximum latency for normalization (e.g., 5000ms)
	MaxCostUSD   float64 // Maximum cost for normalization (e.g., $1.00)
}

// RewardComponents contains the individual components of the composite reward
type RewardComponents struct {
	LatencyScore   float64 // 0-1, higher is better (normalized)
	CostEfficiency float64 // 0-1, higher is better (normalized)
	SuccessRate    float64 // 0-1, 1.0 if success, 0.0 if failure
}

// CompositeReward represents the calculated composite reward
type CompositeReward struct {
	Total      float64
	Components RewardComponents
	Weights    RewardWeights
}

// BanditArm represents a provider-semantic_class pair with Thompson Sampling parameters
type BanditArm struct {
	ID                  string
	ProviderID          string
	SemanticClass       string
	Alpha               float64
	Beta                float64
	TotalSelections     int
	TotalSuccesses      int
	TotalFailures       int
	AvgLatencyScore     float64
	AvgCostEfficiency   float64
	AvgSuccessRate      float64
	CompositeReward     float64
	Weights             RewardWeights
	UpdatedAt           time.Time
}

// NewRewardEngine creates a new reward engine
func NewRewardEngine(db *sql.DB) *RewardEngine {
	return &RewardEngine{
		db: db,
		defaultWeights: RewardWeights{
			Latency: 0.33,
			Cost:    0.33,
			Success: 0.34,
		},
		classWeights: make(map[string]RewardWeights),
		normalizationMax: NormalizationParams{
			MaxLatencyMs: 5000.0,  // 5 seconds
			MaxCostUSD:   1.0,     // $1.00
		},
	}
}

// CalculateCompositeReward computes the composite reward from inference metrics
func (re *RewardEngine) CalculateCompositeReward(
	latencyMs int64,
	costUSD float64,
	success bool,
	semanticClass string,
) CompositeReward {
	weights := re.GetWeights(semanticClass)

	// Calculate individual components (normalized 0-1)
	latencyScore := re.normalizeLatency(float64(latencyMs))
	costEfficiency := re.normalizeCost(costUSD)
	successRate := 0.0
	if success {
		successRate = 1.0
	}

	// Calculate composite reward: α·latency + β·cost + γ·success
	total := (weights.Latency * latencyScore) +
		(weights.Cost * costEfficiency) +
		(weights.Success * successRate)

	return CompositeReward{
		Total: total,
		Components: RewardComponents{
			LatencyScore:   latencyScore,
			CostEfficiency: costEfficiency,
			SuccessRate:    successRate,
		},
		Weights: weights,
	}
}

// normalizeLatency converts latency to a 0-1 score (lower latency = higher score)
func (re *RewardEngine) normalizeLatency(latencyMs float64) float64 {
	if latencyMs <= 0 {
		return 1.0
	}

	// Inverse normalization: score = 1 - (latency / max_latency)
	score := 1.0 - (latencyMs / re.normalizationMax.MaxLatencyMs)

	// Clamp to [0, 1]
	if score < 0 {
		return 0.0
	}
	if score > 1 {
		return 1.0
	}

	return score
}

// normalizeCost converts cost to a 0-1 efficiency score (lower cost = higher score)
func (re *RewardEngine) normalizeCost(costUSD float64) float64 {
	if costUSD <= 0 {
		return 1.0
	}

	// Inverse normalization: efficiency = 1 - (cost / max_cost)
	efficiency := 1.0 - (costUSD / re.normalizationMax.MaxCostUSD)

	// Clamp to [0, 1]
	if efficiency < 0 {
		return 0.0
	}
	if efficiency > 1 {
		return 1.0
	}

	return efficiency
}

// UpdateBanditArm updates the Thompson Sampling parameters for a provider-class pair
func (re *RewardEngine) UpdateBanditArm(
	ctx context.Context,
	providerID string,
	semanticClass string,
	reward CompositeReward,
	success bool,
) error {
	startTime := time.Now()

	// Call the database stored procedure to update bandit arm
	query := `
		SELECT update_bandit_arm_from_feedback(
			$1::UUID,           -- provider_id
			$2::VARCHAR,        -- semantic_class
			$3::BOOLEAN,        -- success
			$4::DECIMAL,        -- latency_score
			$5::DECIMAL,        -- cost_efficiency
			$6::DECIMAL,        -- success_rate
			$7::DECIMAL,        -- weight_latency
			$8::DECIMAL,        -- weight_cost
			$9::DECIMAL         -- weight_success
		)
	`

	var armID string
	err := re.db.QueryRowContext(ctx, query,
		providerID,
		semanticClass,
		success,
		reward.Components.LatencyScore,
		reward.Components.CostEfficiency,
		reward.Components.SuccessRate,
		reward.Weights.Latency,
		reward.Weights.Cost,
		reward.Weights.Success,
	).Scan(&armID)

	if err != nil {
		observability.RecordBanditRewardUpdate(providerID, semanticClass, 0, false)
		return fmt.Errorf("failed to update bandit arm: %w", err)
	}

	latencyMs := time.Since(startTime).Milliseconds()

	// Record metrics
	observability.RecordBanditRewardUpdate(providerID, semanticClass, latencyMs, true)
	observability.RecordCompositeRewardComponents(
		providerID,
		semanticClass,
		reward.Components.LatencyScore,
		reward.Components.CostEfficiency,
		reward.Components.SuccessRate,
	)

	return nil
}

// GetBanditArm retrieves the current state of a bandit arm
func (re *RewardEngine) GetBanditArm(ctx context.Context, providerID, semanticClass string) (*BanditArm, error) {
	query := `
		SELECT
			id, provider_id, semantic_class, alpha, beta,
			total_selections, total_successes, total_failures,
			avg_latency_score, avg_cost_efficiency, avg_success_rate,
			composite_reward,
			weight_latency, weight_cost, weight_success,
			updated_at
		FROM bandit_arms
		WHERE provider_id = $1 AND semantic_class = $2
	`

	var arm BanditArm
	err := re.db.QueryRowContext(ctx, query, providerID, semanticClass).Scan(
		&arm.ID,
		&arm.ProviderID,
		&arm.SemanticClass,
		&arm.Alpha,
		&arm.Beta,
		&arm.TotalSelections,
		&arm.TotalSuccesses,
		&arm.TotalFailures,
		&arm.AvgLatencyScore,
		&arm.AvgCostEfficiency,
		&arm.AvgSuccessRate,
		&arm.CompositeReward,
		&arm.Weights.Latency,
		&arm.Weights.Cost,
		&arm.Weights.Success,
		&arm.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			// Return default arm if not found
			return &BanditArm{
				ProviderID:    providerID,
				SemanticClass: semanticClass,
				Alpha:         1.0,
				Beta:          1.0,
				Weights:       re.GetWeights(semanticClass),
			}, nil
		}
		return nil, fmt.Errorf("failed to get bandit arm: %w", err)
	}

	// Record current parameters as metrics
	observability.RecordProviderReward(
		providerID,
		semanticClass,
		arm.Alpha,
		arm.Beta,
		arm.CompositeReward,
	)

	return &arm, nil
}

// GetAllArmsForClass retrieves all bandit arms for a semantic class
func (re *RewardEngine) GetAllArmsForClass(ctx context.Context, semanticClass string) ([]*BanditArm, error) {
	query := `
		SELECT
			id, provider_id, semantic_class, alpha, beta,
			total_selections, total_successes, total_failures,
			avg_latency_score, avg_cost_efficiency, avg_success_rate,
			composite_reward,
			weight_latency, weight_cost, weight_success,
			updated_at
		FROM bandit_arms
		WHERE semantic_class = $1
		ORDER BY composite_reward DESC
	`

	rows, err := re.db.QueryContext(ctx, query, semanticClass)
	if err != nil {
		return nil, fmt.Errorf("failed to query bandit arms: %w", err)
	}
	defer rows.Close()

	var arms []*BanditArm
	for rows.Next() {
		var arm BanditArm
		if err := rows.Scan(
			&arm.ID,
			&arm.ProviderID,
			&arm.SemanticClass,
			&arm.Alpha,
			&arm.Beta,
			&arm.TotalSelections,
			&arm.TotalSuccesses,
			&arm.TotalFailures,
			&arm.AvgLatencyScore,
			&arm.AvgCostEfficiency,
			&arm.AvgSuccessRate,
			&arm.CompositeReward,
			&arm.Weights.Latency,
			&arm.Weights.Cost,
			&arm.Weights.Success,
			&arm.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}
		arms = append(arms, &arm)

		// Record metrics for this arm
		observability.RecordProviderReward(
			arm.ProviderID,
			arm.SemanticClass,
			arm.Alpha,
			arm.Beta,
			arm.CompositeReward,
		)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}

	return arms, nil
}

// SelectArmThompsonSampling performs Thompson Sampling to select the best provider
func (re *RewardEngine) SelectArmThompsonSampling(arms []*BanditArm, explorationRate float64) *BanditArm {
	if len(arms) == 0 {
		return nil
	}

	// Exploration: random selection with probability epsilon
	if shouldExplore(explorationRate) {
		return arms[randomInt(len(arms))]
	}

	// Exploitation: sample from Beta distribution for each arm
	var bestArm *BanditArm
	maxSample := -1.0

	for _, arm := range arms {
		// Sample from Beta(α, β)
		sample := sampleBeta(arm.Alpha, arm.Beta)

		if sample > maxSample {
			maxSample = sample
			bestArm = arm
		}
	}

	return bestArm
}

// sampleBeta samples from a Beta distribution using gonum's proper implementation
// This provides true Thompson Sampling with correct posterior uncertainty quantification
func sampleBeta(alpha, beta float64) float64 {
	// Handle edge cases with uniform prior
	if alpha <= 0 || beta <= 0 {
		return 0.5
	}

	// Use minimum values to prevent numerical instability
	if alpha < 0.01 {
		alpha = 0.01
	}
	if beta < 0.01 {
		beta = 0.01
	}

	// Create Beta distribution with gonum and sample from it
	dist := distuv.Beta{
		Alpha: alpha,
		Beta:  beta,
		Src:   rng,
	}

	// Sample from the Beta distribution - this provides proper uncertainty quantification
	// for Thompson Sampling, unlike the mean approximation
	sample := dist.Rand()

	// Clamp to [0, 1] to handle any numerical edge cases
	if sample < 0 {
		return 0.0
	}
	if sample > 1 {
		return 1.0
	}

	return sample
}

// shouldExplore returns true with probability explorationRate
func shouldExplore(explorationRate float64) bool {
	return randomFloat() < explorationRate
}

// randomFloat returns a random float between 0 and 1 using a proper RNG
func randomFloat() float64 {
	return rng.Float64()
}

// randomInt returns a random integer between 0 and max (exclusive) using a proper RNG
func randomInt(max int) int {
	if max <= 0 {
		return 0
	}
	return rng.Intn(max)
}

// SetWeights sets the reward weights for a specific semantic class
func (re *RewardEngine) SetWeights(semanticClass string, weights RewardWeights) error {
	// Validate that weights sum to approximately 1.0
	sum := weights.Latency + weights.Cost + weights.Success
	if math.Abs(sum-1.0) > 0.01 {
		return fmt.Errorf("weights must sum to 1.0, got %.3f", sum)
	}

	re.mu.Lock()
	defer re.mu.Unlock()

	if semanticClass == "" {
		re.defaultWeights = weights
	} else {
		re.classWeights[semanticClass] = weights
	}

	// Record metrics
	observability.RecordCompositeRewardWeights(
		semanticClass,
		weights.Latency,
		weights.Cost,
		weights.Success,
	)

	return nil
}

// GetWeights retrieves the weights for a semantic class
func (re *RewardEngine) GetWeights(semanticClass string) RewardWeights {
	re.mu.RLock()
	defer re.mu.RUnlock()

	if weights, exists := re.classWeights[semanticClass]; exists {
		return weights
	}

	return re.defaultWeights
}

// SetNormalizationParams updates the normalization parameters
func (re *RewardEngine) SetNormalizationParams(maxLatencyMs, maxCostUSD float64) {
	re.mu.Lock()
	defer re.mu.Unlock()

	re.normalizationMax = NormalizationParams{
		MaxLatencyMs: maxLatencyMs,
		MaxCostUSD:   maxCostUSD,
	}
}

// GetArmStats returns statistics for a bandit arm
func (arm *BanditArm) GetMean() float64 {
	if arm.Alpha+arm.Beta == 0 {
		return 0.5
	}
	return arm.Alpha / (arm.Alpha + arm.Beta)
}

// GetVariance returns the variance of the Beta distribution
func (arm *BanditArm) GetVariance() float64 {
	if arm.Alpha+arm.Beta == 0 {
		return 0.25
	}

	sum := arm.Alpha + arm.Beta
	return (arm.Alpha * arm.Beta) / (sum * sum * (sum + 1))
}

// GetSuccessRate returns the empirical success rate
func (arm *BanditArm) GetSuccessRate() float64 {
	if arm.TotalSelections == 0 {
		return 0.0
	}
	return float64(arm.TotalSuccesses) / float64(arm.TotalSelections)
}
