/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['images.unsplash.com'],
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/getting-started',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig