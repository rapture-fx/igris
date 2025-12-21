'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  BookOpen,
  Code,
  Layers,
  Zap,
  Key,
  GitBranch,
  Box,
  Package,
  Users,
  BarChart3,
  DollarSign,
  HelpCircle,
  FileText,
  ChevronRight,
  ChevronDown,
  Search
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface DocsSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

interface NavigationItem {
  name: string;
  href: string;
  icon?: any;
  children?: NavigationItem[];
  badge?: string;
}

interface NavigationSection {
  section: string;
  items: NavigationItem[];
}

const navigationSections: NavigationSection[] = [
  {
    section: 'Documentation',
    items: [
      {
        name: 'Introduction',
        href: '/docs',
        icon: Home,
      },
      {
        name: 'Quick Start',
        href: '/docs/quickstart',
        icon: Zap,
      },
    ],
  },
  {
    section: 'Guide',
    items: [
      {
        name: 'Providers & Keys',
        href: '/docs/providers-keys',
        icon: Key,
      },
      {
        name: 'Routing Policies',
        href: '/docs/routing-policies',
        icon: GitBranch,
      },
      {
        name: 'Core Features',
        href: '/docs/core-features',
        icon: Box,
        children: [
          { name: 'Adaptive Optimization', href: '/docs/core-features/adaptive-optimization' },
          { name: 'Provider Health Checks', href: '/docs/core-features/provider-health' },
          { name: 'EscapeVector Mode', href: '/docs/core-features/escape-vector' },
          { name: 'Gold Code Override', href: '/docs/core-features/gold-code' },
          { name: 'Emergency Hotfix Blob', href: '/docs/core-features/hotfix-blob' },
          { name: 'Speculative Execution', href: '/docs/core-features/speculative' },
          { name: 'Council Mode', href: '/docs/core-features/council-mode' },
          { name: 'Cognitive Advisor', href: '/docs/core-features/cognitive-advisor' },
          { name: 'Shadow Mode', href: '/docs/core-features/shadow-mode' },
          { name: 'SLO Enforcer', href: '/docs/core-features/slo-enforcer' },
        ],
      },
      {
        name: 'Multi-Tenancy',
        href: '/docs/multi-tenancy',
        icon: Users,
      },
      {
        name: 'Observability',
        href: '/docs/observability',
        icon: BarChart3,
      },
    ],
  },
  {
    section: 'Resources',
    items: [
      {
        name: 'SDK Usage',
        href: '/docs/sdk-usage',
        icon: Package,
      },
      {
        name: 'Architecture',
        href: '/docs/architecture',
        icon: Layers,
      },
      {
        name: 'FAQ',
        href: '/docs/faq',
        icon: HelpCircle,
      },
    ],
  },
];

const apiReferenceSections: NavigationSection[] = [
  {
    section: 'Documentation',
    items: [
      { name: 'Introduction', href: '/docs/api-reference/introduction', icon: BookOpen },
      { name: 'Quick Start', href: '/docs/api-reference/quick-start', icon: Zap },
    ],
  },
  {
    section: 'API',
    items: [
      { name: 'Authentication', href: '/docs/api-reference/authentication', icon: Key },
      {
        name: 'Endpoints',
        href: '/docs/api-reference/endpoints/chat-completions',
        icon: Code,
        children: [
          { name: 'Chat Completions', href: '/docs/api-reference/endpoints/chat-completions', badge: 'POST' },
          { name: 'Models', href: '/docs/api-reference/endpoints/models', badge: 'GET' },
          { name: 'Embeddings', href: '/docs/api-reference/endpoints/embeddings', badge: 'POST' },
          { name: 'Status & Health', href: '/docs/api-reference/endpoints/status', badge: 'GET' },
        ]
      },
      { name: 'Errors & Retries', href: '/docs/api-reference/errors-retries', icon: HelpCircle },
      { name: 'Rate Limits & Budgets', href: '/docs/api-reference/rate-limits-budgets', icon: BarChart3 },
    ],
  },
  {
    section: 'Resources',
    items: [
      { name: 'SDKs', href: '/docs/api-reference/sdks', icon: Package },
    ],
  },
];

const navigation: NavigationItem[] = [
  {
    name: 'Changelog',
    href: '/docs/changelog',
    icon: FileText,
  },
];

