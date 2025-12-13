# Documentation Automation

Automatic documentation sync keeps docs in perfect sync with the codebase using GitHub Actions.

## How It Works

```
Code Change → Push to main → GitHub Action → Extract Data → Update Docs → Commit
```

**Automatic extraction from:**
- `internal/observability/metrics.go` → Prometheus metrics
- `config/tier_config.yaml` → Pricing and tier limits
- `docs_int/ARCHITECTURE_*.md` → Architecture documentation
- `README.md` → Project overview

**Updated automatically:**
- `web/apps/web-docs/docs/observability.mdx` - Metrics count
- `web/apps/web-docs/docs/pricing-tiers.mdx` - Pricing validation
- All other docs stay accurate with codebase changes

## Setup

### 1. GitHub Actions Workflow

Location: `.github/workflows/docs-sync.yml`

**Triggers on:**
- Push to `main` with changes to Go files, config files, or docs
- Manual trigger via GitHub Actions UI

**Permissions required:**
```yaml
permissions:
  contents: write  # To commit doc updates
```

### 2. Extraction Scripts

Location: `scripts/docs/`

**Scripts:**
- `extract-metrics.js` - Extracts Prometheus metrics from Go code
- `extract-config.js` - Extracts tier config from YAML
- `update-docs.js` - Updates MDX files with extracted data

**Install dependencies:**
```bash
cd scripts/docs
npm install
```

### 3. Generated Files

Location: `web/apps/web-docs/docs/.generated/`

**Files:**
- `metrics.json` - Extracted Prometheus metrics
- `config.json` - Extracted tier configuration

These files are auto-generated and tracked in git for the workflow.

## Usage

### Automatic (Production)

Push to `main` and the workflow runs automatically:

```bash
git add .
git commit -m "feat: add new metric for request latency"
git push origin main

# GitHub Action runs automatically
# Docs are updated and committed by bot
```

### Manual Trigger

Run workflow manually from GitHub:

```bash
gh workflow run docs-sync.yml
```

Or via GitHub UI:
```
Actions → Documentation Sync → Run workflow
```

### Local Testing

Test extraction locally before pushing:

```bash
cd scripts/docs

# Run full sync
npm run sync

# Check what changed
git diff ../../web/apps/web-docs/docs/

# Revert if needed
git checkout ../../web/apps/web-docs/docs/
```

## What Gets Extracted

### 1. Prometheus Metrics

**Source:** `internal/observability/metrics.go`

**Extracts:**
- Metric name (e.g., `http_requests_total`)
- Metric type (Counter, Histogram, Gauge)
- Help text
- Label definitions
- Bucket configurations

**Example:**
```go
httpRequestsTotal = promauto.NewCounterVec(
    prometheus.CounterOpts{
        Name: "http_requests_total",
        Help: "Total number of HTTP requests",
    },
    []string{"method", "path", "status"},
)
```

**Becomes:**
```json
{
  "type": "Counter",
  "name": "http_requests_total",
  "help": "Total number of HTTP requests",
  "labels": ["method", "path", "status"]
}
```

### 2. Tier Configuration

**Source:** `config/tier_config.yaml`

**Extracts:**
- Tier names and display names
- Pricing (USD, billing period, overage rates)
- Request limits per tier
- Feature flags per tier
- SLA targets

**Example:**
```yaml
tiers:
  developer:
    display_name: "Develop"
    price:
      usd: 149
      billing_period: "month"
    limits:
      max_requests_per_month: 500000
```

**Becomes:**
```json
{
  "name": "developer",
  "display_name": "Develop",
  "price": { "usd": 149, "billing_period": "month" },
  "limits": { "requests_per_month": 500000 }
}
```

## Workflow Output

### Success

```
✅ Documentation updated and committed

Changed files:
- web/apps/web-docs/docs/observability.mdx
- web/apps/web-docs/docs/pricing-tiers.mdx
```

### No Changes

```
✅ Documentation is up to date
```

### Failure

Check GitHub Actions logs for errors:
- Extraction errors (invalid Go syntax, YAML parse errors)
- File not found (paths changed)
- Git commit errors (permissions)

## Adding New Extractions

### Step 1: Create Extractor

Create `scripts/docs/extract-something.js`:

```javascript
#!/usr/bin/env node
const fs = require('fs');

function extractData() {
  // Parse source files
  // Extract relevant information
  return { data: [...] };
}

const result = extractData();
console.log(JSON.stringify(result, null, 2));
```

### Step 2: Add to Workflow

