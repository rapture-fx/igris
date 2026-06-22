package trustrecs

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

// SQLStore persists trust recommendation lifecycle state. Every method is
// tenant-scoped: the tenant id always comes from the authenticated caller and is
// bound as a query parameter.
type SQLStore struct {
	DB *sql.DB
}

type scanner interface {
	Scan(dest ...interface{}) error
}

const stateColumns = `state_id, tenant_id, recommendation_id, status, reason,
	snoozed_until, acknowledged_at, resolved_at, created_at, updated_at`

// Upsert sets the lifecycle state for one recommendation, canonicalizing the
// status-implied timestamps. There is exactly one row per (tenant,
// recommendation_id); a repeat call overwrites the prior decision.
func (s *SQLStore) Upsert(ctx context.Context, tenantID string, input UpsertInput) (State, error) {
	now := time.Now().UTC()
	normalized, err := ValidateUpsertInput(input, now)
	if err != nil {
		return State{}, err
	}

	var acknowledgedAt, resolvedAt, snoozedUntil sql.NullTime
	switch normalized.Status {
	case StatusAcknowledged:
		acknowledgedAt = sql.NullTime{Time: now, Valid: true}
	case StatusResolved:
		resolvedAt = sql.NullTime{Time: now, Valid: true}
	case StatusSnoozed:
		snoozedUntil = sql.NullTime{Time: *normalized.SnoozedUntil, Valid: true}
	}

	return scanState(s.DB.QueryRowContext(ctx, `
		INSERT INTO trust_recommendation_states (
			tenant_id, recommendation_id, status, reason,
			snoozed_until, acknowledged_at, resolved_at, created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
		ON CONFLICT (tenant_id, recommendation_id) DO UPDATE SET
			status = EXCLUDED.status,
			reason = EXCLUDED.reason,
			snoozed_until = EXCLUDED.snoozed_until,
			acknowledged_at = EXCLUDED.acknowledged_at,
			resolved_at = EXCLUDED.resolved_at,
			updated_at = NOW()
		RETURNING `+stateColumns,
		tenantID, normalized.RecommendationID, normalized.Status, normalized.Reason,
		snoozedUntil, acknowledgedAt, resolvedAt))
}

// List returns every lifecycle row for the tenant, newest first.
func (s *SQLStore) List(ctx context.Context, tenantID string) ([]State, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT `+stateColumns+`
		FROM trust_recommendation_states
		WHERE tenant_id = $1
		ORDER BY updated_at DESC`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]State, 0)
	for rows.Next() {
		item, err := scanState(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func scanState(row scanner) (State, error) {
	var st State
	var reason sql.NullString
	var snoozedUntil, acknowledgedAt, resolvedAt sql.NullTime
	err := row.Scan(
		&st.StateID,
		&st.TenantID,
		&st.RecommendationID,
		&st.Status,
		&reason,
		&snoozedUntil,
		&acknowledgedAt,
		&resolvedAt,
		&st.CreatedAt,
		&st.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return State{}, ErrNotFound
	}
	if err != nil {
		return State{}, err
	}
	st.Reason = reason.String
	if snoozedUntil.Valid {
		t := snoozedUntil.Time
		st.SnoozedUntil = &t
	}
	if acknowledgedAt.Valid {
		t := acknowledgedAt.Time
		st.AcknowledgedAt = &t
	}
	if resolvedAt.Valid {
		t := resolvedAt.Time
		st.ResolvedAt = &t
	}
	return st, nil
}
