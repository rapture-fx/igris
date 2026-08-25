"""Decorator semantics and the fail-closed execution flow."""

from __future__ import annotations

import dataclasses
import io
import json
import sys
from typing import NamedTuple

import pytest
from conftest import FailingProvider, FakeTty, StaticProvider, read_events

import igris
from igris.errors import (
    ActionDenied,
    ApprovalError,
    ApprovalUnavailableError,
    EvidencePersistenceError,
    ExecutionCompletedEvidenceError,
    IdentityError,
    JournalError,
    UnsupportedFunctionError,
)
from igris.journal import FileJournal


class TestDecoratorForms:
    def test_bare_decorator_with_terminal_approval(self, igris_home, monkeypatch, capsys):
        monkeypatch.setattr(sys, "stdin", FakeTty("y\n"))

        @igris.guard
        def add(a: int, b: int) -> int:
            return a + b

        assert add(2, 3) == 5
        events = read_events(igris_home)
        assert [e["event_type"] for e in events] == ["decision", "outcome"]
        prompt = capsys.readouterr().out
        assert "approval required" in prompt
        assert "add" in prompt

    def test_called_decorator_with_arguments(self, igris_home, allow_provider):
        @igris.guard(action="customer.refund", risk="critical", approval_provider=allow_provider)
        def refund(customer_id: str, amount: int):
            return {"refunded": amount}

        assert refund("cus_1", amount=42) == {"refunded": 42}
        decision = read_events(igris_home)[0]
        assert decision["action_name"] == "customer.refund"
        assert decision["risk"] == "critical"

    def test_metadata_preserved(self, igris_home, allow_provider):
        @igris.guard(approval_provider=allow_provider)
        def documented(x: int) -> int:
            """Docstring stays."""
            return x

        assert documented.__name__ == "documented"
        assert documented.__doc__ == "Docstring stays."
        assert documented.__wrapped__(7) == 7  # functools.wraps

    def test_positional_and_keyword_semantics(self, igris_home, allow_provider):
        @igris.guard(approval_provider=allow_provider)
        def f(a, b=10, *args, c, **kwargs):
            return (a, b, args, c, kwargs)

        assert f(1, 2, 3, 4, c=5, d=6) == (1, 2, (3, 4), 5, {"d": 6})

    def test_instance_and_static_methods(self, igris_home, allow_provider):
        class Payments:
            def __init__(self):
                self.calls = 0

            @igris.guard(approval_provider=allow_provider)
            def charge(self, amount: int):
                self.calls += 1
                return amount * 2

            @staticmethod
            @igris.guard(approval_provider=allow_provider)
            def convert(amount: int):
                return amount + 1

        p = Payments()
        assert p.charge(5) == 10
        assert p.calls == 1
        assert Payments.convert(1) == 2

    def test_malformed_call_propagates_typeerror_without_events(self, igris_home, allow_provider):
        @igris.guard(approval_provider=allow_provider)
        def f(a: int):
            return a

        with pytest.raises(TypeError):
            f()  # missing required argument; never reached approval
        assert read_events(igris_home) == []

    def test_async_function_rejected_at_decoration(self, igris_home):
        with pytest.raises(UnsupportedFunctionError, match="async"):

            @igris.guard
            async def later():
                return 1

    def test_generator_function_rejected_at_decoration(self, igris_home):
        with pytest.raises(UnsupportedFunctionError):

            @igris.guard
            def gen():
                yield 1


