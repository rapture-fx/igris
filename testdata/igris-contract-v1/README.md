# Igris contract-v1 conformance fixtures

Protocol reference fixtures for the Embedded Igris SDK's action contract and
evidence event formats (schema version `1`). **These are protocol references,
not proof that backend ingestion exists** — no Connected ingestion endpoint is
implemented as of 2026-07-10.

## What is here

| File | Content |
| --- | --- |
| `action_contract.json` | The `ActionContract` the SDK derived for the fixture action `fixtures.customer.refund` (`execution_mode: embedded`, `contract_hash` included). |
| `journal.jsonl` | A real SDK journal with 5 events: approved decision → succeeded outcome, denied decision (no outcome follows a denial), approved decision → failed outcome. Inputs include Unicode (`ünïcode ✓ 日本語`, `café ☕`) and redacted values (built-in `api_key` + caller-declared `card_number`). |
| `verify_key.pem` | The Ed25519 **public** key that verifies `journal.jsonl`. |
| `canonical/*.canonical.json` | Exact canonical unsigned-payload bytes (sorted keys, compact separators, `ensure_ascii=false`, UTF-8) for one decision and one outcome — byte-comparison references for backend implementers. |
| `expected.json` | `contract_hash`, `key_id`, public-key fingerprint, per-event `event_hash` values, hash/signature rules, and the SDK verifier result at generation time. |
| `generate_fixtures.py` | The generator. Fixtures are produced by the real SDK, never hand-written. |

## How they were generated

```bash
cd sdk/python && uv sync --dev && \
  uv run python ../../testdata/igris-contract-v1/generate_fixtures.py
```

The generator runs `@igris.guard` against a throwaway `IGRIS_HOME`, asserts
that the fixture "secret" and card number never appear in any emitted byte,
verifies the journal with `igris.verification.verify_journal`, copies out the
journal and the **public** key only, and deletes the ephemeral private key.
Regenerating produces a new key, new UUIDs, new timestamps, and therefore new
hashes — fixtures are a point-in-time snapshot; `expected.json` is rewritten
to match.

To re-verify the committed fixtures with the SDK's public CLI:

```bash
cd sdk/python && uv run igris verify ../../testdata/igris-contract-v1/journal.jsonl \
  --public-key ../../testdata/igris-contract-v1/verify_key.pem
```

Verified at generation time: exit 0, `5 event(s) verified`.

## Security notes

- No private key is committed. The signing key existed only in a temp
  directory during generation and was deleted.
- `fixture-secret-value-NOT-A-REAL-CREDENTIAL` and the test card number are
  markers; the journal proves they are redacted (`<REDACTED>`), not stored.
- The failed outcome's `sanitized_error_summary` demonstrates secret
  scrubbing of exception text.
