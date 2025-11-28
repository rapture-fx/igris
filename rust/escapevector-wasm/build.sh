#!/bin/bash
set -e

echo "Building EscapeVector WASM module..."

# Install wasm-pack if not present
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Build for web (browser + Node.js)
wasm-pack build --target bundler --release --out-dir ../../internal/sdk/javascript/wasm

# Check size
WASM_FILE="../../internal/sdk/javascript/wasm/escapevector_wasm_bg.wasm"
if [ -f "$WASM_FILE" ]; then
    SIZE=$(wc -c < "$WASM_FILE")
    SIZE_KB=$((SIZE / 1024))
    echo "WASM size: ${SIZE_KB} KB (uncompressed)"

    # Check gzipped size
    gzip -c "$WASM_FILE" > "${WASM_FILE}.gz"
    GZIP_SIZE=$(wc -c < "${WASM_FILE}.gz")
    GZIP_SIZE_KB=$((GZIP_SIZE / 1024))
    echo "WASM size: ${GZIP_SIZE_KB} KB (gzipped)"
    rm "${WASM_FILE}.gz"

    if [ $GZIP_SIZE_KB -gt 180 ]; then
        echo "⚠️  WARNING: WASM exceeds 180 KB target (${GZIP_SIZE_KB} KB)"
        exit 1
    else
        echo "✓ WASM size OK: ${GZIP_SIZE_KB} KB < 180 KB"
    fi
else
    echo "⚠️  WASM file not found"
    exit 1
fi

echo "✓ Build complete!"
