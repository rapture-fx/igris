const path = require('path');

const withMDX = require('@next/mdx')({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [require('remark-gfm').default],
    rehypePlugins: [],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Enable static export for Cloudflare Pages
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  reactStrictMode: true,
  transpilePackages: [],
  images: {
    unoptimized: true, // Required for static export
  },
  // Set workspace root for proper file tracing in monorepo
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Explicitly use webpack for MDX support
  webpack: (config) => {
    return config;
  },
};

module.exports = withMDX(nextConfig);
