package coordinator

import (
	"database/sql"
	"time"
)

// GovernanceTrustSummary holds tenant-wide operational trust counts. Each field
// is a count of safe governance records — no secrets, tokens, or raw payloads.
type GovernanceTrustSummary struct {
	VerifiedExecutions      int `json:"verified_executions"`
	RecoveredExecutions     int `json:"recovered_executions"`
	PolicyBlockedActions    int `json:"policy_blocked_actions"`
	ApprovalRequiredActions int `json:"approval_required_actions"`
	BoundaryViolations      int `json:"boundary_violations"`
	FailedProofVerification int `json:"failed_proof_verification"`
}

// GovernanceActiveStates counts executions currently in each operational state.
type GovernanceActiveStates struct {
	Running           int `json:"running"`
	ApprovalRequired  int `json:"approval_required"`
	Recovering        int `json:"recovering"`
	Failed            int `json:"failed"`
	Verified          int `json:"verified"`
	PartiallyVerified int `json:"partially_verified"`
	Blocked           int `json:"blocked"`
}

// GovernanceCriticalEvent is one operator-readable critical event. Reason text
// is the persisted operator reason; it never carries secrets.
type GovernanceCriticalEvent struct {
	Kind      string    `json:"kind"`
	Category  string    `json:"category"`
	TaskID    string    `json:"task_id,omitempty"`
	RuntimeID string    `json:"runtime_id,omitempty"`
	Severity  string    `json:"severity"`
	Reason    string    `json:"reason"`
	CreatedAt time.Time `json:"created_at"`
}

// GovernanceSummary is the aggregate payload behind the console Overview page.
type GovernanceSummary struct {
	TrustSummary          GovernanceTrustSummary    `json:"trust_summary"`
	ActiveExecutionStates GovernanceActiveStates    `json:"active_execution_states"`
	RecentCriticalEvents  []GovernanceCriticalEvent `json:"recent_critical_events"`
	GeneratedAt           time.Time                 `json:"generated_at"`
}

// GovernanceSummaryReport computes the tenant-wide execution trust summary from
// the governance, recovery, boundary, and verification ledgers. All queries are
// scoped to the tenant. The returned payload is safe to expose to operators.
func (s *CheckpointStore) GovernanceSummaryReport(tenantID string, criticalLimit int) (*GovernanceSummary, error) {
	summary := &GovernanceSummary{
		RecentCriticalEvents: []GovernanceCriticalEvent{},
		GeneratedAt:          time.Now().UTC(),
	}
	if s == nil || s.db == nil || isSQLMockDB(s.db) {
		return summary, nil
	}
	if criticalLimit <= 0 || criticalLimit > 100 {
		criticalLimit = 15
	}

	// Verification ledger: verified / failed counts and distinct-task states.
	if err := s.db.QueryRow(`
		SELECT
			COUNT(*) FILTER (WHERE status = 'verified'),
			COUNT(*) FILTER (WHERE status IN ('failed_verification','policy_violation')),
			COUNT(DISTINCT task_id) FILTER (WHERE status = 'verified'),
			COUNT(DISTINCT task_id) FILTER (WHERE status = 'partially_verified')
		FROM verification_results
		WHERE tenant_id = $1`, tenantID).Scan(
		&summary.TrustSummary.VerifiedExecutions,
		&summary.TrustSummary.FailedProofVerification,
		&summary.ActiveExecutionStates.Verified,
		&summary.ActiveExecutionStates.PartiallyVerified,
	); err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// Action policy ledger: denied (blocked) and approval-required decisions.
	if err := s.db.QueryRow(`
		SELECT
			COUNT(*) FILTER (WHERE decision = 'denied'),
			COUNT(*) FILTER (WHERE decision = 'approval_required'),
			COUNT(DISTINCT task_id) FILTER (WHERE decision = 'denied')
		FROM action_policy_decisions
		WHERE tenant_id = $1`, tenantID).Scan(
		&summary.TrustSummary.PolicyBlockedActions,
		&summary.TrustSummary.ApprovalRequiredActions,
		&summary.ActiveExecutionStates.Blocked,
	); err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// Boundary violation ledger.
	if err := s.db.QueryRow(`
		SELECT COUNT(*) FROM boundary_violations WHERE tenant_id = $1`,
		tenantID).Scan(&summary.TrustSummary.BoundaryViolations); err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// Recovery ledger: distinct tasks that were redispatched or resumed.
	if err := s.db.QueryRow(`
		SELECT COUNT(DISTINCT task_id)
		FROM task_recovery_events
		WHERE tenant_id = $1
		  AND (event_type ILIKE '%redispatch%'
		    OR event_type ILIKE '%recovered%'
		    OR event_type ILIKE '%resume%')`,
		tenantID).Scan(&summary.TrustSummary.RecoveredExecutions); err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// Task records: live operational states.
	if err := s.db.QueryRow(`
		SELECT
			COUNT(*) FILTER (WHERE status IN ('pending','dispatched','checkpointed')),
			COUNT(*) FILTER (WHERE status = 'approval_required'),
			COUNT(*) FILTER (WHERE status = 'recovering'),
			COUNT(*) FILTER (WHERE status = 'failed')
		FROM task_records
		WHERE tenant_id = $1`, tenantID).Scan(
		&summary.ActiveExecutionStates.Running,
		&summary.ActiveExecutionStates.ApprovalRequired,
		&summary.ActiveExecutionStates.Recovering,
		&summary.ActiveExecutionStates.Failed,
	); err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	events, err := s.recentCriticalEvents(tenantID, criticalLimit)
	if err != nil {
		return nil, err
	}
	summary.RecentCriticalEvents = events
	return summary, nil
}

