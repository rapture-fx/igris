'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { DOCS_LINKS } from '../../lib/docs-urls'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const borderStyle = 'var(--section-border)'

type FooterLink = { label: string; href: string; external?: boolean }

type FooterColumn = { heading: string; links: FooterLink[] }

const columns: FooterColumn[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Run', href: '/#product' },
      { label: 'Recover', href: '/#product' },
      { label: 'Verify', href: '/#product' },
      { label: 'Inspect', href: '/#product' },
      { label: 'Action endpoint', href: '/#action-endpoint' },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    heading: 'Developers',
    links: [
      { label: 'Documentation', href: DOCS_LINKS.home, external: true },
      { label: 'Quick start', href: DOCS_LINKS.quickstart, external: true },
      { label: 'API reference', href: DOCS_LINKS.apiReference, external: true },
      { label: 'SDKs', href: DOCS_LINKS.sdk, external: true },
      { label: 'Verification', href: DOCS_LINKS.verification, external: true },
      { label: 'Architecture', href: DOCS_LINKS.architecture, external: true },
      { label: 'Tools', href: DOCS_LINKS.tools, external: true },
    ],
  },
  {
    heading: 'Solutions',
    links: [
      { label: 'AI agents', href: DOCS_LINKS.agents, external: true },
      { label: 'Robotics', href: DOCS_LINKS.robotics, external: true },
      { label: 'Runtime', href: '/runtime' },
      { label: 'Use cases', href: '/use-cases' },
      { label: 'Platform', href: '/core' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Security', href: '/security' },
      { label: 'Jobs', href: '/jobs' },
      { label: 'Sign in', href: '/auth?mode=signin' },
      { label: 'Get started', href: '/auth?mode=signup' },
      { label: 'GitHub', href: 'https://github.com/Igris-inertial', external: true },
      { label: 'X', href: 'https://x.com/igrisinertial', external: true },
    ],
  },
]

function FooterLogo() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const isDark = mounted && theme === 'dark'
  return (
    <img
      src={isDark ? '/inertiadm.png' : '/inertia.png'}
      alt="Igris Inertial"
      className="h-7 w-auto rounded-md"
    />
  )
}

function FooterNavLink({ link }: { link: FooterLink }) {
  const className =
    'text-gray-600 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors'
  const style = { fontFamily: SANS, fontSize: '0.875rem', lineHeight: 1.5 }

  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {link.label}
      </a>
    )
  }

  return (
    <Link href={link.href} prefetch={false} className={className} style={style}>
      {link.label}
    </Link>
  )
}

export default function Footer() {
  return (
    <footer className="bg-gray-50 dark:bg-[#0e0e0c] text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="pt-14 md:pt-16 pb-10 md:pb-12">
          <div className="flex flex-col gap-12 lg:gap-16 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-[280px] shrink-0">
              <Link href="/" prefetch={false} className="inline-flex" aria-label="Igris Inertial home">
                <FooterLogo />
              </Link>
              <p
                className="mt-4 text-gray-600 dark:text-[#a8a898]"
                style={{ fontFamily: SANS, fontSize: '0.875rem', lineHeight: 1.6 }}
              >
                Governed execution for agent actions, with recovery and proof built in.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10 flex-1 lg:max-w-3xl lg:ml-auto">
              {columns.map((col) => (
                <div key={col.heading} className="flex flex-col gap-3 min-w-0">
                  <p
                    className="text-gray-900 dark:text-[#f6f6f4]"
                    style={{
                      fontFamily: MONO,
                      fontSize: '10px',
                      letterSpacing: '0.18em',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                    }}
                  >
                    {col.heading}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        <FooterNavLink link={link} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ borderTop: borderStyle }} />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-y-4 py-8 md:py-9">
          <p
            className="text-gray-500 dark:text-[#8a8a7a]"
            style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.02em' }}
          >
            © 2026 Igris Inertial
          </p>

          <nav
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-gray-500 dark:text-[#8a8a7a]"
            style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.02em' }}
            aria-label="Legal"
          >
            <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors">
              Privacy
            </Link>
            <span className="text-gray-300 dark:text-[#3a3a32]" aria-hidden>
              ·
            </span>
            <Link href="/terms" className="hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors">
              Terms
            </Link>
            <span className="text-gray-300 dark:text-[#3a3a32]" aria-hidden>
              ·
            </span>
            <Link href="/security" className="hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors">
              Security
            </Link>
            <span className="text-gray-300 dark:text-[#3a3a32]" aria-hidden>
              ·
            </span>
            <Link href="/cookies" className="hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors">
              Cookies
            </Link>
            <span className="text-gray-300 dark:text-[#3a3a32]" aria-hidden>
              ·
            </span>
            <Link href="/dpa" className="hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors">
              DPA
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}