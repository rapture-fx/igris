#!/bin/bash

# Build script for combined documentation deployment
# This creates a single output directory with:
#   / -> Hub page
#   /overture -> Overture docs
#   /runtime -> Runtime docs

set -e  # Exit on error

echo "🚀 Building Combined Documentation Site..."
echo ""

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf combined-docs-output
mkdir -p combined-docs-output

# Install dependencies (from monorepo root)
echo ""
echo "📦 Installing dependencies..."
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$(dirname "$SCRIPT_DIR")"
pnpm install
cd "$SCRIPT_DIR"

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
pnpm run build
cd ..

# Build Runtime Docs
echo ""
echo "📦 Building Runtime Docs (/runtime)..."
cd web-docs-runtime
pnpm run build
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
