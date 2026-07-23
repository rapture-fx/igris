"""Unit tests for the explicit durable Igris client.

Every test runs under the autouse socket guard from conftest.py. HTTP behavior
is exercised only through an injectable opener — never real network.
"""

from __future__ import annotations

import io
import json
import urllib.error

import pytest
from conftest import read_events

import igris
from igris import (
    AuthenticationError,
    BindingConflictError,
    ContractBinding,
    DurableConfigurationError,
    DurableTimeoutError,
    EvidenceNotLinkableError,
    IdempotencyConflictError,
    IgrisDurableClient,
    IgrisRunProof,
    ReconciliationRequiredError,
    UnboundActionError,
    wrap_tool,
)

ENDPOINT = "https://igris.example"
API_KEY = "igris_secret_token_do_not_leak"
CONTRACT_HASH = "a" * 64
ACTION_NAME = "tests.durable.refund"
TARGET_ACTION_ID = "act_target_1"
RUN_ID = "run_abc123"


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    monkeypatch.delenv("IGRIS_API_URL", raising=False)
    monkeypatch.delenv("IGRIS_API_KEY", raising=False)


class FakeHTTPResponse:
    def __init__(self, status: int, body: dict):
        self.status = status
        self._body = json.dumps(body).encode("utf-8")

    def getcode(self):
        return self.status

    def read(self):
        return self._body


def make_http_error(
    status: int, body: dict, url: str = "https://igris.example/v1"
) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(
        url=url,
        code=status,
        msg="error",
        hdrs=None,
        fp=io.BytesIO(json.dumps(body).encode("utf-8")),
    )


def sample_binding_body(**overrides) -> dict:
    body = {
        "id": "bind_1",
        "action_name": ACTION_NAME,
        "contract_hash": CONTRACT_HASH,
        "target_action_id": TARGET_ACTION_ID,
        "target_version_hash": "b" * 64,
        "input_mapping": {"amount": "amount_cents"},
        "endpoint_config_ref": None,
        "timeout_ms": 30_000,
        "replay_class": "retryable",
        "idempotency_required": True,
        "created_at": "2026-01-01T00:00:00Z",
        "immutable": True,
    }
    body.update(overrides)
    return body


def sample_run_status_body(**overrides) -> dict:
    body = {
        "run_id": RUN_ID,
        "task_id": "task_1",
        "status": "running",
        "proof_status": None,
        "durable_execution_status": "running",
        "managed_decision_status": None,
        "recovery_status": None,
        "run_linkage_status": None,
        "execution_id": "exec_1",
        "action_name": ACTION_NAME,
        "result": None,
        "error": None,
        "message": None,
    }
    body.update(overrides)
    return body


def sample_proof_body(**overrides) -> dict:
    body = {
        "schema": "igris_run_proof.v1",
        "product_term": "Igris Run Proof",
        "run_id": RUN_ID,
        "task_id": "task_1",
        "action_name": ACTION_NAME,
        "contract_hash": CONTRACT_HASH,
        "binding_id": "bind_1",
        "target_action_id": TARGET_ACTION_ID,
        "target_version_hash": "b" * 64,
        "business_idempotency_key": "biz-key-1",
        "statuses": {"run": "completed", "proof": "available"},
        "claim_boundary": {
            "runtime_receipt": (
                "separate Runtime-signed managed execution claim; does not prove "
                "external side-effect uniqueness or Action Protocol chain validity"
            ),
            "action_protocol_evidence": (
                "separate SDK-signed decision/outcome claim; does not prove managed "
                "dispatch or Runtime recovery"
            ),
            "external_effect": (
                "neither cryptographic claim independently proves the external effect"
            ),
            "linked_view": (
                "Igris Run Proof joins claims for one durable run; it is not "
                "protocol-level cryptographic unification"
            ),
            "run_scoped_evidence": (
                "server eligibility requires tenant, action_name, contract_hash, "
                "decision input_hash match"
            ),
        },
        "runtime_proof": {"kind": "runtime_receipt", "digest": "rr_1"},
        "action_protocol_evidence": {"kind": "evidence", "batch_id": "batch_1"},
        "recovery_lineage": [],
        "latest_runtime_handoff": None,
    }
    body.update(overrides)
    return body


