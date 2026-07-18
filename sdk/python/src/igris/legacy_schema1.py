"""Exact historical JSON reconstruction for externally supplied schema 1.

This module is a verification compatibility boundary, not the producer
serializer. It retains accepted JSON number tokens byte-for-byte and rejects
already-coerced numeric values whose original signed representation is lost.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

MAX_INPUT_BYTES = 1_048_576
MAX_DEPTH = 64
_JSON_NUMBER = re.compile(r"-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?\Z")


class LegacySchema1JSONError(ValueError):
    """Base class for bounded schema-1 JSON failures."""


class UnsupportedLegacyRepresentation(LegacySchema1JSONError):
    """The original signed representation can no longer be reconstructed."""


class DuplicateMember(LegacySchema1JSONError):
    """A decoded object member name occurred more than once."""


class TrailingContent(LegacySchema1JSONError):
    """Non-whitespace content followed the top-level JSON value."""


class InvalidUnicodeScalar(LegacySchema1JSONError):
    """A decoded string contained a lone surrogate code point."""


class ResourceLimit(LegacySchema1JSONError):
    """A bounded parsing or reconstruction limit was exceeded."""


@dataclass(frozen=True)
class RawNumber:
    """One valid JSON numeric token retained exactly as received."""

    lexeme: str


def _raw_number(text: str) -> RawNumber:
    return RawNumber(text)


def _reject_constant(text: str) -> None:
    raise LegacySchema1JSONError(f"non-JSON numeric constant: {text}")


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateMember(f"duplicate decoded object member: {key}")
        result[key] = value
    return result


def parse_legacy_json(data: bytes) -> Any:
    """Parse one bounded JSON value while retaining every number lexeme."""
    if len(data) > MAX_INPUT_BYTES:
        raise ResourceLimit(f"input exceeds {MAX_INPUT_BYTES} bytes")
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise LegacySchema1JSONError("input is not valid UTF-8") from exc

    stripped = text.lstrip()
    decoder = json.JSONDecoder(
        object_pairs_hook=_unique_object,
        parse_int=_raw_number,
        parse_float=_raw_number,
        parse_constant=_reject_constant,
        strict=True,
    )
    try:
        value, end = decoder.raw_decode(stripped)
    except (json.JSONDecodeError, LegacySchema1JSONError) as exc:
        if isinstance(exc, LegacySchema1JSONError):
            raise
        raise LegacySchema1JSONError("input is not valid JSON") from exc
    if stripped[end:].strip():
        raise TrailingContent("non-whitespace content follows the JSON value")
    _validate_value(value, depth=0)
    return value


def parse_legacy_object(data: bytes) -> dict[str, Any]:
    """Parse one schema-1 object from untrusted raw JSON."""
    value = parse_legacy_json(data)
    if not isinstance(value, dict):
        raise LegacySchema1JSONError("schema-1 value is not an object")
    return value


def encode_legacy_json(value: Any) -> bytes:
    """Reconstruct exact schema-1 bytes or fail closed if lexemes were lost."""
    _validate_value(value, depth=0)
    return _encode(value, depth=0).encode("utf-8")


def canonicalize_legacy_json(data: bytes) -> bytes:
    """Parse and reconstruct exact historical schema-1 bytes."""
    return encode_legacy_json(parse_legacy_json(data))


def _validate_value(value: Any, *, depth: int) -> None:
    if depth > MAX_DEPTH:
        raise ResourceLimit(f"nesting exceeds {MAX_DEPTH}")
    if isinstance(value, str):
        if any(0xD800 <= ord(character) <= 0xDFFF for character in value):
            raise InvalidUnicodeScalar("lone surrogate is not a Unicode scalar")
        return
    if isinstance(value, RawNumber):
        if _JSON_NUMBER.fullmatch(value.lexeme) is None:
            raise LegacySchema1JSONError(f"invalid preserved JSON number: {value.lexeme}")
        return
    if value is None or isinstance(value, bool):
        return
    if isinstance(value, list):
        for item in value:
            _validate_value(item, depth=depth + 1)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise LegacySchema1JSONError("object member name is not a string")
            _validate_value(key, depth=depth + 1)
            _validate_value(item, depth=depth + 1)
        return
    if isinstance(value, (int, float)):
        raise UnsupportedLegacyRepresentation(
            f"numeric token lexeme was lost to {type(value).__name__}"
        )
    raise LegacySchema1JSONError(f"unsupported JSON value type: {type(value).__name__}")


def _encode(value: Any, *, depth: int) -> str:
    if depth > MAX_DEPTH:
        raise ResourceLimit(f"nesting exceeds {MAX_DEPTH}")
    if isinstance(value, RawNumber):
        if _JSON_NUMBER.fullmatch(value.lexeme) is None:
            raise LegacySchema1JSONError(f"invalid preserved JSON number: {value.lexeme}")
        return value.lexeme
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
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
    if isinstance(value, (int, float)):
        raise UnsupportedLegacyRepresentation(
            f"numeric token lexeme was lost to {type(value).__name__}"
        )
    raise LegacySchema1JSONError(f"unsupported JSON value type: {type(value).__name__}")
