'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type GuideContent = {
  title: string;
  summary: string;
  body: ReactNode;
  sections: Array<{ id: string; label: string }>;
  railTitle: string;
  railCode?: string;
  railResponse?: string;
  railStatus?: Array<{ code: number; title: string; description: string }>;
};

const guideContent: Record<string, GuideContent> = {
  introduction: {
    title: 'Introduction',
    summary: 'How to read the Igris API reference and choose the right API surface.',
    body: (
      <div className="space-y-6">
        <section id="surfaces" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Two Product Surfaces</h2>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            Igris ships both a cloud control plane and a local runtime API. The cloud base URL is
            <code> https://overture.igrisinertial.com</code>. The local runtime base URL is
            <code> http://localhost:8080</code> by default.
          </p>
        </section>
        <section id="endpoint-pages" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">How Endpoint Pages Work</h2>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            Every endpoint has a dedicated page with request context, path and query parameters,
            request and response examples, and runnable HTTP snippets for JavaScript, Go, and Rust.
            The pinned right rail replaces the generic table of contents for API pages.
          </p>
        </section>
        <section id="sdk-guidance" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">SDK Guidance</h2>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            JavaScript, Go, and Rust are the first-class native SDKs today. For management and
            control-plane endpoints that are not wrapped by those SDKs yet, use direct HTTP calls.
          </p>
        </section>
      </div>
    ),
    sections: [
      { id: 'surfaces', label: 'Two Product Surfaces' },
      { id: 'endpoint-pages', label: 'How Endpoint Pages Work' },
      { id: 'sdk-guidance', label: 'SDK Guidance' },
    ],
    railTitle: 'Base URLs',
    railCode: `Cloud API
https://overture.igrisinertial.com

Local runtime
http://localhost:8080`,
    railResponse: `{
  "surface": "cloud",
  "supports": [
    "routing",
    "billing",
    "receipts",
    "fleet coordination"
  ]
}`,
  },
  authentication: {
    title: 'Authentication',
    summary: 'Which credential type each API surface expects.',
    body: (
      <div className="space-y-6">
        <section id="tenant-api-keys" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Tenant API Keys</h2>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            Customer automation should use tenant API keys with the <code>igris_</code> prefix.
            Supply them as <code>Authorization: Bearer ...</code> or <code>X-API-Key</code>.
          </p>
        </section>
        <section id="session-cookies" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Session Cookies</h2>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            Console routes use Better Auth session cookies. They are not interchangeable with bearer
            tokens unless the endpoint explicitly accepts an API key as an alternative.
          </p>
        </section>
        <section id="runtime-local-auth" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Runtime-local Auth</h2>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            The local runtime API follows your runtime <code>auth</code> configuration. Some local
            deployments intentionally run unauthenticated inside a trusted network boundary.
          </p>
        </section>
      </div>
    ),
    sections: [
      { id: 'tenant-api-keys', label: 'Tenant API Keys' },
      { id: 'session-cookies', label: 'Session Cookies' },
      { id: 'runtime-local-auth', label: 'Runtime-local Auth' },
    ],
    railTitle: 'Bearer Example',
    railCode: `curl -H "Authorization: Bearer $IGRIS_API_KEY" \\
  https://overture.igrisinertial.com/v1/models`,
    railResponse: `{
  "error": "unauthorized",
  "code": "INVALID_API_KEY"
}`,
  },
  errors: {
    title: 'Errors',
    summary: 'Common response envelopes for validation, auth, and server failures.',
    body: (
      <div className="space-y-6">
        <section id="validation-errors" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Validation Errors</h2>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            Many handlers return a small JSON envelope with <code>error</code> and sometimes
            <code>message</code> or <code>code</code>. The exact body can vary by route family, so
            endpoint pages call out the most relevant examples.
          </p>
        </section>
        <section id="authentication-failures" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Authentication Failures</h2>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            Auth failures typically return HTTP 401. Session-based handlers often return
            <code>MISSING_SESSION</code> or <code>INVALID_SESSION</code>. API-key handlers often
            return <code>INVALID_API_KEY</code>.
          </p>
        </section>
        <section id="server-errors" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Server Errors</h2>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            Internal failures commonly return <code>internal_error</code> or a route-specific code
            such as <code>registration_failed</code> or <code>STORAGE_FAILED</code>.
          </p>
        </section>
      </div>
    ),
    sections: [
      { id: 'validation-errors', label: 'Validation Errors' },
      { id: 'authentication-failures', label: 'Authentication Failures' },
      { id: 'server-errors', label: 'Server Errors' },
    ],
    railTitle: 'Error Envelope',
    railCode: `{
  "error": "invalid_request",
  "message": "Failed to parse request body"
}`,
    railResponse: `{
  "error": {
    "message": "Rate limit exceeded. Please try again later.",
    "type": "rate_limit_error",
    "code": "RATE_LIMIT_EXCEEDED"
  },
  "retry_after_seconds": 60
}`,
  },
  'rate-limits': {
    title: 'Rate Limits',
    summary: 'Current throttle behavior for the shipped control plane.',
    body: (
      <div className="space-y-6">
        <section id="global-control-plane-limit" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Global Control-plane Limit</h2>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            The current default limiter is 100 requests per minute. The response headers are only
            guaranteed on the 429 path today.
          </p>
        </section>
        <section id="runtime-download-limit" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Runtime Download Limit</h2>
          <p className="mb-0 text-sm leading-7 text-slate-700">
            Runtime download endpoints have their own tighter subscription-aware throttle. Treat
            binary download as a provisioning action, not as a hot-path request.
          </p>
        </section>
      </div>
    ),
    sections: [
      { id: 'global-control-plane-limit', label: 'Global Control-plane Limit' },
      { id: 'runtime-download-limit', label: 'Runtime Download Limit' },
    ],
    railTitle: '429 Example',
    railCode: `Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0`,
    railResponse: `{
  "error": {
    "message": "Rate limit exceeded. Please try again later.",
    "type": "rate_limit_error",
    "code": "RATE_LIMIT_EXCEEDED"
  },
  "retry_after_seconds": 60
}`,
    railStatus: [
      { code: 429, title: 'Too Many Requests', description: 'Retry after the advertised cooldown window.' },
    ],
  },
};

