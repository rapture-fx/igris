'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useModal } from '../../contexts/ModalContext';
import { useProductPopup } from '../../contexts/ProductPopupContext';

type DropdownKey = 'features' | 'resources' | null;

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const [mobileFeaturesOpen, setMobileFeaturesOpen] = useState(false);
  const [docsHubUrl, setDocsHubUrl] = useState('https://docs.igrisinertial.com/');
  const [consoleUrl, setConsoleUrl] = useState('https://console.igrisinertial.com');
  const [isScrolled, setIsScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<DropdownKey>(null);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [renderedDropdown, setRenderedDropdown] = useState<DropdownKey>(null);
  const [slideFrom, setSlideFrom] = useState<'left' | 'right' | 'none'>('none');
  const { openEarlyAccessModal } = useModal();
  const { theme, setTheme } = useTheme();
  const { openUseCases } = useProductPopup();
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
      setConsoleUrl('https://console.igrisinertial.com');
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

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
      <header
        className="fixed top-0 left-0 w-full z-50"
      >
        {/* Full-width background + border */}
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
          <div
            onMouseLeave={scheduleClose}
            className="-mx-5"
          >
            {/* Nav bar inner content — px-5 always keeps content aligned */}
            <div
              className="w-full px-5 bg-transparent"
              style={{
                paddingTop: '0.5rem',
                paddingBottom: '0.5rem',
              }}
            >
              {/* Inner padding matches hero content: px-4 md:px-8 lg:px-12 */}
              <div className="flex items-center justify-between w-full px-4 md:px-8 lg:px-12 relative">
                <div className="flex">
                  <Link href="/" prefetch={false}>
                    <img
                      src={isDark ? '/inertiadm.png' : '/inertia.png'}
                      alt="Igris Inertial"
                      className="h-10 w-auto rounded-lg"
                    />
                  </Link>
                </div>

                <div className="hidden md:flex items-center space-x-1 absolute left-1/2 -translate-x-1/2">
                  <button
                    onMouseEnter={() => openDropdown('features')}
                    className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1 transition-all duration-200 rounded-md ${
                      activeDropdown === 'features'
                        ? 'text-gray-900 dark:text-[#f6f6f4] bg-black/[0.05] dark:bg-white/[0.08]'
                        : 'text-gray-600 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
                    }`}
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                  >
                    Feature
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${activeDropdown === 'features' ? 'rotate-180' : ''}`} />
                  </button>

                  <button
                    onMouseEnter={() => openDropdown('resources')}
                    className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1 transition-all duration-200 rounded-md ${
                      activeDropdown === 'resources'
                        ? 'text-gray-900 dark:text-[#f6f6f4] bg-black/[0.05] dark:bg-white/[0.08]'
                        : 'text-gray-600 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-black/[0.05] dark:hover:bg-white/[0.08]'
                    }`}
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                  >
                    Resources
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${activeDropdown === 'resources' ? 'rotate-180' : ''}`} />
                  </button>

                  <Link
                    href="/pricing"
                    prefetch={false}
                    onMouseEnter={scheduleClose}
                    className="px-3 py-1.5 text-gray-600 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-all duration-200 font-medium text-sm rounded-md"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                  >
                    Pricing
                  </Link>
                </div>

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
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                  >
                    Sign In
                  </a>

                  <a
                    href={consoleUrl ? `${consoleUrl}/auth?mode=signup` : '#'}
                    onMouseEnter={scheduleClose}
                    className="inline-flex items-center justify-center px-3 py-1.5 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-lg rounded-md bg-[#1b1912] dark:bg-[#f6f6f4] text-[#f6f6f4] dark:text-[#1b1912]"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
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
            </div>

            {/* Dropdown container */}
            {renderedDropdown && (
              <div
                className="hidden md:block overflow-hidden absolute left-1/2 -translate-x-1/2"
                style={{ maxWidth: '600px', width: '100%', zIndex: 50 }}
                onMouseEnter={cancelClose}
              >
                <div
                  className={`bg-white dark:bg-[#1b1912] border border-gray-200 dark:border-gray-700 shadow-[0_4px_24px_rgba(0,0,0,0.08)] rounded-xl transition-all duration-300 ease-out ${
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
                      <div className="grid grid-cols-4">
                        {/* Col 1 - Routing & Optimization */}
                        <div className="p-6 ">
                          <span className="text-xs font-medium uppercase tracking-wider mb-3 block text-[#1b1912] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Routing & Optimization</span>
                          <div className="flex flex-col gap-1.5">
                            <span onClick={() => setActiveDropdown(null)} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Thompson Sampling</span>
                            <span onClick={() => setActiveDropdown(null)} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Speculative Execution</span>
                            <span onClick={() => setActiveDropdown(null)} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Council Mode</span>
                            <span onClick={() => setActiveDropdown(null)} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Cognitive Advisor</span>
                            <span onClick={() => setActiveDropdown(null)} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Adaptive Optimization</span>
                            <span onClick={() => setActiveDropdown(null)} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Provider Health & Failover</span>
                          </div>
                        </div>

                        {/* Col 2 - Agents */}
                        <div className="p-6 ">
                          <span className="text-xs font-medium uppercase tracking-wider mb-3 block text-[#1b1912] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Agents</span>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Planning Agents</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Reflection Agents</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Behavior Trees</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Multi-Agent Swarms</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Tool Execution</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Human-in-the-Loop</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Agent Memory</span>
                          </div>
                        </div>

                        {/* Col 3 - Infrastructure */}
                        <div className="p-6 ">
                          <span className="text-xs font-medium uppercase tracking-wider mb-3 block text-[#1b1912] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Infrastructure</span>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Local LLM Fallback</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>QLoRA On-Device Training</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Federated Learning</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>SLO Enforcer</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Fleet Management</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Model Management</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Multi-Tenancy</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>MCP Integration</span>
                          </div>
                        </div>

                        {/* Col 4 - Security & Resilience */}
                        <div className="p-6">
                          <span className="text-xs font-medium uppercase tracking-wider mb-3 block text-[#1b1912] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Security & Resilience</span>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Shadow Mode</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>EscapeVector</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Gold Code</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Cryptographic Signing</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Safety Containment</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] cursor-default" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>BYOK Key Vault</span>
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
                        {/* Col 1 - Documentation */}
                        <div className="p-6 ">
                          <span className="text-xs font-medium uppercase tracking-wider mb-3 block text-[#1b1912] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Documentation</span>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-pointer" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Getting Started</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-pointer" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>API Reference</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-pointer" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>SDK Documentation</span>
                          </div>
                        </div>

                        {/* Col 2 - Use Cases */}
                        <div className="p-6 ">
                          <span className="text-xs font-medium uppercase tracking-wider mb-3 block text-[#1b1912] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Use Cases</span>
                          <div className="flex flex-col gap-1.5">
                            <span onClick={() => { setActiveDropdown(null); openUseCases(); }} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-pointer" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Enterprise AI</span>
                            <span onClick={() => { setActiveDropdown(null); openUseCases(); }} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-pointer" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Multi-Agent Systems</span>
                            <span onClick={() => { setActiveDropdown(null); openUseCases(); }} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-pointer" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Real-time Optimization</span>
                            <span onClick={() => { setActiveDropdown(null); openUseCases(); }} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-pointer" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Edge Deployment</span>
                          </div>
                        </div>

                        {/* Col 3 - Blog + Changelog */}
                        <div className="p-6">
                          <span className="text-xs font-medium uppercase tracking-wider mb-3 block text-[#1b1912] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Blog</span>
                          <div className="flex flex-col gap-1.5">
                            <Link href="/blog" prefetch={false} onClick={() => setActiveDropdown(null)} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-pointer" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Latest Updates</Link>
                            <Link href="/blog" prefetch={false} onClick={() => setActiveDropdown(null)} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-pointer" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Product Insights</Link>
                            <Link href="/blog" prefetch={false} onClick={() => setActiveDropdown(null)} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-pointer" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Technical Deep Dives</Link>
                            <Link href="/blog" prefetch={false} onClick={() => setActiveDropdown(null)} className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-pointer" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Industry News</Link>
                          </div>
                          <span className="text-xs font-medium uppercase tracking-wider mt-5 mb-3 block text-[#1b1912] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Changelog</span>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-pointer" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>v2.0 Release</span>
                            <span className="text-xs text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors cursor-pointer" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>v1.9 Updates</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Overlay */}
          {mobileMenuOpen && (
            <div className="md:hidden fixed inset-0 top-0 z-50 bg-white dark:bg-[#1b1912] overflow-y-auto overscroll-contain">
              {/* Mobile menu header */}
              <div className="flex items-center justify-between px-4 sm:px-6" style={{ paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
                <Link href="/" prefetch={false} onClick={() => setMobileMenuOpen(false)}>
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
                <div>
                  <button
                    onClick={() => setMobileFeaturesOpen(!mobileFeaturesOpen)}
                    className="w-full flex items-center justify-between text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                  >
                    Feature
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobileFeaturesOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileFeaturesOpen && (
                    <div className="ml-4 mt-3 space-y-3">
                      <Link href="/runtime" prefetch={false} onClick={() => { setMobileMenuOpen(false); setMobileFeaturesOpen(false); }} className="block text-left text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Runtime</Link>
                      <Link href="/runtime" prefetch={false} onClick={() => { setMobileMenuOpen(false); setMobileFeaturesOpen(false); }} className="block text-left text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Overture</Link>
                      <button onClick={() => { setMobileMenuOpen(false); setMobileFeaturesOpen(false); openUseCases(); }} className="block text-left text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Use Cases</button>
                    </div>
                  )}
                </div>

                <div>
                  <button
                    onClick={() => setMobileResourcesOpen(!mobileResourcesOpen)}
                    className="w-full flex items-center justify-between text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                  >
                    Resources
                    <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobileResourcesOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileResourcesOpen && (
                    <div className="ml-4 mt-3 space-y-3">
                      <a href={docsHubUrl} className="block text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }} onClick={() => { setMobileMenuOpen(false); setMobileResourcesOpen(false); }}>Documentation</a>
                      <button onClick={() => { setMobileMenuOpen(false); setMobileResourcesOpen(false); openUseCases(); }} className="block text-left text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>Use Cases</button>
                      <Link href="/blog" prefetch={false} className="block text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }} onClick={() => { setMobileMenuOpen(false); setMobileResourcesOpen(false); }}>Blog</Link>
                    </div>
                  )}
                </div>

                <Link href="/pricing" prefetch={false} className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }} onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
                <a href={consoleUrl ? `${consoleUrl}/auth?mode=signin` : '#'} className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }} onClick={() => setMobileMenuOpen(false)}>Sign In</a>
                <a href={consoleUrl ? `${consoleUrl}/auth?mode=signup` : '#'} onClick={() => setMobileMenuOpen(false)} className="inline-flex items-center justify-center px-4 py-2 hover:opacity-80 transition-all duration-200 text-sm font-medium shadow-sm rounded-md" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', backgroundColor: '#14120a', color: '#f6f6f4' }}>Get Started</a>
              </nav>
            </div>
          )}
        </div>
      </header>
    </>
  );
}
