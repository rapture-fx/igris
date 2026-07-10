"""Shared fixtures.

Every test runs against a temporary ``IGRIS_HOME`` — nothing touches the
developer's real ``~/.igris``, no existing key is relied on, and no network
access occurs (enforced by an autouse socket guard).
"""

from __future__ import annotations

import io
import json
import socket

import pytest

from igris.approval import ApprovalDecision


class NetworkAttemptError(AssertionError):
    pass


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    """Fail any test that attempts to create a socket."""

    def _blocked(*args, **kwargs):
        raise NetworkAttemptError("network access attempted during an Igris SDK test")

    monkeypatch.setattr(socket, "socket", _blocked)
    monkeypatch.setattr(socket, "create_connection", _blocked)
    monkeypatch.setattr(socket, "socketpair", _blocked, raising=False)


@pytest.fixture
def igris_home(tmp_path, monkeypatch):
    home = tmp_path / "igris-home"
    monkeypatch.setenv("IGRIS_HOME", str(home))
    return home


class StaticProvider:
    """Injectable approval provider returning a fixed decision."""

    def __init__(self, decision: str, reason: str = "test provider") -> None:
        self.decision_value = decision
        self.reason = reason
        self.requests = []

    def decide(self, request):
        self.requests.append(request)
        return ApprovalDecision(self.decision_value, self.reason)


class FailingProvider:
    def decide(self, request):
        raise RuntimeError("provider exploded")


class FakeTty(io.StringIO):
    def isatty(self) -> bool:
        return True


@pytest.fixture
def allow_provider():
    return StaticProvider("allowed")


@pytest.fixture
def deny_provider():
    return StaticProvider("denied")


def read_events(home) -> list[dict]:
    journal = home / "journal.jsonl"
    if not journal.exists():
        return []
    return [
        json.loads(line)
        for line in journal.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