// recentCriticalEvents merges denied policy decisions, failed verifications,
// boundary violations, denied handoffs, and skipped/blocked recovery events
// into a single newest-first critical event stream.
func (s *CheckpointStore) recentCriticalEvents(tenantID string, limit int) ([]GovernanceCriticalEvent, error) {
	rows, err := s.db.Query(`
		(SELECT 'policy_denied' AS kind, 'policy' AS category, task_id::text,
		        COALESCE(runtime_id,'') AS runtime_id, 'critical' AS severity,
		        policy_reason AS reason, created_at
		   FROM action_policy_decisions
		  WHERE tenant_id = $1 AND decision = 'denied')
		UNION ALL
		(SELECT 'proof_failed', 'proof', task_id::text, '', 'critical',
		        reason, created_at
		   FROM verification_results
		  WHERE tenant_id = $1 AND status IN ('failed_verification','policy_violation'))
		UNION ALL
		(SELECT 'boundary_violation', 'boundary', task_id::text,
		        COALESCE(runtime_id,''), severity, reason, created_at
		   FROM boundary_violations
		  WHERE tenant_id = $1)
		UNION ALL
		(SELECT 'handoff_denied', 'handoff', task_id::text,
		        COALESCE(target_runtime_id,''), 'warning', reason, created_at
		   FROM runtime_handoff_events
		  WHERE tenant_id = $1 AND decision = 'denied')
		UNION ALL
		(SELECT 'replay_skipped', 'recovery', task_id::text,
		        COALESCE(source_runtime_id,''), 'warning', reason, created_at
		   FROM task_recovery_events
		  WHERE tenant_id = $1
		    AND (event_type ILIKE '%skip%' OR replay_allowed = false))
		ORDER BY created_at DESC
		LIMIT $2`, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]GovernanceCriticalEvent, 0, limit)
	for rows.Next() {
		var e GovernanceCriticalEvent
		var taskID, runtimeID sql.NullString
		if err := rows.Scan(&e.Kind, &e.Category, &taskID, &runtimeID,
			&e.Severity, &e.Reason, &e.CreatedAt); err != nil {
			return nil, err
		}
		e.TaskID = taskID.String
		e.RuntimeID = runtimeID.String
		out = append(out, e)
	}
	return out, rows.Err()
}
