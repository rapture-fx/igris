#!/usr/bin/env bash
# Run this once on the Hetzner VPS to set up binary storage for igris-overture.
# Usage: sudo bash vps-setup.sh

set -euo pipefail

BINARIES_DIR="/opt/igris-binaries"
IGRIS_USER="${IGRIS_USER:-igris}"

echo "=== Igris VPS Binary Storage Setup ==="
echo ""

# Create directories
mkdir -p "${BINARIES_DIR}"/{linux-amd64,linux-arm64,linux-armv7,macos-arm64,macos-x64,staging}

# Create igris system user if not exists
if ! id "$IGRIS_USER" &>/dev/null; then
    useradd --system --no-create-home --shell /usr/sbin/nologin "$IGRIS_USER"
    echo "Created system user: $IGRIS_USER"
fi

# Ownership
chown -R "${IGRIS_USER}:${IGRIS_USER}" "${BINARIES_DIR}"
chmod -R 755 "${BINARIES_DIR}"

echo "Created: ${BINARIES_DIR}/{linux-amd64,linux-arm64,linux-armv7,macos-arm64,macos-x64,staging}"

# Install organize script
cat > "${BINARIES_DIR}/organize.sh" << 'ORGANIZE_EOF'
#!/usr/bin/env bash
set -euo pipefail
BINARIES_DIR="${IGRIS_BINARIES_DIR:-/opt/igris-binaries}"
VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then echo "Usage: $0 <version-tag>" >&2; exit 1; fi
STAGING="${BINARIES_DIR}/staging/${VERSION}"
if [[ ! -d "$STAGING" ]]; then echo "Error: staging directory not found: $STAGING" >&2; exit 1; fi
echo "Organizing ${VERSION} binaries..."
platform_dir() {
    case "$1" in
        *linux-x64*|*linux-amd64*) echo "linux-amd64" ;;
        *linux-arm64*|*linux-aarch64*) echo "linux-arm64" ;;
        *linux-armv7*) echo "linux-armv7" ;;
        *macos-arm64*|*darwin-arm64*) echo "macos-arm64" ;;
        *macos-x64*|*darwin-x86_64*|*darwin-amd64*) echo "macos-x64" ;;
        *) echo "" ;;
    esac
}
moved=0
for f in "${STAGING}"/*; do
    [[ -e "$f" ]] || continue
    fname="$(basename "$f")"
    dir="$(platform_dir "$fname")"
    if [[ -z "$dir" ]]; then echo "  Skipping: $fname"; continue; fi
    mkdir -p "${BINARIES_DIR}/${dir}"
    mv "$f" "${BINARIES_DIR}/${dir}/"
    echo "  ${fname} -> ${dir}/"
    ((moved++))
done
rmdir "${STAGING}" 2>/dev/null || true
rmdir "${BINARIES_DIR}/staging" 2>/dev/null || true
echo "Done. Moved ${moved} files."
ORGANIZE_EOF

chmod +x "${BINARIES_DIR}/organize.sh"
chown "${IGRIS_USER}:${IGRIS_USER}" "${BINARIES_DIR}/organize.sh"
echo "Installed: ${BINARIES_DIR}/organize.sh"

# Print env var to add
echo ""
echo "=== Add to your igris-overture environment ==="
echo ""
echo "  RUNTIME_BINARIES_DIR=${BINARIES_DIR}"
echo ""
echo "If using a systemd service, add to /etc/igris-overture.env:"
echo "  echo 'RUNTIME_BINARIES_DIR=${BINARIES_DIR}' >> /etc/igris-overture.env"
echo "  systemctl restart igris-overture"
echo ""
echo "=== Setup complete ==="
