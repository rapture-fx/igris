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
