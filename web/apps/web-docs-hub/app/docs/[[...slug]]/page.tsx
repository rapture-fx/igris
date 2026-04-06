import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { DocsBody, DocsPage } from 'fumadocs-ui/page';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { fumadocsMdxComponents } from '@/components/fumadocs-mdx-components';
import { docsSearch } from '@/lib/docs-search';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) return {};
  return {
    title: page.data.title,
    description: page.data.description,
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <RootProvider
      theme={{ enabled: false }}
      search={docsSearch}
    >
      <DocsLayout
        tree={source.pageTree}
        nav={{ title: 'Igris Docs' }}
        sidebar={{ defaultOpenLevel: 1 }}
      >
        <DocsPage toc={page.data.toc}>
          <DocsBody>
            <h1>{page.data.title}</h1>
            <MDX components={fumadocsMdxComponents} />
          </DocsBody>
        </DocsPage>
      </DocsLayout>
    </RootProvider>
  );
}
