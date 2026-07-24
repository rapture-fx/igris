'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown } from 'lucide-react';
import { DOCS_LINKS } from '../../lib/docs-urls';
import { getConsoleUrl, PROD_CONSOLE } from '../../lib/console-url';
import LandingSectionLink from '../LandingSectionLink';
import { useTheme } from 'next-themes';


const NAV_FONT = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const NAV_ITEM_STYLE: React.CSSProperties = {
  fontFamily: NAV_FONT,
  fontSize: '14px',
  letterSpacing: '0',
  fontWeight: 400,
};

interface DropdownItem {
  label: string;
  description: string;
  href: string;
  external?: boolean;
}

const productItems: DropdownItem[] = [
  { label: 'Action', description: 'Configure a consequential operation once.', href: DOCS_LINKS.quickstart, external: true },
  { label: 'Run', description: 'Submit one durable attempt with a business idempotency key.', href: DOCS_LINKS.deployStaging, external: true },
  { label: 'Proof', description: 'Inspect what Igris authorized, observed, and verified.', href: DOCS_LINKS.proofStatus, external: true },
  { label: 'Reconciliation', description: 'Resolve an uncertain external effect without blind replay.', href: DOCS_LINKS.reconciliation, external: true },
];

const docsItems: DropdownItem[] = [
  { label: 'Python quickstart', description: 'Configure an Action, run it, wait, and retrieve Proof.', href: DOCS_LINKS.quickstart, external: true },
  { label: 'Deploy staging', description: 'Use the first hosted-alpha wedge Action.', href: DOCS_LINKS.deployStaging, external: true },
  { label: 'REST API', description: 'The canonical managed interface.', href: DOCS_LINKS.apiReference, external: true },
  { label: 'Proof status', description: 'Understand claims and verification limits.', href: DOCS_LINKS.proofStatus, external: true },
  { label: 'Action Protocol', description: 'Advanced open trust and interoperability layer.', href: DOCS_LINKS.actionProtocol, external: true },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const closeAll = () => {
    setMobileOpen(false);
    setProductOpen(false);
    setDocsOpen(false);
  };

  const logoSrc = mounted && theme === 'dark' ? '/inertiadm.png' : '/inertia.png';
  const consoleUrl = mounted ? getConsoleUrl() : (process.env.NEXT_PUBLIC_CONSOLE_URL || PROD_CONSOLE);

  const navToggleClass =
    'flex items-center gap-1 rounded-[8px] px-2.5 py-1.5 text-[14px] text-gray-600 dark:text-[#a8a898] hover:bg-[#f4f4f5] dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors';
  const navToggleActiveClass =
    'bg-[#f4f4f5] text-gray-900 dark:bg-white/[0.08] dark:text-[#f6f6f4]';
  const dropdownLinkClass =
    'block rounded-[8px] px-3 py-2 text-[13px] text-gray-500 dark:text-[#a8a898] hover:bg-[#f4f4f5] dark:hover:bg-white/[0.06] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors';

  const renderSubItem = (item: DropdownItem) =>
    item.external ? (
      <a
        key={item.label}
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={closeAll}
        className={dropdownLinkClass}
        style={{ fontFamily: NAV_FONT }}
      >
        {item.label}
      </a>
    ) : (
      <LandingSectionLink
        key={item.label}
        href={item.href}
        onClick={closeAll}
        className={dropdownLinkClass}
        style={{ fontFamily: NAV_FONT }}
      >
        {item.label}
      </LandingSectionLink>
    );

  const NavGroups = (
    <>
      {/* Product */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setProductOpen((v) => !v); setDocsOpen(false); }}
          className={`${navToggleClass} ${productOpen ? navToggleActiveClass : ''}`}
          style={NAV_ITEM_STYLE}
        >
          <span>Product</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${productOpen ? 'rotate-180' : ''}`} />
        </button>
        {productOpen && (
          <div className="absolute top-full left-0 mt-1.5 w-48 rounded-[10px] border border-[#ebebeb] dark:border-white/[0.12] bg-white dark:bg-[#110f0f] p-1.5 shadow-lg z-50">
            {productItems.map(renderSubItem)}
          </div>
        )}
      </div>

      {/* Docs */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setDocsOpen((v) => !v); setProductOpen(false); }}
          className={`${navToggleClass} ${docsOpen ? navToggleActiveClass : ''}`}
          style={NAV_ITEM_STYLE}
        >
          <span>Docs</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${docsOpen ? 'rotate-180' : ''}`} />
        </button>
        {docsOpen && (
          <div className="absolute top-full left-0 mt-1.5 w-56 rounded-[10px] border border-[#ebebeb] dark:border-white/[0.12] bg-white dark:bg-[#110f0f] p-1.5 shadow-lg z-50">
            {docsItems.map(renderSubItem)}
          </div>
        )}
      </div>

    </>
  );

  return (
    <>
      {/* Desktop header */}
      <header className="hidden md:flex items-center bg-white dark:bg-[#110f0f] px-4 sm:px-6 lg:px-8 py-4 fixed top-0 left-0 right-0 z-50">
        <Link href="/" prefetch={false} onClick={closeAll} className="flex items-center shrink-0">
          <img src={logoSrc} alt="Igris Inertial" className="h-8 w-auto rounded-lg" />
        </Link>

        <nav className="flex items-center gap-6 ml-10">{NavGroups}</nav>
        <div className="flex items-center gap-4 ml-auto">
          <a
            href={consoleUrl}
            onClick={closeAll}
            className="inline-flex h-9 items-center justify-center rounded-[20px] border border-[rgba(0,0,0,0.1)] dark:border-white/[0.12] bg-white dark:bg-transparent px-5 text-[14px] text-[#171717] dark:text-[#f6f6f4] hover:bg-[#fafafa] dark:hover:bg-white/[0.06] hover:border-[rgba(0,0,0,0.15)] transition-colors"
            style={{ fontFamily: NAV_FONT, fontWeight: 500 }}
          >
            Console
          </a>
          <Link
            href="/auth?mode=signup"
            prefetch={false}
            onClick={closeAll}
            className="inline-flex h-9 items-center justify-center rounded-[20px] bg-[#171717] text-white px-5 text-[14px] hover:bg-[#383838] transition-colors"
            style={{ fontFamily: NAV_FONT, fontWeight: 500 }}
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-[#110f0f]/80 backdrop-blur-md pt-4">
        <div className="px-4 sm:px-6">
          <div className="flex h-14 items-center justify-between">
            <Link href="/" prefetch={false} onClick={closeAll} className="flex items-center">
              <img src={logoSrc} alt="Igris Inertial" className="h-10 w-auto rounded-lg" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="text-gray-500 dark:text-[#c8c8b8]"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 pt-16 bg-white dark:bg-[#010203] overflow-y-auto">
          <nav className="flex flex-col px-5 py-6 gap-0.5">
            {NavGroups}
          </nav>
        </div>
      )}
    </>
  );
}
