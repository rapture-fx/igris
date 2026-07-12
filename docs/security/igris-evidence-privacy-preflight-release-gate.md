# Release Gate — Evidence Privacy Preflight (`fa2e8da61`)

**Review type:** Final read-only security / privacy / compatibility / release gate  
**Date:** 2026-07-12  
**Reviewed tip:** `fa2e8da61a353d9b1eecb9dbd055a3098ee4b8fe` (`feature/igris-evidence-privacy-preflight`)  
**Base:** `c71bd8e609bbb2568ebf8280e48e0d6eae9b5d96` (private-alpha integration freeze)  
**Exact diff:** `c71bd8e60..fa2e8da61` — **13 files**, SDK-only (`sdk/python/**`)  
**Review branch:** `feature/igris-connected-evidence-security-gate` (docs only)  

## Recommendation

### **GO** for merging `fa2e8da61` as a follow-up private-alpha / alpha.2 PR

No merge blockers and no private-alpha blockers. The change is a **local, fail-closed privacy preflight** plus **value-free local inspect**, with explicit per-invocation acknowledgement. It does **not** alter ActionContract v1, evidence event schema v1, canonical bytes, hashes, signatures, chain/batch identity, HTTP envelope, backend APIs, `execution_provenance=embedded`, or explicit-only upload semantics.

Accepted residuals and non-blocking notes are listed in §7–§8.

---

## 1. Scope and commits

| Commit | Summary |
| --- | --- |
| `38b822716` | Local evidence privacy classifier |
| `74114d92f` | Sync preflight enforcement + CLI inspect / `--allow-unredacted` |
| `f6da47cc4` | Privacy documentation |
| `fa2e8da61` | Suppress untrusted sync error details / path leakage in errors |

**Changed files (13):**  
`evidence_privacy.py` (new), `evidence_sync.py`, `verification.py`, `errors.py`, `cli.py`, `__init__.py`, `README.md`, `docs/evidence-privacy.md`, `pyproject.toml`, `test_evidence_privacy.py` (new), `test_evidence_sync.py`, `test_cli.py`, `test_release_metadata.py`.

**Not changed:** backend, migrations, contract sync, guard automatic network behavior, legacy SDK, production.

---

## 2. Required control matrix

| Control | Result | Evidence |
| --- | --- | --- |
| Inspect verifies journal before analysis | **VERIFIED** | `inspect_journal` → `load_journal_snapshot` then classify |
| Inspect zero DNS/socket/urllib/HTTP | **VERIFIED** | Code path local-only; `test_cli_is_local_only_value_free_and_byte_preserving` monkeys `getaddrinfo`/`Request`/`urlopen` |
| Never rewrite journal or keys | **VERIFIED** | Byte equality before/after inspect and refused sync |
| Never print argument values / credentials / key material / response bodies / transport reasons / absolute paths | **VERIFIED** | Privacy report holds names+classifications only; path-free errors; detail suppression in `_error_for_status` / `_scrubbed_reason`; tests assert values and paths absent |
| Bounded classifications, counts, action names, retained parameter names only | **VERIFIED** | CLI `_cmd_evidence_inspect` + report dataclasses |
| Deterministic `fully_redacted` / `partially_redacted` / `no_arguments` / `unknown` | **VERIFIED** | `_classify_summary` + tests (unicode, unsupported, malformed) |
| Classification uses only signed `redacted_input_summary` | **VERIFIED** | Decision events only; exact re-parse via `bounded_summary` round-trip |
| Partial/unknown blocks sync before config/client/DNS/HTTP | **VERIFIED** | Privacy check precedes `load_evidence_sync_config` / client construction; `RecordingClient.calls==[]`; CLI without env still exit 3 |
| `EvidencePrivacyPreflightError`: `execution_occurred=False`, `retry_safe=True`, `error_code=evidence_privacy_acknowledgement_required`, CLI exit **3** | **VERIFIED** | `errors.py`, `EXIT_PRIVACY_ACK_REQUIRED=3`, tests |
| Tampered/invalid journal fails separately (exit 1 / validation path) | **VERIFIED** | Inspect/sync local verification first; tamper test exit 1 |
| `--allow-unredacted` per-invocation only; no env/config persistence | **VERIFIED** | `action="store_true"` only; no env reader; second sync without flag fails |
| Ack does not suppress auth/redirect/chain/idempotency/server failures | **VERIFIED** | Ack only bypasses privacy gate; existing HTTP error paths unchanged except detail scrubbing |
| Ack sends byte-identical events vs original journal | **VERIFIED** | `test_acknowledgement_uploads_unchanged_events_for_current_call_only` |
| Fully redacted / no-arg sync without override | **VERIFIED** | `test_fully_redacted_and_no_argument_journal_syncs_without_override` |
| Protocol/schema/provenance/explicit-upload unchanged | **VERIFIED** | SDK-only delta; no Go API changes; conformance green |
| Residual disclosure channels documented honestly | **VERIFIED** | `docs/evidence-privacy.md` §privacy limitations + README |
| Large/hostile journal / unicode / malformed / nested / multi-action | **VERIFIED** (unit) | 501-event journal; unicode param name; unsupported/malformed unknown; multi-action mixed journal |
| Suppressing untrusted endpoint detail / transport reasons | **ACCEPTABLE** | Typed `error_code`/`status_code` retained; operators lose free-text `detail` and OS errno text — intentional privacy/safety tradeoff (see §6) |

