'use client';

/**
 * DashboardLayout — the unified console shell.
 *
 * Replaces the previous light multi-group sidebar with the canonical
 * product design: a 48px icon rail on the left (lens switcher), a 236px
 * lens-content sidebar, and the main pane on the right. Dark throughout.
 *
 * Pages no longer need to render their own sidebar — the shell provides
 * one based on the active route's lens.
 */

import { ConsoleStyles, tokens } from '@/components/console/primitives';
import { IconRail } from '@/components/console/IconRail';
import { LensSidebar } from '@/components/console/LensSidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { HealthCheckGate } from '@/components/HealthCheckGate';

interface DashboardLayoutProps {
  children: React.ReactNode;
  /** Deprecated: layout is full-width by default now. Kept for prop compatibility. */
  fullWidth?: boolean;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <HealthCheckGate skipHealthCheck={true}>
      <ErrorBoundary>
        <div
          className="igris-pane flex h-screen overflow-hidden"
          style={{ background: tokens.bg, color: tokens.text }}
        >
          <ConsoleStyles />
          <IconRail />
          <LensSidebar />
          <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
            {children}
          </main>
        </div>
      </ErrorBoundary>
    </HealthCheckGate>
  );
}
