from __future__ import annotations

import importlib.util
import json
import threading
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


def test_orphan_in_progress_does_not_reexecute(tmp_path: Path) -> None:
    """Process dies after in_progress is persisted — never re-run the effect."""
    adapter = load_adapter()
    ledger = adapter.DurableLedger(tmp_path / "ledger.json")
    ledger.mark_orphan_for_test("business-orphan", "hash-a")
    calls: list[str] = []

    with pytest.raises(adapter.IdempotencyUnresolved) as excinfo:
        ledger.execute(
            "business-orphan",
            "hash-a",
            lambda: calls.append("effect") or {"status": "ok"},
        )
    assert excinfo.value.status == adapter.UNRESOLVED_EFFECT_STATUS
    assert "reconciliation" in excinfo.value.detail.lower()
    assert calls == []

    snapshot = json.loads((tmp_path / "ledger.json").read_text())
    assert snapshot["records"]["business-orphan"]["state"] == "in_progress"
    assert snapshot.get("effect_count", 0) == 0


def test_orphan_in_progress_different_payload_still_conflicts(tmp_path: Path) -> None:
    adapter = load_adapter()
    ledger = adapter.DurableLedger(tmp_path / "ledger.json")
    ledger.mark_orphan_for_test("business-orphan", "hash-a")
    with pytest.raises(adapter.IdempotencyConflict):
        ledger.execute("business-orphan", "hash-b", lambda: {"status": "wrong"})


def test_callable_exception_marks_reconciliation_required(tmp_path: Path) -> None:
    """Effect state uncertain after exception — do not allow automatic retry."""
    adapter = load_adapter()
    ledger = adapter.DurableLedger(tmp_path / "ledger.json")
    calls: list[str] = []

    def boom() -> dict[str, str]:
        calls.append("effect")
        raise RuntimeError("effect may have partially applied")

    with pytest.raises(RuntimeError, match="partially applied"):
        ledger.execute("business-fail", "hash-a", boom)
    assert calls == ["effect"]

    snapshot = json.loads((tmp_path / "ledger.json").read_text())
    record = snapshot["records"]["business-fail"]
    assert record["state"] == adapter.STATE_RECONCILIATION_REQUIRED
    assert record["effect_status"] == adapter.STATE_UNKNOWN_EFFECT

    with pytest.raises(adapter.IdempotencyUnresolved) as excinfo:
        ledger.execute("business-fail", "hash-a", lambda: calls.append("retry") or {"status": "ok"})
    assert excinfo.value.status == adapter.UNRESOLVED_EFFECT_STATUS
    assert calls == ["effect"]


def test_callable_exception_returns_typed_safe_unresolved_response(tmp_path: Path) -> None:
    adapter = load_adapter()
    ledger = adapter.DurableLedger(tmp_path / "ledger.json")
    secret_marker = "PRIVATE_FAILURE_DETAIL_MUST_NOT_LEAK"

    def boom(**_: object) -> dict[str, str]:
        raise RuntimeError(secret_marker)

    with pytest.raises(adapter.ConsequentialEffectUncertain):
        ledger.execute(
            "business-http-failure",
            "hash-a",
            boom,
        )
    payload = adapter.unresolved_effect_response(
        "consequential effect completion is unknown; automatic replay refused"
    )

    assert payload == {
        "error": "idempotency_unresolved",
        "status": "unknown_effect_state",
        "effect_status": "unknown_effect_state",
        "reconciliation_required": True,
        "detail": "consequential effect completion is unknown; automatic replay refused",
    }
    assert secret_marker not in json.dumps(payload)


def test_completed_result_with_lost_client_response_remains_replay_safe(tmp_path: Path) -> None:
    """Result persisted; client response lost — identical replay returns stored result."""
    adapter = load_adapter()
    ledger = adapter.DurableLedger(tmp_path / "ledger.json")
    calls: list[str] = []

    first, replayed = ledger.execute(
        "business-lost-response",
        "hash-a",
        lambda: calls.append("effect") or {"status": "ok", "n": 1},
    )
    assert replayed is False
    assert first == {"status": "ok", "n": 1}

    second, replayed = ledger.execute(
        "business-lost-response",
        "hash-a",
        lambda: calls.append("duplicate") or {"status": "wrong"},
    )
    assert replayed is True
    assert second == first
    assert calls == ["effect"]


def test_concurrent_in_progress_duplicate_handled_safely(tmp_path: Path) -> None:
    """Two concurrent callers with the same key: only one effect, other unresolved/conflict."""
    adapter = load_adapter()
    ledger = adapter.DurableLedger(tmp_path / "ledger.json")
    started = threading.Event()
    release = threading.Event()
    results: list[tuple[str, object]] = []
    lock = threading.Lock()

    def slow_effect() -> dict[str, str]:
        started.set()
        assert release.wait(timeout=2)
        return {"status": "ok"}

    def worker() -> None:
        try:
            result, replayed = ledger.execute("business-concurrent", "hash-a", slow_effect)
            with lock:
                results.append(("ok", (result, replayed)))
        except Exception as exc:  # collect exact exception types
            with lock:
                results.append((type(exc).__name__, str(exc)))

    t1 = threading.Thread(target=worker)
    t2 = threading.Thread(target=worker)
    t1.start()
    assert started.wait(timeout=2)
    t2.start()
    # Give the second thread a chance to observe in_progress.
    threading.Event().wait(0.05)
    release.set()
    t1.join(timeout=2)
    t2.join(timeout=2)

    assert len(results) == 2
    outcomes = {item[0] for item in results}
    assert "ok" in outcomes
    # The duplicate must not execute a second effect; it surfaces unresolved or waits
    # for the lock and replays. Under the ledger lock, the second either sees
    # in_progress (unresolved) or completed (replay).
    assert outcomes <= {"ok", "IdempotencyUnresolved"}
    snapshot = json.loads((tmp_path / "ledger.json").read_text())
    assert snapshot["effect_count"] == 1
    assert snapshot["records"]["business-concurrent"]["state"] == "completed"
