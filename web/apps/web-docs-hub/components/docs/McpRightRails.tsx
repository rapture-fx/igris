'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { getMcpPageSections, mcpGuides } from '@/lib/mcp-reference';

export function McpReferenceRightRail() {
  return (
    <div className="sticky top-6 space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="m-0 text-sm font-semibold text-slate-900">MCP Pages</h3>
        </div>
        <nav className="px-2 py-2">
          <ul className="space-y-1">
            {mcpGuides.map((guide) => (
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
          <h3 className="m-0 text-sm font-semibold text-slate-900">On This Page</h3>
        </div>
        <nav className="px-2 py-2">
          <ul className="space-y-1">
            {getMcpPageSections('mcp').map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-gray-50 hover:text-slate-900"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

export function McpPageRightRail({ slug }: { slug: string }) {
  const sections = getMcpPageSections(slug);

  return (
    <div className="sticky top-6 space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="m-0 text-sm font-semibold text-slate-900">MCP Pages</h3>
        </div>
        <nav className="px-2 py-2">
          <ul className="space-y-1">
            {mcpGuides.map((guide) => (
              <li key={guide.slug}>
                <Link
                  href={guide.href}
                  className={cn(
                    'block rounded-lg px-3 py-2 text-sm transition-colors',
                    guide.slug === slug
                      ? 'bg-gray-100 font-medium text-slate-900'
                      : 'text-slate-700 hover:bg-gray-50 hover:text-slate-900'
                  )}
                >
                  {guide.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {sections.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-3">
            <h3 className="m-0 text-sm font-semibold text-slate-900">On This Page</h3>
          </div>
          <nav className="px-2 py-2">
            <ul className="space-y-1">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-gray-50 hover:text-slate-900"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
