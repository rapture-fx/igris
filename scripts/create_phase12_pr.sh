#!/bin/bash
# Create Pull Request for Phase 12 Completion

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Creating Phase 12 Pull Request                      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Verify we have the commits
echo "📋 Commits to be merged (9 commits):"
echo "─────────────────────────────────────────────────────────"
git log --oneline fix/ci-architecture-alignment --not main
echo "─────────────────────────────────────────────────────────"
echo ""

# Check if PR already exists
echo "🔍 Checking for existing PR..."
EXISTING_PR=$(gh pr list --head fix/ci-architecture-alignment --state open --json number --jq '.[0].number' 2>/dev/null || echo "")

if [ -n "$EXISTING_PR" ]; then
    echo "⚠️  PR #$EXISTING_PR already exists for this branch"
    echo "    View it at: https://github.com/wiramahendra/igris-inertial/pull/$EXISTING_PR"
    echo ""
    read -p "Do you want to update the existing PR? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Exiting..."
        exit 0
    fi
else
    echo "✅ No existing PR found - will create new one"
fi
echo ""

# Create the PR
echo "🚀 Creating pull request..."
echo ""

gh pr create \
    --base main \
    --head fix/ci-architecture-alignment \
    --title "Phase 12: Integration Layer, Validation, and Production Rollout" \
    --body-file PR_DESCRIPTION_PHASE12.md \
    --label "phase12,autonomous,production-ready" \
    --assignee @me

echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Pull request created successfully!"
echo "════════════════════════════════════════════════════════"
echo ""

# Show the PR
gh pr view --web

echo ""
echo "Next steps:"
echo "  1. Review the PR on GitHub"
echo "  2. Request reviews from team members"
echo "  3. Ensure all CI checks pass"
echo "  4. Merge when approved"
echo ""
