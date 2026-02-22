package cognitive

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

)

// Advisor analyzes provider performance and generates optimization proposals
type Advisor struct {
	db                *sql.DB
	analysisInterval  time.Duration
	confidenceThresh  float64
	minRequestCount   int64
}

// NewAdvisor creates a new cognitive advisor
func NewAdvisor(db *sql.DB) *Advisor {
	return &Advisor{
		db:                db,
		analysisInterval:  15 * time.Minute,
		confidenceThresh:  0.75, // 75% confidence minimum
		minRequestCount:   100,  // Minimum 100 requests per provider to analyze
	}
}

// AnalyzeAndGenerateProposals analyzes all tenants and generates proposals
func (a *Advisor) AnalyzeAndGenerateProposals(ctx context.Context) error {
	startTime := time.Now()

	log.Info().Msg("Starting cognitive analysis cycle")

	// Get all active tenants
	tenants, err := a.getActiveTenants(ctx)
	if err != nil {
		return fmt.Errorf("failed to get active tenants: %w", err)
	}

	log.Info().Int("tenant_count", len(tenants)).Msg("Analyzing tenants")

	for _, tenantID := range tenants {
		if err := a.analyzeTenant(ctx, tenantID); err != nil {
			log.Error().Err(err).Str("tenant_id", tenantID).Msg("Failed to analyze tenant")
			continue
		}
	}

	duration := time.Since(startTime)
	log.Info().
		Dur("duration", duration).
		Int("tenants_analyzed", len(tenants)).
		Msg("Cognitive analysis cycle completed")

	return nil
}

// analyzeTenant performs provider analysis for a single tenant
func (a *Advisor) analyzeTenant(ctx context.Context, tenantID string) error {
	startTime := time.Now()

	// Get provider metrics per intent
	metrics, err := a.getProviderMetrics(ctx, tenantID)
	if err != nil {
		return fmt.Errorf("failed to get provider metrics: %w", err)
	}

	if len(metrics) == 0 {
		log.Debug().Str("tenant_id", tenantID).Msg("No metrics available for analysis")
		return nil
	}

	// Detect degradation and generate proposals
	proposals := a.detectDegradationAndPropose(tenantID, metrics)

	// Store proposals in database
	for _, proposal := range proposals {
		if err := a.storeProposal(ctx, proposal); err != nil {
			log.Error().Err(err).Str("proposal_id", proposal.ProposalID).Msg("Failed to store proposal")
			continue
		}

		// Record metrics
		_ = time.Since(startTime).Seconds() // analysisDuration
		// TODO: Add cognitive metrics
		// metrics.RecordCognitiveProposalGenerated(tenantID, confidence, riskScore, duration)

		log.Info().
			Str("tenant_id", tenantID).
			Str("proposal_id", proposal.ProposalID).
			Float64("confidence", proposal.Confidence).
			Float64("risk_score", proposal.RiskScore).
			Int("changes", len(proposal.ProposedChanges)).
			Msg("Cognitive proposal generated")
	}

	return nil
}

// getActiveTenants retrieves all active tenant IDs
func (a *Advisor) getActiveTenants(ctx context.Context) ([]string, error) {
	query := `
		SELECT DISTINCT tenant_id
		FROM semantic_bandit_rewards
		WHERE created_at > NOW() - INTERVAL '1 hour'
		LIMIT 100
	`

	rows, err := a.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tenants []string
	for rows.Next() {
		var tenantID string
		if err := rows.Scan(&tenantID); err != nil {
			continue
		}
		tenants = append(tenants, tenantID)
	}

	return tenants, rows.Err()
}