// Search index for documentation
const searchIndex = [
  { title: 'Introduction', path: '/docs/introduction', keywords: 'intro getting started welcome overview' },
  { title: 'Quickstart', path: '/docs/quickstart', keywords: 'quick start begin setup install' },
  { title: 'SDK Usage', path: '/docs/sdk-usage', keywords: 'sdk usage how to use implementation' },
  { title: 'Architecture', path: '/docs/architecture', keywords: 'architecture design system structure' },
  { title: 'API Reference', path: '/docs/api-reference/introduction', keywords: 'api reference endpoints methods' },
  { title: 'API Quick Start', path: '/docs/api-reference/quick-start', keywords: 'api quick start curl first request' },
  { title: 'Authentication', path: '/docs/api-reference/authentication', keywords: 'authentication auth api key jwt token bearer' },
  { title: 'Chat Completions', path: '/docs/api-reference/endpoints/chat-completions', keywords: 'chat completions inference openai gpt claude' },
  { title: 'Models', path: '/docs/api-reference/endpoints/models', keywords: 'models list available gpt claude' },
  { title: 'Embeddings', path: '/docs/api-reference/endpoints/embeddings', keywords: 'embeddings vectors semantic search' },
  { title: 'Status & Health', path: '/docs/api-reference/endpoints/status', keywords: 'status health check monitoring metrics' },
  { title: 'Errors & Retries', path: '/docs/api-reference/errors-retries', keywords: 'errors retries error handling fallback' },
  { title: 'Rate Limits & Budgets', path: '/docs/api-reference/rate-limits-budgets', keywords: 'rate limits budgets quota usage tiers' },
  { title: 'SDKs', path: '/docs/api-reference/sdks', keywords: 'sdk client libraries typescript python go rust' },
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
  { title: 'Shadow Mode', path: '/docs/core-features/shadow-mode', keywords: 'shadow mode testing canary feature core rollout' },
  { title: 'SLO Enforcer', path: '/docs/core-features/slo-enforcer', keywords: 'slo enforcer service level objective guardrails monitoring' },
  { title: 'Adaptive Optimization', path: '/docs/core-features/adaptive-optimization', keywords: 'adaptive optimization quality scoring performance tuning automatic' },
  { title: 'Provider Health Checks', path: '/docs/core-features/provider-health', keywords: 'provider health checks monitoring failover resilient availability' },
];

const dropdownItems = [
  { label: 'Documentation', href: '/docs', icon: BookOpen },
  { label: 'API Reference', href: '/docs/api-reference/introduction', icon: Code },
  { label: 'Change Log', href: '/docs/changelog', icon: FileText },
];

