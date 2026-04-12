import { createElement } from 'react';
import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { ReferenceMenu } from '@/components/reference-menu';

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
        type: 'custom',
        children: createElement(ReferenceMenu),
      },
    ],
    githubUrl: 'https://github.com/wiramahendra/Schlep-engine',
  };
}
