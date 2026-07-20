#!/usr/bin/env bash
#
# Regression guard: a shallow clone must be able to obtain the immutable
# Schema-1 protocol release dependency via scripts/ci/fetch_frozen_protocol_release.sh
# without full-history checkout and without falling back to HEAD.
#
# Usage:
#   scripts/ci/test_fetch_frozen_protocol_release_shallow.sh
#
# Requires network access to origin (or a remote that carries tag
# schema1-conformance-v1.0.0). Skips cleanly when ORIGIN_URL is unavailable
# only if IGRIS_ALLOW_SKIP_PROTOCOL_FETCH_TEST=1 (not used in Proof Gate).

set -euo pipefail

PROTOCOL_RELEASE_COMMIT="f98ef76e4fe0cb6b52341639d42cf99213623465"
FROZEN_MANIFEST_SHA256="864e8043944191222af789b3d0dd3d947f03b1aadf52651bde97511d807776f4"

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT_DIR"

ORIGIN_URL=$(git remote get-url origin)
TMP_DIR=$(mktemp -d)
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

echo "[shallow-protocol-fetch-test] cloning depth=1 from ${ORIGIN_URL}"
git clone --depth 1 "${ORIGIN_URL}" "${TMP_DIR}/shallow"
cd "${TMP_DIR}/shallow"

if git cat-file -e "${PROTOCOL_RELEASE_COMMIT}^{commit}" 2>/dev/null; then
  echo "shallow-protocol-fetch-test: unexpected — release commit already present in depth=1 clone" >&2
  exit 1
fi

# Copy the fetch helper into the shallow clone so it runs against THIS work tree.
mkdir -p scripts/ci
cp "${ROOT_DIR}/scripts/ci/fetch_frozen_protocol_release.sh" scripts/ci/
chmod +x scripts/ci/fetch_frozen_protocol_release.sh
bash scripts/ci/fetch_frozen_protocol_release.sh

got_commit=$(git rev-parse "${PROTOCOL_RELEASE_COMMIT}^{commit}")
if [[ "$got_commit" != "$PROTOCOL_RELEASE_COMMIT" ]]; then
  echo "shallow-protocol-fetch-test: resolved ${got_commit}, expected ${PROTOCOL_RELEASE_COMMIT}" >&2
  exit 1
fi

got_sha=$(git show "${PROTOCOL_RELEASE_COMMIT}:spec/test-vectors/suite-schema-1/manifest.json" | shasum -a 256 | awk '{print $1}')
if [[ "$got_sha" != "$FROZEN_MANIFEST_SHA256" ]]; then
  echo "shallow-protocol-fetch-test: manifest SHA ${got_sha} != ${FROZEN_MANIFEST_SHA256}" >&2
  exit 1
fi

# Must not silently use HEAD for the protocol tree.
head_sha=$(git rev-parse HEAD)
if [[ "$head_sha" == "$PROTOCOL_RELEASE_COMMIT" ]]; then
  echo "shallow-protocol-fetch-test: HEAD unexpectedly equals protocol release (test invalid)" >&2
  exit 1
fi

echo "[shallow-protocol-fetch-test] OK"
