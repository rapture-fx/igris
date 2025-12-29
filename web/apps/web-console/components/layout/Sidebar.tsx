'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, KeyRound, Network, Settings, X, Activity, LogOut, User, CreditCard, ChevronRight, Eye, Wrench, FileText, Server, ChevronDown, DollarSign, Shield, Lightbulb, CloudCog, Cpu, Sliders, Radio, Zap, Brain, GraduationCap, Lock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, getInitials } from '@/utils/helpers';
import { useTenant } from '@/hooks/useTenant';
import { logout } from '@/lib/auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
        name: 'Cognitive Advisor',
        href: '/dashboard/cognitive',
        icon: Home,
        modes: ['architect'] as ViewMode[],
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
      {
        name: 'EscapeVector',
        href: '/dashboard/runtime/escape',
        icon: Home,
        modes: ['architect', 'operator'] as ViewMode[],
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
  const router = useRouter();
  const { data: tenant } = useTenant();
  const tier = tenant?.plan || 'scale'; // Temporarily default to 'scale' for development
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    Overture: true,
    Runtime: true,
    Agents: true,
  });

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

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
        <div className="flex h-full flex-col bg-beige-primary shadow-sm border-r border-gray-200">
          {/* Logo Section */}
          <div className="h-12 flex items-center px-7 border-b border-gray-200">
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
                          <item.icon className="h-4 w-4" />
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
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer Section */}
          <div className="p-4 flex-shrink-0 border-t border-border-light">
              {/* Help Section */}
              <div>
                <p className="text-xs font-medium font-inter text-gray-900 mb-1">
                  Need help?
                </p>
                <p className="text-xs text-gray-600 font-inter">
                  Check our{' '}
                  <Link
                    href="/docs"
                    className="text-gray-600 hover:text-gray-900 font-medium underline inline-flex items-center gap-1"
                  >
                    documentation
                    <span className="text-xs">↗</span>
                  </Link>
                  {' '}or{' '}
                  <a
                    href="mailto:support@igrisinertial.com"
                    className="text-gray-600 hover:text-gray-900 font-medium underline"
                  >
                    support@igrisinertial.com
                  </a>
                </p>
              </div>

              {/* Profile & Sign Out Section */}
              <div className="relative pt-3 border-t border-border-light">
              {/* Profile Menu Dropdown */}
              {showProfileMenu && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <div className="absolute bottom-full left-0 right-0 mb-2 z-40 bg-beige-primary border border-border-light rounded-lg shadow-lg p-2">
                    <button
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-lg hover:bg-beige-primary transition-colors text-left"
                      onClick={() => {
                        setShowProfileMenu(false);
                        // Billing logic will be implemented later
                      }}
                    >
                      <CreditCard className="h-5 w-5 text-gray-700" />
                      <div>
                        <p className="text-sm font-medium font-inter text-gray-900">Billing</p>
                        <p className="text-xs text-gray-600 font-inter">Manage your subscription and billing</p>
                      </div>
                    </button>

                    <button
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-lg hover:bg-beige-primary transition-colors text-left border-t border-border-light mt-2 pt-4"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowLogoutDialog(true);
                      }}
                    >
                      <LogOut className="h-5 w-5 text-gray-900" />
                      <div>
                        <p className="text-sm font-medium font-inter text-gray-900">Logout</p>
                        <p className="text-xs text-gray-600 font-inter">Sign out of your account</p>
                      </div>
                    </button>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowProfileMenu(true)}
                  className="flex items-center gap-3 flex-1 hover:bg-beige-primary rounded-lg p-2 transition-colors"
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-900 text-white font-semibold text-sm">
                    {tenant ? getInitials(tenant.name) : 'U'}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium font-inter text-gray-900">
                      {tenant?.name || 'Profile'}
                    </span>
                    <span className="text-xs text-gray-600 font-inter">
                      Profile
                    </span>
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Collapse"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out of your account?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLogoutDialog(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
