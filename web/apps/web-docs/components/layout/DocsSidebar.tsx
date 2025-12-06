'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

const navigation: NavigationItem[] = [
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
    name: 'API Reference',
    href: '/docs/api',
    icon: Code,
    children: [
      { name: '/v1/health', href: '/docs/api#health-check', badge: 'GET' },
      { name: '/v1/infer', href: '/docs/api#inference-openai-compatible', badge: 'POST' },
      { name: '/v1/chat/completions', href: '/docs/api#inference-openai-compatible', badge: 'POST' },
      { name: '/v1/embeddings', href: '/docs/api#embeddings', badge: 'POST' },
      { name: '/v1/providers', href: '/docs/api#list-providers', badge: 'GET' },
      { name: '/v1/providers/{name}/stats', href: '/docs/api#provider-stats', badge: 'GET' },
      { name: '/v1/providers/custom', href: '/docs/api#register-custom-provider', badge: 'POST' },
      { name: '/v1/admin/tenants', href: '/docs/api#create-tenant', badge: 'POST' },
      { name: '/v1/tenants/{id}/usage', href: '/docs/api#get-tenant-usage', badge: 'GET' },
      { name: '/v1/tenants/{id}/costs/breakdown', href: '/docs/api#get-cost-breakdown', badge: 'GET' },
      { name: '/v1/routing/preview', href: '/docs/api#preview-routing-decision', badge: 'POST' },
      { name: '/v1/health/metrics', href: '/docs/api#health-metrics', badge: 'GET' },
      { name: '/metrics', href: '/docs/api#prometheus-metrics', badge: 'GET' },
      { name: '/admin/optimizer', href: '/docs/api#update-optimizer-config', badge: 'POST' },
      { name: '/admin/routing/reset', href: '/docs/api#reset-thompson-sampling', badge: 'POST' },
    ],
  },
  {
    name: 'SDK Usage',
    href: '/docs/sdk-usage',
    icon: Package,
  },
  {
    name: 'Core Features',
    href: '/docs/core-features',
    icon: Box,
    children: [
      { name: 'EscapeVector Mode', href: '/docs/core-features/escape-vector' },
      { name: 'Gold Code Override', href: '/docs/core-features/gold-code' },
      { name: 'Emergency Hotfix Blob', href: '/docs/core-features/hotfix-blob' },
      { name: 'Speculative Execution', href: '/docs/core-features/speculative' },
      { name: 'Council Mode', href: '/docs/core-features/council-mode' },
      { name: 'Cognitive Advisor', href: '/docs/core-features/cognitive-advisor' },
    ],
  },
  {
    name: 'Architecture',
    href: '/docs/architecture',
    icon: Layers,
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
  {
    name: 'FAQ',
    href: '/docs/faq',
    icon: HelpCircle,
  },
  {
    name: 'Changelog',
    href: '/docs/changelog',
    icon: FileText,
  },
];

export function DocsSidebar({ open = true, onClose }: DocsSidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Auto-expand parent if child is active
  useEffect(() => {
    navigation.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some(child => pathname === child.href);
        if (hasActiveChild) {
          setExpandedItems((prev) =>
            prev.includes(item.name) ? prev : [...prev, item.name]
          );
        }
      }
    });
  }, [pathname]);

  const toggleExpanded = (itemName: string) => {
    setExpandedItems((prev) =>
      prev.includes(itemName)
        ? prev.filter((name) => name !== itemName)
        : [...prev, itemName]
    );
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
        <div className="flex h-full flex-col bg-beige-secondary rounded-2xl shadow-md border border-border-light">
          {/* Logo Section */}
          <div className="h-20 flex items-center px-7 pt-6">
            <Link href="/docs" className="flex items-center">
              <img
                src="/img/schlep-logo-34.png"
                alt="Schlep Logo"
                className="h-6 w-auto"
              />
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-4 pt-8 pb-4 scrollbar-hide">
            <ul className="space-y-1">
              {navigation.map((item) => {
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
                      // Items with children - clickable link + expand button
                      <div className="flex items-center gap-0 rounded-lg overflow-hidden">
                        <Link
                          href={item.href}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2 text-[0.8125rem] font-medium font-inter transition-colors flex-1',
                            isParentActive
                              ? 'text-primary font-semibold'
                              : 'text-gray-700 hover:text-gray-900'
                          )}
                          onClick={onClose}
                        >
                          {item.icon && <item.icon className="h-4 w-4" />}
                          <span className="flex-1">{item.name}</span>
                        </Link>
                        <button
                          onClick={() => toggleExpanded(item.name)}
                          className={cn(
                            'px-2 py-2 transition-colors',
                            isParentActive
                              ? 'text-primary'
                              : 'text-gray-700 hover:text-gray-900'
                          )}
                        >
                          <ChevronRight
                            className={cn(
                              'h-3.5 w-3.5 transition-transform',
                              isExpanded && 'rotate-90'
                            )}
                          />
                        </button>
                      </div>
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
          </nav>

          {/* Footer Section */}
          <div className="p-4 flex-shrink-0">
            <div className="bg-beige-secondary shadow-md border border-border-light rounded-xl p-3">
              <p className="text-[0.6875rem] font-medium font-inter text-gray-900 mb-0.5">
                Need help?
              </p>
              <p className="text-[0.6875rem] text-gray-600 font-inter">
                Contact us at{' '}
                <a
                  href="mailto:support@schlep-engine.com"
                  className="text-gray-600 hover:text-gray-900 font-medium underline"
                >
                  support@schlep-engine.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
