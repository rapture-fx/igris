const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  // Pin the file-tracing root to the pnpm workspace root (web/). Without this,
  // Next.js auto-infers the root from the nearest lockfile and can pick a
  // stray lockfile higher up the tree, nesting the standalone output under an
  // unpredictable path. Pinning it makes the standalone layout deterministic:
  //   .next/standalone/apps/better-auth-upstream/server.js
  //   .next/standalone/node_modules/...
  // which is exactly what the Dockerfile copies and runs.
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

module.exports = nextConfig;
