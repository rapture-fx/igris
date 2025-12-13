package models

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// OptimizationMode defines the routing optimization strategy
type OptimizationMode string

const (
	OptimizationModeCost    OptimizationMode = "cost"
	OptimizationModeBalanced OptimizationMode = "balanced"
	OptimizationModeQuality  OptimizationMode = "quality"
	OptimizationModeCustom   OptimizationMode = "custom"
)

// CustomerRoutingPreferences represents routing preferences for a customer
type CustomerRoutingPreferences struct {
	TenantID         string           `json:"tenant_id" db:"tenant_id"`
	OptimizationMode OptimizationMode `json:"optimization_mode" db:"optimization_mode"`

	// Custom weights (only used if mode == "custom")
	LatencyWeight *float64 `json:"latency_weight,omitempty" db:"latency_weight"`
	QualityWeight *float64 `json:"quality_weight,omitempty" db:"quality_weight"`
	CostWeight    *float64 `json:"cost_weight,omitempty" db:"cost_weight"`

	// Constraints
	MaxCostPerRequest *float64 `json:"max_cost_per_request,omitempty" db:"max_cost_per_request"`
	MinQualityScore   *float64 `json:"min_quality_score,omitempty" db:"min_quality_score"`
	MaxLatencyMs      *int     `json:"max_latency_ms,omitempty" db:"max_latency_ms"`

	// Domain-specific preferences
	DomainPreferences DomainPreferenceMap `json:"domain_preferences,omitempty" db:"domain_preferences"`

	// Metadata
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// DomainPreference represents routing preferences for a specific domain
type DomainPreference struct {
	Domain        string  `json:"domain"`
	QualityWeight float64 `json:"quality_weight"`
	CostWeight    float64 `json:"cost_weight"`
}

// DomainPreferenceMap is a map of domain to preferences
type DomainPreferenceMap map[string]DomainPreference

// Value implements driver.Valuer for DomainPreferenceMap
func (dpm DomainPreferenceMap) Value() (driver.Value, error) {
	if dpm == nil {
		return nil, nil
	}
	return json.Marshal(dpm)
}

// Scan implements sql.Scanner for DomainPreferenceMap
func (dpm *DomainPreferenceMap) Scan(value interface{}) error {
	if value == nil {
		*dpm = nil
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return errors.New("failed to scan DomainPreferenceMap: not a byte slice")
	}

	var result map[string]DomainPreference
	if err := json.Unmarshal(bytes, &result); err != nil {
		return err
	}

	*dpm = result
	return nil
}

// GetRewardWeights returns the reward weights based on the optimization mode
func (prefs *CustomerRoutingPreferences) GetRewardWeights() RewardWeights {
	switch prefs.OptimizationMode {
	case OptimizationModeCost:
		return RewardWeights{
			Latency: 0.3,
			Success: 0.3,
			Quality: 0.1,
			Cost:    0.3,
		}
	case OptimizationModeBalanced:
		return RewardWeights{
			Latency: 0.25,
			Success: 0.25,
			Quality: 0.30,
			Cost:    0.20,
		}
	case OptimizationModeQuality:
		return RewardWeights{
			Latency: 0.15,
			Success: 0.20,
			Quality: 0.50,
			Cost:    0.15,
		}
	case OptimizationModeCustom:
		// Use custom weights if provided
		if prefs.LatencyWeight != nil && prefs.QualityWeight != nil && prefs.CostWeight != nil {
			latency := *prefs.LatencyWeight
			quality := *prefs.QualityWeight
			cost := *prefs.CostWeight
			// Success weight is the remainder to sum to 1.0
			success := 1.0 - (latency + quality + cost)
			if success < 0 {
				success = 0
			}
			return RewardWeights{
				Latency: latency,
				Success: success,
				Quality: quality,
				Cost:    cost,
			}
		}
		// Fallback to balanced if custom weights are incomplete
		return RewardWeights{
			Latency: 0.25,
			Success: 0.25,
			Quality: 0.30,
			Cost:    0.20,
		}
	default:
		// Default to balanced
		return RewardWeights{
			Latency: 0.25,
			Success: 0.25,
			Quality: 0.30,
			Cost:    0.20,
		}
	}
}

// GetDomainWeights returns reward weights adjusted for a specific domain
func (prefs *CustomerRoutingPreferences) GetDomainWeights(domain string) RewardWeights {
	// Start with base weights
	weights := prefs.GetRewardWeights()

	// Apply domain-specific overrides if they exist
	if domainPref, ok := prefs.DomainPreferences[domain]; ok {
		weights.Quality = domainPref.QualityWeight
		weights.Cost = domainPref.CostWeight

		// Re-normalize: distribute remaining weight between latency and success
		remaining := 1.0 - (weights.Quality + weights.Cost)
		if remaining < 0 {
			remaining = 0
		}

		// Split remaining weight between latency and success
		weights.Latency = remaining * 0.6
		weights.Success = remaining * 0.4
	}

	return weights
}

// Validate checks if the preferences are valid
func (prefs *CustomerRoutingPreferences) Validate() error {
	// Validate optimization mode
	validModes := map[OptimizationMode]bool{
		OptimizationModeCost:     true,
		OptimizationModeBalanced: true,
		OptimizationModeQuality:  true,
		OptimizationModeCustom:   true,
	}

	if !validModes[prefs.OptimizationMode] {
		return errors.New("invalid optimization mode")
	}

	// Validate custom weights if mode is custom
	if prefs.OptimizationMode == OptimizationModeCustom {
		if prefs.LatencyWeight == nil || prefs.QualityWeight == nil || prefs.CostWeight == nil {
			return errors.New("custom mode requires latency_weight, quality_weight, and cost_weight")
		}

		sum := *prefs.LatencyWeight + *prefs.QualityWeight + *prefs.CostWeight
		if sum > 1.0 {
			return errors.New("sum of weights cannot exceed 1.0")
		}

		if *prefs.LatencyWeight < 0 || *prefs.QualityWeight < 0 || *prefs.CostWeight < 0 {
			return errors.New("weights must be non-negative")
		}
	}

	// Validate constraints
	if prefs.MaxCostPerRequest != nil && *prefs.MaxCostPerRequest < 0 {
		return errors.New("max_cost_per_request must be non-negative")
	}

	if prefs.MinQualityScore != nil {
		if *prefs.MinQualityScore < 0 || *prefs.MinQualityScore > 1.0 {
			return errors.New("min_quality_score must be between 0.0 and 1.0")
		}
	}

	if prefs.MaxLatencyMs != nil && *prefs.MaxLatencyMs < 0 {
		return errors.New("max_latency_ms must be non-negative")
	}

	return nil
}

// RewardWeights represents the weights for different optimization factors
type RewardWeights struct {
	Latency float64 `json:"latency"`
	Success float64 `json:"success"`
	Quality float64 `json:"quality"`
	Cost    float64 `json:"cost"`
}

// GetDefaultPreferences returns the default preferences for a new customer
func GetDefaultPreferences(tenantID string) *CustomerRoutingPreferences {
	return &CustomerRoutingPreferences{
		TenantID:          tenantID,
		OptimizationMode:  OptimizationModeBalanced,
		DomainPreferences: make(DomainPreferenceMap),
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}
}
