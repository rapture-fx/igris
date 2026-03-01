'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

const labelMap: Record<string, string> = {
  docs: 'Docs',
  overview: 'Overview',
  architecture: 'Architecture',
  governance: 'Governance',
  sdk: 'SDKs',
  deployment: 'Deployment',
  quickstart: 'Quick Start',
  'execution-model': 'Execution Model',
  safety: 'Safety & Containment',
  agents: 'Agents',
  tools: 'Tools',
  memory: 'Memory',
  robotics: 'Robotics',
  'cloud-coordination': 'Cloud Coordination',
  audit: 'Audit',
};

export function DocsNavbar() {
  const pathname = usePathname();

  const generateBreadcrumbs = () => {
    if (!pathname) return [];

    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Docs', href: '/docs' }];

    let currentPath = '';
    segments.slice(1).forEach((segment) => {
      currentPath += `/${segment}`;
      const label = labelMap[segment] || segment
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      breadcrumbs.push({ label, href: `/docs${currentPath}` });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <nav className="bg-transparent h-12">
      <div className="h-full max-w-[90rem] mx-auto px-8 sm:px-12 lg:px-16">
        <div className="h-full flex gap-12">
          <div className="flex-1 min-w-0 flex items-center">
            <div className="flex items-center space-x-2 text-sm">
              {breadcrumbs.map((breadcrumb, index) => (
                <div key={breadcrumb.href} className="flex items-center">
                  {index > 0 && (
                    <ChevronRight className="h-4 w-4 text-gray-400 mx-2" />
                  )}
                  {index === breadcrumbs.length - 1 ? (
                    <span className="text-gray-900 dark:text-[#f6f6f4] font-medium">
                      {breadcrumb.label}
                    </span>
                  ) : (
                    <Link
                      href={breadcrumb.href}
                      className="text-gray-600 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors"
                    >
                      {breadcrumb.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="hidden xl:flex items-center gap-3 w-64">
            <a
              href="https://app.igrisinertial.com"
              className="px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-[#f6f6f4] bg-[#f6f6f4] dark:bg-[#25231e] hover:bg-beige-secondary dark:hover:bg-[#2a2820] rounded-lg transition-colors whitespace-nowrap shadow-sm border border-gray-200 dark:border-[#f6f6f4]/10"
            >
              Dashboard
            </a>
            <a
              href="https://app.igrisinertial.com/signup"
              className="px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-[#f6f6f4] bg-[#f6f6f4] dark:bg-[#25231e] hover:bg-beige-secondary dark:hover:bg-[#2a2820] rounded-lg transition-colors whitespace-nowrap shadow-sm border border-gray-200 dark:border-[#f6f6f4]/10"
            >
              Sign Up
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
