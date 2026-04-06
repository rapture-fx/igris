import Link from 'next/link';
import type { ReactNode } from 'react';
import type { TOCItemType } from 'fumadocs-core/toc';
import { Callout } from 'fumadocs-ui/components/callout';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import { ApiCodeTabs } from '@/components/docs/ApiCodeTabs';
import type { ApiEndpointPageData, ApiField, ApiStatusCode } from '@/lib/api-reference';

interface ApiEndpointPageProps {
  data: ApiEndpointPageData;
}

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

  const typeMap = Object.fromEntries(
    fields.map((field) => [
      field.name,
      {
        type: field.type,
        required: field.required,
        description: field.description,
      },
    ])
  );

  return (
    <AnchorSection id={id} className="space-y-3 border-t border-gray-200 pt-8">
        <h2 className="m-0 text-lg font-semibold text-slate-900">{title}</h2>
      <TypeTable type={typeMap} />
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
      <Callout title="Status Codes" type="info">
        <p>Status-code details for this endpoint are still being documented.</p>
      </Callout>
    );
  }

  return (
    <div className="space-y-3">
        {statusCodes.map((status) => (
          <Callout
            key={status.code}
            title={
              <span className="inline-flex items-center gap-2">
                <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(status.code)}`}>
                  {status.code}
                </span>
                <span>{status.title}</span>
              </span>
            }
            type={status.code >= 500 ? 'error' : status.code === 429 ? 'warning' : 'info'}
          >
            <p>{status.description}</p>
            {status.example ? (
              <CodeBlock title="Example">
                <Pre>
                  <code>{status.example}</code>
                </Pre>
              </CodeBlock>
            ) : null}
          </Callout>
        ))}
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
        <AnchorSection id="request-example" className="space-y-3 border-t border-gray-200 pt-8">
            <h2 className="m-0 text-lg font-semibold text-slate-900">Request Example</h2>
          <CodeBlock title="JSON request">
            <Pre>
              <code>{data.requestExample}</code>
            </Pre>
          </CodeBlock>
        </AnchorSection>
      )}

      {requestExamplePending && (
        <AnchorSection id="request-example" className="space-y-3 border-t border-gray-200 pt-8">
          <h2 className="m-0 text-lg font-semibold text-slate-900">Request Example</h2>
          <Callout title="Request example pending" type="info">
            <p>A runnable request body example is not available on this page yet.</p>
          </Callout>
        </AnchorSection>
      )}

      {data.notes.length > 0 && (
        <AnchorSection id="notes" className="space-y-3 border-t border-gray-200 pt-8">
            <h2 className="m-0 text-lg font-semibold text-slate-900">Notes</h2>
          <ul className="m-0 space-y-3 px-5 py-4">
            {data.notes.map((note) => (
              <li key={note} className="ml-5 text-sm leading-7 text-slate-700">
                {note}
              </li>
            ))}
          </ul>
        </AnchorSection>
      )}

      <AnchorSection id="code-examples" className="space-y-3 border-t border-gray-200 pt-8">
        <h2 className="m-0 text-lg font-semibold text-slate-900">Code Examples</h2>
        <ApiCodeTabs samples={data.codeSamples} />
      </AnchorSection>

      <AnchorSection id="sample-response" className="space-y-3 border-t border-gray-200 pt-8">
        <h2 className="m-0 text-lg font-semibold text-slate-900">Sample Response</h2>
        {data.responseExample ? (
          <CodeBlock title="JSON response">
            <Pre>
              <code>{data.responseExample}</code>
            </Pre>
          </CodeBlock>
        ) : (
          <Callout title="Response example pending" type="info">
            <p>A response example is not available on this page yet.</p>
          </Callout>
        )}
      </AnchorSection>

      <AnchorSection id="status-codes" className="space-y-3 border-t border-gray-200 pt-8">
        <h2 className="m-0 text-lg font-semibold text-slate-900">Status Codes</h2>
        <StatusCodeList statusCodes={data.statusCodes} />
      </AnchorSection>
    </div>
  );
}

export function getApiEndpointToc(data: ApiEndpointPageData): TOCItemType[] {
  const toc: TOCItemType[] = [
    { title: 'Overview', url: '#overview', depth: 2 },
    { title: 'When To Use', url: '#when-to-use', depth: 2 },
    { title: 'Integration Guidance', url: '#integration-guidance', depth: 2 },
  ];

  if (data.pathParams.length > 0) {
    toc.push({ title: 'Path Parameters', url: '#path-parameters', depth: 2 });
  }
  if (data.queryParams.length > 0) {
    toc.push({ title: 'Query Parameters', url: '#query-parameters', depth: 2 });
  }
  if (data.requestBodyFields.length > 0) {
    toc.push({ title: 'Request Body', url: '#request-body', depth: 2 });
  }
  if (data.requestExample || data.requestBodyFields.length > 0) {
    toc.push({ title: 'Request Example', url: '#request-example', depth: 2 });
  }
  if (data.notes.length > 0) {
    toc.push({ title: 'Notes', url: '#notes', depth: 2 });
  }
  toc.push(
    { title: 'Code Examples', url: '#code-examples', depth: 2 },
    { title: 'Sample Response', url: '#sample-response', depth: 2 },
    { title: 'Status Codes', url: '#status-codes', depth: 2 }
  );

  return toc;
}
