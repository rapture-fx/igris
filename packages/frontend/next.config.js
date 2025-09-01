/** @type {import('next').NextConfig} */
const nextConfig = {
  // Environment and API configuration
  env: {
    BACKEND_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    WS_HOST: process.env.NEXT_PUBLIC_WS_HOST || 'localhost:8000',
  },
  
  // Environment variables validation
  publicRuntimeConfig: {
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
    wsHost: process.env.NEXT_PUBLIC_WS_HOST,
    enableMLFeatures: process.env.NEXT_PUBLIC_ENABLE_ML_FEATURES === 'true',
    enableRealTime: process.env.NEXT_PUBLIC_ENABLE_REAL_TIME === 'true',
  },
  
  // Server runtime config (private)
  serverRuntimeConfig: {
    apiSecret: process.env.API_SECRET,
    internalApiUrl: process.env.INTERNAL_API_URL,
  },

  // Image optimization
  images: {
    domains: ['localhost'],
    unoptimized: process.env.NODE_ENV === 'development',
    formats: ['image/webp', 'image/avif'],
  },

  // Performance and optimization
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },

  // Build configuration
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['src', 'pages', 'components', 'lib', 'app'],
  },

  // Webpack configuration for better stability
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Improve module resolution
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }

    // Optimize chunks in production
    if (!dev) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          common: {
            minChunks: 2,
            chunks: 'all',
            enforce: true,
            priority: 1,
          },
        },
      }
    }

    // Handle SVG imports
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    })

    return config
  },


  // Redirects for common issues
  async redirects() {
    return [
      {
        source: '/docs',
        destination: '/documentation',
        permanent: true,
      },
    ]
  },

  // Output configuration
  output: 'standalone',
  
  // Development server configuration with API proxy
  ...(process.env.NODE_ENV === 'development' && {
    async rewrites() {
      return [
        {
          source: '/api/proxy/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
        },
        {
          source: '/api/health',
          destination: `${process.env.NEXT_PUBLIC_API_URL}/health`,
        },
      ]
    },
    onDemandEntries: {
      maxInactiveAge: 25 * 1000,
      pagesBufferLength: 2,
    },
  }),
  
  // API routes configuration
  async headers() {
    const headers = [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ]
    
    // Add CORS headers for development
    if (process.env.NODE_ENV === 'development') {
      headers.push({
        source: '/api/proxy/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,POST,PUT,DELETE,OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type,Authorization',
          },
        ],
      })
    }
    
    return headers
  },
}

module.exports = nextConfig 