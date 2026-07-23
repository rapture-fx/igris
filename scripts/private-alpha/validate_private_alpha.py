#!/usr/bin/env python3
"""Build and validate the private-alpha experience in temporary directories."""

from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXAMPLE = ROOT / "examples" / "private-alpha"
CONNECTED_URL_ENV = "IGRIS_ALPHA_TEST_API_URL"
CONNECTED_KEY_ENV = "IGRIS_ALPHA_TEST_API_KEY"


class ValidationFailure(RuntimeError):
    pass


def scrub(text: str, secrets: tuple[str, ...]) -> str:
    for secret in secrets:
        if secret:
            text = text.replace(secret, "<REDACTED>")
    return text


def run(
    command: list[str],
    *,
    env: dict[str, str] | None = None,
    secrets: tuple[str, ...] = (),
) -> str:
    printable = " ".join(command)
    print(f"RUN: {printable}")
    completed = subprocess.run(  # noqa: S603 - commands are fixed by this local harness
        command,
        cwd=ROOT,
        env=env,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        check=False,
    )
    output = scrub(completed.stdout, secrets)
    if output:
        print(output, end="" if output.endswith("\n") else "\n")
    if completed.returncode != 0:
        raise ValidationFailure(f"command exited {completed.returncode}: {printable}")
    return output


def require_patterns(output: str, patterns: tuple[str, ...], step: str) -> None:
    missing = [pattern for pattern in patterns if pattern not in output]
    if missing:
        raise ValidationFailure(f"{step} output is missing: {', '.join(missing)}")


def build_wheel(temp_root: Path) -> Path:
    uv = shutil.which("uv")
    if uv is None:
        raise ValidationFailure("uv is required to build the private-alpha wheel")
    dist = temp_root / "dist"
    dist.mkdir()
    run([uv, "build", "--wheel", "--out-dir", str(dist), str(ROOT / "sdk" / "python")])
    wheels = list(dist.glob("igris_sdk-*.whl"))
    if len(wheels) != 1:
        raise ValidationFailure(f"expected one wheel, found {len(wheels)}")
    return wheels[0]


def create_environment(temp_root: Path, wheel: Path) -> tuple[Path, dict[str, str]]:
    venv = temp_root / "venv"
    run([sys.executable, "-m", "venv", str(venv)])
    python = venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    run([str(python), "-m", "pip", "install", str(wheel)])

    env = os.environ.copy()
    bin_dir = str(python.parent)
    env["PATH"] = bin_dir + os.pathsep + env.get("PATH", "")
    env["IGRIS_HOME"] = str(temp_root / "igris-home")
    env.pop("IGRIS_API_URL", None)
    env.pop("IGRIS_API_KEY", None)
    return python, env


def validate_embedded(python: Path, env: dict[str, str]) -> None:
    demo = run([str(python), str(EXAMPLE / "refund_demo.py")], env=env)
    require_patterns(
        demo,
        (
            "ALLOWED: synthetic_refund_recorded",
            "DENIED: function did not execute",
            "FAILED: function executed locally and raised RuntimeError",
            f"JOURNAL: {env['IGRIS_HOME']}/journal.jsonl",
        ),
        "Embedded demo",
    )

    igris = python.parent / ("igris.exe" if os.name == "nt" else "igris")
    run([str(igris), "key-info"], env=env)
    verified = run(
        [
            str(igris),
            "verify",
            f"{env['IGRIS_HOME']}/journal.jsonl",
            "--public-key",
            f"{env['IGRIS_HOME']}/verify_key.pem",
        ],
        env=env,
    )
    require_patterns(verified, ("OK: 5 event(s) verified",), "offline verification")

    inspected = run(
        [str(python), str(EXAMPLE / "inspect_journal.py"), f"{env['IGRIS_HOME']}/journal.jsonl"],
        env=env,
    )
    require_patterns(
        inspected,
        (
            "events: 5",
            "decision.allowed: 2",
            "decision.denied: 1",
            "outcome.succeeded: 1",
            "outcome.failed: 1",
        ),
        "journal inspection",
    )


def validate_connected(python: Path, embedded_env: dict[str, str], temp_root: Path) -> None:
    endpoint = os.environ.get(CONNECTED_URL_ENV, "").strip()
    api_key = os.environ.get(CONNECTED_KEY_ENV, "").strip()
    if not endpoint or not api_key:
        raise ValidationFailure(
            f"Connected validation requires both {CONNECTED_URL_ENV} and {CONNECTED_KEY_ENV}"
        )

    env = embedded_env.copy()
    env["IGRIS_API_URL"] = endpoint
    env["IGRIS_API_KEY"] = api_key
    env["IGRIS_HOME"] = str(temp_root / "igris-connected-home")
    secrets = (api_key,)
    igris = python.parent / ("igris.exe" if os.name == "nt" else "igris")

    run([str(python), str(EXAMPLE / "refund_demo.py")], env=env, secrets=secrets)
    sync_output = run(
        [
            str(igris),
            "evidence",
            "sync",
            f"{env['IGRIS_HOME']}/journal.jsonl",
            "--public-key",
            f"{env['IGRIS_HOME']}/verify_key.pem",
        ],
        env=env,
        secrets=secrets,
    )
    match = re.search(r"^  batch ([^:]+): verified,", sync_output, re.MULTILINE)
    if match is None:
        raise ValidationFailure("Connected sync did not return a verified batch id")
    status = run([str(igris), "evidence", "status", match.group(1)], env=env, secrets=secrets)
    require_patterns(
        status,
        ("evidence_state: verified", "execution_provenance: embedded"),
        "evidence status",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--connected",
        action="store_true",
        help=(
            f"also use the explicit disposable endpoint in {CONNECTED_URL_ENV} and "
            f"{CONNECTED_KEY_ENV}"
        ),
    )
    args = parser.parse_args()

    completed: list[str] = []
    try:
        with tempfile.TemporaryDirectory(prefix="igris-private-alpha-") as temp_dir:
            temp_root = Path(temp_dir)
            wheel = build_wheel(temp_root)
            completed.append("wheel build")
            python, env = create_environment(temp_root, wheel)
            completed.append("clean wheel install")
            validate_embedded(python, env)
            completed.append("Embedded demo + offline verification")
            if args.connected:
                validate_connected(python, env, temp_root)
                completed.append("Connected contract + evidence sync/status")
    except (OSError, ValidationFailure) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        print("SUMMARY: FAIL")
        for step in completed:
            print(f"  PASS: {step}")
        return 1

    print("SUMMARY: PASS")
    for step in completed:
        print(f"  PASS: {step}")
    if not args.connected:
        print("  SKIP: Connected (no explicit --connected request)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
