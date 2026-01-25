package cognitive

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v3"

	"github.com/Igris-inertial/system/igris-overture/policies"
	"github.com/Igris-inertial/system/igris-overture/router"
)

// Applier applies approved cognitive proposals to the routing system
type Applier struct {
	db            *sql.DB
	policyEngine  *policies.AdvancedPolicyEngine
	semanticRouter *router.SemanticRouter
}

// NewApplier creates a new proposal applier
func NewApplier(
	db *sql.DB,
	policyEngine *policies.AdvancedPolicyEngine,
	semanticRouter *router.SemanticRouter,
) *Applier {
	return &Applier{
		db:            db,
		policyEngine:  policyEngine,
		semanticRouter: semanticRouter,
	}
}

// ApproveProposal approves a proposal for application
func (a *Applier) ApproveProposal(ctx context.Context, proposalID, approvedBy string) error {
	// Update proposal status
	query := `
		UPDATE cognitive_proposals
		SET status = $1, approved_by = $2, approved_at = NOW()
		WHERE proposal_id = $3 AND status = 'pending'
		RETURNING tenant_id
	`

	var tenantID string
	err := a.db.QueryRowContext(ctx, query, StatusApproved, approvedBy, proposalID).Scan(&tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("proposal not found or already processed")
		}
		return fmt.Errorf("failed to approve proposal: %w", err)
	}

	// Log audit
	if err := a.logAudit(ctx, proposalID, ActionApproved, approvedBy, "Proposal approved for application"); err != nil {
		log.Warn().Err(err).Msg("Failed to log audit entry")
	}

	// Record metrics
	// TODO: metrics.RecordCognitiveProposalApproved(tenantID)

	log.Info().
		Str("proposal_id", proposalID).
		Str("tenant_id", tenantID).
		Str("approved_by", approvedBy).
		Msg("Cognitive proposal approved")

	return nil
}

// RejectProposal rejects a proposal
func (a *Applier) RejectProposal(ctx context.Context, proposalID, rejectedBy, reason string) error {
	// Update proposal status
	query := `
		UPDATE cognitive_proposals
		SET status = $1, approved_by = $2, approved_at = NOW()
		WHERE proposal_id = $3 AND status = 'pending'
		RETURNING tenant_id
	`

	var tenantID string
	err := a.db.QueryRowContext(ctx, query, StatusRejected, rejectedBy, proposalID).Scan(&tenantID)
	if err != nil {
		if err == sql.ErrNoRows {
			return fmt.Errorf("proposal not found or already processed")
		}
		return fmt.Errorf("failed to reject proposal: %w", err)
	}

	// Log audit
	details := fmt.Sprintf("Proposal rejected: %s", reason)
	if err := a.logAudit(ctx, proposalID, ActionRejected, rejectedBy, details); err != nil {
		log.Warn().Err(err).Msg("Failed to log audit entry")
	}

	// Record metrics
	// TODO: metrics.RecordCognitiveProposalRejected(tenantID)

	log.Info().
		Str("proposal_id", proposalID).
		Str("tenant_id", tenantID).
		Str("rejected_by", rejectedBy).
		Str("reason", reason).
		Msg("Cognitive proposal rejected")

	return nil
}

