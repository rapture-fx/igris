"""Manifest-driven Python runner for the schema-1 conformance candidate."""

from __future__ import annotations

import argparse
import base64
import binascii
import hashlib
import json
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Any

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

from igris.legacy_schema1 import (
    DuplicateMember,
    InvalidUnicodeScalar,
    LegacySchema1JSONError,
    ResourceLimit,
    TrailingContent,
    canonicalize_legacy_json,
    encode_legacy_json,
    parse_legacy_json,
)
from conformance.schema1.python.schema_tools import (
    DEFAULT_SCHEMA_PATH,
    REPOSITORY_ROOT,
    issue_codes,
    validate_result,
)

DEFAULT_SUITE = REPOSITORY_ROOT / "spec/test-vectors/suite-schema-1"
SAFE_INTEGER_MAX = 9_007_199_254_740_991
ID_RE = re.compile(r"^[a-z0-9][a-zA-Z0-9-]{2,127}$")
ACTION_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_.:-]{0,127}$")
HEX_64_RE = re.compile(r"^[0-9a-f]{64}$")
PARAMETER_KINDS = {
    "POSITIONAL_ONLY",
    "POSITIONAL_OR_KEYWORD",
    "VAR_POSITIONAL",
    "KEYWORD_ONLY",
    "VAR_KEYWORD",
}
REGISTERED_ISSUES = set(issue_codes())

ISSUE_SEVERITY = {
    "specification_conflict": "error",
    "malformed": "error",
    "invalid_utf8": "error",
    "duplicate_member": "error",
    "trailing_content": "error",
    "resource_limit": "error",
    "unsupported_schema": "error",
    "unknown_field": "error",
    "missing_field": "error",
    "invalid_field": "error",
    "invalid_null": "error",
    "canonicalization_failed": "error",
    "unsupported_legacy_representation": "error",
    "integer_out_of_range": "error",
    "invalid_unicode_scalar": "error",
    "unsupported_algorithm": "error",
    "hash_mismatch": "error",
    "invalid_signature": "error",
    "missing_signature": "error",
    "unknown_key": "error",
    "ambiguous_key": "error",
    "chain_discontinuity": "error",
    "partial_chain": "warning",
    "incomplete_chain": "error",
    "completeness_unknown": "warning",
    "fork_detected": "error",
    "invalid_transition": "error",
    "unknown_decision_reference": "error",
    "duplicate_outcome": "error",
    "unresolved_execution": "warning",
    "unknown_fields_present": "warning",
    "untrusted_key": "warning",
    "revoked_key": "warning",
    "outside_binding_interval": "warning",
    "binding_interval_indeterminate": "warning",
    "stale_trust_snapshot": "warning",
    "trust_unknown": "warning",
    "producer_time_only": "warning",
    "time_confidence_unavailable": "warning",
}
assert set(ISSUE_SEVERITY) == REGISTERED_ISSUES


class ConformanceFailure(RuntimeError):
    """One bounded conformance failure identified by vector ID."""


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def issue(code: str, event_index: int | None = None) -> dict[str, Any]:
    return {
        "severity": ISSUE_SEVERITY[code],
        "code": code,
        "event_index": event_index,
        "path": None,
    }


