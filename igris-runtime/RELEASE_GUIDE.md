# Igris Runtime Release Guide

This guide explains how to create releases for igris-runtime on the **main system repository** (Igris-inertial/Igris).

---

## Overview

Releases are automated via GitHub Actions and publish to **this repository's releases page**, not a separate repo.

**Release URL**: `https://github.com/Igris-inertial/Igris/releases`

---

## Release Process

### 1. Update Version

Edit `igris-runtime/Cargo.toml`:

```toml
[workspace.package]
version = "1.7.0"  # Update this
```

### 2. Update CHANGELOG

Create or update release notes (optional but recommended):

```bash
cd igris-runtime
nano V1.7_RELEASE_NOTES.md
```

### 3. Commit Changes

```bash
git add igris-runtime/Cargo.toml
git commit -m "Bump igris-runtime to v1.7.0"
```

### 4. Create and Push Tag

**Important**: Use `runtime-v*` prefix (not just `v*`):

```bash
# Create tag
git tag -a runtime-v1.7.0 -m "Igris Runtime v1.7.0 - Production Release"

# Push tag to trigger release
git push origin runtime-v1.7.0
```

### 5. Automated Build

GitHub Actions will automatically:
- Build for 4 platforms (Linux x64/ARM64, macOS x64/ARM64)
- Create release on **this repo**: `Igris-inertial/Igris`
- Upload binaries:
  - `igris-runtime-linux-x64.tar.gz`
  - `igris-runtime-linux-arm64.tar.gz`
  - `igris-runtime-macos-x64.tar.gz`
  - `igris-runtime-macos-arm64.tar.gz`
  - `install.sh`

### 6. Verify Release

Check: `https://github.com/Igris-inertial/Igris/releases`

Test installation:
```bash
curl -sSL https://raw.githubusercontent.com/Igris-inertial/Igris/main/igris-runtime/install.sh | bash
```

---

## Release Workflow Location

**Workflow**: `.github/workflows/igris-runtime-release.yml` (in repo root)

**Trigger**: Push tags matching `runtime-v*`

---

## Tag Naming Convention

- ✅ `runtime-v1.7.0` - Correct (triggers release)
- ✅ `runtime-v1.7.0-rc1` - Correct (prerelease)
- ❌ `v1.7.0` - Wrong (doesn't trigger runtime release)
- ❌ `1.7.0` - Wrong (missing prefix)

---

## Manual Release (if needed)

If automated release fails, create manually:

1. Build locally:
```bash
cd igris-runtime
cargo build --release
```

2. Package:
```bash
cd target/release
tar czf igris-runtime-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m).tar.gz igris-runtime
```

3. Create release on GitHub:
   - Go to: `https://github.com/Igris-inertial/Igris/releases/new`
   - Tag: `runtime-v1.7.0`
   - Upload `.tar.gz` files

---

## Installation Testing

After release, test on each platform:

### Linux
```bash
curl -sSL https://raw.githubusercontent.com/Igris-inertial/Igris/main/igris-runtime/install.sh | bash
igris-runtime --version
```

### macOS
```bash
curl -sSL https://raw.githubusercontent.com/Igris-inertial/Igris/main/igris-runtime/install.sh | bash
igris-runtime --version
```

---

## Troubleshooting

### Release not triggered
- Check tag format: must be `runtime-v*`
- Check workflow file exists at `.github/workflows/igris-runtime-release.yml`
- Check GitHub Actions tab for errors

### Build fails
- Check Rust version compatibility (requires 1.75+)
- Check cross-compilation setup for Linux ARM64
- Check macOS runner availability

### Install script fails
- Verify release assets were uploaded
- Check file naming matches: `igris-runtime-{platform}.tar.gz`
- Test with `TEST_MODE=true ./install.sh` locally first

---

## Current Version

**Latest**: v1.6.0
**Next**: v1.7.0 (planned)

---

## Repository Structure

```
Igris-inertial/Igris/               # Main repo
├── .github/workflows/
│   └── igris-runtime-release.yml   # Release automation
├── igris-runtime/                  # Runtime subdirectory
│   ├── Cargo.toml                  # Version here
│   ├── install.sh                  # Installation script
│   └── ...
└── ...
```

**All releases publish to the main repo, not a separate repository.**

---

## Quick Commands

```bash
# Bump version, commit, tag, and push
cd igris-runtime
vim Cargo.toml  # Update version
cd ..
git add igris-runtime/Cargo.toml
git commit -m "Bump runtime to v1.7.0"
git tag -a runtime-v1.7.0 -m "Release v1.7.0"
git push origin main
git push origin runtime-v1.7.0
```

Done! GitHub Actions will handle the rest.
