# Release Gate — Existing Tool Wrapper (`igris.wrap_tool`)

**Review type:** Final read-only security / API-compatibility / evidence-integrity gate  
**Date:** 2026-07-12  
**Reviewed tip:** `666ddb8e67db6de2baf4872a67782feb607332bb` (`feature/igris-existing-tool-wrapper`)  
**Exact base:** `a60e399e35c032cb174b2b2e7a5719464e8bc31a`  
**Diff:** `a60e399e35..666ddb8e6` — 10 files, SDK-only  
**Reviewer role:** Principal Python SDK, async-runtime, API-compatibility, evidence-integrity, application-security  

## Recommendation

### **GO** for merging `666ddb8e6` as an alpha.2 / private-alpha follow-up PR

No merge blockers and no private-alpha blockers. The feature reuses the existing guard engine helpers for redaction, Connected sync, approval, and signed evidence without mutating originals, without automatic network activity, and without Managed provenance.

Accepted residuals (maintainability, async asymmetry, contract_hash identity divergence, BaseException/cancellation) are **not** release blockers when documented in release notes.

---

## 1. Commits reviewed

| Commit | Summary |
| --- | --- |
| `7efdf99b4` | `wrap_tool` / `wrap_tools` implementation |
| `f498fe16e` | Equivalence, compatibility, collection, security tests |
| `666ddb8e6` | Guide, framework-neutral example, sdist inclusion |

**Changed files:** `wrap_tool.py` (new), `contracts.py`, `errors.py`, `__init__.py`, `README.md`, `docs/wrapping-existing-tools.md`, `examples/tool-wrapping/…`, `pyproject.toml`, `test_wrap_tool.py`, `test_release_metadata.py`.

---

## 2. Orchestration comparison: `@igris.guard` vs `wrap_tool`

| Step | `@igris.guard` | `wrap_tool` (sync / async) | Assessment |
| --- | --- | --- | --- |
| Argument binding | `inspect.signature` + bind/defaults | Same | **Equivalent** |
| Connected contract sync | `resolve_connected_client` → `ensure_contract_synced` | Same | **Equivalent** |
| Redaction / sensitive collection | `redact_arguments` + `collect_sensitive_raw_values` | Same | **Equivalent** |
| Canonicalize + hash + summary | `to_canonical` / `sha256_hex` / `bounded_summary` | Same | **Equivalent** |
| Identity | `LocalSigningIdentity.load_or_create` or inject | Same | **Equivalent** |
| Approval | `_evaluate_approval` | Same | **Equivalent** |
| Decision event append | `_append_event` DECISION | Same | **Equivalent** |
| Denial | `ActionDenied` before invoke | Same | **Equivalent** |
| Invoke original | direct call | direct / `await` | **Equivalent** (async path only on wrap) |
| Outcome on success/fail | `_record_outcome_or_raise` | Same | **Equivalent** |
| Evidence-write failure | `ExecutionCompletedEvidenceError` via helper | Same | **Equivalent** |
| Exception propagation | re-raise after failed outcome | Same (`except Exception`) | **Equivalent** |
| Zero-network Embedded | no client when unset | Same; tests force fail socket | **Equivalent** |
| Generator rejection | decoration-time `UnsupportedFunctionError` | wrap-time `ToolWrapError` | **Equivalent policy** |
| Async support | **Rejected** at `build_contract` | **Allowed** via `_build_contract_unchecked` + async wrapper | **Documented asymmetry** |
| Code structure | single decorated wrapper body | `_make_sync_wrapper` / `_make_async_wrapper` mirror guard helpers | **Accepted maintainability residual** (not alpha.2 blocker) |

**Mirrored orchestration residual:** Sync and async wrappers duplicate the same ordered steps rather than sharing one internal engine function. Behavior is covered by equivalence tests. Treat as **accepted maintainability residual**, not a security or correctness blocker.

---

## 3. Control matrix