export function ApiGuidePage({ slug }: { slug: string }) {
  const guide = guideContent[slug];

  return (
    <div className="not-prose space-y-8">
      <section>
        <h1 className="m-0 text-[1.125rem] font-bold text-slate-900">{guide.title}</h1>
        <p className="mb-0 mt-3 text-[0.8125rem] leading-7 text-slate-700">{guide.summary}</p>
      </section>
      {guide.body}
    </div>
  );
}

export function ApiGuideRightRail({ slug }: { slug: string }) {
  const guide = guideContent[slug];
  const [activeSection, setActiveSection] = useState(guide.sections[0]?.id ?? '');

  useEffect(() => {
    const elements = guide.sections
      .map((section) => document.getElementById(section.id))
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
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: '-96px 0px -65%' }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [guide.sections]);

  return (
    <div className="sticky top-6 space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="m-0 text-sm font-semibold text-slate-900">On This Page</h3>
        </div>
        <nav className="px-2 py-2">
          <ul className="space-y-1">
            {guide.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className={cn(
                    'block rounded-lg px-3 py-2 text-sm transition-colors',
                    activeSection === section.id
                      ? 'bg-gray-100 font-medium text-slate-900'
                      : 'text-slate-600 hover:bg-gray-50 hover:text-slate-900'
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="m-0 text-sm font-semibold text-slate-900">{guide.railTitle}</h3>
        </div>
        {guide.railCode && (
          <pre className="m-0 overflow-x-auto bg-[#f8f8f6] px-4 py-4 text-xs leading-6 text-slate-900">
            <code>{guide.railCode}</code>
          </pre>
        )}
      </div>

      {guide.railResponse && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="m-0 text-sm font-semibold text-slate-900">Example JSON</h3>
          </div>
          <pre className="m-0 overflow-x-auto bg-[#f8f8f6] px-4 py-4 text-xs leading-6 text-slate-900">
            <code>{guide.railResponse}</code>
          </pre>
        </div>
      )}

      {guide.railStatus && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="m-0 text-sm font-semibold text-slate-900">Status Codes</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {guide.railStatus.map((status) => (
              <div key={status.code} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                    {status.code}
                  </span>
                  <span className="text-sm font-medium text-slate-900">{status.title}</span>
                </div>
                <p className="mb-0 mt-2 text-sm leading-7 text-slate-700">{status.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
