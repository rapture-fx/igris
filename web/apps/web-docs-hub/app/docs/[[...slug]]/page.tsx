import { source } from '@/lib/source';
import { getMDXComponents } from '@/components/mdx';
import { InlineTOC } from 'fumadocs-ui/components/inline-toc';
import { DocsBody, DocsPage } from 'fumadocs-ui/page';
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
    <DocsPage full={page.data.full} toc={page.data.toc}>
      <DocsBody>
        {page.data.toc.length > 0 ? (
          <InlineTOC items={page.data.toc}>On this page</InlineTOC>
        ) : null}
        <MDX components={getMDXComponents(source, page)} />
      </DocsBody>
    </DocsPage>
  );
}
