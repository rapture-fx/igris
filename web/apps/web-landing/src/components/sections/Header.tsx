'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useModal } from '../../contexts/ModalContext';
import { useProductPopup } from '../../contexts/ProductPopupContext';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resourcesDropdownOpen, setResourcesDropdownOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const [docsHubUrl, setDocsHubUrl] = useState('https://docs.igrisinertial.com/');
  const [consoleUrl, setConsoleUrl] = useState('https://admin.igris-inertial.com');
  const [isScrolled, setIsScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { openEarlyAccessModal } = useModal();
  const { theme } = useTheme();
  const { openOverture, openRuntime, openUseCases } = useProductPopup();
  const resourcesDropdownRef = useRef<HTMLDivElement>(null);

  // Set mounted state for hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Set docs hub URL based on environment
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setDocsHubUrl('http://localhost:3001');
      setConsoleUrl('http://localhost:3005');
    } else {
      setDocsHubUrl('https://docs.igrisinertial.com/');
      setConsoleUrl('https://admin.igris-inertial.com');
    }
  }, []);

  // Detect scroll for blur effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resourcesDropdownRef.current && !resourcesDropdownRef.current.contains(event.target as Node)) {
        setResourcesDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <>
      {/* Blur overlay when dropdown is open */}
      {resourcesDropdownOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          onClick={() => setResourcesDropdownOpen(false)}
        />
      )}

       <header
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
         isScrolled ? 'backdrop-blur-md bg-[rgba(246,246,244,0.8)] dark:bg-[rgba(27,25,18,0.8)]' : 'bg-[#f6f6f4] dark:bg-[#1b1912]'
       }`}
     >
       <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12 py-4 border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/5 bg-[#f6f6f4] dark:bg-[#1b1912]">
          <div className="flex items-center justify-between w-full">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
<img
                   src="/ii.png"
                    alt="Igris Inertial"
                     style={{ width: '120px', height: 'auto' }}
                  />
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-6">
              {/* Resources Dropdown */}
              <div className="relative" ref={resourcesDropdownRef}>
                  <button
                  onClick={() => {
                    setResourcesDropdownOpen(!resourcesDropdownOpen);
                  }}
                   className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs flex items-center gap-1"
                 >
                   Resources
                   <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${resourcesDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              {resourcesDropdownOpen && (
                   <div className="absolute top-full right-0 mt-2 w-[500px] border border-gray-300 dark:border-[#f6f6f4]/5 bg-[#f6f6f4] dark:bg-[#1b1912] shadow-lg z-50 p-2">
                    <div className="grid grid-cols-2">
                      {/* Left Column - Docs */}
                      <a
                        href={docsHubUrl}
                        className="p-8 border-r border-gray-300 dark:border-[#f6f6f4]/5 flex items-end min-h-[280px] relative overflow-hidden"
                        onClick={() => setResourcesDropdownOpen(false)}
                      >
                        <div className="absolute inset-0 p-1">
                          <img
                            src="/dc.png"
                            alt=""
                            className="w-full h-full object-cover opacity-30"
                          />
                        </div>
                        <span className="text-sm font-normal text-gray-900 dark:text-[#f6f6f4] relative z-10">
                          Docs
                        </span>
                      </a>

                      {/* Right Column - Use Cases */}
                      <button
                        onClick={() => {
                          setResourcesDropdownOpen(false);
                          openUseCases();
                        }}
                        className="p-8 flex items-end min-h-[280px] text-left w-full relative overflow-hidden"
                      >
                        <div className="absolute inset-0 p-1">
                          <img
                            src="/uc.png"
                            alt=""
                            className="w-full h-full object-cover opacity-30"
                          />
                        </div>
                        <span className="text-sm font-normal text-gray-900 dark:text-[#f6f6f4] relative z-10">
                          Use Cases
                        </span>
                      </button>
                    </div>
                  </div>
               )}
            </div>

              <Link
                href="/pricing"
                className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs"
              >
                Pricing
              </Link>

              <a
                href={consoleUrl ? `${consoleUrl}/auth?mode=signin` : '#'}
                className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs"
              >
                Sign In
              </a>

              <a
                 href={consoleUrl ? `${consoleUrl}/auth?mode=signup` : '#'}
                 className="bg-black text-white dark:bg-[#f6f6f4] dark:text-black px-2.5 py-1 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 text-xs shadow-md hover:shadow-lg"
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
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-gray-200 dark:border-[#f6f6f4]/5 bg-[#f6f6f4] dark:bg-[#1b1912]">
            <nav className="flex flex-col space-y-4 mt-4">
              {/* Resources Dropdown Mobile */}
               <div>
                  <button
                    onClick={() => setMobileResourcesOpen(!mobileResourcesOpen)}
                     className="w-full flex items-center justify-between text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs"
                  >
                   Resources
                   <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobileResourcesOpen ? 'rotate-180' : ''}`} />
                 </button>
                   {mobileResourcesOpen && (
                    <div className="ml-4 mt-2 space-y-2">
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setMobileResourcesOpen(false);
                          openUseCases();
                        }}
                         className="block text-left text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs"
                      >
                        Use Cases
                      </button>
                      <a
                        href={docsHubUrl}
className="block text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setMobileResourcesOpen(false);
                        }}
                >
                  Docs
                    </a>
               <Link
                  href="/blog"
                         className="block text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs"
                         onClick={() => {
                           setMobileMenuOpen(false);
                           setMobileResourcesOpen(false);
                         }}
                >
                  Blog
                </Link>
                    </div>
                  )}
               </div>

              <Link
                  href="/pricing"
                  className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>

              <a
                href={consoleUrl ? `${consoleUrl}/auth?mode=signin` : '#'}
                className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs"
                onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </a>
              <a
                 href={consoleUrl ? `${consoleUrl}/auth?mode=signup` : '#'}
                 onClick={() => setMobileMenuOpen(false)}
                 className="bg-black text-white dark:bg-[#f6f6f4] dark:text-black px-3 py-1.5 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 text-xs shadow-md inline-block text-center"
               >
                  Get Started
                </a>
            </nav>
          </div>
        )}
      </div>
    </header>
    </>
  );
}