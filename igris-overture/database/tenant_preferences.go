package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/lib/pq"
)

// TenantRewardWeights represents the reward weights for a tenant
type TenantRewardWeights struct {
	Latency float64 `json:"latency"`
	Success float64 `json:"success"`
	Cost    float64 `json:"cost"`
	Cache   float64 `json:"cache"`
	Quality float64 `json:"quality"`
}

// DefaultRewardWeights returns the default reward weights
func DefaultRewardWeights() TenantRewardWeights {
	return TenantRewardWeights{
		Latency: 0.4,
		Success: 0.3,
		Cost:    0.15,
		Cache:   0.1,
		Quality: 0.05,
	}
}

// Normalize ensures weights sum to 1.0
func (w *TenantRewardWeights) Normalize() {
	sum := w.Latency + w.Success + w.Cost + w.Cache + w.Quality
	if sum > 0 {
		w.Latency /= sum
		w.Success /= sum
		w.Cost /= sum
		w.Cache /= sum
		w.Quality /= sum
	}
}

// TenantRoutingPreference represents a tenant's routing preferences
type TenantRoutingPreference struct {
	TenantID           string                         `json:"tenant_id"`
	RewardWeights      TenantRewardWeights            `json:"reward_weights"`
	ExplorationRate    float64                        `json:"exploration_rate"`
	SampleCount        int                            `json:"sample_count"`
	ConfidenceScore    float64                        `json:"confidence_score"`
	LearningEnabled    bool                           `json:"learning_enabled"`
	LearningRate       float64                        `json:"learning_rate"`
	UpdateFrequency    int                            `json:"update_frequency"`
	SemanticClassWeights map[string]TenantRewardWeights `json:"semantic_class_weights,omitempty"`
	CreatedAt          time.Time                      `json:"created_at"`
	LastUpdated        time.Time                      `json:"last_updated"`
	LastLearningUpdate time.Time                      `json:"last_learning_update"`
}

// GetTenantPreferences retrieves routing preferences for a tenant
func (db *DB) GetTenantPreferences(ctx context.Context, tenantID string) (*TenantRoutingPreference, error) {
	query := `
		SELECT
			tenant_id,
			reward_weights,
			exploration_rate,
			sample_count,
			confidence_score,
			learning_enabled,
			learning_rate,
			update_frequency,
			semantic_class_weights,
			created_at,
			last_updated,
			last_learning_update
		FROM tenant_routing_preferences
		WHERE tenant_id = $1
	`

	var pref TenantRoutingPreference
	var rewardWeightsJSON []byte
	var semanticWeightsJSON []byte

	err := db.DB.QueryRowContext(ctx, query, tenantID).Scan(
		&pref.TenantID,
		&rewardWeightsJSON,
		&pref.ExplorationRate,
		&pref.SampleCount,
		&pref.ConfidenceScore,
		&pref.LearningEnabled,
		&pref.LearningRate,
		&pref.UpdateFrequency,
		&semanticWeightsJSON,
		&pref.CreatedAt,
		&pref.LastUpdated,
		&pref.LastLearningUpdate,
	)

	if err == sql.ErrNoRows {
		// Return default preferences if not found
		return &TenantRoutingPreference{
			TenantID:         tenantID,
			RewardWeights:    DefaultRewardWeights(),
			ExplorationRate:  0.1,
			SampleCount:      0,
			ConfidenceScore:  0.0,
			LearningEnabled:  true,
			LearningRate:     0.05,
			UpdateFrequency:  500,
			CreatedAt:        time.Now(),
			LastUpdated:      time.Now(),
			LastLearningUpdate: time.Now(),
		}, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get tenant preferences: %w", err)
	}

	// Unmarshal JSON fields
	if err := json.Unmarshal(rewardWeightsJSON, &pref.RewardWeights); err != nil {
		return nil, fmt.Errorf("failed to unmarshal reward weights: %w", err)
	}

	if len(semanticWeightsJSON) > 0 && string(semanticWeightsJSON) != "{}" {
		if err := json.Unmarshal(semanticWeightsJSON, &pref.SemanticClassWeights); err != nil {
			return nil, fmt.Errorf("failed to unmarshal semantic weights: %w", err)
		}
	}

	return &pref, nil
}