// getProviderMetrics retrieves aggregated provider metrics
func (a *Advisor) getProviderMetrics(ctx context.Context, tenantID string) ([]ProviderMetrics, error) {
	query := `
		WITH recent_metrics AS (
			SELECT
				provider_id,
				semantic_class,
				success,
				latency_ms,
				cost_usd,
				composite_reward
			FROM semantic_bandit_rewards
			WHERE tenant_id = $1
				AND created_at > NOW() - INTERVAL '1 hour'
		),
		aggregated AS (
			SELECT
				provider_id,
				semantic_class,
				COUNT(*) as request_count,
				AVG(CASE WHEN success THEN 1.0 ELSE 0.0 END) as success_rate,
				AVG(latency_ms) as avg_latency,
				PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency,
				PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99_latency,
				AVG(cost_usd) as avg_cost,
				AVG(composite_reward) as avg_reward
			FROM recent_metrics
			GROUP BY provider_id, semantic_class
			HAVING COUNT(*) >= $2
		),
		bandit_arms AS (
			SELECT
				provider_id,
				semantic_class,
				alpha,
				beta
			FROM semantic_bandit_arms
			WHERE tenant_id = $1
		)
		SELECT
			a.provider_id,
			a.semantic_class,
			a.request_count,
			COALESCE(a.success_rate, 0),
			COALESCE(a.avg_latency, 0),
			COALESCE(a.p95_latency, 0),
			COALESCE(a.p99_latency, 0),
			COALESCE(a.avg_cost, 0),
			COALESCE(b.alpha, 1),
			COALESCE(b.beta, 1)
		FROM aggregated a
		LEFT JOIN bandit_arms b ON a.provider_id = b.provider_id
			AND a.semantic_class = b.semantic_class
		ORDER BY a.provider_id, a.semantic_class
	`

	rows, err := a.db.QueryContext(ctx, query, tenantID, a.minRequestCount)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var allMetrics []ProviderMetrics
	for rows.Next() {
		var m ProviderMetrics
		// FIX-2026-02: cognitive-advisor — fixed SQL scan column order.
		// Previous code scanned col 5 (avg_latency) into P95Latency twice, and
		// col 8 (avg_cost) into SuccessRate, corrupting both fields.
		// Now avg_latency and avg_cost are captured in dedicated temp variables.
		var avgLatency, avgCost float64
		if err := rows.Scan(
			&m.Provider,     // col 1: provider_id
			&m.Intent,       // col 2: semantic_class
			&m.RequestCount, // col 3: request_count
			&m.SuccessRate,  // col 4: success_rate ✓
			&avgLatency,     // col 5: avg_latency  (not in ProviderMetrics; kept for SQL arity)
			&m.P95Latency,   // col 6: p95_latency  ✓
			&m.P99Latency,   // col 7: p99_latency  ✓
			&avgCost,        // col 8: avg_cost     (FIX: was incorrectly writing to SuccessRate)
			&m.ThompsonAlpha, // col 9: alpha ✓
			&m.ThompsonBeta,  // col 10: beta ✓
		); err != nil {
			log.Error().Err(err).Msg("Failed to scan provider metrics")
			continue
		}
		_ = avgLatency // informational; p95_latency (col 6) is the authoritative latency value
		_ = avgCost    // FIX-2026-02: cognitive-advisor — avg_cost available for future cost field

		m.ErrorRate = 1.0 - m.SuccessRate
		allMetrics = append(allMetrics, m)
	}

	return allMetrics, rows.Err()
}

// detectDegradationAndPropose analyzes metrics and generates proposals
func (a *Advisor) detectDegradationAndPropose(tenantID string, metrics []ProviderMetrics) []*Proposal {
	var proposals []*Proposal

	// Group by intent
	intentMap := make(map[string][]ProviderMetrics)
	for _, m := range metrics {
		intentMap[m.Intent] = append(intentMap[m.Intent], m)
	}

	// Analyze each intent group
	for intent, providers := range intentMap {
		if len(providers) < 2 {
			continue // Need at least 2 providers to compare
		}

		// Calculate degradation scores
		for i := range providers {
			providers[i].DegradationScore = a.calculateDegradationScore(&providers[i])
		}

		// Find best and worst performers
		var best, worst *ProviderMetrics
		for i := range providers {
			p := &providers[i]
			if best == nil || p.SuccessRate > best.SuccessRate {
				best = p
			}
			if worst == nil || p.DegradationScore > worst.DegradationScore {
				worst = p
			}
		}

		// Generate proposal if significant degradation detected
		if worst != nil && worst.DegradationScore > 0.3 {
			proposal := a.createProposal(tenantID, intent, providers, best, worst)
			if proposal != nil {
				proposals = append(proposals, proposal)
			}
		}
	}

	return proposals
}

