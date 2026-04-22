const fs = require('fs');
const path = require('path');

const {
  getDocsAudienceMode,
  isAudienceVisible,
} = require('./docs-audience');

const appRoot = path.join(__dirname, '..');
const outDir = path.join(appRoot, 'out');
const generatedDir = path.join(appRoot, 'lib', 'generated');
const docsAudiencePath = path.join(generatedDir, 'docs-audience.json');
const publicSearchIndexPath = path.join(appRoot, 'public', 'search-index.json');
const publicSearchStaticPath = path.join(appRoot, 'public', 'search-static.json');

const publicLeakPatterns = [
  { pattern: /\bimplementation audit\b/i, message: 'implementation audit evidence' },
  { pattern: /\bsource-backed\b/i, message: 'source-backed validation wording' },
  { pattern: /\bcurrent implementation\b/i, message: 'current implementation wording' },
  { pattern: /\bimplementation detail\b/i, message: 'implementation detail wording' },
  { pattern: /\bhidden implementation\b/i, message: 'hidden implementation wording' },
  { pattern: /\bcurrent endpoint stores\b/i, message: 'endpoint storage mechanics' },
  { pattern: /\binternal flows\b/i, message: 'internal flow wording' },
  { pattern: /\binternal trace context\b/i, message: 'internal tracing mechanics' },
  { pattern: /\blow-level internal\b/i, message: 'low-level internal mechanics' },
  { pattern: /\binternally buffered\b/i, message: 'internal buffering mechanics' },
  { pattern: /\broute_inventory_count\b/i, message: 'route inventory metadata' },
  { pattern: /\bgenerated_from\b/i, message: 'generated artifact source metadata' },
  { pattern: /\bdocs-implementation-audit\b/i, message: 'implementation audit artifact names' },
  { pattern: /\bserver implementation\b/i, message: 'server implementation wording' },
  { pattern: /\bbackend implementation\b/i, message: 'backend implementation wording' },
  { pattern: /\bcmd\/igris-overture\b/i, message: 'internal source paths' },
  { pattern: /\bigris-overture\b/i, message: 'internal repository names' },
  { pattern: /\brust-core\b/i, message: 'internal repository names' },
  { pattern: /\/Users\/wira\b/i, message: 'local filesystem paths' },
  { pattern: /\/admin\/slo\//i, message: 'deployment-specific SLO admin paths' },
  { pattern: /\binternal FFI contract\b/i, message: 'internal runtime/control-plane wording' },
];

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function outputPathForUrl(url) {
  const cleanUrl = url.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!cleanUrl) {
    return path.join(outDir, 'index.html');
  }
  return path.join(outDir, cleanUrl, 'index.html');
}

function scanFile(filePath, failures) {
  const extension = path.extname(filePath);
  if (!['.html', '.txt', '.json', '.js'].includes(extension)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rule of publicLeakPatterns) {
    if (rule.pattern.test(content)) {
      failures.push(`${filePath}: public output contains ${rule.message}.`);
    }
  }
}

function scanSearchFile(filePath, audienceMode, failures) {
  if (!fs.existsSync(filePath)) {
    failures.push(`Missing public search artifact: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rule of publicLeakPatterns) {
    if (rule.pattern.test(content)) {
      failures.push(`${filePath}: public search contains ${rule.message}.`);
    }
  }

  if (path.basename(filePath) !== 'search-index.json') {
    return;
  }

  const entries = JSON.parse(content);
  for (const entry of entries) {
    if (!isAudienceVisible(entry.audience, audienceMode)) {
      failures.push(`${filePath}: ${entry.audience} search entry leaked into ${audienceMode} build: ${entry.path}`);
    }
  }
}

function main() {
  const failures = [];
  const audienceMode = getDocsAudienceMode();

  if (!fs.existsSync(outDir)) {
    failures.push(`Missing static export directory: ${outDir}`);
  }
  if (!fs.existsSync(docsAudiencePath)) {
    failures.push(`Missing generated docs audience map: ${docsAudiencePath}`);
  }

  if (failures.length === 0) {
    const docsAudience = JSON.parse(fs.readFileSync(docsAudiencePath, 'utf8'));
    for (const [url, audience] of Object.entries(docsAudience.pages || {})) {
      if (isAudienceVisible(audience, audienceMode)) {
        continue;
      }

      const outputPath = outputPathForUrl(url);
      if (fs.existsSync(outputPath)) {
        failures.push(`${outputPath}: ${audience} page was exported in ${audienceMode} build.`);
      }
    }
  }

  scanSearchFile(publicSearchIndexPath, audienceMode, failures);
  scanSearchFile(publicSearchStaticPath, audienceMode, failures);

  if (audienceMode === 'public') {
    for (const filePath of walkFiles(outDir)) {
      scanFile(filePath, failures);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Public docs output validation failed:\n${failures.join('\n')}`);
  }

  console.log('Public docs output validation passed');
}

main();
