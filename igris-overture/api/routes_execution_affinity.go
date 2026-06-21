package api

import (
	"context"
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterExecutionAffinityRoutes exposes the read-only relationship between
// registered agents, action definitions, and action packs. It answers:
// what actions does this agent actually use, and which agents use this action?
//
// The endpoint returns aggregates only. It never reads or renders prompts,
// model output, request bodies, response bodies, secrets, or raw execution rows.
func RegisterExecutionAffinityRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		return
	}
	v1 := app.Group("/v1/execution/affinity")
	v1.Use(middleware.BetterAuth(db))
	v1.Get("", handleExecutionAffinity(db))
}

const (
	executionAffinitySource = "task_records/action_policy_decisions/registered_agents/action_definitions/approval_requests/task_recovery_events/proof/execution_eval_runs"
	affinityMaxFilterLen    = 256
	affinityBreakdownLimit  = 50
)

type executionAffinityFilters struct {
	AgentID    string
	ActionName string
	PackName   string
}

type executionAffinityResponse struct {
	Range        string                      `json:"range"`
	Source       string                      `json:"source"`
	AgentActions []executionAffinityAction   `json:"agent_actions"`
	ActionAgents []executionAffinityAgent    `json:"action_agents"`
	PackEdges    []executionAffinityPackEdge `json:"pack_edges"`
	Hotspots     []executionAffinityHotspot  `json:"hotspots"`
}

type executionAffinityAction struct {
	ActionName           string  `json:"action_name"`
	ActionDisplayName    string  `json:"action_display_name"`
	PackName             string  `json:"pack_name"`
	RunCount             int64   `json:"run_count"`
	SuccessfulRuns       int64   `json:"successful_runs"`
	FailedRuns           int64   `json:"failed_runs"`
	ApprovalRequiredRuns int64   `json:"approval_required_runs"`
	RecoveryRuns         int64   `json:"recovery_runs"`
	EvalRunCount         int64   `json:"eval_run_count"`
	EvalPassedRuns       int64   `json:"eval_passed_runs"`
	ProofCoveredRuns     int64   `json:"proof_covered_runs"`
	SuccessRate          float64 `json:"success_rate"`
	FailureRate          float64 `json:"failure_rate"`
	ApprovalRate         float64 `json:"approval_rate"`
	RecoveryRate         float64 `json:"recovery_rate"`
	EvalPassRate         float64 `json:"eval_pass_rate"`
	ProofCoverage        float64 `json:"proof_coverage"`
}

type executionAffinityAgent struct {
	AgentID              string  `json:"agent_id"`
	AgentName            string  `json:"agent_name"`
	AgentType            string  `json:"agent_type"`
	ActionName           string  `json:"action_name"`
	ActionDisplayName    string  `json:"action_display_name"`
	PackName             string  `json:"pack_name"`
	RunCount             int64   `json:"run_count"`
	SuccessfulRuns       int64   `json:"successful_runs"`
	FailedRuns           int64   `json:"failed_runs"`
	ApprovalRequiredRuns int64   `json:"approval_required_runs"`
	RecoveryRuns         int64   `json:"recovery_runs"`
	EvalRunCount         int64   `json:"eval_run_count"`
	EvalPassedRuns       int64   `json:"eval_passed_runs"`
	ProofCoveredRuns     int64   `json:"proof_covered_runs"`
	SuccessRate          float64 `json:"success_rate"`
	FailureRate          float64 `json:"failure_rate"`
	ApprovalRate         float64 `json:"approval_rate"`
	RecoveryRate         float64 `json:"recovery_rate"`
	EvalPassRate         float64 `json:"eval_pass_rate"`
	ProofCoverage        float64 `json:"proof_coverage"`
}

type executionAffinityPackEdge struct {
	PackName          string  `json:"pack_name"`
	ActionName        string  `json:"action_name"`
	ActionDisplayName string  `json:"action_display_name"`
	AgentID           string  `json:"agent_id"`
	AgentName         string  `json:"agent_name"`
	RunCount          int64   `json:"run_count"`
	SuccessRate       float64 `json:"success_rate"`
	RecoveryRate      float64 `json:"recovery_rate"`
	ApprovalRate      float64 `json:"approval_rate"`
	EvalPassRate      float64 `json:"eval_pass_rate"`
	ProofCoverage     float64 `json:"proof_coverage"`
}

