#!/bin/bash
# Igris Runtime Installer
# Downloads, verifies, and installs the igris-runtime binary

set -e

VERSION="${VERSION:-runtime-v1.6.0}"
BASE_URL="https://github.com/Igris-inertial/system/releases/download"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"
TEST_MODE="${TEST_MODE:-false}"

# Detect OS and architecture
detect_platform() {
    local OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    local ARCH=$(uname -m)

    case "$OS" in
        linux)
            case "$ARCH" in
                x86_64)          echo "linux-x64" ;;
                aarch64|arm64)   echo "linux-arm64" ;;
                armv7l|armv7)    echo "linux-armv7" ;;
                armv6l)          echo "linux-armv7" ;;  # Raspberry Pi Zero/1 — use armv7 build
                *)
                    echo "Unsupported Linux architecture: $ARCH" >&2
                    exit 1
                    ;;
            esac
            ;;
        darwin)
            # Check for Apple Silicon (works even under Rosetta where uname -m returns x86_64)
            if sysctl -n hw.optional.arm64 2>/dev/null | grep -q 1; then
                echo "macos-arm64"
            elif [ "$ARCH" = "arm64" ]; then
                echo "macos-arm64"
            else
                echo "macos-x64"
            fi
            ;;
        *)
            echo "Unsupported OS: $OS" >&2
            exit 1
            ;;
    esac
}

# Portable sha256 check (Linux: sha256sum, macOS: shasum)
sha256_check() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{print $1}'
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$1" | awk '{print $1}'
    else
        echo "Error: sha256sum or shasum not found — cannot verify download." >&2
        exit 1
    fi
}

# Download binary and verify checksum
download_and_verify() {
    local PLATFORM=$1
    local FILENAME="igris-runtime-${PLATFORM}.tar.gz"
    local CHECKSUM_FILE="${FILENAME}.sha256"
    local URL="${BASE_URL}/${VERSION}/${FILENAME}"
    local CHECKSUM_URL="${BASE_URL}/${VERSION}/${CHECKSUM_FILE}"
    local TMP_DIR=$(mktemp -d)

    echo "Downloading igris-runtime ${VERSION} for ${PLATFORM}..."

    # Download binary
    if ! curl -fsSL "$URL" -o "$TMP_DIR/$FILENAME"; then
        echo "Error: Failed to download $URL" >&2
        echo "Supported platforms: linux-x64, linux-arm64, linux-armv7, macos-arm64, macos-x64" >&2
        rm -rf "$TMP_DIR"
        exit 1
    fi

    # Download checksum
    if ! curl -fsSL "$CHECKSUM_URL" -o "$TMP_DIR/$CHECKSUM_FILE"; then
        echo "Error: Failed to download checksum from $CHECKSUM_URL" >&2
        rm -rf "$TMP_DIR"
        exit 1
    fi

    # Verify checksum
    local EXPECTED=$(cat "$TMP_DIR/$CHECKSUM_FILE" | tr -d '[:space:]')
    local ACTUAL=$(sha256_check "$TMP_DIR/$FILENAME")

    if [ "$EXPECTED" != "$ACTUAL" ]; then
        echo "Error: Checksum verification failed!" >&2
        echo "  Expected: $EXPECTED" >&2
        echo "  Actual:   $ACTUAL" >&2
        echo "The download may be corrupted or tampered with. Aborting." >&2
        rm -rf "$TMP_DIR"
        exit 1
    fi

    echo "✓ Checksum verified"
    echo "$TMP_DIR/$FILENAME"
}

# Install from archive
install_from_archive() {
    local ARCHIVE_PATH=$1
    local TMP_DIR=$(mktemp -d)

    cd "$TMP_DIR"
    tar xzf "$ARCHIVE_PATH"

    mkdir -p "$INSTALL_DIR"

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

# Test mode: bundle a local binary
bundle_local_binary() {
    local PLATFORM=$1
    local BINARY_PATH=$2
    local TMP_DIR=$(mktemp -d)

    echo "[TEST MODE] Bundling local binary..." >&2
    cp "$BINARY_PATH" "$TMP_DIR/igris-runtime"
    cd "$TMP_DIR"
    tar czf "igris-runtime-${PLATFORM}.tar.gz" igris-runtime
    echo "$TMP_DIR/igris-runtime-${PLATFORM}.tar.gz"
}

check_local_binary() {
    if [ -f "./target/release/igris-runtime" ]; then
        echo "./target/release/igris-runtime"
    elif [ -f "./igris-runtime" ]; then
        echo "./igris-runtime"
    elif [ -f "./bin/igris-runtime" ]; then
        echo "./bin/igris-runtime"
    fi
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

    LOCAL_BIN=$(check_local_binary)

    if [ -n "$LOCAL_BIN" ] && [ "$TEST_MODE" = "true" ]; then
        echo "[TEST MODE] Found local binary: $LOCAL_BIN"
        ARCHIVE=$(bundle_local_binary "$PLATFORM" "$LOCAL_BIN")
        install_from_archive "$ARCHIVE"
        rm -rf "$(dirname "$ARCHIVE")"
    else
        echo "Installing version: $VERSION"
        echo ""
        ARCHIVE=$(download_and_verify "$PLATFORM")
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

    if [ -f "$INSTALL_DIR/igris-runtime" ]; then
        echo "✓ Installation verified"
        ls -lh "$INSTALL_DIR/igris-runtime"

        if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
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
    echo "  curl -sSL https://igrisinertial.com/install | bash"
    echo "  VERSION=runtime-v1.5.0 ./install.sh   # specific version"
    echo "  INSTALL_DIR=~/bin ./install.sh         # custom directory"
    echo "  TEST_MODE=true ./install.sh            # use local binary"
    echo ""
    echo "Environment variables:"
    echo "  VERSION      - Release tag (default: runtime-v1.6.0)"
    echo "  INSTALL_DIR  - Install path (default: ~/.local/bin)"
    echo "  TEST_MODE    - Use local binary (default: false)"
    exit 0
fi

main
