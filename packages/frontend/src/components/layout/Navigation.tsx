'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, User, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Logo } from '@/components/ui/Logo';
import { shouldBypassAuth } from '@/lib/dev-config';

export function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { user, isAuthenticated, signOut, isLoading } = useAuth();
  const pathname = usePathname();

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setIsUserMenuOpen(false);
      setIsMobileMenuOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsUserMenuOpen(false);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const isAuthPage = pathname?.startsWith('/auth');
  if (isAuthPage) return null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
      <div className="max-w-6xl mx-auto">
        <div className="px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 group">
              <Logo width={32} height={32} alt="Pollarbase Logo" />
              <span className="text-lg font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors font-apple">
                Pollarbase
                {shouldBypassAuth() && (
                  <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full font-medium">
                    DEV
                  </span>
                )}
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <button className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors font-apple">
                Product
                <ChevronDown className="ml-1 w-3 h-3" />
              </button>
              
              <button className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors font-apple">
                Developers
                <ChevronDown className="ml-1 w-3 h-3" />
              </button>
              
              <Link href="/enterprise" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors font-apple">
                Enterprise
              </Link>
              
              <Link href="/pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors font-apple">
                Pricing
              </Link>
              
              <Link href="/docs" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors font-apple">
                Docs
              </Link>

              <Link href="/blog" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors font-apple">
                Blog
              </Link>

              {/* Right side */}
              <div className="flex items-center space-x-3 ml-6">
                <a
                  href="https://github.com/pollarbase/pollarbase"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors font-apple"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                  </svg>
                  <span>84.6K</span>
                </a>

              {isLoading ? (
                  <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              ) : isAuthenticated && user ? (
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                      className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                      <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-xs font-apple">
                        {user.first_name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                      <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${
                      isUserMenuOpen ? 'rotate-180' : ''
                    }`} />
                  </button>

                  {isUserMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                        <div className="px-3 py-2 border-b border-gray-100">
                          <p className="text-xs font-medium text-gray-900 font-apple">{user.display_name}</p>
                          <p className="text-xs text-gray-500 font-apple">{user.email}</p>
                      </div>
                      
                      <Link
                        href="/dashboard"
                          className="flex items-center px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors font-apple"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <User className="w-3 h-3 mr-2" />
                          Dashboard
                        </Link>
                      
                        <button
                          onClick={handleSignOut}
                          className="flex items-center w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors font-apple"
                        >
                          <LogOut className="w-3 h-3 mr-2" />
                          Sign Out
                        </button>
                    </div>
                  )}
                </div>
              ) : (
                  <Link 
                    href="/dashboard"
                    className="inline-flex items-center px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-md transition-colors font-apple"
                  >
                    Dashboard
                  </Link>
                )}
                </div>
            </nav>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-1.5 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setIsMobileMenuOpen(!isMobileMenuOpen);
              }}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden mt-3 py-3 border-t border-gray-200/20">
              <div className="flex flex-col space-y-3">
                <Link href="/product" className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-apple">Product</Link>
                <Link href="/developers" className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-apple">Developers</Link>
                <Link href="/enterprise" className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-apple">Enterprise</Link>
                <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-apple">Pricing</Link>
                <Link href="/docs" className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-apple">Docs</Link>
                <Link href="/blog" className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-apple">Blog</Link>
                
                <div className="pt-3 border-t border-gray-200/20">
                {isAuthenticated && user ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-xs font-apple">
                          {user.first_name?.[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div>
                          <p className="text-xs font-medium text-gray-900 font-apple">{user.display_name}</p>
                          <p className="text-xs text-gray-500 font-apple">{user.email}</p>
                        </div>
                      </div>
                      <Link href="/dashboard" className="block text-sm text-gray-600 hover:text-gray-900 transition-colors font-apple">Dashboard</Link>
                      <button onClick={handleSignOut} className="block text-sm text-red-600 hover:text-red-700 transition-colors font-apple">Sign Out</button>
                  </div>
                ) : (
                    <div className="space-y-2">
                      <a href="https://github.com/pollarbase/pollarbase" className="block text-sm text-gray-600 hover:text-gray-900 transition-colors font-apple">GitHub</a>
                      <Link href="/dashboard" className="block px-3 py-1.5 bg-emerald-500 text-white text-xs rounded-md text-center font-apple">Dashboard</Link>
                  </div>
                )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
} 
