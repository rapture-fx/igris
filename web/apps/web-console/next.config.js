/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  experimental: {
    instrumentationHook: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  // Inline workspace packages into the bundle
  transpilePackages: [
    '@igris-inertial/ui',
    '@igris-inertial/types',
    '@igris-inertial/javascript-sdk',
  ],

  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  },

  images: {
    unoptimized: true,
  },

  async redirects() {
    return [
      // Old dashboard sub-routes → new sidebar routes
      { source: '/dashboard/fleet',               destination: '/fleet/devices',      permanent: true },
      { source: '/dashboard/fleet/:path*',        destination: '/fleet/devices',      permanent: true },
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
      { source: '/dashboard/runtime',             destination: '/fleet/devices',      permanent: true },
      { source: '/dashboard/runtime/:path*',      destination: '/fleet/devices',      permanent: true },
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
