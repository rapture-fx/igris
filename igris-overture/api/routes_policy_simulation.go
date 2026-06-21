package api

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterPolicySimulationRoutes exposes a read-only, deterministic preview of
// how a proposed policy rule would have classified recent execution records.
//
// It NEVER mutates policy, replays runs, dispatches tasks, calls runtimes, or
// reads prompts/model output. It only aggregates already-persisted execution
// truth (task lifecycle rows, policy-decision action names, approval, recovery,
// proof, and eval-run state), tenant- and time-bounded, and returns impact
// counts plus safe identifiers. There is no persistence and no migration: the
// simulation is computed on the fly from existing tables.
func RegisterPolicySimulationRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		return
	}
	v1 := app.Group("/v1/policy/simulate")
	v1.Use(middleware.BetterAuth(db))
	v1.Post("", handlePolicySimulate(db))
}

// policySimulateRequest is the strict, allow-listed request body. tenant_id is
// present only so it can be explicitly rejected with a clear message; every
// other unknown field is rejected by DisallowUnknownFields.
type policySimulateRequest struct {
	TenantID string `json:"tenant_id"`

	Range      string `json:"range"`
	PolicyMode string `json:"policy_mode"`

	// Match criteria (all optional, combined with AND). At least one is required
	// for a run to be considered affected; with none, the simulation warns and
	// classifies nothing as affected rather than inventing impact.
	MatchActionName   string `json:"match_action_name"`
	MatchActionPrefix string `json:"match_action_prefix"`
	MatchAgentID      string `json:"match_agent_id"`
	MatchAgentType    string `json:"match_agent_type"`
	MatchResultStatus string `json:"match_result_status"`

	RequireProofMissing     bool `json:"require_proof_missing"`
	RequireRecoveryOccurred bool `json:"require_recovery_occurred"`
	RequireEvalFailed       bool `json:"require_eval_failed"`
}

type policySimAffectedAgent struct {
	Key      string `json:"key"`
	Name     string `json:"name"`
	RunCount int64  `json:"run_count"`
}

type policySimAffectedAction struct {
	Name     string `json:"name"`
	RunCount int64  `json:"run_count"`
}

type policySimSampleRun struct {
	TaskID string `json:"task_id"`
	Status string `json:"status"`
}

type policySimulateResponse struct {
	Range                string                    `json:"range"`
	PolicyMode           string                    `json:"policy_mode"`
	Source               string                    `json:"source"`
	TotalRunsConsidered  int64                     `json:"total_runs_considered"`
	WouldAllow           int64                     `json:"would_allow"`
	WouldRequireApproval int64                     `json:"would_require_approval"`
	WouldBlock           int64                     `json:"would_block"`
	AffectedRunCount     int64                     `json:"affected_run_count"`
	AffectedAgents       []policySimAffectedAgent  `json:"affected_agents"`
	AffectedActions      []policySimAffectedAction `json:"affected_actions"`
	SampleRuns           []policySimSampleRun      `json:"sample_runs"`
	Warnings             []string                  `json:"warnings"`
}

const (
	policySimMode_RequireApproval = "require_approval"
	policySimMode_Block           = "block"

	policySimSource = "task_records/action_policy_decisions/approval_requests/task_recovery_events/proof/execution_eval_runs"

	policySimMaxMatchValueLen = 256
	policySimBreakdownLimit   = 20
	policySimSampleLimit      = 20
)

// policySimAllowedStatuses bounds the match_result_status input to known task
// lifecycle statuses so the criterion is meaningful and never arbitrary text.
var policySimAllowedStatuses = map[string]bool{
	"completed":         true,
	"failed":            true,
	"canceled":          true,
	"approval_required": true,
	"dispatched":        true,
	"in_flight":         true,
	"running":           true,
	"pending":           true,
}

func handlePolicySimulate(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		var req policySimulateRequest
		if err := decodePolicySimulateBody(c.Body(), &req); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_body"})
		}
		if strings.TrimSpace(req.TenantID) != "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{
				"error":   "tenant_override_rejected",
				"message": "tenant_id must not be supplied in the request body",
			})
		}

		resp, validationErr, dbErr := runPolicySimulation(c.Context(), db, tenantID, req)
		if validationErr != "" {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": validationErr})
		}
		if dbErr != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		return c.JSON(resp)
	}
}