// GetTenantRewardWeights retrieves just the reward weights for a tenant
// Uses the database helper function for efficient retrieval
func (db *DB) GetTenantRewardWeights(ctx context.Context, tenantID string) (TenantRewardWeights, error) {
	query := `SELECT get_tenant_reward_weights($1)`

	var weightsJSON []byte
	err := db.DB.QueryRowContext(ctx, query, tenantID).Scan(&weightsJSON)
	if err != nil {
		return DefaultRewardWeights(), fmt.Errorf("failed to get reward weights: %w", err)
	}

	var weights TenantRewardWeights
	if err := json.Unmarshal(weightsJSON, &weights); err != nil {
		return DefaultRewardWeights(), fmt.Errorf("failed to unmarshal weights: %w", err)
	}

	return weights, nil
}

// GetSemanticClassWeights retrieves reward weights for a specific semantic class
func (db *DB) GetSemanticClassWeights(ctx context.Context, tenantID, semanticClass string) (TenantRewardWeights, error) {
	pref, err := db.GetTenantPreferences(ctx, tenantID)
	if err != nil {
		return DefaultRewardWeights(), err
	}

	// Check for semantic-class-specific override
	if pref.SemanticClassWeights != nil {
		if weights, ok := pref.SemanticClassWeights[semanticClass]; ok {
			return weights, nil
		}
	}

	// Fall back to tenant default weights
	return pref.RewardWeights, nil
}

// UpdateTenantPreferenceWeights updates the reward weights for a tenant
// Uses the database helper function
func (db *DB) UpdateTenantPreferenceWeights(
	ctx context.Context,
	tenantID string,
	weights TenantRewardWeights,
	sampleCount int,
	confidence float64,
) error {
	// Normalize weights before storing
	weights.Normalize()

	weightsJSON, err := json.Marshal(weights)
	if err != nil {
		return fmt.Errorf("failed to marshal weights: %w", err)
	}

	query := `SELECT update_tenant_preference_weights($1, $2, $3, $4)`

	_, err = db.DB.ExecContext(ctx, query, tenantID, weightsJSON, sampleCount, confidence)
	if err != nil {
		return fmt.Errorf("failed to update preference weights: %w", err)
	}

	return nil
}

// IncrementTenantSampleCount increments the sample count for a tenant
func (db *DB) IncrementTenantSampleCount(ctx context.Context, tenantID string) error {
	query := `
		INSERT INTO tenant_routing_preferences (tenant_id, sample_count, last_updated)
		VALUES ($1, 1, NOW())
		ON CONFLICT (tenant_id) DO UPDATE
		SET sample_count = tenant_routing_preferences.sample_count + 1,
		    last_updated = NOW()
	`

	_, err := db.DB.ExecContext(ctx, query, tenantID)
	if err != nil {
		return fmt.Errorf("failed to increment sample count: %w", err)
	}

	return nil
}

// UpdateSemanticClassWeights updates weights for a specific semantic class
func (db *DB) UpdateSemanticClassWeights(
	ctx context.Context,
	tenantID string,
	semanticClass string,
	weights TenantRewardWeights,
) error {
	weights.Normalize()

	// Get current preferences
	pref, err := db.GetTenantPreferences(ctx, tenantID)
	if err != nil {
		return err
	}

	// Initialize map if needed
	if pref.SemanticClassWeights == nil {
		pref.SemanticClassWeights = make(map[string]TenantRewardWeights)
	}

	// Update semantic class weights
	pref.SemanticClassWeights[semanticClass] = weights

	weightsJSON, err := json.Marshal(pref.SemanticClassWeights)
	if err != nil {
		return fmt.Errorf("failed to marshal semantic weights: %w", err)
	}

	query := `
		UPDATE tenant_routing_preferences
		SET semantic_class_weights = $1,
		    last_updated = NOW()
		WHERE tenant_id = $2
	`

	_, err = db.DB.ExecContext(ctx, query, weightsJSON, tenantID)
	if err != nil {
		return fmt.Errorf("failed to update semantic weights: %w", err)
	}

	return nil
}

