import { betterAuth } from 'better-auth';
import { admin, organization } from 'better-auth/plugins';
import { nextCookies } from 'better-auth/next-js';
import { dash } from '@better-auth/infra';
import { Pool } from 'pg';
import { Resend } from 'resend';

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
    sendResetPassword: async ({ user, url }) => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: 'Igris Inertial <noreply@igrisinertial.com>',
        to: user.email,
        subject: 'Reset your password',
        html: `
          <p>Hi ${user.name || 'there'},</p>
          <p>Click the link below to reset your password. This link expires in 1 hour.</p>
          <p><a href="${url}" style="color:#000;font-weight:600">Reset password →</a></p>
          <p style="color:#999;font-size:12px">If you didn't request this, you can ignore this email.</p>
        `,
      });
    },
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    } : {}),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      },
    } : {}),
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
