from __future__ import annotations

import importlib.util
import json
from pathlib import Path
from types import ModuleType

import pytest


def load_adapter() -> ModuleType:
    root = Path(__file__).resolve().parents[3]
    path = root / "examples" / "clock_3b_contract_bound_adapter.py"
    spec = importlib.util.spec_from_file_location("clock_3b_contract_bound_adapter", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_strict_request_rejects_missing_extra_and_wrong_types() -> None:
    adapter = load_adapter()
    assert adapter.strict_request(b'{"account_id":"acct-1","amount_cents":2500}') == {
        "account_id": "acct-1",
        "amount_cents": 2500,
    }
    with pytest.raises(ValueError, match="missing fields"):
        adapter.strict_request(b'{"account_id":"acct-1"}')
    with pytest.raises(ValueError, match="unknown fields"):
        adapter.strict_request(b'{"account_id":"acct-1","amount_cents":1,"extra":true}')
    with pytest.raises(ValueError, match="amount_cents must be an integer"):
        adapter.strict_request(b'{"account_id":"acct-1","amount_cents":"2500"}')


def test_durable_ledger_replays_identical_and_conflicts_on_payload_change(tmp_path: Path) -> None:
    adapter = load_adapter()
    ledger = adapter.DurableLedger(tmp_path / "ledger.json")
    calls: list[str] = []

    result, replayed = ledger.execute(
        "business-1",
        "hash-a",
        lambda: calls.append("effect") or {"status": "ok"},
    )
    assert result == {"status": "ok"}
    assert replayed is False
    assert calls == ["effect"]

    result, replayed = ledger.execute(
        "business-1",
        "hash-a",
        lambda: calls.append("duplicate") or {"status": "wrong"},
    )
    assert result == {"status": "ok"}
    assert replayed is True
    assert calls == ["effect"]

    with pytest.raises(adapter.IdempotencyConflict):
        ledger.execute("business-1", "hash-b", lambda: {"status": "wrong"})

    snapshot = json.loads((tmp_path / "ledger.json").read_text())
    assert snapshot["endpoint_invocation_count"] == 1
    assert snapshot["effect_count"] == 1