class TestApproval:
    def test_denial_prevents_execution_and_writes_signed_decision(self, igris_home, deny_provider):
        calls = []

        @igris.guard(action="danger.zone", approval_provider=deny_provider)
        def dangerous():
            calls.append(1)

        with pytest.raises(ActionDenied, match=r"danger\.zone"):
            dangerous()
        assert calls == []
        events = read_events(igris_home)
        assert len(events) == 1
        assert events[0]["event_type"] == "decision"
        assert events[0]["decision"] == "denied"
        assert events[0]["signature"]
        # No fabricated outcome after a denial.
        assert all(e["event_type"] != "outcome" for e in events)

    def test_non_tty_required_approval_fails_closed(self, igris_home, monkeypatch):
        monkeypatch.setattr(sys, "stdin", io.StringIO("y\n"))
        calls = []

        @igris.guard
        def f():
            calls.append(1)

        with pytest.raises(ApprovalUnavailableError):
            f()
        assert calls == []
        assert read_events(igris_home) == []

    def test_provider_failure_fails_closed(self, igris_home):
        calls = []

        @igris.guard(approval_provider=FailingProvider())
        def f():
            calls.append(1)

        with pytest.raises(ApprovalError, match="failing closed"):
            f()
        assert calls == []

    def test_terminal_default_is_deny(self, igris_home, monkeypatch):
        monkeypatch.setattr(sys, "stdin", FakeTty("\n"))

        @igris.guard
        def f():
            return 1

        with pytest.raises(ActionDenied):
            f()

    def test_terminal_rejects_non_affirmative(self, igris_home, monkeypatch):
        monkeypatch.setattr(sys, "stdin", FakeTty("sure why not\n"))

        @igris.guard
        def f():
            return 1

        with pytest.raises(ActionDenied):
            f()

    def test_approval_never_runs_without_prompt_and_records_decision(self, igris_home):
        @igris.guard(approval="never")
        def f(x):
            return x

        assert f(9) == 9
        decision = read_events(igris_home)[0]
        assert decision["decision"] == "allowed"
        assert decision["approval_mode"] == "never"

    def test_provider_sees_only_redacted_bounded_summary(self, igris_home, allow_provider):
        @igris.guard(approval_provider=allow_provider)
        def f(password: str, note: str):
            return True

        f("hunter2-super-secret", "x" * 5000)
        request = allow_provider.requests[0]
        assert "hunter2-super-secret" not in request.redacted_input_summary
        assert "<REDACTED>" in request.redacted_input_summary
        assert len(request.redacted_input_summary) < 3000


class TestFailClosed:
    def test_identity_failure_prevents_execution(self, igris_home, allow_provider, monkeypatch):
        # IGRIS_HOME pointing at a regular file makes identity creation fail.
        igris_home.parent.mkdir(parents=True, exist_ok=True)
        igris_home.write_text("not a directory")
        calls = []

        @igris.guard(approval_provider=allow_provider)
        def f():
            calls.append(1)

        with pytest.raises(IdentityError):
            f()
        assert calls == []

    def test_decision_journal_failure_prevents_execution(
        self, igris_home, allow_provider, tmp_path
    ):
        blocked = tmp_path / "blocked-journal"
        blocked.mkdir()  # journal path is a directory: append must fail
        calls = []

        @igris.guard(approval_provider=allow_provider, journal=blocked)
        def f():
            calls.append(1)

        with pytest.raises(JournalError):
            f()
        assert calls == []
        assert read_events(igris_home) == []

    def test_canonicalization_failure_prevents_execution(self, igris_home, allow_provider):
        calls = []

        @igris.guard(approval_provider=allow_provider)
        def f(x):
            calls.append(1)

        with pytest.raises(igris.CanonicalizationError):
            f(float("nan"))
        assert calls == []
        assert read_events(igris_home) == []


class _OutcomeFailsJournal:
    """Journal that persists the decision but fails on the outcome append."""

    def __init__(self, path):
        self._inner = FileJournal(path)
        self.appends = 0

    @property
    def path(self):
        return self._inner.path

    def append_event(self, build):
        self.appends += 1
        if self.appends >= 2:
            raise JournalError("disk full (simulated)")
        return self._inner.append_event(build)


