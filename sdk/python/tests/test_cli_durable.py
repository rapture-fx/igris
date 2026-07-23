"""CLI tests for durable binding / run commands.

Uses ``igris.cli.main([...])`` in-process with monkeypatched
``IgrisDurableClient`` so the autouse socket guard never sees real network.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import pytest

from igris import (
    ContractBinding,
    DurableConfigurationError,
    IgrisRunProof,
    UnboundActionError,
)
from igris.cli import EXIT_INVALID, EXIT_USAGE, main
from igris.durable import DurableRunStatus

CONTRACT_HASH = "a" * 64
ACTION_NAME = "tests.cli.durable"
TARGET_ACTION_ID = "act_cli_1"
RUN_ID = "run_cli_1"
API_KEY = "igris_secret_token_do_not_leak"


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    monkeypatch.delenv("IGRIS_API_URL", raising=False)
    monkeypatch.delenv("IGRIS_API_KEY", raising=False)


def sample_binding() -> ContractBinding:
    return ContractBinding(
        id="bind_cli_1",
        action_name=ACTION_NAME,
        contract_hash=CONTRACT_HASH,
        target_action_id=TARGET_ACTION_ID,
        target_version_hash="b" * 64,
        input_mapping={"amount": "amount_cents"},
        endpoint_config_ref=None,
        timeout_ms=30_000,
        replay_class="retryable",
        idempotency_required=True,
        created_at="2026-01-01T00:00:00Z",
        immutable=True,
    )


def sample_status(**overrides: Any) -> DurableRunStatus:
    data = {
        "run_id": RUN_ID,
        "task_id": "task_cli",
        "status": "completed",
        "proof_status": "available",
        "durable_execution_status": "completed",
        "managed_decision_status": None,
        "recovery_status": None,
        "run_linkage_status": "eligible_linked",
        "execution_id": "exec_cli",
        "action_name": ACTION_NAME,
        "result": {"ok": True},
        "error": None,
        "message": None,
    }
    data.update(overrides)
    return DurableRunStatus.from_response(data)


def sample_proof() -> IgrisRunProof:
    return IgrisRunProof.from_response(
        {
            "schema": "igris_run_proof.v1",
            "product_term": "Igris Run Proof",
            "run_id": RUN_ID,
            "action_name": ACTION_NAME,
            "contract_hash": CONTRACT_HASH,
            "statuses": {"run": "completed"},
            "claim_boundary": {
                "runtime_receipt": "separate Runtime-signed managed execution claim",
                "action_protocol_evidence": "separate SDK-signed decision/outcome claim",
            },
            "runtime_proof": {"kind": "runtime"},
            "action_protocol_evidence": {"kind": "evidence"},
        }
    )


@dataclass
class FakeDurableClient:
    """Minimal stand-in for CLI durable commands."""

    binding: ContractBinding | None = None
    status: DurableRunStatus | None = None
    fail_with: Exception | None = None
    run_fail_with: Exception | None = None

    def get_binding(self, action_name: str, contract_hash: str) -> ContractBinding:
        if self.fail_with is not None:
            raise self.fail_with
        assert self.binding is not None
        return self.binding

    def create_binding(self, **kwargs: Any) -> ContractBinding:
        if self.fail_with is not None:
            raise self.fail_with
        assert self.binding is not None
        return self.binding

    def get_run(self, run_id: str) -> DurableRunStatus:
        if self.fail_with is not None:
            raise self.fail_with
        assert self.status is not None
        return self.status

    def run(self, *args: Any, **kwargs: Any):
        if self.run_fail_with is not None:
            raise self.run_fail_with
        if self.fail_with is not None:
            raise self.fail_with
        from igris.durable import DurableRun

        return DurableRun(self, run_id=RUN_ID, initial=self.status)  # type: ignore[arg-type]


def install_fake_client(monkeypatch, fake: FakeDurableClient) -> None:
    class DurableClientFactory:
        def __new__(cls, **kwargs: Any):
            return fake

        @staticmethod
        def from_env(**kwargs: Any):
            return fake

    monkeypatch.setattr("igris.cli.IgrisDurableClient", DurableClientFactory)


class TestCliBinding:
    def test_binding_get_human_output(self, monkeypatch, capsys):
        fake = FakeDurableClient(binding=sample_binding())
        install_fake_client(monkeypatch, fake)

        code = main(
            [
                "binding",
                "get",
                "--action",
                ACTION_NAME,
                "--contract-hash",
                CONTRACT_HASH,
                "--endpoint",
                "https://igris.example",
                "--api-key",
                API_KEY,
            ]
        )
        assert code == 0
        out = capsys.readouterr().out
        assert f"binding {fake.binding.id}" in out
        assert ACTION_NAME in out
        assert CONTRACT_HASH in out
        assert TARGET_ACTION_ID in out
        assert API_KEY not in out


class TestCliRunStatus:
    def test_run_status_human_output(self, monkeypatch, capsys):
        fake = FakeDurableClient(status=sample_status())
        install_fake_client(monkeypatch, fake)

        code = main(
            [
                "run",
                "status",
                RUN_ID,
                "--endpoint",
                "https://igris.example",
                "--api-key",
                API_KEY,
            ]
        )
        assert code == 0
        out = capsys.readouterr().out
        assert f"run_id:                 {RUN_ID}" in out
        assert "status:                 completed" in out
        assert "is_terminal:            True" in out
        assert API_KEY not in out


class TestCliRunProof:
    def test_run_proof_json_output(self, monkeypatch, capsys):
        proof = sample_proof()

        class ProofClient(FakeDurableClient):
            def get_run(self, run_id: str) -> DurableRunStatus:
                return sample_status(
                    igris_run_proof={
                        "schema": proof.schema,
                        "product_term": proof.product_term,
                        "run_id": proof.run_id,
                        "action_name": proof.action_name,
                        "contract_hash": proof.contract_hash,
                        "statuses": proof.statuses,
                        "claim_boundary": {
                            "runtime_receipt": "separate Runtime-signed managed execution claim",
                            "action_protocol_evidence": (
                                "separate SDK-signed decision/outcome claim"
                            ),
                        },
                        "runtime_proof": proof.runtime_proof,
                        "action_protocol_evidence": proof.action_protocol_evidence,
                    }
                )

        install_fake_client(monkeypatch, ProofClient())

        code = main(
            [
                "run",
                "proof",
                RUN_ID,
                "--endpoint",
                "https://igris.example",
                "--api-key",
                API_KEY,
            ]
        )
        assert code == 0
        out = capsys.readouterr().out
        payload = json.loads(out)
        assert payload["schema"] == "igris_run_proof.v1"
        assert payload["run_id"] == RUN_ID
        assert payload["claim_boundary"]["runtime_receipt"].startswith("separate Runtime")
        assert payload["runtime_proof"] == {"kind": "runtime"}
        assert payload["action_protocol_evidence"] == {"kind": "evidence"}
        assert API_KEY not in out


class TestCliFailures:
    def test_auth_config_failure_exit_code_2(self, monkeypatch, capsys):
        # Missing endpoint/api-key and env → DurableConfigurationError via real from_env
        code = main(
            [
                "binding",
                "get",
                "--action",
                ACTION_NAME,
                "--contract-hash",
                CONTRACT_HASH,
            ]
        )
        assert code == EXIT_USAGE
        err = capsys.readouterr().err
        assert "igris binding:" in err
        assert API_KEY not in err

        # Explicit DurableConfigurationError from client
        fake = FakeDurableClient(
            fail_with=DurableConfigurationError("durable client requires both endpoint and api_key")
        )
        install_fake_client(monkeypatch, fake)
        code = main(["run", "status", RUN_ID])
        assert code == EXIT_USAGE
        err = capsys.readouterr().err
        assert "igris run:" in err

    def test_unbound_action_failure_exit_code_1(self, monkeypatch, capsys):
        fake = FakeDurableClient(
            run_fail_with=UnboundActionError(
                "action has no exact execution binding",
            )
        )
        install_fake_client(monkeypatch, fake)

        code = main(
            [
                "run",
                "submit",
                "--action",
                ACTION_NAME,
                "--input",
                '{"amount": 1}',
                "--idempotency-key",
                "biz-1",
                "--contract-hash",
                CONTRACT_HASH,
                "--endpoint",
                "https://igris.example",
                "--api-key",
                API_KEY,
            ]
        )
        assert code == EXIT_INVALID
        err = capsys.readouterr().err
        assert "igris run:" in err
        assert "binding" in err.lower()
        assert API_KEY not in err
