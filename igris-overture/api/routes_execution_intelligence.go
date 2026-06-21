package api

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/Igris-inertial/system/igris-overture/middleware"
)

// RegisterExecutionIntelligenceRoutes exposes read-only operational metrics
// derived from execution truth: task lifecycle rows, policy decisions, and
// recovery events. It does not read prompts or model outputs.
func RegisterExecutionIntelligenceRoutes(app *fiber.App, db *sql.DB) {
	if db == nil {
		return
	}
	v1 := app.Group("/v1/execution/intelligence")
	v1.Use(middleware.BetterAuth(db))
	v1.Get("", handleExecutionIntelligence(db))
}

type executionIntelligenceSummary struct {
	TotalRuns             int64   `json:"total_runs"`
	SuccessfulRuns        int64   `json:"successful_runs"`
	FailedRuns            int64   `json:"failed_runs"`
	ApprovalRequiredRuns  int64   `json:"approval_required_runs"`
	HumanInterventionRuns int64   `json:"human_intervention_runs"`
	RecoveryRuns          int64   `json:"recovery_runs"`
	AverageDurationMs     float64 `json:"average_duration_ms"`
	SuccessRate           float64 `json:"success_rate"`
	FailureRate           float64 `json:"failure_rate"`
	ApprovalRate          float64 `json:"approval_rate"`
	HumanInterventionRate float64 `json:"human_intervention_rate"`
	RecoveryRate          float64 `json:"recovery_rate"`
}

type intelligenceBreakdown struct {
	Key                  string  `json:"key"`
	Name                 string  `json:"name"`
	TotalRuns            int64   `json:"total_runs"`
	SuccessfulRuns       int64   `json:"successful_runs"`
	FailedRuns           int64   `json:"failed_runs"`
	ApprovalRequiredRuns int64   `json:"approval_required_runs"`
	RecoveryRuns         int64   `json:"recovery_runs"`
	EvalRunCount         int64   `json:"eval_run_count"`
	EvalPassedRuns       int64   `json:"eval_passed_runs"`
	ProofCoveredRuns     int64   `json:"proof_covered_runs"`
	AverageDurationMs    float64 `json:"average_duration_ms"`
	SuccessRate          float64 `json:"success_rate"`
	FailureRate          float64 `json:"failure_rate"`
	ApprovalRate         float64 `json:"approval_rate"`
	RecoveryRate         float64 `json:"recovery_rate"`
	EvalPassRate         float64 `json:"eval_pass_rate"`
	ProofCoverage        float64 `json:"proof_coverage"`
}

func handleExecutionIntelligence(db *sql.DB) fiber.Handler {
	return func(c *fiber.Ctx) error {
		tenantID := middleware.GetClerkUserID(c)
		if tenantID == "" {
			return c.Status(http.StatusUnauthorized).JSON(fiber.Map{"error": "unauthenticated"})
		}
		rangeParam := strings.TrimSpace(c.Query("range", "last_30d"))
		interval := rangeToInterval(rangeParam)

		summary, err := queryExecutionIntelligenceSummary(c.Context(), db, tenantID, interval)
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		agents, err := queryExecutionIntelligenceBreakdown(c.Context(), db, tenantID, interval, "agent")
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}
		actions, err := queryExecutionIntelligenceBreakdown(c.Context(), db, tenantID, interval, "action")
		if err != nil {
			return c.Status(http.StatusInternalServerError).JSON(fiber.Map{"error": "db_error"})
		}

		return c.JSON(fiber.Map{
			"range":   rangeParam,
			"source":  "task_records/action_policy_decisions/task_recovery_events",
			"summary": summary,
			"agents":  agents,
			"actions": actions,
		})
	}
}

func queryExecutionIntelligenceSummary(ctx context.Context, db *sql.DB, tenantID, interval string) (executionIntelligenceSummary, error) {
	query := `
		WITH base AS (
			SELECT
				tr.task_id,
				tr.status,
				tr.created_at,
				tr.dispatched_at,
				tr.completed_at,
				tr.canceled_at,
				EXISTS (
					SELECT 1 FROM approval_requests ar
					WHERE ar.tenant_id = tr.tenant_id AND ar.task_id = tr.task_id
				) AS human_intervention,
				EXISTS (
					SELECT 1 FROM task_recovery_events tre
					WHERE tre.tenant_id = tr.tenant_id AND tre.task_id = tr.task_id
				) AS had_recovery
			FROM task_records tr
			WHERE tr.tenant_id = $1
			  AND ` + intervalWhereClause(interval) + `
		)
		SELECT
			COUNT(*)::bigint,
			COUNT(*) FILTER (WHERE status = 'completed')::bigint,
			COUNT(*) FILTER (WHERE status = 'failed')::bigint,
			COUNT(*) FILTER (WHERE status = 'approval_required')::bigint,
			COUNT(*) FILTER (WHERE human_intervention)::bigint,
			COUNT(*) FILTER (WHERE had_recovery)::bigint,
			AVG(` + durationExpr() + `)
		FROM base`

	var (
		total         int64
		successful    int64
		failed        int64
		approvals     int64
		interventions int64
		recoveries    int64
		avgDuration   sql.NullFloat64
	)
	err := db.QueryRowContext(ctx, query, tenantID).Scan(&total, &successful, &failed, &approvals, &interventions, &recoveries, &avgDuration)
	if err != nil {
		return executionIntelligenceSummary{}, err
	}
	return buildExecutionIntelligenceSummary(total, successful, failed, approvals, interventions, recoveries, avgDuration), nil
}

