"""Fail if the deterministic conformance seed leaks outside approved tooling."""

from __future__ import annotations

import argparse
import base64
import hashlib
import sys
from pathlib import Path

from conformance.schema1.python.schema_tools import REPOSITORY_ROOT

SEED_FILENAME = "deterministic-001.private.seed.TEST-ONLY.b64"
SEED_VALUE = base64.b64encode(
    hashlib.sha256(b"igris-schema-1-conformance-deterministic-key-001").digest()
)
APPROVED_PREFIXES = (
    "conformance/schema1/",
    "spec/test-vectors/suite-schema-1/",
)
APPROVED_FILES = {
    ".gitignore",
    "spec/test-vectors/README.md",
    "spec/test-vectors/schema-1-release-plan.md",
}
SKIP_PARTS = {".git", ".venv", "__pycache__", "node_modules"}


def unexpected_references(root: Path = REPOSITORY_ROOT) -> list[str]:
    failures: list[str] = []
    for path in root.rglob("*"):
        if not path.is_file() or SKIP_PARTS.intersection(path.parts):
            continue
        relative = path.relative_to(root).as_posix()
        if relative in APPROVED_FILES or relative.startswith(APPROVED_PREFIXES):
            continue
        try:
            data = path.read_bytes()
        except OSError:
            continue
        if SEED_FILENAME.encode() in data or SEED_VALUE in data:
            failures.append(relative)
    return sorted(failures)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.parse_args()
    failures = unexpected_references()
    if failures:
        print("deterministic conformance seed referenced outside approved tooling:")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("deterministic conformance seed references: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
