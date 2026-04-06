'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarContentMobile,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSeparator,
  SidebarTrigger,
  SidebarViewport,
} from 'fumadocs-ui/components/layout/sidebar';
import { LargeSearchToggle, SearchToggle } from 'fumadocs-ui/components/layout/search-toggle';
import { getApiNavigationSections } from '@/lib/api-reference';

const methodColors: Record<string, string> = {
  GET: 'bg-emerald-50 text-emerald-700',
  POST: 'bg-blue-50 text-blue-700',
  PUT: 'bg-amber-50 text-amber-700',
  PATCH: 'bg-orange-50 text-orange-700',
  DELETE: 'bg-red-50 text-red-700',
};

function ApiSidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <SidebarSeparator className="px-3 pt-4 text-[0.78rem] font-medium normal-case tracking-normal text-fd-muted-foreground">
      {children}
    </SidebarSeparator>
  );
}

function ApiSidebarContent() {
  const pathname = usePathname();
  const sections = getApiNavigationSections();

  return (
    <SidebarViewport>
      {sections.map((section) => (
        <div key={section.section} className="pb-3">
          <ApiSidebarSectionLabel>{section.section}</ApiSidebarSectionLabel>
          <div className="mt-2 space-y-1 px-2">
            {section.items.map((item) => {
              const isActive =
                pathname === item.href ||
                pathname === `${item.href}/`;

              return (
                <SidebarItem
                  key={item.href}
                  href={item.href}
                  className={isActive ? 'bg-fd-accent text-fd-accent-foreground' : undefined}
                >
                  {item.badge ? (
                    <span
                      className={`inline-flex min-w-[3rem] justify-center rounded-md px-2 py-0.5 text-[0.65rem] font-semibold ${methodColors[item.badge] ?? 'bg-fd-muted text-fd-muted-foreground'}`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                  <span className="truncate">{item.name}</span>
                </SidebarItem>
              );
            })}
          </div>
        </div>
      ))}
    </SidebarViewport>
  );
}

function ApiSidebarDesktop() {
  return (
    <SidebarContent>
      <SidebarHeader>
        <div className="flex items-center justify-between gap-3">
          <Link href="/docs" className="text-[15px] font-medium text-fd-foreground no-underline">
            Igris Docs
          </Link>
        </div>
        <LargeSearchToggle hideIfDisabled />
      </SidebarHeader>
      <ApiSidebarContent />
      <SidebarFooter>
        <SidebarItem href="/docs/api-reference">
          <span className="truncate">API Reference Home</span>
        </SidebarItem>
      </SidebarFooter>
    </SidebarContent>
  );
}

function ApiSidebarMobile() {
  return (
    <SidebarContentMobile>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <Link href="/docs" className="me-auto text-[15px] font-medium text-fd-foreground no-underline">
            Igris Docs
          </Link>
          <SearchToggle hideIfDisabled className="p-2" />
          <SidebarTrigger className="rounded-md p-2" />
        </div>
      </SidebarHeader>
      <ApiSidebarContent />
      <SidebarFooter>
        <SidebarItem href="/docs/api-reference">
          <span className="truncate">API Reference Home</span>
        </SidebarItem>
      </SidebarFooter>
    </SidebarContentMobile>
  );
}

export function ApiDocsSidebar() {
  return <Sidebar Content={<ApiSidebarDesktop />} Mobile={<ApiSidebarMobile />} defaultOpenLevel={1} />;
}
