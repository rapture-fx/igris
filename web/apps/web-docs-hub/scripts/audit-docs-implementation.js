const fs = require('fs');
const path = require('path');

const { docsDir, generatedDir, repoRoot } = require('./docs-data');

const allowGaps = process.argv.includes('--allow-gaps') || process.env.DOCS_AUDIT_ALLOW_GAPS === '1';

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

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

function walk(dir, predicate, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, predicate, files);
    } else if (entry.isFile() && predicate(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizeFilePath(filePath) {
  return path.relative(repoRoot, filePath);
}

function joinRoute(base, routePath) {
  const normalized = `${base}${routePath}`.replace(/\/+/g, '/');
  if (normalized === '') {
    return '/';
  }
  return normalized !== '/' && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function sourceSurface(filePath) {
  const relative = normalizeFilePath(filePath);
  if (relative.startsWith('igris-runtime/')) {
    return 'local-runtime';
  }
  if (relative.startsWith('igris-overture/')) {
    return 'cloud-api';
  }
  if (relative.startsWith('rust-core/')) {
    return 'rust-core';
  }
  if (relative.startsWith('web/apps/web-console/')) {
    return 'web-console';
  }
  return 'other';
}

function extractGoRoutes(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const prefixes = new Map([['app', '']]);
  let changed = true;

  while (changed) {
    changed = false;
    const groupRegex = /(\w+)\s*:=\s*(\w+)\.Group\("([^"]*)"/g;
    let match;
    while ((match = groupRegex.exec(source)) !== null) {
      const [, name, baseName, suffix] = match;
      if (!prefixes.has(baseName)) {
        continue;
      }
      const value = joinRoute(prefixes.get(baseName), suffix);
      if (prefixes.get(name) !== value) {
        prefixes.set(name, value);
        changed = true;
      }
    }
  }

  const routes = [];
  const routeRegex = /(\w+)\.(Get|Post|Put|Patch|Delete)\("([^"]*)"/g;
  let match;
  while ((match = routeRegex.exec(source)) !== null) {
    const [, baseName, method, suffix] = match;
    const base = prefixes.get(baseName);
    if (base === undefined) {
      continue;
    }
    routes.push({
      method: method.toUpperCase(),
      path: joinRoute(base, suffix),
      file: normalizeFilePath(filePath),
      surface: sourceSurface(filePath),
    });
  }

  return routes;
}

function extractRustRoutes(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const routes = [];
  const routeRegex = /\.route\(\s*"([^"]+)",\s*(get|post|put|patch|delete)\(/g;
  let match;
  while ((match = routeRegex.exec(source)) !== null) {
    routes.push({
      method: match[2].toUpperCase(),
      path: match[1],
      file: normalizeFilePath(filePath),
      surface: sourceSurface(filePath),
    });
  }
  return routes;
}

function buildRouteInventory() {
  const files = walk(
    repoRoot,
    (filePath) => SOURCE_EXTENSIONS.has(path.extname(filePath)) &&
      !filePath.endsWith('_test.go') &&
      !filePath.endsWith('.test.ts') &&
      !filePath.endsWith('.test.tsx') &&
      !filePath.endsWith('.spec.ts') &&
      !filePath.endsWith('.spec.tsx') &&
      (filePath.includes(`${path.sep}igris-overture${path.sep}`) ||
        filePath.includes(`${path.sep}igris-runtime${path.sep}`) ||
        filePath.includes(`${path.sep}web${path.sep}apps${path.sep}web-console${path.sep}`))
  );

  const routes = [];
  for (const filePath of files) {
    if (filePath.endsWith('.go')) {
      routes.push(...extractGoRoutes(filePath));
    } else if (filePath.endsWith('.rs')) {
      routes.push(...extractRustRoutes(filePath));
    }
  }

  return routes;
}

function normalizeClaimPath(rawPath) {
  let value = rawPath.trim();
  value = value.replace(/^['"`]+|['"`),;]+$/g, '');
  value = value.replace(/&amp;/g, '&').replace(/&#123;/g, '{').replace(/&#125;/g, '}');
  try {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const parsed = new URL(value);
      value = parsed.pathname;
    }
  } catch {
    // Keep the raw value; it will fail matching below.
  }
  value = value.split(']')[0].split(')')[0].split('<')[0];
  value = value.split('?')[0].split('#')[0];
  value = value.replace(/[.,;:]+$/g, '');
  if (value !== '/' && value.endsWith('/')) {
    value = value.slice(0, -1);
  }
  return value;
}

function routeToRegex(routePath) {
  const escaped = routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withColonParams = escaped.replace(/:[a-zA-Z0-9_]+/g, '[^/]+');
  const withBraceParams = withColonParams.replace(/\\\{[a-zA-Z0-9_]+\\\}/g, '[^/]+');
  return new RegExp(`^${withBraceParams}$`);
}

function sameRoutePattern(left, right) {
  return routeToRegex(left).test(right) || routeToRegex(right).test(left);
}

function expectedSurfaceForUrl(url) {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return 'local-runtime';
    }
    if (parsed.hostname.includes('overture.igrisinertial.com')) {
      return 'cloud-api';
    }
  } catch {
    return null;
  }
  return null;
}

function shouldAuditPath(pathValue) {
  return /^\/(v1|api|proof|admin)\b/.test(pathValue) && !pathValue.includes('*');
}

function addClaim(claims, seen, claim) {
  const key = `${claim.file}:${claim.line}:${claim.method ?? '*'}:${claim.path}:${claim.expected_surface ?? '*'}`;
  if (!seen.has(key) && shouldAuditPath(claim.path)) {
    seen.add(key);
    claims.push(claim);
  }
}

function extractDocsRouteClaims() {
  const docsFiles = walk(docsDir, (filePath) => filePath.endsWith('.mdx'));
  const claims = [];
  const seen = new Set();

  for (const filePath of docsFiles) {
    const relative = normalizeFilePath(filePath);
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineNo = index + 1;

      const methodUrlRegex = /\b(GET|POST|PUT|PATCH|DELETE)\s+(https?:\/\/[^\s"'`\\)]+)/g;
      let match;
      while ((match = methodUrlRegex.exec(line)) !== null) {
        const url = match[2];
        addClaim(claims, seen, {
          file: relative,
          line: lineNo,
          method: match[1],
          path: normalizeClaimPath(url),
          expected_surface: expectedSurfaceForUrl(url),
          source: line.trim(),
        });
      }

      const methodPathRegex = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/(?:v1|api|proof|admin)[^\s"'`)\]<]*)/g;
      while ((match = methodPathRegex.exec(line)) !== null) {
        addClaim(claims, seen, {
          file: relative,
          line: lineNo,
          method: match[1],
          path: normalizeClaimPath(match[2]),
          expected_surface: null,
          source: line.trim(),
        });
      }

      const curlUrlRegex = /curl(?:\s+-X\s+(GET|POST|PUT|PATCH|DELETE))?[^"'`]*(https?:\/\/[^\s"'`\\)]+)/g;
      while ((match = curlUrlRegex.exec(line)) !== null) {
        const url = match[2];
        addClaim(claims, seen, {
          file: relative,
          line: lineNo,
          method: match[1] ?? 'GET',
          path: normalizeClaimPath(url),
          expected_surface: expectedSurfaceForUrl(url),
          source: line.trim(),
        });
      }

      const backtickPathRegex = /`(\/(?:v1|api|proof|admin)[^`]*)`/g;
      while ((match = backtickPathRegex.exec(line)) !== null) {
        addClaim(claims, seen, {
          file: relative,
          line: lineNo,
          method: null,
          path: normalizeClaimPath(match[1]),
          expected_surface: null,
          source: line.trim(),
        });
      }
    }
  }

  return claims;
}

function classifyClaim(claim, routes) {
  const pathMatches = routes.filter((route) => sameRoutePattern(route.path, claim.path));
  const methodMatches = pathMatches.filter((route) => !claim.method || route.method === claim.method);
  const surfaceMatches = methodMatches.filter((route) => !claim.expected_surface || route.surface === claim.expected_surface);

  if (surfaceMatches.length > 0) {
    return {
      ...claim,
      status: 'implemented',
      evidence: surfaceMatches.slice(0, 5),
    };
  }

  if (methodMatches.length > 0) {
    return {
      ...claim,
      status: 'wrong-surface',
      evidence: methodMatches.slice(0, 5),
    };
  }

  if (pathMatches.length > 0) {
    return {
      ...claim,
      status: 'wrong-method',
      evidence: pathMatches.slice(0, 5),
    };
  }

  return {
    ...claim,
    status: 'missing',
    evidence: [],
  };
}

function buildPageSummary(rows) {
  const pages = new Map();
  for (const row of rows) {
    const page = pages.get(row.file) ?? {
      file: row.file,
      implemented: 0,
      missing: 0,
      wrong_surface: 0,
      wrong_method: 0,
      total_route_claims: 0,
    };
    page.total_route_claims += 1;
    if (row.status === 'wrong-surface') {
      page.wrong_surface += 1;
    } else if (row.status === 'wrong-method') {
      page.wrong_method += 1;
    } else {
      page[row.status] += 1;
    }
    pages.set(row.file, page);
  }
  return [...pages.values()].sort((a, b) => {
    const aRisk = a.missing + a.wrong_surface + a.wrong_method;
    const bRisk = b.missing + b.wrong_surface + b.wrong_method;
    return bRisk - aRisk || a.file.localeCompare(b.file);
  });
}

function summarize(rows) {
  return rows.reduce(
    (summary, row) => {
      summary.total += 1;
      summary.by_status[row.status] = (summary.by_status[row.status] ?? 0) + 1;
      return summary;
    },
    { total: 0, by_status: {} }
  );
}

function evidenceText(row) {
  if (row.evidence.length === 0) {
    return 'none';
  }
  return row.evidence.map((item) => `${item.method} ${item.path} (${item.surface}, ${item.file})`).join('<br />');
}

function renderMarkdown(summary, pageSummary, rows, guideSummary, guidePageSummary, guideRows) {
  const riskyRows = rows.filter((row) => row.status !== 'implemented');
  const riskyGuideRows = guideRows.filter((row) => row.status !== 'implemented');
  const lines = [
    '# Documentation Implementation Audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'This report compares customer-facing docs route claims against routes registered in `igris-overture`, `igris-runtime`, and the web console codebase. It is evidence-based: a route claim is implemented only when the matching method/path is registered in code on the expected surface.',
    '',
    'The API reference has a separate endpoint verification report in `api-verification.md`. The guide-page section below is the highest-signal view for finding made-up or stale customer-facing workflow documentation.',
    '',
    '## Summary',
    '',
    `- Route claims audited: ${summary.total}`,
    `- Implemented on expected surface: ${summary.by_status.implemented ?? 0}`,
    `- Missing from code: ${summary.by_status.missing ?? 0}`,
    `- Implemented on a different surface than documented: ${summary.by_status['wrong-surface'] ?? 0}`,
    `- Path exists with a different method: ${summary.by_status['wrong-method'] ?? 0}`,
    '',
    '## Guide Page Summary',
    '',
    `- Guide route claims audited: ${guideSummary.total}`,
    `- Implemented on expected surface: ${guideSummary.by_status.implemented ?? 0}`,
    `- Missing from code: ${guideSummary.by_status.missing ?? 0}`,
    `- Implemented on a different surface than documented: ${guideSummary.by_status['wrong-surface'] ?? 0}`,
    `- Path exists with a different method: ${guideSummary.by_status['wrong-method'] ?? 0}`,
    '',
    '| Page | Route claims | Implemented | Missing | Wrong surface | Wrong method |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
  ];

  for (const page of guidePageSummary) {
    lines.push(`| \`${page.file}\` | ${page.total_route_claims} | ${page.implemented} | ${page.missing} | ${page.wrong_surface} | ${page.wrong_method} |`);
  }

  lines.push('', '## Unsupported Or Mismatched Guide Claims', '');
  if (riskyGuideRows.length === 0) {
    lines.push('No unsupported guide-page route claims were found.');
  } else {
    lines.push('| Status | Page | Line | Method | Path | Expected surface | Evidence |');
    lines.push('| --- | --- | ---: | --- | --- | --- | --- |');
    for (const row of riskyGuideRows) {
      lines.push(`| ${row.status} | \`${row.file}\` | ${row.line} | ${row.method ?? '*'} | \`${row.path}\` | ${row.expected_surface ?? 'unspecified'} | ${evidenceText(row)} |`);
    }
  }

  lines.push(
    '',
    '## All Page Risk Summary',
    '',
    '| Page | Route claims | Implemented | Missing | Wrong surface | Wrong method |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
  );

  for (const page of pageSummary) {
    lines.push(`| \`${page.file}\` | ${page.total_route_claims} | ${page.implemented} | ${page.missing} | ${page.wrong_surface} | ${page.wrong_method} |`);
  }

  lines.push('', '## All Unsupported Or Mismatched Claims', '');
  if (riskyRows.length === 0) {
    lines.push('No unsupported route claims were found.');
  } else {
    lines.push('| Status | Page | Line | Method | Path | Expected surface | Evidence |');
    lines.push('| --- | --- | ---: | --- | --- | --- | --- |');
    for (const row of riskyRows) {
      lines.push(`| ${row.status} | \`${row.file}\` | ${row.line} | ${row.method ?? '*'} | \`${row.path}\` | ${row.expected_surface ?? 'unspecified'} | ${evidenceText(row)} |`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function main() {
  const routes = buildRouteInventory();
  const claims = extractDocsRouteClaims();
  const rows = claims.map((claim) => classifyClaim(claim, routes));
  const summary = summarize(rows);
  const pageSummary = buildPageSummary(rows);
  const guideRows = rows.filter((row) => !row.file.includes('/api-reference/'));
  const guideSummary = summarize(guideRows);
  const guidePageSummary = buildPageSummary(guideRows);

  fs.mkdirSync(generatedDir, { recursive: true });
  fs.writeFileSync(
    path.join(generatedDir, 'docs-implementation-audit.json'),
    `${JSON.stringify({ generated_at: new Date().toISOString(), summary, guide_summary: guideSummary, pages: pageSummary, guide_pages: guidePageSummary, claims: rows }, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(generatedDir, 'docs-implementation-audit.md'),
    renderMarkdown(summary, pageSummary, rows, guideSummary, guidePageSummary, guideRows)
  );

  console.log(`Docs implementation audit generated: ${summary.total} route claims`);
  console.log(JSON.stringify(summary, null, 2));

  const unsupported = rows.filter((row) => row.status !== 'implemented');
  if (unsupported.length > 0 && !allowGaps) {
    console.error(`Docs implementation audit failed: ${unsupported.length} unsupported or mismatched route claims found.`);
    console.error(`See ${path.join(generatedDir, 'docs-implementation-audit.md')}`);
    process.exitCode = 1;
  }
}

main();
