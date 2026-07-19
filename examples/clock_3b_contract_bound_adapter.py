#!/usr/bin/env python3
"""Authenticated Clock 3B HTTP adapter for one contract-bound Igris Action.

This is deliberately not a generic Python executor. It exposes one fixed
JSON endpoint and invokes one callable already wrapped with ``igris.wrap_tool``.
The durable idempotency ledger reserves a key before the consequential effect;
an interrupted in-progress request fails closed and is never re-executed.
"""

from __future__ import annotations

import argparse
import dataclasses
import hashlib
import json
import os
import tempfile
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import igris  # type: ignore[import-not-found]

ACTION_NAME = "clock3b.consequential_transfer"
AUTH_HEADER = "X-Igris-Adapter-Token"
MAX_BODY_BYTES = 16 * 1024
_EFFECT_PATH: Path | None = None


def consequential_transfer(account_id: str, amount_cents: int) -> dict[str, Any]:
    """Perform the one fixed proof effect and return a deterministic result."""
    if not account_id or len(account_id) > 128:
        raise ValueError("account_id must contain 1-128 characters")
    if isinstance(amount_cents, bool) or not isinstance(amount_cents, int):
        raise TypeError("amount_cents must be an integer")
    if amount_cents <= 0 or amount_cents > 1_000_000:
        raise ValueError("amount_cents must be between 1 and 1000000")
    if _EFFECT_PATH is None:
        raise RuntimeError("effect ledger is not configured")
    _EFFECT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _EFFECT_PATH.open("a", encoding="utf-8") as handle:
        handle.write(
            json.dumps(
                {"account_id": account_id, "amount_cents": amount_cents},
                sort_keys=True,
                separators=(",", ":"),
            )
            + "\n"
        )
        handle.flush()
        os.fsync(handle.fileno())
    return {
        "account_id": account_id,
        "amount_cents": amount_cents,
        "effect": "clock3b_transfer_recorded",
    }


class DurableLedger:
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
                if existing["request_hash"] != request_hash:
                    raise IdempotencyConflict("key already used with a different request")
                if existing["state"] != "completed":
                    raise IdempotencyInProgress("prior request is incomplete; refusing re-execution")
                return existing["result"], True

            ledger["records"][key] = {
                "request_hash": request_hash,
                "state": "in_progress",
            }
            ledger["endpoint_invocation_count"] += 1
            self._store(ledger)

            result = operation()
            ledger = self._load()
            ledger["effect_count"] += 1
            ledger["records"][key] = {
                "request_hash": request_hash,
                "state": "completed",
                "result": result,
            }
            self._store(ledger)
            return result, False

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return self._load()


class IdempotencyConflict(Exception):
    pass


class IdempotencyInProgress(Exception):
    pass


def strict_request(body: bytes) -> dict[str, Any]:
    decoded = json.loads(body)
    if not isinstance(decoded, dict):
        raise ValueError("request body must be an object")
    expected = {"account_id", "amount_cents"}
    unknown = set(decoded) - expected
    missing = expected - set(decoded)
    if unknown:
        raise ValueError("unknown fields: " + ", ".join(sorted(unknown)))
    if missing:
        raise ValueError("missing fields: " + ", ".join(sorted(missing)))
    if not isinstance(decoded["account_id"], str):
        raise ValueError("account_id must be a string")
    if isinstance(decoded["amount_cents"], bool) or not isinstance(decoded["amount_cents"], int):
        raise ValueError("amount_cents must be an integer")
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
        server_version = "IgrisClock3BAdapter/1"

        def do_POST(self) -> None:  # noqa: N802
            if self.path != "/v1/clock3b/consequential-transfer":
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
            except IdempotencyInProgress as exc:
                self._json(HTTPStatus.CONFLICT, {"error": "idempotency_in_progress", "detail": str(exc)})
                return
            except (json.JSONDecodeError, ValueError, TypeError) as exc:
                self._json(HTTPStatus.UNPROCESSABLE_ENTITY, {"error": "invalid_request", "detail": str(exc)})
                return
            self._json(HTTPStatus.OK, {"result": result, "idempotency_replayed": replayed})

        def log_message(self, format: str, *args: Any) -> None:
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
    global _EFFECT_PATH
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18099)
    parser.add_argument("--ledger", type=Path, required=True)
    parser.add_argument("--journal", type=Path, required=True)
    parser.add_argument("--print-contract", action="store_true")
    parser.add_argument("--print-ledger", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("IGRIS_CLOCK3B_ADAPTER_TOKEN", "")
    if not token:
        raise SystemExit("IGRIS_CLOCK3B_ADAPTER_TOKEN is required")
    if args.host not in {"127.0.0.1", "::1", "localhost"}:
        raise SystemExit("Clock 3B adapter must bind to loopback")
    _EFFECT_PATH = args.ledger.with_suffix(args.ledger.suffix + ".effects.jsonl")

    wrapped = igris.wrap_tool(
        consequential_transfer,
        action=ACTION_NAME,
        risk="high",
        approval="never",
        journal=args.journal,
        metadata={"adapter": "clock3b", "authorization_layer": "embedded"},
    )
    contract = getattr(wrapped, "__igris_contract__")
    if args.print_contract:
        print(json.dumps(dataclasses.asdict(contract), sort_keys=True, separators=(",", ":")))
        return 0
    ledger = DurableLedger(args.ledger)
    if args.print_ledger:
        print(json.dumps(ledger.snapshot(), sort_keys=True, separators=(",", ":")))
        return 0

    server = ThreadingHTTPServer((args.host, args.port), build_handler(wrapped, ledger, token))
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
