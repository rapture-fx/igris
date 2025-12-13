# Documentation Automation Scripts

Automated scripts for extracting documentation from the codebase and keeping docs in sync.

## Overview

These scripts are run automatically by `.github/workflows/docs-sync.yml` on every push to `main`. They extract real data from the codebase (metrics, configuration, architecture) and update documentation files.

## Scripts

### `extract-metrics.js`

Extracts Prometheus metrics from `internal/observability/metrics.go`.

**Output:** `web/apps/web-docs/docs/.generated/metrics.json`

**Extracted data:**
- Metric name and type (Counter, Histogram, Gauge)
- Help text
- Label definitions
- Bucket configurations (for Histograms)

**Usage:**
```bash
node extract-metrics.js > ../../web/apps/web-docs/docs/.generated/metrics.json
```

**Example output:**
```json
{
  "total": 150,
  "extracted_at": "2025-12-03T10:15:30.000Z",
  "source_file": "internal/observability/metrics.go",
  "metrics": [
    {
      "type": "Counter",
      "variable": "httpRequestsTotal",
      "name": "http_requests_total",
      "help": "Total number of HTTP requests",
      "labels": ["method", "path", "status"]
    }
  ]
}
```

### `extract-config.js`

Extracts tier configuration from `config/tier_config.yaml`.

**Output:** `web/apps/web-docs/docs/.generated/config.json`

**Extracted data:**
- Tier names, prices, and limits
- Feature flags per tier
- SLA targets
- Global configuration

**Usage:**
```bash
node extract-config.js > ../../web/apps/web-docs/docs/.generated/config.json
```

**Example output:**
```json
{
  "version": "2.0",
  "last_updated": "2025-11-30T00:00:00Z",
  "tiers": [
    {
      "name": "developer",
      "display_name": "Develop",
      "price": { "usd": 149, "billing_period": "month" },
      "limits": {
        "requests_per_month": 500000,
        "max_providers": 5
      },
      "features": {
        "thompson_sampling": true,
        "speculative_execution": false
      }
    }
  ]
}
```

### `update-docs.js`

Updates MDX documentation files with extracted data.

**Updated files:**
- `observability.mdx` - Metrics count and tables
- `pricing-tiers.mdx` - Pricing validation

**Usage:**
```bash
node update-docs.js
```

**What it does:**
1. Reads generated JSON files from `.generated/`
2. Updates metrics counts (e.g., "150+ Prometheus metrics")
3. Validates pricing table matches config
4. Reports changed files

## Manual Usage

Run locally to test extraction:

```bash
cd scripts/docs

# Install dependencies
npm install

# Extract all data and update docs
npm run sync

# Or run individually
npm run extract:metrics
npm run extract:config
npm run update
```

## GitHub Action Workflow

The workflow (`.github/workflows/docs-sync.yml`) runs automatically on:

**Triggers:**
- Push to `main` branch
- Changes to:
  - `internal/**/*.go`
  - `config/**/*.yaml`
  - `docs_int/**/*.md`
  - `README.md`

**Steps:**
1. Checkout repository
2. Install Node.js dependencies
3. Run extraction scripts
4. Update documentation files
5. Commit changes (if any)

**Bot user:**
- Name: `docs-sync-bot`
- Email: `bot@igris-inertial.com`

## Adding New Extractions

To extract new data types:

1. **Create extractor script:**
   ```javascript
   // scripts/docs/extract-something.js
   const data = extractFromCodebase();
   console.log(JSON.stringify(data, null, 2));
   ```

2. **Add to workflow:**
   ```yaml
   - name: Extract something
     run: |
       node ./scripts/docs/extract-something.js > ./web/apps/web-docs/docs/.generated/something.json
   ```

3. **Update docs script:**
   ```javascript
   // In update-docs.js
   function updateSomething() {
     const data = JSON.parse(fs.readFileSync('something.json'));
     // Update relevant MDX files
   }
   ```

## Troubleshooting

### Workflow fails on push

Check workflow logs in GitHub Actions tab. Common issues:
- Missing Node.js dependencies (add to `package.json`)
- Invalid YAML in config files
- Regex pattern mismatch in extraction

### Metrics count is wrong

The extractor uses regex to parse Go code. If metric definitions change format:
1. Update regex patterns in `extract-metrics.js`
2. Test locally: `node extract-metrics.js`
3. Verify output matches expected format

### Docs not updating

Ensure file paths in workflow match actual locations:
- Check `paths:` trigger in workflow
- Verify output paths for generated JSON
- Check file permissions (scripts must be executable)

## Development

### Testing locally

```bash
# Dry run (don't commit)
npm run sync

# Check what changed
git diff web/apps/web-docs/docs/

# Revert if needed
git checkout web/apps/web-docs/docs/
```

### Debugging extraction

```bash
# View raw output
node extract-metrics.js | jq .

# Count extracted items
node extract-metrics.js | jq '.total'

# Validate JSON
node extract-metrics.js | jq . > /dev/null && echo "Valid JSON"
```

## CI/CD Integration

The workflow integrates with the documentation deployment pipeline:

```
Code Push → docs-sync.yml → Update MDX → Deploy to Vercel
```

Changes are automatically deployed to docs site after commit.

## Maintenance

**Monthly:**
- Review extraction accuracy
- Update regex patterns if code patterns change
- Add new extractors for new doc sections

**On major refactors:**
- Update file paths in workflow
- Test extraction scripts locally first
- Verify docs render correctly after update

---

**Last updated:** 2025-12-03
**Maintained by:** Igris Overture team
