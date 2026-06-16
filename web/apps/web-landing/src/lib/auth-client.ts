import { createAuthClient } from 'better-auth/react';
import { getConsoleUrl } from './console-url';

export const authClient = createAuthClient({
  baseURL: getConsoleUrl(),
});

export const { signIn, signUp, signOut, getSession } = authClient;