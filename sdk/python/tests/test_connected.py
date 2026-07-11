"""Connected contract synchronization: configuration, trigger, and failure semantics.

Every test runs under the autouse socket guard from conftest.py, so any code
path that would actually touch the network fails loudly. HTTP behavior is
exercised through the injectable opener; guard behavior through injectable
sync clients.
"""

from __future__ import annotations

import io
import json
import urllib.error

import pytest
from conftest import StaticProvider, read_events

import igris
from igris import connected
from igris.connected import (
    ConnectedConfig,
    ContractSyncResult,
    HttpContractSyncClient,
    contract_wire_payload,
    derive_idempotency_key,
    ensure_contract_synced,
    load_connected_config,
)

TOKEN = "igris_test_token_v1_not_real"


@pytest.fixture(autouse=True)
def _clean_state(monkeypatch):
    """Isolate the in-process sync cache and Connected env between tests."""
    monkeypatch.delenv("IGRIS_API_URL", raising=False)
    monkeypatch.delenv("IGRIS_API_KEY", raising=False)
    connected._SYNC_CACHE.clear()
    yield
    connected._SYNC_CACHE.clear()


class RecordingSyncClient:
    cache_scope = "recording://test"

    def __init__(self, fail_with: Exception | None = None):
        self.contracts = []
        self.fail_with = fail_with

    def sync_contract(self, contract):
        self.contracts.append(contract)
        if self.fail_with is not None:
            raise self.fail_with
        return ContractSyncResult(
            action_name=contract.action_name,
            contract_hash=contract.contract_hash,
            created=True,
        )


class FakeHTTPResponse:
    def __init__(self, status: int, body: dict):
        self.status = status
        self._body = json.dumps(body).encode("utf-8")

    def getcode(self):
        return self.status

    def read(self):
        return self._body


def make_http_error(status: int, body: dict) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(
        url="https://igris.test/v1/contracts/sync",
        code=status,
        msg="error",
        hdrs=None,
        fp=io.BytesIO(json.dumps(body).encode("utf-8")),
    )


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


class TestConnectedConfiguration:
    def test_no_configuration_means_disabled(self):
        assert load_connected_config({}) is None
        assert connected.resolve_connected_client() is None

    def test_endpoint_without_token_fails_before_execution(self, monkeypatch, igris_home):
        monkeypatch.setenv("IGRIS_API_URL", "https://igris.example")
        calls = []

        @igris.guard(action="tests.partial.endpoint", approval_provider=StaticProvider("allowed"))
        def act():
            calls.append(1)

        with pytest.raises(igris.ConnectedConfigurationError) as excinfo:
            act()
        assert calls == [], "the consequential function must not execute"
        assert excinfo.value.execution_occurred is False
        assert read_events(igris_home) == [], "nothing may be recorded before a config failure"

    def test_token_without_endpoint_fails_before_execution(self, monkeypatch, igris_home):
        monkeypatch.setenv("IGRIS_API_KEY", TOKEN)
        calls = []

        @igris.guard(action="tests.partial.token", approval_provider=StaticProvider("allowed"))
        def act():
            calls.append(1)

        with pytest.raises(igris.ConnectedConfigurationError) as excinfo:
            act()
        assert calls == []
        assert TOKEN not in str(excinfo.value), "credentials must never appear in errors"
        assert read_events(igris_home) == []

    def test_http_endpoint_rejected_unless_local(self):
        with pytest.raises(igris.ConnectedConfigurationError):
            load_connected_config({"IGRIS_API_URL": "http://igris.example", "IGRIS_API_KEY": TOKEN})
        config = load_connected_config(
            {"IGRIS_API_URL": "http://localhost:8080", "IGRIS_API_KEY": TOKEN}
        )
        assert config is not None
        assert config.endpoint == "http://localhost:8080"

    def test_non_http_scheme_rejected(self):
        with pytest.raises(igris.ConnectedConfigurationError):
            load_connected_config({"IGRIS_API_URL": "ftp://igris.example", "IGRIS_API_KEY": TOKEN})

    def test_token_not_in_config_repr(self):
        config = ConnectedConfig(endpoint="https://igris.example", token=TOKEN)
        assert TOKEN not in repr(config)


# ---------------------------------------------------------------------------
# Guard-integrated synchronization trigger
# ---------------------------------------------------------------------------


