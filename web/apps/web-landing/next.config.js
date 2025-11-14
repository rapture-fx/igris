/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Enable static HTML export for Cloudflare Pages
  trailingSlash: true, // Recommended for static hosting
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true, // Required for static export
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