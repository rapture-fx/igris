#!/bin/bash
# Check PR Status

echo "╔════════════════════════════════════════════════════════╗"
echo "║   PR Status Check                                      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Repository URL
REPO_URL="https://github.com/wiramahendra/Schlep-engine"
echo "📍 Repository: $REPO_URL"
echo ""

# Check for open PRs
echo "🔍 Checking for open PRs from fix/ci-architecture-alignment..."
gh pr list --head fix/ci-architecture-alignment --json number,title,url,state

# If no result, might be already merged or in different state
if [ $? -ne 0 ]; then
    echo ""
    echo "⚠️  No open PR found. Checking all PRs (including merged)..."
    gh pr list --head fix/ci-architecture-alignment --state all --limit 1 --json number,title,url,state
fi

echo ""
echo "════════════════════════════════════════════════════════"
echo "Direct Links:"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📋 All Pull Requests:"
echo "   $REPO_URL/pulls"
echo ""
echo "🔍 PRs from fix/ci-architecture-alignment:"
echo "   $REPO_URL/pulls?q=is%3Apr+head%3Afix%2Fci-architecture-alignment"
echo ""
echo "🌿 Compare branches:"
echo "   $REPO_URL/compare/main...fix/ci-architecture-alignment"
echo ""
echo "════════════════════════════════════════════════════════"
