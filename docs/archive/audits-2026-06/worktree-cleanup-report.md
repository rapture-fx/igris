# Worktree cleanup report

Date: 2026-07-24

Canonical remote: `origin/main`

Canonical SHA: `018d1c17df32f18b1c990d0d1a9e88c0e7a368e3`

## Result

- `origin/main` exactly matched the supplied post-PR-83 SHA after
  `git fetch --prune origin`.
- No worktree was locked and Git reported no prunable metadata before cleanup.
- Two worktrees were clean, unlocked, pushed, and fully reachable from
  `origin/main`; only those two were removed.
- No branch, stash, dirty worktree, unique commit, or unpushed worktree was
  deleted.
- Free disk space increased from approximately 4.5 GiB to 7.0 GiB
  (approximately 2.5 GiB recovered as measured by `df -h`).

## Classification

`Reachable` means the worktree HEAD is an ancestor of the fetched
`origin/main`. `Locked` reflects Git worktree metadata, not filesystem flags.

| Classification | Path | Branch | HEAD | Dirty | Locked | Reachable | Reason |
|---|---|---|---|---:|---:|---:|---|
| KEEP | `<workspace-parent>/system` | `feature/clock-3b-contract-bound-durable-action` | `0740f3d90a59a0730ead10f7a1fbae85e8e0b9fe` | yes | no | yes | User-owned untracked files; never clean automatically. |
| KEEP | `<temporary-worktree>` | `docs/hosted-alpha-product-truth` | `639a2c122d8ff206f8423ea320507ff3b3218afc` at inventory time | no | no | no | Active worktree for this task. |
| ARCHIVE | `<workspace-parent>/igris-audit-dogfood` | `audit/core-product-readiness-after-dogfood` | `424bbf2b65c4923ecfc85afc928818a5b586a7d3` | no | no | no | Unique local commit; branch tracks `origin/main`, not a matching remote branch. |
| ARCHIVE | `<workspace-parent>/system-clock-3b-r2-ratification` | `review/clock-3b-contract-bound-durable-action-final-ratification` | `441f2fa75a4f8baff64ba50d99e2f2f5c9aad67b` | no | no | no | Unique and no upstream. |
| ARCHIVE | `<workspace-parent>/system-clock-3b-ratification` | detached | `7733998f4d521340fa753cf073adf325a32122a2` | no | no | no | Detached unique review commit. |
| ARCHIVE | `<workspace-parent>/system-clock-3c-final-ratification` | `review/clock-3c-final-ratification` | `83e28b66539a890d958c7bd368af63ce132015ee` | no | no | no | Unique and no upstream. |
| ARCHIVE | `<workspace-parent>/system-clock-3c-r-ratification` | `review/clock-3c-stable-linked-proof-ratification` | `13b4658de512cc5fab4bea7c578bcbd521b7314f` | no | no | no | Unique and no upstream. |
| MANUAL_REVIEW | `<workspace-parent>/system-clock-3f` | `feature/clock-3f-product-validation` | `c46b4d8c22d7c7ec50f54f8001621fb28fe94b1c` | no | no | no | Pushed branch but not merged into current main. |
| ARCHIVE | `<workspace-parent>/system-worktrees/connected-evidence-security-gate` | `feature/igris-connected-evidence-security-gate` | `c281a7c656aa9fdd891efe93e48da719952a5e38` | no | no | no | Unique and no upstream. |
| ARCHIVE | `<workspace-parent>/system-worktrees/connected-sync-security-gate` | `feature/igris-connected-sync-security-gate` | `478f67f3578ab83bdd3189992a9211ed69be7eaa` | no | no | no | Unique and no upstream. |
| SAFE_REMOVE (removed) | `<workspace-parent>/system-worktrees/external-action-targets` | `feature/external-action-targets` | `ced032f171c861365ddd1e4798d6a592e55571f4` | no | no | yes | Pushed, merged by PR #83, clean, and unlocked. Branch ref preserved. |
| MANUAL_REVIEW | `<workspace-parent>/system-worktrees/external-alpha-docs` | `feature/external-alpha-docs` | `8736b4c64b5eec35878dc2b8a7d3f9cc819144e6` | no | no | no | Pushed but not merged; broad stale delta. |
| MANUAL_REVIEW | `<workspace-parent>/system-worktrees/external-alpha-landing` | `feature/external-alpha-landing` | `b85758d95297b73a6a11dce6f96f6de5a5c9fdb6` | no | no | no | Pushed but not merged; broad stale delta. |
| MANUAL_REVIEW | `<workspace-parent>/system-worktrees/external-alpha-product-surface` | `feature/external-alpha-product-surface` | `3b81803fd8931b2a40296b109b62e3f8f93bf55f` | no | no | no | Pushed but not merged; broad stale delta. |
| ARCHIVE | `<workspace-parent>/system-worktrees/external-alpha-readiness` | `feature/external-alpha-readiness` | `ab035744ab1632591b77410ea287556d386c198b` | no | no | no | Unique local tip with no upstream. |
| MANUAL_REVIEW | `<workspace-parent>/system-worktrees/external-alpha-sdk-distribution` | `feature/external-alpha-sdk-distribution` | `8e1192ebe6e2b907afc35ed2a52c76db016414d1` | no | no | no | Pushed but not merged; package-publication work requires ownership review. |
| ARCHIVE | `<workspace-parent>/system-worktrees/igris-2e1-independent-review` | `review/igris-standalone-verifier-2e1-gate` | `80004480b3a2362e82ed8fb1c31c388d91651c7b` | no | no | no | Unique and no upstream. |
| ARCHIVE | `<workspace-parent>/system-worktrees/igris-2e3-confirmation` | `review/igris-standalone-verifier-2e3-confirmation` | `29a4d2b75deda22058ddab53f8cc851669a9a626` | no | no | no | Unique and no upstream. |
| ARCHIVE | `<workspace-parent>/system-worktrees/igris-connected-staging-foundation` | `feature/igris-connected-staging-foundation` | `7a9c06f15853f51e60bd23a828a9422cee4b70f5` | no | no | no | Unique and no upstream. |
| ARCHIVE | `<workspace-parent>/system-worktrees/igris-connected-staging-foundation-pg16` | `feature/igris-connected-staging-foundation-pg16` | `6799acb9f92d64c1953c6b607f19a4cc7ec9664b` | no | no | no | Unique and no upstream. |
| ARCHIVE | `<workspace-parent>/system-worktrees/igris-connected-staging-pg16-final-gate` | `review/igris-connected-staging-pg16-final-gate` | `9e47d7cd33ad55ab59b3ecbb51d4c5465eea8592` | no | no | no | Unique review tip; misleading upstream is `origin/main`. |
| ARCHIVE | `<workspace-parent>/system-worktrees/igris-connected-staging-pg16-remediation-final-gate` | `review/igris-connected-staging-pg16-remediation-final-gate` | `2b1baadfc7d3795c50a7c9373812e05c79999f94` | no | no | no | Unique and no upstream. |
| ARCHIVE | `<workspace-parent>/system-worktrees/igris-connected-staging-pg16-security-blockers` | `fix/igris-connected-staging-pg16-security-blockers` | `c53e55b87bb646fcc7dcdb7fa35c82966e5d1598` | no | no | no | Unique and no upstream. |
| ARCHIVE | `<workspace-parent>/system-worktrees/igris-evidence-privacy-preflight` | `feature/igris-evidence-privacy-preflight` | `fa2e8da61a353d9b1eecb9dbd055a3098ee4b8fe` | no | no | no | Unique and no upstream. |
| ARCHIVE | `<workspace-parent>/system-worktrees/igris-existing-tool-wrapper` | `feature/igris-existing-tool-wrapper` | `666ddb8e67db6de2baf4872a67782feb607332bb` | no | no | no | Unique and no upstream. |
| ARCHIVE | `<workspace-parent>/system-worktrees/igris-greenfield-database-bootstrap` | `feature/igris-greenfield-database-bootstrap` | `2f043f656d604ec19b055fc669280492e4995255` | no | no | no | Unique and no upstream. |
| ARCHIVE | `<workspace-parent>/system-worktrees/igris-pg16-structural-manifest-integrity` | `fix/igris-pg16-structural-manifest-integrity` | `1a75456b5424aabdf6c6c670bee8e6b31a34239b` | no | no | no | Unique and no upstream. |
| ARCHIVE | `<workspace-parent>/system-worktrees/igris-pg16-structural-manifest-integrity-final-release-gate` | `review/igris-pg16-structural-manifest-integrity-final-release-gate` | `1a75456b5424aabdf6c6c670bee8e6b31a34239b` | no | no | no | Duplicate unique tip; no upstream. |
| ARCHIVE | `<workspace-parent>/system-worktrees/igris-private-alpha-developer-experience` | `feature/igris-private-alpha-developer-experience` | `c55ba3968399fef97d78b224438bb08d0a4457cb` | no | no | no | Unique and no upstream. |
| ARCHIVE | `<workspace-parent>/system-worktrees/igris-protocol-independent-review` | `review/igris-protocol-foundation-independent-gate` | `9514931345898505feafd2db32f6d047fe131d2f` | no | no | no | Unique and no upstream. |
| ARCHIVE | `<workspace-parent>/system-worktrees/igris-schema1-candidate-reproducibility-final` | `review/igris-schema1-candidate-reproducibility-final` | `285ecca1bfbcb7b5e4c0b20aed424109c707328c` | no | no | no | Unique and no upstream. |
| SAFE_REMOVE (removed) | `<workspace-parent>/system-worktrees/product-compression` | detached | `f99266427b6bc507ec8142b99d06f69bc31aef53` | no | no | yes | Detached commit merged by PR #82; clean and unlocked. |
| ARCHIVE | `<workspace-parent>/system-worktrees/release-private-alpha-2-candidate` | `release/igris-private-alpha-v0.1.0-alpha.2-candidate` | `7a9f30493c07520b7d4a0744927958ce6dba3f6b` | no | no | no | Unique release candidate and no upstream. |
| KEEP | `<workspace-parent>/system-worktrees/stabilize-durable-igris` | `feature/stabilize-durable-igris` | `0c13bbb7413ec9d9ad7aee233f6a73cde3695ecc` | yes | no | yes | Three untracked consolidation files; never remove dirty work. |

