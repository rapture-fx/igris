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

const guideContent: Record<string, GuideContent> = {
  introduction: {
    title: 'Introduction',
    summary: 'How the Igris API reference is organized, when to use each access point, and how to move from guides into endpoint-level integration work.',
    body: (
      <div className="space-y-10">
        <section id="surfaces" className="space-y-3">
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
        <section id="endpoint-pages" className="space-y-3 border-t border-gray-200 pt-8">
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
        <section id="sdk-guidance" className="space-y-3 border-t border-gray-200 pt-8">
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
            <p className="mb-0">
              The current customer SDK surface is JavaScript, Go, and Rust. Treat those as the
              supported language targets in this reference. If you are working in another language,
              build against the documented HTTP contract rather than assuming a maintained SDK exists
              for that ecosystem yet.
            </p>
          </div>
        </section>
        <section id="support-labels" className="space-y-3 border-t border-gray-200 pt-8">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Support Labels and Deployment Modes</h2>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p className="mb-0">
              Each endpoint page carries both a support label and a deployment mode. <strong>Core</strong>
              routes are the primary customer contract. <strong>Supported</strong> routes are part of the
              shipped product surface but may not be the first endpoint a new customer should start with.
              <strong>Preview</strong> routes are available, but they should be adopted deliberately.
            </p>
            <p className="mb-0">
              Deployment mode tells you where the route belongs operationally. <strong>Cloud</strong>
              routes are served by the hosted API, <strong>Local</strong> routes are served by
              <code> igris-runtime</code>, and <strong>Hybrid</strong> routes are used when the hosted
              product and one or more runtimes are working together.
            </p>
          </div>
        </section>
      </div>
    ),
    sections: [
      { id: 'surfaces', label: 'Two Product Surfaces' },
      { id: 'endpoint-pages', label: 'How Endpoint Pages Work' },
      { id: 'sdk-guidance', label: 'SDK Guidance' },
      { id: 'support-labels', label: 'Support Labels and Deployment Modes' },
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
      <div className="space-y-10">
        <section id="tenant-api-keys" className="space-y-3">
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
        <section id="session-cookies" className="space-y-3 border-t border-gray-200 pt-8">
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
        <section id="runtime-local-auth" className="space-y-3 border-t border-gray-200 pt-8">
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
        <section id="choosing-a-credential" className="space-y-3 border-t border-gray-200 pt-8">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Choosing a Credential</h2>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p className="mb-0">
              Use tenant API keys for server-to-server automation. Use session cookies for browser
              experiences that are already inside the Igris console. Use runtime-local authentication
              only when the endpoint is explicitly local and you control the deployment boundary.
            </p>
            <p className="mb-0">
              If an integration is meant to run unattended, default to API keys and avoid session
              flows. That keeps the operational model clear and makes it easier to rotate credentials,
              audit access, and recover from auth failures without a browser in the loop.
            </p>
          </div>
        </section>
      </div>
    ),
    sections: [
      { id: 'tenant-api-keys', label: 'Tenant API Keys' },
      { id: 'session-cookies', label: 'Session Cookies' },
      { id: 'runtime-local-auth', label: 'Runtime-local Auth' },
      { id: 'choosing-a-credential', label: 'Choosing a Credential' },
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
      <div className="space-y-10">
        <section id="status-codes" className="space-y-3">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Status Codes</h2>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p className="mb-0">
              The HTTP status code tells you what class of failure happened before you look at the
              JSON body. In this reference, treat 4xx responses as request, authentication, or access
              problems that your client should handle directly, and treat 5xx responses as server-side
              failures that may require retry, fallback, or operator attention.
            </p>
            <p className="mb-0">
              The most common patterns are 400 for invalid request shape, 401 for missing or invalid
              credentials, 403 for an authenticated request that still is not allowed, 404 when the
              addressed resource does not exist, 429 when throttling is applied, and 500-level codes
              when the server cannot complete a valid request.
            </p>
          </div>
        </section>
        <section id="validation-errors" className="space-y-3 border-t border-gray-200 pt-8">
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
        <section id="authentication-failures" className="space-y-3 border-t border-gray-200 pt-8">
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
        <section id="server-errors" className="space-y-3 border-t border-gray-200 pt-8">
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
        <section id="handling-strategy" className="space-y-3 border-t border-gray-200 pt-8">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Handling Strategy</h2>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p className="mb-0">
              Good clients do not handle every error the same way. Fix the request for 400-class
              validation issues, refresh or replace credentials for 401 responses, stop and inspect
              authorization assumptions on 403 responses, and apply controlled retry or fallback only
              for the routes and statuses that are documented as retry-safe.
            </p>
            <p className="mb-0">
              At minimum, log the method, path, status code, request correlation context, and error
              code when one is present. That gives operators enough information to separate customer
              input mistakes from credential problems and server instability.
            </p>
          </div>
        </section>
      </div>
    ),
    sections: [
      { id: 'status-codes', label: 'Status Codes' },
      { id: 'validation-errors', label: 'Validation Errors' },
      { id: 'authentication-failures', label: 'Authentication Failures' },
      { id: 'server-errors', label: 'Server Errors' },
      { id: 'handling-strategy', label: 'Handling Strategy' },
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
    railStatus: [
      { code: 400, title: 'Bad Request', description: 'The route was reached, but the request body, query, or path data did not match the endpoint contract.' },
      { code: 401, title: 'Unauthorized', description: 'Credentials were missing, expired, malformed, or not accepted by this route.' },
      { code: 403, title: 'Forbidden', description: 'The caller is authenticated, but the action or resource is not allowed for that identity.' },
      { code: 404, title: 'Not Found', description: 'The addressed resource or route target does not exist in the current tenant or runtime context.' },
      { code: 429, title: 'Too Many Requests', description: 'The caller exceeded the current throttle window and should wait before retrying.' },
      { code: 500, title: 'Internal Server Error', description: 'The server accepted the request contract but failed while processing it.' },
    ],
  },
  'rate-limits': {
    title: 'Rate Limits',
    summary: 'What throttling exists today, where it applies, and how clients should behave when they receive a 429 response.',
    body: (
      <div className="space-y-10">
        <section id="global-control-plane-limit" className="space-y-3">
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
        <section id="runtime-download-limit" className="space-y-3 border-t border-gray-200 pt-8">
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
        <section id="client-behavior" className="space-y-3 border-t border-gray-200 pt-8">
          <h2 className="mt-0 text-lg font-semibold text-slate-900">Client Behavior</h2>
          <div className="space-y-3 text-sm leading-7 text-slate-700">
            <p className="mb-0">
              Build clients so that a 429 is expected and handled, not treated as an exceptional edge
              case. Honor <code>Retry-After</code> when it is present, apply backoff with jitter for
              repeated retries, and avoid running parallel request bursts that all wake up at the same
              second.
            </p>
            <p className="mb-0">
              If you control both the caller and the workload pattern, the best rate-limit strategy is
              to smooth traffic before it reaches the API. Queue bursty work, coalesce repeated reads
              when possible, and keep binary distribution and provisioning actions off your latency-
              sensitive request path.
            </p>
          </div>
        </section>
      </div>
    ),
    sections: [
      { id: 'global-control-plane-limit', label: 'Global Control-plane Limit' },
      { id: 'runtime-download-limit', label: 'Runtime Download Limit' },
      { id: 'client-behavior', label: 'Client Behavior' },
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
    <div className="not-prose max-w-[48rem] space-y-8">
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
                  <span className={cn('rounded-md px-2 py-1 text-xs font-semibold', statusBadgeClass(status.code))}>
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
