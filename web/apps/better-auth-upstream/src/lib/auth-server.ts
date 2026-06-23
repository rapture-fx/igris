import { betterAuth } from 'better-auth';
import { Pool } from 'pg';
import { sendTransactionalEmail, passwordResetEmail, verificationEmail } from './email';

let pool: Pool | null = null;

function databasePool(): Pool | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;

  if (!pool) {
    pool = new Pool({ connectionString: url });
  }
  return pool;
}

/** BetterAuth handler backed by Neon Postgres (shared session tables with Overture). */
export function createAuthHandler() {
  const db = databasePool();
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (!db || !secret) return null;

  const consoleOrigin =
    process.env.BETTER_AUTH_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_CONSOLE_URL?.trim() ||
    'http://localhost:3100';

  const landingOrigin =
    process.env.NEXT_PUBLIC_LANDING_URL?.trim() || 'http://localhost:3000';

  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    socialProviders.github = {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
  }

  // Gate hard email-verification behind an env flag so a misconfigured mailer
  // can never lock the whole tenant base out of login. Verification emails are
  // still sent on signup regardless; this only controls whether login is blocked
  // until the address is confirmed.
  const requireEmailVerification =
    process.env.IGRIS_REQUIRE_EMAIL_VERIFICATION?.trim() === 'true';

  return betterAuth({
    database: db,
    secret,
    baseURL: consoleOrigin,
    trustedOrigins: [consoleOrigin, landingOrigin],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification,
      // BetterAuth generates the single-use, expiring token and the `url`; we
      // only deliver it. Never log `url`/`token`.
      sendResetPassword: async ({ user, url }) => {
        const msg = passwordResetEmail(url);
        await sendTransactionalEmail({ to: user.email, ...msg });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const msg = verificationEmail(url);
        await sendTransactionalEmail({ to: user.email, ...msg });
      },
    },
    socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
  });
}