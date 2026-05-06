#!/bin/bash

# Build script for documentation deployment
# Current repo layout only includes web-docs-hub, so this script
# builds that app and copies its static export into a deployable output dir.

set -e  # Exit on error

echo "🚀 Building Documentation Site..."
echo "🔧 Current directory: $(pwd)"
echo ""

# Find the web directory (where package.json is located)
# The script can be run from different locations:
# - From web/apps/: need to go up one level (../package.json)
# - From web/: already there (package.json)
# - From repo root: need to go to web/ (web/package.json)

echo "🔍 Looking for package.json..."
echo "  Current dir: $(pwd)"
echo "  Checking ../package.json: $([ -f "../package.json" ] && echo "EXISTS" || echo "NOT FOUND")"
echo "  Checking ./package.json: $([ -f "package.json" ] && echo "EXISTS" || echo "NOT FOUND")"
echo "  Checking web/package.json: $([ -f "web/package.json" ] && echo "EXISTS" || echo "NOT FOUND")"

if [ -f "../package.json" ]; then
  echo "✅ Found ../package.json (running from web/apps/)"
  cd ..
  WEB_DIR="$(pwd)"
  echo "📁 WEB_DIR set to: $WEB_DIR"
elif [ -f "package.json" ]; then
  echo "✅ Found package.json in current directory (already in web/)"
  WEB_DIR="$(pwd)"
elif [ -f "web/package.json" ]; then
  echo "✅ Found web/package.json (running from repo root)"
  WEB_DIR="$(pwd)/web"
else
  echo "❌ Error: Could not find package.json"
  echo "Current directory: $(pwd)"
  echo "Contents: $(ls -la | head -10)"
  if [ -d ".." ]; then
    echo "Parent directory ($(cd .. && pwd)) contents:"
    ls -la .. | head -10
  fi
  exit 1
fi

echo "📦 Working directory: $WEB_DIR"
echo ""

# Install dependencies (from web directory - monorepo root for web apps)
echo "📦 Installing dependencies from $WEB_DIR..."
cd "$WEB_DIR"
pnpm install

# Navigate to apps directory
cd "$WEB_DIR/apps"

# Clean previous builds
echo ""
echo "🧹 Cleaning previous builds..."
rm -rf combined-docs-output
mkdir -p combined-docs-output

# Build docs hub
echo ""
echo "📦 Building Docs Hub (/)..."
cd web-docs-hub
pnpm run build
cd ..

if [ ! -d "web-docs-hub/out" ]; then
  echo "❌ Error: web-docs-hub build completed but no out/ directory was generated"
  exit 1
fi

# Copy output
echo ""
echo "🔄 Preparing deploy output..."

echo "  Copying docs hub output"
cp -r web-docs-hub/out/. combined-docs-output/

# Summary
echo ""
echo "✅ Build complete!"
echo ""
echo "📁 Output structure:"
echo "   combined-docs-output/"
echo "   ├── index.html"
echo "   ├── docs/"
echo "   └── ..."
echo ""
echo "🌐 Deploy the 'combined-docs-output' directory to Cloudflare Pages"
echo ""
