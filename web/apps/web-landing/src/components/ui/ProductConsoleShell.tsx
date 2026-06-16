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
      className="flex items-center gap-2 sm:gap-3 border-b border-black/[0.06] bg-[#fafaf8] px-3 py-2.5 dark:border-white/[0.06] dark:bg-[#141210] sm:px-4"
      style={{ fontFamily: SANS }}
    >
      <button
        type="button"
        aria-label="Home"
        className="inline-flex shrink-0 cursor-default items-center justify-center p-0 text-gray-500 transition-colors hover:text-gray-700 dark:text-[#8a8a7a] dark:hover:text-[#d3d2c8]"
      >
        <Home className="h-5 w-5" strokeWidth={1.65} />
      </button>

      <div className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-lg border border-black/[0.08] bg-white/80 px-2.5 dark:border-white/[0.1] dark:bg-[#0e0e0c]/80">
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
    <div className="relative overflow-hidden rounded-[18px] bg-black/[0.03] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.08)] dark:bg-white/[0.02] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]">
      <ProductBrowserChrome url={url} />
      <div className="p-[6px] pt-[4px]">
        <div className="relative rounded-[14px] bg-black/[0.04] p-[4px] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.1)] dark:bg-white/[0.025] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.05)]">
          {children}
        </div>
      </div>
    </div>
  )
}