package executionevals

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

type SQLStore struct {
	DB *sql.DB
}

type scanner interface {
	Scan(dest ...interface{}) error
}

func (s *SQLStore) List(ctx context.Context, tenantID string) ([]Eval, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT eval_id, tenant_id, name, description, target_action_name, target_agent_id,
		       assertions_json, enabled, created_at, updated_at, archived_at
		FROM execution_evals
		WHERE tenant_id = $1 AND archived_at IS NULL
		ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Eval, 0)
	for rows.Next() {
		item, err := scanEval(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *SQLStore) Create(ctx context.Context, tenantID string, input CreateInput) (Eval, error) {
	normalized, err := ValidateCreateInput(input)
	if err != nil {
		return Eval{}, err
	}
	assertions, err := AssertionsJSON(normalized.Assertions)
	if err != nil {
		return Eval{}, err
	}
	return scanEval(s.DB.QueryRowContext(ctx, `
		INSERT INTO execution_evals (
			tenant_id, name, description, target_action_name, target_agent_id,
			assertions_json, enabled, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
		RETURNING eval_id, tenant_id, name, description, target_action_name, target_agent_id,
		          assertions_json, enabled, created_at, updated_at, archived_at`,
		tenantID, normalized.Name, normalized.Description, normalized.TargetActionName,
		normalized.TargetAgentID, assertions, *normalized.Enabled))
}

func (s *SQLStore) Get(ctx context.Context, tenantID, id string) (Eval, error) {
	evalID, err := uuid.Parse(strings.TrimSpace(id))
	if err != nil {
		return Eval{}, ErrNotFound
	}
	return scanEval(s.DB.QueryRowContext(ctx, `
		SELECT eval_id, tenant_id, name, description, target_action_name, target_agent_id,
		       assertions_json, enabled, created_at, updated_at, archived_at
		FROM execution_evals
		WHERE tenant_id = $1 AND eval_id = $2 AND archived_at IS NULL`,
		tenantID, evalID.String()))
}

func (s *SQLStore) Update(ctx context.Context, tenantID, id string, input UpdateInput) (Eval, error) {
	current, err := s.Get(ctx, tenantID, id)
	if err != nil {
		return Eval{}, err
	}
	normalized, err := ValidateUpdateInput(input)
	if err != nil {
		return Eval{}, err
	}
	if normalized.Name != nil {
		current.Name = *normalized.Name
	}
	if normalized.Description != nil {
		current.Description = *normalized.Description
	}
	if normalized.TargetActionName != nil {
		current.TargetActionName = *normalized.TargetActionName
	}
	if normalized.TargetAgentID != nil {
		current.TargetAgentID = *normalized.TargetAgentID
	}
	if normalized.Assertions != nil {
		current.Assertions = *normalized.Assertions
	}
	if normalized.Enabled != nil {
		current.Enabled = *normalized.Enabled
	}
	assertions, err := AssertionsJSON(current.Assertions)
	if err != nil {
		return Eval{}, err
	}
	return scanEval(s.DB.QueryRowContext(ctx, `
		UPDATE execution_evals
		SET name = $3, description = $4, target_action_name = $5, target_agent_id = $6,
		    assertions_json = $7, enabled = $8, updated_at = NOW()
		WHERE tenant_id = $1 AND eval_id = $2 AND archived_at IS NULL
		RETURNING eval_id, tenant_id, name, description, target_action_name, target_agent_id,
		          assertions_json, enabled, created_at, updated_at, archived_at`,
		tenantID, current.EvalID.String(), current.Name, current.Description,
		current.TargetActionName, current.TargetAgentID, assertions, current.Enabled))
}

func (s *SQLStore) Archive(ctx context.Context, tenantID, id string) error {
	evalID, err := uuid.Parse(strings.TrimSpace(id))
	if err != nil {
		return ErrNotFound
	}
	res, err := s.DB.ExecContext(ctx, `
		UPDATE execution_evals
		SET archived_at = NOW(), updated_at = NOW()
		WHERE tenant_id = $1 AND eval_id = $2 AND archived_at IS NULL`,
		tenantID, evalID.String())
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *SQLStore) LoadExecutionTruth(ctx context.Context, tenantID string, taskID uuid.UUID) (ExecutionTruth, error) {
	var executionID sql.NullString
	var status sql.NullString
	var taskDefinition []byte
	var actionName sql.NullString
	var agentID sql.NullString
	var agentName sql.NullString
	var proofStatus sql.NullString
	var proofSignature sql.NullString
	var proofVerified sql.NullBool
	var approvalRequired bool
	var recoveryOccurred bool

	err := s.DB.QueryRowContext(ctx, `
		SELECT
			COALESCE(proof_execution_id, ''),
			COALESCE(status, ''),
			task_definition,
			COALESCE(registered_agent_id::text, ''),
			COALESCE(registered_agent_name, ''),
			COALESCE(proof_status, ''),
			COALESCE(proof_signature, ''),
			COALESCE(proof_verified, false),
			EXISTS (
				SELECT 1 FROM approval_requests ar
				WHERE ar.tenant_id = tr.tenant_id AND ar.task_id = tr.task_id
			) OR COALESCE(status, '') = 'approval_required',
			EXISTS (
				SELECT 1 FROM task_recovery_events re
				WHERE re.tenant_id = tr.tenant_id AND re.task_id = tr.task_id
			),
			COALESCE((
				SELECT apd.action_name
				FROM action_policy_decisions apd
				WHERE apd.tenant_id = tr.tenant_id AND apd.task_id = tr.task_id
				ORDER BY apd.created_at DESC
				LIMIT 1
			), '')
		FROM task_records tr
		WHERE tr.tenant_id = $1 AND tr.task_id = $2`,
		tenantID, taskID.String()).Scan(
		&executionID, &status, &taskDefinition, &agentID, &agentName,
		&proofStatus, &proofSignature, &proofVerified,
		&approvalRequired, &recoveryOccurred, &actionName,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return ExecutionTruth{}, ErrNotFound
	}
	if err != nil {
		return ExecutionTruth{}, err
	}
	proofGenerated := proofVerified.Bool || proofSignature.String != "" ||
		proofStatus.String == "verified" || proofStatus.String == "present"
	return BuildExecutionTruth(
		taskID,
		executionID.String,
		status.String,
		json.RawMessage(taskDefinition),
		actionName.String,
		agentID.String,
		agentName.String,
		approvalRequired,
		recoveryOccurred,
		proofGenerated,
	), nil
}

func (s *SQLStore) CreateRun(ctx context.Context, tenantID string, eval Eval, truth ExecutionTruth, results []AssertionResult, passed, failed int) (Run, error) {
	resultsJSON, err := ResultsJSON(results)
	if err != nil {
		return Run{}, err
	}
	status := EvalRunStatus(failed)
	run, err := scanRun(s.DB.QueryRowContext(ctx, `
		INSERT INTO execution_eval_runs (
			tenant_id, eval_id, task_id, execution_id, status,
			passed_count, failed_count, results_json, created_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
		RETURNING eval_run_id, tenant_id, eval_id, task_id, execution_id, status,
		          passed_count, failed_count, results_json, created_at, '' AS eval_name`,
		tenantID, eval.EvalID.String(), truth.TaskID.String(), truth.ExecutionID,
		status, passed, failed, resultsJSON))
	if err != nil {
		return Run{}, err
	}
	run.EvalName = eval.Name
	return run, nil
}

func (s *SQLStore) GetRunsForTaskOrRun(ctx context.Context, tenantID, id string) ([]Run, error) {
	parsed, err := uuid.Parse(strings.TrimSpace(id))
	if err != nil {
		return nil, ErrNotFound
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT er.eval_run_id, er.tenant_id, er.eval_id, er.task_id, er.execution_id,
		       er.status, er.passed_count, er.failed_count, er.results_json, er.created_at,
		       COALESCE(e.name, '')
		FROM execution_eval_runs er
		LEFT JOIN execution_evals e
		  ON e.tenant_id = er.tenant_id AND e.eval_id = er.eval_id
		WHERE er.tenant_id = $1 AND (er.eval_run_id = $2 OR er.task_id = $2)
		ORDER BY er.created_at DESC`, tenantID, parsed.String())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Run, 0)
	for rows.Next() {
		item, err := scanRun(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, ErrNotFound
	}
	return items, nil
}

func (s *SQLStore) GetRunsForEval(ctx context.Context, tenantID, id string, limit int) ([]Run, error) {
	evalID, err := uuid.Parse(strings.TrimSpace(id))
	if err != nil {
		return nil, ErrNotFound
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT er.eval_run_id, er.tenant_id, er.eval_id, er.task_id, er.execution_id,
		       er.status, er.passed_count, er.failed_count, er.results_json, er.created_at,
		       COALESCE(e.name, '')
		FROM execution_eval_runs er
		INNER JOIN execution_evals e
		  ON e.tenant_id = er.tenant_id AND e.eval_id = er.eval_id
		WHERE er.tenant_id = $1
		  AND er.eval_id = $2
		  AND e.archived_at IS NULL
		ORDER BY er.created_at DESC
		LIMIT $3`, tenantID, evalID.String(), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Run, 0)
	for rows.Next() {
		item, err := scanRun(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func scanEval(row scanner) (Eval, error) {
	var eval Eval
	var raw []byte
	var archived sql.NullTime
	err := row.Scan(
		&eval.EvalID,
		&eval.TenantID,
		&eval.Name,
		&eval.Description,
		&eval.TargetActionName,
		&eval.TargetAgentID,
		&raw,
		&eval.Enabled,
		&eval.CreatedAt,
		&eval.UpdatedAt,
		&archived,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Eval{}, ErrNotFound
	}
	if err != nil {
		return Eval{}, err
	}
	if archived.Valid {
		eval.ArchivedAt = &archived.Time
	}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &eval.Assertions); err != nil {
			return Eval{}, fmt.Errorf("decode assertions_json: %w", err)
		}
	}
	return eval, nil
}

func scanRun(row scanner) (Run, error) {
	var run Run
	var raw []byte
	err := row.Scan(
		&run.EvalRunID,
		&run.TenantID,
		&run.EvalID,
		&run.TaskID,
		&run.ExecutionID,
		&run.Status,
		&run.PassedCount,
		&run.FailedCount,
		&raw,
		&run.CreatedAt,
		&run.EvalName,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Run{}, ErrNotFound
	}
	if err != nil {
		return Run{}, err
	}
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &run.Results); err != nil {
			return Run{}, fmt.Errorf("decode results_json: %w", err)
		}
	}
	return run, nil
}
