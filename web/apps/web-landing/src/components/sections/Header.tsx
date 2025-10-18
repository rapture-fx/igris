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
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
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
          </nav>

          <div className="hidden md:flex items-center space-x-3">
            <Link href="/auth" style={{ backgroundColor: '#e9eef9', color: '#1f53d0' }} className="text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-all duration-200 font-semibold text-sm shadow-md hover:shadow-lg font-inter">
              Docs
            </Link>
            <Link href="https://github.com/schlep-engine"
              target="_blank"
              rel="noopener noreferrer"
              style={{ backgroundColor: '#ffffff' }}
              className="text-black px-6 py-2.5 rounded-lg hover:bg-gray-100 transition-all duration-200 font-semibold text-sm shadow-md hover:shadow-lg font-inter"
            >
              GitHub
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