package cognitive

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/Igris-inertial/system/igris-overture/observability"
)

// AutoApplier manages automatic proposal application and rollback monitoring
type AutoApplier struct {
	db              *sql.DB
	applier         *Applier
	checkInterval   time.Duration
	done            chan struct{}
	wg              sync.WaitGroup

	// Rollback thresholds (configurable per-tenant via DB)
	defaultLatencyThreshold   float64
	defaultErrorRateThreshold float64
	defaultCostThreshold      float64

	// FIX-2026-02: cognitive-advisor — per-tenant rate limit (1 apply per 5min per tenant)
	lastApplyPerTenant map[string]time.Time
	lastApplyMu        sync.Mutex
	applyRateLimit     time.Duration
}

// AutoApplierConfig holds configuration for the auto-applier
type AutoApplierConfig struct {
	CheckInterval           time.Duration
	DefaultLatencyThreshold float64 // % degradation to trigger rollback
	DefaultErrorRateThreshold float64
	DefaultCostThreshold    float64
}

// DefaultAutoApplierConfig returns default configuration
func DefaultAutoApplierConfig() AutoApplierConfig {
	return AutoApplierConfig{
		CheckInterval:           5 * time.Minute,
		DefaultLatencyThreshold: 0.10, // 10% degradation
		DefaultErrorRateThreshold: 0.05, // 5% increase
		DefaultCostThreshold:    0.10, // 10% increase
	}
}

// NewAutoApplier creates a new auto-applier
func NewAutoApplier(db *sql.DB, applier *Applier) *AutoApplier {
	config := DefaultAutoApplierConfig()
	return NewAutoApplierWithConfig(db, applier, config)
}

// NewAutoApplierWithConfig creates a new auto-applier with custom configuration
func NewAutoApplierWithConfig(db *sql.DB, applier *Applier, config AutoApplierConfig) *AutoApplier {
	return &AutoApplier{
		db:                        db,
		applier:                   applier,
		checkInterval:             config.CheckInterval,
		done:                      make(chan struct{}),
		defaultLatencyThreshold:   config.DefaultLatencyThreshold,
		defaultErrorRateThreshold: config.DefaultErrorRateThreshold,
		defaultCostThreshold:      config.DefaultCostThreshold,
		// FIX-2026-02: cognitive-advisor — initialise per-tenant rate limit (1 apply per 5min)
		lastApplyPerTenant: make(map[string]time.Time),
		applyRateLimit:     5 * time.Minute,
	}
}

// Start begins the auto-apply and rollback monitoring loop
func (aa *AutoApplier) Start(ctx context.Context) {
	aa.wg.Add(2)

	// Auto-apply loop
	go aa.autoApplyLoop(ctx)

	// Rollback monitoring loop
	go aa.rollbackMonitorLoop(ctx)

	log.Info().
		Dur("check_interval", aa.checkInterval).
		Float64("latency_threshold", aa.defaultLatencyThreshold).
		Float64("error_rate_threshold", aa.defaultErrorRateThreshold).
		Float64("cost_threshold", aa.defaultCostThreshold).
		Msg("Cognitive auto-applier started")
}

// Stop gracefully stops the auto-applier
func (aa *AutoApplier) Stop() {
	close(aa.done)
	aa.wg.Wait()
	log.Info().Msg("Cognitive auto-applier stopped")
}

// autoApplyLoop periodically checks for proposals to auto-apply
func (aa *AutoApplier) autoApplyLoop(ctx context.Context) {
	defer aa.wg.Done()

	ticker := time.NewTicker(aa.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-aa.done:
			return
		case <-ticker.C:
			aa.processAutoApplyProposals(ctx)
		}
	}
}

// rollbackMonitorLoop monitors applied proposals and triggers rollbacks if needed
func (aa *AutoApplier) rollbackMonitorLoop(ctx context.Context) {
	defer aa.wg.Done()

	ticker := time.NewTicker(aa.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-aa.done:
			return
		case <-ticker.C:
			aa.checkForRollbacks(ctx)
		}
	}
}

