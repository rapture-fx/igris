'use client';

import { useState } from 'react';
import { DocsSidebar } from './DocsSidebar';
import { DocsNavbar } from './DocsNavbar';
import { TableOfContents } from './TableOfContents';

interface DocsLayoutProps {
  children: React.ReactNode;
  hideTableOfContents?: boolean;
  rightRail?: React.ReactNode;
  maxWidthClass?: string;
  rightRailWidthClass?: string;
}

export function DocsLayout({
  children,
  hideTableOfContents = false,
  rightRail,
  maxWidthClass = 'max-w-[90rem]',
  rightRailWidthClass = 'w-[24rem]',
}: DocsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const railWidthClass = rightRail ? rightRailWidthClass : 'w-64';

  return (
    <div className="relative min-h-screen m-0 p-0 overflow-x-hidden bg-white dark:bg-[#25231e]">
      <div className="relative z-10 flex h-screen">
        <DocsSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 md:ml-64 overflow-x-hidden flex flex-col h-screen">
          <div className="flex-shrink-0">
            <DocsNavbar
              maxWidthClass={maxWidthClass}
              rightColumnWidthClass={railWidthClass}
            />
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className={`${maxWidthClass} mx-auto px-8 sm:px-12 lg:px-16 pt-4 pb-16`}>
              <div className="flex gap-12">
                <div className="flex-1 min-w-0 relative">
                  {children}
                </div>
                {rightRail ? (
                  <aside className={`hidden xl:block ${rightRailWidthClass} flex-shrink-0`}>
                    {rightRail}
                  </aside>
                ) : !hideTableOfContents ? (
                  <aside className="hidden xl:block w-64 flex-shrink-0">
                    <TableOfContents />
                  </aside>
                ) : null}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
