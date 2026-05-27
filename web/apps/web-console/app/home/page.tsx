'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTasks, type Task } from '@/hooks/useTasks';
import { useGovernanceRuntimes } from '@/hooks/useGovernance';
import { getRelativeTime } from '@/utils/helpers';

const CHECKLIST = [
  'Create an action',
  'Add a target and secret',
  'Choose the policy',
  'Copy the endpoint',
  'Run a test',
  'Inspect proof',
];

function proofStatus(task?: Task): string {
  if (!task?.proof) return 'Proof unavailable';
  if (task.proof.verified || task.proof.status === 'verified') return 'Proof verified';
  if (task.proof.verified === false || task.proof.status === 'mismatch') return 'Proof failed';
  if (task.proof.status === 'present') return 'Receipt present';
  return 'Proof unavailable';
}

function actionName(task: Task): string {
  return task.policy?.action_name || task.task_type || task.task_id;
}

function StatusRow({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'ok' | 'warn' | 'bad' | 'neutral' }) {
  const dot =
    tone === 'ok' ? 'bg-emerald-400' :
    tone === 'warn' ? 'bg-amber-400' :
    tone === 'bad' ? 'bg-rose-500' :
    'bg-[#3a3a32]';
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-white/[0.06] bg-white/[0.018] px-3 py-2">
      <span className="flex items-center gap-2 text-[12px] text-[#c8c7be]">
        <span className={'h-1.5 w-1.5 rounded-full ' + dot} />
        {label}
      </span>
      <span className="text-[11.5px] text-[#8a8a82] text-right">{value}</span>
    </div>
  );
}

function HomeInner() {
  const { data: taskData, isLoading: tasksLoading } = useTasks({ limit: 60 });
  const { data: runtimeData, isLoading: runtimesLoading } = useGovernanceRuntimes({ limit: 50 });
  const tasks = useMemo(() => taskData?.tasks ?? [], [taskData?.tasks]);
  const runtimes = runtimeData?.items ?? [];
  const lastRun = tasks[0];
  const firstActionCreated = tasks.some((t) => Boolean(t.policy?.action_name || t.task_type));
  const runtimeConnected = runtimes.some((r) => Boolean(r.last_seen));
  const loading = tasksLoading || runtimesLoading;
  const proof = proofStatus(lastRun);
  const proofTone = proof === 'Proof verified' ? 'ok' : proof === 'Proof failed' ? 'bad' : 'warn';

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1040px] px-8 py-10">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <h1 className="text-[18px] text-[#f0efe8]" style={{ letterSpacing: '-0.01em' }}>
                Set up Igris for agent actions
              </h1>
              <p className="mt-2 text-[13px] leading-relaxed text-[#8a8a82]">
                Igris sits between your agent and the side effects it can perform. Create an action, get an endpoint, then route agent actions through Igris so runs can be inspected, recovered, and proven.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/actions/new" className="inline-flex h-8 items-center rounded-md border border-emerald-500/20 bg-emerald-500/[0.12] px-3 text-[11.5px] text-emerald-300 hover:bg-emerald-500/[0.16]">
                Create your first action
              </Link>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <section className="rounded-lg border-[0.5px] border-white/[0.06] bg-white/[0.015] p-4">
              <h2 className="mb-3 text-[13px] text-[#d3d2c8]">Setup checklist</h2>
              <div className="space-y-2">
                {CHECKLIST.map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-md px-2 py-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/[0.08] text-[10.5px] text-[#8a8a82]">{index + 1}</span>
                    <span className="text-[12.5px] text-[#c8c7be]">{item}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border-[0.5px] border-white/[0.06] bg-white/[0.015] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] text-[#d3d2c8]">Actionable status</h2>
              </div>
              {loading ? (
                <div className="text-[11.5px] text-[#6a6a62]">Loading status...</div>
              ) : (
                <div className="space-y-2">
                  <StatusRow label="Runtime connected" value={runtimeConnected ? 'Connected' : 'Disconnected'} tone={runtimeConnected ? 'ok' : 'warn'} />
                  <StatusRow label="First action created" value={firstActionCreated ? 'Created' : 'Not created'} tone={firstActionCreated ? 'ok' : 'warn'} />
                  <StatusRow label="Last run status" value={lastRun ? `${actionName(lastRun)}: ${lastRun.status.replace(/_/g, ' ')}` : 'No runs yet'} tone={lastRun?.status === 'failed' ? 'bad' : lastRun ? 'ok' : 'neutral'} />
                  <StatusRow label="Proof" value={lastRun ? proof : 'No run to inspect'} tone={lastRun ? proofTone : 'neutral'} />
                </div>
              )}
            </section>
          </div>

          {lastRun && (
            <div className="mt-5">
              <Link href={`/runs/${encodeURIComponent(lastRun.task_id)}`} className="text-[11.5px] text-[#c8c7be] hover:text-[#f0efe8]">
                Inspect latest run →
              </Link>
            </div>
          )}
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
