'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
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

  return (
    <div className="not-prose space-y-10 [&_a]:no-underline">
      <section id="overview" className="space-y-5">
        <div className="space-y-3">
          <h2 className="m-0 text-base font-semibold text-slate-900">Overview</h2>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            This reference documents the shipped Igris API as one product. Depending on your deployment,
            you will call either the hosted API for account-level capabilities or the local runtime API
            for execution, inference, and device-local operations. The guide pages explain shared behavior
            first, and the endpoint pages document each route in detail.
          </p>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            Start with Introduction if you are new to the API surface. Authentication explains which
            credentials belong to automation, console sessions, and local runtime access. Errors and
            Rate Limits describe the failure patterns you should handle before integrating against any
            endpoint in production.
          </p>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            Each endpoint page is written as an operational reference: what the route is for, which
            authentication model it expects, the request shape, example responses, status codes, and
            runnable HTTP examples in JavaScript, Go, and Rust when that helps clarify usage.
          </p>
        </div>
      </section>

      <section id="guides" className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="m-0 text-base font-semibold text-slate-900">Reference guides</h2>
          <p className="mb-0 mt-2 text-sm leading-7 text-slate-700">
            These guides cover the behavior that applies across the API reference, so you do not have
            to relearn the same rules on every endpoint page.
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {apiGuides.map((guide) => (
            <Link
              key={guide.slug}
              href={guide.href}
              className="flex items-start justify-between gap-4 px-6 py-4 no-underline transition-colors hover:bg-gray-50"
            >
              <div className="space-y-1">
                <div className="text-sm font-semibold text-slate-900">{guide.title}</div>
                <div className="text-sm leading-7 text-slate-700">{guide.summary}</div>
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
                    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${methodClasses[endpoint.method] ?? 'bg-gray-100 text-gray-700'}`}>
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
          <h3 className="m-0 text-sm font-semibold text-slate-900">Guide Pages</h3>
        </div>
        <nav className="px-2 py-2">
          <ul className="space-y-1">
            <li>
              <a
                href="#overview"
                className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-gray-50 hover:text-slate-900"
              >
                Overview
              </a>
            </li>
            <li>
              <a
                href="#guides"
                className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-gray-50 hover:text-slate-900"
              >
                Reference guides
              </a>
            </li>
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
