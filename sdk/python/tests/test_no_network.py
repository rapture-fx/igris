"""Embedded Igris must never touch the network.

The autouse ``_no_network`` fixture in conftest.py replaces socket creation
with a hard failure, so any socket use anywhere in the SDK during these flows
would fail the test. This file exercises the complete guarded-action and
verification flows explicitly under that guard.
"""

from __future__ import annotations

import socket

import pytest
from conftest import NetworkAttemptError, StaticProvider

import igris
from igris.identity import LocalSigningIdentity, load_public_key
from igris.verification import verify_journal


def test_socket_guard_is_active():
    with pytest.raises(NetworkAttemptError):
        socket.socket(socket.AF_INET, socket.SOCK_STREAM)


def test_full_guard_and_verify_flow_makes_no_network_calls(igris_home):
    provider = StaticProvider("allowed")

    @igris.guard(action="tests.offline", risk="high", approval_provider=provider)
    def act(amount: int, api_key: str):
        return {"ok": amount}

    # Success path, denial path, and failure path — all offline.
    assert act(5, api_key="secret-key-123") == {"ok": 5}

    denier = StaticProvider("denied")

    @igris.guard(action="tests.offline.denied", approval_provider=denier)
    def denied_action():
        raise AssertionError("must not run")

    with pytest.raises(igris.ActionDenied):
        denied_action()

    @igris.guard(action="tests.offline.failing", approval_provider=StaticProvider("allowed"))
    def failing_action():
        raise ValueError("boom")

    with pytest.raises(ValueError):
        failing_action()

    # Offline verification of everything just recorded.
    identity = LocalSigningIdentity.load_or_create()
    public = load_public_key(identity.public_key_path)
    result = verify_journal(igris_home / "journal.jsonl", public)
    assert result.valid
    assert result.events_verified == 5  # 2 + 1 + 2 events


def test_import_makes_no_network_calls():
    import importlib

    import igris as igris_module

    importlib.reload(igris_module)
