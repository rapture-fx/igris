#!/usr/bin/env bash
set -euo pipefail

sudo apt-get update
sudo apt-get install -y --no-install-recommends postgresql-client
sudo rm -rf /var/lib/apt/lists/*

corepack enable
corepack prepare pnpm@8.15.0 --activate
python -m pip install --user --disable-pip-version-check uv

python --version
go version
rustc --version
node --version
pnpm --version
docker --version
psql --version
uv --version

printf '\nIgris toolchain is ready. See docs/development/cloud-development.md.\n'
