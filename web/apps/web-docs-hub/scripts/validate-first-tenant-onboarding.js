#!/usr/bin/env node
/**
 * Validate External Alpha durable onboarding docs against the Python SDK source.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..', '..');
const docsDir = path.join(__dirname, '..', 'content', 'docs');
const durableSourcePath = path.join(repoRoot, 'sdk/python/src/igris/durable.py');
const pyprojectPath = path.join(repoRoot, 'sdk/python/pyproject.toml');
const quickstartPath = path.join(docsDir, 'quickstart.mdx');
const firstActionPath = path.join(docsDir, 'first-durable-action.mdx');
const sdkPath = path.join(docsDir, 'sdk.mdx');
const clientPath = path.join(docsDir, 'sdk-durable-client.mdx');
const canonicalApi = 'https://overture.igrisinertial.com';

const failures = [];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function fail(message) {
  failures.push(message);
}

function assertIncludes(content, needle, label) {
  if (!content.includes(needle)) {
    fail(`${label}: missing ${needle}`);
  }
}

function assertNotIncludes(content, needle, label) {
  if (content.includes(needle)) {
    fail(`${label}: must not include ${needle}`);
  }
}

function validatePyproject() {
  const pyproject = read(pyprojectPath);
  assertIncludes(pyproject, 'name = "igris-sdk"', pyprojectPath);
  assertNotIncludes(pyproject, 'name = "igris"', pyprojectPath);
}

function validateDurableSource() {
  const source = read(durableSourcePath);
  for (const needle of [
    'class IgrisDurableClient',
    'def from_env',
    'def sync_contract',
    'def create_action_target',
    'def ensure_binding',
    'def run(',
    'def wait(',
    'def proof(',
    'ReconciliationRequiredError',
  ]) {
    assertIncludes(source, needle, durableSourcePath);
  }
}

function validateGuide(filePath, required, forbidden) {
  const guide = read(filePath);
  for (const needle of required) {
    assertIncludes(guide, needle, filePath);
  }
  for (const needle of forbidden) {
    assertNotIncludes(guide, needle, filePath);
  }
}

function main() {
  validatePyproject();
  validateDurableSource();

  const sharedForbidden = [
    'pip install igris-inertial',
    'exactly-once execution for every',
    'universal exactly-once execution',
    'Clock 3',
    'Overture',
    './scripts/unified_execution_proof_demo.sh',
    'from igris import IgrisClient',
  ];

  function assertNoAffirmativeInstallIgris(content, label) {
    // Allow explicit "do not pip install igris" warnings; forbid affirmative install lines.
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
      if (/do\s+\*\*not\*\*\s+run\s+`pip install igris`/i.test(trimmed)) continue;
      if (/do not .*pip install igris/i.test(trimmed)) continue;
      if (/never\s+`?pip install igris`?/i.test(trimmed)) continue;
      if (/^pip install igris(?:\s|$|")/.test(trimmed) || /^(?:python -m )?pip install igris(?:\s|$|")/.test(trimmed)) {
        fail(`${label}: unsupported affirmative install command: ${trimmed}`);
      }
    }
  }

  validateGuide(
    quickstartPath,
    [
      'igris-sdk',
      'import igris',
      'IgrisDurableClient',
      `export IGRIS_API_URL="${canonicalApi}"`,
      'IGRIS_API_KEY',
      'invitation',
      'Your First Durable Action',
      'pip install ./sdk/python',
    ],
    sharedForbidden,
  );
  assertNoAffirmativeInstallIgris(read(quickstartPath), quickstartPath);

  validateGuide(
    firstActionPath,
    [
      'IgrisDurableClient',
      'wrap_tool',
      'sync_contract',
      'create_action_target',
      'ensure_binding',
      'contract_hash',
      'idempotency_key',
      'run.wait',
      'run.proof',
      'ReconciliationRequiredError',
    ],
    [
      ...sharedForbidden,
      'igris actions run demo.echo',
      'https://console.igrisinertial.com/auth?mode=signup',
    ],
  );
  assertNoAffirmativeInstallIgris(read(firstActionPath), firstActionPath);

  validateGuide(
    sdkPath,
    ['igris-sdk', 'from igris import IgrisDurableClient', 'IgrisDurableClient'],
    ['pip install igris-inertial', 'from igris import IgrisClient'],
  );
  assertNoAffirmativeInstallIgris(read(sdkPath), sdkPath);

  validateGuide(
    clientPath,
    [
      'IgrisDurableClient.from_env',
      'IGRIS_API_URL',
      'IGRIS_API_KEY',
      canonicalApi,
      'Authorization: Bearer',
    ],
    sharedForbidden,
  );
  assertNoAffirmativeInstallIgris(read(clientPath), clientPath);

  if (failures.length) {
    console.error('External Alpha durable onboarding validation failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('External Alpha durable onboarding validation passed.');
}

main();
