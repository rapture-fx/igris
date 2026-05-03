'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ErrorState } from '@/components/states/ErrorState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyButton, ExecutionStatusBadge, ViolationBadge } from '@/components/execution/shared';
import { fetchExecutionRuns, formatDurationMs, type ExecutionRun } from '@/lib/executionRuns';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Search,
  Timer,
} from 'lucide-react';

function isWithin24h(dateStr: string): boolean {
  return new Date(dateStr) > new Date(Date.now() - 24 * 60 * 60 * 1000);
}

const STATUS_OPTIONS = ['all', 'RUNNING', 'COMPLETED', 'ERROR', 'VIOLATION'];
const TIME_OPTIONS = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
];

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: typeof Activity;
  loading: boolean;
}) {
  return (
    <div className="border border-gray-200 shadow rounded-3xl overflow-hidden bg-white">
      <div className="px-4 pt-4 pb-2 text-xs font-medium text-black flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-gray-400" />
        {label}
      </div>
      <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl px-4 pt-5 pb-6">
        {loading ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <div className="text-3xl font-bold text-gray-900 tabular-nums">{value}</div>
        )}
        <p className="text-xs text-black mt-1 text-right">{sub}</p>
      </div>
    </div>
  );
}

export default function ExecutionRunsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('24h');
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const { data: runs = [], isLoading, error, refetch } = useQuery<ExecutionRun[]>({
    queryKey: ['execution-runs', page, statusFilter, timeRange],
    queryFn: () => fetchExecutionRuns({
      limit: pageSize,
      offset: page * pageSize,
      sort: 'created_at:desc',
      range: timeRange,
      status: statusFilter === 'all' ? undefined : statusFilter,
    }, { strict: true }),
    retry: false,
  });

  if (error) {
    return (
      <DashboardLayout>
        <ErrorState
          error={error}
          title="Run records are unavailable"
          description="This page uses live execution records only and does not fall back to mock data."
          onRetry={() => {
            void refetch();
          }}
        />
      </DashboardLayout>
    );
  }

  const filteredRuns = useMemo(() => {
    const query = search.trim().toLowerCase();
    return runs.filter((run) => {
      const matchesSearch =
        !query ||
        run.id.toLowerCase().includes(query) ||
        run.agent_id?.toLowerCase().includes(query) ||
        run.runtime_id?.toLowerCase().includes(query) ||
        run.device_id?.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === 'all' ||
        run.status === statusFilter ||
        (statusFilter === 'VIOLATION' && run.has_violation);
      return matchesSearch && matchesStatus;
    });
  }, [runs, search, statusFilter]);

  const stats = useMemo(() => {
    const recent = runs.filter((run) => isWithin24h(run.started_at));
    const running = runs.filter((run) => run.status === 'RUNNING').length;
    const completed = recent.filter((run) => run.status === 'COMPLETED').length;
    const violations = recent.filter((run) => run.has_violation).length;
    const durations = recent
      .filter((run) => run.duration_ms != null && run.status === 'COMPLETED')
      .map((run) => run.duration_ms as number);
    const avgDuration = durations.length
      ? formatDurationMs(Math.round(durations.reduce((total, current) => total + current, 0) / durations.length))
      : '—';
    return { running, completed, violations, avgDuration };
  }, [runs]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Runs</h1>
            <p className="text-xs text-black mt-0.5">
              Execution records for governed AI work, receipts, and enforcement outcomes.
            </p>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Running" value={stats.running} sub="active now" icon={Activity} loading={isLoading} />
          <StatCard label="Completed" value={stats.completed} sub="last 24 hours" icon={CheckCircle2} loading={isLoading} />
          <StatCard label="Violations" value={stats.violations} sub="last 24 hours" icon={AlertTriangle} loading={isLoading} />
          <StatCard label="Avg Duration" value={stats.avgDuration} sub="completed runs" icon={Timer} loading={isLoading} />
        </div>

        <div className="border border-gray-200 shadow rounded-3xl overflow-hidden bg-white">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-medium text-black">Execution Records</span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="run id · agent · device"
                  className="pl-8 h-7 text-xs w-52"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-7 w-32 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status} className="text-xs">
                      {status === 'all' ? 'All statuses' : status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-xs">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Run ID</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Agent</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Device</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Model</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Started</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Duration</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Violation</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Receipt</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-gray-100">
                        {Array.from({ length: 10 }).map((_, cellIndex) => (
                          <td key={cellIndex} className="px-4 py-2.5">
                            <Skeleton className="h-3.5 w-16" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredRuns.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-16 text-center text-black">
                        No runs found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRuns.map((run) => (
                      <tr key={run.id} className="border-b border-gray-100 hover:bg-gray-100/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-700">{truncateText(run.id, 18)}</span>
                            <CopyButton value={run.id} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-700">{truncateText(run.agent_id, 14)}</span>
                            <CopyButton value={run.agent_id} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {run.runtime_id || run.device_id ? truncateText(run.runtime_id ?? run.device_id, 14) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{run.model ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500 tabular-nums">{getRelativeTime(run.started_at)}</td>
                        <td className="px-4 py-2.5 text-gray-500 tabular-nums">
                          {run.duration_ms != null ? formatDurationMs(run.duration_ms) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <ExecutionStatusBadge status={run.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          <ViolationBadge hasViolation={run.has_violation} />
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {run.receipt_hash || run.receipt_signature ? 'Available' : 'Pending'}
                        </td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/execution/runs/${run.id}`}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            Open
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-xs text-black">
                Page {page + 1} · {filteredRuns.length} records
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={page === 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={filteredRuns.length < pageSize}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
