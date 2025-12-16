#!/bin/bash
# Cloudflare Pages build script (OpenNext adapter)

set -e  # Exit on error

# Save current directory
SCRIPT_DIR="$(pwd)"

echo "🔧 Current directory: $SCRIPT_DIR"
echo "🔧 Installing dependencies..."
pnpm install

echo "🏗️  Building with @opennextjs/cloudflare..."
npx @opennextjs/cloudflare

echo "📊 Checking what was built..."
echo "Contents of .open-next:"
ls -la .open-next/ | head -20 || echo "Build output location may have changed"

echo ""
echo "✅ Build complete!"
