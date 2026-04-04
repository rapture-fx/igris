import { DocsLayout } from '@/components/layout/DocsLayout';
import { MDXContent } from '@/components/MDXContent';
import { JsonLd } from '@/components/JsonLd';
import { DocFooter } from '@/components/layout/DocFooter';
import { FeedbackWidget } from '@/components/layout/FeedbackWidget';
import { ApiReferenceRightRail } from '@/components/docs/ApiReferencePage';
import { McpPageRightRail, McpReferenceRightRail } from '@/components/docs/McpReferencePage';
import { notFound } from 'next/navigation';
import type { ComponentType } from 'react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const jsonLdBySlug: Record<string, Record<string, unknown>> = {
  'execution-model': {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'Execution Model — Bounded AI Execution with Verifiable Traces',
    description: 'How Igris governs AI execution through envelopes, resource limits, signed violation logs, and deterministic paths. Covers cloud and local execution with cryptographic proof.',
    url: 'https://docs.igrisinertial.com/docs/execution-model/',
    author: { '@type': 'Organization', name: 'Igris Inertial' },
    publisher: { '@type': 'Organization', name: 'Igris Inertial', url: 'https://igrisinertial.com' },
    about: ['Bounded execution', 'Verifiable traces', 'Execution envelopes', 'Deterministic behavior'],
    isPartOf: { '@type': 'WebSite', name: 'Igris Documentation', url: 'https://docs.igrisinertial.com' },
  },
  'quickstart': {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Get Started with Igris Runtime',
    description: 'Install the 16MB Runtime binary, configure your model providers, and execute your first bounded task with verifiable traces.',
    url: 'https://docs.igrisinertial.com/docs/quickstart/',
    estimatedCost: { '@type': 'MonetaryAmount', currency: 'USD', value: '0' },
    step: [
      { '@type': 'HowToStep', name: 'Install Runtime', text: 'Download the 16MB binary for your platform (Linux, macOS, Windows, ARM).' },
      { '@type': 'HowToStep', name: 'Configure Providers', text: 'Set up your model providers — local GGUF models or cloud APIs (OpenAI, Anthropic, etc.).' },
      { '@type': 'HowToStep', name: 'Execute Your First Task', text: 'Run a bounded execution task with resource limits and receive a signed execution receipt.' },
    ],
    author: { '@type': 'Organization', name: 'Igris Inertial' },
  },
  'ros2-integration': {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'ROS 2 Integration — Governed AI Execution for Robotics',
    description: 'Run Igris Runtime on ROS 2 Humble and Iron systems. Topics, services, and behavior trees for autonomous robot execution with bounded safety limits.',
    url: 'https://docs.igrisinertial.com/docs/ros2-integration/',
    author: { '@type': 'Organization', name: 'Igris Inertial' },
    publisher: { '@type': 'Organization', name: 'Igris Inertial', url: 'https://igrisinertial.com' },
    about: ['ROS 2 integration', 'Autonomous systems', 'Robotics execution', 'Fleet management'],
    isPartOf: { '@type': 'WebSite', name: 'Igris Documentation', url: 'https://docs.igrisinertial.com' },
  },
  'safety': {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'Safety & Containment — Sandboxed AI Execution',
    description: 'OS-level cgroup containment, sandboxed execution, and hard limits on runtime, memory, and network access for governed AI systems.',
    url: 'https://docs.igrisinertial.com/docs/safety/',
    author: { '@type': 'Organization', name: 'Igris Inertial' },
    publisher: { '@type': 'Organization', name: 'Igris Inertial', url: 'https://igrisinertial.com' },
    about: ['Sandboxed execution', 'Containment', 'Safety limits', 'Bounded execution'],
    isPartOf: { '@type': 'WebSite', name: 'Igris Documentation', url: 'https://docs.igrisinertial.com' },
  },
  'fleet-management': {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: 'Fleet Management — Device Registration, OTA Updates, and Config Push',
    description: 'Manage Runtime devices across your fleet. Device registration with Ed25519 signatures, OTA model updates, configuration push, and health monitoring.',
    url: 'https://docs.igrisinertial.com/docs/fleet-management/',
    author: { '@type': 'Organization', name: 'Igris Inertial' },
    publisher: { '@type': 'Organization', name: 'Igris Inertial', url: 'https://igrisinertial.com' },
    about: ['Fleet management', 'OTA updates', 'Device registration', 'Health monitoring'],
    isPartOf: { '@type': 'WebSite', name: 'Igris Documentation', url: 'https://docs.igrisinertial.com' },
  },
};

