from __future__ import annotations

from pathlib import Path

import pytest

from conformance.schema1.python.check_python_lock_reproducibility import (
    DEFAULT_PROJECT,
    PythonLockReproducibilityError,
    check_python_lock_reproducibility,
)

CUTOFF = "2026-07-16T15:07:12Z"


def _write_project(
    tmp_path: Path,
    *,
    project_cutoff: str | None = CUTOFF,
    lock_cutoff: str | None = CUTOFF,
) -> Path:
    project = tmp_path / "project"
    project.mkdir()
    project_text = "[tool.uv]\n"
    if project_cutoff is not None:
        project_text += f'exclude-newer = "{project_cutoff}"\n'
    lock_text = "version = 1\n"
    if lock_cutoff is not None:
        lock_text += f'\n[options]\nexclude-newer = "{lock_cutoff}"\n'
    (project / "pyproject.toml").write_text(project_text, encoding="utf-8")
    (project / "uv.lock").write_text(lock_text, encoding="utf-8")
    return project


def test_committed_project_has_fixed_matching_cutoff() -> None:
    assert check_python_lock_reproducibility(DEFAULT_PROJECT) == CUTOFF


def test_fixed_matching_cutoff_passes(tmp_path: Path) -> None:
    project = _write_project(tmp_path)
    assert check_python_lock_reproducibility(project) == CUTOFF


@pytest.mark.parametrize(
    "cutoff", [None, "1 week", "2026-07-16", "2026-07-16T15:07:12"]
)
def test_missing_or_relative_project_cutoff_fails(
    tmp_path: Path, cutoff: str | None
) -> None:
    project = _write_project(tmp_path, project_cutoff=cutoff)
    with pytest.raises(PythonLockReproducibilityError, match="fixed RFC3339 UTC"):
        check_python_lock_reproducibility(project)


def test_invalid_calendar_timestamp_fails(tmp_path: Path) -> None:
    project = _write_project(tmp_path, project_cutoff="2026-02-30T15:07:12Z")
    with pytest.raises(PythonLockReproducibilityError, match="not a valid timestamp"):
        check_python_lock_reproducibility(project)


@pytest.mark.parametrize("lock_cutoff", [None, "2026-07-16T15:07:13Z"])
def test_missing_or_different_lock_cutoff_fails(
    tmp_path: Path, lock_cutoff: str | None
) -> None:
    project = _write_project(tmp_path, lock_cutoff=lock_cutoff)
    with pytest.raises(PythonLockReproducibilityError, match="does not record"):
        check_python_lock_reproducibility(project)
