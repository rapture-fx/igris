'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, TrendingUp, KeyRound, Network, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/helpers';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    name: 'Usage & Analytics',
    href: '/dashboard/usage',
    icon: TrendingUp,
  },
  {
    name: 'Providers & Keys',
    href: '/dashboard/providers',
    icon: KeyRound,
  },
  {
    name: 'Routing Policies',
    href: '/dashboard/policy',
    icon: Network,
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

export function Sidebar({ open = true, onClose }: SidebarProps) {
  const pathname = usePathname();

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
          'fixed top-0 left-0 z-40 h-screen w-64 transform bg-beige-primary transition-transform duration-200 ease-in-out md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col border-r border-border-light">
          <div className="h-16 border-r border-border-light"></div>
          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 pt-8 pb-4">
            <ul className="space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium font-inter transition-colors',
                        isActive
                          ? 'bg-beige-secondary shadow-md text-gray-900 border border-border-light'
                          : 'text-gray-700 hover:bg-beige-secondary hover:text-gray-900'
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

          {/* Footer */}
          <div className="border-t border-border-light p-4 flex-shrink-0">
            <div className="rounded-lg bg-beige-secondary p-3">
              <p className="text-xs font-medium font-inter text-gray-900 mb-1">
                Need help?
              </p>
              <p className="text-xs text-gray-600 font-inter mb-2">
                Check our documentation or contact support
              </p>
              <Button variant="outline" size="sm" className="w-full text-xs">
                View Docs
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