## Stashes retained

All nine stashes were retained:

| Stash | Object | Description |
|---|---|---|
| `stash@{0}` | `6f75dac7bd636924015a467228bd7f360b6c446f` | `On main: backup-frontend-before-purge` |
| `stash@{1}` | `d1db4a3bd941c22598b5b99101005a6f9da4b083` | `On feature/phase11_providers: frontend-wip: Web landing updates and API modifications pre-alpha-merge` |
| `stash@{2}` | `81bcbc5ef53289ca353c101151f8ef2d1b1a14fc` | `On main: Local Claude settings - keep stashed` |
| `stash@{3}` | `e9dd93e629dcaea3be763bf09e40cb32b9c21861` | `On main: Stash local claude settings on main before pull` |
| `stash@{4}` | `5b8137a4b03ba032c0e4381e6a499619a6d45eb4` | `On feature/optimizer-activation: Stash local claude settings before merge` |
| `stash@{5}` | `794e5ca140f020809ccfd618a6aaca5009da73f0` | `On main: temp stash for branch switch` |
| `stash@{6}` | `81d097b8aa8146189c8fc10b8bf6e3c6a25d698d` | `WIP on main: 213e1577c Merge pull request #50` |
| `stash@{7}` | `8c7ef894a459a121dd721a1f2a8f5018659b6b13` | `On enhancement/production-ready-v2: Temporary stash for filter-branch` |
| `stash@{8}` | `1a22083f1ecbd0d0cc4ca8c552c8b26573f198d3` | `WIP on main: ac943159c Dataset Marketplace` |

