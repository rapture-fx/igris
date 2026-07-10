"""Canonical, deterministic serialization for Igris evidence.

The canonical JSON format follows the convention already used by the Igris
runtime's execution receipts (``igris-runtime`` ``receipt.rs``):

* UTF-8 encoding
* keys sorted lexicographically
* compact separators (``,`` and ``:``)
* no NaN / infinity
* ``ensure_ascii=False`` (non-ASCII text is emitted as UTF-8, matching the
  Rust/Go serializers, which do not escape non-ASCII)

Hashes are SHA-256 over the canonical bytes, hex-encoded.

Value policy
------------
Supported values are converted deterministically:

``None``, ``bool``, ``int``, finite ``float``, ``str``, ``list``, ``tuple``
(as JSON array), ``dict`` with string keys, and dataclass *instances*
(converted field-by-field).

Any other value is replaced by a deterministic **type marker** string of the
form ``<igris:unsupported:module.QualifiedTypeName>`` that carries no value
data. This is a deliberate, documented policy choice: guarded functions
frequently receive rich objects (clients, ORM rows, ``self``); failing the
call for those would make the guard unusable, and calling ``repr()`` would
leak data. The marker keeps evidence deterministic and leak-free at the cost
of not committing to the unsupported value's content.

Two conditions are still hard failures (:class:`~igris.errors.CanonicalizationError`),
because accepting them would make evidence non-deterministic or ambiguous:

* NaN or infinite floats (anywhere in the structure)
* cyclic containers or nesting beyond :data:`MAX_DEPTH`
"""

from __future__ import annotations

import dataclasses
import hashlib
import json
import math
from typing import Any

from .errors import CanonicalizationError

MAX_DEPTH = 64

_UNSUPPORTED_MARKER = "<igris:unsupported:{type_name}>"
_NON_STRING_KEY_MARKER = "<igris:unsupported:mapping-with-non-string-keys>"


def type_name(value: Any) -> str:
    """Deterministic dotted name for a value's type."""
    cls = type(value)
    module = getattr(cls, "__module__", "unknown") or "unknown"
    qualname = getattr(cls, "__qualname__", cls.__name__)
    return f"{module}.{qualname}"


def to_canonical(value: Any, *, _depth: int = 0, _seen: frozenset[int] = frozenset()) -> Any:
    """Convert *value* to a canonical JSON-safe structure.

    Raises:
        CanonicalizationError: for NaN/infinity, cycles, or excessive depth.
    """
    if _depth > MAX_DEPTH:
        raise CanonicalizationError(f"nesting exceeds maximum depth of {MAX_DEPTH}")

    if value is None or isinstance(value, (bool, int, str)):
        return value

    if isinstance(value, float):
        if not math.isfinite(value):
            raise CanonicalizationError(
                "NaN and infinite floats are not permitted in canonical evidence"
            )
        return value

    if isinstance(value, (list, tuple)):
        if id(value) in _seen:
            raise CanonicalizationError("cyclic container cannot be canonicalized")
        seen = _seen | {id(value)}
        return [to_canonical(item, _depth=_depth + 1, _seen=seen) for item in value]

    if isinstance(value, dict):
        if id(value) in _seen:
            raise CanonicalizationError("cyclic container cannot be canonicalized")
        if not all(isinstance(key, str) for key in value):
            return _NON_STRING_KEY_MARKER
        seen = _seen | {id(value)}
        return {
            key: to_canonical(item, _depth=_depth + 1, _seen=seen) for key, item in value.items()
        }

    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        if id(value) in _seen:
            raise CanonicalizationError("cyclic dataclass cannot be canonicalized")
        seen = _seen | {id(value)}
        return {
            field.name: to_canonical(getattr(value, field.name), _depth=_depth + 1, _seen=seen)
            for field in dataclasses.fields(value)
        }

    return _UNSUPPORTED_MARKER.format(type_name=type_name(value))


def canonical_json_bytes(value: Any) -> bytes:
    """Serialize an already-canonical structure to canonical JSON bytes."""
    try:
        text = json.dumps(
            value,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            allow_nan=False,
        )
    except (TypeError, ValueError) as exc:
        raise CanonicalizationError(f"canonical JSON serialization failed: {exc}") from exc
    return text.encode("utf-8")


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_hash(value: Any) -> str:
    """SHA-256 hex of the canonical JSON encoding of *value*."""
    return sha256_hex(canonical_json_bytes(to_canonical(value)))
