'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { useWasmEngine } from '@/hooks/useWasmEngine';
import {
  Activity,
  AlertTriangle,
  Cpu,
  Eye,
  Gauge,
  RefreshCw,
  Route,
  ShieldCheck,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

interface CircuitBreakerStatus {
  enabled: boolean;
  state: 'closed' | 'open' | 'half-open' | 'half_open';
  trip_count: number;
  last_tripped_at: string | null;
  providers: Array<{
    provider: string;
    state: 'closed' | 'open' | 'half-open' | 'half_open';
    failure_count?: number;
    failures?: number;
    trip_count?: number;
  }>;
}

interface SpeculativeStatus {
  enabled: boolean;
  success_rate: number;
  latency_improvement_ms: number;
  cost_delta_percent: number;
  races_24h: number;
  wins_by_provider: Array<{
    provider: string;
    win_rate: number;
  }>;
}

interface SpeculativeConfig {
  enabled: boolean;
  max_parallel_providers: number;
  timeout_ms: number;
  first_token_threshold_ms: number;
  enabled_providers: string[];
}

interface SpeculativeRace {
  id: string;
  created_at: string;
  winner?: string | null;
  providers: string[];
  latency_improvement_ms: number;
  cost_delta_percent: number;
}

interface SpeculativeRacesResponse {
  races: SpeculativeRace[];
  count: number;
}

interface CouncilStatus {
  enabled: boolean;
  current_council_size: number;
  avg_quality_improvement: number;
  cost_overhead_24h: number;
  last_run: {
    timestamp: string;
    summary: string;
  };
}

interface CouncilConfig {
  enabled: boolean;
  num_models: number;
  models: string[];
  voting_strategy: string;
  quality_threshold: number;
  max_tokens: number;
  cost_limit: number;
  chairman_model?: string;
}

interface CouncilAnalytics {
  total_invocations: number;
  last_24h: number;
  avg_latency_ms: number;
  avg_cost_usd: number;
  by_chairman: Array<{
    chairman_provider: string;
    winner_provider: string;
    avg_total_latency_ms: number;
    avg_ranking_latency_ms: number;
    avg_cost_usd: number;
    invocation_count: number;
  }>;
}

interface ShadowStatus {
  enabled: boolean;
  shadow_traffic_percent: number;
  requests_24h: number;
  quality_delta: number;
  discrepancies_found: number;
  last_updated: string;
}

interface ShadowConfig {
  enabled: boolean;
  shadow_percent: number;
  primary_provider: string;
  shadow_provider: string;
  quality_threshold: number;
  auto_promote: boolean;
  auto_promote_threshold: number;
}

interface StrategyPreference {
  mode: string;
}

interface RouterStatsEntry {
  total_requests?: number;
  average_latency?: number;
  reliability_rate?: number;
  last_updated?: string;
  TotalRequests?: number;
  AverageLatency?: number;
  ReliabilityRate?: number;
  LastUpdated?: string;
}

interface AggregatedInferenceMetrics {
  provider: string;
  model: string;
  request_count: number;
  success_count: number;
  error_count: number;
  total_cost_usd: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  last_updated: string;
}

interface ProviderStatsResponse {
  router_stats: Record<string, RouterStatsEntry>;
  aggregated: Record<string, Record<string, AggregatedInferenceMetrics>>;
  timestamp: number;
  trace_id: string;
}

interface ProviderTelemetryRow {
  provider: string;
  models_seen: number;
  request_count: number;
  success_rate_percent: number | null;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
  total_cost_usd: number;
  last_updated: string | null;
  activity: 'active' | 'watch' | 'idle';
}

const EXECUTION_MODES = [
  {
    label: 'thompson',
    title: 'Adaptive',
    description: 'Learns provider preference over time for adaptive path selection.',
  },
  {
    label: 'speculative',
    title: 'Speculative / Latency',
    description: 'Races providers in parallel and returns the first valid answer.',
  },
  {
    label: 'balanced',
    title: 'Balanced',
    description: 'Trades off quality, latency, and cost at request time.',
  },
  {
    label: 'quality',
    title: 'Quality',
    description: 'Biases toward higher-quality providers for harder work.',
  },
  {
    label: 'cost',
    title: 'Cost',
    description: 'Prefers cheaper providers when acceptable.',
  },
  {
    label: 'council',
    title: 'Council',
    description: 'Runs multiple providers and synthesizes a final answer.',
  },
];

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercent(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${value.toFixed(digits)}%`;
}

function formatMoney(value: number | null | undefined, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `$${value.toFixed(digits)}`;
}

function formatMs(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${Math.round(value)}ms`;
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function normalizeCircuitState(value: string | null | undefined) {
  if (!value) return 'closed';
  return value === 'half_open' ? 'half-open' : value;
}

function parseDelimitedList(value: string) {
  return value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toggleListValue(values: string[], candidate: string) {
  return values.includes(candidate)
    ? values.filter((value) => value !== candidate)
    : [...values, candidate];
}

function deriveProviderTelemetryRows(data?: ProviderStatsResponse): ProviderTelemetryRow[] {
  if (!data) return [];

  const aggregatedProviders = Object.entries(data.aggregated ?? {});
  if (aggregatedProviders.length > 0) {
    return aggregatedProviders
      .map(([provider, modelsMap]) => {
        const modelEntries = Object.values(modelsMap ?? {});
        const requestCount = modelEntries.reduce((sum, entry) => sum + (entry.request_count ?? 0), 0);
        const successCount = modelEntries.reduce((sum, entry) => sum + (entry.success_count ?? 0), 0);
        const weightedLatency = modelEntries.reduce(
          (sum, entry) => sum + ((entry.avg_latency_ms ?? 0) * (entry.request_count ?? 0)),
          0
        );
        const totalCostUsd = modelEntries.reduce((sum, entry) => sum + (entry.total_cost_usd ?? 0), 0);
        const p95Latency = modelEntries.reduce((max, entry) => Math.max(max, entry.p95_latency_ms ?? 0), 0);
        const timestamps = modelEntries
          .map((entry) => entry.last_updated)
          .filter(Boolean)
          .sort();
        const lastUpdated = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null;

        const successRate = requestCount > 0 ? (successCount / requestCount) * 100 : null;
        const avgLatency = requestCount > 0 ? weightedLatency / requestCount : null;
        const activity: ProviderTelemetryRow['activity'] =
          requestCount === 0
            ? 'idle'
            : (successRate !== null && successRate < 90) || (avgLatency !== null && avgLatency > 2000)
            ? 'watch'
            : 'active';

        return {
          provider,
          models_seen: modelEntries.length,
          request_count: requestCount,
          success_rate_percent: successRate,
          avg_latency_ms: avgLatency,
          p95_latency_ms: p95Latency || null,
          total_cost_usd: totalCostUsd,
          last_updated: lastUpdated,
          activity,
        };
      })
      .sort((a, b) => b.request_count - a.request_count);
  }

  return Object.entries(data.router_stats ?? {})
    .map(([provider, stats]) => {
      const totalRequests = stats.total_requests ?? stats.TotalRequests ?? 0;
      const averageLatency = stats.average_latency ?? stats.AverageLatency ?? 0;
      const reliabilityRate = stats.reliability_rate ?? stats.ReliabilityRate ?? 0;
      const lastUpdated = stats.last_updated ?? stats.LastUpdated ?? null;
      const successRate = totalRequests > 0 ? reliabilityRate * 100 : null;
      const activity: ProviderTelemetryRow['activity'] =
        totalRequests === 0
          ? 'idle'
          : (successRate !== null && successRate < 90) || averageLatency > 2000
          ? 'watch'
          : 'active';

      return {
        provider,
        models_seen: 0,
        request_count: totalRequests,
        success_rate_percent: successRate,
        avg_latency_ms: averageLatency || null,
        p95_latency_ms: null,
        total_cost_usd: 0,
        last_updated: lastUpdated,
        activity,
      };
    })
    .sort((a, b) => b.request_count - a.request_count);
}

function StateBadge({ state }: { state: string }) {
  const normalized = normalizeCircuitState(state);
  const styles = normalized === 'open'
    ? 'bg-red-50 text-red-600 border-red-200'
    : normalized === 'half-open'
    ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
    : 'bg-green-50 text-green-700 border-green-200';

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${styles}`}>
      <span className={`h-1.5 w-1.5 rounded-full inline-block ${
        normalized === 'open' ? 'bg-red-500' : normalized === 'half-open' ? 'bg-yellow-400' : 'bg-green-500'
      }`} />
      {normalized}
    </span>
  );
}

function ActivityBadge({ activity }: { activity: ProviderTelemetryRow['activity'] }) {
  const styles = {
    active: 'bg-green-50 text-green-700 border-green-200',
    watch: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    idle: 'bg-gray-50 text-gray-600 border-gray-200',
  } as const;
  const labels = {
    active: 'Active',
    watch: 'Watch',
    idle: 'No Traffic',
  } as const;

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${styles[activity]}`}>
      {labels[activity]}
    </span>
  );
}

function OverviewCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub: string;
  loading?: boolean;
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
  icon: Icon,
  title,
  description,
  actions,
  bodyClassName = 'px-4 py-4',
  className = '',
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
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

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3">
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function KeyValueCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3">
      <p className="text-[10px] text-gray-500 mb-1">{label}</p>
      <div className="text-xs text-gray-900 break-words">{value}</div>
    </div>
  );
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
    <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200 mt-2">
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

