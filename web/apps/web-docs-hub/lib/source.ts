import { docs } from '@/.source/server';
import { loader } from 'fumadocs-core/source';
import { createSidebarTree } from '@/lib/sidebar-tree';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});

export const sidebarTree = createSidebarTree(source.pageTree);
