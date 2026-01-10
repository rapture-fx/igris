package router

import (
	"encoding/json"
	"time"
)

// RoutingMetadata contains structured metadata about a routing decision
// OVERTURE-04: Explainable routing traces for observability and debugging
type RoutingMetadata struct {
	// Request identification
	RequestID     string    `json:"request_id"`
	Timestamp     time.Time `json:"timestamp"`
	ModelName     string    `json:"model_name"`
	UserTier      string    `json:"user_tier,omitempty"`

	// Policy evaluation
	PolicyMatch   *PolicyMatchMetadata   `json:"policy_match"`

	// Backend selection
	SelectedBackendID string               `json:"selected_backend_id"`
	SelectionReason   string               `json:"selection_reason"`
	RoutingPolicy     string               `json:"routing_policy"`
	Confidence        float64              `json:"confidence"`

	// Candidate evaluation
	TotalCandidates   int                  `json:"total_candidates"`
	HealthyCandidates int                  `json:"healthy_candidates"`
	TrustedCandidates int                  `json:"trusted_candidates"`
	CandidateScores   []CandidateScore     `json:"candidate_scores"`

	// Trust verification details
	TrustFiltering *TrustFilteringMetadata `json:"trust_filtering,omitempty"`

	// Thompson Sampling details (if applicable)
	ThompsonSampling *ThompsonSamplingMetadata `json:"thompson_sampling,omitempty"`

	// Performance metrics
	RoutingLatencyMs float64              `json:"routing_latency_ms"`
}

// PolicyMatchMetadata contains details about policy evaluation
type PolicyMatchMetadata struct {
	TenantID        string   `json:"tenant_id"`
	PolicyMatched   bool     `json:"policy_matched"`
	Reason          string   `json:"reason"`
	AllowedProviders []string `json:"allowed_providers,omitempty"`
	MaxCostUSD      float64  `json:"max_cost_usd,omitempty"`
	Preference      string   `json:"preference,omitempty"` // "latency" or "cost"
}

// CandidateScore contains scoring details for a single backend candidate
type CandidateScore struct {
	BackendID        string  `json:"backend_id"`
	BackendType      string  `json:"backend_type"`
	Healthy          bool    `json:"healthy"`
	Trusted          bool    `json:"trusted"`
	TrustScore       float64 `json:"trust_score,omitempty"`
	TrustConfidence  float64 `json:"trust_confidence,omitempty"`
	AvgLatencyMs     float64 `json:"avg_latency_ms,omitempty"`
	ErrorRate        float64 `json:"error_rate,omitempty"`
	CurrentLoad      int     `json:"current_load,omitempty"`
	SamplingScore    float64 `json:"sampling_score,omitempty"`   // Thompson Sampling score
	Selected         bool    `json:"selected"`
	RejectionReason  string  `json:"rejection_reason,omitempty"` // Why not selected
}

// TrustFilteringMetadata contains trust verification details
type TrustFilteringMetadata struct {
	TotalCandidates   int      `json:"total_candidates"`
	TrustedCount      int      `json:"trusted_count"`
	BlockedCount      int      `json:"blocked_count"`
	BlockedProviders  []string `json:"blocked_providers,omitempty"`
	BlockedReasons    []string `json:"blocked_reasons,omitempty"`
}

// ThompsonSamplingMetadata contains Thompson Sampling decision details
type ThompsonSamplingMetadata struct {
	GlobalExplorationCount int      `json:"global_exploration_count"`
	ExplorationRate        float64  `json:"exploration_rate"`
	BudgetRemaining        int      `json:"budget_remaining"`
	DecisionType           string   `json:"decision_type"` // "bootstrap", "explore", "exploit"
	SelectedBackendPhase   string   `json:"selected_backend_phase"`
	SelectedBackendSamples int      `json:"selected_backend_samples"`
	SelectedBackendAlpha   float64  `json:"selected_backend_alpha,omitempty"`
	SelectedBackendBeta    float64  `json:"selected_backend_beta,omitempty"`
}