class TestOutcomeSemantics:
    def test_success_writes_decision_then_outcome(self, igris_home, allow_provider):
        @igris.guard(approval_provider=allow_provider)
        def f(x: int):
            return x * 2

        assert f(4) == 8
        events = read_events(igris_home)
        assert [e["event_type"] for e in events] == ["decision", "outcome"]
        decision, outcome = events
        assert outcome["status"] == "succeeded"
        assert outcome["decision_event_id"] == decision["event_id"]
        assert outcome["observed_result_type"] == "builtins.int"
        assert outcome["previous_event_hash"] == decision["event_hash"]

    def test_function_exception_records_failure_and_reraises(self, igris_home, allow_provider):
        class PaymentError(RuntimeError):
            pass

        @igris.guard(approval_provider=allow_provider)
        def f():
            raise PaymentError("card declined")

        with pytest.raises(PaymentError, match="card declined"):
            f()
        outcome = read_events(igris_home)[1]
        assert outcome["status"] == "failed"
        assert outcome["exception_type"].endswith("PaymentError")
        assert "card declined" in outcome["sanitized_error_summary"]

    def test_error_summary_is_scrubbed_and_bounded(self, igris_home, allow_provider):
        @igris.guard(approval_provider=allow_provider)
        def f(api_key: str):
            raise RuntimeError(f"upstream rejected key {api_key}: " + "x" * 5000)

        with pytest.raises(RuntimeError):
            f("sk-live-abcdef123456")
        outcome = read_events(igris_home)[1]
        assert "sk-live-abcdef123456" not in outcome["sanitized_error_summary"]
        assert len(outcome["sanitized_error_summary"]) < 400

    def test_outcome_write_failure_reports_execution_and_never_retries(
        self, igris_home, allow_provider, tmp_path
    ):
        journal = _OutcomeFailsJournal(tmp_path / "journal.jsonl")
        calls = []

        @igris.guard(approval_provider=allow_provider, journal=journal)
        def f():
            calls.append(1)
            return "done"

        with pytest.raises(ExecutionCompletedEvidenceError) as excinfo:
            f()
        assert calls == [1], "function must execute exactly once, never retried"
        err = excinfo.value
        assert isinstance(err, EvidencePersistenceError)
        assert err.execution_occurred is True
        assert err.executed is True
        assert err.execution_state == "completed"
        assert err.evidence_state == "incomplete"
        assert err.retry_safe is False
        assert err.action_id
        decision = json.loads(journal.path.read_text(encoding="utf-8").splitlines()[0])
        assert err.decision_event_id == decision["event_id"]
        assert err.function_outcome == "succeeded"
        assert err.result == "done"
        assert "EXECUTED" in str(err)
        assert "INCOMPLETE" in str(err)
        assert "Automatic retry is UNSAFE" in str(err)
        assert "did not retry" in str(err)

    def test_outcome_write_failure_after_function_exception(
        self, igris_home, allow_provider, tmp_path
    ):
        journal = _OutcomeFailsJournal(tmp_path / "journal.jsonl")

        @igris.guard(approval_provider=allow_provider, journal=journal)
        def f():
            raise ValueError("original failure")

        with pytest.raises(ExecutionCompletedEvidenceError) as excinfo:
            f()
        err = excinfo.value
        assert err.execution_occurred is True
        assert err.execution_state == "failed"
        assert err.evidence_state == "incomplete"
        assert err.retry_safe is False
        assert err.function_outcome == "failed"
        assert err.result is None
        decision = json.loads(journal.path.read_text(encoding="utf-8").splitlines()[0])
        assert err.decision_event_id == decision["event_id"]
        assert isinstance(err.__cause__, ValueError)

    def test_outcome_write_failure_message_does_not_expose_result_or_secrets(
        self, igris_home, allow_provider, tmp_path
    ):
        journal = _OutcomeFailsJournal(tmp_path / "journal.jsonl")
        secret = "sk-live-POST-EXECUTION-SECRET"

        @igris.guard(approval_provider=allow_provider, journal=journal)
        def f(api_key: str):
            return {"ok": True, "api_key": api_key}

        with pytest.raises(ExecutionCompletedEvidenceError) as excinfo:
            f(secret)
        err = excinfo.value
        assert err.result == {"ok": True, "api_key": secret}
        assert secret not in str(err)
        assert secret not in repr(err)

    def test_post_execution_error_is_publicly_importable(self):
        assert igris.ExecutionCompletedEvidenceError is ExecutionCompletedEvidenceError


