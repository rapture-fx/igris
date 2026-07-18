"""Generate the deterministic Igris schema-1 conformance candidate.

The generator refuses to write inside the repository. Generate into a fresh
temporary directory and compare/copy the resulting suite as an explicit review
step. Historical fixtures are read-only inputs and are never regenerated.
"""

from __future__ import annotations

import argparse
import base64
import copy
import hashlib
import json
import platform
import sys
import tempfile
from pathlib import Path, PurePosixPath
from typing import Any

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

from conformance.schema1.python.legacy_json import encode_legacy_json, parse_legacy_json
from conformance.schema1.python.schema_tools import (
    DEFAULT_SCHEMA_PATH,
    REPOSITORY_ROOT,
    validate_result,
)

SUITE_ID = "igris-schema-1-conformance"
SUITE_REVISION = "1.0.0-candidate.1"
PROTOCOL_CANDIDATE = "55d400490a5e6915b9ae634749c6845a0cd15726"
RATIFICATION_COMMIT = "938c8c27b96d38cd1819eb881d5fe57a197ddaa1"
HISTORICAL_DIR = REPOSITORY_ROOT / "testdata/igris-contract-v1"
COMMITTED_SUITE = REPOSITORY_ROOT / "spec/test-vectors/suite-schema-1"
SAFE_INTEGER_MAX = 9_007_199_254_740_991

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


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def json_bytes(value: Any) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False)
        + "\n"
    ).encode()