// ToJSON converts RoutingMetadata to JSON string
func (rm *RoutingMetadata) ToJSON() (string, error) {
	bytes, err := json.Marshal(rm)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// ToJSONPretty converts RoutingMetadata to pretty-printed JSON string
func (rm *RoutingMetadata) ToJSONPretty() (string, error) {
	bytes, err := json.MarshalIndent(rm, "", "  ")
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// FromJSON parses RoutingMetadata from JSON string
func FromJSON(jsonStr string) (*RoutingMetadata, error) {
	var metadata RoutingMetadata
	err := json.Unmarshal([]byte(jsonStr), &metadata)
	if err != nil {
		return nil, err
	}
	return &metadata, nil
}

// MetadataBuilder helps build RoutingMetadata incrementally
type MetadataBuilder struct {
	metadata *RoutingMetadata
}

// NewMetadataBuilder creates a new metadata builder
func NewMetadataBuilder(requestID string, modelName string) *MetadataBuilder {
	return &MetadataBuilder{
		metadata: &RoutingMetadata{
			RequestID:       requestID,
			Timestamp:       time.Now(),
			ModelName:       modelName,
			CandidateScores: []CandidateScore{},
		},
	}
}

// WithUserTier sets the user tier
func (mb *MetadataBuilder) WithUserTier(tier string) *MetadataBuilder {
	mb.metadata.UserTier = tier
	return mb
}

// WithPolicyMatch sets policy match metadata
func (mb *MetadataBuilder) WithPolicyMatch(tenantID string, matched bool, reason string, allowedProviders []string, maxCost float64, preference string) *MetadataBuilder {
	mb.metadata.PolicyMatch = &PolicyMatchMetadata{
		TenantID:        tenantID,
		PolicyMatched:   matched,
		Reason:          reason,
		AllowedProviders: allowedProviders,
		MaxCostUSD:      maxCost,
		Preference:      preference,
	}
	return mb
}

// WithSelection sets backend selection metadata
func (mb *MetadataBuilder) WithSelection(backendID string, reason string, policy string, confidence float64) *MetadataBuilder {
	mb.metadata.SelectedBackendID = backendID
	mb.metadata.SelectionReason = reason
	mb.metadata.RoutingPolicy = policy
	mb.metadata.Confidence = confidence
	return mb
}

// WithCandidateCounts sets candidate count metadata
func (mb *MetadataBuilder) WithCandidateCounts(total, healthy, trusted int) *MetadataBuilder {
	mb.metadata.TotalCandidates = total
	mb.metadata.HealthyCandidates = healthy
	mb.metadata.TrustedCandidates = trusted
	return mb
}

// AddCandidateScore adds a candidate score entry
func (mb *MetadataBuilder) AddCandidateScore(score CandidateScore) *MetadataBuilder {
	mb.metadata.CandidateScores = append(mb.metadata.CandidateScores, score)
	return mb
}

// WithTrustFiltering sets trust filtering metadata
func (mb *MetadataBuilder) WithTrustFiltering(total, trusted, blocked int, blockedProviders []string, blockedReasons []string) *MetadataBuilder {
	mb.metadata.TrustFiltering = &TrustFilteringMetadata{
		TotalCandidates:  total,
		TrustedCount:     trusted,
		BlockedCount:     blocked,
		BlockedProviders: blockedProviders,
		BlockedReasons:   blockedReasons,
	}
	return mb
}

// WithThompsonSampling sets Thompson Sampling metadata
func (mb *MetadataBuilder) WithThompsonSampling(globalExplorations int, explorationRate float64, budgetRemaining int, decisionType string, backendPhase string, backendSamples int, alpha, beta float64) *MetadataBuilder {
	mb.metadata.ThompsonSampling = &ThompsonSamplingMetadata{
		GlobalExplorationCount: globalExplorations,
		ExplorationRate:        explorationRate,
		BudgetRemaining:        budgetRemaining,
		DecisionType:           decisionType,
		SelectedBackendPhase:   backendPhase,
		SelectedBackendSamples: backendSamples,
		SelectedBackendAlpha:   alpha,
		SelectedBackendBeta:    beta,
	}
	return mb
}

// WithRoutingLatency sets routing latency
func (mb *MetadataBuilder) WithRoutingLatency(latencyMs float64) *MetadataBuilder {
	mb.metadata.RoutingLatencyMs = latencyMs
	return mb
}

// Build returns the constructed RoutingMetadata
func (mb *MetadataBuilder) Build() *RoutingMetadata {
	return mb.metadata
}

// RoutingTrace combines routing metadata with request outcome
// Used for end-to-end tracing and observability
type RoutingTrace struct {
	Metadata        *RoutingMetadata `json:"metadata"`
	RequestOutcome  *RequestOutcome  `json:"request_outcome,omitempty"`
}

// RequestOutcome contains the result of a routed request
type RequestOutcome struct {
	Success            bool      `json:"success"`
	ActualLatencyMs    float64   `json:"actual_latency_ms"`
	ErrorMessage       string    `json:"error_message,omitempty"`
	StatusCode         int       `json:"status_code,omitempty"`
	TokensUsed         int       `json:"tokens_used,omitempty"`
	ActualCostUSD      float64   `json:"actual_cost_usd,omitempty"`
	CompletionTime     time.Time `json:"completion_time"`
}

// AddOutcome adds request outcome to the trace
func (rt *RoutingTrace) AddOutcome(success bool, latencyMs float64, err error, statusCode int, tokensUsed int, costUSD float64) {
	outcome := &RequestOutcome{
		Success:         success,
		ActualLatencyMs: latencyMs,
		StatusCode:      statusCode,
		TokensUsed:      tokensUsed,
		ActualCostUSD:   costUSD,
		CompletionTime:  time.Now(),
	}

	if err != nil {
		outcome.ErrorMessage = err.Error()
	}

	rt.RequestOutcome = outcome
}

// ToJSON converts RoutingTrace to JSON string
func (rt *RoutingTrace) ToJSON() (string, error) {
	bytes, err := json.Marshal(rt)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// ToJSONPretty converts RoutingTrace to pretty-printed JSON string
func (rt *RoutingTrace) ToJSONPretty() (string, error) {
	bytes, err := json.MarshalIndent(rt, "", "  ")
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}
