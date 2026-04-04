const fs = require('fs');
const path = require('path');

const { bannedPatterns, docsDir, generatedDir } = require('./docs-data');

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

  const requiredGeneratedFiles = ['api-reference.json', 'api-verification.json', 'sdk-support.json'];
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

  const quickstart = fs.readFileSync(path.join(docsDir, 'quickstart.mdx'), 'utf8');
  if (!quickstart.includes('OpenAI-compatible')) {
    failures.push('quickstart.mdx must explain the OpenAI-compatible onboarding path.');
  }

  const sdkPage = fs.readFileSync(path.join(docsDir, 'sdk.mdx'), 'utf8');
  if (!sdkPage.includes('first-class SDKs today are JavaScript/TypeScript, Go, and Rust')) {
    failures.push('sdk.mdx must state the current first-class SDK support clearly.');
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
