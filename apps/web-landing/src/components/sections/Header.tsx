'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, ChevronRight } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from "next-themes";

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { theme } = useTheme();

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
    <header className={`fixed top-0 left-0 w-full z-50 py-4 dark:bg-gray-900 font-inter ${scrolled ? 'scrolled' : ''}`} style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center">
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <Image
                src="/Docs Schlep-engne.svg"
                alt="Schlep Engine"
                width={40}
                height={40}
              />
            </Link>
          </div>

          <nav className="hidden md:flex justify-center flex-grow space-x-8 mr-auto">
            <Link href="/" className={`text-sm transition-colors duration-200 font-inter ${pathname === '/' ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}>
              Platform
            </Link>
            <Link href="/solutions" className={`text-sm transition-colors duration-200 font-inter ${pathname === '/solutions' ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}>
              Solution
            </Link>
            <Link href="http://localhost:3005/api-reference" className="text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200 font-inter">
              Docs
            </Link>
            <Link href="/pricing" className={`text-sm transition-colors duration-200 font-inter ${pathname === '/pricing' ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}>
              Pricing
            </Link>
          </nav>

          <div className="hidden md:flex items-center space-x-3">
            <Link href="/auth" style={{ backgroundColor: '#1f53d0' }} className="text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold text-sm shadow-md hover:shadow-lg font-inter">
              Sign Up
            </Link>
          </div>

          <div className="md:hidden flex items-center space-x-2">
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
      </div>
    </header>
  );
}