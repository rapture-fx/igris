#!/usr/bin/env bash
# Organizes staged release binaries into the correct platform directories.
# Run on the VPS after uploading new release artifacts.
# Usage: ./vps-organize-binaries.sh <version-tag>
# Example: ./vps-organize-binaries.sh runtime-v1.7.0

set -euo pipefail

BINARIES_DIR="${IGRIS_BINARIES_DIR:-/opt/igris-binaries}"
VERSION="${1:-}"

if [[ -z "$VERSION" ]]; then
    echo "Usage: $0 <version-tag>" >&2
    echo "Example: $0 runtime-v1.7.0" >&2
    exit 1
fi

STAGING="${BINARIES_DIR}/staging/${VERSION}"

if [[ ! -d "$STAGING" ]]; then
    echo "Error: staging directory not found: $STAGING" >&2
    exit 1
fi

echo "Organizing ${VERSION} binaries from ${STAGING}..."

platform_dir() {
    local filename="$1"
    case "$filename" in
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

    if [[ -z "$dir" ]]; then
        echo "  Skipping unrecognized file: $fname"
        continue
    fi

    mkdir -p "${BINARIES_DIR}/${dir}"
    mv "$f" "${BINARIES_DIR}/${dir}/"
    echo "  ${fname} → ${dir}/"
    ((moved++))
done

# Cleanup empty staging dir
rmdir "${STAGING}" 2>/dev/null || true
rmdir "${BINARIES_DIR}/staging" 2>/dev/null || true

echo "Done. Moved ${moved} files."
echo ""
echo "Verify:"
ls -lh "${BINARIES_DIR}/linux-amd64/" 2>/dev/null || echo "  linux-amd64: (empty)"
ls -lh "${BINARIES_DIR}/linux-arm64/" 2>/dev/null || echo "  linux-arm64: (empty)"
ls -lh "${BINARIES_DIR}/macos-arm64/" 2>/dev/null || echo "  macos-arm64: (empty)"
