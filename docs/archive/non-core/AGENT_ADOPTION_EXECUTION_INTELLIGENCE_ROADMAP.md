# Igris Agent Adoption and Execution Intelligence Roadmap

## Current State Assessment

Igris already has the right execution-trust spine for agent adoption:

- Actions and Action Packs compile into registered actions. Action Pack manifests reject tenant overrides, raw task definitions, runtime endpoints, ciphertext, nonces, key material, and secret-looking values.
- The Agent Registry is tenant-scoped identity and attribution only. It does not deploy agents or store secrets, prompts, or model internals.
- Durable task records are tenant-scoped and idempotent by `(tenant_id, idempotency_key)`.
- Runtime dispatch, signed runtime callbacks, recovery events, proof state, receipt lineage, execution boundaries, and governance decisions are persisted separately.
- MCP `call_action` rides the registered-action path and rejects raw execution override fields before dispatch.
- The product promise suite already exercises registered actions, MCP, idempotency, runtime dispatch, callbacks, recovery, proof, and safe inspection.

The main gap is adoption/product shape: operators can see what executed and whether it was proven, but not a concise explanation of why an agent chose an action, and there is no first-class reliability view by agent or action.

## Evidence Memory Design

Evidence Memory is a summary-only operator record attached to a task, execution id, or registered agent. It is not a prompt store, trace store, chat history, or model observability feature.

Stored fields:

- `goal_summary`: bounded human-readable goal.
- `decision_summary`: bounded explanation of the external decision.
- `evidence_summary`: bounded JSON array of evidence labels such as `usage=4821`.
- `outcome_summary`: bounded result summary.
- `task_id`, `execution_id`, `registered_agent_id`, `registered_agent_name`: tenant-scoped attachment keys.
- `redaction_status`, `retention_expires_at`, timestamps.

Server rules:

- Reject body `tenant_id`; tenant comes only from auth.
- Validate task ownership before attaching to `task_id`.
- Validate execution ownership before attaching to `execution_id`.
- Resolve registered agents through the Agent Registry.
- Reject prompt, chain-of-thought, hidden reasoning, token, API key, password, private key, and bearer-style markers.
- Enforce bounded field lengths and item counts.

## Execution Intelligence Design

Execution Intelligence derives from execution truth only:

- `task_records.status`, `created_at`, `dispatched_at`, `completed_at`, `canceled_at`.
- `action_policy_decisions.decision` and latest `action_name`.
- `approval_requests` for human intervention.
- `task_recovery_events` for recovery involvement.

Initial metrics:

- total runs, successful runs, failed runs
- success rate, failure rate
- approval-required count/rate
- human intervention count/rate
- recovery count/rate
- average execution duration
- agent reliability breakdown
- action reliability breakdown

This intentionally excludes prompt text, model outputs, hidden reasoning, and provider-specific assumptions.

## Required Schema Changes

Implemented foundation migration:

- `igris-overture/database/migrations/063_agent_evidence_memory.sql`

New table:

- `agent_evidence_memory`

Indexes:

- tenant + task
- tenant + execution id
- tenant + registered agent
- tenant + retention expiry

Future schema work:

- Optional retention cleanup job for expired evidence memory.
- Optional materialized daily rollup table only after query volume justifies it.

## Required API Changes

Implemented foundation APIs:

- `POST /v1/agent-memory`
- `GET /v1/agent-memory`
- `GET /v1/execution/intelligence`

Response principles:

- Return summaries and safe IDs only.
- Do not return prompts, raw task definitions, encrypted payloads, checkpoint bodies, receipt bodies, provider tokens, or secrets.
- Keep `verified`, proof fields, recovery state, and evidence memory separate.

Future API work:

- Add `GET /v1/agents/:id/intelligence`.
- Add `GET /v1/actions/:id/intelligence`.
- Add retention admin endpoints only if there is a real operator workflow.

## Required Console Changes

Recommended views:

- Run detail: add an "Evidence Memory" section below proof/recovery with goal, decision, evidence, outcome.
- Agent detail: add reliability summary and recent evidence memory.
- Actions: add action reliability trends beside registered action detail.
- Overview: add small execution intelligence totals, not a model-observability dashboard.

Console should not expose prompt text or hidden reasoning. Missing memory should render as unavailable, not as a fake explanation.

## Security Review

Preserved boundaries:

- Tenant identity comes from BetterAuth only.
- Body tenant override is rejected.
- Task and execution attachments are tenant-checked server-side.
- Agent references resolve through the tenant-scoped Agent Registry.
- Evidence Memory validation rejects prompt/chain-of-thought/secret markers before persistence.
- Execution Intelligence uses persisted execution records only.

Risks:

- String validation cannot prove a summary is semantically safe. It blocks known dangerous classes but cannot replace operator discipline and client-side redaction.
- Retention requires a cleanup job to enforce expiry physically, not only hide expired records at read time.
- Metrics from live task tables are correct but may become expensive at scale without rollups.

## Migration Plan

1. Apply migration `063_agent_evidence_memory.sql`.
2. Deploy additive API routes.
3. Add console read surfaces.
4. Add retention cleanup.
5. Add rollups only after measuring query load.

No backfill is required. Existing runs remain compatible because memory is optional and attached after the fact.

## Implementation Order

1. Foundation: schema, validation, create/list Evidence Memory API.
2. Foundation: read-only Execution Intelligence aggregate endpoint.
3. Console: run detail Evidence Memory view.
4. Console: agent/action reliability panels.
5. CLI/onboarding: `igris init claude-code` installs template, registers agent, installs starter pack, runs doctor, validates first run.
6. Provider packs: GitHub, Resend, Slack, Stripe, Postgres as standard Action Packs only.

## Risks

- Treating Evidence Memory as chat history would undermine positioning. Keep it summary-only.
- Treating Intelligence as LLM observability would pull the product toward model telemetry. Keep metrics tied to execution truth.
- Provider packs must not introduce special execution paths.
- One-command onboarding must not bypass registry, action gateway, idempotency, signed callbacks, recovery, or proof.

## Recommended Next PR

Build the console read path for the foundation APIs:

- Add Evidence Memory to run detail.
- Add `/v1/execution/intelligence` cards for agent/action reliability.
- Add tests proving the console does not render prompts, raw bodies, encrypted inputs, nonces, or secrets.
