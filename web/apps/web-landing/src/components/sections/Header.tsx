'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [resourcesDropdownOpen, setResourcesDropdownOpen] = useState(false);
  const [mobileProductOpen, setMobileProductOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const { openEarlyAccessModal } = useModal();
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const resourcesDropdownRef = useRef<HTMLDivElement>(null);

  // Set docs hub URL based on environment
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setDocsHubUrl('http://localhost:3001');
    } else {
      setDocsHubUrl('https://docs.igrisinertial.com/');
    }
  }, []);

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setScrolled(true);
      } else {
        setScrolled(false);
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
    <header className={`fixed top-0 left-0 w-full z-50 py-4 dark:bg-gray-900 font-inter ${scrolled ? 'scrolled' : ''}`} style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Image
                src="/schlep-logo-34.png"
                alt="Igris Inertial"
                width={30}
                height={30}
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
                className="text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium text-sm font-inter flex items-center gap-1"
              >
                Product
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${productDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {productDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ backgroundColor: '#f6f6f4' }}>
                  <Link
                    href="/overture"
                    className="block px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 font-inter"
                    onClick={() => setProductDropdownOpen(false)}
                  >
                    Overture
                  </Link>
                  <Link
                    href="/runtime"
                    className="block px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 font-inter"
                    onClick={() => setProductDropdownOpen(false)}
                  >
                    Runtime
                  </Link>
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
                className="text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium text-sm font-inter flex items-center gap-1"
              >
                Resources
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${resourcesDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {resourcesDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden" style={{ backgroundColor: '#f6f6f4' }}>
                  <Link
                    href="/use-cases"
                    className="block px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 font-inter"
                    onClick={() => setResourcesDropdownOpen(false)}
                  >
                    Use Cases
                  </Link>
                  <a
                    href={docsHubUrl}
                    className="block px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 font-inter"
                    onClick={() => setResourcesDropdownOpen(false)}
                  >
                    Docs
                  </a>
                  <Link
                    href="/blog"
                    className="block px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 font-inter"
                    onClick={() => setResourcesDropdownOpen(false)}
                  >
                    Blog
                  </Link>
                  <Link
                    href="/pricing"
                    className="block px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 font-inter"
                    onClick={() => setResourcesDropdownOpen(false)}
                  >
                    Pricing
                  </Link>
                </div>
              )}
            </div>

            <Link
              href="/login"
              className="text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium text-sm font-inter"
            >
              Sign In
            </Link>

            <button
              onClick={openEarlyAccessModal}
              className="text-white px-3 py-1 md:px-4 md:py-1 rounded-lg hover:opacity-90 transition-all duration-200 text-sm shadow-md hover:shadow-lg font-inter"
              style={{ backgroundColor: '#000000' }}
            >
              Sign Up
            </button>
          </div>

          <div className="md:hidden flex items-center">
            <button
              type="button"
              className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-300"
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

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-gray-200">
            <nav className="flex flex-col space-y-4 mt-4">
              {/* Product Dropdown Mobile */}
              <div>
                <button
                  onClick={() => setMobileProductOpen(!mobileProductOpen)}
                  className="w-full flex items-center justify-between text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium text-sm font-inter"
                >
                  Product
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobileProductOpen ? 'rotate-180' : ''}`} />
                </button>
                {mobileProductOpen && (
                  <div className="ml-4 mt-2 space-y-2">
                    <Link
                      href="/overture"
                      className="block text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium text-sm font-inter"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setMobileProductOpen(false);
                      }}
                    >
                      Overture
                    </Link>
                    <Link
                      href="/runtime"
                      className="block text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium text-sm font-inter"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setMobileProductOpen(false);
                      }}
                    >
                      Runtime
                    </Link>
                  </div>
                )}
              </div>

              {/* Resources Dropdown Mobile */}
              <div>
                <button
                  onClick={() => setMobileResourcesOpen(!mobileResourcesOpen)}
                  className="w-full flex items-center justify-between text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium text-sm font-inter"
                >
                  Resources
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobileResourcesOpen ? 'rotate-180' : ''}`} />
                </button>
                {mobileResourcesOpen && (
                  <div className="ml-4 mt-2 space-y-2">
                    <Link
                      href="/use-cases"
                      className="block text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium text-sm font-inter"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setMobileResourcesOpen(false);
                      }}
                    >
                      Use Cases
                    </Link>
                    <a
                      href={docsHubUrl}
                      className="block text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium text-sm font-inter"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setMobileResourcesOpen(false);
                      }}
                    >
                      Docs
                    </a>
                    <Link
                      href="/blog"
                      className="block text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium text-sm font-inter"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setMobileResourcesOpen(false);
                      }}
                    >
                      Blog
                    </Link>
                    <Link
                      href="/pricing"
                      className="block text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium text-sm font-inter"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setMobileResourcesOpen(false);
                      }}
                    >
                      Pricing
                    </Link>
                  </div>
                )}
              </div>

              <Link
                href="/login"
                className="text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium text-sm font-inter"
                onClick={() => setMobileMenuOpen(false)}
              >
                Login
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openEarlyAccessModal();
                }}
                className="text-white px-3 py-1 rounded-lg hover:opacity-90 transition-all duration-200 text-sm shadow-md font-inter w-full"
                style={{ backgroundColor: '#000000' }}
              >
                Sign Up
              </button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}