"""Tests for ``igris.wrap_tool`` and ``igris.wrap_tools``.

Covers decorator equivalence, callable compatibility, metadata preservation,
collection handling, and security invariants.  All tests run under the
autouse socket guard from ``conftest.py``.
"""

from __future__ import annotations

import asyncio
import functools
import inspect
import socket
import urllib.request

import pytest
from conftest import StaticProvider, read_events

import igris
from igris.connected import ContractSyncResult
from igris.errors import ActionDenied, ToolWrapError
from igris.wrap_tool import wrap_tool, wrap_tools

# Save the real socketpair before conftest's autouse _no_network fixture replaces it.
# asyncio.run needs socketpair for its self-pipe mechanism on Unix. socketpair
# in turn calls socket.socket internally, so both must be restored temporarily.
_real_socket = socket.socket
_real_socketpair = socket.socketpair


def _run_async(coro):
    """Run a coroutine for testing, temporarily allowing socket internals."""
    saved_socket = socket.socket
    saved_socketpair = socket.socketpair
    socket.socket = _real_socket
    socket.socketpair = _real_socketpair
    try:
        return asyncio.run(coro)
    finally:
        socket.socket = saved_socket
        socket.socketpair = saved_socketpair


# ---------------------------------------------------------------------------
# Public namespace
# ---------------------------------------------------------------------------


class TestPublicNamespace:
    def test_wrapper_api_exposed_from_igris(self):
        assert igris.wrap_tool is wrap_tool
        assert igris.wrap_tools is wrap_tools
        assert igris.ToolWrapError is ToolWrapError

    def test_all_names_are_importable(self):
        for name in igris.__all__:
            assert hasattr(igris, name), f"igris.__all__ lists {name!r} but it is not importable"


# ---------------------------------------------------------------------------
# Equivalence: decorator vs wrap_tool
# ---------------------------------------------------------------------------


