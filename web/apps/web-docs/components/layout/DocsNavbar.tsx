'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Search, FileText } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

// Search index for documentation
const searchIndex = [
  { title: 'Introduction', path: '/docs/introduction', keywords: 'intro getting started welcome overview' },
  { title: 'Quickstart', path: '/docs/quickstart', keywords: 'quick start begin setup install' },
  { title: 'SDK Usage', path: '/docs/sdk-usage', keywords: 'sdk usage how to use implementation' },
  { title: 'Architecture', path: '/docs/architecture', keywords: 'architecture design system structure' },
  { title: 'API Reference', path: '/docs/api-reference', keywords: 'api reference endpoints methods' },
  { title: 'Providers & Keys', path: '/docs/providers-keys', keywords: 'providers keys configuration setup api keys' },
  { title: 'Observability', path: '/docs/observability', keywords: 'observability monitoring logging metrics' },
  { title: 'Routing Policies', path: '/docs/routing-policies', keywords: 'routing policies rules configuration' },
  { title: 'Multi-Tenancy', path: '/docs/multi-tenancy', keywords: 'multi tenancy tenant isolation' },
  { title: 'FAQ', path: '/docs/faq', keywords: 'faq questions answers help' },
  { title: 'Changelog', path: '/docs/changelog', keywords: 'changelog updates releases versions' },
  { title: 'Escape Vector', path: '/docs/core-features/escape-vector', keywords: 'escape vector feature core' },
  { title: 'Hotfix Blob', path: '/docs/core-features/hotfix-blob', keywords: 'hotfix blob feature core patch' },
  { title: 'Cognitive Advisor', path: '/docs/core-features/cognitive-advisor', keywords: 'cognitive advisor ai feature core' },
  { title: 'Gold Code', path: '/docs/core-features/gold-code', keywords: 'gold code quality feature core' },
  { title: 'Speculative', path: '/docs/core-features/speculative', keywords: 'speculative feature core prediction' },
  { title: 'Council Mode', path: '/docs/core-features/council-mode', keywords: 'council mode feature core collaboration' },
];

export function DocsNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [filteredResults, setFilteredResults] = useState<typeof searchIndex>([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

  // Generate breadcrumbs from pathname
  const generateBreadcrumbs = () => {
    if (!pathname) return [];

    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Docs', href: '/docs' }];

    let currentPath = '';
    segments.slice(1).forEach((segment) => {
      currentPath += `/${segment}`;
      const label = segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      breadcrumbs.push({ label, href: `/docs${currentPath}` });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  // Handle search
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      const results = searchIndex.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.keywords.toLowerCase().includes(query) ||
        item.path.toLowerCase().includes(query)
      );
      setFilteredResults(results);
      setShowResults(true);
      setSelectedIndex(0); // Reset selection when results change
    } else {
      setFilteredResults([]);
      setShowResults(false);
    }
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Ctrl+F / Cmd+F keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        setIsSearchModalOpen(true);
      }
      // Close modal on Escape
      if (event.key === 'Escape' && isSearchModalOpen) {
        setIsSearchModalOpen(false);
        setSearchQuery('');
        setShowResults(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchModalOpen]);

  // Focus modal input when modal opens
  useEffect(() => {
    if (isSearchModalOpen && modalInputRef.current) {
      modalInputRef.current.focus();
    }
  }, [isSearchModalOpen]);

  const handleResultClick = (path: string) => {
    router.push(path);
    setSearchQuery('');
    setShowResults(false);
    setIsSearchModalOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || filteredResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredResults[selectedIndex]) {
          handleResultClick(filteredResults[selectedIndex].path);
        }
        break;
    }
  };

  return (
    <>
    <nav className="bg-beige-primary border-b border-transparent">
      <div className="py-4">
        <div className="max-w-7xl mx-auto px-8 sm:px-12 lg:px-16">
          <div className="flex gap-8">
            {/* Left side: Breadcrumbs + spacer for content area */}
            <div className="flex-1 min-w-0 flex items-center">
              <div className="flex items-center space-x-2 text-sm">
                {breadcrumbs.map((breadcrumb, index) => (
                  <div key={breadcrumb.href} className="flex items-center">
                    {index > 0 && (
                      <ChevronRight className="h-4 w-4 text-gray-400 mx-2" />
                    )}
                    {index === breadcrumbs.length - 1 ? (
                      <span className="text-gray-900 font-medium">
                        {breadcrumb.label}
                      </span>
                    ) : (
                      <Link
                        href={breadcrumb.href}
                        className="text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        {breadcrumb.label}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right side: Search Bar and Sign Up button */}
            <div className="hidden xl:flex items-center gap-3 w-96 flex-shrink-0">
              <div className="relative flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder=""
                    readOnly
                    onClick={() => setIsSearchModalOpen(true)}
                    className="w-full pl-10 pr-16 py-1.5 text-xs border border-gray-300 rounded-lg outline-none bg-beige-primary shadow-sm cursor-pointer"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                    <span className="text-xs font-medium text-gray-400">⌘ F</span>
                  </div>
                </div>
              </div>

              {/* Dashboard Button */}
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-xs font-medium text-gray-900 bg-beige-primary hover:bg-beige-secondary rounded-lg transition-colors whitespace-nowrap shadow-md border border-gray-200"
              >
                Dashboard
              </Link>

              {/* Sign Up Button */}
              <Link
                href="/signup"
                className="px-3 py-1.5 text-xs font-medium text-gray-900 bg-beige-primary hover:bg-beige-secondary rounded-lg transition-colors whitespace-nowrap shadow-md border border-gray-200"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>

    {/* Search Modal */}
    {isSearchModalOpen && (
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
        {/* Backdrop with blur */}
        <div
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
          onClick={() => {
            setIsSearchModalOpen(false);
            setSearchQuery('');
            setShowResults(false);
          }}
        />

        {/* Modal Content */}
        <div className="relative w-full max-w-2xl mx-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
            {/* Search Input */}
            <div className="relative bg-white p-3">
              <Search className="absolute left-7 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={modalInputRef}
                type="text"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-10 pr-4 py-2 text-sm outline-none rounded-lg border border-gray-200 focus:border-gray-300"
              />
            </div>

            {/* Search Results */}
            {showResults && filteredResults.length > 0 && (
              <div className="max-h-64 overflow-y-auto bg-gray-50 p-2">
                {filteredResults.map((result, index) => (
                  <button
                    key={result.path}
                    onClick={() => handleResultClick(result.path)}
                    className={`w-full px-3 py-2 transition-colors text-left flex items-start gap-2.5 border-b border-gray-100 last:border-b-0 ${
                      index === selectedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 mb-0.5">
                        {result.title}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {result.path}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No Results */}
            {showResults && searchQuery.length > 0 && filteredResults.length === 0 && (
              <div className="p-6 text-center">
                <p className="text-sm text-gray-500">
                  No results found for "{searchQuery}"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
