package api

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/Igris-inertial/system/igris-overture/middleware"
	"github.com/Igris-inertial/system/igris-overture/policyproposals"
	"github.com/Igris-inertial/system/igris-overture/trustrecs"
)

// RegisterTrustRecommendationRoutes exposes a read-only, deterministic list of
// execution-trust attention items derived entirely from already-aggregated
// execution truth (the same task/proof/recovery/approval/eval metrics behind
// Execution Intelligence) plus, when present, policy-proposal freshness.
//
// It is NOT an AI advisor: it never calls a model, never reads prompts or model
// output, never mutates anything, never replays runs, and persists nothing. Each
// finding is a deterministic threshold over tenant-scoped aggregates with a
// plain-language operator action.
func RegisterTrustRecommendationRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		return
	}
	v1 := app.Group("/v1/execution/trust-recommendations")
	v1.Use(middleware.BetterAuth(db))
	store := &trustrecs.SQLStore{DB: db}
	v1.Get("", handleTrustRecommendations(db))
	v1.Get("/states", handleTrustRecommendationStates(store))
	v1.Patch("/:id/state", handleTrustRecommendationStatePatch(store))
}

const (
	trustSeverityCritical = "critical"
	trustSeverityWarning  = "warning"
	trustSeverityInfo     = "info"

	trustCategoryAgent      = "agent"
	trustCategoryAction     = "action"
	trustCategoryEvaluation = "evaluation"
	trustCategoryProof      = "proof"
	trustCategoryPolicy     = "policy"

	// Activity floors — never flag entities with too few runs to be meaningful.
	trustMinActiveRuns  = 3
	trustMinRunsForRate = 5
	trustMinEvalRuns    = 3

	// Deterministic thresholds (documented inline; tuned conservatively).
	trustRecoveryWarn     = 0.10
	trustProofWarn        = 0.95
	trustProofCritical    = 0.80
	trustEvalPassWarn     = 0.90
	trustEvalPassCritical = 0.75
	trustFailureWarn      = 0.10
	trustFailureCritical  = 0.25
	trustApprovalWarn     = 0.90

	trustProposalStaleAfter = 7 * 24 * time.Hour

	trustDefaultLimit = 50
	trustMaxLimit     = 200

	// Sentinel keys the intelligence breakdown uses for unattributed rows; these
	// are not actionable/linkable, so they are skipped.
	trustUnattributedAgent = "unattributed"
	trustUnknownAction     = "unknown_action"
)

type trustLink struct {
	Rel   string `json:"rel"`
	Label string `json:"label"`
}

type trustRecommendation struct {
	ID                string         `json:"id"`
	Severity          string         `json:"severity"`
	Category          string         `json:"category"`
	Title             string         `json:"title"`
	Summary           string         `json:"summary"`
	Reason            string         `json:"reason"`
	RecommendedAction string         `json:"recommended_action"`
	EntityType        string         `json:"entity_type,omitempty"`
	EntityID          string         `json:"entity_id,omitempty"`
	EntityName        string         `json:"entity_name,omitempty"`
	Metrics           map[string]any `json:"metrics"`
	Links             []trustLink    `json:"links"`

	// Lifecycle overlay (defaults to "active" when an operator has not triaged
	// the finding). These never change how a recommendation is generated.
	State          string     `json:"state"`
	StateReason    string     `json:"state_reason,omitempty"`
	SnoozedUntil   *time.Time `json:"snoozed_until,omitempty"`
	AcknowledgedAt *time.Time `json:"acknowledged_at,omitempty"`
	ResolvedAt     *time.Time `json:"resolved_at,omitempty"`
}

// trustProposalInput is the safe, minimal projection of a policy proposal the
// recommendation builder needs (no criteria, no simulation payload).
type trustProposalInput struct {
	ID          string
	Name        string
	Status      string
	SimulatedAt *time.Time
}