func queryExecutionIntelligenceBreakdown(ctx context.Context, db *sql.DB, tenantID, interval, mode string) ([]intelligenceBreakdown, error) {
	keyExpr := "COALESCE(tr.registered_agent_id::text, 'unattributed')"
	nameExpr := "COALESCE(NULLIF(tr.registered_agent_name, ''), 'unattributed')"
	join := ""
	if mode == "action" {
		keyExpr = "COALESCE(NULLIF(apd.action_name, ''), 'unknown_action')"
		nameExpr = keyExpr
		join = `
			LEFT JOIN LATERAL (
				SELECT action_name
				FROM action_policy_decisions apd
				WHERE apd.tenant_id = tr.tenant_id
				  AND apd.task_id = tr.task_id
				ORDER BY apd.created_at DESC
				LIMIT 1
			) apd ON true`
	}

	query := `
		WITH base AS (
			SELECT
				` + keyExpr + ` AS key,
				` + nameExpr + ` AS name,
				tr.task_id,
				tr.status,
				tr.created_at,
				tr.dispatched_at,
				tr.completed_at,
				tr.canceled_at,
				(
					COALESCE(tr.proof_verified, false)
					OR COALESCE(tr.proof_signature, '') <> ''
					OR COALESCE(tr.proof_status, '') IN ('verified', 'present')
				) AS proof_covered,
				EXISTS (
					SELECT 1 FROM task_recovery_events tre
					WHERE tre.tenant_id = tr.tenant_id AND tre.task_id = tr.task_id
				) AS had_recovery,
				COALESCE(eval_stats.eval_run_count, 0)::bigint AS eval_run_count,
				COALESCE(eval_stats.eval_passed_count, 0)::bigint AS eval_passed_count
			FROM task_records tr
			` + join + `
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
		)
		SELECT
			key,
			name,
			COUNT(*)::bigint,
			COUNT(*) FILTER (WHERE status = 'completed')::bigint,
			COUNT(*) FILTER (WHERE status = 'failed')::bigint,
			COUNT(*) FILTER (WHERE status = 'approval_required')::bigint,
			COUNT(*) FILTER (WHERE had_recovery)::bigint,
			COALESCE(SUM(eval_run_count), 0)::bigint,
			COALESCE(SUM(eval_passed_count), 0)::bigint,
			COUNT(*) FILTER (WHERE proof_covered)::bigint,
			AVG(` + durationExpr() + `)
		FROM base
		GROUP BY key, name
		ORDER BY COUNT(*) DESC, name ASC
		LIMIT 50`

	rows, err := db.QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]intelligenceBreakdown, 0)
	for rows.Next() {
		var (
			key         string
			name        string
			total       int64
			successful  int64
			failed      int64
			approvals   int64
			recoveries  int64
			evalRuns    int64
			evalPassed  int64
			proofRuns   int64
			avgDuration sql.NullFloat64
		)
		if err := rows.Scan(
			&key, &name, &total, &successful, &failed, &approvals, &recoveries,
			&evalRuns, &evalPassed, &proofRuns, &avgDuration,
		); err != nil {
			return nil, err
		}
		items = append(items, buildExecutionIntelligenceBreakdown(
			key, name, total, successful, failed, approvals, recoveries,
			evalRuns, evalPassed, proofRuns, avgDuration,
		))
	}
	return items, rows.Err()
}

func buildExecutionIntelligenceSummary(total, successful, failed, approvals, interventions, recoveries int64, avgDuration sql.NullFloat64) executionIntelligenceSummary {
	avg := 0.0
	if avgDuration.Valid {
		avg = avgDuration.Float64
	}
	return executionIntelligenceSummary{
		TotalRuns:             total,
		SuccessfulRuns:        successful,
		FailedRuns:            failed,
		ApprovalRequiredRuns:  approvals,
		HumanInterventionRuns: interventions,
		RecoveryRuns:          recoveries,
		AverageDurationMs:     avg,
		SuccessRate:           rate(successful, total),
		FailureRate:           rate(failed, total),
		ApprovalRate:          rate(approvals, total),
		HumanInterventionRate: rate(interventions, total),
		RecoveryRate:          rate(recoveries, total),
	}
}

func buildExecutionIntelligenceBreakdown(
	key, name string,
	total, successful, failed, approvals, recoveries, evalRuns, evalPassed, proofRuns int64,
	avgDuration sql.NullFloat64,
) intelligenceBreakdown {
	avg := 0.0
	if avgDuration.Valid {
		avg = avgDuration.Float64
	}
	return intelligenceBreakdown{
		Key:                  key,
		Name:                 name,
		TotalRuns:            total,
		SuccessfulRuns:       successful,
		FailedRuns:           failed,
		ApprovalRequiredRuns: approvals,
		RecoveryRuns:         recoveries,
		EvalRunCount:         evalRuns,
		EvalPassedRuns:       evalPassed,
		ProofCoveredRuns:     proofRuns,
		AverageDurationMs:    avg,
		SuccessRate:          rate(successful, total),
		FailureRate:          rate(failed, total),
		ApprovalRate:         rate(approvals, total),
		RecoveryRate:         rate(recoveries, total),
		EvalPassRate:         rate(evalPassed, evalRuns),
		ProofCoverage:        rate(proofRuns, total),
	}
}

func rate(numerator, denominator int64) float64 {
	if denominator <= 0 {
		return 0
	}
	return float64(numerator) / float64(denominator)
}

func durationExpr() string {
	return "EXTRACT(EPOCH FROM (COALESCE(completed_at, canceled_at, created_at) - COALESCE(dispatched_at, created_at))) * 1000"
}

func intervalWhereClause(interval string) string {
	return fmt.Sprintf("tr.created_at >= NOW() - INTERVAL '%s'", interval)
}
