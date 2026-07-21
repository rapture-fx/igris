const fs = require('fs');
const path = require('path');

const { bannedPatterns, docsDir, generatedDir, repoRoot, sdkSupport } = require('./docs-data');
const {
  allowedAudiences,
  getDocsAudienceMode,
  isAudienceVisible,
  parseFrontmatter,
} = require('./docs-audience');

const publicLeakPatterns = [
  { pattern: /\bimplementation audit\b/i, message: 'Public docs must not expose implementation audit evidence.' },
  { pattern: /\bsource-backed\b/i, message: 'Public docs must not expose source-backed validation wording.' },
  { pattern: /\bcurrent implementation\b/i, message: 'Public docs must describe product behavior, not current implementation details.' },
  { pattern: /\bimplementation detail\b/i, message: 'Public docs must not frame product behavior as implementation detail.' },
  { pattern: /\bhidden implementation\b/i, message: 'Public docs must not reference hidden implementation details.' },
  { pattern: /\bcurrent endpoint stores\b/i, message: 'Public docs must not expose endpoint storage mechanics.' },
  { pattern: /\binternal flows\b/i, message: 'Public docs must not reference internal flows.' },
  { pattern: /\binternal trace context\b/i, message: 'Public docs must not expose internal tracing mechanics.' },
  { pattern: /\blow-level internal\b/i, message: 'Public docs must not expose low-level internal mechanics.' },
  { pattern: /\binternally buffered\b/i, message: 'Public docs must not expose internal buffering mechanics.' },
  { pattern: /\broute_inventory_count\b/i, message: 'Public docs must not expose route inventory metadata.' },
  { pattern: /\bgenerated_from\b/i, message: 'Public docs must not expose generated artifact source metadata.' },
  { pattern: /\bdocs-implementation-audit\b/i, message: 'Public docs must not expose implementation audit artifact names.' },
  { pattern: /\bserver implementation\b/i, message: 'Public docs must not reference server implementation.' },
  { pattern: /\bbackend implementation\b/i, message: 'Public docs must not reference backend implementation.' },
  { pattern: /\bcmd\/igris-overture\b/i, message: 'Public docs must not expose internal source paths.' },
  { pattern: /\bigris-overture\b/i, message: 'Public docs must not expose repository names as evidence.' },
  { pattern: /\brust-core\b/i, message: 'Public docs must not expose repository names as evidence.' },
  { pattern: /\/Users\/wira\b/i, message: 'Public docs must not expose local filesystem paths.' },
  { pattern: /\/admin\/slo\//i, message: 'Public docs must not expose deployment-specific SLO admin paths.' },
  { pattern: /\binternal FFI contract\b/i, message: 'Public docs must not expose internal runtime/control-plane interfaces.' },
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
    } else if (entry.isFile() && fullPath.endsWith('.mdx')) {
      files.push(fullPath);
    }
  }
  return files;
}

function toDocUrl(filePath) {
  const relativePath = path.relative(docsDir, filePath).replaceAll(path.sep, '/');
  const withoutExtension = relativePath.replace(/\.mdx$/, '');

  if (withoutExtension === 'index') {
    return '/docs';
  }
  if (withoutExtension.endsWith('/index')) {
    return `/docs/${withoutExtension.slice(0, -'/index'.length)}`;
  }

  return `/docs/${withoutExtension}`;
}

function navItemToDocUrl(item) {
  if (typeof item !== 'string' || item.startsWith('---')) {
    return null;
  }

  if (item === 'index') {
    return '/docs';
  }
  if (item.endsWith('/index')) {
    return `/docs/${item.slice(0, -'/index'.length)}`;
  }

  return `/docs/${item}`;
}

