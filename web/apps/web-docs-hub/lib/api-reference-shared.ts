import apiReference from '@/lib/generated/api-reference.json';
import apiVerification from '@/lib/generated/api-verification.json';

export type ApiEndpoint = {
  method: string;
  path: string;
  auth: string;
  surface: string;
  stability: string;
  description: string;
  coverageStatus?: ApiCoverageStatus;
  coverageLabel?: string;
  coverageConfidence?: string;
};

export type ApiSection = {
  title: string;
  summary: string;
  endpoints: ApiEndpoint[];
};

export type ApiGuide = {
  slug: string;
  title: string;
  summary: string;
  href: string;
};

export type ApiNavItem = {
  name: string;
  href: string;
  badge?: string;
};

export type ApiNavSection = {
  section: string;
  items: ApiNavItem[];
};

export type ApiField = {
  name: string;
  type: string;
  required?: boolean;
  description: string;
};

export type ApiStatusCode = {
  code: number;
  title: string;
  description: string;
  example?: string;
};

export type ApiCodeSample = {
  label: string;
  language: string;
  code: string;
};

export type ApiCoverageStatus = 'verified' | 'referenced' | 'documented';

export type ApiEndpointPageData = {
  section: ApiSection;
  sectionSlug: string;
  endpoint: ApiEndpoint;
  endpointSlug: string;
  href: string;
  title: string;
  baseUrl: string;
  functionality: string;
  pathParams: ApiField[];
  queryParams: ApiField[];
  requestBodyFields: ApiField[];
  requestExample: string | null;
  responseExample: string | null;
  statusCodes: ApiStatusCode[];
  codeSamples: ApiCodeSample[];
  notes: string[];
};

export const apiGuides: ApiGuide[] = [
  {
    slug: 'introduction',
    title: 'Introduction',
    summary: 'Base URLs, API surfaces, and how this reference is organized.',
    href: '/docs/api-reference/introduction',
  },
  {
    slug: 'authentication',
    title: 'Authentication',
    summary: 'API key, session cookie, and runtime-local auth expectations.',
    href: '/docs/api-reference/authentication',
  },
  {
    slug: 'errors',
    title: 'Errors',
    summary: 'Common error envelopes and how to interpret status codes.',
    href: '/docs/api-reference/errors',
  },
  {
    slug: 'rate-limits',
    title: 'Rate Limits',
    summary: 'Global and endpoint-specific throttling behavior.',
    href: '/docs/api-reference/rate-limits',
  },
];

const apiSections = apiReference.sections as ApiSection[];
const verificationEntries = new Map(
  ((apiVerification.endpoints ?? []) as Array<{ method: string; path: string; status: string; confidence: string }>).map((entry) => [
    `${entry.method} ${entry.path}`,
    entry,
  ])
);

function enrichEndpoint(endpoint: ApiEndpoint): ApiEndpoint {
  const verification = verificationEntries.get(`${endpoint.method} ${endpoint.path}`);

  if (!verification) {
    return {
      ...endpoint,
      coverageStatus: 'documented',
      coverageLabel: 'Documented',
      coverageConfidence: 'low',
    };
  }

  if (verification.status === 'test-covered') {
    return {
      ...endpoint,
      coverageStatus: 'verified',
      coverageLabel: 'Verified',
      coverageConfidence: verification.confidence,
    };
  }

  if (verification.status === 'client-referenced') {
    return {
      ...endpoint,
      coverageStatus: 'referenced',
      coverageLabel: 'Referenced',
      coverageConfidence: verification.confidence,
    };
  }

  return {
    ...endpoint,
    coverageStatus: 'documented',
    coverageLabel: 'Documented',
    coverageConfidence: verification.confidence,
  };
}

const enrichedApiSections = apiSections.map((section) => ({
  ...section,
  endpoints: section.endpoints.map((endpoint) => enrichEndpoint(endpoint)),
}));

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getApiSections() {
  return enrichedApiSections;
}

export function getApiSectionSlug(title: string) {
  return slugify(title);
}

export function getApiEndpointSlug(endpoint: ApiEndpoint) {
  return slugify(`${endpoint.method.toLowerCase()}-${endpoint.path.replace(/:/g, '').replace(/\//g, '-')}`);
}

export function getApiEndpointHref(section: ApiSection, endpoint: ApiEndpoint) {
  return `/docs/api-reference/${getApiSectionSlug(section.title)}/${getApiEndpointSlug(endpoint)}`;
}

export function getApiNavigationSections(): ApiNavSection[] {
  const guideItems: ApiNavItem[] = [
    { name: 'Overview', href: '/docs/api-reference' },
    ...apiGuides.map((guide) => ({
      name: guide.title,
      href: guide.href,
    })),
  ];

  const endpointSections: ApiNavSection[] = enrichedApiSections.map((section) => ({
    section: section.title,
    items: section.endpoints.map((endpoint) => ({
      name: endpoint.path,
      href: getApiEndpointHref(section, endpoint),
      badge: endpoint.method,
    })),
  }));

  return [{ section: 'Overview', items: guideItems }, ...endpointSections];
}

export function findApiGuide(slug: string) {
  return apiGuides.find((guide) => guide.slug === slug) ?? null;
}

export function findApiEndpoint(sectionSlug: string, endpointSlug: string) {
  for (const section of enrichedApiSections) {
    if (getApiSectionSlug(section.title) !== sectionSlug) {
      continue;
    }

    for (const endpoint of section.endpoints) {
      if (getApiEndpointSlug(endpoint) === endpointSlug) {
        return { section, endpoint };
      }
    }
  }

  return null;
}

export function getApiEndpointStaticParams() {
  return enrichedApiSections.flatMap((section) =>
    section.endpoints.map((endpoint) => ({
      slug: [getApiSectionSlug(section.title), getApiEndpointSlug(endpoint)],
    }))
  );
}

export function getApiGuideStaticParams() {
  return apiGuides.map((guide) => ({ slug: [guide.slug] }));
}

export function getApiBreadcrumbLabel(pathname: string) {
  if (!pathname.startsWith('/docs/api-reference')) {
    return null;
  }

  const relative = pathname.replace(/^\/docs\/api-reference\/?/, '');
  if (!relative) {
    return 'API Reference';
  }

  const parts = relative.split('/').filter(Boolean);
  if (parts.length === 1) {
    const guide = findApiGuide(parts[0]);
    return guide?.title ?? null;
  }

  if (parts.length === 2) {
    const match = findApiEndpoint(parts[0], parts[1]);
    return match ? `${match.endpoint.method} ${match.endpoint.path}` : null;
  }

  return null;
}
