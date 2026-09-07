# v0.1.0-alpha.2 final — deterministic artifact hashes

Package version: `0.1.0a2` (PEP 440 prerelease; alpha.1 shipped as
`0.1.0a1`, so `0.1.0a1 < 0.1.0a2` orders naturally).

Built with `scripts/ci/sdk_artifact_check.sh` (two isolated builds compared
byte-for-byte, contents inspected, wheel and sdist installed into separate
clean virtual environments, all `__all__` exports plus `wrap_tool` /
`wrap_tools` / `ToolWrapError` / `evidence inspect` / exit code 3 verified,
`igris --version` reporting `igris 0.1.0a2`, `pip check` clean). Nothing was
published.

Artifacts are a pure function of the `sdk/python` tree, so the hashes are
pinned to that tree object rather than a single commit:

- `sdk/python` tree: `e8a13aa09db701201561437563bce194b6de1ae9`
  (verify with `git rev-parse <commit>:sdk/python`)
- Branch: `release/igris-private-alpha-v0.1.0-alpha.2-final`, based on
  alpha.1-final `f9fced56595b3e050f1c25ac7728c08f738ace9f` (identity
  `0.1.0a1`)

| Artifact | Size (bytes) | SHA-256 |
| --- | --- | --- |
| `igris-0.1.0a2-py3-none-any.whl` | 56900 | `e01c11512c0167d636c1f38037d4f775f3508268e9228ec165a7ad1c55b73ea7` |
| `igris-0.1.0a2.tar.gz` | 51930 | `7af1d65f8d0736ec92e4f822435072745c960c6535cc26071bde74db85817e24` |

Superseded hashes: the pre-rebase build of this branch (tree `cad67f97f`,
before the alpha.1 `0.1.0a1` lineage and its README install line were
incorporated) produced `2ea81169…` / `c59908b5…`; the alpha.2 *candidate*
branch (version string still `0.1.0`, tree `da8e27aac`) produced
`bfb9596c…` / `06cbff4f…`. Both are obsolete. Alpha.1's `0.1.0a1` hashes
(`48cb74a8…` / `5cc7a59f…`) remain recorded in
`private-alpha-merge-manifest.md`.
