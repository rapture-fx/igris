"""Local privacy inspection and evidence-sync preflight regression tests."""

from __future__ import annotations

import json
import socket
import urllib.request
from pathlib import Path

import pytest
from conftest import StaticProvider

import igris
from igris.cli import EXIT_PRIVACY_ACK_REQUIRED, main
from igris.errors import EvidencePrivacyInspectionError, EvidencePrivacyPreflightError
from igris.evidence_privacy import PrivacyClassification, inspect_journal
from igris.evidence_sync import sync_journal
from igris.identity import LocalSigningIdentity, default_journal_path
from igris.journal import finalize_event
from igris.verification import verify_journal


class RecordingClient:
    def __init__(self) -> None:
        self.calls = []

    def submit_batch(self, key_id, public_key_pem, first_previous_event_hash, events):
        self.calls.append((key_id, public_key_pem, first_previous_event_hash, events))
        return {
            "batch_id": "privacy-test-batch",
            "evidence_state": "verified",
            "events_verified": len(events),
            "created": True,
            "chain_head": events[-1]["event_hash"],
        }


def record_mixed_journal(igris_home: Path) -> tuple[Path, tuple[str, ...]]:
    retained_values = ("customer-business-value-4815", "unicode-business-value-9021")

    @igris.guard(action="privacy.fully", approval_provider=StaticProvider("allowed"))
    def fully(token: str):
        return token

    @igris.guard(action="privacy.partial", approval_provider=StaticProvider("allowed"))
    def partial(customer_id: str, api_key: str):
        return customer_id

    @igris.guard(action="privacy.unicode", approval_provider=StaticProvider("denied"))
    def unicode_parameter(客户: str):
        return 客户

    @igris.guard(action="privacy.noargs", approval_provider=StaticProvider("allowed"))
    def no_arguments():
        raise RuntimeError("fixed test failure")

    assert fully("secret-token-not-in-evidence") == "secret-token-not-in-evidence"
    assert partial(retained_values[0], api_key="secret-key-not-in-evidence") == retained_values[0]
    with pytest.raises(igris.ActionDenied):
        unicode_parameter(retained_values[1])
    with pytest.raises(RuntimeError):
        no_arguments()
    return default_journal_path(), retained_values


