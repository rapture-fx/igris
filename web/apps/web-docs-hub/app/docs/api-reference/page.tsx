import type { Metadata } from 'next';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { DocsBody, DocsPage } from 'fumadocs-ui/page';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { ApiDocsSidebar } from '@/components/docs/ApiDocsSidebar';
import { ApiReferencePage, ApiReferenceRightRail } from '@/components/docs/ApiReferencePage';
import { docsSearch } from '@/lib/docs-search';
import { source } from '@/lib/source';

export const metadata: Metadata = {
  title: 'API Reference',
  description: 'Customer-facing API guides and endpoint reference for Igris.',
};

export default function ApiReferenceIndexPage() {
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
          tableOfContent={{ enabled: true, component: <ApiReferenceRightRail /> }}
        >
          <DocsBody>
            <ApiReferencePage />
          </DocsBody>
        </DocsPage>
      </DocsLayout>
    </RootProvider>
  );
}