---

## 3. Compatibility impact

| Surface | Impact |
| --- | --- |
| ActionContract v1 / event schema v1 / canonicalization | **None** |
| Batch identity / HTTP body shape | **None** (same events when allowed or acknowledged) |
| Guard / Embedded zero-network default | **None** (guard does not call evidence sync) |
| Public typed errors | **Additive** `EvidencePrivacyPreflightError` / `EvidencePrivacyInspectionError` |
| Sync error **message strings** | **Narrowing** — server `detail` and transport reason strings no longer interpolated (status + stable codes remain). Callers matching substrings of remote `detail` may break; callers using `error_code` / `status_code` remain compatible. |
| Default `igris evidence sync` behavior | **Stricter** for journals with retained ordinary args or unknown summaries (fail closed with exit 3) — intentional product hardening for alpha.2 |

---

## 4. Test execution (this review)

Implementation worktree read-only:  
`/Users/wira/Desktop/system-worktrees/igris-evidence-privacy-preflight` @ `fa2e8da61`.

| Suite | Result |
| --- | --- |
| `uv run --python 3.10 pytest -q` | **190 passed** |
| `uv run --python 3.11 pytest -q` | **190 passed** |
| `uv run --python 3.12 pytest -q` | **190 passed** |
| `uv run --python 3.13 pytest -q` | **190 passed** |
| `ruff check .` / `ruff format --check .` | **All checks passed** / format OK |
| `uv build` wheel + sdist | **OK** (`igris-0.1.0`) |
| Clean wheel install + `igris evidence --help` + `uv pip check` | **OK** (`inspect` listed) |
| Clean sdist install + import | **OK** |
| Wheel contains `evidence_privacy` module; sdist includes `docs/evidence-privacy.md` | **OK** |
| `go test ./conformance/contractv1/ ./igris-overture/internal/canonicaljson/` | **ok** (unchanged backend) |

No production contact, no package publication, no migrations applied.

---

## 5. Design notes of security interest

### 5.1 Preflight ordering (correct)

```text
load public key → load_journal_snapshot (verify) → inspect_verified_snapshot
  → if unsafe and not allow_unredacted: raise PreflightError
  → else load_evidence_sync_config / client → HTTP
```

Configuration and network are unreachable when privacy refuses.

### 5.2 Snapshot integrity

`load_journal_snapshot` returns verified events used for both privacy and upload, avoiding TOCTOU between verify and re-read of journal bytes.

### 5.3 Classifier conservatism

Unknown for truncated (`...(truncated)`), non-identifier keys, unsorted names, non-round-tripping summaries, unsupported-type placeholders, non-string summaries. Partial redaction whenever any top-level value is not exactly `<REDACTED>`.