type executionAffinityHotspot struct {
	Scope       string `json:"scope"`
	Name        string `json:"name"`
	Observation string `json:"observation"`
	RunCount    int64  `json:"run_count"`
}

func handleExecutionAffinity(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}

		rangeParam := normalizeAffinityRange(c.Query("range", "last_30d"))
		filters := executionAffinityFilters{
			AgentID:    strings.TrimSpace(c.Query("agent_id")),
			ActionName: strings.TrimSpace(c.Query("action_name")),
			PackName:   strings.TrimSpace(c.Query("pack")),
		}
		if err := validateAffinityFilters(filters); err != nil {
			return c.Status(http.StatusBadRequest).JSON(fiber.Map{"error": "invalid_filter", "message": err.Error()})
		}

		interval := rangeToInterval(rangeParam)
		agentActions, err := queryExecutionAffinityActions(c.Context(), db, tenantID, interval, filters)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		actionAgents, err := queryExecutionAffinityAgents(c.Context(), db, tenantID, interval, filters)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		packEdges, err := queryExecutionAffinityPackEdges(c.Context(), db, tenantID, interval, filters)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		return c.JSON(executionAffinityResponse{
			Range:        rangeParam,
			Source:       executionAffinitySource,
			AgentActions: agentActions,
			ActionAgents: actionAgents,
			PackEdges:    packEdges,
			Hotspots:     buildExecutionAffinityHotspots(agentActions, actionAgents),
		})
	}
}

func normalizeAffinityRange(r string) string {
	switch strings.TrimSpace(r) {
	case "last_1h", "last_6h", "last_24h", "last_7d", "last_30d":
		return strings.TrimSpace(r)
	default:
		return "last_30d"
	}
}

func validateAffinityFilters(filters executionAffinityFilters) error {
	for _, value := range []string{filters.AgentID, filters.ActionName, filters.PackName} {
		if len(value) > affinityMaxFilterLen {
			return fiber.NewError(http.StatusBadRequest, "filter is too long")
		}
	}
	return nil
}

func queryExecutionAffinityActions(ctx context.Context, db *sql.DB, tenantID, interval string, filters executionAffinityFilters) ([]executionAffinityAction, error) {
	where, args := affinityWhereClause(filters, "b", []interface{}{tenantID})
	query := executionAffinityBaseCTE(interval) + `
		SELECT
			b.action_name,
			COALESCE(NULLIF(MAX(b.action_display_name), ''), b.action_name) AS action_display_name,
			COALESCE(NULLIF(MAX(b.pack_name), ''), '') AS pack_name,
			COUNT(*)::bigint,
			COUNT(*) FILTER (WHERE b.status = 'completed')::bigint,
			COUNT(*) FILTER (WHERE b.status = 'failed')::bigint,
			COUNT(*) FILTER (WHERE b.approval_required)::bigint,
			COUNT(*) FILTER (WHERE b.had_recovery)::bigint,
			COALESCE(SUM(b.eval_run_count), 0)::bigint,
			COALESCE(SUM(b.eval_passed_count), 0)::bigint,
			COUNT(*) FILTER (WHERE b.proof_covered)::bigint
		FROM base b
		WHERE b.action_name <> ''` + where + `
		GROUP BY b.action_name
		ORDER BY COUNT(*) DESC, b.action_name ASC
		LIMIT ` + intLiteral(affinityBreakdownLimit)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]executionAffinityAction, 0)
	for rows.Next() {
		var item executionAffinityAction
		if err := rows.Scan(
			&item.ActionName, &item.ActionDisplayName, &item.PackName,
			&item.RunCount, &item.SuccessfulRuns, &item.FailedRuns,
			&item.ApprovalRequiredRuns, &item.RecoveryRuns,
			&item.EvalRunCount, &item.EvalPassedRuns, &item.ProofCoveredRuns,
		); err != nil {
			return nil, err
		}
		item.fillRates()
		items = append(items, item)
	}
	return items, rows.Err()
}

