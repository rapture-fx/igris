# Phase 13 Branch Management Guide

**Generated:** 2025-10-11
**Base Branch:** `fix/ci-architecture-alignment`
**Target Branches:** `phase13-agent1`, `phase13-agent2`, `phase13-agent3`

---

## Table of Contents

1. [Overview](#overview)
2. [Repository Status](#repository-status)
3. [Branch Creation](#branch-creation)
4. [Conflict Detection](#conflict-detection)
5. [Merge Strategies](#merge-strategies)
6. [Safe Merge Procedures](#safe-merge-procedures)
7. [Conflict Resolution](#conflict-resolution)
8. [Pull Request Workflow](#pull-request-workflow)
9. [Automated Scripts](#automated-scripts)
10. [Best Practices](#best-practices)

---

## Overview

This guide provides comprehensive instructions for managing three parallel Phase 13 development branches based on the latest development branch (`fix/ci-architecture-alignment`) which contains 9 commits ahead of `main`.

### Current Repository State

- **Main Branch:** `main` (production)
- **Development Branch:** `fix/ci-architecture-alignment` (9 commits ahead of main)
- **Total Modified Files:** ~4,661 files changed since main
- **Phase 13 Branches:** 3 parallel branches for concurrent development

### Branch Strategy

```
main (production)
  │
  └─── fix/ci-architecture-alignment (development - not yet merged)
         │
         ├─── phase13-agent1 (parallel work stream 1)
         ├─── phase13-agent2 (parallel work stream 2)
         └─── phase13-agent3 (parallel work stream 3)
```

---

## Repository Status

### Development Branch Details

**Branch:** `fix/ci-architecture-alignment`
**Latest Commit:** `406c62266 - Integration Layer, Validation, and Production Rollout`

**Commit History (last 10):**
```
406c62266  Integration Layer, Validation, and Production Rollout
a269274d8  Autonomous Reliability Layer
97cd2cae8  Predictive Intelligence Layer with forecast models
42d0b927d  Implementation Status: 100% COMPLETE
079468a46  Completing AI-Driven Policy Autotuner
53aadb935  Production Hardening
4b9c8a13a  fix: aggressive TypeScript suppression for Linguist
9d1c31846  fix: realign GitHub Linguist to Rust + Go + Python
2bae5dd62  Adaptive Orchestration Layer (AOL)
34ab5090c  Landing page copy
```

### Major Components Added

- **Autonomous Control Core** (`rust_kernel/src/autonomous/`)
- **SLO Enforcer & Auditor** (`rust_kernel/src/slo_enforcer/`)
- **Autonomic Scheduler** (`go_gateway/internal/scheduler/`)
- **Predictive Intelligence** (`rust_kernel/src/predictive/`)
- **Reinforcement Learning** (`rust_kernel/src/rl/`)
- **Orchestration Layer** (`rust_kernel/src/orchestration/`)
- **Integration Test Suite** (`integration/tests/`)
- **Chaos Testing** (`chaos/`)
- **Deployment Infrastructure** (`deploy/`)

---

## Branch Creation

### Automated Branch Creation

Use the provided script to create all three branches:

```bash
./phase13_branch_management.sh
```

**What this script does:**
1. Fetches latest changes from origin
2. Checks out and updates `fix/ci-architecture-alignment`
3. Creates `phase13-agent1`, `phase13-agent2`, `phase13-agent3`
4. Pushes all branches to origin
5. Generates status report

### Manual Branch Creation

If you prefer manual creation:

```bash
# Ensure base branch is up to date
git checkout fix/ci-architecture-alignment
git pull origin fix/ci-architecture-alignment

# Create phase13-agent1
git checkout -b phase13-agent1
git push -u origin phase13-agent1

# Create phase13-agent2
git checkout fix/ci-architecture-alignment
git checkout -b phase13-agent2
git push -u origin phase13-agent2

# Create phase13-agent3
git checkout fix/ci-architecture-alignment
git checkout -b phase13-agent3
git push -u origin phase13-agent3
```

### Verify Branch Creation

```bash
git branch -a | grep phase13
```

Expected output:
```
  phase13-agent1
  phase13-agent2
  phase13-agent3
  remotes/origin/phase13-agent1
  remotes/origin/phase13-agent2
  remotes/origin/phase13-agent3
```

---

## Conflict Detection

### Automated Conflict Detection

Run the conflict detection script to simulate merges and identify potential conflicts:

```bash
./phase13_conflict_detector.sh
```

**This script will:**
1. Analyze changed files in each branch
2. Simulate merges back to base branch
3. Detect conflicts between parallel branches
4. Generate JSON and Markdown reports

**Output Files:**
- `phase13_conflict_report.json` - Machine-readable conflict data
- `phase13_conflict_report.md` - Human-readable conflict report

### Manual Conflict Detection

Check for overlapping changes between branches:

```bash
# Compare two branches for common modified files
git diff --name-only fix/ci-architecture-alignment...phase13-agent1 | sort > agent1_files.txt
git diff --name-only fix/ci-architecture-alignment...phase13-agent2 | sort > agent2_files.txt
comm -12 agent1_files.txt agent2_files.txt
```

### Dry-run Merge Test

Test merge without committing:

```bash
git checkout fix/ci-architecture-alignment
git merge --no-commit --no-ff phase13-agent1

# Check for conflicts
git status

# Abort the test merge
git merge --abort
```

---

## Merge Strategies

### Strategy 1: Merge (--no-ff) ✅ RECOMMENDED

**Best for:** Phase 13 parallel branches

**Pros:**
- Preserves complete branch history
- Clear visualization of parallel work
- Easy to trace feature development
- Non-destructive

**Cons:**
- Can create "merge commit clutter"
- History may be complex

**Command:**
```bash
git merge --no-ff phase13-agent1
```

**When to use:**
- Feature branches with significant changes
- Parallel development streams
- When history preservation is important

---

### Strategy 2: Rebase

**Best for:** Linear history preference

**Pros:**
- Clean, linear history
- No merge commits
- Easy to follow chronologically

**Cons:**
- Rewrites commit history (dangerous if shared)
- Conflicts must be resolved per commit
- Can be confusing for beginners

**Command:**
```bash
git checkout phase13-agent1
git rebase fix/ci-architecture-alignment
git push --force-with-lease origin phase13-agent1
```

**When to use:**
- Before merging to clean up commits
- Private branches not yet pushed
- When linear history is critical

⚠️ **WARNING:** Never rebase branches that others are working on!

---

### Strategy 3: Squash Merge

**Best for:** Many small commits

**Pros:**
- Combines all commits into one
- Very clean history
- Good for cleanup

**Cons:**
- Loses granular commit history
- Hard to trace individual changes
- Cannot easily revert specific changes

**Command:**
```bash
git merge --squash phase13-agent1
git commit -m "Add Phase 13 Agent 1 features"
```

**When to use:**
- Many WIP commits
- Feature complete but messy history
- Cleanup before final merge

---

## Safe Merge Procedures

### Pre-Merge Checklist

Before merging any branch:

- [ ] All tests passing (`cargo test`, `go test`)
- [ ] Branch is up to date with base
- [ ] Code review completed
- [ ] No debug code or TODOs
- [ ] Documentation updated
- [ ] CHANGELOG updated (if applicable)
- [ ] Backup branch created

### Step-by-Step Merge Procedure

#### 1. Create Backup Branch

```bash
git checkout phase13-agent1
git checkout -b phase13-agent1-backup
```

#### 2. Update Base Branch

```bash
git checkout fix/ci-architecture-alignment
git fetch origin
git pull origin fix/ci-architecture-alignment
```

#### 3. Create Merge Preparation Branch

```bash
git checkout -b merge-prep-agent1
```

#### 4. Attempt Merge

```bash
git merge --no-ff phase13-agent1
```

#### 5a. If NO Conflicts

```bash
# Run tests
cargo test --workspace
go test ./...

# If tests pass
git push origin merge-prep-agent1

# Create pull request or merge to base
git checkout fix/ci-architecture-alignment
git merge --ff-only merge-prep-agent1
git push origin fix/ci-architecture-alignment

# Clean up
git branch -d merge-prep-agent1
```

#### 5b. If Conflicts Occur

```bash
# View conflicts
git status

# See conflicting files
git diff --name-only --diff-filter=U

# Resolve each file
# Option 1: Manual resolution in editor
vim <conflicting-file>

# Option 2: Use merge tool
git mergetool

# Option 3: Accept one side completely
git checkout --theirs <file>  # Use incoming changes
git checkout --ours <file>    # Use current branch

# After resolving all conflicts
git add .
git commit

# Run tests
cargo test --workspace
go test ./...
```

#### 6. Post-Merge Verification

```bash
# Verify merge commit
git log --oneline -1

# Check diff
git diff fix/ci-architecture-alignment

# Run full test suite
cargo test --workspace
go test ./...

# Check for any uncommitted changes
git status
```

---

## Conflict Resolution

### Understanding Conflict Markers

When git encounters conflicts, it marks them like this:

```
<<<<<<< HEAD (current branch - fix/ci-architecture-alignment)
let cache_size = 1024;
=======
let cache_size = 2048;
>>>>>>> phase13-agent1 (incoming branch)
```

**Resolution steps:**
1. Decide which version to keep (or combine both)
2. Remove conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
3. Save the file
4. `git add <file>`

### Common Conflict Scenarios

#### 1. Cargo.lock / Cargo.toml Conflicts

**Scenario:** Dependency version conflicts

**Resolution:**
```bash
# Usually safe to accept theirs and rebuild
git checkout --theirs rust_kernel/Cargo.lock
cargo build  # Regenerates lock file
git add rust_kernel/Cargo.lock
```

#### 2. Source Code Conflicts

**Scenario:** Same function modified in both branches

**Resolution:**
- Carefully review both versions
- Understand the intent of each change
- Manually merge to preserve both intents
- Test thoroughly after resolution

#### 3. Configuration File Conflicts

**Scenario:** Config values changed in both branches

**Resolution:**
```bash
# Review both changes
git diff --ours --theirs <config-file>

# Manually merge needed values
vim <config-file>

# Validate configuration
# (run app/tests to ensure config is valid)
```

#### 4. New File Added in Both Branches

**Scenario:** Same filename, different content

**Resolution:**
```bash
# Rename one or merge content
mv old_filename new_filename
git add old_filename new_filename
```

### Conflict Resolution Tools

#### Git Mergetool

Configure and use:
```bash
# Configure (one-time)
git config --global merge.tool vimdiff  # or: meld, kdiff3, etc.

# Use during conflict
git mergetool
```

#### VS Code Integration

If using VS Code:
1. Open conflicting file
2. Click "Accept Current Change" / "Accept Incoming Change" / "Accept Both Changes"
3. Or manually edit
4. Save and stage

#### Command Line Helpers

```bash
# Show conflicts with context
git diff --merge

# Show conflicts for specific file
git diff <file>

# Show what changed on each side
git log --merge --left-right --oneline

# Undo merge and start over
git merge --abort
```

---

## Pull Request Workflow

### Creating Pull Requests

For each branch, create a pull request using the generated template:

```bash
# Generate PR templates for all branches
./phase13_merge_helper.sh pr
```

This creates:
- `pr_template_phase13-agent1.md`
- `pr_template_phase13-agent2.md`
- `pr_template_phase13-agent3.md`

### PR Template Structure

Each template includes:
- **Summary** - Brief description of changes
- **Changes** - Checklist of modifications
- **Testing** - Test verification checklist
- **Merge Checklist** - Pre-merge requirements
- **Deployment Notes** - Special considerations
- **Related Issues** - Issue references

### PR Review Process

1. **Create PR** on GitHub/GitLab
2. **Assign reviewers** from the team
3. **Run CI/CD** checks automatically
4. **Address feedback** from reviewers
5. **Update PR** with fixes
6. **Approve** after review complete
7. **Merge** using chosen strategy

### PR Best Practices

- Keep PRs focused and reasonably sized
- Write clear PR descriptions
- Link to related issues
- Include test evidence (screenshots, logs)
- Respond to review comments promptly
- Squash fixup commits before merge
- Delete branch after successful merge

---

## Automated Scripts

### 1. Branch Management Script

**File:** `phase13_branch_management.sh`

**Usage:**
```bash
./phase13_branch_management.sh
```

**Functions:**
- Creates all three Phase 13 branches
- Pushes to origin
- Generates status report

---

### 2. Conflict Detection Script

**File:** `phase13_conflict_detector.sh`

**Usage:**
```bash
./phase13_conflict_detector.sh
```

**Functions:**
- Simulates merges for each branch
- Detects parallel branch conflicts
- Generates JSON and Markdown reports

**Output:**
- `phase13_conflict_report.json`
- `phase13_conflict_report.md`

---

### 3. Merge Helper Script

**File:** `phase13_merge_helper.sh`

**Usage:**
```bash
# Interactive mode
./phase13_merge_helper.sh

# Command line mode
./phase13_merge_helper.sh strategies   # Show merge strategies
./phase13_merge_helper.sh commands     # Generate merge commands
./phase13_merge_helper.sh pr           # Generate PR templates
./phase13_merge_helper.sh checklist    # Show pre-merge checklist
./phase13_merge_helper.sh tips         # Show conflict tips
```

**Functions:**
- Interactive merge guidance
- Generate merge commands
- Create PR templates
- Provide conflict resolution tips

---

## Best Practices

### Development Workflow

1. **Start Work**
   ```bash
   git checkout phase13-agent1
   git pull origin phase13-agent1
   git checkout -b feature/my-feature
   ```

2. **Regular Commits**
   ```bash
   git add .
   git commit -m "feat: add new component"
   ```

3. **Stay Updated**
   ```bash
   # Regularly merge base branch
   git fetch origin
   git merge origin/fix/ci-architecture-alignment
   ```

4. **Push Work**
   ```bash
   git push origin feature/my-feature
   ```

5. **Merge to Phase Branch**
   ```bash
   git checkout phase13-agent1
   git merge --no-ff feature/my-feature
   git push origin phase13-agent1
   ```

### Commit Message Conventions

Follow conventional commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructure
- `test`: Add tests
- `chore`: Maintenance

**Examples:**
```
feat(scheduler): add cooldown window enforcement
fix(slo): correct HMAC signature verification
docs(phase13): update branch management guide
```

### Testing Strategy

**Before Pushing:**
```bash
# Rust tests
cargo test --workspace
cargo clippy --all-targets --all-features

# Go tests
go test ./...
go vet ./...
```

**Before Merging:**
```bash
# Full integration test suite
cargo test --workspace --release
go test ./... -v

# Check for warnings
cargo build --workspace 2>&1 | grep warning
```

### Code Review Guidelines

**For Authors:**
- Keep PRs < 500 lines when possible
- Write clear descriptions
- Self-review before requesting review
- Include test evidence
- Respond to feedback promptly

**For Reviewers:**
- Review within 24 hours
- Be constructive and specific
- Test locally if possible
- Approve only when confident
- Check for security issues

### Branch Hygiene

**Regular Cleanup:**
```bash
# Delete merged branches locally
git branch --merged | grep -v "\*" | xargs git branch -d

# Delete merged branches remotely
git remote prune origin

# Clean up stale tracking branches
git fetch --prune
```

**Branch Naming:**
- Use descriptive names
- Include type prefix (feature/, fix/, docs/)
- Keep names lowercase with hyphens
- Avoid special characters

---

## Troubleshooting

### Problem: "Branch already exists"

```bash
# Force recreate
git branch -D phase13-agent1
git checkout -b phase13-agent1 fix/ci-architecture-alignment
```

### Problem: "Merge conflict in binary file"

```bash
# Accept one version
git checkout --theirs <binary-file>
# or
git checkout --ours <binary-file>

git add <binary-file>
```

### Problem: "Can't push - remote has changes"

```bash
# Pull with rebase
git pull --rebase origin phase13-agent1

# Or merge
git pull origin phase13-agent1
```

### Problem: "Accidentally merged wrong branch"

```bash
# Undo last merge (if not pushed)
git reset --hard HEAD~1

# If already pushed
git revert -m 1 HEAD
```

---

## Appendix A: Quick Reference

### Essential Commands

```bash
# Branch operations
git checkout <branch>
git checkout -b <new-branch>
git branch -d <branch>
git push -u origin <branch>

# Merge operations
git merge --no-ff <branch>
git merge --abort
git mergetool

# Conflict resolution
git status
git diff --name-only --diff-filter=U
git checkout --ours <file>
git checkout --theirs <file>

# Testing
cargo test --workspace
go test ./...

# Cleanup
git branch --merged | xargs git branch -d
git remote prune origin
```

### File Locations

| File | Purpose |
|------|---------|
| `phase13_branch_management.sh` | Create all branches |
| `phase13_conflict_detector.sh` | Detect merge conflicts |
| `phase13_merge_helper.sh` | Merge assistance and guidance |
| `phase13_conflict_report.json` | Machine-readable conflict data |
| `phase13_conflict_report.md` | Human-readable conflict report |
| `pr_template_*.md` | Pull request templates |

---

## Appendix B: Recommended Merge Order

Based on typical development patterns:

1. **First:** Merge `phase13-agent1` (assuming minimal conflicts)
2. **Second:** Merge `phase13-agent2` (incorporating agent1 changes)
3. **Third:** Merge `phase13-agent3` (incorporating agent1 + agent2)

**Rationale:** Sequential merging allows each merge to incorporate previous work, reducing compound conflicts.

**Alternative (if branches are independent):**
- Merge in order of completion
- Merge smallest changes first
- Merge most critical features first

---

## Support and Questions

If you encounter issues:

1. Check this guide
2. Run `./phase13_merge_helper.sh` for interactive help
3. Review conflict detection reports
4. Consult git documentation: `git help <command>`
5. Contact team lead or senior developer

---

**Document Version:** 1.0
**Last Updated:** 2025-10-11
**Author:** Phase 13 Branch Management Automation
