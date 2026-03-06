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
import {
  RefreshCw, SlidersHorizontal, Eye, ArrowDown, Zap, Users, ShieldCheck, Activity,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ShadowMode = 'disabled' | 'shadow' | 'go' | 'rust';
type SpeculativeMode = 'disabled' | 'conservative' | 'aggressive';

interface RoutingPolicy {
  strategy: string;
  fallback_enabled: boolean;
  max_retry_attempts: number;
  active_providers: number;
  // Runtime optimizer
  shadow_mode: ShadowMode;
  shadow_sample_rate: number;
  // Thompson Sampling
  exploration_rate: number;
  quality_routing_enabled: boolean;
  // Council mode
  council_mode_enabled: boolean;
  council_max_providers: number;
  // Speculative execution
  speculative_mode: SpeculativeMode;
  // SLO Breaker
  slo_breaker_enabled: boolean;
  slo_p95_latency_delta: number;
  slo_cost_delta: number;
  slo_error_rate_delta: number;
  // Fallback
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
  routing_weight: number;
  status: 'healthy' | 'degraded' | 'offline';
}

interface RoutingDecision {
  id: string;
  timestamp: string;
  request_id: string;
  selected_provider: string;
  latency_ms: number | null;
  fallback_used: boolean;
  mode: 'standard' | 'optimized' | 'council' | 'speculative';
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_POLICY: RoutingPolicy = {
  strategy: 'thompson_sampling',
  fallback_enabled: true,
  max_retry_attempts: 2,
  active_providers: 3,
  shadow_mode: 'shadow',
  shadow_sample_rate: 1.0,
  exploration_rate: 0.10,
  quality_routing_enabled: true,
  council_mode_enabled: false,
  council_max_providers: 3,
  speculative_mode: 'disabled',
  slo_breaker_enabled: true,
  slo_p95_latency_delta: 0.10,
  slo_cost_delta: 0.05,
  slo_error_rate_delta: 0.005,
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

const MOCK_DECISIONS: RoutingDecision[] = [
  { id: 'd1', timestamp: '2026-03-05T10:00:45Z', request_id: 'req_7f3a1c', selected_provider: 'Anthropic', latency_ms: 268, fallback_used: false, mode: 'optimized'  },
  { id: 'd2', timestamp: '2026-03-05T09:59:59Z', request_id: 'req_2b8e4d', selected_provider: 'OpenAI',    latency_ms: 312, fallback_used: false, mode: 'standard'   },
  { id: 'd3', timestamp: '2026-03-05T09:58:46Z', request_id: 'req_9c5f7a', selected_provider: 'Anthropic', latency_ms: 295, fallback_used: true,  mode: 'standard'   },
  { id: 'd4', timestamp: '2026-03-05T09:57:53Z', request_id: 'req_4d1b2e', selected_provider: 'DeepSeek',  latency_ms: 408, fallback_used: false, mode: 'optimized'  },
  { id: 'd5', timestamp: '2026-03-05T09:56:59Z', request_id: 'req_8a6c3f', selected_provider: 'OpenAI',    latency_ms: 324, fallback_used: false, mode: 'council'    },
  { id: 'd6', timestamp: '2026-03-05T09:55:45Z', request_id: 'req_5e9d7b', selected_provider: 'OpenAI',    latency_ms: null, fallback_used: true, mode: 'standard'   },
];

// ─── Static Config ────────────────────────────────────────────────────────────

const STRATEGY_OPTIONS = [
  { value: 'thompson_sampling',    label: 'Thompson Sampling' },
  { value: 'latency_based',        label: 'Latency Based' },
  { value: 'cost_based',           label: 'Cost Based' },
  { value: 'weighted_round_robin', label: 'Weighted Round Robin' },
];

const PROVIDER_OPTIONS = [
  { value: 'openai',    label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'deepseek',  label: 'DeepSeek' },
  { value: 'google',    label: 'Google Gemini' },
  { value: 'xai',       label: 'xAI' },
];

const SHADOW_MODE_OPTIONS: { value: ShadowMode; label: string; description: string }[] = [
  {
    value: 'disabled',
    label: 'Off',
    description: 'Standard routing engine only. No parallel evaluation.',
  },
  {
    value: 'shadow',
    label: 'Shadow Test',
    description: 'Optimized engine runs in parallel for evaluation. Standard engine remains authoritative — no effect on live traffic.',
  },
  {
    value: 'go',
    label: 'Standard',
    description: 'Default routing engine handles all decisions.',
  },
  {
    value: 'rust',
    label: 'Optimized',
    description: 'High-performance routing engine is fully active. Standard engine acts as fallback only.',
  },
];

const SPECULATIVE_MODE_OPTIONS: { value: SpeculativeMode; label: string }[] = [
  { value: 'disabled',    label: 'Disabled' },
  { value: 'conservative', label: 'Conservative (2 providers)' },
  { value: 'aggressive',   label: 'Aggressive (3–4 providers)' },
];

const PROVIDER_AVATAR: Record<string, { bg: string; text: string; initial: string }> = {
  openai:    { bg: 'bg-[#10a37f]',  text: 'text-white',      initial: 'O' },
  anthropic: { bg: 'bg-orange-100', text: 'text-orange-700', initial: 'A' },
  deepseek:  { bg: 'bg-blue-100',   text: 'text-blue-700',   initial: 'D' },
  google:    { bg: 'bg-red-100',    text: 'text-red-700',    initial: 'G' },
  xai:       { bg: 'bg-gray-900',   text: 'text-white',      initial: 'X' },
};

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

function ShadowModeBadge({ mode }: { mode: ShadowMode }) {
  const map: Record<ShadowMode, { cls: string; label: string }> = {
    disabled: { cls: 'bg-gray-50 text-gray-500 border-gray-200',      label: 'Off'         },
    shadow:   { cls: 'bg-blue-50 text-blue-700 border-blue-200',      label: 'Shadow Test'  },
    go:       { cls: 'bg-green-50 text-green-700 border-green-200',   label: 'Standard'    },
    rust:     { cls: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Optimized'  },
  };
  const { cls, label } = map[mode] ?? { cls: 'bg-gray-50 text-gray-500 border-gray-200', label: mode };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {label}
    </span>
  );
}


function DecisionModeBadge({ mode }: { mode: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    standard:    { cls: 'bg-gray-50 text-gray-600 border-gray-200',     label: 'Standard'    },
    optimized:   { cls: 'bg-orange-50 text-orange-700 border-orange-200', label: 'Optimized' },
    council:     { cls: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Council'   },
    speculative: { cls: 'bg-blue-50 text-blue-700 border-blue-200',      label: 'Speculative'},
  };
  const { cls, label } = map[mode] ?? { cls: 'bg-gray-50 text-gray-600 border-gray-200', label: mode };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {label}
    </span>
  );
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
    exploration_rate: '0.10',
  });

  // Fallback chain
  const [fallbackForm, setFallbackForm] = useState({
    primary: 'openai',
    fallback1: 'anthropic',
    fallback2: 'deepseek',
  });
  const [fallbackDirty, setFallbackDirty] = useState(false);

  // Local optimistic state
  const [localShadowMode, setLocalShadowMode] = useState<ShadowMode | null>(null);
  const [localSampleRate, setLocalSampleRate] = useState<number | null>(null);
  const [localExplorationRate, setLocalExplorationRate] = useState<number | null>(null);
  const [localQualityRouting, setLocalQualityRouting] = useState<boolean | null>(null);
  const [localCouncilEnabled, setLocalCouncilEnabled] = useState<boolean | null>(null);
  const [localCouncilProviders, setLocalCouncilProviders] = useState<number | null>(null);
  const [localSpeculativeMode, setLocalSpeculativeMode] = useState<SpeculativeMode | null>(null);
  const [localSloEnabled, setLocalSloEnabled] = useState<boolean | null>(null);

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
    mutationFn: (data: object) => api.post('/models/routing/fallback', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routing-policy'] });
      setFallbackDirty(false);
    },
  });

  const optimizerMutation = useMutation({
    mutationFn: (data: object) => api.patch('/models/routing/optimizer', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routing-policy'] }),
  });

  const openDialog = () => {
    setPolicyForm({
      strategy: policy?.strategy ?? 'thompson_sampling',
      fallback_enabled: policy?.fallback_enabled ?? true,
      max_retry_attempts: String(policy?.max_retry_attempts ?? 2),
      exploration_rate: String(policy?.exploration_rate ?? 0.10),
    });
    setDialogOpen(true);
  };

  const handlePolicySave = () => {
    policyMutation.mutate({
      strategy: policyForm.strategy,
      fallback_enabled: policyForm.fallback_enabled,
      max_retry_attempts: parseInt(policyForm.max_retry_attempts, 10),
      exploration_rate: parseFloat(policyForm.exploration_rate),
    });
  };

  const handleFallbackSave = () => {
    fallbackMutation.mutate({
      primary_provider: fallbackForm.primary,
      fallback_providers: [fallbackForm.fallback1, fallbackForm.fallback2].filter(Boolean),
    });
  };

  // Effective values (local overrides API until next refetch)
  const shadowMode: ShadowMode = localShadowMode ?? policy?.shadow_mode ?? 'disabled';
  const sampleRate: number = localSampleRate ?? policy?.shadow_sample_rate ?? 1.0;
  const explorationRate: number = localExplorationRate ?? policy?.exploration_rate ?? 0.10;
  const qualityRouting: boolean = localQualityRouting ?? policy?.quality_routing_enabled ?? true;
  const councilEnabled: boolean = localCouncilEnabled ?? policy?.council_mode_enabled ?? false;
  const councilProviders: number = localCouncilProviders ?? policy?.council_max_providers ?? 3;
  const speculativeMode: SpeculativeMode = localSpeculativeMode ?? policy?.speculative_mode ?? 'disabled';
  const sloEnabled: boolean = localSloEnabled ?? policy?.slo_breaker_enabled ?? true;
  const activeProviderCount = policy?.active_providers ?? metrics.filter((m) => m.status !== 'offline').length;

  const shadowModeInfo = SHADOW_MODE_OPTIONS.find((o) => o.value === shadowMode);

  const patchOptimizer = (patch: object) => {
    optimizerMutation.mutate(patch);
  };

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
              <SlidersHorizontal className="h-3.5 w-3.5" /> Edit Routing Policy
            </Button>
          </div>
        </div>

        {/* ── Policy Summary ─────────────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-medium text-gray-900">Routing Policy</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="px-4 py-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {[
                {
                  label: 'Strategy',
                  value: policyLoading ? null : (
                    STRATEGY_OPTIONS.find((o) => o.value === policy?.strategy)?.label ?? policy?.strategy ?? 'Thompson Sampling'
                  ),
                },
                {
                  label: 'Shadow Optimizer',
                  value: policyLoading ? null : shadowMode,
                  render: (v: string) => <ShadowModeBadge mode={v as ShadowMode} />,
                },
                {
                  label: 'Active Providers',
                  value: policyLoading ? null : String(activeProviderCount),
                },
                {
                  label: 'Quality Routing',
                  value: policyLoading ? null : (qualityRouting ? 'Enabled' : 'Disabled'),
                },
              ].map(({ label, value, render }) => (
                <div key={label}>
                  <p className="text-[11px] text-gray-400 mb-1">{label}</p>
                  {value === null
                    ? <Skeleton className="h-4 w-20" />
                    : render
                      ? render(value)
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
                  <TableHead key={col} className="text-xs font-medium text-gray-500 h-9 px-4 bg-gray-50 hover:bg-gray-50">
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
                      <TableCell key={j} className="px-4 py-3"><Skeleton className="h-3.5 w-16" /></TableCell>
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
                    <TableCell className="px-4 py-3"><LatencyCell ms={m.latency_ms} /></TableCell>
                    <TableCell className="px-4 py-3"><SuccessRateCell rate={m.success_rate} /></TableCell>
                    <TableCell className="px-4 py-3">
                      {m.cost_per_1k === null
                        ? <span className="text-xs text-gray-300">—</span>
                        : <span className="text-xs font-mono tabular-nums text-gray-700">${m.cost_per_1k.toFixed(3)}</span>
                      }
                    </TableCell>
                    <TableCell className="px-4 py-3"><WeightBar weight={m.routing_weight} /></TableCell>
                    <TableCell className="px-4 py-3"><HealthBadge status={m.status} /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* ── Runtime Optimizer + Thompson Sampling 2-col ───────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

          {/* Runtime Optimizer — Shadow Mode (3/5) */}
          <Card className="xl:col-span-3 border border-gray-200 shadow-none">
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                Runtime Optimizer
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="px-4 py-4 space-y-4">
              <p className="text-xs text-gray-500">
                Control the Rust Thompson Sampling optimizer rollout. In shadow mode the Rust
                optimizer runs in parallel with Go — decisions are compared and logged without
                affecting live traffic.
              </p>

              {/* Shadow mode select */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Optimizer Mode</Label>
                <Select
                  value={shadowMode}
                  onValueChange={(v) => {
                    const m = v as ShadowMode;
                    setLocalShadowMode(m);
                    patchOptimizer({ shadow_mode: m });
                  }}
                  disabled={optimizerMutation.isPending}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHADOW_MODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {shadowModeInfo && (
                  <p className="text-[11px] text-gray-400">{shadowModeInfo.description}</p>
                )}
              </div>

              {/* Sample rate — visible when shadow mode is active */}
              {shadowMode === 'shadow' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">
                    Shadow Sample Rate
                    <span className="ml-2 text-[11px] text-gray-400 font-normal">
                      {(sampleRate * 100).toFixed(0)}% of requests
                    </span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    className="h-8 text-xs font-mono w-28"
                    value={sampleRate}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) {
                        setLocalSampleRate(v);
                        patchOptimizer({ shadow_sample_rate: v });
                      }
                    }}
                    disabled={optimizerMutation.isPending}
                  />
                </div>
              )}

              {/* SLO Breaker status notice when in rust mode */}
              {shadowMode === 'rust' && (
                <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5">
                  <Activity className="h-3.5 w-3.5 text-orange-600 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                  <p className="text-xs text-orange-700">
                    SLO Breaker is active. If p95 latency, cost, or error rate exceeds configured thresholds, the system will auto-revert to Standard mode.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Thompson Sampling (2/5) */}
          <Card className="xl:col-span-2 border border-gray-200 shadow-none">
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                Thompson Sampling
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="px-4 py-4 space-y-4">
              <p className="text-xs text-gray-500">
                Bayesian multi-arm bandit using Beta distribution. Balances exploration of new
                providers vs exploitation of top performers.
              </p>

              {/* Exploration rate */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">
                  Exploration Rate
                  <span className="ml-2 text-[11px] text-gray-400 font-normal">
                    {(explorationRate * 100).toFixed(0)}%
                  </span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  className="h-8 text-xs font-mono w-28"
                  value={explorationRate}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) {
                      setLocalExplorationRate(v);
                      patchOptimizer({ exploration_rate: v });
                    }
                  }}
                  disabled={optimizerMutation.isPending}
                />
                <p className="text-[11px] text-gray-400">
                  Probability of routing to a non-optimal provider for exploration.
                </p>
              </div>

              <Separator />

              {/* Quality routing toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium text-gray-700">Quality Routing</Label>
                  <p className="text-[11px] text-gray-400 mt-0.5">Score response quality via domain heuristics.</p>
                </div>
                <Switch
                  checked={qualityRouting}
                  onCheckedChange={(v) => {
                    setLocalQualityRouting(v);
                    patchOptimizer({ quality_routing_enabled: v });
                  }}
                  disabled={optimizerMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Advanced Execution Modes ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

          {/* Council Mode */}
          <Card className="border border-gray-200 shadow-none">
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                Council Mode
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="px-4 py-4 space-y-4">
              <p className="text-xs text-gray-500">
                Run inference in parallel across 2–4 providers. Providers rank each other&apos;s
                responses, and a chairman provider synthesizes the final answer.
              </p>

              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-gray-700">Enable Council Mode</Label>
                <Switch
                  checked={councilEnabled}
                  onCheckedChange={(v) => {
                    setLocalCouncilEnabled(v);
                    patchOptimizer({ council_mode_enabled: v });
                  }}
                  disabled={optimizerMutation.isPending}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Max Council Providers</Label>
                <Select
                  value={String(councilProviders)}
                  onValueChange={(v) => {
                    const n = parseInt(v, 10);
                    setLocalCouncilProviders(n);
                    patchOptimizer({ council_max_providers: n });
                  }}
                  disabled={!councilEnabled || optimizerMutation.isPending}
                >
                  <SelectTrigger className="h-8 text-xs w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2" className="text-xs">2 providers</SelectItem>
                    <SelectItem value="3" className="text-xs">3 providers</SelectItem>
                    <SelectItem value="4" className="text-xs">4 providers</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-gray-400">
                  More providers improve quality but increase latency and cost.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Speculative Execution */}
          <Card className="border border-gray-200 shadow-none">
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                Speculative Execution
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="px-4 py-4 space-y-4">
              <p className="text-xs text-gray-500">
                Race multiple providers in parallel and stream from the fastest first-token winner.
                Losing provider streams are cancelled; wasted tokens are tracked and accounted.
              </p>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Execution Mode</Label>
                <Select
                  value={speculativeMode}
                  onValueChange={(v) => {
                    const m = v as SpeculativeMode;
                    setLocalSpeculativeMode(m);
                    patchOptimizer({ speculative_mode: m });
                  }}
                  disabled={optimizerMutation.isPending}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECULATIVE_MODE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {speculativeMode !== 'disabled' && (
                <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5">
                  <Zap className="h-3.5 w-3.5 text-yellow-600 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                  <p className="text-xs text-yellow-700">
                    Speculative mode increases token usage. Cost accounting is active and will auto-disable this feature if waste exceeds your plan threshold.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── SLO Guardrails + Fallback 2-col ───────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

          {/* SLO Guardrails (3/5) */}
          <Card className="xl:col-span-3 border border-gray-200 shadow-none">
            <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                SLO Guardrails
              </CardTitle>
              <Switch
                checked={sloEnabled}
                onCheckedChange={(v) => {
                  setLocalSloEnabled(v);
                  patchOptimizer({ slo_breaker_enabled: v });
                }}
                disabled={optimizerMutation.isPending}
              />
            </CardHeader>
            <Separator />
            <CardContent className="px-4 py-4 space-y-3">
              <p className="text-xs text-gray-500">
                When Rust optimizer is in full rollout mode, the SLO Breaker monitors these
                deltas against Go router baselines. A breach triggers automatic reversion to Go mode.
              </p>

              <div className="grid grid-cols-3 gap-4 pt-1">
                <div className="space-y-1">
                  <p className="text-[11px] text-gray-400">P95 Latency Delta</p>
                  <p className="text-sm font-mono font-medium text-gray-900">
                    {((policy?.slo_p95_latency_delta ?? 0.10) * 100).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-gray-400">max increase allowed</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-gray-400">Cost Delta</p>
                  <p className="text-sm font-mono font-medium text-gray-900">
                    {((policy?.slo_cost_delta ?? 0.05) * 100).toFixed(0)}%
                  </p>
                  <p className="text-[10px] text-gray-400">max increase allowed</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] text-gray-400">Error Rate Delta</p>
                  <p className="text-sm font-mono font-medium text-gray-900">
                    {((policy?.slo_error_rate_delta ?? 0.005) * 100).toFixed(2)}%
                  </p>
                  <p className="text-[10px] text-gray-400">max increase allowed</p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center gap-4 text-[11px] text-gray-400">
                <span>Window: 5 min</span>
                <span>Min samples: 100</span>
              </div>
            </CardContent>
          </Card>

          {/* Fallback Chain (2/5) */}
          <Card className="xl:col-span-2 border border-gray-200 shadow-none">
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
            <CardContent className="px-4 py-4 space-y-3">
              {/* Primary */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Primary Provider</Label>
                <Select
                  value={fallbackForm.primary}
                  onValueChange={(v) => { setFallbackForm((f) => ({ ...f, primary: v })); setFallbackDirty(true); }}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
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
                <Label className="text-xs font-medium text-gray-700">Fallback 1</Label>
                <Select
                  value={fallbackForm.fallback1}
                  onValueChange={(v) => { setFallbackForm((f) => ({ ...f, fallback1: v })); setFallbackDirty(true); }}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
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
                <Label className="text-xs font-medium text-gray-700">Fallback 2</Label>
                <Select
                  value={fallbackForm.fallback2}
                  onValueChange={(v) => { setFallbackForm((f) => ({ ...f, fallback2: v })); setFallbackDirty(true); }}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
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
                {['Timestamp', 'Request', 'Provider', 'Latency', 'Mode', 'Fallback'].map((col) => (
                  <TableHead key={col} className="text-xs font-medium text-gray-500 h-9 px-4 bg-gray-50 hover:bg-gray-50">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {decisionsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j} className="px-4 py-3"><Skeleton className="h-3.5 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : decisions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-xs text-gray-400">
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
                      <DecisionModeBadge mode={d.mode} />
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

      {/* ── Edit Routing Policy Dialog ────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Edit Routing Policy</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Configure the global routing strategy, retry behavior, and Thompson Sampling parameters.
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
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STRATEGY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Thompson Sampling exploration rate */}
            {policyForm.strategy === 'thompson_sampling' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Exploration Rate</Label>
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  className="h-8 text-xs font-mono"
                  value={policyForm.exploration_rate}
                  onChange={(e) => setPolicyForm((f) => ({ ...f, exploration_rate: e.target.value }))}
                />
                <p className="text-[11px] text-gray-400">Probability of routing to a sub-optimal provider for exploration (default: 0.10).</p>
              </div>
            )}

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