def make_client(opener) -> IgrisDurableClient:
    return IgrisDurableClient(endpoint=ENDPOINT, api_key=API_KEY, opener=opener)


# ---------------------------------------------------------------------------
# Configuration / execution profile
# ---------------------------------------------------------------------------


class TestDurableConfiguration:
    def test_requires_explicit_endpoint_and_api_key(self):
        with pytest.raises(DurableConfigurationError) as excinfo:
            IgrisDurableClient()
        assert "endpoint" in str(excinfo.value).lower() or "api_key" in str(excinfo.value).lower()

    def test_partial_constructor_rejected(self):
        with pytest.raises(DurableConfigurationError):
            IgrisDurableClient(endpoint=ENDPOINT)
        with pytest.raises(DurableConfigurationError):
            IgrisDurableClient(api_key=API_KEY)

    def test_from_env_requires_both_env_vars(self, monkeypatch):
        with pytest.raises(DurableConfigurationError):
            IgrisDurableClient.from_env({})

        monkeypatch.setenv("IGRIS_API_URL", ENDPOINT)
        with pytest.raises(DurableConfigurationError) as excinfo:
            IgrisDurableClient.from_env()
        assert "IGRIS_API_KEY" in str(excinfo.value) or "api_key" in str(excinfo.value).lower()
        assert API_KEY not in str(excinfo.value)

        monkeypatch.delenv("IGRIS_API_URL", raising=False)
        monkeypatch.setenv("IGRIS_API_KEY", API_KEY)
        with pytest.raises(DurableConfigurationError) as excinfo:
            IgrisDurableClient.from_env()
        assert API_KEY not in str(excinfo.value)

    def test_from_env_succeeds_with_both(self, monkeypatch):
        monkeypatch.setenv("IGRIS_API_URL", ENDPOINT)
        monkeypatch.setenv("IGRIS_API_KEY", API_KEY)
        client = IgrisDurableClient.from_env(opener=lambda *a, **k: FakeHTTPResponse(200, {}))
        assert isinstance(client, IgrisDurableClient)

    def test_api_url_alone_does_not_make_wrap_tool_durable(
        self, monkeypatch, igris_home, allow_provider
    ):
        """IGRIS_API_URL alone never switches Embedded wrap_tool to durable/remote.

        Durable execution requires an explicit ``IgrisDurableClient``. Partial
        Connected env still fails before any remote durable path; with no
        Connected env, wrap_tool remains fully local and writes journal events.
        """
        monkeypatch.setenv("IGRIS_API_URL", ENDPOINT)

        def refund(amount: int) -> int:
            return amount

        tool = wrap_tool(refund, action="tests.durable.partial", approval_provider=allow_provider)
        with pytest.raises(igris.ConnectedConfigurationError):
            tool(5)
        assert read_events(igris_home) == []

        # from_env also rejects URL-only — durable client stays separate/explicit
        with pytest.raises(DurableConfigurationError):
            IgrisDurableClient.from_env()

        monkeypatch.delenv("IGRIS_API_URL", raising=False)
        local = wrap_tool(refund, action="tests.durable.local", approval_provider=allow_provider)
        assert local(5) == 5
        events = read_events(igris_home)
        assert [e["event_type"] for e in events] == ["decision", "outcome"]
        assert events[0]["decision"] == "allowed"
        assert events[1]["status"] == "succeeded"

    def test_missing_idempotency_key_rejected(self):
        client = make_client(lambda *a, **k: FakeHTTPResponse(200, {}))
        with pytest.raises(DurableConfigurationError) as excinfo:
            client.run(ACTION_NAME, input={"amount": 1}, contract_hash=CONTRACT_HASH)
        assert "idempotency_key" in str(excinfo.value)

        with pytest.raises(DurableConfigurationError):
            client.run(
                ACTION_NAME,
                input={"amount": 1},
                contract_hash=CONTRACT_HASH,
                idempotency_key="   ",
            )

    def test_name_only_binding_rejected(self):
        client = make_client(lambda *a, **k: FakeHTTPResponse(200, {}))
        with pytest.raises(DurableConfigurationError) as excinfo:
            client.create_binding(
                action_name=ACTION_NAME,
                contract_hash="",
                target_action_id=TARGET_ACTION_ID,
                input_mapping={"amount": "amount_cents"},
            )
        assert "contract_hash" in str(excinfo.value)

        with pytest.raises(DurableConfigurationError):
            client.get_binding(ACTION_NAME, "")

        with pytest.raises(DurableConfigurationError):
            client.run(
                ACTION_NAME,
                input={"amount": 1},
                idempotency_key="k1",
                # no contract_hash
            )

    def test_missing_target_action_id_rejected(self):
        client = make_client(lambda *a, **k: FakeHTTPResponse(200, {}))
        with pytest.raises(DurableConfigurationError) as excinfo:
            client.create_binding(
                action_name=ACTION_NAME,
                contract_hash=CONTRACT_HASH,
                target_action_id="",
                input_mapping={"amount": "amount_cents"},
            )
        assert "target_action_id" in str(excinfo.value)

    def test_invalid_contract_hash_rejected(self):
        client = make_client(lambda *a, **k: FakeHTTPResponse(200, {}))
        with pytest.raises(DurableConfigurationError):
            client.get_binding(ACTION_NAME, "not-a-hash")


