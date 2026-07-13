"""Explicit Connected evidence synchronization (``igris evidence sync``).

Uploading local Embedded evidence to Igris is EXPLICIT: it happens only when
the developer runs the CLI command (or calls :func:`sync_journal` directly).
Guarded execution never uploads evidence, never spawns a background thread,
and is completely unchanged — ``igris.guard`` does not import this module.

What is uploaded, and nothing else:

* the signed decision/outcome events of the selected journal, verbatim;
* the PUBLIC verification key (``verify_key.pem``) for tenant-scoped
  registration and server-side signature verification;
* the ``key_id`` and per-batch chain-linkage metadata
  (``first_previous_event_hash``).

Never uploaded: the private signing key, API credentials (they ride only in
the ``Authorization`` header), raw values removed by redaction (they are not
in the journal to begin with), environment variables, local filesystem
paths, function source, or any journal other than the selected one.

Before any network activity the journal is verified locally with the same
verifier ``igris verify`` uses; a journal that fails locally is never
uploaded and never rewritten.

Verified central storage proves cryptographic integrity and chain
continuity of locally observed Embedded execution. It does NOT make the
evidence Managed, does not prove the external side effect occurred, and
grants no execution permission.

Batching: journals larger than one request are uploaded as consecutive
chain-linked batches. If the server already holds a prefix of this journal
(an earlier sync), the reported ``expected_head`` is located in the local
journal and only the remainder is uploaded — one bounded resync, never an
unbounded retry loop. Batch identity (and the derived ``Idempotency-Key``)
commits to the actual canonical event bytes, mirroring the server rule in
``igris-overture/api/evidence_verify.go``.
"""

from __future__ import annotations

import dataclasses
import json
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from .canonical import canonical_json_bytes, sha256_hex
from .connected import (
    DEFAULT_TIMEOUT_SECONDS,
    ENDPOINT_ENV,
    TOKEN_ENV,
    ConnectedConfig,
    load_connected_config,
)
from .errors import (
    ConnectedConfigurationError,
    EvidencePrivacyPreflightError,
    EvidenceSyncAuthenticationError,
    EvidenceSyncConfigurationError,
    EvidenceSyncConflictError,
    EvidenceSyncError,
    EvidenceSyncServerError,
    EvidenceSyncTransportError,
    EvidenceSyncValidationError,
    IdentityError,
)
from .evidence_privacy import inspect_verified_snapshot
from .identity import (
    PUBLIC_KEY_FILENAME,
    default_journal_path,
    igris_home,
    key_id_for,
    load_public_key,
)
from .verification import load_journal_snapshot

BATCHES_PATH = "/v1/evidence/batches"
MAX_EVENTS_PER_BATCH = 500
# Stay well under the server's 1 MiB request cap; the envelope (key PEM,
# field names) rides in the same request.
MAX_BATCH_PAYLOAD_BYTES = 900 * 1024
_MAX_ERROR_DETAIL_CHARS = 200
_MAX_REPORTED_ISSUES = 5


@dataclasses.dataclass(frozen=True)
class EvidenceBatchResult:
    """One accepted (or replayed) batch as the endpoint reported it."""

    batch_id: str
    evidence_state: str
    events_verified: int
    created: bool
    chain_head: str | None


@dataclasses.dataclass(frozen=True)
class EvidenceSyncReport:
    """Outcome of one explicit synchronization run."""

    key_id: str
    events_total: int
    events_uploaded: int
    batches: tuple[EvidenceBatchResult, ...]
    up_to_date: bool


class _ChainHeadMismatch(Exception):
    """Internal: the endpoint expects a different stream head (409)."""

    def __init__(self, expected_head: str | None) -> None:
        super().__init__("chain_head_mismatch")
        self.expected_head = expected_head


def load_evidence_sync_config(environ: Any = None) -> ConnectedConfig:
    """Resolve explicit Connected configuration for evidence sync.

    Unlike guarded execution (where no configuration simply means Embedded
    mode), the explicit sync command REQUIRES complete configuration.
    """
    try:
        config = load_connected_config(environ)
    except ConnectedConfigurationError as exc:
        raise EvidenceSyncConfigurationError(f"evidence sync cannot run: {exc}") from None
    if config is None:
        raise EvidenceSyncConfigurationError(
            "evidence sync requires explicit Connected configuration: set "
            f"{ENDPOINT_ENV} and {TOKEN_ENV}. Nothing was uploaded."
        )
    return config


def read_journal_events(path: Path) -> list[dict[str, Any]]:
    """Parse the journal's events. Call only after local verification."""
    events: list[dict[str, Any]] = []
    for line in path.read_bytes().split(b"\n"):
        stripped = line.strip()
        if stripped:
            events.append(json.loads(stripped.decode("utf-8")))
    return events


