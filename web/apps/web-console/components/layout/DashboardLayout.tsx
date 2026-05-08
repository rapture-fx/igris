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
        <div className="flex min-h-screen bg-background">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <div className="flex-1 flex flex-col md:ml-64 min-w-0">
            {/* Mobile top bar */}
            <nav className="md:hidden h-12 px-4 flex items-center border-b border-border bg-background flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            </nav>

            {/* Trial Banner */}
            {showTrialBanner && (
              <div className="bg-blue-600 dark:bg-blue-700 text-white px-4 sm:px-6 lg:px-8 py-3 border-b border-border flex-shrink-0">
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
                      onClick={() => window.location.href = '/settings/license'}
                    >
                      View License
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

            <main className="flex-1 overflow-x-hidden">
              <div className={`console-cardscope px-4 sm:px-6 lg:px-8 py-6 ${fullWidth ? 'w-full' : 'max-w-[1200px] mx-auto'}`}>
                {children}
              </div>
            </main>
          </div>
        </div>
      </ErrorBoundary>
    </HealthCheckGate>
  );
}
