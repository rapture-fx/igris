"""Connected mode: explicit, opt-in ActionContract synchronization.

Embedded Igris makes **zero network calls** — that is unchanged and enforced
by tests. Connected mode is enabled only when BOTH environment variables are
set::

    IGRIS_API_URL=https://your-igris-endpoint
    IGRIS_API_KEY=igris_...            # tenant-scoped API key

With Connected mode enabled, ``@igris.guard`` synchronizes the function's
:class:`~igris.contracts.ActionContract` to ``POST /v1/contracts/sync``
before the FIRST guarded execution of each contract version in this process
— before local approval and before the consequential function runs. The
declaration in code stays the registration; no console step is required.

What is sent: the ActionContract v1 fields only (action name, module,
qualified name, risk, approval mode, execution mode, parameter descriptors,
code fingerprint, contract hash) plus the SDK name/version. Function
arguments, decision/outcome events, journals, and signing keys are NEVER
sent, and synchronization uploads no evidence.

What is NOT granted: synchronization records a declaration centrally; it
grants no permission to execute anything, and the guarded function continues
to execute locally under unchanged Embedded semantics (local approval, local
signed evidence).

Failure semantics: while Connected mode is explicitly enabled, a
synchronization failure PREVENTS execution (typed, pre-execution errors —
see :mod:`igris.errors`). There is no silent fallback to Embedded-only
execution. Partial configuration fails the same way.

Idempotency: each sync derives a stable ``Idempotency-Key`` from the
operation, action name, and contract hash, so a retried sync of the same
contract replays instead of re-registering. The key derivation is
``"sdk-" + SHA-256("igris-contract-sync:v1:<action_name>:<contract_hash>")``
truncated to 48 hex chars.
"""

from __future__ import annotations

import dataclasses
import hashlib
import json
import threading
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Protocol

from .contracts import ActionContract
from .errors import (
    ConnectedConfigurationError,
    ContractSyncConflictError,
    ContractSyncError,
)

ENDPOINT_ENV = "IGRIS_API_URL"
TOKEN_ENV = "IGRIS_API_KEY"  # noqa: S105 — the env var NAME, not a credential value

DEFAULT_TIMEOUT_SECONDS = 10.0
_LOCAL_DEV_HOSTNAMES = frozenset({"localhost", "127.0.0.1", "::1"})
_MAX_ERROR_DETAIL_CHARS = 200

_SYNC_CACHE: set[tuple[str, str, str]] = set()
_SYNC_CACHE_LOCK = threading.Lock()


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """Refuse every redirect so credentials stay bound to the configured origin."""

    def redirect_request(self, req: Any, fp: Any, code: int, msg: str, headers: Any, newurl: str):
        return None


@dataclasses.dataclass(frozen=True)
class ConnectedConfig:
    """Explicit Connected configuration. The token never appears in repr."""

    endpoint: str
    token: str = dataclasses.field(repr=False)


def load_connected_config(environ: Any = None) -> ConnectedConfig | None:
    """Read explicit Connected configuration from the environment.

    Returns ``None`` when neither variable is set (pure Embedded mode — zero
    network activity). Raises :class:`ConnectedConfigurationError` for
    partial or invalid configuration: an explicitly half-configured Connected
    mode must fail clearly before execution, never silently degrade.
    """
    if environ is None:
        import os

        environ = os.environ
    endpoint = (environ.get(ENDPOINT_ENV) or "").strip()
    token = (environ.get(TOKEN_ENV) or "").strip()
    if not endpoint and not token:
        return None
    if not endpoint:
        raise ConnectedConfigurationError(
            f"Connected mode is partially configured: {TOKEN_ENV} is set but "
            f"{ENDPOINT_ENV} is not. Set both to enable Connected mode or unset "
            f"{TOKEN_ENV} for Embedded-only operation. "
            "The consequential function did not execute."
        )
    if not token:
        raise ConnectedConfigurationError(
            f"Connected mode is partially configured: {ENDPOINT_ENV} is set but "
            f"{TOKEN_ENV} is not. Set both to enable Connected mode or unset "
            f"{ENDPOINT_ENV} for Embedded-only operation. "
            "The consequential function did not execute."
        )

    parsed = urllib.parse.urlsplit(endpoint)
    if parsed.scheme == "http":
        if parsed.hostname not in _LOCAL_DEV_HOSTNAMES:
            raise ConnectedConfigurationError(
                f"{ENDPOINT_ENV} must use https (http is permitted only for "
                "local development endpoints: localhost, 127.0.0.1, ::1). "
                "The consequential function did not execute."
            )
    elif parsed.scheme != "https":
        raise ConnectedConfigurationError(
            f"{ENDPOINT_ENV} must be an https URL. The consequential function did not execute."
        )
    if not parsed.hostname:
        raise ConnectedConfigurationError(
            f"{ENDPOINT_ENV} has no host. The consequential function did not execute."
        )
    return ConnectedConfig(endpoint=endpoint.rstrip("/"), token=token)


