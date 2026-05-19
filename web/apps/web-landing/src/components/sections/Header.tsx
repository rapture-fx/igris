'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';

const NAV_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO_FONT = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace';

const NAV_ITEM_STYLE: React.CSSProperties = {
  fontFamily: MONO_FONT,
  fontSize: '11px',
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
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

  const [consoleUrl, setConsoleUrl] = useState('https://console.igrisinertial.com');
  const [mounted, setMounted] = useState(false);

  const { theme, setTheme } = useTheme();

  useEffect(() => { setMounted(true); }, []);

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

  const isDark = mounted && theme === 'dark';

  const SidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="pl-8 pr-5 pt-5 pb-6">
        <Link href="/" prefetch={false} onClick={() => setMobileOpen(false)}>
          <img
            src={isDark ? '/inertiadm.png' : '/inertia.png'}
            alt="Igris Inertial"
            className="h-10 w-auto rounded-lg"
          />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto pl-6 pr-3">
        {/* Product accordion */}
        <button
          type="button"
          onClick={() => setProductOpen((v) => !v)}
          className="w-full flex items-center justify-between px-2.5 py-2 text-gray-500 dark:text-[#8a8a7a] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors"
          style={NAV_ITEM_STYLE}
        >
          <span>Product</span>
          <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${productOpen ? 'rotate-180' : ''}`} />
        </button>
        {productOpen && (
          <div className="ml-2 mb-2 border-l border-black/[0.08] dark:border-white/[0.08]">
            {productItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                prefetch={false}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-1.5 text-[12px] text-gray-600 dark:text-[#a8a898] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors"
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
          className="w-full flex items-center justify-between px-2.5 py-2 text-gray-500 dark:text-[#8a8a7a] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors"
          style={NAV_ITEM_STYLE}
        >
          <span>Docs</span>
          <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${docsOpen ? 'rotate-180' : ''}`} />
        </button>
        {docsOpen && (
          <div className="ml-2 mb-2 border-l border-black/[0.08] dark:border-white/[0.08]">
            {docsItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-1.5 text-[12px] text-gray-600 dark:text-[#a8a898] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors"
                style={{ fontFamily: NAV_FONT }}
              >
                {item.label}
              </a>
            ))}
          </div>
        )}

        <Link
          href="/pricing"
          prefetch={false}
          onClick={() => setMobileOpen(false)}
          className="block px-2.5 py-2 text-gray-500 dark:text-[#8a8a7a] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors"
          style={NAV_ITEM_STYLE}
        >
          Pricing
        </Link>
      </nav>

      {/* Footer of sidebar: theme + auth */}
      <div className="pl-6 pr-3 pb-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.06] space-y-2">
        <button
          type="button"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="w-full flex items-center gap-2 px-2.5 py-2 text-gray-500 dark:text-[#8a8a7a] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors"
          style={NAV_ITEM_STYLE}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          <span>{isDark ? 'Light' : 'Dark'}</span>
        </button>

        <a
          href={`${consoleUrl}/auth?mode=signin`}
          onClick={() => setMobileOpen(false)}
          className="block text-center px-4 py-2 text-xs font-medium rounded-xl border transition-opacity hover:opacity-80 bg-white text-[#1b1912] border-black/10 dark:bg-white/[0.06] dark:text-[#f6f6f4] dark:border-white/[0.12]"
          style={{ fontFamily: NAV_FONT }}
        >
          Sign in
        </a>

        <a
          href={`${consoleUrl}/auth?mode=signup`}
          onClick={() => setMobileOpen(false)}
          className="block text-center px-4 py-2 text-xs font-medium rounded-xl transition-opacity hover:opacity-80 bg-[#1b1912] text-[#f6f6f4] dark:bg-[#f6f6f4] dark:text-[#1b1912]"
          style={{ fontFamily: NAV_FONT }}
        >
          Get started
        </a>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — fixed, doesn't scroll */}
      <aside
        className="igris-header hidden md:flex fixed top-0 left-0 h-screen w-60 z-40 bg-white dark:bg-[#110f0f] border-r border-black/[0.08] dark:border-white/[0.08]"
      >
        {SidebarContent}
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-white/85 dark:bg-[rgba(17,15,15,0.85)] backdrop-blur-md border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" prefetch={false}>
            <img
              src={isDark ? '/inertiadm.png' : '/inertia.png'}
              alt="Igris Inertial"
              className="h-9 w-auto rounded-lg"
            />
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-gray-700 dark:text-[#c8c8b8]"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 pt-14 bg-white dark:bg-[#110f0f] overflow-y-auto">
          {SidebarContent}
        </div>
      )}
    </>
  );
}
