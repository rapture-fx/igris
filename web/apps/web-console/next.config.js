/** @type {import('next').NextConfig} */
const nextConfig = {
  // SSR mode for Cloudflare Pages (required for Clerk middleware)
  // DO NOT use output: 'export' - it breaks authentication middleware
  reactStrictMode: true,

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  // Inline workspace packages into the bundle (replaces outputFileTracingRoot)
  transpilePackages: [
    '@igris-inertial/ui',
    '@igris-inertial/types',
    '@igris-inertial/javascript-sdk',
  ],

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  },

  images: {
    unoptimized: true, // Required for Cloudflare Pages
  },
}

module.exports = nextConfig
