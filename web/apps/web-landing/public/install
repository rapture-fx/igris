#!/usr/bin/env bash
# Igris Runtime installer
# Usage: curl -fsSL https://igrisinertial.com/install | bash
# Or with API key: IGRIS_API_KEY=igris_xxx curl -fsSL https://igrisinertial.com/install | bash
#
# The binary is served from the authenticated Overture API.
# You must have an active Igris subscription to download.

set -euo pipefail

OVERTURE_URL="${IGRIS_OVERTURE_URL:-https://overture.igrisinertial.com}"
INSTALL_DIR="${IGRIS_INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="igris-runtime"

# ── Detect platform ──────────────────────────────────────────────────────────

detect_platform() {
    local os arch
    case "$(uname -s)" in
        Linux)  os="linux"  ;;
        Darwin) os="macos"  ;;
        *)
            die "Unsupported OS: $(uname -s). Supported: Linux, macOS."
            ;;
    esac
    case "$(uname -m)" in
        x86_64|amd64) arch="amd64" ;;
        arm64|aarch64) arch="arm64" ;;
        *)
            die "Unsupported architecture: $(uname -m). Supported: x86-64, ARM64."
            ;;
    esac
    echo "${os}-${arch}"
}

# ── Helpers ───────────────────────────────────────────────────────────────────

info()  { printf '\033[1;32m[igris]\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[igris]\033[0m %s\n' "$*" >&2; }
die()   { printf '\033[1;31m[igris] error:\033[0m %s\n' "$*" >&2; exit 1; }
step()  { printf '\033[1;37m[igris]\033[0m %s\n' "$*"; }

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

sha256_file() {
    if command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$1" | awk '{print $1}'
    elif command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{print $1}'
    else
        warn "No SHA-256 tool found (shasum / sha256sum) — skipping checksum verification."
        echo "SKIP"
    fi
}

# ── Pre-flight ────────────────────────────────────────────────────────────────

require_cmd curl

PLATFORM="${IGRIS_PLATFORM:-$(detect_platform)}"
BINARY_FILE="${BINARY_NAME}-${PLATFORM}"
if [[ "$PLATFORM" == windows* ]]; then
    BINARY_FILE="${BINARY_FILE}.exe"
fi

if [ ! -d "$INSTALL_DIR" ]; then
    info "Creating install directory: $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR" \
        || die "Cannot create $INSTALL_DIR — try: sudo IGRIS_INSTALL_DIR=$INSTALL_DIR bash <(curl -fsSL https://igrisinertial.com/install)"
fi
[ -w "$INSTALL_DIR" ] \
    || die "$INSTALL_DIR is not writable — try: sudo bash <(curl -fsSL https://igrisinertial.com/install)"

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# ── Authenticate ──────────────────────────────────────────────────────────────

step "Detected platform: $PLATFORM"

AUTH_HEADER=""
if [ -n "${IGRIS_API_KEY:-}" ]; then
    AUTH_HEADER="X-API-Key: ${IGRIS_API_KEY}"
    info "Using API key from IGRIS_API_KEY"
else
    if [ ! -t 0 ]; then
        echo ""
        echo "  No API key found. Get yours at:"
        echo "  https://console.igrisinertial.com/settings/keys"
        echo ""
        echo "  Then run:"
        echo "  IGRIS_API_KEY=igris_... curl -fsSL https://igrisinertial.com/install | bash"
        echo ""
        exit 1
    fi
    echo ""
    echo "  API key required → https://console.igrisinertial.com/settings/keys"
    echo ""
    printf "  Paste your key: "
    read -r IGRIS_API_KEY_INPUT
    IGRIS_API_KEY_INPUT="$(echo "$IGRIS_API_KEY_INPUT" | tr -d '[:space:]')"
    if [ -z "$IGRIS_API_KEY_INPUT" ]; then
        die "No API key provided."
    fi
    AUTH_HEADER="X-API-Key: ${IGRIS_API_KEY_INPUT}"
    IGRIS_API_KEY="${IGRIS_API_KEY_INPUT}"
fi

# ── Download binary ───────────────────────────────────────────────────────────

DOWNLOAD_URL="${OVERTURE_URL}/api/v1/runtime/download?platform=${PLATFORM}"
CHECKSUM_URL="${OVERTURE_URL}/v1/runtime/checksum?platform=${PLATFORM}"

step "Downloading igris-runtime (${PLATFORM})..."

HTTP_STATUS=$(curl -fsSL -s \
    -H "$AUTH_HEADER" \
    -H "User-Agent: igris-installer/1.0" \
    -w "%{http_code}" \
    -o "${TMP_DIR}/${BINARY_FILE}" \
    "$DOWNLOAD_URL")

case "$HTTP_STATUS" in
    200) ;;
    403) die "Access denied — check your API key and subscription status at https://console.igrisinertial.com/settings/billing" ;;
    429) die "Download rate limit reached. Try again in an hour." ;;
    401) die "Invalid API key." ;;
    404) die "Runtime binary not available for platform: $PLATFORM. Please contact support." ;;
    *)   die "Download failed (HTTP ${HTTP_STATUS}). Check $DOWNLOAD_URL" ;;
esac

# ── Verify checksum ───────────────────────────────────────────────────────────

step "Verifying binary integrity..."

CHECKSUM_RESP=$(curl -fsSL -s \
    -H "User-Agent: igris-installer/1.0" \
    "${CHECKSUM_URL}" 2>/dev/null || true)

if [ -z "$CHECKSUM_RESP" ]; then
    die "Checksum endpoint unavailable — cannot verify binary integrity. Aborting."
fi
EXPECTED=$(echo "$CHECKSUM_RESP" | grep -oE '^[a-f0-9]{64}')
if [ -z "$EXPECTED" ]; then
    die "Checksum format invalid — expected 64-char hex string. Aborting."
fi
ACTUAL=$(sha256_file "${TMP_DIR}/${BINARY_FILE}")
if [ "$ACTUAL" = "SKIP" ]; then
    warn "Skipping checksum verification."
elif [ "$EXPECTED" != "$ACTUAL" ]; then
    die "Checksum mismatch — binary may be corrupt.\n  expected: $EXPECTED\n  got:      $ACTUAL"
else
    info "Checksum verified."
fi

# ── Install ───────────────────────────────────────────────────────────────────

chmod +x "${TMP_DIR}/${BINARY_FILE}"
mv "${TMP_DIR}/${BINARY_FILE}" "${INSTALL_DIR}/${BINARY_NAME}"
info "Installed: ${INSTALL_DIR}/${BINARY_NAME}"

# ── Verify install ────────────────────────────────────────────────────────────

if command -v igris-runtime >/dev/null 2>&1; then
    VERSION=$(igris-runtime --version 2>/dev/null | head -1 || echo "unknown")
    info "igris-runtime $VERSION is ready."
else
    warn "igris-runtime installed but not in PATH."
    warn "Add it: export PATH=\"\$PATH:${INSTALL_DIR}\""
fi

# ── Next steps ────────────────────────────────────────────────────────────────

echo ""
echo "  ────────────────────────────────────────────────"
echo "  Next steps"
echo "  ────────────────────────────────────────────────"
echo ""
echo "  1. Start the runtime:"
echo "     igris-runtime serve"
echo ""
echo "  Your runtime will appear in Fleet → Devices within 30 seconds."
echo ""
echo "  Docs: https://docs.igrisinertial.com/runtime"
echo "  ────────────────────────────────────────────────"
echo ""