# ---------------------------------------------------------------------------
# HTTP client behaviors
# ---------------------------------------------------------------------------


class TestDurableHttpClient:
    def test_sync_contract(self, allow_provider):
        seen = {}

        def opener(request, timeout=None):
            seen["url"] = request.full_url
            seen["auth"] = request.get_header("Authorization")
            seen["body"] = json.loads(request.data.decode("utf-8"))
            return FakeHTTPResponse(
                201,
                {
                    "version": {"contract_hash": CONTRACT_HASH, "created": True},
                    "action": {"action_name": ACTION_NAME},
                },
            )

        @igris.guard(action=ACTION_NAME, approval_provider=allow_provider)
        def refund(amount: int):
            return amount

        client = make_client(opener)
        result = client.sync_contract(refund)
        assert result.contract_hash == CONTRACT_HASH
        assert result.created is True
        assert seen["url"] == f"{ENDPOINT}/v1/contracts/sync"
        assert seen["auth"] == f"Bearer {API_KEY}"
        assert "contract" in seen["body"]

    def test_get_binding(self):
        def opener(request, timeout=None):
            assert request.get_method() == "GET"
            assert CONTRACT_HASH in request.full_url
            return FakeHTTPResponse(200, sample_binding_body())

        binding = make_client(opener).get_binding(ACTION_NAME, CONTRACT_HASH)
        assert isinstance(binding, ContractBinding)
        assert binding.id == "bind_1"
        assert binding.action_name == ACTION_NAME
        assert binding.contract_hash == CONTRACT_HASH
        assert binding.target_action_id == TARGET_ACTION_ID
        assert binding.input_mapping == {"amount": "amount_cents"}
        assert binding.immutable is True

    def test_create_binding_requires_exact_hash_and_returns_binding(self):
        seen = {}

        def opener(request, timeout=None):
            seen["method"] = request.get_method()
            seen["url"] = request.full_url
            seen["body"] = json.loads(request.data.decode("utf-8"))
            return FakeHTTPResponse(201, sample_binding_body())

        binding = make_client(opener).create_binding(
            action_name=ACTION_NAME,
            contract_hash=CONTRACT_HASH,
            target_action_id=TARGET_ACTION_ID,
            input_mapping={"amount": "amount_cents"},
        )
        assert isinstance(binding, ContractBinding)
        assert binding.target_action_id == TARGET_ACTION_ID
        assert seen["method"] == "POST"
        assert f"/versions/{CONTRACT_HASH}/bindings" in seen["url"]
        assert seen["body"]["target_action_id"] == TARGET_ACTION_ID
        assert seen["body"]["idempotency_required"] is True

    def test_create_binding_maps_binding_exists(self):
        def opener(request, timeout=None):
            raise make_http_error(409, {"error": "binding_exists"})

        with pytest.raises(BindingConflictError) as excinfo:
            make_client(opener).create_binding(
                action_name=ACTION_NAME,
                contract_hash=CONTRACT_HASH,
                target_action_id=TARGET_ACTION_ID,
                input_mapping={"amount": "amount_cents"},
            )
        assert excinfo.value.error_code == "binding_exists"
        assert API_KEY not in str(excinfo.value)

    def test_run_rejects_unbound(self):
        def opener(request, timeout=None):
            # Pre-check get_binding → binding_not_found
            raise make_http_error(404, {"error": "binding_not_found"})

        with pytest.raises(UnboundActionError) as excinfo:
            make_client(opener).run(
                ACTION_NAME,
                input={"amount": 10},
                idempotency_key="biz-1",
                contract_hash=CONTRACT_HASH,
            )
        assert "binding" in str(excinfo.value).lower()

    def test_run_submission_success(self):
        calls = []

        def opener(request, timeout=None):
            calls.append(request.get_method() + " " + request.full_url)
            if request.get_method() == "GET":
                return FakeHTTPResponse(200, sample_binding_body())
            assert request.get_method() == "POST"
            body = json.loads(request.data.decode("utf-8"))
            assert body["idempotency_key"] == "biz-key-1"
            assert body["contract_hash"] == CONTRACT_HASH
            return FakeHTTPResponse(
                202,
                sample_run_status_body(status="accepted", durable_execution_status="accepted"),
            )

        handle = make_client(opener).run(
            ACTION_NAME,
            input={"amount": 10},
            idempotency_key="biz-key-1",
            contract_hash=CONTRACT_HASH,
        )
        assert handle.run_id == RUN_ID
        assert handle.last_status is not None
        assert handle.last_status.status == "accepted"
        assert any(c.startswith("GET ") for c in calls)
        assert any(c.startswith("POST ") for c in calls)

    def test_idempotency_key_conflict(self):
        def opener(request, timeout=None):
            if request.get_method() == "GET":
                return FakeHTTPResponse(200, sample_binding_body())
            raise make_http_error(409, {"error": "idempotency_key_conflict"})

        with pytest.raises(IdempotencyConflictError) as excinfo:
            make_client(opener).run(
                ACTION_NAME,
                input={"amount": 10},
                idempotency_key="reuse-key",
                contract_hash=CONTRACT_HASH,
            )
        assert excinfo.value.error_code == "idempotency_key_conflict"

    def test_get_run_status_and_recovering(self):
        def opener(request, timeout=None):
            return FakeHTTPResponse(
                200,
                sample_run_status_body(status="recovering", recovery_status="recovering"),
            )

        status = make_client(opener).get_run(RUN_ID)
        assert status.run_id == RUN_ID
        assert status.is_recovering is True
        assert status.is_terminal is False
        assert status.requires_reconciliation is False

    def test_reconciliation_required_on_status_and_wait(self, monkeypatch):
        def opener(request, timeout=None):
            return FakeHTTPResponse(
                200,
                sample_run_status_body(
                    status="reconciliation_required",
                    durable_execution_status="reconciliation_required",
                    recovery_status="reconciliation_required",
                ),
            )

        client = make_client(opener)
        handle = igris.DurableRun(client, run_id=RUN_ID)

        with pytest.raises(ReconciliationRequiredError) as excinfo:
            handle.status()
        assert excinfo.value.run_id == RUN_ID

        with pytest.raises(ReconciliationRequiredError):
            handle.wait(timeout=1.0, poll_interval=0.01)

    def test_reconciliation_required_from_top_level_flag_when_status_failed(self):
        """Clock 3D attaches reconciliation_required on GET run even when
        task.status remains failed — SDK must not miss that signal."""
        body = sample_run_status_body(
            status="failed",
            durable_execution_status="failed",
            recovery_status="present",
        )
        body["reconciliation_required"] = True
        body["reconciliation_status"] = "reconciliation_required"
        body["igris_run_proof"] = {
            "schema": "igris_run_proof.v1",
            "product_term": "Igris Run Proof",
            "run_id": RUN_ID,
            "statuses": {"reconciliation_status": "reconciliation_required"},
            "operator_reconciliation": {
                "claim_type": "operator_reconciliation",
                "cryptographic_proof": False,
                "reconciliation_required": True,
                "status": "reconciliation_required",
            },
        }
        status = igris.DurableRunStatus.from_response(body)
        assert status.status == "failed"
        assert status.requires_reconciliation is True

        def opener(request, timeout=None):
            return FakeHTTPResponse(200, body)

        handle = igris.DurableRun(make_client(opener), run_id=RUN_ID)
        with pytest.raises(ReconciliationRequiredError):
            handle.status()

    def test_wait_timeout(self, monkeypatch):
        monkeypatch.setattr("igris.durable.time.sleep", lambda _s: None)

        def opener(request, timeout=None):
            return FakeHTTPResponse(200, sample_run_status_body(status="running"))

        handle = igris.DurableRun(make_client(opener), run_id=RUN_ID)
        with pytest.raises(DurableTimeoutError) as excinfo:
            handle.wait(timeout=0.05, poll_interval=0.01)
        assert excinfo.value.run_id == RUN_ID
        assert "timed out" in str(excinfo.value).lower()

    def test_wait_terminal_completed(self, monkeypatch):
        monkeypatch.setattr("igris.durable.time.sleep", lambda _s: None)
        polls = {"n": 0}

        def opener(request, timeout=None):
            polls["n"] += 1
            if polls["n"] < 2:
                return FakeHTTPResponse(200, sample_run_status_body(status="running"))
            return FakeHTTPResponse(
                200,
                sample_run_status_body(
                    status="completed",
                    durable_execution_status="completed",
                    result={"ok": True},
                ),
            )

        status = igris.DurableRun(make_client(opener), run_id=RUN_ID).wait(
            timeout=5.0, poll_interval=0.01
        )
        assert status.status == "completed"
        assert status.is_terminal is True
        assert status.result == {"ok": True}

    def test_proof_returns_igris_run_proof_with_claim_boundary(self):
        proof_payload = sample_proof_body()

        def opener(request, timeout=None):
            return FakeHTTPResponse(
                200,
                sample_run_status_body(
                    status="completed",
                    durable_execution_status="completed",
                    igris_run_proof=proof_payload,
                ),
            )

        proof = igris.DurableRun(make_client(opener), run_id=RUN_ID).proof()
        assert isinstance(proof, IgrisRunProof)
        assert proof.schema == "igris_run_proof.v1"
        assert proof.run_id == RUN_ID
        assert proof.claim_boundary is not None
        assert proof.claim_boundary.runtime_receipt is not None
        assert proof.claim_boundary.action_protocol_evidence is not None
        assert "Runtime" in proof.claim_boundary.runtime_receipt
        assert proof.runtime_proof == {"kind": "runtime_receipt", "digest": "rr_1"}
        assert proof.action_protocol_evidence == {"kind": "evidence", "batch_id": "batch_1"}
        # Separate objects — not merged into one crypto proof blob
        assert proof.runtime_proof is not proof.action_protocol_evidence

    def test_evidence_not_linkable(self):
        def opener(request, timeout=None):
            raise make_http_error(
                409, {"error": "evidence_not_linkable", "detail": "hash mismatch"}
            )

        with pytest.raises(EvidenceNotLinkableError) as excinfo:
            make_client(opener).link_evidence(RUN_ID, "batch_xyz")
        assert excinfo.value.error_code == "evidence_not_linkable"
        assert "hash mismatch" in str(excinfo.value)

    def test_authentication_error_401(self):
        def opener(request, timeout=None):
            raise make_http_error(401, {"error": "unauthenticated"})

        with pytest.raises(AuthenticationError) as excinfo:
            make_client(opener).get_binding(ACTION_NAME, CONTRACT_HASH)
        assert excinfo.value.status_code == 401
        assert API_KEY not in str(excinfo.value)

    def test_credentials_never_appear_in_exception_messages(self):
        def opener(request, timeout=None):
            raise make_http_error(
                401,
                {
                    "error": "unauthenticated",
                    "detail": f"bad token {API_KEY} rejected",
                },
            )

        with pytest.raises(AuthenticationError) as excinfo:
            make_client(opener).get_run(RUN_ID)
        message = str(excinfo.value)
        assert API_KEY not in message
        assert "igris_secret_token_do_not_leak" not in message

        # Configuration errors also scrub
        with pytest.raises(DurableConfigurationError) as excinfo:
            IgrisDurableClient(endpoint=ENDPOINT, api_key="")
        assert API_KEY not in str(excinfo.value)


