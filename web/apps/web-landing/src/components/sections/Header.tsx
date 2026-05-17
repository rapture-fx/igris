'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
type DropdownKey = 'product' | 'docs' | null;

const NAV_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO_FONT = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace';

const NAV_ITEM_CLS = (active: boolean) =>
  `px-2.5 py-1.5 flex items-center gap-1 transition-colors duration-200 ${
    active
      ? 'text-[#000000] dark:text-[#f6f6f4]'
      : 'text-gray-500 dark:text-[#8a8a7a] hover:text-[#000000] dark:hover:text-[#f6f6f4]'
  }`;

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

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileProductOpen, setMobileProductOpen] = useState(false);
  const [mobileDocsOpen, setMobileDocsOpen] = useState(false);

  const [docsHubUrl, setDocsHubUrl] = useState('https://docs.igrisinertial.com');
  const [consoleUrl, setConsoleUrl] = useState('https://console.igrisinertial.com');
  const [isScrolled, setIsScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [activeDropdown, setActiveDropdown] = useState<DropdownKey>(null);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [renderedDropdown, setRenderedDropdown] = useState<DropdownKey>(null);

  const { theme, setTheme } = useTheme();
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setDocsHubUrl('http://localhost:3001');
      setConsoleUrl('http://localhost:3005');
    } else {
      setDocsHubUrl('https://docs.igrisinertial.com');
      setConsoleUrl('https://console.igrisinertial.com');
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => { setIsScrolled(window.scrollY > 10); };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (activeDropdown) {
      setRenderedDropdown(activeDropdown);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { setIsDropdownVisible(true); });
      });
    } else {
      setIsDropdownVisible(false);
      const timeout = setTimeout(() => { setRenderedDropdown(null); }, 300);
      return () => clearTimeout(timeout);
    }
  }, [activeDropdown]);

  // Swap content instantly when switching between open dropdowns
  useEffect(() => {
    if (activeDropdown && isDropdownVisible) {
      setRenderedDropdown(activeDropdown);
    }
  }, [activeDropdown, isDropdownVisible]);

  const openDropdown = useCallback((key: DropdownKey) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setActiveDropdown(key);
  }, []);

  const scheduleClose = useCallback(() => {
    closeTimeoutRef.current = setTimeout(() => { setActiveDropdown(null); }, 200);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const closeMobileAll = () => {
    setMobileMenuOpen(false);
    setMobileProductOpen(false);
    setMobileDocsOpen(false);
  };

  const isDark = mounted && theme === 'dark';

  // --- Dropdown data ---

  const productItems: DropdownItem[] = [
    { label: 'Run', description: 'Turn agent decisions into controlled actions with recorded progress.', href: '/#product' },
    { label: 'Recover', description: 'Resume from recorded progress — committed actions never replay.', href: '/#product' },
    { label: 'Verify', description: 'Signed receipts and a chain you can check after the run.', href: '/#product' },
    { label: 'Inspect', description: 'Operator-readable evidence without raw payloads.', href: '/#product' },
  ];

  const docsItems: DropdownItem[] = [
    { label: 'Getting Started', description: 'Run your first verified execution path.', href: `https://docs.igrisinertial.com/docs/`, external: true },
    { label: 'API Reference', description: 'Endpoints, request format, and response fields.', href: `https://docs.igrisinertial.com/docs/api-reference/`, external: true },
    { label: 'SDKs', description: 'JavaScript, Python, Go, Rust, and cURL examples.', href: `https://docs.igrisinertial.com/docs/sdk/`, external: true },
    { label: 'Receipt Verification', description: 'Understand signed records and verification.', href: `https://docs.igrisinertial.com/docs/verification/`, external: true },
    { label: 'Architecture', description: 'How Igris governs execution across environments.', href: `https://docs.igrisinertial.com/docs/architecture/`, external: true },
  ];

  // --- Item renderer ---

  const renderDropdownItem = (item: DropdownItem) => {
    const inner = (
      <div className="flex items-start gap-2.5">
        <div>
          <span
            className="block text-[13px] text-[#000000] dark:text-[#f6f6f4] mb-0.5 group-hover:opacity-70 transition-opacity"
            style={{ fontFamily: NAV_FONT, fontWeight: 500, letterSpacing: '-0.005em' }}
          >
            {item.label}
          </span>
          <span
            className="block text-xs text-gray-500 dark:text-[#a8a898] leading-snug"
            style={{ fontFamily: NAV_FONT }}
          >
            {item.description}
          </span>
        </div>
      </div>
    );
    const cls = 'group block px-4 py-3 transition-colors';
    if (item.external) {
      return (
        <a key={item.label} href={item.href} className={cls} onClick={() => setActiveDropdown(null)}>
          {inner}
        </a>
      );
    }
    return (
      <Link key={item.label} href={item.href} prefetch={false} className={cls} onClick={() => setActiveDropdown(null)}>
        {inner}
      </Link>
    );
  };

  const renderGrid = (items: DropdownItem[]) => (
    <div className="grid grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          {renderDropdownItem(item)}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <header className="igris-header fixed top-0 left-0 w-full z-50">
        {/* Full-width background */}
        <div
          className={`absolute inset-0 transition-all duration-300 ${
            isScrolled
              ? 'backdrop-blur-md bg-[rgba(255,255,255,0.85)] dark:bg-[rgba(17,15,15,0.85)]'
              : 'bg-transparent'
          }`}
          style={{ borderBottom: 'none' }}
        />

        <div className="relative mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
          {/* Nav bar + dropdown wrapper */}
          <div onMouseLeave={scheduleClose} className="-mx-5">

            {/* Nav bar */}
            <div className="w-full px-5 bg-transparent" style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
              <div className="flex items-center justify-between w-full px-2 md:px-4 lg:px-6 relative">

                {/* Logo */}
                <div className="flex">
                  <Link href="/" prefetch={false}>
                    <img
                      src={isDark ? '/inertiadm.png' : '/inertia.png'}
                      alt="Igris Inertial"
                      className="h-10 w-auto rounded-lg"
                    />
                  </Link>
                </div>

                {/* Desktop center nav */}
                <div className="hidden md:flex items-center gap-x-1 absolute left-1/2 -translate-x-1/2">
                  {(
                    [
                      { key: 'product', label: 'Product' },
                      { key: 'docs', label: 'Docs' },
                    ] as { key: DropdownKey; label: string }[]
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      onMouseEnter={() => openDropdown(key)}
                      className={NAV_ITEM_CLS(activeDropdown === key)}
                      style={NAV_ITEM_STYLE}
                    >
                      {label}
                      <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${activeDropdown === key ? 'rotate-180' : ''}`} />
                    </button>
                  ))}

                  <Link
                    href="/pricing"
                    prefetch={false}
                    onMouseEnter={scheduleClose}
                    className="px-2.5 py-1.5 text-gray-500 dark:text-[#8a8a7a] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors duration-200"
                    style={NAV_ITEM_STYLE}
                  >
                    Pricing
                  </Link>
                </div>

                {/* Desktop right */}
                <div className="hidden md:flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                    className="p-1.5 text-gray-500 dark:text-[#8a8a7a] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors duration-200"
                    aria-label="Toggle theme"
                  >
                    {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                  </button>

                  <a
                    href={consoleUrl ? `${consoleUrl}/auth?mode=signin` : '#'}
                    onMouseEnter={scheduleClose}
                    className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium rounded-xl border transition-opacity hover:opacity-80 bg-white text-[#1b1912] border-black/10 dark:bg-white/[0.06] dark:text-[#f6f6f4] dark:border-white/[0.12]"
                    style={{ fontFamily: NAV_FONT }}
                  >
                    Sign in
                  </a>

                  <a
                    href={consoleUrl ? `${consoleUrl}/auth?mode=signup` : '#'}
                    onMouseEnter={scheduleClose}
                    className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium rounded-xl transition-opacity hover:opacity-80 bg-[#1b1912] text-[#f6f6f4] dark:bg-[#f6f6f4] dark:text-[#1b1912]"
                    style={{ fontFamily: NAV_FONT }}
                  >
                    Get started
                  </a>
                </div>

                {/* Mobile hamburger */}
                <div className="md:hidden flex items-center">
                  <button
                    type="button"
                    className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-300"
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  >
                    {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop dropdown panel */}
            {renderedDropdown && (
              <div
                className="hidden md:block overflow-hidden absolute left-1/2 -translate-x-1/2"
                style={{ maxWidth: '640px', width: '100%', zIndex: 50, paddingTop: '4px' }}
                onMouseEnter={cancelClose}
              >
                <div
                  className={`transition-all duration-300 ease-out ${
                    isDropdownVisible ? 'opacity-100 max-h-[480px]' : 'opacity-0 max-h-0'
                  }`}
                  style={{
                    overflow: 'hidden',
                    backgroundColor: isDark ? '#110f0f' : '#ffffff',
                    borderTop: 'var(--section-border)',
                    borderBottom: 'var(--section-border)',
                    borderLeft: 'var(--section-border)',
                    borderRight: 'var(--section-border)',
                  }}
                >
                  <div className="flex items-baseline justify-between px-4 py-2" style={{ borderBottom: 'var(--section-border)' }}>
                    <span
                      className="text-gray-500 dark:text-[#8a8a7a]"
                      style={{ fontFamily: MONO_FONT, fontSize: '10px', letterSpacing: '0.22em' }}
                    >
                      {renderedDropdown === 'product' && 'PRODUCT'}
                      {renderedDropdown === 'docs' && 'DOCS'}
                    </span>
                    <span
                      className="text-gray-400 dark:text-[#5a5a52]"
                      style={{ fontFamily: MONO_FONT, fontSize: '10px', letterSpacing: '0.22em' }}
                    >
                      ↵ ESC
                    </span>
                  </div>
                  {renderedDropdown === 'product' && renderGrid(productItems)}
                  {renderedDropdown === 'docs' && renderGrid(docsItems)}
                </div>
              </div>
            )}
          </div>

          {/* Mobile menu overlay */}
          {mobileMenuOpen && (
            <div className="md:hidden fixed inset-0 top-0 z-50 bg-white dark:bg-[#110f0f] overflow-y-auto overscroll-contain">
              {/* Mobile header */}
              <div className="flex items-center justify-between px-4 sm:px-6" style={{ paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                <Link href="/" prefetch={false} onClick={closeMobileAll}>
                  <img
                    src={isDark ? '/inertiadm.png' : '/inertia.png'}
                    alt="Igris Inertial"
                    className="h-10 w-auto rounded-lg"
                  />
                </Link>
                <button
                  type="button"
                  className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-300"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex flex-col space-y-5 px-6 pt-4 pb-8">

                {/* Product */}
                <div>
                  <button
                    onClick={() => setMobileProductOpen(!mobileProductOpen)}
                    className="w-full flex items-center justify-between text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm"
                    style={{ fontFamily: NAV_FONT }}
                  >
                    Product
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobileProductOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileProductOpen && (
                    <div className="ml-4 mt-3 space-y-3">
                      {productItems.map((item) => (
                        <Link key={item.label} href={item.href} prefetch={false} onClick={closeMobileAll} className="block text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm" style={{ fontFamily: NAV_FONT }}>
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Docs */}
                <div>
                  <button
                    onClick={() => setMobileDocsOpen(!mobileDocsOpen)}
                    className="w-full flex items-center justify-between text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm"
                    style={{ fontFamily: NAV_FONT }}
                  >
                    Docs
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobileDocsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileDocsOpen && (
                    <div className="ml-4 mt-3 space-y-3">
                      {docsItems.map((item) => (
                        <a key={item.label} href={item.href} onClick={closeMobileAll} className="block text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm" style={{ fontFamily: NAV_FONT }}>
                          {item.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <Link href="/pricing" prefetch={false} className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm" style={{ fontFamily: NAV_FONT }} onClick={closeMobileAll}>Pricing</Link>
                <a href={consoleUrl ? `${consoleUrl}/auth?mode=signin` : '#'} className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm" style={{ fontFamily: NAV_FONT }} onClick={closeMobileAll}>Sign In</a>
                <a href={consoleUrl ? `${consoleUrl}/auth?mode=signup` : '#'} onClick={closeMobileAll} className="inline-flex items-center justify-center px-4 py-2 hover:opacity-80 transition-all duration-200 text-sm font-medium shadow-sm rounded-xl" style={{ fontFamily: NAV_FONT, backgroundColor: '#14120a', color: '#f6f6f4' }}>Get Started</a>
              </nav>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
