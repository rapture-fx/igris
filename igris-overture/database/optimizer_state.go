package database

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// OptimizerStatePersistence handles Rust optimizer state persistence to Postgres
// Phase 2: Enables optimizer state recovery across service restarts
type OptimizerStatePersistence struct {
	db      *sql.DB
	enabled bool
}

// OptimizerState represents a snapshot of the Rust optimizer's internal state
type OptimizerState struct {
	StateID       int64                  `json:"state_id,omitempty"`
	SnapshotName  string                 `json:"snapshot_name"`
	OptimizerType string                 `json:"optimizer_type"` // "thompson_sampling", "epsilon_greedy", etc.

	// Serialized optimizer state (JSON or binary)
	StateData     map[string]interface{} `json:"state_data"`

	// Metadata
	ProviderCount int                    `json:"provider_count"`
	TotalSamples  int64                  `json:"total_samples"`
	Version       string                 `json:"version"`

	// Timestamps
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
}

// OptimizerCheckpoint represents a point-in-time snapshot for recovery
type OptimizerCheckpoint struct {
	CheckpointID  int64     `json:"checkpoint_id"`
	StateData     []byte    `json:"state_data"`
	Checksum      string    `json:"checksum"`
	CreatedAt     time.Time `json:"created_at"`
}

// NewOptimizerStatePersistence creates a new optimizer state persistence handler
func NewOptimizerStatePersistence(db *sql.DB) *OptimizerStatePersistence {
	enabled := db != nil

	if enabled {
		// Ensure schema exists
		if err := createOptimizerStateSchema(db); err != nil {
			enabled = false
			fmt.Printf("[OptimizerState] Warning: Failed to create schema: %v\n", err)
		}
	}

	return &OptimizerStatePersistence{
		db:      db,
		enabled: enabled,
	}
}

// IsEnabled returns whether database persistence is enabled
func (osp *OptimizerStatePersistence) IsEnabled() bool {
	return osp.enabled
}

// SaveState persists the optimizer state to Postgres
func (osp *OptimizerStatePersistence) SaveState(ctx context.Context, state *OptimizerState) (int64, error) {
	if !osp.enabled {
		return 0, fmt.Errorf("database persistence not enabled")
	}

	state.UpdatedAt = time.Now()
	if state.CreatedAt.IsZero() {
		state.CreatedAt = state.UpdatedAt
	}

	// Serialize state data to JSON
	stateJSON, err := json.Marshal(state.StateData)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal state data: %w", err)
	}

	var stateID int64
	err = osp.db.QueryRowContext(ctx, `
		INSERT INTO optimizer_states (
			snapshot_name, optimizer_type, state_data,
			provider_count, total_samples, version,
			created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING state_id
	`, state.SnapshotName, state.OptimizerType, stateJSON,
		state.ProviderCount, state.TotalSamples, state.Version,
		state.CreatedAt, state.UpdatedAt).Scan(&stateID)

	if err != nil {
		return 0, fmt.Errorf("failed to save optimizer state: %w", err)
	}

	return stateID, nil
}

// LoadState retrieves the latest optimizer state
func (osp *OptimizerStatePersistence) LoadState(ctx context.Context, snapshotName string) (*OptimizerState, error) {
	if !osp.enabled {
		return nil, fmt.Errorf("database persistence not enabled")
	}

	var state OptimizerState
	var stateJSON []byte

	err := osp.db.QueryRowContext(ctx, `
		SELECT state_id, snapshot_name, optimizer_type, state_data,
		       provider_count, total_samples, version, created_at, updated_at
		FROM optimizer_states
		WHERE snapshot_name = $1
		ORDER BY updated_at DESC
		LIMIT 1
	`, snapshotName).Scan(
		&state.StateID, &state.SnapshotName, &state.OptimizerType, &stateJSON,
		&state.ProviderCount, &state.TotalSamples, &state.Version,
		&state.CreatedAt, &state.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil // No state found
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load optimizer state: %w", err)
	}

	// Deserialize state data
	if err := json.Unmarshal(stateJSON, &state.StateData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal state data: %w", err)
	}

	return &state, nil
}

// UpdateState updates an existing optimizer state
func (osp *OptimizerStatePersistence) UpdateState(ctx context.Context, state *OptimizerState) error {
	if !osp.enabled {
		return fmt.Errorf("database persistence not enabled")
	}

	state.UpdatedAt = time.Now()

	stateJSON, err := json.Marshal(state.StateData)
	if err != nil {
		return fmt.Errorf("failed to marshal state data: %w", err)
	}

	_, err = osp.db.ExecContext(ctx, `
		UPDATE optimizer_states
		SET state_data = $1, provider_count = $2, total_samples = $3,
		    version = $4, updated_at = $5
		WHERE state_id = $6
	`, stateJSON, state.ProviderCount, state.TotalSamples,
		state.Version, state.UpdatedAt, state.StateID)

	if err != nil {
		return fmt.Errorf("failed to update optimizer state: %w", err)
	}

	return nil
}