## Local branch tips not present on an origin ref

These branch tips were not contained by any fetched `origin/*` ref at audit
time. They were preserved locally and not pushed automatically:

`adaptive-scaling`, `archive/fastapi-legacy`,
`archive/pre-enhancement-20251004`,
`archive/pre-enhancement-final-20251004-195044`,
`audit/core-product-readiness-after-dogfood`, `chore/cold-start-readiness`,
`cognitive-control`, `docs/hosted-alpha-product-truth`,
`enhancement/production-ready-v2`, `feat/action-definition-digest`,
`feature/embedded-sdk-release-hardening`, `feature/external-alpha-readiness`,
`feature/igris-connected-evidence-security-gate`,
`feature/igris-connected-staging-foundation`,
`feature/igris-connected-staging-foundation-pg16`,
`feature/igris-connected-sync-security-gate`,
`feature/igris-core-integration-readiness`,
`feature/igris-evidence-privacy-preflight`,
`feature/igris-existing-tool-wrapper`,
`feature/igris-greenfield-database-bootstrap`,
`feature/igris-private-alpha-developer-experience`,
`fix/igris-connected-staging-pg16-security-blockers`,
`fix/igris-pg16-structural-manifest-integrity`,
`opt/auto-tune-20251004-172239`,
`release/igris-private-alpha-v0.1.0-alpha.2-candidate`,
`review/clock-3b-contract-bound-durable-action-final-ratification`,
`review/clock-3b-contract-bound-durable-action-ratification`,
`review/clock-3c-final-ratification`,
`review/clock-3c-stable-linked-proof-ratification`,
`review/igris-connected-staging-pg16-final-gate`,
`review/igris-connected-staging-pg16-remediation-final-gate`,
`review/igris-pg16-structural-manifest-integrity-final-release-gate`,
`review/igris-protocol-foundation-independent-gate`,
`review/igris-schema1-candidate-reproducibility-final`,
`review/igris-standalone-verifier-2e1-gate`,
`review/igris-standalone-verifier-2e3-confirmation`, and
`rfc/igris-protocol-foundation`.

## Commands executed

Read-only inventory:

```bash
git fetch --prune origin
git rev-parse origin/main
git worktree list --porcelain
git stash list
git branch -vv
git status --porcelain=v1 --untracked-files=all
git merge-base --is-ancestor <worktree-head> origin/main
git branch -r --contains <branch-head>
git worktree prune --dry-run --verbose
du -sk <worktree-path>
df -h <workspace-parent>/system
```

Cleanup:

```bash
git worktree remove <workspace-parent>/system-worktrees/external-action-targets
git worktree remove <workspace-parent>/system-worktrees/product-compression
```

No `git worktree prune` mutation was needed. No branch or stash deletion command
was executed.
