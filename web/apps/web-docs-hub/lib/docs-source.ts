import path from 'node:path';

const DOCS_ROOT = path.join(process.cwd(), 'content', 'docs');
const GITHUB_REPO_URL = 'https://github.com/wiramahendra/Schlep-engine';
const GITHUB_REF = 'main';
const APP_REPO_PREFIX = 'web/apps/web-docs-hub';

export function getDocRelativePath(slug?: string[]): string {
  const segments = slug && slug.length > 0 ? slug : ['index'];
  return path.posix.join(...segments) + '.mdx';
}

export function getDocAbsolutePath(slug?: string[]): string {
  const relativePath = getDocRelativePath(slug);
  const absolutePath = path.resolve(DOCS_ROOT, relativePath);

  if (!absolutePath.startsWith(DOCS_ROOT + path.sep) && absolutePath !== DOCS_ROOT) {
    throw new Error('Invalid documentation path.');
  }

  return absolutePath;
}

export function getDocGithubUrl(slug?: string[]): string {
  const relativePath = getDocRelativePath(slug);
  return `${GITHUB_REPO_URL}/blob/${GITHUB_REF}/${APP_REPO_PREFIX}/content/docs/${relativePath}`;
}

export function getDocMarkdownUrl(slug?: string[]): string {
  return `/markdown/${getDocRelativePath(slug)}`;
}
