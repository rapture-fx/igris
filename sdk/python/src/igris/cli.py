"""The ``igris`` command-line interface (standard library ``argparse`` only).

Commands:

* ``igris verify [JOURNAL_PATH]`` — verify a local evidence journal offline.
  Exit code 0 only when the journal is fully valid.
* ``igris key-info`` — print the local public key identity. Never prints
  private-key material.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import __version__
from .errors import IdentityError
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

    args = parser.parse_args(argv)

    if args.command == "verify":
        return _cmd_verify(args)
    if args.command == "key-info":
        return _cmd_key_info()
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
