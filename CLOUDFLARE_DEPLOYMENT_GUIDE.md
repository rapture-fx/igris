# Cloudflare Pages Deployment Guide
## Unified Documentation Hub - Single Deployment

This guide covers deploying the unified documentation with all three paths served from a single Cloudflare Pages project.

---

## Architecture Overview

**Single Cloudflare Pages Project** serving:
- `https://docs.igrisinertial.com/` → Hub page
- `https://docs.igrisinertial.com/overture` → Overture documentation
- `https://docs.igrisinertial.com/runtime` → Runtime documentation

✅ Simple single deployment
✅ No Workers needed
✅ All docs in one project
✅ Automatic updates on git push

---

## Project Structure

The monorepo contains three Next.js apps that are combined into one deployment:

```
web/apps/
├── web-docs-hub/          # Hub page (serves at /)
├── web-docs/              # Overture docs (serves at /overture)
├── web-docs-runtime/      # Runtime docs (serves at /runtime)
└── build-combined-docs.sh # Build script that combines all three
```

**Build Process:**
1. Build hub → output to `web-docs-hub/out/`
2. Build Overture → output to `web-docs/out/` (with basePath: '/overture')
3. Build Runtime → output to `web-docs-runtime/out/` (with basePath: '/runtime')
4. Combine all outputs into `combined-docs-output/`

---

## Prerequisites

- GitHub repository with the monorepo structure
- Cloudflare account
- Domain `igrisinertial.com` added to Cloudflare
- Node.js 18+ installed locally (for testing)

---

## Deployment Steps

### Step 1: Create Cloudflare Pages Project

1. Go to **Cloudflare Dashboard** → **Pages**
2. Click **Create a project**
3. Click **Connect to Git**
4. Select your GitHub repository
5. Click **Begin setup**

### Step 2: Configure Build Settings

**Project name:** `igris-docs-unified`

**Build configuration:**
```
Framework preset: None (we're using custom script)
Build command: cd web/apps && chmod +x build-combined-docs.sh && ./build-combined-docs.sh
Build output directory: web/apps/combined-docs-output
Root directory: / (leave as root)
Node version: 18 or higher
```

**Environment variables:**
```
NODE_VERSION=18
```

**Important:** The build script handles installing dependencies and building all three apps.

### Step 3: Deploy

1. Click **Save and Deploy**
2. Wait for build to complete (5-10 minutes first time)
3. You'll get a URL like `igris-docs-unified.pages.dev`

### Step 4: Test Preview Deployment

Before adding custom domain, test the preview:

1. Visit `https://igris-docs-unified.pages.dev/`
   - Should show hub page with two product cards

2. Visit `https://igris-docs-unified.pages.dev/overture`
   - Should redirect to `/overture/docs` and show Overture documentation

3. Visit `https://igris-docs-unified.pages.dev/runtime`
   - Should redirect to `/runtime/docs` and show Runtime documentation

### Step 5: Add Custom Domain

1. Go to your project → **Custom domains**
2. Click **Set up a custom domain**
3. Enter: `docs.igrisinertial.com`
4. Click **Activate domain**
5. Cloudflare will automatically configure DNS (if domain is on Cloudflare)
6. Wait for SSL certificate to provision (1-5 minutes)

### Step 6: Verify Production

Test all three URLs:

✅ **Hub:** https://docs.igrisinertial.com/
✅ **Overture:** https://docs.igrisinertial.com/overture
✅ **Runtime:** https://docs.igrisinertial.com/runtime

---

## Local Testing

### Option 1: Test Combined Build

```bash
cd /Users/wira/Desktop/system/web/apps
./build-combined-docs.sh

# Serve the combined output
cd combined-docs-output
npx serve
# Visit http://localhost:3000
```

### Option 2: Test Individual Apps

**Hub (port 3001):**
```bash
cd web/apps/web-docs-hub
npm install
npm run dev
# Visit http://localhost:3001
```

**Overture (port 3002):**
```bash
cd web/apps/web-docs
npm install
npm run dev
# Visit http://localhost:3002/overture
```

**Runtime (port 3004):**
```bash
cd web/apps/web-docs-runtime
npm install
npm run dev
# Visit http://localhost:3004/runtime
```

---

## Build Script Details

The `build-combined-docs.sh` script:

1. **Cleans** previous builds (`combined-docs-output/`)
2. **Installs** dependencies for each app
3. **Builds** each app with Next.js static export
4. **Combines** all outputs into one directory:
   ```
   combined-docs-output/
   ├── index.html           # Hub page
   ├── _next/               # Hub assets
   ├── img/                 # Shared images
   ├── overture/            # Overture docs (complete)
   │   ├── index.html
   │   ├── docs/
   │   └── _next/
   └── runtime/             # Runtime docs (complete)
       ├── index.html
       ├── docs/
       └── _next/
   ```

---

## Automatic Deployments

Once configured, Cloudflare automatically deploys on every push to main:

1. **Push changes** to GitHub
2. **Cloudflare detects** the push
3. **Runs** `build-combined-docs.sh`
4. **Deploys** the combined output
5. **Live** in 5-10 minutes

### Manual Redeploy

To trigger without code changes:
```bash
git commit --allow-empty -m "Trigger Cloudflare rebuild"
git push
```

---

## Troubleshooting

### Build Fails

**Error: `npm: command not found`**
- **Fix:** Add `NODE_VERSION=18` to environment variables in Cloudflare

**Error: `Permission denied: build-combined-docs.sh`**
- **Fix:** Build command should include `chmod +x build-combined-docs.sh`

**Error: `No such file or directory`**
- **Fix:** Verify `Build output directory` is set to `web/apps/combined-docs-output`

