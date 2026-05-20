'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useTheme } from 'next-themes';


const NAV_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO_FONT = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace';

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

  const { theme } = useTheme();

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
    <div className="flex flex-col h-full w-full">
      {/* Logo */}
      <div className="pl-5 pr-8 pt-8 md:pt-10 pb-6 flex justify-end">
        <Link href="/" prefetch={false} onClick={() => setMobileOpen(false)}>
          <img
            src={isDark ? '/inertiadm.png' : '/inertia.png'}
            alt="Igris Inertial"
            className="h-7 w-auto rounded-lg"
          />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto pl-3 pr-8 text-right">
        <a
          href={`${consoleUrl}/auth?mode=signin`}
          onClick={() => setMobileOpen(false)}
          className="block w-full py-1.5 text-black dark:text-[#f6f6f4] hover:opacity-70 transition-opacity"
          style={NAV_ITEM_STYLE}
        >
          Sign in
        </a>

        <Link
          href="/pricing"
          prefetch={false}
          onClick={() => setMobileOpen(false)}
          className="block w-full py-1.5 text-black dark:text-[#f6f6f4] hover:opacity-70 transition-opacity"
          style={NAV_ITEM_STYLE}
        >
          Pricing
        </Link>

        {/* Product accordion */}
        <button
          type="button"
          onClick={() => setProductOpen((v) => !v)}
          className="w-full flex items-center justify-end gap-2 py-1.5 text-black dark:text-[#f6f6f4] hover:opacity-70 transition-opacity"
          style={NAV_ITEM_STYLE}
        >
          <span>Product</span>
        </button>
        {productOpen && (
          <div className="mb-2 pr-2 border-r border-black/[0.08] dark:border-white/[0.08]">
            {productItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                prefetch={false}
                onClick={() => setMobileOpen(false)}
                className="block w-full pl-3 pr-0 py-1 text-[10px] text-gray-600 dark:text-[#a8a898] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors"
                style={{ fontFamily: NAV_FONT }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — fixed, doesn't scroll */}
      <aside
        className="igris-header igris-sidebar hidden md:flex fixed top-0 left-0 h-screen w-96 z-40 bg-white dark:bg-[#110f0f] border-r border-black/[0.08] dark:border-white/[0.08]"
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
