"""Action contract determinism and validation."""

from __future__ import annotations

import json

import pytest

from igris.canonical import canonical_json_bytes
from igris.contracts import build_contract, validate_action_name
from igris.errors import ContractError


def sample(customer_id: str, amount: int = 5, *, dry_run: bool = False) -> dict:
    return {"customer_id": customer_id, "amount": amount, "dry_run": dry_run}


class TestActionIdentity:
    def test_default_action_name_is_module_and_qualname(self):
        contract = build_contract(sample, action=None, risk="low", approval="never")
        assert contract.action_name == f"{sample.__module__}.sample"
        assert contract.action_id == contract.action_name

    def test_default_identity_deterministic(self):
        a = build_contract(sample, action=None, risk="low", approval="never")
        b = build_contract(sample, action=None, risk="low", approval="never")
        assert a.action_name == b.action_name
        assert a.contract_hash == b.contract_hash

    def test_no_absolute_path_in_contract(self):
        contract = build_contract(sample, action=None, risk="low", approval="never")
        serialized = json.dumps(
            {
                "action_name": contract.action_name,
                "module": contract.module,
                "qualified_name": contract.qualified_name,
                "params": [p.name for p in contract.parameter_descriptors],
            }
        )
        assert "/" not in contract.action_name
        assert "\\" not in contract.action_name
        assert not contract.module.startswith("/")
        assert "Users" not in serialized

    def test_explicit_action_name_used_and_validated(self):
        contract = build_contract(
            sample, action="customer.refund", risk="high", approval="required"
        )
        assert contract.action_name == "customer.refund"
        for bad in ("", "1starts-with-digit", "has spaces", "a" * 200, "semi;colon"):
            with pytest.raises(ContractError):
                validate_action_name(bad)


class TestContractHash:
    def test_hash_changes_with_semantic_fields(self):
        a = build_contract(sample, action=None, risk="low", approval="never")
        b = build_contract(sample, action=None, risk="critical", approval="never")
        c = build_contract(sample, action="other.name", risk="low", approval="never")
        assert a.contract_hash != b.contract_hash
        assert a.contract_hash != c.contract_hash

    def test_hash_is_hex_sha256(self):
        contract = build_contract(sample, action=None, risk="low", approval="never")
        assert len(contract.contract_hash) == 64
        int(contract.contract_hash, 16)

    def test_hash_excludes_unstable_values(self):
        """The canonical pre-hash payload has no timestamps, paths, or ids."""
        contract = build_contract(sample, action=None, risk="low", approval="never")
        # Rebuild the unsigned payload exactly as build_contract does.
        import dataclasses

        unsigned = {
            "schema_version": contract.schema_version,
            "action_name": contract.action_name,
            "module": contract.module,
            "qualified_name": contract.qualified_name,
            "risk": contract.risk,
            "approval_mode": contract.approval_mode,
            "execution_mode": contract.execution_mode,
            "parameter_descriptors": [
                dataclasses.asdict(d) for d in contract.parameter_descriptors
            ],
            "code_fingerprint": contract.code_fingerprint,
        }
        text = canonical_json_bytes(unsigned).decode("utf-8")
        assert "0x" not in text  # no memory addresses
        assert "/Users" not in text and "C:\\" not in text  # no absolute paths
        assert "timestamp" not in text  # no timestamps in the contract


class TestParameterDescriptors:
    def test_descriptors_from_signature(self):
        contract = build_contract(sample, action=None, risk="low", approval="never")
        by_name = {d.name: d for d in contract.parameter_descriptors}
        assert list(by_name) == ["customer_id", "amount", "dry_run"]
        assert by_name["customer_id"].annotation == "str"
        assert by_name["customer_id"].has_default is False
        assert by_name["amount"].has_default is True
        assert by_name["dry_run"].kind == "KEYWORD_ONLY"

    def test_missing_source_does_not_invent_fingerprint(self):
        contract = build_contract(len, action="builtin.len", risk="low", approval="never")
        assert contract.code_fingerprint is None
        assert contract.contract_hash  # hash still generated

    def test_execution_mode_is_embedded(self):
        contract = build_contract(sample, action=None, risk="low", approval="never")
        assert contract.execution_mode == "embedded"


class TestValidation:
    def test_invalid_risk_rejected(self):
        with pytest.raises(ContractError, match="risk"):
            build_contract(sample, action=None, risk="extreme", approval="never")

    def test_invalid_approval_rejected(self):
        with pytest.raises(ContractError, match="approval"):
            build_contract(sample, action=None, risk="low", approval="slack")
