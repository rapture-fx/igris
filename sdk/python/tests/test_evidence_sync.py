"""Explicit evidence synchronization: local-first validation, upload
contents, typed failure semantics, and the guarantee that guarded execution
never uploads evidence.

Every test runs under the autouse socket guard from conftest.py, so any code
path that would actually touch the network fails loudly. HTTP behavior is
exercised through the injectable opener.
"""

from __future__ import annotations

import io
import json
import urllib.error
from pathlib import Path

import pytest
from conftest import StaticProvider

import igris
from igris import evidence_sync
from igris.errors import (
    EvidenceSyncAuthenticationError,
    EvidenceSyncConfigurationError,
    EvidenceSyncConflictError,
    EvidenceSyncServerError,
    EvidenceSyncTransportError,
    EvidenceSyncValidationError,
)
from igris.evidence_sync import (
    HttpEvidenceSyncClient,
    batch_content_hash,
    derive_idempotency_key,
    get_batch_status,
    sync_journal,
)
from igris.identity import LocalSigningIdentity, default_journal_path

TOKEN = "igris_test_token_ev_not_real"
ENDPOINT = "https://igris.test"


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    monkeypatch.delenv("IGRIS_API_URL", raising=False)
    monkeypatch.delenv("IGRIS_API_KEY", raising=False)


@pytest.fixture
def connected_env(monkeypatch):
    monkeypatch.setenv("IGRIS_API_URL", ENDPOINT)
    monkeypatch.setenv("IGRIS_API_KEY", TOKEN)


class FakeHTTPResponse:
    def __init__(self, status: int, body: dict):
        self.status = status
        self._body = json.dumps(body).encode("utf-8")

    def getcode(self):
        return self.status

    def read(self):
        return self._body


def make_http_error(status: int, body: dict) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(
        url=ENDPOINT + "/v1/evidence/batches",
        code=status,
        msg="error",
        hdrs=None,
        fp=io.BytesIO(json.dumps(body).encode("utf-8")),
    )


class RecordingOpener:
    """Injectable opener: records every request, returns/raises from a queue."""

    def __init__(self, *outcomes):
        self.outcomes = list(outcomes)
        self.requests = []

    def __call__(self, request, timeout=None):
        self.requests.append(request)
        if not self.outcomes:
            raise AssertionError("unexpected extra HTTP request")
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def verified_response(
    batch_id: str = "b-1", events: int = 0, created: bool = True, chain_head: str | None = None
) -> FakeHTTPResponse:
    return FakeHTTPResponse(
        202 if created else 200,
        {
            "batch_id": batch_id,
            "evidence_state": "verified",
            "execution_provenance": "embedded",
            "events_accepted": events,
            "events_verified": events,
            "created": created,
            "chain_head": chain_head,
        },
    )


def write_journal(igris_home, n_actions: int = 2) -> Path:
    """Record real guarded executions into the temporary IGRIS_HOME journal."""
    provider = StaticProvider("allowed")

    @igris.guard(action="tests.evidence.pay", risk="high", approval_provider=provider)
    def pay(amount: int, api_key: str):
        return {"ok": amount}

    for i in range(n_actions):
        assert pay(i + 1, api_key="secret-arg-value") == {"ok": i + 1}
    return default_journal_path()


def make_client(opener) -> HttpEvidenceSyncClient:
    from igris.connected import ConnectedConfig

    return HttpEvidenceSyncClient(ConnectedConfig(endpoint=ENDPOINT, token=TOKEN), opener=opener)


# ---------------------------------------------------------------------------
# Guarded execution never uploads evidence
# ---------------------------------------------------------------------------