class TestGuardSynchronization:
    def test_first_invocation_syncs_before_approval_and_execution(self, igris_home):
        order = []
        client = RecordingSyncClient()

        class OrderedProvider:
            def decide(self, request):
                order.append("approval")
                from igris.approval import ApprovalDecision

                return ApprovalDecision("allowed", "test")

        original_sync = client.sync_contract
        client.sync_contract = lambda contract: (order.append("sync"), original_sync(contract))[1]

        @igris.guard(
            action="tests.connected.order",
            approval_provider=OrderedProvider(),
            sync_client=client,
        )
        def act():
            order.append("execute")
            return "ok"

        assert act() == "ok"
        assert order == ["sync", "approval", "execute"]

    def test_successful_sync_continues_embedded_flow(self, igris_home):
        client = RecordingSyncClient()

        @igris.guard(
            action="tests.connected.flow",
            approval_provider=StaticProvider("allowed"),
            sync_client=client,
        )
        def act(amount: int):
            return amount * 2

        assert act(21) == 42
        events = read_events(igris_home)
        assert [e["event_type"] for e in events] == ["decision", "outcome"]
        assert events[0]["decision"] == "allowed"
        assert events[1]["status"] == "succeeded"

    def test_repeat_invocation_uses_in_process_cache(self, igris_home):
        client = RecordingSyncClient()

        @igris.guard(
            action="tests.connected.cache",
            approval_provider=StaticProvider("allowed"),
            sync_client=client,
        )
        def act():
            return "ok"

        act()
        act()
        act()
        assert len(client.contracts) == 1, "one sync per contract version per process"

    def test_distinct_contracts_sync_separately(self, igris_home):
        client = RecordingSyncClient()
        provider = StaticProvider("allowed")

        @igris.guard(action="tests.connected.first", approval_provider=provider, sync_client=client)
        def first():
            return 1

        @igris.guard(
            action="tests.connected.second", approval_provider=provider, sync_client=client
        )
        def second():
            return 2

        first()
        second()
        hashes = {c.contract_hash for c in client.contracts}
        assert len(client.contracts) == 2
        assert len(hashes) == 2

    def test_cache_is_scoped_by_destination(self, igris_home):
        provider = StaticProvider("allowed")
        client_a = RecordingSyncClient()
        client_a.cache_scope = "https://endpoint-a"
        client_b = RecordingSyncClient()
        client_b.cache_scope = "https://endpoint-b"

        @igris.guard(
            action="tests.connected.scope", approval_provider=provider, sync_client=client_a
        )
        def act_a():
            return "a"

        act_a()
        # Same contract identity toward a different destination must re-sync.
        contract = act_a.__igris_contract__
        ensure_contract_synced(contract, client_b)
        assert len(client_a.contracts) == 1
        assert len(client_b.contracts) == 1

    def test_only_contract_data_is_sent(self, igris_home):
        client = RecordingSyncClient()

        @igris.guard(
            action="tests.connected.payload",
            approval_provider=StaticProvider("allowed"),
            sync_client=client,
        )
        def act(customer_id: str, api_key: str):
            return "ok"

        act("cus_1", api_key="super-secret-value")
        payload = contract_wire_payload(client.contracts[0])
        assert set(payload) == {
            "schema_version",
            "action_name",
            "module",
            "qualified_name",
            "risk",
            "approval_mode",
            "execution_mode",
            "parameter_descriptors",
            "code_fingerprint",
            "contract_hash",
        }
        raw = json.dumps(payload)
        assert "super-secret-value" not in raw, "argument values must never be sent"
        assert "cus_1" not in raw


