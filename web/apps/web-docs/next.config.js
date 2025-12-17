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
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  reactStrictMode: true,
  transpilePackages: [],
  images: {
    unoptimized: true, // Required for static export
  },
  // Explicitly use webpack for MDX support
  webpack: (config) => {
    return config;
  },
};

module.exports = withMDX(nextConfig);
