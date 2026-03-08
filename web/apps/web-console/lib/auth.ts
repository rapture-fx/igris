// Authentication helpers — Clerk is the single source of truth.
// The legacy cookie-based login/register/logout flows have been removed.

export async function getToken(): Promise<string | null | undefined> {
  return await window.Clerk?.session?.getToken();
}

export function isAuthenticated(): boolean {
  return !!window.Clerk?.session;
}
