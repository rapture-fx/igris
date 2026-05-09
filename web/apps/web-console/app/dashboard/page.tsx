'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { ErrorState } from '@/components/states/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { fetchExecutionReceipts, fetchExecutionRuns, fetchExecutionViolations, type ExecutionReceipt, type ExecutionRun, type ExecutionViolation } from '@/lib/executionRuns';
import { api } from '@/lib/apiClient';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import { useSession } from '@/lib/auth-client';
import { useTenant } from '@/hooks/useTenant';
import {
  AlertTriangle,
  ArrowRight,
  Cpu,
  Hash,
  PlayCircle,
  Shield,
  XCircle,
} from 'lucide-react';

interface OverviewStats {
  online_devices: number;
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  icon: typeof PlayCircle;
  loading: boolean;
}) {
  return (
    <div className="border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white">
      <div className="px-4 pt-4 pb-2 text-xs font-medium text-foreground flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </div>
      <div className="bg-white px-4 pt-4 pb-5">
        {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-foreground tabular-nums">{value}</div>}
      </div>
    </div>
  );
}

function Surface({
  title,
  link,
  children,
}: {
  title: string;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-foreground">{title}</span>
        {link && (
          <Link href={link.href} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
            {link.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="bg-white">{children}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const { data: tenant } = useTenant();
  const userName = tenant?.name || session?.user?.name || session?.user?.email?.split('@')[0] || 'User';

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery<OverviewStats>({
    queryKey: ['dashboard-overview'],
    queryFn: () => api.get<OverviewStats>('/v1/stats/overview', { allowMockFallback: false }),
    retry: false,
  });

  const { data: runs = [], isLoading: runsLoading, error: runsError, refetch: refetchRuns } = useQuery<ExecutionRun[]>({
    queryKey: ['dashboard-runs'],
    queryFn: () => fetchExecutionRuns({ limit: 20, sort: 'created_at:desc', range: '24h' }, { strict: true }),
    retry: false,
  });

  const { data: receipts = [], isLoading: receiptsLoading, error: receiptsError, refetch: refetchReceipts } = useQuery<ExecutionReceipt[]>({
    queryKey: ['dashboard-receipts'],
    queryFn: () => fetchExecutionReceipts(40, { strict: true }),
    retry: false,
  });

  const { data: violations = [], isLoading: violationsLoading, error: violationsError, refetch: refetchViolations } = useQuery<ExecutionViolation[]>({
    queryKey: ['dashboard-violations'],
    queryFn: () => fetchExecutionViolations('last_24h', 500, { strict: true }),
    retry: false,
  });

  const digest = useMemo(() => {
    const verifiedReceipts = receipts.filter((receipt) => {
      const status = String(receipt.status ?? receipt.verification_status ?? '').toLowerCase();
      return status === 'verified';
    }).length;
    const unverifiedReceipts = receipts.filter((receipt) => {
      const status = String(receipt.status ?? receipt.verification_status ?? '').toLowerCase();
      return status !== 'verified';
    }).length;
    const failedOrStopped = runs.filter((run) => ['ERROR', 'CANCELLED', 'VIOLATION', 'PAUSED'].includes(run.status)).length;
    return {
      runs: runs.length,
      verifiedReceipts,
      unverifiedReceipts,
      failedOrStopped,
      policyViolations: violations.length,
      connectedDevices: stats?.online_devices ?? 0,
    };
  }, [receipts, runs, violations, stats]);

  const verificationCoverage = useMemo(() => {
    if (!receipts.length) return 0;
    const verified = receipts.filter((receipt) => {
      const status = String(receipt.status ?? receipt.verification_status ?? '').toLowerCase();
      return status === 'verified';
    }).length;
    return Math.round((verified / receipts.length) * 100);
  }, [receipts]);

  const pageError = statsError ?? runsError ?? receiptsError ?? violationsError;

  if (pageError) {
    return (
      <DashboardLayout>
        <ErrorState
          error={pageError}
          title="Verified execution data is unavailable"
          description="Dashboard metrics are shown only from live backend data on this page."
          onRetry={() => {
            void refetchStats();
            void refetchRuns();
            void refetchReceipts();
            void refetchViolations();
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <OnboardingModal />
      <div className="space-y-6">
        <h1 className="text-base font-semibold text-foreground">Hi, {userName}, this is the Verified execution overview</h1>

        <div className="grid grid-cols-2 xl:grid-cols-6 gap-3">
          <SummaryCard label="Runs" value={digest.runs} icon={PlayCircle} loading={runsLoading} />
          <SummaryCard label="Verified receipts" value={digest.verifiedReceipts} icon={Hash} loading={receiptsLoading} />
          <SummaryCard label="Failed or stopped" value={digest.failedOrStopped} icon={XCircle} loading={runsLoading} />
          <SummaryCard label="Unverified receipts" value={digest.unverifiedReceipts} icon={Shield} loading={receiptsLoading} />
          <SummaryCard label="Policy violations" value={digest.policyViolations} icon={AlertTriangle} loading={violationsLoading} />
          <SummaryCard label="Connected devices" value={digest.connectedDevices} icon={Cpu} loading={statsLoading} />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-4">
          <Surface title="Recent runs" link={{ href: '/execution/runs', label: 'All runs' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white border-b border-black/[0.08] dark:border-white/[0.08]">
                    <th className="px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide">Run</th>
                    <th className="px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide">Agent</th>
                    <th className="px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide">Started</th>
                    <th className="px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {runsLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={index} className="bg-white border-b border-black/[0.08] dark:border-white/[0.08]">
                        {Array.from({ length: 5 }).map((_, cell) => (
                          <td key={cell} className="px-4 py-2.5"><Skeleton className="h-4 w-20" /></td>
                        ))}
                      </tr>
                    ))
                  ) : runs.length === 0 ? (
                    <tr className="bg-white">
                      <td colSpan={5} className="px-4 py-10 text-center text-foreground">No run records were returned.</td>
                    </tr>
                  ) : (
                    runs.map((run) => (
                      <tr key={run.id} className="bg-white border-b border-black/[0.08] dark:border-white/[0.08] hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-foreground">{truncateText(run.id, 16)}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{truncateText(run.agent_id, 16)}</td>
                        <td className="px-4 py-2.5 text-foreground">{getRelativeTime(run.started_at)}</td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={run.has_violation ? 'VIOLATION' : run.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          <Link href={`/execution/runs/${run.id}`} className="text-blue-600 hover:text-blue-700">
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Surface>

          <Surface title="Verification coverage" link={{ href: '/proof/receipts', label: 'Receipts' }}>
            <div className="px-4 py-4 space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-700 mb-2">
                  <span>Receipts verified</span>
                  <span className="font-medium tabular-nums">{verificationCoverage}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${verificationCoverage}%` }} />
                </div>
              </div>
              <div className="space-y-3">
                {receiptsLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="space-y-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  ))
                ) : receipts.length === 0 ? (
                  <p className="text-xs text-gray-500">No receipt records were returned.</p>
                ) : (
                  receipts.slice(0, 4).map((receipt) => {
                    const status = String(receipt.status ?? receipt.verification_status ?? 'pending');
                    return (
                      <div key={receipt.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-gray-800">{status}</span>
                          <span className="text-[11px] text-gray-500">{getRelativeTime(receipt.timestamp)}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-gray-600">
                          {truncateText(receipt.execution_id, 18)} · {truncateText(receipt.agent_id, 14)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Surface>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-4">
          <Surface title="Policy violations" link={{ href: '/proof/violations', label: 'Violations' }}>
            <div className="divide-y divide-gray-100 min-h-[280px]">
              {violationsLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="px-4 py-3">
                    <Skeleton className="h-3 w-24 mb-1.5" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))
              ) : violations.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs text-black">No policy violation records were returned.</div>
              ) : (
                violations.slice(0, 6).map((violation) => (
                  <div key={violation.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-gray-700">
                        {violation.violation_type || violation.policy_rule || 'Violation recorded'}
                      </span>
                      <span className="text-[11px] text-black">{getRelativeTime(violation.timestamp)}</span>
                    </div>
                    <p className="text-[11px] text-black mt-0.5">
                      {truncateText(violation.agent_id, 16)} · {truncateText(violation.device_id, 14)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Surface>

          <Surface title="Recent execution outcomes" link={{ href: '/execution/runs', label: 'Runs' }}>
            <div className="px-4 py-4 space-y-3 min-h-[280px]">
              {runsLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="space-y-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))
              ) : runs.length === 0 ? (
                <p className="text-xs text-gray-500">No execution outcomes were returned.</p>
              ) : (
                runs
                  .slice(0, 8)
                  .map((run) => (
                    <div key={run.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-medium text-gray-800">{truncateText(run.id, 18)}</p>
                        <StatusBadge status={run.has_violation ? 'VIOLATION' : run.status} />
                      </div>
                      <p className="mt-1 text-[11px] text-gray-600 leading-relaxed">
                        {truncateText(run.agent_id, 16)} · {run.verification_status || 'verification not recorded'}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </Surface>
        </div>
      </div>
    </DashboardLayout>
  );
}
