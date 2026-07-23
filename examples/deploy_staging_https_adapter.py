#!/usr/bin/env python3
"""Disposable HTTPS deploy.staging adapter for Igris external-target validation.

Controlled by the Igris team for pilot validation only. No production data.

Endpoints:
  POST /v1/deploy/staging     — consequential staging deploy (idempotent)
  GET  /v1/deploy/staging/{id} — independent lookup of a deployment
  GET  /v1/deploy/staging      — list deployment ids (operator inspection)

Failure injection (request headers):
  X-Igris-Fail-Before-Effect: 1  — fail before writing the deployment
  X-Igris-Fail-After-Effect: 1   — write deployment then return unresolved
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import ssl
import threading
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ACTION_NAME = "deploy.staging"
AUTH_HEADER = "X-Igris-Adapter-Token"
MAX_BODY_BYTES = 32 * 1024

STATE_IN_PROGRESS = "in_progress"
STATE_COMPLETED = "completed"
STATE_RECONCILIATION_REQUIRED = "reconciliation_required"


class IdempotencyConflict(Exception):
    pass


class IdempotencyUnresolved(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class DurableLedger:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.path.write_text("{}", encoding="utf-8")

    def _load(self) -> dict[str, Any]:
        return json.loads(self.path.read_text(encoding="utf-8") or "{}")

    def _save(self, data: dict[str, Any]) -> None:
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps(data, sort_keys=True, indent=2), encoding="utf-8")
        os.replace(tmp, self.path)

    def execute(self, key: str, digest: str, effect) -> tuple[dict[str, Any], bool]:
        with self._lock:
            data = self._load()
            existing = data.get(key)
            if existing is not None:
                if existing.get("request_digest") != digest:
                    raise IdempotencyConflict("idempotency key reused with different payload")
                state = existing.get("state")
                if state == STATE_COMPLETED:
                    return existing["result"], True
                if state in {STATE_IN_PROGRESS, STATE_RECONCILIATION_REQUIRED}:
                    raise IdempotencyUnresolved(
                        "prior attempt left an unresolved consequential effect; "
                        "automatic replay refused"
                    )
                raise IdempotencyUnresolved(f"unexpected ledger state {state!r}")

            data[key] = {
                "state": STATE_IN_PROGRESS,
                "request_digest": digest,
            }
            self._save(data)

        try:
            result = effect()
        except AfterEffectUncertain as exc:
            with self._lock:
                data = self._load()
                data[key] = {
                    "state": STATE_RECONCILIATION_REQUIRED,
                    "request_digest": digest,
                    "deployment_id": exc.deployment_id,
                }
                self._save(data)
            raise IdempotencyUnresolved(
                "consequential effect completion is unknown; automatic replay refused"
            ) from exc
        except Exception:
            with self._lock:
                data = self._load()
                # Pre-effect failure: drop reservation so recovery may retry.
                if data.get(key, {}).get("state") == STATE_IN_PROGRESS:
                    del data[key]
                    self._save(data)
            raise

        with self._lock:
            data = self._load()
            data[key] = {
                "state": STATE_COMPLETED,
                "request_digest": digest,
                "result": result,
            }
            self._save(data)
        return result, False


class AfterEffectUncertain(Exception):
    def __init__(self, deployment_id: str) -> None:
        super().__init__(deployment_id)
        self.deployment_id = deployment_id


class DeploymentStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.path.write_text("[]", encoding="utf-8")

    def _load(self) -> list[dict[str, Any]]:
        return json.loads(self.path.read_text(encoding="utf-8") or "[]")

    def _save(self, rows: list[dict[str, Any]]) -> None:
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps(rows, sort_keys=True, indent=2), encoding="utf-8")
        os.replace(tmp, self.path)

    def create(self, service: str, environment: str, image_tag: str) -> dict[str, Any]:
        row = {
            "deployment_id": f"dep_{uuid.uuid4().hex[:16]}",
            "service": service,
            "environment": environment,
            "image_tag": image_tag,
            "status": "deployed",
        }
        with self._lock:
            rows = self._load()
            rows.append(row)
            self._save(rows)
        return row

    def get(self, deployment_id: str) -> dict[str, Any] | None:
        with self._lock:
            for row in self._load():
                if row.get("deployment_id") == deployment_id:
                    return row
        return None

    def list_ids(self) -> list[str]:
        with self._lock:
            return [r["deployment_id"] for r in self._load()]

    def count(self) -> int:
        with self._lock:
            return len(self._load())


def request_digest(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def unresolved_effect_response(detail: str) -> dict[str, Any]:
    return {
        "error": "idempotency_unresolved",
        "status": "unknown_effect_state",
        "effect_status": "unknown_effect_state",
        "reconciliation_required": True,
        "detail": detail,
    }


def build_handler(ledger: DurableLedger, store: DeploymentStore, token: str):
    class Handler(BaseHTTPRequestHandler):
        server_version = "IgrisDeployStagingAdapter/1"

        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/v1/deploy/staging":
                if self.headers.get(AUTH_HEADER) != token:
                    self._json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
                    return
                self._json(
                    HTTPStatus.OK,
                    {"deployments": store.list_ids(), "count": store.count()},
                )
                return
            prefix = "/v1/deploy/staging/"
            if self.path.startswith(prefix):
                if self.headers.get(AUTH_HEADER) != token:
                    self._json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
                    return
                dep_id = self.path[len(prefix) :].strip("/")
                row = store.get(dep_id)
                if row is None:
                    self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
                    return
                self._json(HTTPStatus.OK, row)
                return
            self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})

        def do_POST(self) -> None:  # noqa: N802
            if self.path != "/v1/deploy/staging":
                self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
                return
            if self.headers.get(AUTH_HEADER) != token:
                self._json(HTTPStatus.UNAUTHORIZED, {"error": "unauthorized"})
                return
            key = self.headers.get("Idempotency-Key", "").strip()
            if not key or len(key) > 128:
                self._json(HTTPStatus.UNPROCESSABLE_ENTITY, {"error": "invalid_idempotency_key"})
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
                payload = json.loads(self.rfile.read(length).decode("utf-8"))
                if not isinstance(payload, dict):
                    raise ValueError("body must be a JSON object")
                service = payload.get("service")
                environment = payload.get("environment")
                image_tag = payload.get("image_tag")
                if not all(isinstance(v, str) and v for v in (service, environment, image_tag)):
                    raise ValueError("service, environment, and image_tag are required strings")
                if environment != "staging":
                    raise ValueError("environment must be staging")

                fail_before = self.headers.get("X-Igris-Fail-Before-Effect", "").strip() == "1"
                fail_after = self.headers.get("X-Igris-Fail-After-Effect", "").strip() == "1"

                def effect() -> dict[str, Any]:
                    if fail_before:
                        raise RuntimeError("injected pre-effect failure")
                    row = store.create(service, environment, image_tag)
                    if fail_after:
                        raise AfterEffectUncertain(row["deployment_id"])
                    return {
                        "deployment_id": row["deployment_id"],
                        "service": service,
                        "environment": environment,
                        "image_tag": image_tag,
                        "action": ACTION_NAME,
                    }

                result, replayed = ledger.execute(key, request_digest(payload), effect)
            except IdempotencyConflict as exc:
                self._json(HTTPStatus.CONFLICT, {"error": "idempotency_conflict", "detail": str(exc)})
                return
            except IdempotencyUnresolved as exc:
                self._json(HTTPStatus.CONFLICT, unresolved_effect_response(exc.detail))
                return
            except (json.JSONDecodeError, ValueError, TypeError) as exc:
                self._json(
                    HTTPStatus.UNPROCESSABLE_ENTITY,
                    {"error": "invalid_request", "detail": str(exc)},
                )
                return
            except RuntimeError as exc:
                self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "pre_effect_failure", "detail": str(exc)})
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18443)
    parser.add_argument("--ledger", type=Path, required=True)
    parser.add_argument("--deployments", type=Path, required=True)
    parser.add_argument("--tls-cert", type=Path, help="PEM certificate for HTTPS")
    parser.add_argument("--tls-key", type=Path, help="PEM private key for HTTPS")
    parser.add_argument(
        "--allow-non-loopback-bind",
        action="store_true",
        help="Permit binding outside loopback for a reverse-proxied pilot host",
    )
    args = parser.parse_args()

    token = os.environ.get("IGRIS_DEPLOY_STAGING_ADAPTER_TOKEN", "")
    if not token:
        raise SystemExit("IGRIS_DEPLOY_STAGING_ADAPTER_TOKEN is required")
    if args.host not in {"127.0.0.1", "::1", "localhost"} and not args.allow_non_loopback_bind:
        raise SystemExit("Refusing non-loopback bind without --allow-non-loopback-bind")
    if bool(args.tls_cert) ^ bool(args.tls_key):
        raise SystemExit("Provide both --tls-cert and --tls-key for HTTPS")

    ledger = DurableLedger(args.ledger)
    store = DeploymentStore(args.deployments)
    server = ThreadingHTTPServer((args.host, args.port), build_handler(ledger, store, token))
    scheme = "http"
    if args.tls_cert and args.tls_key:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(certfile=str(args.tls_cert), keyfile=str(args.tls_key))
        server.socket = ctx.wrap_socket(server.socket, server_side=True)
        scheme = "https"
    print(f"{scheme}://{args.host}:{args.port}/v1/deploy/staging", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