const docModules = {
  architecture: () => import('@/docs/architecture.mdx'),
  governance: () => import('@/docs/governance.mdx'),
  sdk: () => import('@/docs/sdk.mdx'),
  deployment: () => import('@/docs/deployment.mdx'),
  quickstart: () => import('@/docs/quickstart.mdx'),
  'execution-model': () => import('@/docs/execution-model.mdx'),
  'execution-flow': () => import('@/docs/execution-flow.mdx'),
  safety: () => import('@/docs/safety.mdx'),
  agents: () => import('@/docs/agents.mdx'),
  tools: () => import('@/docs/tools.mdx'),
  memory: () => import('@/docs/memory.mdx'),
  robotics: () => import('@/docs/robotics.mdx'),
  'cloud-coordination': () => import('@/docs/cloud-coordination.mdx'),
  audit: () => import('@/docs/audit.mdx'),
  'execution-receipts': () => import('@/docs/execution-receipts.mdx'),
  'capability-model': () => import('@/docs/capability-model.mdx'),
  'agent-lifecycle': () => import('@/docs/agent-lifecycle.mdx'),
  'behavior-trees': () => import('@/docs/behavior-trees.mdx'),
  'durable-tasks': () => import('@/docs/durable-tasks.mdx'),
  'context-engineering': () => import('@/docs/context-engineering.mdx'),
  'fleet-management': () => import('@/docs/fleet-management.mdx'),
  'first-cloud-integration': () => import('@/docs/first-cloud-integration.mdx'),
  'deploy-local-runtime': () => import('@/docs/deploy-local-runtime.mdx'),
  'hybrid-deployment-workflow': () => import('@/docs/hybrid-deployment-workflow.mdx'),
  'receipts-audit-workflow': () => import('@/docs/receipts-audit-workflow.mdx'),
  'fleet-rollout-workflow': () => import('@/docs/fleet-rollout-workflow.mdx'),
  'ros2-integration': () => import('@/docs/ros2-integration.mdx'),
  'key-management': () => import('@/docs/key-management.mdx'),
  'sdk-integration-patterns': () => import('@/docs/sdk-integration-patterns.mdx'),
  'documentation-roadmap': () => import('@/docs/documentation-roadmap.mdx'),
  policy: () => import('@/docs/policy.mdx'),
  'api-reference': () => import('@/docs/api-reference.mdx'),
  changelog: () => import('@/docs/changelog.mdx'),
  articles: () => import('@/docs/articles/index.mdx'),
  'pricing-tiers': () => import('@/docs/pricing-tiers.mdx'),
  multimodal: () => import('@/docs/multimodal.mdx'),
  mcp: () => import('@/docs/mcp.mdx'),
  'mcp-server': () => import('@/docs/mcp-server.mdx'),
  'mcp-swarm': () => import('@/docs/mcp-swarm.mdx'),
  'mcp-integration-patterns': () => import('@/docs/mcp-integration-patterns.mdx'),
  history: () => import('@/docs/history.mdx'),
  'cognitive-advisor': () => import('@/docs/cognitive-advisor.mdx'),
  swarm: () => import('@/docs/swarm.mdx'),
  'trial-billing': () => import('@/docs/trial-billing.mdx'),
  console: () => import('@/docs/console.mdx'),
  troubleshooting: () => import('@/docs/troubleshooting.mdx'),
  'speculative-execution': () => import('@/docs/speculative-execution.mdx'),
  'approval-workflows': () => import('@/docs/approval-workflows.mdx'),
  'slo-enforcer': () => import('@/docs/slo-enforcer.mdx'),
  'multi-tenancy': () => import('@/docs/multi-tenancy.mdx'),
  escapevector: () => import('@/docs/escapevector.mdx'),
  'circuit-breaker': () => import('@/docs/circuit-breaker.mdx'),
  'provider-health': () => import('@/docs/provider-health.mdx'),
  'shadow-mode': () => import('@/docs/shadow-mode.mdx'),
  'tamper-evident-logs': () => import('@/docs/tamper-evident-logs.mdx'),
  'model-aggregation': () => import('@/docs/model-aggregation.mdx'),
  'local-llm-fallback': () => import('@/docs/local-llm-fallback.mdx'),
  'data-privacy': () => import('@/docs/data-privacy.mdx'),
  'error-codes': () => import('@/docs/error-codes.mdx'),
  'rate-limiting': () => import('@/docs/rate-limiting.mdx'),
  'security': () => import('@/docs/security.mdx'),
  'sla': () => import('@/docs/sla.mdx'),
  'upgrade-migration': () => import('@/docs/upgrade-migration.mdx'),
  'webhooks': () => import('@/docs/webhooks.mdx'),
} satisfies Record<string, () => Promise<{ default: ComponentType }>>;

export async function generateStaticParams() {
  return Object.keys(docModules).map((slug) => ({ slug }));
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params;
  const loadDoc = docModules[slug as keyof typeof docModules];
  const fullWidth = slug === 'api-reference';
  const isApiReference = slug === 'api-reference';
  const mcpSlugs = new Set(['mcp', 'mcp-server', 'mcp-swarm', 'mcp-integration-patterns']);
  const isMcpSection = mcpSlugs.has(slug);

  if (!loadDoc) notFound();

  let MDXComponent;
  try {
    MDXComponent = (await loadDoc()).default;
  } catch {
    notFound();
  }

  const jsonLdData = jsonLdBySlug[slug];

  return (
    <>
      {jsonLdData && <JsonLd data={jsonLdData} />}
      <DocsLayout
        hideTableOfContents={isApiReference || isMcpSection}
        rightRail={
          isApiReference
            ? <ApiReferenceRightRail />
            : isMcpSection
              ? (slug === 'mcp' ? <McpReferenceRightRail /> : <McpPageRightRail slug={slug} />)
              : undefined
        }
        maxWidthClass={isApiReference ? 'max-w-[96rem]' : 'max-w-[90rem]'}
      >
        <MDXContent fullWidth={fullWidth}>
          <MDXComponent />
        </MDXContent>
        <FeedbackWidget />
        <DocFooter slug={slug} />
      </DocsLayout>
    </>
  );
}
