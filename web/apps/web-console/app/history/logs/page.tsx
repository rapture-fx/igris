'use client';

import { useState, useMemo, useEffect, Suspense, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { downloadJSON, getRelativeTime, formatCurrency, cn } from '@/utils/helpers';
import { useTraces, type RequestTrace } from '@/hooks/useTraces';
import { KeyValueGrid } from '@/components/proof/KeyValueGrid';
import { JSONViewer } from '@/components/proof/JSONViewer';
import { RightSideDrawer, DrawerSection } from '@/components/proof/RightSideDrawer';
import {
  Search, RefreshCw, Download, Copy, Check, X,
  Radio, Activity, Link2, type LucideIcon,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

type Severity = 'info' | 'warning' | 'error' | 'critical';

type EventType =
  | 'ExecutionStarted'
  | 'ProviderSelected'
  | 'ToolCall'
  | 'PolicyViolation'
  | 'ExecutionTerminated'
  | 'ReceiptSigned'
  | 'DeviceConnected'
  | 'DeviceDisconnected';

interface EventPayload {
  policy_rule?: string;
  action_taken?: string;
  latency_ms?: number;
  provider?: string;
  model?: string;
  tokens?: number;
  [key: string]: unknown;
}

interface RuntimeEvent {
  id: string;
  timestamp: string;
  event_type: EventType;
  severity: Severity;
  execution_id: string;
  agent_id: string;
  device_id: string;
  message: string;
  payload: EventPayload;
}


const TIME_RANGE_MAP: Record<string, number> = {
  last_5m:  5 * 60_000,
  last_15m: 15 * 60_000,
  last_1h:  60 * 60_000,
  last_6h:  6 * 60 * 60_000,
  last_24h: 24 * 60 * 60_000,
};

const EVENT_TYPES: EventType[] = [
  'ExecutionStarted', 'ProviderSelected', 'ToolCall', 'PolicyViolation',
  'ExecutionTerminated', 'ReceiptSigned', 'DeviceConnected', 'DeviceDisconnected',
];

// ─── Severity badge ─────────────────────────────────────────────────────────────

const SEV_STYLES: Record<Severity, string> = {
  info:     'bg-gray-50 text-gray-600 border-gray-200',
  warning:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  error:    'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

const SEV_ROW: Record<Severity, string> = {
  info:     'border-l-gray-200',
  warning:  'border-l-yellow-400',
  error:    'border-l-orange-400',
  critical: 'border-l-red-500',
};

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium border rounded ${SEV_STYLES[severity]}`}>
      {severity}
    </span>
  );
}

// ─── Event type chip ─────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<EventType, string> = {
  ExecutionStarted:    'bg-blue-50 text-blue-700',
  ProviderSelected:    'bg-violet-50 text-violet-700',
  ToolCall:            'bg-teal-50 text-teal-700',
  PolicyViolation:     'bg-red-50 text-red-700',
  ExecutionTerminated: 'bg-orange-50 text-orange-700',
  ReceiptSigned:       'bg-green-50 text-green-700',
  DeviceConnected:     'bg-sky-50 text-sky-700',
  DeviceDisconnected:  'bg-gray-100 text-gray-600',
};

function EventTypeChip({ type }: { type: EventType }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded ${TYPE_STYLES[type]}`}>
      {type}
    </span>
  );
}

// ─── Copy Button ─────────────────────────────────────────────────────────────────

