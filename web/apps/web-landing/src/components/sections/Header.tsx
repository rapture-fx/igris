'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useModal } from '../../contexts/ModalContext';
import { useProductPopup } from '../../contexts/ProductPopupContext';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [resourcesDropdownOpen, setResourcesDropdownOpen] = useState(false);
  const [mobileProductOpen, setMobileProductOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const [docsHubUrl, setDocsHubUrl] = useState('https://docs.igrisinertial.com/');
  const [consoleUrl, setConsoleUrl] = useState('https://admin.igris-inertial.com');
  const [isScrolled, setIsScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { openEarlyAccessModal } = useModal();
  const { theme } = useTheme();
  const { openOverture, openRuntime } = useProductPopup();
  const productDropdownRef = useRef<HTMLDivElement>(null);
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
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setProductDropdownOpen(false);
      }
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
       <header
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
         isScrolled ? 'backdrop-blur-md bg-[rgba(246,246,244,0.8)] dark:bg-[rgba(27,25,18,0.8)]' : 'bg-transparent'
       }`}
     >
       <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12 py-4">
          <div className="flex items-center justify-between w-full">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <img
                  src={mounted && theme === 'dark' ? '/dmnav.png' : '/oklog.png'}
                   alt="Igris Inertial"
                   style={{ width: '80px', height: 'auto' }}
                 />
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-6">
            {/* Product Dropdown */}
            <div className="relative" ref={productDropdownRef}>
              <button
                onClick={() => {
                  setProductDropdownOpen(!productDropdownOpen);
                  setResourcesDropdownOpen(false);
                }}
                className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs font-inter flex items-center gap-1"
              >
                Product
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${productDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
               {productDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 rounded-lg shadow-lg border border-gray-200 dark:border-[#f6f6f4]/5 overflow-hidden bg-[#f6f6f4] dark:bg-dark-bg">
                   <button
                       onClick={() => {
                         setProductDropdownOpen(false);
                         openOverture();
                       }}
                       className="block w-full text-left px-4 py-2 text-xs text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                     >
                       Overture
                     </button>
                     <button
                       onClick={() => {
                         setProductDropdownOpen(false);
                         openRuntime();
                       }}
                       className="block w-full text-left px-4 py-2 text-xs text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                     >
                       Runtime
                     </button>
                </div>
              )}
            </div>

            {/* Resources Dropdown */}
            <div className="relative" ref={resourcesDropdownRef}>
                 <button
                 onClick={() => {
                   setResourcesDropdownOpen(!resourcesDropdownOpen);
                   setProductDropdownOpen(false);
                 }}
                  className="text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs flex items-center gap-1"
                >
                  Resources
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${resourcesDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              {resourcesDropdownOpen && (
                 <div className="absolute top-full left-0 mt-2 w-48 rounded-lg shadow-lg border border-gray-200 dark:border-[#f6f6f4]/5 overflow-hidden bg-[#f6f6f4] dark:bg-dark-bg">
              <Link
                      href="/use-cases"
                      className="block px-4 py-2 text-xs text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                      onClick={() => setResourcesDropdownOpen(false)}
                    >
                      Use Cases
                    </Link>
                    <a
                      href={docsHubUrl}
                      className="block px-4 py-2 text-xs text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                      onClick={() => setResourcesDropdownOpen(false)}
              >
                Docs
                    </a>
               <Link
                 href="/blog"
                      className="block px-4 py-2 text-xs text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                      onClick={() => setResourcesDropdownOpen(false)}
               >
                 Blog
               </Link>
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
              {/* Product Dropdown Mobile */}
               <div>
                  <button
                    onClick={() => setMobileProductOpen(!mobileProductOpen)}
                    className="w-full flex items-center justify-between text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs"
                  >
                   Product
                   <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobileProductOpen ? 'rotate-180' : ''}`} />
                 </button>
                  {mobileProductOpen && (
                    <div className="ml-4 mt-2 space-y-2">
                       <button
                         onClick={() => {
                           setMobileMenuOpen(false);
                           setMobileProductOpen(false);
                           openOverture();
                         }}
                         className="block text-left text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs"
                       >
                         Overture
                       </button>
                       <button
                         onClick={() => {
                           setMobileMenuOpen(false);
                           setMobileProductOpen(false);
                           openRuntime();
                         }}
                         className="block text-left text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs"
                       >
                         Runtime
                       </button>
                    </div>
                  )}
               </div>

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
                <Link
                        href="/use-cases"
                        className="block text-gray-700 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors duration-200 font-medium text-xs"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          setMobileResourcesOpen(false);
                        }}
                      >
                        Use Cases
                      </Link>
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
  );
}