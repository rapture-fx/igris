"""Release metadata guards for the Embedded SDK package."""

from __future__ import annotations

from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # Python 3.10: tomllib landed in 3.11
    import tomli as tomllib

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def load_pyproject() -> dict:
    return tomllib.loads((PROJECT_ROOT / "pyproject.toml").read_text(encoding="utf-8"))


class TestPackageMetadata:
    def test_alpha2_prerelease_version_is_consistent(self):
        import igris

        assert load_pyproject()["project"]["version"] == "0.1.0a2"
        assert igris.__version__ == "0.1.0a2"

    def test_distribution_metadata_stays_embedded_and_minimal(self):
        project = load_pyproject()["project"]

        assert project["name"] == "igris-sdk"
        assert project["requires-python"] == ">=3.10"
        assert project["dependencies"] == ["cryptography>=42.0"]
        assert project["readme"] == "README.md"
        assert project["license"] == {"text": "MIT"}

    def test_declared_python_classifiers_match_release_matrix(self):
        classifiers = set(load_pyproject()["project"]["classifiers"])

        for version in ("3.10", "3.11", "3.12", "3.13"):
            assert f"Programming Language :: Python :: {version}" in classifiers

    def test_console_entry_point_and_typed_marker_are_declared(self):
        pyproject = load_pyproject()

        assert pyproject["project"]["scripts"] == {"igris": "igris.cli:main"}
        assert (PROJECT_ROOT / "src" / "igris" / "py.typed").is_file()

    def test_artifact_include_policy_keeps_distribution_small(self):
        sdist = load_pyproject()["tool"]["hatch"]["build"]["targets"]["sdist"]

        assert sdist["include"] == [
            "src/igris",
            "docs/evidence-privacy.md",
            "docs/wrapping-existing-tools.md",
            "docs/durable-action-quickstart.md",
            "README.md",
            "LICENSE",
        ]
        assert (PROJECT_ROOT / "LICENSE").is_file()
        assert "tests" not in sdist["include"]
        assert "examples" not in sdist["include"]
