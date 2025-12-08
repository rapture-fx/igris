const withMDX = require('@next/mdx')({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [require('remark-gfm').default],
    rehypePlugins: [
      [require('rehype-mermaid').default, { strategy: 'img-svg' }]
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  reactStrictMode: true,
  transpilePackages: [],
  // Explicitly use webpack for MDX support
  webpack: (config) => {
    return config;
  },
};

module.exports = withMDX(nextConfig);
