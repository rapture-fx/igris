'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sidebar } from './Sidebar';
import { useTenant } from '@/hooks/useTenant';
import { AlertCircle, X } from 'lucide-react';
import { HealthCheckGate } from '@/components/HealthCheckGate';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface DashboardLayoutProps {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export function DashboardLayout({ children, fullWidth = false }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const { data: tenant } = useTenant();

  const isTrialActive = tenant?.trial_active;
  const trialDaysLeft = tenant?.trial_days_left;
  const trialTier = tenant?.plan || 'Seed';

  const showTrialBanner = isTrialActive && !bannerDismissed;

  return (
    <HealthCheckGate skipHealthCheck={true}>
      <ErrorBoundary>
        <div className="min-h-screen bg-[#f3f3f6] dark:bg-[#25231e] m-0 p-0">
          {/* Mobile top bar */}
          <nav className="fixed top-0 left-0 md:left-64 right-0 z-40 h-2 bg-[#f3f3f6] dark:bg-[#25231e] md:pl-12 md:pr-2">
            <div className="h-full px-4 flex items-center">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          </nav>

          <div className="flex m-0 p-0 pt-2 pb-2">
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="flex-1 md:ml-64 md:pl-12 md:pr-2 px-4 sm:px-6 lg:px-8 overflow-x-hidden rounded-2xl bg-background h-[calc(100vh-16px)] border border-gray-200 dark:border-[#f6f6f4]/10">
              {/* Trial Banner */}
              {showTrialBanner && (
                <div className="bg-blue-600 dark:bg-blue-700 text-white px-4 sm:px-6 lg:px-8 py-3 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      <p className="text-sm font-medium">
                        {trialDaysLeft} days left in your {trialTier} trial · Upgrade now to keep full access
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white text-blue-600 hover:bg-blue-50 border-0 text-xs font-medium"
                        onClick={() => window.location.href = '/settings/billing'}
                      >
                        Upgrade Now
                      </Button>
                      <button
                        onClick={() => setBannerDismissed(true)}
                        className="text-white hover:text-blue-100 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className={`px-4 sm:px-6 lg:px-8 py-6 rounded-2xl ${fullWidth ? 'w-full' : 'max-w-[1200px] mx-auto'}`}>
                {children}
              </div>
            </main>

            <div className="w-2 bg-[#f3f3f6] dark:bg-[#25231e] hidden md:block" />
          </div>

          {/* Bottom spacer */}
          <footer className="fixed bottom-0 left-0 md:left-64 right-0 z-40 h-2 bg-[#f3f3f6] dark:bg-[#25231e]" />
        </div>
      </ErrorBoundary>
    </HealthCheckGate>
  );
}
