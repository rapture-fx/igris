import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const body = await request.json();

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

    // Get Cloudflare bindings using getRequestContext
    const { env } = getRequestContext();

    // Check if DB binding exists
    if (!env.DB) {
      console.error('D1 database binding not found');
      return new Response(
        JSON.stringify({
          error: 'Database configuration error',
          details: 'D1 binding not found. Please configure DB binding in Cloudflare Pages.'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Insert into D1 database
    try {
      const result = await env.DB.prepare(
        'INSERT INTO signups (name, email, company, plan_interest, message) VALUES (?, ?, ?, ?, ?)'
      )
        .bind(name, email, company, planInterest, body.message || null)
        .run();

      if (result.success) {
        console.log('Submission stored in D1:', { email, company, plan: planInterest, name });

        return new Response(
          JSON.stringify({
            message: 'Submission successful',
            id: result.meta.last_row_id
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        throw new Error('Database insertion failed');
      }
    } catch (dbError: any) {
      // Check for unique constraint violation (duplicate email)
      if (dbError.message && dbError.message.includes('UNIQUE constraint failed')) {
        console.log('Duplicate email submission attempt:', email);
        return new Response(
          JSON.stringify({ error: 'This email has already been registered for early access' }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw dbError;
    }
  } catch (error: any) {
    console.error('Error processing early access submission:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
