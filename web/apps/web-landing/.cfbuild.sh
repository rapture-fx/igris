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

# Build with standard Next.js
echo "🏗️  Building Next.js application..."
pnpm build

# Check if build succeeded
if [ -d ".next" ]; then
    echo "✅ Build complete! Next.js bundle ready in .next/"
    ls -la .next/ | head -20
else
    echo "❌ Build failed - .next directory not found"
    exit 1
fi
