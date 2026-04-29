import { createAuthClient } from 'better-auth/react';
import { adminClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005',
  plugins: [adminClient()],
});

export const { signIn, signUp, signOut, getSession } = authClient;

// AUTH DISABLED FOR LOCAL DEVELOPMENT — stable mock session stops polling loop
const DEV_SESSION = {
  data: {
    user: {
      id: 'dev-user',
      name: 'Dev User',
      email: 'dev@localhost',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      image: null,
    },
    session: {
      id: 'dev-session',
      userId: 'dev-user',
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: new Date(),
      updatedAt: new Date(),
      token: 'dev-token',
      ipAddress: null,
      userAgent: null,
    },
  },
  isPending: false,
  error: null,
  refetch: () => Promise.resolve({ data: null, error: null }),
} as const;

export function useSession() {
  return DEV_SESSION;
}
