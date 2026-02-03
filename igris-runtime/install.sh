#!/bin/bash
# Igris Runtime Installer (TEST VERSION)
# Tests locally with simulated GitHub release

set -e

REPO="Igris-inertial/Igris"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
TEST_MODE="${TEST_MODE:-false}"

# Detect OS and architecture
detect_platform() {
    local OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    local ARCH=$(uname -m)
    
    case "$OS" in
        linux)
            case "$ARCH" in
                x86_64) echo "linux-x64" ;;
                aarch64|arm64) echo "linux-arm64" ;;
                *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
            esac
            ;;
        darwin)
            case "$ARCH" in
                x86_64) echo "macos-x64" ;;
                arm64) echo "macos-arm64" ;;
                *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
            esac
            ;;
        *)
            echo "Unsupported OS: $OS" >&2
            exit 1
            ;;
    esac
}

# Check if binary exists locally for testing
check_local_binary() {
    local PLATFORM=$1
    local LOCAL_BIN=""
    
    # Try multiple possible locations
    if [ -f "./target/release/igris-runtime" ]; then
        LOCAL_BIN="./target/release/igris-runtime"
    elif [ -f "./igris-runtime" ]; then
        LOCAL_BIN="./igris-runtime"
    elif [ -f "./bin/igris-runtime" ]; then
        LOCAL_BIN="./bin/igris-runtime"
    fi
    
    echo "$LOCAL_BIN"
}

# Create test release package
bundle_local_binary() {
    local PLATFORM=$1
    local BINARY_PATH=$2
    local TMP_DIR=$(mktemp -d)
    
    echo "[TEST MODE] Bundling local binary..." >&2
    
    cp "$BINARY_PATH" "$TMP_DIR/igris-runtime"
    cd "$TMP_DIR"
    tar czf "igris-runtime-${PLATFORM}.tar.gz" igris-runtime
    
    # Output only the path (no other output)
    echo "$TMP_DIR/igris-runtime-${PLATFORM}.tar.gz"
}

# Download from GitHub
download_from_github() {
    local PLATFORM=$1
    local VERSION=$2
    local FILENAME="igris-runtime-${PLATFORM}.tar.gz"
    local URL="https://github.com/${REPO}/releases/download/${VERSION}/${FILENAME}"
    local TMP_DIR=$(mktemp -d)
    
    echo "Downloading from GitHub: $URL"
    
    if ! curl -sL "$URL" -o "$TMP_DIR/$FILENAME"; then
        echo "Error: Failed to download from $URL" >&2
        rm -rf "$TMP_DIR"
        exit 1
    fi
    
    echo "$TMP_DIR/$FILENAME"
}

# Install from archive
install_from_archive() {
    local ARCHIVE_PATH=$1
    local TMP_DIR=$(mktemp -d)
    
    cd "$TMP_DIR"
    tar xzf "$ARCHIVE_PATH"
    
    # Create install directory if it doesn't exist
    mkdir -p "$INSTALL_DIR"
    
    # Install
    if [ -w "$INSTALL_DIR" ]; then
        mv igris-runtime "$INSTALL_DIR/"
        chmod +x "$INSTALL_DIR/igris-runtime"
    else
        echo "Installing to $INSTALL_DIR (requires sudo)..."
        sudo mv igris-runtime "$INSTALL_DIR/"
        sudo chmod +x "$INSTALL_DIR/igris-runtime"
    fi
    
    cd - > /dev/null
    rm -rf "$TMP_DIR"
    
    echo "✓ Igris Runtime installed to ${INSTALL_DIR}/igris-runtime"
}

# Main
main() {
    echo "Igris Runtime Installer"
    echo "======================="
    echo ""
    
    PLATFORM=$(detect_platform)
    echo "Detected platform: $PLATFORM"
    echo "Install directory: $INSTALL_DIR"
    echo ""
    
    # Check for local binary first (for testing)
    LOCAL_BIN=$(check_local_binary "$PLATFORM")
    
    if [ -n "$LOCAL_BIN" ] && [ "$TEST_MODE" = "true" ]; then
        echo "[TEST MODE] Found local binary: $LOCAL_BIN"
        echo "[TEST MODE] Bundling for installation..."
        ARCHIVE=$(bundle_local_binary "$PLATFORM" "$LOCAL_BIN")
        install_from_archive "$ARCHIVE"
        rm -rf "$(dirname "$ARCHIVE")"
    else
        # Production mode - download from GitHub
        echo "Checking for latest release..."
        VERSION=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
        
        if [ -z "$VERSION" ]; then
            echo "Error: Could not determine latest version from GitHub"
            echo ""
            echo "To test locally, build the binary first:"
            echo "  cargo build --release"
            echo "  TEST_MODE=true ./install.sh"
            exit 1
        fi
        
        echo "Latest version: $VERSION"
        echo ""
        
        ARCHIVE=$(download_from_github "$PLATFORM" "$VERSION")
        install_from_archive "$ARCHIVE"
        rm -rf "$(dirname "$ARCHIVE")"
    fi
    
    echo ""
    echo "Next steps:"
    echo "  1. Download a GGUF model from HuggingFace"
    echo "  2. Configure config.json5 with your model path"
    echo "  3. Run: igris-runtime serve"
    echo "  4. API available at http://localhost:8080"
    echo ""
    
    # Verify installation
    if [ -f "$INSTALL_DIR/igris-runtime" ]; then
        echo "✓ Installation verified"
        ls -lh "$INSTALL_DIR/igris-runtime"
        
        if echo "$PATH" | grep -q "$INSTALL_DIR"; then
            echo ""
            igris-runtime --version 2>/dev/null || true
        else
            echo ""
            echo "Add to your PATH:"
            echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
        fi
    fi
}

# Help
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Igris Runtime Installer"
    echo ""
    echo "Usage:"
    echo "  ./install.sh                    # Download and install from GitHub"
    echo "  TEST_MODE=true ./install.sh     # Test with local binary"
    echo "  INSTALL_DIR=~/bin ./install.sh  # Install to custom directory"
    echo ""
    echo "Prerequisites for TEST_MODE:"
    echo "  - Build binary: cargo build --release"
    exit 0
fi

main