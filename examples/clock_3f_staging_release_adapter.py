#!/usr/bin/env python3
"""Disposable staging-release adapter for Clock 3F product validation.

Action: ``deploy.staging_release``

Intent: deploy one exact commit to a disposable staging target. The adapter:

* accepts only ``service``, ``environment``, ``commit_sha``
* requires a business idempotency key
* supports deterministic idempotent replay
* exposes a verifiable external ``deployment_id``
* refuses arbitrary shell / free-form commands
* restricts environment to ``disposable-staging``
* supports controlled failure injection for recovery and uncertain-effect tests
* never persists sensitive response bodies beyond bounded identifiers
"""

from __future__ import annotations

import argparse
import dataclasses
import hashlib
import json
import os
import tempfile
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import igris  # type: ignore[import-not-found]

ACTION_NAME = "deploy.staging_release"
AUTH_HEADER = "X-Igris-Adapter-Token"
MAX_BODY_BYTES = 16 * 1024
ALLOWED_ENVIRONMENT = "disposable-staging"
ALLOWED_SERVICES = frozenset({"demo-api", "demo-web", "clock3f-probe"})

STATE_IN_PROGRESS = "in_progress"
STATE_COMPLETED = "completed"
STATE_RECONCILIATION_REQUIRED = "reconciliation_required"
STATE_UNKNOWN_EFFECT = "unknown_effect_state"
UNRESOLVED_EFFECT_STATUS = "unknown_effect_state"

_EFFECT_PATH: Path | None = None
_INJECT_MODE: str = "none"
_HOLD_PATH: Path | None = None


def staging_release(service: str, environment: str, commit_sha: str) -> dict[str, Any]:
    """Perform the one fixed staging deploy effect and return a bounded result."""
    if service not in ALLOWED_SERVICES:
        raise ValueError(f"service must be one of {sorted(ALLOWED_SERVICES)}")
    if environment != ALLOWED_ENVIRONMENT:
        raise ValueError(f"environment must be {ALLOWED_ENVIRONMENT!r}")
    if not isinstance(commit_sha, str) or len(commit_sha) != 40:
        raise ValueError("commit_sha must be a 40-character hex digest")
    if any(ch not in "0123456789abcdef" for ch in commit_sha.lower()):
        raise ValueError("commit_sha must be lowercase/uppercase hex")
    if _EFFECT_PATH is None:
        raise RuntimeError("effect ledger is not configured")

    if _INJECT_MODE == "hold_before_effect" and _HOLD_PATH is not None:
        _HOLD_PATH.write_text("holding\n", encoding="utf-8")
        deadline = time.time() + 120
        while time.time() < deadline:
            if not _HOLD_PATH.exists():
                break
            time.sleep(0.05)
        else:
            raise TimeoutError("hold_before_effect timed out")

    deployment_id = f"dep_{hashlib.sha256(f'{service}:{environment}:{commit_sha}'.encode()).hexdigest()[:24]}"
    effect = {
        "service": service,
        "environment": environment,
        "commit_sha": commit_sha.lower(),
        "deployment_id": deployment_id,
        "effect": "staging_release_recorded",
    }
    _EFFECT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _EFFECT_PATH.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(effect, sort_keys=True, separators=(",", ":")) + "\n")
        handle.flush()
        os.fsync(handle.fileno())

    if _INJECT_MODE == "fail_after_effect":
        # Effect is durable; response path is intentionally uncertain.
        raise ConsequentialEffectUncertain(
            "staging deploy recorded but acknowledgment path failed"
        )

    return effect


