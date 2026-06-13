/** Canonical docs site paths — keep in sync with web-docs-hub `content/docs/meta.json`. */
export const DOCS_ORIGIN = 'https://docs.igrisinertial.com';

export function docsUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${DOCS_ORIGIN}${normalized}`;
}

export const DOCS_LINKS = {
  home: docsUrl('/docs'),
  quickstart: docsUrl('/docs/quickstart'),
  apiReference: docsUrl('/docs/api-reference'),
  sdk: docsUrl('/docs/sdk'),
  verification: docsUrl('/docs/verification'),
  architecture: docsUrl('/docs/architecture'),
  tools: docsUrl('/docs/tools'),
  agents: docsUrl('/docs/agents'),
  robotics: docsUrl('/docs/robotics'),
} as const;