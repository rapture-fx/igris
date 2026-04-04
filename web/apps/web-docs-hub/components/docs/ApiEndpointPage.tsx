'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ApiCodeTabs } from '@/components/docs/ApiCodeTabs';
import { cn } from '@/lib/utils';
import type { ApiEndpointPageData, ApiField, ApiStatusCode } from '@/lib/api-reference';

interface ApiEndpointPageProps {
  data: ApiEndpointPageData;
}

type EndpointAnchor = {
  id: string;
  label: string;
};

function AnchorSection({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} data-api-anchor={id} className={className}>
      {children}
    </section>
  );
}

function FieldList({ id, title, fields }: { id: string; title: string; fields: ApiField[] }) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <AnchorSection id={id} className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="m-0 text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="divide-y divide-gray-200">
        {fields.map((field) => (
          <div key={field.name} className="grid gap-3 px-5 py-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-sm text-slate-900">{field.name}</code>
                <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700">{field.type}</span>
                {field.required && (
                  <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                    Required
                  </span>
                )}
              </div>
            </div>
            <p className="mb-0 text-sm leading-7 text-slate-700">{field.description}</p>
          </div>
        ))}
      </div>
    </AnchorSection>
  );
}

function statusBadgeClass(code: number) {
  if (code >= 200 && code < 300) {
    return 'bg-emerald-50 text-emerald-700';
  }
  if (code >= 300 && code < 400) {
    return 'bg-sky-50 text-sky-700';
  }
  if (code === 400) {
    return 'bg-amber-50 text-amber-800';
  }
  if (code === 401 || code === 403) {
    return 'bg-orange-50 text-orange-700';
  }
  if (code === 404) {
    return 'bg-yellow-50 text-yellow-800';
  }
  if (code === 429) {
    return 'bg-rose-50 text-rose-700';
  }
  if (code >= 500) {
    return 'bg-red-50 text-red-700';
  }

  return 'bg-gray-100 text-gray-700';
}

function supportBadgeClass(support: ApiEndpointPageData['endpoint']['support']) {
  if (support === 'core') {
    return 'bg-emerald-50 text-emerald-700';
  }
  if (support === 'preview') {
    return 'bg-amber-50 text-amber-800';
  }
  return 'bg-blue-50 text-blue-700';
}

function supportLabel(support: ApiEndpointPageData['endpoint']['support']) {
  if (support === 'core') {
    return 'Core';
  }
  if (support === 'preview') {
    return 'Preview';
  }
  return 'Supported';
}

function deploymentLabel(mode: ApiEndpointPageData['endpoint']['deployment']) {
  if (mode === 'cloud') {
    return 'Cloud';
  }
  if (mode === 'local') {
    return 'Local';
  }
  return 'Hybrid';
}

