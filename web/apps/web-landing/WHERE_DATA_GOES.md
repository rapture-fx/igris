# Where Early Access Form Submissions Go

## Current Status (After Fix)

✅ **The API endpoint is now working!** Test confirmed: `/api/early-access` returns 200 OK.

## Where Your Submission Data Goes

### Option 1: Console Logs ONLY (Current Default)

**Without Cloudflare KV configured**, all submissions are:
- ✅ **Logged to console** (viewable in Cloudflare Dashboard)
- ❌ **NOT persisted** to any database
- ⚠️ **Lost after 24-48 hours** (log retention limit)

**How to view submissions:**
1. Go to Cloudflare Dashboard
2. Navigate to: **Pages** → **schlep-engine-landing** → **Real-time Logs**
3. Look for log entries like:
   ```
   Early access submission: {
     id: '1763117092824',
     email: 'user@example.com',
     company: 'Company Name',
     plan: 'developer',
     name: 'User Name',
     message: 'Optional message'
   }
   ```

**Pros:**
- ✅ Works immediately, no setup required
- ✅ Simple to implement

**Cons:**
- ❌ Data not persisted
- ❌ Hard to export or analyze
- ❌ Logs expire after 24-48 hours
- ❌ Need to manually check logs

---

### Option 2: Cloudflare KV Storage (Recommended)

**With Cloudflare KV configured**, submissions are:
- ✅ **Logged to console** (for debugging)
- ✅ **Stored in Cloudflare KV** (key-value database)
- ✅ **Persisted permanently** (until manually deleted)
- ✅ **Easy to retrieve** via API or Wrangler CLI

#### Data Storage Structure

Each submission is stored as:

**Individual Submission:**
- **Key:** `submission:{timestamp}` (e.g., `submission:1763117092824`)
- **Value:**
  ```json
  {
    "name": "User Name",
    "email": "user@example.com",
    "company": "Company Name",
    "planInterest": "developer",
    "message": "Optional message",
    "timestamp": "2024-11-14T10:44:52.824Z",
    "id": "1763117092824"
  }
  ```

**Index of All Submissions:**
- **Key:** `submissions:index`
- **Value:** Array of all submission IDs
  ```json
  ["1763117092824", "1763117093456", "1763117094789"]
  ```

#### How to Set Up Cloudflare KV

**Step 1: Create KV Namespace**
```bash
cd web/apps/web-landing
pnpm wrangler kv:namespace create "EARLY_ACCESS_KV"
```

This will output something like:
```
🌀 Creating namespace with title "schlep-engine-landing-EARLY_ACCESS_KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "EARLY_ACCESS_KV", id = "abc123xyz456" }
```

**Step 2: Configure in Cloudflare Dashboard**
1. Go to: **Cloudflare Dashboard** → **Pages** → **schlep-engine-landing**
2. Click: **Settings** → **Functions**
3. Scroll to: **KV namespace bindings**
4. Click: **Add binding**
5. Set:
   - **Variable name:** `EARLY_ACCESS_KV`
   - **KV namespace:** Select the namespace you created

**Step 3: Redeploy**
```bash
git add .
git commit -m "Add Cloudflare KV support for early access submissions"
git push
```

Or manually:
```bash
cd web/apps/web-landing
pnpm pages:build
pnpm wrangler pages deploy .vercel/output/static
```

#### How to Retrieve Stored Submissions

**Option A: Using Wrangler CLI**
```bash
# List all keys
pnpm wrangler kv:key list --binding=EARLY_ACCESS_KV

# Get the index (list of all submission IDs)
pnpm wrangler kv:key get "submissions:index" --binding=EARLY_ACCESS_KV

# Get a specific submission
pnpm wrangler kv:key get "submission:1763117092824" --binding=EARLY_ACCESS_KV

# Export all submissions to a file
pnpm wrangler kv:bulk get --binding=EARLY_ACCESS_KV > submissions.json
```

**Option B: Via Cloudflare Dashboard**
1. Go to: **Workers & Pages** → **KV**
2. Click your namespace: **schlep-engine-landing-EARLY_ACCESS_KV**
3. Browse or search for keys
4. View individual submission data

**Option C: Create an Admin API Endpoint** (Optional)

You could create a new API route at `app/api/admin/submissions/route.ts`:
```typescript
import { getRequestContext } from '@cloudflare/next-on-pages';
export const runtime = 'edge';

export async function GET(request: Request) {
  const { env } = getRequestContext();

  // Get all submission IDs
  const indexStr = await env.EARLY_ACCESS_KV.get('submissions:index');
  const ids = indexStr ? JSON.parse(indexStr) : [];

  // Get all submissions
  const submissions = await Promise.all(
    ids.map(async (id) => {
      const data = await env.EARLY_ACCESS_KV.get(`submission:${id}`);
      return data ? JSON.parse(data) : null;
    })
  );

  return Response.json({ submissions: submissions.filter(Boolean) });
}
```

Then access at: `https://www.schlep-engine.com/api/admin/submissions`

⚠️ **Security Warning:** Add authentication to protect this endpoint!

---

## Summary

| Feature | Without KV | With KV |
|---------|-----------|---------|
| Works immediately | ✅ Yes | ❌ Requires setup |
| Data persisted | ❌ No | ✅ Yes |
| Easy to retrieve | ❌ No | ✅ Yes |
| Log retention | 24-48 hours | Permanent |
| Export to CSV/JSON | ❌ Hard | ✅ Easy |
| Cost | Free | Free (10GB limit) |

## Recommendation

For a production website collecting user information:
- **Set up Cloudflare KV** (takes 5 minutes)
- Your data will be permanently stored
- You can easily export and analyze submissions
- Cloudflare KV is free for the first 10GB of data

---

## Current Implementation Status

✅ API endpoint created: `/api/early-access`
✅ Form submission works
✅ Data logged to console
⏳ KV storage ready (just needs configuration in Cloudflare Dashboard)

**Next Action:** Configure KV binding in Cloudflare Dashboard (see Step 2 above)