// ApplyProposal applies an approved proposal to the routing system
func (a *Applier) ApplyProposal(ctx context.Context, proposalID string) error {
	// Load proposal
	proposal, err := a.loadProposal(ctx, proposalID)
	if err != nil {
		return fmt.Errorf("failed to load proposal: %w", err)
	}

	if proposal.Status != StatusApproved {
		return fmt.Errorf("proposal must be approved before application")
	}

	// Get current policy
	currentPolicy, err := a.policyEngine.GetActivePolicy(ctx, proposal.TenantID)
	if err != nil {
		return fmt.Errorf("failed to get current policy: %w", err)
	}

	// Apply changes to policy
	newPolicyContent, err := a.applyChangesToPolicy(currentPolicy, proposal.ProposedChanges)
	if err != nil {
		return fmt.Errorf("failed to apply changes: %w", err)
	}

	// Convert policy to YAML
	policyYAML, err := yaml.Marshal(newPolicyContent)
	if err != nil {
		return fmt.Errorf("failed to marshal policy: %w", err)
	}

	// Generate new version
	newVersion := fmt.Sprintf("v_cognitive_%d", time.Now().Unix())

	// Load and activate new policy
	newPolicy, err := a.policyEngine.LoadPolicy(
		ctx,
		proposal.TenantID,
		string(policyYAML),
		newVersion,
		"cognitive-advisor",
	)
	if err != nil {
		return fmt.Errorf("failed to load new policy: %w", err)
	}

	if err := a.policyEngine.ActivatePolicy(ctx, newPolicy.ID); err != nil {
		return fmt.Errorf("failed to activate policy: %w", err)
	}

	// Apply exploration rate changes if specified
	if err := a.applyExplorationRateChanges(proposal.ProposedChanges); err != nil {
		log.Warn().Err(err).Msg("Failed to apply exploration rate changes")
	}

	// Update proposal status to applied
	updateQuery := `
		UPDATE cognitive_proposals
		SET status = $1, applied_at = NOW()
		WHERE proposal_id = $2
	`

	if _, err := a.db.ExecContext(ctx, updateQuery, StatusApplied, proposalID); err != nil {
		log.Error().Err(err).Msg("Failed to update proposal status")
	}

	// Log audit
	details := fmt.Sprintf("Proposal applied, new policy version: %s", newVersion)
	if err := a.logAudit(ctx, proposalID, ActionApplied, "cognitive-applier", details); err != nil {
		log.Warn().Err(err).Msg("Failed to log audit entry")
	}

	// Record metrics
	projectedSavings := 0.0
	projectedLatencyReduction := 0.0
	if proposal.ProjectedCostSavingMonthly.Valid {
		projectedSavings = proposal.ProjectedCostSavingMonthly.Float64
	}
	if proposal.ProjectedLatencyP95Reduct.Valid {
		projectedLatencyReduction = proposal.ProjectedLatencyP95Reduct.Float64
	}

	// TODO: Add cognitive metrics
	// metrics.RecordCognitiveProposalApplied(tenantID, savings, latencyReduction)
	_ = projectedSavings
	_ = projectedLatencyReduction

	log.Info().
		Str("proposal_id", proposalID).
		Str("tenant_id", proposal.TenantID).
		Str("new_version", newVersion).
		Int("changes_applied", len(proposal.ProposedChanges)).
		Msg("Cognitive proposal applied successfully")

	return nil
}

// loadProposal loads a proposal from the database
func (a *Applier) loadProposal(ctx context.Context, proposalID string) (*Proposal, error) {
	query := `
		SELECT
			id, proposal_id, tenant_id, generated_at, confidence, risk_score,
			projected_latency_p95_reduction_pct, projected_cost_saving_usd_monthly,
			rationale, proposed_changes::TEXT, shadow_simulation_results::TEXT,
			status, approved_by, approved_at, applied_at, created_at
		FROM cognitive_proposals
		WHERE proposal_id = $1
	`

	var proposal Proposal
	var approvedBy sql.NullString
	var approvedAt, appliedAt sql.NullTime

	err := a.db.QueryRowContext(ctx, query, proposalID).Scan(
		&proposal.ID,
		&proposal.ProposalID,
		&proposal.TenantID,
		&proposal.GeneratedAt,
		&proposal.Confidence,
		&proposal.RiskScore,
		&proposal.ProjectedLatencyP95Reduct,
		&proposal.ProjectedCostSavingMonthly,
		&proposal.Rationale,
		&proposal.ProposedChangesRaw,
		&proposal.ShadowResultsRaw,
		&proposal.Status,
		&approvedBy,
		&approvedAt,
		&appliedAt,
		&proposal.CreatedAt,
	)

	if err != nil {
		return nil, err
	}

	proposal.ApprovedBy = approvedBy
	proposal.ApprovedAt = approvedAt
	proposal.AppliedAt = appliedAt

	// Unmarshal proposed changes
	if err := proposal.UnmarshalProposedChanges(); err != nil {
		return nil, fmt.Errorf("failed to unmarshal proposed changes: %w", err)
	}

	return &proposal, nil
}