def batch_content_hash(key_id: str, events: list[dict[str, Any]]) -> str:
    """The server's deterministic batch identity, mirrored exactly.

    SHA-256 over the key id plus the ordered manifest of SHA-256 hashes of
    the canonical event bytes (igris-overture/api/evidence_verify.go
    ``evidenceContentHash``). Keep the two implementations in lockstep.
    """
    byte_hashes = [sha256_hex(canonical_json_bytes(event)) for event in events]
    material = "igris-evidence-batch:v1:" + key_id + ":" + ",".join(byte_hashes)
    return sha256_hex(material.encode("utf-8"))


def derive_idempotency_key(key_id: str, content_hash: str) -> str:
    """Stable, documented Idempotency-Key for one batch submission."""
    material = f"igris-evidence-sync:v1:{key_id}:{content_hash}"
    return "sdk-" + sha256_hex(material.encode("utf-8"))[:48]


class _RefuseRedirects(urllib.request.HTTPRedirectHandler):
    """Never follow redirects: an HTTPS endpoint must answer directly.

    Returning None makes urllib surface the 3xx as an HTTPError, which is
    mapped to a transport failure — evidence must not chase a Location
    header to a host (or scheme) the developer did not configure.
    """

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class HttpEvidenceSyncClient:
    """Standard-library HTTP client for the evidence batch endpoints.

    Bounded timeouts, https enforced at configuration time, redirects
    refused, and strictly bounded error surfaces: credentials never appear
    in exceptions. ``opener`` is an injectable ``callable(request, timeout)
    -> response`` used by tests.
    """

    def __init__(
        self,
        config: ConnectedConfig,
        *,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        opener: Any = None,
    ) -> None:
        self._config = config
        self._timeout = timeout
        self._opener = opener or _default_open

    @property
    def endpoint(self) -> str:
        return self._config.endpoint

    def submit_batch(
        self,
        key_id: str,
        public_key_pem: str,
        first_previous_event_hash: str | None,
        events: list[dict[str, Any]],
    ) -> dict[str, Any]:
        payload = {
            "key_id": key_id,
            "public_key_pem": public_key_pem,
            "journal_segment": {
                "first_previous_event_hash": first_previous_event_hash,
                "events": events,
            },
        }
        content_hash = batch_content_hash(key_id, events)
        # S310: scheme restricted to https/local-dev http by configuration.
        request = urllib.request.Request(  # noqa: S310
            self._config.endpoint + BATCHES_PATH,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer " + self._config.token,
                "Idempotency-Key": derive_idempotency_key(key_id, content_hash),
            },
        )
        return self._send(request, accept=(200, 202))

    def get_batch(self, batch_id: str) -> dict[str, Any]:
        quoted = urllib.parse.quote(batch_id, safe="")
        request = urllib.request.Request(  # noqa: S310
            self._config.endpoint + BATCHES_PATH + "/" + quoted,
            method="GET",
            headers={"Authorization": "Bearer " + self._config.token},
        )
        return self._send(request, accept=(200,))

    def _send(self, request: urllib.request.Request, accept: tuple[int, ...]) -> dict[str, Any]:
        try:
            response = self._opener(request, timeout=self._timeout)
        except urllib.error.HTTPError as exc:
            raise _error_for_status(exc) from None
        except TimeoutError as exc:
            raise EvidenceSyncTransportError(
                "evidence sync failed: the request timed out. Nothing needs to "
                "be undone; re-running the command is safe (content-keyed)."
            ) from exc
        except urllib.error.URLError as exc:
            raise EvidenceSyncTransportError(
                f"evidence sync failed: transport failure ({_scrubbed_reason(exc)}). "
                "Re-running the command is safe (content-keyed)."
            ) from None
        except OSError as exc:
            raise EvidenceSyncTransportError(
                f"evidence sync failed: transport failure ({type(exc).__name__}). "
                "Re-running the command is safe (content-keyed)."
            ) from None

        status = getattr(response, "status", None) or response.getcode()
        raw = response.read()
        if status not in accept:
            raise EvidenceSyncServerError(
                f"evidence sync failed: unexpected response status {status}",
                status_code=status,
            )
        try:
            decoded = json.loads(raw.decode("utf-8"))
            if not isinstance(decoded, dict):
                raise ValueError("response is not an object")
            return decoded
        except (ValueError, UnicodeDecodeError) as exc:
            raise EvidenceSyncServerError(
                "evidence sync failed: the endpoint returned an unreadable response",
                status_code=status,
            ) from exc


def _default_open(request: urllib.request.Request, timeout: float) -> Any:
    opener = urllib.request.build_opener(_RefuseRedirects)
    return opener.open(request, timeout=timeout)


