import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { DocsBody, DocsPage } from 'fumadocs-ui/page';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { ApiEndpointPage, ApiEndpointRightRail } from '@/components/docs/ApiEndpointPage';
import { ApiGuidePage, ApiGuideRightRail } from '@/components/docs/ApiGuidePage';
import { ApiDocsSidebar } from '@/components/docs/ApiDocsSidebar';
import { buildApiEndpointPageData } from '@/lib/api-reference-page-data';
import { docsSearch } from '@/lib/docs-search';
import { source } from '@/lib/source';
import {
  findApiEndpoint,
  findApiGuide,
  getApiEndpointStaticParams,
  getApiGuideStaticParams,
} from '@/lib/api-reference';

interface ApiReferenceDetailPageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateStaticParams() {
  return [...getApiGuideStaticParams(), ...getApiEndpointStaticParams()];
}

export async function generateMetadata({ params }: ApiReferenceDetailPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (slug.length === 1) {
    const guide = findApiGuide(slug[0]);
    if (!guide) {
      return {};
    }

    return {
      title: `${guide.title} | API Reference`,
      description: guide.summary,
    };
  }

  if (slug.length === 2) {
    const match = findApiEndpoint(slug[0], slug[1]);
    if (!match) {
      return {};
    }

    const data = buildApiEndpointPageData(match.section, match.endpoint);

    return {
      title: `${data.title} | API Reference`,
      description: data.functionality,
    };
  }

  return {};
}

export default async function ApiReferenceDetailPage({ params }: ApiReferenceDetailPageProps) {
  const { slug } = await params;

  if (slug.length === 1) {
    const guide = findApiGuide(slug[0]);
    if (!guide) {
      notFound();
    }

    return (
      <RootProvider theme={{ enabled: false }} search={docsSearch}>
        <DocsLayout
          tree={source.pageTree}
          nav={{ title: 'Igris Docs', url: '/docs' }}
          sidebar={{ component: <ApiDocsSidebar />, enabled: true }}
        >
          <DocsPage
            breadcrumb={{ enabled: false }}
            footer={{ enabled: false }}
            tableOfContent={{ enabled: true, component: <ApiGuideRightRail slug={guide.slug} /> }}
          >
            <DocsBody>
              <ApiGuidePage slug={guide.slug} />
            </DocsBody>
          </DocsPage>
        </DocsLayout>
      </RootProvider>
    );
  }

  if (slug.length === 2) {
    const match = findApiEndpoint(slug[0], slug[1]);
    if (!match) {
      notFound();
    }

    const data = buildApiEndpointPageData(match.section, match.endpoint);

    return (
      <RootProvider theme={{ enabled: false }} search={docsSearch}>
        <DocsLayout
          tree={source.pageTree}
          nav={{ title: 'Igris Docs', url: '/docs' }}
          sidebar={{ component: <ApiDocsSidebar />, enabled: true }}
        >
          <DocsPage
            full
            breadcrumb={{ enabled: false }}
            footer={{ enabled: false }}
            tableOfContent={{ enabled: true, component: <ApiEndpointRightRail data={data} /> }}
            article={{ className: 'max-w-none' }}
          >
            <DocsBody>
              <ApiEndpointPage data={data} />
            </DocsBody>
          </DocsPage>
        </DocsLayout>
      </RootProvider>
    );
  }

  notFound();
}
