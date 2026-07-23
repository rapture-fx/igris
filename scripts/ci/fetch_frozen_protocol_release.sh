#!/usr/bin/env bash
#
# Ensure the immutable Schema-1 protocol release commit is available in the
# current git work tree so Clock 3B proof steps can `git show` / `git archive`
# it.
#
# Hosted Proof Gate uses actions/checkout with fetch-depth: 1. The protocol
# release commit is not an ancestor of the Clock 3C product line, so it is
# absent from that shallow clone unless fetched explicitly.
#
# Immutable identity (do not change):
#   tag:    schema1-conformance-v1.0.0  (annotated)
#   commit: f98ef76e4fe0cb6b52341639d42cf99213623465
#   manifest SHA-256: 864e8043944191222af789b3d0dd3d947f03b1aadf52651bde97511d807776f4
#
# Operates on the current work tree (PWD). Never falls back to HEAD or a
# different manifest. Does not modify product semantics.

set -euo pipefail

PROTOCOL_RELEASE_TAG="schema1-conformance-v1.0.0"
PROTOCOL_RELEASE_COMMIT="f98ef76e4fe0cb6b52341639d42cf99213623465"
FROZEN_MANIFEST_SHA256="864e8043944191222af789b3d0dd3d947f03b1aadf52651bde97511d807776f4"
MANIFEST_PATH="spec/test-vectors/suite-schema-1/manifest.json"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "fetch_frozen_protocol_release: not inside a git work tree" >&2
  exit 1
fi

if git cat-file -e "${PROTOCOL_RELEASE_COMMIT}^{commit}" 2>/dev/null; then
  echo "[protocol-release] commit ${PROTOCOL_RELEASE_COMMIT} already present"
else
  echo "[protocol-release] fetching immutable tag ${PROTOCOL_RELEASE_TAG} (depth=1)"
  # Prefer the annotated release tag over a floating branch tip.
  git fetch --depth=1 origin "tag" "${PROTOCOL_RELEASE_TAG}"
fi

if ! git cat-file -e "${PROTOCOL_RELEASE_COMMIT}^{commit}" 2>/dev/null; then
  echo "fetch_frozen_protocol_release: required commit ${PROTOCOL_RELEASE_COMMIT} is still unavailable after fetch" >&2
  exit 1
fi

# If the tag ref is present, its peeled target must be exactly the frozen commit.
if git rev-parse -q --verify "refs/tags/${PROTOCOL_RELEASE_TAG}" >/dev/null; then
  peeled=$(git rev-parse "${PROTOCOL_RELEASE_TAG}^{}")
  if [[ "$peeled" != "$PROTOCOL_RELEASE_COMMIT" ]]; then
    echo "fetch_frozen_protocol_release: tag ${PROTOCOL_RELEASE_TAG} peels to ${peeled}, expected ${PROTOCOL_RELEASE_COMMIT}" >&2
    exit 1
  fi
  echo "[protocol-release] tag ${PROTOCOL_RELEASE_TAG} peels to ${PROTOCOL_RELEASE_COMMIT}"
fi

manifest_sha=$(git show "${PROTOCOL_RELEASE_COMMIT}:${MANIFEST_PATH}" | shasum -a 256 | awk '{print $1}')
if [[ "$manifest_sha" != "$FROZEN_MANIFEST_SHA256" ]]; then
  echo "fetch_frozen_protocol_release: frozen manifest SHA mismatch: got ${manifest_sha}, expected ${FROZEN_MANIFEST_SHA256}" >&2
  exit 1
fi

echo "[protocol-release] OK commit=${PROTOCOL_RELEASE_COMMIT} manifest_sha256=${manifest_sha}"
