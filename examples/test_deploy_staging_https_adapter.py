#!/usr/bin/env python3
"""Unit tests for the disposable deploy.staging HTTPS adapter (HTTP dogfood)."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib import error, request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "examples"))

from deploy_staging_https_adapter import (  # noqa: E402
    AUTH_HEADER,
    DurableLedger,
    DeploymentStore,
    build_handler,
)


class DeployStagingAdapterTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        root = Path(self._tmpdir.name)
        self.token = "test-token"
        os.environ["IGRIS_DEPLOY_STAGING_ADAPTER_TOKEN"] = self.token
        self.ledger = DurableLedger(root / "ledger.json")
        self.store = DeploymentStore(root / "deployments.json")
        handler = build_handler(self.ledger, self.store, self.token)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.port = self.server.server_address[1]
        self._thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self._thread.start()

    def tearDown(self) -> None:
        self.server.shutdown()
        self._tmpdir.cleanup()

    def _post(self, payload: dict, key: str, extra_headers: dict | None = None) -> tuple[int, dict]:
        body = json.dumps(payload).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            AUTH_HEADER: self.token,
            "Idempotency-Key": key,
        }
        if extra_headers:
            headers.update(extra_headers)
        req = request.Request(
            f"http://127.0.0.1:{self.port}/v1/deploy/staging",
            data=body,
            headers=headers,
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=5) as resp:
                return resp.status, json.loads(resp.read().decode("utf-8"))
        except error.HTTPError as exc:
            return exc.code, json.loads(exc.read().decode("utf-8"))

    def test_normal_deploy_and_lookup(self) -> None:
        status, payload = self._post(
            {"service": "api", "environment": "staging", "image_tag": "sha-abc"},
            key="k1",
        )
        self.assertEqual(status, 200)
        dep_id = payload["result"]["deployment_id"]
        self.assertEqual(self.store.count(), 1)
        status2, payload2 = self._post(
            {"service": "api", "environment": "staging", "image_tag": "sha-abc"},
            key="k1",
        )
        self.assertEqual(status2, 200)
        self.assertTrue(payload2["idempotency_replayed"])
        self.assertEqual(self.store.count(), 1)
        req = request.Request(
            f"http://127.0.0.1:{self.port}/v1/deploy/staging/{dep_id}",
            headers={AUTH_HEADER: self.token},
        )
        with request.urlopen(req, timeout=5) as resp:
            row = json.loads(resp.read().decode("utf-8"))
        self.assertEqual(row["deployment_id"], dep_id)

    def test_conflicting_payload(self) -> None:
        self._post(
            {"service": "api", "environment": "staging", "image_tag": "sha-a"},
            key="k2",
        )
        status, payload = self._post(
            {"service": "api", "environment": "staging", "image_tag": "sha-b"},
            key="k2",
        )
        self.assertEqual(status, 409)
        self.assertEqual(payload["error"], "idempotency_conflict")
        self.assertEqual(self.store.count(), 1)

    def test_pre_effect_failure_allows_retry(self) -> None:
        status, _ = self._post(
            {"service": "api", "environment": "staging", "image_tag": "sha-c"},
            key="k3",
            extra_headers={"X-Igris-Fail-Before-Effect": "1"},
        )
        self.assertEqual(status, 500)
        self.assertEqual(self.store.count(), 0)
        status2, payload2 = self._post(
            {"service": "api", "environment": "staging", "image_tag": "sha-c"},
            key="k3",
        )
        self.assertEqual(status2, 200)
        self.assertEqual(self.store.count(), 1)
        self.assertIn("deployment_id", payload2["result"])

    def test_post_effect_uncertain_refuses_replay(self) -> None:
        status, payload = self._post(
            {"service": "api", "environment": "staging", "image_tag": "sha-d"},
            key="k4",
            extra_headers={"X-Igris-Fail-After-Effect": "1"},
        )
        self.assertEqual(status, 409)
        self.assertEqual(payload["error"], "idempotency_unresolved")
        self.assertTrue(payload["reconciliation_required"])
        self.assertEqual(self.store.count(), 1)
        status2, payload2 = self._post(
            {"service": "api", "environment": "staging", "image_tag": "sha-d"},
            key="k4",
        )
        self.assertEqual(status2, 409)
        self.assertEqual(payload2["error"], "idempotency_unresolved")
        self.assertEqual(self.store.count(), 1)


if __name__ == "__main__":
    unittest.main()
