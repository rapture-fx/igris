'use client';

/**
 * Actions lens — the catalogue of named endpoints the agent calls through Igris.
 * Layout ports the canonical execution-detail design: 44px top bar, status strip,
 * body with surface-style table. No fabricated metrics.
 */

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useTasks } from '@/hooks/useTasks';
import { useActions } from '@/hooks/useActions';
import { buildRegisteredActions, type ConsoleAction } from '@/lib/actions';
import { getRelativeTime, truncateText } from '@/utils/helpers';

type Tone = 'ok' | 'warn' | 'bad' | 'muted';

function toneClasses(tone: Tone): string {
  switch (tone) {
    case 'ok':    return 'text-emerald-300';
    case 'warn':  return 'text-amber-300';
    case 'bad':   return 'text-rose-400';
    case 'muted':
    default:      return 'text-[#a8a89e]';
  }
}

function proofTone(status: string): Tone {
  if (status === 'Proof verified') return 'ok';
  if (status === 'Proof failed' || status === 'Failed verification') return 'bad';
  if (status === 'Proof unavailable' || status === 'No run yet') return 'muted';
  return 'warn';
}

function setupStatus(action: ConsoleAction): { label: string; tone: Tone } {
  const def = action.definition;
  if (def.target_type === 'mock_demo') return { label: 'Ready', tone: 'ok' };
  if (def.target_type === 'webhook' || def.target_type === 'api') {
    if (!def.target_url) return { label: 'Needs target', tone: 'warn' };
    return { label: 'Ready', tone: 'ok' };
  }
  if (def.target_type === 'local_runtime') return { label: 'Needs runtime', tone: 'warn' };
  return { label: 'Ready', tone: 'ok' };
}

function ActionsInner() {
  const { data: actionData, isLoading: actionsLoading } = useActions();
  const { data: taskData, isLoading: tasksLoading } = useTasks({ limit: 100 });
  const tasks = useMemo(() => taskData?.tasks ?? [], [taskData?.tasks]);
  const actions = useMemo(() => buildRegisteredActions(actionData?.actions ?? [], tasks), [actionData?.actions, tasks]);
  const isLoading = actionsLoading || tasksLoading;

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-0 h-full">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 h-11 px-5 border-b border-[var(--ig-border)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="text-[13px] font-medium text-[#f0efe8]"
              style={{ letterSpacing: '-0.01em' }}
            >
              Actions
            </span>
            <span className="text-[11.5px] text-[#7a7a72]">
              Agent → Igris Action Endpoint → Tool/API/Workflow
            </span>
          </div>
          <Link
            href="/actions/new"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] bg-emerald-500/[0.12] text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/[0.16]"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M12 5 L12 19 M5 12 L19 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <span>Create action</span>
          </Link>
        </div>

        {/* Status strip — first-time orientation */}
        <div
          className="flex flex-wrap items-center gap-2 px-5 py-3 border-b border-[var(--ig-border-soft)]"
          style={{ background: 'var(--ig-bg-surface)' }}
        >
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-[var(--ig-bg-chip)] border border-[var(--ig-border)]">
            <span className="block w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10.5px] text-[#7a7a72] tracking-[0.02em]">Registry</span>
            <span className="text-[11.5px] text-[#c8c7be]" style={{ letterSpacing: '-0.005em' }}>
              {actions.length} {actions.length === 1 ? 'action' : 'actions'}
            </span>
          </div>
          <div className="text-[11.5px] text-[#7a7a72] ml-1">
            Actions are endpoints your agent calls instead of calling tools directly.
          </div>
        </div>

        {/* Body */}
        <div className="ic-scroll flex-1 overflow-y-auto px-7 pt-6 pb-6">
          <div className="rounded-lg border-[0.5px] border-[var(--ig-border)] overflow-hidden" style={{ background: 'var(--ig-bg-surface)' }}>
            <div
              className="grid gap-3 border-b border-[var(--ig-border-soft)] px-4 py-2 text-[10.5px] text-[#7a7a72] tracking-[0.02em]"
              style={{ gridTemplateColumns: '1.1fr 1fr 130px 120px 110px 130px 110px' }}
            >
              <span>Action</span>
              <span>Target</span>
              <span>Policy</span>
              <span>Replay</span>
              <span>Last run</span>
              <span>Proof</span>
              <span>Endpoint</span>
            </div>

            {isLoading ? (
              <div className="px-4 py-8 text-[12px] text-[#6a6a62]">Loading actions…</div>
            ) : actions.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="text-[13.5px] text-[#e8e7df]" style={{ letterSpacing: '-0.005em' }}>
                  Create your first action
                </div>
                <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-relaxed text-[#7a7a72]">
                  Actions are endpoints your agent calls instead of calling tools directly.
                  Igris loads policy and target, then runs the action with a signed receipt.
                </p>
                <Link
                  href="/actions/new"
                  className="mt-4 inline-flex h-8 items-center rounded-md border border-emerald-500/20 bg-emerald-500/[0.12] px-3 text-[11.5px] text-emerald-300 hover:bg-emerald-500/[0.16]"
                >
                  Create action
                </Link>
              </div>
            ) : (
              actions.map((action) => {
                const setup = setupStatus(action);
                return (
                  <Link
                    key={`${action.source}-${action.id}`}
                    href={`/actions/${action.id}`}
                    className="grid items-center gap-3 border-b border-[var(--ig-border-soft)] px-4 py-2.5 last:border-b-0 hover:bg-[var(--ig-bg-chip)] transition-colors"
                    style={{ gridTemplateColumns: '1.1fr 1fr 130px 120px 110px 130px 110px' }}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={'block w-1.5 h-1.5 rounded-full flex-shrink-0 ' + (setup.tone === 'ok' ? 'bg-emerald-400' : setup.tone === 'warn' ? 'bg-amber-400' : 'bg-[#3a3a32]')} />
                      <span className="truncate text-[12.5px] text-[#e8e7df]">{action.name}</span>
                    </span>
                    <span className="truncate text-[11.5px] text-[#a8a89e]">{truncateText(action.target, 42)}</span>
                    <span className="truncate text-[11.5px] text-[#c8c7be]">{action.policy}</span>
                    <span className="truncate text-[11.5px] text-[#a8a89e]">{action.replayBehavior}</span>
                    <span className="text-[10.5px] text-[#7a7a72] tabular-nums">
                      {action.lastRun ? getRelativeTime(action.lastRun.created_at) : 'No runs yet'}
                    </span>
                    <span className={'text-[11.5px] truncate ' + toneClasses(proofTone(action.proofStatus))}>
                      {action.proofStatus}
                    </span>
                    <span className={'text-[11.5px] truncate ' + toneClasses(setup.tone)}>{setup.label}</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[var(--ig-border)]">
          <div className="flex items-center gap-3 px-5 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#d3d2c8]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Action registry</span>
            </span>
            <span className="text-[#3a3a32]">·</span>
            <span className="text-[11.5px] text-[#a8a89e]">
              Keep your AI stack. Route risky actions through Igris.
            </span>
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