// runPolicySimulation validates the request, runs the deterministic read-only
// impact computation over execution truth, and returns the safe response. It is
// the single source of simulation behaviour, shared by the standalone simulate
// endpoint and by proposal re-simulation. It returns a non-empty validation
// error code (→ 400) for bad input, or a non-nil error (→ 500) for a DB failure.
// It NEVER mutates policy, replays runs, dispatches tasks, or persists anything.
func runPolicySimulation(ctx context.Context, db *sql.DB, tenantID string, req policySimulateRequest) (policySimulateResponse, string, error) {
	normalized, interval, validationErr := validatePolicySimulateRequest(req)
	if validationErr != "" {
		return policySimulateResponse{}, validationErr, nil
	}

	matchClause, matchArgs, hasCriteria := buildPolicyMatchClause(normalized)
	warnings := make([]string, 0)
	if !hasCriteria {
		warnings = append(warnings, "No match criteria were provided, so no runs were classified as affected. Add at least one criterion to preview impact.")
	}

	total, affected, err := queryPolicySimulationCounts(ctx, db, tenantID, interval, matchClause, matchArgs)
	if err != nil {
		return policySimulateResponse{}, "", err
	}
	if total == 0 {
		warnings = append(warnings, "No execution records were found in the selected window.")
	}

	resp := policySimulateResponse{
		Range:               normalized.Range,
		PolicyMode:          normalized.PolicyMode,
		Source:              policySimSource,
		TotalRunsConsidered: total,
		AffectedRunCount:    affected,
		AffectedAgents:      []policySimAffectedAgent{},
		AffectedActions:     []policySimAffectedAction{},
		SampleRuns:          []policySimSampleRun{},
		Warnings:            warnings,
	}
	resp.WouldAllow, resp.WouldRequireApproval, resp.WouldBlock = computePolicyImpact(total, affected, normalized.PolicyMode)

	// Only fan out to the (still bounded) breakdown/sample queries when the
	// proposed rule actually matched something. Saves three reads otherwise.
	if affected > 0 {
		agents, err := queryPolicySimulationAgents(ctx, db, tenantID, interval, matchClause, matchArgs)
		if err != nil {
			return policySimulateResponse{}, "", err
		}
		actions, err := queryPolicySimulationActions(ctx, db, tenantID, interval, matchClause, matchArgs)
		if err != nil {
			return policySimulateResponse{}, "", err
		}
		samples, err := queryPolicySimulationSamples(ctx, db, tenantID, interval, matchClause, matchArgs)
		if err != nil {
			return policySimulateResponse{}, "", err
		}
		resp.AffectedAgents = agents
		resp.AffectedActions = actions
		resp.SampleRuns = samples
	}

	return resp, "", nil
}

// validatePolicySimulateRequest normalizes and bounds the request. It returns
// the normalized request, the SQL interval literal for the range, and a machine
// error code (empty when valid).
func validatePolicySimulateRequest(req policySimulateRequest) (policySimulateRequest, string, string) {
	out := policySimulateRequest{
		MatchActionName:         strings.TrimSpace(req.MatchActionName),
		MatchActionPrefix:       strings.TrimSpace(req.MatchActionPrefix),
		MatchAgentID:            strings.TrimSpace(req.MatchAgentID),
		MatchAgentType:          strings.TrimSpace(req.MatchAgentType),
		MatchResultStatus:       strings.TrimSpace(req.MatchResultStatus),
		RequireProofMissing:     req.RequireProofMissing,
		RequireRecoveryOccurred: req.RequireRecoveryOccurred,
		RequireEvalFailed:       req.RequireEvalFailed,
	}

	out.Range = strings.TrimSpace(req.Range)
	interval, ok := policySimRangeToInterval(out.Range)
	if !ok {
		return out, "", "invalid_range"
	}

	out.PolicyMode = strings.TrimSpace(req.PolicyMode)
	if out.PolicyMode != policySimMode_RequireApproval && out.PolicyMode != policySimMode_Block {
		return out, "", "invalid_policy_mode"
	}

	for _, v := range []string{out.MatchActionName, out.MatchActionPrefix, out.MatchAgentID, out.MatchAgentType, out.MatchResultStatus} {
		if len(v) > policySimMaxMatchValueLen {
			return out, "", "match_value_too_long"
		}
	}
	if out.MatchResultStatus != "" && !policySimAllowedStatuses[out.MatchResultStatus] {
		return out, "", "invalid_result_status"
	}

	return out, interval, ""
}

