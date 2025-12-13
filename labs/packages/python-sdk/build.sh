#!/bin/bash
"""
Build script for Schlep-engine Python SDK

This script helps build and package the SDK for distribution.
"""

set -e

echo "🏗️  Building Schlep-engine Python SDK"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "pyproject.toml" ]; then
    echo "❌ Error: pyproject.toml not found. Make sure you're in the SDK root directory."
    exit 1
fi

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf build/ dist/ *.egg-info/

# Install build dependencies
echo "📦 Installing build dependencies..."
pip install build twine

# Run tests
echo "🧪 Running installation test..."
python3 test_installation.py

if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Aborting build."
    exit 1
fi

# Build the package
echo "🔨 Building package..."
python -m build

# Check the distribution
echo "🔍 Checking distribution..."
twine check dist/*

echo "✅ Build completed successfully!"
echo ""
echo "📦 Built packages:"
ls -la dist/

echo ""
echo "To install locally for testing:"
echo "  pip install dist/igris_overture-*.whl"
echo ""
echo "To publish to PyPI:"
echo "  twine upload dist/*"