class TestMetadata:
    def test_metadata_recorded_and_redacted(self, igris_home, allow_provider):
        @igris.guard(
            approval_provider=allow_provider,
            metadata={"team": "payments", "api_key": "meta-secret"},
        )
        def f():
            return 1

        f()
        decision = read_events(igris_home)[0]
        assert decision["metadata"]["team"] == "payments"
        assert decision["metadata"]["api_key"] == "<REDACTED>"

    def test_invalid_metadata_rejected_at_decoration(self, igris_home):
        with pytest.raises(igris.ContractError):

            @igris.guard(metadata={"bad": float("inf")})
            def f():
                return 1

    def test_non_dict_metadata_rejected(self, igris_home):
        with pytest.raises(igris.ContractError):

            @igris.guard(metadata=["not", "a", "dict"])
            def f():
                return 1


class TestInputHash:
    def test_input_hash_over_redacted_representation(self, igris_home):
        """Two calls differing only in a secret produce the same input hash."""
        p1 = StaticProvider("allowed")
        p2 = StaticProvider("allowed")

        @igris.guard(approval_provider=p1)
        def f(user: str, token: str):
            return True

        f("alice", "token-one")
        f("alice", "token-two")
        events = read_events(igris_home)
        decisions = [e for e in events if e["event_type"] == "decision"]
        assert decisions[0]["input_hash"] == decisions[1]["input_hash"]
        _ = p2  # symmetry; provider identity is irrelevant to the hash


class TestNamedFieldRedactionEndToEnd:
    """A secret in a dataclass or named tuple must not reach signed evidence.

    Regression coverage for a disclosure where redaction traversed mappings and
    sequences only, while canonicalization additionally expanded dataclasses
    and named tuples by field name. The end-to-end assertions matter as much as
    the unit ones: the leak surfaced in three places at once — the journal, the
    input hash, and the text shown to the human approving the call.
    """

    SECRET = "sk-live-GUARD-E2E-SECRET-9999"

    def test_dataclass_secret_reaches_neither_journal_nor_prompt(self, igris_home):
        @dataclasses.dataclass
        class Credentials:
            user: str
            api_key: str

        provider = StaticProvider("allowed")

        @igris.guard(action="tests.dataclass.leak", approval_provider=provider)
        def act(config):
            return "done"

        act(Credentials("wira", self.SECRET))

        assert self.SECRET not in (igris_home / "journal.jsonl").read_text()
        assert self.SECRET not in provider.requests[0].redacted_input_summary

    def test_named_tuple_secret_reaches_neither_journal_nor_prompt(self, igris_home):
        class Credentials(NamedTuple):
            user: str
            api_key: str

        provider = StaticProvider("allowed")

        @igris.guard(action="tests.namedtuple.leak", approval_provider=provider)
        def act(config):
            return "done"

        act(Credentials("wira", self.SECRET))

        assert self.SECRET not in (igris_home / "journal.jsonl").read_text()
        assert self.SECRET not in provider.requests[0].redacted_input_summary

    def test_error_echoing_a_dataclass_secret_is_scrubbed(self, igris_home):
        @dataclasses.dataclass
        class Credentials:
            api_key: str

        @igris.guard(action="tests.dataclass.error", approval_provider=StaticProvider("allowed"))
        def act(config):
            raise ValueError(f"upstream rejected {config.api_key}")

        with pytest.raises(ValueError):
            act(Credentials(self.SECRET))

        assert self.SECRET not in (igris_home / "journal.jsonl").read_text()
