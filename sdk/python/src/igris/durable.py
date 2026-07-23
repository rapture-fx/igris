"""Managed Igris client: Action → Run → Proof (plus advanced setup).

Ordinary managed journey uses :class:`Igris`::

    igris = Igris.from_env()
    run = igris.run("deploy.staging", input={...}, idempotency_key="...")
    run.wait()
    run.proof()

:class:`IgrisDurableClient` remains the compatibility / advanced client that
talks to the managed REST API. :class:`Igris` is a thin facade over it — not a
second durable state machine.

Embedded ``igris.wrap_tool`` / ``@igris.guard`` stay local by default and are
never remoted by environment variables alone. Exact contract-hash bindings and
caller-supplied business idempotency keys remain mandatory underneath.
"""

from __future__ import annotations

import dataclasses
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Mapping
from typing import Any

from .connected import (
    DEFAULT_TIMEOUT_SECONDS,
    ENDPOINT_ENV,
    TOKEN_ENV,
    ConnectedConfig,
    ContractSyncResult,
    HttpContractSyncClient,
    _NoRedirectHandler,
    contract_wire_payload,
    load_connected_config,
)
from .contracts import ActionContract
from .errors import (
    ActionNotRegistered,
    AuthenticationError,
    AuthorizationDenied,
    BindingConflictError,
    ContractMismatchError,
    ContractSyncError,
    DurableConfigurationError,
    DurableError,
    DurableTimeoutError,
    DurableTransportError,
    EvidenceNotLinkableError,
    IdempotencyConflictError,
    ProofUnavailableError,
    ReconciliationRequiredError,
    RunNotFoundError,
    UnboundActionError,
)

_CONTRACT_HASH_RE = re.compile(r"^[a-f0-9]{64}$")
_MAX_ERROR_DETAIL_CHARS = 200
_TERMINAL_RUN_STATUSES = frozenset(
    {
        "completed",
        "failed",
        "rejected",
        "cancelled",
        "canceled",
        "reconciliation_required",
        "unknown_effect_state",
    }
)
_RECONCILIATION_STATUSES = frozenset({"reconciliation_required", "unknown_effect_state"})


# ---------------------------------------------------------------------------
# Typed models
# ---------------------------------------------------------------------------


@dataclasses.dataclass(frozen=True)
class ContractBinding:
    """Immutable exact contract → target Action binding."""

    id: str
    action_name: str
    contract_hash: str
    target_action_id: str
    target_version_hash: str
    input_mapping: dict[str, str]
    endpoint_config_ref: str | None
    timeout_ms: int
    replay_class: str | None
    idempotency_required: bool
    created_at: str | None
    immutable: bool = True

    @classmethod
    def from_response(cls, data: Mapping[str, Any]) -> ContractBinding:
        mapping = data.get("input_mapping") or {}
        if isinstance(mapping, str):
            mapping = json.loads(mapping)
        if not isinstance(mapping, dict):
            mapping = {}
        return cls(
            id=str(data["id"]),
            action_name=str(data["action_name"]),
            contract_hash=str(data["contract_hash"]),
            target_action_id=str(data["target_action_id"]),
            target_version_hash=str(data.get("target_version_hash") or ""),
            input_mapping={str(k): str(v) for k, v in mapping.items()},
            endpoint_config_ref=(
                str(data["endpoint_config_ref"]) if data.get("endpoint_config_ref") else None
            ),
            timeout_ms=int(data.get("timeout_ms") or 0),
            replay_class=str(data["replay_class"]) if data.get("replay_class") else None,
            idempotency_required=bool(data.get("idempotency_required", True)),
            created_at=str(data["created_at"]) if data.get("created_at") else None,
            immutable=bool(data.get("immutable", True)),
        )


@dataclasses.dataclass(frozen=True)
class ActionTarget:
    """Executable Action definition (webhook/target identity), not a Python upload."""

    id: str
    name: str
    display_name: str | None
    description: str | None
    target_type: str
    target_url: str
    method: str
    policy_preset: str | None
    replay_class: str | None
    approval_required: bool
    irreversible: bool
    target_metadata: dict[str, Any]
    created_at: str | None = None
    updated_at: str | None = None

    @classmethod
    def from_response(cls, data: Mapping[str, Any]) -> ActionTarget:
        metadata = data.get("target_metadata") or {}
        if not isinstance(metadata, dict):
            metadata = {}
        return cls(
            id=str(data["id"]),
            name=str(data["name"]),
            display_name=str(data["display_name"]) if data.get("display_name") else None,
            description=str(data["description"]) if data.get("description") else None,
            target_type=str(data.get("target_type") or ""),
            target_url=str(data.get("target_url") or ""),
            method=str(data.get("method") or "POST"),
            policy_preset=str(data["policy_preset"]) if data.get("policy_preset") else None,
            replay_class=str(data["replay_class"]) if data.get("replay_class") else None,
            approval_required=bool(data.get("approval_required", False)),
            irreversible=bool(data.get("irreversible", False)),
            target_metadata=dict(metadata),
            created_at=str(data["created_at"]) if data.get("created_at") else None,
            updated_at=str(data["updated_at"]) if data.get("updated_at") else None,
        )


@dataclasses.dataclass(frozen=True)
class ClaimBoundary:
    """Explicit separation of Runtime vs Action Protocol claim types.

    Mirrors the server ``claim_boundary`` object on ``igris_run_proof.v1``.
    """

    runtime_receipt: str | None
    action_protocol_evidence: str | None
    external_effect: str | None = None
    linked_view: str | None = None
    run_scoped_evidence: str | None = None
    raw: dict[str, Any] = dataclasses.field(default_factory=dict)

    @classmethod
    def from_mapping(cls, data: Mapping[str, Any] | None) -> ClaimBoundary | None:
        if not isinstance(data, dict):
            return None
        return cls(
            runtime_receipt=(str(data["runtime_receipt"]) if data.get("runtime_receipt") else None),
            action_protocol_evidence=(
                str(data["action_protocol_evidence"])
                if data.get("action_protocol_evidence")
                else None
            ),
            external_effect=(str(data["external_effect"]) if data.get("external_effect") else None),
            linked_view=str(data["linked_view"]) if data.get("linked_view") else None,
            run_scoped_evidence=(
                str(data["run_scoped_evidence"]) if data.get("run_scoped_evidence") else None
            ),
            raw=dict(data),
        )


