import { notFound } from 'next/navigation';
import { DocsLayout } from '@/components/layout/DocsLayout';
import { ApiEndpointPage, ApiEndpointRightRail } from '@/components/docs/ApiEndpointPage';
import { ApiGuidePage, ApiGuideRightRail } from '@/components/docs/ApiGuidePage';
import { buildApiEndpointPageData } from '@/lib/api-reference-page-data';
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

export default async function ApiReferenceDetailPage({ params }: ApiReferenceDetailPageProps) {
  const { slug } = await params;

  if (slug.length === 1) {
    const guide = findApiGuide(slug[0]);
    if (!guide) {
      notFound();
    }

    return (
      <DocsLayout
        hideTableOfContents
        rightRail={<ApiGuideRightRail slug={guide.slug} />}
        maxWidthClass="max-w-[96rem]"
      >
        <ApiGuidePage slug={guide.slug} />
      </DocsLayout>
    );
  }

  if (slug.length === 2) {
    const match = findApiEndpoint(slug[0], slug[1]);
    if (!match) {
      notFound();
    }

    const data = buildApiEndpointPageData(match.section, match.endpoint);

    return (
      <DocsLayout
        hideTableOfContents
        rightRail={<ApiEndpointRightRail data={data} />}
        maxWidthClass="max-w-[104rem]"
      >
        <ApiEndpointPage data={data} />
      </DocsLayout>
    );
  }

  notFound();
}
