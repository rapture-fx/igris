import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Cards, Card } from 'fumadocs-ui/components/card';
import type { TOCItemType } from 'fumadocs-core/toc';
import { apiGuides, getApiNavigationSections, getApiSections, getApiEndpointHref, slugify } from '@/lib/api-reference';

export function ApiReferencePage() {
  const sections = getApiSections();
  const navSections = getApiNavigationSections();
  const methodClasses: Record<string, string> = {
    GET: 'bg-emerald-50 text-emerald-700',
    POST: 'bg-blue-50 text-blue-700',
    PUT: 'bg-amber-50 text-amber-700',
    PATCH: 'bg-orange-50 text-orange-700',
    DELETE: 'bg-red-50 text-red-700',
  };

  function coverageClass(status?: string) {
    if (status === 'verified') {
      return 'bg-emerald-50 text-emerald-700';
    }
    if (status === 'referenced') {
      return 'bg-blue-50 text-blue-700';
    }
    return 'bg-amber-50 text-amber-800';
  }

  function supportClass(support: string) {
    if (support === 'core') {
      return 'bg-emerald-50 text-emerald-700';
    }
    if (support === 'preview') {
      return 'bg-amber-50 text-amber-800';
    }
    return 'bg-blue-50 text-blue-700';
  }

  function supportLabel(support: string) {
    if (support === 'core') {
      return 'Core';
    }
    if (support === 'preview') {
      return 'Preview';
    }
    return 'Supported';
  }

  function deploymentLabel(deployment: string) {
    if (deployment === 'cloud') {
      return 'Cloud';
    }
    if (deployment === 'local') {
      return 'Local';
    }
    return 'Hybrid';
  }

  return (
    <div className="not-prose max-w-[52rem] space-y-10 [&_a]:no-underline">
      <section id="overview" className="space-y-5">
        <div className="space-y-3">
          <h2 className="m-0 text-base font-semibold text-slate-900">Overview</h2>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            This is the customer API contract for Igris. Read it as one product surface, even when the
            request ultimately lands on the hosted API or on a local runtime. The guide pages explain
            the rules that apply across the product, and the endpoint pages document the routes you
            actually integrate against.
          </p>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            If you are new to the API, start with Introduction. Authentication tells you which
            credentials belong to backend automation, browser sessions, and runtime-local access.
            Errors and Rate Limits explain the failure patterns and retry behavior you should account
            for before you put any route on a production path.
          </p>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            Each endpoint page is written as an operational reference. It tells you what the route is
            for, when to use it, how to authenticate, what request shape it expects, how to handle the
            response, and what mistakes are most likely to cause problems during integration.
          </p>
        </div>
      </section>

      <section id="guides" className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="m-0 text-base font-semibold text-slate-900">Reference guides</h2>
          <p className="mb-0 mt-2 text-sm leading-7 text-slate-700">
            Read these once before you go deep on individual routes. They cover the shared behavior
            that makes the rest of the API reference easier to use correctly.
          </p>
        </div>
        <Cards className="grid-cols-1 gap-0 p-0">
          {apiGuides.map((guide) => (
            <Card
              key={guide.slug}
              href={guide.href}
              title={guide.title}
              description={guide.summary}
              className="rounded-none border-0 border-t border-gray-200 first:border-t-0 shadow-none"
            />
          ))}
        </Cards>
      </section>

      {sections.map((section) => {
        const navSection = navSections.find((candidate) => candidate.section === section.title);

        return (
          <section id={`group-${slugify(section.title)}`} key={section.title} className="rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="m-0 text-base font-semibold text-slate-900">{section.title}</h2>
                <p className="mb-0 mt-2 text-sm leading-7 text-slate-700">{section.summary}</p>
              </div>
            </div>

            <div className="divide-y divide-gray-200">
              {section.endpoints.map((endpoint) => (
                <Link
                  key={`${endpoint.method}-${endpoint.path}`}
                  href={getApiEndpointHref(section, endpoint)}
                  className="grid gap-4 px-6 py-5 no-underline transition-colors hover:bg-gray-50 lg:grid-cols-[6rem_minmax(0,1.2fr)_minmax(16rem,0.8fr)]"
                >
                  <div>
                    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${methodClasses[endpoint.method] ?? 'bg-gray-100 text-gray-700'}`}>
                      {navSection?.items.find((item) => item.href === getApiEndpointHref(section, endpoint))?.badge ?? endpoint.method}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <code className="text-sm text-slate-900">{endpoint.path}</code>
                      <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[0.7rem] font-medium text-gray-600">
                        {deploymentLabel(endpoint.deployment)}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${supportClass(endpoint.support)}`}>
                        {supportLabel(endpoint.support)}
                      </span>
                      <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[0.7rem] font-medium text-gray-600">
                        {endpoint.surface}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[0.7rem] font-medium ${coverageClass(endpoint.coverageStatus)}`}>
                        {endpoint.coverageLabel ?? 'Documented'}
                      </span>
                    </div>
                    <p className="mb-0 mt-2 text-sm leading-7 text-slate-700">{endpoint.description}</p>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-gray-500">Authentication</div>
                    <div className="mt-2 text-sm leading-7 text-slate-700">{endpoint.auth}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function getApiReferenceToc(): TOCItemType[] {
  const sections = getApiSections();

  return [
    { title: 'Overview', url: '#overview', depth: 2 },
    { title: 'Reference guides', url: '#guides', depth: 2 },
    ...sections.map((section) => ({
      title: section.title,
      url: `#group-${slugify(section.title)}`,
      depth: 2,
    })),
  ];
}
