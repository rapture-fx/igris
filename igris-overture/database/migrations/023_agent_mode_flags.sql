-- Migration 023: Add reflection_mode and council_mode flags to agent_settings.
-- Required by PATCH /v1/agents/:id { reflection_mode, council_mode }.

ALTER TABLE agent_settings
    ADD COLUMN IF NOT EXISTS reflection_mode BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS council_mode     BOOLEAN NOT NULL DEFAULT false;