func queryExecutionAffinityAgents(ctx context.Context, db *sql.DB, tenantID, interval string, filters executionAffinityFilters) ([]executionAffinityAgent, error) {
	where, args := affinityWhereClause(filters, "b", []interface{}{tenantID})
	query := executionAffinityBaseCTE(interval) + `
		SELECT
			COALESCE(NULLIF(b.agent_id, ''), 'unattributed') AS agent_id,
			COALESCE(NULLIF(MAX(b.agent_name), ''), 'unattributed') AS agent_name,
			COALESCE(NULLIF(MAX(b.agent_type), ''), '') AS agent_type,
			b.action_name,
			COALESCE(NULLIF(MAX(b.action_display_name), ''), b.action_name) AS action_display_name,
			COALESCE(NULLIF(MAX(b.pack_name), ''), '') AS pack_name,
			COUNT(*)::bigint,
			COUNT(*) FILTER (WHERE b.status = 'completed')::bigint,
			COUNT(*) FILTER (WHERE b.status = 'failed')::bigint,
			COUNT(*) FILTER (WHERE b.approval_required)::bigint,
			COUNT(*) FILTER (WHERE b.had_recovery)::bigint,
			COALESCE(SUM(b.eval_run_count), 0)::bigint,
			COALESCE(SUM(b.eval_passed_count), 0)::bigint,
			COUNT(*) FILTER (WHERE b.proof_covered)::bigint
		FROM base b
		WHERE b.action_name <> ''` + where + `
		GROUP BY COALESCE(NULLIF(b.agent_id, ''), 'unattributed'), b.action_name
		ORDER BY COUNT(*) DESC, agent_name ASC
		LIMIT ` + intLiteral(affinityBreakdownLimit)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]executionAffinityAgent, 0)
	for rows.Next() {
		var item executionAffinityAgent
		if err := rows.Scan(
			&item.AgentID, &item.AgentName, &item.AgentType,
			&item.ActionName, &item.ActionDisplayName, &item.PackName,
			&item.RunCount, &item.SuccessfulRuns, &item.FailedRuns,
			&item.ApprovalRequiredRuns, &item.RecoveryRuns,
			&item.EvalRunCount, &item.EvalPassedRuns, &item.ProofCoveredRuns,
		); err != nil {
			return nil, err
		}
		item.fillRates()
		items = append(items, item)
	}
	return items, rows.Err()
}

func queryExecutionAffinityPackEdges(ctx context.Context, db *sql.DB, tenantID, interval string, filters executionAffinityFilters) ([]executionAffinityPackEdge, error) {
	where, args := affinityWhereClause(filters, "b", []interface{}{tenantID})
	query := executionAffinityBaseCTE(interval) + `
		SELECT
			COALESCE(NULLIF(b.pack_name, ''), 'unpacked') AS pack_name,
			b.action_name,
			COALESCE(NULLIF(MAX(b.action_display_name), ''), b.action_name) AS action_display_name,
			COALESCE(NULLIF(b.agent_id, ''), 'unattributed') AS agent_id,
			COALESCE(NULLIF(MAX(b.agent_name), ''), 'unattributed') AS agent_name,
			COUNT(*)::bigint,
			COUNT(*) FILTER (WHERE b.status = 'completed')::bigint,
			COUNT(*) FILTER (WHERE b.approval_required)::bigint,
			COUNT(*) FILTER (WHERE b.had_recovery)::bigint,
			COALESCE(SUM(b.eval_run_count), 0)::bigint,
			COALESCE(SUM(b.eval_passed_count), 0)::bigint,
			COUNT(*) FILTER (WHERE b.proof_covered)::bigint
		FROM base b
		WHERE b.action_name <> ''` + where + `
		GROUP BY COALESCE(NULLIF(b.pack_name, ''), 'unpacked'), b.action_name, COALESCE(NULLIF(b.agent_id, ''), 'unattributed')
		ORDER BY pack_name ASC, b.action_name ASC, COUNT(*) DESC
		LIMIT ` + intLiteral(affinityBreakdownLimit)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]executionAffinityPackEdge, 0)
	for rows.Next() {
		var item executionAffinityPackEdge
		var successful, approvals, recoveries, evalRuns, evalPassed, proofCovered int64
		if err := rows.Scan(
			&item.PackName, &item.ActionName, &item.ActionDisplayName,
			&item.AgentID, &item.AgentName, &item.RunCount,
			&successful, &approvals, &recoveries, &evalRuns, &evalPassed, &proofCovered,
		); err != nil {
			return nil, err
		}
		item.SuccessRate = rate(successful, item.RunCount)
		item.ApprovalRate = rate(approvals, item.RunCount)
		item.RecoveryRate = rate(recoveries, item.RunCount)
		item.EvalPassRate = rate(evalPassed, evalRuns)
		item.ProofCoverage = rate(proofCovered, item.RunCount)
		items = append(items, item)
	}
	return items, rows.Err()
}