class TestDecoratorEquivalence:
    def test_contract_equivalence(self, igris_home, allow_provider):
        @igris.guard(action="eq.refund", risk="critical", approval_provider=allow_provider)
        def decorated(customer_id: str, amount: int):
            return {"refunded": amount}

        def original(customer_id: str, amount: int):
            return {"refunded": amount}

        wrapped = wrap_tool(
            original,
            action="eq.refund",
            risk="critical",
            approval_provider=allow_provider,
        )

        dec_contract = decorated.__igris_contract__
        wrap_contract = wrapped.__igris_contract__
        assert dec_contract.action_name == wrap_contract.action_name
        assert dec_contract.risk == wrap_contract.risk
        assert dec_contract.approval_mode == wrap_contract.approval_mode
        assert dec_contract.execution_mode == wrap_contract.execution_mode
        assert dec_contract.parameter_descriptors == wrap_contract.parameter_descriptors
        # contract_hash intentionally differs: it includes module, qualified_name,
        # and code_fingerprint which are function-identity-derived, not semantic.
        # The two paths produce semantically equivalent contracts, not byte-identical.

    def test_allowed_execution_equivalence(self, igris_home, allow_provider):
        @igris.guard(action="eq.allowed", approval_provider=allow_provider)
        def decorated(x: int):
            return x * 2

        def original(x: int):
            return x * 2

        wrapped = wrap_tool(original, action="eq.allowed", approval_provider=allow_provider)
        assert decorated(5) == wrapped(5) == 10
        dec_events = read_events(igris_home)
        # Two calls → four events
        assert len(dec_events) == 4
        assert [e["event_type"] for e in dec_events] == [
            "decision",
            "outcome",
            "decision",
            "outcome",
        ]
        assert all(e["action_name"] == "eq.allowed" for e in dec_events)

    def test_denied_execution_prevents_original(self, igris_home, deny_provider):
        calls = []

        def original(x: int):
            calls.append(x)
            return x

        wrapped = wrap_tool(original, action="eq.denied", approval_provider=deny_provider)
        with pytest.raises(ActionDenied, match=r"eq\.denied"):
            wrapped(42)
        assert calls == [], "denial must prevent the original callable from running"
        events = read_events(igris_home)
        assert len(events) == 1
        assert events[0]["decision"] == "denied"
        assert all(e["event_type"] != "outcome" for e in events)

    def test_success_writes_decision_then_outcome(self, igris_home, allow_provider):
        def original(x: int):
            return x + 1

        wrapped = wrap_tool(original, action="eq.success", approval_provider=allow_provider)
        assert wrapped(7) == 8
        events = read_events(igris_home)
        assert [e["event_type"] for e in events] == ["decision", "outcome"]
        assert events[1]["status"] == "succeeded"
        assert events[1]["decision_event_id"] == events[0]["event_id"]

    def test_failure_records_failed_outcome_and_reraises(self, igris_home, allow_provider):
        class ToolError(RuntimeError):
            pass

        def original():
            raise ToolError("boom")

        wrapped = wrap_tool(original, action="eq.fail", approval_provider=allow_provider)
        with pytest.raises(ToolError, match="boom"):
            wrapped()
        events = read_events(igris_home)
        assert events[1]["status"] == "failed"
        assert "ToolError" in events[1]["exception_type"]
        assert "boom" in events[1]["sanitized_error_summary"]

    def test_redaction_identical_to_decorator(self, igris_home, allow_provider):
        secret = "sk-live-redact-test-9999"

        @igris.guard(action="eq.redact", approval_provider=allow_provider)
        def decorated(api_key: str, amount: int):
            return amount

        def original(api_key: str, amount: int):
            return amount

        wrapped = wrap_tool(original, action="eq.redact", approval_provider=allow_provider)
        decorated(secret, 10)
        wrapped(secret, 10)
        events = read_events(igris_home)
        dec_summary = events[0]["redacted_input_summary"]
        wrap_summary = events[2]["redacted_input_summary"]
        assert dec_summary == wrap_summary
        assert secret not in dec_summary
        assert "<REDACTED>" in dec_summary
        assert events[0]["input_hash"] == events[2]["input_hash"]

    def test_zero_network_embedded_mode(self, igris_home, allow_provider):
        # conftest socket guard is autouse → any network call raises.
        def original(x: int):
            return x

        wrapped = wrap_tool(original, action="eq.nonet", approval_provider=allow_provider)
        assert wrapped(1) == 1

    def test_connected_sync_reuses_engine(self, igris_home):
        from igris import connected

        connected._SYNC_CACHE.clear()

        class RecordingClient:
            cache_scope = "recording://test"

            def __init__(self):
                self.contracts = []

            def sync_contract(self, contract):
                self.contracts.append(contract)
                return ContractSyncResult(
                    action_name=contract.action_name,
                    contract_hash=contract.contract_hash,
                    created=True,
                )

        client = RecordingClient()

        def original(x: int):
            return x * 3

        wrapped = wrap_tool(
            original,
            action="eq.connected",
            approval_provider=StaticProvider("allowed"),
            sync_client=client,
        )
        assert wrapped(2) == 6
        assert len(client.contracts) == 1
        assert client.contracts[0].action_name == "eq.connected"
        connected._SYNC_CACHE.clear()


# ---------------------------------------------------------------------------
# Metadata preservation
# ---------------------------------------------------------------------------


class TestMetadataPreservation:
    def test_signature_preserved(self, igris_home, allow_provider):
        def original(a: int, b: str = "x", *args, c: float, **kwargs):
            return (a, b, args, c, kwargs)

        wrapped = wrap_tool(original, action="meta.sig", approval_provider=allow_provider)
        assert inspect.signature(wrapped) == inspect.signature(original)

    def test_name_preserved(self, igris_home, allow_provider):
        def original_function(x: int):
            """My docstring."""
            return x

        wrapped = wrap_tool(original_function, action="meta.name", approval_provider=allow_provider)
        assert wrapped.__name__ == "original_function"
        assert (
            wrapped.__qualname__
            == "TestMetadataPreservation.test_name_preserved.<locals>.original_function"
        )
        assert wrapped.__doc__ == "My docstring."
        assert wrapped.__module__ == original_function.__module__
        assert wrapped.__wrapped__ is original_function

    def test_original_callable_unchanged(self, igris_home, allow_provider):
        def original(x: int):
            return x

        original_dict_before = dict(original.__dict__) if hasattr(original, "__dict__") else {}
        original_name = original.__name__
        original_qualified = original.__qualname__

        wrapped = wrap_tool(original, action="meta.invariant", approval_provider=allow_provider)

        assert original.__name__ == original_name
        assert original.__qualname__ == original_qualified
        assert not hasattr(original, "__igris_contract__")
        assert hasattr(wrapped, "__igris_contract__")
        if hasattr(original, "__dict__"):
            assert original.__dict__ == original_dict_before