class TestGuardNeverUploadsEvidence:
    def test_guard_module_does_not_reference_evidence_sync(self):
        import inspect

        import igris.guard as guard_module

        source = inspect.getsource(guard_module)
        assert "evidence_sync" not in source
        assert "/v1/evidence" not in source

    def test_guarded_execution_constructs_no_evidence_client(self, igris_home, monkeypatch):
        def _forbidden(*args, **kwargs):
            raise AssertionError("guarded execution must never construct an evidence client")

        monkeypatch.setattr(evidence_sync, "HttpEvidenceSyncClient", _forbidden)
        monkeypatch.setattr(evidence_sync, "sync_journal", _forbidden)
        journal = write_journal(igris_home)  # real guarded executions
        assert journal.exists()
        # And the socket guard (conftest) already proves zero network I/O.


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


class TestEvidenceSyncConfiguration:
    def test_no_configuration_fails_clearly(self, igris_home):
        write_journal(igris_home)
        with pytest.raises(EvidenceSyncConfigurationError) as exc_info:
            sync_journal(allow_unredacted=True)
        assert "IGRIS_API_URL" in str(exc_info.value)
        assert "IGRIS_API_KEY" in str(exc_info.value)

    @pytest.mark.parametrize("present", ["IGRIS_API_URL", "IGRIS_API_KEY"])
    def test_partial_configuration_fails_clearly(self, igris_home, monkeypatch, present):
        write_journal(igris_home)
        monkeypatch.setenv(present, ENDPOINT if present == "IGRIS_API_URL" else TOKEN)
        with pytest.raises(EvidenceSyncConfigurationError):
            sync_journal(allow_unredacted=True)

    def test_http_endpoint_refused_except_localhost(self, igris_home, monkeypatch):
        write_journal(igris_home)
        monkeypatch.setenv("IGRIS_API_URL", "http://evil.example.test")
        monkeypatch.setenv("IGRIS_API_KEY", TOKEN)
        with pytest.raises(EvidenceSyncConfigurationError) as exc_info:
            sync_journal(allow_unredacted=True)
        assert "https" in str(exc_info.value)

    def test_config_failure_happens_before_local_files_matter(self):
        # No journal, no config: config-independent local validation still
        # reports the journal problem first (nothing was uploaded either way).
        with pytest.raises(EvidenceSyncValidationError) as exc_info:
            sync_journal(Path("/nonexistent/journal.jsonl"))
        assert "Nothing was uploaded" in str(exc_info.value)


# ---------------------------------------------------------------------------
# Local validation fails before any network activity
# ---------------------------------------------------------------------------


class TestLocalValidationBeforeNetwork:
    def test_malformed_journal_fails_before_network(self, igris_home):
        journal = write_journal(igris_home)
        with open(journal, "ab") as handle:
            handle.write(b"{not json\n")
        opener = RecordingOpener()
        with pytest.raises(EvidenceSyncValidationError) as exc_info:
            sync_journal(client=make_client(opener))
        assert opener.requests == [], "local failure must never reach the network"
        assert "LOCAL verification" in str(exc_info.value)
        assert "malformed_json" in str(exc_info.value)

    def test_broken_chain_fails_before_network(self, igris_home):
        journal = write_journal(igris_home)
        lines = journal.read_bytes().strip().split(b"\n")
        # Drop a middle event: linkage breaks.
        journal.write_bytes(b"\n".join([lines[0], lines[3]]) + b"\n")
        opener = RecordingOpener()
        with pytest.raises(EvidenceSyncValidationError) as exc_info:
            sync_journal(client=make_client(opener))
        assert opener.requests == []
        assert "chain_break" in str(exc_info.value)

    def test_tampered_event_fails_before_network(self, igris_home):
        journal = write_journal(igris_home)
        text = journal.read_text(encoding="utf-8")
        journal.write_text(text.replace('"status":"succeeded"', '"status":"failed"'), "utf-8")
        opener = RecordingOpener()
        with pytest.raises(EvidenceSyncValidationError) as exc_info:
            sync_journal(client=make_client(opener))
        assert opener.requests == []
        assert "hash_mismatch" in str(exc_info.value)

    def test_journal_is_never_modified_by_sync(self, igris_home):
        journal = write_journal(igris_home)
        with open(journal, "ab") as handle:
            handle.write(b"{not json\n")
        before = journal.read_bytes()
        with pytest.raises(EvidenceSyncValidationError):
            sync_journal(client=make_client(RecordingOpener()))
        assert journal.read_bytes() == before, "sync must never rewrite or repair the journal"

    def test_missing_journal(self, igris_home):
        with pytest.raises(EvidenceSyncValidationError) as exc_info:
            sync_journal(client=make_client(RecordingOpener()))
        assert "journal not found" in str(exc_info.value)

    def test_empty_journal_is_up_to_date_without_network(self, igris_home):
        # Create identity + empty journal.
        LocalSigningIdentity.load_or_create()
        journal = default_journal_path()
        journal.write_bytes(b"")
        opener = RecordingOpener()
        report = sync_journal(client=make_client(opener), allow_unredacted=True)
        assert report.up_to_date
        assert report.events_total == 0
        assert opener.requests == []


