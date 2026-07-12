# Igris private-alpha v0.1.0-alpha.2 — release note (candidate)

Status date: 2026-07-12
Branch: `release/igris-private-alpha-v0.1.0-alpha.2-candidate`
Base: `feature/igris-private-alpha-ci` tip
`40825a90028fc25752cd40934c0c14b9ab07af93` (descends from alpha.1 RC
`a60e399e35c032cb174b2b2e7a5719464e8bc31a`).

## Scope

Alpha.2 combines two completed, independently reviewed feature branches on
top of the secure alpha.1 CI baseline:

1. **Evidence privacy** (`feature/igris-evidence-privacy-preflight`, tip
   `fa2e8da61a353d9b1eecb9dbd055a3098ee4b8fe`) — local privacy classifier,
   `igris evidence inspect`, fail-closed sync preflight, one-shot
   `--allow-unredacted` acknowledgement, untrusted-error suppression.
   Independent security review: **GO** (commit `392750d01`, included).
2. **Existing-tool wrapping** (`feature/igris-existing-tool-wrapper`, tip
   `666ddb8e67db6de2baf4872a67782feb607332bb`) — `igris.wrap_tool` and
   `igris.wrap_tools` for callables that cannot be edited, including
   `async def` functions. Independent security review: **GO** (commit
   `b8a2e0a56`, included) — no merge blockers; accepted residuals are
   documented below and in the migration guide.

## Compatibility

- **No evidence protocol or backend API change.** ActionContract v1,
  evidence v1, canonical bytes, signatures, chain semantics, batch identity,
  and every HTTP request format are unchanged. Alpha.1 journals verify and
  sync byte-identically. No backend, migration, or workflow file changed.
- **Stricter sync behavior (deliberate).** `igris evidence sync` now refuses
  journals containing partially redacted or unknown decisions unless
  `--allow-unredacted` is passed for that single invocation, and exits with
  code 3 when acknowledgement is required. This is a client-side policy
  change only.
- **Framework-neutral wrapper only.** No framework adapters, no automatic
  tool discovery, no new dependencies (`cryptography>=42.0` remains the only
  runtime dependency).
- **Zero-network Embedded default unchanged.** Evidence upload remains
  explicit; there is no automatic upload and no background networking.
- **Rollback.** Downgrading to alpha.1 keeps all evidence valid; it removes
  `evidence inspect`, the privacy preflight, and `wrap_tool`/`wrap_tools`.

## New public APIs and typed errors

- `igris.wrap_tool`, `igris.wrap_tools`
- `igris.inspect_journal`, `igris.EvidencePrivacyReport`,
  `igris.PrivacyClassification`
- `igris.ToolWrapError`, `igris.EvidencePrivacyInspectionError`,
  `igris.EvidencePrivacyPreflightError`
- CLI: `igris evidence inspect`, `igris evidence sync --allow-unredacted`,
  exit code 3 (`EXIT_PRIVACY_ACK_REQUIRED`)

Details and migration steps: `sdk/python/docs/alpha-2-migration.md`,
`sdk/python/docs/evidence-privacy.md`,
`sdk/python/docs/wrapping-existing-tools.md`.

## Known limitations

- Default name-based redaction is an exact-name match against a small
  secret-like list; business parameters must be redacted explicitly.
  Redaction does not provide anonymity: action and parameter names,
  metadata, timestamps, type names, error summaries, and hashes can still
  disclose information.
- `@igris.guard` still rejects `async def` (use `wrap_tool`); generator and
  async-generator callables are rejected by both paths.
- Original callables are never mutated by wrapping, and already-guarded or
  already-wrapped callables cannot be wrapped again (`ToolWrapError`).
- Switching an action between decorator and wrapper declaration styles
  changes its `contract_hash` (function identity differs) and registers a
  new Connected contract version on first sync.
- Async cancellation propagates without fabricating an outcome event: the
  journal keeps the signed decision and remains verifiable.

## Validation summary

- Combined SDK suite (alpha.1 suite + privacy + wrapper + alpha.2
  integration tests) green; Ruff lint and format clean.
- Python matrix: see the integration report (real 3.10 / 3.11 / 3.12 / 3.13
  interpreters, versions asserted).
- Alpha.2 harness `scripts/ci/run_alpha2_harness.sh`: one decorated action,
  wrapped sync tools (fully redacted, retained, failing), one wrapped async
  tool → 11 signed events verified offline; `evidence inspect` exit 3;
  fail-closed refusal and one-shot acknowledgement proven against an
  in-process recording client with synthetic data only. The frozen alpha.1
  example and harness are unchanged.

### Known integration finding (merge precondition)

The backend-owned end-to-end test
`igris-overture/api/evidence_ingestion_e2e_test.go`
(`TestEvidenceIngestionEndToEndPythonSDK`) encodes alpha.1 ordering: its
fixture journal retains ordinary refund arguments, and it expects a missing
`IGRIS_API_KEY` configuration error. Under alpha.2 the privacy preflight
correctly refuses **before** configuration is read, so the private-alpha CI
`postgres` stage fails on this one assertion (the other three end-to-end
suites — contract sync, cross-slice evidence upload, redirect refusal — pass
against the real backend, confirming HTTP formats are unchanged). Backend
files are out of scope for this integration branch; before or alongside
merge, that test needs a follow-up in backend scope: pass
`--allow-unredacted` to its sync invocations (or redact the fixture
arguments) and update the step-2 assertion to the preflight refusal.

## Artifact hashes (deterministic, built twice)

Recorded in `docs/releases/private-alpha-2-artifact-hashes.md` alongside the
build-twice determinism check.

## Publication status

Not published. The `igris` / `igris-inertial` PyPI namespace collision
documented in `sdk/python/RELEASE.md` still blocks any public release. Both
independent security reviews (privacy: `392750d01`; wrapper: `b8a2e0a56`)
returned GO, so the candidate is unblocked for final merge review; merging
and tagging remain explicit operator decisions.
