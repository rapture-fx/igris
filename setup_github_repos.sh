#!/bin/bash
# Igris SDK GitHub Setup Script
# This script creates GitHub repositories and pushes all SDKs

set -e  # Exit on error

GITHUB_ORG="igris-inertial"
SDK_LANGUAGES=("python" "rust" "javascript" "go" "java" "csharp" "ruby")

echo "========================================="
echo "Igris SDK GitHub Setup"
echo "========================================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "ERROR: GitHub CLI (gh) is not installed."
    echo "Install with: brew install gh"
    echo "Or visit: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "ERROR: Not authenticated with GitHub CLI."
    echo "Please run: gh auth login"
    exit 1
fi

echo "GitHub CLI is installed and authenticated."
echo ""

# Ask for confirmation
read -p "This will create 7 public repositories. Continue? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "========================================="
echo "Step 1: Creating GitHub Repositories"
echo "========================================="
echo ""

for sdk in "${SDK_LANGUAGES[@]}"; do
    repo_name="igris-${sdk}-sdk"

    echo "Creating ${GITHUB_ORG}/${repo_name}..."

    gh repo create "${GITHUB_ORG}/${repo_name}" \
        --public \
        --description "Official ${sdk^} SDK for Igris - AI routing and cost optimization" \
        || echo "Repository may already exist, continuing..."

    echo "Created: ${repo_name}"
    echo ""
done

echo ""
echo "========================================="
echo "Step 2: Adding Remote Origins"
echo "========================================="
echo ""

BASE_DIR="/Users/wira/Desktop/system"

for sdk in "${SDK_LANGUAGES[@]}"; do
    sdk_dir="${BASE_DIR}/igris-${sdk}-sdk"

    if [ -d "$sdk_dir" ]; then
        cd "$sdk_dir"

        # Remove existing origin if present
        git remote remove origin 2>/dev/null || true

        # Add new origin
        git remote add origin "https://github.com/${GITHUB_ORG}/igris-${sdk}-sdk.git"

        echo "Added remote origin for igris-${sdk}-sdk"
    else
        echo "WARNING: Directory not found: $sdk_dir"
    fi
done

echo ""
echo "========================================="
echo "Step 3: Pushing to GitHub"
echo "========================================="
echo ""

read -p "Ready to push all SDKs to GitHub? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted. You can push manually later."
    exit 0
fi

for sdk in "${SDK_LANGUAGES[@]}"; do
    sdk_dir="${BASE_DIR}/igris-${sdk}-sdk"

    if [ -d "$sdk_dir" ]; then
        cd "$sdk_dir"

        echo "Pushing igris-${sdk}-sdk..."

        git push -u origin main

        # Create and push v1.0.0 tag
        git tag v1.0.0 2>/dev/null || true
        git push origin v1.0.0 2>/dev/null || true

        echo "Pushed: igris-${sdk}-sdk"
        echo ""
    fi
done

echo ""
echo "========================================="
echo "SUCCESS!"
echo "========================================="
echo ""
echo "All SDKs have been pushed to GitHub:"
echo ""

for sdk in "${SDK_LANGUAGES[@]}"; do
    echo "  https://github.com/${GITHUB_ORG}/igris-${sdk}-sdk"
done

echo ""
echo "Next steps:"
echo "  1. Configure repository settings (Issues, Discussions, topics)"
echo "  2. Publish to package managers (PyPI, crates.io, npm, etc.)"
echo "  3. See SDK_MIGRATION_SUMMARY.md for details"
echo ""