class TestGuardSyncFailures:
    @pytest.mark.parametrize(
        "failure",
        [
            igris.ContractSyncError(
                "auth rejected; did NOT execute", status_code=401, retry_safe=False
            ),
            igris.ContractSyncError(
                "validation failed; did NOT execute", status_code=422, retry_safe=False
            ),
            igris.ContractSyncConflictError("conflict; did NOT execute"),
            igris.ContractSyncError("timed out; did NOT execute", retry_safe=True),
            igris.ContractSyncError("transport failure; did NOT execute", retry_safe=True),
        ],
        ids=["auth", "validation", "idempotency-conflict", "timeout", "transport"],
    )
    def test_sync_failure_prevents_execution(self, igris_home, failure):
        client = RecordingSyncClient(fail_with=failure)
        calls = []

        @igris.guard(
            action="tests.connected.failure",
            approval_provider=StaticProvider("allowed"),
            sync_client=client,
        )
        def act():
            calls.append(1)

        with pytest.raises(type(failure)) as excinfo:
            act()
        assert calls == [], "the consequential function must never run after a sync failure"
        assert excinfo.value.execution_occurred is False
        assert read_events(igris_home) == [], "no event may be recorded for a prevented execution"

    def test_no_silent_fallback_after_failure(self, igris_home):
        failure = igris.ContractSyncError("boom; did NOT execute", retry_safe=True)
        client = RecordingSyncClient(fail_with=failure)

        @igris.guard(
            action="tests.connected.nofallback",
            approval_provider=StaticProvider("allowed"),
            sync_client=client,
        )
        def act():
            return "must not happen"

        with pytest.raises(igris.ContractSyncError):
            act()
        with pytest.raises(igris.ContractSyncError):
            act()
        assert len(client.contracts) == 2, "failures are never cached; every call retries the sync"

    def test_env_configured_guard_uses_http_client(self, monkeypatch, igris_home):
        captured = {}

        def fake_urlopen(request, timeout=None):
            captured["url"] = request.full_url
            captured["auth"] = request.get_header("Authorization")
            captured["idempotency"] = request.get_header("Idempotency-key")
            captured["body"] = json.loads(request.data.decode("utf-8"))
            captured["timeout"] = timeout
            body = {
                "action": {"action_name": "tests.connected.env"},
                "version": {"contract_hash": "x", "created": True},
                "grants": {"execution_permission": False},
            }
            return FakeHTTPResponse(201, body)

        class FakeOpener:
            open = staticmethod(fake_urlopen)

        handlers = []

        def fake_build_opener(*args):
            handlers.extend(args)
            return FakeOpener()

        monkeypatch.setenv("IGRIS_API_URL", "https://igris.example")
        monkeypatch.setenv("IGRIS_API_KEY", TOKEN)
        monkeypatch.setattr(connected.urllib.request, "build_opener", fake_build_opener)

        @igris.guard(action="tests.connected.env", approval_provider=StaticProvider("allowed"))
        def act():
            return "ok"

        assert act() == "ok"
        assert captured["url"] == "https://igris.example/v1/contracts/sync"
        assert captured["auth"] == "Bearer " + TOKEN
        assert captured["idempotency"].startswith("sdk-")
        assert set(captured["body"]) == {"contract", "client"}
        assert captured["body"]["client"]["sdk"] == "igris-python"
        assert captured["timeout"] == connected.DEFAULT_TIMEOUT_SECONDS
        assert len(handlers) == 1
        assert isinstance(handlers[0], connected._NoRedirectHandler)


# ---------------------------------------------------------------------------
# HTTP client behavior (fake opener; no sockets)
# ---------------------------------------------------------------------------


def make_client(opener) -> HttpContractSyncClient:
    config = ConnectedConfig(endpoint="https://igris.example", token=TOKEN)
    return HttpContractSyncClient(config, opener=opener)


def sample_contract():
    @igris.guard(action="tests.http.sample", approval_provider=StaticProvider("allowed"))
    def sample(a: int, b: str = "x"):
        return a

    return sample.__igris_contract__


