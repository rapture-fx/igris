const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '../docs');
const outputFile = path.join(__dirname, '../lib/search-index.json');
const generatedApiFile = path.join(__dirname, '../lib/generated/api-reference.json');
const generatedSdkFile = path.join(__dirname, '../lib/generated/sdk-support.json');

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractSearchIndex() {
  const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.mdx'));
  const index = [];

  const slugToTitle = {
    'overview.mdx': 'Overview',
    'architecture.mdx': 'Architecture',
    'quickstart.mdx': 'Quick Start',
    'execution-model.mdx': 'Execution Model',
    'execution-flow.mdx': 'Execution Flow',
    'safety.mdx': 'Safety & Containment',
    'capability-model.mdx': 'Capabilities & Limits',
    'execution-receipts.mdx': 'Execution Receipts',
    'agent-lifecycle.mdx': 'Agent Lifecycle',
    'agents.mdx': 'Agents',
    'behavior-trees.mdx': 'Behavior Trees',
    'tools.mdx': 'Tools',
    'memory.mdx': 'Memory',
    'robotics.mdx': 'Robotics',
    'ros2-integration.mdx': 'ROS2 Integration',
    'cloud-coordination.mdx': 'Cloud Coordination',
    'fleet-management.mdx': 'Fleet Management',
    'policy.mdx': 'Policy',
    'audit.mdx': 'Audit',
    'sdk.mdx': 'SDK',
    'deployment.mdx': 'Deployment',
    'key-management.mdx': 'Key Management',
    'pricing-tiers.mdx': 'Pricing',
    'api-reference.mdx': 'API Reference',
    'changelog.mdx': 'Changelog',
    'multimodal.mdx': 'Multimodal',
    'mcp.mdx': 'MCP Integration',
    'history.mdx': 'History',
    'cognitive-advisor.mdx': 'Routing Advisor',
    'swarm.mdx': 'Swarm',
    'trial-billing.mdx': 'Trial & Billing',
    'console.mdx': 'Console',
    'troubleshooting.mdx': 'Troubleshooting',
    'speculative-execution.mdx': 'Speculative Execution',
    'approval-workflows.mdx': 'Approval Workflows',
    'slo-enforcer.mdx': 'SLO Enforcer',
    'multi-tenancy.mdx': 'Multi-Tenancy',
    'escapevector.mdx': 'Routing Engine',
    'circuit-breaker.mdx': 'Circuit Breaker',
    'provider-health.mdx': 'Provider Health',
    'shadow-mode.mdx': 'Shadow Mode',
    'tamper-evident-logs.mdx': 'Tamper-Evident Logs',
    'model-aggregation.mdx': 'Model Aggregation',
    'local-llm-fallback.mdx': 'Local LLM Fallback',
    'data-privacy.mdx': 'Data Privacy',
    'error-codes.mdx': 'Error Codes',
    'rate-limiting.mdx': 'Rate Limiting',
    'security.mdx': 'Security',
    'sla.mdx': 'SLA',
    'upgrade-migration.mdx': 'Upgrade & Migration',
    'webhooks.mdx': 'Webhooks',
  };

  function processFile(file, subdir) {
    const filePath = subdir ? path.join(docsDir, subdir, file) : path.join(docsDir, file);
    const slug = file.replace('.mdx', '');
    const content = fs.readFileSync(filePath, 'utf-8');
    const sanitizedContent = content
      .replace(/^import\s.+;$/gm, '')
      .replace(/^export\s.+;$/gm, '')
      .replace(/<[^>\n]+>/g, ' ')
      .replace(/\{[^}\n]+\}/g, ' ');
    const title = slugToTitle[file] || slug
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    // Extract headings (lines starting with #)
    const headings = sanitizedContent
      .split('\n')
      .filter(line => /^#{1,3}\s/.test(line))
      .map(line => line.replace(/^#+\s/, '').trim())
      .join(' ');

    // Extract code block languages
    const codeLangs = [...sanitizedContent.matchAll(/```(\w+)/g)]
      .map(m => m[1])
      .join(' ');

    // Get first paragraph for description
    const paragraphs = sanitizedContent.split('\n\n');
    const firstPara = paragraphs
      .find(p => !p.startsWith('# ') && p.trim().length > 20)
      ?.replace(/^#\s.+\n\n?/, '')
      ?.replace(/[#*`_~\[\]()]/g, '')
      ?.trim()
      ?.slice(0, 200) || '';

    const keywords = `${headings} ${codeLangs} ${firstPara} ${slug}`.toLowerCase();
    const docPath = subdir
      ? `/docs/${subdir}/${slug}`
      : `/docs/${slug === 'overview' ? '' : slug}`;

    index.push({
      title,
      path: docPath,
      keywords: keywords.slice(0, 500),
    });
  }

  files.forEach(file => processFile(file, null));

  // Index articles subdirectory
  const articleTitles = {
    'index.mdx': null, // skipped — served at /docs/articles already in static index
    'edge-deployment-guide.mdx': 'Deploying Igris on Edge Devices',
    'safe-agents-capability-gates.mdx': 'Building Safe Agents with Capability Gates',
    'thompson-sampling-routing.mdx': 'How Adaptive Routing Works',
  };

  const articlesDir = path.join(docsDir, 'articles');
  if (fs.existsSync(articlesDir)) {
    const articleFiles = fs.readdirSync(articlesDir).filter(f => f.endsWith('.mdx') && f !== 'index.mdx');
    articleFiles.forEach(file => {
      const slug = file.replace('.mdx', '');
      const content = fs.readFileSync(path.join(articlesDir, file), 'utf-8');
      const title = articleTitles[file] || slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const headings = content.split('\n').filter(line => /^#{1,3}\s/.test(line)).map(line => line.replace(/^#+\s/, '').trim()).join(' ');
      const keywords = `${headings} ${slug}`.toLowerCase();
      index.push({ title, path: `/docs/articles/${slug}`, keywords: keywords.slice(0, 500) });
    });
  }

  if (fs.existsSync(generatedApiFile)) {
    const apiReference = JSON.parse(fs.readFileSync(generatedApiFile, 'utf-8'));
    index.push(
      { title: 'API Introduction', path: '/docs/api-reference/introduction', keywords: 'api introduction base url surfaces overview contract'.toLowerCase() },
      { title: 'API Authentication', path: '/docs/api-reference/authentication', keywords: 'api authentication bearer api key session cookie runtime auth'.toLowerCase() },
      { title: 'API Errors', path: '/docs/api-reference/errors', keywords: 'api errors error codes invalid request unauthorized internal error'.toLowerCase() },
      { title: 'API Rate Limits', path: '/docs/api-reference/rate-limits', keywords: 'api rate limits retry-after 429 throttle'.toLowerCase() }
    );
    for (const section of apiReference.sections || []) {
      const sectionSlug = slugify(section.title);
      for (const endpoint of section.endpoints || []) {
        const endpointSlug = slugify(`${endpoint.method.toLowerCase()}-${endpoint.path.replace(/:/g, '').replace(/\//g, '-')}`);
        index.push({
          title: `${endpoint.method} ${endpoint.path}`,
          path: `/docs/api-reference/${sectionSlug}/${endpointSlug}`,
          keywords: `${section.title} ${endpoint.method} ${endpoint.path} ${endpoint.description} ${endpoint.auth} ${endpoint.surface}`.toLowerCase().slice(0, 500),
        });
      }
    }
  }

  if (fs.existsSync(generatedSdkFile)) {
    const sdkSupport = JSON.parse(fs.readFileSync(generatedSdkFile, 'utf-8'));
    for (const row of sdkSupport.rows || []) {
      index.push({
        title: `${row.language} SDK`,
        path: '/docs/sdk',
        keywords: `${row.language} ${row.status} ${row.package} ${row.install} ${row.notes}`.toLowerCase().slice(0, 500),
      });
    }
  }

  fs.writeFileSync(outputFile, JSON.stringify(index, null, 2));
  console.log(`Search index generated: ${index.length} entries → ${outputFile}`);
}

extractSearchIndex();
