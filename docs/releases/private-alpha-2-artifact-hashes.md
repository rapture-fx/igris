# v0.1.0-alpha.2 final — deterministic artifact hashes

Package version: `0.1.0a2` (PEP 440 prerelease).

Built with `scripts/ci/sdk_artifact_check.sh` (two isolated builds compared
byte-for-byte, contents inspected, wheel and sdist installed into separate
clean virtual environments, all `__all__` exports plus `wrap_tool` /
`wrap_tools` / `ToolWrapError` / `evidence inspect` / exit code 3 verified,
`igris --version` reporting `igris 0.1.0a2`, `pip check` clean). Nothing was
published.

Artifacts are a pure function of the `sdk/python` tree, so the hashes are
pinned to that tree object rather than a single commit:

- `sdk/python` tree: `cad67f97fe27772d378b1536d086b0106a4454bc`
  (verify with `git rev-parse <commit>:sdk/python`)
- Built at commit `a6f4732d4d8c4d5d02a910161001a9f2729ba877` on
  `release/igris-private-alpha-v0.1.0-alpha.2-final`

| Artifact | Size (bytes) | SHA-256 |
| --- | --- | --- |
| `igris-0.1.0a2-py3-none-any.whl` | 56899 | `2ea81169308aed40bfe56b25cd1a82ec6c27207f8e2b9cb29fe70f7432f815c4` |
| `igris-0.1.0a2.tar.gz` | 51929 | `c59908b5495217e50a199de044d24c583998936cad20f22e00a9bc49ba393789` |

Superseded hashes: the alpha.2 *candidate* branch (version string still
`0.1.0`, tree `da8e27aac`) produced `bfb9596c…` / `06cbff4f…`; those artifacts
are obsolete now that the release identity is `0.1.0a2`. Alpha.1's `0.1.0`
hashes remain recorded in `private-alpha-merge-manifest.md`.
