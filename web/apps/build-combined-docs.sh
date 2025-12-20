#!/bin/bash

# Build script for combined documentation deployment
# This creates a single output directory with:
#   / -> Hub page
#   /overture -> Overture docs
#   /runtime -> Runtime docs

set -e  # Exit on error

echo "🚀 Building Combined Documentation Site..."
echo "🔧 Current directory: $(pwd)"
echo ""

# Find the web directory (where package.json is located)
# Cloudflare runs from repo root, so we need to navigate to web/
if [ -f "web/package.json" ]; then
  echo "✅ Found web/package.json (running from repo root)"
  WEB_DIR="$(pwd)/web"
elif [ -f "package.json" ]; then
  echo "✅ Found package.json in current directory (already in web/)"
  WEB_DIR="$(pwd)"
else
  echo "❌ Error: Could not find package.json"
  echo "Current directory: $(pwd)"
  echo "Contents: $(ls -la | head -10)"
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

# Build Hub
echo ""
echo "📦 Building Hub (/)..."
cd web-docs-hub
pnpm run build
cd ..

# Build Overture Docs
echo ""
echo "📦 Building Overture Docs (/overture)..."
cd web-docs
NEXT_PUBLIC_USE_BASEPATH=true pnpm run build
cd ..

# Build Runtime Docs
echo ""
echo "📦 Building Runtime Docs (/runtime)..."
cd web-docs-runtime
NEXT_PUBLIC_USE_BASEPATH=true pnpm run build
cd ..

# Combine outputs
echo ""
echo "🔄 Combining outputs..."

# Copy hub (root level)
echo "  Copying hub to /"
cp -r web-docs-hub/out/* combined-docs-output/

# Copy Overture docs
echo "  Copying Overture docs to /overture"
mkdir -p combined-docs-output/overture
cp -r web-docs/out/* combined-docs-output/overture/

# Copy Runtime docs
echo "  Copying Runtime docs to /runtime"
mkdir -p combined-docs-output/runtime
cp -r web-docs-runtime/out/* combined-docs-output/runtime/

# Summary
echo ""
echo "✅ Build complete!"
echo ""
echo "📁 Output structure:"
echo "   combined-docs-output/"
echo "   ├── index.html              (Hub page)"
echo "   ├── overture/"
echo "   │   ├── index.html          (Overture redirect)"
echo "   │   └── docs/               (Overture docs)"
echo "   └── runtime/"
echo "       ├── index.html          (Runtime redirect)"
echo "       └── docs/               (Runtime docs)"
echo ""
echo "🌐 Deploy the 'combined-docs-output' directory to Cloudflare Pages"
echo ""
