import { createElement } from 'react';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: createElement(
        'span',
        { className: 'inline-flex items-center' },
        createElement('img', {
          src: '/fofot.png',
          alt: 'Igris',
          className: 'h-7 w-auto dark:hidden',
        }),
        createElement('img', {
          src: '/fofotlight.png',
          alt: 'Igris',
          className: 'hidden h-7 w-auto dark:block',
        }),
      ),
      url: '/docs',
    },
    links: [
      {
        text: 'Docs',
        url: '/docs',
        active: 'nested-url',
      },
      {
        type: 'menu',
        text: 'Reference',
        items: [
          {
            text: 'API Reference',
            description: 'HTTP API contract and endpoint reference',
            url: '/docs/api-reference',
          },
          {
            text: 'SDKs',
            description: 'Supported SDKs and integration paths',
            url: '/docs/sdk',
          },
          {
            text: 'MCP',
            description: 'Model Context Protocol guides and runtime patterns',
            url: '/docs/mcp',
          },
        ],
      },
    ],
    githubUrl: 'https://github.com/wiramahendra/Schlep-engine',
  };
}
