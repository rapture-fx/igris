import { DocsLayout } from '@/components/layout/DocsLayout';
import { MDXContent } from '@/components/MDXContent';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{
    example: string;
  }>;
}

// Map example slugs to their corresponding MDX files
const exampleToFile: Record<string, string> = {
  'simple-mission': 'simple-mission',
};

export async function generateStaticParams() {
  return Object.keys(exampleToFile).map((example) => ({
    example,
  }));
}

export default async function BehaviorTreeExamplePage({ params }: PageProps) {
  const { example } = await params;
  const fileName = exampleToFile[example];

  if (!fileName) {
    notFound();
  }

  let MDXComponent;
  try {
    MDXComponent = (await import(`@/docs/behavior-trees/examples/${fileName}.mdx`)).default;
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
