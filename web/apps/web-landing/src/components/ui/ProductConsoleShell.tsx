'use client'

import React from 'react'
import { BookOpen, Search } from 'lucide-react'
import { DOCS_LINKS } from '../../lib/docs-urls'

const SANS =
  'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

export const PRODUCT_SHOWCASE_URLS = {
  run: 'app.igrisinertial.com/runs/run_01HGJ9N7P4D',
  recover: 'app.igrisinertial.com/runs/run_01HGJ9N7P4D/recovery',
  prove: 'app.igrisinertial.com/runs',
} as const

export const PRODUCT_SURFACE_LIGHT = '#f9f9fa'
export const PRODUCT_SURFACE_DARK = '#161515'

const LANDING_SURFACE_FRAME_CLASS =
  'product-console-frame relative overflow-hidden rounded-lg border border-[var(--landing-surface-border)] bg-[var(--landing-surface)] shadow-[0_1px_3px_rgba(0,0,0,0.03),0_2px_8px_rgba(0,0,0,0.03)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.22)]'

function ProductConsoleSurfaceStyles() {
  return (
    <style>{`
      .product-console-frame {
        --product-surface: ${PRODUCT_SURFACE_LIGHT};
      }
      html.dark .product-console-frame {
        --product-surface: ${PRODUCT_SURFACE_DARK};
      }
      .product-console-frame .igris-console {
        background: var(--product-surface) !important;
        --ic-bg: var(--product-surface);
        --ic-bg-rail: var(--product-surface);
        --ic-dot-border: var(--product-surface);
      }
      .product-console-frame .igris-console nav,
      .product-console-frame .igris-console aside,
      .product-console-frame .igris-console .ic-footer,
      .product-console-frame .igris-console .flex.flex-col.min-h-0,
      .product-console-frame .igris-console .ic-topbar {
        background: var(--product-surface) !important;
      }
      .product-console-frame .ic-runmap,
      .product-console-frame .ic-runmap--flush {
        background: var(--product-surface) !important;
        border: 0 !important;
        border-radius: 0 !important;
        margin: 0 !important;
      }
      .product-console-frame .landing-surface-panel {
        background: var(--product-surface);
      }
      .product-console-frame .ae-window {
        background: var(--product-surface);
        --p-panel: var(--product-surface);
        --p-bar: var(--product-surface);
        border-radius: 0;
      }
      .product-console-frame .ae-worker-terminal {
        background: var(--product-surface);
        border-color: var(--landing-surface-border);
      }
    `}</style>
  )
}

export function LandingSurfaceFrame({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`${LANDING_SURFACE_FRAME_CLASS} ${className}`.trim()}>
      <ProductConsoleSurfaceStyles />
      {children}
    </div>
  )
}

function ProductBrowserChrome({ url }: { url: string }) {
  return (
    <div
      className="flex items-center gap-2 border-b border-[var(--landing-surface-border)] bg-[var(--landing-surface)] px-3 py-2.5 sm:gap-3 sm:px-4"
      style={{ fontFamily: SANS }}
    >
      <button
        type="button"
        aria-label="Home"
        className="inline-flex shrink-0 cursor-default items-center justify-center px-0.5 text-gray-500 transition-colors hover:text-gray-700 dark:text-[#8a8a7a] dark:hover:text-[#d3d2c8]"
        style={{ fontFamily: MONO }}
      >
        <span className="text-[15px] font-medium leading-none tracking-tight" aria-hidden>
          ::
        </span>
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
    <LandingSurfaceFrame>
      <ProductBrowserChrome url={url} />
      {children}
    </LandingSurfaceFrame>
  )
}