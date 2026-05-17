'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const borderStyle = 'var(--section-border)'

type FooterLink = { label: string; href: string; external?: boolean }

const columns: { heading: string; ref: string; links: FooterLink[] }[] = [
  {
    heading: 'PRODUCT',
    ref: 'R.1',
    links: [
      { label: 'Action Tasks', href: '/core' },
      { label: 'Failure Recovery', href: '/core' },
      { label: 'Signed Receipts', href: '/core' },
      { label: 'Proof Verification', href: '/core' },
      { label: 'Operator Inspection', href: '/core' },
    ],
  },
  {
    heading: 'DEVELOPERS',
    ref: 'R.2',
    links: [
      { label: 'Quickstart', href: '/core' },
      { label: 'SDKs', href: '/core' },
      { label: 'API Reference', href: '/core' },
      { label: 'Docs', href: 'https://docs.igrisinertial.com', external: true },
    ],
  },
  {
    heading: 'USE CASES',
    ref: 'R.3',
    links: [
      { label: 'AI Agents', href: '/use-cases' },
      { label: 'Internal Automation', href: '/use-cases' },
      { label: 'Agent Workflows', href: '/use-cases' },
      { label: 'High-Risk Tool Calls', href: '/use-cases' },
    ],
  },
  {
    heading: 'COMPANY',
    ref: 'R.4',
    links: [
      { label: 'Pricing', href: '/pricing' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: 'mailto:support@igrisinertial.com', external: true },
    ],
  },
  {
    heading: 'SOCIAL',
    ref: 'R.5',
    links: [
      { label: 'GitHub', href: 'https://github.com/igrisinertial', external: true },
      { label: 'X (Twitter)', href: 'https://x.com/igrisinertial', external: true },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/company/igrisinertial', external: true },
      { label: 'Discord', href: 'https://discord.com', external: true },
    ],
  },
]

export default function Footer() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  return (
    <footer className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12">

          {/* Link columns */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-y-10 gap-x-6 pt-10 md:pt-12 pb-12 md:pb-14">
            {columns.map((col) => (
              <div key={col.heading} className="flex flex-col gap-3">
                <div className="pb-2" style={{ borderBottom: borderStyle }}>
                  <span
                    className="text-[#000000] dark:text-[#f6f6f4]"
                    style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', fontWeight: 500 }}
                  >
                    {col.heading}
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {col.links.map((link) =>
                    link.external ? (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 dark:text-[#a8a898] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors"
                          style={{ fontFamily: SANS, fontSize: '0.875rem' }}
                        >
                          {link.label}
                        </a>
                      </li>
                    ) : (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          prefetch={false}
                          className="text-gray-600 dark:text-[#a8a898] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors"
                          style={{ fontFamily: SANS, fontSize: '0.875rem' }}
                        >
                          {link.label}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>

          <div style={{ borderTop: borderStyle }} />

          {/* Bottom strip */}
          <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-y-3 py-6 md:py-7">
            <div
              className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-gray-500 dark:text-[#8a8a7a]"
              style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em' }}
            >
              <span>© 2026 IGRIS INERTIAL</span>
              <span className="text-gray-300 dark:text-[#3a3a32]">·</span>
              <Link href="/privacy" className="hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors">
                PRIVACY
              </Link>
              <span className="text-gray-300 dark:text-[#3a3a32]">·</span>
              <Link href="/terms" className="hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors">
                TERMS
              </Link>
              <span className="text-gray-300 dark:text-[#3a3a32]">·</span>
              <Link href="/security" className="hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors">
                SECURITY
              </Link>
            </div>

            <div
              className="flex items-center gap-4"
              style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em' }}
            >
              <span className="text-gray-500 dark:text-[#8a8a7a]">BUILD&nbsp;2026.05</span>
              {mounted && (
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  aria-label="Toggle theme"
                  className="inline-flex items-baseline gap-1.5 text-gray-500 dark:text-[#8a8a7a] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors"
                >
                  <span aria-hidden className="inline-block w-3 border-t border-current translate-y-[-3px]" />
                  {theme === 'dark' ? 'LIGHT' : 'DARK'}
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </footer>
  )
}
