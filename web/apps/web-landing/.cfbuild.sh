#!/bin/bash
# Cloudflare Pages build script

set -e  # Exit on error

echo "🔧 Installing dependencies..."
pnpm install

echo "🏗️  Building with @cloudflare/next-on-pages..."
npx @cloudflare/next-on-pages@1

echo "🖼️  Copying public assets..."
# Check if public directory exists
if [ -d "public" ]; then
    echo "✓ Found public directory, copying assets..."
    cp -r public/* .vercel/output/static/ || echo "Warning: Could not copy all public assets"
else
    echo "⚠️  Warning: public directory not found at $(pwd)/public"
    echo "Checking alternate locations..."
    ls -la
fi

echo "📦 Copying functions..."
mkdir -p .vercel/output/static/_functions
if [ -d "functions" ]; then
    cp -r functions/. .vercel/output/static/_functions/ || echo "Warning: Could not copy functions"
else
    echo "⚠️  Warning: functions directory not found"
fi

echo "✅ Build complete!"
echo "📊 Files in output:"
ls -la .vercel/output/static/ | head -30
echo ""
echo "🎨 Images in output:"
find .vercel/output/static -maxdepth 1 -name "*.png" -o -name "*.svg" | head -10 || echo "No images found!"
