"""Verify that Python dependency resolution has a fixed UTC time boundary."""

from __future__ import annotations

import argparse
import re
import sys
import tomllib
from datetime import datetime
from pathlib import Path
from typing import Any

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PROJECT = REPOSITORY_ROOT / "sdk/python"
UTC_RFC3339_RE = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z")


class PythonLockReproducibilityError(RuntimeError):
    """Raised when the committed resolver boundary is absent or inconsistent."""


def _load_toml(path: Path) -> dict[str, Any]:
    try:
        return tomllib.loads(path.read_text(encoding="utf-8"))
    except (OSError, tomllib.TOMLDecodeError) as exc:
        raise PythonLockReproducibilityError(f"unable to load {path.name}") from exc


def check_python_lock_reproducibility(project: Path = DEFAULT_PROJECT) -> str:
    """Return the fixed cutoff or fail if project and lock state disagree."""

    project = project.resolve()
    pyproject = _load_toml(project / "pyproject.toml")
    lock = _load_toml(project / "uv.lock")

    cutoff = pyproject.get("tool", {}).get("uv", {}).get("exclude-newer")
    if not isinstance(cutoff, str) or not UTC_RFC3339_RE.fullmatch(cutoff):
        raise PythonLockReproducibilityError(
            "tool.uv.exclude-newer must be a fixed RFC3339 UTC timestamp"
        )
    try:
        datetime.strptime(cutoff, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError as exc:
        raise PythonLockReproducibilityError(
            "tool.uv.exclude-newer is not a valid timestamp"
        ) from exc

    locked_cutoff = lock.get("options", {}).get("exclude-newer")
    if locked_cutoff != cutoff:
        raise PythonLockReproducibilityError(
            "uv.lock does not record the committed resolver cutoff"
        )
    return cutoff


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, default=DEFAULT_PROJECT)
    args = parser.parse_args()
    try:
        cutoff = check_python_lock_reproducibility(args.project)
    except PythonLockReproducibilityError as exc:
        print(f"Python lock reproducibility: FAIL: {exc}", file=sys.stderr)
        return 1
    print(f"Python lock reproducibility: PASS (exclude-newer={cutoff})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
