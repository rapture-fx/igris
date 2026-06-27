'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown } from 'lucide-react';
import { DOCS_LINKS } from '../../lib/docs-urls';
import { LANDING_SECTIONS, landingHash } from '../../lib/landing-sections';
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
  { label: 'Run', description: 'Every call goes through policy and routing with recorded progress.', href: landingHash(LANDING_SECTIONS.productRun) },
  { label: 'Recover', description: 'Resume from checkpoints when providers rate-limit or workers fail.', href: landingHash(LANDING_SECTIONS.productRecover) },
  { label: 'Prove', description: 'Signed receipts for every action. Inspect what ran and what recovered.', href: landingHash(LANDING_SECTIONS.productProve) },
];

const docsItems: DropdownItem[] = [
  { label: 'Getting Started', description: 'Run your first verified execution path.', href: DOCS_LINKS.quickstart, external: true },
  { label: 'API Reference', description: 'Endpoints, request format, and response fields.', href: DOCS_LINKS.apiReference, external: true },
  { label: 'SDKs', description: 'JavaScript, Python, Go, Rust, and cURL examples.', href: DOCS_LINKS.sdk, external: true },
  { label: 'Receipt Verification', description: 'Understand signed records and verification.', href: DOCS_LINKS.verification, external: true },
  { label: 'Architecture', description: 'How Igris governs execution across environments.', href: DOCS_LINKS.architecture, external: true },
];

const SIDEBAR_WIDTH = 256;

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

  const navLinkClass =
    'text-[14px] text-gray-600 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors';
  const navToggleClass =
    'flex items-center gap-1 text-[14px] text-gray-600 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors';
  const dropdownLinkClass =
    'block rounded-md px-3 py-1.5 text-[13px] text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors';

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
        <button type="button" onClick={() => { setProductOpen((v) => !v); setDocsOpen(false); }} className={navToggleClass} style={NAV_ITEM_STYLE}>
          <span>Product</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${productOpen ? 'rotate-180' : ''}`} />
        </button>
        {productOpen && (
          <div className="absolute top-full left-0 mt-1 w-48 rounded-lg border border-[#ebebeb] dark:border-white/[0.12] bg-white dark:bg-[#110f0f] p-1.5 shadow-lg z-50">
            {productItems.map(renderSubItem)}
          </div>
        )}
      </div>

      {/* Docs */}
      <div className="relative">
        <button type="button" onClick={() => { setDocsOpen((v) => !v); setProductOpen(false); }} className={navToggleClass} style={NAV_ITEM_STYLE}>
          <span>Docs</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${docsOpen ? 'rotate-180' : ''}`} />
        </button>
        {docsOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 rounded-lg border border-[#ebebeb] dark:border-white/[0.12] bg-white dark:bg-[#110f0f] p-1.5 shadow-lg z-50">
            {docsItems.map(renderSubItem)}
          </div>
        )}
      </div>

    </>
  );

  return (
    <>
      {/* Desktop header */}
      <header className="hidden md:flex items-center bg-white dark:bg-[#110f0f] px-6 py-4 sticky top-0 z-50">
        <Link href="/" prefetch={false} onClick={closeAll} className="flex items-center shrink-0">
          <img src={logoSrc} alt="Igris Inertial" className="h-8 w-auto rounded-lg" />
        </Link>

        <nav className="flex items-center gap-6 ml-10">{NavGroups}</nav>
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
