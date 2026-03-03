'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  KeyRound, Settings, FileText, ChevronDown, Shield, Scale, ShieldCheck,
  Cpu, Zap, Search, ExternalLink, Mail,
  FileText as ChangeLogIcon, Activity as StatusIcon, BookOpen,
  Bell, LayoutDashboard, Boxes, History,
} from 'lucide-react';
import { cn } from '@/utils/helpers';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

interface NavigationItem {
  name: string;
  href?: string;
  icon: any;
  children?: Array<{ name: string; href: string }>;
}

const navigation: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    name: 'Execution',
    icon: Zap,
    children: [
      { name: 'Runs', href: '/execution/runs' },
      { name: 'Agents', href: '/execution/agents' },
    ],
  },
  {
    name: 'Fleet',
    icon: Boxes,
    children: [
      { name: 'Devices', href: '/fleet/devices' },
    ],
  },
  {
    name: 'Models',
    icon: Cpu,
    children: [
      { name: 'Routing', href: '/models/routing' },
      { name: 'Providers', href: '/models/providers' },
      { name: 'Cost', href: '/models/cost' },
    ],
  },
  {
    name: 'Policy',
    icon: Scale,
    children: [
      { name: 'Bounds', href: '/policy/bounds' },
      { name: 'Capabilities', href: '/policy/capabilities' },
    ],
  },
  {
    name: 'Proof',
    icon: ShieldCheck,
    children: [
      { name: 'Receipts', href: '/proof/receipts' },
      { name: 'Violations', href: '/proof/violations' },
    ],
  },
  {
    name: 'History',
    icon: History,
    children: [
      { name: 'Logs', href: '/history/logs' },
      { name: 'Metrics', href: '/history/metrics' },
      { name: 'Alerts', href: '/history/alerts' },
    ],
  },
  {
    name: 'Settings',
    icon: Settings,
    children: [
      { name: 'General', href: '/settings/general' },
      { name: 'Keys', href: '/settings/keys' },
      { name: 'License', href: '/settings/license' },
    ],
  },
];

const DEFAULT_EXPANDED: Record<string, boolean> = {
  Execution: false,
  Fleet: false,
  Models: true,
  Policy: false,
  Proof: false,
  History: false,
  Settings: false,
};

