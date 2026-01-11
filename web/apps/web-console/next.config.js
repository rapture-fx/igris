const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

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

  // Monorepo support - prevent symlink issues
  outputFileTracingRoot: path.join(__dirname, '../../'),
}

module.exports = nextConfig
