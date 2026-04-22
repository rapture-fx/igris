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
    'POST /v1/mcp/stream',
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
  const allowedSdkStatuses = new Set(['first-class', 'preview', 'openai-compatible']);
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

  const requiredWorkflowDocs = [
    'first-cloud-integration.mdx',
    'deploy-local-runtime.mdx',
    'hybrid-deployment-workflow.mdx',
    'receipts-audit-workflow.mdx',
    'fleet-rollout-workflow.mdx',
  ];
  for (const fileName of requiredWorkflowDocs) {
    const fullPath = path.join(docsDir, fileName);
    if (!fs.existsSync(fullPath)) {
      failures.push(`Missing workflow documentation page: ${fullPath}`);
    }
  }

  const requiredReferenceDocs = [
    'context-engineering.mdx',
    'sdk-integration-patterns.mdx',
    'documentation-roadmap.mdx',
    'mcp.mdx',
    'mcp-server.mdx',
    'mcp-swarm.mdx',
    'mcp-integration-patterns.mdx',
  ];
  for (const fileName of requiredReferenceDocs) {
    const fullPath = path.join(docsDir, fileName);
    if (!fs.existsSync(fullPath)) {
      failures.push(`Missing reference documentation page: ${fullPath}`);
    }
  }

  const quickstart = fs.readFileSync(path.join(docsDir, 'quickstart.mdx'), 'utf8');
  if (!quickstart.includes('OpenAI-compatible')) {
    failures.push('quickstart.mdx must explain the OpenAI-compatible onboarding path.');
  }

  const sdkPage = fs.readFileSync(path.join(docsDir, 'sdk.mdx'), 'utf8');
  const normalizeLanguage = (language) => language.replace(/\s*\/\s*/g, '/');
  const firstClassLanguages = (sdkSupport.rows ?? [])
    .filter((row) => row.status === 'first-class')
    .map((row) => normalizeLanguage(row.language));
  const openAICompatibleLanguages = (sdkSupport.rows ?? [])
    .filter((row) => row.status === 'openai-compatible')
    .map((row) => row.language);

  const mentionsAllFirstClass = firstClassLanguages.every((language) => sdkPage.includes(language));
  const mentionsOpenAICompatible = openAICompatibleLanguages.every((language) => sdkPage.includes(language));
  if (!mentionsAllFirstClass || !mentionsOpenAICompatible || !sdkPage.includes('OpenAI-compatible')) {
    failures.push('sdk.mdx must state the current first-class SDK support clearly.');
  }
  if (!sdkPage.includes('## Support Policy')) {
    failures.push('sdk.mdx must include a Support Policy section.');
  }
  if (!sdkPage.includes('## Deployment Mode Guidance')) {
    failures.push('sdk.mdx must include deployment mode guidance.');
  }
  if (!sdkPage.includes('## Code Quality Expectations')) {
    failures.push('sdk.mdx must include code quality expectations.');
  }

  const sdkPatterns = fs.readFileSync(path.join(docsDir, 'sdk-integration-patterns.mdx'), 'utf8');
  for (const requiredText of [
    'IGRIS_API_KEY',
    'IGRIS_BASE_URL',
    '## Pattern: Choose A Mode Once',
    '## Pattern: Keep Receipt And Audit Handling Out Of The Hot Path',
    'JavaScript / TypeScript',
    'Go',
    'Rust',
  ]) {
    if (!sdkPatterns.includes(requiredText)) {
      failures.push(`sdk-integration-patterns.mdx is missing required content: ${requiredText}`);
    }
  }

  const contextEngineering = fs.readFileSync(path.join(docsDir, 'context-engineering.mdx'), 'utf8');
  for (const requiredText of [
    '## Implementation Checklist',
    'Request-local context',
    'Retrieval and memory',
    'MCP and shared context',
    'Durable task state',
    'Receipts and audit context',
    '## Code And Workflow Quality Signals',
  ]) {
    if (!contextEngineering.includes(requiredText)) {
      failures.push(`context-engineering.mdx is missing required content: ${requiredText}`);
    }
  }

  const jsSdkRow = (sdkSupport.rows ?? []).find((row) => row.language === 'JavaScript / TypeScript');
  if (!jsSdkRow) {
    failures.push('Missing JavaScript / TypeScript SDK support row.');
  } else {
    const jsPackagePath = path.join(repoRoot, 'igris-javascript-sdk', 'package.json');
    if (fs.existsSync(jsPackagePath)) {
      const jsPackage = JSON.parse(fs.readFileSync(jsPackagePath, 'utf8'));
      if (jsPackage.name !== '@igris-inertial/sdk') {
        failures.push(`JavaScript SDK package mismatch: expected @igris-inertial/sdk, found ${jsPackage.name}`);
      }
      const expectedPackage = jsPackage.name;
      const expectedInstall = `npm install ${jsPackage.name}`;
      const expectedImport = `import { IgrisClient } from '${jsPackage.name}';`;
      if (jsSdkRow.package !== expectedPackage) {
        failures.push(`JavaScript SDK docs package mismatch: expected ${expectedPackage}, found ${jsSdkRow.package}`);
      }
      if (jsSdkRow.install !== expectedInstall) {
        failures.push(`JavaScript SDK docs install mismatch: expected "${expectedInstall}", found "${jsSdkRow.install}"`);
      }
      if (jsSdkRow.import !== expectedImport) {
        failures.push(`JavaScript SDK docs import mismatch: expected "${expectedImport}", found "${jsSdkRow.import}"`);
      }
    } else {
      warnings.push(`Skipping JavaScript SDK repo validation; missing ${jsPackagePath}`);
    }
  }

  const goSdkRow = (sdkSupport.rows ?? []).find((row) => row.language === 'Go');
  if (!goSdkRow) {
    failures.push('Missing Go SDK support row.');
  } else {
    const goModPath = path.join(repoRoot, 'igris-go-sdk', 'go.mod');
    if (fs.existsSync(goModPath)) {
      const goMod = fs.readFileSync(goModPath, 'utf8');
      const goModuleMatch = goMod.match(/^module\s+(.+)$/m);
      if (!goModuleMatch || goModuleMatch[1].trim() !== 'github.com/igris-inertial/go-sdk') {
        failures.push('Go SDK module path must remain github.com/igris-inertial/go-sdk.');
      }
      const goModule = goModuleMatch?.[1]?.trim();
      if (goModule) {
        const expectedInstall = `go get ${goModule}`;
        const expectedImport = `import igris "${goModule}"`;
        if (goSdkRow.package !== goModule) {
          failures.push(`Go SDK docs package mismatch: expected ${goModule}, found ${goSdkRow.package}`);
        }
        if (goSdkRow.install !== expectedInstall) {
          failures.push(`Go SDK docs install mismatch: expected "${expectedInstall}", found "${goSdkRow.install}"`);
        }
        if (goSdkRow.import !== expectedImport) {
          failures.push(`Go SDK docs import mismatch: expected "${expectedImport}", found "${goSdkRow.import}"`);
        }
      }
    } else {
      warnings.push(`Skipping Go SDK repo validation; missing ${goModPath}`);
    }
  }

  const rustSdkRow = (sdkSupport.rows ?? []).find((row) => row.language === 'Rust');
  if (!rustSdkRow) {
    failures.push('Missing Rust SDK support row.');
  } else {
    const rustCargoPath = path.join(repoRoot, 'igris-rust-sdk', 'Cargo.toml');
    if (fs.existsSync(rustCargoPath)) {
      const rustCargo = fs.readFileSync(rustCargoPath, 'utf8');
      const rustPackageMatch = rustCargo.match(/^name\s*=\s*"(.+)"$/m);
      if (!rustPackageMatch || rustPackageMatch[1].trim() !== 'igris-inertial') {
        failures.push('Rust SDK crate name must remain igris-inertial.');
      }
      const rustPackage = rustPackageMatch?.[1]?.trim();
      if (rustPackage) {
        const expectedInstall = `cargo add ${rustPackage}`;
        const expectedImport = `use ${rustPackage.replace(/-/g, '_')}::IgrisClient;`;
        if (rustSdkRow.package !== rustPackage) {
          failures.push(`Rust SDK docs package mismatch: expected ${rustPackage}, found ${rustSdkRow.package}`);
        }
        if (rustSdkRow.install !== expectedInstall) {
          failures.push(`Rust SDK docs install mismatch: expected "${expectedInstall}", found "${rustSdkRow.install}"`);
        }
        if (rustSdkRow.import !== expectedImport) {
          failures.push(`Rust SDK docs import mismatch: expected "${expectedImport}", found "${rustSdkRow.import}"`);
        }
      }
    } else {
      warnings.push(`Skipping Rust SDK repo validation; missing ${rustCargoPath}`);
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
