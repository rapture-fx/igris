export const runtime = 'edge';

export async function GET() {
  const debug = {
    // @ts-ignore
    processEnvDB: typeof process.env.DB,
    // @ts-ignore
    processEnvKeys: Object.keys(process.env).filter(k => k.includes('D')),
  };

  try {
    // @ts-ignore
    const { getRequestContext } = await import('@cloudflare/next-on-pages');
    const ctx = getRequestContext();
    debug.hasContext = true;
    // @ts-ignore
    debug.envKeys = Object.keys(ctx.env || {});
    // @ts-ignore
    debug.hasDB = !!ctx.env?.DB;
  } catch (e: any) {
    debug.hasContext = false;
    debug.error = e.message;
  }

  return Response.json(debug);
}
