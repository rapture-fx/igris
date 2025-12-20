# Quick Guide: Deploy Combined Docs to Cloudflare Pages

## Option 1: Update via Cloudflare Dashboard (Recommended)

1. **Go to Cloudflare Dashboard**
   - Visit: https://dash.cloudflare.com
   - Navigate to: **Pages** → Your docs project

2. **Update Build Settings**
   - Go to: **Settings** → **Builds & deployments**
   - Update:
     - **Framework preset**: `None` or `Other`
     - **Build command**: `cd web/apps && chmod +x build-combined-docs.sh && ./build-combined-docs.sh`
     - **Build output directory**: `web/apps/combined-docs-output`
     - **Root directory**: `/` (or leave blank)

3. **Environment Variables**
   - Add: `NODE_VERSION=18` (or `20`)

4. **Save and Redeploy**
   - Click **Save**
   - Go to **Deployments** tab
   - Click **Retry deployment** on latest deployment

## Option 2: Deploy via Wrangler CLI

```bash
# 1. Install Wrangler (if not already installed)
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Build the combined docs
cd /Users/wira/Desktop/system/web/apps
chmod +x build-combined-docs.sh
./build-combined-docs.sh

# 4. Deploy to Cloudflare Pages
cd combined-docs-output
wrangler pages deploy . --project-name=igris-docs-unified
```

## Option 3: Trigger via Git Push

1. **Make sure build settings are updated** (see Option 1)
2. **Push any commit** to your main branch:
   ```bash
   git add .
   git commit -m "Update docs deployment"
   git push
   ```
3. Cloudflare will automatically build and deploy

## Verify Deployment

After deployment, check:
- ✅ `https://docs.igrisinertial.com/` → Hub page (two product cards)
- ✅ `https://docs.igrisinertial.com/overture` → Overture docs
- ✅ `https://docs.igrisinertial.com/runtime` → Runtime docs

## Troubleshooting

**Build fails?**
- Check build logs in Cloudflare Dashboard
- Verify Node version matches (18 or 20)
- Ensure build script is executable: `chmod +x build-combined-docs.sh`

**Hub not showing?**
- Verify build output directory is correct: `web/apps/combined-docs-output`
- Check that `index.html` exists in the output directory
- Verify root directory is set to `/` or blank

**Still seeing Overture docs at root?**
- Clear Cloudflare cache: **Caching** → **Configuration** → **Purge Everything**
- Wait 1-2 minutes for cache to clear
- Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
