'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTasks } from '@/hooks/useTasks';
import { useActionDrafts } from '@/hooks/useActionDrafts';
import { buildActions, buildDraftActions } from '@/lib/actions';
import { getRelativeTime, truncateText } from '@/utils/helpers';

function proofTone(status: string): string {
  if (status === 'Proof verified') return 'text-emerald-300';
  if (status === 'Proof failed') return 'text-rose-400';
  if (status === 'Proof unavailable') return 'text-amber-300';
  return 'text-[#c8c7be]';
}

function ActionsInner() {
  const { data, isLoading } = useTasks({ limit: 100 });
  const { drafts } = useActionDrafts();
  const tasks = useMemo(() => data?.tasks ?? [], [data?.tasks]);
  const runActions = useMemo(() => buildActions(tasks), [tasks]);
  const actions = useMemo(() => {
    const names = new Set(runActions.map((action) => action.name));
    return [...buildDraftActions(drafts, names), ...runActions];
  }, [drafts, runActions]);

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1180px] px-8 py-10">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-[15px] text-[#f0efe8]" style={{ letterSpacing: '-0.01em' }}>Actions</h1>
              <p className="mt-0.5 text-[12px] text-[#7a7a72]">Actions are safe endpoints for your agent. Instead of calling a tool directly, your agent calls Igris.</p>
            </div>
            <Link href="/actions/new" className="inline-flex h-7 items-center rounded-md border border-emerald-500/20 bg-emerald-500/[0.12] px-3 text-[11.5px] text-emerald-300 hover:bg-emerald-500/[0.16]">
              Create action
            </Link>
          </div>

          <div className="overflow-hidden rounded-lg border-[0.5px] border-white/[0.06] bg-white/[0.015]">
            <div className="grid gap-3 border-b border-white/[0.05] px-4 py-2 text-[10.5px] text-[#7a7a72]" style={{ gridTemplateColumns: '1.1fr 1fr 130px 120px 105px 120px 110px' }}>
              <span>Action name</span>
              <span>Target</span>
              <span>Policy</span>
              <span>Replay behavior</span>
              <span>Last run</span>
              <span>Proof</span>
              <span>Endpoint</span>
            </div>
            {isLoading ? (
              <div className="px-4 py-8 text-[11.5px] text-[#6a6a62]">Loading actions...</div>
            ) : actions.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-[14px] text-[#e8e7df]">Create your first action</p>
                <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-[#7a7a72]">
                  Actions are safe endpoints for your agent. Instead of calling a tool directly, your agent calls Igris.
                </p>
                <Link href="/actions/new" className="mt-4 inline-flex h-8 items-center rounded-md border border-emerald-500/20 bg-emerald-500/[0.12] px-3 text-[11.5px] text-emerald-300 hover:bg-emerald-500/[0.16]">
                  Create action
                </Link>
              </div>
            ) : (
              actions.map((action) => (
                <Link
                  key={`${action.source}-${action.id}`}
                  href={`/actions/${action.id}`}
                  className="grid items-center gap-3 border-b border-white/[0.04] px-4 py-2.5 last:border-b-0 hover:bg-white/[0.025]"
                  style={{ gridTemplateColumns: '1.1fr 1fr 130px 120px 105px 120px 110px' }}
                >
                  <span className="truncate text-[12.5px] text-[#e8e7df]">
                    {action.name}
                    {action.source === 'draft' && <span className="ml-2 rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[#7a7a72]">draft</span>}
                  </span>
                  <span className="truncate text-[11px] text-[#8a8a82]">{truncateText(action.target, 42)}</span>
                  <span className="truncate text-[11px] text-[#c8c7be]">{action.policy}</span>
                  <span className="truncate text-[11px] text-[#8a8a82]">{action.replayBehavior}</span>
                  <span className="text-[10.5px] text-[#7a7a72]">{action.lastRun ? getRelativeTime(action.lastRun.created_at) : 'No run yet'}</span>
                  <span className={'text-[11px] ' + proofTone(action.proofStatus)}>{action.proofStatus}</span>
                  <span className="truncate text-[11px] text-[#c8c7be]">Copyable</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function ActionsPage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="flex-1" /></DashboardLayout>}>
      <ActionsInner />
    </Suspense>
  );
}
