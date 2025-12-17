// Cloudflare Pages Function for API health check
// Deployed at: /api/test

export async function onRequestGet() {
  return new Response(
    JSON.stringify({
      status: 'ok',
      message: 'API is working',
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
