"""CLI behavior and the end-to-end integration flow through the public CLI."""

from __future__ import annotations

import json
import os
import subprocess
import sys

import pytest
from conftest import StaticProvider, read_events

import igris
from igris.cli import main


@pytest.fixture
def populated(igris_home):
    """Journal with success, denial, and failure paths recorded."""
    allow = StaticProvider("allowed")
    deny = StaticProvider("denied")

    @igris.guard(action="cli.success", approval_provider=allow)
    def ok(x: int):
        return x

    @igris.guard(action="cli.denied", approval_provider=deny)
    def blocked():
        raise AssertionError("must not run")

    @igris.guard(action="cli.failing", approval_provider=StaticProvider("allowed"))
    def failing():
        raise RuntimeError("expected failure")

    ok(1)
    with pytest.raises(igris.ActionDenied):
        blocked()
    with pytest.raises(RuntimeError):
        failing()
    return igris_home / "journal.jsonl"


def run_cli(args, igris_home):
    """Run the public CLI exactly as an installed user would."""
    env = dict(os.environ, IGRIS_HOME=str(igris_home))
    return subprocess.run(
        [sys.executable, "-m", "igris.cli", *args],
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
    )


class TestVerifyCommand:
    def test_valid_journal_exits_zero(self, populated, igris_home):
        proc = run_cli(["verify", str(populated)], igris_home)
        assert proc.returncode == 0, proc.stderr
        assert "OK" in proc.stdout
        assert "5 event(s)" in proc.stdout

    def test_default_journal_path(self, populated, igris_home):
        proc = run_cli(["verify"], igris_home)
        assert proc.returncode == 0, proc.stderr

    def test_tampered_journal_exits_nonzero(self, populated, igris_home):
        events = read_events(igris_home)
        events[0]["action_name"] = "cli.someone-else"
        populated.write_text(
            "".join(json.dumps(e, sort_keys=True, separators=(",", ":")) + "\n" for e in events),
            encoding="utf-8",
        )
        proc = run_cli(["verify", str(populated)], igris_home)
        assert proc.returncode == 1
        assert "INVALID" in proc.stderr

    def test_missing_journal_exits_two(self, igris_home):
        proc = run_cli(["verify", str(igris_home / "nope.jsonl")], igris_home)
        assert proc.returncode == 2
        assert "not found" in proc.stderr

    def test_output_has_no_emoji(self, populated, igris_home):
        proc = run_cli(["verify", str(populated)], igris_home)
        assert proc.stdout.isascii()

    def test_in_process_main_matches_subprocess(self, populated, igris_home):
        assert main(["verify", str(populated)]) == 0


class TestKeyInfoCommand:
    def test_prints_public_identity_only(self, igris_home):
        proc = run_cli(["key-info"], igris_home)
        assert proc.returncode == 0, proc.stderr
        assert "key_id:" in proc.stdout
        assert "fingerprint: sha256:" in proc.stdout
        assert "verify_key.pem" in proc.stdout
        assert "PRIVATE KEY" not in proc.stdout
        # The actual private key PEM body must never appear.
        private_pem = (igris_home / "signing_key.pem").read_text()
        body = [line for line in private_pem.splitlines() if "-" not in line]
        for chunk in body:
            assert chunk not in proc.stdout


class TestSecretsNeverInJournal:
    def test_journal_bytes_free_of_secrets(self, igris_home):
        secret = "sk-live-THIS-MUST-NOT-LEAK-42"

        @igris.guard(approval_provider=StaticProvider("allowed"))
        def call_api(api_key: str, amount: int):
            raise RuntimeError(f"api rejected key {api_key}")

        with pytest.raises(RuntimeError):
            call_api(secret, 10)
        raw = (igris_home / "journal.jsonl").read_bytes()
        assert secret.encode() not in raw
