package router

import (
	"github.com/Igris-inertial/system/igris-overture/inference/optimizer/ffi"
	"github.com/Igris-inertial/system/igris-overture/inference/quality"
	"github.com/Igris-inertial/system/igris-overture/models"
)

// RewardPolicyBuilder builds reward policies based on customer preferences
type RewardPolicyBuilder struct{}

// NewRewardPolicyBuilder creates a new reward policy builder
func NewRewardPolicyBuilder() *RewardPolicyBuilder {
	return &RewardPolicyBuilder{}
}

// BuildRewardPolicy creates a reward policy from customer preferences and request classification
func (b *RewardPolicyBuilder) BuildRewardPolicy(
	prefs *models.CustomerRoutingPreferences,
	classification *quality.RequestClassification,
) ffi.RewardPolicy {
	// Get base weights from customer preferences
	var weights models.RewardWeights
	if classification != nil {
		// Use domain-specific weights if classification is available
		weights = prefs.GetDomainWeights(classification.Domain)
	} else {
		// Use general weights
		weights = prefs.GetRewardWeights()
	}

	// Adjust weights based on quality sensitivity if classification is available
	if classification != nil {
		weights = b.adjustWeightsForSensitivity(weights, classification)
	}

	// Build target and max values
	targetLatency := 500.0  // Default target latency: 500ms
	maxLatency := 5000.0    // Default max latency: 5s
	targetCost := 0.001     // Default target cost: $0.001
	maxCost := 0.1          // Default max cost: $0.10

	// Apply customer constraints if specified
	if prefs.MaxLatencyMs != nil {
		maxLatency = float64(*prefs.MaxLatencyMs)
		targetLatency = maxLatency * 0.5 // Target is 50% of max
	}

	if prefs.MaxCostPerRequest != nil {
		maxCost = *prefs.MaxCostPerRequest
		targetCost = maxCost * 0.5 // Target is 50% of max
	}

	return ffi.RewardPolicy{
		LatencyWeight:   weights.Latency,
		SuccessWeight:   weights.Success,
		CacheWeight:     0.0, // Cache not yet implemented
		CostWeight:      weights.Cost,
		QualityWeight:   weights.Quality,
		TargetLatencyMs: targetLatency,
		MaxLatencyMs:    maxLatency,
		TargetCostUsd:   targetCost,
		MaxCostUsd:      maxCost,
	}
}

// adjustWeightsForSensitivity adjusts reward weights based on quality sensitivity
func (b *RewardPolicyBuilder) adjustWeightsForSensitivity(
	weights models.RewardWeights,
	classification *quality.RequestClassification,
) models.RewardWeights {
	// For high quality sensitivity, boost quality weight
	switch classification.QualitySensitivity {
	case "high":
		// Increase quality weight by 20%, decrease cost weight
		boost := 0.2
		weights.Quality += boost
		weights.Cost -= boost * 0.5
		weights.Latency -= boost * 0.3
		weights.Success -= boost * 0.2
	case "low":
		// Decrease quality weight by 10%, increase cost weight
		reduction := 0.1
		weights.Quality -= reduction
		weights.Cost += reduction * 0.6
		weights.Latency += reduction * 0.4
	}

	// Normalize weights to ensure they sum to ~1.0
	weights = b.normalizeWeights(weights)

	return weights
}

// normalizeWeights normalizes weights to sum to 1.0
func (b *RewardPolicyBuilder) normalizeWeights(weights models.RewardWeights) models.RewardWeights {
	sum := weights.Latency + weights.Success + weights.Quality + weights.Cost

	if sum == 0 {
		// Avoid division by zero, return balanced weights
		return models.RewardWeights{
			Latency: 0.25,
			Success: 0.25,
			Quality: 0.30,
			Cost:    0.20,
		}
	}

	// Normalize
	weights.Latency = weights.Latency / sum
	weights.Success = weights.Success / sum
	weights.Quality = weights.Quality / sum
	weights.Cost = weights.Cost / sum

	return weights
}

// GetPresetWeights returns preset weights for a given optimization mode
func GetPresetWeights(mode models.OptimizationMode) models.RewardWeights {
	switch mode {
	case models.OptimizationModeCost:
		return models.RewardWeights{
			Latency: 0.3,
			Success: 0.3,
			Quality: 0.1,
			Cost:    0.3,
		}
	case models.OptimizationModeBalanced:
		return models.RewardWeights{
			Latency: 0.25,
			Success: 0.25,
			Quality: 0.30,
			Cost:    0.20,
		}
	case models.OptimizationModeQuality:
		return models.RewardWeights{
			Latency: 0.15,
			Success: 0.20,
			Quality: 0.50,
			Cost:    0.15,
		}
	default:
		// Default to balanced
		return models.RewardWeights{
			Latency: 0.25,
			Success: 0.25,
			Quality: 0.30,
			Cost:    0.20,
		}
	}
}
