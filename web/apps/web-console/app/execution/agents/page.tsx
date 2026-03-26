'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetBody,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/apiClient';
import { toast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import { useRouter } from 'next/navigation';
import {
  Brain,
  Moon,
  Shield,
  Activity,
  Search,
  RefreshCw,
  History,
  Cpu,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  GitBranch,
  Loader2,
  Radio,
} from 'lucide-react';
import {
  ExecutionStatusBadge,
  ViolationBadge,
  KeyValueGrid,
  JSONViewer,
  LifecycleTimeline,
  CopyButton,
} from '@/components/execution/shared';
import { useTraces } from '@/hooks/useTraces';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LifecycleEntry {
  state: string;
  timestamp: string;
  note?: string;
}

interface RecentExecution {
  id: string;
  status: string;
  started_at: string;
  duration_ms?: number;
}

interface ViolationEntry {
  id: string;
  type: string;
  timestamp: string;
  severity?: string;
}

interface Agent {
  id: string;
  namespace: string;
  state: string;
  last_run_at?: string;
  device_id?: string;
  violation_count: number;
  capabilities: string[] | Record<string, unknown>;
  lifecycle_history?: LifecycleEntry[];
  recent_executions?: RecentExecution[];
  violations?: ViolationEntry[];
  policy_bounds?: Record<string, unknown>;
  execution_bounds?: Record<string, unknown>;
  current_goal?: string;
  envelope_summary?: string;
  last_trace_at?: string;
  shadow_mode?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(2)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${m}m ${rem}s`;
}

function resolveCapabilities(caps: string[] | Record<string, unknown>): Record<string, string> {
  if (Array.isArray(caps)) {
    return Object.fromEntries(caps.map((c) => [c, 'enabled']));
  }
  return Object.fromEntries(
    Object.entries(caps).map(([k, v]) => [k, String(v)]),
  );
}

// ─── BT Types ─────────────────────────────────────────────────────────────────

interface BTNode {
  id: string;
  name: string;
  type: 'selector' | 'sequence' | 'action' | 'condition';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'violation';
  depth: number;
  duration_ms?: number;
  execution_id?: string;
  timestamp?: string;
  llm_proposal?: string;
}

interface BTState {
  agent_id: string;
  nodes: BTNode[];
  last_updated: string;
}

// ─── BT Execution View ────────────────────────────────────────────────────────

const BT_STATUS_STYLES: Record<string, string> = {
  completed: 'bg-green-50 text-green-700 border-green-200',
  running:   'bg-blue-50 text-blue-700 border-blue-200 animate-pulse',
  failed:    'bg-red-50 text-red-700 border-red-200',
  violation: 'bg-orange-50 text-orange-700 border-orange-200',
  pending:   'bg-gray-50 text-gray-500 border-gray-200',
};

const BT_TYPE_ICON: Record<string, string> = {
  selector: '◇',
  sequence: '→',
  action:   '▶',
  condition: '?',
};

function BTExecutionView({ agentId }: { agentId: string }) {
  const { data, isLoading, dataUpdatedAt } = useQuery<BTState>({
    queryKey: ['bt-state', agentId],
    queryFn: async () => {
      try {
        return await api.get<BTState>(`/v1/agents/${agentId}/bt-state`);
      } catch {
        return { agent_id: agentId, nodes: [], last_updated: '' };
      }
    },
    refetchInterval: 2_000,
    retry: false,
  });

  const isStale = dataUpdatedAt > 0 && Date.now() - dataUpdatedAt > 10_000;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading execution tree...
      </div>
    );
  }

  const nodes = data?.nodes ?? [];
  if (nodes.length === 0) {
    return <p className="text-xs text-gray-400">No execution data available.</p>;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        {isStale ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
            Stale
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
            Live
          </span>
        )}
      </div>
      <div className="space-y-0.5">
      {nodes.map((node) => (
        <div
          key={node.id}
          className="flex items-start gap-2"
          style={{ paddingLeft: `${node.depth * 16}px` }}
        >
          {/* Connector line for children */}
          {node.depth > 0 && (
            <span className="mt-1 flex-shrink-0 text-gray-300 text-[10px] font-mono">└</span>
          )}
          <div className="flex-1 flex items-center justify-between gap-2 py-1 px-2 rounded-md hover:bg-gray-50 group">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[10px] text-gray-400 font-mono flex-shrink-0">
                {BT_TYPE_ICON[node.type] ?? '•'}
              </span>
              <span className="text-xs text-gray-700 font-medium truncate">{node.name}</span>
              {node.execution_id && (
                <span className="text-[10px] text-gray-400 font-mono truncate hidden group-hover:inline">
                  {node.execution_id.slice(0, 8)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {node.duration_ms != null && node.duration_ms > 0 && (
                <span className="text-[10px] text-gray-400 tabular-nums">
                  {node.duration_ms < 1000 ? `${node.duration_ms}ms` : `${(node.duration_ms / 1000).toFixed(1)}s`}
                </span>
              )}
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                  BT_STATUS_STYLES[node.status] ?? BT_STATUS_STYLES.pending
                }`}
              >
                {node.status}
              </span>
            </div>
          </div>
        </div>
      ))}
        {data?.last_updated && (
          <p className="text-[10px] text-gray-400 pt-1 pl-1">
            Last updated {getRelativeTime(data.last_updated)}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATE_OPTIONS = ['all', 'RUNNING', 'IDLE', 'SAFE_IDLE', 'RECOVERING', 'ERROR'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function MiniExecutionsTable({ executions }: { executions: RecentExecution[] }) {
  if (executions.length === 0) {
    return <p className="text-xs text-gray-400">No recent executions.</p>;
  }
  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-3 py-2 font-medium text-gray-500">Execution ID</th>
            <th className="text-left px-3 py-2 font-medium text-gray-500">Status</th>
            <th className="text-left px-3 py-2 font-medium text-gray-500">Started</th>
            <th className="text-left px-3 py-2 font-medium text-gray-500">Duration</th>
          </tr>
        </thead>
        <tbody>
          {executions.map((ex, i) => (
            <tr key={ex.id} className={i < executions.length - 1 ? 'border-b border-gray-100' : ''}>
              <td className="px-3 py-2">
                <div className="flex items-center gap-1">
                  <span className="text-gray-700">{truncateText(ex.id, 14)}</span>
                  <CopyButton value={ex.id} />
                </div>
              </td>
              <td className="px-3 py-2">
                <ExecutionStatusBadge status={ex.status} />
              </td>
              <td className="px-3 py-2 text-gray-500 tabular-nums">
                {getRelativeTime(ex.started_at)}
              </td>
              <td className="px-3 py-2 text-gray-500 tabular-nums">
                {ex.duration_ms != null ? formatDurationMs(ex.duration_ms) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniViolationsTable({ violations }: { violations: ViolationEntry[] }) {
  if (violations.length === 0) {
    return <p className="text-xs text-gray-400">No violation history.</p>;
  }
  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-3 py-2 font-medium text-gray-500">Violation ID</th>
            <th className="text-left px-3 py-2 font-medium text-gray-500">Type</th>
            <th className="text-left px-3 py-2 font-medium text-gray-500">Severity</th>
            <th className="text-left px-3 py-2 font-medium text-gray-500">When</th>
          </tr>
        </thead>
        <tbody>
          {violations.map((v, i) => (
            <tr key={v.id} className={i < violations.length - 1 ? 'border-b border-gray-100' : ''}>
              <td className="px-3 py-2">
                <span className="text-gray-700">{truncateText(v.id, 14)}</span>
              </td>
              <td className="px-3 py-2 text-gray-700">{v.type}</td>
              <td className="px-3 py-2">
                {v.severity ? (
                  <ExecutionStatusBadge status={v.severity} />
                ) : (
                  <span className="text-gray-300">—</span>
                )}
              </td>
              <td className="px-3 py-2 text-gray-500 tabular-nums">
                {getRelativeTime(v.timestamp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExecutionAgentsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [selected, setSelected] = useState<Agent | null>(null);

  const { data: agents = [], isLoading, refetch } = useQuery<Agent[]>({
    queryKey: ['execution-agents'],
    queryFn: async () => {
      try {
        return await api.get('/v1/execution/agents');
      } catch {
        return [] as Agent[];
      }
    },
    retry: false,
  });

  const { data: traces = [] } = useTraces();

  const shadowMutation = useMutation({
    mutationFn: ({ agentId, enabled }: { agentId: string; enabled: boolean }) =>
      api.patch(`/v1/agents/${agentId}`, { shadow_mode: enabled }),
    onSuccess: (_, { enabled }) => {
      qc.invalidateQueries({ queryKey: ['execution-agents'] });
      toast({
        title: enabled ? 'Shadow mode enabled' : 'Shadow mode disabled',
        description: enabled
          ? 'Agent will observe without enforcement.'
          : 'Agent will enforce policy normally.',
      });
    },
    onError: () => {
      toast({ title: 'Update failed', description: 'Could not update shadow mode.', variant: 'destructive' });
    },
  });

  // Keyboard: Escape closes drawer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return agents.filter((a) => {
      const matchSearch =
        !q ||
        a.id.toLowerCase().includes(q) ||
        a.namespace?.toLowerCase().includes(q);
      const matchState =
        stateFilter === 'all' || a.state === stateFilter;
      return matchSearch && matchState;
    });
  }, [agents, search, stateFilter]);

  const counts = useMemo(() => {
    const active = agents.filter((a) => a.state === 'RUNNING' || a.state === 'ACTIVE').length;
    const recovering = agents.filter((a) => a.state === 'RECOVERING').length;
    const violationsToday = agents.reduce((sum, a) => sum + (a.violation_count || 0), 0);
    const allExecs = agents.flatMap((a) => a.recent_executions ?? []);
    const traceSuccessPct = allExecs.length > 0
      ? Math.round((allExecs.filter((e) => e.status === 'COMPLETED').length / allExecs.length) * 100)
      : null;
    return { active, recovering, violationsToday, traceSuccessPct };
  }, [agents]);

  const STAT_CARDS = [
    {
      label: 'Active',
      value: counts.active,
      icon: Brain,
      iconColor: 'text-green-500',
      valueColor: counts.active > 0 ? 'text-green-700' : 'text-gray-900',
      isString: false,
    },
    {
      label: 'Violations Today',
      value: counts.violationsToday,
      icon: AlertTriangle,
      iconColor: counts.violationsToday > 0 ? 'text-orange-500' : 'text-gray-400',
      valueColor: counts.violationsToday > 0 ? 'text-orange-700' : 'text-gray-900',
      isString: false,
    },
    {
      label: 'Trace Success',
      value: counts.traceSuccessPct !== null ? `${counts.traceSuccessPct}%` : '—',
      icon: CheckCircle2,
      iconColor: 'text-blue-500',
      valueColor: 'text-gray-900',
      isString: true,
    },
    {
      label: 'Recovering',
      value: counts.recovering,
      icon: Activity,
      iconColor: counts.recovering > 0 ? 'text-yellow-500' : 'text-gray-400',
      valueColor: counts.recovering > 0 ? 'text-yellow-700' : 'text-gray-900',
      isString: false,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Agents</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Runtime lifecycle and execution state.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="agent_id · namespace"
                className="pl-8 h-8 text-xs w-52"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {STATE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {s === 'all' ? 'All states' : s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Summary Cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_CARDS.map((c) => (
            <Card key={c.label} className="border border-gray-200 shadow-none">
              <CardHeader className="px-4 pt-3 pb-1">
                <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <c.icon className={`h-3.5 w-3.5 ${c.iconColor}`} />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                {isLoading ? (
                  <Skeleton className="h-5 w-10 mt-0.5" />
                ) : c.isString ? (
                  <span className={`text-sm font-semibold tabular-nums ${c.valueColor}`}>
                    {c.value}
                  </span>
                ) : (
                  <span className={`text-xl font-semibold tabular-nums ${c.valueColor}`}>
                    {c.value}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-200">
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  Agent ID
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  Namespace
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  Goal / Envelope
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  State
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  Last Trace
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  Violations
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  Device
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  Mode
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  BT Live
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-gray-100">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j} className="px-3 py-2.5">
                        <Skeleton className="h-3.5 w-16" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-gray-400 text-xs py-16"
                  >
                    No agents found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((agent) => (
                  <TableRow
                    key={agent.id}
                    className="cursor-pointer hover:bg-gray-50 border-b border-gray-100"
                    onClick={() => setSelected(agent)}
                  >
                    <TableCell className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-700">
                          {truncateText(agent.id, 16)}
                        </span>
                        <CopyButton value={agent.id} />
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <span className="text-xs text-gray-600">
                        {agent.namespace ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5 max-w-[160px]">
                      <span className="text-xs text-gray-500 truncate block">
                        {agent.current_goal ?? agent.envelope_summary ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <ExecutionStatusBadge status={agent.state} />
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <span className="text-xs text-gray-500 tabular-nums">
                        {(agent.last_trace_at ?? agent.last_run_at)
                          ? getRelativeTime((agent.last_trace_at ?? agent.last_run_at)!)
                          : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <ViolationBadge count={agent.violation_count} />
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <span className="text-xs text-gray-500">
                        {agent.device_id ? truncateText(agent.device_id, 12) : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      {agent.shadow_mode ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                          <Moon className="h-2.5 w-2.5" />
                          Shadow
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => router.push(`/execution/agents/${agent.id}/live`)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-colors"
                      >
                        <Radio className="h-2.5 w-2.5" />
                        Live
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* ── Agent Detail Drawer ─────────────────────────────────────────────── */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <div>
                  <SheetTitle>Agent Detail</SheetTitle>
                  <div className="flex items-center gap-1.5 mt-1">
                    <code className="text-xs text-gray-500">{selected.id}</code>
                    <CopyButton value={selected.id} />
                  </div>
                </div>
                <SheetClose onClick={() => setSelected(null)} />
              </SheetHeader>

              <SheetBody>
                <div className="space-y-6 py-2">

                  {/* §0 Shadow Mode */}
                  <section>
                    <div className="flex items-center justify-between py-3 px-1 rounded-md">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4 text-purple-500" />
                        <div>
                          <p className="text-xs font-medium text-gray-700">Shadow Mode</p>
                          <p className="text-[11px] text-gray-400 leading-relaxed">
                            Observe all activity without enforcing policy rules.
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={selected.shadow_mode ?? false}
                        disabled={shadowMutation.isPending}
                        onCheckedChange={(checked) =>
                          shadowMutation.mutate({ agentId: selected.id, enabled: checked })
                        }
                        className="ml-4"
                      />
                    </div>
                    {selected.shadow_mode && (
                      <div className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-purple-50 border border-purple-200 text-xs text-purple-700">
                        <Moon className="h-3.5 w-3.5 shrink-0" />
                        This agent is in shadow mode — violations are logged but not enforced.
                      </div>
                    )}
                  </section>

                  <Separator />

                  {/* §1 Lifecycle Timeline */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5" />
                      Lifecycle Timeline
                    </h3>
                    <LifecycleTimeline
                      events={selected.lifecycle_history ?? []}
                    />
                  </section>

                  <Separator />

                  {/* §2 Capabilities */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5" />
                      Capabilities
                    </h3>
                    {selected.capabilities &&
                    (Array.isArray(selected.capabilities)
                      ? selected.capabilities.length > 0
                      : Object.keys(selected.capabilities).length > 0) ? (
                      Array.isArray(selected.capabilities) ? (
                        <div className="flex flex-wrap gap-1.5">
                          {(selected.capabilities as string[]).map((cap) => (
                            <span
                              key={cap}
                              className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded border border-gray-200"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <KeyValueGrid
                          rows={Object.entries(
                            resolveCapabilities(selected.capabilities),
                          ).map(([k, v]) => ({ label: k, value: v, mono: true }))}
                        />
                      )
                    ) : (
                      <p className="text-xs text-gray-400">No capabilities configured.</p>
                    )}
                  </section>

                  <Separator />

                  {/* §3 Execution Bounds */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      Execution Bounds
                    </h3>
                    {selected.execution_bounds || selected.policy_bounds ? (
                      <KeyValueGrid
                        rows={Object.entries(
                          selected.execution_bounds ?? selected.policy_bounds ?? {},
                        ).map(([k, v]) => ({
                          label: k.replace(/_/g, ' '),
                          value: typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v),
                          mono: true,
                        }))}
                      />
                    ) : (
                      <p className="text-xs text-gray-400">No execution bounds configured.</p>
                    )}
                  </section>

                  <Separator />

                  {/* §4 Recent Executions */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" />
                      Recent Executions
                      {(selected.recent_executions ?? []).length > 0 && (
                        <span className="ml-1 text-xs font-normal text-gray-400">
                          ({selected.recent_executions!.length})
                        </span>
                      )}
                    </h3>
                    <MiniExecutionsTable
                      executions={selected.recent_executions ?? []}
                    />
                  </section>

                  <Separator />

                  {/* §5 Violation History */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Violation History
                      {selected.violation_count > 0 && (
                        <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-700 border border-orange-200">
                          {selected.violation_count}
                        </span>
                      )}
                    </h3>
                    <MiniViolationsTable
                      violations={selected.violations ?? []}
                    />
                  </section>

                  <Separator />

                  {/* §6 Latest Inference Traces */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <BarChart3 className="h-3.5 w-3.5" />
                      Latest Inference Traces
                      <span className="ml-1 text-[10px] font-normal text-gray-400 normal-case tracking-normal">
                        fleet-wide
                      </span>
                    </h3>
                    {traces.length === 0 ? (
                      <p className="text-xs text-gray-400">No traces available.</p>
                    ) : (
                      <div className="border border-gray-200 rounded-md overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="text-left px-3 py-2 font-medium text-gray-500">Provider / Model</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500">Status</th>
                              <th className="text-right px-3 py-2 font-medium text-gray-500">Latency</th>
                              <th className="text-right px-3 py-2 font-medium text-gray-500">When</th>
                            </tr>
                          </thead>
                          <tbody>
                            {traces.slice(0, 3).map((trace) => (
                              <tr key={trace.id} className="border-b border-gray-100 last:border-0">
                                <td className="px-3 py-2">
                                  <span className="text-gray-700">{trace.provider}</span>
                                  <span className="text-gray-400 mx-1">/</span>
                                  <span className="text-gray-500">{truncateText(trace.model, 16)}</span>
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    trace.status === 200
                                      ? 'bg-green-50 text-green-700 border border-green-200'
                                      : 'bg-red-50 text-red-700 border border-red-200'
                                  }`}>
                                    {trace.status}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                                  {trace.latency < 1000
                                    ? `${Math.round(trace.latency)}ms`
                                    : `${(trace.latency / 1000).toFixed(1)}s`}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-400">
                                  {getRelativeTime(trace.timestamp)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  <Separator />

                  {/* §6.5 BT Execution View */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5" />
                      BT Execution View
                      <span className="ml-1 text-[10px] font-normal text-gray-400 normal-case tracking-normal">
                        live · 2s
                      </span>
                    </h3>
                    <BTExecutionView agentId={selected.id} />
                  </section>

                  <Separator />

                  {/* §7 Raw JSON */}
                  <section>
                    <JSONViewer data={selected} />
                  </section>
                </div>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