// policySimRangeToInterval bounds the simulation to 24h / 7d / 30d only. The
// returned literal is a fixed, internal string (never user text) and is the
// only value interpolated into SQL.
func policySimRangeToInterval(r string) (string, bool) {
	switch r {
	case "24h":
		return "24 hours", true
	case "7d":
		return "7 days", true
	case "30d":
		return "30 days", true
	default:
		return "", false
	}
}

// computePolicyImpact derives the would-allow / would-require-approval /
// would-block counts. A proposed rule applies its mode to matched runs; runs it
// does not match are unaffected and therefore allowed.
func computePolicyImpact(total, affected int64, mode string) (allow, approval, block int64) {
	if affected > total {
		affected = total
	}
	allow = total - affected
	switch mode {
	case policySimMode_RequireApproval:
		approval = affected
	case policySimMode_Block:
		block = affected
	}
	return allow, approval, block
}

// buildPolicyMatchClause builds the parameterized boolean fragment that marks a
// run as affected. Every user value is bound as a query parameter ($2…); no
// user text is concatenated into SQL. Returns "false" when no criteria are set.
func buildPolicyMatchClause(req policySimulateRequest) (string, []interface{}, bool) {
	conds := make([]string, 0)
	args := make([]interface{}, 0)
	next := func() int { return len(args) + 2 } // $1 is always tenant_id

	if req.MatchActionName != "" {
		conds = append(conds, fmt.Sprintf("b.action_name = $%d", next()))
		args = append(args, req.MatchActionName)
	}
	if req.MatchActionPrefix != "" {
		conds = append(conds, fmt.Sprintf(`b.action_name LIKE $%d ESCAPE '\'`, next()))
		args = append(args, escapeLikePrefix(req.MatchActionPrefix)+"%")
	}
	if req.MatchAgentID != "" {
		conds = append(conds, fmt.Sprintf("b.agent_id = $%d", next()))
		args = append(args, req.MatchAgentID)
	}
	if req.MatchAgentType != "" {
		conds = append(conds, fmt.Sprintf("b.agent_type = $%d", next()))
		args = append(args, req.MatchAgentType)
	}
	if req.MatchResultStatus != "" {
		conds = append(conds, fmt.Sprintf("b.status = $%d", next()))
		args = append(args, req.MatchResultStatus)
	}
	if req.RequireProofMissing {
		conds = append(conds, "b.proof_covered = false")
	}
	if req.RequireRecoveryOccurred {
		conds = append(conds, "b.had_recovery = true")
	}
	if req.RequireEvalFailed {
		conds = append(conds, "b.eval_failed = true")
	}

	if len(conds) == 0 {
		return "false", args, false
	}
	return strings.Join(conds, " AND "), args, true
}

// escapeLikePrefix escapes LIKE wildcards so an operator's prefix is matched
// literally (no injection risk — the value is still bound as a parameter).
func escapeLikePrefix(prefix string) string {
	r := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return r.Replace(prefix)
}

