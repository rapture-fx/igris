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
  { title: 'Pricing Tiers', path: '/docs/pricing-tiers', keywords: 'pricing tiers plans cost billing' },
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
  const searchRef = useRef<HTMLDivElement>(null);

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

  const handleResultClick = (path: string) => {
    router.push(path);
    setSearchQuery('');
    setShowResults(false);
  };

  return (
    <nav className="bg-beige-primary border-b border-transparent">
      <div className="py-4">
        <div className="max-w-7xl mx-auto px-8 sm:px-12 lg:px-16">
          <div className="flex items-center gap-4">
            {/* Breadcrumbs - Left side */}
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

            {/* Search Bar - Aligned with content */}
            <div className="relative w-full max-w-md" ref={searchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchQuery.length > 0 && setShowResults(true)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#299a93] focus:border-transparent bg-white shadow-sm transition-all"
                />
              </div>

              {/* Search Results Popup */}
              {showResults && filteredResults.length > 0 && (
                <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden z-50">
                  <div className="max-h-96 overflow-y-auto">
                    {filteredResults.map((result, index) => (
                      <button
                        key={result.path}
                        onClick={() => handleResultClick(result.path)}
                        className="w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left flex items-start gap-3 border-b border-gray-100 last:border-b-0"
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
                </div>
              )}

              {/* No Results */}
              {showResults && searchQuery.length > 0 && filteredResults.length === 0 && (
                <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-50">
                  <p className="text-sm text-gray-500 text-center">
                    No results found for "{searchQuery}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
