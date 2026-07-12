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


class TestEvidenceSyncCommand:
    def test_missing_configuration_exits_two(self, populated, igris_home, monkeypatch, capsys):
        monkeypatch.delenv("IGRIS_API_URL", raising=False)
        monkeypatch.delenv("IGRIS_API_KEY", raising=False)
        assert main(["evidence", "sync", str(populated), "--allow-unredacted"]) == 2
        err = capsys.readouterr().err
        assert "IGRIS_API_URL" in err
        assert "IGRIS_API_KEY" in err

    def test_partial_configuration_exits_two_subprocess(self, populated, igris_home):
        env = dict(os.environ, IGRIS_HOME=str(igris_home), IGRIS_API_KEY="igris_k")
        env.pop("IGRIS_API_URL", None)
        proc = subprocess.run(
            [
                sys.executable,
                "-m",
                "igris.cli",
                "evidence",
                "sync",
                "--allow-unredacted",
            ],
            capture_output=True,
            text=True,
            env=env,
            timeout=60,
        )
        assert proc.returncode == 2
        assert "igris_k" not in proc.stderr, "credentials must never appear in CLI output"

    def test_invalid_journal_exits_one_before_network(
        self, populated, igris_home, monkeypatch, capsys
    ):
        monkeypatch.setenv("IGRIS_API_URL", "https://igris.test")
        monkeypatch.setenv("IGRIS_API_KEY", "igris_cli_token_not_real")
        text = populated.read_text(encoding="utf-8")
        populated.write_text(text.replace('"decision":"allowed"', '"decision":"denied "'), "utf-8")

        from igris import evidence_sync as evidence_sync_module

        def _no_network(request, timeout=None):
            raise AssertionError("local validation failure must never reach the network")

        monkeypatch.setattr(evidence_sync_module, "_default_open", _no_network)
        assert main(["evidence", "sync", str(populated)]) == 1
        err = capsys.readouterr().err
        assert "LOCAL verification" in err
        assert "igris_cli_token_not_real" not in err

    def test_successful_sync_exits_zero(self, populated, igris_home, monkeypatch, capsys):
        monkeypatch.setenv("IGRIS_API_URL", "https://igris.test")
        monkeypatch.setenv("IGRIS_API_KEY", "igris_cli_token_not_real")

        from igris import evidence_sync as evidence_sync_module

        events = [json.loads(line) for line in populated.read_text("utf-8").strip().splitlines()]

        class _Response:
            status = 202

            def read(self):
                return json.dumps(
                    {
                        "batch_id": "b-cli-1",
                        "evidence_state": "verified",
                        "execution_provenance": "embedded",
                        "events_verified": len(events),
                        "created": True,
                        "chain_head": events[-1]["event_hash"],
                    }
                ).encode("utf-8")

            def getcode(self):
                return self.status

        calls = []

        def fake_open(request, timeout=None):
            calls.append(request)
            return _Response()

        monkeypatch.setattr(evidence_sync_module, "_default_open", fake_open)
        assert main(["evidence", "sync", str(populated), "--allow-unredacted"]) == 0
        out = capsys.readouterr().out
        assert "OK: local verification passed" in out
        assert "b-cli-1" in out
        assert "embedded" in out
        assert len(calls) == 1

    def test_auth_failure_exits_one(self, populated, igris_home, monkeypatch, capsys):
        monkeypatch.setenv("IGRIS_API_URL", "https://igris.test")
        monkeypatch.setenv("IGRIS_API_KEY", "igris_cli_token_not_real")

        import io as io_module
        import urllib.error

        from igris import evidence_sync as evidence_sync_module

        def fake_open(request, timeout=None):
            raise urllib.error.HTTPError(
                url=request.full_url,
                code=401,
                msg="unauthorized",
                hdrs=None,
                fp=io_module.BytesIO(b'{"error":"unauthenticated"}'),
            )

        monkeypatch.setattr(evidence_sync_module, "_default_open", fake_open)
        assert main(["evidence", "sync", str(populated), "--allow-unredacted"]) == 1
        err = capsys.readouterr().err
        assert "authentication was rejected" in err
        assert "igris_cli_token_not_real" not in err

    def test_evidence_help_available_in_subprocess(self, igris_home):
        proc = run_cli(["evidence", "--help"], igris_home)
        assert proc.returncode == 0
        assert "sync" in proc.stdout
        assert "status" in proc.stdout


class TestEvidenceStatusCommand:
    def test_status_prints_fields(self, igris_home, monkeypatch, capsys):
        monkeypatch.setenv("IGRIS_API_URL", "https://igris.test")
        monkeypatch.setenv("IGRIS_API_KEY", "igris_cli_token_not_real")

        from igris import evidence_sync as evidence_sync_module

        class _Response:
            status = 200

            def read(self):
                return json.dumps(
                    {
                        "batch_id": "b-cli-2",
                        "evidence_state": "verified",
                        "execution_provenance": "embedded",
                        "events_accepted": 5,
                        "events_verified": 5,
                    }
                ).encode("utf-8")

            def getcode(self):
                return self.status

        monkeypatch.setattr(
            evidence_sync_module, "_default_open", lambda r, timeout=None: _Response()
        )
        assert main(["evidence", "status", "b-cli-2"]) == 0
        out = capsys.readouterr().out
        assert "evidence_state: verified" in out
        assert "execution_provenance: embedded" in out
