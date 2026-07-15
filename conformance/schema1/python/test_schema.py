from __future__ import annotations

from copy import deepcopy

import pytest
from jsonschema import ValidationError

from conformance.schema1.python.schema_tools import issue_codes, validate_result


def positive_result() -> dict:
    return {
        "schema_id": "igris:protocol:verification-result:1",
        "artifact": {
            "object_schema_id": "1",
            "object_type": "evidence-chain",
            "artifact_id": None,
        },
        "specification": "consistent",
        "parse": "valid",
        "schema": "supported",
        "canonicalization": "valid",
        "algorithm": "supported",
        "object_hash": "valid",
        "signature": "valid",
        "key_resolution": "resolved",
        "continuity": "valid_genesis",
        "completeness": "completeness_unknown",
        "semantics": "valid",
        "trust": "unknown",
        "time_confidence": "producer_asserted",
        "summary": "valid_but_trust_unknown",
        "policy": None,
        "events_verified": 2,
        "issues": [
            {
                "severity": "warning",
                "code": "completeness_unknown",
                "event_index": None,
                "path": None,
            }
        ],
    }


def assert_invalid(mutator) -> None:
    result = deepcopy(positive_result())
    mutator(result)
    with pytest.raises(ValidationError):
        validate_result(result)


def test_positive_specification_example_validates() -> None:
    validate_result(positive_result())


def test_issue_registry_is_exact_and_unique() -> None:
    codes = issue_codes()
    assert len(codes) == 39
    assert len(set(codes)) == 39
    assert "unsupported_event_type" not in codes
    assert "invalid_field" in codes
    assert "outside_binding_interval" in codes
    assert "binding_interval_indeterminate" in codes
    assert "unsupported_legacy_representation" in codes


@pytest.mark.parametrize(
    "mutator",
    [
        lambda result: result.__setitem__("summary", "maybe_valid"),
        lambda result: result.pop("signature"),
        lambda result: result.__setitem__("unexpected", True),
        lambda result: result["issues"][0].__setitem__(
            "code", "unsupported_event_type"
        ),
        lambda result: result.__setitem__("events_verified", -1),
        lambda result: result["artifact"].__setitem__("unexpected", True),
        lambda result: result["issues"][0].__setitem__("event_index", -1),
        lambda result: result["issues"][0].__setitem__("path", "not/a/json/pointer"),
    ],
)
def test_closed_result_contract_rejects_invalid_shapes(mutator) -> None:
    assert_invalid(mutator)


@pytest.mark.parametrize(
    "policy",
    [
        {},
        {
            "profile_id": "policy:test",
            "profile_version": "1",
            "status": "unknown",
            "evaluated_at": "2030-01-01T00:00:00Z",
        },
        {
            "profile_id": "policy:test",
            "profile_version": "1",
            "status": "accepted",
            "evaluated_at": "not-a-time",
        },
        {
            "profile_id": "policy:test",
            "profile_version": "1",
            "status": "accepted",
            "evaluated_at": "2030-01-01T00:00:00Z",
            "message": "portable results do not contain free-form messages",
        },
    ],
)
def test_malformed_policy_objects_are_rejected(policy) -> None:
    assert_invalid(lambda result: result.__setitem__("policy", policy))


def test_complete_policy_object_validates() -> None:
    result = positive_result()
    result["policy"] = {
        "profile_id": "policy:test",
        "profile_version": "1",
        "status": "accepted",
        "evaluated_at": "2030-01-01T00:00:00Z",
    }
    validate_result(result)