# ---------------------------------------------------------------------------
# Upload contents
# ---------------------------------------------------------------------------


class TestUploadContents:
    def test_uploads_exactly_the_allowed_envelope(self, igris_home):
        journal = write_journal(igris_home)
        raw_events = [json.loads(line) for line in journal.read_text("utf-8").strip().splitlines()]
        opener = RecordingOpener(
            verified_response(events=len(raw_events), chain_head=raw_events[-1]["event_hash"])
        )
        report = sync_journal(client=make_client(opener), allow_unredacted=True)

        assert len(opener.requests) == 1
        request = opener.requests[0]
        assert request.full_url == ENDPOINT + "/v1/evidence/batches"
        payload = json.loads(request.data.decode("utf-8"))
        assert sorted(payload) == ["journal_segment", "key_id", "public_key_pem"]
        assert sorted(payload["journal_segment"]) == ["events", "first_previous_event_hash"]
        assert payload["journal_segment"]["first_previous_event_hash"] is None
        assert payload["journal_segment"]["events"] == raw_events
        assert "BEGIN PUBLIC KEY" in payload["public_key_pem"]

        body_text = request.data.decode("utf-8")
        identity = LocalSigningIdentity.load_or_create()
        private_pem = (identity.home / "signing_key.pem").read_text("utf-8")
        assert "PRIVATE" not in body_text, "private key material must never be uploaded"
        for line in private_pem.splitlines()[1:-1]:
            assert line not in body_text
        assert TOKEN not in body_text, "the API credential must never ride in the body"
        assert "secret-arg-value" not in body_text, "redacted raw values are not in the journal"
        assert str(identity.home) not in body_text, "local paths must never be uploaded"
        assert "IGRIS_API" not in body_text, "environment variables must never be uploaded"

        auth = request.get_header("Authorization")
        assert auth == "Bearer " + TOKEN
        idem = request.get_header("Idempotency-key")
        expected = derive_idempotency_key(
            report.key_id, batch_content_hash(report.key_id, raw_events)
        )
        assert idem == expected

        assert report.events_uploaded == len(raw_events)
        assert not report.up_to_date
        assert report.batches[0].evidence_state == "verified"

    def test_chunks_large_journals_into_linked_batches(self, igris_home, monkeypatch):
        journal = write_journal(igris_home, n_actions=3)  # 6 events
        raw_events = [json.loads(line) for line in journal.read_text("utf-8").strip().splitlines()]
        monkeypatch.setattr(evidence_sync, "MAX_EVENTS_PER_BATCH", 4)
        opener = RecordingOpener(
            verified_response("b-1", 4, chain_head=raw_events[3]["event_hash"]),
            verified_response("b-2", 2, chain_head=raw_events[5]["event_hash"]),
        )
        report = sync_journal(client=make_client(opener), allow_unredacted=True)
        assert [batch.batch_id for batch in report.batches] == ["b-1", "b-2"]
        assert report.events_uploaded == 6

        first = json.loads(opener.requests[0].data.decode("utf-8"))
        second = json.loads(opener.requests[1].data.decode("utf-8"))
        assert first["journal_segment"]["first_previous_event_hash"] is None
        assert len(first["journal_segment"]["events"]) == 4
        assert second["journal_segment"]["first_previous_event_hash"] == raw_events[3]["event_hash"]
        assert len(second["journal_segment"]["events"]) == 2


