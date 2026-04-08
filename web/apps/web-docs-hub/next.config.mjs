import { fileURLToPath } from 'url';
import path from 'path';
import { createMDX } from 'fumadocs-mdx/next';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  eslint: {
    ignoreDuringBuilds: true,
  },
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname);
    config.infrastructureLogging = {
      ...(config.infrastructureLogging ?? {}),
      level: 'error',
    };
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      (warning) => {
        const message = warning?.message ?? '';
        const details = warning?.details ?? '';

        return (
          message.includes('webpack.cache.PackFileCacheStrategy') &&
          message.includes('fumadocs-mdx') &&
          details.includes("import(url.href)")
        );
      },
    ];

    return config;
  },
};

export default createMDX()(nextConfig);