// processAutoApplyProposals finds and applies eligible proposals
func (aa *AutoApplier) processAutoApplyProposals(ctx context.Context) {
	// Find proposals eligible for auto-apply
	proposals, err := aa.getEligibleProposals(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get eligible proposals for auto-apply")
		return
	}

	for _, proposal := range proposals {
		// Get tenant's auto-apply configuration
		config, err := aa.getTenantAutoApplyConfig(ctx, proposal.TenantID)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", proposal.TenantID).Msg("Failed to get tenant config")
			continue
		}

		if !config.AutoApplyEnabled {
			continue
		}

		// Check if proposal meets thresholds
		if proposal.Confidence < config.AutoApplyThreshold {
			observability.RecordAutoAppliedProposal(proposal.TenantID, "skipped")
			log.Debug().
				Str("proposal_id", proposal.ProposalID).
				Float64("confidence", proposal.Confidence).
				Float64("threshold", config.AutoApplyThreshold).
				Msg("Proposal confidence below threshold")
			continue
		}

		if proposal.RiskScore > config.MaxRiskScore {
			observability.RecordAutoAppliedProposal(proposal.TenantID, "skipped")
			log.Debug().
				Str("proposal_id", proposal.ProposalID).
				Float64("risk_score", proposal.RiskScore).
				Float64("max_risk", config.MaxRiskScore).
				Msg("Proposal risk above threshold")
			continue
		}

		// FIX-2026-02: cognitive-advisor — enforce 1 apply per 5min per tenant
		aa.lastApplyMu.Lock()
		lastApply, seen := aa.lastApplyPerTenant[proposal.TenantID]
		aa.lastApplyMu.Unlock()
		if seen && time.Since(lastApply) < aa.applyRateLimit {
			log.Debug().
				Str("tenant_id", proposal.TenantID).
				Dur("since_last_apply", time.Since(lastApply)).
				Msg("Cognitive auto-apply rate limit: skipping (< 5min since last apply)")
			continue
		}

		// Record baseline before applying
		if err := aa.recordBaseline(ctx, proposal); err != nil {
			log.Error().Err(err).Str("proposal_id", proposal.ProposalID).Msg("Failed to record baseline")
			continue
		}

		// Apply the proposal
		if err := aa.applier.ApplyProposal(ctx, proposal.ProposalID); err != nil {
			log.Error().Err(err).Str("proposal_id", proposal.ProposalID).Msg("Failed to auto-apply proposal")
			observability.RecordAutoAppliedProposal(proposal.TenantID, "failed")
			continue
		}

		// FIX-2026-02: cognitive-advisor — record apply time for rate limiting
		aa.lastApplyMu.Lock()
		aa.lastApplyPerTenant[proposal.TenantID] = time.Now()
		aa.lastApplyMu.Unlock()

		observability.RecordAutoAppliedProposal(proposal.TenantID, "applied")

		log.Info().
			Str("tenant_id", proposal.TenantID).
			Str("proposal_id", proposal.ProposalID).
			Float64("confidence", proposal.Confidence).
			Float64("risk_score", proposal.RiskScore).
			Msg("Proposal auto-applied successfully")
	}
}

// checkForRollbacks monitors applied proposals and triggers rollbacks if performance degrades
func (aa *AutoApplier) checkForRollbacks(ctx context.Context) {
	// Get baselines that need monitoring (not yet past rollback deadline)
	baselines, err := aa.getActiveBaselines(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get active baselines for rollback check")
		return
	}

	for _, baseline := range baselines {
		// Get tenant's thresholds
		config, err := aa.getTenantAutoApplyConfig(ctx, baseline.TenantID)
		if err != nil {
			log.Error().Err(err).Str("tenant_id", baseline.TenantID).Msg("Failed to get tenant config")
			continue
		}

		// Get current metrics
		currentMetrics, err := aa.getCurrentMetrics(ctx, baseline.TenantID, baseline.SemanticClass)
		if err != nil {
			log.Error().Err(err).Str("proposal_id", baseline.ProposalID).Msg("Failed to get current metrics")
			continue
		}

		// Check for degradation
		degradation := aa.checkDegradation(baseline, currentMetrics, config)

		if degradation.NeedsRollback {
			log.Warn().
				Str("tenant_id", baseline.TenantID).
				Str("proposal_id", baseline.ProposalID).
				Str("reason", degradation.Reason).
				Float64("degradation_pct", degradation.DegradationPct).
				Msg("Performance degradation detected, triggering rollback")

			if err := aa.triggerRollback(ctx, baseline, degradation.Reason); err != nil {
				log.Error().Err(err).Str("proposal_id", baseline.ProposalID).Msg("Failed to trigger rollback")
				continue
			}

			observability.RecordRollbackTriggered(baseline.TenantID, degradation.Reason)
		}
	}

	// Mark baselines past their deadline as no longer needing monitoring
	if err := aa.markExpiredBaselines(ctx); err != nil {
		log.Error().Err(err).Msg("Failed to mark expired baselines")
	}
}

