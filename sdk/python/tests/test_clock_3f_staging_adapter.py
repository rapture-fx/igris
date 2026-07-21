from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType

import pytest


def load_adapter() -> ModuleType:
    root = Path(__file__).resolve().parents[3]
    path = root / "examples" / "clock_3f_staging_release_adapter.py"
    spec = importlib.util.spec_from_file_location("clock_3f_staging_release_adapter", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_strict_request_shape() -> None:
    adapter = load_adapter()
    ok = adapter.strict_request(
        b'{"service":"demo-api","environment":"disposable-staging","commit_sha":"'
        + (b"a" * 40)
        + b'"}'
    )
    assert ok["service"] == "demo-api"
    with pytest.raises(ValueError, match="missing fields"):
        adapter.strict_request(b'{"service":"demo-api"}')
    with pytest.raises(ValueError, match="unknown fields"):
        adapter.strict_request(
            b'{"service":"demo-api","environment":"disposable-staging",'
            b'"commit_sha":"' + (b"a" * 40) + b'","shell":"rm -rf /"}'
        )
    with pytest.raises(ValueError, match="shell metacharacters"):
        adapter.strict_request(
            b'{"service":"demo-api;rm","environment":"disposable-staging",'
            b'"commit_sha":"' + (b"a" * 40) + b'"}'
        )


def test_ledger_idempotent_and_conflict(tmp_path: Path) -> None:
    adapter = load_adapter()
    ledger = adapter.DurableLedger(tmp_path / "ledger.json")
    calls: list[str] = []
    result, replayed = ledger.execute(
        "deploy:demo-api:disposable-staging:" + ("a" * 40),
        "hash-a",
        lambda: calls.append("effect") or {"deployment_id": "dep_1"},
    )
    assert replayed is False
    assert calls == ["effect"]
    result2, replayed2 = ledger.execute(
        "deploy:demo-api:disposable-staging:" + ("a" * 40),
        "hash-a",
        lambda: calls.append("dup") or {"deployment_id": "wrong"},
    )
    assert replayed2 is True
    assert result2 == result
    assert calls == ["effect"]
    with pytest.raises(adapter.IdempotencyConflict):
        ledger.execute(
            "deploy:demo-api:disposable-staging:" + ("a" * 40),
            "hash-b",
            lambda: {"deployment_id": "wrong"},
        )


def test_orphan_refuses_replay(tmp_path: Path) -> None:
    adapter = load_adapter()
    ledger = adapter.DurableLedger(tmp_path / "ledger.json")
    ledger.mark_orphan_for_test("k1", "hash-a")
    calls: list[str] = []
    with pytest.raises(adapter.IdempotencyUnresolved):
        ledger.execute("k1", "hash-a", lambda: calls.append("x") or {})
    assert calls == []


def test_exception_marks_reconciliation(tmp_path: Path) -> None:
    adapter = load_adapter()
    ledger = adapter.DurableLedger(tmp_path / "ledger.json")
    with pytest.raises(adapter.ConsequentialEffectUncertain):
        ledger.execute("k1", "hash-a", lambda: (_ for _ in ()).throw(RuntimeError("boom")))
    snap = ledger.snapshot()
    assert snap["records"]["k1"]["state"] == "reconciliation_required"
    assert snap["effect_count"] == 0
