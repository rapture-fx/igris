'use client';

/**
 * LensSidebar — the 236px content sidebar for the currently active lens.
 * For the Tasks lens it delegates to ExecutionTaskSidebar. For other
 * lenses (not yet ported) it shows a minimal placeholder header.
 */

import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ExecutionTaskSidebar } from '@/components/execution/ExecutionTaskSidebar';
import { activeLensId } from './IconRail';
import { tokens } from './primitives';

function PlaceholderSidebar({ title, body }: { title: string; body?: React.ReactNode }) {
  return (
    <aside
      className="flex flex-col border-r flex-shrink-0"
      style={{ width: 236, background: tokens.bgRail, borderColor: tokens.borderSoft }}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <span className="text-[11px]" style={{ color: tokens.textDim }}>{title}</span>
      </div>
      {body !== undefined && (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-[11.5px] text-center" style={{ color: tokens.textDim }}>
            {body}
          </div>
        </div>
      )}
    </aside>
  );
}

function LensSidebarContent() {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const lens = activeLensId(pathname);

  // Home renders without a sidebar — page body uses its own layout.
  if (lens === 'home') return null;

  if (lens === 'executions') {
    const taskId = params?.id ? decodeURIComponent(params.id) : '';
    const isMock = searchParams?.get('mock') === '1' || taskId === 'mock';
    return <ExecutionTaskSidebar selectedTaskId={isMock ? 'tsk_01HZX7E4MQGYK9QH4F3JC2NMD8' : taskId} />;
  }

  if (lens === 'runtimes') {
    return <PlaceholderSidebar title="Runtimes" />;
  }

  // No lens (auth pages, onboarding, etc.) — render no sidebar.
  return null;
}

export function LensSidebar() {
  return (
    <Suspense fallback={null}>
      <LensSidebarContent />
    </Suspense>
  );
}
