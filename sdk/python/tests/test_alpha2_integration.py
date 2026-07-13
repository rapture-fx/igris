"""Alpha.2 combined-behavior tests: wrapped tools meeting evidence privacy.

The privacy preflight suite and the wrapper suite each verify their own
feature in isolation.  This module exercises the combination shipped in
v0.1.0-alpha.2: evidence produced through ``wrap_tool``/``wrap_tools`` flows
through local privacy inspection and the fail-closed sync preflight exactly
like decorator-produced evidence.  All tests run under the autouse socket
guard from ``conftest.py``.
"""

from __future__ import annotations

import asyncio
import functools
import json
import socket
import urllib.request
import warnings

import pytest
from conftest import StaticProvider, read_events

import igris
from igris.cli import EXIT_PRIVACY_ACK_REQUIRED, main
from igris.connected import ContractSyncResult
from igris.errors import (
    EvidencePrivacyInspectionError,
    EvidencePrivacyPreflightError,
    UnsupportedFunctionError,
)
from igris.evidence_privacy import PrivacyClassification, inspect_journal
from igris.evidence_sync import sync_journal
from igris.identity import LocalSigningIdentity, default_journal_path
from igris.verification import verify_journal
from igris.wrap_tool import wrap_tool, wrap_tools

# asyncio.run needs socketpair (self-pipe) which conftest's guard blocks;
# temporarily restore the real primitives exactly as test_wrap_tool.py does.
_real_socket = socket.socket
_real_socketpair = socket.socketpair


def _run_async(coro):
    saved_socket = socket.socket
    saved_socketpair = socket.socketpair
    socket.socket = _real_socket
    socket.socketpair = _real_socketpair
    try:
        return asyncio.run(coro)
    finally:
        socket.socket = saved_socket
        socket.socketpair = saved_socketpair


class RecordingEvidenceClient:
    """Explicit injected client; records uploads instead of doing HTTP."""

    def __init__(self) -> None:
        self.calls = []

    def submit_batch(self, key_id, public_key_pem, first_previous_event_hash, events):
        self.calls.append((key_id, public_key_pem, first_previous_event_hash, events))
        return {
            "batch_id": "alpha2-test-batch",
            "evidence_state": "verified",
            "events_verified": len(events),
            "created": True,
            "chain_head": events[-1]["event_hash"],
        }


class RecordingContractClient:
    cache_scope = "recording://alpha2"

    def __init__(self) -> None:
        self.contracts = []

    def sync_contract(self, contract):
        self.contracts.append(contract)
        return ContractSyncResult(
            action_name=contract.action_name,
            contract_hash=contract.contract_hash,
            created=True,
        )


def _forbid_network_setup(monkeypatch) -> None:
    """Beyond the socket guard: fail on DNS lookup or urllib request creation."""

    def forbidden(*args, **kwargs):
        raise AssertionError("no configuration, DNS, or HTTP activity may occur")

    monkeypatch.setattr(socket, "getaddrinfo", forbidden)
    monkeypatch.setattr(urllib.request, "Request", forbidden)
    monkeypatch.setattr(urllib.request, "urlopen", forbidden)


def _home_file_bytes(home) -> dict[str, bytes]:
    return {path.name: path.read_bytes() for path in home.iterdir() if path.is_file()}


# ---------------------------------------------------------------------------
# Wrapped tools + privacy classification + sync preflight
# ---------------------------------------------------------------------------


