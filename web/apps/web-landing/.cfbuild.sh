#!/bin/bash
# Cloudflare Pages build script

echo "🔧 Installing dependencies..."
pnpm install

echo "🏗️  Building with @cloudflare/next-on-pages..."
npx @cloudflare/next-on-pages@1

echo "📦 Copying functions..."
mkdir -p .vercel/output/static/_functions
cp -r functions/. .vercel/output/static/_functions/

echo "✅ Build complete!"
ls -la .vercel/output/static/ | head -20
