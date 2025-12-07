/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed 'output: export' to enable server-side features (API routes, SSR)
  // This is required for Cloudflare Pages Functions to work
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true, // Keep this for Cloudflare compatibility
    domains: ['images.unsplash.com', 'via.placeholder.com'],
  },
  // Add empty turbopack config to silence webpack warning
  turbopack: {},
}

module.exports = nextConfig