class TestWrappedToolPrivacy:
    def test_fully_redacted_wrapped_tool_classifies_and_syncs_without_override(
        self, igris_home, allow_provider
    ):
        def send_invoice(customer_ref: str, invoice_body: str):
            return f"sent:{customer_ref}"

        wrapped = wrap_tool(
            send_invoice,
            action="alpha2.invoice.send",
            redact=["customer_ref", "invoice_body"],
            approval_provider=allow_provider,
        )
        assert wrapped("cust-77", invoice_body="synthetic body") == "sent:cust-77"

        report = inspect_journal(default_journal_path())
        assert report.decision_count == 1
        assert report.classifications.fully_redacted == 1
        assert report.actions[0].classification is PrivacyClassification.FULLY_REDACTED
        assert report.actions[0].retained_parameter_names == ()
        assert report.safe_for_upload

        client = RecordingEvidenceClient()
        sync_report = sync_journal(client=client)
        assert sync_report.events_uploaded == 2
        assert len(client.calls) == 1

    def test_retained_argument_blocks_sync_before_config_dns_or_http(
        self, igris_home, allow_provider, monkeypatch
    ):
        def lookup_customer(customer_id: str, api_key: str):
            return customer_id

        wrapped = wrap_tool(
            lookup_customer,
            action="alpha2.customer.lookup",
            approval_provider=allow_provider,
        )
        assert wrapped("business-value-1234", api_key="secret-not-retained") == (
            "business-value-1234"
        )

        journal = default_journal_path()
        before_journal = journal.read_bytes()
        before_home = _home_file_bytes(igris_home)

        monkeypatch.delenv("IGRIS_API_URL", raising=False)
        monkeypatch.delenv("IGRIS_API_KEY", raising=False)
        _forbid_network_setup(monkeypatch)

        client = RecordingEvidenceClient()
        with pytest.raises(EvidencePrivacyPreflightError) as exc_info:
            sync_journal(client=client)
        assert client.calls == []
        assert "business-value-1234" not in str(exc_info.value)

        # A refused sync and an inspection must not rewrite evidence or keys.
        report = inspect_journal(journal)
        assert report.classifications.partially_redacted == 1
        assert report.actions[0].retained_parameter_names == ("customer_id",)
        assert journal.read_bytes() == before_journal
        assert _home_file_bytes(igris_home) == before_home

        assert main(["evidence", "sync", str(journal)]) == EXIT_PRIVACY_ACK_REQUIRED
        assert journal.read_bytes() == before_journal

    def test_allow_unredacted_permits_only_the_current_invocation(self, igris_home, allow_provider):
        def tag_record(record_id: str):
            return record_id

        wrapped = wrap_tool(
            tag_record, action="alpha2.record.tag", approval_provider=allow_provider
        )
        wrapped("retained-ordinary-value")

        journal = default_journal_path()
        original_events = [json.loads(line) for line in journal.read_text("utf-8").splitlines()]

        acknowledged = RecordingEvidenceClient()
        report = sync_journal(client=acknowledged, allow_unredacted=True)
        assert report.events_uploaded == len(original_events)
        assert acknowledged.calls[0][3] == original_events

        # The acknowledgement is not persisted: the next sync refuses again.
        refused = RecordingEvidenceClient()
        with pytest.raises(EvidencePrivacyPreflightError):
            sync_journal(client=refused)
        assert refused.calls == []

    def test_wrapped_async_tool_journal_classifies_correctly(self, igris_home, allow_provider):
        async def transfer(amount: int, access_token: str):
            return amount

        wrapped = wrap_tool(
            transfer, action="alpha2.transfer.async", approval_provider=allow_provider
        )
        assert _run_async(wrapped(250, access_token="secret-value")) == 250

        report = inspect_journal(default_journal_path())
        assert report.decision_count == 1
        assert report.succeeded_count == 1
        assert report.actions[0].classification is PrivacyClassification.PARTIALLY_REDACTED
        assert report.actions[0].retained_parameter_names == ("amount",)
        assert not report.safe_for_upload

    def test_denied_wrapped_tool_never_runs_and_is_classified(self, igris_home, deny_provider):
        calls = []

        def delete_everything(scope: str):
            calls.append(scope)

        wrapped = wrap_tool(
            delete_everything, action="alpha2.delete", approval_provider=deny_provider
        )
        with pytest.raises(igris.ActionDenied):
            wrapped("all")
        assert calls == []

        report = inspect_journal(default_journal_path())
        assert (report.denied_count, report.outcome_count) == (1, 0)

    def test_failed_wrapped_tool_is_locally_verifiable_and_classified(
        self, igris_home, allow_provider
    ):
        def flaky(target: str):
            raise RuntimeError("downstream unavailable")

        wrapped = wrap_tool(flaky, action="alpha2.flaky", approval_provider=allow_provider)
        with pytest.raises(RuntimeError, match="downstream unavailable"):
            wrapped("synthetic-target")

        events = read_events(igris_home)
        assert [e["event_type"] for e in events] == ["decision", "outcome"]
        assert events[1]["status"] == "failed"

        identity = LocalSigningIdentity.load_or_create()
        assert verify_journal(default_journal_path(), identity.public_key()).valid
        report = inspect_journal(default_journal_path())
        assert report.failed_count == 1

    def test_tampered_wrapped_journal_fails_before_classification_or_network(
        self, igris_home, allow_provider, monkeypatch
    ):
        def ping(host_label: str):
            return host_label

        wrapped = wrap_tool(ping, action="alpha2.ping", approval_provider=allow_provider)
        wrapped("synthetic-host")

        journal = default_journal_path()
        tampered = journal.read_bytes().replace(b'"risk":"medium"', b'"risk":"high"', 1)
        journal.write_bytes(tampered)

        with pytest.raises(EvidencePrivacyInspectionError):
            inspect_journal(journal)

        _forbid_network_setup(monkeypatch)
        client = RecordingEvidenceClient()
        with pytest.raises(igris.IgrisError) as exc_info:
            sync_journal(client=client)
        assert client.calls == []
        # Verification failed before the privacy layer even ran.
        assert not isinstance(exc_info.value, EvidencePrivacyPreflightError)


