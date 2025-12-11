#!/bin/bash
set -e

# Download Phi-3-mini-4k-instruct Q4_K_M GGUF model
# This is a quantized 4-bit model optimized for CPU inference (~2.3 GB)

MODEL_DIR="models"
MODEL_FILE="phi-3-mini-4k-instruct-q4.gguf"
MODEL_URL="https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf"

echo "======================================"
echo "Phi-3 Mini 4K Model Downloader"
echo "======================================"
echo ""
echo "This script downloads Phi-3-mini-4k-instruct-q4.gguf (~2.3 GB)"
echo "Model: Microsoft Phi-3 Mini 4K Instruct (Q4_K_M quantization)"
echo "License: MIT"
echo ""

# Create models directory if it doesn't exist
if [ ! -d "$MODEL_DIR" ]; then
    echo "Creating $MODEL_DIR directory..."
    mkdir -p "$MODEL_DIR"
fi

# Check if model already exists
if [ -f "$MODEL_DIR/$MODEL_FILE" ]; then
    echo "Model already exists at $MODEL_DIR/$MODEL_FILE"
    echo "File size: $(du -h "$MODEL_DIR/$MODEL_FILE" | cut -f1)"
    echo ""
    read -p "Re-download? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping download."
        exit 0
    fi
    echo "Removing existing model..."
    rm "$MODEL_DIR/$MODEL_FILE"
fi

# Download the model
echo ""
echo "Downloading $MODEL_FILE..."
echo "URL: $MODEL_URL"
echo ""
echo "This may take a while depending on your internet connection..."
echo ""

# Use curl or wget depending on what's available
if command -v curl &> /dev/null; then
    curl -L --progress-bar -o "$MODEL_DIR/$MODEL_FILE" "$MODEL_URL"
elif command -v wget &> /dev/null; then
    wget --show-progress -O "$MODEL_DIR/$MODEL_FILE" "$MODEL_URL"
else
    echo "Error: Neither curl nor wget is available."
    echo "Please install one of them and try again."
    exit 1
fi

# Verify download
if [ ! -f "$MODEL_DIR/$MODEL_FILE" ]; then
    echo ""
    echo "Error: Download failed!"
    exit 1
fi

echo ""
echo "======================================"
echo "Download complete!"
echo "======================================"
echo ""
echo "Model location: $MODEL_DIR/$MODEL_FILE"
echo "File size: $(du -h "$MODEL_DIR/$MODEL_FILE" | cut -f1)"
echo ""
echo "To enable local LLM fallback, update your config.json5:"
echo ""
echo "  local_fallback: {"
echo "    enabled: true,"
echo "    model_path: \"$MODEL_DIR/$MODEL_FILE\","
echo "    context_size: 4096,"
echo "    threads: 4,"
echo "    max_tokens: 512,"
echo "    temperature: 0.7,"
echo "  }"
echo ""
echo "Then restart Igris Runtime."
echo ""
