#!/bin/bash
set -e  # stop if any command fails

# Ensure you're on the latest main
git checkout main
git pull origin main

# Create and push Phase 13 branch
git checkout -b feature/phase13-cognitive-control
git push -u origin feature/phase13-cognitive-control

# Back to main before next branch
git checkout main

# Create and push Phase 12.3 branch
git checkout -b feature/phase12-3-federation
git push -u origin feature/phase12-3-federation

# Back to main before next branch
git checkout main

# Create and push research docs branch
git checkout -b docs/research-whitepaper
git push -u origin docs/research-whitepaper

# Back to main before next branch
git checkout main

# Create and push coordinator/sync branch
git checkout -b coordinator/branch-sync
git push -u origin coordinator/branch-sync

# Final confirmation
git branch -a
echo "✅ All branches created and pushed successfully!"

