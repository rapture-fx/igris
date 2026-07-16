"""Schema-1 exact reconstruction and hostile-parser regressions."""

from __future__ import annotations

import pytest

from igris.legacy_schema1 import (
    LegacySchema1JSONError,
    RawNumber,
    UnsupportedLegacyRepresentation,
    encode_legacy_json,
    parse_legacy_json,
)


@pytest.mark.parametrize(
    "lexeme", ["1E+2", "1e2", "100", "-0", "0", "0.0", "123456789012345678901234567890"]
)
def test_numeric_token_lexeme_is_preserved(lexeme):
    raw = f'{{"number":{lexeme}}}'.encode()
    assert encode_legacy_json(parse_legacy_json(raw)) == raw


def test_historical_unicode_and_escape_bytes():
    raw = (
        '{"z":"quote\\" slash/ backslash\\\\ controls\\b\\f\\n\\r\\t '
        'less< greater> amp& café separators \u2028\u2029 supplementary 😀","a":1}'
    ).encode()
    canonical = encode_legacy_json(parse_legacy_json(raw))
    assert (
        canonical
        == (
            '{"a":1,"z":"quote\\" slash/ backslash\\\\ controls\\b\\f\\n\\r\\t '
            'less< greater> amp& café separators \u2028\u2029 supplementary 😀"}'
        ).encode()
    )
    assert b"\\u2028" not in canonical
    assert b"\\u2029" not in canonical
    assert b"\xe2\x80\xa8" in canonical
    assert b"\xe2\x80\xa9" in canonical


@pytest.mark.parametrize(
    "raw",
    [
        b'{"a":1,"a":2}',
        b'{"a":1,"\\u0061":2}',
        b'{"n":+1}',
        b'{"n":01}',
        b'{"n":1e}',
        b'{"s":"\\ud800"}',
        b'{"s":"\\udc00"}',
        b"{} []",
        b'{"s":"\xff"}',
    ],
)
def test_unsafe_or_malformed_json_is_rejected(raw):
    with pytest.raises(LegacySchema1JSONError):
        parse_legacy_json(raw)


@pytest.mark.parametrize("number", [100, 100.0])
def test_lost_numeric_lexeme_fails_closed(number):
    with pytest.raises(UnsupportedLegacyRepresentation):
        encode_legacy_json({"number": number})


def test_raw_number_wrapper_is_internal_exact_representation():
    assert encode_legacy_json({"number": RawNumber("1E+2")}) == b'{"number":1E+2}'


@pytest.mark.parametrize("lexeme", ["+1", "01", "1e", "1."])
def test_invalid_internal_number_wrapper_is_rejected(lexeme):
    with pytest.raises(LegacySchema1JSONError):
        encode_legacy_json({"number": RawNumber(lexeme)})
