// Ambient type augmentation for the Clerk global object injected by @clerk/nextjs.
// Only the subset used by apiClient.ts and auth.ts is declared here.

interface ClerkSession {
  getToken(): Promise<string | null>;
}

interface ClerkInstance {
  session?: ClerkSession | null;
}

interface Window {
  Clerk?: ClerkInstance;
}