@dataclasses.dataclass(frozen=True)
class IgrisRunProof:
    """Typed ``igris_run_proof.v1`` product representation.

    This is a linked product view — not one cryptographic proof object.
    Runtime receipt claims and Action Protocol Evidence remain separate.
    ``eligible_linked`` is server eligibility, not protocol-level run binding.
    """

    schema: str
    product_term: str
    run_id: str
    task_id: str | None
    action_name: str | None
    contract_hash: str | None
    binding_id: str | None
    target_action_id: str | None
    target_version: str | None
    target_version_hash: str | None
    business_idempotency_key: str | None
    request_fingerprint: str | None
    tool_input_hash: str | None
    runtime_execution_id: str | None
    statuses: dict[str, Any]
    claim_boundary: ClaimBoundary | None
    runtime_proof: dict[str, Any] | None
    action_protocol_evidence: dict[str, Any] | None
    recovery_lineage: list[dict[str, Any]]
    latest_runtime_handoff: dict[str, Any] | None
    raw: dict[str, Any]

    @classmethod
    def from_response(cls, data: Mapping[str, Any]) -> IgrisRunProof:
        statuses = data.get("statuses") if isinstance(data.get("statuses"), dict) else {}
        recovery = data.get("recovery_lineage")
        if not isinstance(recovery, list):
            recovery = []
        target_version = data.get("target_version") or data.get("target_version_hash")
        return cls(
            schema=str(data.get("schema") or "igris_run_proof.v1"),
            product_term=str(data.get("product_term") or "Igris Run Proof"),
            run_id=str(data.get("run_id") or ""),
            task_id=str(data["task_id"]) if data.get("task_id") else None,
            action_name=str(data["action_name"]) if data.get("action_name") else None,
            contract_hash=str(data["contract_hash"]) if data.get("contract_hash") else None,
            binding_id=str(data["binding_id"]) if data.get("binding_id") else None,
            target_action_id=(
                str(data["target_action_id"]) if data.get("target_action_id") else None
            ),
            target_version=str(target_version) if target_version else None,
            target_version_hash=(
                str(data["target_version_hash"]) if data.get("target_version_hash") else None
            ),
            business_idempotency_key=(
                str(data["business_idempotency_key"])
                if data.get("business_idempotency_key")
                else None
            ),
            request_fingerprint=(
                str(data["request_fingerprint"]) if data.get("request_fingerprint") else None
            ),
            tool_input_hash=str(data["tool_input_hash"]) if data.get("tool_input_hash") else None,
            runtime_execution_id=(
                str(data["runtime_execution_id"]) if data.get("runtime_execution_id") else None
            ),
            statuses=dict(statuses),
            claim_boundary=ClaimBoundary.from_mapping(
                data.get("claim_boundary") if isinstance(data.get("claim_boundary"), dict) else None
            ),
            runtime_proof=(
                dict(data["runtime_proof"]) if isinstance(data.get("runtime_proof"), dict) else None
            ),
            action_protocol_evidence=(
                dict(data["action_protocol_evidence"])
                if isinstance(data.get("action_protocol_evidence"), dict)
                else None
            ),
            recovery_lineage=[dict(item) for item in recovery if isinstance(item, dict)],
            latest_runtime_handoff=(
                dict(data["latest_runtime_handoff"])
                if isinstance(data.get("latest_runtime_handoff"), dict)
                else None
            ),
            raw=dict(data),
        )