// Baseline represents a baseline for rollback monitoring
type Baseline struct {
	ID                   int64
	TenantID             string
	ProposalID           string
	SemanticClass        string
	BaselineP95Latency   float64
	BaselineErrorRate    float64
	BaselineAvgCost      float64
	BaselineRequestCount int
	AppliedAt            time.Time
	RollbackDeadline     time.Time
}

// CurrentMetrics represents current performance metrics
type CurrentMetrics struct {
	P95Latency   float64
	ErrorRate    float64
	AvgCost      float64
	RequestCount int
}

// DegradationCheck represents the result of a degradation check
type DegradationCheck struct {
	NeedsRollback   bool
	Reason          string
	DegradationPct  float64
}

// TenantAutoApplyConfig holds tenant-specific auto-apply settings
type TenantAutoApplyConfig struct {
	AutoApplyEnabled    bool
	AutoApplyThreshold  float64
	MaxRiskScore        float64
	LatencyThreshold    float64
	ErrorRateThreshold  float64
	CostThreshold       float64
}

// getEligibleProposals finds pending proposals that are eligible for auto-apply
func (aa *AutoApplier) getEligibleProposals(ctx context.Context) ([]*Proposal, error) {
	query := `
		SELECT
			p.proposal_id,
			p.tenant_id,
			p.confidence,
			p.risk_score,
			p.proposed_changes,
			p.rationale
		FROM cognitive_proposals p
		JOIN tenant_self_tuner_config c ON p.tenant_id = c.tenant_id
		WHERE p.status = 'pending'
		  AND c.auto_apply_enabled = TRUE
		  AND p.confidence >= c.auto_apply_threshold
		  AND p.risk_score <= c.max_risk_score
		  AND p.generated_at > NOW() - INTERVAL '24 hours'
		ORDER BY p.confidence DESC, p.risk_score ASC
		LIMIT 10
	`

	rows, err := aa.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query eligible proposals: %w", err)
	}
	defer rows.Close()

	var proposals []*Proposal
	for rows.Next() {
		var p Proposal
		if err := rows.Scan(
			&p.ProposalID,
			&p.TenantID,
			&p.Confidence,
			&p.RiskScore,
			&p.ProposedChangesRaw,
			&p.Rationale,
		); err != nil {
			log.Error().Err(err).Msg("Failed to scan proposal")
			continue
		}

		if err := p.UnmarshalProposedChanges(); err != nil {
			log.Error().Err(err).Str("proposal_id", p.ProposalID).Msg("Failed to unmarshal changes")
			continue
		}

		proposals = append(proposals, &p)
	}

	return proposals, rows.Err()
}

// getTenantAutoApplyConfig retrieves tenant-specific auto-apply configuration
func (aa *AutoApplier) getTenantAutoApplyConfig(ctx context.Context, tenantID string) (*TenantAutoApplyConfig, error) {
	query := `
		SELECT
			auto_apply_enabled,
			auto_apply_threshold,
			max_risk_score,
			latency_degradation_threshold,
			error_rate_degradation_threshold,
			cost_degradation_threshold
		FROM tenant_self_tuner_config
		WHERE tenant_id = $1
	`

	var config TenantAutoApplyConfig
	err := aa.db.QueryRowContext(ctx, query, tenantID).Scan(
		&config.AutoApplyEnabled,
		&config.AutoApplyThreshold,
		&config.MaxRiskScore,
		&config.LatencyThreshold,
		&config.ErrorRateThreshold,
		&config.CostThreshold,
	)

	if err == sql.ErrNoRows {
		// Return defaults
		return &TenantAutoApplyConfig{
			AutoApplyEnabled:   false,
			AutoApplyThreshold: 0.90,
			MaxRiskScore:       0.30,
			LatencyThreshold:   aa.defaultLatencyThreshold,
			ErrorRateThreshold: aa.defaultErrorRateThreshold,
			CostThreshold:      aa.defaultCostThreshold,
		}, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get tenant config: %w", err)
	}

	return &config, nil
}

