import type { RootProviderProps } from 'fumadocs-ui/provider/base';

function createDocsSearch(): NonNullable<RootProviderProps['search']> {
  const links: [string, string][] = [
    ['Quick Start', '/docs/quickstart'],
    ['API Reference', '/docs/api-reference'],
    ['SDKs', '/docs/sdk'],
    ['Context Engineering', '/docs/context-engineering'],
  ];

  return {
    enabled: true,
    options: {
      type: 'static',
      api: '/search-static.json',
      links,
    },
  };
}

export const docsSearch = createDocsSearch();
