'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown, Sun, Moon, Frame } from 'lucide-react';
import { useTheme } from 'next-themes';
type DropdownKey = 'product' | 'docs' | 'usecases' | 'resources' | null;

const NAV_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const NAV_ITEM_CLS = (active: boolean) =>
  `px-3 py-1.5 text-sm font-medium flex items-center gap-1 transition-all duration-200 rounded-md ${
    active
      ? 'text-gray-900 dark:text-[#f6f6f4] bg-black/[0.05] dark:bg-white/[0.08]'
      : 'text-gray-600 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
  }`;

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
  const [mobileUseCasesOpen, setMobileUseCasesOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);

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
    setMobileUseCasesOpen(false);
    setMobileResourcesOpen(false);
  };

  const isDark = mounted && theme === 'dark';

  // --- Dropdown data ---

  const productItems: DropdownItem[] = [
    { label: 'Verifiable Execution', description: 'Run AI tasks with signed execution records.', href: '/#verifiable-execution' },
    { label: 'Governed Runs', description: 'Apply boundaries, permissions, and controlled task execution.', href: '/#governed-runs' },
    { label: 'Failure-Aware Execution', description: 'Make fallback paths and failures visible.', href: '/#failure-aware-execution' },
    { label: 'Structured Execution', description: 'Use defined paths for agents, workflows, and edge systems.', href: '/#structured-execution' },
    { label: 'Edge & Local Execution', description: 'Run closer to the environment where work happens.', href: '/#edge-local-execution' },
    { label: 'Signed Receipts', description: 'Verify what happened after a critical run.', href: '/#signed-receipts' },
  ];

  const docsItems: DropdownItem[] = [
    { label: 'Getting Started', description: 'Install and run the first local proof demo.', href: `${docsHubUrl}/docs/getting-started/`, external: true },
    { label: 'API Reference', description: 'Endpoints, request format, and response fields.', href: `${docsHubUrl}/docs/api-reference/`, external: true },
    { label: 'SDKs', description: 'JavaScript, Python, Go, Rust, and cURL examples.', href: `${docsHubUrl}/docs/sdk/`, external: true },
    { label: 'Proof Demo', description: 'Run the unified execution proof locally.', href: `${docsHubUrl}/docs/proof-demo/`, external: true },
    { label: 'Receipt Verification', description: 'Understand signed records and verification.', href: `${docsHubUrl}/docs/receipt-verification/`, external: true },
    { label: 'Architecture', description: 'How Igris governs execution across environments.', href: `${docsHubUrl}/docs/architecture/`, external: true },
  ];

  const useCasesItems: DropdownItem[] = [
    { label: 'AI Agents', description: 'Control, inspect, and verify tool-calling agents.', href: '/ai-agents' },
    { label: 'Internal Automation', description: 'Add execution records to AI-powered business workflows.', href: '/use-cases' },
    { label: 'Edge AI', description: 'Run AI closer to devices and local environments.', href: '/machine' },
    { label: 'Robotics Research', description: 'Explore governed execution paths for physical systems.', href: '/robotics' },
    { label: 'Regulated Workflows', description: 'Create auditable records for sensitive AI runs.', href: '/use-cases' },
  ];

  const resourcesItems: DropdownItem[] = [
    { label: 'Proof Status', description: 'What is proven today and what is still in progress.', href: '/#proof' },
    { label: 'Private Demo', description: 'See Igris run a verified execution path.', href: '/#how-it-works' },
    { label: 'Roadmap', description: 'What is being validated next.', href: '/#product' },
    { label: 'Changelog', description: 'Product updates and proof milestones.', href: '/#product' },
    { label: 'Blog', description: 'Technical notes and implementation updates.', href: '/blog' },
  ];

  // --- Item renderer ---

  const renderDropdownItem = (item: DropdownItem) => {
    const inner = (
      <div className="flex items-start gap-2.5">
        <div className="flex-shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#2a2a2a]">
          <Frame className="h-3 w-3 text-gray-500 dark:text-[#a8a898]" strokeWidth={1.5} />
        </div>
        <div>
          <span className="block text-xs font-medium text-[#1b1912] dark:text-[#f6f6f4] mb-0.5 group-hover:text-gray-700 dark:group-hover:text-[#e8e8e0] transition-colors" style={{ fontFamily: NAV_FONT }}>{item.label}</span>
          <span className="block text-xs text-gray-500 dark:text-[#a8a898] leading-snug" style={{ fontFamily: NAV_FONT }}>{item.description}</span>
        </div>
      </div>
    );
    const cls = 'group block rounded-lg px-3 py-2.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors';
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
    <div className="p-4 grid grid-cols-2 gap-x-3 gap-y-0.5">
      {items.map(renderDropdownItem)}
    </div>
  );

  return (
    <>
      <header className="fixed top-0 left-0 w-full z-50">
        {/* Full-width background */}
        <div
          className={`absolute inset-0 transition-all duration-300 ${
            isScrolled
              ? 'backdrop-blur-md bg-[rgba(255,255,255,0.85)] dark:bg-[rgba(27,25,18,0.85)]'
              : 'bg-white dark:bg-[#1b1912]'
          }`}
          style={{ borderBottom: 'none' }}
        />

        <div className="relative mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
          {/* Nav bar + dropdown wrapper */}
          <div onMouseLeave={scheduleClose} className="-mx-5">

            {/* Nav bar */}
            <div className="w-full px-5 bg-transparent" style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
              <div className="flex items-center justify-between w-full px-4 md:px-8 lg:px-12 relative">

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
                <div className="hidden md:flex items-center space-x-1 absolute left-1/2 -translate-x-1/2">
                  {(
                    [
                      { key: 'product', label: 'Product' },
                      { key: 'docs', label: 'Docs' },
                      { key: 'usecases', label: 'Use Cases' },
                      { key: 'resources', label: 'Resources' },
                    ] as { key: DropdownKey; label: string }[]
                  ).map(({ key, label }) => (
                    <button
                      key={key}
                      onMouseEnter={() => openDropdown(key)}
                      className={NAV_ITEM_CLS(activeDropdown === key)}
                      style={{ fontFamily: NAV_FONT }}
                    >
                      {label}
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${activeDropdown === key ? 'rotate-180' : ''}`} />
                    </button>
                  ))}

                  <Link
                    href="/pricing"
                    prefetch={false}
                    onMouseEnter={scheduleClose}
                    className="px-3 py-1.5 text-gray-600 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-all duration-200 font-medium text-sm rounded-md"
                    style={{ fontFamily: NAV_FONT }}
                  >
                    Pricing
                  </Link>
                </div>

                {/* Desktop right */}
                <div className="hidden md:flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setTheme(isDark ? 'light' : 'dark')}
                    className="p-2 rounded-md hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors duration-200"
                    aria-label="Toggle theme"
                  >
                    {isDark ? (
                      <Sun className="h-4 w-4 text-[#f6f6f4]" />
                    ) : (
                      <Moon className="h-4 w-4 text-[#1b1912]" />
                    )}
                  </button>

                  <a
                    href={consoleUrl ? `${consoleUrl}/auth?mode=signin` : '#'}
                    onMouseEnter={scheduleClose}
                    className="inline-flex items-center justify-center px-3 py-1.5 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow rounded-md border bg-white dark:bg-[rgba(246,246,244,0.08)] text-[#1b1912] dark:text-[#f6f6f4] border-[rgba(20,18,10,0.1)] dark:border-[rgba(246,246,244,0.12)]"
                    style={{ fontFamily: NAV_FONT }}
                  >
                    Sign In
                  </a>

                  <a
                    href={consoleUrl ? `${consoleUrl}/auth?mode=signup` : '#'}
                    onMouseEnter={scheduleClose}
                    className="inline-flex items-center justify-center px-3 py-1.5 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-lg rounded-md bg-[#1b1912] dark:bg-[#f6f6f4] text-[#f6f6f4] dark:text-[#1b1912]"
                    style={{ fontFamily: NAV_FONT }}
                  >
                    Get Started
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
                style={{ maxWidth: '600px', width: '100%', zIndex: 50, paddingTop: '8px' }}
                onMouseEnter={cancelClose}
              >
                <div
                  className={`border shadow-[0_4px_24px_rgba(0,0,0,0.08)] rounded-xl transition-all duration-300 ease-out ${
                    isDropdownVisible ? 'opacity-100 max-h-[400px]' : 'opacity-0 max-h-0'
                  }`}
                  style={{
                    overflow: 'hidden',
                    backgroundColor: isDark ? '#26241d' : '#f9f9fa',
                    borderColor: isDark ? 'rgba(246, 246, 244, 0.08)' : 'rgba(229, 231, 235, 1)',
                  }}
                >
                  {renderedDropdown === 'product' && renderGrid(productItems)}
                  {renderedDropdown === 'docs' && renderGrid(docsItems)}
                  {renderedDropdown === 'usecases' && renderGrid(useCasesItems)}
                  {renderedDropdown === 'resources' && renderGrid(resourcesItems)}
                </div>
              </div>
            )}
          </div>

          {/* Mobile menu overlay */}
          {mobileMenuOpen && (
            <div className="md:hidden fixed inset-0 top-0 z-50 bg-white dark:bg-[#1b1912] overflow-y-auto overscroll-contain">
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

                {/* Use Cases */}
                <div>
                  <button
                    onClick={() => setMobileUseCasesOpen(!mobileUseCasesOpen)}
                    className="w-full flex items-center justify-between text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm"
                    style={{ fontFamily: NAV_FONT }}
                  >
                    Use Cases
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobileUseCasesOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileUseCasesOpen && (
                    <div className="ml-4 mt-3 space-y-3">
                      {useCasesItems.map((item) => (
                        <Link key={item.label} href={item.href} prefetch={false} onClick={closeMobileAll} className="block text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm" style={{ fontFamily: NAV_FONT }}>
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resources */}
                <div>
                  <button
                    onClick={() => setMobileResourcesOpen(!mobileResourcesOpen)}
                    className="w-full flex items-center justify-between text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm"
                    style={{ fontFamily: NAV_FONT }}
                  >
                    Resources
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobileResourcesOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileResourcesOpen && (
                    <div className="ml-4 mt-3 space-y-3">
                      {resourcesItems.map((item) => (
                        <Link key={item.label} href={item.href} prefetch={false} onClick={closeMobileAll} className="block text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm" style={{ fontFamily: NAV_FONT }}>
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <Link href="/pricing" prefetch={false} className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm" style={{ fontFamily: NAV_FONT }} onClick={closeMobileAll}>Pricing</Link>
                <a href={consoleUrl ? `${consoleUrl}/auth?mode=signin` : '#'} className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm" style={{ fontFamily: NAV_FONT }} onClick={closeMobileAll}>Sign In</a>
                <a href={consoleUrl ? `${consoleUrl}/auth?mode=signup` : '#'} onClick={closeMobileAll} className="inline-flex items-center justify-center px-4 py-2 hover:opacity-80 transition-all duration-200 text-sm font-medium shadow-sm rounded-md" style={{ fontFamily: NAV_FONT, backgroundColor: '#14120a', color: '#f6f6f4' }}>Get Started</a>
              </nav>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