function StatusCodeList({ statusCodes }: { statusCodes: ApiStatusCode[] }) {
  if (statusCodes.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="m-0 text-sm font-semibold text-slate-900">Status Codes</h3>
        </div>
        <div className="px-4 py-4">
          <p className="mb-0 text-sm leading-7 text-slate-700">
            Status-code details for this endpoint are still being documented.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-4 py-3">
        <h3 className="m-0 text-sm font-semibold text-slate-900">Status Codes</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {statusCodes.map((status) => (
          <div key={status.code} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={cn('rounded-md px-2 py-1 text-xs font-semibold', statusBadgeClass(status.code))}>
                {status.code}
              </span>
              <span className="text-sm font-medium text-slate-900">{status.title}</span>
            </div>
            <p className="mb-0 mt-2 text-sm leading-7 text-slate-700">{status.description}</p>
            {status.example && (
              <pre className="mt-3 overflow-x-auto rounded-lg bg-[#f8f8f6] px-3 py-3 text-xs leading-6 text-slate-900">
                <code>{status.example}</code>
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ApiEndpointPage({ data }: ApiEndpointPageProps) {
  const requestExamplePending = !data.requestExample && data.requestBodyFields.length > 0;
  const coverageClass = data.endpoint.coverageStatus === 'verified'
    ? 'bg-emerald-50 text-emerald-700'
    : data.endpoint.coverageStatus === 'referenced'
      ? 'bg-blue-50 text-blue-700'
      : 'bg-amber-50 text-amber-800';

  return (
    <div className="not-prose max-w-[60rem] space-y-8">
      <AnchorSection id="overview" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
            {data.endpoint.method}
          </span>
          <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${supportBadgeClass(data.endpoint.support)}`}>
            {supportLabel(data.endpoint.support)}
          </span>
          <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
            {deploymentLabel(data.endpoint.deployment)}
          </span>
          <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
            {data.endpoint.surface}
          </span>
          <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
            {data.endpoint.stability}
          </span>
          <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${coverageClass}`}>
            {data.endpoint.coverageLabel ?? 'Documented'}
          </span>
        </div>
        <div className="space-y-4">
          <h1 className="m-0 text-[1.125rem] font-bold text-slate-900">{data.title}</h1>
          <p className="mb-0 mt-3 text-[0.8125rem] leading-7 text-slate-700">{data.functionality}</p>
          <dl className="grid overflow-hidden rounded-xl border border-gray-200 bg-white lg:grid-cols-2">
            <div className="min-h-[7rem] border-b border-gray-200 px-5 py-4 lg:border-r">
              <dt className="text-[0.72rem] font-semibold uppercase tracking-wide text-gray-500">Base URL</dt>
              <dd className="mt-3">
                <code className="block break-all rounded-lg bg-gray-50 px-3 py-2 text-[0.85rem] leading-6 text-slate-900">
                  {data.baseUrl}
                </code>
              </dd>
            </div>
            <div className="min-h-[7rem] border-b border-gray-200 px-5 py-4">
              <dt className="text-[0.72rem] font-semibold uppercase tracking-wide text-gray-500">Authentication</dt>
              <dd className="mt-3">
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-[0.92rem] leading-6 text-slate-900">
                  {data.endpoint.auth}
                </div>
              </dd>
            </div>
            <div className="min-h-[7rem] border-b border-gray-200 px-5 py-4 lg:border-b-0 lg:border-r">
              <dt className="text-[0.72rem] font-semibold uppercase tracking-wide text-gray-500">Operation</dt>
              <dd className="mt-3">
                <code className="block break-all rounded-lg bg-gray-50 px-3 py-2 text-[0.85rem] leading-6 text-slate-900">
                  {data.endpoint.path}
                </code>
              </dd>
            </div>
            <div className="min-h-[7rem] px-5 py-4">
              <dt className="text-[0.72rem] font-semibold uppercase tracking-wide text-gray-500">Support</dt>
              <dd className="mt-3">
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${supportBadgeClass(data.endpoint.support)}`}>
                      {supportLabel(data.endpoint.support)}
                    </span>
                    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                      {deploymentLabel(data.endpoint.deployment)}
                    </span>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${coverageClass}`}>
                      {data.endpoint.coverageLabel ?? 'Documented'}
                    </span>
                  </div>
                </div>
              </dd>
            </div>
          </dl>
        </div>
      </AnchorSection>

      <AnchorSection id="when-to-use" className="space-y-3 border-t border-gray-200 pt-8">
        <h2 className="m-0 text-lg font-semibold text-slate-900">When To Use</h2>
        <p className="mb-0 text-sm leading-7 text-slate-700">{data.whenToUse}</p>
      </AnchorSection>

      <AnchorSection id="integration-guidance" className="space-y-3 border-t border-gray-200 pt-8">
        <h2 className="m-0 text-lg font-semibold text-slate-900">Integration Guidance</h2>
        <div className="space-y-3 text-sm leading-7 text-slate-700">
          <p className="mb-0">{data.retryGuidance}</p>
          {data.commonMistakes.length > 0 && (
            <div>
              <h3 className="m-0 text-sm font-semibold text-slate-900">Common Mistakes</h3>
              <ul className="mb-0 mt-3 list-disc space-y-2 pl-5">
                {data.commonMistakes.map((mistake) => (
                  <li key={mistake}>{mistake}</li>
                ))}
              </ul>
            </div>
          )}
          {data.relatedEndpoints.length > 0 && (
            <div>
              <h3 className="m-0 text-sm font-semibold text-slate-900">Related Endpoints</h3>
              <ul className="mb-0 mt-3 list-disc space-y-2 pl-5">
                {data.relatedEndpoints.map((related) => (
                  <li key={related.href}>
                    <Link href={related.href} className="text-sm text-primary no-underline hover:underline">
                      {related.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.relatedGuides.length > 0 && (
            <div>
              <h3 className="m-0 text-sm font-semibold text-slate-900">Related Guides</h3>
              <ul className="mb-0 mt-3 list-disc space-y-2 pl-5">
                {data.relatedGuides.map((guide) => (
                  <li key={guide.href}>
                    <Link href={guide.href} className="text-sm text-primary no-underline hover:underline">
                      {guide.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </AnchorSection>

      <FieldList id="path-parameters" title="Path Parameters" fields={data.pathParams} />
      <FieldList id="query-parameters" title="Query Parameters" fields={data.queryParams} />
      <FieldList id="request-body" title="Request Body" fields={data.requestBodyFields} />

      {data.requestExample && (
        <AnchorSection id="request-example" className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="m-0 text-lg font-semibold text-slate-900">Request Example</h2>
          </div>
          <pre className="m-0 overflow-x-auto bg-[#f8f8f6] px-5 py-4 text-xs leading-6 text-slate-900">
            <code>{data.requestExample}</code>
          </pre>
        </AnchorSection>
      )}

      {requestExamplePending && (
        <AnchorSection id="request-example" className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-4">
          <h2 className="m-0 text-lg font-semibold text-slate-900">Request Example</h2>
          <p className="mb-0 mt-2 text-sm leading-7 text-slate-700">
            A runnable request body example is not available on this page yet.
          </p>
        </AnchorSection>
      )}

      {data.notes.length > 0 && (
        <AnchorSection id="notes" className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="m-0 text-lg font-semibold text-slate-900">Notes</h2>
          </div>
          <ul className="m-0 space-y-3 px-5 py-4">
            {data.notes.map((note) => (
              <li key={note} className="ml-5 text-sm leading-7 text-slate-700">
                {note}
              </li>
            ))}
          </ul>
        </AnchorSection>
      )}
    </div>
  );
}

export function ApiEndpointRightRail({ data }: ApiEndpointPageProps) {
  const anchors = useMemo<EndpointAnchor[]>(() => {
    const items: EndpointAnchor[] = [{ id: 'overview', label: 'Overview' }];

    items.push({ id: 'when-to-use', label: 'When To Use' });
    items.push({ id: 'integration-guidance', label: 'Integration Guidance' });

    if (data.pathParams.length > 0) {
      items.push({ id: 'path-parameters', label: 'Path Parameters' });
    }
    if (data.queryParams.length > 0) {
      items.push({ id: 'query-parameters', label: 'Query Parameters' });
    }
    if (data.requestBodyFields.length > 0) {
      items.push({ id: 'request-body', label: 'Request Body' });
    }
    if (data.requestExample || data.requestBodyFields.length > 0) {
      items.push({ id: 'request-example', label: 'Request Example' });
    }
    if (data.notes.length > 0) {
      items.push({ id: 'notes', label: 'Notes' });
    }

    return items;
  }, [data.notes.length, data.pathParams.length, data.queryParams.length, data.requestBodyFields.length, data.requestExample]);

  const [activeAnchor, setActiveAnchor] = useState(anchors[0]?.id ?? 'overview');

  useEffect(() => {
    const elements = anchors
      .map((anchor) => document.getElementById(anchor.id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (elements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]?.target?.id) {
          setActiveAnchor(visible[0].target.id);
        }
      },
      { rootMargin: '-96px 0px -65%' }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [anchors]);

  return (
    <div className="sticky top-6 space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="m-0 text-sm font-semibold text-slate-900">On This Endpoint</h3>
        </div>
        <nav className="px-2 py-2">
          <ul className="space-y-1">
            {anchors.map((anchor) => (
              <li key={anchor.id}>
                <a
                  href={`#${anchor.id}`}
                  className={cn(
                    'block rounded-lg px-3 py-2 text-sm transition-colors',
                    activeAnchor === anchor.id
                      ? 'bg-gray-100 font-medium text-slate-900'
                      : 'text-slate-600 hover:bg-gray-50 hover:text-slate-900'
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById(anchor.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {anchor.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <ApiCodeTabs samples={data.codeSamples} />

      {data.responseExample ? (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="m-0 text-sm font-semibold text-slate-900">Sample Response</h3>
          </div>
          <pre className="m-0 overflow-x-auto bg-[#f8f8f6] px-4 py-4 text-xs leading-6 text-slate-900">
            <code>{data.responseExample}</code>
          </pre>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-4">
          <h3 className="m-0 text-sm font-semibold text-slate-900">Sample Response</h3>
          <p className="mb-0 mt-2 text-sm leading-7 text-slate-700">
            A response example is not available on this page yet.
          </p>
        </div>
      )}

      <StatusCodeList statusCodes={data.statusCodes} />
    </div>
  );
}
