import type { RootProviderProps } from 'fumadocs-ui/provider/base';
import { DocsSearchDialog } from '@/components/docs-search-dialog';

function createDocsSearch(): NonNullable<RootProviderProps['search']> {
  const links: [string, string][] = [
    ['Quick Start', '/docs/quickstart'],
    ['API Reference', '/docs/api-reference'],
    ['SDKs', '/docs/sdk'],
    ['Context Engineering', '/docs/context-engineering'],
  ];

  return {
    enabled: true,
    SearchDialog: DocsSearchDialog,
    links,
  };
}

export const docsSearch = createDocsSearch();
