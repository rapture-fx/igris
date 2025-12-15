/** @type {import('next').NextConfig} */
const nextConfig = {
  // Removed 'output: export' to enable server-side features (API routes, SSR)
  // This is required for Cloudflare Pages Functions to work
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true, // Keep this for Cloudflare compatibility
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
    ],
  },
  // Configure Turbopack root for monorepo
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig