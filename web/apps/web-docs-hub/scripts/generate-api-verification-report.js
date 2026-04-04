const fs = require('fs');
const path = require('path');

const { apiSections, generatedDir, repoRoot } = require('./docs-data');

const SOURCE_EXTENSIONS = new Set(['.go', '.rs', '.ts', '.tsx', '.js', '.jsx']);
const SKIP_DIRS = new Set([
  '.git',
  '.next',
  'node_modules',
  'target',
  'dist',
  'out',
  'coverage',
  '.pnpm-store',
  '.turbo',
]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function endpointPathToRegex(routePath) {
  const escaped = routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withColonParams = escaped.replace(/:[a-zA-Z0-9_]+/g, '[^"\'\\s/?]+');
  const withBraceParams = withColonParams.replace(/\\\{[a-zA-Z0-9_]+\\\}/g, '[^"\'\\s/?]+');
  return new RegExp(withBraceParams);
}

function normalizeFilePath(filePath) {
  return path.relative(repoRoot, filePath);
}

function classifyEvidenceFile(filePath) {
  const relative = normalizeFilePath(filePath);

  if (
    relative.includes('/tests/') ||
    relative.includes('stability-tests/') ||
    relative.endsWith('_test.go') ||
    relative.endsWith('.test.ts') ||
    relative.endsWith('.test.tsx') ||
    relative.endsWith('.spec.ts') ||
    relative.endsWith('.spec.tsx')
  ) {
    return 'test';
  }

  if (
    relative.includes('/sdk') ||
    relative.includes('-sdk/') ||
    relative.includes('/client') ||
    relative.includes('license-client/') ||
    relative.includes('transport.rs')
  ) {
    return 'client';
  }

  return 'implementation';
}

function isRelevantEvidenceFile(endpoint, relativePath) {
  if (endpoint.surface === 'Local runtime') {
    return relativePath.startsWith('igris-runtime/');
  }

  return (
    relativePath.startsWith('igris-overture/') ||
    relativePath.startsWith('stability-tests/') ||
    relativePath.startsWith('igris-javascript-sdk/') ||
    relativePath.startsWith('igris-go-sdk/') ||
    relativePath.startsWith('igris-rust-sdk/') ||
    relativePath.startsWith('igris-runtime/crates/igris-license-client/')
  );
}

function buildEndpointCatalog() {
  return apiSections.flatMap((section) =>
    section.endpoints.map((endpoint) => ({
      section: section.title,
      summary: section.summary,
      ...endpoint,
    }))
  );
}

function buildVerificationRows(files) {
  const fileContents = files.map((filePath) => ({
    filePath,
    relativePath: normalizeFilePath(filePath),
    kind: classifyEvidenceFile(filePath),
    content: fs.readFileSync(filePath, 'utf8'),
  }));

  return buildEndpointCatalog().map((endpoint) => {
    const regex = endpointPathToRegex(endpoint.path);
    const methodRegex = new RegExp(`\\b${endpoint.method}\\b`, 'i');

    const matches = fileContents.filter(
      ({ content, relativePath }) =>
        isRelevantEvidenceFile(endpoint, relativePath) && regex.test(content) && methodRegex.test(content)
    );
    const testFiles = matches.filter((match) => match.kind === 'test').map((match) => match.relativePath);
    const clientFiles = matches.filter((match) => match.kind === 'client').map((match) => match.relativePath);

    let status = 'implemented-unverified';
    let confidence = 'low';
    let note = 'Route is documented and registered in code, but no direct test or client exercise was found in this repository scan.';

    if (testFiles.length > 0) {
      status = 'test-covered';
      confidence = 'high';
      note = 'At least one automated test references this route path and method.';
    } else if (clientFiles.length > 0) {
      status = 'client-referenced';
      confidence = 'medium';
      note = 'A client or transport layer references this route, but no direct automated test was found.';
    }

    return {
      section: endpoint.section,
      method: endpoint.method,
      path: endpoint.path,
      auth: endpoint.auth,
      surface: endpoint.surface,
      stability: endpoint.stability,
      description: endpoint.description,
      status,
      confidence,
      note,
      evidence: {
        test_files: testFiles,
        client_files: clientFiles,
      },
    };
  });
}

function buildSummary(rows) {
  return rows.reduce(
    (summary, row) => {
      summary.total += 1;
      summary.by_status[row.status] = (summary.by_status[row.status] ?? 0) + 1;
      summary.by_section[row.section] = (summary.by_section[row.section] ?? 0) + 1;
      return summary;
    },
    {
      total: 0,
      by_status: {},
      by_section: {},
    }
  );
}

function renderMarkdown(summary, rows) {
  const lines = [
    '# API Verification Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'This report is evidence-based. It does not claim endpoint health beyond what is present in route registration, tests, and client references in this repository.',
    '',
    '## Summary',
    '',
    `- Total documented endpoints: ${summary.total}`,
    `- Test-covered: ${summary.by_status['test-covered'] ?? 0}`,
    `- Client-referenced: ${summary.by_status['client-referenced'] ?? 0}`,
    `- Implemented but unverified: ${summary.by_status['implemented-unverified'] ?? 0}`,
    '',
    '## Endpoints',
    '',
    '| Status | Method | Path | Section | Evidence |',
    '| --- | --- | --- | --- | --- |',
  ];

  for (const row of rows) {
    const evidence = [
      ...(row.evidence.test_files.length > 0 ? [`tests: ${row.evidence.test_files.length}`] : []),
      ...(row.evidence.client_files.length > 0 ? [`clients: ${row.evidence.client_files.length}`] : []),
    ].join(', ') || 'none';

    lines.push(`| ${row.status} | ${row.method} | \`${row.path}\` | ${row.section} | ${evidence} |`);
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const rows = buildVerificationRows(walk(repoRoot));
  const summary = buildSummary(rows);

  fs.mkdirSync(generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(generatedDir, 'api-verification.json'),
    `${JSON.stringify({ generated_at: new Date().toISOString(), summary, endpoints: rows }, null, 2)}\n`
  );
  fs.writeFileSync(path.join(generatedDir, 'api-verification.md'), renderMarkdown(summary, rows));

  console.log(`API verification report generated: ${summary.total} endpoints`);
  console.log(JSON.stringify(summary, null, 2));
}

main();
