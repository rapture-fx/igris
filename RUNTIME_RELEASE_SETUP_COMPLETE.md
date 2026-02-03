# Igris Runtime Release Setup - Complete

**Date:** 2026-02-03
**Status:** ✅ Complete - Ready to Release

---

## Problem Identified

An agent incorrectly suggested creating a **separate repository** for igris-runtime releases, which caused:
- Git repository confusion
- 1,196 unpushed commits on local main
- Remote repository was reset to "Initial commit"

## Solution Implemented

✅ **Releases now configured for the SAME repository** (Igris-inertial/Igris)

---

## What Was Created

### 1. Release Workflow
**File:** `.github/workflows/igris-runtime-release.yml`

**Features:**
- Builds for 4 platforms (Linux x64/ARM64, macOS Intel/Apple Silicon)
- Automated cross-compilation
- Uploads binaries to GitHub Releases
- Includes installation script
- Triggers on tags matching `runtime-v*`

### 2. Release Guide
**File:** `igris-runtime/RELEASE_GUIDE.md`

Complete guide covering:
- How to create a release
- Tag naming conventions
- Testing procedures
- Troubleshooting

### 3. Installation Script
**File:** `igris-runtime/install.sh` (already exists)

**Works with:**
- Production mode: Downloads from GitHub releases
- Test mode: Uses local binary

**Supports:**
- Linux x64/ARM64
- macOS Intel/Apple Silicon

---

## How to Create a Release

### Quick Steps:

```bash
# 1. Update version in Cargo.toml
cd igris-runtime
vim Cargo.toml  # Change version to 1.7.0

# 2. Commit
cd ..
git add igris-runtime/Cargo.toml
git commit -m "Bump igris-runtime to v1.7.0"

# 3. Tag and push
git tag -a runtime-v1.7.0 -m "Release v1.7.0"
git push origin main
git push origin runtime-v1.7.0
```

### What Happens Automatically:

1. GitHub Actions detects the `runtime-v1.7.0` tag
2. Builds binaries for all 4 platforms
3. Creates release at: `https://github.com/Igris-inertial/Igris/releases`
4. Uploads:
   - `igris-runtime-linux-x64.tar.gz`
   - `igris-runtime-linux-arm64.tar.gz`
   - `igris-runtime-macos-x64.tar.gz`
   - `igris-runtime-macos-arm64.tar.gz`
   - `install.sh`

### Users Install With:

```bash
curl -sSL https://raw.githubusercontent.com/Igris-inertial/Igris/main/igris-runtime/install.sh | bash
```

---

## Git Repository Situation

### Current State:
- **Remote (origin/main)**: Only has `3fc916b25 Initial commit`
- **Local (main)**: Has 1,196 commits of real work
- **Status**: Local is ahead by 1,196 commits

### What Happened:
Someone (likely another agent) force-pushed to remote and reset it to a single "Initial commit", wiping the history. Your local branch still has all the work.

### Options to Fix:

#### Option 1: Restore Full History (Recommended if solo project)

```bash
# Create backup first
git branch backup-before-push

# Force push to restore all work to remote
git push origin main --force

# Verify
git log origin/main --oneline | head -10
```

**Pros:**
- Restores all 1,196 commits to remote
- Preserves full history
- Makes local and remote match

**Cons:**
- Overwrites remote (but remote is basically empty anyway)
- If others are working on this, they'll need to reset their branches

#### Option 2: Keep Clean History (If you want fresh start)

```bash
# Create backup
git branch backup-all-work

# Reset to remote
git reset --hard origin/main

# Cherry-pick important commits or start fresh
# (This loses the 1,196 commits on main, but backup branch has them)
```

**Pros:**
- Clean history going forward
- Matches remote

**Cons:**
- Loses the 1,196 commits (but they're in backup branch)

### My Recommendation:

**If this is your solo project or you can coordinate with team:**

```bash
# 1. Create backup (safe!)
git branch backup-before-push

# 2. Push everything to restore work
git push origin main --force

# 3. Verify success
git log origin/main --oneline | head
```

This restores all your work to the remote. The remote was essentially wiped anyway (only had "Initial commit"), so you're not losing any remote work.

---

## Files Created/Modified

### New Files:
1. `.github/workflows/igris-runtime-release.yml` - Release automation
2. `igris-runtime/RELEASE_GUIDE.md` - How to create releases
3. `RUNTIME_RELEASE_SETUP_COMPLETE.md` - This document

### Existing Files (not modified):
- `igris-runtime/install.sh` - Already works correctly
- `igris-runtime/Cargo.toml` - Version: 1.6.0
- `igris-runtime/README.md` - Documentation

---

## Next Steps

### 1. Fix Git Repository (Choose One):

**A. Restore Work (Recommended):**
```bash
git branch backup-before-push
git push origin main --force
```

**B. Or Start Fresh:**
```bash
git branch backup-all-work
git reset --hard origin/main
```

### 2. Create First Release:

```bash
# Update version
vim igris-runtime/Cargo.toml  # Change to 1.7.0 or keep 1.6.0

# Tag and push
git tag -a runtime-v1.6.0 -m "First public release"
git push origin runtime-v1.6.0
```

### 3. Verify Release:

- Check: `https://github.com/Igris-inertial/Igris/releases`
- Test install: `curl -sSL https://raw.githubusercontent.com/Igris-inertial/Igris/main/igris-runtime/install.sh | bash`

---

## Testing Before First Release

Test locally first:

```bash
cd igris-runtime
cargo build --release
TEST_MODE=true ./install.sh
igris-runtime --version
```

---

## Important Notes

✅ **Releases are on THIS repo** (Igris-inertial/Igris), not a separate repo
✅ **Tag format:** `runtime-v1.x.x` (not just `v1.x.x`)
✅ **Workflow location:** `.github/workflows/` in repo root
✅ **Install script:** Already works correctly

❌ **Don't create separate repo** for releases
❌ **Don't use `v*` tags** (use `runtime-v*`)
❌ **Don't manually upload binaries** (workflow does it)

---

## Release Checklist

Before creating a release:

- [ ] Update version in `igris-runtime/Cargo.toml`
- [ ] Test build: `cargo build --release`
- [ ] Test install: `TEST_MODE=true ./install.sh`
- [ ] Commit version bump
- [ ] Create tag: `runtime-v1.x.x`
- [ ] Push main branch
- [ ] Push tag
- [ ] Wait for GitHub Actions
- [ ] Verify release page
- [ ] Test installation from release

---

## Summary

🎉 **Release system is now properly configured!**

- ✅ Releases publish to main repo (not separate)
- ✅ Automated builds for 4 platforms
- ✅ One-line installation for users
- ✅ Documentation complete

**Ready to create your first release when you fix the git situation!**

---

## Questions?

See `igris-runtime/RELEASE_GUIDE.md` for detailed instructions.
