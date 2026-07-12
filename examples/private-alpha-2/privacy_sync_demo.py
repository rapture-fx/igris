"""Demonstrate the fail-closed evidence privacy preflight with no network.

Uses an in-process recording client so the refusal and the explicit
acknowledgement can be shown without any endpoint, API key, DNS lookup, or
HTTP request. Run ``alpha2_demo.py`` first so a journal exists.
"""

from igris.errors import EvidencePrivacyPreflightError
from igris.evidence_sync import sync_journal


class RecordingClient:
    """Stands in for the HTTP client; records what would have been uploaded."""

    def __init__(self) -> None:
        self.calls = []

    def submit_batch(self, key_id, public_key_pem, first_previous_event_hash, events):
        self.calls.append(events)
        return {
            "batch_id": "alpha2-demo-batch",
            "evidence_state": "verified",
            "events_verified": len(events),
            "created": True,
            "chain_head": events[-1]["event_hash"],
        }


def main() -> None:
    refused = RecordingClient()
    try:
        sync_journal(client=refused)
    except EvidencePrivacyPreflightError:
        assert refused.calls == []
        print("PRIVACY REFUSAL: sync refused before any upload (no events left the machine)")
    else:  # pragma: no cover - protects the fail-closed claim in this example
        raise AssertionError("a journal with retained values must refuse default sync")

    acknowledged = RecordingClient()
    report = sync_journal(client=acknowledged, allow_unredacted=True)
    print(f"ACKNOWLEDGED UPLOAD: {report.events_uploaded} events to the recording client")

    try:
        sync_journal(client=RecordingClient())
    except EvidencePrivacyPreflightError:
        print("SECOND SYNC REFUSED: --allow-unredacted was not persisted")
    else:  # pragma: no cover
        raise AssertionError("the acknowledgement must apply to one invocation only")


if __name__ == "__main__":
    main()
