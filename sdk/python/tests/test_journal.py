"""Journal chaining, durability, corruption refusal, and concurrency."""

from __future__ import annotations

import json
import threading

from igris.identity import LocalSigningIdentity, load_public_key
from igris.journal import (
    EVENT_SCHEMA_VERSION,
    FileJournal,
    finalize_event,
    new_event_id,
    utc_timestamp,
)
from igris.verification import verify_journal


def make_builder(identity, event_type="decision", **extra):
    def build(previous_hash):
        payload = {
            "schema_version": EVENT_SCHEMA_VERSION,
            "event_type": event_type,
            "event_id": new_event_id(),
            "action_id": "tests.action",
            "action_name": "tests.action",
            "contract_hash": "0" * 64,
            "timestamp_utc": utc_timestamp(),
            "key_id": identity.key_id,
            "previous_event_hash": previous_hash,
            "decision": "allowed",
            "risk": "low",
            "approval_mode": "never",
            "redacted_input_summary": "",
            "input_hash": "0" * 64,
        }
        payload.update(extra)
        return finalize_event(payload, identity.sign)

    return build


class TestChaining:
    def test_first_event_has_null_genesis(self, igris_home, tmp_path):
        identity = LocalSigningIdentity.load_or_create()
        journal = FileJournal(tmp_path / "j.jsonl")
        event = journal.append_event(make_builder(identity))
        assert event["previous_event_hash"] is None

    def test_each_event_links_to_previous(self, igris_home, tmp_path):
        identity = LocalSigningIdentity.load_or_create()
        journal = FileJournal(tmp_path / "j.jsonl")
        first = journal.append_event(make_builder(identity))
        second = journal.append_event(make_builder(identity))
        assert second["previous_event_hash"] == first["event_hash"]

    def test_lines_are_compact_json(self, igris_home, tmp_path):
        identity = LocalSigningIdentity.load_or_create()
        path = tmp_path / "j.jsonl"
        FileJournal(path).append_event(make_builder(identity))
        line = path.read_text(encoding="utf-8").strip()
        parsed = json.loads(line)
        assert parsed["schema_version"] == EVENT_SCHEMA_VERSION
        assert ": " not in line  # compact separators


class TestCorruptTail:
    def test_refuses_to_extend_corrupt_journal(self, igris_home, tmp_path):
        identity = LocalSigningIdentity.load_or_create()
        path = tmp_path / "j.jsonl"
        journal = FileJournal(path)
        journal.append_event(make_builder(identity))
        with open(path, "a", encoding="utf-8") as handle:
            handle.write("{corrupt\n")
        import pytest

        from igris.errors import JournalError

        with pytest.raises(JournalError, match="corrupt"):
            journal.append_event(make_builder(identity))


class TestConcurrency:
    def test_threaded_appends_keep_chain_valid(self, igris_home, tmp_path):
        identity = LocalSigningIdentity.load_or_create()
        path = tmp_path / "j.jsonl"
        journal = FileJournal(path)
        errors: list[Exception] = []

        def append_many():
            try:
                for _ in range(20):
                    journal.append_event(make_builder(identity))
            except Exception as exc:  # pragma: no cover - failure reporting
                errors.append(exc)

        threads = [threading.Thread(target=append_many) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == []
        public = load_public_key(identity.public_key_path)
        result = verify_journal(path, public)
        assert result.valid, result.issues
        assert result.events_verified == 100
