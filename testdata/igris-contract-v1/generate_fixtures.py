"""Generate Igris contract-v1 conformance fixtures from the REAL Embedded SDK.

Run from the repository root:

    cd sdk/python && uv sync --dev && \
      uv run python ../../testdata/igris-contract-v1/generate_fixtures.py

The script drives the actual `igris` package (sdk/python/src) — it does not
hand-author any JSON — so the fixtures are, by construction, what the SDK
emits. It uses a throwaway IGRIS_HOME: the ephemeral Ed25519 PRIVATE key is
generated, used for signing, and NEVER copied into the fixtures. Only the
public verification key is committed.

Outputs (all in this directory):
    action_contract.json      ActionContract for the fixture action
    journal.jsonl             5 events: approved decision + succeeded outcome,
                              denied decision, approved decision + failed outcome
    verify_key.pem            Ed25519 PUBLIC key that verifies journal.jsonl
    canonical/*.json          exact canonical unsigned-payload bytes for one
                              decision and one outcome event (byte-compare refs)
    expected.json             contract hash, per-event hashes, key_id, and the
                              SDK verifier's result at generation time

The secret value below is a fixture marker, not a real credential; the script
asserts it never appears in any emitted byte.
"""

from __future__ import annotations

import dataclasses
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

FIXTURE_DIR = Path(__file__).resolve().parent
REPO_ROOT = FIXTURE_DIR.parent.parent
SDK_SRC = REPO_ROOT / "sdk" / "python" / "src"

sys.path.insert(0, str(SDK_SRC))

FAKE_SECRET = "fixture-secret-value-NOT-A-REAL-CREDENTIAL"  # noqa: S105


def main() -> int:
    home = Path(tempfile.mkdtemp(prefix="igris-fixture-home-"))
    os.environ["IGRIS_HOME"] = str(home)

    import igris
    from igris.approval import ApprovalDecision
    from igris.identity import LocalSigningIdentity, load_public_key
    from igris.journal import event_digest, unsigned_payload
    from igris.verification import verify_journal

    class ScriptedProvider:
        def __init__(self, decisions: list[str]) -> None:
            self._decisions = decisions

        def decide(self, request):
            return ApprovalDecision(self._decisions.pop(0), "fixture-scripted decision")

    provider = ScriptedProvider(["allowed", "denied", "allowed"])

    @igris.guard(
        action="fixtures.customer.refund",
        risk="critical",
        approval="required",
        redact=["card_number"],
        metadata={"suite": "igris-contract-v1", "note": "ünïcode ✓ 日本語"},
        approval_provider=provider,
    )
    def refund_customer(customer_id: str, amount: int, api_key: str, card_number: str, memo: str):
        if customer_id == "cus_fail":
            raise RuntimeError(f"upstream rejected key {api_key} for mémo {memo}")
        return {"refunded": amount, "memo": memo}

    # 1. Approved decision + succeeded outcome (Unicode + redacted inputs).
    refund_customer("cus_ünïcode_001", 2500, FAKE_SECRET, "4111-1111-1111-1111", "café ☕ refund")
    # 2. Denied decision (no outcome may follow a denial).
    try:
        refund_customer("cus_denied_002", 1, FAKE_SECRET, "4111-1111-1111-1111", "denied path")
    except igris.ActionDenied:
        pass
    else:
        raise AssertionError("denial fixture did not raise ActionDenied")
    # 3. Approved decision + failed outcome (scrubbed error summary).
    try:
        refund_customer("cus_fail", 9, FAKE_SECRET, "4111-1111-1111-1111", "fäilure path")
    except RuntimeError:
        pass
    else:
        raise AssertionError("failure fixture did not raise")

    journal_path = home / "journal.jsonl"
    raw = journal_path.read_bytes()
    assert FAKE_SECRET.encode() not in raw, "fixture secret leaked into journal"
    assert b"4111-1111-1111-1111" not in raw, "caller-declared redaction leaked"

    events = [json.loads(line) for line in raw.decode("utf-8").splitlines() if line.strip()]
    assert [e["event_type"] for e in events] == [
        "decision",
        "outcome",
        "decision",
        "decision",
        "outcome",
    ]
    assert events[0]["decision"] == "allowed"
    assert events[1]["status"] == "succeeded"
    assert events[2]["decision"] == "denied"
    assert events[4]["status"] == "failed"

    identity = LocalSigningIdentity.load_or_create()
    public = load_public_key(identity.public_key_path)
    result = verify_journal(journal_path, public)
    assert result.valid, f"generated journal failed SDK verification: {result.issues}"

    contract = refund_customer.__igris_contract__
    contract_dict = dataclasses.asdict(contract)

    # Write fixtures. Private key stays in the throwaway home and is deleted.
    (FIXTURE_DIR / "canonical").mkdir(exist_ok=True)
    (FIXTURE_DIR / "action_contract.json").write_text(
        json.dumps(contract_dict, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (FIXTURE_DIR / "journal.jsonl").write_bytes(raw)
    shutil.copyfile(identity.public_key_path, FIXTURE_DIR / "verify_key.pem")

    for label, event in (("decision_approved", events[0]), ("outcome_succeeded", events[1])):
        payload = unsigned_payload(event)
        canonical = json.dumps(
            payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
        ).encode("utf-8")
        (FIXTURE_DIR / "canonical" / f"{label}.canonical.json").write_bytes(canonical + b"\n")
        assert event_digest(payload).hex() == event["event_hash"]

    expected = {
        "schema_version": "1",
        "contract_hash": contract.contract_hash,
        "key_id": identity.key_id,
        "public_key_fingerprint_sha256": identity.fingerprint,
        "event_hashes": [
            {"event_type": e["event_type"], "event_id": e["event_id"], "event_hash": e["event_hash"]}
            for e in events
        ],
        "verifier_result_at_generation": {
            "valid": result.valid,
            "events_verified": result.events_verified,
        },
        "hash_rule": "event_hash = SHA-256 hex of canonical JSON of the event without "
        "event_hash and signature (sorted keys, compact separators, ensure_ascii=false, UTF-8)",
        "signature_rule": "signature = base64(Ed25519.sign(raw 32-byte SHA-256 digest of the "
        "canonical unsigned payload))",
    }
    (FIXTURE_DIR / "expected.json").write_text(
        json.dumps(expected, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    shutil.rmtree(home)  # destroys the ephemeral private key
    print(f"fixtures written to {FIXTURE_DIR}")
    print(f"journal events: {len(events)}, verifier: valid={result.valid}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