// SetLearningEnabled enables or disables learning for a tenant
func (db *DB) SetLearningEnabled(ctx context.Context, tenantID string, enabled bool) error {
	query := `
		INSERT INTO tenant_routing_preferences (tenant_id, learning_enabled, last_updated)
		VALUES ($1, $2, NOW())
		ON CONFLICT (tenant_id) DO UPDATE
		SET learning_enabled = $2,
		    last_updated = NOW()
	`

	_, err := db.DB.ExecContext(ctx, query, tenantID, enabled)
	if err != nil {
		return fmt.Errorf("failed to set learning enabled: %w", err)
	}

	return nil
}

// GetTenantsNeedingUpdate returns tenants that should have their weights updated
// based on sample count reaching update frequency
func (db *DB) GetTenantsNeedingUpdate(ctx context.Context, limit int) ([]string, error) {
	query := `
		SELECT tenant_id
		FROM tenant_routing_preferences
		WHERE learning_enabled = TRUE
		  AND sample_count > 0
		  AND sample_count % update_frequency = 0
		  AND last_learning_update < last_updated
		ORDER BY last_learning_update ASC
		LIMIT $1
	`

	rows, err := db.DB.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenants needing update: %w", err)
	}
	defer rows.Close()

	var tenantIDs []string
	for rows.Next() {
		var tenantID string
		if err := rows.Scan(&tenantID); err != nil {
			return nil, fmt.Errorf("failed to scan tenant ID: %w", err)
		}
		tenantIDs = append(tenantIDs, tenantID)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %w", err)
	}

	return tenantIDs, nil
}