def _error_for_status(exc: urllib.error.HTTPError) -> EvidenceSyncError:
    status = exc.code
    error_code, _detail = _parse_error_body(exc)
    if 300 <= status < 400:
        return EvidenceSyncTransportError(
            f"evidence sync failed: the endpoint attempted a redirect (HTTP {status}); "
            "refusing to follow redirects for evidence upload"
        )
    if status in (401, 403):
        return EvidenceSyncAuthenticationError(
            f"evidence sync failed: authentication was rejected (HTTP {status}); "
            f"check the {TOKEN_ENV} credential",
            status_code=status,
            error_code=error_code,
        )
    if status == 409:
        if error_code == "chain_head_mismatch":
            expected = _expected_head(exc)
            raise _ChainHeadMismatch(expected)
        reason = error_code or "conflict"
        return EvidenceSyncConflictError(
            f"evidence sync failed: the endpoint reported {reason}",
            error_code=error_code,
        )
    if status == 429 or status >= 500:
        return EvidenceSyncServerError(
            f"evidence sync failed: the endpoint is unavailable (HTTP {status}); "
            "re-running the command later is safe (content-keyed)",
            status_code=status,
            error_code=error_code,
        )
    reason = f"the endpoint rejected the request (HTTP {status}"
    if error_code:
        reason += f", {error_code}"
    reason += ")"
    return EvidenceSyncValidationError(
        "evidence sync failed: " + reason,
        status_code=status,
        error_code=error_code,
    )


def _parse_error_body(exc: urllib.error.HTTPError) -> tuple[str | None, str | None]:
    body = _read_error_json(exc)
    error_code = body.get("error") if body else None
    detail = body.get("detail") if body else None
    if not isinstance(error_code, str):
        error_code = None
    if not isinstance(detail, str):
        detail = None
    elif len(detail) > _MAX_ERROR_DETAIL_CHARS:
        detail = detail[:_MAX_ERROR_DETAIL_CHARS] + "…"
    return error_code, detail


def _expected_head(exc: urllib.error.HTTPError) -> str | None:
    body = _read_error_json(exc)
    expected = body.get("expected_head") if body else None
    return expected if isinstance(expected, str) else None


def _read_error_json(exc: urllib.error.HTTPError) -> dict[str, Any] | None:
    cached = getattr(exc, "_igris_body", None)
    if cached is not None:
        return cached
    try:
        decoded = json.loads(exc.read().decode("utf-8"))
    except (ValueError, OSError):
        decoded = None
    if not isinstance(decoded, dict):
        decoded = None
    exc._igris_body = decoded  # read() is one-shot; cache for both parsers
    return decoded


def _scrubbed_reason(exc: urllib.error.URLError) -> str:
    reason = getattr(exc, "reason", None)
    if isinstance(reason, BaseException):
        return type(reason).__name__
    return type(exc).__name__


