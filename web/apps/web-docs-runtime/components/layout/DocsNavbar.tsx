'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export function DocsNavbar() {
  const pathname = usePathname();

  // Generate breadcrumbs from pathname
  const generateBreadcrumbs = () => {
    if (!pathname) return [];

    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Docs', href: '/docs' }];

    let currentPath = '';
    segments.slice(1).forEach((segment) => {
      currentPath += `/${segment}`;
      const label = segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      breadcrumbs.push({ label, href: `/docs${currentPath}` });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <>
    <nav className="bg-beige-primary border-b border-border-light h-12">
      <div className="h-full">
        <div className="h-full max-w-[90rem] mx-auto px-8 sm:px-12 lg:px-16">
          <div className="h-full flex gap-12">
            {/* Left side: Breadcrumbs + spacer for content area */}
            <div className="flex-1 min-w-0 flex items-center">
              <div className="flex items-center space-x-2 text-sm">
                {breadcrumbs.map((breadcrumb, index) => (
                  <div key={breadcrumb.href} className="flex items-center">
                    {index > 0 && (
                      <ChevronRight className="h-4 w-4 text-gray-400 mx-2" />
                    )}
                    {index === breadcrumbs.length - 1 ? (
                      <span className="text-gray-900 font-medium">
                        {breadcrumb.label}
                      </span>
                    ) : (
                      <Link
                        href={breadcrumb.href}
                        className="text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        {breadcrumb.label}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right side: Dashboard and Sign Up buttons */}
            <div className="hidden xl:flex items-center gap-3 w-64">
              {/* Dashboard Button */}
              <Link
                href="/dashboard"
                className="px-3 py-1.5 text-xs font-medium text-gray-900 bg-beige-primary hover:bg-beige-secondary rounded-lg transition-colors whitespace-nowrap shadow-sm border border-gray-200"
              >
                Dashboard
              </Link>

              {/* Sign Up Button */}
              <Link
                href="/signup"
                className="px-3 py-1.5 text-xs font-medium text-gray-900 bg-beige-primary hover:bg-beige-secondary rounded-lg transition-colors whitespace-nowrap shadow-sm border border-gray-200"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
    </>
  );
}