func handleTrustRecommendations(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		if strings.TrimSpace(c.Query("tenant_id")) != "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "tenant_override_rejected",
				"message": "tenant_id must not be supplied",
			})
		}

		rangeToken, ok := normalizeTrustRange(c.Query("range", "7d"))
		if !ok {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_range"})
		}
		interval := rangeToInterval(rangeToken)

		limit := c.QueryInt("limit", trustDefaultLimit)
		if limit <= 0 {
			limit = trustDefaultLimit
		}
		if limit > trustMaxLimit {
			limit = trustMaxLimit
		}

		agents, err := queryExecutionIntelligenceBreakdown(c.Context(), db, tenantID, interval, "agent")
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		actions, err := queryExecutionIntelligenceBreakdown(c.Context(), db, tenantID, interval, "action")
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		// Policy proposals are best-effort: the table may not exist in every
		// deployment, so a load failure degrades to "no proposal findings" rather
		// than failing the whole endpoint.
		proposals := loadTrustProposals(c.Context(), db, tenantID)

		recs := buildTrustRecommendations(rangeToken, agents, actions, proposals)

		// Overlay the operator lifecycle state (also best-effort: when the state
		// table is absent every finding simply reads as active). Snoozed and
		// resolved findings are hidden from the default view.
		states := loadTrustStates(c.Context(), db, tenantID)
		recs = applyTrustState(recs, states, time.Now().UTC(),
			c.QueryBool("include_resolved", false), c.QueryBool("include_snoozed", false))

		if len(recs) > limit {
			recs = recs[:limit]
		}

		return c.JSON(fiber.Map{
			"range":           rangeToken,
			"generated_at":    time.Now().UTC().Format(time.RFC3339),
			"recommendations": recs,
		})
	}
}

// applyTrustState overlays operator lifecycle state onto generated findings by
// stable id and applies the default visibility filter. It is pure (no DB) so it
// is unit-tested directly. A snooze whose expiry has passed reads as active.
func applyTrustState(recs []trustRecommendation, states map[string]trustrecs.State, now time.Time, includeResolved, includeSnoozed bool) []trustRecommendation {
	out := make([]trustRecommendation, 0, len(recs))
	for _, r := range recs {
		effective := trustrecs.StatusActive
		if st, ok := states[r.ID]; ok {
			effective = st.EffectiveStatus(now)
			r.StateReason = st.Reason
			r.AcknowledgedAt = st.AcknowledgedAt
			r.ResolvedAt = st.ResolvedAt
			if effective == trustrecs.StatusSnoozed {
				r.SnoozedUntil = st.SnoozedUntil
			}
		}
		r.State = effective
		if effective == trustrecs.StatusResolved && !includeResolved {
			continue
		}
		if effective == trustrecs.StatusSnoozed && !includeSnoozed {
			continue
		}
		out = append(out, r)
	}
	return out
}

// loadTrustStates returns the tenant's lifecycle rows keyed by recommendation id.
// Any error (including a missing table where migration 066 is unapplied) degrades
// to an empty map, so every finding reads as active.
func loadTrustStates(ctx context.Context, db *sql.DB, tenantID string) map[string]trustrecs.State {
	store := &trustrecs.SQLStore{DB: db}
	items, err := store.List(ctx, tenantID)
	if err != nil {
		return map[string]trustrecs.State{}
	}
	out := make(map[string]trustrecs.State, len(items))
	for _, st := range items {
		out[st.RecommendationID] = st
	}
	return out
}

type trustStatePatchRequest struct {
	TenantID       string `json:"tenant_id"`
	Status         string `json:"status"`
	Reason         string `json:"reason"`
	SnoozeDuration string `json:"snooze_duration"`
}

// trustSnoozeDurations bounds snooze to a few simple windows; clients never send
// a raw timestamp.
var trustSnoozeDurations = map[string]time.Duration{
	"1d":  24 * time.Hour,
	"7d":  7 * 24 * time.Hour,
	"30d": 30 * 24 * time.Hour,
}

