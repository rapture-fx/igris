#!/bin/bash
# Verify repository sync status

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Repository Sync Verification                        ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Current branch
echo "📍 Current Branch:"
git branch --show-current
echo ""

# Check if fix/ci-architecture-alignment is in sync
echo "🔄 Checking fix/ci-architecture-alignment sync..."
git fetch origin --quiet

LOCAL=$(git rev-parse fix/ci-architecture-alignment)
REMOTE=$(git rev-parse origin/fix/ci-architecture-alignment)

if [ "$LOCAL" = "$REMOTE" ]; then
    echo "✅ fix/ci-architecture-alignment is IN SYNC with remote"
    echo "   Local:  $LOCAL"
    echo "   Remote: $REMOTE"
else
    echo "⚠️  fix/ci-architecture-alignment is OUT OF SYNC"
    echo "   Local:  $LOCAL"
    echo "   Remote: $REMOTE"
    echo ""
    echo "   To update, run:"
    echo "   git checkout fix/ci-architecture-alignment"
    echo "   git pull origin fix/ci-architecture-alignment"
fi
echo ""

# Check phase13 branches
echo "📋 Phase 13 Branches Status:"
if git show-ref --verify --quiet refs/heads/phase13-agent1; then
    echo "   ✅ phase13-agent1 EXISTS locally"
else
    echo "   ❌ phase13-agent1 does NOT exist locally"
fi

if git show-ref --verify --quiet refs/heads/phase13-agent2; then
    echo "   ✅ phase13-agent2 EXISTS locally"
else
    echo "   ❌ phase13-agent2 does NOT exist locally"
fi

if git show-ref --verify --quiet refs/heads/phase13-agent3; then
    echo "   ✅ phase13-agent3 EXISTS locally"
else
    echo "   ❌ phase13-agent3 does NOT exist locally"
fi
echo ""

# Check remote phase13 branches
echo "🌐 Remote Phase 13 Branches:"
git ls-remote --heads origin | grep phase13 || echo "   ❌ No phase13 branches on remote yet"
echo ""

# Untracked files
echo "📄 Untracked Files:"
git status --short | grep "^??" | awk '{print "   " $2}'
echo ""

echo "════════════════════════════════════════════════════════"
echo "✅ Verification complete!"
echo "════════════════════════════════════════════════════════"