@dataclasses.dataclass(frozen=True)
class ContractSyncResult:
    """Outcome of a successful synchronization."""

    action_name: str
    contract_hash: str
    created: bool


class ContractSyncClient(Protocol):
    """Small injectable interface for contract synchronization.

    ``cache_scope`` identifies the sync destination so the in-process
    success cache never conflates different endpoints.
    """

    cache_scope: str

    def sync_contract(self, contract: ActionContract) -> ContractSyncResult: ...


def contract_wire_payload(contract: ActionContract) -> dict[str, Any]:
    """The exact ActionContract v1 object as the SDK emits it — nothing else."""
    return {
        "schema_version": contract.schema_version,
        "action_name": contract.action_name,
        "module": contract.module,
        "qualified_name": contract.qualified_name,
        "risk": contract.risk,
        "approval_mode": contract.approval_mode,
        "execution_mode": contract.execution_mode,
        "parameter_descriptors": [
            dataclasses.asdict(descriptor) for descriptor in contract.parameter_descriptors
        ],
        "code_fingerprint": contract.code_fingerprint,
        "contract_hash": contract.contract_hash,
    }


def derive_idempotency_key(contract: ActionContract) -> str:
    """Stable, documented Idempotency-Key for one contract synchronization.

    Content-derived, so every retry of the same contract sync reuses the same
    key and replays instead of re-registering.
    """
    material = f"igris-contract-sync:v1:{contract.action_name}:{contract.contract_hash}"
    return "sdk-" + hashlib.sha256(material.encode("utf-8")).hexdigest()[:48]


