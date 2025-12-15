#!/bin/bash
set -e

# Igris Runtime v1.4 - Multi-Model Downloader
# Supports: Phi-3, Qwen3-8B/14B, DeepSeek-V3.2-7B, GLM-4-9B, Llama-4-8B (when available)

MODEL_DIR="models"

# Color codes for pretty output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================"
echo "Igris Runtime v1.4 Model Downloader"
echo "======================================${NC}"
echo ""

# Model definitions
declare -A MODEL_NAMES
MODEL_NAMES[1]="Phi-3 Mini 4K (v1.1-1.3 default)"
MODEL_NAMES[2]="Qwen3-8B Instruct"
MODEL_NAMES[3]="Qwen3-14B Instruct"
MODEL_NAMES[4]="DeepSeek-V3.2 7B (Coder)"
MODEL_NAMES[5]="GLM-4 9B Chat"
MODEL_NAMES[6]="Llama-4 8B (NOT YET AVAILABLE)"

declare -A MODEL_FILES
MODEL_FILES[1]="phi-3-mini-4k-instruct-q4.gguf"
MODEL_FILES[2]="qwen2.5-8b-instruct-q4_k_m.gguf"
MODEL_FILES[3]="qwen2.5-14b-instruct-q5_k_m.gguf"
MODEL_FILES[4]="DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf"
MODEL_FILES[5]="glm-4-9b-chat-Q4_K_M.gguf"
MODEL_FILES[6]="NOT_AVAILABLE"

declare -A MODEL_URLS
MODEL_URLS[1]="https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf"
MODEL_URLS[2]="https://huggingface.co/Qwen/Qwen2.5-8B-Instruct-GGUF/resolve/main/qwen2.5-8b-instruct-q4_k_m.gguf"
MODEL_URLS[3]="https://huggingface.co/Qwen/Qwen2.5-14B-Instruct-GGUF/resolve/main/qwen2.5-14b-instruct-q5_k_m.gguf"
MODEL_URLS[4]="https://huggingface.co/deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct-GGUF/resolve/main/DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf"
MODEL_URLS[5]="https://huggingface.co/second-state/glm-4-9b-chat-GGUF/resolve/main/glm-4-9b-chat-Q4_K_M.gguf"
MODEL_URLS[6]="NOT_AVAILABLE"

declare -A MODEL_SIZES
MODEL_SIZES[1]="~2.3 GB"
MODEL_SIZES[2]="~4.9 GB"
MODEL_SIZES[3]="~8.5 GB"
MODEL_SIZES[4]="~4.2 GB"
MODEL_SIZES[5]="~5.4 GB"
MODEL_SIZES[6]="~4.8 GB"

declare -A MODEL_CONFIG_IDS
MODEL_CONFIG_IDS[1]="phi-3-mini-4k"
MODEL_CONFIG_IDS[2]="qwen3-8b"
MODEL_CONFIG_IDS[3]="qwen3-14b"
MODEL_CONFIG_IDS[4]="deepseek-v3-2-7b"
MODEL_CONFIG_IDS[5]="glm-4-9b"
MODEL_CONFIG_IDS[6]="llama-4-8b"

declare -A MODEL_CAPABILITIES
MODEL_CAPABILITIES[1]="Compact, fast, general-purpose"
MODEL_CAPABILITIES[2]="Reasoning, coding, math, multilingual (40-60% better than Phi-3)"
MODEL_CAPABILITIES[3]="High-quality reasoning, coding, math, multilingual (50-70% better than Phi-3)"
MODEL_CAPABILITIES[4]="Specialized coding, technical tasks, long-context (16k)"
MODEL_CAPABILITIES[5]="Reasoning, coding, excellent Chinese support, multilingual"
MODEL_CAPABILITIES[6]="General-purpose, reasoning, coding (placeholder)"

# Display menu
echo -e "${GREEN}Available Models:${NC}"
echo ""
for i in {1..6}; do
    if [ "$i" -eq 6 ]; then
        echo -e "${RED}$i. ${MODEL_NAMES[$i]} - ${MODEL_SIZES[$i]}${NC}"
    else
        echo -e "$i. ${MODEL_NAMES[$i]} - ${MODEL_SIZES[$i]}"
    fi
    echo -e "   ${YELLOW}${MODEL_CAPABILITIES[$i]}${NC}"
    echo ""