// calculateDegradationScore computes a 0-1 degradation score
func (a *Advisor) calculateDegradationScore(m *ProviderMetrics) float64 {
	// Weighted scoring:
	// - Error rate: 40%
	// - P95 latency: 30%
	// - P99 latency: 20%
	// - Thompson beta: 10%

	errorScore := m.ErrorRate * 0.4

	// Latency score (normalized to 0-1, with 5000ms = 1.0)
	latencyScore := math.Min(m.P95Latency/5000.0, 1.0) * 0.3
	p99Score := math.Min(m.P99Latency/10000.0, 1.0) * 0.2

	// Thompson beta score (higher beta = more failures)
	betaScore := 0.0
	if m.ThompsonAlpha+m.ThompsonBeta > 0 {
		betaScore = float64(m.ThompsonBeta) / float64(m.ThompsonAlpha+m.ThompsonBeta) * 0.1
	}

	return errorScore + latencyScore + p99Score + betaScore
}

// createProposal generates a proposal to fix degradation
func (a *Advisor) createProposal(
	tenantID, intent string,
	allProviders []ProviderMetrics,
	best, worst *ProviderMetrics,
) *Proposal {
	// Calculate confidence based on sample size and variance
	confidence := a.calculateConfidence(allProviders)
	if confidence < a.confidenceThresh {
		return nil // Not confident enough
	}

	// Calculate risk score
	riskScore := a.calculateRiskScore(worst, allProviders)

	// Generate proposed changes
	var changes []ProposedChange

	// 1. Adjust Thompson Sampling parameters for worst performer
	newAlpha := int(float64(worst.ThompsonAlpha) * 0.7) // Reduce alpha by 30%
	newBeta := int(float64(worst.ThompsonBeta) * 1.3)   // Increase beta by 30%
	if newAlpha < 1 {
		newAlpha = 1
	}

	changes = append(changes, ProposedChange{
		Type:     ChangeTypeThompsonAlphaBeta,
		Provider: worst.Provider,
		Intent:   intent,
		Alpha:    &newAlpha,
		Beta:     &newBeta,
	})

	// 2. Prefer best performer
	changes = append(changes, ProposedChange{
		Type:       ChangeTypeIntentFilter,
		Intent:     intent,
		Preference: &best.Provider,
	})

	// Calculate projected impact
	latencyReduction := ((worst.P95Latency - best.P95Latency) / worst.P95Latency) * 100
	costSavingPct := 0.0
	if worst.SuccessRate < 0.95 {
		// Assume reduced retries save costs
		costSavingPct = (0.95 - worst.SuccessRate) * 100
	}

	// Generate rationale
	rationale := fmt.Sprintf(
		"Provider '%s' showing degradation for intent '%s': %.1f%% error rate, %.0fms P95 latency. "+
			"Recommend shifting traffic to '%s' with %.1f%% success rate and %.0fms P95 latency.",
		worst.Provider, intent, worst.ErrorRate*100, worst.P95Latency,
		best.Provider, best.SuccessRate*100, best.P95Latency,
	)

	proposal := &Proposal{
		ProposalID:                 fmt.Sprintf("prop_%s", uuid.New().String()[:8]),
		TenantID:                   tenantID,
		GeneratedAt:                time.Now(),
		Confidence:                 confidence,
		RiskScore:                  riskScore,
		Rationale:                  rationale,
		ProposedChanges:            changes,
		Status:                     StatusPending,
	}

	if latencyReduction > 0 {
		proposal.ProjectedLatencyP95Reduct.Valid = true
		proposal.ProjectedLatencyP95Reduct.Float64 = latencyReduction
	}

	if costSavingPct > 0 {
		// Rough estimate: $0.10 per 1000 requests saved
		monthlySavings := (costSavingPct / 100) * float64(worst.RequestCount) * 30 * 0.0001
		proposal.ProjectedCostSavingMonthly.Valid = true
		proposal.ProjectedCostSavingMonthly.Float64 = monthlySavings
	}

	return proposal
}

