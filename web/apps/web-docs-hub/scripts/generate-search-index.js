const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '../content/docs');
const outputFile = path.join(__dirname, '../lib/search-index.json');
const staticSearchFile = path.join(__dirname, '../public/search-static.json');
const generatedApiFile = path.join(__dirname, '../lib/generated/api-reference.json');
const generatedSdkFile = path.join(__dirname, '../lib/generated/sdk-support.json');
const metaFile = path.join(__dirname, '../content/docs/meta.json');

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildBreadcrumbMap() {
  if (!fs.existsSync(metaFile)) return {};

  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
  const breadcrumbs = {};
  let currentSection = '';

  for (const item of meta.pages || []) {
    if (typeof item !== 'string') continue;

    const separatorMatch = item.match(/^---(.+)---$/);
    if (separatorMatch) {
      currentSection = separatorMatch[1].trim();
      continue;
    }

    breadcrumbs[item] = currentSection ? [currentSection] : [];
  }

  return breadcrumbs;
}

async function writeStaticSearchDatabase(index) {
  const { createSearchAPI } = await import('fumadocs-core/search/server');
  const searchApi = createSearchAPI('simple', {
    indexes: index.map((entry) => ({
      title: entry.title,
      description: entry.description || '',
      breadcrumbs: entry.breadcrumbs || [],
      content: entry.content || entry.keywords || entry.title,
      url: entry.path,
      keywords: entry.keywords || '',
    })),
  });

  const exported = await searchApi.export();
  fs.writeFileSync(staticSearchFile, JSON.stringify(exported));
}

async function extractSearchIndex() {
  const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.mdx'));
  const index = [];
  const breadcrumbMap = buildBreadcrumbMap();

  const slugToTitle = {
    'index.mdx': 'Igris',
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
    const pageKey = subdir ? `${subdir}/${slug}` : slug;
    const content = fs.readFileSync(filePath, 'utf-8');
    const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---\n*/, '');
    const sanitizedContent = contentWithoutFrontmatter
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
      : `/docs/${slug === 'index' ? '' : slug}`;

    index.push({
      title,
      path: docPath,
      description: firstPara,
      content: `${headings} ${firstPara}`.trim(),
      breadcrumbs: breadcrumbMap[pageKey] || [],
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
      {
        title: 'API Introduction',
        path: '/docs/api-reference/introduction',
        description: 'Overview of the customer API contract.',
        content: 'API introduction base URL surfaces overview contract',
        breadcrumbs: ['API Reference'],
        keywords: 'api introduction base url surfaces overview contract'.toLowerCase(),
      },
      {
        title: 'API Authentication',
        path: '/docs/api-reference/authentication',
        description: 'Authentication models for cloud and local API use.',
        content: 'API authentication bearer api key session cookie runtime auth',
        breadcrumbs: ['API Reference'],
        keywords: 'api authentication bearer api key session cookie runtime auth'.toLowerCase(),
      },
      {
        title: 'API Errors',
        path: '/docs/api-reference/errors',
        description: 'Error handling and common response codes.',
        content: 'API errors error codes invalid request unauthorized internal error',
        breadcrumbs: ['API Reference'],
        keywords: 'api errors error codes invalid request unauthorized internal error'.toLowerCase(),
      },
      {
        title: 'API Rate Limits',
        path: '/docs/api-reference/rate-limits',
        description: 'Rate limit behavior and retry expectations.',
        content: 'API rate limits retry-after 429 throttle',
        breadcrumbs: ['API Reference'],
        keywords: 'api rate limits retry-after 429 throttle'.toLowerCase(),
      }
    );
    for (const section of apiReference.sections || []) {
      const sectionSlug = slugify(section.title);
      for (const endpoint of section.endpoints || []) {
        const endpointSlug = slugify(`${endpoint.method.toLowerCase()}-${endpoint.path.replace(/:/g, '').replace(/\//g, '-')}`);
        index.push({
          title: `${endpoint.method} ${endpoint.path}`,
          path: `/docs/api-reference/${sectionSlug}/${endpointSlug}`,
          description: endpoint.description,
          content: `${endpoint.method} ${endpoint.path} ${endpoint.description}`.trim(),
          breadcrumbs: ['API Reference', section.title],
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
        description: row.notes,
        content: `${row.language} ${row.status} ${row.notes}`.trim(),
        breadcrumbs: breadcrumbMap.sdk || ['Getting Started'],
        keywords: `${row.language} ${row.status} ${row.package} ${row.install} ${row.notes}`.toLowerCase().slice(0, 500),
      });
    }
  }

  fs.writeFileSync(outputFile, JSON.stringify(index, null, 2));
  await writeStaticSearchDatabase(index);
  console.log(`Search index generated: ${index.length} entries → ${outputFile}`);
  console.log(`Static search database generated → ${staticSearchFile}`);
}

extractSearchIndex().catch((error) => {
  console.error(error);
  process.exit(1);
});
