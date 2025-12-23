'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, KeyRound, Network, Settings, X, Activity, LogOut, User, CreditCard, ChevronRight, Eye, Wrench, FileText, Server, ChevronDown } from 'lucide-react';
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

const navigation = [
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
    minTier: 'growth', // Hidden on developer tier
    modes: ['operator', 'audit'] as ViewMode[],
  },
  {
    name: 'Providers & Keys',
    href: '/dashboard/providers',
    icon: KeyRound,
    modes: ['operator', 'architect'] as ViewMode[],
  },
  {
    name: 'Routing Policies',
    href: '/dashboard/policy',
    icon: Network,
    modes: ['architect'] as ViewMode[],
  },
  {
    name: 'Edge Fleet',
    href: '/dashboard/fleet',
    icon: Server,
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
  const [viewMode, setViewMode] = useState<ViewMode>('operator');
  const [showViewModeDropdown, setShowViewModeDropdown] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  // Filter navigation based on tier and view mode
  const visibleNavigation = navigation.filter(item => {
    // Tier filter
    if (item.minTier === 'growth' && tier === 'developer') {
      return false;
    }
    // View mode filter
    if (item.modes && !item.modes.includes(viewMode)) {
      return false;
    }
    return true;
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
          'fixed top-0 left-0 z-50 h-screen w-72 transform transition-transform duration-200 ease-in-out md:translate-x-0 p-3',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col bg-beige-primary rounded-2xl shadow-sm border border-border-light">
          {/* Logo Section */}
          <div className="h-20 flex items-center px-7 pt-6">
            <Link href="/dashboard" className="flex items-center">
              <img
                src="/schlep-logo-34.png"
                alt="Schlep Logo"
                className="h-6 w-auto"
              />
            </Link>
          </div>

          {/* View Mode Selector */}
          <div className="px-4 pt-4">
            <div className="relative">
              <button
                onClick={() => setShowViewModeDropdown(!showViewModeDropdown)}
                className="w-full flex items-center justify-between bg-beige-primary border border-border-light rounded-lg px-3 py-2 text-left hover:bg-beige-secondary transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">View Mode</span>
                  <span className="text-xs font-medium text-gray-900 capitalize">
                    {viewMode}
                  </span>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-600 transition-transform ${showViewModeDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showViewModeDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowViewModeDropdown(false)}
                  />
                  <div className="absolute top-full left-0 right-0 mt-1 bg-beige-primary border border-border-light rounded-lg shadow-lg z-20">
                    {viewModes.map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => {
                          setViewMode(mode.id);
                          setShowViewModeDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                          viewMode === mode.id
                            ? 'bg-beige-secondary text-gray-900 font-medium'
                            : 'text-gray-700 hover:bg-beige-secondary'
                        } ${mode.id === 'operator' ? 'rounded-t-lg' : ''} ${mode.id === 'audit' ? 'rounded-b-lg' : ''}`}
                      >
                        <div>{mode.name}</div>
                        <div className="text-xs text-gray-500">{mode.description}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
            <ul className="space-y-1">
              {visibleNavigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium font-inter transition-colors',
                        isActive
                          ? 'bg-beige-secondary text-gray-900'
                          : 'text-gray-700 hover:bg-beige-primary hover:text-gray-900'
                      )}
                      onClick={onClose}
                    >
                      <item.icon className="h-5 w-5" />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer Section */}
          <div className="p-4 flex-shrink-0">
            <div className="bg-beige-primary border border-border-light rounded-xl p-4 space-y-4">
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
