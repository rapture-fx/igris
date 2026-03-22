'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { Slider } from '@/components/ui/slider';
import {
  RefreshCw, SlidersHorizontal, Zap, Users, Eye, ShieldCheck,
  CheckCircle2, Cpu, AlertTriangle,
} from 'lucide-react';
import { useWasmEngine } from '@/hooks/useWasmEngine';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StrategyConfig {
  strategy: string;
  circuit_breaker_enabled: boolean;
  provider_health_monitor: boolean;
}

interface SpeculativeConfig {
  enable_speculative_execution: boolean;
  max_parallel_requests: number;
  speculative_timeout_ms: number;
}

interface CouncilConfig {
  enable_council_mode: boolean;
  council_models: string[];
  aggregation_strategy: string;
  min_consensus: number;
}

interface ShadowConfig {
  enable_shadow_mode: boolean;
  shadow_providers: string[];
  shadow_sampling_rate: number;
  capture_latency_metrics: boolean;
  capture_cost_metrics: boolean;
  capture_quality_metrics: boolean;
}

interface ProviderRow {
  id: string;
  provider: string;
  kind: string;
  status: 'healthy' | 'degraded' | 'offline';
  average_latency_ms: number | null;
  success_rate_percent: number | null;
  cost_per_token: number | null;
  routing_weight: number;
  priority: number;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_STRATEGY: StrategyConfig = {
  strategy: 'thompson_sampling',
  circuit_breaker_enabled: true,
  provider_health_monitor: true,
};

const MOCK_SPECULATIVE: SpeculativeConfig = {
  enable_speculative_execution: false,
  max_parallel_requests: 2,
  speculative_timeout_ms: 800,
};

const MOCK_COUNCIL: CouncilConfig = {
  enable_council_mode: false,
  council_models: ['claude-sonnet-4-6', 'gpt-4o'],
  aggregation_strategy: 'majority_vote',
  min_consensus: 2,
};

const MOCK_SHADOW: ShadowConfig = {
  enable_shadow_mode: true,
  shadow_providers: ['deepseek', 'google'],
  shadow_sampling_rate: 20,
  capture_latency_metrics: true,
  capture_cost_metrics: true,
  capture_quality_metrics: false,
};

const MOCK_PROVIDERS: ProviderRow[] = [
  {
    id: 'p1', provider: 'Anthropic', kind: 'anthropic', status: 'healthy',
    average_latency_ms: 274, success_rate_percent: 99.8, cost_per_token: 0.000012,
    routing_weight: 45, priority: 1,
  },
  {
    id: 'p2', provider: 'OpenAI', kind: 'openai', status: 'healthy',
    average_latency_ms: 318, success_rate_percent: 99.1, cost_per_token: 0.000015,
    routing_weight: 38, priority: 2,
  },
  {
    id: 'p3', provider: 'DeepSeek', kind: 'deepseek', status: 'healthy',
    average_latency_ms: 412, success_rate_percent: 97.2, cost_per_token: 0.0000020,
    routing_weight: 17, priority: 3,
  },
  {
    id: 'p4', provider: 'Google Gemini', kind: 'google', status: 'degraded',
    average_latency_ms: 580, success_rate_percent: 91.4, cost_per_token: 0.0000070,
    routing_weight: 0, priority: 4,
  },
  {
    id: 'p5', provider: 'xAI Grok', kind: 'xai', status: 'offline',
    average_latency_ms: null, success_rate_percent: null, cost_per_token: null,
    routing_weight: 0, priority: 5,
  },
];

// ─── Static Options ─────────────────────────────────────────────────────────────

const STRATEGY_OPTIONS = [
  { value: 'thompson_sampling',  label: 'Thompson Sampling',  desc: 'Bayesian multi-armed bandit — balances exploration and exploitation.' },
  { value: 'latency_optimized',  label: 'Latency Optimized',  desc: 'Always route to the provider with the lowest p95 latency.' },
  { value: 'cost_optimized',     label: 'Cost Optimized',     desc: 'Always route to the lowest-cost provider within latency budget.' },
  { value: 'quality_optimized',  label: 'Quality Optimized',  desc: 'Route to the highest quality-scored provider.' },
];

const AGGREGATION_OPTIONS = [
  { value: 'majority_vote',       label: 'Majority Vote' },
  { value: 'quality_score',       label: 'Quality Score' },
  { value: 'weighted_consensus',  label: 'Weighted Consensus' },
];

const AVAILABLE_MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-6',   label: 'Claude Opus 4.6' },
  { value: 'gpt-4o',            label: 'GPT-4o' },
  { value: 'gpt-4o-mini',       label: 'GPT-4o Mini' },
  { value: 'deepseek-chat',     label: 'DeepSeek Chat' },
  { value: 'gemini-1.5-pro',    label: 'Gemini 1.5 Pro' },
  { value: 'grok-2',            label: 'Grok 2' },
];