function CopyBtn({ text, className }: { text: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className={cn('flex-shrink-0 text-gray-300 hover:text-gray-600 transition-colors', className)}
      title="Copy"
    >
      {ok ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ─── Filter chip ─────────────────────────────────────────────────────────────────

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-px bg-gray-100 text-gray-700 rounded-full border border-gray-200">
      {label}
      <button onClick={onClear} className="text-gray-400 hover:text-gray-700 transition-colors ml-0.5">
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

// ─── Surface Section ─────────────────────────────────────────────────────────────

function SurfaceSection({
  icon: Icon,
  title,
  description,
  actions,
  children,
  bodyClassName,
  collapsed,
  className,
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  bodyClassName?: string;
  collapsed?: boolean;
  className?: string;
}) {
  const hasHeader = title || Icon || actions;
  return (
    <div className={cn('rounded-lg overflow-hidden bg-background border-[0.5px] border-black/[0.08] dark:border-white/[0.08]', className)}>
      {hasHeader && (
        <div className="flex items-start justify-between gap-4 px-5 py-4">
          {(title || Icon) && (
            <div className="flex items-start gap-3">
              {Icon && (
                <div className="flex-shrink-0 mt-0.5 p-1.5 rounded-md bg-gray-100">
                  <Icon className="h-4 w-4 text-gray-500" />
                </div>
              )}
              {title && (
                <div>
                  <p className="text-sm font-semibold text-gray-900">{title}</p>
                  {description && <p className="text-xs text-black mt-0.5">{description}</p>}
                </div>
              )}
            </div>
          )}
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      )}
      {!collapsed && (
        <div className={cn('bg-background', hasHeader && 'border-t-[0.5px] border-black/[0.08] dark:border-white/[0.08]', bodyClassName ?? 'px-5 py-4')}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Execution Timeline View ──────────────────────────────────────────────────────

function ExecutionTimeline({ events }: { events: RuntimeEvent[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, RuntimeEvent[]>();
    for (const e of events) {
      const key = e.execution_id || '__device__';
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([execId, evts]) => ({
      execId,
      events: evts,
      firstTs: evts[evts.length - 1]?.timestamp,
      lastTs: evts[0]?.timestamp,
      hasCritical: evts.some((e) => e.severity === 'critical'),
      hasError: evts.some((e) => e.severity === 'error'),
    }));
  }, [events]);

  if (grouped.length === 0) {
    return (
      <div className="py-8 text-xs text-gray-500">
        — no events for the selected filters —
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grouped.map(({ execId, events: evts, firstTs, lastTs, hasCritical, hasError }) => (
        <div key={execId} className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-2.5 flex items-center justify-between gap-3 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-2 min-w-0">
              <Activity className="h-3 w-3 text-gray-400 flex-shrink-0" />
              {execId === '__device__' ? (
                <span className="text-xs text-gray-400">runtime events</span>
              ) : (
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs text-blue-600 truncate">{execId}</span>
                  <CopyBtn text={execId} className="text-gray-300 hover:text-gray-600" />
                </div>
              )}
              {hasCritical && <span className="text-xs text-red-500 font-bold">CRIT</span>}
              {!hasCritical && hasError && <span className="text-xs text-orange-600 font-bold">ERR</span>}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-400">
              <span>{evts.length} events</span>
              {firstTs && lastTs && firstTs !== lastTs && (
                <span>{getRelativeTime(firstTs)} → {getRelativeTime(lastTs)}</span>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {evts.map((e) => (
              <div key={e.id} className="flex items-baseline gap-0 px-4 py-[3px] hover:bg-gray-50 transition-colors">
                <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap pr-3 flex-shrink-0 select-none">
                  {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={cn(
                  'text-xs font-bold uppercase pr-3 w-[46px] flex-shrink-0 select-none',
                  e.severity === 'critical' ? 'text-red-400'    :
                  e.severity === 'error'    ? 'text-orange-400' :
                  e.severity === 'warning'  ? 'text-yellow-400' :
                                              'text-green-500',
                )}>
                  {e.severity === 'critical' ? 'CRIT' : e.severity.slice(0, 4).toUpperCase()}
                </span>
                <span className="text-xs text-violet-600 pr-3 w-[160px] flex-shrink-0 truncate select-none">{e.event_type}</span>
                <span className="text-xs text-gray-700 flex-1 min-w-0 break-words leading-[1.7]">{e.message}</span>
                {e.payload.latency_ms != null && (
                  <span className="text-xs text-gray-400 tabular-nums flex-shrink-0 pl-3 select-none">
                    {e.payload.latency_ms}ms
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page content ────────────────────────────────────────────────────────────

function LogsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filters
  const [agentFilter,     setAgentFilter]     = useState('all');
  const [deviceFilter,    setDeviceFilter]    = useState('all');
  const [execFilter,      setExecFilter]      = useState('');
  const [typeFilter,      setTypeFilter]      = useState('all');
  const [severityFilter,  setSeverityFilter]  = useState('all');
  const [timeRange,       setTimeRange]       = useState('last_1h');
  const [textSearch,      setTextSearch]      = useState('');

  // Controls
  const [liveMode,   setLiveMode]   = useState(true);
  const [viewMode,   setViewMode]   = useState<'event_stream' | 'execution_timeline' | 'request_traces'>('event_stream');
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('event'));

  // Traces tab state
  const [traceProviderFilter, setTraceProviderFilter] = useState('all');
  const [traceStatusFilter,   setTraceStatusFilter]   = useState('all');
  const [selectedTrace,       setSelectedTrace]       = useState<RequestTrace | null>(null);

  const { data: allTraces = [], isLoading: tracesLoading } = useTraces();

  // Fetch
  const { data: allEvents = [], isLoading, refetch, dataUpdatedAt } = useQuery<RuntimeEvent[]>({
    queryKey: ['history-events', timeRange, agentFilter, deviceFilter, typeFilter, severityFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ range: timeRange, limit: '500' });
      if (agentFilter   !== 'all') p.set('agent_id',   agentFilter);
      if (deviceFilter  !== 'all') p.set('device_id',  deviceFilter);
      if (typeFilter    !== 'all') p.set('event_type', typeFilter);
      if (severityFilter !== 'all') p.set('severity',  severityFilter);
      try {
        return await api.get<RuntimeEvent[]>(`/v1/history/events?${p}`);
      } catch {
        return [] as RuntimeEvent[];
      }
    },
    refetchInterval: liveMode ? 10_000 : false,
    retry: false,
    staleTime: 5_000,
  });

  // Sync drawer URL
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    selectedId ? p.set('event', selectedId) : p.delete('event');
    router.replace(`?${p.toString()}`, { scroll: false });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive select options from data
  const uniqueAgents  = useMemo(() => [...new Set(allEvents.map((e) => e.agent_id).filter(Boolean))], [allEvents]);
  const uniqueDevices = useMemo(() => [...new Set(allEvents.map((e) => e.device_id).filter(Boolean))], [allEvents]);

  // Client-side filters
  const events = useMemo(() => {
    const q = textSearch.trim().toLowerCase();
    return allEvents.filter((e) => {
      const matchExec    = !execFilter   || e.execution_id.includes(execFilter);
      const matchAgent   = agentFilter   === 'all' || e.agent_id   === agentFilter;
      const matchDevice  = deviceFilter  === 'all' || e.device_id  === deviceFilter;
      const matchType    = typeFilter    === 'all' || e.event_type === typeFilter;
      const matchSev     = severityFilter === 'all' || e.severity   === severityFilter;
      const matchText    = !q || e.message.toLowerCase().includes(q)
        || e.execution_id.toLowerCase().includes(q)
        || e.agent_id.toLowerCase().includes(q)
        || e.event_type.toLowerCase().includes(q);
      return matchExec && matchAgent && matchDevice && matchType && matchSev && matchText;
    });
  }, [allEvents, execFilter, agentFilter, deviceFilter, typeFilter, severityFilter, textSearch]);

  const selected = useMemo(() => events.find((e) => e.id === selectedId) ?? null, [events, selectedId]);

  const counts = useMemo(() => ({
    total:    events.length,
    critical: events.filter((e) => e.severity === 'critical').length,
    error:    events.filter((e) => e.severity === 'error').length,
    warning:  events.filter((e) => e.severity === 'warning').length,
  }), [events]);

  // Active chips
  const activeFilters = [
    agentFilter   !== 'all' && { key: 'agent',   label: `agent: ${agentFilter}`,    clear: () => setAgentFilter('all') },
    deviceFilter  !== 'all' && { key: 'runtime', label: `runtime: ${deviceFilter}`, clear: () => setDeviceFilter('all') },
    execFilter              && { key: 'exec',    label: `exec: ${execFilter}`,       clear: () => setExecFilter('') },
    typeFilter    !== 'all' && { key: 'type',    label: typeFilter,                  clear: () => setTypeFilter('all') },
    severityFilter !== 'all' && { key: 'sev',   label: severityFilter,              clear: () => setSeverityFilter('all') },
    textSearch              && { key: 'search',  label: `"${textSearch}"`,           clear: () => setTextSearch('') },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const clearAll = () => {
    setAgentFilter('all'); setDeviceFilter('all'); setExecFilter('');
    setTypeFilter('all'); setSeverityFilter('all'); setTextSearch('');
  };

  function highlightMatch(text: string, q: string) {
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-100 text-yellow-900 rounded-[2px]">
          {text.slice(idx, idx + q.length)}
        </mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  const q = textSearch.trim().toLowerCase();

  return (
    <DashboardLayout fullWidth>
      <div className="flex flex-col gap-2 flex-1 min-h-0 px-6 pr-8 py-6">

        {/* ── Filter bar ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2 flex-shrink-0">
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="h-auto py-2 w-52 text-xs bg-white shadow-none"><SelectValue placeholder="all agents" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">all agents</SelectItem>
              {uniqueAgents.map((a) => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={deviceFilter} onValueChange={setDeviceFilter}>
            <SelectTrigger className="h-auto py-2 w-52 text-xs bg-white shadow-none"><SelectValue placeholder="all runtimes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">all runtimes</SelectItem>
              {uniqueDevices.map((d) => <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="exec ID..." className="py-2 h-auto w-52 text-xs shadow-none"
            value={execFilter} onChange={(e) => setExecFilter(e.target.value)} />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-auto py-2 w-60 text-xs bg-white shadow-none"><SelectValue placeholder="all types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">all types</SelectItem>
              {EVENT_TYPES.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="h-auto py-2 w-44 text-xs bg-white shadow-none"><SelectValue placeholder="all" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">all</SelectItem>
              {(['info', 'warning', 'error', 'critical'] as Severity[]).map((s) =>
                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="h-auto py-2 w-44 text-xs bg-white shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[
                { label: 'Last 5m',  value: 'last_5m'  },
                { label: 'Last 15m', value: 'last_15m' },
                { label: 'Last 1h',  value: 'last_1h'  },
                { label: 'Last 6h',  value: 'last_6h'  },
                { label: 'Last 24h', value: 'last_24h' },
              ].map((t) => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-auto py-2 text-xs gap-1.5" onClick={() => setLiveMode(!liveMode)}>
            <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', liveMode ? 'bg-green-500 animate-pulse' : 'bg-gray-400')} />
            Live
          </Button>
          <Button variant="outline" size="sm" className="h-auto py-2 text-xs gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
          <Button variant="outline" size="sm" className="h-auto py-2 text-xs gap-1.5" disabled={events.length === 0}
            onClick={() => downloadJSON(events, `events-${timeRange}`)}>
            <Download className="h-3 w-3" /> Export
          </Button>
          <div className="relative flex-1 min-w-[120px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input placeholder="search messages..." className="py-2 h-auto text-xs pl-7 shadow-none bg-white"
              value={textSearch} onChange={(e) => setTextSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setTextSearch('')} />
          </div>
        </div>
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2.5 border-t border-gray-100">
            {activeFilters.map((f) => <FilterChip key={f.key} label={f.label} onClear={f.clear} />)}
            <button onClick={clearAll} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">clear all</button>
          </div>
        )}

        {/* ── Tabs + stats ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-shrink-0">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
            <TabsList className="h-8 p-0.5 bg-muted gap-0">
              <TabsTrigger value="event_stream" className="h-7 px-3 text-xs text-gray-600 dark:text-gray-400 data-[state=active]:bg-white dark:data-[state=active]:bg-background data-[state=active]:text-gray-900 dark:data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:shadow-none data-[state=active]:border-0 data-[state=active]:rounded-md">
                Event Stream
              </TabsTrigger>
              <TabsTrigger value="execution_timeline" className="h-7 px-3 text-xs text-gray-600 dark:text-gray-400 data-[state=active]:bg-white dark:data-[state=active]:bg-background data-[state=active]:text-gray-900 dark:data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:shadow-none data-[state=active]:border-0 data-[state=active]:rounded-md">
                Execution Timeline
              </TabsTrigger>
              <TabsTrigger value="request_traces" className="h-7 px-3 text-xs text-gray-600 dark:text-gray-400 data-[state=active]:bg-white dark:data-[state=active]:bg-background data-[state=active]:text-gray-900 dark:data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:shadow-none data-[state=active]:border-0 data-[state=active]:rounded-md">
                Request Traces
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-400 tabular-nums">
              {isLoading ? '…' : events.length}{allEvents.length !== events.length && ` / ${allEvents.length}`} events
            </span>
            {counts.critical > 0 && <span className="px-1.5 py-0.5 rounded border text-xs font-medium bg-red-50 text-red-700 border-red-200">{counts.critical} critical</span>}
            {counts.error > 0 && <span className="px-1.5 py-0.5 rounded border text-xs font-medium bg-orange-50 text-orange-700 border-orange-200">{counts.error} error</span>}
            {counts.warning > 0 && <span className="px-1.5 py-0.5 rounded border text-xs font-medium bg-yellow-50 text-yellow-700 border-yellow-200">{counts.warning} warning</span>}
            {liveMode && <span className="flex items-center gap-1 text-green-600"><Radio className="h-2.5 w-2.5" /> live</span>}
            {dataUpdatedAt > 0 && <span className="text-gray-400">{new Date(dataUpdatedAt).toLocaleTimeString()}</span>}
          </div>
        </div>

        {/* ── Request Traces ────────────────────────────────────────────────── */}
        {viewMode === 'request_traces' ? (() => {
          const traceProviders = Array.from(new Set(allTraces.map((t) => t.provider))).sort();
          const filteredTraces = allTraces.filter((t) => {
            if (traceProviderFilter !== 'all' && t.provider !== traceProviderFilter) return false;
            if (traceStatusFilter === '200' && t.status !== 200) return false;
            if (traceStatusFilter === 'error' && t.status === 200) return false;
            return true;
          });
          return (
            <>
              <SurfaceSection
                className="flex-1 min-h-0 flex flex-col"
                bodyClassName="px-0 py-0 flex-1 min-h-0"
                actions={
                  <>
                    <Select value={traceProviderFilter} onValueChange={setTraceProviderFilter}>
                      <SelectTrigger className="h-8 w-36 text-xs bg-white"><SelectValue placeholder="All providers" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All providers</SelectItem>
                        {traceProviders.map((p) => (
                          <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={traceStatusFilter} onValueChange={setTraceStatusFilter}>
                      <SelectTrigger className="h-8 w-28 text-xs bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all"   className="text-xs">All statuses</SelectItem>
                        <SelectItem value="200"   className="text-xs">Success (200)</SelectItem>
                        <SelectItem value="error" className="text-xs">Errors</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-gray-400 tabular-nums">
                      {tracesLoading ? '…' : filteredTraces.length} traces
                    </span>
                  </>
                }
              >
              {/* Traces table */}
              <div
                className="overflow-y-auto flex-1 min-h-0"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
              >
                  <Table className="w-full table-fixed">
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[90px]  text-xs font-medium text-gray-500 uppercase tracking-wide h-9 px-3 bg-background border-b border-black/[0.08] dark:border-white/[0.08]">Time</TableHead>
                        <TableHead className="w-[110px] text-xs font-medium text-gray-500 uppercase tracking-wide h-9 px-3 bg-background border-b border-black/[0.08] dark:border-white/[0.08]">Provider</TableHead>
                        <TableHead className="w-[140px] text-xs font-medium text-gray-500 uppercase tracking-wide h-9 px-3 bg-background border-b border-black/[0.08] dark:border-white/[0.08]">Model</TableHead>
                        <TableHead className="w-[64px]  text-xs font-medium text-gray-500 uppercase tracking-wide h-9 px-3 bg-background border-b border-black/[0.08] dark:border-white/[0.08]">Status</TableHead>
                        <TableHead className="w-[80px]  text-xs font-medium text-gray-500 uppercase tracking-wide h-9 px-3 bg-background border-b border-black/[0.08] dark:border-white/[0.08]">Latency</TableHead>
                        <TableHead className="w-[80px]  text-xs font-medium text-gray-500 uppercase tracking-wide h-9 px-3 bg-background border-b border-black/[0.08] dark:border-white/[0.08]">Tokens</TableHead>
                        <TableHead className="w-[70px]  text-xs font-medium text-gray-500 uppercase tracking-wide h-9 px-3 bg-background border-b border-black/[0.08] dark:border-white/[0.08]">Cost</TableHead>
                        <TableHead className="           text-xs font-medium text-gray-500 uppercase tracking-wide h-9 px-3 bg-background border-b border-black/[0.08] dark:border-white/[0.08]">Tags</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tracesLoading ? (
                        Array.from({ length: 10 }).map((_, i) => (
                          <TableRow key={i}>
                            {Array.from({ length: 8 }).map((_, j) => (
                              <TableCell key={j} className="px-3 py-2">
                                <div className="h-3 rounded bg-gray-100 animate-pulse" style={{ width: `${(i * 37 + j * 19) % 80 + 32}px` }} />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : filteredTraces.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="py-16 text-center text-xs text-gray-400">
                            No traces for the selected filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTraces.map((trace) => (
                          <TableRow
                            key={trace.id}
                            className={cn(
                              'cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors',
                              selectedTrace?.id === trace.id ? 'bg-blue-50/50' : '',
                            )}
                            onClick={() => setSelectedTrace(selectedTrace?.id === trace.id ? null : trace)}
                          >
                            <TableCell className="px-3 py-2 text-xs text-gray-400 tabular-nums whitespace-nowrap">
                              {new Date(trace.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-xs text-gray-700 font-medium truncate">
                              {trace.provider}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-xs text-gray-500 truncate" title={trace.model}>
                              {trace.model}
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium border ${
                                trace.status === 200
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : trace.status === 429
                                  ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                {trace.status}
                              </span>
                            </TableCell>
                            <TableCell className="px-3 py-2 text-xs tabular-nums text-gray-600">
                              {trace.latency < 1000
                                ? `${Math.round(trace.latency)}ms`
                                : `${(trace.latency / 1000).toFixed(1)}s`}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-xs tabular-nums text-gray-600">
                              {trace.tokens?.total?.toLocaleString() ?? '—'}
                            </TableCell>
                            <TableCell className="px-3 py-2 text-xs tabular-nums text-gray-600">
                              {formatCurrency(trace.cost, 'USD')}
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <div className="flex items-center gap-1 flex-wrap">
                                {trace.cache_hit && (
                                  <span className="inline-flex px-1 py-0.5 rounded text-xs bg-sky-50 text-sky-600 border border-sky-200">cache</span>
                                )}
                                {trace.used_speculative && (
                                  <span className="inline-flex px-1 py-0.5 rounded text-xs bg-violet-50 text-violet-600 border border-violet-200">spec</span>
                                )}
                                {trace.tag && (
                                  <span className="inline-flex px-1 py-0.5 rounded text-xs bg-amber-50 text-amber-600 border border-amber-200">{trace.tag}</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </SurfaceSection>

              {/* Trace detail drawer */}
              <RightSideDrawer
                open={!!selectedTrace}
                onClose={() => setSelectedTrace(null)}
                title={
                  <>
                    <Activity className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">{selectedTrace?.provider ?? ''}</span>
                    {selectedTrace && (
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium border ${
                        selectedTrace.status === 200 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {selectedTrace.status}
                      </span>
                    )}
                  </>
                }
                subtitle={selectedTrace?.request_id}
              >
                {selectedTrace && (
                  <>
                    <DrawerSection title="Request Metadata">
                      <KeyValueGrid items={[
                        { label: 'Request ID',  value: selectedTrace.request_id, copyable: true, copyValue: selectedTrace.request_id },
                        { label: 'Provider',    value: selectedTrace.provider },
                        { label: 'Model',       value: selectedTrace.model },
                        { label: 'Timestamp',   value: new Date(selectedTrace.timestamp).toISOString().replace('T', ' ').slice(0, 19) },
                        { label: 'Latency',     value: selectedTrace.latency < 1000 ? `${Math.round(selectedTrace.latency)}ms` : `${(selectedTrace.latency / 1000).toFixed(2)}s` },
                        { label: 'Status',      value: String(selectedTrace.status) },
                        { label: 'Streamed',    value: selectedTrace.was_streamed ? 'Yes' : 'No' },
                        { label: 'Speculative', value: selectedTrace.used_speculative ? 'Yes' : 'No' },
                        { label: 'Cache Hit',   value: selectedTrace.cache_hit ? `Yes (saved ${formatCurrency(selectedTrace.cache_savings ?? 0)})` : 'No' },
                      ]} />
                    </DrawerSection>

                    <DrawerSection title="Token Usage">
                      <KeyValueGrid items={[
                        { label: 'Input Tokens',  value: selectedTrace.tokens?.input?.toLocaleString() ?? '—' },
                        { label: 'Output Tokens', value: selectedTrace.tokens?.output?.toLocaleString() ?? '—' },
                        { label: 'Total Tokens',  value: selectedTrace.tokens?.total?.toLocaleString() ?? '—' },
                      ]} />
                    </DrawerSection>

                    <DrawerSection title="Cost Breakdown">
                      <KeyValueGrid items={[
                        { label: 'Input Cost',    value: formatCurrency(selectedTrace.cost_breakdown?.input ?? 0) },
                        { label: 'Output Cost',   value: formatCurrency(selectedTrace.cost_breakdown?.output ?? 0) },
                        { label: 'Overhead',      value: formatCurrency(selectedTrace.cost_breakdown?.overhead ?? 0) },
                        { label: 'Total Cost',    value: formatCurrency(selectedTrace.cost) },
                      ]} />
                    </DrawerSection>

                    {selectedTrace.prompt && (
                      <DrawerSection title="Prompt">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words bg-gray-50 rounded p-2.5 max-h-40 overflow-y-auto">
                          {selectedTrace.prompt}
                        </pre>
                      </DrawerSection>
                    )}

                    {selectedTrace.completion && (
                      <DrawerSection title="Completion">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words bg-gray-50 rounded p-2.5 max-h-40 overflow-y-auto">
                          {selectedTrace.completion}
                        </pre>
                      </DrawerSection>
                    )}

                    {selectedTrace.error && (
                      <DrawerSection title="Error">
                        <div className="bg-red-50 border border-red-200 rounded p-2.5">
                          <p className="text-xs text-red-700 font-medium">{selectedTrace.error.message}</p>
                          {selectedTrace.error.provider_error && (
                            <p className="text-xs text-red-500 mt-1">{selectedTrace.error.provider_error}</p>
                          )}
                        </div>
                      </DrawerSection>
                    )}

                    <DrawerSection title="Raw Trace JSON">
                      <JSONViewer data={selectedTrace} filename={`trace-${selectedTrace.request_id}`} />
                    </DrawerSection>
                  </>
                )}
              </RightSideDrawer>
            </>
          );
        })() : null}

        {/* ── Execution Timeline ────────────────────────────────────────────── */}
        {viewMode === 'execution_timeline' ? (
          <SurfaceSection
            className="flex-1 min-h-0 flex flex-col"
            bodyClassName="px-4 py-4 flex-1 min-h-0 overflow-y-auto"
          >
            <div
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgb(229 231 235) transparent' } as React.CSSProperties}
            >
              <div className="space-y-3 pb-6">
                <ExecutionTimeline events={events} />
              </div>
            </div>
          </SurfaceSection>
        ) : viewMode === 'event_stream' ? (

        /* ── Event Stream ────────────────────────────────────────────────── */
        <SurfaceSection
          className="flex-1 min-h-0 flex flex-col"
          bodyClassName="px-0 py-0 flex-1 min-h-0"
          actions={
            <div className="flex items-center gap-2">
              {liveMode && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <Radio className="h-2.5 w-2.5" /> live
                </span>
              )}
              {dataUpdatedAt > 0 && !liveMode && (
                <span className="text-xs text-gray-400">
                  {new Date(dataUpdatedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          }
        >
          {/* Log lines */}
          <div
            className="overflow-y-auto h-full"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgb(229 231 235) transparent' } as React.CSSProperties}
          >
            {isLoading ? (
              <div className="px-4 py-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-[3px] opacity-30 animate-pulse">
                    <span className="text-xs text-gray-600 w-[58px] bg-gray-200 rounded h-2.5" />
                    <span className="text-xs w-[36px] bg-gray-100 rounded h-2.5" />
                    <span className="text-xs w-[120px] bg-gray-200 rounded h-2.5" />
                    <span className="text-xs flex-1 bg-gray-200 rounded h-2.5" style={{ maxWidth: `${(i * 47 + 120) % 280 + 80}px` }} />
                  </div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="px-4 py-8">
                <span className="text-xs text-gray-600">
                  {activeFilters.length > 0
                    ? <>— no events match filters — <button onClick={clearAll} className="text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors">clear</button></>
                    : '— no events in selected time range —'}
                </span>
              </div>
            ) : (
              events.map((e) => (
                <div
                  key={e.id}
                  className={cn(
                    'flex items-baseline gap-0 px-4 py-[3px] cursor-pointer group transition-colors',
                    'border-l-[3px]',
                    selectedId === e.id
                      ? 'bg-blue-50'
                      : 'hover:bg-gray-50',
                    e.severity === 'critical' ? 'border-l-red-500'    :
                    e.severity === 'error'    ? 'border-l-orange-500' :
                    e.severity === 'warning'  ? 'border-l-yellow-500' :
                                                'border-l-transparent',
                  )}
                  onClick={() => setSelectedId(e.id === selectedId ? null : e.id)}
                >
                  {/* Timestamp */}
                  <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap pr-3 flex-shrink-0 select-none">
                    {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>

                  {/* Severity level */}
                  <span className={cn(
                    'text-xs font-bold uppercase pr-3 w-[46px] flex-shrink-0 select-none',
                    e.severity === 'critical' ? 'text-red-400'    :
                    e.severity === 'error'    ? 'text-orange-400' :
                    e.severity === 'warning'  ? 'text-yellow-400' :
                                                'text-green-500',
                  )}>
                    {e.severity === 'critical' ? 'CRIT' : e.severity.slice(0, 4).toUpperCase()}
                  </span>

                  {/* Event type */}
                  <span className="text-xs text-violet-600 pr-3 w-[176px] flex-shrink-0 truncate select-none">
                    {e.event_type}
                  </span>

                  {/* Message */}
                  <span className="text-xs text-gray-700 flex-1 min-w-0 break-words leading-[1.7]">
                    {q ? highlightMatch(e.message, q) : e.message}
                  </span>

                  {/* Exec ID — reveal on hover */}
                  {e.execution_id && (
                    <span
                      className="text-xs text-blue-500/60 flex-shrink-0 pl-3 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                      onClick={(ev) => { ev.stopPropagation(); router.push(`/execution/runs/${e.execution_id}`); }}
                    >
                      {e.execution_id.slice(0, 10)}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </SurfaceSection>
        ) : null}

      </div>

      {/* Event Details Drawer */}
      <RightSideDrawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={
          <>
            <Activity className="h-4 w-4 text-gray-400" />
            Event Details
            {selected && <EventTypeChip type={selected.event_type} />}
          </>
        }
        subtitle={selected ? new Date(selected.timestamp).toISOString() : undefined}
      >
        {selected && (
          <>
            {/* Event Metadata */}
            <DrawerSection title="Event Metadata">
              <KeyValueGrid items={[
                { label: 'event_id',     value: selected.id,            copyable: true, copyValue: selected.id },
                { label: 'timestamp',    value: new Date(selected.timestamp).toISOString() },
                { label: 'event_type',   value: <EventTypeChip type={selected.event_type} /> },
                { label: 'severity',     value: <SeverityBadge severity={selected.severity} /> },
                ...(selected.execution_id ? [{
                  label: 'execution_id',
                  value: selected.execution_id,
                  copyable: true,
                  copyValue: selected.execution_id,
                  href: `/execution/runs/${selected.execution_id}`,
                }] : []),
                ...(selected.agent_id ? [{ label: 'agent_id',  value: selected.agent_id,  copyable: true, copyValue: selected.agent_id }] : []),
                ...(selected.device_id ? [{ label: 'runtime_id', value: selected.device_id, copyable: true, copyValue: selected.device_id }] : []),
              ]} />
            </DrawerSection>

            <Separator />

            {/* Message */}
            <DrawerSection title="Message">
              <div className="px-3 py-2.5 rounded border border-gray-200 bg-gray-50">
                <p className="text-xs text-gray-700 break-words leading-5">{selected.message}</p>
              </div>
            </DrawerSection>

            {/* Event Payload */}
            {Object.keys(selected.payload).length > 0 && (
              <>
                <Separator />
                <DrawerSection title="Event Payload">
                  <KeyValueGrid items={[
                    ...(selected.payload.policy_rule  != null ? [{ label: 'policy_rule',  value: String(selected.payload.policy_rule) }]  : []),
                    ...(selected.payload.action_taken != null ? [{ label: 'action_taken', value: String(selected.payload.action_taken) }] : []),
                    ...(selected.payload.latency_ms   != null ? [{ label: 'latency_ms',   value: `${selected.payload.latency_ms}ms` }]    : []),
                    ...(selected.payload.provider     != null ? [{ label: 'provider',     value: String(selected.payload.provider) }]     : []),
                    ...(selected.payload.model        != null ? [{ label: 'model',        value: String(selected.payload.model) }]        : []),
                    ...(selected.payload.tokens       != null ? [{ label: 'tokens',       value: String(selected.payload.tokens) }]       : []),
                  ]} />
                </DrawerSection>
              </>
            )}

            {/* Linked Entities */}
            {(selected.execution_id || selected.agent_id || selected.device_id) && (
              <>
                <Separator />
                <DrawerSection title="Linked Entities">
                  <div className="space-y-2">
                    {selected.execution_id && (
                      <a
                        href={`/execution/runs/${selected.execution_id}`}
                        className="flex items-center gap-2 px-3 py-2 rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
                      >
                        <Link2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-blue-600 group-hover:text-blue-700 truncate">{selected.execution_id}</span>
                        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">Execution →</span>
                      </a>
                    )}
                    {selected.agent_id && (
                      <a
                        href={`/fleet/agents?agent=${selected.agent_id}`}
                        className="flex items-center gap-2 px-3 py-2 rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
                      >
                        <Link2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-teal-600 group-hover:text-teal-700 truncate">{selected.agent_id}</span>
                        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">Agent →</span>
                      </a>
                    )}
                    {selected.device_id && (
                      <a
                        href={`/infrastructure/runtimes?device=${selected.device_id}`}
                        className="flex items-center gap-2 px-3 py-2 rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
                      >
                        <Link2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-violet-600 group-hover:text-violet-700 truncate">{selected.device_id}</span>
                        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">Runtime →</span>
                      </a>
                    )}
                    {selected.event_type === 'ReceiptSigned' && selected.execution_id && (
                      <a
                        href={`/proof/receipts?receipt=${selected.execution_id}`}
                        className="flex items-center gap-2 px-3 py-2 rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
                      >
                        <Link2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-green-600 group-hover:text-green-700 truncate">receipt for {selected.execution_id.slice(0, 14)}…</span>
                        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">Receipt →</span>
                      </a>
                    )}
                    {selected.event_type === 'PolicyViolation' && selected.execution_id && (
                      <a
                        href={`/proof/violations?violation=${selected.execution_id}`}
                        className="flex items-center gap-2 px-3 py-2 rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
                      >
                        <Link2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-red-600 group-hover:text-red-700 truncate">violation record</span>
                        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">Violation →</span>
                      </a>
                    )}
                  </div>
                </DrawerSection>
              </>
            )}

            <Separator />

            {/* Raw JSON */}
            <DrawerSection title="Raw Event JSON">
              <JSONViewer data={selected} filename={`event-${selected.id}`} />
            </DrawerSection>
          </>
        )}
      </RightSideDrawer>
    </DashboardLayout>
  );
}

export default function HistoryLogsPage() {
  return (
    <Suspense>
      <LogsContent />
    </Suspense>
  );
}
