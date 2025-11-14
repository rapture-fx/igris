# Complete Code - D1 Database for Early Access Signups

## ✅ All Files Ready - Complete Implementation

---

## 1. Database Migration

**File:** `migrations/0001_create_signups.sql`

```sql
-- Migration: Create signups table for early access emails
-- Database: D1
-- Created: 2024-11-14

CREATE TABLE IF NOT EXISTS signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    company TEXT NOT NULL,
    plan_interest TEXT NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_signups_email ON signups(email);

-- Create index for timestamp queries
CREATE INDEX IF NOT EXISTS idx_signups_created_at ON signups(created_at);
```

---

## 2. API Route Handler

**File:** `app/api/early-access/route.ts`

```typescript
// Next.js API Route for early access form submissions
// Uses Edge Runtime for Cloudflare Pages compatibility with D1 database
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

interface Env {
  DB?: D1Database;
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

    // Access Cloudflare bindings using getRequestContext
    // This only works in production (Cloudflare Pages), not in local dev
    let env: Env | undefined;
    try {
      const context = getRequestContext();
      env = context.env as Env;
    } catch (e) {
      // In local development, getRequestContext is not available
      console.log('Running in local dev mode (no D1 database)');
    }

    // Store in Cloudflare D1 (if available)
    if (env?.DB) {
      try {
        // Insert into database
        const result = await env.DB.prepare(
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
```

---

## 3. Form Submission Code (Already Implemented)

**File:** `src/components/modals/EarlyAccessModal.tsx` (excerpt)

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  // Validation
  const errors = {
    name: !formData.name.trim(),
    email: !formData.email.trim(),
    company: !formData.company.trim(),
    planInterest: !formData.planInterest,
  };

  setValidationErrors(errors);

  if (Object.values(errors).some(Boolean)) {
    setError('Please fill in all required fields.');
    return;
  }

  setError('');
  setIsSubmitting(true);

  try {
    const response = await fetch('/api/early-access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...formData,
        timestamp: new Date().toISOString()
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Submission failed');
    }

    setIsSubmitted(true);
    setFormData({
      name: '',
      email: '',
      company: '',
      planInterest: '',
      message: ''
    });
  } catch (err: any) {
    setError(err.message || 'Failed to submit form. Please try again later.');
    console.error('Form submission error:', err);
  } finally {
    setIsSubmitting(false);
  }
};
```

---

## 4. Wrangler Configuration

**File:** `wrangler.toml`

```toml
name = "schlep-engine-landing"
compatibility_date = "2024-09-01"
compatibility_flags = ["nodejs_compat"]

pages_build_output_dir = ".vercel/output/static"

# D1 Database binding for early access signups
[[d1_databases]]
binding = "DB"
database_name = "schlep-signups"
database_id = "your-database-id-here"  # Replace after creation

[env.production]
[[env.production.d1_databases]]
binding = "DB"
database_name = "schlep-signups"
database_id = "your-production-database-id"  # Replace after creation
```

---

## 5. Package.json Scripts

**File:** `package.json` (relevant scripts)

```json
{
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "pages:build": "npx @cloudflare/next-on-pages",
    "start": "next start -p 3000",
    "lint": "next lint"
  }
}
```

---

## Deployment Steps

### 1. Create D1 Database

```bash
cd web/apps/web-landing
pnpm wrangler d1 create schlep-signups
```

Copy the `database_id` from the output.

### 2. Update wrangler.toml

Replace `your-database-id-here` with the actual database ID.

### 3. Run Migration

```bash
pnpm wrangler d1 migrations apply schlep-signups
```

### 4. Configure in Cloudflare Dashboard

1. Go to **Pages** → **Your Project** → **Settings** → **Functions**
2. Add **D1 database binding**:
   - Variable name: `DB`
   - Database: `schlep-signups`

### 5. Deploy

```bash
# Build
pnpm pages:build

# Deploy
pnpm wrangler pages deploy .vercel/output/static
```

Or push to Git (auto-deploy).

---

## Verify Signups

```bash
# View all signups
pnpm wrangler d1 execute schlep-signups --command "SELECT * FROM signups ORDER BY created_at DESC"

# Count signups
pnpm wrangler d1 execute schlep-signups --command "SELECT COUNT(*) FROM signups"

# Export to JSON
pnpm wrangler d1 execute schlep-signups --command "SELECT * FROM signups" --json > signups.json
```

---

## Features Implemented

✅ **Email validation** - Checks for valid email format
✅ **Duplicate prevention** - UNIQUE constraint on email field
✅ **Error handling** - Proper HTTP status codes (400, 409, 500)
✅ **Local dev support** - Works without D1 in development
✅ **Production ready** - Fully compatible with Cloudflare Pages
✅ **Automatic timestamps** - Created_at field auto-populated
✅ **Indexed queries** - Fast lookups by email and date

---

## Database Schema

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT |
| `name` | TEXT | NOT NULL |
| `email` | TEXT | NOT NULL UNIQUE |
| `company` | TEXT | NOT NULL |
| `plan_interest` | TEXT | NOT NULL |
| `message` | TEXT | NULL |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

---

## Testing

### Test Locally

```bash
pnpm dev

# In another terminal
curl -X POST http://localhost:3000/api/early-access \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "company": "Test Co",
    "planInterest": "developer",
    "message": "Testing"
  }'
```

### Test Production

Visit: https://www.schlep-engine.com/
- Click "Get Early Access"
- Fill form
- Submit
- Check database

---

## Next Steps

After deployment:
1. Test the form on production site
2. Verify signups in D1 database
3. Set up email notifications (optional)
4. Create analytics dashboard (optional)

Everything is ready! 🚀