# ---------------------------------------------------------------------------
# Decorator vs wrapper declaration styles
# ---------------------------------------------------------------------------


class TestDeclarationStyles:
    def test_switching_style_changes_contract_hash_and_connected_version(self, igris_home):
        from igris import connected

        connected._SYNC_CACHE.clear()
        client = RecordingContractClient()

        @igris.guard(
            action="alpha2.style",
            approval_provider=StaticProvider("allowed"),
            sync_client=client,
        )
        def decorated_style(item_id: str):
            return item_id

        def wrapped_style(item_id: str):
            return item_id

        wrapped = wrap_tool(
            wrapped_style,
            action="alpha2.style2",
            approval_provider=StaticProvider("allowed"),
            sync_client=client,
        )

        decorated_style("a")
        wrapped("b")

        dec_contract = decorated_style.__igris_contract__
        wrap_contract = wrapped.__igris_contract__
        # Semantic fields match; the hash differs because contract identity
        # includes module/qualified-name/code fingerprint.  Switching the
        # declaration style therefore registers as a new Connected contract
        # version rather than silently reusing the old one.
        assert dec_contract.parameter_descriptors == wrap_contract.parameter_descriptors
        assert dec_contract.contract_hash != wrap_contract.contract_hash
        assert [c.contract_hash for c in client.contracts] == [
            dec_contract.contract_hash,
            wrap_contract.contract_hash,
        ]
        connected._SYNC_CACHE.clear()

    def test_neither_style_uploads_evidence_automatically(self, igris_home, allow_provider):
        @igris.guard(action="alpha2.noauto.dec", approval_provider=allow_provider)
        def decorated(x: int):
            return x

        def plain(x: int):
            return x

        wrapped = wrap_tool(plain, action="alpha2.noauto.wrap", approval_provider=allow_provider)
        # The autouse socket guard fails the test if either path touches the
        # network; executing both proves evidence stays local until an
        # explicit sync call.
        assert decorated(1) == 1
        assert wrapped(2) == 2
        assert len(read_events(igris_home)) == 4


# ---------------------------------------------------------------------------
# Async semantics
# ---------------------------------------------------------------------------