// CreateCheckpoint creates a point-in-time checkpoint for recovery
func (osp *OptimizerStatePersistence) CreateCheckpoint(ctx context.Context, stateData []byte, checksum string) (int64, error) {
	if !osp.enabled {
		return 0, fmt.Errorf("database persistence not enabled")
	}

	var checkpointID int64
	err := osp.db.QueryRowContext(ctx, `
		INSERT INTO optimizer_checkpoints (state_data, checksum, created_at)
		VALUES ($1, $2, $3)
		RETURNING checkpoint_id
	`, stateData, checksum, time.Now()).Scan(&checkpointID)

	if err != nil {
		return 0, fmt.Errorf("failed to create checkpoint: %w", err)
	}

	return checkpointID, nil
}

// LoadLatestCheckpoint retrieves the most recent checkpoint
func (osp *OptimizerStatePersistence) LoadLatestCheckpoint(ctx context.Context) (*OptimizerCheckpoint, error) {
	if !osp.enabled {
		return nil, fmt.Errorf("database persistence not enabled")
	}

	var checkpoint OptimizerCheckpoint

	err := osp.db.QueryRowContext(ctx, `
		SELECT checkpoint_id, state_data, checksum, created_at
		FROM optimizer_checkpoints
		ORDER BY created_at DESC
		LIMIT 1
	`).Scan(&checkpoint.CheckpointID, &checkpoint.StateData,
		&checkpoint.Checksum, &checkpoint.CreatedAt)

	if err == sql.ErrNoRows {
		return nil, nil // No checkpoint found
	}
	if err != nil {
		return nil, fmt.Errorf("failed to load checkpoint: %w", err)
	}

	return &checkpoint, nil
}

// CleanupOldStates removes optimizer states older than specified duration
func (osp *OptimizerStatePersistence) CleanupOldStates(ctx context.Context, olderThan time.Duration) (int64, error) {
	if !osp.enabled {
		return 0, fmt.Errorf("database persistence not enabled")
	}

	cutoffTime := time.Now().Add(-olderThan)

	result, err := osp.db.ExecContext(ctx, `
		DELETE FROM optimizer_states
		WHERE updated_at < $1
	`, cutoffTime)

	if err != nil {
		return 0, fmt.Errorf("failed to cleanup old states: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	return rowsAffected, nil
}

// CleanupOldCheckpoints removes checkpoints older than specified duration
func (osp *OptimizerStatePersistence) CleanupOldCheckpoints(ctx context.Context, olderThan time.Duration) (int64, error) {
	if !osp.enabled {
		return 0, fmt.Errorf("database persistence not enabled")
	}

	cutoffTime := time.Now().Add(-olderThan)

	result, err := osp.db.ExecContext(ctx, `
		DELETE FROM optimizer_checkpoints
		WHERE created_at < $1
	`, cutoffTime)

	if err != nil {
		return 0, fmt.Errorf("failed to cleanup old checkpoints: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	return rowsAffected, nil
}

// GetStateHistory returns historical optimizer states
func (osp *OptimizerStatePersistence) GetStateHistory(ctx context.Context, snapshotName string, limit int) ([]*OptimizerState, error) {
	if !osp.enabled {
		return nil, fmt.Errorf("database persistence not enabled")
	}

	rows, err := osp.db.QueryContext(ctx, `
		SELECT state_id, snapshot_name, optimizer_type, state_data,
		       provider_count, total_samples, version, created_at, updated_at
		FROM optimizer_states
		WHERE snapshot_name = $1
		ORDER BY updated_at DESC
		LIMIT $2
	`, snapshotName, limit)

	if err != nil {
		return nil, fmt.Errorf("failed to query state history: %w", err)
	}
	defer rows.Close()

	var states []*OptimizerState

	for rows.Next() {
		var state OptimizerState
		var stateJSON []byte

		if err := rows.Scan(
			&state.StateID, &state.SnapshotName, &state.OptimizerType, &stateJSON,
			&state.ProviderCount, &state.TotalSamples, &state.Version,
			&state.CreatedAt, &state.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan state row: %w", err)
		}

		if err := json.Unmarshal(stateJSON, &state.StateData); err != nil {
			return nil, fmt.Errorf("failed to unmarshal state data: %w", err)
		}

		states = append(states, &state)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating state rows: %w", err)
	}

	return states, nil
}

// createOptimizerStateSchema creates the necessary database tables
func createOptimizerStateSchema(db *sql.DB) error {
	schema := `
	-- Optimizer states table
	CREATE TABLE IF NOT EXISTS optimizer_states (
		state_id BIGSERIAL PRIMARY KEY,
		snapshot_name VARCHAR(255) NOT NULL,
		optimizer_type VARCHAR(100) NOT NULL,
		state_data JSONB NOT NULL,
		provider_count INTEGER NOT NULL,
		total_samples BIGINT NOT NULL,
		version VARCHAR(50) NOT NULL,
		created_at TIMESTAMP NOT NULL,
		updated_at TIMESTAMP NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_optimizer_states_snapshot
		ON optimizer_states(snapshot_name, updated_at DESC);

	-- Optimizer checkpoints table
	CREATE TABLE IF NOT EXISTS optimizer_checkpoints (
		checkpoint_id BIGSERIAL PRIMARY KEY,
		state_data BYTEA NOT NULL,
		checksum VARCHAR(64) NOT NULL,
		created_at TIMESTAMP NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_optimizer_checkpoints_created
		ON optimizer_checkpoints(created_at DESC);
	`

	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to create schema: %w", err)
	}

	return nil
}
