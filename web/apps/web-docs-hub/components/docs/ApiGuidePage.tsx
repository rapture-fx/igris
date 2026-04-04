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
    summary: 'How the Igris API reference is organized, when to use each access point, and how to move from guides into endpoint-level integration work.',
    body: (
      <div className="space-y-6">
        <section id="surfaces" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Two Product Surfaces</h2>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p className="mb-0">
              Igris is documented here as one product with two access points. Use the hosted API at
              <code> https://overture.igrisinertial.com</code> when your integration needs account,
              fleet, billing, receipt, or policy capabilities. Use the local runtime API at
              <code> http://localhost:8080</code> by default when the request belongs on the machine
              where Igris is running.
            </p>
            <p className="mb-0">
              This split is about where the request executes, not about two different products. The
              API reference groups endpoints by capability so you can navigate by task first and only
              think about the base URL when you are ready to make the call.
            </p>
          </div>
        </section>
        <section id="endpoint-pages" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">How Endpoint Pages Work</h2>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p className="mb-0">
              Every endpoint has its own page. That page tells you what the route is for, which
              authentication model it expects, the path and query parameters it accepts, the request
              body fields that matter, and the status codes you should plan for in a real client.
            </p>
            <p className="mb-0">
              The code panel on the right is there to keep the request example visible while you read
              the surrounding contract. Use the overview page to browse by capability, then switch to
              endpoint pages when you are implementing or debugging a specific call.
            </p>
          </div>
        </section>
        <section id="sdk-guidance" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">SDK Guidance</h2>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p className="mb-0">
              JavaScript, Go, and Rust are the first-class SDK languages today. When an endpoint is
              covered by a native SDK, prefer that SDK for application code because it gives you a
              cleaner call surface and reduces request-shape drift over time.
            </p>
            <p className="mb-0">
              Some management routes are still best treated as direct HTTP integrations. In those
              cases, the endpoint page is the primary contract: use the request and response examples,
              confirm the authentication model, and wire your own client behavior around the listed
              status codes.
            </p>
          </div>
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
    summary: 'Which credentials belong to automation, browser sessions, and runtime-local deployments, and how to choose the right one for each route.',
    body: (
      <div className="space-y-6">
        <section id="tenant-api-keys" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Tenant API Keys</h2>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p className="mb-0">
              Customer automation should use tenant API keys with the <code>igris_</code> prefix.
              These keys are the default credential for server-side integrations, CI jobs, backend
              workers, and any script that is calling the hosted API outside the browser.
            </p>
            <p className="mb-0">
              Supply the key as <code>Authorization: Bearer ...</code> or <code>X-API-Key</code> if
              the endpoint allows it. Endpoint pages call out the expected model explicitly, so you
              should treat the endpoint page as authoritative over any generic assumption.
            </p>
          </div>
        </section>
        <section id="session-cookies" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Session Cookies</h2>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p className="mb-0">
              Browser-driven console workflows use session cookies. These routes are designed for an
              authenticated user session rather than headless automation, so they should not be
              treated as generic bearer-token endpoints unless the endpoint page says an API key is
              also accepted.
            </p>
            <p className="mb-0">
              If you are building automation, prefer routes that are documented with API-key access.
              Mixing browser session assumptions into automation usually creates fragile clients and
              unclear operational ownership.
            </p>
          </div>
        </section>
        <section id="runtime-local-auth" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Runtime-local Auth</h2>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p className="mb-0">
              The local runtime API follows the runtime&apos;s own <code>auth</code> configuration.
              Some deployments intentionally keep that surface inside a trusted network boundary with
              minimal local auth, while others front it with stricter controls.
            </p>
            <p className="mb-0">
              Because that access model depends on deployment, do not assume that a local runtime
              route behaves like the hosted API. Check the endpoint page, then confirm the runtime
              configuration in the environment where you will run the integration.
            </p>
          </div>
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
    summary: 'How to read error responses across the API reference and what to expect from validation, authentication, throttling, and server failures.',
    body: (
      <div className="space-y-6">
        <section id="validation-errors" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Validation Errors</h2>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p className="mb-0">
              Validation failures usually mean the request shape was wrong for the route you called.
              Many handlers return a compact JSON envelope with <code>error</code> and sometimes a
              more specific <code>message</code> or <code>code</code> value that tells you what part
              of the request could not be accepted.
            </p>
            <p className="mb-0">
              The exact envelope can vary by route family, which is why endpoint pages include the
              examples that matter most for that route. Treat those page-level examples as the best
              guide to what your client should log and surface to operators.
            </p>
          </div>
        </section>
        <section id="authentication-failures" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Authentication Failures</h2>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p className="mb-0">
              Authentication failures typically return HTTP 401. Session-based handlers often use
              codes such as <code>MISSING_SESSION</code> or <code>INVALID_SESSION</code>, while
              API-key handlers more commonly return <code>INVALID_API_KEY</code> or a similarly
              direct credential error.
            </p>
            <p className="mb-0">
              When you see a 401, first confirm that the route is using the credential model you
              expect. A large share of integration mistakes come from calling a session-oriented route
              with an API key, or treating a runtime-local route like a hosted control-plane route.
            </p>
          </div>
        </section>
        <section id="server-errors" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Server Errors</h2>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p className="mb-0">
              Server-side failures commonly return a generic error such as <code>internal_error</code>
              or a route-specific code such as <code>registration_failed</code> or
              <code> STORAGE_FAILED</code>. These responses indicate that the server accepted the
              route contract but could not complete the operation.
            </p>
            <p className="mb-0">
              Clients should log the status code, the error code when present, and the request
              context needed for retry or investigation. If the endpoint page lists retry-safe status
              codes, follow that guidance rather than assuming every 5xx should be replayed.
            </p>
          </div>
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
    summary: 'What throttling exists today, where it applies, and how clients should behave when they receive a 429 response.',
    body: (
      <div className="space-y-6">
        <section id="global-control-plane-limit" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Global Control-plane Limit</h2>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p className="mb-0">
              The hosted API currently applies a default limiter of 100 requests per minute. That is
              the baseline throttle behavior documented for the shipped product today, and endpoint
              pages call out the exceptions that matter more than the global default.
            </p>
            <p className="mb-0">
              Response headers are only guaranteed on the 429 path right now. Clients should not
              assume that every successful response carries full rate-limit metadata, so your retry
              logic should be driven by the actual error response rather than by optimistic header
              parsing on every request.
            </p>
          </div>
        </section>
        <section id="runtime-download-limit" className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Runtime Download Limit</h2>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p className="mb-0">
              Runtime download endpoints use a tighter subscription-aware throttle. Treat binary
              download as a provisioning or rollout action, not as a hot-path request that your
              application makes repeatedly during normal traffic.
            </p>
            <p className="mb-0">
              When you receive a 429, respect the advertised cooldown window and retry after that
              delay. If you are orchestrating downloads across many machines, stagger those requests
              so the retry path does not turn into another burst immediately after the cooldown ends.
            </p>
          </div>
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