# ---------------------------------------------------------------------------
# Product facade: Igris (Action → Run → Proof)
# ---------------------------------------------------------------------------


class TestIgrisFacade:
    def test_public_import(self):
        from igris import Igris

        assert Igris is igris.Igris
        assert "Igris" in igris.__all__

    def test_from_env_and_delegation(self, monkeypatch):
        monkeypatch.setenv("IGRIS_API_URL", ENDPOINT)
        monkeypatch.setenv("IGRIS_API_KEY", API_KEY)
        facade = igris.Igris.from_env()
        assert isinstance(facade.durable, IgrisDurableClient)

        seen: list[str] = []

        def opener(request, timeout=None):
            seen.append(request.get_method() + " " + request.full_url)
            if request.full_url.endswith(f"/versions/{CONTRACT_HASH}/binding"):
                return FakeHTTPResponse(200, sample_binding_body())
            if request.get_method() == "POST" and request.full_url.endswith(
                f"/v1/actions/{ACTION_NAME}/run"
            ):
                body = json.loads(request.data.decode("utf-8"))
                assert body["idempotency_key"] == "biz-1"
                assert body["contract_hash"] == CONTRACT_HASH
                return FakeHTTPResponse(
                    202, sample_run_status_body(status="accepted", run_id=RUN_ID)
                )
            raise AssertionError(request.full_url)

        facade = igris.Igris(durable=make_client(opener))
        facade.remember_contract(ACTION_NAME, CONTRACT_HASH)
        run = facade.run(ACTION_NAME, input={"amount": 1}, idempotency_key="biz-1")
        assert run.run_id == RUN_ID
        assert any("/run" in s for s in seen)

    def test_run_requires_idempotency_key(self):
        facade = igris.Igris(durable=make_client(lambda *a, **k: FakeHTTPResponse(200, {})))
        facade.remember_contract(ACTION_NAME, CONTRACT_HASH)
        with pytest.raises(DurableConfigurationError) as excinfo:
            facade.run(ACTION_NAME, input={"amount": 1})
        assert "idempotency_key" in str(excinfo.value)

    def test_run_without_remembered_contract_raises(self):
        facade = igris.Igris(durable=make_client(lambda *a, **k: FakeHTTPResponse(200, {})))
        with pytest.raises(UnboundActionError):
            facade.run(ACTION_NAME, input={"amount": 1}, idempotency_key="k1")

    def test_configure_action_caches_hash_for_ordinary_run(self, allow_provider):
        state = {"bound": False}
        calls: list[str] = []

        def opener(request, timeout=None):
            calls.append(request.get_method() + " " + request.full_url)
            path = request.full_url
            if path.endswith("/v1/contracts/sync"):
                return FakeHTTPResponse(
                    201,
                    {
                        "version": {"contract_hash": CONTRACT_HASH, "created": True},
                        "action": {"action_name": ACTION_NAME},
                    },
                )
            if path.endswith(f"/versions/{CONTRACT_HASH}/binding"):
                if request.get_method() == "GET":
                    if not state["bound"]:
                        raise make_http_error(404, {"error": "binding_not_found"})
                    return FakeHTTPResponse(200, sample_binding_body())
            if (
                path.endswith(f"/versions/{CONTRACT_HASH}/bindings")
                and request.get_method() == "POST"
            ):
                state["bound"] = True
                return FakeHTTPResponse(201, sample_binding_body())
            if path.endswith(f"/v1/actions/{ACTION_NAME}/run"):
                body = json.loads(request.data.decode("utf-8"))
                assert body["contract_hash"] == CONTRACT_HASH
                assert body["idempotency_key"] == "k-config"
                return FakeHTTPResponse(
                    202, sample_run_status_body(status="accepted", run_id=RUN_ID)
                )
            raise AssertionError(path)

        facade = igris.Igris(durable=make_client(opener))

        @igris.guard(action=ACTION_NAME, approval_provider=allow_provider)
        def refund(amount: int):
            return amount

        binding = facade.configure_action(
            refund,
            target_action_id=TARGET_ACTION_ID,
            input_mapping={"amount": "amount_cents"},
        )
        assert binding.contract_hash == CONTRACT_HASH
        run = facade.run(ACTION_NAME, input={"amount": 1}, idempotency_key="k-config")
        assert run.run_id == RUN_ID
        assert any("/contracts/sync" in c for c in calls)
        assert any("/run" in c for c in calls)

    def test_durable_client_still_public(self):
        assert igris.IgrisDurableClient is IgrisDurableClient
        assert "IgrisDurableClient" in igris.__all__
