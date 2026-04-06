-- Migration 032: Persist signed task execution artifacts for durable polling.
-- Runtime already returns execution_envelope and execution_receipt on final task
-- completion. Overture stores them here so GET /v1/tasks can expose the same
-- signed audit material without requiring clients to consume the stream path.

ALTER TABLE task_records
    ADD COLUMN IF NOT EXISTS execution_envelope JSONB,
    ADD COLUMN IF NOT EXISTS execution_receipt JSONB;
