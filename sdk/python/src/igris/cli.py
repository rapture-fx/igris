"""The ``igris`` command-line interface (standard library ``argparse`` only).

Commands:

* ``igris verify [JOURNAL_PATH]`` — verify a local evidence journal offline.
* ``igris key-info`` — print the local public key identity.
* ``igris evidence sync|inspect|status`` — explicit Connected evidence commands.
* ``igris binding get|create`` — inspect or create exact contract bindings.
* ``igris run submit|status|wait|proof`` — durable run lifecycle and proof.
* ``igris run link-evidence`` — explicitly link a verified Evidence batch.

Durable commands reuse :class:`~igris.IgrisDurableClient` and require explicit
``IGRIS_API_URL`` + ``IGRIS_API_KEY`` (or ``--endpoint`` / ``--api-key``).
They never make Embedded ``wrap_tool`` remote.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from . import __version__
from .durable import IgrisDurableClient
from .errors import (
    DurableConfigurationError,
    DurableError,
    EvidencePrivacyInspectionError,
    EvidencePrivacyPreflightError,
    EvidenceSyncConfigurationError,
    EvidenceSyncError,
    IdentityError,
    ReconciliationRequiredError,
    UnboundActionError,
)
from .evidence_privacy import inspect_journal
from .evidence_sync import get_batch_status, sync_journal
from .identity import (
    PUBLIC_KEY_FILENAME,
    LocalSigningIdentity,
    default_journal_path,
    igris_home,
    load_public_key,
)
from .verification import verify_journal

EXIT_OK = 0
EXIT_INVALID = 1
EXIT_USAGE = 2
EXIT_PRIVACY_ACK_REQUIRED = 3


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="igris",
        description="Igris: a drop-in action layer for consequential AI-agent actions.",
    )
    parser.add_argument("--version", action="version", version=f"igris {__version__}")
    subparsers = parser.add_subparsers(dest="command", required=True)

    verify_parser = subparsers.add_parser("verify", help="verify a local evidence journal offline")
    verify_parser.add_argument(
        "journal",
        nargs="?",
        default=None,
        help=f"journal path (default: {Path('~') / '.igris' / 'journal.jsonl'} or $IGRIS_HOME)",
    )
    verify_parser.add_argument(
        "--public-key",
        default=None,
        help=f"public key PEM path (default: {PUBLIC_KEY_FILENAME} in the Igris home)",
    )

    subparsers.add_parser("key-info", help="print the local signing identity (public parts only)")

    evidence_parser = subparsers.add_parser(
        "evidence", help="explicit Connected evidence commands (never automatic)"
    )
    evidence_subparsers = evidence_parser.add_subparsers(dest="evidence_command", required=True)
    sync_parser = evidence_subparsers.add_parser(
        "sync",
        help="verify the local journal, then upload it to the configured Igris endpoint",
    )
    sync_parser.add_argument(
        "journal",
        nargs="?",
        default=None,
        help=f"journal path (default: {Path('~') / '.igris' / 'journal.jsonl'} or $IGRIS_HOME)",
    )
    sync_parser.add_argument(
        "--public-key",
        default=None,
        help=f"public key PEM path (default: {PUBLIC_KEY_FILENAME} in the Igris home)",
    )
    sync_parser.add_argument(
        "--allow-unredacted",
        action="store_true",
        help=(
            "deliberately upload retained or unclassifiable argument content for this "
            "invocation only"
        ),
    )
    inspect_parser = evidence_subparsers.add_parser(
        "inspect",
        help="verify and inspect local evidence privacy without any network activity",
    )
    inspect_parser.add_argument(
        "journal",
        nargs="?",
        default=None,
        help=f"journal path (default: {Path('~') / '.igris' / 'journal.jsonl'} or $IGRIS_HOME)",
    )
    inspect_parser.add_argument(
        "--public-key",
        default=None,
        help=f"public key PEM path (default: {PUBLIC_KEY_FILENAME} in the Igris home)",
    )
    inspect_parser.add_argument(
        "--verbose",
        action="store_true",
        help="explain classifications without displaying argument values",
    )
    status_parser = evidence_subparsers.add_parser(
        "status", help="fetch a previously uploaded batch's verification status"
    )
    status_parser.add_argument("batch_id", help="batch id returned by `igris evidence sync`")

    binding_parser = subparsers.add_parser(
        "binding", help="inspect or create exact contract→target bindings"
    )
    binding_sub = binding_parser.add_subparsers(dest="binding_command", required=True)
    binding_get = binding_sub.add_parser("get", help="inspect binding by exact contract_hash")
    _add_durable_auth_flags(binding_get)
    binding_get.add_argument("--action", required=True, help="action name")
    binding_get.add_argument("--contract-hash", required=True, help="exact 64-hex contract hash")
    binding_get.add_argument("--json", action="store_true", help="machine-readable JSON output")

    binding_create = binding_sub.add_parser("create", help="create an immutable exact-hash binding")
    _add_durable_auth_flags(binding_create)
    binding_create.add_argument("--action", required=True, help="action name")
    binding_create.add_argument("--contract-hash", required=True, help="exact 64-hex contract hash")
    binding_create.add_argument(
        "--target-action-id", required=True, help="target Action definition UUID"
    )
    binding_create.add_argument(
        "--input-mapping",
        required=True,
        help='JSON object mapping contract params to target fields, e.g. \'{"a":"a"}\'',
    )
    binding_create.add_argument("--replay-class", default="retryable")
    binding_create.add_argument("--json", action="store_true", help="machine-readable JSON output")

    run_parser = subparsers.add_parser("run", help="durable run submit/status/wait/proof")
    run_sub = run_parser.add_subparsers(dest="run_command", required=True)

    run_submit = run_sub.add_parser("submit", help="submit a durable contract-bound run")
    _add_durable_auth_flags(run_submit)
    run_submit.add_argument("--action", required=True, help="action name")
    run_submit.add_argument("--contract-hash", required=True, help="exact 64-hex contract hash")
    run_submit.add_argument(
        "--idempotency-key",
        required=True,
        help="explicit business idempotency key (never auto-generated)",
    )
    run_submit.add_argument(
        "--input",
        default="{}",
        help="JSON object of run input (default: {})",
    )
    run_submit.add_argument("--json", action="store_true", help="machine-readable JSON output")

    run_status = run_sub.add_parser("status", help="fetch durable run status")
    _add_durable_auth_flags(run_status)
    run_status.add_argument("run_id", help="durable run id")
    run_status.add_argument("--json", action="store_true", help="machine-readable JSON output")

    run_wait = run_sub.add_parser("wait", help="wait for a terminal durable run status")
    _add_durable_auth_flags(run_wait)
    run_wait.add_argument("run_id", help="durable run id")
    run_wait.add_argument("--timeout", type=float, default=60.0, help="bounded timeout seconds")
    run_wait.add_argument("--poll-interval", type=float, default=1.0)
    run_wait.add_argument("--json", action="store_true", help="machine-readable JSON output")

    run_proof = run_sub.add_parser("proof", help="retrieve Igris Run Proof for a run")
    _add_durable_auth_flags(run_proof)
    run_proof.add_argument("run_id", help="durable run id")
    run_proof.add_argument(
        "--human",
        action="store_true",
        help="concise human-readable summary (default output is JSON)",
    )

    run_link = run_sub.add_parser(
        "link-evidence", help="explicitly link a verified Evidence batch to a run"
    )
    _add_durable_auth_flags(run_link)
    run_link.add_argument("run_id", help="durable run id")
    run_link.add_argument("--batch-id", required=True, help="verified Evidence batch id")
    run_link.add_argument("--json", action="store_true", help="machine-readable JSON output")

    args = parser.parse_args(argv)

    if args.command == "verify":
        return _cmd_verify(args)
    if args.command == "key-info":
        return _cmd_key_info()
    if args.command == "evidence":
        if args.evidence_command == "sync":
            return _cmd_evidence_sync(args)
        if args.evidence_command == "inspect":
            return _cmd_evidence_inspect(args)
        return _cmd_evidence_status(args)
    if args.command == "binding":
        return _cmd_binding(args)
    if args.command == "run":
        return _cmd_run(args)
    parser.error(f"unknown command {args.command!r}")
    return EXIT_USAGE  # unreachable; parser.error exits


def _add_durable_auth_flags(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--endpoint",
        default=None,
        help="Igris API endpoint (default: $IGRIS_API_URL)",
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help="tenant-scoped igris_… API key (default: $IGRIS_API_KEY)",
    )


def _durable_client(args: argparse.Namespace) -> IgrisDurableClient:
    endpoint = getattr(args, "endpoint", None)
    api_key = getattr(args, "api_key", None)
    if endpoint or api_key:
        return IgrisDurableClient(endpoint=endpoint, api_key=api_key)
    return IgrisDurableClient.from_env()


def _print_json(payload: Any) -> None:
    print(json.dumps(payload, indent=2, sort_keys=True, default=str))


def _cmd_binding(args: argparse.Namespace) -> int:
    try:
        client = _durable_client(args)
        if args.binding_command == "get":
            binding = client.get_binding(args.action, args.contract_hash)
        else:
            try:
                mapping = json.loads(args.input_mapping)
            except json.JSONDecodeError as exc:
                print(f"igris binding create: invalid --input-mapping JSON: {exc}", file=sys.stderr)
                return EXIT_USAGE
            if not isinstance(mapping, dict):
                print(
                    "igris binding create: --input-mapping must be a JSON object", file=sys.stderr
                )
                return EXIT_USAGE
            binding = client.create_binding(
                action_name=args.action,
                contract_hash=args.contract_hash,
                target_action_id=args.target_action_id,
                input_mapping={str(k): str(v) for k, v in mapping.items()},
                replay_class=args.replay_class,
            )
    except DurableConfigurationError as exc:
        print(f"igris binding: {exc}", file=sys.stderr)
        return EXIT_USAGE
    except DurableError as exc:
        print(f"igris binding: {exc}", file=sys.stderr)
        return EXIT_INVALID

    payload = {
        "id": binding.id,
        "action_name": binding.action_name,
        "contract_hash": binding.contract_hash,
        "target_action_id": binding.target_action_id,
        "target_version_hash": binding.target_version_hash,
        "input_mapping": binding.input_mapping,
        "timeout_ms": binding.timeout_ms,
        "replay_class": binding.replay_class,
        "idempotency_required": binding.idempotency_required,
        "immutable": binding.immutable,
        "created_at": binding.created_at,
    }
    if args.json:
        _print_json(payload)
    else:
        print(f"binding {binding.id}")
        print(f"  action:          {binding.action_name}")
        print(f"  contract_hash:   {binding.contract_hash}")
        print(f"  target_action_id:{binding.target_action_id}")
        print(f"  target_version:  {binding.target_version_hash}")
        print(f"  input_mapping:   {json.dumps(binding.input_mapping, sort_keys=True)}")
        print(f"  idempotency_required: {binding.idempotency_required}")
    return EXIT_OK


def _cmd_run(args: argparse.Namespace) -> int:
    try:
        client = _durable_client(args)
        if args.run_command == "submit":
            try:
                run_input = json.loads(args.input)
            except json.JSONDecodeError as exc:
                print(f"igris run submit: invalid --input JSON: {exc}", file=sys.stderr)
                return EXIT_USAGE
            if not isinstance(run_input, dict):
                print("igris run submit: --input must be a JSON object", file=sys.stderr)
                return EXIT_USAGE
            handle = client.run(
                args.action,
                input=run_input,
                idempotency_key=args.idempotency_key,
                contract_hash=args.contract_hash,
            )
            status = handle.last_status
            payload = {
                "run_id": handle.run_id,
                "status": status.status if status else None,
                "task_id": status.task_id if status else None,
            }
            if args.json:
                _print_json(payload)
            else:
                print(f"run_id: {handle.run_id}")
                if status is not None:
                    print(f"status: {status.status}")
            return EXIT_OK

        if args.run_command == "status":
            status = client.get_run(args.run_id)
            return _emit_run_status(status, as_json=args.json)

        if args.run_command == "wait":
            from .durable import DurableRun

            status = DurableRun(client, run_id=args.run_id).wait(
                timeout=args.timeout, poll_interval=args.poll_interval
            )
            return _emit_run_status(status, as_json=args.json)

        if args.run_command == "proof":
            from .durable import DurableRun

            proof = DurableRun(client, run_id=args.run_id).proof()
            if args.human:
                print(f"schema:        {proof.schema}")
                print(f"product_term:  {proof.product_term}")
                print(f"run_id:        {proof.run_id}")
                print(f"action_name:   {proof.action_name}")
                print(f"contract_hash: {proof.contract_hash}")
                print(f"statuses:      {json.dumps(proof.statuses, sort_keys=True)}")
                print(
                    "claim_boundary preserves Runtime receipt vs Action Protocol Evidence "
                    "as separate claims; eligible_linked is server eligibility."
                )
                return EXIT_OK
            _print_json(proof.raw)
            return EXIT_OK

        if args.run_command == "link-evidence":
            result = client.link_evidence(args.run_id, args.batch_id)
            payload = {
                "id": result.id,
                "run_id": result.run_id,
                "evidence_batch_id": result.evidence_batch_id,
                "claim_type": result.claim_type,
                "run_linkage_status": result.run_linkage_status,
                "schema": result.schema,
            }
            if args.json:
                _print_json(payload)
            else:
                print(f"linked batch {result.evidence_batch_id} → run {result.run_id}")
                print(f"  claim_type:         {result.claim_type}")
                print(f"  run_linkage_status: {result.run_linkage_status}")
                print("  note: eligible_linked is server eligibility, not a crypto run bind")
            return EXIT_OK
    except UnboundActionError as exc:
        print(f"igris run: {exc}", file=sys.stderr)
        return EXIT_INVALID
    except ReconciliationRequiredError as exc:
        print(f"igris run: {exc}", file=sys.stderr)
        return EXIT_INVALID
    except DurableConfigurationError as exc:
        print(f"igris run: {exc}", file=sys.stderr)
        return EXIT_USAGE
    except DurableError as exc:
        print(f"igris run: {exc}", file=sys.stderr)
        return EXIT_INVALID

    print(f"igris run: unknown subcommand {args.run_command!r}", file=sys.stderr)
    return EXIT_USAGE


def _emit_run_status(status: Any, *, as_json: bool) -> int:
    payload = {
        "run_id": status.run_id,
        "task_id": status.task_id,
        "status": status.status,
        "proof_status": status.proof_status,
        "durable_execution_status": status.durable_execution_status,
        "managed_decision_status": status.managed_decision_status,
        "recovery_status": status.recovery_status,
        "run_linkage_status": status.run_linkage_status,
        "is_terminal": status.is_terminal,
        "is_recovering": status.is_recovering,
        "requires_reconciliation": status.requires_reconciliation,
    }
    if as_json:
        _print_json(payload)
    else:
        print(f"run_id:                 {status.run_id}")
        print(f"status:                 {status.status}")
        print(f"durable_execution:      {status.durable_execution_status}")
        print(f"recovery_status:        {status.recovery_status}")
        print(f"proof_status:           {status.proof_status}")
        print(f"run_linkage_status:     {status.run_linkage_status}")
        print(f"is_terminal:            {status.is_terminal}")
        print(f"is_recovering:          {status.is_recovering}")
        print(f"requires_reconciliation:{status.requires_reconciliation}")
    return EXIT_OK


def _cmd_verify(args: argparse.Namespace) -> int:
    journal_path = Path(args.journal) if args.journal else default_journal_path()
    key_path = Path(args.public_key) if args.public_key else igris_home() / PUBLIC_KEY_FILENAME

    if not journal_path.exists():
        print(f"igris verify: journal not found: {journal_path}", file=sys.stderr)
        return EXIT_USAGE
    try:
        public_key = load_public_key(key_path)
    except IdentityError as exc:
        print(f"igris verify: {exc}", file=sys.stderr)
        return EXIT_USAGE

    result = verify_journal(journal_path, public_key)
    if result.valid:
        print(f"OK: {result.events_verified} event(s) verified in {journal_path}")
        print("Chain linkage, event hashes, signatures, and schema versions are valid.")
        return EXIT_OK

    print(f"INVALID: journal {journal_path} failed verification", file=sys.stderr)
    for issue in result.issues:
        location = f"line {issue.line_number}" if issue.line_number else "file"
        print(f"  {location}: [{issue.code}] {issue.message}", file=sys.stderr)
    print(
        f"  {result.events_verified} event(s) verified before/around the failure.",
        file=sys.stderr,
    )
    return EXIT_INVALID


def _cmd_evidence_sync(args: argparse.Namespace) -> int:
    journal_path = Path(args.journal) if args.journal else None
    key_path = Path(args.public_key) if args.public_key else None

    try:
        report = sync_journal(
            journal_path,
            public_key_path=key_path,
            allow_unredacted=args.allow_unredacted,
        )
    except EvidencePrivacyPreflightError as exc:
        print(f"igris evidence sync: {exc}", file=sys.stderr)
        return EXIT_PRIVACY_ACK_REQUIRED
    except EvidenceSyncConfigurationError as exc:
        print(f"igris evidence sync: {exc}", file=sys.stderr)
        return EXIT_USAGE
    except EvidenceSyncError as exc:
        print(f"igris evidence sync: {exc}", file=sys.stderr)
        return EXIT_INVALID

    print(f"OK: local verification passed ({report.events_total} event(s), key {report.key_id})")
    if report.events_total == 0:
        print("nothing to sync: the journal has no events")
        return EXIT_OK
    if report.up_to_date:
        print("already up to date: the endpoint holds all local evidence")
        return EXIT_OK
    print(
        f"synced {report.events_uploaded} event(s) in {len(report.batches)} batch(es); "
        "execution_provenance stays embedded"
    )
    for batch in report.batches:
        replay = "" if batch.created else " (replayed)"
        events = f"{batch.events_verified} event(s)"
        print(f"  batch {batch.batch_id}: {batch.evidence_state}, {events}{replay}")
    return EXIT_OK


def _cmd_evidence_inspect(args: argparse.Namespace) -> int:
    journal_path = Path(args.journal) if args.journal else None
    key_path = Path(args.public_key) if args.public_key else None
    try:
        report = inspect_journal(journal_path, public_key_path=key_path)
    except EvidencePrivacyInspectionError as exc:
        print(f"igris evidence inspect: {exc}", file=sys.stderr)
        return EXIT_INVALID

    print("OK: local verification passed; privacy inspection used zero network requests")
    print(
        f"events: {report.event_count} "
        f"(decisions: {report.decision_count}, outcomes: {report.outcome_count})"
    )
    print(
        f"decisions: allowed={report.allowed_count}, denied={report.denied_count}; "
        f"outcomes: succeeded={report.succeeded_count}, failed={report.failed_count}"
    )
    counts = report.classifications
    print(
        "classifications: "
        f"fully_redacted={counts.fully_redacted}, "
        f"partially_redacted={counts.partially_redacted}, "
        f"no_arguments={counts.no_arguments}, unknown={counts.unknown}"
    )
    for action in report.actions:
        name = json.dumps(action.action_name, ensure_ascii=False)
        detail = f"action {name}: {action.classification.value}"
        if action.retained_parameter_names:
            parameters = ", ".join(
                json.dumps(parameter, ensure_ascii=False)
                for parameter in action.retained_parameter_names
            )
            detail += f"; parameters that may retain content: {parameters}"
        print(detail)
        if args.verbose:
            print(f"  reason: {action.explanation}")

    if report.safe_for_upload:
        print(f"SAFE under policy {report.policy}: no retained or unknown argument content found")
        return EXIT_OK
    print(
        f"ACKNOWLEDGEMENT REQUIRED under policy {report.policy}: "
        "sync will refuse unless every business argument is redacted or "
        "--allow-unredacted is supplied for that invocation"
    )
    return EXIT_PRIVACY_ACK_REQUIRED


def _cmd_evidence_status(args: argparse.Namespace) -> int:
    try:
        status = get_batch_status(args.batch_id)
    except EvidenceSyncConfigurationError as exc:
        print(f"igris evidence status: {exc}", file=sys.stderr)
        return EXIT_USAGE
    except EvidenceSyncError as exc:
        print(f"igris evidence status: {exc}", file=sys.stderr)
        return EXIT_INVALID

    for field in (
        "batch_id",
        "evidence_state",
        "execution_provenance",
        "events_accepted",
        "events_verified",
        "verification_key_id",
        "received_at",
        "verified_at",
        "verification_error_code",
        "chain_head",
    ):
        print(f"{field}: {status.get(field)}")
    return EXIT_OK


def _cmd_key_info() -> int:
    try:
        identity = LocalSigningIdentity.load_or_create()
    except IdentityError as exc:
        print(f"igris key-info: {exc}", file=sys.stderr)
        return EXIT_USAGE
    print(f"key_id:      {identity.key_id}")
    print(f"fingerprint: sha256:{identity.fingerprint}")
    print(f"public_key:  {identity.public_key_path}")
    return EXIT_OK


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
