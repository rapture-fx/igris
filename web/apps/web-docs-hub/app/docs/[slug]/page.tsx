import { DocsLayout } from '@/components/layout/DocsLayout';
import { MDXContent } from '@/components/MDXContent';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const slugToFile: Record<string, string> = {
  architecture: 'architecture',
  governance: 'governance',
  sdk: 'sdk',
  deployment: 'deployment',
  quickstart: 'quickstart',
  'execution-model': 'execution-model',
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
  'fleet-management': 'fleet-management',
  'ros2-integration': 'ros2-integration',
  policy: 'policy',
  'api-reference': 'api-reference',
  changelog: 'changelog',
  articles: 'articles/index',
};

export async function generateStaticParams() {
  return Object.keys(slugToFile).map((slug) => ({ slug }));
}

export default async function DocPage({ params }: PageProps) {
  const { slug } = await params;
  const fileName = slugToFile[slug];

  if (!fileName) notFound();

  let MDXComponent;
  try {
    MDXComponent = (await import(`@/docs/${fileName}.mdx`)).default;
  } catch {
    notFound();
  }

  return (
    <DocsLayout>
      <MDXContent>
        <MDXComponent />
      </MDXContent>
    </DocsLayout>
  );
}
