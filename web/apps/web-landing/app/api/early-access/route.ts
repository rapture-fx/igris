// Next.js API Route for Cloudflare Pages with D1
// Must use edge runtime to access Cloudflare bindings
export const runtime = 'edge';

interface Env {
  DB: D1Database;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
    const { name, email, company, planInterest } = body;
    if (!name || !email || !company || !planInterest) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Access D1 database from process.env (Cloudflare binding)
    const db = (process.env as unknown as Env).DB;

    if (!db) {
      console.error('D1 database binding not found');
      return new Response(
        JSON.stringify({ error: 'Database configuration error' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Insert into D1 database
    try {
      const result = await db.prepare(
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
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      } else {
        throw new Error('Database insertion failed');
      }
    } catch (dbError: any) {
      // Check for unique constraint violation (duplicate email)
      if (dbError.message?.includes('UNIQUE constraint failed')) {
        console.log('Duplicate email submission attempt:', email);
        return new Response(
          JSON.stringify({ error: 'This email has already been registered for early access' }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      throw dbError;
    }
  } catch (error) {
    console.error('Error processing early access submission:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
