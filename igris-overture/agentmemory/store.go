package agentmemory

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

var ErrNotFound = errors.New("agent memory target not found")

type SQLStore struct {
	DB *sql.DB
}

type scanner interface {
	Scan(dest ...interface{}) error
}

func (s *SQLStore) Create(ctx context.Context, tenantID string, input CreateInput, now time.Time) (Memory, error) {
	normalized, err := ValidateCreateInput(input, now)
	if err != nil {
		return Memory{}, err
	}
	evidence, err := EvidenceJSON(normalized.EvidenceSummary)
	if err != nil {
		return Memory{}, fmt.Errorf("marshal evidence_summary: %w", err)
	}
	expiresAt := RetentionExpiry(now, normalized.RetentionDays)
	row := s.DB.QueryRowContext(ctx, `
		INSERT INTO agent_evidence_memory (
			tenant_id, task_id, execution_id, registered_agent_id, registered_agent_name,
			goal_summary, decision_summary, evidence_summary, outcome_summary,
			redaction_status, retention_expires_at, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
		RETURNING memory_id, tenant_id, task_id, execution_id, registered_agent_id,
		          registered_agent_name, goal_summary, decision_summary, evidence_summary,
		          outcome_summary, redaction_status, retention_expires_at, created_at, updated_at`,
		tenantID,
		nullUUID(normalized.TaskID),
		normalized.ExecutionID,
		nullUUID(normalized.RegisteredAgentID),
		normalized.RegisteredAgentName,
		normalized.GoalSummary,
		normalized.DecisionSummary,
		evidence,
		normalized.OutcomeSummary,
		RedactionStatus,
		expiresAt,
	)
	return scanMemory(row)
}

func (s *SQLStore) List(ctx context.Context, tenantID string, filter ListFilter) ([]Memory, error) {
	limit := filter.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	args := []interface{}{tenantID}
	where := []string{"tenant_id = $1"}
	if filter.TaskID != nil {
		args = append(args, filter.TaskID.String())
		where = append(where, fmt.Sprintf("task_id = $%d", len(args)))
	}
	if strings.TrimSpace(filter.ExecutionID) != "" {
		args = append(args, strings.TrimSpace(filter.ExecutionID))
		where = append(where, fmt.Sprintf("execution_id = $%d", len(args)))
	}
	if filter.AgentID != nil {
		args = append(args, filter.AgentID.String())
		where = append(where, fmt.Sprintf("registered_agent_id = $%d", len(args)))
	}
	if strings.TrimSpace(filter.AgentName) != "" {
		args = append(args, normalizeAgentName(filter.AgentName))
		where = append(where, fmt.Sprintf("registered_agent_name = $%d", len(args)))
	}
	args = append(args, limit)

	query := `
		SELECT memory_id, tenant_id, task_id, execution_id, registered_agent_id,
		       registered_agent_name, goal_summary, decision_summary, evidence_summary,
		       outcome_summary, redaction_status, retention_expires_at, created_at, updated_at
		FROM agent_evidence_memory
		WHERE ` + strings.Join(where, " AND ") + `
		  AND (retention_expires_at IS NULL OR retention_expires_at > NOW())
		ORDER BY created_at DESC
		LIMIT $` + fmt.Sprintf("%d", len(args))

	rows, err := s.DB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Memory, 0)
	for rows.Next() {
		item, err := scanMemory(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func scanMemory(row scanner) (Memory, error) {
	var memory Memory
	var taskID uuid.NullUUID
	var agentID uuid.NullUUID
	var evidenceRaw []byte
	var retentionExpiresAt sql.NullTime
	err := row.Scan(
		&memory.MemoryID,
		&memory.TenantID,
		&taskID,
		&memory.ExecutionID,
		&agentID,
		&memory.RegisteredAgentName,
		&memory.GoalSummary,
		&memory.DecisionSummary,
		&evidenceRaw,
		&memory.OutcomeSummary,
		&memory.RedactionStatus,
		&retentionExpiresAt,
		&memory.CreatedAt,
		&memory.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Memory{}, ErrNotFound
		}
		return Memory{}, err
	}
	if taskID.Valid {
		id := taskID.UUID
		memory.TaskID = &id
	}
	if agentID.Valid {
		id := agentID.UUID
		memory.RegisteredAgentID = &id
	}
	if retentionExpiresAt.Valid {
		t := retentionExpiresAt.Time
		memory.RetentionExpiresAt = &t
	}
	memory.EvidenceSummary = DecodeEvidence(evidenceRaw)
	return memory, nil
}

func nullUUID(id *uuid.UUID) interface{} {
	if id == nil || *id == uuid.Nil {
		return nil
	}
	return id.String()
}
