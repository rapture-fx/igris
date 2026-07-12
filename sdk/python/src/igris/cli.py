"""The ``igris`` command-line interface (standard library ``argparse`` only).

Commands:

* ``igris verify [JOURNAL_PATH]`` — verify a local evidence journal offline.
  Exit code 0 only when the journal is fully valid.
* ``igris key-info`` — print the local public key identity. Never prints
  private-key material.
* ``igris evidence sync [JOURNAL_PATH]`` — EXPLICITLY verify the local
  journal and upload it to the configured Connected endpoint. Requires
  ``IGRIS_API_URL`` and ``IGRIS_API_KEY``. Exit code 0 only for a successful
  (or safely replayed / already up-to-date) upload. Guarded execution never
  triggers this.
* ``igris evidence inspect [JOURNAL_PATH]`` — verify and classify argument
  retention locally. Never performs network activity or prints values.
* ``igris evidence status BATCH_ID`` — fetch a previously uploaded batch's
  tenant-scoped verification status.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import __version__
from .errors import (
    EvidencePrivacyInspectionError,
    EvidencePrivacyPreflightError,
    EvidenceSyncConfigurationError,
    EvidenceSyncError,
    IdentityError,
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
    parser.error(f"unknown command {args.command!r}")
    return EXIT_USAGE  # unreachable; parser.error exits


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
