#!/bin/bash
# Cloudflare Pages build script (Standard Next.js)

set -e  # Exit on error

echo "🔧 Current directory: $PWD"

# Verify Node.js version
echo "📦 Node.js version: $(node --version)"
echo "📦 pnpm version: $(pnpm --version)"

# Check if we're using Node 20+
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Error: Node.js 20+ required, but found Node.js $NODE_VERSION"
    echo "Please set NODE_VERSION=20.19.5 in Cloudflare Pages environment variables"
    exit 1
fi

# Install dependencies
echo "🔧 Installing dependencies..."
pnpm install

# Build with standard Next.js (static export)
echo "🏗️  Building Next.js application..."
pnpm build

# Check if build succeeded (static export outputs to 'out' directory)
if [ -d "out" ]; then
    echo "✅ Build complete! Static export ready in out/"
    echo "📦 Output directory contents:"
    ls -la out/ | head -20
elif [ -d ".next" ]; then
    echo "⚠️  Warning: .next directory found but 'out' expected for static export"
    echo "✅ Falling back to .next directory"

    # Remove cache directory (exceeds Cloudflare Pages 25MB file size limit)
    if [ -d ".next/cache" ]; then
        echo "🧹 Removing .next/cache directory..."
        rm -rf .next/cache
        echo "✅ Cache removed"
    fi

    ls -la .next/ | head -20
else
    echo "❌ Build failed - no output directory found"
    exit 1
fi
