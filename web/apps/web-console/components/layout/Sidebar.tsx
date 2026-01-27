'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, KeyRound, Network, Settings, X, Activity, Eye, Wrench, FileText, Server, ChevronDown, DollarSign, Shield, Lightbulb, CloudCog, Cpu, Sliders, Radio, Zap, Brain, GraduationCap, Lock, Search, HelpCircle, ExternalLink, Mail, FileText as ChangeLogIcon, Activity as StatusIcon, BookOpen } from 'lucide-react';
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
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
    modes: ['operator', 'architect', 'audit'] as ViewMode[],
  },
  {
    name: 'Observability',
    href: '/dashboard/observability',
    icon: Activity,
    minTier: 'growth',
    modes: ['operator', 'audit'] as ViewMode[],
  },
  {
    name: 'Overture',
    icon: CloudCog,
    modes: ['operator', 'architect'] as ViewMode[],
    children: [
      {
        name: 'Providers',
        href: '/dashboard/providers',
        icon: Home,
        modes: ['operator', 'architect'] as ViewMode[],
      },
      {
        name: 'Routing Rules',
        href: '/dashboard/policy',
        icon: Home,
        modes: ['architect'] as ViewMode[],
      },
      {
        name: 'Cost & Quota',
        href: '/dashboard/usage',
        icon: Home,
        modes: ['operator', 'architect'] as ViewMode[],
      },
      {
        name: 'Shadow Mode',
        href: '/dashboard/overture/shadow',
        icon: Home,
        modes: ['architect'] as ViewMode[],
      },
      {
        name: 'Speculative Router',
        href: '/dashboard/overture/speculative',
        icon: Home,
        modes: ['architect'] as ViewMode[],
      },
      {
        name: 'Cognitive Advisor',
        href: '/dashboard/overture/cognitive',
        icon: Home,
        modes: ['architect'] as ViewMode[],
      },
      {
        name: 'Council Mode',
        href: '/dashboard/overture/council',
        icon: Home,
        modes: ['architect'] as ViewMode[],
      },
      {
        name: 'EscapeVector (Cloud)',
        href: '/dashboard/overture/escapevector',
        icon: Home,
        modes: ['operator', 'architect'] as ViewMode[],
      },
    ],
  },
  {
    name: 'Runtime',
    icon: Server,
    modes: ['operator', 'audit'] as ViewMode[],
    children: [
      {
        name: 'Fleet Overview',
        href: '/dashboard/runtime/fleet',
        icon: Home,
        modes: ['operator', 'audit'] as ViewMode[],
      },
      {
        name: 'Device Details',
        href: '/dashboard/runtime/devices',
        icon: Home,
        modes: ['operator', 'audit'] as ViewMode[],
      },
      {
        name: 'Config Push',
        href: '/dashboard/runtime/config',
        icon: Home,
        modes: ['architect'] as ViewMode[],
      },
      {
        name: 'Swarm Status',
        href: '/dashboard/runtime/swarm',
        icon: Home,
        modes: ['operator', 'audit'] as ViewMode[],
      },
    ],
  },
  {
    name: 'Agents',
    icon: Brain,
    modes: ['operator', 'architect'] as ViewMode[],
    children: [
      {
        name: 'Planning & Reflection',
        href: '/dashboard/agents/planning',
        icon: Home,
        modes: ['architect'] as ViewMode[],
      },
      {
        name: 'Tools Management',
        href: '/dashboard/agents/tools',
        icon: Home,
        modes: ['architect'] as ViewMode[],
      },
      {
        name: 'QLoRA Training',
        href: '/dashboard/agents/qlora',
        icon: Home,
        modes: ['architect'] as ViewMode[],
      },
    ],
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    modes: ['operator', 'architect'] as ViewMode[],
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
    Overture: true,
    Runtime: true,
    Agents: true,
  });

  const toggleSection = (sectionName: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName],
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
        <div className="flex h-full flex-col border-r border-border" style={{ backgroundColor: '#14120a' }}>
          {/* Logo Section */}
          <div className="h-12 flex items-center px-7">
            <Link href="/dashboard" className="flex items-center">
              <img
                src="/dmfoot.png"
                alt="dmfoot"
                 style={{ width: '20px', height: 'auto' }}
              />
            </Link>
          </div>

          {/* Search Bar */}
          <div className="px-4 py-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder=""
                readOnly
                onClick={() => setIsSearchModalOpen(true)}
                className="w-full pl-9 pr-16 py-2 text-xs border border-border rounded-lg outline-none bg-background focus:border-gray-300 dark:focus:border-border transition-colors cursor-pointer text-foreground"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                <span className="text-xs text-muted-foreground">⌘ F</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
            <ul className="space-y-1">
              {visibleNavigation.map((item) => {
                // If item has children, render as expandable section
                if (item.children && item.children.length > 0) {
                  const isExpanded = expandedSections[item.name];
                  const hasActiveChild = item.children.some(child => pathname === child.href || pathname?.startsWith(child.href + '/'));

                  return (
                    <li key={item.name}>
                      {/* Section Header */}
                      <button
                        onClick={() => toggleSection(item.name)}
                        className={cn(
                          'w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-xs font-medium font-inter transition-colors',
                          hasActiveChild
                            ? 'bg-muted text-foreground'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="h-4 w-4 text-foreground" />
                          {item.name}
                        </div>
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 transition-transform',
                            isExpanded ? 'rotate-180' : ''
                          )}
                        />
                      </button>

                      {/* Child Items */}
                      {isExpanded && (
                        <ul className="mt-1 ml-3 space-y-1 border-l border-border pl-2">
                          {item.children.map((child) => {
                            const isActive = pathname === child.href || pathname?.startsWith(child.href + '/');
                            return (
                              <li key={child.name}>
                                <Link
                                  href={child.href!}
                                  className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium font-inter transition-colors',
                                    isActive
                                      ? 'bg-muted text-foreground'
                                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                  )}
                                  onClick={onClose}
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
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium font-inter transition-colors',
                        isActive
                          ? 'text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                      onClick={onClose}
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground" />
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
                   <div className="absolute bottom-full left-0 right-0 mb-2 z-40 bg-card border border-border rounded-lg shadow-sm p-2">
                    {/* Docs Section */}
                    <div className="py-1.5">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5 px-2">Documentation</p>
                      <a
                        href="https://docs.igrisinertial.com/overture"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-muted transition-colors text-left"
                        onClick={() => setShowHelpMenu(false)}
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-inter text-foreground">Overture Docs</span>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </a>
                      <a
                        href="https://docs.igrisinertial.com/runtime"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-muted transition-colors text-left"
                        onClick={() => setShowHelpMenu(false)}
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-inter text-foreground">Runtime Docs</span>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      </a>
                    </div>

                    <div className="border-t border-border my-1"></div>

                    {/* Support Email */}
                    <a
                      href="mailto:support@igrisinertial.com"
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-muted transition-colors text-left"
                      onClick={() => setShowHelpMenu(false)}
                    >
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-inter text-foreground">Contact Support</span>
                    </a>

                    {/* Change Log */}
                    <a
                      href="https://changelog.igrisinertial.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-muted transition-colors text-left"
                      onClick={() => setShowHelpMenu(false)}
                    >
                      <div className="flex items-center gap-2">
                        <ChangeLogIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-inter text-foreground">Change Log</span>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>

                    {/* System Status */}
                    <a
                      href="https://status.igrisinertial.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-muted transition-colors text-left"
                      onClick={() => setShowHelpMenu(false)}
                    >
                      <div className="flex items-center gap-2">
                        <StatusIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-inter text-foreground">System Status</span>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  </div>
                </>
              )}

              {/* Help Button */}
              <button
                onClick={() => setShowHelpMenu(!showHelpMenu)}
                className="flex items-center justify-center w-7 h-7 rounded-full border border-border hover:bg-muted transition-colors"
              >
                <span className="text-muted-foreground text-xs font-semibold">?</span>
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
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => {
              setIsSearchModalOpen(false);
              setSearchQuery('');
              setShowSearchResults(false);
            }}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-2xl mx-4">
            <div className="bg-white dark:bg-card rounded-xl shadow-2xl border border-gray-200 dark:border-border overflow-hidden p-1">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  ref={modalInputRef}
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full pl-10 pr-4 py-2 text-xs outline-none rounded-lg border border-gray-200 dark:border-border focus:border-gray-300 dark:focus:border-border bg-background text-foreground"
                />
              </div>

              {/* Search Results */}
              {showSearchResults && filteredResults.length > 0 && (
                <div className="max-h-64 overflow-y-auto bg-gray-50 dark:bg-muted p-2 mt-2 rounded-lg">
                  {filteredResults.map((result, index) => (
                    <button
                      key={result.path}
                      onClick={() => handleResultClick(result.path)}
                      className={`w-full px-3 py-2 transition-colors text-left flex items-start gap-2.5 border-b border-gray-100 dark:border-border last:border-b-0 ${index === selectedIndex ? 'bg-gray-100 dark:bg-background' : 'hover:bg-gray-50 dark:hover:bg-background'
                        }`}
                    >
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground mb-0.5">
                          {result.title}
                        </div>
                        <div className="text-[0.65rem] text-muted-foreground truncate">
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
                  <p className="text-sm text-muted-foreground">
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
