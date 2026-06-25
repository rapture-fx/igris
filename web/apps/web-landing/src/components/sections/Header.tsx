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

  const sideLinkClass =
    'block rounded-md px-3 py-2 text-black dark:text-[#f6f6f4] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors';
  const sideToggleClass =
    'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-black dark:text-[#f6f6f4] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors';
  const subLinkClass =
    'block rounded-md px-3 py-1.5 text-[13px] text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors';

  const renderSubItem = (item: DropdownItem) =>
    item.external ? (
      <a
        key={item.label}
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={closeAll}
        className={subLinkClass}
        style={{ fontFamily: NAV_FONT }}
      >
        {item.label}
      </a>
    ) : (
      <LandingSectionLink
        key={item.label}
        href={item.href}
        onClick={closeAll}
        className={subLinkClass}
        style={{ fontFamily: NAV_FONT }}
      >
        {item.label}
      </LandingSectionLink>
    );

  const NavGroups = (
    <>
      {/* Product */}
      <button type="button" onClick={() => setProductOpen((v) => !v)} className={sideToggleClass} style={NAV_ITEM_STYLE}>
        <span>Product</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${productOpen ? 'rotate-180' : ''}`} />
      </button>
      {productOpen && (
        <div className="mb-1 ml-3 flex flex-col border-l border-gray-200 dark:border-white/[0.12] pl-1">
          {productItems.map(renderSubItem)}
        </div>
      )}

      {/* Docs */}
      <button type="button" onClick={() => setDocsOpen((v) => !v)} className={sideToggleClass} style={NAV_ITEM_STYLE}>
        <span>Docs</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${docsOpen ? 'rotate-180' : ''}`} />
      </button>
      {docsOpen && (
        <div className="mb-1 ml-3 flex flex-col border-l border-gray-200 dark:border-white/[0.12] pl-1">
          {docsItems.map(renderSubItem)}
        </div>
      )}

      {/* Pricing */}
      <Link href="/pricing" prefetch={false} onClick={closeAll} className={sideLinkClass} style={NAV_ITEM_STYLE}>
        Pricing
      </Link>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex fixed inset-y-0 left-0 z-50 flex-col border-r border-[#ebebeb] dark:border-white/[0.08] bg-white dark:bg-[#110f0f] px-5 py-8"
        style={{ width: SIDEBAR_WIDTH }}
      >
        <Link href="/" prefetch={false} onClick={closeAll} className="flex items-center px-1">
          <img src={logoSrc} alt="Igris Inertial" className="h-10 w-auto rounded-lg" />
        </Link>

        <nav className="mt-10 flex flex-col gap-0.5">{NavGroups}</nav>
      </aside>

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