class TestHttpContractSyncClient:
    def test_success_parses_result_and_sets_headers(self):
        seen = {}

        def opener(request, timeout=None):
            seen["method"] = request.get_method()
            seen["content_type"] = request.get_header("Content-type")
            seen["auth"] = request.get_header("Authorization")
            seen["key"] = request.get_header("Idempotency-key")
            seen["body"] = json.loads(request.data.decode("utf-8"))
            return FakeHTTPResponse(201, {"version": {"contract_hash": "abc123", "created": True}})

        contract = sample_contract()
        result = make_client(opener).sync_contract(contract)
        assert result.created is True
        assert result.contract_hash == "abc123"
        assert seen["method"] == "POST"
        assert seen["content_type"] == "application/json"
        assert seen["auth"] == "Bearer " + TOKEN
        assert seen["key"] == derive_idempotency_key(contract)
        assert set(seen["body"]) == {"contract", "client"}

    def test_idempotency_key_is_stable_across_retries(self):
        contract = sample_contract()
        assert derive_idempotency_key(contract) == derive_idempotency_key(contract)
        assert len(derive_idempotency_key(contract)) <= 128

    @pytest.mark.parametrize("status", [301, 302, 303, 307, 308])
    def test_redirect_status_is_typed_and_never_followed(self, status):
        calls = []

        def opener(request, timeout=None):
            calls.append(request)
            return FakeHTTPResponse(status, {})

        with pytest.raises(igris.ContractSyncError) as excinfo:
            make_client(opener).sync_contract(sample_contract())
        error = excinfo.value
        assert len(calls) == 1
        assert calls[0].full_url == "https://igris.example/v1/contracts/sync"
        assert error.status_code == status
        assert error.error_code == "redirect_refused"
        assert error.execution_occurred is False
        assert error.retry_safe is False
        assert TOKEN not in str(error)

    @pytest.mark.parametrize(
        "target",
        [
            "http://igris.example/downgrade",
            "https://other.example/cross-origin",
        ],
    )
    def test_redirect_handler_creates_no_target_request_or_authorization(self, target):
        handler = connected._NoRedirectHandler()
        original = urllib.request.Request(
            "https://igris.example/v1/contracts/sync",
            headers={"Authorization": "Bearer " + TOKEN},
        )
        redirected = handler.redirect_request(original, None, 302, "Found", {}, target)
        assert redirected is None

    def test_redirect_failure_prevents_execution_and_journal_write(self, igris_home):
        client = make_client(lambda request, timeout=None: FakeHTTPResponse(302, {}))
        calls = []

        @igris.guard(
            action="tests.connected.redirect",
            approval_provider=StaticProvider("allowed"),
            sync_client=client,
        )
        def act():
            calls.append(1)

        with pytest.raises(igris.ContractSyncError) as excinfo:
            act()
        assert excinfo.value.error_code == "redirect_refused"
        assert calls == []
        assert read_events(igris_home) == []

    def test_authentication_failure(self):
        def opener(request, timeout=None):
            raise make_http_error(401, {"error": "unauthenticated"})

        with pytest.raises(igris.ContractSyncError) as excinfo:
            make_client(opener).sync_contract(sample_contract())
        error = excinfo.value
        assert error.status_code == 401
        assert error.retry_safe is False
        assert error.execution_occurred is False
        assert "did NOT execute" in str(error)
        assert TOKEN not in str(error)

    def test_validation_failure(self):
        def opener(request, timeout=None):
            raise make_http_error(
                422, {"error": "contract_hash_mismatch", "detail": "supplied hash is wrong"}
            )

        with pytest.raises(igris.ContractSyncError) as excinfo:
            make_client(opener).sync_contract(sample_contract())
        assert excinfo.value.error_code == "contract_hash_mismatch"
        assert excinfo.value.retry_safe is False

    def test_idempotency_conflict(self):
        def opener(request, timeout=None):
            raise make_http_error(409, {"error": "idempotency_key_conflict"})

        with pytest.raises(igris.ContractSyncConflictError) as excinfo:
            make_client(opener).sync_contract(sample_contract())
        assert excinfo.value.retry_safe is False
        assert excinfo.value.error_code == "idempotency_key_conflict"

    @pytest.mark.parametrize("status", [429, 500, 503])
    def test_retry_safe_statuses(self, status):
        def opener(request, timeout=None):
            raise make_http_error(
                status, {"error": "rate_limited" if status == 429 else "db_error"}
            )

        with pytest.raises(igris.ContractSyncError) as excinfo:
            make_client(opener).sync_contract(sample_contract())
        assert excinfo.value.retry_safe is True

    def test_timeout(self):
        def opener(request, timeout=None):
            raise TimeoutError("timed out")

        with pytest.raises(igris.ContractSyncError) as excinfo:
            make_client(opener).sync_contract(sample_contract())
        assert excinfo.value.retry_safe is True
        assert "did NOT execute" in str(excinfo.value)

    def test_transport_failure(self):
        def opener(request, timeout=None):
            raise urllib.error.URLError(OSError("connection refused"))

        with pytest.raises(igris.ContractSyncError) as excinfo:
            make_client(opener).sync_contract(sample_contract())
        assert excinfo.value.retry_safe is True
        assert TOKEN not in str(excinfo.value)

    def test_unreadable_success_body(self):
        class BrokenResponse(FakeHTTPResponse):
            def read(self):
                return b"not json"

        def opener(request, timeout=None):
            return BrokenResponse(200, {})

        with pytest.raises(igris.ContractSyncError) as excinfo:
            make_client(opener).sync_contract(sample_contract())
        assert excinfo.value.retry_safe is True


# ---------------------------------------------------------------------------
# Zero-network Embedded default (regression)
# ---------------------------------------------------------------------------


class TestEmbeddedDefaultUnchanged:
    def test_unconfigured_guard_performs_no_sync_and_no_network(self, igris_home):
        # The autouse socket guard would fail this test on ANY socket use.
        @igris.guard(action="tests.embedded.default", approval_provider=StaticProvider("allowed"))
        def act(amount: int):
            return amount

        assert act(7) == 7
        events = read_events(igris_home)
        assert [e["event_type"] for e in events] == ["decision", "outcome"]
        assert connected._SYNC_CACHE == set(), "no sync may be recorded without configuration"

    def test_execution_completed_evidence_error_still_public_and_non_retryable(self):
        error = igris.ExecutionCompletedEvidenceError(
            "post-execution evidence failure",
            action_id="a",
            decision_event_id="d",
            function_outcome="succeeded",
            result=1,
        )
        assert error.execution_occurred is True
        assert error.retry_safe is False