// applyChangesToPolicy applies proposed changes to a policy
func (a *Applier) applyChangesToPolicy(
	currentPolicy *policies.AdvancedTenantPolicy,
	changes []ProposedChange,
) (*policies.AdvancedPolicyContent, error) {
	var newContent *policies.AdvancedPolicyContent

	// Start with current policy content or create new
	if currentPolicy != nil && currentPolicy.Content != nil {
		newContent = currentPolicy.Content
	} else {
		newContent = &policies.AdvancedPolicyContent{
			Version:     "2.0",
			Weights:     make(map[string]float64),
			Preferences: make(map[string]interface{}),
		}
	}

	// Apply each change
	for _, change := range changes {
		switch change.Type {
		case ChangeTypeThompsonAlphaBeta:
			// Thompson sampling parameters are stored in database, not policy
			// This is handled separately via bandit arm updates
			log.Debug().
				Str("type", change.Type).
				Str("provider", change.Provider).
				Msg("Thompson sampling changes applied via database")

		case ChangeTypeExplorationRate:
			// Store in preferences
			if newContent.Preferences == nil {
				newContent.Preferences = make(map[string]interface{})
			}
			if change.Weight != nil {
				newContent.Preferences["exploration_rate"] = float64(*change.Weight) / 100.0
			}

		case ChangeTypeIntentFilter:
			// Add intent-specific provider preference
			if change.Preference != nil {
				if newContent.Preferences == nil {
					newContent.Preferences = make(map[string]interface{})
				}
				intentPrefs, ok := newContent.Preferences["intent_preferences"].(map[string]interface{})
				if !ok {
					intentPrefs = make(map[string]interface{})
					newContent.Preferences["intent_preferences"] = intentPrefs
				}
				intentPrefs[change.Intent] = *change.Preference
			}

		case ChangeTypeProviderWeight:
			// Adjust provider weight
			if change.Weight != nil {
				newContent.Weights[change.Provider] = float64(*change.Weight) / 100.0
			}

		default:
			log.Warn().Str("type", change.Type).Msg("Unknown change type")
		}
	}

	return newContent, nil
}

// applyExplorationRateChanges applies exploration rate changes to the semantic router
func (a *Applier) applyExplorationRateChanges(changes []ProposedChange) error {
	for _, change := range changes {
		if change.Type == ChangeTypeExplorationRate && change.Weight != nil {
			rate := float64(*change.Weight) / 100.0
			if err := a.semanticRouter.SetExplorationRate(rate); err != nil {
				return fmt.Errorf("failed to set exploration rate: %w", err)
			}
			log.Info().Float64("rate", rate).Msg("Exploration rate updated")
		}
	}
	return nil
}

// logAudit logs an action to the audit trail
func (a *Applier) logAudit(ctx context.Context, proposalID, action, actor, details string) error {
	query := `
		INSERT INTO cognitive_audit_log (proposal_id, action, actor, details)
		VALUES ($1, $2, $3, $4)
	`

	_, err := a.db.ExecContext(ctx, query, proposalID, action, actor, details)
	return err
}

// ListProposals lists proposals for a tenant
func (a *Applier) ListProposals(ctx context.Context, tenantID string, status string, limit int) ([]*Proposal, error) {
	query := `
		SELECT
			id, proposal_id, tenant_id, generated_at, confidence, risk_score,
			projected_latency_p95_reduction_pct, projected_cost_saving_usd_monthly,
			rationale, proposed_changes::TEXT, status, approved_by, approved_at, created_at
		FROM cognitive_proposals
		WHERE tenant_id = $1
	`

	args := []interface{}{tenantID}
	if status != "" {
		query += " AND status = $2"
		args = append(args, status)
	}

	query += " ORDER BY generated_at DESC LIMIT $" + fmt.Sprintf("%d", len(args)+1)
	args = append(args, limit)

	rows, err := a.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var proposals []*Proposal
	for rows.Next() {
		var p Proposal
		var approvedBy sql.NullString
		var approvedAt sql.NullTime

		if err := rows.Scan(
			&p.ID,
			&p.ProposalID,
			&p.TenantID,
			&p.GeneratedAt,
			&p.Confidence,
			&p.RiskScore,
			&p.ProjectedLatencyP95Reduct,
			&p.ProjectedCostSavingMonthly,
			&p.Rationale,
			&p.ProposedChangesRaw,
			&p.Status,
			&approvedBy,
			&approvedAt,
			&p.CreatedAt,
		); err != nil {
			log.Error().Err(err).Msg("Failed to scan proposal")
			continue
		}

		p.ApprovedBy = approvedBy
		p.ApprovedAt = approvedAt

		if err := p.UnmarshalProposedChanges(); err != nil {
			log.Error().Err(err).Msg("Failed to unmarshal proposed changes")
			continue
		}

		proposals = append(proposals, &p)
	}

	return proposals, rows.Err()
}
