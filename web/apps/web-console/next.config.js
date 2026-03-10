/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  typescript: {
    ignoreBuildErrors: true,
  },

  // Inline workspace packages into the bundle
  transpilePackages: [
    '@igris-inertial/ui',
    '@igris-inertial/types',
    '@igris-inertial/javascript-sdk',
  ],

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  },

  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
