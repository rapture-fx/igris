'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { apiGuides, getApiNavigationSections, getApiSections, getApiEndpointHref, slugify } from '@/lib/api-reference';

export function ApiReferencePage() {
  const sections = getApiSections();
  const navSections = getApiNavigationSections();

  function coverageClass(status?: string) {
    if (status === 'verified') {
      return 'bg-emerald-50 text-emerald-700';
    }
    if (status === 'referenced') {
      return 'bg-blue-50 text-blue-700';
    }
    return 'bg-amber-50 text-amber-800';
  }

  return (
    <div className="not-prose space-y-10 [&_a]:no-underline">
      <section id="browse" className="space-y-6">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Overview</div>
          <h1 className="m-0 text-[1.125rem] font-bold text-slate-900">How to use this reference</h1>
          <p className="mb-0 max-w-4xl text-[0.8125rem] leading-7 text-slate-700">
            Igris is documented here as one product. Depending on where it is running, you will call
            either the cloud API or a local runtime endpoint. Browse by capability below, or use the
            sidebar search to jump directly to a guide or endpoint page.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,2.2fr)_minmax(20rem,1fr)]">
          <div className="rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="m-0 text-base font-semibold text-slate-900">Reference structure</h2>
            </div>
            <div className="space-y-5 px-6 py-5">
              <p className="m-0 text-[0.8125rem] leading-7 text-slate-700">
                Start with the guide pages for authentication, errors, and rate limits, then move into
                the endpoint groups for request and response details.
              </p>
              <p className="m-0 text-[0.8125rem] leading-7 text-slate-700">
                Guide pages explain shared behaviors. Endpoint pages focus on a single route with its
                request shape, authentication model, examples, and status codes.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-6 py-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cloud API base URL</div>
                <code className="mt-2 block text-sm text-slate-900">https://overture.igrisinertial.com</code>
                <p className="mb-0 mt-2 text-sm leading-7 text-slate-700">
                  Hosted account, billing, fleet, receipt, and policy endpoints.
                </p>
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Local runtime base URL</div>
                <code className="mt-2 block text-sm text-slate-900">http://localhost:8080</code>
                <p className="mb-0 mt-2 text-sm leading-7 text-slate-700">
                  Local health, inference, validation, and runtime execution endpoints.
                </p>
              </div>
              <div className="border-t border-gray-200 pt-4 xl:border-t xl:pt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Coverage labels</div>
                <p className="mb-0 mt-2 text-sm leading-7 text-slate-700">
                  Endpoint pages show whether a route is verified, referenced by shipped clients, or documented.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[0.7rem] font-medium text-emerald-700">
                    Verified
                  </span>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[0.7rem] font-medium text-blue-700">
                    Referenced
                  </span>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[0.7rem] font-medium text-amber-800">
                    Documented
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="guides" className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="m-0 text-base font-semibold text-slate-900">Reference guides</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {apiGuides.map((guide) => (
            <Link
              key={guide.slug}
              href={guide.href}
              className="flex items-start justify-between gap-4 px-6 py-4 no-underline transition-colors hover:bg-gray-50"
            >
              <div>
                <div className="text-sm font-semibold text-slate-900">{guide.title}</div>
                <div className="mt-1 text-sm leading-7 text-slate-700">{guide.summary}</div>
              </div>
              <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
            </Link>
          ))}
        </div>
      </section>

      {sections.map((section) => {
        const navSection = navSections.find((candidate) => candidate.section === section.title);

        return (
          <section id={`group-${slugify(section.title)}`} key={section.title} className="rounded-2xl border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="m-0 text-base font-semibold text-slate-900">{section.title}</h2>
                  <p className="mb-0 mt-2 text-sm leading-7 text-slate-700">{section.summary}</p>
                </div>
                <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                  {section.endpoints.length} endpoints
                </div>
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
                    <span className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                      {navSection?.items.find((item) => item.href === getApiEndpointHref(section, endpoint))?.badge ?? endpoint.method}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <code className="text-sm text-slate-900">{endpoint.path}</code>
                      <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[0.7rem] font-medium text-gray-600">
                        {endpoint.surface}
                      </span>
                      <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[0.7rem] font-medium text-gray-600">
                        {endpoint.stability}
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

export function ApiReferenceRightRail() {
  const sections = getApiSections();

  return (
    <div className="sticky top-6 space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="m-0 text-sm font-semibold text-slate-900">Start Here</h3>
        </div>
        <nav className="px-2 py-2">
          <ul className="space-y-1">
            <li>
              <a href="#browse" className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-gray-50 hover:text-slate-900">
                Browse the catalog
              </a>
            </li>
            <li>
              <a href="#guides" className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-gray-50 hover:text-slate-900">
                Reference guides
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="m-0 text-sm font-semibold text-slate-900">Guide Pages</h3>
        </div>
        <nav className="px-2 py-2">
          <ul className="space-y-1">
            {apiGuides.map((guide) => (
              <li key={guide.slug}>
                <Link
                  href={guide.href}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-gray-50 hover:text-slate-900"
                >
                  {guide.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="m-0 text-sm font-semibold text-slate-900">Endpoint Groups</h3>
        </div>
        <nav className="max-h-[24rem] overflow-y-auto px-2 py-2">
          <ul className="space-y-1">
            {sections.map((section) => (
              <li key={section.title}>
                <a
                  href={`#group-${slugify(section.title)}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-gray-50 hover:text-slate-900"
                >
                  <span>{section.title}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.7rem] font-medium text-gray-600">
                    {section.endpoints.length}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
