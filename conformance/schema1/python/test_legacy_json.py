from __future__ import annotations

import pytest

from conformance.schema1.python.legacy_json import (
    DuplicateMember,
    InvalidUnicodeScalar,
    LegacyJSONError,
    ResourceLimit,
    TrailingContent,
    canonicalize_legacy_json,
)


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        (b'{"x":1E+2}', b'{"x":1E+2}'),
        (b'{"x":1e2}', b'{"x":1e2}'),
        (b'{"x":100}', b'{"x":100}'),
        (b'{"x":-0}', b'{"x":-0}'),
        (b'{"x":0.0}', b'{"x":0.0}'),
        (
            '{"k":"\u2028\u2029"}'.encode(),
            b'{"k":"' + bytes.fromhex("e280a8e280a9") + b'"}',
        ),
        (b'{"b":1,"a":2}', b'{"a":2,"b":1}'),
    ],
)
def test_exact_legacy_reconstruction(source: bytes, expected: bytes) -> None:
    assert canonicalize_legacy_json(source) == expected


@pytest.mark.parametrize(
    ("source", "error"),
    [
        (b'{"a":1,"a":2}', DuplicateMember),
        (b'{"a":1} trailing', TrailingContent),
        (b'{"a":+1}', LegacyJSONError),
        (b'{"a":01}', LegacyJSONError),
        (b'{"a":1.}', LegacyJSONError),
        (b'{"a":1e}', LegacyJSONError),
        (b'{"a":NaN}', LegacyJSONError),
        (b'{"a":"\\ud800"}', InvalidUnicodeScalar),
        (b"\xff", LegacyJSONError),
    ],
)
def test_invalid_legacy_inputs_fail_closed(
    source: bytes, error: type[Exception]
) -> None:
    with pytest.raises(error):
        canonicalize_legacy_json(source)


def test_depth_limit_is_enforced() -> None:
    source = b"[" * 66 + b"0" + b"]" * 66
    with pytest.raises((LegacyJSONError, ResourceLimit)):
        canonicalize_legacy_json(source)