class DurableLedger:
    """File-backed idempotency ledger with fail-closed orphan semantics."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.Lock()

    def _load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"records": {}, "effect_count": 0, "endpoint_invocation_count": 0}
        loaded = json.loads(self.path.read_text(encoding="utf-8"))
        if not isinstance(loaded, dict) or not isinstance(loaded.get("records"), dict):
            raise RuntimeError("invalid adapter ledger")
        return loaded

    def _store(self, ledger: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_name = tempfile.mkstemp(prefix=self.path.name + ".", dir=self.path.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(ledger, handle, sort_keys=True, separators=(",", ":"))
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(tmp_name, self.path)
        finally:
            if os.path.exists(tmp_name):
                os.unlink(tmp_name)

    def _refuse_unresolved(self, existing: dict[str, Any], request_hash: str) -> None:
        if existing.get("request_hash") != request_hash:
            raise IdempotencyConflict("key already used with a different request")
        raise IdempotencyUnresolved(
            status=UNRESOLVED_EFFECT_STATUS,
            detail=(
                "prior request has unresolved effect state "
                f"(ledger_state={existing.get('state')}); "
                "refusing re-execution — reconciliation required"
            ),
        )

    def execute(
        self,
        key: str,
        request_hash: str,
        operation: Any,
    ) -> tuple[dict[str, Any], bool]:
        with self._lock:
            ledger = self._load()
            existing = ledger["records"].get(key)
            if existing is not None:
                state = existing.get("state")
                if existing.get("request_hash") != request_hash:
                    raise IdempotencyConflict("key already used with a different request")
                if state == STATE_COMPLETED:
                    return existing["result"], True
                self._refuse_unresolved(existing, request_hash)

            ledger["records"][key] = {
                "request_hash": request_hash,
                "state": STATE_IN_PROGRESS,
            }
            ledger["endpoint_invocation_count"] += 1
            self._store(ledger)

            try:
                result = operation()
            except Exception as exc:
                ledger = self._load()
                ledger["records"][key] = {
                    "request_hash": request_hash,
                    "state": STATE_RECONCILIATION_REQUIRED,
                    "effect_status": STATE_UNKNOWN_EFFECT,
                }
                self._store(ledger)
                raise ConsequentialEffectUncertain(str(exc)) from exc

            ledger = self._load()
            ledger["effect_count"] += 1
            ledger["records"][key] = {
                "request_hash": request_hash,
                "state": STATE_COMPLETED,
                "result": result,
            }
            self._store(ledger)
            return result, False

    def mark_orphan_for_test(self, key: str, request_hash: str) -> None:
        with self._lock:
            ledger = self._load()
            ledger["records"][key] = {
                "request_hash": request_hash,
                "state": STATE_IN_PROGRESS,
            }
            ledger["endpoint_invocation_count"] = ledger.get("endpoint_invocation_count", 0) + 1
            self._store(ledger)

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return self._load()

    def effect_count_from_journal(self) -> int:
        if _EFFECT_PATH is None or not _EFFECT_PATH.exists():
            return 0
        return sum(1 for _ in _EFFECT_PATH.open(encoding="utf-8"))


class IdempotencyConflict(Exception):
    pass


class IdempotencyUnresolved(Exception):
    def __init__(self, status: str, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.detail = detail


class ConsequentialEffectUncertain(RuntimeError):
    """Deploy may have occurred; completion is unknowable."""


def unresolved_effect_response(detail: str) -> dict[str, Any]:
    return {
        "error": "idempotency_unresolved",
        "status": UNRESOLVED_EFFECT_STATUS,
        "effect_status": UNRESOLVED_EFFECT_STATUS,
        "reconciliation_required": True,
        "detail": detail,
    }


def strict_request(body: bytes) -> dict[str, Any]:
    decoded = json.loads(body)
    if not isinstance(decoded, dict):
        raise ValueError("request body must be an object")
    expected = {"service", "environment", "commit_sha"}
    unknown = set(decoded) - expected
    missing = expected - set(decoded)
    if unknown:
        raise ValueError("unknown fields: " + ", ".join(sorted(unknown)))
    if missing:
        raise ValueError("missing fields: " + ", ".join(sorted(missing)))
    if not isinstance(decoded["service"], str):
        raise ValueError("service must be a string")
    if not isinstance(decoded["environment"], str):
        raise ValueError("environment must be a string")
    if not isinstance(decoded["commit_sha"], str):
        raise ValueError("commit_sha must be a string")
    # Refuse shell-shaped payloads even if somehow smuggled into known fields.
    for key in ("service", "environment", "commit_sha"):
        value = decoded[key]
        if any(tok in value for tok in (";", "|", "`", "$(", "&&", "\n")):
            raise ValueError(f"{key} must not contain shell metacharacters")
    return decoded


def request_digest(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def build_handler(
    wrapped: Any,
    ledger: DurableLedger,
    token: str,
) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        server_version = "IgrisClock3FStagingAdapter/1"

        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/health":
                self._json(HTTPStatus.OK, {"ok": True, "action": ACTION_NAME})
                return
            if self.path == "/v1/deploy/staging-release/ledger":
                if self.headers.get(AUTH_HEADER) != token:
                    self._json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
                    return
                snap = ledger.snapshot()
                snap["effect_journal_count"] = ledger.effect_count_from_journal()
                self._json(HTTPStatus.OK, snap)
                return
            self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

        def do_POST(self) -> None:  # noqa: N802
            if self.path != "/v1/deploy/staging-release":
                self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
                return
            if self.headers.get(AUTH_HEADER) != token:
                self._json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
                return
            key = self.headers.get("Idempotency-Key", "").strip()
            if not key or len(key) > 128:
                self._json(
                    HTTPStatus.UNPROCESSABLE_ENTITY,
                    {"error": "invalid_idempotency_key"},
                )
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_content_length"})
                return
            if length < 1 or length > MAX_BODY_BYTES:
                self._json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "invalid_body_size"})
                return
            try:
                payload = strict_request(self.rfile.read(length))
                result, replayed = ledger.execute(
                    key,
                    request_digest(payload),
                    lambda: wrapped(**payload),
                )
            except IdempotencyConflict as exc:
                self._json(HTTPStatus.CONFLICT, {"error": "idempotency_conflict", "detail": str(exc)})
                return
            except IdempotencyUnresolved as exc:
                self._json(HTTPStatus.CONFLICT, unresolved_effect_response(exc.detail))
                return
            except ConsequentialEffectUncertain:
                self._json(
                    HTTPStatus.INTERNAL_SERVER_ERROR,
                    unresolved_effect_response(
                        "consequential effect completion is unknown; "
                        "automatic replay refused"
                    ),
                )
                return
            except (json.JSONDecodeError, ValueError, TypeError) as exc:
                self._json(
                    HTTPStatus.UNPROCESSABLE_ENTITY,
                    {"error": "invalid_request", "detail": str(exc)},
                )
                return
            # Bounded success body only — no raw secrets or large payloads.
            self._json(
                HTTPStatus.OK,
                {
                    "result": {
                        "deployment_id": result["deployment_id"],
                        "service": result["service"],
                        "environment": result["environment"],
                        "commit_sha": result["commit_sha"],
                        "effect": result["effect"],
                    },
                    "idempotency_replayed": replayed,
                },
            )

        def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
            return

        def _json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
            body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
            self.send_response(status.value)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    return Handler


def main() -> int:
    global _EFFECT_PATH, _INJECT_MODE, _HOLD_PATH
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18100)
    parser.add_argument("--ledger", type=Path, required=True)
    parser.add_argument("--journal", type=Path, required=True)
    parser.add_argument(
        "--inject",
        choices=("none", "hold_before_effect", "fail_after_effect"),
        default="none",
    )
    parser.add_argument("--hold-file", type=Path, default=None)
    parser.add_argument("--print-contract", action="store_true")
    parser.add_argument("--print-ledger", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("IGRIS_CLOCK3F_ADAPTER_TOKEN", "")
    if not token:
        raise SystemExit("IGRIS_CLOCK3F_ADAPTER_TOKEN is required")
    if args.host not in {"127.0.0.1", "::1", "localhost"}:
        raise SystemExit("Clock 3F adapter must bind to loopback")

    _INJECT_MODE = args.inject
    _HOLD_PATH = args.hold_file
    _EFFECT_PATH = args.ledger.with_suffix(args.ledger.suffix + ".effects.jsonl")

    wrapped = igris.wrap_tool(
        staging_release,
        action=ACTION_NAME,
        risk="critical",
        approval="never",
        journal=args.journal,
        metadata={
            "adapter": "clock3f",
            "authorization_layer": "embedded",
            "target_scope": ALLOWED_ENVIRONMENT,
        },
    )
    contract = getattr(wrapped, "__igris_contract__")
    if args.print_contract:
        print(json.dumps(dataclasses.asdict(contract), sort_keys=True, separators=(",", ":")))
        return 0
    ledger = DurableLedger(args.ledger)
    if args.print_ledger:
        snap = ledger.snapshot()
        snap["effect_journal_count"] = ledger.effect_count_from_journal()
        print(json.dumps(snap, sort_keys=True, separators=(",", ":")))
        return 0

    server = ThreadingHTTPServer((args.host, args.port), build_handler(wrapped, ledger, token))
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