// calculateConfidence estimates confidence in the proposal
func (a *Advisor) calculateConfidence(providers []ProviderMetrics) float64 {
	if len(providers) == 0 {
		return 0.0
	}

	// Confidence based on:
	// 1. Total request count (more data = higher confidence)
	// 2. Consistency across providers (lower variance = higher confidence)

	totalRequests := int64(0)
	for _, p := range providers {
		totalRequests += p.RequestCount
	}

	// Request count score (0-0.5)
	requestScore := math.Min(float64(totalRequests)/10000.0, 0.5)

	// Consistency score (0-0.5)
	var successRates []float64
	for _, p := range providers {
		successRates = append(successRates, p.SuccessRate)
	}
	variance := a.variance(successRates)
	consistencyScore := math.Max(0.5-variance, 0.0)

	return requestScore + consistencyScore
}

// calculateRiskScore estimates risk of applying the proposal
func (a *Advisor) calculateRiskScore(worst *ProviderMetrics, all []ProviderMetrics) float64 {
	// Risk factors:
	// 1. How different is worst from average (higher = lower risk)
	// 2. Sample size (larger = lower risk)

	avgSuccessRate := 0.0
	for _, p := range all {
		avgSuccessRate += p.SuccessRate
	}
	avgSuccessRate /= float64(len(all))

	diff := math.Abs(worst.SuccessRate - avgSuccessRate)
	differenceScore := 1.0 - math.Min(diff*2, 1.0) // Higher diff = lower risk

	sampleScore := 1.0 - math.Min(float64(worst.RequestCount)/5000.0, 1.0)

	return (differenceScore + sampleScore) / 2.0
}

// variance calculates variance of a slice
func (a *Advisor) variance(values []float64) float64 {
	if len(values) == 0 {
		return 0.0
	}

	mean := 0.0
	for _, v := range values {
		mean += v
	}
	mean /= float64(len(values))

	variance := 0.0
	for _, v := range values {
		diff := v - mean
		variance += diff * diff
	}

	return variance / float64(len(values))
}

// storeProposal saves a proposal to the database
func (a *Advisor) storeProposal(ctx context.Context, proposal *Proposal) error {
	changesJSON, err := json.Marshal(proposal.ProposedChanges)
	if err != nil {
		return fmt.Errorf("failed to marshal proposed changes: %w", err)
	}

	query := `
		INSERT INTO cognitive_proposals (
			proposal_id, tenant_id, confidence, risk_score,
			projected_latency_p95_reduction_pct, projected_cost_saving_usd_monthly,
			rationale, proposed_changes, status
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	_, err = a.db.ExecContext(ctx, query,
		proposal.ProposalID,
		proposal.TenantID,
		proposal.Confidence,
		proposal.RiskScore,
		proposal.ProjectedLatencyP95Reduct,
		proposal.ProjectedCostSavingMonthly,
		proposal.Rationale,
		changesJSON,
		proposal.Status,
	)

	if err != nil {
		return fmt.Errorf("failed to insert proposal: %w", err)
	}

	// Log audit entry
	return a.logAudit(ctx, proposal.ProposalID, ActionGenerated, "cognitive-advisor", "Proposal generated by AI")
}

// logAudit logs an action to the audit trail
func (a *Advisor) logAudit(ctx context.Context, proposalID, action, actor, details string) error {
	query := `
		INSERT INTO cognitive_audit_log (proposal_id, action, actor, details)
		VALUES ($1, $2, $3, $4)
	`

	_, err := a.db.ExecContext(ctx, query, proposalID, action, actor, details)
	return err
}
