import { DocsLayout } from '@/components/layout/DocsLayout';
import { MDXContent } from '@/components/MDXContent';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{
    feature: string;
  }>;
}

// Map feature slugs to their corresponding MDX files
const featureToFile: Record<string, string> = {
  'local-fallback': 'local-fallback',
  'reflection': 'reflection',
  'planning': 'planning',
  'tools': 'tools',
  'swarm': 'swarm',
  'mcp-swarm': 'mcp-swarm',
  'qlora': 'qlora',
};

export async function generateStaticParams() {
  return Object.keys(featureToFile).map((feature) => ({
    feature,
  }));
}

export default async function CoreFeaturePage({ params }: PageProps) {
  const { feature } = await params;
  const fileName = featureToFile[feature];

  if (!fileName) {
    notFound();
  }

  let MDXComponent;
  try {
    MDXComponent = (await import(`@/docs/core-features/${fileName}.mdx`)).default;
  } catch (error) {
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
