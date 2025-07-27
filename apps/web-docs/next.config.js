/** @type {import('next').NextConfig} */
const nextConfig = {
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