func handleTrustRecommendationStatePatch(store *trustrecs.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		recommendationID := strings.TrimSpace(c.Params("id"))
		if recommendationID == "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_recommendation_id"})
		}

		var req trustStatePatchRequest
		if err := decodeTrustStateBody(c.Body(), &req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		if strings.TrimSpace(req.TenantID) != "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "tenant_override_rejected",
				"message": "tenant_id must not be supplied in the request body",
			})
		}

		input := trustrecs.UpsertInput{
			RecommendationID: recommendationID,
			Status:           strings.TrimSpace(req.Status),
			Reason:           req.Reason,
		}
		if input.Status == trustrecs.StatusSnoozed {
			dur, ok := trustSnoozeDurations[strings.TrimSpace(req.SnoozeDuration)]
			if !ok {
				dur = trustSnoozeDurations["7d"]
			}
			until := time.Now().UTC().Add(dur)
			input.SnoozedUntil = &until
		}

		state, err := store.Upsert(c.Context(), tenantID, input)
		if err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_state", "message": err.Error()})
		}
		return c.JSON(fiber.Map{"state": state})
	}
}

func handleTrustRecommendationStates(store *trustrecs.SQLStore) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		items, err := store.List(c.Context(), tenantID)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(fiber.Map{"states": items, "total": len(items)})
	}
}

func decodeTrustStateBody(body []byte, out any) error {
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	return decoder.Decode(out)
}

// normalizeTrustRange bounds the window to 24h/7d/30d (accepting the last_*
// aliases). Returns the canonical short token.
func normalizeTrustRange(raw string) (string, bool) {
	switch strings.TrimSpace(raw) {
	case "24h", "last_24h":
		return "24h", true
	case "7d", "last_7d", "":
		return "7d", true
	case "30d", "last_30d":
		return "30d", true
	default:
		return "", false
	}
}

// buildTrustRecommendations is the deterministic core: it is DB-free and pure so
// it can be unit-tested directly. Findings are ordered by severity, then by
// category and entity for a stable result.
func buildTrustRecommendations(rangeToken string, agents, actions []intelligenceBreakdown, proposals []trustProposalInput) []trustRecommendation {
	recs := make([]trustRecommendation, 0)
	window := trustRangeLabel(rangeToken)

	for _, a := range agents {
		if a.Key == "" || a.Key == trustUnattributedAgent {
			continue
		}
		// Active agent with no evaluation coverage at all.
		if a.TotalRuns >= trustMinActiveRuns && a.EvalRunCount == 0 {
			recs = append(recs, trustRecommendation{
				ID:                trustID(trustCategoryAgent, "no_eval_coverage", a.Key),
				Severity:          trustSeverityWarning,
				Category:          trustCategoryAgent,
				Title:             "Agent has no evaluations",
				Summary:           "This agent is running actions but no execution evaluations cover its behavior.",
				Reason:            fmt.Sprintf("%d runs in the last %s with no execution evaluations.", a.TotalRuns, window),
				RecommendedAction: "Create an evaluation for this agent.",
				EntityType:        "agent",
				EntityID:          a.Key,
				EntityName:        a.Name,
				Metrics:           map[string]any{"total_runs": a.TotalRuns, "eval_run_count": a.EvalRunCount},
				Links:             []trustLink{{Rel: "agent", Label: "Open agent"}, {Rel: "evaluations_new", Label: "Create evaluation"}},
			})
		}
		// Low evaluation pass rate (only when there is enough eval signal).
		if a.EvalRunCount >= trustMinEvalRuns && a.EvalPassRate < trustEvalPassWarn {
			severity := trustSeverityWarning
			if a.EvalPassRate < trustEvalPassCritical {
				severity = trustSeverityCritical
			}
			recs = append(recs, trustRecommendation{
				ID:                trustID(trustCategoryAgent, "low_eval_pass", a.Key),
				Severity:          severity,
				Category:          trustCategoryEvaluation,
				Title:             "Agent evaluation pass rate is low",
				Summary:           "Evaluations for this agent are failing more often than expected.",
				Reason:            fmt.Sprintf("%s eval pass rate across %d eval runs in the last %s.", pct(a.EvalPassRate), a.EvalRunCount, window),
				RecommendedAction: "Review failed evaluation results.",
				EntityType:        "agent",
				EntityID:          a.Key,
				EntityName:        a.Name,
				Metrics:           map[string]any{"eval_pass_rate": a.EvalPassRate, "eval_run_count": a.EvalRunCount},
				Links:             []trustLink{{Rel: "agent", Label: "Open agent"}, {Rel: "evaluations", Label: "Review evaluations"}},
			})
		}
	}

	for _, a := range actions {
		if a.Key == "" || a.Key == trustUnknownAction {
			continue
		}
		if a.TotalRuns < trustMinRunsForRate {
			continue
		}
		// High recovery rate.
		if a.RecoveryRate > trustRecoveryWarn {
			recs = append(recs, trustRecommendation{
				ID:                trustID(trustCategoryAction, "high_recovery", a.Key),
				Severity:          trustSeverityWarning,
				Category:          trustCategoryAction,
				Title:             "Action recovers often",
				Summary:           "This action needed recovery on a meaningful share of its runs.",
				Reason:            fmt.Sprintf("Recovered in %s of %d runs in the last %s.", pct(a.RecoveryRate), a.TotalRuns, window),
				RecommendedAction: "Inspect recent recovered runs.",
				EntityType:        "action",
				EntityID:          a.Key,
				EntityName:        a.Name,
				Metrics:           map[string]any{"recovery_rate": a.RecoveryRate, "recovery_runs": a.RecoveryRuns, "total_runs": a.TotalRuns},
				Links:             []trustLink{{Rel: "action", Label: "Open action"}, {Rel: "runs", Label: "View runs"}},
			})
		}
		// Low proof coverage.
		if a.ProofCoverage < trustProofWarn {
			severity := trustSeverityWarning
			if a.ProofCoverage < trustProofCritical {
				severity = trustSeverityCritical
			}
			recs = append(recs, trustRecommendation{
				ID:                trustID(trustCategoryAction, "low_proof", a.Key),
				Severity:          severity,
				Category:          trustCategoryProof,
				Title:             "Action proof coverage is low",
				Summary:           "Some runs of this action completed without recorded proof or receipt.",
				Reason:            fmt.Sprintf("%s proof coverage across %d runs in the last %s.", pct(a.ProofCoverage), a.TotalRuns, window),
				RecommendedAction: "Inspect proof and receipt state.",
				EntityType:        "action",
				EntityID:          a.Key,
				EntityName:        a.Name,
				Metrics:           map[string]any{"proof_coverage": a.ProofCoverage, "proof_covered_runs": a.ProofCoveredRuns, "total_runs": a.TotalRuns},
				Links:             []trustLink{{Rel: "action", Label: "Open action"}},
			})
		}
		// High failure rate.
		if a.FailureRate > trustFailureWarn {
			severity := trustSeverityWarning
			if a.FailureRate > trustFailureCritical {
				severity = trustSeverityCritical
			}
			recs = append(recs, trustRecommendation{
				ID:                trustID(trustCategoryAction, "high_failure", a.Key),
				Severity:          severity,
				Category:          trustCategoryAction,
				Title:             "Action fails often",
				Summary:           "This action failed on a meaningful share of its runs.",
				Reason:            fmt.Sprintf("%s failure rate across %d runs in the last %s.", pct(a.FailureRate), a.TotalRuns, window),
				RecommendedAction: "Inspect recent failed runs.",
				EntityType:        "action",
				EntityID:          a.Key,
				EntityName:        a.Name,
				Metrics:           map[string]any{"failure_rate": a.FailureRate, "failed_runs": a.FailedRuns, "total_runs": a.TotalRuns},
				Links:             []trustLink{{Rel: "action", Label: "Open action"}, {Rel: "runs", Label: "View runs"}},
			})
		}
		// Approval-heavy action.
		if a.ApprovalRate > trustApprovalWarn {
			recs = append(recs, trustRecommendation{
				ID:                trustID(trustCategoryAction, "approval_heavy", a.Key),
				Severity:          trustSeverityWarning,
				Category:          trustCategoryPolicy,
				Title:             "Action requires approval on nearly every run",
				Summary:           "Almost every run of this action paused for human approval.",
				Reason:            fmt.Sprintf("%s of %d runs required approval in the last %s.", pct(a.ApprovalRate), a.TotalRuns, window),
				RecommendedAction: "Review whether the policy is too strict or the action is inherently sensitive.",
				EntityType:        "action",
				EntityID:          a.Key,
				EntityName:        a.Name,
				Metrics:           map[string]any{"approval_rate": a.ApprovalRate, "approval_required_runs": a.ApprovalRequiredRuns, "total_runs": a.TotalRuns},
				Links:             []trustLink{{Rel: "action", Label: "Open action"}},
			})
		}
	}

	now := time.Now().UTC()
	for _, p := range proposals {
		if p.Status != policyproposals.StatusApproved {
			continue
		}
		stale := p.SimulatedAt == nil || now.Sub(*p.SimulatedAt) > trustProposalStaleAfter
		if !stale {
			continue
		}
		reason := "Approved proposal has no recorded simulation."
		if p.SimulatedAt != nil {
			reason = fmt.Sprintf("Approved proposal last simulated %d days ago.", int(now.Sub(*p.SimulatedAt).Hours()/24))
		}
		recs = append(recs, trustRecommendation{
			ID:                trustID(trustCategoryPolicy, "proposal_stale", p.ID),
			Severity:          trustSeverityWarning,
			Category:          trustCategoryPolicy,
			Title:             "Approved policy proposal is stale",
			Summary:           "This proposal was approved but its simulation evidence is out of date.",
			Reason:            reason,
			RecommendedAction: "Re-simulate before promotion.",
			EntityType:        "policy_proposal",
			EntityID:          p.ID,
			EntityName:        p.Name,
			Metrics:           map[string]any{},
			Links:             []trustLink{{Rel: "proposal", Label: "Open proposal"}},
		})
	}

	sortTrustRecommendations(recs)
	return recs
}

