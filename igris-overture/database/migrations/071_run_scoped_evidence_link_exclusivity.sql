-- Migration 071: Run-scoped evidence link exclusivity (Clock 3C).
--
-- Clock 3B allowed the same verified Embedded evidence chain/batch to be
-- linked to multiple contract-bound runs that shared a contract_hash. Clock 3C
-- fails closed: within a tenant, one evidence batch and one chain digest may
-- prove at most one durable run.
--
-- This migration does NOT change Action Protocol Evidence, Runtime receipts,
-- ActionContract schema, or igris-verify semantics. It only strengthens the
-- server-side linkage table introduced by migration 070.
--
-- NOTE: this migration is committed for the normal manual migration runbook.
-- It is NOT applied to any shared, staging, or production database here.
-- Disposable proof/CI databases may apply it explicitly via the heavy proof
-- gate runbook; application startup must never auto-apply it.

-- One verified evidence batch may attach to at most one bound run per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS contract_bound_action_evidence_links_batch_exclusive_idx
    ON contract_bound_action_evidence_links (tenant_id, evidence_batch_id)
    WHERE evidence_batch_id IS NOT NULL;

-- One evidence chain digest may attach to at most one bound run per tenant.
-- Stronger than the 070 unique (tenant_id, task_id, evidence_chain_digest),
-- which still permitted the same digest across different task_ids.
CREATE UNIQUE INDEX IF NOT EXISTS contract_bound_action_evidence_links_digest_exclusive_idx
    ON contract_bound_action_evidence_links (tenant_id, evidence_chain_digest);
