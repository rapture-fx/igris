'use client';

import { useState } from 'react';
import { DocsSidebar } from './DocsSidebar';
import { DocsNavbar } from './DocsNavbar';
import { TableOfContents } from './TableOfContents';

interface DocsLayoutProps {
  children: React.ReactNode;
}

export function DocsLayout({ children }: DocsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-screen m-0 p-0 overflow-x-hidden bg-[#f7f7f3] dark:bg-[#1b1912]">
      <div className="relative z-10 flex h-screen">
        <DocsSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 md:ml-64 overflow-x-hidden flex flex-col h-screen">
          <div className="flex-shrink-0">
            <DocsNavbar />
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[90rem] mx-auto px-8 sm:px-12 lg:px-16 py-6 pb-16">
              <div className="flex gap-12">
                <div className="flex-1 min-w-0 relative">
                  {children}
                </div>
                <aside className="hidden xl:block w-64 flex-shrink-0">
                  <TableOfContents />
                </aside>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
