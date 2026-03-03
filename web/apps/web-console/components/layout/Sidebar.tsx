'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, KeyRound, Network, Settings, X, Activity, Eye, Wrench, FileText, Server, ChevronDown, DollarSign, Shield, Lightbulb, CloudCog, Cpu, Sliders, Radio, Zap, Brain, GraduationCap, Lock, Search, HelpCircle, ExternalLink, Mail, FileText as ChangeLogIcon, Activity as StatusIcon, BookOpen, GitBranch, Flame, AlertTriangle, TestTube, Sparkles, Play, Bell, LayoutDashboard, Boxes, MonitorSmartphone, Settings as ConfigIcon, Layers, Route, Building2, History, Database } from 'lucide-react';
import { cn } from '@/utils/helpers';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

type ViewMode = 'operator' | 'architect' | 'audit';

interface NavigationItem {
  name: string;
  href?: string;
  icon: any;
  modes?: ViewMode[];
  minTier?: string;
  children?: NavigationItem[];
}

const navigation: NavigationItem[] = [
  // OVERVIEW
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    modes: ['operator', 'architect', 'audit'] as ViewMode[],
  },

  // EXECUTION
  {
    name: 'Execution',
    icon: Zap,
    modes: ['operator', 'architect', 'audit'] as ViewMode[],
    children: [
      {
        name: 'Runs',
        href: '/execution/runs',
        icon: Play,
        modes: ['operator', 'architect', 'audit'] as ViewMode[],
      },
      {
        name: 'Agents',
        href: '/execution/agents',
        icon: Brain,
        modes: ['operator', 'architect'] as ViewMode[],
      },
    ],
  },

  // FLEET
  {
    name: 'Fleet',
    icon: Boxes,
    modes: ['operator', 'architect', 'audit'] as ViewMode[],
    children: [
      {
        name: 'Devices',
        href: '/fleet/devices',
        icon: MonitorSmartphone,
        modes: ['operator', 'audit'] as ViewMode[],
      },
    ],
  },

  // MODELS
  {
    name: 'Models',
    icon: Cpu,
    modes: ['operator', 'architect'] as ViewMode[],
    children: [
      {
        name: 'Routing',
        href: '/models/routing',
        icon: Route,
        modes: ['architect'] as ViewMode[],
      },
      {
        name: 'Providers',
        href: '/models/providers',
        icon: CloudCog,
        modes: ['operator', 'architect'] as ViewMode[],
      },
      {
        name: 'Cost',
        href: '/models/cost',
        icon: DollarSign,
        modes: ['operator', 'architect'] as ViewMode[],
      },
    ],
  },

  // POLICY
  {
    name: 'Policy',
    icon: Shield,
    modes: ['operator', 'architect'] as ViewMode[],
    children: [
      {
        name: 'Bounds',
        href: '/policy/bounds',
        icon: Sliders,
        modes: ['architect'] as ViewMode[],
      },
      {
        name: 'Capabilities',
        href: '/policy/capabilities',
        icon: Lightbulb,
        modes: ['architect'] as ViewMode[],
      },
    ],
  },

  // PROOF
  {
    name: 'Proof',
    icon: Shield,
    modes: ['operator', 'audit'] as ViewMode[],
    children: [
      {
        name: 'Receipts',
        href: '/proof/receipts',
        icon: FileText,
        modes: ['operator', 'audit'] as ViewMode[],
      },
      {
        name: 'Violations',
        href: '/proof/violations',
        icon: AlertTriangle,
        modes: ['operator', 'audit'] as ViewMode[],
      },
    ],
  },

  // HISTORY
  {
    name: 'History',
    icon: History,
    modes: ['operator', 'architect', 'audit'] as ViewMode[],
    children: [
      {
        name: 'Logs',
        href: '/history/logs',
        icon: FileText,
        modes: ['operator', 'audit'] as ViewMode[],
      },
      {
        name: 'Metrics',
        href: '/history/metrics',
        icon: Activity,
        modes: ['operator', 'architect'] as ViewMode[],
      },
      {
        name: 'Alerts',
        href: '/history/alerts',
        icon: Bell,
        modes: ['operator', 'architect'] as ViewMode[],
      },
    ],
  },

  // SETTINGS
  {
    name: 'Settings',
    icon: Settings,
    modes: ['operator', 'architect'] as ViewMode[],
    children: [
      {
        name: 'General',
        href: '/settings/general',
        icon: ConfigIcon,
        modes: ['operator'] as ViewMode[],
      },
      {
        name: 'Keys',
        href: '/settings/keys',
        icon: KeyRound,
        modes: ['architect'] as ViewMode[],
      },
      {
        name: 'License',
        href: '/settings/license',
        icon: FileText,
        modes: ['operator'] as ViewMode[],
      },
    ],
  },
];

