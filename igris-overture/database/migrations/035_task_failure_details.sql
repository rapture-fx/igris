-- Migration 035: Structured durable task failure details.
-- Preserves execution-authority rejection metadata separately from the
-- human-readable failure_reason string so API clients can inspect stable fields.

ALTER TABLE task_records
    ADD COLUMN IF NOT EXISTS failure_details JSONB;
