#!/usr/bin/env python3
"""Build and validate the private-alpha.2 experience in temporary directories.

Runs the alpha.2 example (one decorated action, wrapped sync tools, one
wrapped async tool) against a freshly built wheel in a clean virtual
environment, then proves the evidence-privacy behavior: offline verification,
``igris evidence inspect`` (exit code 3 on retained content), the fail-closed
sync refusal, and the one-shot ``--allow-unredacted`` acknowledgement via an
in-process recording client. Purely local: no endpoint, API key, or network.

The frozen alpha.1 harness (``validate_private_alpha.py``) is unchanged.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXAMPLE = ROOT / "examples" / "private-alpha-2"


class ValidationFailure(RuntimeError):
    pass


def run(
    command: list[str],
    *,
    env: dict[str, str] | None = None,
    expected_exit: int = 0,
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
    if completed.stdout:
        print(completed.stdout, end="" if completed.stdout.endswith("\n") else "\n")
    if completed.returncode != expected_exit:
        raise ValidationFailure(
            f"command exited {completed.returncode} (expected {expected_exit}): {printable}"
        )
    return completed.stdout


def require_patterns(output: str, patterns: tuple[str, ...], step: str) -> None:
    missing = [pattern for pattern in patterns if pattern not in output]
    if missing:
        raise ValidationFailure(f"{step} output is missing: {', '.join(missing)}")


def build_wheel(temp_root: Path) -> Path:
    uv = shutil.which("uv")
    if uv is None:
        raise ValidationFailure("uv is required to build the private-alpha.2 wheel")
    dist = temp_root / "dist"
    dist.mkdir()
    run([uv, "build", "--wheel", "--out-dir", str(dist), str(ROOT / "sdk" / "python")])
    wheels = list(dist.glob("igris-*.whl"))
    if len(wheels) != 1:
        raise ValidationFailure(f"expected one wheel, found {len(wheels)}")
    return wheels[0]


def create_environment(temp_root: Path, wheel: Path) -> tuple[Path, dict[str, str]]:
    venv = temp_root / "venv"
    run([sys.executable, "-m", "venv", str(venv)])
    python = venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    run([str(python), "-m", "pip", "install", str(wheel)])

    env = os.environ.copy()
    env["PATH"] = str(python.parent) + os.pathsep + env.get("PATH", "")
    env["IGRIS_HOME"] = str(temp_root / "igris-home")
    env.pop("IGRIS_API_URL", None)
    env.pop("IGRIS_API_KEY", None)
    return python, env


def validate_alpha2(python: Path, env: dict[str, str]) -> list[str]:
    completed: list[str] = []
    demo = run([str(python), str(EXAMPLE / "alpha2_demo.py")], env=env)
    require_patterns(
        demo,
        (
            "DECORATED ALLOWED: synthetic_refund_recorded",
            "DECORATED DENIED: function did not execute",
            "WRAPPED SYNC FULLY REDACTED: archived:tick_demo_1:resolved",
            "WRAPPED SYNC RETAINED: tagged:vip-demo-account",
            "WRAPPED FAILED: original ran locally and raised RuntimeError",
            "WRAPPED ASYNC: notified:chan_demo_oncall",
            f"JOURNAL: {env['IGRIS_HOME']}/journal.jsonl",
        ),
        "alpha.2 demo",
    )
    completed.append("decorated + wrapped sync + wrapped async actions")

    igris = python.parent / ("igris.exe" if os.name == "nt" else "igris")
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
    require_patterns(verified, ("OK: 11 event(s) verified",), "offline verification")
    completed.append("offline verification of 11 signed events")

    inspected = run([str(igris), "evidence", "inspect"], env=env, expected_exit=3)
    require_patterns(
        inspected,
        (
            "OK: local verification passed; privacy inspection used zero network requests",
            "events: 11 (decisions: 6, outcomes: 5)",
            "decisions: allowed=5, denied=1; outcomes: succeeded=4, failed=1",
            "classifications: fully_redacted=3, partially_redacted=3, "
            "no_arguments=0, unknown=0",
            "ACKNOWLEDGEMENT REQUIRED",
        ),
        "evidence inspect",
    )
    completed.append("evidence inspect classification (exit code 3 on retained content)")

    privacy = run([str(python), str(EXAMPLE / "privacy_sync_demo.py")], env=env)
    require_patterns(
        privacy,
        (
            "PRIVACY REFUSAL: sync refused before any upload",
            "ACKNOWLEDGED UPLOAD: 11 events to the recording client",
            "SECOND SYNC REFUSED: --allow-unredacted was not persisted",
        ),
        "privacy sync demo",
    )
    completed.append("fail-closed refusal + one-shot acknowledgement (recording client)")
    return completed


def main() -> int:
    completed: list[str] = []
    try:
        with tempfile.TemporaryDirectory(prefix="igris-private-alpha2-") as temp_dir:
            temp_root = Path(temp_dir)
            wheel = build_wheel(temp_root)
            completed.append("wheel build")
            python, env = create_environment(temp_root, wheel)
            completed.append("clean wheel install")
            completed.extend(validate_alpha2(python, env))
    except (OSError, ValidationFailure) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        print("SUMMARY: FAIL")
        for step in completed:
            print(f"  PASS: {step}")
        return 1

    print("SUMMARY: PASS")
    for step in completed:
        print(f"  PASS: {step}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
