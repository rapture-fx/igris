'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { Skeleton } from '@/components/ui/skeleton';
import { useGovernanceSummary } from '@/hooks/useGovernance';
import { useTasks } from '@/hooks/useTasks';
import { GovernanceBadge } from '@/components/governance/GovernanceBadge';
import {
  criticalEventTitle,
  recoveryStateLabel,
  severityTone,
  type GovernanceCriticalEvent,
  type Tone,
} from '@/lib/governance';
import { getRelativeTime, truncateText, cn } from '@/utils/helpers';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  CircleSlash,
  FileWarning,
  Hand,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

// ── Trust summary cards ─────────────────────────────────────────────────────

interface TrustCardDef {
  key: string;
  label: string;
  hint: string;
  icon: typeof ShieldCheck;
  value: number;
  href: string;
  // Tone applied to the value when it is non-zero.
  activeTone: Tone;
}

function TrustCard({ def, loading }: { def: TrustCardDef; loading: boolean }) {
  const active = def.value > 0;
  const valueColor: Record<Tone, string> = {
    success: 'text-green-600',
    danger: 'text-red-600',
    warning: 'text-amber-600',
    info: 'text-blue-600',
    neutral: 'text-foreground',
  };
  return (
    <Link
      href={def.href}
      className="group rounded-lg border-[0.5px] border-black/[0.08] dark:border-white/[0.08] bg-white p-4 transition-colors hover:border-black/20"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <def.icon className="h-3.5 w-3.5" />
          {def.label}
        </span>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
      </div>
      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-9 w-14" />
        ) : (
          <span
            className={cn(
              'text-3xl font-bold tabular-nums',
              active ? valueColor[def.activeTone] : 'text-muted-foreground/50',
            )}
          >
            {def.value}
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{def.hint}</p>
    </Link>
  );
}

// ── Active execution states ─────────────────────────────────────────────────

function StatePill({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <GovernanceBadge label={String(value)} tone={value > 0 ? tone : 'neutral'} showDot={false} />
    </div>
  );
}

// ── Critical event row ──────────────────────────────────────────────────────

const EVENT_ICON: Record<string, typeof AlertTriangle> = {
  policy: Ban,
  proof: FileWarning,
  boundary: AlertTriangle,
  handoff: CircleSlash,
  recovery: RotateCcw,
};

