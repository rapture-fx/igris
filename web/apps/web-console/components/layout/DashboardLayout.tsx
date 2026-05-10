'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sidebar } from './Sidebar';
import { Breadcrumbs } from './Breadcrumbs';
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

          <div className="flex-1 flex flex-col md:ml-72 min-w-0 overflow-hidden">
            {/* Header navbar */}
            <header className="h-12 px-4 sm:px-6 flex items-center border-b-[0.5px] border-black/[0.08] dark:border-white/[0.08] bg-background flex-shrink-0 sticky top-0 z-50">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8 mr-2 -ml-1"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
              <Breadcrumbs />
            </header>

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

            <main className={`flex-1 overflow-y-auto ${fullWidth ? 'flex flex-col' : ''}`}>
              <div className={`console-cardscope ${fullWidth ? 'w-full px-4 sm:px-5 pt-5 flex-1 flex flex-col min-h-0' : 'max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6'}`}>
                {children}
              </div>
            </main>
          </div>
        </div>
      </ErrorBoundary>
    </HealthCheckGate>
  );
}
