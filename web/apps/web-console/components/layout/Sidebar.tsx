'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BarChart3, Key, Shield, Settings, X } from 'lucide-react';
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
    icon: LayoutDashboard,
  },
  {
    name: 'Usage & Analytics',
    href: '/dashboard/usage',
    icon: BarChart3,
  },
  {
    name: 'Providers & Keys',
    href: '/dashboard/providers',
    icon: Key,
  },
  {
    name: 'Routing Policies',
    href: '/dashboard/policy',
    icon: Shield,
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
          'fixed top-0 left-0 z-50 h-screen w-64 transform border-r border-border-light bg-beige-primary transition-transform duration-200 ease-in-out md:sticky md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b border-border-light px-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-schlep-blue text-white font-bold text-sm">
                S
              </div>
              <span className="font-inter font-semibold text-lg text-gray-900">
                Console
              </span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 py-4">
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
                          ? 'bg-schlep-blue text-white'
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
          <div className="border-t border-border-light p-4">
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
