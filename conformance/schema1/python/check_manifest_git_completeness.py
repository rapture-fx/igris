"""Verify that every frozen candidate manifest file is committed and intact."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath
from typing import Any

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SUITE = REPOSITORY_ROOT / "spec/test-vectors/suite-schema-1"
SHA256_RE = re.compile(r"[0-9a-f]{64}")


class ManifestGitCompletenessError(RuntimeError):
    """Raised when committed candidate state cannot reproduce the manifest."""


def _safe_manifest_path(suite: Path, relative: str) -> Path:
    pure = PurePosixPath(relative)
    if not relative or pure.is_absolute() or ".." in pure.parts or "\\" in relative:
        raise ManifestGitCompletenessError(f"unsafe manifest path: {relative}")
    target = suite.joinpath(*pure.parts)
    try:
        target.resolve().relative_to(suite.resolve())
    except ValueError as exc:
        raise ManifestGitCompletenessError(
            f"manifest path escapes suite: {relative}"
        ) from exc
    return target


def _tracked_paths(repository_root: Path) -> set[str]:
    try:
        output = subprocess.check_output(
            ["git", "-C", str(repository_root), "ls-files", "-z"],
            stderr=subprocess.STDOUT,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        raise ManifestGitCompletenessError(
            "unable to enumerate Git-tracked files"
        ) from exc
    return {item.decode() for item in output.split(b"\0") if item}


def check_manifest_git_completeness(
    suite: Path = DEFAULT_SUITE,
    repository_root: Path = REPOSITORY_ROOT,
) -> int:
    """Return the verified entry count or fail on missing, untracked, or drifted files."""

    repository_root = repository_root.resolve()
    suite = suite.resolve()
    try:
        suite.relative_to(repository_root)
    except ValueError as exc:
        raise ManifestGitCompletenessError("suite is outside the repository") from exc

    manifest_path = suite / "manifest.json"
    try:
        manifest: dict[str, Any] = json.loads(manifest_path.read_bytes())
    except (OSError, json.JSONDecodeError) as exc:
        raise ManifestGitCompletenessError("unable to load candidate manifest") from exc

    entries = manifest.get("files")
    if not isinstance(entries, list):
        raise ManifestGitCompletenessError("manifest files must be an array")

    tracked = _tracked_paths(repository_root)
    manifest_repo_path = manifest_path.relative_to(repository_root).as_posix()
    if manifest_repo_path not in tracked:
        raise ManifestGitCompletenessError("candidate manifest is not tracked by Git")

    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise ManifestGitCompletenessError("manifest file entry must be an object")
        relative = entry.get("path")
        expected = entry.get("sha256")
        if not isinstance(relative, str) or not isinstance(expected, str):
            raise ManifestGitCompletenessError(
                "manifest file entry requires string path and sha256"
            )
        if relative in seen:
            raise ManifestGitCompletenessError(
                f"duplicate manifest file path: {relative}"
            )
        seen.add(relative)
        if not SHA256_RE.fullmatch(expected):
            raise ManifestGitCompletenessError(f"invalid manifest SHA-256: {relative}")

        target = _safe_manifest_path(suite, relative)
        if not target.is_file():
            raise ManifestGitCompletenessError(f"manifest file is missing: {relative}")

        repo_path = target.relative_to(repository_root).as_posix()
        if repo_path not in tracked:
            raise ManifestGitCompletenessError(
                f"manifest file is not tracked by Git: {relative}"
            )

        actual = hashlib.sha256(target.read_bytes()).hexdigest()
        if actual != expected:
            raise ManifestGitCompletenessError(f"manifest hash mismatch: {relative}")

    return len(entries)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--suite", type=Path, default=DEFAULT_SUITE)
    args = parser.parse_args()
    try:
        count = check_manifest_git_completeness(args.suite)
    except ManifestGitCompletenessError as exc:
        print(f"schema-1 manifest Git completeness: FAIL: {exc}", file=sys.stderr)
        return 1
    print(
        "schema-1 manifest Git completeness: "
        f"PASS ({count}/{count} tracked files match)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
