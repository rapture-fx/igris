import { DocsLayout } from '@/components/layout/DocsLayout';
import { MDXContent } from '@/components/MDXContent';
import { JsonLd } from '@/components/JsonLd';
import { DocFooter } from '@/components/layout/DocFooter';
import { FeedbackWidget } from '@/components/layout/FeedbackWidget';
import { ApiReferenceRightRail } from '@/components/docs/ApiReferencePage';
import { notFound } from 'next/navigation';

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

const slugToFile: Record<string, string> = {
  architecture: 'architecture',
  governance: 'governance',
  sdk: 'sdk',
  deployment: 'deployment',
  quickstart: 'quickstart',
  'execution-model': 'execution-model',
  'execution-flow': 'execution-flow',
  safety: 'safety',
  agents: 'agents',
  tools: 'tools',
  memory: 'memory',
  robotics: 'robotics',
  'cloud-coordination': 'cloud-coordination',
  audit: 'audit',
  'execution-receipts': 'execution-receipts',
  'capability-model': 'capability-model',
  'agent-lifecycle': 'agent-lifecycle',
  'behavior-trees': 'behavior-trees',
  'durable-tasks': 'durable-tasks',
  'fleet-management': 'fleet-management',
  'first-cloud-integration': 'first-cloud-integration',
  'deploy-local-runtime': 'deploy-local-runtime',
  'hybrid-deployment-workflow': 'hybrid-deployment-workflow',
  'receipts-audit-workflow': 'receipts-audit-workflow',
  'fleet-rollout-workflow': 'fleet-rollout-workflow',
  'ros2-integration': 'ros2-integration',
  'key-management': 'key-management',
  policy: 'policy',
  'api-reference': 'api-reference',
  changelog: 'changelog',
  articles: 'articles/index',
  'pricing-tiers': 'pricing-tiers',
  multimodal: 'multimodal',
  mcp: 'mcp',
  history: 'history',
  'cognitive-advisor': 'cognitive-advisor',
  swarm: 'swarm',
  'trial-billing': 'trial-billing',
  console: 'console',
  troubleshooting: 'troubleshooting',
  'speculative-execution': 'speculative-execution',
  'approval-workflows': 'approval-workflows',
  'slo-enforcer': 'slo-enforcer',
  'multi-tenancy': 'multi-tenancy',
  escapevector: 'escapevector',
  'circuit-breaker': 'circuit-breaker',
  'provider-health': 'provider-health',
  'shadow-mode': 'shadow-mode',
  'tamper-evident-logs': 'tamper-evident-logs',
  'model-aggregation': 'model-aggregation',
  'local-llm-fallback': 'local-llm-fallback',
  'data-privacy': 'data-privacy',
  'error-codes': 'error-codes',
  'rate-limiting': 'rate-limiting',
  'security': 'security',
  'sla': 'sla',
  'upgrade-migration': 'upgrade-migration',
  'webhooks': 'webhooks',
};

export async function generateStaticParams() {
  return Object.keys(slugToFile).map((slug) => ({ slug }));
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params;
  const fileName = slugToFile[slug];
  const fullWidth = slug === 'api-reference';
  const isApiReference = slug === 'api-reference';

  if (!fileName) notFound();

  let MDXComponent;
  try {
    MDXComponent = (await import(`@/docs/${fileName}.mdx`)).default;
  } catch {
    notFound();
  }

  const jsonLdData = slugToFile[slug] ? jsonLdBySlug[slug] : undefined;

  return (
    <>
      {jsonLdData && <JsonLd data={jsonLdData} />}
      <DocsLayout
        hideTableOfContents={isApiReference}
        rightRail={isApiReference ? <ApiReferenceRightRail /> : undefined}
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
