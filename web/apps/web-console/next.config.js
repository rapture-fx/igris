const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Static export for Cloudflare Pages
  reactStrictMode: true,

  typescript: {
    ignoreBuildErrors: true, // Ignore TypeScript errors during build
  },

  eslint: {
    ignoreDuringBuilds: true, // Ignore ESLint errors during build
  },

  transpilePackages: [
    '@igris-inertial/ui',
    '@igris-inertial/types',
    '@igris-inertial/javascript-sdk',
  ],

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081',
  },

  images: {
    unoptimized: true, // Required for Cloudflare Pages
  },

  // Monorepo support
  outputFileTracingRoot: path.join(__dirname, '../../'),
}

module.exports = nextConfig