@dataclasses.dataclass(frozen=True)
class DurableRunStatus:
    """Product run status from ``GET /v1/actions/runs/:id``."""

    run_id: str
    task_id: str | None
    status: str
    proof_status: str | None
    durable_execution_status: str | None
    managed_decision_status: str | None
    recovery_status: str | None
    run_linkage_status: str | None
    execution_id: str | None
    action_name: str | None
    contract_binding: dict[str, Any] | None
    igris_run_proof: IgrisRunProof | None
    linked_proof: dict[str, Any] | None
    result: Any
    error: str | None
    message: str | None
    raw: dict[str, Any]

    @property
    def is_terminal(self) -> bool:
        statuses = {
            (self.status or "").lower(),
            (self.durable_execution_status or "").lower(),
        }
        return bool(statuses & _TERMINAL_RUN_STATUSES)

    @property
    def is_recovering(self) -> bool:
        return (self.recovery_status or "").lower() == "recovering" or (
            self.status or ""
        ).lower() == "recovering"

    @property
    def requires_reconciliation(self) -> bool:
        candidates = {
            (self.status or "").lower(),
            (self.durable_execution_status or "").lower(),
            (self.recovery_status or "").lower(),
        }
        if candidates & _RECONCILIATION_STATUSES:
            return True
        if self.raw.get("reconciliation_required") is True:
            return True
        if (self.raw.get("reconciliation_status") or "").lower() in _RECONCILIATION_STATUSES:
            return True
        if self.igris_run_proof is not None:
            recon_status = (self.igris_run_proof.statuses or {}).get("reconciliation_status")
            if str(recon_status or "").lower() in _RECONCILIATION_STATUSES:
                return True
            claim = self.igris_run_proof.raw.get("operator_reconciliation")
            if isinstance(claim, dict) and (
                claim.get("reconciliation_required") is True
                or str(claim.get("status") or "").lower() in _RECONCILIATION_STATUSES
            ):
                return True
        raw_result = self.raw.get("result")
        if isinstance(raw_result, dict) and raw_result.get("reconciliation_required") is True:
            return True
        return False

    @classmethod
    def from_response(cls, data: Mapping[str, Any]) -> DurableRunStatus:
        proof_data = data.get("igris_run_proof")
        proof = IgrisRunProof.from_response(proof_data) if isinstance(proof_data, dict) else None
        binding = data.get("contract_binding")
        return cls(
            run_id=str(data.get("run_id") or data.get("task_id") or ""),
            task_id=str(data["task_id"]) if data.get("task_id") else None,
            status=str(data.get("status") or ""),
            proof_status=str(data["proof_status"]) if data.get("proof_status") else None,
            durable_execution_status=(
                str(data["durable_execution_status"])
                if data.get("durable_execution_status")
                else None
            ),
            managed_decision_status=(
                str(data["managed_decision_status"])
                if data.get("managed_decision_status")
                else None
            ),
            recovery_status=(str(data["recovery_status"]) if data.get("recovery_status") else None),
            run_linkage_status=(
                str(data["run_linkage_status"]) if data.get("run_linkage_status") else None
            ),
            execution_id=str(data["execution_id"]) if data.get("execution_id") else None,
            action_name=str(data["action_name"]) if data.get("action_name") else None,
            contract_binding=dict(binding) if isinstance(binding, dict) else None,
            igris_run_proof=proof,
            linked_proof=(
                dict(data["linked_proof"]) if isinstance(data.get("linked_proof"), dict) else None
            ),
            result=data.get("result"),
            error=str(data["error"]) if data.get("error") else None,
            message=str(data["message"]) if data.get("message") else None,
            raw=dict(data),
        )


@dataclasses.dataclass(frozen=True)
class EvidenceLinkResult:
    """Outcome of an explicit Evidence link to a durable run."""

    id: str
    run_id: str
    task_id: str | None
    contract_hash: str | None
    binding_id: str | None
    evidence_batch_id: str
    evidence_chain_digest: str | None
    claim_type: str
    execution_provenance: str | None
    run_linkage_status: str | None
    tool_input_hash: str | None
    action_name: str | None
    schema: str | None
    raw: dict[str, Any]

    @classmethod
    def from_response(cls, data: Mapping[str, Any]) -> EvidenceLinkResult:
        return cls(
            id=str(data.get("id") or ""),
            run_id=str(data.get("run_id") or ""),
            task_id=str(data["task_id"]) if data.get("task_id") else None,
            contract_hash=str(data["contract_hash"]) if data.get("contract_hash") else None,
            binding_id=str(data["binding_id"]) if data.get("binding_id") else None,
            evidence_batch_id=str(data.get("evidence_batch_id") or data.get("batch_id") or ""),
            evidence_chain_digest=(
                str(data["evidence_chain_digest"]) if data.get("evidence_chain_digest") else None
            ),
            claim_type=str(data.get("claim_type") or "action_protocol_evidence"),
            execution_provenance=(
                str(data["execution_provenance"]) if data.get("execution_provenance") else None
            ),
            run_linkage_status=(
                str(data["run_linkage_status"]) if data.get("run_linkage_status") else None
            ),
            tool_input_hash=str(data["tool_input_hash"]) if data.get("tool_input_hash") else None,
            action_name=str(data["action_name"]) if data.get("action_name") else None,
            schema=str(data["schema"]) if data.get("schema") else None,
            raw=dict(data),
        )


# ---------------------------------------------------------------------------
# Run handle
# ---------------------------------------------------------------------------


class DurableRun:
    """Typed handle for one durable Action run."""

    def __init__(
        self,
        client: IgrisDurableClient,
        *,
        run_id: str,
        initial: DurableRunStatus | None = None,
    ) -> None:
        self._client = client
        self.run_id = run_id
        self._last_status = initial

    @property
    def last_status(self) -> DurableRunStatus | None:
        return self._last_status

    def status(self) -> DurableRunStatus:
        status = self._client.get_run(self.run_id)
        self._last_status = status
        if status.requires_reconciliation:
            raise ReconciliationRequiredError(
                f"durable run {self.run_id!r} requires reconciliation "
                f"(status={status.status!r}, recovery_status={status.recovery_status!r}); "
                "automatic retry is unsafe and was not attempted",
                run_id=self.run_id,
                recovery_status=status.recovery_status,
            )
        return status

    def wait(
        self,
        *,
        timeout: float = 60.0,
        poll_interval: float = 1.0,
        raise_on_reconciliation: bool = True,
    ) -> DurableRunStatus:
        """Poll run status until terminal, reconciliation, or bounded timeout.

        Default timeout is finite. ``recovering`` is not terminal.
        """
        if timeout <= 0:
            raise DurableConfigurationError("wait timeout must be positive")
        if poll_interval <= 0:
            raise DurableConfigurationError("poll_interval must be positive")
        deadline = time.monotonic() + timeout
        while True:
            status = self._client.get_run(self.run_id)
            self._last_status = status
            if status.requires_reconciliation:
                if raise_on_reconciliation:
                    raise ReconciliationRequiredError(
                        f"durable run {self.run_id!r} requires reconciliation "
                        f"(status={status.status!r}); automatic retry is unsafe",
                        run_id=self.run_id,
                        recovery_status=status.recovery_status,
                    )
                return status
            if status.is_terminal:
                return status
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise DurableTimeoutError(
                    f"timed out waiting for durable run {self.run_id!r} after {timeout}s "
                    f"(last status={status.status!r}, recovery_status={status.recovery_status!r})",
                    run_id=self.run_id,
                )
            time.sleep(min(poll_interval, remaining))

    def proof(self, *, prefer: str = "igris_run_proof") -> IgrisRunProof:
        """Retrieve typed Igris Run Proof for this run.

        Prefers ``igris_run_proof`` for new integrations. Falls back to
        ``linked_proof`` only when requested via ``prefer="linked_proof"`` or
        when the preferred field is absent but the alternate is present.
        """
        status = self._client.get_run(self.run_id)
        self._last_status = status
        if prefer == "linked_proof" and status.linked_proof is not None:
            return IgrisRunProof.from_response(status.linked_proof)
        if status.igris_run_proof is not None:
            return status.igris_run_proof
        if status.linked_proof is not None:
            return IgrisRunProof.from_response(status.linked_proof)
        raise ProofUnavailableError(
            f"Igris Run Proof is not available for run {self.run_id!r}. "
            "Proof is returned for contract-bound durable runs on GET run; "
            "unbound or non-bound runs do not carry igris_run_proof.v1."
        )

    def link_evidence(self, batch_id: str) -> EvidenceLinkResult:
        """Explicitly link a verified Evidence batch to this run.

        Evidence upload (``igris evidence sync``) remains a separate step.
        This method only creates the eligibility-gated link.
        """
        return self._client.link_evidence(self.run_id, batch_id)


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------


