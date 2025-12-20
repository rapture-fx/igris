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
  // Only use basePath when building for production (Cloudflare Pages)
  // In dev mode, basePath is empty so you can access http://localhost:3002 directly
  basePath: process.env.NEXT_PUBLIC_USE_BASEPATH === 'true' ? '/overture' : '',
  // Only use static export for production builds, not in dev mode
  // Static export doesn't work with dev server, so we conditionally set it
  ...(process.env.NEXT_PUBLIC_USE_BASEPATH === 'true' ? { output: 'export' } : {}),
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
  // Explicitly use webpack for MDX support and path resolution
  webpack: (config, options) => {
    // Ensure @ alias is properly set
    config.resolve.alias['@'] = path.resolve(__dirname);
    return config;
  },
};

module.exports = withMDX(nextConfig);
