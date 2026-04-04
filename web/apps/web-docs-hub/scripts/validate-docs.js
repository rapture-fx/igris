const fs = require('fs');
const path = require('path');

const { bannedPatterns, docsDir, generatedDir, repoRoot } = require('./docs-data');

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

function main() {
  const failures = [];

  const requiredGeneratedFiles = ['api-reference.json', 'api-verification.json', 'sdk-support.json', 'mcp-reference.json'];
  for (const fileName of requiredGeneratedFiles) {
    const fullPath = path.join(generatedDir, fileName);
    if (!fs.existsSync(fullPath)) {
      failures.push(`Missing generated artifact: ${fullPath}`);
    }
  }

  for (const filePath of walk(docsDir)) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const rule of bannedPatterns) {
      const matched = rule.pattern instanceof RegExp
        ? rule.pattern.test(content)
        : content.includes(rule.pattern);
      if (matched) {
        failures.push(`${filePath}: ${rule.message}`);
      }
    }
  }

  const apiReferencePath = path.join(generatedDir, 'api-reference.json');
  const apiReference = JSON.parse(fs.readFileSync(apiReferencePath, 'utf8'));
  const allowedSupport = new Set(['core', 'supported', 'preview']);
  const allowedDeployment = new Set(['cloud', 'local', 'hybrid']);

  for (const section of apiReference.sections ?? []) {
    for (const endpoint of section.endpoints ?? []) {
      const key = `${endpoint.method} ${endpoint.path}`;
      if (!allowedSupport.has(endpoint.support)) {
        failures.push(`${key}: missing or invalid support level`);
      }
      if (!allowedDeployment.has(endpoint.deployment)) {
        failures.push(`${key}: missing or invalid deployment mode`);
      }
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
  if (!sdkPage.includes('first-class SDKs today are JavaScript/TypeScript, Go, and Rust')) {
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

  const jsPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'igris-javascript-sdk', 'package.json'), 'utf8'));
  if (jsPackage.name !== '@igris-inertial/sdk') {
    failures.push(`JavaScript SDK package mismatch: expected @igris-inertial/sdk, found ${jsPackage.name}`);
  }
  const jsSdkRow = (sdkSupport.rows ?? []).find((row) => row.language === 'JavaScript / TypeScript');
  if (!jsSdkRow) {
    failures.push('Missing JavaScript / TypeScript SDK support row.');
  } else {
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
  }

  const goMod = fs.readFileSync(path.join(repoRoot, 'igris-go-sdk', 'go.mod'), 'utf8');
  const goModuleMatch = goMod.match(/^module\s+(.+)$/m);
  if (!goModuleMatch || goModuleMatch[1].trim() !== 'github.com/igris-inertial/go-sdk') {
    failures.push('Go SDK module path must remain github.com/igris-inertial/go-sdk.');
  }
  const goModule = goModuleMatch?.[1]?.trim();
  const goSdkRow = (sdkSupport.rows ?? []).find((row) => row.language === 'Go');
  if (!goSdkRow) {
    failures.push('Missing Go SDK support row.');
  } else if (goModule) {
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

  const rustCargo = fs.readFileSync(path.join(repoRoot, 'igris-rust-sdk', 'Cargo.toml'), 'utf8');
  const rustPackageMatch = rustCargo.match(/^name\s*=\s*"(.+)"$/m);
  if (!rustPackageMatch || rustPackageMatch[1].trim() !== 'igris-inertial') {
    failures.push('Rust SDK crate name must remain igris-inertial.');
  }
  const rustPackage = rustPackageMatch?.[1]?.trim();
  const rustSdkRow = (sdkSupport.rows ?? []).find((row) => row.language === 'Rust');
  if (!rustSdkRow) {
    failures.push('Missing Rust SDK support row.');
  } else if (rustPackage) {
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

  if (failures.length > 0) {
    console.error('Documentation validation failed:\n');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Documentation validation passed');
}

main();
