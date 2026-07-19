# Igris Run Proof v1 — Stable API Semantics

**Schema:** `igris_run_proof.v1`  
**Product term:** Igris Run Proof  
**Scope:** Contract-bound durable runs only (Clock 3B/3C path)

This document describes the stable operator/API representation returned for a bound durable Igris run. It is **not** a new cryptographic protocol and does **not** unify Action Protocol Evidence with Runtime receipts.

## Endpoints

| Method | Path | Role |
|--------|------|------|
| `GET` | `/v1/actions/runs/:id` | Retrieve run detail + Igris Run Proof when bound |
| `POST` | `/v1/actions/runs/:id/evidence-links` | Append-only link of verified Embedded evidence |

Auth: BetterAuth tenant credential. All access is tenant-scoped.

## GET response (bound run)

Additive fields (Clock 3B fields retained):

```json
{
  "run_id": "<uuid>",
  "task_id": "<uuid>",
  "status": "completed",
  "proof_status": "verified",
  "execution_id": "<runtime execution id>",
  "contract_binding": {
    "binding_id": "<uuid>",
    "contract_hash": "<64 hex>",
    "target_action_id": "<uuid>",
    "target_version_hash": "<64 hex>",
    "business_idempotency_key": "<string>",
    "request_fingerprint": "<64 hex>"
  },
  "igris_run_proof": { "... see below ..." },
  "linked_proof": { "... backwards-compatible view ..." },
  "durable_execution_status": "completed",
  "managed_decision_status": "observed",
  "recovery_status": "completed",
  "run_linkage_status": "eligible_linked"
}
```

### `igris_run_proof` object

| Field | Meaning |
|-------|---------|
| `schema` | Always `igris_run_proof.v1` |
| `product_term` | `Igris Run Proof` |
| `run_id` / `task_id` | Durable run identity |
| `action_name` | Logical action name |
| `contract_hash` / `binding_id` | Exact contract binding identity |
| `target_action_id` / `target_version` | Executable target snapshot identity |
| `business_idempotency_key` | Business-effect idempotency identity |
| `request_fingerprint` | Server digest of binding + tool input |
| `tool_input_hash` | Canonical tool-input hash (matches Evidence `input_hash` when linkable) |
| `runtime_execution_id` | Runtime execution identity when known |
| `statuses` | Machine-readable status dimensions |
| `claim_boundary` | Explicit separation of claim types |
| `runtime_proof` | Runtime receipt claim (`claim_type: runtime_receipt`) |
| `action_protocol_evidence` | Evidence claim when linked (`claim_type: action_protocol_evidence`) |
| `recovery_lineage` | Recovery events for this run |
| `latest_runtime_handoff` | Latest handoff event if any |

### Status dimensions

| Key | Notes |
|-----|-------|
| `contract_binding_status` | Binding present for this run |
| `managed_decision_status` | Managed (Overture) authorization observation |
| `execution_status` | Durable run lifecycle |
| `recovery_status` | Recovery lineage observation — not application-level correctness |
| `runtime_proof_status` | Runtime receipt verification |
| `action_evidence_status` | Whether Evidence is linked |
| `action_evidence_verification_status` | Cryptographic verification of linked Evidence |
| `run_linkage_status` | Server eligibility of linked Evidence for **this** run |

## POST evidence-links

**Request:**

```json
{ "batch_id": "<uuid of verified Embedded batch>" }
```

**Success (201):** returns link id, run/task id, contract/binding, batch id, chain digest, `claim_type=action_protocol_evidence`, `run_linkage_status=eligible_linked`, `tool_input_hash`, `action_name`, `schema=igris_run_proof.v1`.

**Failure (409 `evidence_not_linkable`):** eligibility cannot be proven. Common causes:

- batch not verified Embedded for this tenant
- contract_hash / action_name / tool `input_hash` mismatch
- batch or chain already exclusively linked to another run
- bound-run tool identity cannot be reconstructed

## Eligibility rules (fail closed)

1. Tenant match  
2. Bound run exists  
3. Batch `evidence_state=verified`, `execution_provenance=embedded`  
4. Decision event: same `contract_hash`, same `action_name`, same `input_hash` as this run’s tool body  
5. Exclusive batch + chain ownership within tenant  

Evidence validity (hashes/signatures/chain) is established at ingest time. Run eligibility is a **separate** server claim.

## What operators must not infer

- Runtime receipt **does not** prove external side-effect uniqueness alone  
- Action Protocol Evidence **does not** prove managed Overture execution  
- Linked Igris Run Proof **does not** mean protocol-level cryptographic unification  
- `eligible_linked` is server-rule eligibility, not a frozen-protocol run_id bind  

## Backwards compatibility

Clients that only read Clock 3B `linked_proof.runtime_proof` / `action_protocol_evidence` / `claim_boundary` / `recovery_lineage` continue to work. Prefer `igris_run_proof` for new integrations.