export function DocsSidebar({ open = true, onClose }: DocsSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(dropdownItems[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [filteredResults, setFilteredResults] = useState<typeof searchIndex>([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hubUrl, setHubUrl] = useState('/');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);

  // Set hub URL based on environment
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost') {
        setHubUrl('http://localhost:3001');
      } else {
        setHubUrl('https://docs.igrisinertial.com/');
      }
    }
  }, []);

  // Auto-expand parent if child is active
  useEffect(() => {
    let allItems: NavigationItem[] = [];
    if (selectedItem.label === 'Documentation') {
      allItems = navigationSections.flatMap(section => section.items);
    } else if (selectedItem.label === 'API Reference') {
      allItems = apiReferenceSections.flatMap(section => section.items);
    } else {
      allItems = navigation;
    }

    const itemsToExpand: string[] = [];
    allItems.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some(child => pathname === child.href);
        if (hasActiveChild) {
          itemsToExpand.push(item.name);
        }
      }
    });

    // Only update if the expanded items list would actually change
    setExpandedItems((prev) => {
      const shouldUpdate = itemsToExpand.some(name => !prev.includes(name)) ||
        prev.some(name => !itemsToExpand.includes(name) &&
          allItems.some(item => item.name === name && item.children));

      if (shouldUpdate) {
        return [...new Set([...prev.filter(name =>
          !allItems.some(item => item.name === name && item.children)
        ), ...itemsToExpand])];
      }
      return prev;
    });
  }, [pathname, selectedItem.label]);

  // Set selected dropdown item based on current pathname
  useEffect(() => {
    let newItem = dropdownItems[0]; // Default to Documentation

    if (pathname.includes('/docs/api-reference') || pathname.includes('/docs/api')) {
      newItem = dropdownItems[1]; // API Reference
    } else if (pathname.includes('/docs/changelog')) {
      newItem = dropdownItems[2]; // Change Log
    }

    // Only update if different to prevent unnecessary re-renders
    if (newItem.label !== selectedItem.label) {
      setSelectedItem(newItem);
    }
  }, [pathname]);

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
      setShowSearchResults(true);
      setSelectedIndex(0);
    } else {
      setFilteredResults([]);
      setShowSearchResults(false);
    }
  }, [searchQuery]);

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
        setShowSearchResults(false);
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((name) => name !== itemName)
        : [...prev, itemName]
    );
  };

  const handleResultClick = (path: string) => {
    router.push(path);
    setSearchQuery('');
    setShowSearchResults(false);
    setIsSearchModalOpen(false);
    onClose?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSearchResults || filteredResults.length === 0) return;

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
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-72 transform transition-transform duration-200 ease-in-out md:translate-x-0 p-3',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col bg-beige-primary rounded-2xl shadow-md border border-border-light">
          {/* Logo Section */}
          <div className="h-20 flex items-center px-7 pt-6 pb-4">
            <a href={hubUrl} className="flex items-center">
              <img
                src="/img/igris-logo-34.png"
                alt="Igris Logo"
                className="h-6 w-auto"
              />
            </a>
          </div>

          {/* Search Bar */}
          <div className="px-4 pb-3 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder=""
                readOnly
                onClick={() => setIsSearchModalOpen(true)}
                className="w-full pl-9 pr-16 py-2 text-sm border border-border-light rounded-xl outline-none bg-beige-primary shadow-sm cursor-pointer"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                <span className="text-xs font-medium text-gray-400">⌘ F</span>
              </div>
            </div>
          </div>

          {/* Dropdown Menu */}
          <div className="px-4 pb-4" ref={dropdownRef}>
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-[0.8125rem] font-medium text-gray-900 bg-beige-primary rounded-xl transition-colors border border-border-light shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <selectedItem.icon className="h-4 w-4" />
                  <span>{selectedItem.label}</span>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  dropdownOpen && "rotate-180"
                )} />
              </button>

              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-beige-primary border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50">
                  {dropdownItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        setSelectedItem(item);
                        setDropdownOpen(false);
                        onClose?.();
                      }}
                      className="flex items-center gap-2.5 px-3 py-2.5 text-[0.8125rem] font-medium text-gray-700 hover:text-gray-900 transition-colors border-b border-gray-200 last:border-b-0"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 pt-8 pb-4 scrollbar-hide">
            {(selectedItem.label === 'Documentation' || selectedItem.label === 'API Reference') ? (
              // Show grouped sections for Documentation and API Reference
              <div className="space-y-6">
                {(selectedItem.label === 'Documentation' ? navigationSections : apiReferenceSections).map((section) => (
                  <div key={section.section}>
                    <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 tracking-wider">
                      {section.section}
                    </h3>
                    <ul className="space-y-1">
                      {section.items.map((item) => {
                        // For the introduction page, only match exact path
                        const isActive = item.href === '/docs'
                          ? pathname === '/docs'
                          : pathname === item.href;

                        const hasChildren = item.children && item.children.length > 0;
                        const isExpanded = expandedItems.includes(item.name);

                        // Check if any child is active
                        const hasActiveChild = hasChildren && item.children?.some(child => pathname === child.href);

                        // Parent is only active if it's a direct match (not if child is active)
                        const isParentActive = hasChildren && pathname === item.href;

                        return (
                          <li key={item.name}>
                            {hasChildren ? (
                              // Items with children - only expand/collapse, no navigation
                              <button
                                onClick={() => toggleExpanded(item.name)}
                                className={cn(
                                  'w-full flex items-center gap-2.5 px-3 py-2 text-[0.8125rem] font-medium font-inter transition-colors rounded-lg',
                                  isParentActive
                                    ? 'text-primary font-semibold'
                                    : 'text-gray-700 hover:text-gray-900'
                                )}
                              >
                                {item.icon && <item.icon className="h-4 w-4" />}
                                <span className="flex-1 text-left">{item.name}</span>
                                <ChevronRight
                                  className={cn(
                                    'h-3.5 w-3.5 transition-transform',
                                    isExpanded && 'rotate-90'
                                  )}
                                />
                              </button>
                            ) : (
                              // Regular link for items without children
                              <Link
                                href={item.href}
                                className={cn(
                                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8125rem] font-medium font-inter transition-colors',
                                  isActive
                                    ? 'text-primary font-semibold'
                                    : 'text-gray-700 hover:text-gray-900'
                                )}
                                onClick={onClose}
                              >
                                {item.icon && <item.icon className="h-4 w-4" />}
                                {item.name}
                              </Link>
                            )}

                            {/* Render children if they exist and item is expanded */}
                            {hasChildren && isExpanded && (
                              <ul className="mt-1 ml-6 space-y-0.5">
                                {item.children!.map((child) => {
                                  const isChildActive = pathname === child.href;
                                  return (
                                    <li key={child.name}>
                                      <Link
                                        href={child.href}
                                        className={cn(
                                          'flex items-start gap-2.5 rounded-lg px-3 py-2 text-[0.8125rem] font-medium font-inter transition-colors',
                                          isChildActive
                                            ? 'text-primary font-semibold'
                                            : 'text-gray-700 hover:text-gray-900'
                                        )}
                                        onClick={onClose}
                                      >
                                        {child.badge && (
                                          <span
                                            className={cn(
                                              'px-1.5 py-0.5 text-[0.6rem] font-bold rounded min-w-[2.25rem] text-center flex-shrink-0 mt-0.5',
                                              child.badge === 'GET'
                                                ? 'bg-blue-100 text-blue-700'
                                                : child.badge === 'POST'
                                                  ? 'bg-green-100 text-green-700'
                                                  : child.badge === 'PUT'
                                                    ? 'bg-yellow-100 text-yellow-700'
                                                    : child.badge === 'DELETE'
                                                      ? 'bg-red-100 text-red-700'
                                                      : 'bg-gray-100 text-gray-700'
                                            )}
                                          >
                                            {child.badge}
                                          </span>
                                        )}
                                        <span className="break-all flex-1 leading-relaxed">{child.name}</span>
                                      </Link>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              // Show flat navigation for Changelog
              <ul className="space-y-1">
                {navigation.filter((item) => {
                  if (selectedItem.label === 'Change Log') {
                    return item.name === 'Changelog';
                  }
                  return true;
                }).map((item) => {
                  const isActive = item.href === '/docs'
                    ? pathname === '/docs'
                    : pathname === item.href;

                  const hasChildren = item.children && item.children.length > 0;
                  const isExpanded = expandedItems.includes(item.name);
                  const hasActiveChild = hasChildren && item.children?.some(child => pathname === child.href);
                  const isParentActive = hasChildren && pathname === item.href;

                  return (
                    <li key={item.name}>
                      {hasChildren ? (
                        <button
                          onClick={() => toggleExpanded(item.name)}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3 py-2 text-[0.8125rem] font-medium font-inter transition-colors rounded-lg',
                            isParentActive
                              ? 'text-primary font-semibold'
                              : 'text-gray-700 hover:text-gray-900'
                          )}
                        >
                          {item.icon && <item.icon className="h-4 w-4" />}
                          <span className="flex-1 text-left">{item.name}</span>
                          <ChevronRight
                            className={cn(
                              'h-3.5 w-3.5 transition-transform',
                              isExpanded && 'rotate-90'
                            )}
                          />
                        </button>
                      ) : (
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[0.8125rem] font-medium font-inter transition-colors',
                            isActive
                              ? 'text-primary font-semibold'
                              : 'text-gray-700 hover:text-gray-900'
                          )}
                          onClick={onClose}
                        >
                          {item.icon && <item.icon className="h-4 w-4" />}
                          {item.name}
                        </Link>
                      )}

                      {hasChildren && isExpanded && (
                        <ul className="mt-1 ml-6 space-y-0.5">
                          {item.children!.map((child) => {
                            const isChildActive = pathname === child.href;
                            return (
                              <li key={child.name}>
                                <Link
                                  href={child.href}
                                  className={cn(
                                    'flex items-start gap-2.5 rounded-lg px-3 py-2 text-[0.8125rem] font-medium font-inter transition-colors',
                                    isChildActive
                                      ? 'text-primary font-semibold'
                                      : 'text-gray-700 hover:text-gray-900'
                                  )}
                                  onClick={onClose}
                                >
                                  {child.badge && (
                                    <span
                                      className={cn(
                                        'px-1.5 py-0.5 text-[0.6rem] font-bold rounded min-w-[2.25rem] text-center flex-shrink-0 mt-0.5',
                                        child.badge === 'GET'
                                          ? 'bg-blue-100 text-blue-700'
                                          : child.badge === 'POST'
                                            ? 'bg-green-100 text-green-700'
                                            : child.badge === 'PUT'
                                              ? 'bg-yellow-100 text-yellow-700'
                                              : child.badge === 'DELETE'
                                                ? 'bg-red-100 text-red-700'
                                                : 'bg-gray-100 text-gray-700'
                                      )}
                                    >
                                      {child.badge}
                                    </span>
                                  )}
                                  <span className="break-all flex-1 leading-relaxed">{child.name}</span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
        </div>
      </aside>

      {/* Search Modal */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
          {/* Backdrop with blur */}
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => {
              setIsSearchModalOpen(false);
              setSearchQuery('');
              setShowSearchResults(false);
            }}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-2xl mx-4">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden p-2">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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
              {showSearchResults && filteredResults.length > 0 && (
                <div className="max-h-64 overflow-y-auto bg-gray-50 p-2 mt-2 rounded-lg">
                  {filteredResults.map((result, index) => (
                    <button
                      key={result.path}
                      onClick={() => handleResultClick(result.path)}
                      className={`w-full px-3 py-2 transition-colors text-left flex items-start gap-2.5 border-b border-gray-100 last:border-b-0 ${index === selectedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
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
              {showSearchResults && searchQuery.length > 0 && filteredResults.length === 0 && (
                <div className="p-4 text-center mt-2">
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
