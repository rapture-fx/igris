# D1 Database Deployment Guide - Early Access Signups

## Complete Setup - Step by Step

### Step 1: Create D1 Database

```bash
cd web/apps/web-landing

# Create the D1 database
pnpm wrangler d1 create schlep-signups
```

This will output something like:
```
✅ Successfully created DB 'schlep-signups'!

[[d1_databases]]
binding = "DB"
database_name = "schlep-signups"
database_id = "abc123-def456-ghi789"
```

**IMPORTANT:** Copy the `database_id` value!

---

### Step 2: Update wrangler.toml

Edit `wrangler.toml` and replace `preview_id` with your actual database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "schlep-signups"
database_id = "abc123-def456-ghi789"  # <-- Replace this with your actual ID
```

---

### Step 3: Run Database Migration

```bash
# Apply the migration to create the signups table
pnpm wrangler d1 migrations apply schlep-signups
```

This will create the `signups` table with the schema:
- `id` - Auto-increment primary key
- `name` - User's full name
- `email` - Email (unique constraint)
- `company` - Company name
- `plan_interest` - Selected plan
- `message` - Optional message
- `created_at` - Timestamp

---

### Step 4: Configure Cloudflare Pages

#### Option A: Via Cloudflare Dashboard (Recommended)

1. Go to: **Cloudflare Dashboard** → **Pages** → **schlep-engine-landing**
2. Click: **Settings** → **Functions**
3. Scroll to: **D1 database bindings**
4. Click: **Add binding**
5. Set:
   - **Variable name:** `DB`
   - **D1 database:** Select `schlep-signups`
6. Click **Save**

#### Option B: For Manual Deployment

Update the production section in `wrangler.toml`:

```toml
[env.production]
[[env.production.d1_databases]]
binding = "DB"
database_name = "schlep-signups"
database_id = "abc123-def456-ghi789"  # Your actual production DB ID
```

---

### Step 5: Deploy

```bash
# Build the project
pnpm pages:build

# Deploy to Cloudflare Pages
pnpm wrangler pages deploy .vercel/output/static
```

Or if using Git integration:
```bash
git add .
git commit -m "feat: add D1 database for early access signups"
git push
```

Cloudflare will automatically deploy.

---

## How to Query Signups

### View All Signups

```bash
# Get all signups
pnpm wrangler d1 execute schlep-signups --command "SELECT * FROM signups ORDER BY created_at DESC"

# Count total signups
pnpm wrangler d1 execute schlep-signups --command "SELECT COUNT(*) as total FROM signups"

# Get signups by plan
pnpm wrangler d1 execute schlep-signups --command "SELECT plan_interest, COUNT(*) as count FROM signups GROUP BY plan_interest"
```

### Export to CSV

```bash
# Export all signups to JSON
pnpm wrangler d1 execute schlep-signups --command "SELECT * FROM signups ORDER BY created_at DESC" --json > signups.json

# Or use a script to convert to CSV
pnpm wrangler d1 execute schlep-signups --command "SELECT email, name, company, plan_interest, created_at FROM signups ORDER BY created_at DESC" --json | jq -r '.[] | [.email, .name, .company, .plan_interest, .created_at] | @csv'
```

### Query Specific Data

```bash
# Find a specific email
pnpm wrangler d1 execute schlep-signups --command "SELECT * FROM signups WHERE email = 'user@example.com'"

# Get signups from the last 7 days
pnpm wrangler d1 execute schlep-signups --command "SELECT * FROM signups WHERE created_at >= datetime('now', '-7 days')"

# Get signups interested in Enterprise plan
pnpm wrangler d1 execute schlep-signups --command "SELECT * FROM signups WHERE plan_interest = 'enterprise'"
```

---

## Testing the Form

### Local Testing

```bash
# Start dev server
pnpm dev

# In another terminal, test the API
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

Expected response:
```json
{
  "message": "Submission successful (logged only - D1 not configured)",
  "id": 1731234567890
}
```

### Production Testing

After deployment, visit: https://www.schlep-engine.com/

