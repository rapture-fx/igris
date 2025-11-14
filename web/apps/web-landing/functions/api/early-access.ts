// Cloudflare Pages Function for early access form submissions
// This replaces the Next.js API route when deployed to Cloudflare Pages

interface Env {
  EARLY_ACCESS_KV?: KVNamespace;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const body = await context.request.json();

    // Validate required fields
    const { name, email, company, planInterest } = body;
    if (!name || !email || !company || !planInterest) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const submission = {
      ...body,
      timestamp: new Date().toISOString(),
      id: Date.now().toString()
    };

    // Store in Cloudflare KV (if available)
    if (context.env.EARLY_ACCESS_KV) {
      const key = `submission:${submission.id}`;
      await context.env.EARLY_ACCESS_KV.put(key, JSON.stringify(submission));

      // Also add to index
      const indexKey = 'submissions:index';
      const existingIndex = await context.env.EARLY_ACCESS_KV.get(indexKey, 'json') || [];
      existingIndex.push(submission.id);
      await context.env.EARLY_ACCESS_KV.put(indexKey, JSON.stringify(existingIndex));
    }

    // Log to console (viewable in Cloudflare dashboard)
    console.log('Early access submission:', {
      id: submission.id,
      email,
      company,
      plan: planInterest
    });

    return new Response(
      JSON.stringify({
        message: 'Submission successful',
        id: submission.id
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error processing early access submission:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
