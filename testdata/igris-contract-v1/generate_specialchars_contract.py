"""Generate a special-character ActionContract fixture from the REAL SDK.

Run from the repository root:

    cd sdk/python && uv sync --dev && \
      uv run python ../../testdata/igris-contract-v1/generate_specialchars_contract.py

Companion to generate_fixtures.py (which is frozen — existing fixtures never
change). This script emits ONE additional file, action_contract_specialchars.json,
whose contract fields deliberately carry every canonicalization-interop risk
class inside string annotations: Unicode, `<`, `>`, `&`, double quotes,
backslash, and a newline control character. The Connected sync endpoint must
recompute exactly the SDK-embedded contract_hash for this contract; a Go
implementation that HTML-escapes `<`, `>`, `&` (encoding/json default) cannot.
"""

from __future__ import annotations

import dataclasses
import json
import sys
from pathlib import Path

FIXTURE_DIR = Path(__file__).resolve().parent
REPO_ROOT = FIXTURE_DIR.parent.parent
SDK_SRC = REPO_ROOT / "sdk" / "python" / "src"

sys.path.insert(0, str(SDK_SRC))

INTEROP_ANNOTATION = 'Annotated[str, "café ☕ 日本語 <b>&amp;</b> \\"quoted\\" back\\\\slash line1\\nline2"]'


def main() -> int:
    from igris.contracts import build_contract

    def transfer_funds(recipient, note):
        return {"recipient": recipient, "note": note}

    # String annotations pass through the SDK verbatim (PEP 563 style), so
    # they are the contract-native carrier for interop-risk characters.
    transfer_funds.__annotations__ = {
        "recipient": INTEROP_ANNOTATION,
        "note": 'café ☕ 日本語 <b>&amp;</b> "quoted" back\\slash line1\nline2',
    }

    contract = build_contract(
        transfer_funds,
        action="fixtures.specialchars.transfer",
        risk="high",
        approval="required",
    )
    contract_dict = dataclasses.asdict(contract)

    # The interop-risk characters must be present in the canonical bytes.
    from igris.canonical import canonical_json_bytes

    unsigned = {k: v for k, v in contract_dict.items() if k != "contract_hash"}
    canonical = canonical_json_bytes(unsigned)
    assert "café ☕ 日本語".encode() in canonical, "unicode coverage missing"
    assert b"<b>&amp;</b>" in canonical, "html-escape-risk coverage (< > &) missing"
    assert b'\\"quoted\\"' in canonical, "quoted-text coverage missing"
    assert b"back\\\\slash" in canonical, "backslash coverage missing"
    assert b"\\n" in canonical, "newline control-character coverage missing"

    out = FIXTURE_DIR / "action_contract_specialchars.json"
    out.write_text(
        json.dumps(contract_dict, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"wrote {out}")
    print(f"contract_hash: {contract.contract_hash}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