Edit `.github/workflows/docs-sync.yml`:

```yaml
- name: Extract something
  run: |
    node ./scripts/docs/extract-something.js > ./web/apps/web-docs/docs/.generated/something.json
```

### Step 3: Update Docs

Edit `scripts/docs/update-docs.js`:

```javascript
function updateSomething() {
  const data = JSON.parse(fs.readFileSync('something.json'));
  // Update relevant MDX file
}

// Call in main()
updateSomething();
```

### Step 4: Test

```bash
cd scripts/docs
node extract-something.js | jq .
npm run sync
git diff ../../web/apps/web-docs/docs/
```

## Monitoring

### Check Workflow Runs

```bash
# List recent runs
gh run list --workflow=docs-sync.yml

# View specific run
gh run view <run-id>

# View logs
gh run view <run-id> --log
```

### Verify Commits

Bot commits have this format:

```
docs: auto-sync documentation from codebase

Extracted from:
- internal/observability/metrics.go
- config/tier_config.yaml
- docs_int/ARCHITECTURE_*.md

Generated by: .github/workflows/docs-sync.yml
```

Search git log:
```bash
git log --grep="auto-sync documentation" --oneline
```

## Troubleshooting

### Workflow doesn't trigger

**Problem:** Pushed to main but workflow didn't run

**Check:**
1. Verify file paths in `paths:` trigger match changed files
2. Check if workflow is enabled (Settings → Actions)
3. Verify branch protection rules don't block bot commits

**Fix:**
```yaml
# In .github/workflows/docs-sync.yml
on:
  push:
    branches: [main]
    paths:
      - 'internal/**/*.go'  # Must match your file structure
```

### Extraction fails

**Problem:** Script errors during extraction

**Check:**
1. Node.js version (requires 18+)
2. Dependencies installed (`npm install`)
3. Source file exists and is valid

**Debug:**
```bash
cd scripts/docs
node extract-metrics.js  # Run directly to see errors
```

### Docs not updating

**Problem:** Workflow runs but docs don't change

**Check:**
1. Extracted data actually changed
2. Update logic in `update-docs.js` works
3. File paths are correct

**Debug:**
```bash
# Check generated files
cat web/apps/web-docs/docs/.generated/metrics.json | jq '.total'

# Run update manually
node scripts/docs/update-docs.js

# Check git diff
git diff web/apps/web-docs/docs/
```

### Bot can't commit

**Problem:** Workflow fails at commit step

**Check:**
1. Workflow has `contents: write` permission
2. Branch protection rules allow bot user
3. Git config is set correctly

**Fix:** Add bot to allowed users in branch protection:
```
Settings → Branches → main → Edit →
  Allow specified actors to bypass → Add "docs-sync-bot"
```

## Best Practices

### 1. Test Locally First

Always test extraction locally before pushing:
```bash
npm run sync
git diff
```

### 2. Keep Extractors Simple

Don't over-engineer extraction logic. Simple regex works fine:
```javascript
const regex = /Name:\s*"([^"]+)"/;
const match = content.match(regex);
```

### 3. Fail Fast

Exit with error if extraction fails:
```javascript
if (!fs.existsSync(sourceFile)) {
  console.error('Source file not found');
  process.exit(1);
}
```

### 4. Document Patterns

Comment regex patterns so others can maintain:
```javascript
// Matches: Name: "metric_name"
const nameRegex = /Name:\s*"([^"]+)"/;
```

### 5. Version Control Generated Files

Keep `.generated/*.json` in git so workflow can commit changes:
```gitignore
# In .gitignore - DON'T ignore these
# !web/apps/web-docs/docs/.generated/*.json
```

## Maintenance

### Monthly

- Review extraction accuracy
- Check for new metrics/config to extract
- Update regex patterns if code format changes

### After Major Refactors

- Test extraction scripts locally
- Update file paths in workflow
- Verify docs render correctly

### When Adding Features

- Add extraction for new config
- Update relevant MDX files
- Test full cycle: code change → push → docs update

---

## Quick Reference

**Run locally:**
```bash
cd scripts/docs && npm run sync
```

**Manual trigger:**
```bash
gh workflow run docs-sync.yml
```

**Check workflow status:**
```bash
gh run list --workflow=docs-sync.yml
```

**View bot commits:**
```bash
git log --author="docs-sync-bot" --oneline
```

**Revert bad update:**
```bash
git revert <commit-hash>
```

---

**Created:** 2025-12-03
**Maintained by:** Igris Overture team
**CI/CD:** GitHub Actions