// recordBaseline records baseline metrics before applying a proposal
func (aa *AutoApplier) recordBaseline(ctx context.Context, proposal *Proposal) error {
	// Get the semantic class from the proposal (from first proposed change)
	var semanticClass string
	if len(proposal.ProposedChanges) > 0 {
		semanticClass = proposal.ProposedChanges[0].Intent
	}
	if semanticClass == "" {
		semanticClass = "default"
	}

	// Get tenant's rollback window
	var rollbackWindowSeconds int64 = 3600 // Default 1 hour
	err := aa.db.QueryRowContext(ctx,
		"SELECT rollback_window_seconds FROM tenant_self_tuner_config WHERE tenant_id = $1",
		proposal.TenantID,
	).Scan(&rollbackWindowSeconds)
	if err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("failed to get rollback window: %w", err)
	}

	// Get current metrics as baseline
	query := `
		SELECT
			COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 0) as p95_latency,
			COALESCE(AVG(CASE WHEN success THEN 0.0 ELSE 1.0 END), 0) as error_rate,
			COALESCE(AVG(cost_usd), 0) as avg_cost,
			COUNT(*) as request_count
		FROM semantic_bandit_rewards
		WHERE tenant_id = $1
		  AND semantic_class = $2
		  AND created_at > NOW() - INTERVAL '1 hour'
	`

	var p95Latency, errorRate, avgCost float64
	var requestCount int
	if err := aa.db.QueryRowContext(ctx, query, proposal.TenantID, semanticClass).Scan(
		&p95Latency, &errorRate, &avgCost, &requestCount,
	); err != nil {
		return fmt.Errorf("failed to get baseline metrics: %w", err)
	}

	// Insert baseline
	insertQuery := `
		INSERT INTO cognitive_baselines (
			tenant_id,
			proposal_id,
			semantic_class,
			baseline_p95_latency_ms,
			baseline_error_rate,
			baseline_avg_cost_usd,
			baseline_request_count,
			rollback_deadline
		) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + ($8 || ' seconds')::INTERVAL)
	`

	_, err = aa.db.ExecContext(ctx, insertQuery,
		proposal.TenantID,
		proposal.ProposalID,
		semanticClass,
		p95Latency,
		errorRate,
		avgCost,
		requestCount,
		fmt.Sprintf("%d", rollbackWindowSeconds),
	)

	return err
}

// getActiveBaselines retrieves baselines that need monitoring
func (aa *AutoApplier) getActiveBaselines(ctx context.Context) ([]Baseline, error) {
	query := `
		SELECT
			id,
			tenant_id,
			proposal_id,
			semantic_class,
			baseline_p95_latency_ms,
			baseline_error_rate,
			baseline_avg_cost_usd,
			baseline_request_count,
			applied_at,
			rollback_deadline
		FROM cognitive_baselines
		WHERE rolled_back = FALSE
		  AND rollback_deadline > NOW()
		ORDER BY applied_at DESC
	`

	rows, err := aa.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query active baselines: %w", err)
	}
	defer rows.Close()

	var baselines []Baseline
	for rows.Next() {
		var b Baseline
		if err := rows.Scan(
			&b.ID,
			&b.TenantID,
			&b.ProposalID,
			&b.SemanticClass,
			&b.BaselineP95Latency,
			&b.BaselineErrorRate,
			&b.BaselineAvgCost,
			&b.BaselineRequestCount,
			&b.AppliedAt,
			&b.RollbackDeadline,
		); err != nil {
			log.Error().Err(err).Msg("Failed to scan baseline")
			continue
		}
		baselines = append(baselines, b)
	}

	return baselines, rows.Err()
}