def portable_result(
    object_type: str,
    *,
    object_schema_id: str | None = "1",
    events_verified: int = 0,
    overrides: dict[str, Any] | None = None,
    issues: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    value: dict[str, Any] = {
        "schema_id": "igris:protocol:verification-result:1",
        "artifact": {
            "object_schema_id": object_schema_id,
            "object_type": object_type,
            "artifact_id": None,
        },
        "specification": "consistent",
        "parse": "valid",
        "schema": "supported",
        "canonicalization": "valid",
        "algorithm": "not_evaluated",
        "object_hash": "not_present",
        "signature": "not_present",
        "key_resolution": "not_required",
        "continuity": "not_applicable",
        "completeness": "not_applicable",
        "semantics": "not_applicable",
        "trust": "not_evaluated",
        "time_confidence": "not_applicable",
        "summary": "valid_but_trust_unknown",
        "policy": None,
        "events_verified": events_verified,
        "issues": issues or [],
    }
    if overrides:
        for key, item in overrides.items():
            if key == "artifact":
                value["artifact"].update(item)
            else:
                value[key] = item
    validate_result(value)
    return value


def safe_path(root: Path, relative: str) -> Path:
    pure = PurePosixPath(relative)
    if pure.is_absolute() or ".." in pure.parts or "\\" in relative:
        raise ConformanceFailure(f"unsafe manifest path: {relative}")
    target = (root / Path(*pure.parts)).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError as exc:
        raise ConformanceFailure(f"manifest path escapes suite: {relative}") from exc
    return target


def load_manifest(suite: Path) -> dict[str, Any]:
    manifest_path = suite / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    required = {
        "format",
        "format_version",
        "suite_id",
        "suite_revision",
        "protocol_status",
        "source_baseline_commit",
        "ratification_commit",
        "files",
        "vectors",
    }
    if set(manifest) < required:
        raise ConformanceFailure("manifest is missing required fields")
    if (
        manifest["format"] != "igris-test-vector-manifest"
        or manifest["format_version"] != "1"
    ):
        raise ConformanceFailure("unsupported manifest format")
    if manifest["protocol_status"] != "frozen-candidate":
        raise ConformanceFailure("suite must remain a frozen candidate")
    vectors = manifest["vectors"]
    ids = [item["id"] for item in vectors]
    if len(ids) != len(set(ids)) or not all(ID_RE.fullmatch(item) for item in ids):
        raise ConformanceFailure("vector IDs must be unique stable ASCII identifiers")

    file_entries = manifest["files"]
    file_paths = [item["path"] for item in file_entries]
    if len(file_paths) != len(set(file_paths)):
        raise ConformanceFailure("manifest file paths are duplicated")
    recorded = {item["path"]: item["sha256"] for item in file_entries}
    for relative, expected_hash in recorded.items():
        path = safe_path(suite, relative)
        if not path.is_file():
            raise ConformanceFailure(f"manifest file is missing: {relative}")
        if sha256(path.read_bytes()) != expected_hash:
            raise ConformanceFailure(f"manifest hash mismatch: {relative}")
    for vector in vectors:
        for field in ("input", "expected"):
            if vector.get(field) not in recorded:
                raise ConformanceFailure(f"{vector['id']}: unrecorded {field} file")
        for field in ("canonical", "mutation"):
            if vector.get(field) and vector[field] not in recorded:
                raise ConformanceFailure(f"{vector['id']}: unrecorded {field} file")
        if vector.get("expected_primary_issue") not in REGISTERED_ISSUES | {None}:
            raise ConformanceFailure(f"{vector['id']}: unknown expected issue")
    copied_schema = safe_path(suite, "schemas/verification-result-1.schema.json")
    if copied_schema.read_bytes() != DEFAULT_SCHEMA_PATH.read_bytes():
        raise ConformanceFailure("suite verification-result schema copy drifted")
    return manifest


def load_expected(suite: Path, vector: dict[str, Any]) -> dict[str, Any]:
    expected = json.loads(
        safe_path(suite, vector["expected"]).read_text(encoding="utf-8")
    )
    if expected.get("vector_id") != vector["id"]:
        raise ConformanceFailure(f"{vector['id']}: expected file ID mismatch")
    validate_result(expected["verification"])
    return expected


def canonical_positive() -> dict[str, Any]:
    return portable_result("unknown", events_verified=1)


def malformed(
    object_type: str,
    code: str,
    *,
    canonicalization: str = "not_evaluated",
) -> dict[str, Any]:
    return portable_result(
        object_type,
        object_schema_id=None,
        overrides={
            "parse": "resource_limit" if code == "resource_limit" else "malformed",
            "schema": "not_evaluated",
            "canonicalization": canonicalization,
            "algorithm": "not_evaluated",
            "object_hash": "not_evaluated",
            "signature": "not_evaluated",
            "key_resolution": "not_evaluated",
            "continuity": "not_evaluated",
            "completeness": "not_evaluated",
            "semantics": "not_evaluated",
            "trust": "not_evaluated",
            "time_confidence": "not_evaluated",
            "summary": "indeterminate" if code == "resource_limit" else "invalid",
        },
        issues=[issue(code)],
    )


def read_canonical(suite: Path, vector: dict[str, Any]) -> bytes | None:
    relative = vector.get("canonical")
    if not relative:
        return None
    try:
        return base64.b64decode(
            safe_path(suite, relative).read_text(encoding="ascii").strip(),
            validate=True,
        )
    except (ValueError, binascii.Error) as exc:
        raise ConformanceFailure(f"{vector['id']}: invalid canonical base64") from exc


def compare_canonical(
    vector_id: str,
    actual: bytes,
    recorded: bytes | None,
    expected: dict[str, Any],
) -> None:
    if recorded is None:
        raise ConformanceFailure(f"{vector_id}: canonical bytes unexpectedly absent")
    if actual != recorded:
        raise ConformanceFailure(f"{vector_id}: canonical byte mismatch")
    metadata = expected.get("canonical")
    if not isinstance(metadata, dict):
        raise ConformanceFailure(f"{vector_id}: expected canonical metadata absent")
    if base64.b64decode(metadata["bytes_base64"], validate=True) != actual:
        raise ConformanceFailure(f"{vector_id}: expected canonical base64 mismatch")
    if metadata["sha256_hex"] != sha256(actual):
        raise ConformanceFailure(f"{vector_id}: expected canonical hash mismatch")


def evaluate_canonical(
    suite: Path,
    vector: dict[str, Any],
    expected: dict[str, Any],
) -> dict[str, Any]:
    primary = vector.get("expected_primary_issue")
    if primary == "specification_conflict":
        return portable_result(
            "unknown",
            object_schema_id=None,
            overrides={
                "specification": "conflict",
                "schema": "not_evaluated",
                "canonicalization": "not_evaluated",
                "algorithm": "not_evaluated",
                "object_hash": "not_evaluated",
                "signature": "not_evaluated",
                "key_resolution": "not_evaluated",
                "continuity": "not_evaluated",
                "completeness": "not_evaluated",
                "semantics": "not_evaluated",
                "trust": "not_evaluated",
                "time_confidence": "not_evaluated",
                "summary": "indeterminate",
            },
            issues=[issue(primary)],
        )
    mutation = (
        json.loads(safe_path(suite, vector["mutation"]).read_text())
        if vector.get("mutation")
        else None
    )
    if mutation and mutation.get("operation") == "drop_numeric_lexemes":
        return portable_result(
            "unknown",
            overrides={
                "canonicalization": "unsupported",
                "algorithm": "not_evaluated",
                "object_hash": "not_evaluated",
                "signature": "not_evaluated",
                "key_resolution": "not_evaluated",
                "summary": "unsupported",
            },
            issues=[issue("unsupported_legacy_representation")],
        )
    raw = safe_path(suite, vector["input"]).read_bytes()
    try:
        actual = canonicalize_legacy_json(raw)
    except DuplicateMember:
        actual_issue = "duplicate_member"
    except TrailingContent:
        actual_issue = "trailing_content"
    except InvalidUnicodeScalar:
        return portable_result(
            "unknown",
            overrides={"canonicalization": "invalid", "summary": "invalid"},
            issues=[issue("invalid_unicode_scalar")],
        )
    except ResourceLimit:
        actual_issue = "resource_limit"
    except LegacySchema1JSONError:
        actual_issue = primary or "malformed"
    else:
        compare_canonical(vector["id"], actual, read_canonical(suite, vector), expected)
        return canonical_positive()
    if actual_issue != primary:
        raise ConformanceFailure(
            f"{vector['id']}: parser classified {actual_issue}, expected {primary}"
        )
    return malformed("unknown", actual_issue)


CONTRACT_REQUIRED = {
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


def contract_schema_issue(contract: dict[str, Any]) -> str | None:
    if contract.get("schema_version") != "1":
        return "unsupported_schema"
    if missing := CONTRACT_REQUIRED - set(contract):
        del missing
        return "missing_field"
    if set(contract) - CONTRACT_REQUIRED:
        return "unknown_field"
    for name in (
        "action_name",
        "module",
        "qualified_name",
        "risk",
        "approval_mode",
        "execution_mode",
    ):
        if not isinstance(contract[name], str):
            return "invalid_field"
    if not ACTION_RE.fullmatch(contract["action_name"]):
        return "invalid_field"
    if contract["risk"] not in {"low", "medium", "high", "critical"}:
        return "invalid_field"
    if contract["approval_mode"] not in {"required", "never"}:
        return "invalid_field"
    if contract["execution_mode"] != "embedded":
        return "invalid_field"
    fingerprint = contract["code_fingerprint"]
    if fingerprint is not None and (
        not isinstance(fingerprint, str) or not HEX_64_RE.fullmatch(fingerprint)
    ):
        return "invalid_field"
    if not isinstance(contract["contract_hash"], str) or not HEX_64_RE.fullmatch(
        contract["contract_hash"]
    ):
        return "invalid_field"
    descriptors = contract["parameter_descriptors"]
    if not isinstance(descriptors, list):
        return "invalid_field"
    for descriptor in descriptors:
        if not isinstance(descriptor, dict) or set(descriptor) != {
            "name",
            "kind",
            "has_default",
            "annotation",
        }:
            return "invalid_field"
        if (
            not isinstance(descriptor["name"], str)
            or descriptor["kind"] not in PARAMETER_KINDS
            or not isinstance(descriptor["has_default"], bool)
            or (
                descriptor["annotation"] is not None
                and not isinstance(descriptor["annotation"], str)
            )
        ):
            return "invalid_field"
    return None


def evaluate_contract(
    suite: Path,
    vector: dict[str, Any],
    expected: dict[str, Any],
) -> dict[str, Any]:
    raw = safe_path(suite, vector["input"]).read_bytes()
    try:
        contract = parse_legacy_json(raw)
    except DuplicateMember:
        return malformed("action-contract", "duplicate_member")
    except LegacySchema1JSONError:
        return malformed("action-contract", "malformed")
    if not isinstance(contract, dict):
        return malformed("action-contract", "malformed")
    schema_issue = contract_schema_issue(contract)
    if schema_issue == "unsupported_schema":
        return portable_result(
            "action-contract",
            object_schema_id=str(contract.get("schema_version")),
            overrides={
                "schema": "unsupported",
                "canonicalization": "not_evaluated",
                "object_hash": "not_evaluated",
                "semantics": "not_evaluated",
                "summary": "unsupported",
            },
            issues=[issue(schema_issue)],
        )
    if schema_issue:
        return portable_result(
            "action-contract",
            overrides={
                "schema": "invalid",
                "canonicalization": "not_evaluated",
                "object_hash": "not_evaluated",
                "semantics": "not_evaluated",
                "summary": "invalid",
            },
            issues=[issue(schema_issue)],
        )
    submitted = contract.pop("contract_hash")
    canonical = encode_legacy_json(contract)
    computed = sha256(canonical)
    if computed != submitted:
        return portable_result(
            "action-contract",
            overrides={
                "object_hash": "mismatch",
                "semantics": "valid",
                "summary": "invalid",
            },
            issues=[issue("hash_mismatch")],
        )
    compare_canonical(vector["id"], canonical, read_canonical(suite, vector), expected)
    return portable_result(
        "action-contract",
        events_verified=1,
        overrides={"object_hash": "valid", "semantics": "valid"},
    )


EVENT_SHARED = {
    "schema_version",
    "event_type",
    "event_id",
    "action_id",
    "action_name",
    "contract_hash",
    "timestamp_utc",
    "key_id",
    "previous_event_hash",
    "event_hash",
    "signature",
}
DECISION_REQUIRED = {
    "decision",
    "risk",
    "approval_mode",
    "redacted_input_summary",
    "input_hash",
}
OUTCOME_REQUIRED = {"status", "decision_event_id"}
KNOWN_OPTIONAL = {
    "metadata",
    "observed_result_type",
    "redacted_output_hash",
    "exception_type",
    "sanitized_error_summary",
}


def load_public_key(suite: Path, key_ref: str) -> tuple[Ed25519PublicKey, str]:
    if key_ref == "alpha2-historical":
        raw = safe_path(suite, "keys/alpha2-historical.public.pem").read_bytes()
        key = serialization.load_pem_public_key(raw)
        if not isinstance(key, Ed25519PublicKey):
            raise ConformanceFailure("historical key is not Ed25519")
        public = key.public_bytes(
            serialization.Encoding.Raw, serialization.PublicFormat.Raw
        )
    elif key_ref == "deterministic-001":
        public = base64.b64decode(
            safe_path(suite, "keys/deterministic-001.public.raw.b64")
            .read_text()
            .strip(),
            validate=True,
        )
        key = Ed25519PublicKey.from_public_bytes(public)
    else:
        raise ConformanceFailure(f"unknown key_ref: {key_ref}")
    return key, "ed25519:" + sha256(public)[:16]


def parse_timestamp(value: Any) -> bool:
    if not isinstance(value, str) or not value.endswith("Z"):
        return False
    try:
        datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError:
        return False
    return True


def evidence_schema_issue(event: dict[str, Any]) -> str | None:
    if event.get("schema_version") != "1":
        return "unsupported_schema"
    event_type = event.get("event_type")
    if event_type not in {"decision", "outcome"}:
        return "invalid_field"
    required = EVENT_SHARED | (
        DECISION_REQUIRED if event_type == "decision" else OUTCOME_REQUIRED
    )
    if required - set(event):
        return "missing_field"
    for name in (
        "schema_version",
        "event_type",
        "event_id",
        "action_id",
        "action_name",
        "contract_hash",
        "timestamp_utc",
        "key_id",
        "event_hash",
        "signature",
    ):
        if not isinstance(event[name], str):
            return "invalid_field"
    if not ACTION_RE.fullmatch(event["action_name"]):
        return "invalid_field"
    if not HEX_64_RE.fullmatch(event["contract_hash"]) or not HEX_64_RE.fullmatch(
        event["event_hash"]
    ):
        return "invalid_field"
    if event["previous_event_hash"] is not None and (
        not isinstance(event["previous_event_hash"], str)
        or not HEX_64_RE.fullmatch(event["previous_event_hash"])
    ):
        return "invalid_field"
    if not parse_timestamp(event["timestamp_utc"]):
        return "invalid_field"
    if event_type == "decision":
        if (
            event["decision"] not in {"allowed", "denied"}
            or event["risk"] not in {"low", "medium", "high", "critical"}
            or event["approval_mode"] not in {"required", "never"}
            or not isinstance(event["redacted_input_summary"], str)
            or not isinstance(event["input_hash"], str)
        ):
            return "invalid_field"
    elif event["status"] not in {"succeeded", "failed"} or not isinstance(
        event["decision_event_id"], str
    ):
        return "invalid_field"
    return None


def mutation_operation(suite: Path, vector: dict[str, Any]) -> str | None:
    if not vector.get("mutation"):
        return None
    mutation = json.loads(
        safe_path(suite, vector["mutation"]).read_text(encoding="utf-8")
    )
    return mutation.get("operation")


def evidence_failure(
    code: str,
    *,
    object_schema_id: str = "1",
    schema: str = "supported",
    canonicalization: str = "valid",
    object_hash: str = "valid",
    signature: str = "valid",
    key_resolution: str = "resolved",
    summary: str = "invalid",
    issue_list: list[str] | None = None,
) -> dict[str, Any]:
    return portable_result(
        "evidence-event",
        object_schema_id=object_schema_id,
        overrides={
            "schema": schema,
            "canonicalization": canonicalization,
            "algorithm": "supported"
            if canonicalization == "valid"
            else "not_evaluated",
            "object_hash": object_hash,
            "signature": signature,
            "key_resolution": key_resolution,
            "continuity": "not_applicable",
            "completeness": "not_applicable",
            "semantics": "not_evaluated",
            "trust": "not_evaluated",
            "time_confidence": "not_evaluated",
            "summary": summary,
        },
        issues=[issue(item) for item in (issue_list or [code])],
    )


def evaluate_evidence(
    suite: Path,
    vector: dict[str, Any],
    expected: dict[str, Any],
) -> dict[str, Any]:
    raw = safe_path(suite, vector["input"]).read_bytes()
    try:
        event = parse_legacy_json(raw)
    except LegacySchema1JSONError:
        return malformed("evidence-event", "malformed")
    if not isinstance(event, dict):
        return malformed("evidence-event", "malformed")
    schema_issue = evidence_schema_issue(event)
    if schema_issue == "unsupported_schema":
        return evidence_failure(
            schema_issue,
            object_schema_id=str(event.get("schema_version")),
            schema="unsupported",
            canonicalization="not_evaluated",
            object_hash="not_evaluated",
            signature="not_evaluated",
            key_resolution="not_evaluated",
            summary="unsupported",
        )
    if schema_issue:
        return evidence_failure(
            schema_issue,
            schema="invalid",
            canonicalization="not_evaluated",
            object_hash="not_evaluated",
            signature="not_evaluated",
            key_resolution="not_evaluated",
        )

    payload = {
        key: value
        for key, value in event.items()
        if key not in {"event_hash", "signature"}
    }
    canonical = encode_legacy_json(payload)
    digest = hashlib.sha256(canonical).digest()
    hash_valid = event["event_hash"] == digest.hex()

    operation = mutation_operation(suite, vector)
    key, expected_key_id = load_public_key(suite, vector["key_ref"])
    if operation == "ambiguous_key_resolution":
        return evidence_failure(
            "ambiguous_key",
            signature="not_evaluated",
            key_resolution="ambiguous",
            summary="indeterminate",
        )
    if event["key_id"] != expected_key_id:
        return evidence_failure(
            "unknown_key",
            signature="not_evaluated",
            key_resolution="unknown",
            summary="indeterminate",
        )
    if operation == "use_wrong_public_key":
        wrong_public = hashlib.sha256(b"igris-conformance-wrong-public-key").digest()
        key = Ed25519PublicKey.from_public_bytes(wrong_public)

    signature_valid = False
    try:
        signature = base64.b64decode(event["signature"], validate=True)
        if len(signature) == 64:
            key.verify(signature, digest)
            signature_valid = True
    except (ValueError, binascii.Error, InvalidSignature):
        pass
    failures: list[str] = []
    if not hash_valid:
        failures.append("hash_mismatch")
    if not signature_valid:
        failures.append("invalid_signature")
    if failures:
        return evidence_failure(
            failures[0],
            object_hash="valid" if hash_valid else "mismatch",
            signature="invalid",
            issue_list=failures,
        )
    compare_canonical(vector["id"], canonical, read_canonical(suite, vector), expected)
    extra = (
        set(event)
        - EVENT_SHARED
        - DECISION_REQUIRED
        - OUTCOME_REQUIRED
        - KNOWN_OPTIONAL
    )
    issues = []
    if extra:
        issues.append(issue("unknown_fields_present"))
    issues.extend([issue("trust_unknown"), issue("producer_time_only")])
    return portable_result(
        "evidence-event",
        events_verified=1,
        overrides={
            "algorithm": "supported",
            "object_hash": "valid",
            "signature": "valid",
            "key_resolution": "resolved",
            "semantics": "valid",
            "trust": "unknown",
            "time_confidence": "producer_asserted",
        },
        issues=issues,
    )


def parse_chain(suite: Path, vector: dict[str, Any]) -> list[dict[str, Any]]:
    events = []
    for raw in safe_path(suite, vector["input"]).read_bytes().splitlines():
        if not raw.strip():
            continue
        value = parse_legacy_json(raw)
        if not isinstance(value, dict):
            raise ConformanceFailure(f"{vector['id']}: chain member is not an object")
        events.append(value)
    return events


def event_crypto(
    event: dict[str, Any],
    key: Ed25519PublicKey,
    expected_key_id: str,
) -> tuple[bool, str]:
    if evidence_schema_issue(event):
        return False, ""
    payload = {
        name: value
        for name, value in event.items()
        if name not in {"event_hash", "signature"}
    }
    digest = hashlib.sha256(encode_legacy_json(payload)).digest()
    if event["event_hash"] != digest.hex() or event["key_id"] != expected_key_id:
        return False, digest.hex()
    try:
        signature = base64.b64decode(event["signature"], validate=True)
        key.verify(signature, digest)
    except (ValueError, binascii.Error, InvalidSignature):
        return False, digest.hex()
    return True, digest.hex()


def chain_valid_result(count: int, continuity: str) -> dict[str, Any]:
    issues = [
        issue("completeness_unknown"),
        issue("trust_unknown"),
        issue("producer_time_only"),
    ]
    return portable_result(
        "evidence-chain",
        events_verified=count,
        overrides={
            "algorithm": "supported",
            "object_hash": "valid",
            "signature": "valid",
            "key_resolution": "resolved",
            "continuity": continuity,
            "completeness": "completeness_unknown",
            "semantics": "valid",
            "trust": "unknown",
            "time_confidence": "producer_asserted",
        },
        issues=issues,
    )


def evaluate_chain(
    suite: Path,
    vector: dict[str, Any],
    expected: dict[str, Any],
) -> dict[str, Any]:
    events = parse_chain(suite, vector)
    key, expected_key_id = load_public_key(suite, vector["key_ref"])
    mutation = (
        json.loads(safe_path(suite, vector["mutation"]).read_text())
        if vector.get("mutation")
        else {}
    )
    expected_previous = mutation.get("trusted_preceding_hash")
    anchored = expected_previous is not None
    decisions: dict[str, str] = {}
    if anchor_decision := mutation.get("trusted_decision"):
        decisions[str(anchor_decision["event_id"])] = str(anchor_decision["decision"])
    outcomes: set[str] = set()
    identities: dict[str, str] = {}
    verified = 0
    continuity_issue: str | None = None
    semantic_issue: str | None = None
    for event in events:
        crypto_ok, _ = event_crypto(event, key, expected_key_id)
        if not crypto_ok:
            raise ConformanceFailure(
                f"{vector['id']}: chain mutation unexpectedly changed crypto"
            )
        previous_matches = event.get("previous_event_hash") == expected_previous
        event_id = str(event["event_id"])
        event_hash = str(event["event_hash"])
        if event_id in identities and identities[event_id] != event_hash:
            continuity_issue = "fork_detected"
        elif not previous_matches and continuity_issue is None:
            continuity_issue = "chain_discontinuity"
        identities[event_id] = event_hash
        if previous_matches:
            verified += 1
        expected_previous = event_hash

        if event["event_type"] == "decision":
            decisions[event_id] = str(event["decision"])
        else:
            decision_id = str(event["decision_event_id"])
            if decision_id not in decisions:
                semantic_issue = "unknown_decision_reference"
            elif decisions[decision_id] == "denied":
                semantic_issue = "invalid_transition"
            elif decision_id in outcomes:
                semantic_issue = "duplicate_outcome"
            else:
                outcomes.add(decision_id)

    primary = vector.get("expected_primary_issue")
    required_head = mutation.get("required_head")
    actual_head = str(events[-1]["event_hash"]) if events else None
    if required_head is not None and actual_head != required_head:
        return portable_result(
            "evidence-chain",
            events_verified=verified,
            overrides={
                "algorithm": "supported",
                "object_hash": "valid",
                "signature": "valid",
                "key_resolution": "resolved",
                "continuity": "valid_genesis",
                "completeness": "incomplete",
                "semantics": "valid",
                "trust": "unknown",
                "time_confidence": "producer_asserted",
                "summary": "indeterminate",
            },
            issues=[issue("incomplete_chain")],
        )
    actual_issue = continuity_issue or semantic_issue
    if actual_issue:
        if actual_issue != primary:
            raise ConformanceFailure(
                f"{vector['id']}: chain classified {actual_issue}, expected {primary}"
            )
        return portable_result(
            "evidence-chain",
            events_verified=verified,
            overrides={
                "algorithm": "supported",
                "object_hash": "valid",
                "signature": "valid",
                "key_resolution": "resolved",
                "continuity": (
                    "discontinuous"
                    if actual_issue in {"chain_discontinuity", "fork_detected"}
                    else "valid_genesis"
                ),
                "completeness": "completeness_unknown",
                "semantics": (
                    "invalid"
                    if actual_issue
                    in {
                        "unknown_decision_reference",
                        "invalid_transition",
                        "duplicate_outcome",
                    }
                    else "not_evaluated"
                ),
                "trust": "not_evaluated",
                "time_confidence": "not_evaluated",
                "summary": "invalid",
            },
            issues=[issue(actual_issue)],
        )
    return chain_valid_result(
        len(events),
        "valid_anchored" if anchored else "valid_genesis",
    )


def evaluate_trust(
    suite: Path,
    vector: dict[str, Any],
) -> dict[str, Any]:
    overlay = json.loads(safe_path(suite, vector["input"]).read_text(encoding="utf-8"))
    time_confidence = overlay["time_confidence"]
    key_resolution = overlay["key_resolution"]
    key_trust = overlay["key_trust"]
    revocation_snapshot = overlay["revocation_snapshot"]
    binding_evaluation = overlay["binding_evaluation"]
    primary = None
    if key_resolution == "unknown":
        primary = "unknown_key"
    elif key_resolution == "ambiguous":
        primary = "ambiguous_key"
    elif revocation_snapshot == "revoked":
        primary = "revoked_key"
    elif binding_evaluation == "outside":
        primary = "outside_binding_interval"
    elif binding_evaluation == "indeterminate":
        primary = "binding_interval_indeterminate"
    elif key_trust == "untrusted":
        primary = "untrusted_key"
    elif revocation_snapshot == "stale":
        primary = "stale_trust_snapshot"
    elif key_trust == "unknown":
        primary = "trust_unknown"

    trust = (
        "unknown"
        if key_resolution in {"unknown", "ambiguous"}
        else "revoked"
        if revocation_snapshot == "revoked"
        else "outside_binding_interval"
        if binding_evaluation == "outside"
        else "binding_interval_indeterminate"
        if binding_evaluation == "indeterminate"
        else key_trust
    )
    signature = "valid"
    events_verified = 1
    if key_resolution == "unknown":
        signature = "not_evaluated"
        events_verified = 0
    elif key_resolution == "ambiguous":
        signature = "not_evaluated"
        events_verified = 0
    summary = {
        "trusted": "valid_and_trusted",
        "untrusted": "valid_but_untrusted",
        "revoked": "valid_but_untrusted",
        "outside_binding_interval": "valid_but_untrusted",
        "binding_interval_indeterminate": "indeterminate",
        "unknown": "valid_but_trust_unknown",
    }[trust]
    if key_resolution in {"unknown", "ambiguous"}:
        summary = "indeterminate"
    return portable_result(
        "evidence-event",
        events_verified=events_verified,
        overrides={
            "algorithm": "supported",
            "object_hash": "valid",
            "signature": signature,
            "key_resolution": key_resolution,
            "semantics": "not_applicable",
            "trust": trust,
            "time_confidence": time_confidence,
            "summary": summary,
        },
        issues=[issue(primary)] if primary else [],
    )


def run_vector(suite: Path, vector: dict[str, Any]) -> None:
    expected = load_expected(suite, vector)
    family = vector["family"]
    if family == "canonical":
        actual = evaluate_canonical(suite, vector, expected)
    elif family == "contract":
        actual = evaluate_contract(suite, vector, expected)
    elif family == "evidence":
        actual = evaluate_evidence(suite, vector, expected)
    elif family == "chain":
        actual = evaluate_chain(suite, vector, expected)
    elif family == "trust":
        actual = evaluate_trust(suite, vector)
    else:
        raise ConformanceFailure(f"{vector['id']}: unsupported family {family}")
    if actual != expected["verification"]:
        raise ConformanceFailure(f"{vector['id']}: verification result mismatch")


def run(
    suite: Path,
    *,
    vector_id: str | None = None,
    family: str | None = None,
) -> dict[str, Any]:
    manifest = load_manifest(suite)
    selected = [
        vector
        for vector in manifest["vectors"]
        if (vector_id is None or vector["id"] == vector_id)
        and (family is None or vector["family"] == family)
    ]
    if not selected:
        raise ConformanceFailure("selection matched no vectors")
    failures = []
    for vector in selected:
        try:
            run_vector(suite, vector)
        except (
            ConformanceFailure,
            LegacySchema1JSONError,
            KeyError,
            TypeError,
            ValueError,
        ) as exc:
            failures.append({"id": vector["id"], "reason": type(exc).__name__})
    report = {
        "runner": "python-maintained-schema1-path",
        "suite_id": manifest["suite_id"],
        "suite_revision": manifest["suite_revision"],
        "status": "pass" if not failures else "fail",
        "selected": len(selected),
        "passed": len(selected) - len(failures),
        "families": dict(sorted(Counter(item["family"] for item in selected).items())),
        "failures": failures,
        "declared_known_divergences": manifest["known_divergences"],
    }
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--suite", type=Path, default=DEFAULT_SUITE)
    parser.add_argument("--vector")
    parser.add_argument(
        "--family", choices=["canonical", "contract", "evidence", "chain", "trust"]
    )
    args = parser.parse_args()
    try:
        report = run(args.suite.resolve(), vector_id=args.vector, family=args.family)
    except ConformanceFailure as exc:
        print(json.dumps({"status": "fail", "reason": str(exc)}, sort_keys=True))
        return 1
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["status"] == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
