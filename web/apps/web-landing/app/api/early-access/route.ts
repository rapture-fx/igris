// Next.js API Route for early access form submissions
// Uses Edge Runtime for Cloudflare Pages compatibility with D1 database
export const runtime = 'edge';

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

    // Access Cloudflare D1 binding directly from process.env
    // @ts-ignore - Cloudflare bindings available in edge runtime
    const DB = process.env.DB as D1Database | undefined;

    // Store in Cloudflare D1 (if available)
    if (DB) {
      try {
        // Insert into database
        const result = await DB.prepare(
          'INSERT INTO signups (name, email, company, plan_interest, message) VALUES (?, ?, ?, ?, ?)'
        )
          .bind(
            name,
            email,
            company,
            planInterest,
            body.message || null
          )
          .run();

        if (result.success) {
          console.log('Submission stored in D1:', {
            email,
            company,
            plan: planInterest,
            name
          });

          return Response.json(
            {
              message: 'Submission successful',
              id: result.meta.last_row_id
            },
            { status: 200 }
          );
        } else {
          throw new Error('Database insertion failed');
        }
      } catch (dbError: any) {
        // Check for unique constraint violation (duplicate email)
        if (dbError.message?.includes('UNIQUE constraint failed')) {
          console.log('Duplicate email submission attempt:', email);
          return Response.json(
            { error: 'This email has already been registered for early access' },
            { status: 409 }
          );
        }
        throw dbError;
      }
    } else {
      // Fallback: Log to console when D1 is not available (local dev)
      console.log('D1 not available - submission logged but not stored:', {
        email,
        company,
        plan: planInterest,
        name,
        message: body.message || '(no message)'
      });

      return Response.json(
        {
          message: 'Submission successful (logged only - D1 not configured)',
          id: Date.now()
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error processing early access submission:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
