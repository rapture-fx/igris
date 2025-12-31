'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
    name: 'Observability',
    href: '/dashboard/observability',
    icon: Activity,
    minTier: 'growth',
    modes: ['operator', 'audit'] as ViewMode[],
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
  const tier = 'scale'; // Temporarily default to 'scale' for development
  const [searchQuery, setSearchQuery] = useState('');
  const [showHelpMenu, setShowHelpMenu] = useState(false);
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
        <div className="flex h-full flex-col bg-beige-primary border-r border-border-light">
          {/* Logo Section */}
          <div className="h-12 flex items-center px-7 border-b border-border-light">
            <Link href="/dashboard" className="flex items-center">
              <img
                src="/schlep-logo-34.png"
                alt="Schlep Logo"
                className="h-6 w-auto"
              />
            </Link>
          </div>

          {/* Search Bar */}
          <div className="px-3 py-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-[0.75rem] border border-border-light rounded-lg outline-none bg-beige-primary focus:border-gray-300 transition-colors"
              />
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
                          'w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-[0.75rem] font-medium font-inter transition-colors',
                          hasActiveChild
                            ? 'bg-beige-secondary text-gray-900'
                            : 'text-gray-700 hover:bg-beige-primary hover:text-gray-900'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon className="h-5 w-4" style={{ color: 'rgb(75, 85, 99)' }} />
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
                        <ul className="mt-1 ml-3 space-y-1 border-l border-border-light pl-2">
                          {item.children.map((child) => {
                            const isActive = pathname === child.href || pathname?.startsWith(child.href + '/');
                            return (
                              <li key={child.name}>
                                <Link
                                  href={child.href!}
                                  className={cn(
                                    'flex items-center gap-3 rounded-lg px-3 py-2 text-[0.7rem] font-medium font-inter transition-colors',
                                    isActive
                                      ? 'bg-beige-secondary text-gray-900'
                                      : 'text-gray-600 hover:bg-beige-primary hover:text-gray-900'
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
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.75rem] font-medium font-inter transition-colors',
                        isActive
                          ? 'bg-beige-secondary text-gray-900'
                          : 'text-gray-700 hover:bg-beige-primary hover:text-gray-900'
                      )}
                      onClick={onClose}
                    >
                      <item.icon className="h-5 w-4" style={{ color: 'rgb(75, 85, 99)' }} />
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
                  <div className="absolute bottom-full left-0 right-0 mb-2 z-40 bg-beige-primary border border-border-light rounded-lg shadow-lg p-2">
                    {/* Docs Section */}
                    <div className="px-2 py-1.5">
                      <p className="text-[0.65rem] font-medium text-gray-600 mb-1.5">Documentation</p>
                      <a
                        href="https://docs.igrisinertial.com/overture"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-beige-secondary transition-colors text-left"
                        onClick={() => setShowHelpMenu(false)}
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-3.5 w-3.5 text-gray-700" />
                          <span className="text-xs font-inter text-gray-900">Overture Docs</span>
                        </div>
                        <ExternalLink className="h-2.5 w-2.5 text-gray-600" />
                      </a>
                      <a
                        href="https://docs.igrisinertial.com/runtime"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-beige-secondary transition-colors text-left"
                        onClick={() => setShowHelpMenu(false)}
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-3.5 w-3.5 text-gray-700" />
                          <span className="text-xs font-inter text-gray-900">Runtime Docs</span>
                        </div>
                        <ExternalLink className="h-2.5 w-2.5 text-gray-600" />
                      </a>
                    </div>

                    <div className="border-t border-border-light my-1"></div>

                    {/* Support Email */}
                    <a
                      href="mailto:support@igrisinertial.com"
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-beige-secondary transition-colors text-left"
                      onClick={() => setShowHelpMenu(false)}
                    >
                      <Mail className="h-3.5 w-3.5 text-gray-700" />
                      <span className="text-xs font-inter text-gray-900">Contact Support</span>
                    </a>

                    {/* Change Log */}
                    <a
                      href="https://changelog.igrisinertial.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-beige-secondary transition-colors text-left"
                      onClick={() => setShowHelpMenu(false)}
                    >
                      <div className="flex items-center gap-2">
                        <ChangeLogIcon className="h-3.5 w-3.5 text-gray-700" />
                        <span className="text-xs font-inter text-gray-900">Change Log</span>
                      </div>
                      <ExternalLink className="h-2.5 w-2.5 text-gray-600" />
                    </a>

                    {/* System Status */}
                    <a
                      href="https://status.igrisinertial.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-beige-secondary transition-colors text-left"
                      onClick={() => setShowHelpMenu(false)}
                    >
                      <div className="flex items-center gap-2">
                        <StatusIcon className="h-3.5 w-3.5 text-gray-700" />
                        <span className="text-xs font-inter text-gray-900">System Status</span>
                      </div>
                      <ExternalLink className="h-2.5 w-2.5 text-gray-600" />
                    </a>
                  </div>
                </>
              )}

              {/* Help Button */}
              <button
                onClick={() => setShowHelpMenu(!showHelpMenu)}
                className="flex items-center justify-center w-10 h-10 rounded-full border border-border-light hover:bg-beige-secondary transition-colors"
              >
                <span className="text-gray-500 text-lg font-semibold">?</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