function CriticalEventRow({ event }: { event: GovernanceCriticalEvent }) {
  const Icon = EVENT_ICON[event.category] ?? AlertTriangle;
  const tone = severityTone(event.severity);
  const toneColor: Record<Tone, string> = {
    success: 'text-green-600',
    danger: 'text-red-600',
    warning: 'text-amber-600',
    info: 'text-blue-600',
    neutral: 'text-muted-foreground',
  };
  const body = (
    <div className="flex items-start gap-3 px-4 py-3">
      <Icon className={cn('mt-0.5 h-4 w-4 flex-shrink-0', toneColor[tone])} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-xs font-medium text-foreground">{criticalEventTitle(event)}</span>
          <GovernanceBadge
            label={event.severity || 'event'}
            tone={tone}
            showDot={false}
            className="capitalize"
          />
          <span className="text-[11px] text-muted-foreground">
            {getRelativeTime(event.created_at)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{event.reason}</p>
        {(event.task_id || event.runtime_id) && (
          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground/70">
            {event.task_id && `task ${truncateText(event.task_id, 16)}`}
            {event.task_id && event.runtime_id && ' · '}
            {event.runtime_id && `runtime ${truncateText(event.runtime_id, 16)}`}
          </p>
        )}
      </div>
      {event.task_id && <ArrowRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
    </div>
  );
  return event.task_id ? (
    <Link
      href={`/execution/tasks/${encodeURIComponent(event.task_id)}`}
      className="block transition-colors hover:bg-gray-50"
    >
      {body}
    </Link>
  ) : (
    <div>{body}</div>
  );
}

// ── Section shell ───────────────────────────────────────────────────────────

function Section({
  title,
  description,
  link,
  children,
}: {
  title: string;
  description?: string;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
        </div>
        {link && (
          <Link
            href={link.href}
            className="flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700"
          >
            {link.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default function OverviewPage() {
  const { data: summary, isLoading, error } = useGovernanceSummary();
  const { data: tasksData, isLoading: tasksLoading } = useTasks({ limit: 6 });

  const trust = summary?.trust_summary;
  const states = summary?.active_execution_states;
  const events = summary?.recent_critical_events ?? [];
  const recentTasks = tasksData?.tasks ?? [];

  const trustCards: TrustCardDef[] = useMemo(
    () => [
      {
        key: 'verified',
        label: 'Verified executions',
        hint: 'Receipts whose hash and signature validated.',
        icon: ShieldCheck,
        value: trust?.verified_executions ?? 0,
        href: '/proof/receipts',
        activeTone: 'success',
      },
      {
        key: 'recovered',
        label: 'Recovered executions',
        hint: 'Tasks redispatched or resumed after interruption.',
        icon: RotateCcw,
        value: trust?.recovered_executions ?? 0,
        href: '/execution/tasks',
        activeTone: 'info',
      },
      {
        key: 'blocked',
        label: 'Policy-blocked actions',
        hint: 'Actions denied before runtime dispatch.',
        icon: Ban,
        value: trust?.policy_blocked_actions ?? 0,
        href: '/proof/violations',
        activeTone: 'danger',
      },
      {
        key: 'approval',
        label: 'Approval-required actions',
        hint: 'Actions paused for human approval.',
        icon: Hand,
        value: trust?.approval_required_actions ?? 0,
        href: '/execution/approvals',
        activeTone: 'warning',
      },
      {
        key: 'boundary',
        label: 'Boundary violations',
        hint: 'Runtimes that exceeded or reported exceeded limits.',
        icon: AlertTriangle,
        value: trust?.boundary_violations ?? 0,
        href: '/proof/violations',
        activeTone: 'danger',
      },
      {
        key: 'failed-proof',
        label: 'Failed proof verification',
        hint: 'Receipts that failed hash or signature checks.',
        icon: FileWarning,
        value: trust?.failed_proof_verification ?? 0,
        href: '/proof/receipts',
        activeTone: 'danger',
      },
    ],
    [trust],
  );

  return (
    <DashboardLayout>
      <OnboardingModal />
      <div className="space-y-7">
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-foreground">Execution Operations</h1>
          <p className="text-xs text-muted-foreground">
            What ran, whether it was allowed, how it recovered, and whether the result can
            be proven — across every governed AI action this tenant executed.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Execution trust summary is unavailable. The governance summary endpoint
            (<code className="font-mono">/v1/execution/governance/summary</code>) did not
            respond — the backend may not yet be deployed with execution governance.
            Per-task governance is still available on each execution detail page.
          </div>
        )}

        {/* Execution Trust Summary */}
        <Section
          title="Execution trust summary"
          description="Tenant-wide counts from the verification, policy, recovery, and boundary ledgers."
        >
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {trustCards.map((def) => (
              <TrustCard key={def.key} def={def} loading={isLoading} />
            ))}
          </div>
        </Section>

        {/* Active Execution States */}
        <Section
          title="Active execution states"
          description="Where executions currently stand."
        >
          {isLoading ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
              <StatePill label="Running" value={states?.running ?? 0} tone="info" />
              <StatePill
                label="Approval"
                value={states?.approval_required ?? 0}
                tone="warning"
              />
              <StatePill label="Recovering" value={states?.recovering ?? 0} tone="warning" />
              <StatePill label="Failed" value={states?.failed ?? 0} tone="danger" />
              <StatePill label="Verified" value={states?.verified ?? 0} tone="success" />
              <StatePill
                label="Partial proof"
                value={states?.partially_verified ?? 0}
                tone="warning"
              />
              <StatePill label="Blocked" value={states?.blocked ?? 0} tone="danger" />
            </div>
          )}
        </Section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
          {/* Recent Critical Events */}
          <Section
            title="Recent critical events"
            description="Denied actions, failed verification, boundary and handoff blocks."
          >
            <div className="overflow-hidden rounded-lg border-[0.5px] border-black/[0.08] dark:border-white/[0.08] bg-white">
              {isLoading ? (
                <div className="divide-y divide-gray-200">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="px-4 py-3">
                      <Skeleton className="mb-1.5 h-3 w-40" />
                      <Skeleton className="h-3 w-56" />
                    </div>
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 px-4 py-12 text-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <p className="text-xs font-medium text-foreground">
                    No critical events recorded
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    No denied actions, failed verification, or boundary violations for
                    this tenant.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {events.map((event, i) => (
                    <CriticalEventRow key={`${event.kind}-${event.created_at}-${i}`} event={event} />
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* Recent executions */}
          <Section
            title="Recent executions"
            link={{ href: '/execution/tasks', label: 'All executions' }}
          >
            <div className="overflow-hidden rounded-lg border-[0.5px] border-black/[0.08] dark:border-white/[0.08] bg-white">
              {tasksLoading ? (
                <div className="divide-y divide-gray-200">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-4 py-3">
                      <Skeleton className="h-3 w-44" />
                    </div>
                  ))}
                </div>
              ) : recentTasks.length === 0 ? (
                <p className="px-4 py-12 text-center text-xs text-muted-foreground">
                  No executions recorded yet.
                </p>
              ) : (
                <div className="divide-y divide-gray-200">
                  {recentTasks.map((task) => {
                    const recovery = recoveryStateLabel(task.status);
                    return (
                      <Link
                        key={task.task_id}
                        href={`/execution/tasks/${encodeURIComponent(task.task_id)}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-[11px] text-foreground">
                            {truncateText(task.task_id, 22)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {getRelativeTime(
                              task.completed_at ?? task.dispatched_at ?? task.created_at,
                            )}
                          </p>
                        </div>
                        <GovernanceBadge label={recovery.label} tone={recovery.tone} />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>
    </DashboardLayout>
  );
}
