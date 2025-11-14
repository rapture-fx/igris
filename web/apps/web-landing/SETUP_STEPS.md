# Final Setup Steps for D1 Database

## ✅ Completed So Far

1. ✅ Created D1 database: `early_access` (8e942f0e-d4c0-45a7-b10a-605a83b5f4b6)
2. ✅ Updated `wrangler.toml` with database ID
3. ✅ Applied migration locally (table `signups` created)
4. ✅ API route ready at `app/api/early-access/route.ts`
5. ✅ Form already configured

---

## 🚀 Next Steps to Complete

### Step 1: Authenticate Wrangler (One Time)

```bash
cd web/apps/web-landing
pnpm wrangler login
```

This will open a browser for you to authenticate with Cloudflare.

---

### Step 2: Apply Migration to Remote Database

After authentication, run:

```bash
pnpm wrangler d1 migrations apply early_access --remote
```

This creates the `signups` table in your production D1 database.

---

### Step 3: Configure Cloudflare Pages Binding

**Option A: Via Cloudflare Dashboard (Recommended)**

1. Go to: https://dash.cloudflare.com/
2. Navigate to: **Pages** → **schlep-engine-landing** (or your project name)
3. Click: **Settings** → **Functions**
4. Scroll down to: **D1 database bindings**
5. Click: **Add binding**
6. Fill in:
   - **Variable name:** `DB`
   - **D1 database:** Select `early_access`
7. Click **Save**

**Option B: Via Wrangler CLI**

The binding should already work since you created the database. The dashboard method above ensures it's properly configured for your Pages project.

---

### Step 4: Build and Deploy

```bash
# Build the project
pnpm pages:build

# Deploy to Cloudflare Pages
pnpm wrangler pages deploy .vercel/output/static
```

Or if you have Git integration:

```bash
git add .
git commit -m "feat: add D1 database for early access signups"
git push
```

Cloudflare will automatically build and deploy.

---

## 🧪 Testing

### Test Locally (with local D1)

```bash
# Start dev server
pnpm dev

# In another terminal, test the API
curl -X POST http://localhost:3000/api/early-access \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "company": "Test Company",
    "planInterest": "developer",
    "message": "Testing local D1"
  }'

# Check if it was stored
pnpm wrangler d1 execute early_access --local --command "SELECT * FROM signups"
```

### Test Production (after deployment)

1. Visit: https://www.schlep-engine.com/
2. Click **"Get Early Access"** button
3. Fill out the form
4. Submit

Verify the signup was stored:

```bash
pnpm wrangler d1 execute early_access --remote --command "SELECT * FROM signups ORDER BY created_at DESC LIMIT 5"
```

---

## 📊 Viewing Signups

### View All Signups

```bash
# Remote (production) database
pnpm wrangler d1 execute early_access --remote --command "SELECT * FROM signups ORDER BY created_at DESC"

# Count total signups
pnpm wrangler d1 execute early_access --remote --command "SELECT COUNT(*) as total FROM signups"

# Export to JSON
pnpm wrangler d1 execute early_access --remote --command "SELECT * FROM signups" --json > signups-$(date +%Y%m%d).json
```

### Query by Plan Interest

```bash
pnpm wrangler d1 execute early_access --remote --command "
  SELECT plan_interest, COUNT(*) as count
  FROM signups
  GROUP BY plan_interest
  ORDER BY count DESC
"
```

### Recent Signups (Last 7 Days)

```bash
pnpm wrangler d1 execute early_access --remote --command "
  SELECT * FROM signups
  WHERE created_at >= datetime('now', '-7 days')
  ORDER BY created_at DESC
"
```

---

## ⚡ Quick Reference

### Database Info

- **Database Name:** `early_access`
- **Database ID:** `8e942f0e-d4c0-45a7-b10a-605a83b5f4b6`
- **Binding Name:** `DB`
- **Table:** `signups`

### Common Commands

```bash
# Login to Cloudflare
pnpm wrangler login

# Apply migration remotely
pnpm wrangler d1 migrations apply early_access --remote

# Build project
pnpm pages:build

# Deploy
pnpm wrangler pages deploy .vercel/output/static

# View signups
pnpm wrangler d1 execute early_access --remote --command "SELECT * FROM signups"
```

---

## 🔍 Troubleshooting

### Issue: "binding DB is not defined"

**Solution:** D1 binding not configured in Cloudflare Pages
- Follow Step 3 above to add the binding in dashboard

### Issue: "no such table: signups"

**Solution:** Migration not applied to remote database
```bash
pnpm wrangler d1 migrations apply early_access --remote
```

### Issue: "UNIQUE constraint failed: signups.email"

**Expected behavior:** User trying to sign up with same email twice
- API returns 409 status with message: "This email has already been registered for early access"

### Issue: Can't authenticate wrangler

**Solution:**
```bash
# Login
pnpm wrangler login

# Or set API token
export CLOUDFLARE_API_TOKEN="your-api-token"
```

Get API token: https://dash.cloudflare.com/profile/api-tokens

---

## 📝 Summary

You're almost done! Just need to:

1. **Login:** `pnpm wrangler login`
2. **Apply migration remotely:** `pnpm wrangler d1 migrations apply early_access --remote`
3. **Configure Pages binding** (in dashboard)
4. **Deploy:** `pnpm pages:build && pnpm wrangler pages deploy .vercel/output/static`

That's it! Your Early Access form will store all signups in D1. 🎉
