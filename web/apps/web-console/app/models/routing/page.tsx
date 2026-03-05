'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { getRelativeTime } from '@/utils/helpers';
import { RefreshCw, Settings2, Eye, ArrowDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoutingPolicy {
  strategy: string;
  fallback_enabled: boolean;
  max_retry_attempts: number;
  active_providers: number;
  shadow_mode: boolean;
  shadow_provider: string;
  primary_provider: string;
  fallback_providers: string[];
}

interface ProviderMetric {
  id: string;
  provider: string;
  kind: string;
  model: string;
  latency_ms: number | null;
  success_rate: number | null;
  cost_per_1k: number | null;
  routing_weight: number; // 0–100 (percent, normalized across active providers)
  status: 'healthy' | 'degraded' | 'offline';
}

interface RoutingDecision {
  id: string;
  timestamp: string;
  request_id: string;
  selected_provider: string;
  latency_ms: number | null;
  fallback_used: boolean;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_POLICY: RoutingPolicy = {
  strategy: 'Thompson Sampling',
  fallback_enabled: true,
  max_retry_attempts: 2,
  active_providers: 3,
  shadow_mode: false,
  shadow_provider: '',
  primary_provider: 'openai',
  fallback_providers: ['anthropic', 'deepseek'],
};

const MOCK_METRICS: ProviderMetric[] = [
  {
    id: 'm1', provider: 'OpenAI', kind: 'openai', model: 'gpt-4o',
    latency_ms: 318, success_rate: 99.1, cost_per_1k: 0.015, routing_weight: 45, status: 'healthy',
  },
  {
    id: 'm2', provider: 'Anthropic', kind: 'anthropic', model: 'claude-sonnet-4-6',
    latency_ms: 274, success_rate: 99.8, cost_per_1k: 0.012, routing_weight: 38, status: 'healthy',
  },
  {
    id: 'm3', provider: 'DeepSeek', kind: 'deepseek', model: 'deepseek-chat',
    latency_ms: 412, success_rate: 97.2, cost_per_1k: 0.002, routing_weight: 17, status: 'healthy',
  },
  {
    id: 'm4', provider: 'Google Gemini', kind: 'google', model: 'gemini-1.5-pro',
    latency_ms: null, success_rate: 84.3, cost_per_1k: 0.007, routing_weight: 0, status: 'offline',
  },
];

const _now = Date.now();
const MOCK_DECISIONS: RoutingDecision[] = [
  { id: 'd1', timestamp: new Date(_now - 45_000).toISOString(),    request_id: 'req_7f3a1c', selected_provider: 'OpenAI',    latency_ms: 312, fallback_used: false },
  { id: 'd2', timestamp: new Date(_now - 91_000).toISOString(),    request_id: 'req_2b8e4d', selected_provider: 'Anthropic', latency_ms: 281, fallback_used: false },
  { id: 'd3', timestamp: new Date(_now - 134_000).toISOString(),   request_id: 'req_9c5f7a', selected_provider: 'Anthropic', latency_ms: 295, fallback_used: true  },
  { id: 'd4', timestamp: new Date(_now - 187_000).toISOString(),   request_id: 'req_4d1b2e', selected_provider: 'DeepSeek',  latency_ms: 408, fallback_used: false },
  { id: 'd5', timestamp: new Date(_now - 241_000).toISOString(),   request_id: 'req_8a6c3f', selected_provider: 'OpenAI',    latency_ms: 324, fallback_used: false },
  { id: 'd6', timestamp: new Date(_now - 315_000).toISOString(),   request_id: 'req_5e9d7b', selected_provider: 'OpenAI',    latency_ms: null, fallback_used: true },
];

// ─── Static Config ────────────────────────────────────────────────────────────

const STRATEGY_OPTIONS = [
  { value: 'thompson_sampling',   label: 'Thompson Sampling' },
  { value: 'latency_based',       label: 'Latency Based' },
  { value: 'cost_based',          label: 'Cost Based' },
  { value: 'weighted_round_robin', label: 'Weighted Round Robin' },
];

const PROVIDER_OPTIONS = [
  { value: 'openai',     label: 'OpenAI' },
  { value: 'anthropic',  label: 'Anthropic' },
  { value: 'deepseek',   label: 'DeepSeek' },
  { value: 'google',     label: 'Google Gemini' },
  { value: 'xai',        label: 'xAI' },
];

const PROVIDER_AVATAR: Record<string, { bg: string; text: string; initial: string }> = {
  openai:    { bg: 'bg-[#10a37f]',  text: 'text-white',      initial: 'O' },
  anthropic: { bg: 'bg-orange-100', text: 'text-orange-700', initial: 'A' },
  deepseek:  { bg: 'bg-blue-100',   text: 'text-blue-700',   initial: 'D' },
  google:    { bg: 'bg-red-100',    text: 'text-red-700',    initial: 'G' },
  xai:       { bg: 'bg-gray-900',   text: 'text-white',      initial: 'X' },
};

function strategyToValue(strategy: string): string {
  const map: Record<string, string> = {
    'Thompson Sampling':   'thompson_sampling',
    'Latency Based':       'latency_based',
    'Cost Based':          'cost_based',
    'Weighted Round Robin': 'weighted_round_robin',
  };
  return map[strategy] ?? 'thompson_sampling';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProviderAvatar({ kind }: { kind: string }) {
  const meta = PROVIDER_AVATAR[kind] ?? { bg: 'bg-gray-100', text: 'text-gray-600', initial: kind[0]?.toUpperCase() ?? '?' };
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold flex-shrink-0 ${meta.bg} ${meta.text}`}>
      {meta.initial}
    </span>
  );
}

function HealthBadge({ status }: { status: 'healthy' | 'degraded' | 'offline' }) {
  const map = {
    healthy:  { cls: 'bg-green-50 text-green-700 border-green-200',   label: 'Healthy'  },
    degraded: { cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Degraded' },
    offline:  { cls: 'bg-red-50 text-red-600 border-red-200',         label: 'Offline'  },
  } as const;
  const { cls, label } = map[status];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {label}
    </span>
  );
}

function WeightBar({ weight }: { weight: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-gray-900 rounded-full" style={{ width: `${weight}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-600">{weight}%</span>
    </div>
  );
}

function LatencyCell({ ms }: { ms: number | null }) {
  if (ms === null) return <span className="text-xs text-gray-300">—</span>;
  const cls = ms < 300 ? 'text-green-700' : ms < 600 ? 'text-yellow-700' : 'text-red-600';
  return <span className={`text-xs font-mono tabular-nums ${cls}`}>{ms}ms</span>;
}

function SuccessRateCell({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-xs text-gray-300">—</span>;
  const cls = rate >= 98 ? 'text-green-700' : rate >= 90 ? 'text-yellow-700' : 'text-red-600';
  return <span className={`text-xs font-mono tabular-nums ${cls}`}>{rate.toFixed(1)}%</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ModelsRoutingPage() {
  const qc = useQueryClient();

  // Edit policy dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    strategy: 'thompson_sampling',
    fallback_enabled: true,
    max_retry_attempts: '2',
  });

  // Fallback chain
  const [fallbackForm, setFallbackForm] = useState({
    primary: 'openai',
    fallback1: 'anthropic',
    fallback2: 'deepseek',
  });
  const [fallbackDirty, setFallbackDirty] = useState(false);

  // Shadow mode (local until server responds)
  const [shadowEnabled, setShadowEnabled] = useState(false);
  const [shadowProvider, setShadowProvider] = useState('');

  const { data: policy, isLoading: policyLoading } = useQuery<RoutingPolicy>({
    queryKey: ['routing-policy'],
    queryFn: async () => {
      try { return await api.get<RoutingPolicy>('/models/routing'); }
      catch { return MOCK_POLICY; }
    },
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: metrics = [], isLoading: metricsLoading, refetch } = useQuery<ProviderMetric[]>({
    queryKey: ['routing-metrics'],
    queryFn: async () => {
      try { return await api.get<ProviderMetric[]>('/models/routing/metrics'); }
      catch { return MOCK_METRICS; }
    },
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: decisions = [], isLoading: decisionsLoading } = useQuery<RoutingDecision[]>({
    queryKey: ['routing-decisions'],
    queryFn: async () => {
      try { return await api.get<RoutingDecision[]>('/models/routing/history'); }
      catch { return MOCK_DECISIONS; }
    },
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });

  const policyMutation = useMutation({
    mutationFn: (data: object) => api.post('/models/routing', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routing-policy'] });
      setDialogOpen(false);
    },
  });

  const fallbackMutation = useMutation({
    mutationFn: (data: object) => api.post('/models/routing', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routing-policy'] });
      setFallbackDirty(false);
    },
  });

  const shadowMutation = useMutation({
    mutationFn: (data: object) => api.patch('/models/routing', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routing-policy'] }),
  });

  const openDialog = () => {
    setPolicyForm({
      strategy: strategyToValue(policy?.strategy ?? 'Thompson Sampling'),
      fallback_enabled: policy?.fallback_enabled ?? true,
      max_retry_attempts: String(policy?.max_retry_attempts ?? 2),
    });
    setDialogOpen(true);
  };

  const handlePolicySave = () => {
    policyMutation.mutate({
      strategy: policyForm.strategy,
      fallback_enabled: policyForm.fallback_enabled,
      max_retry_attempts: parseInt(policyForm.max_retry_attempts, 10),
    });
  };

  const handleFallbackSave = () => {
    fallbackMutation.mutate({
      primary_provider: fallbackForm.primary,
      fallback_providers: [fallbackForm.fallback1, fallbackForm.fallback2].filter(Boolean),
    });
  };

  const handleShadowToggle = (enabled: boolean) => {
    setShadowEnabled(enabled);
    shadowMutation.mutate({ shadow_mode: enabled, shadow_provider: policy?.shadow_provider ?? shadowProvider });
  };

  const handleShadowProviderChange = (provider: string) => {
    setShadowProvider(provider);
    shadowMutation.mutate({ shadow_mode: policy?.shadow_mode ?? shadowEnabled, shadow_provider: provider });
  };

  const activeShadow = policy?.shadow_mode ?? shadowEnabled;
  const currentShadowProvider = (policy?.shadow_provider || shadowProvider) || '';
  const activeProviderCount = policy?.active_providers ?? metrics.filter((m) => m.status !== 'offline').length;

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Model Routing</h1>
            <p className="text-xs text-gray-500 mt-0.5">Control how requests are routed across AI providers.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={openDialog}>
              <Settings2 className="h-3.5 w-3.5" /> Edit Routing Policy
            </Button>
          </div>
        </div>

        {/* ── Routing Policy Summary ─────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-medium text-gray-900">Routing Policy</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="px-4 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                {
                  label: 'Policy Type',
                  value: policyLoading ? null : (policy?.strategy ?? 'Thompson Sampling'),
                },
                {
                  label: 'Fallback Enabled',
                  value: policyLoading ? null : (policy?.fallback_enabled ? 'Yes' : 'No'),
                },
                {
                  label: 'Active Providers',
                  value: policyLoading ? null : String(activeProviderCount),
                },
                {
                  label: 'Shadow Mode',
                  value: policyLoading ? null : (activeShadow ? 'Enabled' : 'Disabled'),
                },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[11px] text-gray-400 mb-1">{label}</p>
                  {value === null
                    ? <Skeleton className="h-4 w-20" />
                    : <p className="text-xs font-medium text-gray-900">{value}</p>
                  }
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Provider Performance Table ─────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-medium text-gray-900">Provider Performance</CardTitle>
          </CardHeader>
          <Separator />
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Provider', 'Model', 'Avg Latency', 'Success Rate', 'Cost / 1K', 'Routing Weight', 'Status'].map((col) => (
                  <TableHead
                    key={col}
                    className="text-xs font-medium text-gray-500 h-9 px-4 bg-gray-50 hover:bg-gray-50"
                  >
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {metricsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j} className="px-4 py-3">
                        <Skeleton className="h-3.5 w-16" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                metrics.map((m) => (
                  <TableRow key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ProviderAvatar kind={m.kind} />
                        <span className="text-xs font-medium text-gray-900">{m.provider}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-500">{m.model}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <LatencyCell ms={m.latency_ms} />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <SuccessRateCell rate={m.success_rate} />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {m.cost_per_1k === null
                        ? <span className="text-xs text-gray-300">—</span>
                        : <span className="text-xs font-mono tabular-nums text-gray-700">${m.cost_per_1k.toFixed(3)}</span>
                      }
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <WeightBar weight={m.routing_weight} />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <HealthBadge status={m.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* ── Fallback + Shadow 2-col ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

          {/* Fallback Configuration (3/5) */}
          <Card className="xl:col-span-3 border border-gray-200 shadow-none">
            <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-900">Fallback Chain</CardTitle>
              {fallbackDirty && (
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={handleFallbackSave}
                  disabled={fallbackMutation.isPending}
                >
                  {fallbackMutation.isPending && <RefreshCw className="h-3 w-3 animate-spin" />}
                  Save
                </Button>
              )}
            </CardHeader>
            <Separator />
            <CardContent className="px-4 py-4">
              <p className="text-xs text-gray-500 mb-4">
                Define fallback providers used when the primary provider fails.
              </p>
              <div className="space-y-3">
                {/* Primary */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Primary Provider</Label>
                  <Select
                    value={fallbackForm.primary}
                    onValueChange={(v) => { setFallbackForm((f) => ({ ...f, primary: v })); setFallbackDirty(true); }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 text-gray-300 pl-1">
                  <ArrowDown className="h-3.5 w-3.5" />
                  <span className="text-[10px] text-gray-400">on failure</span>
                </div>

                {/* Fallback 1 */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Fallback Provider</Label>
                  <Select
                    value={fallbackForm.fallback1}
                    onValueChange={(v) => { setFallbackForm((f) => ({ ...f, fallback1: v })); setFallbackDirty(true); }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 text-gray-300 pl-1">
                  <ArrowDown className="h-3.5 w-3.5" />
                  <span className="text-[10px] text-gray-400">on failure</span>
                </div>

                {/* Fallback 2 */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Fallback Provider 2</Label>
                  <Select
                    value={fallbackForm.fallback2}
                    onValueChange={(v) => { setFallbackForm((f) => ({ ...f, fallback2: v })); setFallbackDirty(true); }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shadow Mode (2/5) */}
          <Card className="xl:col-span-2 border border-gray-200 shadow-none">
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-gray-400" />
                Shadow Mode
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="px-4 py-4 space-y-4">
              <p className="text-xs text-gray-500">
                Run requests against an alternative provider without affecting live responses.
              </p>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-gray-700">Enable Shadow Mode</Label>
                <Switch
                  checked={activeShadow}
                  onCheckedChange={handleShadowToggle}
                  disabled={shadowMutation.isPending}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Shadow Provider</Label>
                <Select
                  value={currentShadowProvider}
                  onValueChange={handleShadowProviderChange}
                  disabled={!activeShadow || shadowMutation.isPending}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select provider…" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Recent Routing Decisions ───────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-medium text-gray-900">Recent Routing Decisions</CardTitle>
          </CardHeader>
          <Separator />
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Timestamp', 'Request', 'Selected Provider', 'Latency', 'Fallback'].map((col) => (
                  <TableHead
                    key={col}
                    className="text-xs font-medium text-gray-500 h-9 px-4 bg-gray-50 hover:bg-gray-50"
                  >
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {decisionsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j} className="px-4 py-3">
                        <Skeleton className="h-3.5 w-16" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : decisions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-xs text-gray-400">
                    No routing decisions recorded.
                  </TableCell>
                </TableRow>
              ) : (
                decisions.map((d) => (
                  <TableRow key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <TableCell className="px-4 py-3 text-xs text-gray-500 tabular-nums">
                      {getRelativeTime(d.timestamp)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-700">{d.request_id}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs font-medium text-gray-900">
                      {d.selected_provider}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <LatencyCell ms={d.latency_ms} />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {d.fallback_used ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                          Yes
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* ── Edit Routing Policy Dialog ─────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Edit Routing Policy</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Configure the global routing strategy and retry behavior.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Routing Strategy */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Routing Strategy</Label>
              <Select
                value={policyForm.strategy}
                onValueChange={(v) => setPolicyForm((f) => ({ ...f, strategy: v }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Enable Fallback */}
            <div className="flex items-center justify-between py-1">
              <div>
                <Label className="text-xs font-medium text-gray-700">Enable Fallback</Label>
                <p className="text-xs text-gray-400 mt-0.5">Route to fallback providers on failure.</p>
              </div>
              <Switch
                checked={policyForm.fallback_enabled}
                onCheckedChange={(v) => setPolicyForm((f) => ({ ...f, fallback_enabled: v }))}
              />
            </div>

            {/* Max Retry Attempts */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Max Retry Attempts</Label>
              <Input
                type="number"
                min={0}
                max={10}
                className="h-8 text-xs"
                value={policyForm.max_retry_attempts}
                onChange={(e) => setPolicyForm((f) => ({ ...f, max_retry_attempts: e.target.value }))}
              />
            </div>

            {policyMutation.isError && (
              <p className="text-xs text-red-600">Failed to save policy. Try again.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handlePolicySave}
              disabled={policyMutation.isPending}
            >
              {policyMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