def write_signed_decisions(igris_home: Path, summaries: list[str]) -> Path:
    identity = LocalSigningIdentity.load_or_create()
    journal = default_journal_path()
    previous = None
    events = []
    for index, summary in enumerate(summaries):
        payload = {
            "schema_version": "1",
            "event_type": "decision",
            "event_id": f"event-{index}",
            "action_id": f"action-{index}",
            "action_name": "privacy.synthetic",
            "contract_hash": "a" * 64,
            "timestamp_utc": "2026-01-01T00:00:00.000000Z",
            "key_id": identity.key_id,
            "previous_event_hash": previous,
            "decision": "denied",
            "risk": "medium",
            "approval_mode": "required",
            "redacted_input_summary": summary,
            "input_hash": "b" * 64,
        }
        event = finalize_event(payload, identity.sign)
        previous = event["event_hash"]
        events.append(event)
    journal.write_text(
        "".join(
            json.dumps(event, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n"
            for event in events
        ),
        encoding="utf-8",
    )
    return journal


class TestPrivacyClassification:
    def test_mixed_actions_counts_names_and_never_retains_values(self, igris_home):
        journal, retained_values = record_mixed_journal(igris_home)
        report = inspect_journal(journal)

        assert report.event_count == 7
        assert report.decision_count == 4
        assert report.outcome_count == 3
        assert (report.allowed_count, report.denied_count) == (3, 1)
        assert (report.succeeded_count, report.failed_count) == (2, 1)
        assert report.classifications.fully_redacted == 1
        assert report.classifications.partially_redacted == 2
        assert report.classifications.no_arguments == 1
        assert report.classifications.unknown == 0
        assert not report.safe_for_upload

        by_name = {action.action_name: action for action in report.actions}
        assert by_name["privacy.fully"].classification is PrivacyClassification.FULLY_REDACTED
        assert by_name["privacy.partial"].retained_parameter_names == ("customer_id",)
        assert by_name["privacy.unicode"].retained_parameter_names == ("客户",)
        assert by_name["privacy.noargs"].classification is PrivacyClassification.NO_ARGUMENTS
        serialized = repr(report)
        for value in retained_values:
            assert value not in serialized

    def test_unsupported_and_malformed_summaries_are_unknown(self, igris_home):
        journal = write_signed_decisions(
            igris_home,
            ['payload="<igris:unsupported:business.Client>"', "malformed without equals"],
        )
        report = inspect_journal(journal)
        assert report.classifications.unknown == 2
        assert report.actions[0].retained_parameter_names == ("payload",)
        assert not report.safe_for_upload

        client = RecordingClient()
        with pytest.raises(EvidencePrivacyPreflightError):
            sync_journal(client=client)
        assert client.calls == []

    def test_large_verified_journal_within_existing_limits(self, igris_home):
        journal = write_signed_decisions(igris_home, [""] * 501)
        report = inspect_journal(journal)
        assert report.event_count == 501
        assert report.classifications.no_arguments == 501
        assert report.safe_for_upload


class TestInspectSafety:
    def test_cli_is_local_only_value_free_and_byte_preserving(
        self, igris_home, monkeypatch, capsys
    ):
        journal, retained_values = record_mixed_journal(igris_home)
        key_path = igris_home / "verify_key.pem"
        before_journal = journal.read_bytes()
        before_key = key_path.read_bytes()

        def forbidden(*args, **kwargs):
            raise AssertionError("inspect must not perform DNS, socket, urllib, or HTTP activity")

        monkeypatch.setattr(socket, "getaddrinfo", forbidden)
        monkeypatch.setattr(urllib.request, "Request", forbidden)
        monkeypatch.setattr(urllib.request, "urlopen", forbidden)
        assert main(["evidence", "inspect", str(journal), "--verbose"]) == 3
        captured = capsys.readouterr()
        output = captured.out + captured.err
        assert "fully_redacted=1" in output
        assert "partially_redacted=2" in output
        assert '"customer_id"' in output
        assert '"客户"' in output
        for value in retained_values:
            assert value not in output
        assert str(journal) not in output
        assert journal.read_bytes() == before_journal
        assert key_path.read_bytes() == before_key
        identity = LocalSigningIdentity.load_or_create()
        assert verify_journal(journal, identity.public_key()).valid

    def test_tampered_journal_is_nonzero_and_value_free(self, igris_home, capsys):
        journal, retained_values = record_mixed_journal(igris_home)
        before = journal.read_bytes().replace(b'"risk":"medium"', b'"risk":"high"', 1)
        journal.write_bytes(before)
        assert main(["evidence", "inspect", str(journal)]) == 1
        output = capsys.readouterr().err
        assert "local verification" in output
        assert str(journal) not in output
        for value in retained_values:
            assert value not in output

    def test_missing_journal_error_does_not_disclose_absolute_path(self, tmp_path):
        missing = tmp_path / "business-name" / "journal.jsonl"
        with pytest.raises(EvidencePrivacyInspectionError) as exc_info:
            inspect_journal(missing)
        assert str(missing) not in str(exc_info.value)
        assert str(missing) not in repr(exc_info.value)


class TestSyncPrivacyPreflight:
    def test_retained_values_refuse_without_any_request_or_file_change(self, igris_home):
        journal, retained_values = record_mixed_journal(igris_home)
        client = RecordingClient()
        before_journal = journal.read_bytes()
        key_files = {
            path.name: path.read_bytes() for path in igris_home.iterdir() if path.is_file()
        }

        with pytest.raises(EvidencePrivacyPreflightError) as exc_info:
            sync_journal(client=client)

        error = exc_info.value
        assert client.calls == []
        assert error.execution_occurred is False
        assert error.retry_safe is True
        assert error.error_code == "evidence_privacy_acknowledgement_required"
        assert "--allow-unredacted" in str(error)
        for value in retained_values:
            assert value not in str(error)
            assert value not in repr(error)
        assert journal.read_bytes() == before_journal
        assert {
            path.name: path.read_bytes() for path in igris_home.iterdir() if path.is_file()
        } == key_files

    def test_acknowledgement_uploads_unchanged_events_for_current_call_only(self, igris_home):
        journal, _ = record_mixed_journal(igris_home)
        original_events = [json.loads(line) for line in journal.read_text("utf-8").splitlines()]
        client = RecordingClient()
        report = sync_journal(client=client, allow_unredacted=True)
        assert report.events_uploaded == len(original_events)
        assert client.calls[0][3] == original_events

        with pytest.raises(EvidencePrivacyPreflightError):
            sync_journal(client=RecordingClient())

    def test_fully_redacted_and_no_argument_journal_syncs_without_override(self, igris_home):
        @igris.guard(
            action="privacy.safe",
            redact=["business_value"],
            approval_provider=StaticProvider("allowed"),
        )
        def safe(business_value: str):
            return business_value

        @igris.guard(action="privacy.noargs", approval_provider=StaticProvider("denied"))
        def noargs():
            raise AssertionError("must not run")

        assert safe("ordinary-value-not-retained") == "ordinary-value-not-retained"
        with pytest.raises(igris.ActionDenied):
            noargs()
        client = RecordingClient()
        report = sync_journal(client=client)
        assert report.events_uploaded == 3
        assert len(client.calls) == 1

    def test_cli_refusal_precedes_configuration_and_has_distinct_exit_code(
        self, igris_home, monkeypatch, capsys
    ):
        journal, retained_values = record_mixed_journal(igris_home)
        monkeypatch.delenv("IGRIS_API_URL", raising=False)
        monkeypatch.delenv("IGRIS_API_KEY", raising=False)
        assert main(["evidence", "sync", str(journal)]) == EXIT_PRIVACY_ACK_REQUIRED
        output = capsys.readouterr().err
        assert "privacy preflight" in output
        assert "--allow-unredacted" in output
        for value in retained_values:
            assert value not in output