export default function ModelsRoutingPage() {
  const queryClient = useQueryClient();
  const { status: wasmStatus, benchmark, runBenchmark } = useWasmEngine();

  const { data: strategyConfig } = useQuery<StrategyPreference>({
    queryKey: ['routing-strategy-config'],
    queryFn: async () => {
      try {
        return await api.get('/v1/routing/strategy');
      } catch {
        return { mode: 'thompson' };
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const {
    data: providerStats,
    isLoading: providersLoading,
    refetch,
  } = useQuery<ProviderStatsResponse>({
    queryKey: ['routing-provider-stats'],
    queryFn: () => api.get('/v1/providers/stats'),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: cbStatus } = useQuery<CircuitBreakerStatus>({
    queryKey: ['routing-circuit-breaker-status'],
    queryFn: async () => {
      try {
        return await api.get('/v1/routing/circuit-breaker/status');
      } catch {
        return {
          enabled: true,
          state: 'closed',
          trip_count: 0,
          last_tripped_at: null,
          providers: [],
        };
      }
    },
    retry: false,
    refetchInterval: 10_000,
  });

  const { data: speculativeStatus } = useQuery<SpeculativeStatus>({
    queryKey: ['routing-speculative-status'],
    queryFn: async () => {
      try {
        return await api.get('/v1/routing/speculative/status');
      } catch {
        return {
          enabled: false,
          success_rate: 0,
          latency_improvement_ms: 0,
          cost_delta_percent: 0,
          races_24h: 0,
          wins_by_provider: [],
        };
      }
    },
    retry: false,
    staleTime: 30_000,
  });

  const { data: speculativeConfig } = useQuery<SpeculativeConfig>({
    queryKey: ['routing-speculative-config'],
    queryFn: async () => {
      try {
        return await api.get('/v1/routing/speculative/config');
      } catch {
        return {
          enabled: false,
          max_parallel_providers: 0,
          timeout_ms: 0,
          first_token_threshold_ms: 0,
          enabled_providers: [],
        };
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const { data: speculativeRaces } = useQuery<SpeculativeRacesResponse>({
    queryKey: ['routing-speculative-races'],
    queryFn: async () => {
      try {
        return await api.get('/v1/routing/speculative/races?limit=6');
      } catch {
        return { races: [], count: 0 };
      }
    },
    retry: false,
    staleTime: 30_000,
  });

  const { data: councilStatus } = useQuery<CouncilStatus>({
    queryKey: ['routing-council-status'],
    queryFn: async () => {
      try {
        return await api.get('/v1/council/status');
      } catch {
        return {
          enabled: false,
          current_council_size: 0,
          avg_quality_improvement: 0,
          cost_overhead_24h: 0,
          last_run: {
            timestamp: new Date().toISOString(),
            summary: 'No council runs recorded yet',
          },
        };
      }
    },
    retry: false,
    staleTime: 30_000,
  });

  const { data: councilConfig } = useQuery<CouncilConfig>({
    queryKey: ['routing-council-config'],
    queryFn: async () => {
      try {
        return await api.get('/v1/council/config');
      } catch {
        return {
          enabled: false,
          num_models: 3,
          models: [],
          voting_strategy: 'majority',
          quality_threshold: 85,
          max_tokens: 2000,
          cost_limit: 0.5,
          chairman_model: '',
        };
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const { data: councilAnalytics } = useQuery<CouncilAnalytics>({
    queryKey: ['routing-council-analytics'],
    queryFn: async () => {
      try {
        return await api.get('/v1/routing/council/analytics');
      } catch {
        return {
          total_invocations: 0,
          last_24h: 0,
          avg_latency_ms: 0,
          avg_cost_usd: 0,
          by_chairman: [],
        };
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const { data: shadowStatus } = useQuery<ShadowStatus>({
    queryKey: ['routing-shadow-status'],
    queryFn: async () => {
      try {
        return await api.get('/v1/shadow/status');
      } catch {
        return {
          enabled: false,
          shadow_traffic_percent: 0,
          requests_24h: 0,
          quality_delta: 0,
          discrepancies_found: 0,
          last_updated: new Date().toISOString(),
        };
      }
    },
    retry: false,
    staleTime: 30_000,
  });

  const { data: shadowConfig } = useQuery<ShadowConfig>({
    queryKey: ['routing-shadow-config'],
    queryFn: async () => {
      try {
        return await api.get('/v1/shadow/config');
      } catch {
        return {
          enabled: false,
          shadow_percent: 10,
          primary_provider: 'openai',
          shadow_provider: 'anthropic',
          quality_threshold: 85,
          auto_promote: false,
          auto_promote_threshold: 95,
        };
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  const providerRows = deriveProviderTelemetryRows(providerStats);
  const activeProviders = providerRows.filter((row) => row.activity === 'active').length;
  const watchedProviders = providerRows.filter((row) => row.activity === 'watch').length;
  const providerOptions = providerRows.length > 0
    ? providerRows.map((row) => row.provider)
    : ['openai', 'anthropic', 'google', 'deepseek', 'xai'];

  const [strategyForm, setStrategyForm] = useState<StrategyPreference>({ mode: 'thompson' });
  const [strategyDirty, setStrategyDirty] = useState(false);

  const [speculativeForm, setSpeculativeForm] = useState<SpeculativeConfig>({
    enabled: false,
    max_parallel_providers: 0,
    timeout_ms: 0,
    first_token_threshold_ms: 0,
    enabled_providers: [],
  });
  const [speculativeDirty, setSpeculativeDirty] = useState(false);

  const [councilForm, setCouncilForm] = useState<CouncilConfig>({
    enabled: false,
    num_models: 3,
    models: [],
    voting_strategy: 'majority',
    quality_threshold: 85,
    max_tokens: 2000,
    cost_limit: 0.5,
    chairman_model: '',
  });
  const [councilDirty, setCouncilDirty] = useState(false);

  const [shadowForm, setShadowForm] = useState<ShadowConfig>({
    enabled: false,
    shadow_percent: 10,
    primary_provider: 'openai',
    shadow_provider: 'anthropic',
    quality_threshold: 85,
    auto_promote: false,
    auto_promote_threshold: 95,
  });
  const [shadowDirty, setShadowDirty] = useState(false);

  useEffect(() => {
    if (!strategyConfig || strategyDirty) return;
    setStrategyForm({
      mode: strategyConfig.mode || 'thompson',
    });
  }, [strategyConfig, strategyDirty]);

  useEffect(() => {
    if (!speculativeConfig || speculativeDirty) return;
    setSpeculativeForm(speculativeConfig);
  }, [speculativeConfig, speculativeDirty]);

  useEffect(() => {
    if (!councilConfig || councilDirty) return;
    setCouncilForm({
      ...councilConfig,
      chairman_model: councilConfig.chairman_model ?? '',
    });
  }, [councilConfig, councilDirty]);

  useEffect(() => {
    if (!shadowConfig || shadowDirty) return;
    setShadowForm({
      ...shadowConfig,
      primary_provider: shadowConfig.primary_provider || 'openai',
      shadow_provider: shadowConfig.shadow_provider || 'anthropic',
    });
  }, [shadowConfig, shadowDirty]);

  const strategyMutation = useMutation({
    mutationFn: (payload: StrategyPreference) => api.post('/v1/routing/strategy', payload),
    onSuccess: async () => {
      setStrategyDirty(false);
      await queryClient.invalidateQueries({ queryKey: ['routing-strategy-config'] });
    },
  });

  const speculativeMutation = useMutation({
    mutationFn: (payload: SpeculativeConfig) => api.post('/v1/routing/speculative', payload),
    onSuccess: async () => {
      setSpeculativeDirty(false);
      await queryClient.invalidateQueries({ queryKey: ['routing-speculative-config'] });
    },
  });

  const councilMutation = useMutation({
    mutationFn: (payload: CouncilConfig) => api.patch('/v1/council/config', payload),
    onSuccess: async () => {
      setCouncilDirty(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['routing-council-config'] }),
        queryClient.invalidateQueries({ queryKey: ['routing-council-status'] }),
      ]);
    },
  });

  const shadowMutation = useMutation({
    mutationFn: (payload: ShadowConfig) => api.patch('/v1/shadow/config', payload),
    onSuccess: async () => {
      setShadowDirty(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['routing-shadow-config'] }),
        queryClient.invalidateQueries({ queryKey: ['routing-shadow-status'] }),
      ]);
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Routing Configuration</h1>
            <p className="text-xs text-black mt-0.5">
              Configure routing-related product surfaces first, then validate behavior with live telemetry below.
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

        <div className="border border-amber-200 bg-amber-50 rounded-3xl px-4 py-3 text-xs text-amber-800">
          This page is configuration-first again. Some controls persist tenant preferences used by orchestration flows,
          while live routing telemetry remains the source of truth for what hosted and local execution surfaces are actually doing right now.
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <OverviewCard
            icon={Route}
            label="Providers Observed"
            value={formatNumber(providerRows.length)}
            sub={`${activeProviders} active, ${watchedProviders} watch`}
            loading={providersLoading}
          />
          <OverviewCard
            icon={Zap}
            label="Speculative Races"
            value={formatNumber(speculativeStatus?.races_24h ?? 0)}
            sub="Recorded in the last 24 hours."
          />
          <OverviewCard
            icon={Users}
            label="Council Runs"
            value={formatNumber(councilAnalytics?.last_24h ?? 0)}
            sub="Council invocations in the last 24 hours."
          />
          <OverviewCard
            icon={Eye}
            label="Shadow Requests"
            value={formatNumber(shadowStatus?.requests_24h ?? 0)}
            sub="Shadow comparison volume in the last 24 hours."
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <SurfaceSection
            icon={Route}
            title="Routing Preference"
            description="Persist the preferred path-selection mode used by execution flows."
            className="h-full"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Execution mode</Label>
                <Select
                  value={strategyForm.mode}
                  onValueChange={(value) => {
                    setStrategyForm({ mode: value });
                    setStrategyDirty(true);
                  }}
                >
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXECUTION_MODES.map((mode) => (
                      <SelectItem key={mode.label} value={mode.label} className="text-xs">
                        {mode.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-gray-500">
                  Supported values are `thompson`, `speculative`, `balanced`, `quality`, `cost`, and `council`.
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3">
                <p className="text-[10px] text-gray-500 mb-1">Persisted value</p>
                <p className="text-xs text-gray-900">
                  Current saved strategy: <span className="font-mono">{strategyConfig?.mode ?? 'thompson'}</span>
                </p>
              </div>

              <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-3 py-3">
                <p className="text-xs font-medium text-gray-900">Scope</p>
                <p className="text-[11px] text-gray-500 mt-1">
                  This saves a routing preference for orchestration surfaces. Adaptive-router internals and provider telemetry remain independent.
                </p>
              </div>

              <SaveBar
                dirty={strategyDirty}
                pending={strategyMutation.isPending}
                onSave={() => strategyMutation.mutate(strategyForm)}
                onReset={() => {
                  setStrategyForm({ mode: 'thompson' });
                  setStrategyDirty(false);
                }}
              />
              {strategyMutation.isError && (
                <p className="text-xs text-red-600">Failed to save routing preference.</p>
              )}
            </div>
          </SurfaceSection>

          <SurfaceSection
            icon={Cpu}
            title="In-Browser Routing Engine"
            description="WASM-backed path-selection and circuit-breaker support surfaced in-browser for observability and benchmarking."
            className="xl:col-span-2"
            actions={(
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {wasmStatus.bindingReady && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 inline-block" />
                    Live
                  </span>
                )}
                {!wasmStatus.bindingReady && wasmStatus.loading && (
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
                    className="h-7 text-[11px] px-2.5"
                    onClick={() => runBenchmark(500)}
                  >
                    Run Benchmark
                  </Button>
                )}
              </div>
            )}
          >
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <KeyValueCard
                label="Module size"
                value={wasmStatus.moduleSize ? `${(wasmStatus.moduleSize / 1024).toFixed(1)} KB` : '-'}
              />
              <KeyValueCard
                label="Compile time"
                value={wasmStatus.compileTimeMs != null ? `${wasmStatus.compileTimeMs}ms` : '-'}
              />
              <KeyValueCard
                label="Benchmark avg"
                value={benchmark ? `${benchmark.avgPerIterationUs}us` : '-'}
              />
              <KeyValueCard
                label="Exports"
                value={wasmStatus.exports.length > 0 ? `${wasmStatus.exports.length} functions` : '-'}
              />
              <KeyValueCard
                label="Binding"
                value={wasmStatus.bindingReady ? 'wired' : wasmStatus.loaded ? 'pending' : '-'}
              />
            </div>
            {wasmStatus.error && (
              <p className="mt-3 text-[11px] text-red-600">{wasmStatus.error}</p>
            )}
            {!wasmStatus.supported && (
              <p className="mt-3 text-[11px] text-yellow-700">
                WebAssembly is not supported in this browser. Execution still falls back to the server-side path-selection flow.
              </p>
            )}
          </SurfaceSection>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <SurfaceSection
            icon={Zap}
            title="Speculative Configuration"
            description="Configure parallel provider racing preferences and compare them against live backend status."
            className="h-full"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 flex items-center justify-between gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-700">Enable speculative preference</Label>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Persist a parallel-race preference for request flows that honor the routing config store.
                  </p>
                </div>
                <Switch
                  checked={speculativeForm.enabled}
                  onCheckedChange={(checked) => {
                    setSpeculativeForm((current) => ({ ...current, enabled: checked }));
                    setSpeculativeDirty(true);
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Max parallel providers</Label>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    className="h-8 text-xs font-mono bg-white"
                    value={speculativeForm.max_parallel_providers}
                    onChange={(event) => {
                      const value = parseInt(event.target.value, 10);
                      if (!Number.isNaN(value)) {
                        setSpeculativeForm((current) => ({ ...current, max_parallel_providers: value }));
                        setSpeculativeDirty(true);
                      }
                    }}
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Timeout (ms)</Label>
                  <Input
                    type="number"
                    min={100}
                    className="h-8 text-xs font-mono bg-white"
                    value={speculativeForm.timeout_ms}
                    onChange={(event) => {
                      const value = parseInt(event.target.value, 10);
                      if (!Number.isNaN(value)) {
                        setSpeculativeForm((current) => ({ ...current, timeout_ms: value }));
                        setSpeculativeDirty(true);
                      }
                    }}
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium text-gray-700">First token threshold (ms)</Label>
                  <Input
                    type="number"
                    min={50}
                    className="h-8 text-xs font-mono bg-white"
                    value={speculativeForm.first_token_threshold_ms}
                    onChange={(event) => {
                      const value = parseInt(event.target.value, 10);
                      if (!Number.isNaN(value)) {
                        setSpeculativeForm((current) => ({ ...current, first_token_threshold_ms: value }));
                        setSpeculativeDirty(true);
                      }
                    }}
                  />
                  <p className="text-[11px] text-gray-500">
                    Backend-reported enabled providers: {speculativeConfig?.enabled_providers?.length ? speculativeConfig.enabled_providers.join(', ') : 'None reported'}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-2">
                <div>
                  <Label className="text-xs font-medium text-gray-700">Enabled providers</Label>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Persist which providers are eligible for speculative races.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {providerOptions.map((provider) => {
                    const selected = speculativeForm.enabled_providers.includes(provider);
                    return (
                      <button
                        key={`speculative-provider-${provider}`}
                        type="button"
                        className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                          selected
                            ? 'border-gray-900 bg-gray-900 text-white'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                        onClick={() => {
                          setSpeculativeForm((current) => ({
                            ...current,
                            enabled_providers: toggleListValue(current.enabled_providers, provider),
                          }));
                          setSpeculativeDirty(true);
                        }}
                      >
                        {provider}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Live enabled" value={speculativeStatus?.enabled ? 'Yes' : 'No'} />
                <MiniStat label="Success rate" value={formatPercent(speculativeStatus?.success_rate ?? 0)} />
                <MiniStat label="Latency gain" value={formatMs(speculativeStatus?.latency_improvement_ms ?? 0)} />
                <MiniStat label="Recent races" value={formatNumber(speculativeRaces?.count ?? 0)} />
              </div>

              <SaveBar
                dirty={speculativeDirty}
                pending={speculativeMutation.isPending}
                onSave={() => speculativeMutation.mutate(speculativeForm)}
                onReset={() => {
                  setSpeculativeForm(speculativeConfig ?? {
                    enabled: false,
                    max_parallel_providers: 0,
                    timeout_ms: 0,
                    first_token_threshold_ms: 0,
                    enabled_providers: [],
                  });
                  setSpeculativeDirty(false);
                }}
              />
              {speculativeMutation.isError && (
                <p className="text-xs text-red-600">Failed to save speculative configuration.</p>
              )}
            </div>
          </SurfaceSection>

          <SurfaceSection
            icon={Users}
            title="Council Configuration"
            description="Configure the council surface backed by `/v1/council/config` and validate it against live council analytics."
            className="h-full"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 flex items-center justify-between gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-700">Enable council mode</Label>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Persist council evaluation preferences and chairman selection for council-capable flows.
                  </p>
                </div>
                <Switch
                  checked={councilForm.enabled}
                  onCheckedChange={(checked) => {
                    setCouncilForm((current) => ({ ...current, enabled: checked }));
                    setCouncilDirty(true);
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Council size</Label>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    className="h-8 text-xs font-mono bg-white"
                    value={councilForm.num_models}
                    onChange={(event) => {
                      const value = parseInt(event.target.value, 10);
                      if (!Number.isNaN(value)) {
                        setCouncilForm((current) => ({ ...current, num_models: value }));
                        setCouncilDirty(true);
                      }
                    }}
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Voting strategy</Label>
                  <Select
                    value={councilForm.voting_strategy}
                    onValueChange={(value) => {
                      setCouncilForm((current) => ({ ...current, voting_strategy: value }));
                      setCouncilDirty(true);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['majority', 'weighted', 'consensus'].map((value) => (
                        <SelectItem key={value} value={value} className="text-xs">
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Chairman model</Label>
                  <Input
                    className="h-8 text-xs bg-white"
                    value={councilForm.chairman_model ?? ''}
                    onChange={(event) => {
                      setCouncilForm((current) => ({ ...current, chairman_model: event.target.value }));
                      setCouncilDirty(true);
                    }}
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Quality threshold</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-8 text-xs font-mono bg-white"
                    value={councilForm.quality_threshold}
                    onChange={(event) => {
                      const value = parseFloat(event.target.value);
                      if (!Number.isNaN(value)) {
                        setCouncilForm((current) => ({ ...current, quality_threshold: value }));
                        setCouncilDirty(true);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Council models</Label>
                <Textarea
                  className="min-h-[96px] text-xs bg-white"
                  placeholder="gpt-4o, claude-sonnet-4-5, gemini-2.5-pro"
                  value={councilForm.models.join(', ')}
                  onChange={(event) => {
                    setCouncilForm((current) => ({
                      ...current,
                      models: parseDelimitedList(event.target.value),
                    }));
                    setCouncilDirty(true);
                  }}
                />
                <p className="text-[11px] text-gray-500">
                  Enter model ids separated by commas or new lines. Saved count: {formatNumber(councilForm.models.length)}.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Max tokens</Label>
                  <Input
                    type="number"
                    min={1}
                    className="h-8 text-xs font-mono bg-white"
                    value={councilForm.max_tokens}
                    onChange={(event) => {
                      const value = parseInt(event.target.value, 10);
                      if (!Number.isNaN(value)) {
                        setCouncilForm((current) => ({ ...current, max_tokens: value }));
                        setCouncilDirty(true);
                      }
                    }}
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Cost limit</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="h-8 text-xs font-mono bg-white"
                    value={councilForm.cost_limit}
                    onChange={(event) => {
                      const value = parseFloat(event.target.value);
                      if (!Number.isNaN(value)) {
                        setCouncilForm((current) => ({ ...current, cost_limit: value }));
                        setCouncilDirty(true);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Live enabled" value={councilStatus?.enabled ? 'Yes' : 'No'} />
                <MiniStat label="Observed size" value={formatNumber(councilStatus?.current_council_size ?? 0)} />
                <MiniStat label="Quality lift" value={formatPercent(councilStatus?.avg_quality_improvement ?? 0, 2)} />
                <MiniStat label="Last 24h runs" value={formatNumber(councilAnalytics?.last_24h ?? 0)} />
              </div>

              <SaveBar
                dirty={councilDirty}
                pending={councilMutation.isPending}
                onSave={() => councilMutation.mutate(councilForm)}
                onReset={() => {
                  setCouncilForm(councilConfig ?? {
                    enabled: false,
                    num_models: 3,
                    models: [],
                    voting_strategy: 'majority',
                    quality_threshold: 85,
                    max_tokens: 2000,
                    cost_limit: 0.5,
                    chairman_model: '',
                  });
                  setCouncilDirty(false);
                }}
              />
              {councilMutation.isError && (
                <p className="text-xs text-red-600">Failed to save council configuration.</p>
              )}
            </div>
          </SurfaceSection>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <SurfaceSection
            icon={Eye}
            title="Shadow Configuration"
            description="Configure primary-vs-shadow comparison behavior backed by `/v1/shadow/config`."
            className="h-full"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 flex items-center justify-between gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-700">Enable shadow evaluation</Label>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Compare a primary provider against a shadow provider without changing the returned user response.
                  </p>
                </div>
                <Switch
                  checked={shadowForm.enabled}
                  onCheckedChange={(checked) => {
                    setShadowForm((current) => ({ ...current, enabled: checked }));
                    setShadowDirty(true);
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Primary provider</Label>
                  <Select
                    value={shadowForm.primary_provider}
                    onValueChange={(value) => {
                      setShadowForm((current) => ({ ...current, primary_provider: value }));
                      setShadowDirty(true);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providerOptions.map((provider) => (
                        <SelectItem key={`primary-${provider}`} value={provider} className="text-xs">
                          {provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Shadow provider</Label>
                  <Select
                    value={shadowForm.shadow_provider}
                    onValueChange={(value) => {
                      setShadowForm((current) => ({ ...current, shadow_provider: value }));
                      setShadowDirty(true);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {providerOptions.map((provider) => (
                        <SelectItem key={`shadow-${provider}`} value={provider} className="text-xs">
                          {provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Traffic sampled (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-8 text-xs font-mono bg-white"
                    value={shadowForm.shadow_percent}
                    onChange={(event) => {
                      const value = parseInt(event.target.value, 10);
                      if (!Number.isNaN(value)) {
                        setShadowForm((current) => ({ ...current, shadow_percent: value }));
                        setShadowDirty(true);
                      }
                    }}
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Quality threshold</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="h-8 text-xs font-mono bg-white"
                    value={shadowForm.quality_threshold}
                    onChange={(event) => {
                      const value = parseFloat(event.target.value);
                      if (!Number.isNaN(value)) {
                        setShadowForm((current) => ({ ...current, quality_threshold: value }));
                        setShadowDirty(true);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 flex items-center justify-between gap-4">
                <div>
                  <Label className="text-xs font-medium text-gray-700">Auto promote</Label>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Automatically swap the shadow provider into the primary slot when comparisons meet the configured threshold.
                  </p>
                </div>
                <Switch
                  checked={shadowForm.auto_promote}
                  onCheckedChange={(checked) => {
                    setShadowForm((current) => ({ ...current, auto_promote: checked }));
                    setShadowDirty(true);
                  }}
                />
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3 space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Auto promote threshold</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="h-8 text-xs font-mono bg-white"
                  value={shadowForm.auto_promote_threshold}
                  onChange={(event) => {
                    const value = parseFloat(event.target.value);
                    if (!Number.isNaN(value)) {
                      setShadowForm((current) => ({ ...current, auto_promote_threshold: value }));
                      setShadowDirty(true);
                    }
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Live enabled" value={shadowStatus?.enabled ? 'Yes' : 'No'} />
                <MiniStat label="Requests 24h" value={formatNumber(shadowStatus?.requests_24h ?? 0)} />
                <MiniStat label="Quality delta" value={formatPercent(shadowStatus?.quality_delta ?? 0, 2)} />
                <MiniStat label="Discrepancies" value={formatNumber(shadowStatus?.discrepancies_found ?? 0)} />
              </div>

              <SaveBar
                dirty={shadowDirty}
                pending={shadowMutation.isPending}
                onSave={() => shadowMutation.mutate(shadowForm)}
                onReset={() => {
                  setShadowForm(shadowConfig ?? {
                    enabled: false,
                    shadow_percent: 10,
                    primary_provider: 'openai',
                    shadow_provider: 'anthropic',
                    quality_threshold: 85,
                    auto_promote: false,
                    auto_promote_threshold: 95,
                  });
                  setShadowDirty(false);
                }}
              />
              {shadowMutation.isError && (
                <p className="text-xs text-red-600">Failed to save shadow configuration.</p>
              )}
            </div>
          </SurfaceSection>

          <SurfaceSection
            icon={ShieldCheck}
            title="Validation Context"
            description="Live telemetry to validate whether the current configuration is behaving as expected."
            className="h-full"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Breaker state" value={<StateBadge state={cbStatus?.state ?? 'closed'} />} />
                <MiniStat label="Total trips" value={formatNumber(cbStatus?.trip_count ?? 0)} />
                <MiniStat label="Active providers" value={formatNumber(activeProviders)} />
                <MiniStat label="Providers on watch" value={formatNumber(watchedProviders)} />
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3">
                <p className="text-[10px] text-gray-500 mb-1">Last breaker event</p>
                <p className="text-xs text-gray-900">{formatTimestamp(cbStatus?.last_tripped_at)}</p>
              </div>

              <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
                {(cbStatus?.providers ?? []).length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-gray-500">No provider breaker events recorded yet.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {(cbStatus?.providers ?? []).slice(0, 5).map((provider) => (
                      <div key={provider.provider} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-gray-900">{provider.provider}</p>
                          <p className="text-[11px] text-gray-500">
                            failures: {formatNumber(provider.failure_count ?? provider.failures ?? 0)}, trips: {formatNumber(provider.trip_count ?? 0)}
                          </p>
                        </div>
                        <StateBadge state={provider.state} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SurfaceSection>
        </div>

        <SurfaceSection
          icon={Activity}
          title="Provider Telemetry"
          description="Observed request traffic derived from current provider stats APIs. This validates configuration impact but is not itself the configuration surface."
          bodyClassName="px-4 py-4"
        >
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {['Provider', 'Activity', 'Models Seen', 'Requests', 'Success Rate', 'Avg Latency', 'P95 Latency', 'Total Cost', 'Last Seen'].map((col) => (
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
                        {Array.from({ length: 9 }).map((_, j) => (
                          <TableCell key={j} className="px-4 py-3">
                            <Skeleton className="h-3.5 w-16" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : providerRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="px-4 py-10 text-center text-xs text-gray-500">
                        No provider telemetry available yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    providerRows.map((row) => (
                      <TableRow key={row.provider} className="border-b border-gray-100 hover:bg-gray-50">
                        <TableCell className="px-4 py-2.5 text-xs font-medium text-gray-900">{row.provider}</TableCell>
                        <TableCell className="px-4 py-2.5"><ActivityBadge activity={row.activity} /></TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-700">{formatNumber(row.models_seen)}</TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-700">{formatNumber(row.request_count)}</TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-700">{formatPercent(row.success_rate_percent)}</TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-700">{formatMs(row.avg_latency_ms)}</TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-700">{formatMs(row.p95_latency_ms)}</TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-700">{formatMoney(row.total_cost_usd)}</TableCell>
                        <TableCell className="px-4 py-2.5 text-xs text-gray-700">{formatTimestamp(row.last_updated)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </SurfaceSection>

        <SurfaceSection
          icon={Users}
          title="Council Outcomes"
          description="Per-chairman council behavior from persisted analytics."
          bodyClassName="px-4 py-4"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <MiniStat label="Total invocations" value={formatNumber(councilAnalytics?.total_invocations ?? 0)} />
            <MiniStat label="Last 24h" value={formatNumber(councilAnalytics?.last_24h ?? 0)} />
            <MiniStat label="Avg latency" value={formatMs(councilAnalytics?.avg_latency_ms ?? 0)} />
            <MiniStat label="Avg cost" value={formatMoney(councilAnalytics?.avg_cost_usd ?? 0, 4)} />
          </div>

          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
            {(councilAnalytics?.by_chairman ?? []).length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-gray-500">
                No council analytics available yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {['Chairman', 'Winner', 'Avg Latency', 'Ranking Latency', 'Avg Cost', 'Invocations'].map((col) => (
                        <TableHead key={col} className="text-xs font-medium text-gray-500 h-8 px-4 bg-gray-50">
                          {col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(councilAnalytics?.by_chairman ?? []).map((row, index) => (
                      <TableRow key={`${row.chairman_provider}-${row.winner_provider}-${index}`} className="border-b border-gray-100">
                        <TableCell className="px-4 py-2 text-xs font-mono text-gray-700">{row.chairman_provider}</TableCell>
                        <TableCell className="px-4 py-2 text-xs font-mono text-gray-700">{row.winner_provider}</TableCell>
                        <TableCell className="px-4 py-2 text-xs tabular-nums text-gray-700">{formatMs(row.avg_total_latency_ms)}</TableCell>
                        <TableCell className="px-4 py-2 text-xs tabular-nums text-gray-700">{formatMs(row.avg_ranking_latency_ms)}</TableCell>
                        <TableCell className="px-4 py-2 text-xs tabular-nums text-gray-700">{formatMoney(row.avg_cost_usd, 5)}</TableCell>
                        <TableCell className="px-4 py-2 text-xs tabular-nums text-gray-700">{formatNumber(row.invocation_count)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </SurfaceSection>
      </div>
    </DashboardLayout>
  );
}
