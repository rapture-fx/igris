'use client';

/**
 * Executions workspace — the primary product surface.
 *
 * The lens sidebar (ExecutionTaskSidebar) renders the hero-style task list and
 * handles selection. This page is the empty state shown until the user picks
 * an execution; selecting a row navigates to /execution/tasks/[id], which
 * renders the full Run / Recover / Prove story.
 */

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTasks } from '@/hooks/useTasks';

function EmptyState({ message, showDemo }: { message: string; showDemo?: boolean }) {
  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <div className="text-center max-w-sm">
        <div className="text-[13px] text-[#c8c7be] mb-1.5" style={{ letterSpacing: '-0.005em' }}>
          {message}
        </div>
        <div className="text-[11.5px] text-[#7a7a72] leading-relaxed">
          Select an execution from the list to inspect what ran, what recovered,
          and what proof exists.
        </div>
        {showDemo && (
          <Link
            href="/execution/tasks?mock=1"
            className="mt-4 inline-flex items-center gap-1.5 px-3 h-7 rounded-md bg-emerald-500/[0.12] text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/[0.16] text-[11.5px]"
          >
            View demo with sample data
          </Link>
        )}
      </div>
    </div>
  );
}

function ExecutionsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMock = searchParams?.get('mock') === '1';
  const { data, isLoading } = useTasks({ limit: 1 });

  // When the user lands on /execution/tasks with no selection, jump to the
  // most recent task so the workspace is never blank for users with data.
  useEffect(() => {
    if (isMock) {
      router.replace('/execution/tasks/mock?mock=1');
      return;
    }
    const first = data?.tasks?.[0]?.task_id;
    if (first) {
      router.replace(`/execution/tasks/${encodeURIComponent(first)}`);
    }
  }, [data?.tasks, isMock, router]);

  return (
    <DashboardLayout>
      {isLoading
        ? <EmptyState message="Loading executions…" />
        : <EmptyState message="No execution selected" showDemo />}
    </DashboardLayout>
  );
}

export default function ExecutionsPage() {
  return (
    <Suspense fallback={<DashboardLayout><EmptyState message="Loading…" /></DashboardLayout>}>
      <ExecutionsPageInner />
    </Suspense>
  );
}
