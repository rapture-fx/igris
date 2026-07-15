from __future__ import annotations

import base64
import json
from pathlib import Path

import pytest

from conformance.schema1.python.generate import HISTORICAL_DIR, generate
from conformance.schema1.python.runner import ConformanceFailure, load_manifest, run


@pytest.fixture(scope="module")
def generated_suite(tmp_path_factory: pytest.TempPathFactory) -> Path:
    suite = tmp_path_factory.mktemp("igris-schema1-suite")
    generate(suite)
    return suite


def test_full_python_candidate_runner_passes(generated_suite: Path) -> None:
    report = run(generated_suite)
    assert report["status"] == "pass"
    assert report["selected"] == 120
    assert report["passed"] == 120
    assert report["failures"] == []
    assert report["families"] == {
        "canonical": 47,
        "chain": 18,
        "contract": 21,
        "evidence": 22,
        "trust": 12,
    }


def test_runner_supports_vector_and_family_selection(generated_suite: Path) -> None:
    one = run(generated_suite, vector_id="can1-valid-u2028-raw-001")
    assert one["selected"] == one["passed"] == 1
    trust = run(generated_suite, family="trust")
    assert trust["selected"] == trust["passed"] == 12


def test_manifest_hash_mismatch_fails_closed(
    generated_suite: Path,
    tmp_path: Path,
) -> None:
    suite = tmp_path / "suite"
    _copy_tree(generated_suite, suite)
    target = suite / "canonical/legacy-json-1/can1-valid-zero-001.input.json"
    target.write_bytes(b"1")
    with pytest.raises(ConformanceFailure, match="hash mismatch"):
        load_manifest(suite)


def test_manifest_traversal_is_rejected(
    generated_suite: Path,
    tmp_path: Path,
) -> None:
    suite = tmp_path / "suite"
    _copy_tree(generated_suite, suite)
    manifest_path = suite / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["files"][0]["path"] = "../escape"
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(ConformanceFailure, match="unsafe manifest path"):
        load_manifest(suite)


def test_historical_fixture_imports_are_byte_identical(generated_suite: Path) -> None:
    assert (
        generated_suite
        / "contracts/action-contract-1/ac1-valid-alpha2-basic-001.input.json"
    ).read_bytes() == (HISTORICAL_DIR / "action_contract.json").read_bytes()
    assert (
        generated_suite
        / "contracts/action-contract-1/ac1-valid-alpha2-specialchars-001.input.json"
    ).read_bytes() == (
        HISTORICAL_DIR / "action_contract_specialchars.json"
    ).read_bytes()
    assert (
        generated_suite / "chains/evidence-1/ev1-valid-alpha2-journal-001.input.jsonl"
    ).read_bytes() == (HISTORICAL_DIR / "journal.jsonl").read_bytes()
    assert (generated_suite / "keys/alpha2-historical.public.pem").read_bytes() == (
        HISTORICAL_DIR / "verify_key.pem"
    ).read_bytes()


def test_unicode_and_numeric_bytes_are_exact(generated_suite: Path) -> None:
    canonical_dir = generated_suite / "canonical/legacy-json-1"
    u2028 = base64.b64decode(
        (canonical_dir / "can1-valid-u2028-raw-001.canonical.b64").read_text().strip(),
        validate=True,
    )
    u2029 = base64.b64decode(
        (canonical_dir / "can1-valid-u2029-raw-001.canonical.b64").read_text().strip(),
        validate=True,
    )
    assert bytes.fromhex("e280a8") in u2028 and b"\\u2028" not in u2028
    assert bytes.fromhex("e280a9") in u2029 and b"\\u2029" not in u2029

    one_upper = base64.b64decode(
        (canonical_dir / "can1-valid-number-1Eplus2-001.canonical.b64")
        .read_text()
        .strip(),
        validate=True,
    )
    one_lower = base64.b64decode(
        (canonical_dir / "can1-valid-number-1e2-001.canonical.b64").read_text().strip(),
        validate=True,
    )
    hundred = base64.b64decode(
        (canonical_dir / "can1-valid-number-100-001.canonical.b64").read_text().strip(),
        validate=True,
    )
    assert len({one_upper, one_lower, hundred}) == 3


def test_generation_is_byte_deterministic(
    generated_suite: Path,
    tmp_path: Path,
) -> None:
    second = tmp_path / "second"
    generate(second)
    first_files = _inventory(generated_suite)
    second_files = _inventory(second)
    assert first_files == second_files


def _inventory(root: Path) -> dict[str, bytes]:
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def _copy_tree(source: Path, target: Path) -> None:
    for path in source.rglob("*"):
        relative = path.relative_to(source)
        destination = target / relative
        if path.is_dir():
            destination.mkdir(parents=True, exist_ok=True)
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(path.read_bytes())
