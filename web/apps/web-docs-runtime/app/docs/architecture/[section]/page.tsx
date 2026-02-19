import { DocsLayout } from '@/components/layout/DocsLayout';
import { MDXContent } from '@/components/MDXContent';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{
    section: string;
  }>;
}

const sectionToFile: Record<string, string> = {
  containment: 'containment',
};

export async function generateStaticParams() {
  return Object.keys(sectionToFile).map((section) => ({
    section,
  }));
}

export default async function ArchitectureSectionPage({ params }: PageProps) {
  const { section } = await params;
  const fileName = sectionToFile[section];

  if (!fileName) {
    notFound();
  }

  let MDXComponent;
  try {
    MDXComponent = (await import(`@/docs/architecture/${fileName}.mdx`)).default;
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