export function Sidebar({ open = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [filteredResults, setFilteredResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalInputRef = useRef<HTMLInputElement>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(DEFAULT_EXPANDED);

  // Load from localStorage, merging with defaults (new keys keep default value)
  useEffect(() => {
    const saved = localStorage.getItem('sidebar_expanded');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setExpandedSections((prev) => ({ ...prev, ...parsed }));
      } catch (e) {}
    }
  }, []);

  // Auto-expand section containing active route (only when no saved state)
  useEffect(() => {
    const saved = localStorage.getItem('sidebar_expanded');
    if (!saved) {
      const activeSection = navigation.find((item) =>
        item.children?.some(
          (child) => pathname === child.href || pathname?.startsWith(child.href + '/')
        )
      );
      if (activeSection) {
        setExpandedSections((prev) => ({ ...prev, [activeSection.name]: true }));
      }
    }
  }, [pathname]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('sidebar_expanded', JSON.stringify(expandedSections));
  }, [expandedSections]);

  const toggleSection = (name: string) => {
    setExpandedSections((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  // Build flat search index
  const searchIndex = navigation.flatMap((item) => {
    if (item.href) {
      return [{ title: item.name, path: item.href, keywords: item.name.toLowerCase() }];
    }
    return (item.children ?? []).map((child) => ({
      title: `${item.name} › ${child.name}`,
      path: child.href,
      keywords: `${item.name} ${child.name}`.toLowerCase(),
    }));
  });

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      setFilteredResults(searchIndex.filter((i) => i.title.toLowerCase().includes(q) || i.keywords.includes(q)));
      setShowSearchResults(true);
      setSelectedIndex(0);
    } else {
      setFilteredResults([]);
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
      if (e.key === 'Escape' && isSearchModalOpen) {
        setIsSearchModalOpen(false);
        setSearchQuery('');
        setShowSearchResults(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchModalOpen]);

  useEffect(() => {
    if (isSearchModalOpen && modalInputRef.current) {
      modalInputRef.current.focus();
    }
  }, [isSearchModalOpen]);

  const handleResultClick = (path: string) => {
    router.push(path);
    setSearchQuery('');
    setShowSearchResults(false);
    setIsSearchModalOpen(false);
    onClose?.();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!showSearchResults || filteredResults.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex((p) => Math.min(p + 1, filteredResults.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex((p) => Math.max(p - 1, 0)); }
    if (e.key === 'Enter' && filteredResults[selectedIndex]) { handleResultClick(filteredResults[selectedIndex].path); }
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

      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen w-64 transform transition-transform duration-200 ease-in-out md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col border-r border-gray-200 dark:border-[#f6f6f4]/10 bg-white dark:bg-[#25231e]">

          {/* Logo */}
          <div className="h-12 flex items-center px-7">
            <Link href="/dashboard" className="flex items-center">
              <img src="/dmfoot.png" alt="Igris" style={{ width: '25px', height: 'auto' }} />
            </Link>
          </div>

          {/* Search */}
          <div className="px-6 pt-5 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                readOnly
                onClick={() => setIsSearchModalOpen(true)}
                className="w-full pl-9 pr-16 py-2 text-[0.75rem] border border-gray-200 dark:border-[#f6f6f4]/10 rounded-lg outline-none bg-white dark:bg-[#25231e] cursor-pointer text-gray-900 dark:text-[#f6f6f4] focus:border-gray-300 dark:focus:border-[#f6f6f4]/20 transition-colors"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <span className="text-xs font-medium text-gray-400">⌘ F</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 pt-2 pb-4 scrollbar-hide">
            <ul className="space-y-0.5">
              {navigation.map((item) => {
                if (item.children) {
                  const isExpanded = expandedSections[item.name];
                  return (
                    <li key={item.name}>
                      <button
                        onClick={() => toggleSection(item.name)}
                        className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-[0.75rem] font-medium font-inter transition-colors text-gray-600 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-[#f5f5f5] dark:hover:bg-[#2c2a22]"
                      >
                        <div className="flex items-center gap-2">
                          <item.icon className="h-4 w-4 text-gray-400 dark:text-[#c8c8b8]" />
                          {item.name}
                        </div>
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 text-gray-400 transition-transform duration-150',
                            isExpanded && 'rotate-180'
                          )}
                        />
                      </button>

                      {isExpanded && (
                        <ul className="mt-0.5 ml-4 space-y-0.5 border-l border-gray-200 dark:border-[#f6f6f4]/10 pl-4">
                          {item.children.map((child) => {
                            const isActive =
                              pathname === child.href ||
                              pathname?.startsWith(child.href + '/');
                            return (
                              <li key={child.name}>
                                <Link
                                  href={child.href}
                                  onClick={onClose}
                                  className={cn(
                                    'flex items-center rounded-lg px-2.5 py-1.5 text-[0.75rem] font-medium font-inter transition-colors',
                                    isActive
                                      ? 'bg-[#f5f5f5] dark:bg-[#282c34] text-gray-900 dark:text-[#f6f6f4] font-semibold'
                                      : 'text-gray-600 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-[#f5f5f5] dark:hover:bg-[#2c2a22]'
                                  )}
                                >
                                  {child.name}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                }

                if (!item.href) return null;
                const isActive = pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[0.75rem] font-medium font-inter transition-colors',
                        isActive
                          ? 'bg-[#f5f5f5] dark:bg-[#282c34] text-gray-900 dark:text-[#f6f6f4] font-semibold'
                          : 'text-gray-600 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-[#f5f5f5] dark:hover:bg-[#2c2a22]'
                      )}
                    >
                      <item.icon className="h-4 w-4 text-gray-400 dark:text-[#c8c8b8]" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Help */}
          <div className="p-4 flex-shrink-0">
            <div className="relative">
              {showHelpMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowHelpMenu(false)} />
                  <div className="absolute bottom-full left-0 right-0 mb-2 z-40 bg-white dark:bg-[#1b1912] border border-gray-200 dark:border-[#f6f6f4]/10 rounded-lg shadow-sm p-2">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 px-2">Documentation</p>
                    <a
                      href="https://docs.igrisinertial.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors"
                      onClick={() => setShowHelpMenu(false)}
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-gray-400" />
                        <span className="text-xs font-inter text-gray-900 dark:text-[#f6f6f4]">Igris Docs</span>
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </a>
                    <div className="border-t border-gray-200 dark:border-[#f6f6f4]/10 my-1" />
                    <a
                      href="mailto:support@igrisinertial.com"
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors"
                      onClick={() => setShowHelpMenu(false)}
                    >
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-xs font-inter text-gray-900 dark:text-[#f6f6f4]">Contact Support</span>
                    </a>
                    <a
                      href="https://changelog.igrisinertial.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors"
                      onClick={() => setShowHelpMenu(false)}
                    >
                      <div className="flex items-center gap-2">
                        <ChangeLogIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-xs font-inter text-gray-900 dark:text-[#f6f6f4]">Change Log</span>
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </a>
                    <a
                      href="https://status.igrisinertial.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors"
                      onClick={() => setShowHelpMenu(false)}
                    >
                      <div className="flex items-center gap-2">
                        <StatusIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-xs font-inter text-gray-900 dark:text-[#f6f6f4]">System Status</span>
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </a>
                  </div>
                </>
              )}
              <button
                onClick={() => setShowHelpMenu(!showHelpMenu)}
                className="flex items-center justify-center w-7 h-7 rounded-full border border-gray-200 dark:border-[#f6f6f4]/10 hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors"
              >
                <span className="text-gray-500 dark:text-[#c8c8b8] text-xs font-semibold">?</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Search Modal */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
          <div
            className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => { setIsSearchModalOpen(false); setSearchQuery(''); setShowSearchResults(false); }}
          />
          <div className="relative w-full max-w-2xl mx-4">
            <div className="bg-white dark:bg-[#1b1912] rounded-xl shadow-2xl border border-gray-200 dark:border-[#f6f6f4]/10 overflow-hidden p-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  ref={modalInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full pl-10 pr-4 py-2 text-sm outline-none rounded-lg border border-gray-200 dark:border-[#f6f6f4]/10 focus:border-gray-300 dark:focus:border-[#f6f6f4]/20 bg-white dark:bg-[#25231e] text-gray-900 dark:text-[#f6f6f4]"
                />
              </div>
              {showSearchResults && filteredResults.length > 0 && (
                <div className="max-h-64 overflow-y-auto bg-gray-50 dark:bg-[#25231e] p-2 mt-2 rounded-lg">
                  {filteredResults.map((result, index) => (
                    <button
                      key={result.path}
                      onClick={() => handleResultClick(result.path)}
                      className={cn(
                        'w-full px-3 py-2 transition-colors text-left flex items-start gap-2.5 border-b border-gray-100 dark:border-[#f6f6f4]/10 last:border-b-0',
                        index === selectedIndex
                          ? 'bg-gray-100 dark:bg-[#1b1912]'
                          : 'hover:bg-gray-50 dark:hover:bg-[#1b1912]'
                      )}
                    >
                      <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4] mb-0.5">{result.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{result.path}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showSearchResults && searchQuery.length > 0 && filteredResults.length === 0 && (
                <div className="p-4 text-center mt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">No results for &ldquo;{searchQuery}&rdquo;</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