class TestAsyncSemantics:
    def test_guard_decorator_still_rejects_async_functions(self, igris_home):
        with pytest.raises(UnsupportedFunctionError, match="async"):

            @igris.guard(action="alpha2.asym")
            async def not_supported():  # pragma: no cover - never runs
                return None

    def test_wrap_tool_accepts_the_same_async_function(self, igris_home, allow_provider):
        async def supported(x: int):
            return x + 1

        wrapped = wrap_tool(supported, action="alpha2.asym.wrap", approval_provider=allow_provider)
        assert _run_async(wrapped(1)) == 2

    def test_cancellation_propagates_and_leaves_verifiable_journal(
        self, igris_home, allow_provider
    ):
        started = []

        async def long_running(job_id: str):
            started.append(job_id)
            await asyncio.sleep(30)

        wrapped = wrap_tool(long_running, action="alpha2.cancel", approval_provider=allow_provider)

        async def cancel_mid_flight():
            task = asyncio.ensure_future(wrapped("job-1"))
            await asyncio.sleep(0)  # let the wrapper start the original
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task

        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            _run_async(cancel_mid_flight())
        assert not [w for w in caught if "never awaited" in str(w.message)]

        assert started == ["job-1"]
        # Cancellation is not an ordinary failure: the decision event stands,
        # no fabricated outcome is signed, and the journal remains verifiable.
        events = read_events(igris_home)
        assert [e["event_type"] for e in events] == ["decision"]
        identity = LocalSigningIdentity.load_or_create()
        assert verify_journal(default_journal_path(), identity.public_key()).valid
        assert inspect_journal(default_journal_path()).decision_count == 1

    def test_async_completion_awaits_exactly_once(self, igris_home, allow_provider):
        awaited = []

        async def original(x: int):
            awaited.append(x)
            return x * 10

        wrapped = wrap_tool(original, action="alpha2.once", approval_provider=allow_provider)
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            assert _run_async(wrapped(4)) == 40
        assert awaited == [4]
        assert not [w for w in caught if "never awaited" in str(w.message)]

    def test_async_denial_and_exception_paths(self, igris_home):
        ran = []

        async def guarded(x: int):
            ran.append(x)
            if x < 0:
                raise ValueError("negative")
            return x

        denied = wrap_tool(
            guarded, action="alpha2.adeny", approval_provider=StaticProvider("denied")
        )
        with pytest.raises(igris.ActionDenied):
            _run_async(denied(1))
        assert ran == []

        async def failing(x: int):
            raise ValueError("negative")

        allowed = wrap_tool(
            failing, action="alpha2.afail", approval_provider=StaticProvider("allowed")
        )
        with pytest.raises(ValueError, match="negative"):
            _run_async(allowed(-1))
        events = read_events(igris_home)
        assert events[-1]["event_type"] == "outcome"
        assert events[-1]["status"] == "failed"


# ---------------------------------------------------------------------------
# Collection forms with non-plain callables
# ---------------------------------------------------------------------------


class TestCollectionMappingForms:
    def test_mapping_form_wraps_partials_and_callable_objects(self, igris_home, allow_provider):
        def base(scope: str, page: int):
            return f"{scope}:{page}"

        class Search:
            def __call__(self, query: str):
                return f"hit:{query}"

        tools = {
            "list_page": functools.partial(base, "customers"),
            "search": Search(),
        }
        wrapped = wrap_tools(
            tools,
            configuration={
                "list_page": {"action": "alpha2.col.list", "approval_provider": allow_provider},
                "search": {"action": "alpha2.col.search", "approval_provider": allow_provider},
            },
        )
        assert set(wrapped) == {"list_page", "search"}
        assert wrapped["list_page"](3) == "customers:3"
        assert wrapped["search"]("blue") == "hit:blue"
        assert tools["list_page"].func is base, "input mapping values must be untouched"

        events = read_events(igris_home)
        assert [e["action_name"] for e in events if e["event_type"] == "decision"] == [
            "alpha2.col.list",
            "alpha2.col.search",
        ]
        report = inspect_journal(default_journal_path())
        assert report.decision_count == 2
