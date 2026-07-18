from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import pytest

from conformance.schema1.python.check_manifest_git_completeness import (
    ManifestGitCompletenessError,
    check_manifest_git_completeness,
)


def _write_candidate(
    tmp_path: Path,
    *,
    manifest_path: str = "fixture.json",
    contents: bytes = b"frozen bytes\n",
    tracked_fixture: bool = True,
    expected_hash: str | None = None,
) -> tuple[Path, Path]:
    repository = tmp_path / "repository"
    suite = repository / "suite"
    suite.mkdir(parents=True)
    fixture = suite / "fixture.json"
    fixture.write_bytes(contents)
    manifest = {
        "files": [
            {
                "path": manifest_path,
                "sha256": expected_hash or hashlib.sha256(contents).hexdigest(),
            }
        ]
    }
    (suite / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    subprocess.run(["git", "init", "-q", repository], check=True)
    subprocess.run(["git", "-C", repository, "add", "suite/manifest.json"], check=True)
    if tracked_fixture:
        subprocess.run(
            ["git", "-C", repository, "add", "suite/fixture.json"], check=True
        )
    return repository, suite


def test_all_manifest_files_must_be_tracked_and_match(tmp_path: Path) -> None:
    repository, suite = _write_candidate(tmp_path)
    assert check_manifest_git_completeness(suite, repository) == 1


def test_untracked_manifest_file_fails(tmp_path: Path) -> None:
    repository, suite = _write_candidate(tmp_path, tracked_fixture=False)
    with pytest.raises(ManifestGitCompletenessError, match="not tracked by Git"):
        check_manifest_git_completeness(suite, repository)


def test_missing_manifest_file_fails(tmp_path: Path) -> None:
    repository, suite = _write_candidate(tmp_path)
    (suite / "fixture.json").unlink()
    with pytest.raises(ManifestGitCompletenessError, match="file is missing"):
        check_manifest_git_completeness(suite, repository)


def test_manifest_hash_mismatch_fails(tmp_path: Path) -> None:
    repository, suite = _write_candidate(tmp_path, expected_hash="0" * 64)
    with pytest.raises(ManifestGitCompletenessError, match="hash mismatch"):
        check_manifest_git_completeness(suite, repository)


def test_manifest_path_traversal_fails(tmp_path: Path) -> None:
    repository, suite = _write_candidate(tmp_path, manifest_path="../escape")
    with pytest.raises(ManifestGitCompletenessError, match="unsafe manifest path"):
        check_manifest_git_completeness(suite, repository)
