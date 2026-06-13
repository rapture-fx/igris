'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useTheme } from 'next-themes';


const NAV_FONT = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO_FONT = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace';

const NAV_ITEM_STYLE: React.CSSProperties = {
  fontFamily: NAV_FONT,
  fontSize: '11px',
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
  { label: 'Run', description: 'Turn agent decisions into controlled actions with recorded progress.', href: '/#product' },
  { label: 'Recover', description: 'Resume from recorded progress — committed actions never replay.', href: '/#product' },
  { label: 'Verify', description: 'Signed receipts and a chain you can check after the run.', href: '/#product' },
  { label: 'Inspect', description: 'Operator-readable evidence without raw payloads.', href: '/#product' },
];

const docsItems: DropdownItem[] = [
  { label: 'Getting Started', description: 'Run your first verified execution path.', href: 'https://docs.igrisinertial.com/docs/', external: true },
  { label: 'API Reference', description: 'Endpoints, request format, and response fields.', href: 'https://docs.igrisinertial.com/docs/api-reference/', external: true },
  { label: 'SDKs', description: 'JavaScript, Python, Go, Rust, and cURL examples.', href: 'https://docs.igrisinertial.com/docs/sdk/', external: true },
  { label: 'Receipt Verification', description: 'Understand signed records and verification.', href: 'https://docs.igrisinertial.com/docs/verification/', external: true },
  { label: 'Architecture', description: 'How Igris governs execution across environments.', href: 'https://docs.igrisinertial.com/docs/architecture/', external: true },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [consoleUrl, setConsoleUrl] = useState('https://console.igrisinertial.com');

  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setConsoleUrl('http://localhost:3005');
    } else {
      setConsoleUrl('https://console.igrisinertial.com');
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  // Close desktop dropdowns on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setProductOpen(false);
        setDocsOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const closeAll = () => {
    setMobileOpen(false);
    setProductOpen(false);
    setDocsOpen(false);
  };

  const DesktopDropdownPanel = (items: DropdownItem[]) => (
    <div className="absolute left-0 top-full mt-2 w-48 rounded-lg bg-white dark:bg-[#161313] border border-gray-200 dark:border-white/[0.12] shadow-lg shadow-gray-200/40 dark:shadow-black/40 p-1.5 z-50">
      {items.map((item) =>
        item.external ? (
          <a
            key={item.label}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={closeAll}
            className="block rounded-md px-3 py-1.5 text-gray-700 dark:text-[#f6f6f4] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
            style={NAV_ITEM_STYLE}
          >
            {item.label}
          </a>
        ) : (
          <Link
            key={item.label}
            href={item.href}
            prefetch={false}
            onClick={closeAll}
            className="block rounded-md px-3 py-1.5 text-gray-700 dark:text-[#f6f6f4] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
            style={NAV_ITEM_STYLE}
          >
            {item.label}
          </Link>
        ),
      )}
    </div>
  );

  return (
    <>
      {/* Top navigation bar — fixed, full width */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-dark-bg/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">

            {/* Logo */}
            <Link href="/" prefetch={false} onClick={closeAll} className="flex items-center">
              <img
                src={mounted && theme === 'dark' ? '/inertiadm.png' : '/inertia.png'}
                alt="Igris Inertial"
                className="h-7 w-auto rounded-lg"
              />
            </Link>

            {/* Desktop nav */}
            <nav ref={navRef} className="hidden md:flex items-center gap-1">
              {/* Product */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setProductOpen((v) => !v); setDocsOpen(false); }}
                  className="flex items-center gap-1 rounded-md px-3 py-1.5 text-gray-700 dark:text-[#f6f6f4] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
                  style={NAV_ITEM_STYLE}
                >
                  <span>Product</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${productOpen ? 'rotate-180' : ''}`} />
                </button>
                {productOpen && DesktopDropdownPanel(productItems)}
              </div>

              {/* Docs */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setDocsOpen((v) => !v); setProductOpen(false); }}
                  className="flex items-center gap-1 rounded-md px-3 py-1.5 text-gray-700 dark:text-[#f6f6f4] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
                  style={NAV_ITEM_STYLE}
                >
                  <span>Docs</span>
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${docsOpen ? 'rotate-180' : ''}`} />
                </button>
                {docsOpen && DesktopDropdownPanel(docsItems)}
              </div>

              {/* Pricing */}
              <Link
                href="/pricing"
                prefetch={false}
                onClick={closeAll}
                className="rounded-md px-3 py-1.5 text-gray-700 dark:text-[#f6f6f4] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
                style={NAV_ITEM_STYLE}
              >
                Pricing
              </Link>

              <span className="mx-1 h-4 w-px bg-gray-300 dark:bg-white/[0.12]" />

              {/* Sign in */}
              <a
                href={`${consoleUrl}/auth?mode=signin`}
                onClick={closeAll}
                className="rounded-md px-3 py-1.5 text-gray-700 dark:text-[#f6f6f4] hover:bg-gray-100 dark:hover:bg-white/[0.08] transition-colors"
                style={NAV_ITEM_STYLE}
              >
                Sign in
              </a>

              <a
                href={`${consoleUrl}/auth?mode=signup`}
                onClick={closeAll}
                className="rounded-xl px-3.5 py-1.5 bg-gray-900 dark:bg-[#f6f6f4] text-white dark:text-[#010203] hover:opacity-80 transition-opacity"
                style={NAV_ITEM_STYLE}
              >
                Create your first action
              </a>
            </nav>

            {/* Mobile toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-gray-500 dark:text-[#c8c8b8]"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 pt-14 bg-white dark:bg-[#010203] overflow-y-auto">
          <nav className="flex flex-col px-5 py-6">
            <a
              href={`${consoleUrl}/auth?mode=signin`}
              onClick={closeAll}
              className="block w-full py-2 text-gray-700 dark:text-[#f6f6f4] hover:opacity-70 transition-opacity"
              style={NAV_ITEM_STYLE}
            >
              Sign in
            </a>

            <Link
              href="/pricing"
              prefetch={false}
              onClick={closeAll}
              className="block w-full py-2 text-gray-700 dark:text-[#f6f6f4] hover:opacity-70 transition-opacity"
              style={NAV_ITEM_STYLE}
            >
              Pricing
            </Link>

            {/* Product accordion */}
            <button
              type="button"
              onClick={() => setProductOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 py-2 text-gray-700 dark:text-[#f6f6f4] hover:opacity-70 transition-opacity"
              style={NAV_ITEM_STYLE}
            >
              <span>Product</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${productOpen ? 'rotate-180' : ''}`} />
            </button>
            {productOpen && (
              <div className="mb-2 pl-3 border-l border-gray-200 dark:border-white/[0.12]">
                {productItems.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    prefetch={false}
                    onClick={closeAll}
                    className="block w-full py-1.5 text-[13px] text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors"
                    style={{ fontFamily: NAV_FONT }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Docs accordion */}
            <button
              type="button"
              onClick={() => setDocsOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 py-2 text-gray-700 dark:text-[#f6f6f4] hover:opacity-70 transition-opacity"
              style={NAV_ITEM_STYLE}
            >
              <span>Docs</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${docsOpen ? 'rotate-180' : ''}`} />
            </button>
            {docsOpen && (
              <div className="mb-2 pl-3 border-l border-gray-200 dark:border-white/[0.12]">
                {docsItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={closeAll}
                    className="block w-full py-1.5 text-[13px] text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors"
                    style={{ fontFamily: NAV_FONT }}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            )}

            <a
              href={`${consoleUrl}/auth?mode=signup`}
              onClick={closeAll}
               className="mt-4 inline-flex items-center justify-center w-full rounded-xl px-4 py-2.5 bg-gray-900 dark:bg-[#f6f6f4] text-white dark:text-[#010203] hover:opacity-80 transition-opacity"
              style={NAV_ITEM_STYLE}
            >
              Create your first action
            </a>
          </nav>
        </div>
      )}
    </>
  );
}