# ---------------------------------------------------------------------------
# Callable categories
# ---------------------------------------------------------------------------


class TestCallableCategories:
    def test_plain_sync_function(self, igris_home, allow_provider):
        def original(x: int, y: int):
            return x + y

        wrapped = wrap_tool(original, action="call.sync", approval_provider=allow_provider)
        assert wrapped(1, 2) == 3

    def test_async_function(self, igris_home, allow_provider):
        async def original(x: int):
            return x * 2

        wrapped = wrap_tool(original, action="call.async", approval_provider=allow_provider)
        result = _run_async(wrapped(5))
        assert result == 10
        events = read_events(igris_home)
        assert [e["event_type"] for e in events] == ["decision", "outcome"]
        assert events[1]["status"] == "succeeded"

    def test_async_function_denial_prevents_execution(self, igris_home, deny_provider):
        calls = []

        async def original(x: int):
            calls.append(x)
            return x

        wrapped = wrap_tool(original, action="call.asyncdeny", approval_provider=deny_provider)
        with pytest.raises(ActionDenied):
            _run_async(wrapped(7))
        assert calls == []

    def test_async_function_failure_reraises(self, igris_home, allow_provider):
        async def original():
            raise ValueError("async boom")

        wrapped = wrap_tool(original, action="call.asyncfail", approval_provider=allow_provider)
        with pytest.raises(ValueError, match="async boom"):
            _run_async(wrapped())
        events = read_events(igris_home)
        assert events[1]["status"] == "failed"
        assert "ValueError" in events[1]["exception_type"]

    def test_bound_method(self, igris_home, allow_provider):
        class Tool:
            def __init__(self):
                self.offset = 10

            def compute(self, x: int):
                return x + self.offset

        tool = Tool()
        wrapped = wrap_tool(tool.compute, action="call.bound", approval_provider=allow_provider)
        assert wrapped(5) == 15

    def test_static_method_after_attribute_access(self, igris_home, allow_provider):
        class Tool:
            @staticmethod
            def helper(x: int):
                return x - 1

        wrapped = wrap_tool(Tool.helper, action="call.static", approval_provider=allow_provider)
        assert wrapped(10) == 9

    def test_functools_partial(self, igris_home, allow_provider):
        def original(a: int, b: int, c: int):
            return a + b + c

        partial = functools.partial(original, 1, 2)
        wrapped = wrap_tool(partial, action="call.partial", approval_provider=allow_provider)
        assert wrapped(3) == 6

    def test_callable_object(self, igris_home, allow_provider):
        class Tool:
            def __call__(self, x: int):
                return x * 100

        tool = Tool()
        wrapped = wrap_tool(tool, action="call.objcall", approval_provider=allow_provider)
        assert wrapped(3) == 300

    def test_async_callable_object(self, igris_home, allow_provider):
        class AsyncTool:
            async def __call__(self, x: int):
                return x + 100

        tool = AsyncTool()
        wrapped = wrap_tool(tool, action="call.asyncobj", approval_provider=allow_provider)
        assert _run_async(wrapped(5)) == 105

    def test_already_guarded_rejected(self, igris_home, allow_provider):
        @igris.guard(action="call.guarded", approval_provider=allow_provider)
        def original(x: int):
            return x

        with pytest.raises(ToolWrapError, match="already guarded"):
            wrap_tool(original, action="call.double", approval_provider=allow_provider)

    def test_already_wrapped_rejected(self, igris_home, allow_provider):
        def original(x: int):
            return x

        wrapped = wrap_tool(original, action="call.first", approval_provider=allow_provider)
        with pytest.raises(ToolWrapError, match="already guarded"):
            wrap_tool(wrapped, action="call.second", approval_provider=allow_provider)

    def test_generator_function_rejected(self, igris_home, allow_provider):
        def original():
            yield 1

        with pytest.raises(ToolWrapError, match="generator"):
            wrap_tool(original, action="call.gen", approval_provider=allow_provider)

    def test_async_generator_function_rejected(self, igris_home, allow_provider):
        async def original():
            yield 1

        with pytest.raises(ToolWrapError, match="generator"):
            wrap_tool(original, action="call.asyncgen", approval_provider=allow_provider)

    def test_non_callable_rejected(self):
        with pytest.raises(ToolWrapError, match="callable"):
            wrap_tool(42, action="call.noncall")  # type: ignore[arg-type]

    def test_metadata_redaction_same_as_decorator(self, igris_home, allow_provider):
        def original():
            return 1

        wrapped = wrap_tool(
            original,
            action="call.metadata",
            approval_provider=allow_provider,
            metadata={"team": "payments", "api_key": "meta-secret"},
        )
        wrapped()
        decision = read_events(igris_home)[0]
        assert decision["metadata"]["team"] == "payments"
        assert decision["metadata"]["api_key"] == "<REDACTED>"