# ---------------------------------------------------------------------------
# Endpoint failure semantics (typed)
# ---------------------------------------------------------------------------


class TestEndpointFailures:
    def _sync(self, igris_home, *outcomes):
        write_journal(igris_home)
        opener = RecordingOpener(*outcomes)
        return sync_journal(client=make_client(opener), allow_unredacted=True)

    def test_authentication_failure_is_typed_and_scrubbed(self, igris_home):
        with pytest.raises(EvidenceSyncAuthenticationError) as exc_info:
            self._sync(igris_home, make_http_error(401, {"error": "unauthenticated"}))
        assert exc_info.value.status_code == 401
        assert exc_info.value.retry_safe is False
        assert TOKEN not in str(exc_info.value)
        assert TOKEN not in repr(exc_info.value)

    def test_validation_rejection_is_typed(self, igris_home):
        retained_value = "business-value-must-not-be-reflected"
        with pytest.raises(EvidenceSyncValidationError) as exc_info:
            self._sync(
                igris_home,
                make_http_error(
                    422,
                    {"error": "validation_failed", "detail": retained_value},
                ),
            )
        assert exc_info.value.error_code == "validation_failed"
        assert exc_info.value.retry_safe is False
        assert retained_value not in str(exc_info.value)
        assert retained_value not in repr(exc_info.value)

    def test_idempotency_conflict_is_typed(self, igris_home):
        with pytest.raises(EvidenceSyncConflictError) as exc_info:
            self._sync(igris_home, make_http_error(409, {"error": "idempotency_key_conflict"}))
        assert exc_info.value.error_code == "idempotency_key_conflict"

    def test_signing_key_conflict_is_typed(self, igris_home):
        with pytest.raises(EvidenceSyncConflictError) as exc_info:
            self._sync(igris_home, make_http_error(409, {"error": "signing_key_conflict"}))
        assert exc_info.value.error_code == "signing_key_conflict"

    def test_server_error_is_retry_safe(self, igris_home):
        with pytest.raises(EvidenceSyncServerError) as exc_info:
            self._sync(igris_home, make_http_error(503, {"error": "db_error"}))
        assert exc_info.value.retry_safe is True

    def test_timeout_is_transport_error(self, igris_home):
        with pytest.raises(EvidenceSyncTransportError) as exc_info:
            self._sync(igris_home, TimeoutError())
        assert exc_info.value.retry_safe is True

    def test_redirect_is_refused(self, igris_home):
        with pytest.raises(EvidenceSyncTransportError) as exc_info:
            self._sync(igris_home, make_http_error(302, {}))
        assert "redirect" in str(exc_info.value)

    def test_server_side_rejection_is_typed_validation(self, igris_home):
        response = FakeHTTPResponse(
            202,
            {
                "batch_id": "b-rej",
                "evidence_state": "rejected",
                "verification_error_code": "hash_mismatch",
                "created": True,
            },
        )
        with pytest.raises(EvidenceSyncValidationError) as exc_info:
            self._sync(igris_home, response)
        assert exc_info.value.error_code == "hash_mismatch"

    def test_no_indefinite_retries(self, igris_home):
        # A transport failure surfaces immediately: exactly one attempt.
        write_journal(igris_home)
        opener = RecordingOpener(urllib.error.URLError("no route"))
        with pytest.raises(EvidenceSyncTransportError):
            sync_journal(client=make_client(opener), allow_unredacted=True)
        assert len(opener.requests) == 1

    def test_transport_reason_text_is_not_reflected(self, igris_home):
        retained_value = "business-value-in-transport-reason"
        with pytest.raises(EvidenceSyncTransportError) as exc_info:
            self._sync(igris_home, urllib.error.URLError(retained_value))
        assert retained_value not in str(exc_info.value)
        assert retained_value not in repr(exc_info.value)


