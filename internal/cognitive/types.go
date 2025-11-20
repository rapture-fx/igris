package cognitive

import (
	"database/sql"
	"encoding/json"
	"time"
)

// Proposal represents a cognitive policy optimization proposal
type Proposal struct {
	ID                             int64                  `db:"id" json:"id"`
	ProposalID                     string                 `db:"proposal_id" json:"proposal_id"`
	TenantID                       string                 `db:"tenant_id" json:"tenant_id"`
	GeneratedAt                    time.Time              `db:"generated_at" json:"generated_at"`
	Confidence                     float64                `db:"confidence" json:"confidence"`
	RiskScore                      float64                `db:"risk_score" json:"risk_score"`
	ProjectedLatencyP95Reduct      sql.NullFloat64        `db:"projected_latency_p95_reduction_pct" json:"projected_latency_p95_reduction_pct,omitempty"`
	ProjectedCostSavingMonthly     sql.NullFloat64        `db:"projected_cost_saving_usd_monthly" json:"projected_cost_saving_usd_monthly,omitempty"`
	Rationale                      string                 `db:"rationale" json:"rationale"`
	ProposedChangesRaw             json.RawMessage        `db:"proposed_changes" json:"-"`
	ProposedChanges                []ProposedChange       `db:"-" json:"proposed_changes"`
	ShadowResultsRaw               json.RawMessage        `db:"shadow_simulation_results" json:"-"`
	ShadowResults                  map[string]interface{} `db:"-" json:"shadow_simulation_results,omitempty"`
	Status                         string                 `db:"status" json:"status"`
	ApprovedBy                     sql.NullString         `db:"approved_by" json:"approved_by,omitempty"`
	ApprovedAt                     sql.NullTime           `db:"approved_at" json:"approved_at,omitempty"`
	AppliedAt                      sql.NullTime           `db:"applied_at" json:"applied_at,omitempty"`
	CreatedAt                      time.Time              `db:"created_at" json:"created_at"`
}

// ProposedChange represents a single policy change in a proposal
type ProposedChange struct {
	Type       string  `json:"type"` // thompson_alpha_beta | exploration_rate | intent_filter | provider_weight
	Provider   string  `json:"provider,omitempty"`
	Intent     string  `json:"intent,omitempty"`
	Alpha      *int    `json:"alpha,omitempty"`
	Beta       *int    `json:"beta,omitempty"`
	Weight     *int    `json:"new_exploration_rate,omitempty"` // 0-100
	Preference *string `json:"preferred_provider,omitempty"`
}

// AuditLogEntry represents an audit log entry for proposal actions
type AuditLogEntry struct {
	ID         int64     `db:"id" json:"id"`
	ProposalID string    `db:"proposal_id" json:"proposal_id"`
	Action     string    `db:"action" json:"action"`
	Actor      string    `db:"actor" json:"actor"`
	Details    string    `db:"details" json:"details"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

// ProposalStatus constants
const (
	StatusPending  = "pending"
	StatusApproved = "approved"
	StatusRejected = "rejected"
	StatusApplied  = "applied"
	StatusExpired  = "expired"
)

// ChangeType constants
const (
	ChangeTypeThompsonAlphaBeta = "thompson_alpha_beta"
	ChangeTypeExplorationRate   = "exploration_rate"
	ChangeTypeIntentFilter      = "intent_filter"
	ChangeTypeProviderWeight    = "provider_weight"
)

// AuditAction constants
const (
	ActionGenerated = "generated"
	ActionApproved  = "approved"
	ActionRejected  = "rejected"
	ActionApplied   = "applied"
	ActionExpired   = "expired"
)

// MarshalJSON custom marshaling to handle nullable fields
func (p *Proposal) MarshalJSON() ([]byte, error) {
	type Alias Proposal
	return json.Marshal(&struct {
		*Alias
		ProjectedLatencyP95Reduct  *float64               `json:"projected_latency_p95_reduction_pct,omitempty"`
		ProjectedCostSavingMonthly *float64               `json:"projected_cost_saving_usd_monthly,omitempty"`
		ApprovedBy                 *string                `json:"approved_by,omitempty"`
		ApprovedAt                 *time.Time             `json:"approved_at,omitempty"`
		AppliedAt                  *time.Time             `json:"applied_at,omitempty"`
		ProposedChanges            []ProposedChange       `json:"proposed_changes"`
		ShadowResults              map[string]interface{} `json:"shadow_simulation_results,omitempty"`
	}{
		Alias:           (*Alias)(p),
		ProjectedLatencyP95Reduct: func() *float64 {
			if p.ProjectedLatencyP95Reduct.Valid {
				return &p.ProjectedLatencyP95Reduct.Float64
			}
			return nil
		}(),
		ProjectedCostSavingMonthly: func() *float64 {
			if p.ProjectedCostSavingMonthly.Valid {
				return &p.ProjectedCostSavingMonthly.Float64
			}
			return nil
		}(),
		ApprovedBy: func() *string {
			if p.ApprovedBy.Valid {
				return &p.ApprovedBy.String
			}
			return nil
		}(),
		ApprovedAt: func() *time.Time {
			if p.ApprovedAt.Valid {
				return &p.ApprovedAt.Time
			}
			return nil
		}(),
		AppliedAt: func() *time.Time {
			if p.AppliedAt.Valid {
				return &p.AppliedAt.Time
			}
			return nil
		}(),
		ProposedChanges: p.ProposedChanges,
		ShadowResults:   p.ShadowResults,
	})
}

// UnmarshalProposedChanges unmarshals the JSONB proposed_changes into ProposedChanges slice
func (p *Proposal) UnmarshalProposedChanges() error {
	if len(p.ProposedChangesRaw) > 0 {
		return json.Unmarshal(p.ProposedChangesRaw, &p.ProposedChanges)
	}
	return nil
}

// UnmarshalShadowResults unmarshals the JSONB shadow_simulation_results into ShadowResults map
func (p *Proposal) UnmarshalShadowResults() error {
	if len(p.ShadowResultsRaw) > 0 {
		return json.Unmarshal(p.ShadowResultsRaw, &p.ShadowResults)
	}
	return nil
}

// ProviderMetrics represents degradation metrics for a provider
type ProviderMetrics struct {
	Provider           string
	Intent             string
	ErrorRate          float64
	P95Latency         float64
	P99Latency         float64
	SuccessRate        float64
	RequestCount       int64
	ThompsonAlpha      int
	ThompsonBeta       int
	CurrentWeight      int
	RecommendedAlpha   int
	RecommendedBeta    int
	RecommendedWeight  int
	DegradationScore   float64 // 0-1, higher = more degraded
	ConfidenceInterval float64
}
