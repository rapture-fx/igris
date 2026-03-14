import { betterAuth } from 'better-auth';
import { admin, organization } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { dash } from '@better-auth/infra';
import { Pool } from 'pg';

export const auth = betterAuth({
  appName: 'Igris Inertial',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3005',
  secret: process.env.BETTER_AUTH_SECRET!,
  apiKey: process.env.BETTER_AUTH_API_KEY,
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  plugins: [
    admin(),
    organization(),
    dash(),
    nextCookies(),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: process.env.NODE_ENV === 'production',
      domain: process.env.COOKIE_DOMAIN || 'igrisinertial.com',
    },
  },
  trustedOrigins: [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005',
    process.env.NEXT_PUBLIC_API_URL || 'https://overture.igrisinertial.com',
    'https://console.igrisinertial.com',
    'http://localhost:8081',
  ],
});
