#!/bin/bash
# Cloudflare Pages build script

set -e  # Exit on error

# Save current directory
SCRIPT_DIR="$(pwd)"

echo "🔧 Current directory: $SCRIPT_DIR"
echo "🔧 Installing dependencies..."
pnpm install

echo "🏗️  Building with @cloudflare/next-on-pages..."
npx @cloudflare/next-on-pages@1

echo "📊 Checking what was built..."
echo "Contents of .vercel/output/static:"
ls -la .vercel/output/static/ | head -20

echo "🖼️  Manually copying public assets..."
# After @cloudflare/next-on-pages builds, manually ensure public assets are copied
if [ -d "$SCRIPT_DIR/public" ]; then
    echo "✓ Found public directory at: $SCRIPT_DIR/public"
    echo "Copying to: $SCRIPT_DIR/.vercel/output/static/"

    # Copy each file explicitly to avoid glob issues
    for file in "$SCRIPT_DIR/public"/*; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            echo "  Copying: $filename"
            cp "$file" "$SCRIPT_DIR/.vercel/output/static/" || echo "  Warning: Could not copy $filename"
        fi
    done
else
    echo "⚠️  Public directory not found at: $SCRIPT_DIR/public"
fi

echo ""
echo "✅ Build complete!"
echo "📊 Final output contents:"
ls -la .vercel/output/static/ | head -40
echo ""
echo "🎨 Images in output:"
find .vercel/output/static -maxdepth 1 \( -name "*.png" -o -name "*.svg" \) || echo "No images found!"
