import { DocsLayout } from '@/components/layout/DocsLayout';
import { MDXContent } from '@/components/MDXContent';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const articleSlugs: Record<string, string> = {
  'first-article': 'articles/first-article',
};

export async function generateStaticParams() {
  return Object.keys(articleSlugs).map((slug) => ({ slug }));
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const fileName = articleSlugs[slug];

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
