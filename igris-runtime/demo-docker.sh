#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

IMG="${IMG:-igris-runtime:runtime}"

echo "== build scratch image =="
docker build -f Dockerfile.runtime -t "$IMG" .

echo "== run =="
echo "Tip: mount ./models if you enable local_fallback.enabled=true"
docker run --rm -p 8080:8080 \
  -e IGRIS_CONFIG=/app/config.json5 \
  -v "$PWD/config.json5:/app/config.json5:ro" \
  "$IMG"