### 5.4 Acknowledgement semantics

CLI flag only; not env-backed; does not rewrite journals; only disables the local policy gate for that process call.

---

## 6. Diagnosability of error-detail suppression

Commit `fa2e8da61` removes:

- HTTP response `detail` from validation/conflict messages  
- Stringified transport `reason` (keeps exception type name only)  
- Absolute journal/key paths from some local failure messages  

**Assessment:** Material reduction in leakage of untrusted server text and filesystem layout. Status codes and snake_case `error_code` remain. For private alpha this is **acceptable**. Operators needing remote detail should use server logs / status API, not client exception strings. **Not** a merge blocker.

---

## 7. Finding classification

| Finding | Class |
| --- | --- |
| None of Critical/High defects found | — |
| Residual disclosure of action names, parameter names, timestamps, hashes, type names, sanitized errors, metadata | **Accepted residual** (documented; not anonymity) |
| Input hashes may leak low-entropy values under offline guessing | **Accepted residual** (documented) |
| Endpoint free-text / transport reason suppressed | **Accepted residual** / intentional hardening |
| Full journal loaded into memory for inspect/sync | **Production-hardening** (fine for alpha journals; quota/streaming later) |
| `retry_safe=True` on privacy preflight | **Accepted residual** (safe for re-run of sync CLI with policy fix/ack; does **not** mean re-run guarded action) |
| Stricter default sync vs pre-preflight journals with ordinary args | **Intended behavior** for alpha.2 — document in release notes |

### Merge blockers

**None.**

### Private-alpha blockers

**None.**

### Documentation issues

**None blocking.** Privacy doc + README are clear. Recommend alpha.2 release notes call out: (1) default sync refusal for partially redacted/unknown journals; (2) exit code 3; (3) message-string narrowing for HTTP details.

### Production-hardening items

1. Streaming/chunked privacy analysis for multi-MB journals.  
2. Optional metrics for preflight refuse rates (without values).  
3. Consider aligning contract-sync error scrubbing with the same detail policy for consistency.

---

## 8. Accepted privacy residuals (explicit)

1. Evidence v1 is **not anonymous**; redaction is value-marker based, not identity-erasing.  
2. Action/parameter names and counts are intentionally visible to operators.  
3. Hashes, type names, sanitized exception text, and timestamps remain in journals and may upload when policy allows or is acknowledged.  
4. Built-in secret name redaction is incomplete for business fields unless listed in `redact=[...]`.  
5. `--allow-unredacted` is a deliberate disclosure valve; abuse is operational, not a crypto bypass.  
6. Local verification proves integrity vs selected public key, not host trustworthiness.

---

## 9. GO conditions

**GO** means:

1. Implementation branch `fa2e8da61` may merge into the private-alpha line (e.g. onto `c71bd8e60` / release branch) as alpha.2 privacy follow-up.  
2. No further code remediations required by this review before merge.  
3. Release notes should mention default preflight refusal + exit code 3 + inspect command.  
4. Does **not** authorize public PyPI publication or Managed-provenance claims.

---

## 10. Hygiene

| Subject | Status |
| --- | --- |
| Implementation branch `feature/igris-evidence-privacy-preflight` | **Untouched** (read-only) |
| Release / Agent I CI / Agent J bootstrap / Agent K wrapper | **Untouched** |
| Backend, migrations, legacy `igris-python-sdk` | **Untouched** |
| Production / credentials | **Untouched** |
| This review commit | Security document only on gate branch |

---

## 11. Document control

| Field | Value |
| --- | --- |
| Base | `c71bd8e609bbb2568ebf8280e48e0d6eae9b5d96` |
| Reviewed | `fa2e8da61a353d9b1eecb9dbd055a3098ee4b8fe` |
| Decision | **GO** |
| Relation to prior gates | Complements private-alpha CONDITIONAL GO by closing the ordinary-argument upload residual for **default** sync (opt-in ack remains) |