| Control | Result | Evidence |
| --- | --- | --- |
| Sync function wrap + execute | **VERIFIED** | equivalence / plain sync tests |
| Async function wrap + execute + denial + failure | **VERIFIED** | `test_async_function*` |
| Bound methods / staticmethod attribute / partials / callable objects / async callable | **VERIFIED** | category tests |
| Generators / async generators rejected | **VERIFIED** | ToolWrapError tests |
| Already-guarded / already-wrapped rejected | **VERIFIED** | tests |
| Missing-signature / non-callable → ToolWrapError | **VERIFIED** | non-callable test; signature path raises ToolWrapError |
| Metadata + `inspect.signature` preservation | **VERIFIED** | tests |
| Original callable immutability | **VERIFIED** | `test_original_callable_unchanged` |
| Mapping/sequence collection; no input mutation | **VERIFIED** | wrap_tools tests |
| Duplicate action rejection | **VERIFIED** | `test_duplicate_action_names_rejected` |
| Deterministic ordering | **VERIFIED** | sequence order test |
| ToolWrapError stability + exports in `__all__` | **VERIFIED** | API surface tests |
| No raw args / private key in repr | **VERIFIED** | security tests |
| Explicit-only evidence upload | **VERIFIED** | `test_no_automatic_evidence_upload` |
| No managed provenance assignment | **VERIFIED** | `test_wrapper_cannot_set_managed_provenance` |
| Semantic contract equivalence (decorator vs wrap) | **VERIFIED** | allowed/denied/redaction equivalence |
| `contract_hash` may diverge (module/QN/fingerprint) | **DOCUMENTED residual** | tests + guide |
| Zero-network without Connected config | **VERIFIED** | socket guard + explicit hidden-network test |
| Connected sync hook reuse | **VERIFIED** | `test_connected_sync_reuses_engine` |
| Guard still rejects async decoration | **VERIFIED** | unchanged `build_contract` path |

---

## 4. Async assessment

- **`wrap_tool` async:** Supported; wrapper is `async def`, awaits original after decision evidence, records outcomes like sync path.
- **`@igris.guard` async:** Still rejected at decoration via `build_contract` — intentional product asymmetry for this version.
- **CancelledError / BaseException:** Both paths only catch `Exception` around the original invoke. `asyncio.CancelledError` (BaseException hierarchy) will not record a failed outcome; same class of residual as uncaught `KeyboardInterrupt` on sync. **Accepted residual** — document that cancellation may leave decision-without-outcome (process-interrupt semantics).

**Not an alpha.2 blocker** if release notes state: “`wrap_tool` supports async callables; `@igris.guard` does not yet.”

---

## 5. API compatibility

| Surface | Impact |
| --- | --- |
| Existing `@igris.guard` | **Unchanged** behaviorally (contracts still reject async/generators) |
| New public API | `wrap_tool`, `wrap_tools`, `ToolWrapError` exported |
| Evidence v1 / Connected contract schema | **Unchanged** |
| Semantic action identity | Action name / risk / approval / redaction equivalent; **contract_hash** may differ due to function identity fields |

---

## 6. Tests executed (this review)

Worktree: `/Users/wira/Desktop/system-worktrees/igris-existing-tool-wrapper` @ `666ddb8e6` (read-only).

| Suite | Result |
| --- | --- |
| `uv run --python 3.10 pytest -q` | **221 passed** |
| `uv run --python 3.11 pytest -q` | **221 passed** |
| `uv run --python 3.12 pytest -q` | **221 passed** |
| `uv run --python 3.13 pytest -q` | **221 passed** |
| `ruff check` / `ruff format --check` | **pass** |
| `uv build` wheel + sdist | **pass** |
| Import smoke (`wrap_tool`, `wrap_tools`, `ToolWrapError`) | **pass** |
| `go test ./conformance/contractv1/` | **ok** (protocol unchanged) |

No production contact; no package publish.

---

## 7. Findings classification

| Finding | Class |
| --- | --- |
| None Critical | — |
| Duplicated sync/async wrapper bodies | **Accepted residual** (maintainability) |
| Async allowed only on wrap_tool | **Accepted residual** (document) |
| `contract_hash` divergence vs decorator | **Accepted residual** (semantic equivalence only) |
| BaseException / cancel may skip failed outcome | **Accepted residual** (shared with Exception-only guard style) |
| Descriptors / exotic bound builtins | **Partially covered** — staticmethod after access tested; arbitrary C builtins without signature fail closed via ToolWrapError |

### Merge / private-alpha blockers

**None.**

### Required release notes

1. New APIs: `igris.wrap_tool`, `igris.wrap_tools`, `ToolWrapError`.  
2. Async supported on wrap path only; decorator still rejects async.  
3. Contracts are semantically equivalent; `contract_hash` may differ by callable identity.  
4. Original callables are never mutated; already-guarded tools cannot be double-wrapped.

---

## 8. Hygiene

| Subject | Status |
| --- | --- |
| Implementation branch | **Untouched** |
| Backend / migrations / legacy SDK / production | **Untouched** |

## Document control

| Field | Value |
| --- | --- |
| Base | `a60e399e35c032cb174b2b2e7a5719464e8bc31a` |
| Reviewed | `666ddb8e67db6de2baf4872a67782feb607332bb` |
| Decision | **GO** |
