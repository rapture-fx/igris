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
  'quick-start': 'quick-start',
  authentication: 'authentication',
  'errors-retries': 'errors-retries',
  'rate-limits-budgets': 'rate-limits-budgets',
  sdks: 'sdks',
};

export async function generateStaticParams() {
  return Object.keys(pageToFile).map((page) => ({
    page,
  }));
}

export default async function ApiReferencePage({ params }: PageProps) {
  const { page } = await params;
  const fileName = pageToFile[page];

  if (!fileName) {
    notFound();
  }

  let MDXComponent;
  try {
    MDXComponent = (await import(`@/docs/api-reference/${fileName}.mdx`)).default;
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
