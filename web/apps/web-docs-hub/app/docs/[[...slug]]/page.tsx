import { isDocPageVisible, source } from '@/lib/source';
import { getMDXComponents } from '@/components/mdx';
import { DocsBody, DocsPage } from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DocsPageActions } from '@/components/docs-page-actions';
import { getDocGithubUrl, getDocMarkdownUrl } from '@/lib/docs-source';

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

export async function generateStaticParams() {
  return source.generateParams().filter((param) => isDocPageVisible(param.slug));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page || !isDocPageVisible(slug)) return {};
  return {
    title: page.data.title,
    description: page.data.description,
  };
}

export default async function Page({ params }: PageProps) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page || !isDocPageVisible(slug)) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage full={page.data.full} toc={page.data.toc}>
      <DocsPageActions
        githubUrl={getDocGithubUrl(slug)}
        markdownUrl={getDocMarkdownUrl(slug)}
        pageTitle={page.data.title}
      />
      <DocsBody className="docs-prose prose-sm md:prose-base">
        <MDX components={getMDXComponents(source, page)} />
      </DocsBody>
    </DocsPage>
  );
}
