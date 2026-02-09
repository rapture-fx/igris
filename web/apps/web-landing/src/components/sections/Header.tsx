'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useModal } from '../../contexts/ModalContext';
import { useProductPopup } from '../../contexts/ProductPopupContext';

type DropdownKey = 'features' | 'resources' | null;

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false);
  const [docsHubUrl, setDocsHubUrl] = useState('https://docs.igrisinertial.com/');
  const [consoleUrl, setConsoleUrl] = useState('https://admin.igris-inertial.com');
  const [isScrolled, setIsScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<DropdownKey>(null);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [renderedDropdown, setRenderedDropdown] = useState<DropdownKey>(null);
  const [slideFrom, setSlideFrom] = useState<'left' | 'right' | 'none'>('none');
  const { openEarlyAccessModal } = useModal();
  const { theme } = useTheme();
  const { openOverture, openRuntime, openUseCases } = useProductPopup();
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevDropdownRef = useRef<DropdownKey>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setDocsHubUrl('http://localhost:3001');
      setConsoleUrl('http://localhost:3005');
    } else {
      setDocsHubUrl('https://docs.igrisinertial.com/');
      setConsoleUrl('https://admin.igris-inertial.com');
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Animate dropdown open/close
  useEffect(() => {
    if (activeDropdown) {
      // Determine slide direction when switching
      const prev = prevDropdownRef.current;
      if (prev && prev !== activeDropdown) {
        setSlideFrom(activeDropdown === 'resources' ? 'right' : 'left');
      } else {
        setSlideFrom('none');
      }
      prevDropdownRef.current = activeDropdown;
      setRenderedDropdown(activeDropdown);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsDropdownVisible(true);
        });
      });
    } else {
      prevDropdownRef.current = null;
      setIsDropdownVisible(false);
      const timeout = setTimeout(() => {
        setRenderedDropdown(null);
        setSlideFrom('none');
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [activeDropdown]);

  // Update rendered content when switching between dropdowns while open
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
    closeTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 200);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const isDark = mounted && theme === 'dark';
  // isFloating tracks the VISUAL state (stays true during close animation)
  const isFloating = renderedDropdown !== null || activeDropdown !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-all duration-300 ${
          isFloating
            ? 'bg-black/20 backdrop-blur-sm pointer-events-auto'
            : 'bg-transparent backdrop-blur-none pointer-events-none'
        }`}
        onClick={() => setActiveDropdown(null)}
      />

      <header
        className="fixed top-0 left-0 w-full z-50"
      >
        {/* Full-width background + border - fades out when floating */}
        <div
          className={`absolute inset-0 transition-all duration-300 ${
            isFloating
              ? 'opacity-0'
              : isScrolled
                ? 'opacity-100 backdrop-blur-md bg-[rgba(246,246,244,0.85)] dark:bg-[rgba(27,25,18,0.85)]'
                : 'opacity-100 bg-[#f6f6f4] dark:bg-[#1b1912]'
          }`}
          style={{ borderBottom: '0.5px solid #d1d5db' }}
        />

        <div className="relative mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
          {/* Nav bar + dropdown wrapper */}
          <div
            onMouseLeave={scheduleClose}
          >
            {/* Top spacing when floating */}
            <div
              className={`transition-all duration-300 ${
                isFloating ? 'h-3' : 'h-0'
              }`}
            />

            {/* Nav bar inner content */}
            <div
              className={`px-4 md:px-8 lg:px-12 flex items-center justify-between w-full transition-all duration-300 ${
                isFloating
                  ? 'bg-[#f6f6f4] dark:bg-[#1b1912] shadow-[0_4px_24px_rgba(0,0,0,0.08)] rounded-t-xl'
                  : 'bg-transparent'
              }`}
              style={{
                paddingTop: '1.5rem',
                paddingBottom: '1.5rem',
              }}
            >
              <div className="flex">
                <Link href="/" prefetch={false}>
                  <img
                    src={isDark ? '/dmfoot.png' : '/foot.png'}
                    alt="Igris Inertial"
                    className="h-10 w-auto"
                  />
                </Link>
              </div>

              <div className="hidden md:flex items-center space-x-6">
                <button
                  onMouseEnter={() => openDropdown('features')}
                  className={`text-sm font-medium flex items-center gap-1 transition-colors duration-200 ${
                    activeDropdown === 'features'
                      ? 'text-gray-900 dark:text-[#f6f6f4]'
                      : 'text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4]'
                  }`}
                  style={{ fontFamily: 'var(--font-geist-sans)' }}
                >
                  Feature
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${activeDropdown === 'features' ? 'rotate-180' : ''}`} />
                </button>

                <button
                  onMouseEnter={() => openDropdown('resources')}
                  className={`text-sm font-medium flex items-center gap-1 transition-colors duration-200 ${
                    activeDropdown === 'resources'
                      ? 'text-gray-900 dark:text-[#f6f6f4]'
                      : 'text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4]'
                  }`}
                  style={{ fontFamily: 'var(--font-geist-sans)' }}
                >
                  Resources
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${activeDropdown === 'resources' ? 'rotate-180' : ''}`} />
                </button>

                <Link
                  href="/pricing"
                  prefetch={false}
                  onMouseEnter={scheduleClose}
                  className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm"
                  style={{ fontFamily: 'var(--font-geist-sans)' }}
                >
                  Pricing
                </Link>

                <a
                  href={consoleUrl ? `${consoleUrl}/auth?mode=signin` : '#'}
                  onMouseEnter={scheduleClose}
                  className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm"
                  style={{ fontFamily: 'var(--font-geist-sans)' }}
                >
                  Sign In
                </a>

                <a
                  href={consoleUrl ? `${consoleUrl}/auth?mode=signup` : '#'}
                  onMouseEnter={scheduleClose}
                  className="bg-[#14120a] text-white dark:bg-[#f6f6f4] dark:text-black px-4 py-2 hover:opacity-90 transition-all duration-200 text-xs shadow-md rounded-md inline-flex items-center justify-center"
                  style={{ fontFamily: 'var(--font-geist-sans)' }}
                >
                  Get Started
                </a>
              </div>

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

            {/* Dropdown container */}
            {renderedDropdown && (
              <div
                className="hidden md:block overflow-hidden"
                onMouseEnter={cancelClose}
              >
                <div
                  className={`bg-[#f6f6f4] dark:bg-[#1b1912] shadow-[0_4px_24px_rgba(0,0,0,0.08)] rounded-b-xl border-t border-gray-200 dark:border-[#f6f6f4]/5 transition-all duration-300 ease-out ${
                    isDropdownVisible
                      ? 'opacity-100 max-h-[400px]'
                      : 'opacity-0 max-h-0'
                  }`}
                  style={{ overflow: 'hidden' }}
                >
                  {/* Sliding content wrapper */}
                  <div className="relative overflow-hidden">
                    {/* Features content */}
                    <div
                      className="transition-all duration-300 ease-out"
                      style={{
                        transform: renderedDropdown === 'features'
                          ? 'translateX(0)'
                          : 'translateX(-100%)',
                        opacity: renderedDropdown === 'features' ? 1 : 0,
                        position: renderedDropdown === 'features' ? 'relative' : 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        pointerEvents: renderedDropdown === 'features' ? 'auto' : 'none',
                      }}
                    >
                      <div className="grid grid-cols-3 min-h-[280px]">
                        {/* Left column - image */}
                        <div className="p-8 border-r border-gray-200 dark:border-[#f6f6f4]/5 relative overflow-hidden">
                          <img src="/hov.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                        </div>

                        {/* Middle column - Routing & Optimization + Agents */}
                        <div className="p-8 border-r border-gray-200 dark:border-[#f6f6f4]/5">
                          <span className="text-xs font-medium text-gray-400 dark:text-[#a8a898] uppercase tracking-wider mb-3 block" style={{ fontFamily: 'var(--font-geist-sans)' }}>Routing & Optimization</span>
                          <div className="flex flex-col gap-1.5">
                            <span onClick={() => setActiveDropdown(null)} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Thompson Sampling</span>
                            <span onClick={() => setActiveDropdown(null)} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Speculative Execution</span>
                            <span onClick={() => setActiveDropdown(null)} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Council Mode</span>
                            <span onClick={() => setActiveDropdown(null)} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Cognitive Advisor</span>
                            <span onClick={() => setActiveDropdown(null)} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Adaptive Optimization</span>
                            <span onClick={() => setActiveDropdown(null)} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Provider Health & Failover</span>
                          </div>
                          <span className="text-xs font-medium text-gray-400 dark:text-[#a8a898] uppercase tracking-wider mt-5 mb-3 block" style={{ fontFamily: 'var(--font-geist-sans)' }}>Agents</span>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Planning Agents</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Reflection Agents</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Behavior Trees</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Multi-Agent Swarms</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Tool Execution</span>
                          </div>
                        </div>

                        {/* Right column - Infrastructure + Security */}
                        <div className="p-8">
                          <span className="text-xs font-medium text-gray-400 dark:text-[#a8a898] uppercase tracking-wider mb-3 block" style={{ fontFamily: 'var(--font-geist-sans)' }}>Infrastructure</span>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Local LLM Fallback</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>QLoRA On-Device Training</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Federated Learning</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>SLO Enforcer</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Fleet Management</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Model Management</span>
                          </div>
                          <span className="text-xs font-medium text-gray-400 dark:text-[#a8a898] uppercase tracking-wider mt-5 mb-3 block" style={{ fontFamily: 'var(--font-geist-sans)' }}>Security & Resilience</span>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Shadow Mode</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>EscapeVector</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Gold Code</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: 'var(--font-geist-sans)' }}>Cryptographic Signing</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Resources content */}
                    <div
                      className="transition-all duration-300 ease-out"
                      style={{
                        transform: renderedDropdown === 'resources'
                          ? 'translateX(0)'
                          : 'translateX(100%)',
                        opacity: renderedDropdown === 'resources' ? 1 : 0,
                        position: renderedDropdown === 'resources' ? 'relative' : 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        pointerEvents: renderedDropdown === 'resources' ? 'auto' : 'none',
                      }}
                    >
                      <div className="grid grid-cols-3">
                        <a
                          href={docsHubUrl}
                          onClick={() => setActiveDropdown(null)}
                          className="p-8 border-r border-gray-200 dark:border-[#f6f6f4]/5 flex items-end min-h-[280px] relative overflow-hidden group/card"
                        >
                          <div className="absolute inset-0 p-1">
                            <img src="/dc.png" alt="" className="w-full h-full object-cover opacity-20 group-hover/card:opacity-40 transition-opacity duration-300" />
                          </div>
                          <div className="relative z-10">
                            <span className="text-sm font-normal text-gray-900 dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-sans)' }}>Documentation</span>
                            <p className="text-xs text-gray-500 dark:text-[#a8a898] mt-1" style={{ fontFamily: 'var(--font-geist-sans)' }}>Guides and API reference</p>
                          </div>
                        </a>

                        <button
                          onClick={() => { setActiveDropdown(null); openUseCases(); }}
                          className="p-8 border-r border-gray-200 dark:border-[#f6f6f4]/5 flex items-end min-h-[280px] text-left w-full relative overflow-hidden group/card"
                        >
                          <div className="absolute inset-0 p-1">
                            <img src="/uc.png" alt="" className="w-full h-full object-cover opacity-20 group-hover/card:opacity-40 transition-opacity duration-300" />
                          </div>
                          <div className="relative z-10">
                            <span className="text-sm font-normal text-gray-900 dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-sans)' }}>Use Cases</span>
                            <p className="text-xs text-gray-500 dark:text-[#a8a898] mt-1" style={{ fontFamily: 'var(--font-geist-sans)' }}>Real-world deployments</p>
                          </div>
                        </button>

                        <Link
                          href="/blog"
                          prefetch={false}
                          onClick={() => setActiveDropdown(null)}
                          className="p-8 flex items-end min-h-[280px] relative overflow-hidden group/card"
                        >
                          <div className="absolute inset-0 p-1">
                            <img src="/exc.png" alt="" className="w-full h-full object-cover opacity-20 group-hover/card:opacity-40 transition-opacity duration-300" />
                          </div>
                          <div className="relative z-10">
                            <span className="text-sm font-normal text-gray-900 dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-sans)' }}>Blog</span>
                            <p className="text-xs text-gray-500 dark:text-[#a8a898] mt-1" style={{ fontFamily: 'var(--font-geist-sans)' }}>Updates and insights</p>
                          </div>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-gray-200 dark:border-[#f6f6f4]/5 bg-[#f6f6f4] dark:bg-[#1b1912]">
              <nav className="flex flex-col space-y-4 mt-4 px-4">
                <div>
                  <button
                    onClick={() => setMobileFeaturesOpen(!mobileFeaturesOpen)}
                    className="w-full flex items-center justify-between text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs"
                    style={{ fontFamily: 'var(--font-geist-sans)' }}
                  >
                    Feature
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobileFeaturesOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileFeaturesOpen && (
                    <div className="ml-4 mt-2 space-y-2">
                      <button onClick={() => { setMobileMenuOpen(false); setMobileFeaturesOpen(false); openRuntime(); }} className="block text-left text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs" style={{ fontFamily: 'var(--font-geist-sans)' }}>Runtime</button>
                      <button onClick={() => { setMobileMenuOpen(false); setMobileFeaturesOpen(false); openOverture(); }} className="block text-left text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs" style={{ fontFamily: 'var(--font-geist-sans)' }}>Overture</button>
                      <button onClick={() => { setMobileMenuOpen(false); setMobileFeaturesOpen(false); openUseCases(); }} className="block text-left text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs" style={{ fontFamily: 'var(--font-geist-sans)' }}>Use Cases</button>
                    </div>
                  )}
                </div>

                <div>
                  <button
                    onClick={() => setMobileResourcesOpen(!mobileResourcesOpen)}
                    className="w-full flex items-center justify-between text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs"
                    style={{ fontFamily: 'var(--font-geist-sans)' }}
                  >
                    Resources
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobileResourcesOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileResourcesOpen && (
                    <div className="ml-4 mt-2 space-y-2">
                      <a href={docsHubUrl} className="block text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs" style={{ fontFamily: 'var(--font-geist-sans)' }} onClick={() => { setMobileMenuOpen(false); setMobileResourcesOpen(false); }}>Documentation</a>
                      <button onClick={() => { setMobileMenuOpen(false); setMobileResourcesOpen(false); openUseCases(); }} className="block text-left text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs" style={{ fontFamily: 'var(--font-geist-sans)' }}>Use Cases</button>
                      <Link href="/blog" prefetch={false} className="block text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs" style={{ fontFamily: 'var(--font-geist-sans)' }} onClick={() => { setMobileMenuOpen(false); setMobileResourcesOpen(false); }}>Blog</Link>
                    </div>
                  )}
                </div>

                <Link href="/pricing" prefetch={false} className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs" style={{ fontFamily: 'var(--font-geist-sans)' }} onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
                <a href={consoleUrl ? `${consoleUrl}/auth?mode=signin` : '#'} className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs" style={{ fontFamily: 'var(--font-geist-sans)' }} onClick={() => setMobileMenuOpen(false)}>Sign In</a>
                <a href={consoleUrl ? `${consoleUrl}/auth?mode=signup` : '#'} onClick={() => setMobileMenuOpen(false)} className="bg-black text-white dark:bg-[#f6f6f4] dark:text-black px-3 py-1.5 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 text-xs shadow-md inline-block text-center" style={{ fontFamily: 'var(--font-geist-sans)' }}>Get Started</a>
              </nav>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
