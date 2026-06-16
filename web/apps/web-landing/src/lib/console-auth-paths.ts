/** Stable post-auth paths on the Rails console (see rails-console/AUTH_ROUTES.md). */
export const CONSOLE_AUTH_PATHS = {
  onboarding: '/onboarding',
  dashboard: '/dashboard',
  resetPassword: '/reset-password',
} as const;

export type ConsoleAuthPath = keyof typeof CONSOLE_AUTH_PATHS;

export function consoleAuthUrl(consoleOrigin: string, path: ConsoleAuthPath): string {
  const base = consoleOrigin.replace(/\/$/, '');
  return `${base}${CONSOLE_AUTH_PATHS[path]}`;
}