# ---------------------------------------------------------------------------
# Collection helper
# ---------------------------------------------------------------------------


class TestWrapToolsCollections:
    def test_sequence_returns_new_list(self, igris_home, allow_provider):
        def tool_a(x: int):
            return x

        def tool_b(y: int):
            return y

        wrapped = wrap_tools(
            [tool_a, tool_b],
            configuration={
                "tool_a": {"action": "tools.a", "approval_provider": allow_provider},
                "tool_b": {"action": "tools.b", "approval_provider": allow_provider},
            },
        )
        assert isinstance(wrapped, list)
        assert len(wrapped) == 2
        assert wrapped[0](5) == 5
        assert wrapped[1](7) == 7

    def test_mapping_preserves_keys(self, igris_home, allow_provider):
        def tool_a(x: int):
            return x

        def tool_b(y: int):
            return y

        wrapped = wrap_tools(
            {"alpha": tool_a, "beta": tool_b},
            configuration={
                "alpha": {"action": "tools.alpha", "approval_provider": allow_provider},
                "beta": {"action": "tools.beta", "approval_provider": allow_provider},
            },
        )
        assert isinstance(wrapped, dict)
        assert set(wrapped.keys()) == {"alpha", "beta"}
        assert wrapped["alpha"](3) == 3
        assert wrapped["beta"](4) == 4

    def test_input_not_mutated(self, igris_home, allow_provider):
        tools_list = []

        def tool_a(x: int):
            return x

        def tool_b(y: int):
            return y

        tools_list.extend([tool_a, tool_b])
        config = {
            "tool_a": {"action": "notmut.a", "approval_provider": allow_provider},
            "tool_b": {"action": "notmut.b", "approval_provider": allow_provider},
        }
        original_list = list(tools_list)
        original_config = dict(config)
        wrap_tools(tools_list, configuration=config)
        assert tools_list == original_list, "input sequence must not be mutated"
        assert config == original_config, "configuration must not be mutated"

    def test_duplicate_action_names_rejected(self, igris_home, allow_provider):
        def tool_a(x: int):
            return x

        def tool_b(y: int):
            return y

        with pytest.raises(ToolWrapError, match="duplicate action"):
            wrap_tools(
                [tool_a, tool_b],
                configuration={
                    "tool_a": {"action": "dup.same", "approval_provider": allow_provider},
                    "tool_b": {"action": "dup.same", "approval_provider": allow_provider},
                },
            )

    def test_missing_configuration_rejected(self, igris_home, allow_provider):
        def tool_a(x: int):
            return x

        with pytest.raises(ToolWrapError, match="no configuration"):
            wrap_tools(
                [tool_a],
                configuration={"other": {"action": "miss.action"}},
            )

    def test_non_callable_entry_rejected(self):
        with pytest.raises(ToolWrapError, match="non-callable"):
            wrap_tools(
                [42],  # type: ignore[list-item]
                configuration={"42": {"action": "nc.action"}},
            )

    def test_order_is_deterministic_for_sequence(self, igris_home, allow_provider):
        def tool_a(x: int):
            return x

        def tool_b(y: int):
            return y

        def tool_c(z: int):
            return z

        wrapped = wrap_tools(
            [tool_a, tool_b, tool_c],
            configuration={
                "tool_a": {"action": "ord.a", "approval_provider": allow_provider},
                "tool_b": {"action": "ord.b", "approval_provider": allow_provider},
                "tool_c": {"action": "ord.c", "approval_provider": allow_provider},
            },
        )
        actions = [w.__igris_contract__.action_name for w in wrapped]
        assert actions == ["ord.a", "ord.b", "ord.c"]

    def test_missing_action_in_config_rejected(self, igris_home, allow_provider):
        def tool_a(x: int):
            return x

        with pytest.raises(ToolWrapError, match="must include"):
            wrap_tools(
                [tool_a],
                configuration={"tool_a": {"risk": "low", "approval_provider": allow_provider}},
            )