class IgrisDurableClient:
    """Small explicit client for durable contract binding, run, and proof.

    Construction is always explicit. Setting ``IGRIS_API_URL`` alone never
    switches Embedded ``wrap_tool`` to durable/remote execution.
    """

    def __init__(
        self,
        *,
        endpoint: str | None = None,
        api_key: str | None = None,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        opener: Any = None,
        config: ConnectedConfig | None = None,
    ) -> None:
        if config is not None:
            self._config = config
        else:
            self._config = _resolve_durable_config(endpoint=endpoint, api_key=api_key)
        self._timeout = timeout
        self._opener = opener or urllib.request.build_opener(_NoRedirectHandler()).open
        self._contract_sync = HttpContractSyncClient(
            self._config, timeout=timeout, opener=self._opener
        )

    @classmethod
    def from_env(cls, environ: Any = None, **kwargs: Any) -> IgrisDurableClient:
        """Build a durable client from ``IGRIS_API_URL`` + ``IGRIS_API_KEY``.

        This is an **explicit** call. Environment variables alone never make
        ``wrap_tool`` remote.
        """
        from .errors import ConnectedConfigurationError

        try:
            config = load_connected_config(environ)
        except ConnectedConfigurationError as exc:
            raise DurableConfigurationError(_rewrite_config_message(str(exc))) from None
        if config is None:
            raise DurableConfigurationError(
                f"durable client requires both {ENDPOINT_ENV} and {TOKEN_ENV}. "
                "Construct IgrisDurableClient(endpoint=..., api_key=...) explicitly, "
                "or set both environment variables and call from_env(). "
                "Embedded wrap_tool remains local until you use this durable client."
            )
        return cls(config=config, **kwargs)

    # -- contracts ---------------------------------------------------------

    def sync_contract(self, contract: ActionContract | Any) -> ContractSyncResult:
        """Synchronize an ActionContract (or wrapped tool exposing ``__igris_contract__``)."""
        resolved = _resolve_contract(contract)
        try:
            return self._contract_sync.sync_contract(resolved)
        except ContractSyncError as exc:
            raise _map_contract_sync_error(exc) from None

    # -- action targets ----------------------------------------------------

    def create_action_target(
        self,
        *,
        name: str,
        target_url: str,
        target_type: str = "webhook",
        method: str = "POST",
        display_name: str | None = None,
        description: str | None = None,
        policy_preset: str = "Safe automation",
        replay_class: str = "retryable",
        approval_required: bool = False,
        irreversible: bool = False,
        target_metadata: Mapping[str, Any] | None = None,
        secret_refs: list[str] | None = None,
    ) -> ActionTarget:
        """Create an executable Action target definition (explicit bootstrap).

        Target identity remains visible — this does not create bindings and
        does not upload Python.
        """
        if not name or not str(name).strip():
            raise DurableConfigurationError("action target name is required")
        if not target_url or not str(target_url).strip():
            raise DurableConfigurationError("action target_url is required")
        body: dict[str, Any] = {
            "name": name,
            "display_name": display_name or name,
            "description": description or "",
            "target_type": target_type,
            "target_url": target_url,
            "method": method,
            "policy_preset": policy_preset,
            "replay_class": replay_class,
            "approval_required": approval_required,
            "irreversible": irreversible,
            "target_metadata": dict(target_metadata or {}),
        }
        if secret_refs is not None:
            body["secret_refs"] = list(secret_refs)
        data = self._request_json("POST", "/v1/actions", body=body, expect=(201,))
        return ActionTarget.from_response(data)

    def get_action_target(self, action_id: str) -> ActionTarget:
        if not action_id or not str(action_id).strip():
            raise DurableConfigurationError("action_id is required")
        data = self._request_json("GET", f"/v1/actions/{urllib.parse.quote(action_id, safe='')}")
        return ActionTarget.from_response(data)

    # -- bindings ----------------------------------------------------------

    def get_binding(self, action_name: str, contract_hash: str) -> ContractBinding:
        """Inspect the immutable binding for an exact action + contract_hash."""
        name, hash_ = _require_exact_identity(action_name, contract_hash)
        path = f"/v1/contracts/actions/{urllib.parse.quote(name, safe='')}/versions/{hash_}/binding"
        data = self._request_json("GET", path)
        return ContractBinding.from_response(data)

    def create_binding(
        self,
        *,
        action_name: str,
        contract_hash: str,
        target_action_id: str,
        input_mapping: Mapping[str, str],
        timeout_ms: int = 30_000,
        replay_class: str | None = "retryable",
        idempotency_required: bool = True,
        endpoint_config_ref: str | None = None,
    ) -> ContractBinding:
        """Create an exact contract_hash → target binding.

        Requires ``contract_hash`` and ``target_action_id``. Name-only binding
        is rejected. Existing immutable bindings are never mutated.
        """
        name, hash_ = _require_exact_identity(action_name, contract_hash)
        if not target_action_id or not str(target_action_id).strip():
            raise DurableConfigurationError(
                "target_action_id is required; durable binding never resolves "
                "targets from Action name alone"
            )
        if not idempotency_required:
            raise DurableConfigurationError(
                "idempotency_required must be True for consequential durable bindings"
            )
        if not isinstance(input_mapping, Mapping) or not input_mapping:
            raise DurableConfigurationError(
                "input_mapping is required (exact 1:1 contract parameter → target field)"
            )
        body: dict[str, Any] = {
            "target_action_id": str(target_action_id).strip(),
            "input_mapping": {str(k): str(v) for k, v in input_mapping.items()},
            "timeout_ms": timeout_ms,
            "idempotency_required": True,
        }
        if replay_class is not None:
            body["replay_class"] = replay_class
        if endpoint_config_ref is not None:
            body["endpoint_config_ref"] = endpoint_config_ref
        path = (
            f"/v1/contracts/actions/{urllib.parse.quote(name, safe='')}/versions/{hash_}/bindings"
        )
        data = self._request_json("POST", path, body=body, expect=(201,))
        return ContractBinding.from_response(data)

    def ensure_binding(
        self,
        *,
        action_name: str,
        contract_hash: str,
        target_action_id: str,
        input_mapping: Mapping[str, str],
        **kwargs: Any,
    ) -> ContractBinding:
        """Return existing exact binding or create it. Never binds by name alone."""
        try:
            existing = self.get_binding(action_name, contract_hash)
        except DurableError as exc:
            if exc.error_code == "binding_not_found" or (
                exc.status_code == 404 and exc.error_code in {None, "binding_not_found"}
            ):
                existing = None
            else:
                raise
        else:
            if existing.target_action_id != str(target_action_id).strip():
                raise BindingConflictError(
                    f"exact contract {contract_hash[:12]}… is already bound to target "
                    f"{existing.target_action_id!r}, not {target_action_id!r}"
                )
            return existing
        try:
            return self.create_binding(
                action_name=action_name,
                contract_hash=contract_hash,
                target_action_id=target_action_id,
                input_mapping=input_mapping,
                **kwargs,
            )
        except BindingConflictError:
            return self.get_binding(action_name, contract_hash)

    # -- runs --------------------------------------------------------------

    def run(
        self,
        action_name: str | None = None,
        *,
        input: Mapping[str, Any] | None = None,
        idempotency_key: str | None = None,
        contract_hash: str | None = None,
        contract: ActionContract | Any | None = None,
        metadata: Mapping[str, Any] | None = None,
        require_binding: bool = True,
    ) -> DurableRun:
        """Submit one durable contract-bound run and return a typed handle.

        Requires an explicit business ``idempotency_key`` and exact
        ``contract_hash`` (or a contract/tool that provides one). Does not
        generate random idempotency keys.
        """
        resolved_name, resolved_hash = _resolve_run_identity(
            action_name=action_name, contract_hash=contract_hash, contract=contract
        )
        if not idempotency_key or not str(idempotency_key).strip():
            raise DurableConfigurationError(
                "idempotency_key is required for consequential durable runs. "
                "Provide a stable business key so retries are safe; the client "
                "never generates a random idempotency key."
            )
        if require_binding:
            try:
                self.get_binding(resolved_name, resolved_hash)
            except DurableError as exc:
                if isinstance(exc, ActionNotRegistered):
                    raise
                if (
                    exc.error_code in {"binding_not_found", "binding_required"}
                    or exc.status_code == 404
                ):
                    raise UnboundActionError(
                        f"action {resolved_name!r} contract {resolved_hash[:12]}… has no "
                        "exact execution binding. Create a binding with create_binding("
                        "action_name=..., contract_hash=..., target_action_id=..., "
                        "input_mapping=...) before submitting a durable run."
                    ) from None
                raise

        body: dict[str, Any] = {
            "input": dict(input or {}),
            "idempotency_key": str(idempotency_key).strip(),
            "contract_hash": resolved_hash,
        }
        if metadata is not None:
            body["metadata"] = dict(metadata)
        path = f"/v1/actions/{urllib.parse.quote(resolved_name, safe='')}/run"
        try:
            data = self._request_json("POST", path, body=body, expect=(200, 202))
        except DurableError as exc:
            # Managed approval gate returns HTTP 409 with a usable run handle.
            if exc.error_code == "approval_required" and isinstance(
                getattr(exc, "response_body", None), dict
            ):
                data = exc.response_body  # type: ignore[attr-defined]
            else:
                raise
        run_id = str(data.get("run_id") or data.get("task_id") or "")
        if not run_id:
            raise DurableError(
                "durable run response did not include run_id",
                error_code="invalid_run_response",
                retry_safe=True,
            )
        return DurableRun(self, run_id=run_id, initial=DurableRunStatus.from_response(data))

    def get_run(self, run_id: str) -> DurableRunStatus:
        if not run_id or not str(run_id).strip():
            raise DurableConfigurationError("run_id is required")
        path = f"/v1/actions/runs/{urllib.parse.quote(str(run_id).strip(), safe='')}"
        data = self._request_json("GET", path)
        return DurableRunStatus.from_response(data)

    def get_proof(self, run_id: str) -> IgrisRunProof:
        return DurableRun(self, run_id=run_id).proof()

    def link_evidence(self, run_id: str, batch_id: str) -> EvidenceLinkResult:
        if not run_id or not str(run_id).strip():
            raise DurableConfigurationError("run_id is required")
        if not batch_id or not str(batch_id).strip():
            raise DurableConfigurationError(
                "batch_id is required; Evidence must be synced explicitly "
                "(igris evidence sync) before linking"
            )
        path = f"/v1/actions/runs/{urllib.parse.quote(str(run_id).strip(), safe='')}/evidence-links"
        data = self._request_json(
            "POST",
            path,
            body={"batch_id": str(batch_id).strip()},
            expect=(201,),
        )
        return EvidenceLinkResult.from_response(data)

    # -- HTTP --------------------------------------------------------------

    def _request_json(
        self,
        method: str,
        path: str,
        *,
        body: Mapping[str, Any] | None = None,
        expect: tuple[int, ...] = (200,),
    ) -> dict[str, Any]:
        url = self._config.endpoint + path
        data = None
        headers = {
            "Authorization": "Bearer " + self._config.token,
            "Accept": "application/json",
        }
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = urllib.request.Request(url, data=data, method=method, headers=headers)  # noqa: S310
        try:
            response = self._opener(request, timeout=self._timeout)
        except urllib.error.HTTPError as exc:
            raise self._error_for_status(exc, method=method, path=path) from None
        except TimeoutError as exc:
            raise DurableTransportError(f"durable request timed out ({method} {path})") from exc
        except urllib.error.URLError as exc:
            raise DurableTransportError(
                f"durable transport failure ({method} {path}: {_scrubbed_reason(exc)})"
            ) from None
        except OSError as exc:
            raise DurableTransportError(
                f"durable transport failure ({method} {path}: {type(exc).__name__})"
            ) from None

        status = getattr(response, "status", None) or response.getcode()
        raw = response.read()
        if 300 <= status < 400:
            raise DurableError(
                f"durable endpoint returned HTTP {status}; redirects are refused so "
                "credentials cannot cross origins",
                status_code=status,
                error_code="redirect_refused",
                retry_safe=False,
            )
        if status not in expect:
            # Some endpoints return 409 with a structured body we still parse
            # (handled above via HTTPError). Non-error unexpected statuses fail.
            raise DurableError(
                f"durable endpoint returned unexpected status {status} for {method} {path}",
                status_code=status,
                retry_safe=None,
            )
        if not raw:
            return {}
        try:
            decoded = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeError) as exc:
            raise DurableError(
                f"durable endpoint returned an unreadable response for {method} {path}",
                status_code=status,
                retry_safe=True,
            ) from exc
        if not isinstance(decoded, dict):
            raise DurableError(
                f"durable endpoint returned a non-object response for {method} {path}",
                status_code=status,
                retry_safe=True,
            )
        return decoded

    def _error_for_status(
        self, exc: urllib.error.HTTPError, *, method: str, path: str
    ) -> DurableError:
        status = exc.code
        if 300 <= status < 400:
            return DurableError(
                f"durable endpoint returned HTTP {status}; redirects are refused",
                status_code=status,
                error_code="redirect_refused",
                retry_safe=False,
            )
        error_code, detail, message, body = _parse_error_body(exc)
        detail = _developer_safe_detail(detail or message)

        # Managed approval gate: 409 with a run handle — surface as DurableError
        # carrying response_body so run() can return a typed handle.
        if error_code == "approval_required" or (
            isinstance(body, dict)
            and (
                body.get("error") == "approval_required"
                or body.get("status") == "approval_required"
            )
            and (body.get("run_id") or body.get("task_id"))
        ):
            return DurableError(
                "durable run is awaiting managed approval",
                status_code=status,
                error_code="approval_required",
                retry_safe=False,
                response_body=body if isinstance(body, dict) else None,
            )

        if status in (401, 403):
            if status == 403 and error_code in {"policy_denied", "authorization_denied"}:
                return AuthorizationDenied(
                    f"durable request denied ({method} {path}: HTTP {status}"
                    + (f", {error_code}" if error_code else "")
                    + ")",
                    status_code=status,
                    error_code=error_code,
                )
            return AuthenticationError(
                f"durable authentication was rejected (HTTP {status}); check the "
                f"tenant-scoped {TOKEN_ENV} credential",
                status_code=status,
                error_code=error_code,
            )

        if error_code == "binding_required":
            return UnboundActionError(
                "exact contract has no execution binding; create a binding with "
                "contract_hash + target_action_id before running",
                status_code=status,
            )
        if error_code == "binding_exists":
            return BindingConflictError(
                "an immutable binding already exists for this exact contract version",
                status_code=status,
            )
        if error_code == "binding_not_found":
            return DurableError(
                "no binding found for this exact action name and contract_hash",
                status_code=status,
                error_code="binding_not_found",
                retry_safe=False,
            )
        if error_code == "idempotency_key_conflict":
            return IdempotencyConflictError(
                "idempotency_key was already used with a different request fingerprint; "
                "retrying with the same key and different input is unsafe",
                status_code=status,
            )
        if error_code == "idempotency_key_required":
            return DurableConfigurationError(
                "idempotency_key is required for consequential durable runs",
                error_code=error_code,
            )
        if error_code == "evidence_not_linkable":
            reason = detail or "eligibility could not be proven"
            return EvidenceNotLinkableError(
                f"Evidence is not linkable to this run: {reason}",
                status_code=status,
            )
        if error_code in {
            "contract_hash_mismatch",
            "invalid_contract_hash",
            "invalid_bound_action_request",
        }:
            return ContractMismatchError(
                f"contract identity mismatch ({error_code}"
                + (f": {detail}" if detail else "")
                + ")",
                status_code=status,
                error_code=error_code,
            )
        if error_code in {
            "action_not_found",
            "contract_version_not_found",
            "target_action_not_found",
            "contract_bound_run_not_found",
        }:
            return ActionNotRegistered(
                f"action or contract not found for this tenant ({error_code})",
                status_code=status,
                error_code=error_code,
            )
        if error_code in {"run_not_found", "invalid_run_id"} or (
            status == 404 and "/runs/" in path
        ):
            return RunNotFoundError(
                f"durable run not found ({error_code or 'run_not_found'})",
                status_code=status,
                error_code=error_code or "run_not_found",
            )
        if error_code in _RECONCILIATION_STATUSES or (
            isinstance(message, str) and "reconciliation_required" in message
        ):
            return ReconciliationRequiredError(
                "run is in an unresolved effect state; automatic retry is unsafe",
                status_code=status,
                error_code=error_code or "reconciliation_required",
            )

        retry_safe: bool | None
        if status == 429 or status >= 500:
            retry_safe = True
        elif status in (400, 404, 405, 409, 413, 422):
            retry_safe = False
        else:
            retry_safe = None
        reason = f"HTTP {status}"
        if error_code:
            reason += f", {error_code}"
        if detail:
            reason += f": {detail}"
        return DurableError(
            f"durable request failed ({method} {path}: {reason})",
            status_code=status,
            error_code=error_code,
            retry_safe=retry_safe,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_durable_config(*, endpoint: str | None, api_key: str | None) -> ConnectedConfig:
    from .errors import ConnectedConfigurationError

    endpoint_s = (endpoint or "").strip()
    token_s = (api_key or "").strip()
    if not endpoint_s and not token_s:
        raise DurableConfigurationError(
            "IgrisDurableClient requires endpoint and api_key (or use from_env()). "
            "Durable execution is never inferred from environment variables alone."
        )
    if not endpoint_s or not token_s:
        endpoint_state = "set" if endpoint_s else "missing"
        token_state = "set" if token_s else "missing"
        raise DurableConfigurationError(
            "IgrisDurableClient requires both endpoint and api_key. "
            f"Partial configuration is rejected (got endpoint={endpoint_state}, "
            f"api_key={token_state})."
        )
    try:
        config = load_connected_config({ENDPOINT_ENV: endpoint_s, TOKEN_ENV: token_s})
    except ConnectedConfigurationError as exc:
        raise DurableConfigurationError(_rewrite_config_message(str(exc))) from None
    if config is None:  # pragma: no cover — both vars set above
        raise DurableConfigurationError("durable client configuration resolved to empty")
    return config


def _rewrite_config_message(message: str) -> str:
    return (
        message.replace("Connected mode", "Durable client")
        .replace(
            "The consequential function did not execute.", "The durable client was not created."
        )
        .replace("for Embedded-only operation", "and use Embedded wrap_tool locally")
    )


def _resolve_contract(contract: ActionContract | Any) -> ActionContract:
    if isinstance(contract, ActionContract):
        return contract
    attr = getattr(contract, "__igris_contract__", None)
    if isinstance(attr, ActionContract):
        return attr
    raise DurableConfigurationError(
        "sync_contract expects an ActionContract or a wrap_tool/guard callable "
        "exposing __igris_contract__"
    )


def _require_exact_identity(action_name: str, contract_hash: str) -> tuple[str, str]:
    name = (action_name or "").strip()
    hash_ = (contract_hash or "").strip().lower()
    if not name:
        raise DurableConfigurationError("action_name is required")
    if not hash_:
        raise DurableConfigurationError(
            "contract_hash is required; durable binding and runs never resolve by Action name alone"
        )
    if not _CONTRACT_HASH_RE.fullmatch(hash_):
        raise DurableConfigurationError("contract_hash must be a 64-character lowercase hex digest")
    return name, hash_


def _resolve_run_identity(
    *,
    action_name: str | None,
    contract_hash: str | None,
    contract: ActionContract | Any | None,
) -> tuple[str, str]:
    if contract is not None:
        resolved = _resolve_contract(contract)
        name = (action_name or resolved.action_name).strip()
        hash_ = (contract_hash or resolved.contract_hash).strip().lower()
        return _require_exact_identity(name, hash_)
    if not action_name:
        raise DurableConfigurationError("action_name is required (or pass contract=/wrapped tool)")
    return _require_exact_identity(action_name, contract_hash or "")


def _map_contract_sync_error(exc: ContractSyncError) -> DurableError:
    if exc.error_code == "idempotency_key_conflict":
        return IdempotencyConflictError(str(exc), status_code=exc.status_code)
    if exc.status_code in (401, 403):
        return AuthenticationError(str(exc), status_code=exc.status_code, error_code=exc.error_code)
    if exc.error_code == "contract_hash_mismatch":
        return ContractMismatchError(
            str(exc), status_code=exc.status_code, error_code=exc.error_code
        )
    return DurableError(
        str(exc),
        status_code=exc.status_code,
        error_code=exc.error_code,
        retry_safe=exc.retry_safe,
    )


def _parse_error_body(
    exc: urllib.error.HTTPError,
) -> tuple[str | None, str | None, str | None, dict[str, Any] | None]:
    try:
        decoded = json.loads(exc.read().decode("utf-8"))
    except (ValueError, OSError):
        return None, None, None, None
    if not isinstance(decoded, dict):
        return None, None, None, None
    error_code = decoded.get("error")
    detail = decoded.get("detail")
    message = decoded.get("message")
    if not isinstance(error_code, str):
        error_code = None
    if not isinstance(detail, str):
        detail = None
    if not isinstance(message, str):
        message = None
    if detail and len(detail) > _MAX_ERROR_DETAIL_CHARS:
        detail = detail[:_MAX_ERROR_DETAIL_CHARS] + "…"
    if message and len(message) > _MAX_ERROR_DETAIL_CHARS:
        message = message[:_MAX_ERROR_DETAIL_CHARS] + "…"
    return error_code, detail, message, decoded


def _developer_safe_detail(detail: str | None) -> str | None:
    """Strip internal milestone wording from developer-facing detail strings."""
    if not detail:
        return detail
    cleaned = detail
    for token in (
        "Clock 3B",
        "Clock 3C",
        "Clock 3D",
        "Clock 3E",
        "Overture",
    ):
        cleaned = cleaned.replace(token, "Igris")
    return cleaned


def _scrubbed_reason(exc: urllib.error.URLError) -> str:
    reason = getattr(exc, "reason", None)
    if isinstance(reason, BaseException):
        return type(reason).__name__
    if reason is None:
        return type(exc).__name__
    return str(reason)[:_MAX_ERROR_DETAIL_CHARS]


# ---------------------------------------------------------------------------
# Product facade (Action → Run → Proof)
# ---------------------------------------------------------------------------


class Igris:
    """Thin managed product facade: configure once, then run → wait → proof.

    This class does **not** implement durable recovery, retry-of-effects, or
    reconciliation. Those remain server-side. It only:

    * wraps :class:`IgrisDurableClient` (REST source of truth);
    * caches Action name → exact ``contract_hash`` after one-time setup so
      ordinary ``run(action_name, …)`` calls need not pass raw hashes;
    * delegates advanced sync / target / binding / evidence APIs unchanged.

    Embedded ``wrap_tool`` is never switched to remote by constructing this
    client.
    """

    def __init__(
        self,
        *,
        durable: IgrisDurableClient | None = None,
        endpoint: str | None = None,
        api_key: str | None = None,
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
        opener: Any = None,
        config: ConnectedConfig | None = None,
    ) -> None:
        if durable is not None:
            self._durable = durable
        else:
            self._durable = IgrisDurableClient(
                endpoint=endpoint,
                api_key=api_key,
                timeout=timeout,
                opener=opener,
                config=config,
            )
        # Local setup cache only — not a durable execution state machine.
        self._action_contract_hashes: dict[str, str] = {}

    @classmethod
    def from_env(cls, environ: Any = None, **kwargs: Any) -> Igris:
        """Build from ``IGRIS_API_URL`` + ``IGRIS_API_KEY`` (explicit call)."""
        return cls(durable=IgrisDurableClient.from_env(environ, **kwargs))

    @property
    def durable(self) -> IgrisDurableClient:
        """Compatibility access to the underlying durable REST client."""
        return self._durable

    def remember_contract(self, action_name: str, contract_hash: str) -> None:
        """Cache an exact contract hash for later ``run(action_name, …)`` calls."""
        name = str(action_name or "").strip()
        hash_ = str(contract_hash or "").strip().lower()
        if not name:
            raise DurableConfigurationError("action_name is required to remember a contract")
        if not _CONTRACT_HASH_RE.fullmatch(hash_):
            raise DurableConfigurationError(
                "contract_hash must be a 64-character lowercase hex digest"
            )
        self._action_contract_hashes[name] = hash_

    def configure_action(
        self,
        contract: ActionContract | Any,
        *,
        target_action_id: str,
        input_mapping: Mapping[str, str],
        **binding_kwargs: Any,
    ) -> ContractBinding:
        """One-time setup: sync contract and ensure an exact immutable binding.

        After this returns, ordinary ``run(action_name, input=…,
        idempotency_key=…)`` can omit ``contract_hash`` / ``contract`` for that
        Action name. Does not create targets and does not invent bindings
        silently on every run.
        """
        sync = self._durable.sync_contract(contract)
        binding = self._durable.ensure_binding(
            action_name=sync.action_name,
            contract_hash=sync.contract_hash,
            target_action_id=target_action_id,
            input_mapping=input_mapping,
            **binding_kwargs,
        )
        self.remember_contract(binding.action_name, binding.contract_hash)
        return binding

    def run(
        self,
        action_name: str | None = None,
        *,
        input: Mapping[str, Any] | None = None,
        idempotency_key: str | None = None,
        contract_hash: str | None = None,
        contract: ActionContract | Any | None = None,
        metadata: Mapping[str, Any] | None = None,
        require_binding: bool = True,
    ) -> DurableRun:
        """Submit one durable Action run; return :class:`DurableRun`.

        Requires an explicit business ``idempotency_key``. Exact contract
        identity comes from ``contract`` / ``contract_hash``, or from a hash
        previously stored by :meth:`configure_action` / :meth:`remember_contract`.
        """
        resolved_hash = contract_hash
        if resolved_hash is None and contract is None and action_name:
            resolved_hash = self._action_contract_hashes.get(str(action_name).strip())
        if resolved_hash is None and contract is None:
            hint = (
                f"action {action_name!r} has no remembered contract_hash. "
                "Call configure_action(...) once after binding, pass contract=..., "
                "or pass contract_hash=... explicitly."
                if action_name
                else "Provide action_name after configure_action(...), or pass "
                "contract=... / contract_hash=... explicitly."
            )
            raise UnboundActionError(hint)
        return self._durable.run(
            action_name,
            input=input,
            idempotency_key=idempotency_key,
            contract_hash=resolved_hash,
            contract=contract,
            metadata=metadata,
            require_binding=require_binding,
        )

    def __getattr__(self, name: str) -> Any:
        # Advanced REST helpers (sync_contract, create_action_target, …)
        # remain available without re-implementing them.
        if name.startswith("_"):
            raise AttributeError(name)
        return getattr(self._durable, name)


# Re-export for tests / advanced callers that build wire payloads.
__all__ = [
    "ActionTarget",
    "ClaimBoundary",
    "ContractBinding",
    "DurableRun",
    "DurableRunStatus",
    "EvidenceLinkResult",
    "Igris",
    "IgrisDurableClient",
    "IgrisRunProof",
    "contract_wire_payload",
]
