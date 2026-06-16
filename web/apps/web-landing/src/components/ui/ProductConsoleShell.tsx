'use client'

import React from 'react'
import { BookOpen, Home, Search } from 'lucide-react'
import { DOCS_LINKS } from '../../lib/docs-urls'

const SANS =
  'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

export const PRODUCT_SHOWCASE_URLS = {
  run: 'app.igrisinertial.com/runs/run_01HGJ9N7P4D',
  recover: 'app.igrisinertial.com/runs/run_01HGJ9N7P4D/recovery',
  prove: 'app.igrisinertial.com/runs',
} as const

function ProductBrowserChrome({ url }: { url: string }) {
  return (
    <div
      className="flex items-center gap-2 border-b border-[var(--landing-surface-border)] bg-white px-3 py-2.5 dark:bg-dark-bg sm:gap-3 sm:px-4"
      style={{ fontFamily: SANS }}
    >
      <button
        type="button"
        aria-label="Home"
        className="inline-flex shrink-0 cursor-default items-center justify-center p-0 text-gray-500 transition-colors hover:text-gray-700 dark:text-[#8a8a7a] dark:hover:text-[#d3d2c8]"
      >
        <Home className="h-5 w-5" strokeWidth={1.65} />
      </button>

      <div className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md border border-[var(--landing-surface-border)] bg-[var(--landing-surface)] px-2.5">
        <Search
          className="h-3 w-3 shrink-0 text-gray-400 dark:text-[#6a6a62]"
          strokeWidth={2}
          aria-hidden
        />
        <span
          className="min-w-0 truncate text-[11px] text-gray-600 dark:text-[#a8a898]"
          style={{ fontFamily: MONO }}
        >
          {url}
        </span>
      </div>

      <a
        href={DOCS_LINKS.home}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center text-gray-600 transition-opacity hover:opacity-80 dark:text-[#c8c8b8]"
        aria-label="Open documentation"
      >
        <BookOpen className="h-5 w-5" strokeWidth={1.65} aria-hidden />
      </a>
    </div>
  )
}

export default function ProductConsoleShell({
  url,
  children,
}: {
  url: string
  children: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--landing-surface-border)] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.08)] dark:bg-dark-bg dark:shadow-[0_16px_48px_rgba(0,0,0,0.55)]">
      <ProductBrowserChrome url={url} />
      {children}
    </div>
  )
}