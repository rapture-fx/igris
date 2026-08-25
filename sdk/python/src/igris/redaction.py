"""Input redaction for Igris evidence and approval prompts.

Redaction happens BEFORE canonicalization, hashing, journaling, approval
prompts, and error summaries — every representation the SDK persists or
displays is derived from the same redacted structure.

Matching is by *name*, case-insensitively, against a built-in set of
sensitive parameter names plus any names the caller declares via
``@igris.guard(redact=[...])``. Redacted values are replaced with the literal
marker ``<REDACTED>`` so no length, prefix, or hash of the raw secret leaks
into evidence (low-entropy secrets must not be recoverable from persisted
hashes).

Nested mappings are also scanned: a dict key whose lowercase form is in the
sensitive set is redacted wherever it appears in the argument structure.

Redaction must cover every container type that :mod:`igris.canonical`
expands into named fields, not only mappings. Canonicalization runs *after*
redaction and expands dataclasses and named tuples by field name, so any such
type the redactor does not traverse is a route for a named secret into signed
evidence: the redactor passes it through untouched, and canonicalization then
turns ``Credentials(api_key="sk-live-...")`` into
``{"api_key": "sk-live-..."}`` for the input hash, the journal, and the
approval prompt. Named tuples need care in particular, because a named tuple
is also a ``tuple``: matching the sequence branch first flattens it
positionally and destroys the field names before anything can match them.
"""

from __future__ import annotations

import dataclasses
from collections.abc import Iterable
from typing import Any

REDACTED = "<REDACTED>"

#: Built-in sensitive parameter names (lowercase). Matching is case-insensitive.
SENSITIVE_NAMES: frozenset[str] = frozenset(
    {
        "api_key",
        "apikey",
        "password",
        "passwd",
        "secret",
        "token",
        "access_token",
        "refresh_token",
        "private_key",
        "credential",
        "authorization",
        "auth_header",
        "client_secret",
    }
)

_MAX_SUMMARY_VALUE_CHARS = 120
_MAX_SUMMARY_TOTAL_CHARS = 2000


def build_sensitive_set(extra_names: Iterable[str] | None = None) -> frozenset[str]:
    """The built-in sensitive set plus caller-declared names, lowercased."""
    if not extra_names:
        return SENSITIVE_NAMES
    return SENSITIVE_NAMES | {str(name).lower() for name in extra_names}


def is_sensitive_name(name: str, sensitive: frozenset[str]) -> bool:
    return name.lower() in sensitive


def named_fields(value: Any) -> tuple[str, ...] | None:
    """Field names of a value canonicalization expands by name, else None.

    Covers dataclass instances and named tuples — the two types
    :func:`igris.canonical.to_canonical` turns into JSON objects keyed by
    field name. There is no ``isinstance`` test for a named tuple; the
    structural check against ``_fields`` is the documented approach.
    """
    if isinstance(value, tuple) and hasattr(value, "_fields"):
        fields = getattr(value, "_fields", ())
        if all(isinstance(name, str) for name in fields):
            return tuple(fields)
        return None
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return tuple(field.name for field in dataclasses.fields(value))
    return None


def redact_value(value: Any, sensitive: frozenset[str]) -> Any:
    """Recursively redact sensitive keys inside *value*.

    Only container structure is traversed; leaf values are returned as-is
    (canonicalization decides how leaves are represented).

    A dataclass or named tuple is converted to a mapping keyed by field name
    so its named fields are matched against the sensitive set. Canonicalization
    would produce the same mapping shape from the original object, so this does
    not change the canonical form of values that contain no sensitive names —
    with one exception: a named tuple previously canonicalized to a JSON array
    and now canonicalizes to a JSON object, which is both a fidelity
    improvement and a change to ``input_hash`` for actions that take one.
    """
    names = named_fields(value)
    if names is not None:
        return {
            name: (
                REDACTED
                if is_sensitive_name(name, sensitive)
                else redact_value(getattr(value, name), sensitive)
            )
            for name in names
        }
    if isinstance(value, dict):
        return {
            key: (
                REDACTED
                if isinstance(key, str) and is_sensitive_name(key, sensitive)
                else redact_value(item, sensitive)
            )
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [redact_value(item, sensitive) for item in value]
    return value


def redact_arguments(
    arguments: dict[str, Any],
    sensitive: frozenset[str],
) -> dict[str, Any]:
    """Redact a bound-arguments mapping (parameter name -> value)."""
    return {
        name: (REDACTED if is_sensitive_name(name, sensitive) else redact_value(value, sensitive))
        for name, value in arguments.items()
    }


def collect_sensitive_raw_values(
    arguments: dict[str, Any],
    sensitive: frozenset[str],
) -> list[str]:
    """String forms of sensitive argument values, used to scrub error text.

    Only string values of non-trivial length are collected; the raw values
    never leave the process and are never persisted.
    """
    found: list[str] = []

    def walk(name: str | None, value: Any) -> None:
        if name is not None and is_sensitive_name(name, sensitive):
            if isinstance(value, str) and len(value) >= 4:
                found.append(value)
            return
        # Must mirror redact_value's traversal exactly. A type redacted there
        # but not walked here would be removed from the journal yet left
        # unscrubbed in a sanitized error summary, which echoes its inputs.
        names = named_fields(value)
        if names is not None:
            for field_name in names:
                walk(field_name, getattr(value, field_name))
        elif isinstance(value, dict):
            for key, item in value.items():
                walk(key if isinstance(key, str) else None, item)
        elif isinstance(value, (list, tuple)):
            for item in value:
                walk(None, item)

    for name, value in arguments.items():
        walk(name, value)
    return found


def bounded_summary(redacted_canonical: Any) -> str:
    """A short, human-readable, single-line summary of redacted canonical input.

    Used in approval prompts and stored in decision events. Values are
    truncated so the summary is bounded regardless of input size. The summary
    is derived exclusively from the redacted canonical structure, so it can
    never contain more than the journal itself does.
    """
    import json

    if not isinstance(redacted_canonical, dict):
        text = json.dumps(redacted_canonical, ensure_ascii=False, sort_keys=True)
        return _truncate(text, _MAX_SUMMARY_TOTAL_CHARS)

    parts: list[str] = []
    for name in sorted(redacted_canonical):
        value_text = json.dumps(redacted_canonical[name], ensure_ascii=False, sort_keys=True)
        parts.append(f"{name}={_truncate(value_text, _MAX_SUMMARY_VALUE_CHARS)}")
    return _truncate(", ".join(parts), _MAX_SUMMARY_TOTAL_CHARS)


def scrub_text(text: str, raw_sensitive_values: list[str], *, max_chars: int = 300) -> str:
    """Replace raw sensitive values in *text* and bound its length.

    Used for sanitized exception summaries: exception messages frequently echo
    inputs (e.g. an HTTP client quoting an Authorization header), so any known
    sensitive value is replaced before the message is persisted.
    """
    for raw in raw_sensitive_values:
        if raw:
            text = text.replace(raw, REDACTED)
    return _truncate(text, max_chars)


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "...(truncated)"
