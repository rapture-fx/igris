'use client';

import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RightSideDrawer, DrawerSection } from '@/components/proof/RightSideDrawer';
import { KeyValueGrid } from '@/components/proof/KeyValueGrid';
import { JSONViewer } from '@/components/proof/JSONViewer';
import { api } from '@/lib/apiClient';
import { API_BASE_URL } from '@/utils/constants';
import { toast } from '@/components/ui/use-toast';
import { getRelativeTime } from '@/utils/helpers';
import {
  Bell, AlertTriangle, AlertCircle, Info, CheckCircle2, RefreshCw,
  ShieldAlert, Check, Radio, type LucideIcon,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertSeverity = 'info' | 'warning' | 'critical';
type AlertCategory = 'execution' | 'routing' | 'policy' | 'fleet' | 'cost';
type AlertStatus = 'open' | 'acknowledged' | 'resolved';

interface SystemAlert {
  id: string;
  timestamp: string;
  alert_type: string;
  severity: AlertSeverity;
  category: AlertCategory;
  source: string;
  message: string;
  status: AlertStatus;
  execution_id?: string;
  agent_id?: string;
  device_id?: string;
  provider?: string;
  policy_rule?: string;
  resolved_by?: string;
  resolved_at?: string;
  acknowledged_by?: string;
  acknowledged_at?: string;
}


const TIME_RANGE_MS: Record<string, number> = {
  last_15m: 15 * 60_000,
  last_1h:  60 * 60_000,
  last_6h:  6 * 60 * 60_000,
  last_24h: 24 * 60 * 60_000,
};

// ─── Badge helpers ────────────────────────────────────────────────────────────

const SEV_STYLE: Record<AlertSeverity, string> = {
  info:     'bg-gray-50 text-gray-600 border-gray-200',
  warning:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

const SEV_ICON: Record<AlertSeverity, React.ElementType> = {
  info:     Info,
  warning:  AlertTriangle,
  critical: AlertCircle,
};

const STATUS_STYLE: Record<AlertStatus, string> = {
  open:         'bg-red-50 text-red-700 border-red-200',
  acknowledged: 'bg-orange-50 text-orange-700 border-orange-200',
  resolved:     'bg-green-50 text-green-700 border-green-200',
};

const CAT_STYLE: Record<AlertCategory, string> = {
  execution: 'bg-blue-50 text-blue-700',
  routing:   'bg-violet-50 text-violet-700',
  policy:    'bg-red-50 text-red-700',
  fleet:     'bg-sky-50 text-sky-700',
  cost:      'bg-amber-50 text-amber-700',
};

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const key = (severity ?? '').toLowerCase() as AlertSeverity;
  const Icon = SEV_ICON[key];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium border rounded ${SEV_STYLE[key] ?? SEV_STYLE.info}`}>
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {key}
    </span>
  );
}

function StatusBadge({ status }: { status: AlertStatus }) {
  const key = (status ?? '').toLowerCase() as AlertStatus;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border rounded ${STATUS_STYLE[key] ?? STATUS_STYLE.open}`}>
      {key}
    </span>
  );
}

function CategoryChip({ category }: { category: AlertCategory }) {
  const key = (category ?? '').toLowerCase() as AlertCategory;
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium rounded ${CAT_STYLE[key] ?? CAT_STYLE.execution}`}>
      {key}
    </span>
  );
}

// ─── Design primitives ────────────────────────────────────────────────────────

function OverviewCard({
  icon: Icon, label, value, sub, loading,
}: {
  icon: LucideIcon; label: string; value: ReactNode; sub: string; loading?: boolean;
}) {
  return (
    <div className="border border-gray-200 shadow rounded-3xl overflow-hidden bg-white">
      <div className="px-4 pt-4 pb-2 text-xs font-medium text-black flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-gray-700" strokeWidth={1.5} />
        {label}
      </div>
      <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl px-4 pt-4 pb-5">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-3xl font-bold text-gray-900 tabular-nums">{value}</div>
        )}
        <p className="text-xs text-black mt-1">{sub}</p>
      </div>
    </div>
  );
}

function SurfaceSection({
  icon: Icon, title, description, actions,
  bodyClassName = 'px-4 py-4', className = '', children,
}: {
  icon: LucideIcon; title: string; description: string;
  actions?: ReactNode; bodyClassName?: string; className?: string; children: ReactNode;
}) {
  return (
    <div className={`border border-gray-200 shadow rounded-3xl overflow-hidden bg-white ${className}`}>
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-gray-700" strokeWidth={1.5} />
            <p className="text-xs font-medium text-black">{title}</p>
          </div>
          <p className="text-[11px] text-black mt-0.5">{description}</p>
        </div>
        {actions}
      </div>
      <div className={`bg-gray-50 border-t border-gray-200 rounded-t-3xl ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryAlertsPage() {
  const qc = useQueryClient();

  const [severity,  setSeverity]  = useState('all');
  const [category,  setCategory]  = useState('all');
  const [status,    setStatus]    = useState('all');
  const [timeRange, setTimeRange] = useState('last_1h');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // SSE live feed
  const [sseConnected, setSseConnected] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = `${API_BASE_URL}/v1/alerts/stream`;
    let es: EventSource;
    try {
      es = new EventSource(url, { withCredentials: true });
      es.onopen = () => setSseConnected(true);
      es.addEventListener('alert', (event) => {
        try {
          const newAlert: SystemAlert = JSON.parse(event.data);
          qc.setQueryData(['history-alerts', timeRange], (old: SystemAlert[] | undefined) => {
            if (!old) return [newAlert];
            if (old.some((a) => a.id === newAlert.id)) return old;
            return [newAlert, ...old];
          });
          if (newAlert.severity === 'critical') {
            toast({
              title: `Critical alert: ${newAlert.alert_type}`,
              description: newAlert.message,
              variant: 'destructive',
            });
          } else if (newAlert.severity === 'warning') {
            toast({
              title: `Warning: ${newAlert.alert_type}`,
              description: newAlert.message,
            });
          }
        } catch { /* ignore parse errors */ }
      });
      es.onerror = () => {
        setSseConnected(false);
        es.close();
      };
      sseRef.current = es;
    } catch { /* EventSource unavailable */ }
    return () => { sseRef.current?.close(); setSseConnected(false); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  // Local optimistic status overrides (ack / resolve without full refetch)
  const [localStatus, setLocalStatus] = useState<Record<string, AlertStatus>>({});

  const { data: rawAlerts, isLoading, refetch } = useQuery<SystemAlert[]>({
    queryKey: ['history-alerts', timeRange],
    queryFn: async () => {
      try {
        return await api.get<SystemAlert[]>(`/v1/history/alerts?range=${timeRange}&limit=200`);
      } catch {
        return [] as SystemAlert[];
      }
    },
    refetchInterval: 10_000,
    retry: false,
    staleTime: 5_000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/v1/history/alerts/${id}/acknowledge`, {}),
    onMutate: (id) => setLocalStatus((s) => ({ ...s, [id]: 'acknowledged' })),
    onError: (_e, id) => setLocalStatus((s) => { const n = { ...s }; delete n[id]; return n; }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['history-alerts'] }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/v1/history/alerts/${id}/resolve`, {}),
    onMutate: (id) => setLocalStatus((s) => ({ ...s, [id]: 'resolved' })),
    onError: (_e, id) => setLocalStatus((s) => { const n = { ...s }; delete n[id]; return n; }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['history-alerts'] }),
  });

  // Merge local overrides into alert list
  const alerts = useMemo(() =>
    (rawAlerts ?? []).map((a) => localStatus[a.id] ? { ...a, status: localStatus[a.id] } : a),
    [rawAlerts, localStatus]
  );

  // Filtered view
  const filtered = useMemo(() => alerts.filter((a) => {
    const matchSev = severity === 'all' || a.severity === severity;
    const matchCat = category === 'all' || a.category === category;
    const matchSts = status   === 'all' || a.status   === status;
    return matchSev && matchCat && matchSts;
  }), [alerts, severity, category, status]);

  const selected = useMemo(() => alerts.find((a) => a.id === selectedId) ?? null, [alerts, selectedId]);

  // Summary counts
  const openCount  = alerts.filter((a) => a.status === 'open').length;
  const critCount  = alerts.filter((a) => a.severity === 'critical' && a.status === 'open').length;
  const ackCount   = alerts.filter((a) => a.status === 'acknowledged').length;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const resolvedToday = alerts.filter((a) => a.status === 'resolved' && new Date(a.timestamp) >= today).length;

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">System Alerts</h1>
            <p className="text-xs text-black mt-0.5">Operational alerts and incidents generated by the runtime.</p>
          </div>
          <div className="flex items-center gap-2">
            {sseConnected ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-md">
                <Radio className="h-3 w-3 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-50 border border-gray-200 px-2 py-1 rounded-md">
                <Radio className="h-3 w-3" />
                Polling
              </span>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <OverviewCard icon={Bell}         label="Open Alerts"    value={openCount}     sub="Currently unacknowledged" loading={isLoading} />
          <OverviewCard icon={AlertCircle}  label="Critical"       value={critCount}     sub="Open critical alerts"      loading={isLoading} />
          <OverviewCard icon={ShieldAlert}  label="Acknowledged"   value={ackCount}      sub="Pending review"            loading={isLoading} />
          <OverviewCard icon={CheckCircle2} label="Resolved Today" value={resolvedToday} sub="Closed this session"       loading={isLoading} />
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="h-8 w-32 text-xs bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all"      className="text-xs">All severities</SelectItem>
              <SelectItem value="info"     className="text-xs">Info</SelectItem>
              <SelectItem value="warning"  className="text-xs">Warning</SelectItem>
              <SelectItem value="critical" className="text-xs">Critical</SelectItem>
            </SelectContent>
          </Select>

          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 w-32 text-xs bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all"       className="text-xs">All categories</SelectItem>
              <SelectItem value="execution" className="text-xs">Execution</SelectItem>
              <SelectItem value="routing"   className="text-xs">Routing</SelectItem>
              <SelectItem value="policy"    className="text-xs">Policy</SelectItem>
              <SelectItem value="fleet"     className="text-xs">Fleet</SelectItem>
              <SelectItem value="cost"      className="text-xs">Cost</SelectItem>
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 w-32 text-xs bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all"          className="text-xs">All statuses</SelectItem>
              <SelectItem value="open"         className="text-xs">Open</SelectItem>
              <SelectItem value="acknowledged" className="text-xs">Acknowledged</SelectItem>
              <SelectItem value="resolved"     className="text-xs">Resolved</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="h-8 w-32 text-xs bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="last_15m" className="text-xs">Last 15 min</SelectItem>
              <SelectItem value="last_1h"  className="text-xs">Last 1 hour</SelectItem>
              <SelectItem value="last_6h"  className="text-xs">Last 6 hours</SelectItem>
              <SelectItem value="last_24h" className="text-xs">Last 24 hours</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active alerts table */}
        <SurfaceSection
          icon={Bell}
          title="Active Alerts"
          description="Operational alerts with acknowledgement and resolution controls."
          bodyClassName="px-0 py-0"
          actions={
            !isLoading ? (
              <span className="text-[11px] text-gray-400 tabular-nums whitespace-nowrap">
                {filtered.length} alert{filtered.length !== 1 ? 's' : ''}
              </span>
            ) : undefined
          }
        >
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white mx-4 mb-4">
            <div className="overflow-y-auto relative" style={{ height: 300, scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
              <Table className="w-full table-fixed">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-gray-50 border-b border-gray-200 hover:bg-gray-50">
                    <TableHead className="w-[120px] text-xs font-medium text-gray-500 py-2 px-4">Timestamp</TableHead>
                    <TableHead className="w-[168px] text-xs font-medium text-gray-500 py-2 px-3">Alert Type</TableHead>
                    <TableHead className="w-[82px]  text-xs font-medium text-gray-500 py-2 px-3">Severity</TableHead>
                    <TableHead className="w-[82px]  text-xs font-medium text-gray-500 py-2 px-3">Category</TableHead>
                    <TableHead className="w-[140px] text-xs font-medium text-gray-500 py-2 px-3">Source</TableHead>
                    <TableHead className="           text-xs font-medium text-gray-500 py-2 px-3">Message</TableHead>
                    <TableHead className="w-[96px]  text-xs font-medium text-gray-500 py-2 px-3">Status</TableHead>
                    <TableHead className="w-[130px] text-xs font-medium text-gray-500 py-2 px-3">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i} className="border-b border-gray-100">
                          {Array.from({ length: 8 }).map((_, j) => (
                            <TableCell key={j} className="py-2.5 px-3"><Skeleton className="h-3.5 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    : filtered.length === 0
                      ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-xs text-gray-400 py-14">
                            No alerts match the current filters.
                          </TableCell>
                        </TableRow>
                      )
                      : filtered.map((alert) => (
                          <TableRow
                            key={alert.id}
                            className="border-b border-gray-100 hover:bg-gray-50/60 cursor-pointer"
                            onClick={() => setSelectedId(alert.id)}
                          >
                            <TableCell className="py-2.5 px-4 text-xs text-gray-500 font-mono whitespace-nowrap">
                              {getRelativeTime(alert.timestamp)}
                            </TableCell>
                            <TableCell className="py-2.5 px-3 text-xs text-gray-700 font-mono truncate">
                              {alert.alert_type}
                            </TableCell>
                            <TableCell className="py-2.5 px-3">
                              <SeverityBadge severity={alert.severity} />
                            </TableCell>
                            <TableCell className="py-2.5 px-3">
                              <CategoryChip category={alert.category} />
                            </TableCell>
                            <TableCell className="py-2.5 px-3 text-xs text-gray-500 truncate">
                              {alert.source}
                            </TableCell>
                            <TableCell className="py-2.5 px-3 text-xs text-gray-700 truncate">
                              {alert.message}
                            </TableCell>
                            <TableCell className="py-2.5 px-3">
                              <StatusBadge status={alert.status} />
                            </TableCell>
                            <TableCell className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5">
                                {alert.status === 'open' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-[10px] px-2 font-medium"
                                    onClick={() => acknowledgeMutation.mutate(alert.id)}
                                    disabled={acknowledgeMutation.isPending}
                                  >
                                    Ack
                                  </Button>
                                )}
                                {alert.status !== 'resolved' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-[10px] px-2 font-medium text-green-700 border-green-200 hover:bg-green-50"
                                    onClick={() => resolveMutation.mutate(alert.id)}
                                    disabled={resolveMutation.isPending}
                                  >
                                    <Check className="h-2.5 w-2.5 mr-0.5" />
                                    Resolve
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </SurfaceSection>

        {/* Alert history timeline */}
        <SurfaceSection
          icon={Bell}
          title="Recent Alert History"
          description="Last 10 alerts across all severities and statuses."
          bodyClassName="px-0 py-0"
        >
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white mx-4 mb-4">
            <div className="overflow-y-auto relative" style={{ height: 300, scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
              <Table className="w-full table-fixed">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-gray-50 border-b border-gray-200 hover:bg-gray-50">
                    <TableHead className="w-[148px] text-xs font-medium text-gray-500 py-2 px-4">Timestamp</TableHead>
                    <TableHead className="w-[168px] text-xs font-medium text-gray-500 py-2 px-3">Alert Type</TableHead>
                    <TableHead className="w-[82px]  text-xs font-medium text-gray-500 py-2 px-3">Severity</TableHead>
                    <TableHead className="w-[96px]  text-xs font-medium text-gray-500 py-2 px-3">Status</TableHead>
                    <TableHead className="           text-xs font-medium text-gray-500 py-2 px-3">Resolved By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i} className="border-b border-gray-100">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <TableCell key={j} className="py-2.5 px-3"><Skeleton className="h-3.5 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    : alerts.slice(0, 10).map((a) => (
                        <TableRow key={a.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                          <TableCell className="py-2.5 px-4 text-xs text-gray-500 font-mono whitespace-nowrap">
                            {new Date(a.timestamp).toISOString().replace('T', ' ').slice(0, 19)}
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-xs text-gray-600 font-mono truncate">
                            {a.alert_type}
                          </TableCell>
                          <TableCell className="py-2.5 px-3">
                            <SeverityBadge severity={a.severity} />
                          </TableCell>
                          <TableCell className="py-2.5 px-3">
                            <StatusBadge status={a.status} />
                          </TableCell>
                          <TableCell className="py-2.5 px-3 text-xs text-gray-500">
                            {a.resolved_by ?? <span className="text-gray-300">—</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </SurfaceSection>
      </div>

      {/* Alert details drawer */}
      <RightSideDrawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={
          <>
            <AlertCircle className="h-4 w-4 text-gray-400" />
            <span className="font-mono text-sm">{selected?.alert_type ?? ''}</span>
            {selected && <SeverityBadge severity={selected.severity} />}
          </>
        }
        subtitle={selected?.id}
      >
        {selected && (
          <>
            <DrawerSection title="Alert Metadata">
              <KeyValueGrid items={[
                { label: 'Alert ID',  value: selected.id,        copyable: true, copyValue: selected.id },
                { label: 'Timestamp', value: new Date(selected.timestamp).toISOString().replace('T', ' ').slice(0, 19) },
                { label: 'Severity',  value: <SeverityBadge severity={selected.severity} /> },
                { label: 'Category',  value: <CategoryChip category={selected.category} /> },
                { label: 'Status',    value: <StatusBadge status={selected.status} /> },
                { label: 'Source',    value: selected.source },
              ]} />
            </DrawerSection>

            <DrawerSection title="Alert Context">
              <KeyValueGrid items={[
                { label: 'Execution ID', value: selected.execution_id ?? '—', copyable: !!selected.execution_id, copyValue: selected.execution_id },
                { label: 'Agent ID',     value: selected.agent_id   ?? '—', copyable: !!selected.agent_id,   copyValue: selected.agent_id },
                { label: 'Device ID',    value: selected.device_id  ?? '—', copyable: !!selected.device_id,  copyValue: selected.device_id },
                { label: 'Provider',     value: selected.provider   ?? '—' },
                { label: 'Policy Rule',  value: selected.policy_rule ?? '—' },
              ]} />
            </DrawerSection>

            <DrawerSection title="Actions">
              <div className="flex items-center gap-2">
                {selected.status === 'open' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => { acknowledgeMutation.mutate(selected.id); setSelectedId(null); }}
                    disabled={acknowledgeMutation.isPending}
                  >
                    <ShieldAlert className="h-3 w-3" />
                    Acknowledge
                  </Button>
                )}
                {selected.status !== 'resolved' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
                    onClick={() => { resolveMutation.mutate(selected.id); setSelectedId(null); }}
                    disabled={resolveMutation.isPending}
                  >
                    <Check className="h-3 w-3" />
                    Resolve
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5 text-gray-500"
                  onClick={() => {
                    toast({ title: 'Source muted', description: `${selected.source} will be muted for 1 hour.` });
                    setSelectedId(null);
                  }}
                >
                  Mute Source
                </Button>
              </div>
              {selected.acknowledged_at && (
                <p className="text-[10px] text-gray-400 mt-2">
                  Acknowledged by <span className="font-mono">{selected.acknowledged_by}</span> at {new Date(selected.acknowledged_at).toISOString().replace('T', ' ').slice(0, 19)}
                </p>
              )}
              {selected.resolved_at && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Resolved by <span className="font-mono">{selected.resolved_by}</span> at {new Date(selected.resolved_at).toISOString().replace('T', ' ').slice(0, 19)}
                </p>
              )}
            </DrawerSection>

            <DrawerSection title="Raw Alert JSON">
              <JSONViewer data={selected} />
            </DrawerSection>
          </>
        )}
      </RightSideDrawer>
    </DashboardLayout>
  );
}
