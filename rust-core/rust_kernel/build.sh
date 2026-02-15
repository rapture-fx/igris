#!/bin/bash
set -e

echo "🦀 Building Rust kernel for FFI..."

# Build in release mode for maximum performance
cargo build --release

# Determine the library extension based on OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    LIB_EXT="so"
    LIB_NAME="libigris_kernel.so"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    LIB_EXT="dylib"
    LIB_NAME="libigris_kernel.dylib"
else
    echo "⚠️  Unsupported OS: $OSTYPE"
    exit 1
fi

# Copy library to Go gateway lib directory
echo "📦 Copying $LIB_NAME to ../go_gateway/lib/"
mkdir -p ../go_gateway/lib
cp target/release/$LIB_NAME ../go_gateway/lib/

echo "✅ Rust kernel built successfully!"
echo "📍 Library location: ../go_gateway/lib/$LIB_NAME"