func sortTrustRecommendations(recs []trustRecommendation) {
	rank := map[string]int{trustSeverityCritical: 0, trustSeverityWarning: 1, trustSeverityInfo: 2}
	sort.SliceStable(recs, func(i, j int) bool {
		if rank[recs[i].Severity] != rank[recs[j].Severity] {
			return rank[recs[i].Severity] < rank[recs[j].Severity]
		}
		if recs[i].Category != recs[j].Category {
			return recs[i].Category < recs[j].Category
		}
		return recs[i].ID < recs[j].ID
	})
}

// loadTrustProposals returns the tenant's approved proposals (safe projection
// only). Any error — including a missing table in deployments where the policy
// proposal migration has not been applied — degrades to an empty slice.
func loadTrustProposals(ctx context.Context, db *sql.DB, tenantID string) []trustProposalInput {
	store := &policyproposals.SQLStore{DB: db}
	items, err := store.List(ctx, tenantID)
	if err != nil {
		return nil
	}
	out := make([]trustProposalInput, 0, len(items))
	for _, p := range items {
		if p.Status != policyproposals.StatusApproved {
			continue
		}
		out = append(out, trustProposalInput{
			ID:          p.ProposalID.String(),
			Name:        p.Name,
			Status:      p.Status,
			SimulatedAt: parseProposalSimulatedAt(p.LatestSimulation),
		})
	}
	return out
}

func parseProposalSimulatedAt(raw json.RawMessage) *time.Time {
	if len(raw) == 0 {
		return nil
	}
	var s struct {
		SimulatedAt *time.Time `json:"simulated_at"`
	}
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil
	}
	return s.SimulatedAt
}

func trustID(category, signal, key string) string {
	return fmt.Sprintf("%s:%s:%s", category, signal, key)
}

func trustRangeLabel(token string) string {
	switch token {
	case "24h":
		return "24 hours"
	case "30d":
		return "30 days"
	default:
		return "7 days"
	}
}

// pct renders a 0..1 rate as a whole-number percentage string.
func pct(rate float64) string {
	return fmt.Sprintf("%d%%", int(rate*100+0.5))
}
