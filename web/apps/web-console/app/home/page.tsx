'use client';

/**
 * Home — attention summary only.
 *
 * Surfaces executions that need an operator's attention: failed, blocked
 * (approval required), proof failures, and recovered runs. Each row links
 * straight into the Executions workspace. Uses real data from `useTasks()`;
 * missing data renders as an empty section, never as fabricated values.
 */

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTasks, type Task } from '@/hooks/useTasks';
import { mockTaskListForSidebar } from '@/lib/mockExecution';
import { getRelativeTime } from '@/utils/helpers';

type Bucket = {
  id: string;
  title: string;
  empty: string;
  match: (t: Task) => boolean;
};

const BUCKETS: Bucket[] = [
  {
    id: 'failed',
    title: 'Failed',
    empty: 'No failed executions',
    match: (t) => t.status === 'failed',
  },
  {
    id: 'blocked',
    title: 'Approval required',
    empty: 'Nothing waiting on approval',
    match: (t) => t.status === 'approval_required' || t.policy?.decision === 'approval_required' || t.policy?.decision === 'denied',
  },
  {
    id: 'recovered',
    title: 'Recovered',
    empty: 'No recent recoveries',
    match: (t) => (t.recovery?.events?.length ?? 0) > 0,
  },
  {
    id: 'proof_failed',
    title: 'Proof failures',
    empty: 'No proof failures',
    match: (t) => t.proof?.verified === false || t.proof?.status === 'mismatch',
  },
];

function StatusDot({ task }: { task: Task }) {
  const color =
    task.status === 'failed' ? 'bg-rose-500' :
    task.status === 'approval_required' ? 'bg-amber-400' :
    task.status === 'completed' ? 'bg-[#3a3a32]' :
    'bg-emerald-400';
  return <span className={'block w-1.5 h-1.5 rounded-full ' + color} />;
}

function Row({ task, mock }: { task: Task; mock: boolean }) {
  const title = task.policy?.action_name || task.task_type || task.task_id;
  return (
    <Link
      href={`/execution/tasks/${encodeURIComponent(task.task_id)}${mock ? '?mock=1' : ''}`}
      className="group flex items-center gap-3 px-3 py-2 rounded hover:bg-white/[0.025] transition-colors"
    >
      <StatusDot task={task} />
      <span className="text-[12.5px] text-[#e8e7df] truncate flex-1" style={{ letterSpacing: '-0.005em' }}>
        {title}
      </span>
      {task.runtime_id && (
        <span className="text-[10.5px] text-[#7a7a72] truncate hidden md:inline" style={{ maxWidth: 160 }}>
          {task.runtime_id}
        </span>
      )}
      <span className="text-[10.5px] text-[#5a5a52] tabular-nums">
        {getRelativeTime(task.created_at)}
      </span>
    </Link>
  );
}

function Section({ bucket, tasks, mock }: { bucket: Bucket; tasks: Task[]; mock: boolean }) {
  const rows = tasks.filter(bucket.match).slice(0, 6);
  return (
    <div
      className="rounded-lg border-[0.5px] border-white/[0.06]"
      style={{ background: 'rgba(255,255,255,0.015)', boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.03)' }}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
        <span className="text-[12px] text-[#c8c7be]" style={{ letterSpacing: '-0.005em' }}>
          {bucket.title}
        </span>
        <span className="text-[10.5px] text-[#5a5a52] tabular-nums">{rows.length}</span>
      </div>
      <div className="px-2 py-2">
        {rows.length === 0 ? (
          <div className="px-3 py-2 text-[11.5px] text-[#6a6a62]">{bucket.empty}</div>
        ) : (
          rows.map((t) => <Row key={t.task_id} task={t} mock={mock} />)
        )}
      </div>
    </div>
  );
}

function HomeInner() {
  const searchParams = useSearchParams();
  const isMock = searchParams?.get('mock') === '1';
  const { data, isLoading: realLoading } = useTasks({ limit: 60 });
  const tasks = useMemo(() => (isMock ? mockTaskListForSidebar() : (data?.tasks ?? [])), [isMock, data?.tasks]);
  const isLoading = isMock ? false : realLoading;
  const hasAny = tasks.length > 0;

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[960px] px-8 py-10">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <h1 className="text-[15px] text-[#f0efe8] mb-1" style={{ letterSpacing: '-0.01em' }}>
                Attention
              </h1>
              <p className="text-[12px] text-[#7a7a72]">
                Executions that need a look. Open any row to inspect the Run / Recover / Prove story.
              </p>
            </div>
            {!isMock && !hasAny && !isLoading && (
              <Link
                href="/home?mock=1"
                className="inline-flex items-center gap-1.5 px-3 h-7 rounded-md bg-emerald-500/[0.12] text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/[0.16] text-[11.5px] flex-shrink-0"
              >
                View demo
              </Link>
            )}
            {isMock && (
              <span className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-md bg-amber-400/[0.08] text-amber-300 border border-amber-400/25 text-[10.5px] flex-shrink-0">
                Demo data
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="text-[11.5px] text-[#6a6a62]">Loading…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {BUCKETS.map((b) => <Section key={b.id} bucket={b} tasks={tasks} mock={isMock} />)}
            </div>
          )}

          <div className="mt-6">
            <Link
              href={isMock ? '/execution/tasks?mock=1' : '/execution/tasks'}
              className="inline-flex items-center gap-1.5 text-[11.5px] text-[#c8c7be] hover:text-[#f0efe8]"
            >
              Open Executions →
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="flex-1" /></DashboardLayout>}>
      <HomeInner />
    </Suspense>
  );
}
