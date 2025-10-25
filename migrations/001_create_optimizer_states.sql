-- Migration: 001_create_optimizer_states
-- Purpose: Create optimizer_states table for persistent Thompson Sampling state
-- Phase: 2 - State Externalization
-- Date: 2025-10-25

-- Create optimizer_states table
CREATE TABLE IF NOT EXISTS optimizer_states (
    state_id BIGSERIAL PRIMARY KEY,
    snapshot_name VARCHAR(255) NOT NULL,
    optimizer_type VARCHAR(50) NOT NULL DEFAULT 'thompson_sampling',

    -- Core state data (JSONB for flexibility)
    state_data JSONB NOT NULL,

    -- Metadata
    provider_count INTEGER NOT NULL DEFAULT 0,
    total_samples BIGINT NOT NULL DEFAULT 0,
    version VARCHAR(20) NOT NULL DEFAULT '1.0',

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_optimizer_type CHECK (optimizer_type IN ('thompson_sampling', 'epsilon_greedy', 'ucb'))
);

-- Create index on snapshot_name for quick lookups
CREATE INDEX idx_optimizer_states_snapshot ON optimizer_states(snapshot_name);

-- Create index on created_at for time-based queries
CREATE INDEX idx_optimizer_states_created ON optimizer_states(created_at DESC);

-- Create index on optimizer_type for filtering
CREATE INDEX idx_optimizer_states_type ON optimizer_states(optimizer_type);

-- Create GIN index on state_data for JSON queries
CREATE INDEX idx_optimizer_states_data ON optimizer_states USING GIN (state_data);

-- Add comment
COMMENT ON TABLE optimizer_states IS 'Persistent storage for Thompson Sampling optimizer state across restarts';
COMMENT ON COLUMN optimizer_states.state_data IS 'JSONB containing provider statistics, arm counts, rewards, and sampling parameters';
COMMENT ON COLUMN optimizer_states.snapshot_name IS 'Unique identifier for the state snapshot (e.g., "latest", "2025-10-25-backup")';

-- Trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_optimizer_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_optimizer_states_updated_at
    BEFORE UPDATE ON optimizer_states
    FOR EACH ROW
    EXECUTE FUNCTION update_optimizer_states_updated_at();
