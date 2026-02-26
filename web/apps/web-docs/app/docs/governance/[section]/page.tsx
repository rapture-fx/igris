import { DocsLayout } from '@/components/layout/DocsLayout';
import { MDXContent } from '@/components/MDXContent';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{
    section: string;
  }>;
}

const sectionToFile: Record<string, string> = {
  'execution-verification': 'execution-verification',
  'policy-engine': 'policy-engine',
};

export async function generateStaticParams() {
  return Object.keys(sectionToFile).map((section) => ({
    section,
  }));
}

export default async function GovernanceSectionPage({ params }: PageProps) {
  const { section } = await params;
  const fileName = sectionToFile[section];

  if (!fileName) {
    notFound();
  }

  let MDXComponent;
  try {
    MDXComponent = (await import(`@/docs/governance/${fileName}.mdx`)).default;
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
