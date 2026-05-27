'use client';

/**
 * Runs workspace — execution inspection / flight recorder.
 *
 * The lens sidebar (ExecutionTaskSidebar) renders the hero-style task list and
 * handles selection. This page is the empty state shown until the user picks
 * a run; selecting a row navigates to /runs/[id], which
 * renders the full Run / Recover / Prove story.
 */

import { Suspense } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <div className="text-center max-w-sm">
        <div className="text-[13px] text-[#c8c7be] mb-1.5" style={{ letterSpacing: '-0.005em' }}>
          {message}
        </div>
        <div className="text-[11.5px] text-[#7a7a72] leading-relaxed">
          Select a run from the list to inspect what ran, what recovered,
          and what proof exists.
        </div>
      </div>
    </div>
  );
}

function RunsPageInner() {
  return (
    <DashboardLayout>
      <EmptyState message="No run selected" />
    </DashboardLayout>
  );
}

export default function RunsPage() {
  return (
    <Suspense fallback={<DashboardLayout><EmptyState message="Loading…" /></DashboardLayout>}>
      <RunsPageInner />
    </Suspense>
  );
}