// getCurrentMetrics retrieves current performance metrics
func (aa *AutoApplier) getCurrentMetrics(ctx context.Context, tenantID, semanticClass string) (*CurrentMetrics, error) {
	query := `
		SELECT
			COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms), 0) as p95_latency,
			COALESCE(AVG(CASE WHEN success THEN 0.0 ELSE 1.0 END), 0) as error_rate,
			COALESCE(AVG(cost_usd), 0) as avg_cost,
			COUNT(*) as request_count
		FROM semantic_bandit_rewards
		WHERE tenant_id = $1
		  AND semantic_class = $2
		  AND created_at > NOW() - INTERVAL '10 minutes'
	`

	var metrics CurrentMetrics
	if err := aa.db.QueryRowContext(ctx, query, tenantID, semanticClass).Scan(
		&metrics.P95Latency,
		&metrics.ErrorRate,
		&metrics.AvgCost,
		&metrics.RequestCount,
	); err != nil {
		return nil, fmt.Errorf("failed to get current metrics: %w", err)
	}

	return &metrics, nil
}

// checkDegradation checks if current metrics show degradation compared to baseline
func (aa *AutoApplier) checkDegradation(baseline Baseline, current *CurrentMetrics, config *TenantAutoApplyConfig) DegradationCheck {
	// Skip if not enough recent data
	if current.RequestCount < 10 {
		return DegradationCheck{NeedsRollback: false}
	}

	// Check latency degradation
	if baseline.BaselineP95Latency > 0 {
		latencyIncrease := (current.P95Latency - baseline.BaselineP95Latency) / baseline.BaselineP95Latency
		if latencyIncrease > config.LatencyThreshold {
			return DegradationCheck{
				NeedsRollback:  true,
				Reason:         "latency_degradation",
				DegradationPct: latencyIncrease * 100,
			}
		}
	}

	// Check error rate increase
	errorRateIncrease := current.ErrorRate - baseline.BaselineErrorRate
	if errorRateIncrease > config.ErrorRateThreshold {
		return DegradationCheck{
			NeedsRollback:  true,
			Reason:         "error_rate_increase",
			DegradationPct: errorRateIncrease * 100,
		}
	}

	// Check cost increase
	if baseline.BaselineAvgCost > 0 {
		costIncrease := (current.AvgCost - baseline.BaselineAvgCost) / baseline.BaselineAvgCost
		if costIncrease > config.CostThreshold {
			return DegradationCheck{
				NeedsRollback:  true,
				Reason:         "cost_increase",
				DegradationPct: costIncrease * 100,
			}
		}
	}

	return DegradationCheck{NeedsRollback: false}
}

// triggerRollback rolls back a proposal's changes
func (aa *AutoApplier) triggerRollback(ctx context.Context, baseline Baseline, reason string) error {
	// Start transaction
	tx, err := aa.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Mark baseline as rolled back
	_, err = tx.ExecContext(ctx,
		"UPDATE cognitive_baselines SET rolled_back = TRUE, rolled_back_at = NOW(), rollback_reason = $1 WHERE id = $2",
		reason, baseline.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to mark baseline as rolled back: %w", err)
	}

	// Update proposal status
	_, err = tx.ExecContext(ctx,
		"UPDATE cognitive_proposals SET status = 'rolled_back' WHERE proposal_id = $1",
		baseline.ProposalID,
	)
	if err != nil {
		return fmt.Errorf("failed to update proposal status: %w", err)
	}

	// Log audit entry
	_, err = tx.ExecContext(ctx,
		"INSERT INTO cognitive_audit_log (proposal_id, action, actor, details) VALUES ($1, 'rolled_back', 'auto-applier', $2)",
		baseline.ProposalID, fmt.Sprintf("Auto-rollback triggered: %s", reason),
	)
	if err != nil {
		return fmt.Errorf("failed to log audit entry: %w", err)
	}

	// Commit transaction
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit rollback: %w", err)
	}

	log.Info().
		Str("tenant_id", baseline.TenantID).
		Str("proposal_id", baseline.ProposalID).
		Str("reason", reason).
		Msg("Proposal rolled back successfully")

	return nil
}

// markExpiredBaselines marks baselines past their deadline as no longer needing monitoring
func (aa *AutoApplier) markExpiredBaselines(ctx context.Context) error {
	query := `
		UPDATE cognitive_baselines
		SET rolled_back = TRUE, rollback_reason = 'monitoring_period_expired'
		WHERE rolled_back = FALSE
		  AND rollback_deadline < NOW()
	`

	_, err := aa.db.ExecContext(ctx, query)
	return err
}
