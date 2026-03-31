/**
 * Next.js instrumentation hook — runs once on server startup.
 *
 * BetterAuth's background session-refresh fires Set-Cookie in a fire-and-forget
 * async operation that can race with an already-committed response stream.  Next.js
 * surfaces this as an uncaughtException with code ERR_HTTP_HEADERS_SENT.  The
 * request itself has already completed successfully; the error is benign but noisy
 * and would eventually crash the Node process if left unhandled.
 *
 * We suppress only that specific error code and re-throw everything else so that
 * real crashes still surface normally.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ERR_HTTP_HEADERS_SENT') {
        return;
      }
      // Re-throw so Next.js default handling takes over for any other error
      throw err;
    });
  }
}
