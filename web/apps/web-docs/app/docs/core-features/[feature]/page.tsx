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
  'adaptive-optimization': 'adaptive-optimization',
  'provider-health': 'provider-health',
  'escape-vector': 'escape-vector',
  'gold-code': 'gold-code',
  'hotfix-blob': 'hotfix-blob',
  'speculative': 'speculative',
  'council-mode': 'council-mode',
  'cognitive-advisor': 'cognitive-advisor',
  'shadow-mode': 'shadow-mode',
  'slo-enforcer': 'slo-enforcer',
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
