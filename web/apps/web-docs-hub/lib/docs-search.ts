export const docsSearch = {
  enabled: true,
  options: {
    type: 'static' as const,
    api: '/search-static.json',
    links: [
      ['Quick Start', '/docs/quickstart'],
      ['API Reference', '/docs/api-reference'],
      ['SDKs', '/docs/sdk'],
      ['Context Engineering', '/docs/context-engineering'],
    ],
  },
};