### 404 Errors

**Hub page 404:**
- Check `combined-docs-output/index.html` exists after build
- Verify root files are copied correctly

**Overture/Runtime 404:**
- Check `combined-docs-output/overture/` directory exists
- Verify basePath is configured in `next.config.js`

### Build Takes Too Long

**First build:** 5-10 minutes (normal - installing all dependencies)
**Subsequent builds:** 3-5 minutes (cache helps)

**To speed up:**
- Cloudflare caches node_modules between builds
- Only changed apps rebuild in Next.js

### Assets Not Loading

**Images missing:**
- Check `combined-docs-output/img/` contains logo
- Verify `combined-docs-output/overture/img/` exists
- Ensure `combined-docs-output/runtime/img/` exists

**CSS not applying:**
- Check `_next/static/css/` directories exist in each section
- Verify basePath is set correctly

---

## Updating Documentation

### Update Hub Page

1. Edit `/web/apps/web-docs-hub/app/page.tsx`
2. Commit and push
3. Cloudflare rebuilds automatically

### Update Overture Docs

1. Edit files in `/web/apps/web-docs/docs/*.mdx`
2. Commit and push
3. Cloudflare rebuilds automatically

### Update Runtime Docs

1. Edit files in `/web/apps/web-docs-runtime/docs/*.mdx`
2. Commit and push
3. Cloudflare rebuilds automatically

---

## Configuration Files

### Hub: `web-docs-hub/next.config.js`
```js
const nextConfig = {
  output: 'export',         // Static export
  trailingSlash: true,      // URLs end with /
  // NO basePath - serves at root
};
```

### Overture: `web-docs/next.config.js`
```js
const nextConfig = {
  basePath: '/overture',    // Serve from /overture
  output: 'export',
  trailingSlash: true,
};
```

### Runtime: `web-docs-runtime/next.config.js`
```js
const nextConfig = {
  basePath: '/runtime',     // Serve from /runtime
  output: 'export',
  trailingSlash: true,
};
```

---

## Rollback

If a deployment breaks:

1. Go to Cloudflare Dashboard → **Pages** → Your project
2. Click **Deployments**
3. Find a working deployment
4. Click **⋯** → **Rollback to this deployment**
5. Confirm rollback

Changes are live immediately.

---

## Performance Optimization

### Build Time

Current: ~5-10 minutes
- Hub: ~30 seconds
- Overture: ~2 minutes
- Runtime: ~3 minutes
- Combine: ~1 minute

### Bundle Size

Each section is independently optimized:
- Hub: ~100 KB First Load JS
- Overture: ~120 KB First Load JS
- Runtime: ~120 KB First Load JS

### Caching

Cloudflare automatically caches:
- Static assets (images, CSS, JS)
- HTML pages
- Custom cache rules can be added

---

## Advanced: Custom Build Command

If you need more control, you can modify the build script:

**File:** `web/apps/build-combined-docs.sh`

```bash
#!/bin/bash
set -e

# Your custom build logic here
# For example, add linting, testing, etc.

# Build hub
cd web-docs-hub
npm ci  # Use ci for faster installs
npm run build
cd ..

# Build Overture
cd web-docs
npm ci
npm run build
cd ..

# Build Runtime
cd web-docs-runtime
npm ci
npm run build
cd ..

# Combine
rm -rf combined-docs-output
mkdir -p combined-docs-output
cp -r web-docs-hub/out/* combined-docs-output/
mkdir -p combined-docs-output/overture
cp -r web-docs/out/* combined-docs-output/overture/
mkdir -p combined-docs-output/runtime
cp -r web-docs-runtime/out/* combined-docs-output/runtime/
```

---

## CI/CD Integration (Optional)

### GitHub Actions

Add preview deployments for pull requests:

**File:** `.github/workflows/deploy-docs.yml`

```yaml
name: Deploy Docs

on:
  push:
    branches: [main]
    paths:
      - 'web/apps/web-docs-hub/**'
      - 'web/apps/web-docs/**'
      - 'web/apps/web-docs-runtime/**'
  pull_request:
    paths:
      - 'web/apps/web-docs-hub/**'
      - 'web/apps/web-docs/**'
      - 'web/apps/web-docs-runtime/**'

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Build Combined Docs
        run: |
          cd web/apps
          chmod +x build-combined-docs.sh
          ./build-combined-docs.sh

      - name: Test Output
        run: |
          test -f web/apps/combined-docs-output/index.html
          test -d web/apps/combined-docs-output/overture
          test -d web/apps/combined-docs-output/runtime
```

This validates builds on every PR.

---

## Summary

### Deployment Configuration

**Cloudflare Pages Project:**
- Name: `igris-docs-unified`
- Build command: `cd web/apps && chmod +x build-combined-docs.sh && ./build-combined-docs.sh`
- Output directory: `web/apps/combined-docs-output`
- Custom domain: `docs.igrisinertial.com`

### Live URLs

- ✅ Hub: `https://docs.igrisinertial.com/`
- ✅ Overture: `https://docs.igrisinertial.com/overture`
- ✅ Runtime: `https://docs.igrisinertial.com/runtime`

### Maintenance

- ✅ Single Cloudflare project
- ✅ Auto-deploy on git push
- ✅ No manual file copying
- ✅ No Workers needed
- ✅ Easy rollback

---

## Support

- **Cloudflare Docs:** https://developers.cloudflare.com/pages
- **Next.js basePath:** https://nextjs.org/docs/app/api-reference/next-config-js/basePath
- **Build issues:** Check Cloudflare deployment logs in dashboard

