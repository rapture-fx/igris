const path = require('path');

// Workspace root: web/ (where pnpm-workspace.yaml and node_modules live)
const workspaceRoot = path.join(__dirname, '../../');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  typescript: {
    ignoreBuildErrors: true,
  },

  // Both must point to the same directory for Next.js 16
  outputFileTracingRoot: workspaceRoot,
  turbopack: {
    root: workspaceRoot,
  },

  // Inline workspace packages into the bundle
  transpilePackages: [
    '@igris-inertial/ui',
    '@igris-inertial/types',
    '@igris-inertial/javascript-sdk',
  ],

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  },

  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
