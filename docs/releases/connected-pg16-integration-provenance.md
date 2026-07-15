# Connected PostgreSQL 16 integration provenance

**Integration base:** `1ef093a96dc8ae55c317266aa9b0dc94e5b08579`
(`origin/main`, private alpha.2)

**Integration branch:** `release/igris-connected-pg16-final`

This document records the replay of the reviewed Connected staging and
PostgreSQL 16 release lane onto private alpha.2. The replay preserves the
original implementation order and places each NO-GO review immediately after
the exact stage it reviewed. It does not claim production readiness, package
publication, deployment, or application of migrations to a shared database.

## Commit provenance map

| Stage | Source commit | Integrated commit | Subject |
| --- | --- | --- | --- |
| Bootstrap contract | `1776ad1279559ef5dcee23c9bb9a042ba8cee915` | `e80b8620a371c3eec0404a11db805acfca974266` | docs(db): record migration topology and bootstrap contract |
| Connected bootstrap | `4d9aaea9954f2b53b0cebc75313f2565dfc2985e` | `361620698dfb22ef26fa5f6e1ed5f28c6a6050d8` | feat(db): add deterministic Connected bootstrap |
| Bootstrap regression tests | `37d5989c215b3a3ae9463d94a2e6d7b7e755721f` | `21e0898c774aa0a353b04ac9a4fae6d10d64e9c1` | test(db): verify bootstrap equivalence and failures |
| Recovery runbook | `9c7c4d904419414b476850985b60d9aa246dbad0` | `c86e1b84246bf9e46b05d624462e5e2fd01fe072` | docs(db): add bootstrap recovery runbook |
| Role boundary | `d5485fc49117ea03db779f4c6ad30f97dd07670e` | `74bc6332af6008903c557a9c5c2fea9f336e23f4` | feat(db): add least-privilege Connected roles and boundary tests |
| Staging preflight | `fdde20873919cb21e5800092b5725d16c332ea74` | `801ce9c5683268285ae6d78a5a13a7a220eb3eff` | feat(db): add Connected staging preflight and disposable smoke |
| Operations documentation | `7a9c06f15853f51e60bd23a828a9422cee4b70f5` | `18ec3f864c2fb019a1811154148252ae483a9e84` | docs(ops): document Connected staging roles and smoke procedures |
| PostgreSQL 16 CI | `d9b3851905b2fdba6e924b5f4cded72de0a543fc` | `bc3487522d6eef0437390be23f2992f657908354` | ci(private-alpha): run Connected bootstrap, roles, and preflight on PostgreSQL 16 |
| PostgreSQL 16 helper | `6799acb9f92d64c1953c6b607f19a4cc7ec9664b` | `6c0a1ef62161b6c9f404833f3e95f40ff9b9822a` | docs(ops): record PostgreSQL 16 local proof and validation helper |
| First NO-GO review | `9e47d7cd33ad55ab59b3ecbb51d4c5465eea8592` | `2f5647ff7612fb64ffc81695fbb313d9735225ed` | docs(security): gate Connected staging PG16 operational delta |
| Helper fail-closed remediation | `51780adef86238ade1b36ac6788ba76de04dc124` | `0b51250f3b18945ffdb9bade4614e18496bec478` | fix(connected): fail closed PG16 local validation |
| Structural manifest v1 | `e1f89c7b5c1ba505c53d88e66556e46eeb1c7fbf` | `e14c25913cfa3268e9bcc96624323c83ffe08c42` | fix(database): pin post-role structural manifest |
| Workflow remediation | `9f81c516b96b4e98ec213a60ad22cd5cf4e98a62` | `675e63d17a0a1878e2146cf69620ebbe462f3182` | ci(postgres): harden staging validation workflows |
| First remediation record | `c53e55b87bb646fcc7dcdb7fa35c82966e5d1598` | `a17674b8dd27a5566290e5607d52c866744c162f` | docs(security): record PG16 blocker remediation |
| Second NO-GO review | `2b1baadfc7d3795c50a7c9373812e05c79999f94` | `82325f1c10a6e9234a2d0ddf4ef3fa1472cca9a9` | docs(security): reject PG16 remediation release gate |
| Structural manifest v2 | `bb73d93d6aadb6fe1bf9ee76f9bda784756a2e23` | `f6da41aa52e520e7f6006427f0027d2fd78c3579` | fix(database): canonicalize structural manifest integrity |
| Manifest mutation coverage | `0e8979b7bd727171ea0991247cec9236db4b4c69` | `d3e91df8d5d3516eeed9cf8fce63c0f6351284e0` | test(database): cover structural manifest mutations |
| Manifest v2 security record | `1a75456b5424aabdf6c6c670bee8e6b31a34239b` | `0a94386da5a69fa9330981bd57e7c6550e38479e` | docs(security): document structural manifest v2 |

The source SHAs are retained on their local topic branches. The integrated
SHAs differ because the commits were replayed onto current `origin/main`; the
content and ordering are reviewable directly in this branch.

## Frozen invariants

- Migrations `001` through `069` are byte-identical to the integration base.
- The Python SDK tree, including Evidence v1 and ActionContract v1 public
  surfaces, is byte-identical to the integration base.
- Canonical ActionContract fixtures and the existing privacy preflight release
  gate are byte-identical to the integration base.
- Package identity remains `0.1.0a2`.
- Application startup does not apply migrations.
- Runtime configuration does not fall back to migration-owner credentials.
- Legacy-provider bootstrap remains outside the supported Connected scope.
- No shared database migration, deployment, or package publication is part of
  this integration.

The expected PostgreSQL 16 validation digests are:

- pre-role v069 manifest:
  `034f5f75d2c926baecc67840cf6054309463bbf145c3691e5673c00ab8a36cf4`
- post-role structural manifest v2:
  `d166fffa05546550ebb8fb3d613ea96ef977c4376461c9cb5a10d0359a9946a0`

## Human reviewer focus

- Confirm canonical v2 uses explicit text-backed fields and unambiguous framing
  so security-relevant definitions cannot truncate at PostgreSQL's 63-byte
  `name` boundary.
- Confirm exact trigger enable mode is enforced and structural hashing remains
  separate from ACL and ownership verification.
- Confirm no runtime privilege expansion or application-startup migration path
  was introduced.
- Confirm destructive helper operations require positive identity for the
  disposable local cluster and cannot target a shared or unrelated cluster.
- Confirm hosted CI ran the PostgreSQL 16 helper, structural mutation,
  operational failure-path, migration guard, Python matrix, and Go jobs at the
  exact PR head.

Human approval and complete hosted CI remain mandatory before merge.
