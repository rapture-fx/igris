/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@schlep-engine/ui', '@schlep-engine/types'],
  swcMinify: true,
  experimental: {
    esmExternals: false,
  },
  eslint: {
    // Disable ESLint during builds to prevent build failures on warnings
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Increase webpack timeout for dev server
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    
    // Optimize chunk splitting
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        ...config.optimization?.splitChunks,
        cacheGroups: {
          ...config.optimization?.splitChunks?.cacheGroups,
          framework: {
            name: 'framework',
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            chunks: 'all',
            enforce: true,
          },
          lib: {
            name: 'lib',
            test: /[\\/]node_modules[\\/]/,
            chunks: 'all',
            minChunks: 2,
          },
        },
      },
    }
    
    return config
  },
}

module.exports = nextConfig