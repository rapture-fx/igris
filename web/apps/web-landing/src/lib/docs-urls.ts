/** Canonical docs site paths — keep in sync with web-docs-hub `content/docs/meta.json`. */
export const DOCS_ORIGIN = 'https://docs.igrisinertial.com';

/** web-docs-hub sets `trailingSlash: true`; URLs must end with `/` to avoid redirect chains. */
export function docsUrl(path: string): string {
  let normalized = path.startsWith('/') ? path : `/${path}`;
  if (!normalized.endsWith('/')) normalized = `${normalized}/`;
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
  runtime: docsUrl('/docs/deploy-local-runtime'),
  useCases: docsUrl('/docs/hybrid-deployment-workflow'),
  platform: docsUrl('/docs/execution-model'),
} as const;