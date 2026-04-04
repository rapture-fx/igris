import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { mcpGuides, mcpMethodGroups, getMcpPageSections } from '@/lib/mcp-reference';

export function McpReferencePage() {
  return (
    <div className="not-prose max-w-[52rem] space-y-10 [&_a]:no-underline">
      <section id="overview" className="space-y-4">
        <h2 className="m-0 text-base font-semibold text-slate-900">Overview</h2>
        <p className="mb-0 text-sm leading-7 text-slate-700">
          MCP is the structured context layer in Igris. Use it when context belongs to the operating
          environment and must move between tools, agents, sessions, or runtimes without becoming
          accidental prompt state.
        </p>
        <p className="mb-0 text-sm leading-7 text-slate-700">
          This section documents MCP as part of the product contract. Start with the overview if you
          are orienting yourself, move to MCP Server for the customer-facing transport and method
          model, then use the integration-pattern pages when you are designing production workflows.
        </p>
      </section>

      <section id="guides" className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="m-0 text-base font-semibold text-slate-900">Guide Pages</h2>
          <p className="mb-0 mt-2 text-sm leading-7 text-slate-700">
            These pages explain where MCP fits in the product and how to use it without confusing
            shared context, durable progress, and audit evidence.
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {mcpGuides.map((guide) => (
            <Link
              key={guide.slug}
              href={guide.href}
              className="flex items-start justify-between gap-4 px-6 py-4 transition-colors hover:bg-gray-50"
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

      <section id="transport-surfaces" className="rounded-2xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="m-0 text-base font-semibold text-slate-900">Transport Surfaces</h2>
          <p className="mb-0 mt-2 text-sm leading-7 text-slate-700">
            MCP is carried through the product on dedicated customer-facing routes rather than
            hidden behind undocumented runtime calls.
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {mcpMethodGroups
            .find((group) => group.title === 'Transport Surfaces')
            ?.methods.map((method) => (
              <Link
                key={method.name}
                href={method.page}
                className="flex items-start justify-between gap-4 px-6 py-4 transition-colors hover:bg-gray-50"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded-md bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                      Route
                    </span>
                    <code className="text-sm text-slate-900">{method.name}</code>
                  </div>
                  <div className="text-sm leading-7 text-slate-700">{method.summary}</div>
                </div>
                <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
              </Link>
            ))}
        </div>
      </section>

      <section id="method-families" className="space-y-6">
        {mcpMethodGroups
          .filter((group) => group.title !== 'Transport Surfaces')
          .map((group) => (
            <div key={group.title} className="rounded-2xl border border-gray-200 bg-white">
              <div className="border-b border-gray-200 px-6 py-4">
                <h2 className="m-0 text-base font-semibold text-slate-900">{group.title}</h2>
                <p className="mb-0 mt-2 text-sm leading-7 text-slate-700">{group.summary}</p>
              </div>
              <div className="divide-y divide-gray-200">
                {group.methods.map((method) => (
                  <Link
                    key={method.name}
                    href={method.page}
                    className="flex items-start justify-between gap-4 px-6 py-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                          Method
                        </span>
                        <code className="text-sm text-slate-900">{method.name}</code>
                      </div>
                      <div className="text-sm leading-7 text-slate-700">{method.summary}</div>
                    </div>
                    <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
      </section>
    </div>
  );
}
