package policyproposals

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// SQLStore persists policy proposals and their governance events. Every method
// is tenant-scoped: the tenant id always comes from the authenticated caller and
// is bound as a query parameter, never interpolated.
type SQLStore struct {
	DB *sql.DB
}

type scanner interface {
	Scan(dest ...interface{}) error
}

const proposalColumns = `proposal_id, tenant_id, name, description, status, policy_mode,
	match_criteria_json, latest_simulation_json, created_by, created_at, updated_at, archived_at`

// List returns the tenant's non-archived proposals, most recently updated first.
func (s *SQLStore) List(ctx context.Context, tenantID string) ([]Proposal, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT `+proposalColumns+`
		FROM policy_proposals
		WHERE tenant_id = $1 AND archived_at IS NULL
		ORDER BY updated_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Proposal, 0)
	for rows.Next() {
		item, err := scanProposal(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

// Get returns one non-archived proposal for the tenant.
func (s *SQLStore) Get(ctx context.Context, tenantID, id string) (Proposal, error) {
	proposalID, err := uuid.Parse(strings.TrimSpace(id))
	if err != nil {
		return Proposal{}, ErrNotFound
	}
	return scanProposal(s.DB.QueryRowContext(ctx, `
		SELECT `+proposalColumns+`
		FROM policy_proposals
		WHERE tenant_id = $1 AND proposal_id = $2 AND archived_at IS NULL`,
		tenantID, proposalID.String()))
}

// Create inserts a new draft proposal and records a 'created' event atomically.
func (s *SQLStore) Create(ctx context.Context, tenantID, createdBy string, input CreateInput) (Proposal, error) {
	normalized, err := ValidateCreateInput(input)
	if err != nil {
		return Proposal{}, err
	}
	criteriaJSON, err := json.Marshal(normalized.MatchCriteria)
	if err != nil {
		return Proposal{}, err
	}

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return Proposal{}, err
	}
	defer func() { _ = tx.Rollback() }()

	proposal, err := scanProposal(tx.QueryRowContext(ctx, `
		INSERT INTO policy_proposals (
			tenant_id, name, description, status, policy_mode,
			match_criteria_json, created_by, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
		RETURNING `+proposalColumns,
		tenantID, normalized.Name, normalized.Description, StatusDraft, normalized.PolicyMode,
		criteriaJSON, createdBy))
	if err != nil {
		return Proposal{}, err
	}
	if err := insertEvent(ctx, tx, tenantID, proposal.ProposalID, "created", "Draft proposal created"); err != nil {
		return Proposal{}, err
	}
	if err := tx.Commit(); err != nil {
		return Proposal{}, err
	}
	return proposal, nil
}

// Update applies an allow-listed partial edit and/or a safe readiness toggle.
// Content edits are only permitted while the proposal is a draft; the
// draft<->review_ready toggle is the only status change accepted here.
func (s *SQLStore) Update(ctx context.Context, tenantID, id string, input UpdateInput) (Proposal, error) {
	normalized, err := ValidateUpdateInput(input)
	if err != nil {
		return Proposal{}, err
	}
	current, err := s.Get(ctx, tenantID, id)
	if err != nil {
		return Proposal{}, err
	}

	if normalized.hasContentEdit() && !canEditContent(current.Status) {
		return Proposal{}, ErrInvalidTransition
	}
	statusChanged := false
	if normalized.Status != nil && *normalized.Status != current.Status {
		if !canToggleReadiness(current.Status, *normalized.Status) {
			return Proposal{}, ErrInvalidTransition
		}
		statusChanged = true
	}

	if normalized.Name != nil {
		current.Name = *normalized.Name
	}
	if normalized.Description != nil {
		current.Description = *normalized.Description
	}
	if normalized.PolicyMode != nil {
		current.PolicyMode = *normalized.PolicyMode
	}
	if normalized.MatchCriteria != nil {
		current.MatchCriteria = *normalized.MatchCriteria
	}
	if normalized.Status != nil {
		current.Status = *normalized.Status
	}
	criteriaJSON, err := json.Marshal(current.MatchCriteria)
	if err != nil {
		return Proposal{}, err
	}

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return Proposal{}, err
	}
	defer func() { _ = tx.Rollback() }()

	updated, err := scanProposal(tx.QueryRowContext(ctx, `
		UPDATE policy_proposals
		SET name = $3, description = $4, policy_mode = $5, match_criteria_json = $6,
		    status = $7, updated_at = NOW()
		WHERE tenant_id = $1 AND proposal_id = $2 AND archived_at IS NULL
		RETURNING `+proposalColumns,
		tenantID, current.ProposalID.String(), current.Name, current.Description,
		current.PolicyMode, criteriaJSON, current.Status))
	if err != nil {
		return Proposal{}, err
	}
	if normalized.hasContentEdit() {
		if err := insertEvent(ctx, tx, tenantID, updated.ProposalID, "updated", "Proposal details updated"); err != nil {
			return Proposal{}, err
		}
	}
	if statusChanged {
		summary := "Marked ready for review"
		if updated.Status == StatusDraft {
			summary = "Moved back to draft"
		}
		if err := insertEvent(ctx, tx, tenantID, updated.ProposalID, "status_changed", summary); err != nil {
			return Proposal{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return Proposal{}, err
	}
	return updated, nil
}

// SaveSimulation persists a fresh, safe simulation summary for a proposal and
// records a 'simulated' event. Re-simulation is read-only over execution truth
// and never changes the proposal's status or criteria.
func (s *SQLStore) SaveSimulation(ctx context.Context, tenantID, id string, summaryJSON []byte, affected, total int64) (Proposal, error) {
	proposalID, err := uuid.Parse(strings.TrimSpace(id))
	if err != nil {
		return Proposal{}, ErrNotFound
	}

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return Proposal{}, err
	}
	defer func() { _ = tx.Rollback() }()

	updated, err := scanProposal(tx.QueryRowContext(ctx, `
		UPDATE policy_proposals
		SET latest_simulation_json = $3, updated_at = NOW()
		WHERE tenant_id = $1 AND proposal_id = $2 AND archived_at IS NULL
		RETURNING `+proposalColumns,
		tenantID, proposalID.String(), summaryJSON))
	if err != nil {
		return Proposal{}, err
	}
	summary := fmt.Sprintf("Re-simulated: %d of %d runs affected", affected, total)
	if err := insertEvent(ctx, tx, tenantID, updated.ProposalID, "simulated", summary); err != nil {
		return Proposal{}, err
	}
	if err := tx.Commit(); err != nil {
		return Proposal{}, err
	}
	return updated, nil
}

// Approve moves a review_ready proposal to approved. It requires a simulation to
// be attached as evidence and never promotes the rule into live policy.
func (s *SQLStore) Approve(ctx context.Context, tenantID, id string) (Proposal, error) {
	current, err := s.Get(ctx, tenantID, id)
	if err != nil {
		return Proposal{}, err
	}
	if current.Status != StatusReviewReady {
		return Proposal{}, ErrInvalidTransition
	}
	if len(current.LatestSimulation) == 0 {
		return Proposal{}, ErrNotSimulated
	}

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return Proposal{}, err
	}
	defer func() { _ = tx.Rollback() }()

	updated, err := scanProposal(tx.QueryRowContext(ctx, `
		UPDATE policy_proposals
		SET status = $3, updated_at = NOW()
		WHERE tenant_id = $1 AND proposal_id = $2 AND archived_at IS NULL AND status = $4
		RETURNING `+proposalColumns,
		tenantID, current.ProposalID.String(), StatusApproved, StatusReviewReady))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Proposal{}, ErrInvalidTransition
		}
		return Proposal{}, err
	}
	if err := insertEvent(ctx, tx, tenantID, updated.ProposalID, "approved", "Proposal approved for promotion"); err != nil {
		return Proposal{}, err
	}
	if err := tx.Commit(); err != nil {
		return Proposal{}, err
	}
	return updated, nil
}

