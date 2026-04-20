import { docs } from '@/.source/server';
import { loader } from 'fumadocs-core/source';
import docsAudience from '@/lib/generated/docs-audience.json';
import { isAudienceVisible } from '@/lib/docs-audience';
import { createSidebarTree } from '@/lib/sidebar-tree';

export const source = loader({
  baseUrl: '/docs',
  source: docs.toFumadocsSource(),
});

export function getDocSlugFromUrl(url: string) {
  return url.replace(/^\/docs\/?/, '').split('/').filter(Boolean);
}

function normalizeDocUrl(url: string) {
  const normalized = url.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') || '/docs';
  return normalized === '' ? '/docs' : normalized;
}

export function isDocPageVisible(slug: string[] | undefined) {
  const page = source.getPage(slug);
  if (!page) return false;

  const url = normalizeDocUrl(slug?.length ? `/docs/${slug.join('/')}` : '/docs');
  return isAudienceVisible((docsAudience.pages as Record<string, string | undefined>)[url]);
}

export function isDocUrlVisible(url: string) {
  const normalizedUrl = normalizeDocUrl(url);
  return isAudienceVisible((docsAudience.pages as Record<string, string | undefined>)[normalizedUrl]);
}

export const sidebarTree = createSidebarTree(source.pageTree, isDocUrlVisible);
