// Next.js API Route for early access form submissions
// Uses Edge Runtime for Cloudflare Pages compatibility
export const runtime = 'edge';

interface Env {
  EARLY_ACCESS_KV?: KVNamespace;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    const { name, email, company, planInterest } = body;
    if (!name || !email || !company || !planInterest) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const submission = {
      ...body,
      timestamp: new Date().toISOString(),
      id: Date.now().toString()
    };

    // Access Cloudflare KV through process.env in Edge Runtime
    // @ts-ignore - Cloudflare bindings are available in Edge runtime
    const env = process.env as unknown as Env;

    // Store in Cloudflare KV (if available)
    if (env.EARLY_ACCESS_KV) {
      const key = `submission:${submission.id}`;
      await env.EARLY_ACCESS_KV.put(key, JSON.stringify(submission));

      // Also add to index
      const indexKey = 'submissions:index';
      const existingIndexStr = await env.EARLY_ACCESS_KV.get(indexKey);
      const existingIndex = existingIndexStr ? JSON.parse(existingIndexStr) : [];
      existingIndex.push(submission.id);
      await env.EARLY_ACCESS_KV.put(indexKey, JSON.stringify(existingIndex));
    }

    // Log to console (viewable in Cloudflare dashboard)
    console.log('Early access submission:', {
      id: submission.id,
      email,
      company,
      plan: planInterest
    });

    return Response.json(
      {
        message: 'Submission successful',
        id: submission.id
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error processing early access submission:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
