/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  transpilePackages: ['@schlep-engine/ui', '@schlep-engine/types'],
}

module.exports = nextConfig