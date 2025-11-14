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
  /*eslint-disable */
  webpack: (config, { isServer }) => {
    // Fixed BigInt serialization
    const replacer = (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    };
    // Removed excessive logging that was causing server issues
    // console.log('Webpack config:', JSON.stringify(config, replacer, 2));
    return config;
  },
  /*eslint-enable */
}

module.exports = nextConfig