done

# Get user choice
while true; do
    read -p "Select model to download (1-5, or 'all' for all available models): " choice

    if [[ "$choice" == "all" ]]; then
        DOWNLOAD_ALL=true
        break
    elif [[ "$choice" =~ ^[1-5]$ ]]; then
        MODEL_CHOICE=$choice
        DOWNLOAD_ALL=false
        break
    elif [[ "$choice" == "6" ]]; then
        echo -e "${RED}Error: Llama-4 is not yet available. Please choose another model.${NC}"
    else
        echo -e "${RED}Invalid choice. Please enter 1-5 or 'all'.${NC}"
    fi
done

# Create models directory if it doesn't exist
if [ ! -d "$MODEL_DIR" ]; then
    echo ""
    echo -e "${BLUE}Creating $MODEL_DIR directory...${NC}"
    mkdir -p "$MODEL_DIR"
fi

# Function to download a single model
download_model() {
    local model_num=$1
    local model_name="${MODEL_NAMES[$model_num]}"
    local model_file="${MODEL_FILES[$model_num]}"
    local model_url="${MODEL_URLS[$model_num]}"
    local model_size="${MODEL_SIZES[$model_num]}"
    local config_id="${MODEL_CONFIG_IDS[$model_num]}"

    echo ""
    echo -e "${GREEN}======================================"
    echo "Downloading: $model_name"
    echo "======================================${NC}"
    echo -e "File: $model_file"
    echo -e "Size: $model_size"
    echo ""

    # Check if model already exists
    if [ -f "$MODEL_DIR/$model_file" ]; then
        echo -e "${YELLOW}Model already exists at $MODEL_DIR/$model_file${NC}"
        echo "File size: $(du -h "$MODEL_DIR/$model_file" | cut -f1)"
        echo ""
        read -p "Re-download? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Skipping download."
            return 0
        fi
        echo "Removing existing model..."
        rm "$MODEL_DIR/$model_file"
    fi

    # Download the model
    echo ""
    echo "Downloading $model_file..."
    echo "URL: $model_url"
    echo ""
    echo "This may take a while depending on your internet connection..."
    echo ""

    # Use curl or wget depending on what's available
    if command -v curl &> /dev/null; then
        curl -L --progress-bar -o "$MODEL_DIR/$model_file" "$model_url"
    elif command -v wget &> /dev/null; then
        wget --show-progress -O "$MODEL_DIR/$model_file" "$model_url"
    else
        echo -e "${RED}Error: Neither curl nor wget is available.${NC}"
        echo "Please install one of them and try again."
        return 1
    fi

    # Verify download
    if [ ! -f "$MODEL_DIR/$model_file" ]; then
        echo ""
        echo -e "${RED}Error: Download failed!${NC}"
        return 1
    fi

    echo ""
    echo -e "${GREEN}Download complete!${NC}"
    echo "Model location: $MODEL_DIR/$model_file"
    echo "File size: $(du -h "$MODEL_DIR/$model_file" | cut -f1)"
    echo ""

    # Show config snippet
    echo -e "${BLUE}To use this model, update your config.json5:${NC}"
    echo ""
    echo "  local_fallback: {"
    echo "    enabled: true,"
    echo "    selected_model: \"$config_id\",  // NEW in v1.4"
    echo "    // model_path is auto-generated from selected_model"
    echo "  }"
    echo ""
}

# Download selected models
if [ "$DOWNLOAD_ALL" = true ]; then
    echo ""
    echo -e "${GREEN}Downloading all available models...${NC}"
    for i in {1..5}; do
        download_model $i
    done
else
    download_model $MODEL_CHOICE
fi

echo ""
echo -e "${GREEN}======================================"
echo "All downloads complete!"
echo "======================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Update config.json5 with your selected model"
echo "2. Restart Igris Runtime"
echo "3. Test with: curl -X POST http://localhost:8080/v1/infer ..."
echo ""
echo -e "${YELLOW}For detailed configuration, see FIELD_MANUAL.md${NC}"
echo ""
