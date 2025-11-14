export const runtime = 'edge';

export async function GET(request: Request) {
  const debug: any = {
    runtime: 'edge',
    hasProcessEnv: typeof process !== 'undefined',
  };

  try {
    // Try different ways to access bindings
    // @ts-ignore
    debug.processEnvDB = typeof process.env?.DB;

    // Try accessing from request
    // @ts-ignore
    debug.hasCloudflare = typeof request.cf !== 'undefined';

    // Try getRequestContext
    try {
      const { getRequestContext } = require('@cloudflare/next-on-pages');
      const ctx = getRequestContext();
      debug.hasContext = true;
      debug.hasEnv = !!ctx.env;
      debug.hasDB = !!ctx.env?.DB;
      debug.envKeys = ctx.env ? Object.keys(ctx.env) : [];
    } catch (e: any) {
      debug.contextError = e.message;
    }
  } catch (e: any) {
    debug.error = e.message;
  }

  return Response.json(debug);
}