const viewModes = [
  {
    id: 'operator' as ViewMode,
    name: 'Operator',
    description: 'Health, alerts, monitoring',
  },
  {
    id: 'architect' as ViewMode,
    name: 'Architect',
    description: 'Policies, rules, config',
  },
  {
    id: 'audit' as ViewMode,
    name: 'Audit',
    description: 'Historical traces, logs',
  },
];

export function Sidebar({ open = true, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const tier = 'scale'; // Temporarily default to 'scale' for development
  const [searchQuery, setSearchQuery] = useState('');
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [filteredResults, setFilteredResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Execution: false,
    Fleet: false,
    Models: false,
    Policy: false,
    Proof: false,
    History: false,
    Settings: false,
  });

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebar_expanded');
    if (saved) {
      try {
        setExpandedSections(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Auto-expand section containing active route (only if no saved state)
  useEffect(() => {
    const saved = localStorage.getItem('sidebar_expanded');
    if (!saved) {
      const activeSection = navigation.find(item => 
        item.children?.some(child => pathname === child.href || pathname?.startsWith(child.href + '/'))
      );
      if (activeSection) {
        setExpandedSections(prev => ({
          ...prev,
          [activeSection.name]: true
        }));
      }
    }
  }, [pathname]);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('sidebar_expanded', JSON.stringify(expandedSections));
  }, [expandedSections]);

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  // Build search index from navigation
  const searchIndex = navigation.flatMap(item => {
    const items = [];
    if (item.href) {
      items.push({ title: item.name, path: item.href, keywords: item.name.toLowerCase() });
    }
    if (item.children) {
      item.children.forEach(child => {
        items.push({ title: `${item.name} > ${child.name}`, path: child.href!, keywords: `${item.name} ${child.name}`.toLowerCase() });
      });
    }
    return items;
  });

  // Handle search
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      const results = searchIndex.filter(item =>
        item.title.toLowerCase().includes(query) ||
        item.keywords.includes(query)
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

  // Filter navigation based on tier only (removed view mode filtering)
  const filterNavigationItem = (item: NavigationItem): boolean => {
    // Tier filter
    if (item.minTier === 'growth' && tier === 'developer') {
      return false;
    }
    return true;
  };

  const visibleNavigation = navigation.filter(filterNavigationItem).map(item => {
    if (item.children) {
      return {
        ...item,
        children: item.children.filter(filterNavigationItem),
      };
    }
    return item;
  });

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
          'fixed top-0 left-0 z-50 h-screen w-64 transform transition-transform duration-200 ease-in-out md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col border-r border-gray-200 dark:border-[#f6f6f4]/10 bg-white dark:bg-[#25231e]">
          {/* Logo Section */}
          <div className="h-12 flex items-center px-7">
            <Link href="/dashboard" className="flex items-center">
              <img
                src="/dmfoot.png"
                alt="dmfoot"
                 style={{ width: '25px', height: 'auto' }}
              />
            </Link>
          </div>

          {/* Search Bar */}
          <div className="px-6 pt-5 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder=""
                readOnly
                onClick={() => setIsSearchModalOpen(true)}
                className="w-full pl-9 pr-16 py-2 text-[0.75rem] border border-gray-200 dark:border-[#f6f6f4]/10 rounded-lg outline-none bg-white dark:bg-[#25231e] focus:border-gray-300 dark:focus:border-[#f6f6f4]/20 transition-colors cursor-pointer text-gray-900 dark:text-[#f6f6f4]"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                <span className="text-xs font-medium text-gray-400">⌘ F</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 pt-2 pb-4 scrollbar-hide">
            <ul className="space-y-1">
              {visibleNavigation.map((item) => {
                // If item has children, render as expandable section
                if (item.children && item.children.length > 0) {
                  const isExpanded = expandedSections[item.name];

                  return (
                    <li key={item.name}>
                      {/* Section Header */}
                      <button
                        onClick={() => toggleSection(item.name)}
                        className={cn(
                          'w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-[0.75rem] font-medium font-inter transition-colors',
                          'text-gray-600 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-[#f5f5f5] dark:hover:bg-[#2c2a22]'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <item.icon className="h-4 w-4 text-gray-400 dark:text-[#c8c8b8]" />
                          {item.name}
                        </div>
                        <ChevronDown
                          className={cn(
                            'h-3.5 w-3.5 text-gray-400 transition-transform',
                            isExpanded ? 'rotate-180' : ''
                          )}
                        />
                      </button>

                      {/* Child Items */}
                      {isExpanded && (
                        <ul className="mt-0.5 ml-4 space-y-0.5 border-l border-gray-200 dark:border-[#f6f6f4]/10 pl-4">
                          {item.children.map((child) => {
                            const isActive = pathname === child.href || pathname?.startsWith(child.href + '/');
                            return (
                              <li key={child.name}>
                                <Link
                                  href={child.href!}
                                  className={cn(
                                    'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.75rem] font-medium font-inter transition-colors',
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

                // Regular top-level item (only render if it has an href)
                if (!item.href) {
                  return null;
                }

                const isActive = pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-1.5 text-[0.75rem] font-medium font-inter transition-colors',
                        isActive
                          ? 'bg-[#f5f5f5] dark:bg-[#282c34] text-gray-900 dark:text-[#f6f6f4] font-semibold'
                          : 'text-gray-600 dark:text-[#c8c8b8] hover:text-gray-900 dark:hover:text-[#f6f6f4] hover:bg-[#f5f5f5] dark:hover:bg-[#2c2a22]'
                      )}
                      onClick={onClose}
                    >
                      <item.icon className="h-4 w-4 text-gray-400 dark:text-[#c8c8b8]" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Help Button */}
          <div className="p-4 flex-shrink-0">
            <div className="relative">
              {/* Help Menu Dropdown */}
              {showHelpMenu && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowHelpMenu(false)}
                  />
                   <div className="absolute bottom-full left-0 right-0 mb-2 z-40 bg-white dark:bg-[#1b1912] border border-gray-200 dark:border-[#f6f6f4]/10 rounded-lg shadow-sm p-2">
                    {/* Docs Section */}
                    <div className="py-1.5">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 px-2">Documentation</p>
                      <a
                        href="https://docs.igrisinertial.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors text-left"
                        onClick={() => setShowHelpMenu(false)}
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-gray-400" />
                          <span className="text-xs font-inter text-gray-900 dark:text-[#f6f6f4]">Igris Docs</span>
                        </div>
                        <ExternalLink className="h-4 w-4 text-gray-400" />
                      </a>
                    </div>

                    <div className="border-t border-gray-200 dark:border-[#f6f6f4]/10 my-1"></div>

                    {/* Support Email */}
                    <a
                      href="mailto:support@igrisinertial.com"
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors text-left"
                      onClick={() => setShowHelpMenu(false)}
                    >
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-xs font-inter text-gray-900 dark:text-[#f6f6f4]">Contact Support</span>
                    </a>

                    {/* Change Log */}
                    <a
                      href="https://changelog.igrisinertial.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors text-left"
                      onClick={() => setShowHelpMenu(false)}
                    >
                      <div className="flex items-center gap-2">
                        <ChangeLogIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-xs font-inter text-gray-900 dark:text-[#f6f6f4]">Change Log</span>
                      </div>
                      <ExternalLink className="h-4 w-4 text-gray-400" />
                    </a>

                    {/* System Status */}
                    <a
                      href="https://status.igrisinertial.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-[#2c2a22] transition-colors text-left"
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

              {/* Help Button */}
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
          {/* Backdrop with blur */}
          <div
            className="absolute inset-0 bg-black/20 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setIsSearchModalOpen(false);
              setSearchQuery('');
              setShowSearchResults(false);
            }}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-2xl mx-4">
            <div className="bg-white dark:bg-[#1b1912] rounded-xl shadow-2xl border border-gray-200 dark:border-[#f6f6f4]/10 overflow-hidden p-2">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  ref={modalInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-10 pr-4 py-2 text-sm outline-none rounded-lg border border-gray-200 dark:border-[#f6f6f4]/10 focus:border-gray-300 dark:focus:border-[#f6f6f4]/20 bg-white dark:bg-[#25231e] text-gray-900 dark:text-[#f6f6f4]"
                />
              </div>

              {/* Search Results */}
              {showSearchResults && filteredResults.length > 0 && (
                <div className="max-h-64 overflow-y-auto bg-gray-50 dark:bg-[#25231e] p-2 mt-2 rounded-lg">
                  {filteredResults.map((result, index) => (
                    <button
                      key={result.path}
                      onClick={() => handleResultClick(result.path)}
                      className={`w-full px-3 py-2 transition-colors text-left flex items-start gap-2.5 border-b border-gray-100 dark:border-[#f6f6f4]/10 last:border-b-0 ${index === selectedIndex ? 'bg-gray-100 dark:bg-[#1b1912]' : 'hover:bg-gray-50 dark:hover:bg-[#1b1912]'
                        }`}
                    >
                      <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4] mb-0.5">
                          {result.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
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
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No results found for &ldquo;{searchQuery}&rdquo;
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
