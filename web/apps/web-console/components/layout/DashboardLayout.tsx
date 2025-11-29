'use client';

import { useState } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-beige-primary m-0 p-0 overflow-x-hidden">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />

      <div className="flex m-0 p-0 pt-16">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main className="flex-1 md:ml-64 px-4 sm:px-6 lg:px-8 py-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
