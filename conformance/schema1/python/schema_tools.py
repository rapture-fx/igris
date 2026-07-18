"""Validation helpers for the portable verification-result contract."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SCHEMA_PATH = REPOSITORY_ROOT / "spec/schemas/verification-result-1.schema.json"


def load_schema(path: Path = DEFAULT_SCHEMA_PATH) -> dict[str, Any]:
    """Load and self-check the verification-result JSON Schema."""
    schema = json.loads(path.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return schema


def validator(path: Path = DEFAULT_SCHEMA_PATH) -> Draft202012Validator:
    """Build a strict Draft 2020-12 validator with format checking enabled."""
    return Draft202012Validator(load_schema(path), format_checker=FormatChecker())


def validate_result(result: dict[str, Any], path: Path = DEFAULT_SCHEMA_PATH) -> None:
    """Raise jsonschema.ValidationError when a portable result is invalid."""
    validator(path).validate(result)


def issue_codes(path: Path = DEFAULT_SCHEMA_PATH) -> tuple[str, ...]:
    """Return the closed portable issue-code registry in schema order."""
    schema = load_schema(path)
    return tuple(schema["$defs"]["issue"]["properties"]["code"]["enum"])