// BatchUpdateTenantWeights updates multiple tenants' weights in a transaction
func (db *DB) BatchUpdateTenantWeights(
	ctx context.Context,
	updates []struct {
		TenantID    string
		Weights     TenantRewardWeights
		SampleCount int
		Confidence  float64
	},
) error {
	tx, err := db.DB.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		SELECT update_tenant_preference_weights($1, $2, $3, $4)
	`)
	if err != nil {
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, update := range updates {
		update.Weights.Normalize()

		weightsJSON, err := json.Marshal(update.Weights)
		if err != nil {
			return fmt.Errorf("failed to marshal weights for %s: %w", update.TenantID, err)
		}

		_, err = stmt.ExecContext(ctx, update.TenantID, weightsJSON, update.SampleCount, update.Confidence)
		if err != nil {
			return fmt.Errorf("failed to update weights for %s: %w", update.TenantID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// GetPreferenceStats returns statistics about tenant preferences
func (db *DB) GetPreferenceStats(ctx context.Context) (map[string]interface{}, error) {
	query := `
		SELECT
			COUNT(*) as total_tenants,
			COUNT(CASE WHEN learning_enabled THEN 1 END) as learning_enabled_count,
			AVG(sample_count) as avg_sample_count,
			AVG(confidence_score) as avg_confidence,
			AVG(exploration_rate) as avg_exploration_rate
		FROM tenant_routing_preferences
	`

	var totalTenants, learningEnabledCount int
	var avgSampleCount, avgConfidence, avgExplorationRate sql.NullFloat64

	err := db.DB.QueryRowContext(ctx, query).Scan(
		&totalTenants,
		&learningEnabledCount,
		&avgSampleCount,
		&avgConfidence,
		&avgExplorationRate,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to get preference stats: %w", err)
	}

	stats := map[string]interface{}{
		"total_tenants":           totalTenants,
		"learning_enabled_count":  learningEnabledCount,
		"avg_sample_count":        avgSampleCount.Float64,
		"avg_confidence":          avgConfidence.Float64,
		"avg_exploration_rate":    avgExplorationRate.Float64,
	}

	return stats, nil
}

// ResetTenantPreferences resets a tenant's preferences to defaults
func (db *DB) ResetTenantPreferences(ctx context.Context, tenantID string) error {
	query := `
		DELETE FROM tenant_routing_preferences
		WHERE tenant_id = $1
	`

	_, err := db.DB.ExecContext(ctx, query, tenantID)
	if err != nil {
		return fmt.Errorf("failed to reset tenant preferences: %w", err)
	}

	return nil
}

// EnsureTenantPreferencesExist creates default preferences if they don't exist
func (db *DB) EnsureTenantPreferencesExist(ctx context.Context, tenantID string) error {
	defaults := DefaultRewardWeights()
	weightsJSON, err := json.Marshal(defaults)
	if err != nil {
		return fmt.Errorf("failed to marshal default weights: %w", err)
	}

	query := `
		INSERT INTO tenant_routing_preferences (
			tenant_id,
			reward_weights,
			exploration_rate,
			learning_enabled,
			learning_rate,
			update_frequency,
			sample_count
		)
		VALUES ($1, $2, 0.1, true, 0.05, 500, 0)
		ON CONFLICT (tenant_id) DO NOTHING
	`

	_, err = db.DB.ExecContext(ctx, query, tenantID, weightsJSON)
	if err != nil {
		return fmt.Errorf("failed to ensure preferences exist: %w", err)
	}

	return nil
}

// SelfTunerConfig represents configurable self-tuner settings per tenant
type SelfTunerConfig struct {
	TenantID           string        `json:"tenant_id"`
	Enabled            bool          `json:"enabled"`
	Interval           time.Duration `json:"interval"`           // Tuning interval (default: 24h, min: 1h)
	AutoApplyEnabled   bool          `json:"auto_apply_enabled"` // Auto-apply high-confidence changes
	AutoApplyThreshold float64       `json:"auto_apply_threshold"` // Min confidence to auto-apply (default: 0.90)
	MaxRiskScore       float64       `json:"max_risk_score"`       // Max risk for auto-apply (default: 0.3)
	RollbackWindow     time.Duration `json:"rollback_window"`      // Monitor window for rollback (default: 1h)
	LatencyDegradationThreshold float64 `json:"latency_degradation_threshold"` // % degradation to trigger rollback
	ErrorRateDegradationThreshold float64 `json:"error_rate_degradation_threshold"`
	CostDegradationThreshold float64 `json:"cost_degradation_threshold"`
	LastRun            time.Time     `json:"last_run"`
	LastAutoApply      time.Time     `json:"last_auto_apply"`
	UpdatedAt          time.Time     `json:"updated_at"`
}

// DefaultSelfTunerConfig returns default self-tuner configuration
func DefaultSelfTunerConfig(tenantID string) *SelfTunerConfig {
	return &SelfTunerConfig{
		TenantID:           tenantID,
		Enabled:            true,
		Interval:           24 * time.Hour,
		AutoApplyEnabled:   false, // Opt-in by default
		AutoApplyThreshold: 0.90,
		MaxRiskScore:       0.30,
		RollbackWindow:     1 * time.Hour,
		LatencyDegradationThreshold: 0.10, // 10% degradation
		ErrorRateDegradationThreshold: 0.05, // 5% increase
		CostDegradationThreshold: 0.10, // 10% increase
		UpdatedAt:          time.Now(),
	}
}

// GetSelfTunerConfig retrieves self-tuner configuration for a tenant
func (db *DB) GetSelfTunerConfig(ctx context.Context, tenantID string) (*SelfTunerConfig, error) {
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
			cost_degradation_threshold,
			last_run,
			last_auto_apply,
			updated_at
		FROM tenant_self_tuner_config
		WHERE tenant_id = $1
	`

	var config SelfTunerConfig
	var intervalSeconds, rollbackWindowSeconds int64
	var lastRun, lastAutoApply sql.NullTime

	err := db.DB.QueryRowContext(ctx, query, tenantID).Scan(
		&config.TenantID,
		&config.Enabled,
		&intervalSeconds,
		&config.AutoApplyEnabled,
		&config.AutoApplyThreshold,
		&config.MaxRiskScore,
		&rollbackWindowSeconds,
		&config.LatencyDegradationThreshold,
		&config.ErrorRateDegradationThreshold,
		&config.CostDegradationThreshold,
		&lastRun,
		&lastAutoApply,
		&config.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return DefaultSelfTunerConfig(tenantID), nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get self-tuner config: %w", err)
	}

	config.Interval = time.Duration(intervalSeconds) * time.Second
	config.RollbackWindow = time.Duration(rollbackWindowSeconds) * time.Second
	if lastRun.Valid {
		config.LastRun = lastRun.Time
	}
	if lastAutoApply.Valid {
		config.LastAutoApply = lastAutoApply.Time
	}

	return &config, nil
}