# ---------------------------------------------------------------------------
# Incremental continuation (chain-head resync)
# ---------------------------------------------------------------------------


class TestChainHeadResync:
    def test_resumes_after_stored_head(self, igris_home):
        journal = write_journal(igris_home, n_actions=3)  # 6 events
        raw_events = [json.loads(line) for line in journal.read_text("utf-8").strip().splitlines()]
        head = raw_events[1]["event_hash"]  # server already holds events 0-1
        opener = RecordingOpener(
            make_http_error(409, {"error": "chain_head_mismatch", "expected_head": head}),
            verified_response("b-cont", 4, chain_head=raw_events[-1]["event_hash"]),
        )
        report = sync_journal(client=make_client(opener), allow_unredacted=True)
        assert report.events_uploaded == 4
        assert not report.up_to_date

        resumed = json.loads(opener.requests[1].data.decode("utf-8"))
        assert resumed["journal_segment"]["first_previous_event_hash"] == head
        assert len(resumed["journal_segment"]["events"]) == 4

    def test_fully_synced_journal_reports_up_to_date(self, igris_home):
        journal = write_journal(igris_home)
        raw_events = [json.loads(line) for line in journal.read_text("utf-8").strip().splitlines()]
        head = raw_events[-1]["event_hash"]
        opener = RecordingOpener(
            make_http_error(409, {"error": "chain_head_mismatch", "expected_head": head}),
        )
        report = sync_journal(client=make_client(opener), allow_unredacted=True)
        assert report.up_to_date
        assert report.events_uploaded == 0

    def test_diverged_stream_is_conflict(self, igris_home):
        write_journal(igris_home)
        unknown_head = "ab" * 32
        opener = RecordingOpener(
            make_http_error(409, {"error": "chain_head_mismatch", "expected_head": unknown_head}),
        )
        with pytest.raises(EvidenceSyncConflictError) as exc_info:
            sync_journal(client=make_client(opener), allow_unredacted=True)
        assert "diverged" in str(exc_info.value)

    def test_resync_is_bounded_to_one_attempt(self, igris_home):
        journal = write_journal(igris_home, n_actions=2)
        raw_events = [json.loads(line) for line in journal.read_text("utf-8").strip().splitlines()]
        head = raw_events[0]["event_hash"]
        opener = RecordingOpener(
            make_http_error(409, {"error": "chain_head_mismatch", "expected_head": head}),
            make_http_error(409, {"error": "chain_head_mismatch", "expected_head": head}),
        )
        with pytest.raises(EvidenceSyncConflictError):
            sync_journal(client=make_client(opener), allow_unredacted=True)
        assert len(opener.requests) == 2, "exactly one resync; never an unbounded loop"


# ---------------------------------------------------------------------------
# Batch status retrieval
# ---------------------------------------------------------------------------


class TestBatchStatus:
    def test_get_batch_status(self):
        opener = RecordingOpener(
            FakeHTTPResponse(200, {"batch_id": "b-9", "evidence_state": "verified"})
        )
        status = get_batch_status("b-9", client=make_client(opener))
        assert status["evidence_state"] == "verified"
        assert opener.requests[0].full_url == ENDPOINT + "/v1/evidence/batches/b-9"
        assert opener.requests[0].get_header("Authorization") == "Bearer " + TOKEN

    def test_get_batch_status_not_found(self):
        opener = RecordingOpener(make_http_error(404, {"error": "batch_not_found"}))
        with pytest.raises(EvidenceSyncValidationError) as exc_info:
            get_batch_status("b-missing", client=make_client(opener))
        assert exc_info.value.status_code == 404
