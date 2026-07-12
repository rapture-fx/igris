# v0.1.0-alpha.2 candidate — deterministic artifact hashes

Built with `scripts/ci/sdk_artifact_check.sh` (two isolated builds compared
byte-for-byte, contents inspected, wheel and sdist installed into separate
clean virtual environments, all `__all__` exports plus `wrap_tool` /
`wrap_tools` / `ToolWrapError` / `evidence inspect` / exit code 3 verified,
`pip check` clean). Nothing was published.

Artifacts are a pure function of the `sdk/python` tree, so the hashes are
pinned to that tree object rather than a single commit:

- `sdk/python` tree: `da8e27aacb751e0c4defce2d3feb735ef04ebac4`
  (verify with `git rev-parse <commit>:sdk/python`)

| Artifact | Size (bytes) | SHA-256 |
| --- | --- | --- |
| `igris-0.1.0-py3-none-any.whl` | 56870 | `bfb9596cb5a73adca0d67d3a0af9a229cba5072ff9781c941cc0110c86c3cd5e` |
| `igris-0.1.0.tar.gz` | 51928 | `06cbff4f6307257db60559a63babdfa46e38fef58d23c160b1b5aafc0fc485b0` |

Note: the wheel differs from the alpha.1 hashes by construction — alpha.2
changes `sdk/python` sources, `README.md` (embedded in wheel METADATA), and
the sdist include list.
