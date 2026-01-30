# Quick Start: Publish Igris SDKs to GitHub

All automated migration tasks are complete. Follow these steps to publish to GitHub.

## Prerequisites

Install GitHub CLI if not already installed:

```bash
brew install gh
```

Authenticate:

```bash
gh auth login
```

## Option 1: Automated Setup (Recommended)

Run the setup script to create repos and push code automatically:

```bash
./setup_github_repos.sh
```

The script will:
1. Create 7 public GitHub repositories
2. Add remote origins to local git repos
3. Push all code to GitHub
4. Create v1.0.0 tags

Total time: 10 minutes

## Option 2: Manual Setup

### Step 1: Create GitHub Organization

Visit: https://github.com/organizations/new

- Organization name: `igris-inertial`
- Plan: Free (for open source)

### Step 2: Create Repositories

```bash
gh repo create igris-inertial/igris-python-sdk --public
gh repo create igris-inertial/igris-rust-sdk --public
gh repo create igris-inertial/igris-javascript-sdk --public
gh repo create igris-inertial/igris-go-sdk --public
gh repo create igris-inertial/igris-java-sdk --public
gh repo create igris-inertial/igris-csharp-sdk --public
gh repo create igris-inertial/igris-ruby-sdk --public
```

### Step 3: Add Remote Origins

```bash
cd /Users/wira/Desktop/system/igris-python-sdk
git remote add origin https://github.com/igris-inertial/igris-python-sdk.git

cd /Users/wira/Desktop/system/igris-rust-sdk
git remote add origin https://github.com/igris-inertial/igris-rust-sdk.git

cd /Users/wira/Desktop/system/igris-javascript-sdk
git remote add origin https://github.com/igris-inertial/igris-javascript-sdk.git

cd /Users/wira/Desktop/system/igris-go-sdk
git remote add origin https://github.com/igris-inertial/igris-go-sdk.git

cd /Users/wira/Desktop/system/igris-java-sdk
git remote add origin https://github.com/igris-inertial/igris-java-sdk.git

cd /Users/wira/Desktop/system/igris-csharp-sdk
git remote add origin https://github.com/igris-inertial/igris-csharp-sdk.git

cd /Users/wira/Desktop/system/igris-ruby-sdk
git remote add origin https://github.com/igris-inertial/igris-ruby-sdk.git
```

### Step 4: Push to GitHub

```bash
# Python SDK
cd /Users/wira/Desktop/system/igris-python-sdk
git push -u origin main
git tag v1.0.0
git push origin v1.0.0

# Rust SDK
cd /Users/wira/Desktop/system/igris-rust-sdk
git push -u origin main
git tag v1.0.0
git push origin v1.0.0

# JavaScript SDK
cd /Users/wira/Desktop/system/igris-javascript-sdk
git push -u origin main
git tag v1.0.0
git push origin v1.0.0

# Go SDK
cd /Users/wira/Desktop/system/igris-go-sdk
git push -u origin main
git tag v1.0.0
git push origin v1.0.0

# Java SDK
cd /Users/wira/Desktop/system/igris-java-sdk
git push -u origin main
git tag v1.0.0
git push origin v1.0.0

# C# SDK
cd /Users/wira/Desktop/system/igris-csharp-sdk
git push -u origin main
git tag v1.0.0
git push origin v1.0.0

# Ruby SDK
cd /Users/wira/Desktop/system/igris-ruby-sdk
git push -u origin main
git tag v1.0.0
git push origin v1.0.0
```

## Post-Publication Configuration

For each repository, configure:

1. Navigate to repository Settings
2. Enable Issues
3. Enable Discussions
4. Add repository topics:
   - `igris`
   - `ai-routing`
   - `llm`
   - `sdk`
   - `[language]` (e.g., `python`, `rust`, `javascript`)
5. Enable branch protection on `main`

## Verification

After pushing, verify all repositories:

```bash
gh repo list igris-inertial
```

Expected output: 7 repositories

Visit each repository:
- https://github.com/igris-inertial/igris-python-sdk
- https://github.com/igris-inertial/igris-rust-sdk
- https://github.com/igris-inertial/igris-javascript-sdk
- https://github.com/igris-inertial/igris-go-sdk
- https://github.com/igris-inertial/igris-java-sdk
- https://github.com/igris-inertial/igris-csharp-sdk
- https://github.com/igris-inertial/igris-ruby-sdk

## Next: Publish to Package Managers

See `SDK_MIGRATION_SUMMARY.md` for package manager publication commands.

## Troubleshooting

**"Repository already exists"**
- Continue with script, it will add remote origins and push

**"Authentication failed"**
- Run: `gh auth login`
- Follow prompts to authenticate

**"Permission denied"**
- Verify you have write access to igris-inertial organization
- Check SSH keys are configured

**"No such file or directory"**
- Verify paths in script match your system
- Edit `setup_github_repos.sh` if needed

## Support

For issues:
- Check logs in terminal
- Review SDK_MIGRATION_SUMMARY.md
- Verify GitHub CLI installation: `gh --version`
