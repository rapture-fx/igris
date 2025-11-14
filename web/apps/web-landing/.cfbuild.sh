#!/bin/bash
# Cloudflare Pages build script

set -e  # Exit on error

echo "🔧 Installing dependencies..."
pnpm install

echo "🏗️  Building with @cloudflare/next-on-pages..."
npx @cloudflare/next-on-pages@1

echo "🖼️  Copying public assets..."
cp -r public/* .vercel/output/static/

echo "📦 Copying functions..."
mkdir -p .vercel/output/static/_functions
cp -r functions/. .vercel/output/static/_functions/

echo "✅ Build complete!"
echo "📊 Files in output:"
ls -la .vercel/output/static/ | head -30
echo ""
echo "🎨 Images:"
ls -la .vercel/output/static/*.png .vercel/output/static/*.svg 2>/dev/null || echo "No PNG/SVG files found!"