# ---------------------------------------------------------------------------
# Security invariants
# ---------------------------------------------------------------------------


class TestSecurityInvariants:
    def test_no_hidden_network_without_connected_config(self, igris_home, allow_provider):
        # The autouse socket guard already blocks any socket creation.
        # Double-check by also blocking urllib.
        def forbidden_request(*args, **kwargs):
            raise AssertionError("hidden network request detected")

        original_request = urllib.request.Request
        urllib.request.Request = forbidden_request  # type: ignore[assignment]
        try:

            def tool(x: int):
                return x

            wrapped = wrap_tool(tool, action="sec.nonet", approval_provider=allow_provider)
            assert wrapped(1) == 1
        finally:
            urllib.request.Request = original_request  # type: ignore[assignment]

    def test_no_raw_arguments_in_wrapper_repr(self, igris_home, allow_provider):
        secret = "sk-live-secret-no-leak-42"

        def original(api_key: str, amount: int):
            return amount

        wrapped = wrap_tool(original, action="sec.noleak", approval_provider=allow_provider)
        wrapped(secret, 10)
        r = repr(wrapped)
        assert secret not in r
        contract_repr = repr(wrapped.__igris_contract__)
        assert secret not in contract_repr

    def test_no_private_key_exposure(self, igris_home, allow_provider):
        def original(x: int):
            return x

        wrapped = wrap_tool(original, action="sec.keys", approval_provider=allow_provider)
        wrapped(1)
        events = read_events(igris_home)
        all_text = " ".join(str(e) for e in events) + repr(wrapped)
        assert "PRIVATE KEY" not in all_text
        assert "BEGIN" not in all_text

    def test_wrapper_cannot_set_managed_provenance(self, igris_home, allow_provider):
        def original(x: int):
            return x

        wrapped = wrap_tool(original, action="sec.managed", approval_provider=allow_provider)
        assert wrapped.__igris_contract__.execution_mode == "embedded"

    def test_no_automatic_evidence_upload(self, igris_home, allow_provider):
        from igris import evidence_sync as es

        def original(x: int):
            return x

        wrapped = wrap_tool(original, action="sec.noupload", approval_provider=allow_provider)
        wrapped(1)
        # Guarded execution must not reference the evidence sync client.
        assert not hasattr(wrapped, "_igris_sync_client")
        assert es is not None  # importable, just not called

    def test_approval_denial_never_invokes_original(self, igris_home, deny_provider):
        calls = []

        def original():
            calls.append(1)
            return "should never run"

        wrapped = wrap_tool(original, action="sec.denial", approval_provider=deny_provider)
        with pytest.raises(ActionDenied):
            wrapped()
        assert calls == []
