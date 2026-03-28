-- Migration 027: Add prompt_preview to execution_lineage.
-- Required by the HITL approvals page so reviewers can see what the agent
-- was about to execute before approving or rejecting.

ALTER TABLE execution_lineage
    ADD COLUMN IF NOT EXISTS prompt_preview TEXT;
