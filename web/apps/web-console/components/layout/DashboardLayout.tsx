'use client';

import { useState } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import { useTenant } from '@/hooks/useTenant';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HealthCheckGate } from '@/components/HealthCheckGate';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const { data: tenant } = useTenant();

  const isTrialActive = tenant?.metadata?.trial_active;
  const trialDaysLeft = tenant?.metadata?.trial_days_left;
  const trialTier = tenant?.plan || 'Develop';

  const showTrialBanner = isTrialActive && !bannerDismissed;

  return (
    <HealthCheckGate>
      <ErrorBoundary>
        <div className="min-h-screen bg-beige-primary m-0 p-0 overflow-x-hidden">
          <Navbar onMenuClick={() => setSidebarOpen(true)} />

          <div className="flex m-0 p-0 pt-12">
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <main className="flex-1 md:ml-64 md:pl-12 md:pr-2 overflow-x-hidden">
              {/* Trial Banner */}
              {showTrialBanner && (
                <div className="bg-blue-600 text-white px-4 sm:px-6 lg:px-8 py-3 border-b border-border-light">
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

              <div className="px-4 sm:px-6 lg:px-8 py-6 pb-16">
                {children}
              </div>
            </main>
          </div>
          <Footer />
        </div>
      </ErrorBoundary>
    </HealthCheckGate>
  );
}
