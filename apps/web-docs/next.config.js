/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['images.unsplash.com'],
  },
  eslint: {
    // Disable ESLint during builds temporarily
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Also ignore TypeScript errors during builds temporarily
    ignoreBuildErrors: false,
  },
  experimental: {
    forceSwcTransforms: true,
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/introduction',
        permanent: false,
      },
    ]
  },
}

module.exports = nextConfig