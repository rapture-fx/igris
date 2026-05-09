'use client';

import { type CSSProperties, type ReactNode, useMemo, useState, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ErrorState } from '@/components/states/ErrorState';
import { Button } from '@/components/ui/button';
import { ClientChart } from '@/components/ui/client-chart';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { RightSideDrawer, DrawerSection } from '@/components/proof/RightSideDrawer';
import { KeyValueGrid } from '@/components/proof/KeyValueGrid';
import { fetchExecutionViolations, type ExecutionViolation } from '@/lib/executionRuns';
import { getRelativeTime } from '@/utils/helpers';
import { useChartTheme } from '@/utils/chartTheme';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  type LucideIcon,
  ShieldAlert, AlertCircle, AlertTriangle, RefreshCw,
  Download, TrendingUp, ShieldOff, ChevronUp,
} from 'lucide-react';

type ViolationSeverity = 'info' | 'warning' | 'critical' | 'unknown';

const SEV_STYLE: Record<ViolationSeverity, string> = {
  info: 'bg-gray-50 text-gray-600 border-gray-200',
  warning: 'bg-yellow-50 text-yellow-600 border-yellow-200',
  critical: 'bg-red-50 text-red-600 border-red-200',
  unknown: 'bg-gray-50 text-gray-500 border-gray-200',
};

function normalizeSeverity(value?: string): ViolationSeverity {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized === 'info') return 'info';
  if (normalized === 'warning') return 'warning';
  if (normalized === 'critical') return 'critical';
  return 'unknown';
}

function violationLabel(violation: ExecutionViolation): string {
  return violation.violation_type || violation.policy_rule || 'Violation recorded';
}

function SeverityBadge({ severity }: { severity: ViolationSeverity }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border rounded ${SEV_STYLE[severity]}`}>
      {severity}
    </span>
  );
}

function OverviewCard({
  icon: Icon, label, value, loading,
}: {
  icon: LucideIcon; label: string; value: ReactNode; loading?: boolean;
}) {
  return (
    <div className="border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white">
      <div className="px-4 pt-4 pb-2 text-xs font-medium text-foreground flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
        {label}
      </div>
      <div className="bg-white px-4 pt-4 pb-5">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-3xl font-bold text-foreground tabular-nums">{value}</div>
        )}
      </div>
    </div>
  );
}

function SurfaceSection({
  icon: Icon, title, actions,
  bodyClassName = 'px-4 py-4', className = '', collapsed = false, children,
}: {
  icon: LucideIcon; title: string;
  actions?: ReactNode; bodyClassName?: string; className?: string;
  collapsed?: boolean; children: ReactNode;
}) {
  return (
    <div className={`border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white ${className}`}>
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-xs font-medium text-foreground">{title}</p>
        </div>
        {actions}
      </div>
      {!collapsed && (
        <div className={`bg-white ${bodyClassName}`}>
          {children}
        </div>
      )}
    </div>
  );
}

function exportCSV(rows: ExecutionViolation[]) {
  const headers = ['id', 'timestamp', 'execution_id', 'agent_id', 'policy_rule', 'violation_type', 'severity', 'limit_value', 'observed_value', 'action_taken'];
  const lines = rows.map((r) => [
    r.id,
    r.timestamp,
    r.execution_id,
    r.agent_id,
    r.policy_rule ?? '',
    violationLabel(r),
    normalizeSeverity(r.severity),
    r.limit_value ?? '',
    r.observed_value ?? '',
    r.action_taken ?? '',
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `policy-violations-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ViolationsContent() {
  const chartTheme = useChartTheme();

  const [timeRange, setTimeRange] = useState('last_24h');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chartCollapsed, setChartCollapsed] = useState(false);

  const {
    data: violations = [],
    isLoading,
    error,
    refetch,
  } = useQuery<ExecutionViolation[]>({
    queryKey: ['violations-proof', timeRange],
    queryFn: () => fetchExecutionViolations(timeRange, 500, { strict: true }),
    refetchInterval: 15_000,
    retry: false,
    staleTime: 5_000,
  });

  const filtered = useMemo(() => violations.filter((violation) => {
    if (severityFilter === 'all') return true;
    return normalizeSeverity(violation.severity) === severityFilter;
  }), [violations, severityFilter]);

  const selected = useMemo(
    () => violations.find((violation) => violation.id === selectedId) ?? null,
    [violations, selectedId],
  );

  const totalCount = violations.length;
  const criticalCount = violations.filter((violation) => normalizeSeverity(violation.severity) === 'critical').length;
  const boundedCount = violations.filter((violation) => violation.limit_value != null || violation.observed_value != null).length;
  const recordedActions = violations.filter((violation) => Boolean(violation.action_taken)).length;

  const chartData = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour: `${hour}:00`, count: 0 }));
    violations.forEach((violation) => {
      const hour = new Date(violation.timestamp).getHours();
      if (hour >= 0 && hour < 24) buckets[hour].count += 1;
    });
    return buckets;
  }, [violations]);

  if (error) {
    return (
      <DashboardLayout>
        <ErrorState
          error={error}
          title="Violation records are unavailable"
          description="This page reads live proof violations and does not fall back to history alerts or mock data."
          onRetry={() => {
            void refetch();
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-foreground">Policy Violations</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => exportCSV(filtered)}
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <OverviewCard icon={ShieldAlert} label="Total Violations" value={totalCount} loading={isLoading} />
          <OverviewCard icon={AlertCircle} label="Critical" value={criticalCount} loading={isLoading} />
          <OverviewCard icon={AlertTriangle} label="With Bounds Data" value={boundedCount} loading={isLoading} />
          <OverviewCard icon={TrendingUp} label="With Actions" value={recordedActions} loading={isLoading} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="h-8 w-36 text-xs bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="last_1h" className="text-xs">Last 1 hour</SelectItem>
              <SelectItem value="last_6h" className="text-xs">Last 6 hours</SelectItem>
              <SelectItem value="last_24h" className="text-xs">Last 24 hours</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="h-8 w-36 text-xs bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All severities</SelectItem>
              <SelectItem value="info" className="text-xs">Info</SelectItem>
              <SelectItem value="warning" className="text-xs">Warning</SelectItem>
              <SelectItem value="critical" className="text-xs">Critical</SelectItem>
              <SelectItem value="unknown" className="text-xs">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SurfaceSection
          icon={ShieldOff}
          title="Violations"
          bodyClassName="px-0 py-0"
          actions={
            !isLoading ? (
              <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                {filtered.length} of {violations.length}
              </span>
            ) : undefined
          }
        >
          <div className="overflow-y-auto"
            style={{ maxHeight: 400, scrollbarWidth: 'none', msOverflowStyle: 'none' } as CSSProperties}
          >
            <Table className="w-full">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-white border-b border-black/[0.08] dark:border-white/[0.08] hover:bg-white">
                  <TableHead className="w-[120px] text-xs font-medium text-muted-foreground py-2 px-4 uppercase tracking-wide">Timestamp</TableHead>
                  <TableHead className="w-[120px] text-xs font-medium text-muted-foreground py-2 px-3 uppercase tracking-wide">Agent</TableHead>
                  <TableHead className="w-[160px] text-xs font-medium text-muted-foreground py-2 px-3 uppercase tracking-wide">Violation</TableHead>
                  <TableHead className="w-[140px] text-xs font-medium text-muted-foreground py-2 px-3 uppercase tracking-wide">Policy Rule</TableHead>
                  <TableHead className="w-[90px] text-xs font-medium text-muted-foreground py-2 px-3 uppercase tracking-wide">Severity</TableHead>
                  <TableHead className="w-[90px] text-xs font-medium text-muted-foreground py-2 px-3 uppercase tracking-wide">Limit</TableHead>
                  <TableHead className="w-[90px] text-xs font-medium text-muted-foreground py-2 px-3 uppercase tracking-wide">Observed</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground py-2 px-3 uppercase tracking-wide">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, rowIndex) => (
                      <TableRow key={rowIndex} className="bg-white border-b border-black/[0.08] dark:border-white/[0.08]">
                        {Array.from({ length: 8 }).map((_, cellIndex) => (
                          <TableCell key={cellIndex} className="py-2.5 px-3"><Skeleton className="h-3.5 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  : filtered.length === 0
                    ? (
                      <TableRow className="bg-white">
                        <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-14">
                          No policy violations were returned for the selected filters.
                        </TableCell>
                      </TableRow>
                    )
                    : filtered.map((violation) => (
                        <TableRow
                          key={violation.id}
                          className={`bg-white border-b border-black/[0.08] dark:border-white/[0.08] hover:bg-gray-50 cursor-pointer ${selectedId === violation.id ? 'bg-blue-50/40' : ''}`}
                          onClick={() => setSelectedId(violation.id === selectedId ? null : violation.id)}
                        >
                          <TableCell className="py-2.5 px-4 text-xs text-muted-foreground font-mono whitespace-nowrap">
                            {getRelativeTime(violation.timestamp)}
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-xs text-muted-foreground font-mono truncate">
                            {violation.agent_id || <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-xs text-muted-foreground font-mono truncate">
                            {violationLabel(violation)}
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-xs text-muted-foreground font-mono truncate">
                            {violation.policy_rule ?? <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="py-2.5 px-3">
                            <SeverityBadge severity={normalizeSeverity(violation.severity)} />
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-xs text-muted-foreground tabular-nums">
                            {violation.limit_value != null ? String(violation.limit_value) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-xs text-muted-foreground tabular-nums">
                            {violation.observed_value != null ? String(violation.observed_value) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-xs text-muted-foreground truncate">
                            {violation.action_taken ?? <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      ))}
              </TableBody>
            </Table>
          </div>
        </SurfaceSection>

        <SurfaceSection
          icon={TrendingUp}
          title="Violations by Hour"
          collapsed={chartCollapsed}
          actions={
            <button
              onClick={() => setChartCollapsed((value) => !value)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronUp className={`h-4 w-4 transition-transform ${chartCollapsed ? 'rotate-180' : ''}`} />
            </button>
          }
        >
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ClientChart height={160} fallbackClassName="h-40 w-full">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 9, fill: chartTheme.axis }}
                  tickLine={false}
                  axisLine={false}
                  interval={3}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: chartTheme.axis }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, padding: '4px 8px', border: `1px solid ${chartTheme.tooltip.border}`, borderRadius: 6, backgroundColor: chartTheme.tooltip.bg, color: chartTheme.tooltip.text }}
                  itemStyle={{ color: chartTheme.tooltip.text }}
                  labelStyle={{ color: chartTheme.tooltip.text }}
                  cursor={{ fill: chartTheme.tooltip.bg }}
                />
                <Bar dataKey="count" fill="#ef4444" radius={[2, 2, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ClientChart>
          )}
        </SurfaceSection>
      </div>

      <RightSideDrawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={
          <>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm">{selected ? violationLabel(selected) : 'Policy Violation'}</span>
            {selected && <SeverityBadge severity={normalizeSeverity(selected.severity)} />}
          </>
        }
        subtitle={selected?.id}
      >
        {selected && (
          <>
            <DrawerSection title="Violation Metadata">
              <KeyValueGrid items={[
                { label: 'Violation ID', value: selected.id, copyable: true, copyValue: selected.id },
                { label: 'Timestamp', value: new Date(selected.timestamp).toISOString().replace('T', ' ').slice(0, 19) },
                { label: 'Execution ID', value: selected.execution_id, copyable: true, copyValue: selected.execution_id },
                { label: 'Agent ID', value: selected.agent_id || '—', copyable: !!selected.agent_id, copyValue: selected.agent_id },
                { label: 'Device ID', value: selected.device_id || '—', copyable: !!selected.device_id, copyValue: selected.device_id },
                { label: 'Severity', value: <SeverityBadge severity={normalizeSeverity(selected.severity)} /> },
              ]} />
            </DrawerSection>

            <DrawerSection title="Policy Context">
              <KeyValueGrid items={[
                { label: 'Policy Rule', value: selected.policy_rule ?? '—' },
                { label: 'Capability Rule', value: selected.capability_rule ?? '—' },
                { label: 'Bounds Rule', value: selected.bounds_rule ?? '—' },
                { label: 'Limit Value', value: selected.limit_value != null ? String(selected.limit_value) : '—' },
                { label: 'Observed Value', value: selected.observed_value != null ? String(selected.observed_value) : '—' },
              ]} />
            </DrawerSection>

            <DrawerSection title="Execution State">
              <KeyValueGrid items={[
                { label: 'Run Status', value: selected.status ?? '—' },
                { label: 'Execution State', value: selected.execution_state ?? '—' },
                { label: 'Action Taken', value: selected.action_taken ?? '—' },
                { label: 'Supervisor Action', value: selected.supervisor_action ?? '—' },
                { label: 'Containment Result', value: selected.containment_result ?? '—' },
              ]} />
            </DrawerSection>
          </>
        )}
      </RightSideDrawer>
    </DashboardLayout>
  );
}

export default function ProofViolationsPage() {
  return (
    <Suspense>
      <ViolationsContent />
    </Suspense>
  );
}
