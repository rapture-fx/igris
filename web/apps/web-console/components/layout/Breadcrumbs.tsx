'use client';

import { usePathname } from 'next/navigation';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

const routeNames: Record<string, string> = {
  dashboard: 'Dashboard',
  execution: 'Execution',
  runs: 'Runs',
  tasks: 'Tasks',
  approvals: 'Approvals',
  proof: 'Proof',
  receipts: 'Receipts',
  violations: 'Violations',
  policy: 'Policy',
  bounds: 'Bounds',
  capabilities: 'Capabilities',
  fleet: 'Infrastructure',
  devices: 'Devices',
  models: 'Infrastructure',
  providers: 'Providers',
  history: 'History',
  logs: 'Logs',
  metrics: 'Metrics',
  settings: 'Settings',
  license: 'License',
  keys: 'API Keys',
  general: 'General',
};

export function Breadcrumbs() {
  const pathname = usePathname();

  // Split pathname into segments and filter out empty strings
  const segments = pathname.split('/').filter(Boolean);

  // Don't show breadcrumbs on the main dashboard page
  if (segments.length <= 1) {
    return null;
  }

  // Generate breadcrumb items
  const breadcrumbItems = segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/');
    const isLast = index === segments.length - 1;
    const label = routeNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

    return {
      label,
      path,
      isLast,
    };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-[0.75rem]">
        {breadcrumbItems.map((item, index) => (
          <div key={item.path} className="flex items-center gap-1.5">
            <BreadcrumbItem>
              {item.isLast ? (
                <BreadcrumbPage className="text-[0.75rem]">{item.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink href={item.path} className="text-[0.75rem]">{item.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {!item.isLast && <BreadcrumbSeparator className="text-[0.75rem]" />}
          </div>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
