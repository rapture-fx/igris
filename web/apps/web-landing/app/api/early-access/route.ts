// Next.js API Route for early access form submissions
// Uses Edge Runtime for Cloudflare Pages compatibility
import { getRequestContext } from '@cloudflare/next-on-pages';

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

    // Access Cloudflare bindings using getRequestContext
    // This only works in production (Cloudflare Pages), not in local dev
    let env: Env | undefined;
    try {
      const context = getRequestContext();
      env = context.env as Env;
    } catch (e) {
      // In local development, getRequestContext is not available
      console.log('Running in local dev mode (no KV storage)');
    }

    // Store in Cloudflare KV (if available)
    if (env?.EARLY_ACCESS_KV) {
      const key = `submission:${submission.id}`;
      await env.EARLY_ACCESS_KV.put(key, JSON.stringify(submission));

      // Also add to index
      const indexKey = 'submissions:index';
      const existingIndexStr = await env.EARLY_ACCESS_KV.get(indexKey);
      const existingIndex = existingIndexStr ? JSON.parse(existingIndexStr) : [];
      existingIndex.push(submission.id);
      await env.EARLY_ACCESS_KV.put(indexKey, JSON.stringify(existingIndex));

      console.log('Submission stored in KV:', submission.id);
    } else {
      console.log('KV not available - submission logged but not stored');
    }

    // Log to console (viewable in Cloudflare dashboard)
    console.log('Early access submission:', {
      id: submission.id,
      email,
      company,
      plan: planInterest,
      name,
      message: body.message || '(no message)'
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