func executionAffinityBaseCTE(interval string) string {
	return `
		WITH base AS (
			SELECT
				tr.task_id,
				tr.status,
				tr.created_at,
				COALESCE(tr.registered_agent_id::text, '') AS agent_id,
				COALESCE(NULLIF(tr.registered_agent_name, ''), NULLIF(ra.display_name, ''), NULLIF(ra.name, ''), '') AS agent_name,
				COALESCE(ra.agent_type, '') AS agent_type,
				COALESCE(apd.action_name, '') AS action_name,
				COALESCE(ad.display_name, '') AS action_display_name,
				COALESCE(ad.target_metadata->>'pack', '') AS pack_name,
				(
					tr.status = 'approval_required'
					OR EXISTS (
						SELECT 1 FROM approval_requests ar
						WHERE ar.tenant_id = tr.tenant_id AND ar.task_id = tr.task_id
					)
				) AS approval_required,
				EXISTS (
					SELECT 1 FROM task_recovery_events tre
					WHERE tre.tenant_id = tr.tenant_id AND tre.task_id = tr.task_id
				) AS had_recovery,
				(
					COALESCE(tr.proof_verified, false)
					OR COALESCE(tr.proof_signature, '') <> ''
					OR COALESCE(tr.proof_status, '') IN ('verified', 'present')
				) AS proof_covered,
				COALESCE(eval_stats.eval_run_count, 0)::bigint AS eval_run_count,
				COALESCE(eval_stats.eval_passed_count, 0)::bigint AS eval_passed_count
			FROM task_records tr
			LEFT JOIN registered_agents ra
				ON ra.tenant_id = tr.tenant_id AND ra.agent_id = tr.registered_agent_id
			LEFT JOIN LATERAL (
				SELECT action_name
				FROM action_policy_decisions apd
				WHERE apd.tenant_id = tr.tenant_id
				  AND apd.task_id = tr.task_id
				ORDER BY apd.created_at DESC
				LIMIT 1
			) apd ON true
			LEFT JOIN action_definitions ad
				ON ad.tenant_id = tr.tenant_id
			   AND ad.name = apd.action_name
			   AND ad.archived_at IS NULL
			LEFT JOIN LATERAL (
				SELECT
					COUNT(*)::bigint AS eval_run_count,
					COUNT(*) FILTER (WHERE er.status = 'passed')::bigint AS eval_passed_count
				FROM execution_eval_runs er
				WHERE er.tenant_id = tr.tenant_id
				  AND er.task_id = tr.task_id
			) eval_stats ON true
			WHERE tr.tenant_id = $1
			  AND ` + intervalWhereClause(interval) + `
		)`
}

