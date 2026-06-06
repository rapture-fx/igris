package internal

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// RuntimeInstance represents a row in the runtime_instances table.
type RuntimeInstance struct {
	RuntimeID    string
	Endpoint     string
	PublicKey    string
	Capabilities []string
	Platform     string
	Version      string
	IsEdge       bool
	IsHealthy    bool
	LastSeenAt   time.Time
}

// RuntimeRepository provides CRUD access to the runtime_instances table.
type RuntimeRepository struct {
	db *sql.DB
}

// NewRuntimeRepository creates a RuntimeRepository backed by db.
func NewRuntimeRepository(db *sql.DB) *RuntimeRepository {
	return &RuntimeRepository{db: db}
}

// ListHealthy returns all is_healthy=true rows ordered edge-first, then by last_seen_at DESC.
func (r *RuntimeRepository) ListHealthy(ctx context.Context) ([]RuntimeInstance, error) {
	const q = `
		SELECT runtime_id, endpoint, public_key_ed25519, capabilities,
		       COALESCE(platform,''), COALESCE(version,''),
		       is_edge, is_healthy, last_seen_at
		FROM runtime_instances
		WHERE is_healthy = TRUE
		  AND endpoint IS NOT NULL
		  AND BTRIM(endpoint) <> ''
		ORDER BY is_edge DESC, last_seen_at DESC`

	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("runtime_repository: list_healthy: %w", err)
	}
	defer rows.Close()
	return scanInstances(rows)
}

// ListAll returns all rows (used by health poller).
func (r *RuntimeRepository) ListAll(ctx context.Context) ([]RuntimeInstance, error) {
	const q = `
		SELECT runtime_id, endpoint, public_key_ed25519, capabilities,
		       COALESCE(platform,''), COALESCE(version,''),
		       is_edge, is_healthy, last_seen_at
		FROM runtime_instances
		ORDER BY is_edge DESC`

	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("runtime_repository: list_all: %w", err)
	}
	defer rows.Close()
	return scanInstances(rows)
}

// UpdateHealth sets is_healthy and refreshes last_seen_at for a single runtime.
func (r *RuntimeRepository) UpdateHealth(ctx context.Context, runtimeID string, healthy bool) error {
	const q = `UPDATE runtime_instances SET is_healthy=$1, last_seen_at=NOW() WHERE runtime_id=$2`
	if _, err := r.db.ExecContext(ctx, q, healthy, runtimeID); err != nil {
		return fmt.Errorf("runtime_repository: update_health: %w", err)
	}
	return nil
}

// Upsert inserts or updates a runtime_instances row on runtime_id conflict.
func (r *RuntimeRepository) Upsert(ctx context.Context, inst RuntimeInstance) error {
	normalizedEndpoint, err := NormalizeHTTPRuntimeEndpoint(inst.Endpoint)
	if err != nil {
		return fmt.Errorf("runtime_repository: upsert: %w", ErrInvalidRuntimeEndpoint)
	}
	inst.Endpoint = normalizedEndpoint
	caps, err := json.Marshal(inst.Capabilities)
	if err != nil {
		caps = []byte("[]")
	}
	const q = `
		INSERT INTO runtime_instances
		  (runtime_id, endpoint, public_key_ed25519, capabilities,
		   platform, version, is_edge, is_healthy, last_seen_at, registered_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,NOW(),NOW())
		ON CONFLICT (runtime_id) DO UPDATE SET
		  endpoint=$2, public_key_ed25519=$3, capabilities=$4,
		  platform=$5, version=$6, is_edge=$7, is_healthy=TRUE, last_seen_at=NOW()`

	if _, err := r.db.ExecContext(ctx, q,
		inst.RuntimeID, inst.Endpoint, inst.PublicKey, caps,
		inst.Platform, inst.Version, inst.IsEdge,
	); err != nil {
		return fmt.Errorf("runtime_repository: upsert: %w", err)
	}
	return nil
}

// scanInstances reads rows into a []RuntimeInstance slice.
func scanInstances(rows *sql.Rows) ([]RuntimeInstance, error) {
	var out []RuntimeInstance
	for rows.Next() {
		var inst RuntimeInstance
		var capsJSON []byte
		if err := rows.Scan(
			&inst.RuntimeID, &inst.Endpoint, &inst.PublicKey, &capsJSON,
			&inst.Platform, &inst.Version,
			&inst.IsEdge, &inst.IsHealthy, &inst.LastSeenAt,
		); err != nil {
			return nil, fmt.Errorf("runtime_repository: scan: %w", err)
		}
		// Decode capabilities JSONB (null → empty slice).
		if len(capsJSON) > 0 {
			_ = json.Unmarshal(capsJSON, &inst.Capabilities)
		}
		if inst.Capabilities == nil {
			inst.Capabilities = []string{}
		}
		out = append(out, inst)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("runtime_repository: rows: %w", err)
	}
	return out, nil
}
