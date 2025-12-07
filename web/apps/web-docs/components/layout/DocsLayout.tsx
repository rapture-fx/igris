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
    <div className="min-h-screen bg-beige-primary m-0 p-0 overflow-x-hidden">
      <div className="flex m-0 p-0">
        <DocsSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main content area with better centering */}
        <main className="flex-1 md:ml-72 overflow-x-hidden flex flex-col h-screen">
          {/* Fixed Navbar with breadcrumbs */}
          <div className="flex-shrink-0">
            <DocsNavbar />
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[90rem] mx-auto px-8 sm:px-12 lg:px-16 py-6 pb-16">
              <div className="flex gap-12">
                {/* Content */}
                <div className="flex-1 min-w-0 relative">
                  {children}
                </div>

                {/* Right sidebar for TOC */}
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