def sync_journal(
    journal_path: Path | None = None,
    *,
    public_key_path: Path | None = None,
    client: HttpEvidenceSyncClient | None = None,
    allow_unredacted: bool = False,
) -> EvidenceSyncReport:
    """Explicitly verify the selected journal locally, then upload it.

    Raises a typed :class:`~igris.errors.EvidenceSyncError` subclass on any
    failure. Never executes a guarded action, never rewrites the journal,
    and performs zero network activity until local verification passes.
    """
    journal = journal_path or default_journal_path()
    key_path = public_key_path or igris_home() / PUBLIC_KEY_FILENAME

    if not journal.exists():
        raise EvidenceSyncValidationError(
            "evidence sync cannot run: journal not found. Nothing was uploaded."
        )
    try:
        public_key = load_public_key(key_path)
        public_key_pem = key_path.read_text(encoding="utf-8")
    except (IdentityError, OSError) as exc:
        raise EvidenceSyncValidationError(
            "evidence sync cannot run: the public verification key is unavailable or invalid "
            f"({type(exc).__name__}). Nothing was uploaded."
        ) from None
    key_id = key_id_for(public_key)

    # Local verification with the same primitives `igris verify` uses.
    snapshot = load_journal_snapshot(journal, public_key)
    result = snapshot.verification
    if not result.valid:
        summary = "; ".join(
            f"line {issue.line_number}: {issue.code}"
            for issue in result.issues[:_MAX_REPORTED_ISSUES]
        )
        if len(result.issues) > _MAX_REPORTED_ISSUES:
            summary += f"; +{len(result.issues) - _MAX_REPORTED_ISSUES} more"
        raise EvidenceSyncValidationError(
            f"evidence sync refused: the journal failed LOCAL verification ({summary}). "
            "Nothing was uploaded. The journal was not modified — run `igris verify` "
            "for details."
        )

    events = list(snapshot.events)
    if not events:
        return EvidenceSyncReport(
            key_id=key_id, events_total=0, events_uploaded=0, batches=(), up_to_date=True
        )

    privacy = inspect_verified_snapshot(snapshot)
    if not privacy.safe_for_upload and not allow_unredacted:
        flagged = privacy.classifications.partially_redacted
        unknown = privacy.classifications.unknown
        raise EvidencePrivacyPreflightError(
            "evidence sync refused by local privacy preflight: "
            f"{flagged} invocation(s) retain ordinary argument values and "
            f"{unknown} invocation(s) have unknown classification. Nothing was uploaded. "
            "Redact every business argument, inspect with `igris evidence inspect`, or "
            "acknowledge this upload only with `--allow-unredacted`."
        )

    config = load_evidence_sync_config() if client is None else None
    active_client = client or HttpEvidenceSyncClient(config)

    remaining = events
    resynced = False
    batches: list[EvidenceBatchResult] = []
    uploaded = 0

    while remaining:
        chunk = _next_chunk(remaining)
        first_prev = chunk[0].get("previous_event_hash")
        try:
            response = active_client.submit_batch(key_id, public_key_pem, first_prev, chunk)
        except _ChainHeadMismatch as mismatch:
            if batches or resynced:
                # A continuation batch cannot mismatch unless the server's
                # stream moved underneath us (a concurrent writer) — resync
                # exactly once at the start, never loop.
                raise EvidenceSyncConflictError(
                    "evidence sync failed: the server's evidence stream changed during "
                    "the upload (chain_head_mismatch on a continuation batch). "
                    "Re-run the command to resync.",
                    error_code="chain_head_mismatch",
                ) from None
            remaining = _resume_after_head(events, mismatch.expected_head, key_id)
            resynced = True
            if not remaining:
                return EvidenceSyncReport(
                    key_id=key_id,
                    events_total=len(events),
                    events_uploaded=0,
                    batches=(),
                    up_to_date=True,
                )
            continue

        state = str(response.get("evidence_state", ""))
        if state == "rejected":
            code = response.get("verification_error_code")
            raise EvidenceSyncValidationError(
                "evidence sync failed: the endpoint rejected the batch after "
                f"server-side verification ({code}). The journal passed local "
                "verification, so this indicates tampering in transit or a "
                "server-side verifier divergence — nothing further was uploaded.",
                error_code=str(code) if isinstance(code, str) else None,
            )
        batches.append(
            EvidenceBatchResult(
                batch_id=str(response.get("batch_id", "")),
                evidence_state=state,
                events_verified=int(response.get("events_verified", 0) or 0),
                created=bool(response.get("created", False)),
                chain_head=(
                    response["chain_head"] if isinstance(response.get("chain_head"), str) else None
                ),
            )
        )
        uploaded += len(chunk)
        remaining = remaining[len(chunk) :]

    return EvidenceSyncReport(
        key_id=key_id,
        events_total=len(events),
        events_uploaded=uploaded,
        batches=tuple(batches),
        up_to_date=uploaded == 0,
    )


def _next_chunk(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The next contiguous slice within the event-count and byte budgets."""
    chunk: list[dict[str, Any]] = []
    budget = MAX_BATCH_PAYLOAD_BYTES
    for event in events:
        size = len(canonical_json_bytes(event)) + 1
        if chunk and (len(chunk) >= MAX_EVENTS_PER_BATCH or size > budget):
            break
        chunk.append(event)
        budget -= size
    return chunk


def _resume_after_head(
    events: list[dict[str, Any]],
    expected_head: str | None,
    key_id: str,
) -> list[dict[str, Any]]:
    """Locate the server's stored head in this journal; the tail after it is
    what still needs uploading. An unknown head means the stream diverged."""
    if expected_head is None:
        raise EvidenceSyncConflictError(
            "evidence sync failed: the endpoint reported a chain mismatch without a "
            "stored head; re-run the command to resync.",
            error_code="chain_head_mismatch",
        )
    for index, event in enumerate(events):
        if event.get("event_hash") == expected_head:
            return events[index + 1 :]
    raise EvidenceSyncConflictError(
        "evidence sync failed: the server already holds evidence for key "
        f"{key_id} whose chain head is not present in this journal. The local "
        "and central evidence streams have diverged (was another journal synced "
        "with this signing identity?). Nothing was uploaded.",
        error_code="chain_head_mismatch",
    )


def get_batch_status(
    batch_id: str,
    *,
    client: HttpEvidenceSyncClient | None = None,
) -> dict[str, Any]:
    """Fetch the tenant-scoped status of a previously submitted batch."""
    active_client = client or HttpEvidenceSyncClient(load_evidence_sync_config())
    return active_client.get_batch(batch_id)