def compact_json(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode()


def issue(
    code: str,
    *,
    event_index: int | None = None,
    path: str | None = None,
) -> dict[str, Any]:
    return {
        "severity": ISSUE_SEVERITY[code],
        "code": code,
        "event_index": event_index,
        "path": path,
    }


def result(
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


def malformed_result(
    object_type: str,
    code: str = "malformed",
    *,
    canonicalization: str = "not_evaluated",
    summary: str = "invalid",
) -> dict[str, Any]:
    parse = "resource_limit" if code == "resource_limit" else "malformed"
    return result(
        object_type,
        object_schema_id=None,
        overrides={
            "parse": parse,
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
            "summary": summary,
        },
        issues=[issue(code)],
    )


def canonical_expected(
    vector_id: str,
    canonical: bytes | None,
    verification: dict[str, Any],
    *,
    rule: str,
    signature: dict[str, Any] | None = None,
) -> dict[str, Any]:
    value: dict[str, Any] = {
        "vector_id": vector_id,
        "canonical": None,
        "signature": signature,
        "verification": verification,
        "rule": rule,
    }
    if canonical is not None:
        value["canonical"] = {
            "bytes_base64": b64(canonical),
            "sha256_hex": sha256(canonical),
            "utf8": canonical.decode("utf-8"),
        }
    return value


class SuiteBuilder:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.vectors: list[dict[str, Any]] = []
        self.known_divergence_vectors: dict[str, list[str]] = {
            "DIV-001": [],
            "DIV-002": [],
        }

    def _resolve(self, relative: str) -> Path:
        posix = PurePosixPath(relative)
        if posix.is_absolute() or ".." in posix.parts or "\\" in relative:
            raise ValueError(f"unsafe suite path: {relative}")
        target = (self.root / Path(*posix.parts)).resolve()
        target.relative_to(self.root.resolve())
        return target

    def write(self, relative: str, data: bytes) -> str:
        target = self._resolve(relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return relative

    def write_json(self, relative: str, value: Any) -> str:
        return self.write(relative, json_bytes(value))

    def add_vector(
        self,
        *,
        vector_id: str,
        family: str,
        object_type: str,
        input_bytes: bytes,
        expected: dict[str, Any],
        canonical: bytes | None = None,
        extension: str = "json",
        provenance: str = "deterministic-new",
        capabilities: list[str] | None = None,
        tags: list[str] | None = None,
        key_ref: str | None = None,
        mutation: dict[str, Any] | None = None,
        known_divergence: str | None = None,
        expected_primary_issue: str | None = None,
        allowed_secondary_issues: list[str] | None = None,
    ) -> None:
        if any(item["id"] == vector_id for item in self.vectors):
            raise ValueError(f"duplicate vector id: {vector_id}")
        family_dir = {
            "canonical": "canonical/legacy-json-1",
            "contract": "contracts/action-contract-1",
            "evidence": "evidence/evidence-1",
            "chain": "chains/evidence-1",
            "trust": "trust",
        }[family]
        input_path = self.write(
            f"{family_dir}/{vector_id}.input.{extension}", input_bytes
        )
        expected_path = self.write_json(
            f"{family_dir}/{vector_id}.expected.json", expected
        )
        canonical_path = None
        if canonical is not None:
            canonical_path = self.write(
                f"{family_dir}/{vector_id}.canonical.b64",
                (b64(canonical) + "\n").encode(),
            )
        mutation_path = None
        if mutation is not None:
            mutation_path = self.write_json(
                f"mutations/{vector_id}.mutation.json", mutation
            )
        vector = {
            "id": vector_id,
            "family": family,
            "object_type": object_type,
            "schema_version": "1",
            "capabilities": capabilities or ["verify"],
            "input": input_path,
            "canonical": canonical_path,
            "expected": expected_path,
            "key_ref": key_ref,
            "mutation": mutation_path,
            "provenance": provenance,
            "tags": sorted(tags or []),
            "expected_primary_issue": expected_primary_issue,
            "allowed_secondary_issues": sorted(allowed_secondary_issues or []),
            "known_divergence": known_divergence,
        }
        self.vectors.append(vector)
        if known_divergence:
            self.known_divergence_vectors[known_divergence].append(vector_id)

    def finalize(self) -> str:
        referenced: set[str] = set()
        for vector in self.vectors:
            for field in ("input", "canonical", "expected", "mutation"):
                if vector[field]:
                    referenced.add(vector[field])
        referenced.update(
            {
                "keys/alpha2-historical.public.pem",
                "keys/deterministic-001.public.raw.b64",
                "keys/deterministic-001.private.seed.TEST-ONLY.b64",
                "keys/deterministic-001.metadata.json",
                "provenance/alpha2-expected.json",
                "provenance/historical-fixtures.sha256.json",
                "schemas/verification-result-1.schema.json",
            }
        )
        files = [
            {
                "path": path,
                "sha256": sha256(self._resolve(path).read_bytes()),
            }
            for path in sorted(referenced)
        ]
        manifest = {
            "format": "igris-test-vector-manifest",
            "format_version": "1",
            "suite_id": SUITE_ID,
            "suite_revision": SUITE_REVISION,
            "protocol_status": "frozen-candidate",
            "source_baseline_commit": PROTOCOL_CANDIDATE,
            "ratification_commit": RATIFICATION_COMMIT,
            "object_schema_profile": "schema-1-legacy-compatibility",
            "verification_result_schema_id": "igris:protocol:verification-result:1",
            "generator": {
                "path": "conformance/schema1/python/generate.py",
                "python_language_version": "3.11",
                "implementation": platform.python_implementation(),
                "network_required": False,
            },
            "known_divergences": [
                {
                    "id": "DIV-001",
                    "status": "blocking-production-defect",
                    "vectors": sorted(self.known_divergence_vectors["DIV-001"]),
                },
                {
                    "id": "DIV-002",
                    "status": "blocking-production-capability-gap",
                    "vectors": sorted(self.known_divergence_vectors["DIV-002"]),
                },
            ],
            "files": files,
            "vectors": sorted(self.vectors, key=lambda item: item["id"]),
        }
        manifest_bytes = json_bytes(manifest)
        self.write("manifest.json", manifest_bytes)
        manifest_hash = sha256(manifest_bytes)
        candidate = f"""# Igris schema-1 conformance candidate

Status: **Frozen candidate; not released**

- Suite: {SUITE_ID}
- Revision: {SUITE_REVISION}
- Ratified protocol candidate: {PROTOCOL_CANDIDATE}
- Internal ratification: {RATIFICATION_COMMIT}
- Manifest SHA-256: {manifest_hash}
- Python runner expectation: PASS
- Existing Go-path expectation: candidate PASS with declared blocking DIV-001 vectors

The candidate is reproducible and offline. It is not released while required
cross-language vectors expose declared production divergences. The standalone
Go verifier is not part of this candidate.
"""
        self.write("CANDIDATE.md", candidate.encode())
        return manifest_hash


def canonical_positive_result() -> dict[str, Any]:
    return result("unknown", events_verified=1)


def contract_positive_result(hash_status: str = "valid") -> dict[str, Any]:
    summary = "invalid" if hash_status == "mismatch" else "valid_but_trust_unknown"
    issues = [issue("hash_mismatch")] if hash_status == "mismatch" else []
    return result(
        "action-contract",
        events_verified=0 if hash_status == "mismatch" else 1,
        overrides={
            "object_hash": hash_status,
            "semantics": "valid",
            "summary": summary,
        },
        issues=issues,
    )


def evidence_positive_result(
    *,
    object_type: str = "evidence-event",
    events_verified: int = 1,
    continuity: str = "not_applicable",
    completeness: str = "not_applicable",
) -> dict[str, Any]:
    issues = [issue("trust_unknown"), issue("producer_time_only")]
    if completeness == "completeness_unknown":
        issues.insert(0, issue("completeness_unknown"))
    return result(
        object_type,
        events_verified=events_verified,
        overrides={
            "algorithm": "supported",
            "object_hash": "valid",
            "signature": "valid",
            "key_resolution": "resolved",
            "continuity": continuity,
            "completeness": completeness,
            "semantics": "valid",
            "trust": "unknown",
            "time_confidence": "producer_asserted",
            "summary": "valid_but_trust_unknown",
        },
        issues=issues,
    )


def deterministic_key(
    builder: SuiteBuilder,
) -> tuple[Ed25519PrivateKey, bytes, str, str]:
    seed = hashlib.sha256(b"igris-schema-1-conformance-deterministic-key-001").digest()
    private = Ed25519PrivateKey.from_private_bytes(seed)
    public = private.public_key().public_bytes(
        serialization.Encoding.Raw,
        serialization.PublicFormat.Raw,
    )
    fingerprint = sha256(public)
    key_id = "ed25519:" + fingerprint[:16]
    builder.write(
        "keys/deterministic-001.private.seed.TEST-ONLY.b64",
        (b64(seed) + "\n").encode(),
    )
    builder.write(
        "keys/deterministic-001.public.raw.b64", (b64(public) + "\n").encode()
    )
    builder.write_json(
        "keys/deterministic-001.metadata.json",
        {
            "purpose": "conformance-test-only",
            "algorithm": "Ed25519",
            "creation_method": (
                "SHA-256 of the ASCII string "
                "igris-schema-1-conformance-deterministic-key-001"
            ),
            "public_fingerprint_sha256": fingerprint,
            "key_id": key_id,
            "production_use": "prohibited",
            "approved_loader_prefixes": [
                "conformance/schema1/",
                "spec/test-vectors/suite-schema-1/",
            ],
        },
    )
    return private, public, fingerprint, key_id


def signature_metadata(
    signature: bytes,
    *,
    key_id: str,
    fingerprint: str,
) -> dict[str, Any]:
    return {
        "algorithm": "ed25519",
        "input": "sha256_digest",
        "value_base64": b64(signature),
        "key_id": key_id,
        "public_key_fingerprint_sha256": fingerprint,
    }


def finalize_event(
    payload: dict[str, Any],
    private: Ed25519PrivateKey,
) -> tuple[dict[str, Any], bytes, bytes]:
    canonical = compact_json(payload)
    digest = hashlib.sha256(canonical).digest()
    event = dict(payload)
    event["event_hash"] = digest.hex()
    event["signature"] = b64(private.sign(digest))
    return event, canonical, digest


def decision_payload(
    *,
    key_id: str,
    event_id: str,
    decision: str = "allowed",
    previous: str | None = None,
    summary: str = "amount=7",
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    value: dict[str, Any] = {
        "schema_version": "1",
        "event_type": "decision",
        "event_id": event_id,
        "action_id": "conformance.actions.transfer",
        "action_name": "conformance.transfer",
        "contract_hash": "ab" * 32,
        "timestamp_utc": "2030-01-02T03:04:05.000000Z",
        "key_id": key_id,
        "previous_event_hash": previous,
        "decision": decision,
        "risk": "high",
        "approval_mode": "required",
        "redacted_input_summary": summary,
        "input_hash": "cd" * 32,
    }
    if metadata is not None:
        value["metadata"] = metadata
    return value


def outcome_payload(
    *,
    key_id: str,
    event_id: str,
    decision_event_id: str,
    previous: str | None,
    status: str = "succeeded",
) -> dict[str, Any]:
    value: dict[str, Any] = {
        "schema_version": "1",
        "event_type": "outcome",
        "event_id": event_id,
        "action_id": "conformance.actions.transfer",
        "action_name": "conformance.transfer",
        "contract_hash": "ab" * 32,
        "timestamp_utc": "2030-01-02T03:04:06.000000Z",
        "key_id": key_id,
        "previous_event_hash": previous,
        "decision_event_id": decision_event_id,
        "status": status,
        "observed_result_type": "builtins.dict" if status == "succeeded" else None,
    }
    if status == "succeeded":
        value["redacted_output_hash"] = "ef" * 32
    else:
        value["exception_type"] = "builtins.RuntimeError"
        value["sanitized_error_summary"] = "upstream operation failed"
    return value


def add_historical_vectors(
    builder: SuiteBuilder,
    historical_public_key: Ed25519PublicKey,
) -> None:
    builder.write(
        "keys/alpha2-historical.public.pem",
        (HISTORICAL_DIR / "verify_key.pem").read_bytes(),
    )
    builder.write(
        "provenance/alpha2-expected.json",
        (HISTORICAL_DIR / "expected.json").read_bytes(),
    )
    inventory = []
    for path in sorted(item for item in HISTORICAL_DIR.rglob("*") if item.is_file()):
        raw = path.read_bytes()
        inventory.append(
            {
                "path": path.relative_to(REPOSITORY_ROOT).as_posix(),
                "sha256": sha256(raw),
                "size": len(raw),
            }
        )
    builder.write_json("provenance/historical-fixtures.sha256.json", inventory)

    for source_name, vector_id in (
        ("action_contract.json", "ac1-valid-alpha2-basic-001"),
        ("action_contract_specialchars.json", "ac1-valid-alpha2-specialchars-001"),
    ):
        raw = (HISTORICAL_DIR / source_name).read_bytes()
        parsed = parse_legacy_json(raw)
        assert isinstance(parsed, dict)
        stored_hash = parsed.pop("contract_hash")
        assert isinstance(stored_hash, str)
        canonical = encode_legacy_json(parsed)
        assert sha256(canonical) == stored_hash
        expected = canonical_expected(
            vector_id,
            canonical,
            contract_positive_result(),
            rule="Historical ActionContract body excluding contract_hash",
        )
        expected["object_hash"] = stored_hash
        builder.add_vector(
            vector_id=vector_id,
            family="contract",
            object_type="action-contract",
            input_bytes=raw,
            expected=expected,
            canonical=canonical,
            provenance="historical-alpha2-byte-copy",
            capabilities=["canonical", "hash", "verify"],
            tags=["historical", "action-contract"],
        )

    for source_name, vector_id in (
        ("decision_approved.canonical.json", "can1-valid-alpha2-decision-001"),
        ("outcome_succeeded.canonical.json", "can1-valid-alpha2-outcome-001"),
    ):
        raw = (HISTORICAL_DIR / "canonical" / source_name).read_bytes()
        canonical = raw.removesuffix(b"\n")
        assert encode_legacy_json(parse_legacy_json(raw)) == canonical
        expected = canonical_expected(
            vector_id,
            canonical,
            canonical_positive_result(),
            rule="Historical Python 0.1.0a2 canonical unsigned event bytes",
        )
        builder.add_vector(
            vector_id=vector_id,
            family="canonical",
            object_type="unknown",
            input_bytes=raw,
            expected=expected,
            canonical=canonical,
            provenance="historical-alpha2-byte-copy",
            capabilities=["canonical"],
            tags=["historical", "evidence"],
        )

    raw_journal = (HISTORICAL_DIR / "journal.jsonl").read_bytes()
    previous: str | None = None
    count = 0
    for line in raw_journal.splitlines():
        if not line.strip():
            continue
        event = parse_legacy_json(line)
        assert isinstance(event, dict)
        submitted_hash = event["event_hash"]
        submitted_signature = event["signature"]
        assert isinstance(submitted_hash, str)
        assert isinstance(submitted_signature, str)
        assert event["previous_event_hash"] == previous
        payload = {
            k: v for k, v in event.items() if k not in {"event_hash", "signature"}
        }
        canonical = encode_legacy_json(payload)
        digest = hashlib.sha256(canonical).digest()
        assert digest.hex() == submitted_hash
        historical_public_key.verify(base64.b64decode(submitted_signature), digest)
        previous = submitted_hash
        count += 1
    expected = canonical_expected(
        "ev1-valid-alpha2-journal-001",
        None,
        evidence_positive_result(
            object_type="evidence-chain",
            events_verified=count,
            continuity="valid_genesis",
            completeness="completeness_unknown",
        ),
        rule="Historical journal preserved byte-for-byte",
    )
    expected["chain_head"] = previous
    builder.add_vector(
        vector_id="ev1-valid-alpha2-journal-001",
        family="chain",
        object_type="evidence-chain",
        input_bytes=raw_journal,
        expected=expected,
        extension="jsonl",
        provenance="historical-alpha2-byte-copy",
        capabilities=["hash", "signature", "continuity", "semantics", "verify"],
        tags=["historical", "journal", "required"],
        key_ref="alpha2-historical",
    )


def add_canonical_vectors(builder: SuiteBuilder) -> None:
    positives: list[tuple[str, bytes, list[str], str | None]] = [
        ("can1-valid-empty-object-001", b"{}", ["empty", "object"], None),
        ("can1-valid-empty-array-001", b"[]", ["empty", "array"], None),
        ("can1-valid-null-001", b"null", ["null"], None),
        ("can1-valid-true-001", b"true", ["boolean"], None),
        ("can1-valid-false-001", b"false", ["boolean"], None),
        ("can1-valid-zero-001", b"0", ["integer"], None),
        ("can1-valid-negative-integer-001", b"-7", ["integer"], None),
        (
            "can1-valid-large-integer-001",
            b"123456789012345678901234567890",
            ["integer", "large"],
            "DIV-002",
        ),
        ("can1-valid-float-one-001", b"1.0", ["float", "python-emitted"], None),
        (
            "can1-valid-float-negative-zero-001",
            b"-0.0",
            ["float", "python-emitted"],
            None,
        ),
        (
            "can1-valid-float-boundary-small-001",
            b"1e-07",
            ["float", "python-emitted"],
            None,
        ),
        (
            "can1-valid-float-boundary-large-001",
            b"1e+300",
            ["float", "python-emitted"],
            None,
        ),
        ("can1-valid-sorted-ascii-keys-001", b'{"z":1,"a":2}', ["ordering"], None),
        ("can1-valid-prefix-keys-001", b'{"aa":1,"a":2}', ["ordering"], None),
        (
            "can1-valid-unicode-bmp-keys-001",
            '{"é":1,"e":2}'.encode(),
            ["ordering", "unicode"],
            None,
        ),
        (
            "can1-valid-unicode-supplementary-keys-001",
            '{"😀":1,"\\uffff":2}'.encode(),
            ["ordering", "unicode"],
            None,
        ),
        (
            "can1-valid-raw-unicode-001",
            '{"k":"café 日本語 ☕"}'.encode(),
            ["unicode"],
            None,
        ),
        (
            "can1-valid-special-characters-001",
            b'{"amp":"&","back":"\\\\","greater":">","less":"<","quote":"\\"","solidus":"/"}',
            ["escaping"],
            None,
        ),
        (
            "can1-valid-control-characters-001",
            b'{"k":"\\b\\f\\n\\r\\t\\u0000\\u001f"}',
            ["escaping", "controls"],
            None,
        ),
        (
            "can1-valid-u2028-raw-001",
            '{"k":"\u2028"}'.encode(),
            ["unicode", "u2028", "required"],
            "DIV-001",
        ),
        (
            "can1-valid-u2029-raw-001",
            '{"k":"\u2029"}'.encode(),
            ["unicode", "u2029", "required"],
            "DIV-001",
        ),
        (
            "can1-valid-nested-001",
            b'{"z":[{"b":2,"a":1},[],null],"a":{"k":true}}',
            ["nested"],
            None,
        ),
        (
            "can1-valid-unknown-field-hashed-001",
            b'{"known":"value","x_future":{"n":7}}',
            ["legacy-unknown-field"],
            None,
        ),
        (
            "can1-valid-number-1Eplus2-001",
            b'{"x":1E+2}',
            ["numeric-lexeme", "required"],
            "DIV-002",
        ),
        (
            "can1-valid-number-1e2-001",
            b'{"x":1e2}',
            ["numeric-lexeme", "required"],
            "DIV-002",
        ),
        ("can1-valid-number-100-001", b'{"x":100}', ["numeric-lexeme"], None),
        (
            "can1-valid-number-negative-zero-001",
            b'{"x":-0}',
            ["numeric-lexeme"],
            "DIV-002",
        ),
        ("can1-valid-number-zero-001", b'{"x":0}', ["numeric-lexeme"], None),
        (
            "can1-valid-number-zero-point-zero-001",
            b'{"x":0.0}',
            ["numeric-lexeme"],
            "DIV-002",
        ),
        (
            "can1-valid-number-safe-max-001",
            b'{"x":9007199254740991}',
            ["numeric-lexeme", "large"],
            None,
        ),
        (
            "can1-valid-number-beyond-safe-001",
            b'{"x":9007199254740993}',
            ["numeric-lexeme", "large"],
            "DIV-002",
        ),
    ]
    for vector_id, raw, tags, divergence in positives:
        canonical = encode_legacy_json(parse_legacy_json(raw))
        if vector_id == "can1-valid-u2028-raw-001":
            assert bytes.fromhex("e280a8") in canonical and b"\\u2028" not in canonical
        if vector_id == "can1-valid-u2029-raw-001":
            assert bytes.fromhex("e280a9") in canonical and b"\\u2029" not in canonical
        expected = canonical_expected(
            vector_id,
            canonical,
            canonical_positive_result(),
            rule="Schema-1 legacy canonical reconstruction with preserved numeric lexemes",
        )
        builder.add_vector(
            vector_id=vector_id,
            family="canonical",
            object_type="unknown",
            input_bytes=raw,
            expected=expected,
            canonical=canonical,
            capabilities=["canonical"],
            tags=tags,
            known_divergence=divergence,
        )

    lost_id = "can1-unsupported-number-lexeme-lost-001"
    lost_raw = b'{"x":1E+2}'
    lost_result = result(
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
    lost_expected = canonical_expected(
        lost_id,
        None,
        lost_result,
        rule="Simulated verifier capability loss must fail closed",
    )
    builder.add_vector(
        vector_id=lost_id,
        family="canonical",
        object_type="unknown",
        input_bytes=lost_raw,
        expected=lost_expected,
        capabilities=["capability-failure"],
        tags=["numeric-lexeme", "required", "fail-closed"],
        mutation={
            "base_vector": "can1-valid-number-1Eplus2-001",
            "operation": "drop_numeric_lexemes",
            "recompute_hash": False,
        },
        known_divergence="DIV-002",
        expected_primary_issue="unsupported_legacy_representation",
    )

    excessive_depth = b"[" * 66 + b"0" + b"]" * 66
    excessive_size = b'{"padding":"' + b"x" * 1_048_577 + b'"}'
    negatives: list[tuple[str, bytes, str]] = [
        ("can1-invalid-nan-001", b'{"x":NaN}', "malformed"),
        ("can1-invalid-infinity-001", b'{"x":Infinity}', "malformed"),
        ("can1-invalid-utf8-001", b'{"x":"\xff"}', "invalid_utf8"),
        ("can1-invalid-surrogate-001", b'{"x":"\\ud800"}', "invalid_unicode_scalar"),
        ("can1-invalid-trailing-content-001", b'{"x":1} trailing', "trailing_content"),
        ("can1-invalid-duplicate-member-001", b'{"x":1,"x":2}', "duplicate_member"),
        ("can1-indeterminate-excessive-depth-001", excessive_depth, "resource_limit"),
        ("can1-indeterminate-excessive-size-001", excessive_size, "resource_limit"),
        ("can1-invalid-leading-plus-001", b'{"x":+1}', "malformed"),
        ("can1-invalid-leading-zero-001", b'{"x":01}', "malformed"),
        ("can1-invalid-incomplete-decimal-001", b'{"x":1.}', "malformed"),
        ("can1-invalid-malformed-exponent-001", b'{"x":1e}', "malformed"),
    ]
    for vector_id, raw, code in negatives:
        if code == "invalid_unicode_scalar":
            verification = result(
                "unknown",
                overrides={
                    "canonicalization": "invalid",
                    "summary": "invalid",
                },
                issues=[issue(code)],
            )
        else:
            verification = malformed_result(
                "unknown",
                code,
                summary="indeterminate" if code == "resource_limit" else "invalid",
            )
        expected = canonical_expected(
            vector_id,
            None,
            verification,
            rule="Fail-closed legacy parser or bounded-resource rejection",
        )
        builder.add_vector(
            vector_id=vector_id,
            family="canonical",
            object_type="unknown",
            input_bytes=raw,
            expected=expected,
            capabilities=["parse", "canonical"],
            tags=["negative", code],
            expected_primary_issue=code,
        )


CONTRACT_FIELDS = {
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


def build_contract(body: dict[str, Any]) -> tuple[dict[str, Any], bytes]:
    canonical = compact_json(body)
    contract = dict(body)
    contract["contract_hash"] = sha256(canonical)
    return contract, canonical


def add_contract_vectors(builder: SuiteBuilder) -> None:
    kinds = [
        "POSITIONAL_ONLY",
        "POSITIONAL_OR_KEYWORD",
        "VAR_POSITIONAL",
        "KEYWORD_ONLY",
        "VAR_KEYWORD",
    ]
    base_body = {
        "schema_version": "1",
        "action_name": "conformance.contract",
        "module": "conformance",
        "qualified_name": "contract",
        "risk": "low",
        "approval_mode": "never",
        "execution_mode": "embedded",
        "parameter_descriptors": [
            {
                "name": f"p{index}",
                "kind": kind,
                "has_default": kind == "KEYWORD_ONLY",
                "annotation": None
                if index == 0
                else "typing.Annotated[str, 'café ☕']",
            }
            for index, kind in enumerate(kinds)
        ],
        "code_fingerprint": None,
    }
    positives = [
        ("ac1-valid-all-parameter-kinds-001", base_body),
    ]
    for risk in ("low", "medium", "high", "critical"):
        body = copy.deepcopy(base_body)
        body["risk"] = risk
        body["approval_mode"] = "required"
        body["action_name"] = f"conformance.risk.{risk}"
        positives.append((f"ac1-valid-risk-{risk}-001", body))
    for vector_id, body in positives:
        contract, canonical = build_contract(body)
        expected = canonical_expected(
            vector_id,
            canonical,
            contract_positive_result(),
            rule="Schema-1 ActionContract body excludes contract_hash",
        )
        expected["object_hash"] = contract["contract_hash"]
        builder.add_vector(
            vector_id=vector_id,
            family="contract",
            object_type="action-contract",
            input_bytes=json_bytes(contract),
            expected=expected,
            canonical=canonical,
            capabilities=["canonical", "hash", "verify"],
            tags=["deterministic", "python-origin-descriptors"],
        )

    base_contract, _ = build_contract(base_body)
    negatives: list[tuple[str, dict[str, Any], str]] = []
    for vector_id, mutate, code in (
        ("ac1-unsupported-schema-001", ("schema_version", "2"), "unsupported_schema"),
        ("ac1-invalid-extra-field-001", ("extra", True), "unknown_field"),
        ("ac1-invalid-wrong-type-001", ("risk", 7), "invalid_field"),
        ("ac1-invalid-action-name-001", ("action_name", "1bad"), "invalid_field"),
        (
            "ac1-invalid-unicode-action-name-001",
            ("action_name", "café.transfer"),
            "invalid_field",
        ),
        ("ac1-invalid-risk-001", ("risk", "extreme"), "invalid_field"),
        ("ac1-invalid-approval-001", ("approval_mode", "sometimes"), "invalid_field"),
        (
            "ac1-invalid-execution-mode-001",
            ("execution_mode", "managed"),
            "invalid_field",
        ),
        (
            "ac1-invalid-descriptor-001",
            ("parameter_descriptors", [{"name": "x"}]),
            "invalid_field",
        ),
        (
            "ac1-invalid-fingerprint-001",
            ("code_fingerprint", "not-a-hash"),
            "invalid_field",
        ),
        ("ac1-invalid-malformed-hash-001", ("contract_hash", "bad"), "invalid_field"),
    ):
        value = copy.deepcopy(base_contract)
        value[mutate[0]] = mutate[1]
        negatives.append((vector_id, value, code))
    missing = copy.deepcopy(base_contract)
    missing.pop("risk")
    negatives.append(("ac1-invalid-missing-field-001", missing, "missing_field"))
    tampered = copy.deepcopy(base_contract)
    tampered["risk"] = "critical"
    negatives.append(("ac1-invalid-tampered-body-001", tampered, "hash_mismatch"))

    for vector_id, contract, code in negatives:
        if code == "unsupported_schema":
            verification = result(
                "action-contract",
                object_schema_id="2",
                overrides={
                    "schema": "unsupported",
                    "canonicalization": "not_evaluated",
                    "object_hash": "not_evaluated",
                    "semantics": "not_evaluated",
                    "summary": "unsupported",
                },
                issues=[issue(code)],
            )
        elif code == "hash_mismatch":
            verification = contract_positive_result("mismatch")
        else:
            verification = result(
                "action-contract",
                overrides={
                    "schema": "invalid",
                    "canonicalization": "not_evaluated",
                    "object_hash": "not_evaluated",
                    "semantics": "not_evaluated",
                    "summary": "invalid",
                },
                issues=[issue(code)],
            )
        expected = canonical_expected(
            vector_id,
            None,
            verification,
            rule="Closed schema-1 ActionContract validation",
        )
        builder.add_vector(
            vector_id=vector_id,
            family="contract",
            object_type="action-contract",
            input_bytes=json_bytes(contract),
            expected=expected,
            capabilities=["verify"],
            tags=["negative", "action-contract"],
            expected_primary_issue=code,
        )

    duplicate_id = "ac1-invalid-duplicate-member-001"
    duplicate_raw = json_bytes(base_contract).replace(
        b'  "action_name": "conformance.contract",\n',
        b'  "action_name": "conformance.contract",\n  "action_name": "duplicate",\n',
        1,
    )
    builder.add_vector(
        vector_id=duplicate_id,
        family="contract",
        object_type="action-contract",
        input_bytes=duplicate_raw,
        expected=canonical_expected(
            duplicate_id,
            None,
            malformed_result("action-contract", "duplicate_member"),
            rule="Duplicate members are rejected before object construction",
        ),
        capabilities=["parse", "verify"],
        tags=["negative", "duplicate"],
        expected_primary_issue="duplicate_member",
    )


def event_expected(
    vector_id: str,
    event: dict[str, Any],
    canonical: bytes | None,
    verification: dict[str, Any],
    *,
    fingerprint: str,
    rule: str,
) -> dict[str, Any]:
    signature = None
    if isinstance(event.get("signature"), str):
        try:
            signature_raw = base64.b64decode(event["signature"], validate=True)
        except (ValueError, TypeError):
            signature_raw = b""
        signature = signature_metadata(
            signature_raw,
            key_id=str(event.get("key_id")),
            fingerprint=fingerprint,
        )
    value = canonical_expected(
        vector_id,
        canonical,
        verification,
        rule=rule,
        signature=signature,
    )
    value["event_hash"] = event.get("event_hash")
    return value


def evidence_failure_result(
    *,
    code: str,
    object_schema_id: str = "1",
    schema: str = "supported",
    canonicalization: str = "valid",
    object_hash: str = "valid",
    signature: str = "valid",
    key_resolution: str = "resolved",
    continuity: str = "not_applicable",
    semantics: str = "not_evaluated",
    summary: str = "invalid",
    issues: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return result(
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
            "continuity": continuity,
            "completeness": "not_applicable",
            "semantics": semantics,
            "trust": "not_evaluated",
            "time_confidence": "not_evaluated",
            "summary": summary,
        },
        issues=issues or [issue(code)],
    )


def add_evidence_vectors(
    builder: SuiteBuilder,
    private: Ed25519PrivateKey,
    public: bytes,
    fingerprint: str,
    key_id: str,
) -> dict[str, dict[str, Any]]:
    event_specs = [
        (
            "ev1-valid-allowed-decision-001",
            decision_payload(key_id=key_id, event_id="evt-allow"),
        ),
        (
            "ev1-valid-denied-decision-001",
            decision_payload(key_id=key_id, event_id="evt-deny", decision="denied"),
        ),
        (
            "ev1-valid-metadata-001",
            decision_payload(
                key_id=key_id,
                event_id="evt-metadata",
                metadata={"suite": "schema-1", "nested": {"n": 7}},
            ),
        ),
        (
            "ev1-valid-u2028-signed-001",
            decision_payload(
                key_id=key_id,
                event_id="evt-u2028",
                summary="before\u2028after",
            ),
        ),
        (
            "ev1-valid-u2029-signed-001",
            decision_payload(
                key_id=key_id,
                event_id="evt-u2029",
                summary="before\u2029after",
            ),
        ),
        (
            "ev1-valid-unknown-field-hashed-001",
            {
                **decision_payload(key_id=key_id, event_id="evt-unknown-field"),
                "x_future": {"meaning": "not-registered", "n": 7},
            },
        ),
    ]
    events: dict[str, dict[str, Any]] = {}
    for vector_id, payload in event_specs:
        event, canonical, digest = finalize_event(payload, private)
        private.public_key().verify(base64.b64decode(event["signature"]), digest)
        verification = evidence_positive_result()
        if vector_id == "ev1-valid-unknown-field-hashed-001":
            verification["issues"].insert(0, issue("unknown_fields_present"))
        expected = event_expected(
            vector_id,
            event,
            canonical,
            verification,
            fingerprint=fingerprint,
            rule="Ed25519 over raw SHA-256 digest of schema-1 canonical unsigned payload",
        )
        divergence = (
            "DIV-001"
            if vector_id in {"ev1-valid-u2028-signed-001", "ev1-valid-u2029-signed-001"}
            else None
        )
        builder.add_vector(
            vector_id=vector_id,
            family="evidence",
            object_type="evidence-event",
            input_bytes=json_bytes(event),
            expected=expected,
            canonical=canonical,
            capabilities=["canonical", "hash", "signature", "verify"],
            tags=["positive", event["event_type"]],
            key_ref="deterministic-001",
            known_divergence=divergence,
        )
        events[vector_id] = event

    base = events["ev1-valid-allowed-decision-001"]
    mutations: list[tuple[str, dict[str, Any] | bytes, str, dict[str, Any]]] = []

    tampered_payload = copy.deepcopy(base)
    tampered_payload["risk"] = "critical"
    mutations.append(
        (
            "ev1-invalid-tampered-payload-001",
            tampered_payload,
            "hash_mismatch",
            evidence_failure_result(
                code="hash_mismatch",
                object_hash="mismatch",
                signature="invalid",
                issues=[issue("hash_mismatch"), issue("invalid_signature")],
            ),
        )
    )
    recomputed_hash = copy.deepcopy(tampered_payload)
    recomputed_payload = {
        k: v for k, v in recomputed_hash.items() if k not in {"event_hash", "signature"}
    }
    recomputed_hash["event_hash"] = sha256(compact_json(recomputed_payload))
    mutations.append(
        (
            "ev1-invalid-recomputed-hash-original-signature-001",
            recomputed_hash,
            "invalid_signature",
            evidence_failure_result(code="invalid_signature", signature="invalid"),
        )
    )
    tampered_signature = copy.deepcopy(base)
    raw_sig = bytearray(base64.b64decode(tampered_signature["signature"]))
    raw_sig[0] ^= 1
    tampered_signature["signature"] = b64(bytes(raw_sig))
    mutations.append(
        (
            "ev1-invalid-tampered-signature-001",
            tampered_signature,
            "invalid_signature",
            evidence_failure_result(code="invalid_signature", signature="invalid"),
        )
    )
    malformed_signature = copy.deepcopy(base)
    malformed_signature["signature"] = "not-base64!"
    mutations.append(
        (
            "ev1-invalid-malformed-signature-001",
            malformed_signature,
            "invalid_signature",
            evidence_failure_result(code="invalid_signature", signature="invalid"),
        )
    )
    short_signature = copy.deepcopy(base)
    short_signature["signature"] = b64(b"short")
    mutations.append(
        (
            "ev1-invalid-signature-length-001",
            short_signature,
            "invalid_signature",
            evidence_failure_result(code="invalid_signature", signature="invalid"),
        )
    )
    wrong_representation = copy.deepcopy(base)
    payload = {
        k: v
        for k, v in wrong_representation.items()
        if k not in {"event_hash", "signature"}
    }
    wrong_representation["signature"] = b64(private.sign(compact_json(payload)))
    mutations.append(
        (
            "ev1-invalid-signature-wrong-representation-001",
            wrong_representation,
            "invalid_signature",
            evidence_failure_result(code="invalid_signature", signature="invalid"),
        )
    )
    unsupported = copy.deepcopy(base)
    unsupported["schema_version"] = "2"
    mutations.append(
        (
            "ev1-unsupported-schema-001",
            unsupported,
            "unsupported_schema",
            evidence_failure_result(
                code="unsupported_schema",
                object_schema_id="2",
                schema="unsupported",
                canonicalization="not_evaluated",
                object_hash="not_evaluated",
                signature="not_evaluated",
                key_resolution="not_evaluated",
                summary="unsupported",
            ),
        )
    )
    unregistered = copy.deepcopy(base)
    unregistered["event_type"] = "execution_started"
    mutations.append(
        (
            "ev1-invalid-unregistered-event-type-001",
            unregistered,
            "invalid_field",
            evidence_failure_result(
                code="invalid_field",
                schema="invalid",
                canonicalization="not_evaluated",
                object_hash="not_evaluated",
                signature="not_evaluated",
                key_resolution="not_evaluated",
            ),
        )
    )
    missing = copy.deepcopy(base)
    missing.pop("risk")
    mutations.append(
        (
            "ev1-invalid-missing-field-001",
            missing,
            "missing_field",
            evidence_failure_result(
                code="missing_field",
                schema="invalid",
                canonicalization="not_evaluated",
                object_hash="not_evaluated",
                signature="not_evaluated",
                key_resolution="not_evaluated",
            ),
        )
    )
    wrong_type = copy.deepcopy(base)
    wrong_type["event_id"] = 7
    mutations.append(
        (
            "ev1-invalid-wrong-field-type-001",
            wrong_type,
            "invalid_field",
            evidence_failure_result(
                code="invalid_field",
                schema="invalid",
                canonicalization="not_evaluated",
                object_hash="not_evaluated",
                signature="not_evaluated",
                key_resolution="not_evaluated",
            ),
        )
    )
    invalid_time = copy.deepcopy(base)
    invalid_time["timestamp_utc"] = "not-a-time"
    mutations.append(
        (
            "ev1-invalid-timestamp-001",
            invalid_time,
            "invalid_field",
            evidence_failure_result(
                code="invalid_field",
                schema="invalid",
                canonicalization="not_evaluated",
                object_hash="not_evaluated",
                signature="not_evaluated",
                key_resolution="not_evaluated",
            ),
        )
    )
    invalid_decision = copy.deepcopy(base)
    invalid_decision["decision"] = "maybe"
    mutations.append(
        (
            "ev1-invalid-decision-001",
            invalid_decision,
            "invalid_field",
            evidence_failure_result(
                code="invalid_field",
                schema="invalid",
                canonicalization="not_evaluated",
                object_hash="not_evaluated",
                signature="not_evaluated",
                key_resolution="not_evaluated",
            ),
        )
    )
    unknown_key = copy.deepcopy(base)
    unknown_key["key_id"] = "ed25519:0000000000000000"
    payload = {
        k: v for k, v in unknown_key.items() if k not in {"event_hash", "signature"}
    }
    digest = hashlib.sha256(compact_json(payload)).digest()
    unknown_key["event_hash"] = digest.hex()
    unknown_key["signature"] = b64(private.sign(digest))
    mutations.append(
        (
            "ev1-indeterminate-unknown-key-001",
            unknown_key,
            "unknown_key",
            evidence_failure_result(
                code="unknown_key",
                signature="not_evaluated",
                key_resolution="unknown",
                summary="indeterminate",
            ),
        )
    )
    ambiguous_key = copy.deepcopy(base)
    mutations.append(
        (
            "ev1-indeterminate-ambiguous-key-001",
            ambiguous_key,
            "ambiguous_key",
            evidence_failure_result(
                code="ambiguous_key",
                signature="not_evaluated",
                key_resolution="ambiguous",
                summary="indeterminate",
            ),
        )
    )
    wrong_public = copy.deepcopy(base)
    mutations.append(
        (
            "ev1-invalid-wrong-public-key-001",
            wrong_public,
            "invalid_signature",
            evidence_failure_result(code="invalid_signature", signature="invalid"),
        )
    )

    for vector_id, mutated, code, verification in mutations:
        raw = mutated if isinstance(mutated, bytes) else json_bytes(mutated)
        event = mutated if isinstance(mutated, dict) else {}
        expected = event_expected(
            vector_id,
            event,
            None,
            verification,
            fingerprint=fingerprint,
            rule="Fail-closed schema-1 Evidence mutation",
        )
        operation = {
            "ev1-indeterminate-ambiguous-key-001": "ambiguous_key_resolution",
            "ev1-invalid-wrong-public-key-001": "use_wrong_public_key",
        }.get(vector_id, "replace")
        builder.add_vector(
            vector_id=vector_id,
            family="evidence",
            object_type="evidence-event",
            input_bytes=raw,
            expected=expected,
            capabilities=["verify"],
            tags=["negative", code],
            key_ref="deterministic-001",
            mutation={
                "base_vector": "ev1-valid-allowed-decision-001",
                "operation": operation,
                "recompute_hash": vector_id
                in {
                    "ev1-invalid-recomputed-hash-original-signature-001",
                    "ev1-indeterminate-unknown-key-001",
                },
            },
            expected_primary_issue=code,
            allowed_secondary_issues=(
                ["invalid_signature"]
                if vector_id == "ev1-invalid-tampered-payload-001"
                else []
            ),
        )

    malformed_id = "ev1-malformed-object-001"
    builder.add_vector(
        vector_id=malformed_id,
        family="evidence",
        object_type="evidence-event",
        input_bytes=b"[1,2]\n",
        expected=canonical_expected(
            malformed_id,
            None,
            malformed_result("evidence-event"),
            rule="Evidence top-level must be an object",
        ),
        capabilities=["parse", "verify"],
        tags=["negative", "malformed"],
        expected_primary_issue="malformed",
    )
    return events


def chain_bytes(events: list[dict[str, Any]]) -> bytes:
    return b"".join(compact_json(event) + b"\n" for event in events)


def add_chain_vectors(
    builder: SuiteBuilder,
    private: Ed25519PrivateKey,
    fingerprint: str,
    key_id: str,
) -> dict[str, list[dict[str, Any]]]:
    decision, _, _ = finalize_event(
        decision_payload(key_id=key_id, event_id="chain-allow"),
        private,
    )
    outcome, _, _ = finalize_event(
        outcome_payload(
            key_id=key_id,
            event_id="chain-success",
            decision_event_id=decision["event_id"],
            previous=decision["event_hash"],
        ),
        private,
    )
    failed, _, _ = finalize_event(
        outcome_payload(
            key_id=key_id,
            event_id="chain-failed",
            decision_event_id=decision["event_id"],
            previous=decision["event_hash"],
            status="failed",
        ),
        private,
    )
    denied, _, _ = finalize_event(
        decision_payload(key_id=key_id, event_id="chain-deny", decision="denied"),
        private,
    )
    chains: dict[str, list[dict[str, Any]]] = {
        "ev1-valid-allowed-succeeded-chain-001": [decision, outcome],
        "ev1-valid-allowed-failed-chain-001": [decision, failed],
        "ev1-valid-denied-chain-001": [denied],
        "ev1-valid-tail-unwitnessed-001": [decision],
    }
    for vector_id, events in chains.items():
        verification = evidence_positive_result(
            object_type="evidence-chain",
            events_verified=len(events),
            continuity="valid_genesis",
            completeness="completeness_unknown",
        )
        expected = canonical_expected(
            vector_id,
            None,
            verification,
            rule="Schema-1 Evidence chain continuity and lifecycle",
        )
        expected["chain_head"] = events[-1]["event_hash"]
        builder.add_vector(
            vector_id=vector_id,
            family="chain",
            object_type="evidence-chain",
            input_bytes=chain_bytes(events),
            expected=expected,
            extension="jsonl",
            capabilities=["hash", "signature", "continuity", "semantics", "verify"],
            tags=["chain", "positive"],
            key_ref="deterministic-001",
        )

    partial_result = evidence_positive_result(
        object_type="evidence-chain",
        events_verified=1,
        continuity="valid_anchored",
        completeness="completeness_unknown",
    )
    partial_event = copy.deepcopy(outcome)
    partial_expected = canonical_expected(
        "ev1-valid-partial-anchored-001",
        None,
        partial_result,
        rule="Partial segment verified against trusted preceding hash",
    )
    builder.add_vector(
        vector_id="ev1-valid-partial-anchored-001",
        family="chain",
        object_type="evidence-chain",
        input_bytes=chain_bytes([partial_event]),
        expected=partial_expected,
        extension="jsonl",
        capabilities=["hash", "signature", "continuity", "verify"],
        tags=["chain", "partial", "anchored"],
        key_ref="deterministic-001",
        mutation={
            "operation": "verify_partial_segment",
            "trusted_preceding_hash": decision["event_hash"],
            "trusted_decision": {
                "event_id": decision["event_id"],
                "decision": decision["decision"],
            },
        },
    )

    wrong_genesis_payload = {
        k: v for k, v in decision.items() if k not in {"event_hash", "signature"}
    }
    wrong_genesis_payload["previous_event_hash"] = "11" * 32
    wrong_genesis, _, _ = finalize_event(wrong_genesis_payload, private)
    broken = [decision, copy.deepcopy(outcome)]
    broken_payload = {
        k: v for k, v in broken[1].items() if k not in {"event_hash", "signature"}
    }
    broken_payload["previous_event_hash"] = "22" * 32
    broken[1], _, _ = finalize_event(broken_payload, private)
    deleted = [outcome]
    inserted = [decision, copy.deepcopy(decision), outcome]
    reordered = [outcome, decision]
    duplicated = [decision, outcome, copy.deepcopy(outcome)]
    fork_payload = {
        k: v for k, v in decision.items() if k not in {"event_hash", "signature"}
    }
    fork_payload["risk"] = "critical"
    fork_second, _, _ = finalize_event(fork_payload, private)
    fork = [decision, fork_second]
    orphan, _, _ = finalize_event(
        outcome_payload(
            key_id=key_id,
            event_id="chain-orphan",
            decision_event_id="missing-decision",
            previous=None,
        ),
        private,
    )
    after_denial, _, _ = finalize_event(
        outcome_payload(
            key_id=key_id,
            event_id="chain-after-denial",
            decision_event_id=denied["event_id"],
            previous=denied["event_hash"],
        ),
        private,
    )
    duplicate_outcome = copy.deepcopy(outcome)
    duplicate_outcome["event_id"] = "chain-success-duplicate"
    duplicate_payload = {
        k: v
        for k, v in duplicate_outcome.items()
        if k not in {"event_hash", "signature"}
    }
    duplicate_payload["previous_event_hash"] = outcome["event_hash"]
    duplicate_outcome, _, _ = finalize_event(duplicate_payload, private)

    second_instance_payload = decision_payload(
        key_id=key_id,
        event_id="chain-second-instance",
        decision="denied",
        previous=denied["event_hash"],
    )
    second_instance_payload["action_id"] = "conformance.actions.second"
    second_instance_payload["action_name"] = "conformance.second"
    second_instance, _, _ = finalize_event(second_instance_payload, private)
    multi_instance_result = evidence_positive_result(
        object_type="evidence-chain",
        events_verified=2,
        continuity="valid_genesis",
        completeness="completeness_unknown",
    )
    builder.add_vector(
        vector_id="ev1-valid-multiple-action-instances-001",
        family="chain",
        object_type="evidence-chain",
        input_bytes=chain_bytes([denied, second_instance]),
        expected=canonical_expected(
            "ev1-valid-multiple-action-instances-001",
            None,
            multi_instance_result,
            rule="One journal may contain independent Action instances",
        ),
        extension="jsonl",
        capabilities=["hash", "signature", "continuity", "semantics", "verify"],
        tags=["chain", "multiple-instances", "positive"],
        key_ref="deterministic-001",
    )

    negative_specs: list[tuple[str, list[dict[str, Any]], str, int]] = [
        ("ev1-invalid-wrong-genesis-001", [wrong_genesis], "chain_discontinuity", 0),
        ("ev1-invalid-broken-previous-hash-001", broken, "chain_discontinuity", 1),
        ("ev1-invalid-middle-deletion-001", deleted, "chain_discontinuity", 0),
        ("ev1-invalid-insertion-001", inserted, "chain_discontinuity", 2),
        ("ev1-invalid-reorder-001", reordered, "chain_discontinuity", 0),
        ("ev1-invalid-duplicate-event-001", duplicated, "chain_discontinuity", 2),
        ("ev1-invalid-fork-001", fork, "fork_detected", 1),
        ("ev1-invalid-orphan-outcome-001", [orphan], "unknown_decision_reference", 1),
        (
            "ev1-invalid-outcome-after-denial-001",
            [denied, after_denial],
            "invalid_transition",
            2,
        ),
        (
            "ev1-invalid-duplicate-outcome-001",
            [decision, outcome, duplicate_outcome],
            "duplicate_outcome",
            3,
        ),
    ]
    for vector_id, events, code, verified_count in negative_specs:
        continuity = (
            "discontinuous"
            if code in {"chain_discontinuity", "fork_detected"}
            else "valid_genesis"
        )
        verification = result(
            "evidence-chain",
            events_verified=verified_count,
            overrides={
                "algorithm": "supported",
                "object_hash": "valid",
                "signature": "valid",
                "key_resolution": "resolved",
                "continuity": continuity,
                "completeness": "completeness_unknown",
                "semantics": (
                    "invalid"
                    if code
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
            issues=[issue(code)],
        )
        builder.add_vector(
            vector_id=vector_id,
            family="chain",
            object_type="evidence-chain",
            input_bytes=chain_bytes(events),
            expected=canonical_expected(
                vector_id,
                None,
                verification,
                rule="Schema-1 chain mutation or lifecycle rejection",
            ),
            extension="jsonl",
            capabilities=["continuity", "semantics", "verify"],
            tags=["chain", "negative", code],
            key_ref="deterministic-001",
            mutation={
                "base_vector": "ev1-valid-allowed-succeeded-chain-001",
                "operation": (
                    "reorder"
                    if "reorder" in vector_id
                    else "truncate"
                    if "deletion" in vector_id
                    else "replace"
                ),
                "recompute_hash": False,
            },
            expected_primary_issue=code,
        )

    incomplete = result(
        "evidence-chain",
        events_verified=1,
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
    builder.add_vector(
        vector_id="ev1-indeterminate-checkpoint-head-missing-001",
        family="chain",
        object_type="evidence-chain",
        input_bytes=chain_bytes([decision]),
        expected=canonical_expected(
            "ev1-indeterminate-checkpoint-head-missing-001",
            None,
            incomplete,
            rule="Trusted required head proves the submitted chain incomplete",
        ),
        extension="jsonl",
        capabilities=["continuity", "completeness", "verify"],
        tags=["chain", "checkpoint", "incomplete"],
        key_ref="deterministic-001",
        mutation={
            "operation": "require_checkpoint_head",
            "required_head": outcome["event_hash"],
        },
        expected_primary_issue="incomplete_chain",
    )
    return chains


def add_trust_vectors(
    builder: SuiteBuilder,
    base_event_id: str,
) -> None:
    scenarios = [
        (
            "ev1-valid-self-asserted-key-001",
            "unknown",
            "producer_asserted",
            "valid_but_trust_unknown",
            "trust_unknown",
        ),
        ("ev1-valid-trusted-pin-001", "trusted", "trusted", "valid_and_trusted", None),
        (
            "ev1-indeterminate-trust-unknown-key-001",
            "unknown",
            "unavailable",
            "indeterminate",
            "unknown_key",
        ),
        (
            "ev1-indeterminate-trust-ambiguous-key-001",
            "unknown",
            "unavailable",
            "indeterminate",
            "ambiguous_key",
        ),
        (
            "ev1-valid-untrusted-key-001",
            "untrusted",
            "producer_asserted",
            "valid_but_untrusted",
            "untrusted_key",
        ),
        (
            "ev1-valid-active-organization-binding-001",
            "trusted",
            "trusted",
            "valid_and_trusted",
            None,
        ),
        (
            "ev1-valid-revoked-key-001",
            "revoked",
            "producer_asserted",
            "valid_but_untrusted",
            "revoked_key",
        ),
        (
            "ev1-valid-inside-binding-interval-001",
            "trusted",
            "receipt_bounded",
            "valid_and_trusted",
            None,
        ),
        (
            "ev1-valid-outside-binding-interval-001",
            "outside_binding_interval",
            "receipt_bounded",
            "valid_but_untrusted",
            "outside_binding_interval",
        ),
        (
            "ev1-indeterminate-binding-interval-001",
            "binding_interval_indeterminate",
            "unavailable",
            "indeterminate",
            "binding_interval_indeterminate",
        ),
        (
            "ev1-valid-stale-trust-snapshot-001",
            "unknown",
            "producer_asserted",
            "valid_but_trust_unknown",
            "stale_trust_snapshot",
        ),
        (
            "ev1-valid-absent-revocation-snapshot-001",
            "unknown",
            "producer_asserted",
            "valid_but_trust_unknown",
            "trust_unknown",
        ),
    ]
    for vector_id, trust, time_confidence, summary, code in scenarios:
        key_resolution = "resolved"
        signature = "valid"
        object_hash = "valid"
        events_verified = 1
        issues: list[dict[str, Any]] = []
        if code:
            issues.append(issue(code))
        if code == "unknown_key":
            key_resolution = "unknown"
            signature = "not_evaluated"
            events_verified = 0
        elif code == "ambiguous_key":
            key_resolution = "ambiguous"
            signature = "not_evaluated"
            events_verified = 0
        verification = result(
            "evidence-event",
            events_verified=events_verified,
            overrides={
                "algorithm": "supported",
                "object_hash": object_hash,
                "signature": signature,
                "key_resolution": key_resolution,
                "semantics": "not_applicable",
                "trust": trust,
                "time_confidence": time_confidence,
                "summary": summary,
            },
            issues=issues,
        )
        key_trust = (
            "trusted"
            if trust == "trusted"
            else "untrusted"
            if trust == "untrusted"
            else "unknown"
        )
        binding_evaluation = (
            "outside"
            if trust == "outside_binding_interval"
            else "indeterminate"
            if trust == "binding_interval_indeterminate"
            else "inside"
            if vector_id
            in {
                "ev1-valid-active-organization-binding-001",
                "ev1-valid-inside-binding-interval-001",
            }
            else "not_applicable"
        )
        revocation_snapshot = (
            "revoked"
            if trust == "revoked"
            else "stale"
            if code == "stale_trust_snapshot"
            else "absent"
            if vector_id == "ev1-valid-absent-revocation-snapshot-001"
            else "current"
        )
        trust_basis = (
            "self_asserted"
            if vector_id == "ev1-valid-self-asserted-key-001"
            else "key_pin"
            if vector_id == "ev1-valid-trusted-pin-001"
            else "organization_binding"
            if "binding" in vector_id
            else "none"
        )
        overlay = {
            "artifact_vector_id": base_event_id,
            "trust_profile_id": vector_id,
            "key_resolution": key_resolution,
            "key_trust": key_trust,
            "trust_basis": trust_basis,
            "revocation_snapshot": revocation_snapshot,
            "binding_evaluation": binding_evaluation,
            "time_confidence": time_confidence,
            "binding": {
                "subject": "organization:example",
                "authority": "test-only",
                "valid_from": "2029-01-01T00:00:00Z",
                "valid_until": "2031-01-01T00:00:00Z",
            },
        }
        builder.add_vector(
            vector_id=vector_id,
            family="trust",
            object_type="evidence-event",
            input_bytes=json_bytes(overlay),
            expected=canonical_expected(
                vector_id,
                None,
                verification,
                rule="External trust overlay never changes artifact hash or signature facts",
            ),
            capabilities=["trust", "verify"],
            tags=["trust", trust],
            key_ref="deterministic-001",
            expected_primary_issue=code,
        )


def add_specification_conflict_vector(builder: SuiteBuilder) -> None:
    vector_id = "spec1-indeterminate-conflict-001"
    verification = result(
        "unknown",
        object_schema_id=None,
        overrides={
            "specification": "conflict",
            "parse": "valid",
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
        issues=[issue("specification_conflict")],
    )
    builder.add_vector(
        vector_id=vector_id,
        family="canonical",
        object_type="unknown",
        input_bytes=b"{}\n",
        expected=canonical_expected(
            vector_id,
            None,
            verification,
            rule="Applicable normative artifacts conflict; affected verification stops",
        ),
        capabilities=["governance"],
        tags=["specification", "fail-closed"],
        expected_primary_issue="specification_conflict",
    )


def generate(output: Path) -> str:
    if sys.version_info[:2] != (3, 11):
        raise SystemExit("generator requires CPython 3.11 for the frozen candidate")
    output = output.resolve()
    temp_root = Path(tempfile.gettempdir()).resolve()
    try:
        output.relative_to(temp_root)
    except ValueError as exc:
        raise SystemExit(
            f"output must be below temporary directory {temp_root}"
        ) from exc
    if (
        output == COMMITTED_SUITE.resolve()
        or REPOSITORY_ROOT.resolve() in output.parents
    ):
        raise SystemExit("generator refuses to write inside the repository")
    if output.exists() and any(output.iterdir()):
        raise SystemExit(f"output directory is not empty: {output}")
    output.mkdir(parents=True, exist_ok=True)

    builder = SuiteBuilder(output)
    builder.write(
        "schemas/verification-result-1.schema.json",
        DEFAULT_SCHEMA_PATH.read_bytes(),
    )
    historical_pem = (HISTORICAL_DIR / "verify_key.pem").read_bytes()
    historical_public = serialization.load_pem_public_key(historical_pem)
    if not isinstance(historical_public, Ed25519PublicKey):
        raise SystemExit("historical verification key is not Ed25519")

    private, public, fingerprint, key_id = deterministic_key(builder)
    add_historical_vectors(builder, historical_public)
    add_canonical_vectors(builder)
    add_contract_vectors(builder)
    events = add_evidence_vectors(builder, private, public, fingerprint, key_id)
    add_chain_vectors(builder, private, fingerprint, key_id)
    add_trust_vectors(builder, "ev1-valid-allowed-decision-001")
    add_specification_conflict_vector(builder)

    required = {
        "ac1-valid-alpha2-basic-001",
        "ac1-invalid-tampered-body-001",
        "ev1-valid-alpha2-journal-001",
        "ev1-invalid-tampered-payload-001",
        "ev1-invalid-tampered-signature-001",
        "ev1-invalid-broken-previous-hash-001",
        "ev1-unsupported-schema-001",
        "ev1-malformed-object-001",
        "ev1-indeterminate-unknown-key-001",
        "ev1-valid-revoked-key-001",
        "ev1-valid-tail-unwitnessed-001",
        "ev1-invalid-outcome-after-denial-001",
        "can1-valid-u2028-raw-001",
        "can1-valid-u2029-raw-001",
        "can1-valid-number-1Eplus2-001",
        "can1-valid-number-1e2-001",
        "can1-unsupported-number-lexeme-lost-001",
    }
    actual = {item["id"] for item in builder.vectors}
    missing = required - actual
    if missing:
        raise SystemExit(f"missing required vector IDs: {sorted(missing)}")
    del events, public
    return builder.finalize()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    manifest_hash = generate(args.output)
    print(
        json.dumps(
            {
                "suite": str(args.output.resolve()),
                "manifest_sha256": manifest_hash,
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
