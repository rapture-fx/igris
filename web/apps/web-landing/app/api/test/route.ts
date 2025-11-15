export const runtime = 'edge';

export async function GET() {
  return new Response(
    JSON.stringify({
      message: 'Test endpoint works!',
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    return new Response(
      JSON.stringify({
        message: 'Received your data!',
        data: body,
        envKeys: Object.keys(process.env),
        hasDB: 'DB' in (process.env as any)
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
