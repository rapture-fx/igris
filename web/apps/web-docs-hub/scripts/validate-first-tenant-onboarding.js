const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../../..', '..');
const docsDir = path.join(__dirname, '..', 'content', 'docs');
const guidePath = path.join(docsDir, 'first-tenant-action.mdx');
const installerPath = path.join(repoRoot, 'web/apps/web-landing/public/install');
const releaseWorkflowPath = path.join(repoRoot, '.github/workflows/igris-runtime-release.yml');
const cliSourcePath = path.join(repoRoot, 'igris-runtime/crates/igris-server/src/cli/mod.rs');
const cliDispatchPath = path.join(repoRoot, 'igris-runtime/crates/igris-server/src/main.rs');
const railsSettingsPath = path.join(repoRoot, 'web/apps/rails-console/app/views/settings/index.html.erb');
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

function runCli(bin, args) {
  return spawnSync(bin, args, { encoding: 'utf8' });
}

function validateGuide() {
  const guide = read(guidePath);
  const required = [
    'curl -fsSL https://igrisinertial.com/install | bash',
    'igris doctor',
    'https://console.igrisinertial.com/auth?mode=signup',
    'Settings -> Agent / app API keys -> Create API key',
    `export IGRIS_API_URL="${canonicalApi}"`,
    'igris auth login',
    'igris templates install codex',
    'igris agents register',
    'igris packs install starter',
    'igris actions run demo.echo',
    '--agent-name codex_agent',
    'RUN_ID="$(awk',
    'TASK_ID="$(awk',
    'igris runs inspect "$RUN_ID"',
    'igris tasks verify "$TASK_ID"',
    'igris receipts verify "$EXECUTION_ID"',
    '$IGRIS_API_URL/v1/agent-memory?task_id=$TASK_ID',
    '$IGRIS_API_URL/v1/execution/intelligence?range=last_24h',
  ];
  for (const needle of required) {
    assertIncludes(guide, needle, guidePath);
  }
  if (guide.includes('./scripts/igris_doctor.sh')) {
    fail(`${guidePath}: public onboarding must use igris doctor, not repo-local scripts`);
  }
  if (guide.includes('https://api.igrisinertial.com')) {
    fail(`${guidePath}: must use canonical API host ${canonicalApi}`);
  }
}

function validateCliSource() {
  const cli = read(cliSourcePath);
  const dispatch = read(cliDispatchPath);
  const sourceRequired = [
    'pub const DEFAULT_API_BASE: &str = "https://overture.igrisinertial.com";',
    'pub enum ActionsSub',
    'pub enum AgentsSub',
    'pub enum TemplatesSub',
    'pub enum PacksSub',
    'pub enum RunsSub',
    'pub enum ReceiptsSub',
    'agent_name: Option<String>',
    'agent_id: Option<String>',
  ];
  for (const needle of sourceRequired) {
    assertIncludes(cli, needle, cliSourcePath);
  }
  assertIncludes(dispatch, 'cli::actions_run::run_action(', cliDispatchPath);
  assertIncludes(dispatch, 'agent_name.as_deref()', cliDispatchPath);
}

function validateInstallerContract() {
  const installer = read(installerPath);
  const workflow = read(releaseWorkflowPath);
  assertIncludes(workflow, "tags:\n      - 'runtime-v*'", releaseWorkflowPath);
  assertIncludes(workflow, 'igris-runtime-${{ matrix.name }}.tar.gz', releaseWorkflowPath);
  assertIncludes(installer, 'IGRIS_VERSION="${IGRIS_VERSION:-runtime-v1.6.0}"', installerPath);
  assertIncludes(installer, 'igris-runtime-${platform}.tar.gz', installerPath);
  assertIncludes(installer, 'Darwin) os="macos"', installerPath);
  assertIncludes(installer, 'x86_64|amd64) arch="x64"', installerPath);
  if (installer.includes('/igris-${platform}.tar.gz')) {
    fail(`${installerPath}: installer still expects obsolete igris-\${platform}.tar.gz assets`);
  }
}

function validateCanonicalHost() {
  const cli = read(cliSourcePath);
  const rails = read(railsSettingsPath);
  assertIncludes(cli, canonicalApi, cliSourcePath);
  assertIncludes(rails, canonicalApi, railsSettingsPath);
  if (cli.includes('https://api.igrisinertial.com')) {
    fail(`${cliSourcePath}: CLI default must not use non-canonical API host`);
  }
}

function validateCliBinaryIfAvailable() {
  const bin = process.env.IGRIS_CLI_BIN ||
    path.join(repoRoot, 'igris-runtime/target/debug/igris-runtime');
  if (!fs.existsSync(bin)) {
    console.warn(`[first-tenant-onboarding] CLI binary not found at ${bin}; build it before release validation.`);
    return;
  }

  const commands = [
    ['doctor', '--help'],
    ['demo', '--help'],
    ['templates', '--help'],
    ['templates', 'list', '--help'],
    ['templates', 'install', '--help'],
    ['templates', 'verify', '--help'],
    ['auth', 'login', '--help'],
    ['agents', 'register', '--help'],
    ['packs', 'list', '--help'],
    ['packs', 'install', '--help'],
    ['actions', 'run', '--help'],
    ['runs', 'inspect', '--help'],
    ['tasks', 'verify', '--help'],
    ['receipts', 'verify', '--help'],
    ['mcp', 'serve', '--help'],
  ];

  for (const args of commands) {
    const result = runCli(bin, args);
    if (result.status !== 0) {
      fail(`${bin} ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
    }
  }

  const actionsHelp = runCli(bin, ['actions', 'run', '--help']);
  const helpText = `${actionsHelp.stdout}\n${actionsHelp.stderr}`;
  if (!helpText.includes('--agent-name') || !helpText.includes('--agent-id')) {
    fail(`${bin} actions run --help must document --agent-name and --agent-id`);
  }
}

validateGuide();
validateCliSource();
validateInstallerContract();
validateCanonicalHost();
validateCliBinaryIfAvailable();

if (failures.length > 0) {
  console.error('First tenant onboarding validation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('First tenant onboarding validation passed.');
