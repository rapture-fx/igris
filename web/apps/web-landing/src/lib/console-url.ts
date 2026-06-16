const PROD_CONSOLE = 'https://console.igrisinertial.com';
const LOCAL_CONSOLE = 'http://localhost:3100';

/** Console origin for auth redirects and better-auth API calls. */
export function getConsoleUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'localhost' ? LOCAL_CONSOLE : PROD_CONSOLE;
  }
  return process.env.NEXT_PUBLIC_CONSOLE_URL || PROD_CONSOLE;
}