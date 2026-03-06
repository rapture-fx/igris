#!/usr/bin/env bash
# Igris Runtime installer
# Usage: curl -fsSL https://igrisinertial.com/install | bash
# Or:    curl -fsSL https://igrisinertial.com/install | IGRIS_API_KEY=your_key bash

set -euo pipefail

RELEASES_URL="https://releases.igrisinertial.com/runtime/latest"
INSTALL_DIR="${IGRIS_INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="igris-runtime"

# ── Detect platform ──────────────────────────────────────────────────────────

detect_os() {
    case "$(uname -s)" in
        Linux)  echo "linux"   ;;
        Darwin) echo "darwin"  ;;
        *)
            echo "Unsupported OS: $(uname -s)" >&2
            exit 1
            ;;
    esac
}

detect_arch() {
    case "$(uname -m)" in
        x86_64|amd64) echo "amd64" ;;
        arm64|aarch64) echo "arm64" ;;
        *)
            echo "Unsupported architecture: $(uname -m)" >&2
            exit 1
            ;;
    esac
}

OS=$(detect_os)
ARCH=$(detect_arch)
PLATFORM="${OS}-${ARCH}"
BINARY_FILE="${BINARY_NAME}-${PLATFORM}"

# ── Helpers ──────────────────────────────────────────────────────────────────

info()    { printf '\033[1;32m[igris]\033[0m %s\n' "$*"; }
warn()    { printf '\033[1;33m[igris]\033[0m %s\n' "$*" >&2; }
die()     { printf '\033[1;31m[igris] error:\033[0m %s\n' "$*" >&2; exit 1; }

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

# ── Pre-flight ───────────────────────────────────────────────────────────────

require_cmd curl
require_cmd shasum || require_cmd sha256sum

if [ ! -d "$INSTALL_DIR" ]; then
    info "Creating install directory: $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR" || die "Cannot create $INSTALL_DIR (try running with sudo or set IGRIS_INSTALL_DIR)"
fi

if [ ! -w "$INSTALL_DIR" ]; then
    die "$INSTALL_DIR is not writable. Try: sudo bash <(curl -fsSL https://igrisinertial.com/install)"
fi

# ── Download ─────────────────────────────────────────────────────────────────

DOWNLOAD_URL="${RELEASES_URL}/${BINARY_FILE}"
CHECKSUM_URL="${DOWNLOAD_URL}.sha256"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

info "Detected platform: $PLATFORM"
info "Downloading igris-runtime..."

curl -fsSL --progress-bar -o "${TMP_DIR}/${BINARY_FILE}" "$DOWNLOAD_URL" \
    || die "Download failed from $DOWNLOAD_URL"

# ── Verify checksum ──────────────────────────────────────────────────────────

info "Verifying checksum..."
curl -fsSL -o "${TMP_DIR}/${BINARY_FILE}.sha256" "$CHECKSUM_URL" \
    || { warn "Could not fetch checksum — skipping verification"; }

if [ -f "${TMP_DIR}/${BINARY_FILE}.sha256" ]; then
    expected=$(cat "${TMP_DIR}/${BINARY_FILE}.sha256" | awk '{print $1}')
    if command -v shasum >/dev/null 2>&1; then
        actual=$(shasum -a 256 "${TMP_DIR}/${BINARY_FILE}" | awk '{print $1}')
    else
        actual=$(sha256sum "${TMP_DIR}/${BINARY_FILE}" | awk '{print $1}')
    fi

    if [ "$expected" != "$actual" ]; then
        die "Checksum mismatch! Expected: $expected  Got: $actual"
    fi
    info "Checksum verified."
fi

# ── Install ──────────────────────────────────────────────────────────────────

chmod +x "${TMP_DIR}/${BINARY_FILE}"
mv "${TMP_DIR}/${BINARY_FILE}" "${INSTALL_DIR}/${BINARY_NAME}"
info "Installed to ${INSTALL_DIR}/${BINARY_NAME}"

# ── Verify install ───────────────────────────────────────────────────────────

if command -v igris-runtime >/dev/null 2>&1; then
    VERSION=$(igris-runtime --version 2>/dev/null || echo "unknown")
    info "igris-runtime $VERSION is ready."
else
    warn "igris-runtime was installed to ${INSTALL_DIR} but is not in your PATH."
    warn "Add it: export PATH=\"\$PATH:${INSTALL_DIR}\""
fi

# ── Next steps ───────────────────────────────────────────────────────────────

echo ""
echo "  Next steps:"
echo ""

if [ -z "${IGRIS_API_KEY:-}" ]; then
    echo "  1. Get your API key from the Igris dashboard:"
    echo "     https://console.igrisinertial.com/settings/billing"
    echo ""
    echo "  2. Export your credentials:"
    echo "     export IGRIS_LICENSE_KEY=lic_xxxxx"
    echo "     export IGRIS_API_KEY=igris_xxxxx"
    echo ""
    echo "  3. Start the runtime:"
    echo "     igris-runtime serve"
else
    echo "  IGRIS_API_KEY detected — your runtime will register with the fleet on start."
    echo ""
    echo "  Start the runtime:"
    echo "    igris-runtime serve"
fi

echo ""
echo "  Documentation: https://docs.igrisinertial.com/runtime"
echo ""