// Archive soft-deletes a proposal and records an 'archived' event.
func (s *SQLStore) Archive(ctx context.Context, tenantID, id string) error {
	proposalID, err := uuid.Parse(strings.TrimSpace(id))
	if err != nil {
		return ErrNotFound
	}

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	res, err := tx.ExecContext(ctx, `
		UPDATE policy_proposals
		SET archived_at = NOW(), status = $3, updated_at = NOW()
		WHERE tenant_id = $1 AND proposal_id = $2 AND archived_at IS NULL`,
		tenantID, proposalID.String(), StatusArchived)
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
	if err := insertEvent(ctx, tx, tenantID, proposalID, "archived", "Proposal archived"); err != nil {
		return err
	}
	return tx.Commit()
}

// ListEvents returns the most recent governance events for a proposal.
func (s *SQLStore) ListEvents(ctx context.Context, tenantID, id string, limit int) ([]Event, error) {
	proposalID, err := uuid.Parse(strings.TrimSpace(id))
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
		SELECT event_id, tenant_id, proposal_id, event_type, safe_summary, created_at
		FROM policy_proposal_events
		WHERE tenant_id = $1 AND proposal_id = $2
		ORDER BY created_at DESC
		LIMIT $3`, tenantID, proposalID.String(), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]Event, 0)
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.EventID, &e.TenantID, &e.ProposalID, &e.EventType, &e.SafeSummary, &e.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, e)
	}
	return items, rows.Err()
}

// insertEvent appends one governance event. The summary is always a constant or
// count produced by this package — never operator free text — so it is safe.
func insertEvent(ctx context.Context, tx *sql.Tx, tenantID string, proposalID uuid.UUID, eventType, summary string) error {
	_, err := tx.ExecContext(ctx, `
		INSERT INTO policy_proposal_events (tenant_id, proposal_id, event_type, safe_summary, created_at)
		VALUES ($1,$2,$3,$4,NOW())`,
		tenantID, proposalID.String(), eventType, summary)
	return err
}

func scanProposal(row scanner) (Proposal, error) {
	var p Proposal
	var criteriaRaw []byte
	var simulationRaw []byte
	var archived sql.NullTime
	err := row.Scan(
		&p.ProposalID,
		&p.TenantID,
		&p.Name,
		&p.Description,
		&p.Status,
		&p.PolicyMode,
		&criteriaRaw,
		&simulationRaw,
		&p.CreatedBy,
		&p.CreatedAt,
		&p.UpdatedAt,
		&archived,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Proposal{}, ErrNotFound
	}
	if err != nil {
		return Proposal{}, err
	}
	if archived.Valid {
		p.ArchivedAt = &archived.Time
	}
	if len(criteriaRaw) > 0 {
		if err := json.Unmarshal(criteriaRaw, &p.MatchCriteria); err != nil {
			return Proposal{}, fmt.Errorf("decode match_criteria_json: %w", err)
		}
	}
	if len(simulationRaw) > 0 && string(simulationRaw) != "null" {
		p.LatestSimulation = json.RawMessage(simulationRaw)
	}
	return p, nil
}
