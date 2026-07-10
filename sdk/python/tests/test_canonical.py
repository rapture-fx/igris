"""Canonicalization determinism, the type-marker policy, and hard failures."""

from __future__ import annotations

import dataclasses

import pytest

from igris.canonical import canonical_hash, canonical_json_bytes, to_canonical
from igris.errors import CanonicalizationError


@dataclasses.dataclass
class Payment:
    amount: int
    currency: str


class Opaque:
    def __repr__(self):  # must never be persisted
        return "Opaque(secret_token='LEAKED-VALUE')"


class TestSupportedValues:
    def test_primitives_pass_through(self):
        for value in (None, True, False, 0, -7, 3.5, "text", "ünïcode ✓"):
            assert to_canonical(value) == value

    def test_tuple_becomes_list(self):
        assert to_canonical((1, 2, (3,))) == [1, 2, [3]]

    def test_dict_with_string_keys(self):
        assert to_canonical({"b": 1, "a": {"nested": (1,)}}) == {"b": 1, "a": {"nested": [1]}}

    def test_dataclass_converted_field_by_field(self):
        assert to_canonical(Payment(5, "usd")) == {"amount": 5, "currency": "usd"}


class TestUnsupportedValuePolicy:
    def test_unsupported_object_becomes_type_marker_without_value_data(self):
        marker = to_canonical(Opaque())
        assert marker.startswith("<igris:unsupported:")
        assert "Opaque" in marker
        assert "LEAKED-VALUE" not in marker
        assert "secret_token" not in marker

    def test_non_string_key_dict_becomes_marker_without_data(self):
        marker = to_canonical({("secret", "tuple-key"): "secret-value"})
        assert marker == "<igris:unsupported:mapping-with-non-string-keys>"
        assert "secret" not in marker

    def test_marker_is_deterministic(self):
        assert to_canonical(Opaque()) == to_canonical(Opaque())


class TestHardFailures:
    @pytest.mark.parametrize("bad", [float("nan"), float("inf"), float("-inf")])
    def test_nan_and_infinity_rejected(self, bad):
        with pytest.raises(CanonicalizationError):
            to_canonical(bad)
        with pytest.raises(CanonicalizationError):
            to_canonical({"nested": [bad]})

    def test_cycle_rejected(self):
        loop: list = []
        loop.append(loop)
        with pytest.raises(CanonicalizationError, match="cyclic"):
            to_canonical(loop)

    def test_excessive_depth_rejected(self):
        deep: dict = {}
        node = deep
        for _ in range(200):
            node["n"] = {}
            node = node["n"]
        with pytest.raises(CanonicalizationError, match="depth"):
            to_canonical(deep)


class TestDeterminism:
    def test_key_order_irrelevant(self):
        assert canonical_hash({"a": 1, "b": 2}) == canonical_hash({"b": 2, "a": 1})

    def test_compact_sorted_utf8(self):
        data = to_canonical({"b": "ü", "a": 1})
        assert canonical_json_bytes(data) == '{"a":1,"b":"ü"}'.encode()

    def test_shared_containers_are_not_cycles(self):
        shared = [1, 2]
        assert to_canonical({"x": shared, "y": shared}) == {"x": [1, 2], "y": [1, 2]}