1. Click "Get Early Access" button
2. Fill out the form:
   - Name: Your Name
   - Email: your@email.com
   - Company: Your Company
   - Plan: Select any plan
   - Message: (optional)
3. Click "Submit Request"
4. You should see: "Thanks for joining early access!"

Verify in database:
```bash
pnpm wrangler d1 execute schlep-signups --command "SELECT * FROM signups WHERE email = 'your@email.com'"
```

---

## Database Schema

```sql
CREATE TABLE signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    company TEXT NOT NULL,
    plan_interest TEXT NOT NULL,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_signups_email` - For faster email lookups
- `idx_signups_created_at` - For date-based queries

---

## Error Handling

The API handles:

1. **Missing fields** (400 Bad Request)
   ```json
   { "error": "Missing required fields" }
   ```

2. **Invalid email** (400 Bad Request)
   ```json
   { "error": "Invalid email address" }
   ```

3. **Duplicate email** (409 Conflict)
   ```json
   { "error": "This email has already been registered for early access" }
   ```

4. **Database errors** (500 Internal Server Error)
   ```json
   { "error": "Internal server error" }
   ```

---

## Monitoring

### View Real-time Logs

1. Go to: **Cloudflare Dashboard** → **Pages** → **schlep-engine-landing**
2. Click: **Real-time Logs**
3. Look for entries like:
   ```
   Submission stored in D1: { email: 'user@example.com', company: 'Company', ... }
   ```

### Database Metrics

```bash
# Check database size
pnpm wrangler d1 info schlep-signups

# View recent activity
pnpm wrangler d1 execute schlep-signups --command "SELECT DATE(created_at) as date, COUNT(*) as signups FROM signups GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 30"
```

---

## Backup and Maintenance

### Backup Database

```bash
# Export entire database to JSON
pnpm wrangler d1 execute schlep-signups --command "SELECT * FROM signups" --json > backup-$(date +%Y%m%d).json
```

### Delete Old Test Data

```bash
# Delete test signups (be careful!)
pnpm wrangler d1 execute schlep-signups --command "DELETE FROM signups WHERE email LIKE '%@test.com'"

# Or delete specific signup
pnpm wrangler d1 execute schlep-signups --command "DELETE FROM signups WHERE id = 1"
```

### Add New Migrations

To modify the schema later:

1. Create new migration file: `migrations/0002_add_phone_field.sql`
2. Add your SQL changes
3. Run: `pnpm wrangler d1 migrations apply schlep-signups`

---

## Troubleshooting

### Issue: "binding DB is not defined"

**Solution:** D1 binding not configured in Cloudflare Pages
- Go to Pages Settings → Functions → D1 database bindings
- Add binding with variable name `DB` and select your database

### Issue: "no such table: signups"

**Solution:** Migration not applied
```bash
pnpm wrangler d1 migrations apply schlep-signups
```

### Issue: "database locked"

**Solution:** Another migration in progress, wait and retry

### Issue: "UNIQUE constraint failed: signups.email"

**Expected behavior:** User already signed up with that email
- Returns 409 status with helpful message
- Check database: `pnpm wrangler d1 execute schlep-signups --command "SELECT * FROM signups WHERE email = 'user@email.com'"`

---

## Cost and Limits

Cloudflare D1 Free Tier:
- ✅ **5 GB storage** - More than enough for millions of signups
- ✅ **5 million reads/day**
- ✅ **100,000 writes/day**
- ✅ **Unlimited databases**

For early access signups, this is completely free!

---

## Next Steps

After collecting signups, you can:

1. **Export to your CRM** - Use the CSV export commands above
2. **Send welcome emails** - Query recent signups and send emails
3. **Analytics** - Query plan interest, signup trends, etc.
4. **Create admin dashboard** - Build a simple dashboard to view signups

---

## Files Created/Modified

- ✅ `migrations/0001_create_signups.sql` - Database schema
- ✅ `app/api/early-access/route.ts` - API endpoint (updated for D1)
- ✅ `wrangler.toml` - D1 binding configuration
- ✅ Form components - Already correctly configured

Everything is ready to deploy! 🚀
