/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@schlep-engine/ui', '@schlep-engine/types'],
  swcMinify: false,
  experimental: {
    esmExternals: false,
  },
  eslint: {
    // Disable ESLint during builds to prevent build failures on warnings
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig