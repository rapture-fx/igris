'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { downloadJSON, getRelativeTime, cn } from '@/utils/helpers';
import { KeyValueGrid } from '@/components/proof/KeyValueGrid';
import { JSONViewer } from '@/components/proof/JSONViewer';
import { RightSideDrawer, DrawerSection } from '@/components/proof/RightSideDrawer';
import {
  Search, RefreshCw, Download, Copy, Check, X,
  Radio, Activity, Link2,
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

// ─── Mock Data ──────────────────────────────────────────────────────────────────

const _now = Date.now();

const MOCK_EVENTS: RuntimeEvent[] = [
  {
    id: 'evt_0001', timestamp: new Date(_now -  1 * 60_000).toISOString(),
    event_type: 'ExecutionStarted', severity: 'info',
    execution_id: 'exec_4a7b8c9d0e1f', agent_id: 'agent_0x1a2b3c', device_id: 'dev_9f3a2c1b',
    message: 'Execution started with policy v2.4.1',
    payload: { latency_ms: 12, model: 'claude-sonnet-4-6', provider: 'anthropic' },
  },
  {
    id: 'evt_0002', timestamp: new Date(_now -  2 * 60_000).toISOString(),
    event_type: 'ProviderSelected', severity: 'info',
    execution_id: 'exec_4a7b8c9d0e1f', agent_id: 'agent_0x1a2b3c', device_id: 'dev_9f3a2c1b',
    message: 'Provider selected: anthropic/claude-sonnet-4-6 (latency 34ms)',
    payload: { provider: 'anthropic', model: 'claude-sonnet-4-6', latency_ms: 34 },
  },
  {
    id: 'evt_0003', timestamp: new Date(_now -  3 * 60_000).toISOString(),
    event_type: 'ToolCall', severity: 'info',
    execution_id: 'exec_4a7b8c9d0e1f', agent_id: 'agent_0x1a2b3c', device_id: 'dev_9f3a2c1b',
    message: 'Tool call: read_file("/etc/config.json")',
    payload: { latency_ms: 8, tokens: 142 },
  },
  {
    id: 'evt_0004', timestamp: new Date(_now -  4 * 60_000).toISOString(),
    event_type: 'PolicyViolation', severity: 'critical',
    execution_id: 'exec_b1c2d3e4f5a6', agent_id: 'agent_0x4d5e6f', device_id: 'dev_a1b2c3d4',
    message: 'Policy violation: capability_denied — shell:exec not permitted',
    payload: { policy_rule: 'allow_shell_exec', action_taken: 'terminated', latency_ms: 2 },
  },
  {
    id: 'evt_0005', timestamp: new Date(_now -  5 * 60_000).toISOString(),
    event_type: 'ExecutionTerminated', severity: 'error',
    execution_id: 'exec_b1c2d3e4f5a6', agent_id: 'agent_0x4d5e6f', device_id: 'dev_a1b2c3d4',
    message: 'Execution terminated by supervisor after policy violation',
    payload: { action_taken: 'terminated', latency_ms: 5 },
  },
  {
    id: 'evt_0006', timestamp: new Date(_now -  6 * 60_000).toISOString(),
    event_type: 'ReceiptSigned', severity: 'info',
    execution_id: 'exec_4a7b8c9d0e1f', agent_id: 'agent_0x1a2b3c', device_id: 'dev_9f3a2c1b',
    message: 'Execution receipt signed — hash chain intact',
    payload: { latency_ms: 3 },
  },
  {
    id: 'evt_0007', timestamp: new Date(_now -  8 * 60_000).toISOString(),
    event_type: 'DeviceConnected', severity: 'info',
    execution_id: '', agent_id: '', device_id: 'dev_f7e8d9c0',
    message: 'Device dev_f7e8d9c0 connected to control plane',
    payload: { latency_ms: 22 },
  },
  {
    id: 'evt_0008', timestamp: new Date(_now - 11 * 60_000).toISOString(),
    event_type: 'ExecutionStarted', severity: 'info',
    execution_id: 'exec_c3d4e5f6a7b8', agent_id: 'agent_0x1a2b3c', device_id: 'dev_f7e8d9c0',
    message: 'Execution started with policy v2.4.1',
    payload: { latency_ms: 14, model: 'gpt-4o', provider: 'openai' },
  },
  {
    id: 'evt_0009', timestamp: new Date(_now - 12 * 60_000).toISOString(),
    event_type: 'ToolCall', severity: 'warning',
    execution_id: 'exec_c3d4e5f6a7b8', agent_id: 'agent_0x1a2b3c', device_id: 'dev_f7e8d9c0',
    message: 'Tool call exceeded tick budget: 480ms (limit 500ms)',
    payload: { latency_ms: 480, tokens: 380 },
  },
  {
    id: 'evt_0010', timestamp: new Date(_now - 15 * 60_000).toISOString(),
    event_type: 'PolicyViolation', severity: 'error',
    execution_id: 'exec_c3d4e5f6a7b8', agent_id: 'agent_0x1a2b3c', device_id: 'dev_f7e8d9c0',
    message: 'Memory quota exceeded: 420MB observed, limit 384MB',
    payload: { policy_rule: 'max_memory_mb', action_taken: 'throttled', latency_ms: 3 },
  },
  {
    id: 'evt_0011', timestamp: new Date(_now - 18 * 60_000).toISOString(),
    event_type: 'ReceiptSigned', severity: 'info',
    execution_id: 'exec_c3d4e5f6a7b8', agent_id: 'agent_0x1a2b3c', device_id: 'dev_f7e8d9c0',
    message: 'Execution receipt signed with warning flags',
    payload: { latency_ms: 4 },
  },
  {
    id: 'evt_0012', timestamp: new Date(_now - 22 * 60_000).toISOString(),
    event_type: 'DeviceConnected', severity: 'info',
    execution_id: '', agent_id: '', device_id: 'dev_c8d9e0f1',
    message: 'Device dev_c8d9e0f1 connected to control plane',
    payload: { latency_ms: 18 },
  },
  {
    id: 'evt_0013', timestamp: new Date(_now - 25 * 60_000).toISOString(),
    event_type: 'ExecutionStarted', severity: 'info',
    execution_id: 'exec_d5e6f7a8b9c0', agent_id: 'agent_0x7a8b9c', device_id: 'dev_c8d9e0f1',
    message: 'Execution started with policy v2.3.9',
    payload: { latency_ms: 11, model: 'claude-haiku-4-5', provider: 'anthropic' },
  },
  {
    id: 'evt_0014', timestamp: new Date(_now - 26 * 60_000).toISOString(),
    event_type: 'ProviderSelected', severity: 'info',
    execution_id: 'exec_d5e6f7a8b9c0', agent_id: 'agent_0x7a8b9c', device_id: 'dev_c8d9e0f1',
    message: 'Provider selected: anthropic/claude-haiku-4-5 (latency 28ms)',
    payload: { provider: 'anthropic', model: 'claude-haiku-4-5', latency_ms: 28 },
  },
  {
    id: 'evt_0015', timestamp: new Date(_now - 28 * 60_000).toISOString(),
    event_type: 'ReceiptSigned', severity: 'info',
    execution_id: 'exec_d5e6f7a8b9c0', agent_id: 'agent_0x7a8b9c', device_id: 'dev_c8d9e0f1',
    message: 'Execution receipt signed — hash chain intact',
    payload: { latency_ms: 3 },
  },
  {
    id: 'evt_0016', timestamp: new Date(_now - 35 * 60_000).toISOString(),
    event_type: 'DeviceDisconnected', severity: 'warning',
    execution_id: '', agent_id: '', device_id: 'dev_a1b2c3d4',
    message: 'Device dev_a1b2c3d4 disconnected (timeout)',
    payload: { latency_ms: 0 },
  },
  {
    id: 'evt_0017', timestamp: new Date(_now - 42 * 60_000).toISOString(),
    event_type: 'ExecutionStarted', severity: 'info',
    execution_id: 'exec_e7f8a9b0c1d2', agent_id: 'agent_0xd1e2f3', device_id: 'dev_9f3a2c1b',
    message: 'Execution started with policy v2.4.1',
    payload: { latency_ms: 16, model: 'deepseek-chat', provider: 'deepseek' },
  },
  {
    id: 'evt_0018', timestamp: new Date(_now - 44 * 60_000).toISOString(),
    event_type: 'PolicyViolation', severity: 'critical',
    execution_id: 'exec_e7f8a9b0c1d2', agent_id: 'agent_0xd1e2f3', device_id: 'dev_9f3a2c1b',
    message: 'Policy violation: network egress blocked — external host not whitelisted',
    payload: { policy_rule: 'allow_network_egress', action_taken: 'terminated', latency_ms: 1 },
  },
  {
    id: 'evt_0019', timestamp: new Date(_now - 45 * 60_000).toISOString(),
    event_type: 'ExecutionTerminated', severity: 'critical',
    execution_id: 'exec_e7f8a9b0c1d2', agent_id: 'agent_0xd1e2f3', device_id: 'dev_9f3a2c1b',
    message: 'Execution killed by containment enforcer (critical violation)',
    payload: { action_taken: 'killed', latency_ms: 2 },
  },
  {
    id: 'evt_0020', timestamp: new Date(_now - 52 * 60_000).toISOString(),
    event_type: 'ReceiptSigned', severity: 'info',
    execution_id: 'exec_e7f8a9b0c1d2', agent_id: 'agent_0xd1e2f3', device_id: 'dev_9f3a2c1b',
    message: 'Execution receipt signed with critical flags',
    payload: { latency_ms: 5 },
  },
];

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
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border rounded ${SEV_STYLES[severity]}`}>
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
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium rounded ${TYPE_STYLES[type]}`}>
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
      <div className="flex items-center justify-center py-16 text-xs text-gray-400">
        No events for the selected filters.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {grouped.map(({ execId, events: evts, firstTs, lastTs, hasCritical, hasError }) => (
        <Card key={execId} className="border border-gray-200 shadow-none overflow-hidden">
          <CardHeader className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Activity className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                {execId === '__device__' ? (
                  <span className="text-xs text-gray-500 font-medium">Device events</span>
                ) : (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-mono text-blue-600 truncate">{execId}</span>
                    <CopyBtn text={execId} />
                  </div>
                )}
                {(hasCritical || hasError) && (
                  <SeverityBadge severity={hasCritical ? 'critical' : 'error'} />
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 text-[10px] text-gray-400">
                <span>{evts.length} events</span>
                {firstTs && lastTs && firstTs !== lastTs && (
                  <span>{getRelativeTime(firstTs)} → {getRelativeTime(lastTs)}</span>
                )}
              </div>
            </div>
          </CardHeader>
          <div className="divide-y divide-gray-100">
            {evts.map((e) => (
              <div key={e.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className="text-[10px] text-gray-400 tabular-nums whitespace-nowrap pt-0.5 w-[72px] flex-shrink-0">
                  {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <EventTypeChip type={e.event_type} />
                <span className="text-xs text-gray-700 flex-1 min-w-0 break-words">{e.message}</span>
                {e.payload.latency_ms != null && (
                  <span className="text-[10px] text-gray-400 tabular-nums flex-shrink-0 pt-0.5">
                    {e.payload.latency_ms}ms
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
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
  const [viewMode,   setViewMode]   = useState<'event_stream' | 'execution_timeline'>('event_stream');
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('event'));

  // Fetch
  const { data: allEvents = [], isLoading, refetch, dataUpdatedAt } = useQuery<RuntimeEvent[]>({
    queryKey: ['history-events', timeRange, agentFilter, deviceFilter, typeFilter, severityFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ range: timeRange, limit: '500' });
      if (agentFilter   !== 'all') p.set('agent_id',   agentFilter);
      if (deviceFilter  !== 'all') p.set('device_id',  deviceFilter);
      if (typeFilter    !== 'all') p.set('event_type', typeFilter);
      if (severityFilter !== 'all') p.set('severity',  severityFilter);
      return await api.get<RuntimeEvent[]>(`/v1/history/events?${p}`);
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
    deviceFilter  !== 'all' && { key: 'device',  label: `device: ${deviceFilter}`,  clear: () => setDeviceFilter('all') },
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
    <DashboardLayout>
      <div className="space-y-4">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Runtime Events</h1>
            <p className="text-xs text-gray-500 mt-0.5">Structured event stream produced by the runtime and control plane.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-md bg-white">
              <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', liveMode ? 'bg-green-500 animate-pulse' : 'bg-gray-300')} />
              <span className="text-xs text-gray-600">Live</span>
              <Switch checked={liveMode} onCheckedChange={setLiveMode} className="h-4 w-8 scale-75" />
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" disabled={events.length === 0}
              onClick={() => downloadJSON(events, `events-${timeRange}`)}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </div>

        {/* ── Filter bar ────────────────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardContent className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 whitespace-nowrap">Agent</span>
                <Select value={agentFilter} onValueChange={setAgentFilter}>
                  <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="all agents" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">all agents</SelectItem>
                    {uniqueAgents.map((a) => <SelectItem key={a} value={a} className="text-xs font-mono">{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 whitespace-nowrap">Device</span>
                <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                  <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="all devices" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">all devices</SelectItem>
                    {uniqueDevices.map((d) => <SelectItem key={d} value={d} className="text-xs font-mono">{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 whitespace-nowrap">Exec ID</span>
                <Input placeholder="exec_..." className="h-7 w-36 text-xs"
                  value={execFilter} onChange={(e) => setExecFilter(e.target.value)} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 whitespace-nowrap">Type</span>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder="all types" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">all types</SelectItem>
                    {EVENT_TYPES.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 whitespace-nowrap">Severity</span>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="h-7 w-28 text-xs"><SelectValue placeholder="all" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">all</SelectItem>
                    {(['info', 'warning', 'error', 'critical'] as Severity[]).map((s) =>
                      <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 whitespace-nowrap">Range</span>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
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
              </div>
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                <Input placeholder="search messages..." className="h-7 text-xs pl-6"
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
          </CardContent>
        </Card>

        {/* ── Tabs + stats ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
            <TabsList className="h-8 p-0.5 bg-gray-100 gap-0">
              <TabsTrigger value="event_stream" className="h-7 px-3 text-xs data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:border-0 data-[state=active]:rounded-md">
                Event Stream
              </TabsTrigger>
              <TabsTrigger value="execution_timeline" className="h-7 px-3 text-xs data-[state=active]:bg-white data-[state=active]:shadow-none data-[state=active]:border-0 data-[state=active]:rounded-md">
                Execution Timeline
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-400 tabular-nums">
              {isLoading ? '…' : events.length}{allEvents.length !== events.length && ` / ${allEvents.length}`} events
            </span>
            {counts.critical > 0 && <span className="px-1.5 py-0.5 rounded border text-[10px] font-medium bg-red-50 text-red-700 border-red-200">{counts.critical} critical</span>}
            {counts.error > 0 && <span className="px-1.5 py-0.5 rounded border text-[10px] font-medium bg-orange-50 text-orange-700 border-orange-200">{counts.error} error</span>}
            {counts.warning > 0 && <span className="px-1.5 py-0.5 rounded border text-[10px] font-medium bg-yellow-50 text-yellow-700 border-yellow-200">{counts.warning} warning</span>}
            {liveMode && <span className="flex items-center gap-1 text-green-600"><Radio className="h-2.5 w-2.5" /> live</span>}
            {dataUpdatedAt > 0 && <span className="text-gray-400">{new Date(dataUpdatedAt).toLocaleTimeString()}</span>}
          </div>
        </div>

        {/* ── Execution Timeline ────────────────────────────────────────────── */}
        {viewMode === 'execution_timeline' ? (
          <div
            className="overflow-y-auto"
            style={{ height: 'calc(100vh - 260px)', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          >
            <div className="space-y-3 pb-6">
              <ExecutionTimeline events={events} />
            </div>
          </div>
        ) : (

        /* ── Event Stream ────────────────────────────────────────────────── */
        <Card className="border border-gray-200 shadow-none overflow-hidden">
          <div
            className="overflow-y-auto relative"
            style={{ height: 'calc(100vh - 260px)', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          >
          <Table className="w-full table-fixed">
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[88px]  text-[10px] font-medium text-gray-500 uppercase tracking-wide h-9 px-3 bg-gray-50 border-b border-gray-200">Timestamp</TableHead>
                <TableHead className="w-[158px] text-[10px] font-medium text-gray-500 uppercase tracking-wide h-9 px-3 bg-gray-50 border-b border-gray-200">Event Type</TableHead>
                <TableHead className="w-[138px] text-[10px] font-medium text-gray-500 uppercase tracking-wide h-9 px-3 bg-gray-50 border-b border-gray-200">Execution ID</TableHead>
                <TableHead className="w-[108px] text-[10px] font-medium text-gray-500 uppercase tracking-wide h-9 px-3 bg-gray-50 border-b border-gray-200">Agent</TableHead>
                <TableHead className="w-[108px] text-[10px] font-medium text-gray-500 uppercase tracking-wide h-9 px-3 bg-gray-50 border-b border-gray-200">Device</TableHead>
                <TableHead className="w-[78px]  text-[10px] font-medium text-gray-500 uppercase tracking-wide h-9 px-3 bg-gray-50 border-b border-gray-200">Severity</TableHead>
                <TableHead className="          text-[10px] font-medium text-gray-500 uppercase tracking-wide h-9 px-3 bg-gray-50 border-b border-gray-200">Message</TableHead>
                <TableHead className="w-[58px]  text-[10px] font-medium text-gray-500 uppercase tracking-wide h-9 px-3 bg-gray-50 border-b border-gray-200"></TableHead>
              </TableRow>
            </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 10 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 8 }).map((_, j) => (
                            <TableCell key={j} className="px-3 py-2">
                              <div className="h-3 rounded bg-gray-100 animate-pulse" style={{ width: `${(i * 37 + j * 19) % 80 + 32}px` }} />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : events.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-16 text-center text-xs text-gray-400">
                          {activeFilters.length > 0
                            ? <span>No events match the current filters. <button onClick={clearAll} className="underline underline-offset-2 hover:text-gray-700">Clear all</button></span>
                            : 'No events for the selected time range.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      events.map((e) => (
                        <TableRow
                          key={e.id}
                          className={cn(
                            'cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors',
                            selectedId === e.id ? 'bg-blue-50/50' : '',
                          )}
                          onClick={() => setSelectedId(e.id === selectedId ? null : e.id)}
                        >
                          {/* Timestamp */}
                          <TableCell
                            className="px-3 py-2 text-[10px] text-gray-400 tabular-nums whitespace-nowrap font-mono"
                            title={e.timestamp}
                          >
                            {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </TableCell>

                          {/* Event type */}
                          <TableCell className="px-3 py-2 whitespace-nowrap">
                            <EventTypeChip type={e.event_type} />
                          </TableCell>

                          {/* Execution ID */}
                          <TableCell className="px-3 py-2">
                            {e.execution_id ? (
                              <div className="flex items-center gap-1 group">
                                <span
                                  className="text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2 font-mono"
                                  title={e.execution_id}
                                  onClick={(ev) => { ev.stopPropagation(); router.push(`/execution/runs/${e.execution_id}`); }}
                                >
                                  {e.execution_id.slice(0, 14)}…
                                </span>
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <CopyBtn text={e.execution_id} />
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-200 text-xs">—</span>
                            )}
                          </TableCell>

                          {/* Agent */}
                          <TableCell
                            className="px-3 py-2 text-xs text-teal-600 font-mono cursor-pointer hover:underline"
                            title={e.agent_id || undefined}
                            onClick={(ev) => { ev.stopPropagation(); if (e.agent_id) setAgentFilter(e.agent_id); }}
                          >
                            {e.agent_id ? `${e.agent_id.slice(0, 12)}` : <span className="text-gray-200">—</span>}
                          </TableCell>

                          {/* Device */}
                          <TableCell
                            className="px-3 py-2 text-xs text-violet-600 font-mono cursor-pointer hover:underline"
                            title={e.device_id || undefined}
                            onClick={(ev) => { ev.stopPropagation(); if (e.device_id) setDeviceFilter(e.device_id); }}
                          >
                            {e.device_id ? `${e.device_id.slice(0, 12)}` : <span className="text-gray-200">—</span>}
                          </TableCell>

                          {/* Severity */}
                          <TableCell className="px-3 py-2">
                            <SeverityBadge severity={e.severity} />
                          </TableCell>

                          {/* Message */}
                          <TableCell className="px-3 py-2 text-xs text-gray-700 truncate" title={e.message}>
                            {q ? highlightMatch(e.message, q) : e.message}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="px-3 py-2" onClick={(ev) => ev.stopPropagation()}>
                            <button
                              className="text-[10px] text-gray-400 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded px-1.5 py-0.5 transition-colors whitespace-nowrap"
                              onClick={() => setSelectedId(e.id === selectedId ? null : e.id)}
                            >
                              View
                            </button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
          </TableBody>
          </Table>
          </div>
        </Card>
        )}

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
                ...(selected.device_id ? [{ label: 'device_id', value: selected.device_id, copyable: true, copyValue: selected.device_id }] : []),
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
                        <span className="text-xs text-blue-600 group-hover:text-blue-700 font-mono truncate">{selected.execution_id}</span>
                        <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">Execution →</span>
                      </a>
                    )}
                    {selected.agent_id && (
                      <a
                        href={`/fleet/agents?agent=${selected.agent_id}`}
                        className="flex items-center gap-2 px-3 py-2 rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
                      >
                        <Link2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-teal-600 group-hover:text-teal-700 font-mono truncate">{selected.agent_id}</span>
                        <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">Agent →</span>
                      </a>
                    )}
                    {selected.device_id && (
                      <a
                        href={`/fleet/devices?device=${selected.device_id}`}
                        className="flex items-center gap-2 px-3 py-2 rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
                      >
                        <Link2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-violet-600 group-hover:text-violet-700 font-mono truncate">{selected.device_id}</span>
                        <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">Device →</span>
                      </a>
                    )}
                    {selected.event_type === 'ReceiptSigned' && selected.execution_id && (
                      <a
                        href={`/proof/receipts?receipt=${selected.execution_id}`}
                        className="flex items-center gap-2 px-3 py-2 rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
                      >
                        <Link2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-green-600 group-hover:text-green-700 font-mono truncate">receipt for {selected.execution_id.slice(0, 14)}…</span>
                        <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">Receipt →</span>
                      </a>
                    )}
                    {selected.event_type === 'PolicyViolation' && selected.execution_id && (
                      <a
                        href={`/proof/violations?violation=${selected.execution_id}`}
                        className="flex items-center gap-2 px-3 py-2 rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors group"
                      >
                        <Link2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-xs text-red-600 group-hover:text-red-700 font-mono truncate">violation record</span>
                        <span className="text-[10px] text-gray-400 ml-auto flex-shrink-0">Violation →</span>
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
