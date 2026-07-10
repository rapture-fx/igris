# Connected First Slice — Automatic ActionContract Synchronization Only

Status: implementation plan. Nothing in this document is implemented.

## Scope fence

The first Connected vertical slice is **contract synchronization and lookup**
(`POST /v1/contracts/sync`, `GET /v1/contracts/actions/...` — spec:
`igris-connected-api-v1.md` §1–2) and nothing else:

- **No evidence ingestion.** No journal upload, no key registration.
- **No remote approval.** Local `ApprovalProvider` semantics unchanged.
- **No managed dispatch.** No path from a synced contract to
  `TaskCoordinator.Submit`.
- No console UI beyond whatever already renders `action_definitions` rows
  (synced logical actions will appear there naturally via `origin`).
- Embedded guard behavior is byte-for-byte unchanged; sync is a separate,
  explicit, user-invoked flow.

Why this slice first: it exercises the whole new spine — tenant-scoped
auth → validation → fingerprint recomputation → immutable version storage →
idempotency/conflict semantics — with a pure, retry-safe, content-keyed write
and zero risk to execution paths.

## Backend changes (exact files, expected)

| File | Change |
| --- | --- |
| `igris-overture/database/migrations/0XX_action_contract_versions.sql` (new; verify next free number and prod state first) | `action_contract_versions` table + `action_definitions.origin` column, per `igris-connected-data-impact.md` §3. Written in the slice, applied per the normal migration runbook — never auto-applied. |
| `igris-overture/api/routes_contracts.go` (new) | `RegisterContractRoutes(app, db)`; handlers for sync + the two lookups; BetterAuth group; validation order from the API spec; canonical-JSON fingerprint recomputation. |
| `igris-overture/api/routes_contracts_test.go` (new) | Full handler coverage (list below). |
| `igris-overture/coordinator/contract_store.go` (new) or `igris-overture/api/contract_store.go` | INSERT/SELECT-only store: `InsertVersion`, `GetVersion`, `ListVersions`, `EnsureLogicalAction`. Follow `checkpoint_store.go` placement conventions — decide during implementation; no UPDATE statements. |
| `igris-overture/api/route_manifest.go` + `api/testdata/route_manifest.default.json` | Add the three routes with `RegistrationSource: "RegisterContractRoutes"`. |
| `igris-overture/api/route_surface_test.go` | Classify `RegisterContractRoutes` as core public product API. |
| `cmd/igris-overture/main.go` (or wherever sibling `RegisterXRoutes` calls live — verify at implementation time) | Wire `RegisterContractRoutes`. |

Go canonical-JSON note: Go's `encoding/json` marshals maps with sorted keys
and does not escape non-ASCII by default, but it HTML-escapes `<`, `>`, `&`
unless the encoder sets `SetEscapeHTML(false)`. The fingerprint recomputation
MUST use an encoder with HTML escaping disabled and compact output to match
Python's `ensure_ascii=false` + compact separators. **This exact pitfall is
what the conformance fixtures exist to catch** — a unit test must reproduce
`testdata/igris-contract-v1/expected.json`'s `contract_hash` from
`action_contract.json`.

## SDK interfaces to be added later (NOT in this slice, NOT in this repo-area now)

Owned by the SDK/hardening track when the time comes; recorded here as
compatibility requirements, not edits:

- `igris connect` / `igris sync` CLI subcommands (explicit, user-invoked; the
  guard never syncs implicitly).
- A `ContractSyncClient` behind a small protocol, configured via
  `IGRIS_API_URL` / `IGRIS_API_KEY`; reads contracts from decorated functions
  (`__igris_contract__` is already exposed by the guard — implemented today).
- No new guard parameters required for this slice.

## Required tests (backend)

Handler/store tests (httptest + SQL fake or the repo's existing test DB
patterns, mirroring `routes_actions_test.go`):

1. Sync without auth → 401; body `tenant_id` is ignored (tenant comes from
   auth context).
2. First sync creates logical action (`origin=sdk_sync`) + version → 201,
   `created: true`, `execution_permission: false`.
3. Re-sync same `(tenant, name, hash)` → 200, `created: false`, no new row.
4. New hash for same action → 201, second version; first version unchanged
   (immutability assertion: SELECT returns original bytes).
5. `contract_hash` mismatch (client lies about hash) → 422, nothing stored.
6. Security-sensitive delta (`required→never`, risk lowered) → flagged in
   response and on the row.
7. Same `Idempotency-Key` + same fingerprint → replayed response; +different
   fingerprint → 409 `idempotency_key_conflict` (skip if header deferred —
   then natural idempotency tests 3–4 are the required minimum).
8. Cross-tenant: tenant B cannot read or collide with tenant A's action of
   the same name (404 on lookup; both can own `customer.refund`).
9. Manual-action name collision → version attaches, `origin_divergence: true`.
10. Unknown `schema_version` → 422. Oversized body → 413.
11. **Conformance fixture test**: recompute `contract_hash` from
    `testdata/igris-contract-v1/action_contract.json` in Go and match
    `expected.json`; sync the fixture contract end-to-end through the
    handler.
12. Route manifest and route-surface tests updated and passing (proves
    intentional route exposure).

## Migration requirements

Exactly one migration (table + additive column), per the data-impact doc.
Optional `contract_sync_idempotency` table only if the header ships in this
slice — recommendation: **defer the header**, ship natural content
idempotency first (retry-safe without it), add the header table when the SDK
client lands and needs response replay.

## Rollout and backward-compatibility risks

- Migration must be applied manually per the existing runbook (repo memory:
  migrations are never auto-applied; prod state of recent migrations must be
  re-verified first).
- Route manifest guard will fail CI if routes are added without updating the
  manifest — this is the intended safety net, not an obstacle.
- Manual `/v1/actions` flow untouched; `origin` default `'manual'` keeps all
  existing rows and PATCH semantics identical.
- Name-collision behavior (manual action + SDK sync) is additive but
  user-visible; document it in the API reference when implemented.
- The Go↔Python canonical-JSON mismatch is the highest-probability defect;
  it is fenced by fixture test #11.
- No SDK release depends on this slice; the backend can ship dark (routes
  live, no callers) since sync grants nothing.

## Acceptance criteria for the slice

1. All 12 test groups above pass; `make sdk-python-test` and the existing
   `go test ./igris-overture/api ./igris-overture/coordinator` suites stay
   green.
2. A contract synced twice produces exactly one version row; a changed
   contract produces exactly two; history is provably immutable.
3. The fixture contract from `testdata/igris-contract-v1/` round-trips
   through the real handler with a Go-recomputed hash equal to the SDK's.
4. No route exists outside the updated manifest; no endpoint accepts a
   body-supplied tenant; no endpoint grants execution permission.
5. No SDK file modified; no evidence/approval/dispatch code paths touched.