// UpsertSelfTunerConfig creates or updates self-tuner configuration
func (db *DB) UpsertSelfTunerConfig(ctx context.Context, config *SelfTunerConfig) error {
	// Enforce minimum interval of 1 hour
	if config.Interval < time.Hour {
		config.Interval = time.Hour
	}

	query := `
		INSERT INTO tenant_self_tuner_config (
			tenant_id,
			enabled,
			interval_seconds,
			auto_apply_enabled,
			auto_apply_threshold,
			max_risk_score,
			rollback_window_seconds,
			latency_degradation_threshold,
			error_rate_degradation_threshold,
			cost_degradation_threshold,
			updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
		ON CONFLICT (tenant_id) DO UPDATE
		SET
			enabled = EXCLUDED.enabled,
			interval_seconds = EXCLUDED.interval_seconds,
			auto_apply_enabled = EXCLUDED.auto_apply_enabled,
			auto_apply_threshold = EXCLUDED.auto_apply_threshold,
			max_risk_score = EXCLUDED.max_risk_score,
			rollback_window_seconds = EXCLUDED.rollback_window_seconds,
			latency_degradation_threshold = EXCLUDED.latency_degradation_threshold,
			error_rate_degradation_threshold = EXCLUDED.error_rate_degradation_threshold,
			cost_degradation_threshold = EXCLUDED.cost_degradation_threshold,
			updated_at = NOW()
	`

	_, err := db.DB.ExecContext(ctx, query,
		config.TenantID,
		config.Enabled,
		int64(config.Interval.Seconds()),
		config.AutoApplyEnabled,
		config.AutoApplyThreshold,
		config.MaxRiskScore,
		int64(config.RollbackWindow.Seconds()),
		config.LatencyDegradationThreshold,
		config.ErrorRateDegradationThreshold,
		config.CostDegradationThreshold,
	)

	if err != nil {
		return fmt.Errorf("failed to upsert self-tuner config: %w", err)
	}

	return nil
}

// UpdateSelfTunerLastRun updates the last run timestamp
func (db *DB) UpdateSelfTunerLastRun(ctx context.Context, tenantID string) error {
	query := `
		UPDATE tenant_self_tuner_config
		SET last_run = NOW()
		WHERE tenant_id = $1
	`

	_, err := db.DB.ExecContext(ctx, query, tenantID)
	if err != nil {
		return fmt.Errorf("failed to update last run: %w", err)
	}

	return nil
}

// UpdateSelfTunerLastAutoApply updates the last auto-apply timestamp
func (db *DB) UpdateSelfTunerLastAutoApply(ctx context.Context, tenantID string) error {
	query := `
		UPDATE tenant_self_tuner_config
		SET last_auto_apply = NOW()
		WHERE tenant_id = $1
	`

	_, err := db.DB.ExecContext(ctx, query, tenantID)
	if err != nil {
		return fmt.Errorf("failed to update last auto-apply: %w", err)
	}

	return nil
}

// GetTenantsForSelfTuning returns tenants that need self-tuning based on interval
func (db *DB) GetTenantsForSelfTuning(ctx context.Context, limit int) ([]string, error) {
	query := `
		SELECT tenant_id
		FROM tenant_self_tuner_config
		WHERE enabled = TRUE
		  AND (last_run IS NULL OR last_run + (interval_seconds || ' seconds')::INTERVAL < NOW())
		ORDER BY COALESCE(last_run, '1970-01-01'::TIMESTAMP) ASC
		LIMIT $1
	`

	rows, err := db.DB.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to get tenants for self-tuning: %w", err)
	}
	defer rows.Close()

	var tenantIDs []string
	for rows.Next() {
		var tenantID string
		if err := rows.Scan(&tenantID); err != nil {
			return nil, fmt.Errorf("failed to scan tenant ID: %w", err)
		}
		tenantIDs = append(tenantIDs, tenantID)
	}

	return tenantIDs, rows.Err()
}

// Ignore unused import if pq is only for side effects
var _ = pq.Array
