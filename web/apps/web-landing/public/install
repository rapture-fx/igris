#!/usr/bin/env bash
# Igris Runtime installer
# Usage: curl -fsSL https://igrisinertial.com/install | bash

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
        x86_64|amd64)
            # On macOS, check if running under Rosetta on Apple Silicon
            if [ "$os" = "macos" ] && [ "$(sysctl -n sysctl.proc_translated 2>/dev/null)" = "1" ]; then
                arch="arm64"
            else
                arch="amd64"
            fi
            ;;
        arm64|aarch64) arch="arm64" ;;
        armv7l|armv7)  arch="armv7" ;;
        armv6l|armv6)  arch="armv7" ;;  # Pi Zero — use armv7 build
        *)
            die "Unsupported architecture: $(uname -m). Supported: x86-64, ARM64, ARMv7."
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
ARCHIVE_FILE="igris-runtime-${PLATFORM}.tar.gz"

if [ ! -d "$INSTALL_DIR" ]; then
    info "Creating install directory: $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR" \
        || die "Cannot create $INSTALL_DIR — try: sudo IGRIS_INSTALL_DIR=$INSTALL_DIR bash <(curl -fsSL https://igrisinertial.com/install)"
fi
[ -w "$INSTALL_DIR" ] \
    || die "$INSTALL_DIR is not writable — try: sudo bash <(curl -fsSL https://igrisinertial.com/install)"

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# ── Download binary ───────────────────────────────────────────────────────────

step "Detected platform: $PLATFORM"

DOWNLOAD_URL="${OVERTURE_URL}/v1/runtime/install?platform=${PLATFORM}"
CHECKSUM_URL="${OVERTURE_URL}/v1/runtime/checksum?platform=${PLATFORM}"

step "Downloading igris-runtime (${PLATFORM})..."

HTTP_STATUS=$(curl -sSL \
    -H "User-Agent: igris-installer/1.0" \
    -w "%{http_code}" \
    -o "${TMP_DIR}/${ARCHIVE_FILE}" \
    "$DOWNLOAD_URL")

case "$HTTP_STATUS" in
    200) ;;
    400) die "Platform '$PLATFORM' is not supported. Supported: linux-amd64, linux-arm64, linux-armv7, macos-arm64, macos-amd64." ;;
    404) die "Runtime binary not available for platform: $PLATFORM. Please contact support." ;;
    503) die "Binary hosting not yet configured. Please contact support." ;;
    *)   die "Download failed (HTTP ${HTTP_STATUS})." ;;
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
ACTUAL=$(sha256_file "${TMP_DIR}/${ARCHIVE_FILE}")
if [ "$ACTUAL" = "SKIP" ]; then
    warn "Skipping checksum verification."
elif [ "$EXPECTED" != "$ACTUAL" ]; then
    die "Checksum mismatch — binary may be corrupt.\n  expected: $EXPECTED\n  got:      $ACTUAL"
else
    info "Checksum verified."
fi

# ── Extract and install ───────────────────────────────────────────────────────

step "Extracting archive..."
tar -C "${TMP_DIR}" -xzf "${TMP_DIR}/${ARCHIVE_FILE}"

if [ ! -f "${TMP_DIR}/${BINARY_NAME}" ]; then
    die "Extraction failed — '${BINARY_NAME}' not found in archive."
fi

chmod +x "${TMP_DIR}/${BINARY_NAME}"
mv "${TMP_DIR}/${BINARY_NAME}" "${INSTALL_DIR}/${BINARY_NAME}"
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
echo ""
printf "  %-18s  %s\n"  '     \ \ \ \   '  ''
printf "  %-18s  %s\n"  '   \ \ \ \ \ \ '  'Next steps'
printf "  %-18s  %s\n"  '  \ \ \ \ \ \ \'  ''
printf "  %-18s  %s\n"  ' \ \ \ \ \ \ \ '  '1. Authenticate with your API key:'
printf "  %-18s  %s\n"  '  \ \ \ \ \ \ \'  '   igris-runtime auth igris_...'
printf "  %-18s  %s\n"  '   \ \ \ \ \ \ '  ''
printf "  %-18s  %s\n"  '     \ \ \ \   '  '2. Start the runtime:'
printf "  %-18s  %s\n"  ''                 '   igris-runtime serve'
printf "  %-18s  %s\n"  ''                 ''
printf "  %-18s  %s\n"  ''                 'Get your API key:'
printf "  %-18s  %s\n"  ''                 '→ https://console.igrisinertial.com/settings/keys'
printf "  %-18s  %s\n"  ''                 ''
printf "  %-18s  %s\n"  ''                 'Docs: https://docs.igrisinertial.com/runtime'
echo ""
echo "  ────────────────────────────────────────────────"
echo ""