class HttpContractSyncClient:
    """Standard-library HTTP client for ``POST /v1/contracts/sync``.

    Bounded timeout, https-by-default (enforced at configuration time), and
    strictly bounded error surfaces: credentials never appear in exceptions.
    ``opener`` is an injectable ``callable(request, timeout) -> response``
    used by tests. The default opener explicitly refuses every redirect;
    urllib's process-global opener is never used because it follows redirects.
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
        self._opener = opener or urllib.request.build_opener(_NoRedirectHandler()).open
        self.cache_scope = config.endpoint

    def sync_contract(self, contract: ActionContract) -> ContractSyncResult:
        payload = {
            "contract": contract_wire_payload(contract),
            "client": {"sdk": "igris-python", "sdk_version": _sdk_version()},
        }
        body = json.dumps(payload).encode("utf-8")
        # S310: the scheme is restricted to https (or explicit local-dev
        # http) by load_connected_config before a client can exist.
        request = urllib.request.Request(  # noqa: S310
            self._config.endpoint + "/v1/contracts/sync",
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer " + self._config.token,
                "Idempotency-Key": derive_idempotency_key(contract),
            },
        )
        action = contract.action_name
        try:
            response = self._opener(request, timeout=self._timeout)
        except urllib.error.HTTPError as exc:
            raise self._error_for_status(action, exc) from None
        except TimeoutError as exc:
            raise ContractSyncError(
                _sync_failed(action, "the request timed out"),
                retry_safe=True,
            ) from exc
        except urllib.error.URLError as exc:
            raise ContractSyncError(
                _sync_failed(action, f"transport failure ({_scrubbed_reason(exc)})"),
                retry_safe=True,
            ) from None
        except OSError as exc:
            raise ContractSyncError(
                _sync_failed(action, f"transport failure ({type(exc).__name__})"),
                retry_safe=True,
            ) from None

        status = getattr(response, "status", None) or response.getcode()
        raw = response.read()
        if 300 <= status < 400:
            raise self._redirect_error(action, status)
        if status not in (200, 201):
            raise ContractSyncError(
                _sync_failed(action, f"unexpected response status {status}"),
                status_code=status,
                retry_safe=None,
            )
        try:
            decoded = json.loads(raw.decode("utf-8"))
            version = decoded["version"]
            return ContractSyncResult(
                action_name=action,
                contract_hash=str(version["contract_hash"]),
                created=bool(version.get("created", False)),
            )
        except (ValueError, KeyError, TypeError) as exc:
            raise ContractSyncError(
                _sync_failed(action, "the endpoint returned an unreadable response"),
                status_code=status,
                retry_safe=True,
            ) from exc

    def _error_for_status(self, action: str, exc: urllib.error.HTTPError) -> ContractSyncError:
        status = exc.code
        if 300 <= status < 400:
            return self._redirect_error(action, status)
        error_code, detail = _parse_error_body(exc)
        if status == 409 and error_code == "idempotency_key_conflict":
            return ContractSyncConflictError(
                _sync_failed(
                    action,
                    "the Idempotency-Key was already used with a different contract "
                    "fingerprint (idempotency_key_conflict)",
                )
            )
        if status in (401, 403):
            return ContractSyncError(
                _sync_failed(
                    action,
                    f"authentication was rejected (HTTP {status}); check the "
                    f"{TOKEN_ENV} credential",
                ),
                status_code=status,
                error_code=error_code,
                retry_safe=False,
            )
        retry_safe: bool | None
        if status == 429 or status >= 500:
            retry_safe = True
        elif status in (400, 404, 405, 409, 413, 422):
            retry_safe = False
        else:
            retry_safe = None
        reason = f"the endpoint rejected the contract (HTTP {status}"
        if error_code:
            reason += f", {error_code}"
        if detail:
            reason += f": {detail}"
        reason += ")"
        return ContractSyncError(
            _sync_failed(action, reason),
            status_code=status,
            error_code=error_code,
            retry_safe=retry_safe,
        )

    def _redirect_error(self, action: str, status: int) -> ContractSyncError:
        return ContractSyncError(
            _sync_failed(
                action,
                f"the endpoint returned HTTP {status}; redirects are refused so the "
                "Authorization credential cannot cross origins or downgrade transport",
            ),
            status_code=status,
            error_code="redirect_refused",
            retry_safe=False,
        )


def ensure_contract_synced(contract: ActionContract, client: ContractSyncClient) -> None:
    """Synchronize once per (destination, action, contract hash) per process.

    The cache records successful synchronization only — a failure is never
    cached and the next call retries. The cache is an optimization, not
    durable registration truth: the endpoint remains the authority and
    re-synchronization is idempotent by content.
    """
    key = (client.cache_scope, contract.action_name, contract.contract_hash)
    with _SYNC_CACHE_LOCK:
        if key in _SYNC_CACHE:
            return
    client.sync_contract(contract)
    with _SYNC_CACHE_LOCK:
        _SYNC_CACHE.add(key)


def resolve_connected_client() -> ContractSyncClient | None:
    """The guard's Connected entry point.

    ``None`` (no configuration) means pure Embedded behavior with zero
    network activity. Partial configuration raises before execution.
    """
    config = load_connected_config()
    if config is None:
        return None
    return HttpContractSyncClient(config)


def _sdk_version() -> str:
    from . import __version__

    return __version__


def _sync_failed(action: str, reason: str) -> str:
    return (
        f"contract synchronization failed for action {action!r}: {reason}. "
        "Connected mode is explicitly enabled, so the consequential function "
        "did NOT execute (execution_occurred=False); there is no silent "
        "fallback to Embedded-only execution."
    )


def _parse_error_body(exc: urllib.error.HTTPError) -> tuple[str | None, str | None]:
    try:
        decoded = json.loads(exc.read().decode("utf-8"))
    except (ValueError, OSError):
        return None, None
    error_code = decoded.get("error") if isinstance(decoded, dict) else None
    detail = decoded.get("detail") if isinstance(decoded, dict) else None
    if not isinstance(error_code, str):
        error_code = None
    if not isinstance(detail, str):
        detail = None
    elif len(detail) > _MAX_ERROR_DETAIL_CHARS:
        detail = detail[:_MAX_ERROR_DETAIL_CHARS] + "…"
    return error_code, detail


def _scrubbed_reason(exc: urllib.error.URLError) -> str:
    reason = getattr(exc, "reason", None)
    if isinstance(reason, BaseException):
        return type(reason).__name__
    if reason is None:
        return type(exc).__name__
    return str(reason)[:_MAX_ERROR_DETAIL_CHARS]
