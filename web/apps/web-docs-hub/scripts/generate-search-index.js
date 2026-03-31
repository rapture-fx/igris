const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '../docs');
const outputFile = path.join(__dirname, '../lib/search-index.json');

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
    'cognitive-advisor.mdx': 'Cognitive Advisor',
    'swarm.mdx': 'Swarm',
    'trial-billing.mdx': 'Trial & Billing',
    'console.mdx': 'Console',
    'troubleshooting.mdx': 'Troubleshooting',
    'speculative-execution.mdx': 'Speculative Execution',
    'approval-workflows.mdx': 'Approval Workflows',
    'slo-enforcer.mdx': 'SLO Enforcer',
    'multi-tenancy.mdx': 'Multi-Tenancy',
    'escapevector.mdx': 'EscapeVector',
    'circuit-breaker.mdx': 'Circuit Breaker',
    'provider-health.mdx': 'Provider Health',
    'shadow-mode.mdx': 'Shadow Mode',
    'tamper-evident-logs.mdx': 'Tamper-Evident Logs',
    'model-aggregation.mdx': 'Model Aggregation',
    'local-llm-fallback.mdx': 'Local LLM Fallback',
  };

  files.forEach(file => {
    const slug = file.replace('.mdx', '');
    const content = fs.readFileSync(path.join(docsDir, file), 'utf-8');
    const title = slugToTitle[file] || slug
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    // Extract headings (lines starting with #)
    const headings = content
      .split('\n')
      .filter(line => /^#{1,3}\s/.test(line))
      .map(line => line.replace(/^#+\s/, '').trim())
      .join(' ');

    // Extract code block languages
    const codeLangs = [...content.matchAll(/```(\w+)/g)]
      .map(m => m[1])
      .join(' ');

    // Get first paragraph for description
    const paragraphs = content.split('\n\n');
    const firstPara = paragraphs
      .find(p => p.startsWith('# ') || (!p.startsWith('#') && p.trim().length > 20))
      ?.replace(/^#\s.+\n\n?/, '')
      ?.replace(/[#*`_~\[\]()]/g, '')
      ?.trim()
      ?.slice(0, 200) || '';

    const keywords = `${headings} ${codeLangs} ${firstPara} ${slug}`.toLowerCase();

    index.push({
      title,
      path: `/docs/${slug === 'overview' ? '' : slug}`,
      keywords: keywords.slice(0, 500),
    });
  });

  // Add articles entry
  index.push({
    title: 'Articles',
    path: '/docs/articles',
    keywords: 'articles engineering notes architecture deep dive blog posts',
  });

  fs.writeFileSync(outputFile, JSON.stringify(index, null, 2));
  console.log(`Search index generated: ${index.length} entries → ${outputFile}`);
}

extractSearchIndex();
