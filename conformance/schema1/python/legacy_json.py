"""Schema-1 legacy JSON parsing and canonical reconstruction.

This module exists only in the conformance tooling. It preserves accepted JSON
number tokens exactly and emits the historical Python string representation,
including raw UTF-8 U+2028 and U+2029.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from typing import Any

MAX_INPUT_BYTES = 1_048_576
MAX_DEPTH = 64


class LegacyJSONError(ValueError):
    """Base class for bounded legacy JSON failures."""


class DuplicateMember(LegacyJSONError):
    """A decoded object member name occurred more than once."""


class TrailingContent(LegacyJSONError):
    """Non-whitespace content followed the top-level JSON value."""


class InvalidUnicodeScalar(LegacyJSONError):
    """A decoded string contained a lone surrogate code point."""


class ResourceLimit(LegacyJSONError):
    """A declared bounded-work limit was exceeded."""


@dataclass(frozen=True)
class RawNumber:
    """One accepted JSON numeric token retained byte-for-byte."""

    lexeme: str


def _raw_number(text: str) -> RawNumber:
    return RawNumber(text)


def _reject_constant(text: str) -> None:
    raise LegacyJSONError(f"non-JSON numeric constant: {text}")


def _pairs(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in pairs:
        if key in out:
            raise DuplicateMember(f"duplicate decoded member: {key}")
        out[key] = value
    return out


def parse_legacy_json(data: bytes) -> Any:
    """Parse one bounded JSON value while retaining every number lexeme."""
    if len(data) > MAX_INPUT_BYTES:
        raise ResourceLimit(f"input exceeds {MAX_INPUT_BYTES} bytes")
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise LegacyJSONError("input is not UTF-8") from exc

    decoder = json.JSONDecoder(
        object_pairs_hook=_pairs,
        parse_int=_raw_number,
        parse_float=_raw_number,
        parse_constant=_reject_constant,
        strict=True,
    )
    try:
        value, end = decoder.raw_decode(text.lstrip())
    except (json.JSONDecodeError, LegacyJSONError) as exc:
        if isinstance(exc, LegacyJSONError):
            raise
        raise LegacyJSONError("input is not valid JSON") from exc
    if text.lstrip()[end:].strip():
        raise TrailingContent("non-whitespace content follows the JSON value")
    _validate_value(value, depth=0)
    return value


def _validate_value(value: Any, *, depth: int) -> None:
    if depth > MAX_DEPTH:
        raise ResourceLimit(f"nesting exceeds {MAX_DEPTH}")
    if isinstance(value, str):
        if any(0xD800 <= ord(char) <= 0xDFFF for char in value):
            raise InvalidUnicodeScalar("lone surrogate is not a Unicode scalar")
        return
    if isinstance(value, RawNumber) or value is None or isinstance(value, bool):
        return
    if isinstance(value, list):
        for item in value:
            _validate_value(item, depth=depth + 1)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            _validate_value(key, depth=depth + 1)
            _validate_value(item, depth=depth + 1)
        return
    if isinstance(value, int):
        return
    if isinstance(value, float):
        if not math.isfinite(value):
            raise LegacyJSONError("non-finite floats are not permitted")
        return
    raise LegacyJSONError(f"unsupported JSON value type: {type(value).__name__}")


def encode_legacy_json(value: Any) -> bytes:
    """Encode a parsed value using the immutable schema-1 byte profile."""
    _validate_value(value, depth=0)
    return _encode(value, depth=0).encode("utf-8")


def canonicalize_legacy_json(data: bytes) -> bytes:
    """Parse and reconstruct exact schema-1 canonical bytes."""
    return encode_legacy_json(parse_legacy_json(data))


def _encode(value: Any, *, depth: int) -> str:
    if depth > MAX_DEPTH:
        raise ResourceLimit(f"nesting exceeds {MAX_DEPTH}")
    if isinstance(value, RawNumber):
        return value.lexeme
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            raise LegacyJSONError("non-finite floats are not permitted")
        return json.dumps(
            value, ensure_ascii=False, allow_nan=False, separators=(",", ":")
        )
    if isinstance(value, list):
        return "[" + ",".join(_encode(item, depth=depth + 1) for item in value) + "]"
    if isinstance(value, dict):
        members = (
            json.dumps(key, ensure_ascii=False, separators=(",", ":"))
            + ":"
            + _encode(value[key], depth=depth + 1)
            for key in sorted(value)
        )
        return "{" + ",".join(members) + "}"
    raise LegacyJSONError(f"unsupported JSON value type: {type(value).__name__}")