// policySimBaseCTE derives, per task in the tenant+window, the attributes the
// match clause needs. It is read-only and references only existing tables.
func policySimBaseCTE(interval string) string {
	return `
		WITH base AS (
			SELECT
				tr.task_id,
				tr.status,
				tr.created_at,
				COALESCE(tr.registered_agent_id::text, '') AS agent_id,
				COALESCE(tr.registered_agent_name, '') AS agent_name,
				COALESCE(ra.agent_type, '') AS agent_type,
				(
					COALESCE(tr.proof_verified, false)
					OR COALESCE(tr.proof_signature, '') <> ''
					OR COALESCE(tr.proof_status, '') IN ('verified', 'present')
				) AS proof_covered,
				EXISTS (
					SELECT 1 FROM task_recovery_events tre
					WHERE tre.tenant_id = tr.tenant_id AND tre.task_id = tr.task_id
				) AS had_recovery,
				EXISTS (
					SELECT 1 FROM execution_eval_runs er
					WHERE er.tenant_id = tr.tenant_id AND er.task_id = tr.task_id AND er.status = 'failed'
				) AS eval_failed,
				COALESCE((
					SELECT apd.action_name
					FROM action_policy_decisions apd
					WHERE apd.tenant_id = tr.tenant_id AND apd.task_id = tr.task_id
					ORDER BY apd.created_at DESC
					LIMIT 1
				), '') AS action_name
			FROM task_records tr
			LEFT JOIN registered_agents ra
				ON ra.tenant_id = tr.tenant_id AND ra.agent_id = tr.registered_agent_id
			WHERE tr.tenant_id = $1
			  AND ` + intervalWhereClause(interval) + `
		)`
}

func queryPolicySimulationCounts(ctx context.Context, db *sql.DB, tenantID, interval, matchClause string, matchArgs []interface{}) (int64, int64, error) {
	query := policySimBaseCTE(interval) + `
		SELECT
			COUNT(*)::bigint AS total,
			COUNT(*) FILTER (WHERE ` + matchClause + `)::bigint AS affected
		FROM base b`

	args := append([]interface{}{tenantID}, matchArgs...)
	var total, affected int64
	if err := db.QueryRowContext(ctx, query, args...).Scan(&total, &affected); err != nil {
		return 0, 0, err
	}
	return total, affected, nil
}

func queryPolicySimulationAgents(ctx context.Context, db *sql.DB, tenantID, interval, matchClause string, matchArgs []interface{}) ([]policySimAffectedAgent, error) {
	query := policySimBaseCTE(interval) + `
		SELECT
			COALESCE(NULLIF(b.agent_id, ''), 'unattributed') AS key,
			COALESCE(NULLIF(b.agent_name, ''), 'unattributed') AS name,
			COUNT(*)::bigint
		FROM base b
		WHERE ` + matchClause + `
		GROUP BY key, name
		ORDER BY COUNT(*) DESC, name ASC
		LIMIT ` + fmt.Sprint(policySimBreakdownLimit)

	args := append([]interface{}{tenantID}, matchArgs...)
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]policySimAffectedAgent, 0)
	for rows.Next() {
		var item policySimAffectedAgent
		if err := rows.Scan(&item.Key, &item.Name, &item.RunCount); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func queryPolicySimulationActions(ctx context.Context, db *sql.DB, tenantID, interval, matchClause string, matchArgs []interface{}) ([]policySimAffectedAction, error) {
	query := policySimBaseCTE(interval) + `
		SELECT
			COALESCE(NULLIF(b.action_name, ''), 'unknown_action') AS name,
			COUNT(*)::bigint
		FROM base b
		WHERE ` + matchClause + `
		GROUP BY name
		ORDER BY COUNT(*) DESC, name ASC
		LIMIT ` + fmt.Sprint(policySimBreakdownLimit)

	args := append([]interface{}{tenantID}, matchArgs...)
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]policySimAffectedAction, 0)
	for rows.Next() {
		var item policySimAffectedAction
		if err := rows.Scan(&item.Name, &item.RunCount); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func queryPolicySimulationSamples(ctx context.Context, db *sql.DB, tenantID, interval, matchClause string, matchArgs []interface{}) ([]policySimSampleRun, error) {
	query := policySimBaseCTE(interval) + `
		SELECT b.task_id::text, b.status
		FROM base b
		WHERE ` + matchClause + `
		ORDER BY b.created_at DESC
		LIMIT ` + fmt.Sprint(policySimSampleLimit)

	args := append([]interface{}{tenantID}, matchArgs...)
	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]policySimSampleRun, 0)
	for rows.Next() {
		var item policySimSampleRun
		if err := rows.Scan(&item.TaskID, &item.Status); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func decodePolicySimulateBody(body []byte, out any) error {
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	return decoder.Decode(out)
}
