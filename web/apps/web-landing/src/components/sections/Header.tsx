'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, ChevronRight } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from "next-themes";
import { useModal } from '../../contexts/ModalContext';

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { theme } = useTheme();
  const { openEarlyAccessModal } = useModal();

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

  return (
    <header className={`fixed top-0 left-0 w-full z-50 py-4 dark:bg-gray-900 font-inter ${scrolled ? 'scrolled' : ''}`} style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Image
                src="/schlep-logo-34.png"
                alt="Schlep-engine"
                width={30}
                height={30}
              />
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-6">
            <Link
              href="/pricing"
              className="text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium text-sm font-inter"
            >
              Pricing
            </Link>
            <button
              onClick={openEarlyAccessModal}
              className="text-white px-3 py-1 md:px-4 md:py-1 rounded-lg hover:opacity-90 transition-all duration-200 font-semibold text-sm shadow-md hover:shadow-lg font-inter"
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
              <Link
                href="/pricing"
                className="text-gray-700 hover:text-gray-900 transition-colors duration-200 font-medium text-sm font-inter"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openEarlyAccessModal();
                }}
                className="text-white px-3 py-1 rounded-lg hover:opacity-90 transition-all duration-200 font-semibold text-sm shadow-md font-inter w-full"
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