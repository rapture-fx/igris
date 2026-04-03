import apiReference from '@/lib/generated/api-reference.json';

type Endpoint = {
  method: string;
  path: string;
  auth: string;
  surface: string;
  stability: string;
  description: string;
};

type Section = {
  title: string;
  summary: string;
  endpoints: Endpoint[];
};

const methodClasses: Record<string, string> = {
  GET: 'bg-emerald-50 text-emerald-700',
  POST: 'bg-blue-50 text-blue-700',
  PUT: 'bg-amber-50 text-amber-700',
  PATCH: 'bg-orange-50 text-orange-700',
  DELETE: 'bg-red-50 text-red-700',
};

const stabilityClasses: Record<string, string> = {
  stable: 'bg-slate-100 text-slate-700',
  preview: 'bg-amber-100 text-amber-800',
};

export function ApiReferencePage() {
  const sections = apiReference.sections as Section[];

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="mt-0 text-lg font-semibold text-slate-900">Contract Source</h2>
        <p className="mb-0 text-sm text-slate-700">
          This page is generated from live route registrations in <code>igris-overture</code> and{' '}
          <code>igris-runtime</code>. Generated on <code>{apiReference.generated_at}</code>.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 p-5">
        <h2 className="mt-0 text-lg font-semibold text-slate-900">Authentication Model</h2>
        <ul className="mb-0 text-sm text-slate-700">
          <li><strong>Public</strong>: no credentials required.</li>
          <li><strong>`igris_` API key</strong>: bearer token or <code>X-API-Key</code> for tenant-scoped automation and runtimes.</li>
          <li><strong>Session cookie</strong>: Better Auth session used by the web console. Do not treat this as a bearer token contract.</li>
          <li><strong>Runtime-config dependent</strong>: local runtime auth depends on your local <code>auth</code> configuration.</li>
        </ul>
      </div>

      {sections.map((section) => (
        <section key={section.title} className="space-y-4">
          <div>
            <h2 className="mt-0 text-2xl font-semibold text-slate-900">{section.title}</h2>
            <p className="mb-0 text-sm text-slate-700">{section.summary}</p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Method</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Path</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Auth</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Surface</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Stability</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-900">Description</th>
                </tr>
              </thead>
              <tbody>
                {section.endpoints.map((endpoint) => (
                  <tr key={`${endpoint.method}-${endpoint.path}`} className="border-t border-slate-200 align-top">
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${methodClasses[endpoint.method] || 'bg-slate-100 text-slate-700'}`}>
                        {endpoint.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-800">{endpoint.path}</td>
                    <td className="px-4 py-3 text-slate-700">{endpoint.auth}</td>
                    <td className="px-4 py-3 text-slate-700">{endpoint.surface}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${stabilityClasses[endpoint.stability] || 'bg-slate-100 text-slate-700'}`}>
                        {endpoint.stability}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{endpoint.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
