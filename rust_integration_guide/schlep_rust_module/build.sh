#!/bin/bash
# Build script for Rust module

echo "🦀 Building Schlep-engine Rust Module"
echo "======================================"

# Check if Rust is installed
if ! command -v rustc &> /dev/null; then
    echo "❌ Rust not found. Installing..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    source $HOME/.cargo/env
fi

# Check if maturin is installed
if ! command -v maturin &> /dev/null; then
    echo "📦 Installing maturin..."
    pip install maturin
fi

# Build the module
echo "🔨 Building Rust module..."
maturin develop --release

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "🧪 Running demo..."
    python python_integration_demo.py
else
    echo "❌ Build failed!"
    exit 1
fi