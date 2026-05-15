/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  typescript: {
    ignoreBuildErrors: true,
  },

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  },

  images: {
    unoptimized: true,
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' http://localhost:* https://*.igrisinertial.com",
              "frame-ancestors 'none'",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
            ].join('; '),
          },
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
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // Old dashboard sub-routes → new sidebar routes
      { source: '/dashboard/fleet',               destination: '/infrastructure/runtimes', permanent: true },
      { source: '/dashboard/fleet/:path*',        destination: '/infrastructure/runtimes', permanent: true },
      { source: '/dashboard/providers',           destination: '/models/providers',   permanent: true },
      { source: '/dashboard/providers/:path*',    destination: '/models/providers',   permanent: true },
      { source: '/dashboard/usage',               destination: '/history/metrics',    permanent: true },
      { source: '/dashboard/usage/:path*',        destination: '/history/metrics',    permanent: true },
      { source: '/dashboard/policy',              destination: '/policy/bounds',      permanent: true },
      { source: '/dashboard/policy/:path*',       destination: '/policy/bounds',      permanent: true },
      { source: '/dashboard/settings',            destination: '/settings/general',   permanent: true },
      { source: '/dashboard/settings/:path*',     destination: '/settings/general',   permanent: true },
      { source: '/dashboard/agents',              destination: '/execution/agents',   permanent: true },
      { source: '/dashboard/agents/:path*',       destination: '/execution/agents',   permanent: true },
      { source: '/dashboard/runtime',             destination: '/infrastructure/runtimes', permanent: true },
      { source: '/dashboard/runtime/:path*',      destination: '/infrastructure/runtimes', permanent: true },
      // Renamed: /fleet/devices → /infrastructure/runtimes (preserve [id]/ros-monitor sub-paths)
      { source: '/fleet/devices',                 destination: '/infrastructure/runtimes', permanent: true },
      { source: '/fleet/devices/:path*',          destination: '/infrastructure/runtimes/:path*', permanent: true },
      { source: '/dashboard/overture',            destination: '/models/routing',     permanent: true },
      { source: '/dashboard/overture/:path*',     destination: '/models/routing',     permanent: true },
      { source: '/dashboard/observability',       destination: '/history/logs',       permanent: true },
      { source: '/dashboard/observability/:path*',destination: '/history/logs',       permanent: true },
      { source: '/dashboard/cognitive',           destination: '/models/routing',     permanent: true },
      { source: '/dashboard/btree',               destination: '/dashboard',          permanent: true },
      { source: '/dashboard/btree/:path*',        destination: '/dashboard',          permanent: true },
      { source: '/getting-started',              destination: '/dashboard',           permanent: true },
    ];
  },
}

module.exports = nextConfig
