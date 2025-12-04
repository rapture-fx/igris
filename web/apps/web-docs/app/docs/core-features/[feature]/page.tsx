import { DocsLayout } from '@/components/layout/DocsLayout';
import { MDXContent } from '@/components/MDXContent';
import { notFound } from 'next/navigation';

interface PageProps {
  params: {
    feature: string;
  };
}

// Map feature slugs to their corresponding MDX files
const featureToFile: Record<string, string> = {
  'escape-vector': 'escape-vector',
  'gold-code': 'gold-code',
  'hotfix-blob': 'hotfix-blob',
  'speculative': 'speculative',
  'council-mode': 'council-mode',
  'cognitive-advisor': 'cognitive-advisor',
};

export async function generateStaticParams() {
  return Object.keys(featureToFile).map((feature) => ({
    feature,
  }));
}

export default async function CoreFeaturePage({ params }: PageProps) {
  const fileName = featureToFile[params.feature];

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