function main() {
  const failures = [];
  const warnings = [];
  const audienceMode = getDocsAudienceMode();

  const requiredGeneratedFiles = [
    'api-reference.json',
    'api-verification.json',
    'api-contract-validation.json',
    'docs-audience.json',
    'sdk-snippet-validation.json',
    'sdk-compile-validation.json',
    'sdk-support.json',
    'mcp-reference.json',
  ];
  for (const fileName of requiredGeneratedFiles) {
    const fullPath = path.join(generatedDir, fileName);
    if (!fs.existsSync(fullPath)) {
      failures.push(`Missing generated artifact: ${fullPath}`);
    }
  }

  const docsAudiencePath = path.join(generatedDir, 'docs-audience.json');
  const docsAudience = fs.existsSync(docsAudiencePath)
    ? JSON.parse(fs.readFileSync(docsAudiencePath, 'utf8'))
    : { pages: {} };

  const rootMetaPath = path.join(docsDir, 'meta.json');
  if (fs.existsSync(rootMetaPath)) {
    const rootMeta = JSON.parse(fs.readFileSync(rootMetaPath, 'utf8'));
    const rootPages = rootMeta.pages ?? [];
    const visibleNavItems = rootPages
      .map((item) => ({ item, url: navItemToDocUrl(item) }))
      .filter(({ url }) => url);

    for (const { item, url } of visibleNavItems) {
      const audience = docsAudience.pages?.[url];
      if (audience && !isAudienceVisible(audience, audienceMode)) {
        failures.push(`${rootMetaPath}: ${audience} page "${item}" is listed in ${audienceMode} root navigation.`);
      }
    }

    const requiredStartPath = [
      'quickstart',
      'first-durable-action',
      'actions',
      'durable-runs',
      'business-idempotency',
      'recovery',
      'uncertain-effects',
      'igris-run-proof',
      'sdk',
      'sdk-durable-client',
      'sdk-bind-action',
      'sdk-run-action',
      'sdk-inspect-run',
      'runtime-deployment',
      'reconciliation',
      'troubleshooting',
      'rest-api',
      'mcp',
      'action-protocol',
      'evidence',
      'verification',
    ];
    const requiredReferencePath = ['api-reference', 'cli', 'configuration'];
    let previousIndex = -1;
    for (const page of requiredStartPath) {
      const currentIndex = rootPages.indexOf(page);
      if (currentIndex === -1) {
        failures.push(`${rootMetaPath}: missing required customer onboarding page "${page}" in root navigation.`);
      } else if (currentIndex < previousIndex) {
        failures.push(`${rootMetaPath}: customer onboarding page "${page}" appears out of order.`);
      }
      previousIndex = currentIndex;
    }
    for (const page of requiredReferencePath) {
      if (!rootPages.includes(page)) {
        failures.push(`${rootMetaPath}: missing required reference page "${page}" in root navigation.`);
      }
    }

    const apiReferenceIndex = rootPages.indexOf('api-reference');
    const lastStartIndex = rootPages.indexOf(requiredStartPath[requiredStartPath.length - 1]);
    if (apiReferenceIndex !== -1 && lastStartIndex !== -1 && apiReferenceIndex < lastStartIndex) {
      failures.push(`${rootMetaPath}: API Reference must appear after the customer onboarding workflow.`);
    }
  }

  for (const filePath of walk(docsDir)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const { data } = parseFrontmatter(content);
    if (!data.audience) {
      failures.push(`${filePath}: missing required audience frontmatter; use public, operator, or internal.`);
    } else if (!allowedAudiences.has(data.audience)) {
      failures.push(`${filePath}: invalid audience "${data.audience}"; use public, operator, or internal.`);
    }
    const docUrl = toDocUrl(filePath);
    if (docsAudience.pages?.[docUrl] !== data.audience) {
      failures.push(`${filePath}: docs-audience.json has "${docsAudience.pages?.[docUrl] || 'missing'}" for ${docUrl}; regenerate docs artifacts.`);
    }

    for (const rule of bannedPatterns) {
      const matched = rule.pattern instanceof RegExp
        ? rule.pattern.test(content)
        : content.includes(rule.pattern);
      if (matched) {
        failures.push(`${filePath}: ${rule.message}`);
      }
    }
    if (data.audience === 'public') {
      for (const rule of publicLeakPatterns) {
        const matched = rule.pattern instanceof RegExp
          ? rule.pattern.test(content)
          : content.includes(rule.pattern);
        if (matched) {
          failures.push(`${filePath}: ${rule.message}`);
        }
      }
    }
    if (filePath.includes(`${path.sep}api-reference${path.sep}`) && /\/[^\s`"')<]*\{[a-zA-Z0-9_]+\}/.test(content)) {
      failures.push(`${filePath}: raw brace-style path parameter would be parsed as an MDX expression; render it as :param or HTML entities.`);
    }
  }

  const apiReferencePath = path.join(generatedDir, 'api-reference.json');
  const apiReference = JSON.parse(fs.readFileSync(apiReferencePath, 'utf8'));
  const allowedSupport = new Set(['core', 'supported', 'preview']);
  const allowedDeployment = new Set(['cloud', 'local', 'hybrid']);
  const documentedEndpointKeys = new Set();

  for (const section of apiReference.sections ?? []) {
    for (const endpoint of section.endpoints ?? []) {
      const key = `${endpoint.method} ${endpoint.path}`;
      documentedEndpointKeys.add(key);
      if (!allowedSupport.has(endpoint.support)) {
        failures.push(`${key}: missing or invalid support level`);
      }
      if (!allowedDeployment.has(endpoint.deployment)) {
        failures.push(`${key}: missing or invalid deployment mode`);
      }
      if (!allowedAudiences.has(endpoint.audience)) {
        failures.push(`${key}: missing or invalid audience`);
      }
    }
  }

  const publicMarkdownDir = path.join(path.dirname(docsDir), '..', 'public', 'markdown');
  if (fs.existsSync(publicMarkdownDir)) {
    for (const filePath of walk(publicMarkdownDir)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const { data } = parseFrontmatter(content);
      if (!isAudienceVisible(data.audience, audienceMode)) {
        failures.push(`${filePath}: ${data.audience} page leaked into ${audienceMode} public markdown output.`);
      }
      for (const rule of publicLeakPatterns) {
        const matched = rule.pattern instanceof RegExp
          ? rule.pattern.test(content)
          : content.includes(rule.pattern);
        if (matched) {
          failures.push(`${filePath}: ${rule.message}`);
        }
      }
    }
  }

  const requiredCustomerEndpointKeys = [
    'GET /v1/actions',
    'POST /v1/actions',
    'POST /v1/actions/run',
    'POST /v1/actions/:name/run',
    'GET /v1/actions/runs/:id',
    'POST /api/v1/runtime/register',
    'POST /api/v1/runtime/heartbeat',
    'GET /api/v1/runtime/commands',
    'DELETE /api/v1/runtime/deregister',
    'GET /v1/routing/speculative/status',
    'GET /v1/routing/speculative/config',
    'POST /v1/routing/speculative',
    'GET /v1/routing/speculative/analytics',
    'POST /v1/routing/speculative/simulate',
    'GET /v1/routing/circuit-breaker/status',
    'GET /v1/routing/council/analytics',
    'GET /v1/tasks/:id/steps',
    'POST /v1/tasks/:id/cancel',
    'GET /v1/tasks/proof/readiness',
    'POST /v1/tasks/:id/proof/verify',
    'POST /v1/mcp',
    'GET /v1/runtime/profile',
    'GET /v1/memory/status',
    'POST /v1/runtime/task/submit',
    'POST /v1/runtime/task/stream',
  ];
  for (const key of requiredCustomerEndpointKeys) {
    if (!documentedEndpointKeys.has(key)) {
      failures.push(`Customer-facing route is missing from api-reference.json: ${key}`);
    }
  }

  const sdkSupportPath = path.join(generatedDir, 'sdk-support.json');
  const sdkSupport = JSON.parse(fs.readFileSync(sdkSupportPath, 'utf8'));
  const allowedSdkStatuses = new Set(['first-class', 'preview', 'http-api']);
  for (const row of sdkSupport.rows ?? []) {
    if (!allowedSdkStatuses.has(row.status)) {
      failures.push(`SDK support row for ${row.language}: invalid status ${row.status}`);
    }
  }

  const mcpReferencePath = path.join(generatedDir, 'mcp-reference.json');
  const mcpReference = JSON.parse(fs.readFileSync(mcpReferencePath, 'utf8'));
  if (!Array.isArray(mcpReference.guides) || mcpReference.guides.length < 4) {
    failures.push('mcp-reference.json must include the MCP guide set.');
  }
  if (!Array.isArray(mcpReference.methodGroups) || mcpReference.methodGroups.length < 2) {
    failures.push('mcp-reference.json must include MCP method groups.');
  }

  const requiredProductDocs = [
    'first-durable-action.mdx',
    'actions.mdx',
    'durable-runs.mdx',
    'business-idempotency.mdx',
    'recovery.mdx',
    'uncertain-effects.mdx',
    'igris-run-proof.mdx',
    'sdk-durable-client.mdx',
    'sdk-bind-action.mdx',
    'sdk-run-action.mdx',
    'sdk-inspect-run.mdx',
    'runtime-deployment.mdx',
    'reconciliation.mdx',
    'rest-api.mdx',
    'action-protocol.mdx',
    'evidence.mdx',
    'cli.mdx',
    'configuration.mdx',
    'mcp.mdx',
  ];
  for (const fileName of requiredProductDocs) {
    const fullPath = path.join(docsDir, fileName);
    if (!fs.existsSync(fullPath)) {
      failures.push(`Missing External Alpha product documentation page: ${fullPath}`);
    }
  }

  const quickstart = fs.readFileSync(path.join(docsDir, 'quickstart.mdx'), 'utf8');
  if (!quickstart.includes('/docs/first-durable-action')) {
    failures.push('quickstart.mdx must point readers at Your First Durable Action.');
  }
  if (!quickstart.includes('IgrisDurableClient') || !quickstart.includes('igris-sdk')) {
    failures.push('quickstart.mdx must document igris-sdk and IgrisDurableClient.');
  }
  if (quickstart.includes('pip install igris-inertial')) {
    failures.push('quickstart.mdx must not recommend pip install igris-inertial.');
  }

  const sdkPage = fs.readFileSync(path.join(docsDir, 'sdk.mdx'), 'utf8');
  const firstClassLanguages = (sdkSupport.rows ?? [])
    .filter((row) => row.status === 'first-class')
    .map((row) => row.language);
  if (!firstClassLanguages.includes('Python')) {
    failures.push('sdk-support.json must mark Python as first-class for External Alpha.');
  }
  if (!sdkPage.includes('IgrisDurableClient') || !sdkPage.includes('igris-sdk')) {
    failures.push('sdk.mdx must document the Python durable SDK (igris-sdk / IgrisDurableClient).');
  }
  if (sdkPage.includes('pip install igris-inertial') || sdkPage.includes('from igris import IgrisClient')) {
    failures.push('sdk.mdx must not document the obsolete igris-inertial / IgrisClient install path.');
  }

  const pythonSdkRow = (sdkSupport.rows ?? []).find((row) => row.language === 'Python');
  if (!pythonSdkRow) {
    failures.push('Missing Python SDK support row.');
  } else {
    const pyprojectPath = path.join(repoRoot, 'sdk/python/pyproject.toml');
    if (!fs.existsSync(pyprojectPath)) {
      failures.push(`Missing Python SDK pyproject at ${pyprojectPath}`);
    } else {
      const pyproject = fs.readFileSync(pyprojectPath, 'utf8');
      if (!pyproject.includes('name = "igris-sdk"')) {
        failures.push('Python SDK distribution name must remain igris-sdk.');
      }
      if (pythonSdkRow.package !== 'igris-sdk') {
        failures.push(`Python SDK docs package mismatch: expected igris-sdk, found ${pythonSdkRow.package}`);
      }
      if (!String(pythonSdkRow.install || '').includes('sdk/python') && !String(pythonSdkRow.install || '').includes('igris-sdk')) {
        failures.push(`Python SDK docs install must reference sdk/python or igris-sdk; found "${pythonSdkRow.install}"`);
      }
      if (!String(pythonSdkRow.import || '').includes('IgrisDurableClient')) {
        failures.push(`Python SDK docs import must use IgrisDurableClient; found "${pythonSdkRow.import}"`);
      }
    }
  }

  const proofPage = fs.readFileSync(path.join(docsDir, 'igris-run-proof.mdx'), 'utf8');
  for (const requiredText of [
    'eligible_linked',
    'Runtime receipt',
    'Action Protocol Evidence',
    'cryptographic',
  ]) {
    if (!proofPage.includes(requiredText)) {
      failures.push(`igris-run-proof.mdx is missing required claim-boundary content: ${requiredText}`);
    }
  }
  if (/universal exactly-once/i.test(proofPage)) {
    failures.push('igris-run-proof.mdx must not claim universal exactly-once execution.');
  }

  const publicNavForbidden = [
    'robotics',
    'ros2-integration',
    'fleet-management',
    'speculative-execution',
    'multimodal',
    'semantic-routing',
  ];
  const rootMeta = JSON.parse(fs.readFileSync(path.join(docsDir, 'meta.json'), 'utf8'));
  for (const slug of publicNavForbidden) {
    if ((rootMeta.pages ?? []).includes(slug)) {
      failures.push(`meta.json must not list historical page "${slug}" in first-contact navigation.`);
    }
  }

  if (failures.length > 0) {
    console.error('Documentation validation failed:\n');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`[validate-docs] ${warning}`);
    }
  }

  console.log('Documentation validation passed');
}

main();
