"""Offline verification: tamper, reorder, delete, malformed, unknown schema."""

from __future__ import annotations

import json

import pytest
from conftest import StaticProvider, read_events

import igris
from igris.identity import LocalSigningIdentity, load_public_key
from igris.verification import verify_journal


@pytest.fixture
def populated(igris_home):
    """A valid journal with four events (two guarded calls) plus keys."""
    provider = StaticProvider("allowed")

    @igris.guard(action="tests.populate", approval_provider=provider)
    def act(step: int):
        return step

    act(1)
    act(2)
    identity = LocalSigningIdentity.load_or_create()
    public = load_public_key(identity.public_key_path)
    journal = igris_home / "journal.jsonl"
    assert verify_journal(journal, public).valid
    return journal, public


def rewrite(journal, events):
    journal.write_text(
        "".join(
            json.dumps(e, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n"
            for e in events
        ),
        encoding="utf-8",
    )


def codes(result):
    return {issue.code for issue in result.issues}


class TestDetection:
    def test_valid_journal_passes(self, populated):
        journal, public = populated
        result = verify_journal(journal, public)
        assert result.valid
        assert result.events_verified == 4

    def test_modified_event_detected(self, populated, igris_home):
        journal, public = populated
        events = read_events(igris_home)
        events[1]["status"] = "succeeded-definitely-trust-me"
        rewrite(journal, events)
        result = verify_journal(journal, public)
        assert not result.valid
        assert {"hash_mismatch", "bad_signature"} <= codes(result)

    def test_tamper_with_recomputed_hash_still_detected(self, populated, igris_home):
        """An attacker who fixes up event_hash still cannot forge a signature."""
        from igris.journal import event_digest, unsigned_payload

        journal, public = populated
        events = read_events(igris_home)
        events[0]["action_name"] = "innocent.action"
        events[0]["event_hash"] = event_digest(unsigned_payload(events[0])).hex()
        rewrite(journal, events)
        result = verify_journal(journal, public)
        assert not result.valid
        assert "bad_signature" in codes(result)
        assert "chain_break" in codes(result)  # next event linked to the old hash

    def test_reordered_events_detected(self, populated, igris_home):
        journal, public = populated
        events = read_events(igris_home)
        events[1], events[2] = events[2], events[1]
        rewrite(journal, events)
        result = verify_journal(journal, public)
        assert not result.valid
        assert "chain_break" in codes(result)

    def test_middle_deletion_detected(self, populated, igris_home):
        journal, public = populated
        events = read_events(igris_home)
        del events[1]
        rewrite(journal, events)
        result = verify_journal(journal, public)
        assert not result.valid
        assert "chain_break" in codes(result)

    def test_tail_deletion_not_detectable_documented_limitation(self, populated, igris_home):
        """Honest limitation: truncating the tail passes offline verification.

        Detecting this requires an external checkpoint/witness (Connected mode).
        """
        journal, public = populated
        events = read_events(igris_home)
        rewrite(journal, events[:-1])
        result = verify_journal(journal, public)
        assert result.valid

    def test_malformed_jsonl_detected(self, populated):
        journal, public = populated
        with open(journal, "a", encoding="utf-8") as handle:
            handle.write("this is not json\n")
        result = verify_journal(journal, public)
        assert not result.valid
        assert "malformed_json" in codes(result)

    def test_unknown_schema_version_fails(self, populated, igris_home):
        journal, public = populated
        events = read_events(igris_home)
        events[0]["schema_version"] = "999"
        rewrite(journal, events)
        result = verify_journal(journal, public)
        assert not result.valid
        assert "unknown_schema" in codes(result)

    def test_missing_fields_detected(self, populated, igris_home):
        journal, public = populated
        events = read_events(igris_home)
        del events[0]["input_hash"]
        rewrite(journal, events)
        result = verify_journal(journal, public)
        assert not result.valid
        assert "missing_fields" in codes(result)

    def test_wrong_key_detected(self, populated, tmp_path, monkeypatch):
        journal, _ = populated
        monkeypatch.setenv("IGRIS_HOME", str(tmp_path / "other-home"))
        other = LocalSigningIdentity.load_or_create()
        other_public = load_public_key(other.public_key_path)
        result = verify_journal(journal, other_public)
        assert not result.valid
        assert "unknown_key" in codes(result)