const AVAILABLE_PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai',    label: 'OpenAI' },
  { value: 'deepseek',  label: 'DeepSeek' },
  { value: 'google',    label: 'Google Gemini' },
  { value: 'xai',       label: 'xAI Grok' },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

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
      <div className="w-14 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-gray-900 rounded-full" style={{ width: `${Math.min(weight, 100)}%` }} />
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

function SaveBar({
  dirty,
  pending,
  onSave,
  onReset,
}: {
  dirty: boolean;
  pending: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  if (!dirty) return null;
  return (
    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 mt-2">
      <Button variant="ghost" size="sm" className="h-7 text-[11px] text-gray-500" onClick={onReset} disabled={pending}>
        Reset
      </Button>
      <Button size="sm" className="h-7 text-xs gap-1.5" onClick={onSave} disabled={pending}>
        {pending && <RefreshCw className="h-3 w-3 animate-spin" />}
        Save Changes
      </Button>
    </div>
  );
}

function MultiSelectChips({
  options,
  value,
  onChange,
  disabled,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}) {
  const toggle = (v: string) => {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v));
    } else {
      onChange([...value, v]);
    }
  };
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => {
        const selected = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => toggle(opt.value)}
            className={[
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors',
              selected
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400',
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            {selected && <CheckCircle2 className="h-2.5 w-2.5" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function ModelsRoutingPage() {
  const qc = useQueryClient();
  const { status: wasmStatus, benchmark, runBenchmark } = useWasmEngine();

  // ── Routing Strategy state ───────────────────────────────────────────────────
  const [strategyForm, setStrategyForm] = useState<StrategyConfig>({
    strategy: 'thompson_sampling',
    circuit_breaker_enabled: false,
    provider_health_monitor: false,
  });
  const [strategyDirty, setStrategyDirty] = useState(false);

  // ── Speculative Execution state ──────────────────────────────────────────────
  const [speculativeForm, setSpeculativeForm] = useState<SpeculativeConfig>({
    enable_speculative_execution: false,
    max_parallel_requests: 2,
    speculative_timeout_ms: 800,
  });
  const [speculativeDirty, setSpeculativeDirty] = useState(false);

  // ── Council Mode state ───────────────────────────────────────────────────────
  const [councilForm, setCouncilForm] = useState<CouncilConfig>({
    enable_council_mode: false,
    council_models: [],
    aggregation_strategy: 'majority_vote',
    min_consensus: 2,
  });
  const [councilDirty, setCouncilDirty] = useState(false);

  // ── Shadow Mode state ────────────────────────────────────────────────────────
  const [shadowForm, setShadowForm] = useState<ShadowConfig>({
    enable_shadow_mode: false,
    shadow_providers: [],
    shadow_sampling_rate: 10,
    capture_latency_metrics: false,
    capture_cost_metrics: false,
    capture_quality_metrics: false,
  });
  const [shadowDirty, setShadowDirty] = useState(false);

  // ── Provider weights state ───────────────────────────────────────────────────
  const [providerRows, setProviderRows] = useState<ProviderRow[]>([]);
  const [providerDirty, setProviderDirty] = useState(false);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { isLoading: providersLoading, refetch } = useQuery<ProviderRow[]>({
    queryKey: ['routing-providers'],
    queryFn: async () => {
      const data = await api.get<ProviderRow[]>('/providers/stats');
      setProviderRows(data);
      return data;
    },
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────

  const strategyMutation = useMutation({
    mutationFn: (data: StrategyConfig) => api.post('/routing/strategy', data),
    onSuccess: () => { setStrategyDirty(false); qc.invalidateQueries({ queryKey: ['routing-providers'] }); },
  });

  const speculativeMutation = useMutation({
    mutationFn: (data: SpeculativeConfig) => api.post('/routing/speculative', data),
    onSuccess: () => setSpeculativeDirty(false),
  });

  const councilMutation = useMutation({
    mutationFn: (data: CouncilConfig) => api.post('/routing/council', data),
    onSuccess: () => setCouncilDirty(false),
  });

  const shadowMutation = useMutation({
    mutationFn: (data: ShadowConfig) => api.post('/routing/shadow', data),
    onSuccess: () => setShadowDirty(false),
  });

  const providerWeightsMutation = useMutation({
    mutationFn: (data: { providers: ProviderRow[] }) => api.post('/routing/provider_weights', data),
    onSuccess: () => setProviderDirty(false),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const updateProvider = (id: string, field: 'routing_weight' | 'priority', value: number) => {
    setProviderRows((rows) => rows.map((r) => r.id === id ? { ...r, [field]: value } : r));
    setProviderDirty(true);
  };

  const selectedStrategy = STRATEGY_OPTIONS.find((o) => o.value === strategyForm.strategy);

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Routing Engine</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Control how Igris selects providers and models for inference.
            </p>
          </div>
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

        {/* ── 0. EscapeVector WASM Engine ─────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                <p className="text-xs font-medium text-gray-900">EscapeVector WASM Engine</p>
              </div>
              <div className="flex items-center gap-2">
                {wasmStatus.loaded && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                    Active
                  </span>
                )}
                {wasmStatus.loading && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                    Loading
                  </span>
                )}
                {wasmStatus.error && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600 border border-red-200">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Unavailable
                  </span>
                )}
                {wasmStatus.loaded && !benchmark && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => runBenchmark(500)}
                  >
                    Run Benchmark
                  </Button>
                )}
              </div>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Rust-compiled Thompson Sampling and circuit-breaker logic running natively in-browser via WebAssembly.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="px-4 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Module size</p>
                <p className="text-xs font-mono text-gray-900">
                  {wasmStatus.moduleSize ? `${(wasmStatus.moduleSize / 1024).toFixed(1)} KB` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Compile time</p>
                <p className="text-xs font-mono text-gray-900">
                  {wasmStatus.compileTimeMs != null ? `${wasmStatus.compileTimeMs}ms` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Benchmark avg</p>
                <p className="text-xs font-mono text-gray-900">
                  {benchmark ? `${benchmark.avgPerIterationUs}µs` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Exports</p>
                <p className="text-xs font-mono text-gray-900">
                  {wasmStatus.exports.length > 0 ? `${wasmStatus.exports.length} functions` : '—'}
                </p>
              </div>
            </div>
            {wasmStatus.error && (
              <p className="mt-2 text-[11px] text-red-500">{wasmStatus.error}</p>
            )}
            {!wasmStatus.supported && (
              <p className="mt-2 text-[11px] text-yellow-600">
                WebAssembly is not supported in this browser. Routing falls back to server-side Thompson Sampling.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── 1. Routing Strategy ──────────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
              <p className="text-xs font-medium text-gray-900">Routing Strategy</p>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Configure the core routing algorithm used by igris-overture.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="px-4 py-4 space-y-4">

            {/* Strategy Select */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Routing Strategy</Label>
              <Select
                value={strategyForm.strategy}
                onValueChange={(v) => {
                  setStrategyForm((f) => ({ ...f, strategy: v }));
                  setStrategyDirty(true);
                }}
              >
                <SelectTrigger className="h-8 text-xs max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStrategy && (
                <p className="text-[11px] text-gray-400">{selectedStrategy.desc}</p>
              )}
            </div>

            <Separator />

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium text-gray-700">Circuit Breaker</Label>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Automatically remove unhealthy providers from the routing pool.
                  </p>
                </div>
                <Switch
                  checked={strategyForm.circuit_breaker_enabled}
                  onCheckedChange={(v) => {
                    setStrategyForm((f) => ({ ...f, circuit_breaker_enabled: v }));
                    setStrategyDirty(true);
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium text-gray-700">Provider Health Monitoring</Label>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Continuously ping providers to track availability and latency.
                  </p>
                </div>
                <Switch
                  checked={strategyForm.provider_health_monitor}
                  onCheckedChange={(v) => {
                    setStrategyForm((f) => ({ ...f, provider_health_monitor: v }));
                    setStrategyDirty(true);
                  }}
                />
              </div>
            </div>

            <SaveBar
              dirty={strategyDirty}
              pending={strategyMutation.isPending}
              onSave={() => strategyMutation.mutate(strategyForm)}
              onReset={() => { setStrategyForm({ strategy: 'thompson_sampling', circuit_breaker_enabled: false, provider_health_monitor: false }); setStrategyDirty(false); }}
            />
            {strategyMutation.isError && (
              <p className="text-xs text-red-600">Failed to save strategy settings.</p>
            )}
          </CardContent>
        </Card>

        {/* ── 2. Speculative Execution ─────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
              <p className="text-xs font-medium text-gray-900">Speculative Execution</p>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Send requests to multiple providers simultaneously and return the fastest valid response.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="px-4 py-4 space-y-4">

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium text-gray-700">Enable Speculative Execution</Label>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Race N providers in parallel; fastest successful response wins, others are cancelled.
                </p>
              </div>
              <Switch
                checked={speculativeForm.enable_speculative_execution}
                onCheckedChange={(v) => {
                  setSpeculativeForm((f) => ({ ...f, enable_speculative_execution: v }));
                  setSpeculativeDirty(true);
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Maximum Parallel Providers</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  className="h-8 text-xs font-mono"
                  value={speculativeForm.max_parallel_requests}
                  disabled={!speculativeForm.enable_speculative_execution}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) {
                      setSpeculativeForm((f) => ({ ...f, max_parallel_requests: v }));
                      setSpeculativeDirty(true);
                    }
                  }}
                />
                <p className="text-[11px] text-gray-400">Between 1 and 5 providers.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Timeout Threshold (ms)</Label>
                <Input
                  type="number"
                  min={100}
                  className="h-8 text-xs font-mono"
                  value={speculativeForm.speculative_timeout_ms}
                  disabled={!speculativeForm.enable_speculative_execution}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) {
                      setSpeculativeForm((f) => ({ ...f, speculative_timeout_ms: v }));
                      setSpeculativeDirty(true);
                    }
                  }}
                />
                <p className="text-[11px] text-gray-400">Cancel slow providers after this threshold.</p>
              </div>
            </div>

            {speculativeForm.enable_speculative_execution && (
              <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5">
                <Zap className="h-3.5 w-3.5 text-yellow-600 mt-0.5 flex-shrink-0" strokeWidth={1.5} />
                <p className="text-xs text-yellow-700">
                  Speculative execution increases token usage. Wasted tokens from cancelled providers are tracked and accounted toward your cost budget.
                </p>
              </div>
            )}

            <SaveBar
              dirty={speculativeDirty}
              pending={speculativeMutation.isPending}
              onSave={() => speculativeMutation.mutate(speculativeForm)}
              onReset={() => { setSpeculativeForm({ enable_speculative_execution: false, max_parallel_requests: 2, speculative_timeout_ms: 800 }); setSpeculativeDirty(false); }}
            />
            {speculativeMutation.isError && (
              <p className="text-xs text-red-600">Failed to save speculative execution settings.</p>
            )}
          </CardContent>
        </Card>

        {/* ── 3. Council Mode ──────────────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
              <p className="text-xs font-medium text-gray-900">Council Mode</p>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Send requests to multiple models and aggregate the responses into a single answer.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="px-4 py-4 space-y-4">

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium text-gray-700">Enable Council Mode</Label>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Multiple models generate responses; aggregation strategy produces the final answer.
                </p>
              </div>
              <Switch
                checked={councilForm.enable_council_mode}
                onCheckedChange={(v) => {
                  setCouncilForm((f) => ({ ...f, enable_council_mode: v }));
                  setCouncilDirty(true);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Council Models</Label>
              <MultiSelectChips
                options={AVAILABLE_MODELS}
                value={councilForm.council_models}
                disabled={!councilForm.enable_council_mode}
                onChange={(v) => {
                  setCouncilForm((f) => ({ ...f, council_models: v }));
                  setCouncilDirty(true);
                }}
              />
              {councilForm.council_models.length > 0 && (
                <p className="text-[11px] text-gray-400">
                  {councilForm.council_models.length} model{councilForm.council_models.length > 1 ? 's' : ''} selected. More models improve quality but increase latency and cost.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Aggregation Strategy</Label>
                <Select
                  value={councilForm.aggregation_strategy}
                  disabled={!councilForm.enable_council_mode}
                  onValueChange={(v) => {
                    setCouncilForm((f) => ({ ...f, aggregation_strategy: v }));
                    setCouncilDirty(true);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AGGREGATION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Minimum Consensus</Label>
                <Input
                  type="number"
                  min={1}
                  className="h-8 text-xs font-mono"
                  value={councilForm.min_consensus}
                  disabled={!councilForm.enable_council_mode}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) {
                      setCouncilForm((f) => ({ ...f, min_consensus: v }));
                      setCouncilDirty(true);
                    }
                  }}
                />
                <p className="text-[11px] text-gray-400">Min models agreeing to accept result.</p>
              </div>
            </div>

            <SaveBar
              dirty={councilDirty}
              pending={councilMutation.isPending}
              onSave={() => councilMutation.mutate(councilForm)}
              onReset={() => { setCouncilForm({ enable_council_mode: false, council_models: [], aggregation_strategy: 'majority_vote', min_consensus: 2 }); setCouncilDirty(false); }}
            />
            {councilMutation.isError && (
              <p className="text-xs text-red-600">Failed to save council mode settings.</p>
            )}
          </CardContent>
        </Card>

        {/* ── 4. Shadow Mode ───────────────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
              <p className="text-xs font-medium text-gray-900">Shadow Mode</p>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Evaluate alternative providers silently without affecting production responses.
            </p>
          </CardHeader>
          <Separator />
          <CardContent className="px-4 py-4 space-y-4">

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium text-gray-700">Enable Shadow Mode</Label>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Primary provider response returned to user. Shadow providers execute in parallel for evaluation only.
                </p>
              </div>
              <Switch
                checked={shadowForm.enable_shadow_mode}
                onCheckedChange={(v) => {
                  setShadowForm((f) => ({ ...f, enable_shadow_mode: v }));
                  setShadowDirty(true);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Shadow Providers</Label>
              <MultiSelectChips
                options={AVAILABLE_PROVIDERS}
                value={shadowForm.shadow_providers}
                disabled={!shadowForm.enable_shadow_mode}
                onChange={(v) => {
                  setShadowForm((f) => ({ ...f, shadow_providers: v }));
                  setShadowDirty(true);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">
                Traffic Sampling
                <span className="ml-2 text-[11px] text-gray-400 font-normal">
                  {shadowForm.shadow_sampling_rate}% of requests
                </span>
              </Label>
              <div className="flex items-center gap-3">
                <Slider
                  min={1}
                  max={100}
                  step={1}
                  value={[shadowForm.shadow_sampling_rate]}
                  disabled={!shadowForm.enable_shadow_mode}
                  onValueChange={([v]) => {
                    setShadowForm((f) => ({ ...f, shadow_sampling_rate: v }));
                    setShadowDirty(true);
                  }}
                  className="w-48"
                />
                <Input
                  type="number"
                  min={1}
                  max={100}
                  className="h-8 text-xs font-mono w-20"
                  value={shadowForm.shadow_sampling_rate}
                  disabled={!shadowForm.enable_shadow_mode}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v)) {
                      setShadowForm((f) => ({ ...f, shadow_sampling_rate: Math.min(100, Math.max(1, v)) }));
                      setShadowDirty(true);
                    }
                  }}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Capture Metrics</Label>
              <div className="space-y-2.5">
                {[
                  { key: 'capture_latency_metrics' as const, label: 'Capture Latency Metrics', desc: 'Record p50/p95/p99 response latency per shadow provider.' },
                  { key: 'capture_cost_metrics' as const,   label: 'Capture Cost Metrics',   desc: 'Track token usage and estimated cost for shadow requests.' },
                  { key: 'capture_quality_metrics' as const, label: 'Capture Quality Score',  desc: 'Score shadow responses for quality via domain heuristics.' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-gray-700">{label}</p>
                      <p className="text-[11px] text-gray-400">{desc}</p>
                    </div>
                    <Switch
                      checked={shadowForm[key]}
                      disabled={!shadowForm.enable_shadow_mode}
                      onCheckedChange={(v) => {
                        setShadowForm((f) => ({ ...f, [key]: v }));
                        setShadowDirty(true);
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <SaveBar
              dirty={shadowDirty}
              pending={shadowMutation.isPending}
              onSave={() => shadowMutation.mutate(shadowForm)}
              onReset={() => { setShadowForm({ enable_shadow_mode: false, shadow_providers: [], shadow_sampling_rate: 10, capture_latency_metrics: false, capture_cost_metrics: false, capture_quality_metrics: false }); setShadowDirty(false); }}
            />
            {shadowMutation.isError && (
              <p className="text-xs text-red-600">Failed to save shadow mode settings.</p>
            )}
          </CardContent>
        </Card>

        {/* ── 5. Provider Selection Table ──────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-900">Provider Selection Logic</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Edit routing weights and priority order. Changes take effect after saving.
              </p>
            </div>
            {providerDirty && (
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => providerWeightsMutation.mutate({ providers: providerRows })}
                disabled={providerWeightsMutation.isPending}
              >
                {providerWeightsMutation.isPending && <RefreshCw className="h-3 w-3 animate-spin" />}
                Save Weights
              </Button>
            )}
          </CardHeader>
          <Separator />
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Provider', 'Status', 'Avg Latency', 'Success Rate', 'Cost / Token', 'Routing Weight', 'Priority'].map((col) => (
                  <TableHead key={col} className="text-xs font-medium text-gray-500 h-9 px-4 bg-gray-50 hover:bg-gray-50">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {providersLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j} className="px-4 py-3">
                        <Skeleton className="h-3.5 w-16" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                providerRows.map((row) => (
                  <TableRow key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <TableCell className="px-4 py-2.5">
                      <span className="text-xs font-medium text-gray-900">{row.provider}</span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <HealthBadge status={row.status} />
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <LatencyCell ms={row.average_latency_ms} />
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <SuccessRateCell rate={row.success_rate_percent} />
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {row.cost_per_token === null
                        ? <span className="text-xs text-gray-300">—</span>
                        : <span className="text-xs font-mono tabular-nums text-gray-700">${row.cost_per_token.toFixed(7)}</span>
                      }
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          className="h-7 w-16 text-xs font-mono text-center px-1"
                          value={row.routing_weight}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v)) updateProvider(row.id, 'routing_weight', v);
                          }}
                        />
                        <WeightBar weight={row.routing_weight} />
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <Input
                        type="number"
                        min={1}
                        className="h-7 w-14 text-xs font-mono text-center px-1"
                        value={row.priority}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!isNaN(v)) updateProvider(row.id, 'priority', v);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {providerWeightsMutation.isError && (
            <div className="px-4 py-2">
              <p className="text-xs text-red-600">Failed to save provider weights.</p>
            </div>
          )}
        </Card>

      </div>
    </DashboardLayout>
  );
}
