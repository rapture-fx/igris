import { DocsLayout } from '@/components/layout/DocsLayout';
import { MDXContent } from '@/components/MDXContent';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{
    page: string;
  }>;
}

// Map page slugs to their corresponding MDX files
const pageToFile: Record<string, string> = {
  introduction: 'introduction',
  quickstart: 'quickstart',
  'core-concepts': 'core-concepts',
  'node-types': 'node-types',
  'llm-integration': 'llm-integration',
  visualization: 'visualization',
  'runtime-execution': 'runtime-execution',
};

export async function generateStaticParams() {
  return Object.keys(pageToFile).map((page) => ({
    page,
  }));
}

export default async function BehaviorTreePage({ params }: PageProps) {
  const { page } = await params;
  const fileName = pageToFile[page];

  if (!fileName) {
    notFound();
  }

  let MDXComponent;
  try {
    MDXComponent = (await import(`@/docs/behavior-trees/${fileName}.mdx`)).default;
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