func affinityWhereClause(filters executionAffinityFilters, alias string, args []interface{}) (string, []interface{}) {
	clauses := make([]string, 0, 3)
	if filters.AgentID != "" {
		args = append(args, filters.AgentID)
		clauses = append(clauses, alias+".agent_id = $"+intLiteral(len(args)))
	}
	if filters.ActionName != "" {
		args = append(args, filters.ActionName)
		clauses = append(clauses, alias+".action_name = $"+intLiteral(len(args)))
	}
	if filters.PackName != "" {
		args = append(args, filters.PackName)
		clauses = append(clauses, alias+".pack_name = $"+intLiteral(len(args)))
	}
	if len(clauses) == 0 {
		return "", args
	}
	return " AND " + strings.Join(clauses, " AND "), args
}

func (item *executionAffinityAction) fillRates() {
	item.SuccessRate = rate(item.SuccessfulRuns, item.RunCount)
	item.FailureRate = rate(item.FailedRuns, item.RunCount)
	item.ApprovalRate = rate(item.ApprovalRequiredRuns, item.RunCount)
	item.RecoveryRate = rate(item.RecoveryRuns, item.RunCount)
	item.EvalPassRate = rate(item.EvalPassedRuns, item.EvalRunCount)
	item.ProofCoverage = rate(item.ProofCoveredRuns, item.RunCount)
}

func (item *executionAffinityAgent) fillRates() {
	item.SuccessRate = rate(item.SuccessfulRuns, item.RunCount)
	item.FailureRate = rate(item.FailedRuns, item.RunCount)
	item.ApprovalRate = rate(item.ApprovalRequiredRuns, item.RunCount)
	item.RecoveryRate = rate(item.RecoveryRuns, item.RunCount)
	item.EvalPassRate = rate(item.EvalPassedRuns, item.EvalRunCount)
	item.ProofCoverage = rate(item.ProofCoveredRuns, item.RunCount)
}

func buildExecutionAffinityHotspots(actions []executionAffinityAction, agents []executionAffinityAgent) []executionAffinityHotspot {
	hotspots := make([]executionAffinityHotspot, 0)
	for _, action := range actions {
		name := action.ActionName
		if action.ActionDisplayName != "" {
			name = action.ActionDisplayName
		}
		hotspots = appendAffinityObservations(hotspots, "action", name, action.RunCount, action.ApprovalRate, action.RecoveryRate, action.EvalRunCount, action.EvalPassRate, action.ProofCoverage)
	}
	for _, agent := range agents {
		name := agent.AgentName
		if name == "" {
			name = agent.AgentID
		}
		if agent.ActionName != "" {
			name += " on " + agent.ActionName
		}
		hotspots = appendAffinityObservations(hotspots, "agent_action", name, agent.RunCount, agent.ApprovalRate, agent.RecoveryRate, agent.EvalRunCount, agent.EvalPassRate, agent.ProofCoverage)
	}
	if len(hotspots) > affinityBreakdownLimit {
		return hotspots[:affinityBreakdownLimit]
	}
	return hotspots
}

func appendAffinityObservations(items []executionAffinityHotspot, scope, name string, runs int64, approvalRate, recoveryRate float64, evalRuns int64, evalPassRate, proofCoverage float64) []executionAffinityHotspot {
	if runs <= 0 {
		return items
	}
	if approvalRate >= 0.5 {
		items = append(items, executionAffinityHotspot{Scope: scope, Name: name, Observation: "Approval appears in at least half of recorded runs.", RunCount: runs})
	}
	if recoveryRate >= 0.1 {
		items = append(items, executionAffinityHotspot{Scope: scope, Name: name, Observation: "Recovery appeared in at least one in ten recorded runs.", RunCount: runs})
	}
	if evalRuns > 0 && evalPassRate < 0.9 {
		items = append(items, executionAffinityHotspot{Scope: scope, Name: name, Observation: "Evaluation pass rate is below 90 percent for recorded runs.", RunCount: runs})
	}
	if proofCoverage < 0.8 {
		items = append(items, executionAffinityHotspot{Scope: scope, Name: name, Observation: "Proof coverage is below 80 percent for recorded runs.", RunCount: runs})
	}
	return items
}

func intLiteral(value int) string {
	return strconv.Itoa(value)
}
