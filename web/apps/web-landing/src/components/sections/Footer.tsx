'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { DOCS_LINKS, DOCS_ORIGIN } from '../../lib/docs-urls'
import LandingSectionLink from '../LandingSectionLink'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

type FooterLink = { label: string; href: string; external?: boolean; section?: boolean }

type FooterColumn = { heading: string; links: FooterLink[] }

const columns: FooterColumn[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Action', href: DOCS_LINKS.quickstart, external: true },
      { label: 'Run', href: DOCS_LINKS.deployStaging, external: true },
      { label: 'Proof', href: DOCS_LINKS.proofStatus, external: true },
      { label: 'Reconciliation', href: DOCS_LINKS.reconciliation, external: true },
      { label: 'Pricing', href: '/pricing' },
    ],
  },
  {
    heading: 'Developers',
    links: [
      { label: 'Python quickstart', href: DOCS_LINKS.quickstart, external: true },
      { label: 'Deploy staging', href: DOCS_LINKS.deployStaging, external: true },
      { label: 'REST API', href: DOCS_LINKS.apiReference, external: true },
      { label: 'Python SDK', href: DOCS_LINKS.sdk, external: true },
      { label: 'Proof status', href: DOCS_LINKS.proofStatus, external: true },
    ],
  },
  {
    heading: 'Advanced',
    links: [
      { label: 'Action Protocol', href: DOCS_LINKS.actionProtocol, external: true },
      { label: 'Architecture', href: DOCS_LINKS.architecture, external: true },
      { label: 'Security', href: DOCS_LINKS.security, external: true },
      { label: 'Data privacy', href: DOCS_LINKS.dataPrivacy, external: true },
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
  const style = { fontFamily: SANS, fontSize: '1rem', lineHeight: 1.6 }

  if (link.section) {
    return (
      <LandingSectionLink href={link.href} className={className} style={style}>
        {link.label}
      </LandingSectionLink>
    )
  }

  if (link.external) {
    const isDocs = link.href.startsWith(DOCS_ORIGIN)
    return (
      <a
        href={link.href}
        {...(isDocs ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
        className={className}
        style={style}
      >
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
    <footer id="vision-footer" className="mt-16 scroll-mt-28 md:mt-24 bg-white text-[#171717] border-t border-[#ebebeb]">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[820px]">
        <div className="pt-10 md:pt-14 pb-16 md:pb-20">
          <div className="flex flex-col items-start gap-16 lg:gap-24 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-[280px] shrink-0">
              <Link href="/" prefetch={false} className="inline-flex" aria-label="Igris Inertial home">
                <FooterLogo />
              </Link>
              <p
                className="mt-4 text-gray-600 dark:text-[#a8a898]"
                style={{ fontFamily: SANS, fontSize: '1rem', lineHeight: 1.6 }}
              >
                Safe execution for consequential coding-agent actions. Action → Run → Proof.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-10 flex-1 lg:max-w-3xl ml-auto">
              {columns.map((col) => (
                <div key={col.heading} className="flex flex-col gap-3 min-w-0">
                  <p
                    className="text-gray-900 dark:text-[#f6f6f4]"
                    style={{
                      fontFamily: MONO,
                      fontSize: '12px',
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

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-y-4 py-12 md:py-14">
          <p
            className="text-gray-500 dark:text-[#8a8a7a]"
            style={{ fontFamily: MONO, fontSize: '13px', letterSpacing: '0.02em' }}
          >
            © 2026 Igris Inertial
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <nav
              className="flex flex-wrap items-center gap-x-4 gap-y-2 text-gray-500 dark:text-[#8a8a7a]"
              style={{ fontFamily: MONO, fontSize: '13px', letterSpacing: '0.02em' }}
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
        </div>
      </div>
    </footer>
  )
}
