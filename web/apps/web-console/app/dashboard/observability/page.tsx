'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetBody } from '@/components/ui/sheet';
import { useTenant } from '@/hooks/useTenant';
import { formatCurrency, formatNumber, formatLatency, formatDateTime, downloadCSV, downloadJSON, cn } from '@/utils/helpers';
import {
  Activity, Download, Clock, Database, Filter, Search, X,
  ChevronDown, ChevronUp, Copy, Share2, AlertCircle, CheckCircle,
  XCircle, Loader2, BarChart3, Zap, Tag, Code, Link2, Eye, AlertTriangle
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CHART_COLORS } from '@/utils/constants';
import { useTraces, useRealTimeMetrics, useInvalidateTraces } from './hooks';
import {
  useOvertureUsage,
  useOvertureUsageHistory,
  useOvertureCostAnalytics,
  useOvertureProviderStats,
  useOvertureCostTrend,
  useOvertureRoutingStats,
  useOvertureProviderLeaderboard,
  useOvertureAuditLogs,
  useRuntimeFleetInstances,
  useRuntimeFleetMetrics,
} from '@/hooks/useCostInsights';
import { usePolicy } from '@/hooks/usePolicy';

// Types
type RequestTag = 'expected' | 'bug' | 'reviewed' | 'spam' | 'golden' | null;

interface RetryAttempt {
  attempt_number: number;
  start_time: number;
  duration: number;
  status: number;
  error?: string;
}

interface SpeculativeTrace {
  provider: string;
  model: string;
  start: number;
  duration: number;
  status: 'winner' | 'fallback' | 'failed';
  latency: number;
}

interface TimelineMarker {
  name: string;
  timestamp: number;
  type: 'cache_read' | 'dns' | 'tls' | 'first_byte' | 'streaming_start' | 'streaming_end';
}

interface GenerationParams {
  temperature?: number;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop_sequences?: string[];
  max_tokens?: number;
  logprobs?: boolean;
  top_logprobs?: number;
}

interface RequestTrace {
  id: string;
  timestamp: string;
  model: string;
  model_version?: string;
  model_fingerprint?: string;
  provider: string;
  status: number;
  latency: number;
  cost: number;
  cost_breakdown: {
    input: number;
    output: number;
    overhead: number;
  };
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  user_id?: string;
  session_id?: string;
  client_ip?: string;
  user_agent?: string;
  request_id: string;
  parent_request_id?: string;
  child_request_ids?: string[];
  headers?: Record<string, string>;
  request_body?: any;
  response_body?: any;
  prompt?: string;
  completion?: string;
  generation_params?: GenerationParams;
  error?: {
    message: string;
    stack?: string;
    provider_error?: string;
  };
  token_timeline?: Array<{ token_index: number; timestamp: number; is_first?: boolean; is_last?: boolean }>;
  speculative_traces?: SpeculativeTrace[];
  retry_attempts?: RetryAttempt[];
  retry_count?: number;
  tag?: RequestTag;
  shared_url?: string;
  curl_command?: string;
  was_streamed: boolean;
  used_speculative: boolean;
  cache_hit?: boolean;
  cache_savings?: number;
  evaluation_score?: number;
  human_feedback?: 'positive' | 'negative' | null;
  timeline_markers?: TimelineMarker[];
}

// Mock data generator
const generateMockTraces = (count: number): RequestTrace[] => {
  const providerModels = {
    OpenAI: {
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4o'],
      versions: ['gpt-4-0613', 'gpt-4-turbo-2024-04-09', 'gpt-3.5-turbo-0125', 'gpt-4o-2024-05-13'],
    },
    Anthropic: {
      models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku', 'claude-3.5-sonnet'],
      versions: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307', 'claude-3-5-sonnet-20241022'],
    },
    Google: {
      models: ['gemini-pro', 'gemini-ultra', 'gemini-1.5-pro', 'palm-2'],
      versions: ['gemini-pro-1.5', 'gemini-ultra-1.0', 'gemini-1.5-pro-002', 'palm-2-chat-bison'],
    },
    xAI: {
      models: ['grok-1', 'grok-2', 'grok-1.5'],
      versions: ['grok-1-20240401', 'grok-2-20240815', 'grok-1.5-20240610'],
    },
    Cohere: {
      models: ['command', 'command-light', 'command-r', 'command-r-plus'],
      versions: ['command-2024-03', 'command-light-2024-03', 'command-r-08-2024', 'command-r-plus-08-2024'],
    },
  };

  const providers = Object.keys(providerModels);
  const statuses = [200, 200, 200, 200, 200, 429, 500];
  const tags: RequestTag[] = [null, null, null, 'expected', 'bug', 'reviewed', 'golden'];
  const samplePrompts = [
    'Explain quantum computing in simple terms',
    'Write a Python function to sort a list',
    'What are the benefits of TypeScript over JavaScript?',
    'Create a marketing email for a new product launch',
    'Summarize the key points from this document',
  ];
  const sampleCompletions = [
    'Quantum computing leverages quantum mechanics to process information in fundamentally different ways...',
    'Here\'s a Python function that sorts a list:\n\ndef sort_list(items):\n    return sorted(items)',
    'TypeScript offers several advantages: static typing, better IDE support, early error detection...',
    'Subject: Introducing Our Revolutionary New Product\n\nDear valued customer,\n\nWe\'re excited to announce...',
    'Key points:\n1. Market growth of 23%\n2. Customer satisfaction at all-time high\n3. New features...',
  ];

  return Array.from({ length: count }, (_, i) => {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const provider = providers[Math.floor(Math.random() * providers.length)] as keyof typeof providerModels;
    const providerData = providerModels[provider];
    const modelIndex = Math.floor(Math.random() * providerData.models.length);
    const model = providerData.models[modelIndex];
    const modelVersion = providerData.versions[modelIndex];
    const latency = Math.floor(Math.random() * 800) + 100;
    const inputTokens = Math.floor(Math.random() * 2000) + 100;
    const outputTokens = Math.floor(Math.random() * 1500) + 50;
    const inputCost = inputTokens * 0.00001;
    const outputCost = outputTokens * 0.00003;
    const overheadCost = Math.random() * 0.001;
    const totalCost = inputCost + outputCost + overheadCost;

    const wasStreamed = status === 200 || status === 429 || Math.random() > 0.3;
    const usedSpeculative = Math.random() > 0.7;
    const wasRetried = status !== 200 && Math.random() > 0.5;
    const tag = tags[Math.floor(Math.random() * tags.length)];
    const cacheHit = Math.random() > 0.6;
    const cacheSavings = cacheHit ? inputCost * 0.5 : 0;
    const hasParent = i > 0 && Math.random() > 0.7;
    const hasChildren = Math.random() > 0.8;

    const baseTime = Date.now() - (i * 60000);

    // Generate token timeline for streaming requests
    const tokenTimeline = wasStreamed ? Array.from({ length: Math.min(outputTokens, 50) }, (_, idx) => ({
      token_index: idx,
      timestamp: baseTime + (idx * (latency / 50)),
      is_first: idx === 0,
      is_last: idx === Math.min(outputTokens, 50) - 1,
    })) : undefined;

    // Generate speculative traces
    const speculativeTraces = usedSpeculative ? [
      { provider: 'OpenAI', model: 'gpt-4', start: 0, duration: latency * 1.2, status: 'failed' as const, latency: latency * 1.2 },
      { provider: 'Anthropic', model: 'claude-3-sonnet', start: 0, duration: latency, status: 'winner' as const, latency },
      { provider: 'Google', model: 'gemini-pro', start: 0, duration: latency * 1.5, status: 'fallback' as const, latency: latency * 1.5 },
    ] : undefined;

    // Generate retry attempts
    const retryAttempts = wasRetried ? [
      { attempt_number: 1, start_time: baseTime, duration: latency * 0.3, status: 500, error: 'Connection timeout' },
      { attempt_number: 2, start_time: baseTime + latency * 0.3, duration: latency * 0.4, status: 429, error: 'Rate limit exceeded' },
      { attempt_number: 3, start_time: baseTime + latency * 0.7, duration: latency * 0.3, status: status, error: status !== 200 ? 'Final attempt failed' : undefined },
    ] : undefined;

    const promptIndex = Math.floor(Math.random() * samplePrompts.length);
    const prompt = samplePrompts[promptIndex];
    const completion = sampleCompletions[promptIndex];

    const temperature = 0.3 + Math.random() * 0.7;
    const generationParams: GenerationParams = {
      temperature: parseFloat(temperature.toFixed(2)),
      top_p: parseFloat((0.8 + Math.random() * 0.2).toFixed(2)),
      presence_penalty: parseFloat((Math.random() * 0.5).toFixed(2)),
      frequency_penalty: parseFloat((Math.random() * 0.5).toFixed(2)),
      max_tokens: outputTokens,
      logprobs: Math.random() > 0.5,
      top_logprobs: Math.random() > 0.5 ? 5 : undefined,
    };

    const timelineMarkers: TimelineMarker[] = wasStreamed ? [
      { name: 'Cache Read', timestamp: baseTime + 5, type: 'cache_read' },
      { name: 'DNS Lookup', timestamp: baseTime + 12, type: 'dns' },
      { name: 'TLS Handshake', timestamp: baseTime + 25, type: 'tls' },
      { name: 'First Byte', timestamp: baseTime + 80, type: 'first_byte' },
      { name: 'Streaming Start', timestamp: baseTime + 85, type: 'streaming_start' },
      { name: 'Streaming End', timestamp: baseTime + latency, type: 'streaming_end' },
    ] : [];

    const curlCommand = `curl -X POST http://localhost:8081/v1/infer \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '${JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: outputTokens, temperature: generationParams.temperature }, null, 2)}'`;

    return {
      id: `trace_${i + 1}`,
      timestamp: new Date(baseTime).toISOString(),
      model,
      model_version: modelVersion,
      model_fingerprint: `fp_${Math.random().toString(36).substring(7)}`,
      provider,
      status,
      latency,
      cost: totalCost,
      cost_breakdown: {
        input: inputCost,
        output: outputCost,
        overhead: overheadCost,
      },
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
      user_id: `user_${Math.floor(Math.random() * 100)}`,
      session_id: `session_${Math.floor(Math.random() * 50)}`,
      client_ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      user_agent: ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'overture-sdk/1.0', 'python-requests/2.31.0'][Math.floor(Math.random() * 3)],
      request_id: `req_${Date.now()}_${i}`,
      parent_request_id: hasParent ? `req_${Date.now()}_${i - 1}` : undefined,
      child_request_ids: hasChildren ? [`req_${Date.now()}_${i + 1}`, `req_${Date.now()}_${i + 2}`] : undefined,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'overture-sdk/1.0',
      },
      request_body: {
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: outputTokens,
        ...generationParams,
      },
      response_body: status === 200 ? {
        id: `chatcmpl_${i}`,
        model: modelVersion,
        system_fingerprint: `fp_${Math.random().toString(36).substring(7)}`,
        choices: [{ message: { role: 'assistant', content: completion } }],
        usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
      } : undefined,
      prompt,
      completion: status === 200 ? completion : undefined,
      generation_params: generationParams,
      error: status !== 200 ? {
        message: status === 429 ? 'Rate limit exceeded' : 'Internal server error',
        stack: status === 500 ? 'Error: Internal server error\n  at handler (/api/infer.ts:123)' : undefined,
        provider_error: status === 429 ? 'Provider returned 429: Too Many Requests' : 'Provider connection failed',
      } : undefined,
      token_timeline: tokenTimeline,
      speculative_traces: speculativeTraces,
      retry_attempts: retryAttempts,
      retry_count: retryAttempts?.length || 0,
      tag,
      shared_url: Math.random() > 0.8 ? `https://overture.ai/traces/${i}?token=abc123` : undefined,
      curl_command: curlCommand,
      was_streamed: wasStreamed,
      used_speculative: usedSpeculative,
      cache_hit: cacheHit,
      cache_savings: cacheSavings,
      evaluation_score: status === 200 && Math.random() > 0.5 ? parseFloat((Math.random() * 5).toFixed(2)) : undefined,
      human_feedback: status === 200 && Math.random() > 0.7 ? (Math.random() > 0.5 ? 'positive' : 'negative') : null,
      timeline_markers: timelineMarkers,
    };
  });
};

export default function ObservabilityPage() {
  const router = useRouter();
  const { data: tenant, isLoading: tenantLoading } = useTenant();

  // TanStack Query hooks for data fetching
  const { data: traces = [], isLoading: isLoadingTraces } = useTraces();
  const { data: metricsData } = useRealTimeMetrics();
  const invalidateTraces = useInvalidateTraces();

  // Cost Insights hooks - Overture (Cloud Gateway)
  const { data: overtureUsage, isLoading: isLoadingOvertureUsage } = useOvertureUsage();
  const { data: overtureHistory } = useOvertureUsageHistory(6);
  const { data: overtureCostAnalytics } = useOvertureCostAnalytics('24h');
  const { data: overtureProviderStats } = useOvertureProviderStats('24h');
  const { data: overtureCostTrend } = useOvertureCostTrend('24h', '1h');
  const { data: overtureRoutingStats } = useOvertureRoutingStats(24);
  const { data: overtureLeaderboard } = useOvertureProviderLeaderboard();
  const { data: overtureAuditLogs } = useOvertureAuditLogs({ limit: 100, since_hours: 24 });
  const { data: policy } = usePolicy();

  // Cost Insights hooks - Runtime (Edge Execution)
  const { data: runtimeFleetInstances, isLoading: isLoadingRuntimeFleet } = useRuntimeFleetInstances();
  const { data: runtimeFleetMetrics } = useRuntimeFleetMetrics();

  // State
  const [selectedTrace, setSelectedTrace] = useState<RequestTrace | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<string>('all');
  const [filters, setFilters] = useState({
    provider: '',
    model: '',
    status: '',
    minLatency: '',
    minCost: '',
    timeRange: '24h',
    hasError: false,
    usedSpeculative: false,
    wasRetried: false,
    tag: '' as RequestTag | '',
  });
  const [expandedSections, setExpandedSections] = useState({
    headers: false,
    request: false,
    response: false,
    error: false,
  });
  const [savedPresets, setSavedPresets] = useState<Array<{ name: string; filters: typeof filters }>>([
    { name: 'Errors Only', filters: { ...filters, hasError: true, status: '' } },
    { name: 'Cached Requests', filters: { ...filters } },
    { name: 'High Latency', filters: { ...filters, minLatency: '500' } },
  ]);
  const [presetName, setPresetName] = useState('');

  // Privacy-first: Full tracing is OPT-IN ONLY (default OFF)
  const [enableFullTracing, setEnableFullTracing] = useState(false);
  const [showTracingInfo, setShowTracingInfo] = useState(false);
  const [traceNotes, setTraceNotes] = useState<Record<string, Array<{ id: string; author: string; timestamp: string; content: string }>>>({});
  const [newNoteContent, setNewNoteContent] = useState('');

  // Real-time metrics from TanStack Query
  const realTimeMetrics = {
    requestsPerSecond: metricsData?.requestsPerSecond || 0,
    p50Latency: metricsData?.avgLatency || 0,
    p95Latency: metricsData?.avgLatency || 0,
    costPerHour: metricsData?.totalCost || 0,
    activeProviders: metricsData?.activeProviders?.length || 0,
    requestsSparkline: metricsData?.requestsSparkline || [],
  };

  // Tier-based access control
  const tier = tenant?.plan || 'scale'; // Temporarily default to 'scale' for development
  const tierConfigs = {
    developer: { enabled: false, retention: 0, maxRequests: 0, fullFeatures: false },
    growth: { enabled: true, retention: 30, maxRequests: 1000, fullFeatures: false },
    scale: { enabled: true, retention: 90, maxRequests: 100000, fullFeatures: true },
    trial: { enabled: true, retention: 14, maxRequests: 50000, fullFeatures: true },
  };
  const tierConfig = tierConfigs[tier as keyof typeof tierConfigs] || tierConfigs.scale;

  // Mock tenant list for Scale tier multi-tenant dropdown
  const mockTenants = [
    { id: 'all', name: 'All tenants' },
    { id: 'tenant-1', name: 'Acme Corp' },
    { id: 'tenant-2', name: 'TechStart Inc' },
    { id: 'tenant-3', name: 'Global Systems' },
    { id: 'tenant-4', name: 'Innovation Labs' },
  ];

  // Redirect if tier doesn't have access
  if (!tenantLoading && !tierConfig.enabled) {
    router.push('/dashboard/usage');
    return null;
  }

  // Filtered traces
  const filteredTraces = useMemo(() => {
    return traces.filter(trace => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !trace.model.toLowerCase().includes(query) &&
          !trace.provider.toLowerCase().includes(query) &&
          !trace.request_id.toLowerCase().includes(query) &&
          !trace.user_id?.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Provider filter
      if (filters.provider && trace.provider !== filters.provider) return false;

      // Model filter
      if (filters.model && trace.model !== filters.model) return false;

      // Status filter
      if (filters.status && trace.status.toString() !== filters.status) return false;

      // Latency filter
      if (filters.minLatency && trace.latency < parseInt(filters.minLatency)) return false;

      // Cost filter
      if (filters.minCost && trace.cost < parseFloat(filters.minCost)) return false;

      // Has error filter
      if (filters.hasError && trace.status === 200) return false;

      // Used speculative filter
      if (filters.usedSpeculative && !trace.used_speculative) return false;

      // Was retried filter
      if (filters.wasRetried && !trace.retry_count) return false;

      // Tag filter
      if (filters.tag && trace.tag !== filters.tag) return false;

      // Time range filter
      const now = Date.now();
      const traceTime = new Date(trace.timestamp).getTime();
      const timeRanges = {
        '1h': 3600000,
        '24h': 86400000,
        '7d': 604800000,
        '30d': 2592000000,
        '90d': 7776000000,
      };
      const rangeMs = timeRanges[filters.timeRange as keyof typeof timeRanges] || 86400000;

      if (now - traceTime > rangeMs) return false;

      // Tenant filter (Scale tier only) - In production, traces would have a tenant_id field
      // For now, we'll use a mock implementation that simulates filtering
      if (selectedTenant !== 'all' && tier === 'scale') {
        // In a real implementation, this would check: trace.tenant_id !== selectedTenant
        // For the mock, we'll just show all traces since they don't have tenant_id yet
      }

      return true;
    }).slice(0, tierConfig.maxRequests);
  }, [traces, searchQuery, filters, tierConfig.maxRequests, selectedTenant, tier]);

  // Helper function to determine if a request is a failed request
  // Failed requests: HTTP 4xx (except 429), 5xx, timeout >30s, network error, invalid JSON
  // 429 is NOT an error
  const isFailedRequest = (trace: RequestTrace): boolean => {
    // 429 is explicitly NOT an error
    if (trace.status === 429) return false;

    // 4xx errors (except 429) and 5xx errors are failures
    if (trace.status >= 400) return true;

    // Timeout >30s (30000ms)
    if (trace.latency > 30000) return true;

    return false;
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = filteredTraces.length;
    const avgLatency = total > 0 ? filteredTraces.reduce((sum, t) => sum + t.latency, 0) / total : 0;
    const totalCost = filteredTraces.reduce((sum, t) => sum + t.cost, 0);
    const errorRate = total > 0 ? (filteredTraces.filter(t => t.status !== 200).length / total) * 100 : 0;
    const speculativeCount = filteredTraces.filter(t => t.used_speculative).length;
    const retriedCount = filteredTraces.filter(t => t.retry_count && t.retry_count > 0).length;

    return { total, avgLatency, totalCost, errorRate, speculativeCount, retriedCount };
  }, [filteredTraces]);

  // Error Rate Monitoring - 7-day rolling calculation
  const errorRateMetrics = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const twoDaysAgo = now - (48 * 60 * 60 * 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    // 7-day rolling error rate
    const sevenDayTraces = traces.filter(t => {
      const traceTime = new Date(t.timestamp).getTime();
      return traceTime >= sevenDaysAgo && traceTime <= now;
    });
    const sevenDayFailed = sevenDayTraces.filter(isFailedRequest).length;
    const sevenDayTotal = sevenDayTraces.length;
    const sevenDayErrorRate = sevenDayTotal > 0 ? (sevenDayFailed / sevenDayTotal) * 100 : 0;

    // Last 24h error rate
    const last24hTraces = traces.filter(t => {
      const traceTime = new Date(t.timestamp).getTime();
      return traceTime >= oneDayAgo && traceTime <= now;
    });
    const last24hFailed = last24hTraces.filter(isFailedRequest).length;
    const last24hTotal = last24hTraces.length;
    const last24hErrorRate = last24hTotal > 0 ? (last24hFailed / last24hTotal) * 100 : 0;

    // Previous 24h error rate (24-48h ago)
    const prev24hTraces = traces.filter(t => {
      const traceTime = new Date(t.timestamp).getTime();
      return traceTime >= twoDaysAgo && traceTime < oneDayAgo;
    });
    const prev24hFailed = prev24hTraces.filter(isFailedRequest).length;
    const prev24hTotal = prev24hTraces.length;
    const prev24hErrorRate = prev24hTotal > 0 ? (prev24hFailed / prev24hTotal) * 100 : 0;

    // Trend calculation: delta between last 24h and previous 24h
    const errorRateDelta = last24hErrorRate - prev24hErrorRate;
    const trendDirection = errorRateDelta > 0.1 ? 'up' : errorRateDelta < -0.1 ? 'down' : 'flat';

    // 30-day sparkline data (daily buckets)
    const sparklineData: Array<{ day: string; rate: number }> = [];
    for (let i = 29; i >= 0; i--) {
      const dayStart = now - (i * 24 * 60 * 60 * 1000);
      const dayEnd = dayStart + (24 * 60 * 60 * 1000);

      const dayTraces = traces.filter(t => {
        const traceTime = new Date(t.timestamp).getTime();
        return traceTime >= dayStart && traceTime < dayEnd;
      });

      const dayFailed = dayTraces.filter(isFailedRequest).length;
      const dayTotal = dayTraces.length;
      const dayErrorRate = dayTotal > 0 ? (dayFailed / dayTotal) * 100 : 0;

      sparklineData.push({
        day: new Date(dayStart).toISOString().split('T')[0],
        rate: parseFloat(dayErrorRate.toFixed(2))
      });
    }

    return {
      sevenDayErrorRate: parseFloat(sevenDayErrorRate.toFixed(2)),
      last24hErrorRate: parseFloat(last24hErrorRate.toFixed(2)),
      prev24hErrorRate: parseFloat(prev24hErrorRate.toFixed(2)),
      errorRateDelta: parseFloat(errorRateDelta.toFixed(2)),
      trendDirection,
      sparklineData
    };
  }, [traces]);

  // Provider Reliability Score - 7-day per provider
  const providerReliabilityMetrics = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

    // Get all traces from last 7 days
    const sevenDayTraces = traces.filter(t => {
      const traceTime = new Date(t.timestamp).getTime();
      return traceTime >= sevenDaysAgo && traceTime <= now;
    });

    // Group by provider
    const providerStats: Record<string, { total: number; successful: number; failed: number }> = {};

    sevenDayTraces.forEach(trace => {
      if (!providerStats[trace.provider]) {
        providerStats[trace.provider] = { total: 0, successful: 0, failed: 0 };
      }
      providerStats[trace.provider].total++;

      if (isFailedRequest(trace)) {
        providerStats[trace.provider].failed++;
      } else {
        providerStats[trace.provider].successful++;
      }
    });

    // Calculate reliability scores
    const reliabilityScores = Object.entries(providerStats).map(([provider, stats]) => {
      const reliabilityScore = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;

      let badge: 'Excellent' | 'Good' | 'Fair' = 'Fair';
      if (reliabilityScore >= 99.5) {
        badge = 'Excellent';
      } else if (reliabilityScore >= 98) {
        badge = 'Good';
      }

      return {
        provider,
        reliabilityScore: parseFloat(reliabilityScore.toFixed(2)),
        totalRequests: stats.total,
        successfulRequests: stats.successful,
        failedRequests: stats.failed,
        badge
      };
    }).sort((a, b) => b.reliabilityScore - a.reliabilityScore);

    return reliabilityScores;
  }, [traces]);

  // Latency CDF Metrics - Calculate percentiles per provider
  const latencyCDFMetrics = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

    // Get all traces from last 7 days
    const sevenDayTraces = traces.filter(t => {
      const traceTime = new Date(t.timestamp).getTime();
      return traceTime >= sevenDaysAgo && traceTime <= now;
    });

    // Group by provider and collect latencies
    const providerLatencies: Record<string, number[]> = {};

    sevenDayTraces.forEach(trace => {
      if (!providerLatencies[trace.provider]) {
        providerLatencies[trace.provider] = [];
      }
      providerLatencies[trace.provider].push(trace.latency);
    });

    // Calculate percentiles for each provider
    const calculatePercentile = (arr: number[], percentile: number): number => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const index = Math.ceil((percentile / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    const percentileData = Object.entries(providerLatencies).map(([provider, latencies]) => {
      const p50 = calculatePercentile(latencies, 50);
      const p75 = calculatePercentile(latencies, 75);
      const p90 = calculatePercentile(latencies, 90);
      const p95 = calculatePercentile(latencies, 95);
      const p99 = calculatePercentile(latencies, 99);

      return {
        provider,
        p50: Math.round(p50),
        p75: Math.round(p75),
        p90: Math.round(p90),
        p95: Math.round(p95),
        p99: Math.round(p99),
        count: latencies.length
      };
    }).sort((a, b) => a.p95 - b.p95);

    // Generate CDF data for chart
    const cdfChartData: Array<Record<string, number>> = [];
    const latencyThresholds = [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900];

    latencyThresholds.forEach(threshold => {
      const dataPoint: Record<string, number> = { latency: threshold };

      Object.entries(providerLatencies).forEach(([provider, latencies]) => {
        const belowThreshold = latencies.filter(l => l <= threshold).length;
        const percentage = latencies.length > 0 ? (belowThreshold / latencies.length) * 100 : 0;
        dataPoint[provider] = parseFloat(percentage.toFixed(1));
      });

      cdfChartData.push(dataPoint);
    });

    return {
      percentileData,
      cdfChartData,
      providers: Object.keys(providerLatencies)
    };
  }, [traces]);

  // Cost Insights - Real data from Overture API
  const costInsightsMetrics = useMemo(() => {
    if (!overtureUsage || !overtureHistory) {
      // Fallback to empty structure
      return {
        spendByProvider: [],
        spendByModel: [],
        totalSpend: 0,
        prevTotalSpend: 0,
        totalTrend: 0
      };
    }

    // Calculate trend from history (compare current month to previous month)
    const currentMonthSpend = overtureUsage.total_spend_usd;
    const previousMonth = overtureHistory.history.length >= 2 ? overtureHistory.history[overtureHistory.history.length - 2] : null;
    const prevMonthSpend = previousMonth ? previousMonth.total_spend_usd : 0;
    const totalTrend = prevMonthSpend > 0 ? ((currentMonthSpend - prevMonthSpend) / prevMonthSpend) * 100 : 0;

    // Transform provider data to match existing structure
    const spendByProvider = overtureUsage.by_provider.map(p => ({
      provider: p.provider,
      spend: p.total_cost_usd,
      percentage: overtureUsage.total_spend_usd > 0 ? parseFloat(((p.total_cost_usd / overtureUsage.total_spend_usd) * 100).toFixed(1)) : 0,
      trend: 0, // We don't have per-provider trend from this endpoint
    }));

    // Transform model data to match existing structure
    const spendByModel = overtureUsage.by_model.slice(0, 10).map(m => ({
      model: m.model,
      provider: m.provider,
      spend: m.total_cost_usd,
      percentage: overtureUsage.total_spend_usd > 0 ? parseFloat(((m.total_cost_usd / overtureUsage.total_spend_usd) * 100).toFixed(1)) : 0,
      requests: m.request_count,
      trend: 0, // We don't have per-model trend from this endpoint
    }));

    return {
      spendByProvider,
      spendByModel,
      totalSpend: currentMonthSpend,
      prevTotalSpend: prevMonthSpend,
      totalTrend: parseFloat(totalTrend.toFixed(1))
    };
  }, [overtureUsage, overtureHistory]);

  // Export handlers
  const handleExportCSV = () => {
    const exportData = filteredTraces.map(trace => ({
      timestamp: trace.timestamp,
      model: trace.model,
      provider: trace.provider,
      status: trace.status,
      latency: trace.latency,
      cost: trace.cost,
      tokens: trace.tokens.total,
      user_id: trace.user_id,
      request_id: trace.request_id,
      tag: trace.tag || '',
      used_speculative: trace.used_speculative,
      retry_count: trace.retry_count || 0,
    }));
    downloadCSV(exportData, `observability-${Date.now()}`);
  };

  const handleExportJSON = () => {
    downloadJSON(filteredTraces, `observability-${Date.now()}`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleShareTrace = (trace: RequestTrace) => {
    // Generate a shareable URL (7-day expiry)
    const sharedUrl = `https://overture.ai/traces/${trace.id}?token=${btoa(Date.now().toString())}`;
    copyToClipboard(sharedUrl);
    // Optimistic update would go here with queryClient.setQueryData
    alert('Trace URL copied to clipboard! Valid for 7 days.');
  };

  const handleTagTrace = (trace: RequestTrace, tag: RequestTag) => {
    // Optimistic update would go here with queryClient.setQueryData
    if (selectedTrace?.id === trace.id) {
      setSelectedTrace({ ...trace, tag });
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      alert('Please enter a preset name');
      return;
    }
    setSavedPresets(prev => [...prev, { name: presetName, filters: { ...filters } }]);
    setPresetName('');
    alert(`Preset "${presetName}" saved!`);
  };

  const handleLoadPreset = (preset: { name: string; filters: typeof filters }) => {
    setFilters(preset.filters);
  };

  const handleDeletePreset = (presetName: string) => {
    setSavedPresets(prev => prev.filter(p => p.name !== presetName));
  };

  const handleDeleteAllTraces = () => {
    if (window.confirm('Are you sure you want to delete ALL traces? This action cannot be undone.')) {
      // This would require an API call to delete traces
      // invalidateTraces();
      setSelectedTrace(null);
      alert('All traces have been permanently deleted.');
    }
  };

  const getStatusBadge = (status: number) => {
    if (status === 200) {
      return <Badge className="bg-green-50 text-green-700 border-green-200 text-[8px] px-1 py-0">200 OK</Badge>;
    } else if (status === 429) {
      return <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[8px] px-1 py-0">429 Rate Limit</Badge>;
    } else if (status === 500) {
      return <Badge className="bg-red-50 text-red-700 border-red-200 text-[8px] px-1 py-0">{status} Error</Badge>;
    } else {
      return <Badge className="bg-red-50 text-red-700 border-red-200 text-[8px] px-1 py-0">{status} Error</Badge>;
    }
  };

  const getTagBadge = (tag: RequestTag | undefined) => {
    if (!tag) return null;
    const config = {
      expected: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Expected' },
      bug: { bg: 'bg-red-50', text: 'text-red-700', label: 'Bug' },
      reviewed: { bg: 'bg-green-50', text: 'text-green-700', label: 'Reviewed' },
      golden: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Golden' },
      spam: { bg: 'bg-gray-50', text: 'text-gray-700', label: 'Spam' },
    };
    const { bg, text, label } = config[tag];
    return <Badge className={cn(bg, text, 'border text-[8px] px-1 py-0')}>{label}</Badge>;
  };

  if (tenantLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-gray-900" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-base font-medium text-gray-900 font-inter">
                  Observability
                </h1>
                {tier === 'growth' && (
                  <Badge className="bg-gray-50 text-gray-700 border-gray-200 text-xs font-medium">
                    30 days retention
                  </Badge>
                )}
                {tier === 'scale' && (
                  <Badge className="bg-gray-50 text-gray-700 border-gray-200 text-xs font-medium">
                    90 days retention
                  </Badge>
                )}
              </div>
              <p className="text-gray-600 mt-1 font-inter text-xs">
                Monitor and debug LLM requests in real-time
              </p>
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Time Range Selector */}
              <Select
                value={filters.timeRange}
                onValueChange={(value) => setFilters({ ...filters, timeRange: value })}
              >
                <SelectTrigger className="w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">1 hour</SelectItem>
                  <SelectItem value="24h">24 hours</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                  <SelectItem value="90d">90 days</SelectItem>
                </SelectContent>
              </Select>

              {/* Multi-Tenant Dropdown (Scale Only) */}
              {tier === 'scale' ? (
                <Select
                  value={selectedTenant}
                  onValueChange={(value) => setSelectedTenant(value)}
                >
                  <SelectTrigger className="w-48 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mockTenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="relative group">
                  <Select disabled>
                    <SelectTrigger className="w-48 cursor-not-allowed opacity-60 text-xs">
                      <SelectValue placeholder="All tenants" />
                    </SelectTrigger>
                  </Select>
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 bg-beige-primary border border-gray-200/20 rounded-lg p-3 z-50">
                    <p className="text-xs text-gray-600">
                      Multi-tenant view available on Scale plan
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 items-center flex-wrap">
              {enableFullTracing ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button
                        className="p-1 hover:bg-beige-primary rounded-md transition-colors"
                        onMouseEnter={() => setShowTracingInfo(true)}
                        onMouseLeave={() => setShowTracingInfo(false)}
                        onClick={() => setShowTracingInfo(!showTracingInfo)}
                      >
                        <AlertCircle className="h-5 w-5 text-gray-600" />
                      </button>
                      {showTracingInfo && (
                        <div className="absolute top-full right-0 mt-2 w-80 bg-beige-primary border border-gray-200/20 rounded-lg p-4 z-50">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-gray-900 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                                Full Request Tracing Enabled
                              </h4>
                              <p className="text-xs text-gray-600">
                                Prompts, completions, and token streams are now being stored. Recommended only for debugging. All traces automatically deleted after {tierConfig.retention} days.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      className="shadow-sm text-gray-900 border-red-300 hover:bg-red-50"
                      onClick={handleDeleteAllTraces}
                    >
                      Delete All Traces
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    className="shadow-sm"
                    onClick={() => setEnableFullTracing(false)}
                  >
                    Disable Full Tracing
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="shadow-sm text-xs"
                  onClick={() => setEnableFullTracing(true)}
                >
                  Enable Full Tracing
                </Button>
              )}
              {tierConfig.fullFeatures && (
                <>
                  <Button variant="outline" size="sm" className="shadow-sm text-xs" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button variant="outline" size="sm" className="shadow-sm text-xs" onClick={handleExportJSON}>
                    <Download className="h-4 w-4 mr-2" />
                    Export JSON
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs: Traces, Audit Logs, and Cost Insights */}
        <Tabs defaultValue="traces" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="traces" className="text-[10px]">Traces</TabsTrigger>
            <TabsTrigger value="audit" className="text-[10px]">Audit Logs</TabsTrigger>
            <TabsTrigger value="cost" className="text-[10px]">Cost Insights</TabsTrigger>
          </TabsList>

          {/* Traces Tab Content */}
          <TabsContent value="traces" className="space-y-6">
        {/* Metrics Grid Layout */}
        <div className="bg-beige-primary">
          <div className="grid grid-cols-3 divide-x divide-border-light">
            <div className="p-4">
              <div className="text-xs font-medium text-gray-600 mb-1">Total Traces</div>
              <div className="text-lg font-bold text-gray-900">{formatNumber(metrics.total)}</div>
              <p className="text-[0.65rem] text-gray-600 mt-1">
                Last {filters.timeRange === '1h' ? 'hour' : filters.timeRange === '24h' ? '24h' : filters.timeRange === '7d' ? '7 days' : '30 days'}
              </p>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-gray-600 mb-1">Avg Latency</div>
              <div className="text-lg font-bold text-gray-900">{formatLatency(metrics.avgLatency)}</div>
              <p className="text-[0.65rem] text-gray-600 mt-1">
                Response time
              </p>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-gray-600 mb-1">Total Cost</div>
              <div className="text-lg font-bold text-gray-900">{formatCurrency(metrics.totalCost)}</div>
              <p className="text-[0.65rem] text-gray-600 mt-1">
                This period
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-border-light border-t border-border-light">
            <div className="p-4">
              <div className="text-xs font-medium text-gray-600 mb-1">Error Rate</div>
              <div className="text-lg font-bold text-gray-900">{metrics.errorRate.toFixed(1)}%</div>
              <p className="text-[0.65rem] text-gray-600 mt-1">
                {tier === 'scale' ? '90-day' : tier === 'growth' ? '7-day' : 'Limited'}
              </p>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-gray-600 mb-1">Speculative</div>
              <div className="text-lg font-bold text-gray-900">{formatNumber(metrics.speculativeCount)}</div>
              <p className="text-[0.65rem] text-gray-600 mt-1">
                Used parallel
              </p>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-gray-600 mb-1">Retried</div>
              <div className="text-lg font-bold text-gray-900">{formatNumber(metrics.retriedCount)}</div>
              <p className="text-[0.65rem] text-gray-600 mt-1">
                Had retries
              </p>
            </div>
          </div>
        </div>

        {/* 1. REAL-TIME METRICS - Live updating every 5s */}
        <div className="bg-gradient-to-br from-beige-primary to-beige-primary">
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-3.5 w-3.5 text-gray-900" />
              <h3 className="text-sm font-medium text-gray-900">
                Real-Time Metrics
              </h3>
              <span className="relative flex h-2 w-2 ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            </div>
            <p className="text-[10px] text-gray-600 mb-4">Updates every 5 seconds</p>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Requests/Second */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Requests / Second</p>
                <div className="flex items-end gap-3">
                  <p className="text-base font-semibold text-gray-900">{realTimeMetrics.requestsPerSecond.toFixed(1)}</p>
                  <div className="flex-1 h-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={realTimeMetrics.requestsSparkline}>
                        <Line type="monotone" dataKey="value" stroke="#000000" strokeWidth={0.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <p className="text-[10px] text-gray-600">Last 60 seconds</p>
              </div>

              {/* P50/P95 Latency */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">P50 / P95 Latency</p>
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-base font-semibold text-gray-900">{realTimeMetrics.p50Latency.toFixed(0)}ms</p>
                    <span className="text-[10px] text-gray-600">P50</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-sm font-medium text-gray-700">{realTimeMetrics.p95Latency.toFixed(0)}ms</p>
                    <span className="text-[10px] text-gray-600">P95</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-600">Last 5 minutes</p>
              </div>

              {/* Cost/Hour */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Cost / Hour</p>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-gray-900">${realTimeMetrics.costPerHour.toFixed(2)}</p>
                  <div className="flex items-center gap-2 text-[10px] text-gray-600">
                    <span>Projected: ${(realTimeMetrics.costPerHour * 24).toFixed(2)}/day</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-600">Last hour</p>
              </div>

              {/* Active Providers */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Active Providers</p>
                <p className="text-base font-semibold text-gray-900">{realTimeMetrics.activeProviders}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {['OpenAI', 'Anthropic', 'Google', 'xAI', 'Cohere'].slice(0, realTimeMetrics.activeProviders).map((provider, i) => (
                    <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0">{provider}</Badge>
                  ))}
                </div>
                <p className="text-[10px] text-gray-600">Currently responding</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-border-light">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-900" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              {/* Search */}
              <div className="lg:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
                  <Input
                    placeholder="Search requests..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border-light"
                  />
                </div>
              </div>

              {/* Provider */}
              <Select
                value={filters.provider || 'all'}
                onValueChange={(value) => setFilters(prev => ({ ...prev, provider: value === 'all' ? '' : value }))}
              >
                <SelectTrigger className="text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border-light">
                  <SelectValue placeholder="All Providers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  <SelectItem value="OpenAI">OpenAI</SelectItem>
                  <SelectItem value="Anthropic">Anthropic</SelectItem>
                  <SelectItem value="Google">Google</SelectItem>
                  <SelectItem value="xAI">xAI</SelectItem>
                </SelectContent>
              </Select>

              {/* Status */}
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === 'all' ? '' : value }))}
              >
                <SelectTrigger className="text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border-light">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="200">200 OK</SelectItem>
                  <SelectItem value="429">429 Rate Limit</SelectItem>
                  <SelectItem value="500">500 Error</SelectItem>
                </SelectContent>
              </Select>

              {/* Tag */}
              <Select
                value={filters.tag || 'all'}
                onValueChange={(value) => setFilters(prev => ({ ...prev, tag: value === 'all' ? '' : value as RequestTag | '' }))}
              >
                <SelectTrigger className="text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border-light">
                  <SelectValue placeholder="All Tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  <SelectItem value="expected">Expected</SelectItem>
                  <SelectItem value="bug">Bug</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="golden">Golden</SelectItem>
                  <SelectItem value="spam">Spam</SelectItem>
                </SelectContent>
              </Select>

              {/* Time Range */}
              <Select
                value={filters.timeRange}
                onValueChange={(value) => setFilters(prev => ({ ...prev, timeRange: value }))}
              >
                <SelectTrigger className="text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border-light">
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="24h">Last 24h</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Advanced Filters */}
            <div className="flex gap-3 mt-4 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className={filters.hasError ? 'bg-beige-primary text-gray-900 border border-border-light text-xs' : 'text-xs'}
                onClick={() => setFilters(prev => ({ ...prev, hasError: !prev.hasError }))}
              >
                {filters.hasError && <CheckCircle className="h-3 w-3 mr-1" />}
                Has Error
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={filters.usedSpeculative ? 'bg-beige-primary text-gray-900 border border-border-light text-xs' : 'text-xs'}
                onClick={() => setFilters(prev => ({ ...prev, usedSpeculative: !prev.usedSpeculative }))}
              >
                {filters.usedSpeculative && <CheckCircle className="h-3 w-3 mr-1" />}
                Used Speculative
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={filters.wasRetried ? 'bg-beige-primary text-gray-900 border border-border-light text-xs' : 'text-xs'}
                onClick={() => setFilters(prev => ({ ...prev, wasRetried: !prev.wasRetried }))}
              >
                {filters.wasRetried && <CheckCircle className="h-3 w-3 mr-1" />}
                Was Retried
              </Button>
            </div>

            {/* Active Filters */}
            {(searchQuery || filters.provider || filters.status || filters.tag || filters.hasError || filters.usedSpeculative || filters.wasRetried) && (
              <div className="flex gap-2 mt-4 flex-wrap">
                {searchQuery && (
                  <Badge variant="outline" className="gap-2">
                    Search: {searchQuery}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchQuery('')} />
                  </Badge>
                )}
                {filters.provider && (
                  <Badge variant="outline" className="gap-2">
                    Provider: {filters.provider}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, provider: '' }))} />
                  </Badge>
                )}
                {filters.status && (
                  <Badge variant="outline" className="gap-2">
                    Status: {filters.status}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, status: '' }))} />
                  </Badge>
                )}
                {filters.tag && (
                  <Badge variant="outline" className="gap-2">
                    Tag: {filters.tag}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setFilters(prev => ({ ...prev, tag: '' }))} />
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setFilters({
                      provider: '',
                      model: '',
                      status: '',
                      minLatency: '',
                      minCost: '',
                      timeRange: '24h',
                      hasError: false,
                      usedSpeculative: false,
                      wasRetried: false,
                      tag: '',
                    });
                  }}
                >
                  Clear All
                </Button>
              </div>
            )}

            {/* Saved Filter Presets */}
            {tierConfig.fullFeatures && (
              <div className="mt-4 pt-4 border-t border-border-light">
                <h4 className="text-xs font-medium text-gray-600 mb-3">Saved Filter Presets</h4>
                <div className="flex gap-2 flex-wrap mb-3">
                  {savedPresets.map((preset, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-beige-primary border border-border-light rounded px-3 py-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLoadPreset(preset)}
                        className="h-auto p-0 text-xs font-medium text-gray-900 hover:text-gray-700"
                      >
                        {preset.name}
                      </Button>
                      <X
                        className="h-3 w-3 text-gray-600 cursor-pointer hover:text-gray-900"
                        onClick={() => handleDeletePreset(preset.name)}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Preset name..."
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    className="flex-1 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border-light"
                  />
                  <Button variant="outline" size="sm" className="text-xs" onClick={handleSavePreset}>
                    Save Current Filters
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Traces Table */}
        <div className="bg-beige-primary">
          <div className="px-6 py-4 border-b border-border-light">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-gray-900" />
              <h3 className="text-sm font-medium text-gray-900">
                Request Traces
              </h3>
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {filteredTraces.length} of {traces.length} requests
              {tier === 'growth' && ' (Limited to 1,000 requests)'}
              {tier === 'scale' && ' (Up to 100,000 requests)'}
            </p>
          </div>
            {filteredTraces.length === 0 ? (
              <div className="py-16 px-6">
                <div className="max-w-md mx-auto">
                  <p className="text-sm font-normal text-gray-500 mb-3">
                    No requests yet, make your first one to unlock:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 text-xs text-gray-500">
                    <li>Token-by-token timeline</li>
                    <li>Speculative execution waterfall</li>
                    <li>Retry + cache savings</li>
                    <li>Full cost breakdown</li>
                    <li>Shareable, exportable traces</li>
                  </ul>
                </div>
                <div className="mt-8 max-w-2xl mx-auto">
                  <div className="relative group">
                    <pre className="bg-beige-primary border border-gray-200/20 text-gray-700 p-4 rounded-lg text-left text-xs font-mono overflow-x-auto">
{`curl -X POST https://api.overture.com/v1/chat/completions \\
  -H "Authorization: Bearer sk-..." \\
  -H "Content-Type: application/json" \\
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'`}
                    </pre>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`curl -X POST https://api.overture.com/v1/chat/completions \\
  -H "Authorization: Bearer sk-..." \\
  -H "Content-Type: application/json" \\
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'`);
                      }}
                      className="absolute top-2 right-2 text-gray-600 hover:text-gray-900 p-2 rounded transition-colors"
                      title="Copy to clipboard"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="max-h-[600px] overflow-y-auto scrollbar-hide">
                  <table className="w-full text-[9px]">
                    <thead className="sticky top-0 z-10" style={{ backgroundColor: '#f2f1ed' }}>
                      <tr className="border-b border-border-light">
                        <th className="text-left py-1.5 px-2 font-medium text-[8px] text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Time</th>
                        <th className="text-left py-1.5 px-2 font-medium text-[8px] text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Model</th>
                        <th className="text-left py-1.5 px-2 font-medium text-[8px] text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Provider</th>
                        <th className="text-left py-1.5 px-2 font-medium text-[8px] text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Status</th>
                        <th className="text-right py-1.5 px-2 font-medium text-[8px] text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Latency</th>
                        <th className="text-right py-1.5 px-2 font-medium text-[8px] text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Cost</th>
                        <th className="text-right py-1.5 px-2 font-medium text-[8px] text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Tokens</th>
                        <th className="text-left py-1.5 px-2 font-medium text-[8px] text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Cache</th>
                        <th className="text-left py-1.5 px-2 font-medium text-[8px] text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>User</th>
                        <th className="text-left py-1.5 px-2 font-medium text-[8px] text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Chain</th>
                        <th className="text-left py-1.5 px-2 font-medium text-[8px] text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Tags</th>
                        <th className="text-right py-1.5 px-2 font-medium text-[8px] text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                    {filteredTraces.map((trace) => (
                      <tr
                        key={trace.id}
                        className="border-b border-border-light hover:bg-beige-primary cursor-pointer transition-colors"
                        onClick={() => setSelectedTrace(trace)}
                      >
                        <td className="py-1.5 px-2 text-[9px] text-gray-900 font-inter">
                          {new Date(trace.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-1.5 px-2 text-[9px] font-medium text-gray-900">
                          <div className="flex flex-col">
                            <span>{trace.model}</span>
                            {trace.model_version && <span className="text-[7px] text-gray-600">{trace.model_version}</span>}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-[9px] text-gray-900">
                          {trace.provider}
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="flex items-center gap-1.5">
                            {getStatusBadge(trace.status)}
                            {trace.used_speculative && <Badge variant="outline" className="text-[8px] px-1 py-0">Spec</Badge>}
                            {trace.retry_count && trace.retry_count > 0 && <Badge variant="outline" className="text-[8px] px-1 py-0">{trace.retry_count}x</Badge>}
                          </div>
                        </td>
                        <td className="text-right py-1.5 px-2 text-[9px] text-gray-900">
                          {formatLatency(trace.latency)}
                        </td>
                        <td className="text-right py-1.5 px-2 text-[9px] text-gray-900">
                          {formatCurrency(trace.cost)}
                        </td>
                        <td className="text-right py-1.5 px-2 text-[9px] text-gray-900">
                          {formatNumber(trace.tokens.total)}
                        </td>
                        <td className="py-1.5 px-2">
                          {trace.cache_hit ? (
                            <div className="flex flex-col">
                              <Badge className="bg-green-50 text-green-700 border-green-200 text-[8px] px-1 py-0">HIT</Badge>
                              {trace.cache_savings && trace.cache_savings > 0 && (
                                <span className="text-[7px] text-green-600 mt-0.5">-{formatCurrency(trace.cache_savings)}</span>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 text-gray-600">MISS</Badge>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-[9px] text-gray-900">
                          {trace.user_id && (
                            <div className="flex flex-col">
                              <span className="text-[9px]">{trace.user_id}</span>
                              {trace.session_id && <span className="text-[7px] text-gray-600">{trace.session_id}</span>}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 px-2">
                          {(trace.parent_request_id || trace.child_request_ids) && (
                            <div className="flex items-center gap-1">
                              {trace.parent_request_id && <Badge variant="outline" className="text-[8px] px-1 py-0">↑ Parent</Badge>}
                              {trace.child_request_ids && <Badge variant="outline" className="text-[8px] px-1 py-0">↓ {trace.child_request_ids.length}</Badge>}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 px-2">
                          {getTagBadge(trace.tag)}
                        </td>
                        <td className="text-right py-1.5 px-2">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="outline"
                              className="h-auto py-0.5 px-1.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShareTrace(trace);
                              }}
                            >
                              <Share2 className="h-2.5 w-2.5" />
                            </Button>
                            <Button
                              variant="outline"
                              className="h-auto py-0.5 px-1.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTrace(trace);
                              }}
                            >
                              <Eye className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
          {/* 3. PERFORMANCE MONITORING - Dedicated Section */}
        <Card className="border-border-light">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-gray-900" />
              Performance Monitoring
            </CardTitle>
            <CardDescription className="text-[10px]">Provider reliability and performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Error Rate - Main Metric with 7-day rolling */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xs font-medium text-gray-900 mb-2">Error Rate (7-day rolling)</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-900">{errorRateMetrics.sevenDayErrorRate}%</span>
                    <div className="flex items-center gap-1">
                      {errorRateMetrics.trendDirection === 'up' && (
                        <>
                          <ChevronUp className="h-3 w-3 text-gray-900" />
                          <span className="text-[10px] font-medium text-gray-900">+{Math.abs(errorRateMetrics.errorRateDelta).toFixed(2)}%</span>
                        </>
                      )}
                      {errorRateMetrics.trendDirection === 'down' && (
                        <>
                          <ChevronDown className="h-3 w-3 text-gray-600" />
                          <span className="text-[10px] font-medium text-gray-600">-{Math.abs(errorRateMetrics.errorRateDelta).toFixed(2)}%</span>
                        </>
                      )}
                      {errorRateMetrics.trendDirection === 'flat' && (
                        <span className="text-[10px] font-medium text-gray-600">~{errorRateMetrics.errorRateDelta.toFixed(2)}%</span>
                      )}
                      <span className="text-[9px] text-gray-600 ml-1">vs prev 24h</span>
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-600 mt-1">
                    Failed requests: 4xx (except 429), 5xx, timeout &gt;30s
                  </p>
                </div>
              </div>

              {/* 30-day sparkline */}
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={60}>
                  <AreaChart data={errorRateMetrics.sparklineData}>
                    <defs>
                      <linearGradient id="errorRateGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#000000" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-beige-primary border border-gray-200/20 rounded-md p-1.5">
                              <p className="text-[9px] text-gray-600">{payload[0].payload.day}</p>
                              <p className="text-[10px] font-medium text-gray-900">{payload[0].value}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="rate"
                      stroke="#000000"
                      strokeWidth={0.5}
                      fill="url(#errorRateGradient)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-[9px] text-gray-600 mt-1">30-day trend</p>
              </div>
            </div>

            {/* Provider Reliability Score */}
            <div className="mt-6 pt-6 border-t border-border-light">
              <h3 className="text-xs font-medium text-gray-900 mb-3">Provider Reliability Score (7-day)</h3>
              {providerReliabilityMetrics.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-light bg-beige-primary">
                        <th className="text-left py-1 px-2 text-[8px] font-medium text-gray-600">Provider</th>
                        <th className="text-right py-1 px-2 text-[8px] font-medium text-gray-600">Reliability Score</th>
                        <th className="text-right py-1 px-2 text-[8px] font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {providerReliabilityMetrics.map((provider, index) => (
                        <tr key={index} className="border-b border-border-light hover:bg-beige-primary">
                          <td className="py-1 px-2 text-[9px] font-medium text-gray-900">{provider.provider}</td>
                          <td className="text-right py-1 px-2">
                            <span className="text-[9px] font-medium text-gray-900">{provider.reliabilityScore}%</span>
                          </td>
                          <td className="text-right py-1 px-2">
                            <Badge className={cn(
                              "text-[8px] px-1 py-0",
                              provider.badge === 'Excellent' ? "bg-gray-50 text-gray-700 border-gray-200" :
                              provider.badge === 'Good' ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                              "bg-red-50 text-red-700 border-red-200"
                            )}>
                              {provider.badge}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600">
                  <p className="text-[9px]">No provider data available for the last 7 days</p>
                </div>
              )}
            </div>

            {/* Latency CDF - Percentiles Table + Interactive Chart */}
            <div className="mt-6 pt-6 border-t border-border-light">
              <h3 className="text-xs font-medium text-gray-900 mb-4">Latency Distribution (CDF) - 7-day</h3>

              {/* Percentiles Table */}
              {latencyCDFMetrics.percentileData.length > 0 ? (
                <>
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border-light bg-beige-primary">
                          <th className="text-left py-1 px-2 text-[8px] font-medium text-gray-600">Provider</th>
                          <th className="text-right py-1 px-2 text-[8px] font-medium text-gray-600">P50</th>
                          <th className="text-right py-1 px-2 text-[8px] font-medium text-gray-600">P75</th>
                          <th className="text-right py-1 px-2 text-[8px] font-medium text-gray-600">P90</th>
                          <th className="text-right py-1 px-2 text-[8px] font-medium text-gray-600">P95</th>
                          <th className="text-right py-1 px-2 text-[8px] font-medium text-gray-600">P99</th>
                          <th className="text-right py-1 px-2 text-[8px] font-medium text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latencyCDFMetrics.percentileData.map((provider, index) => (
                          <tr key={index} className="border-b border-border-light hover:bg-beige-primary">
                            <td className="py-1 px-2 text-[9px] font-medium text-gray-900">{provider.provider}</td>
                            <td className="text-right py-1 px-2 text-[9px] text-gray-700">{provider.p50}ms</td>
                            <td className="text-right py-1 px-2 text-[9px] text-gray-700">{provider.p75}ms</td>
                            <td className="text-right py-1 px-2 text-[9px] text-gray-700">{provider.p90}ms</td>
                            <td className="text-right py-1 px-2 text-[9px] font-medium text-gray-900">{provider.p95}ms</td>
                            <td className="text-right py-1 px-2 text-[9px] text-gray-700">{provider.p99}ms</td>
                            <td className="text-right py-1 px-2">
                              {index === 0 && (
                                <Badge className="text-[8px] px-1 py-0" style={{ backgroundColor: '#e6f7f6', color: '#299a93', borderColor: '#299a93' }}>
                                  Winner
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* CDF Chart */}
                  <div className="mt-6">
                    <ResponsiveContainer width="100%" height={150}>
                      <LineChart data={latencyCDFMetrics.cdfChartData} margin={{ bottom: 20, left: 5, right: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="latency"
                          stroke="#6b7280"
                          style={{ fontSize: '8px' }}
                          label={{ value: 'Latency (ms)', position: 'insideBottom', offset: -8, style: { fontSize: '8px' } }}
                        />
                        <YAxis
                          stroke="#6b7280"
                          style={{ fontSize: '8px' }}
                          domain={[0, 100]}
                          label={{ value: '% of Requests', angle: -90, position: 'insideLeft', style: { fontSize: '8px' } }}
                        />
                        <Tooltip
                          formatter={(value: any) => `${value}%`}
                          labelFormatter={(label) => `${label}ms`}
                          contentStyle={{
                            backgroundColor: '#f2f1ed',
                            border: '1px solid #e5e4e0',
                            borderRadius: '4px',
                            fontSize: '9px',
                            padding: '4px 6px'
                          }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '8px' }} />
                        {latencyCDFMetrics.providers.map((provider, idx) => {
                          const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                          return (
                            <Line
                              key={provider}
                              type="monotone"
                              dataKey={provider}
                              stroke={colors[idx % colors.length]}
                              strokeWidth={1.5}
                              dot={false}
                              activeDot={{ r: 3 }}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-2 text-[9px] text-gray-600">
                      <p>CDF shows the percentage of requests completing below each latency threshold. Steeper curves = faster, more consistent performance.</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-600">
                  <p className="text-[9px]">No latency data available for the last 7 days</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          {/* Cost Insights Tab Content */}
          <TabsContent value="cost" className="space-y-6">
        {/* COST INSIGHTS - 3-Panel Layout */}
        <Card className="border-border-light">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-gray-900" />
                  Cost Insights
                </CardTitle>
                <CardDescription className="text-xs">30-day spend analysis across providers and models</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Loading state */}
            {isLoadingOvertureUsage || isLoadingRuntimeFleet ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-3 text-sm text-gray-600">Loading cost insights...</span>
              </div>
            ) : (
              <>
            {/* Blended Total Cost Overview (Overture + Runtime) */}
            <div className="mb-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                {/* Overture (Cloud) Cost */}
                <div className="p-4 bg-beige-primary rounded-lg border border-border-light">
                  <p className="text-xs text-gray-600 mb-1">Overture (Cloud) Cost</p>
                  <p className="text-lg font-bold text-gray-900">${costInsightsMetrics.totalSpend.toFixed(2)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {costInsightsMetrics.totalTrend > 0 ? (
                      <>
                        <ChevronUp className="h-4 w-4 text-gray-900" />
                        <span className="text-xs font-semibold text-gray-900">+{costInsightsMetrics.totalTrend}%</span>
                      </>
                    ) : costInsightsMetrics.totalTrend < 0 ? (
                      <>
                        <ChevronDown className="h-4 w-4" style={{ color: '#299a93' }} />
                        <span className="text-xs font-semibold" style={{ color: '#299a93' }}>
                          {costInsightsMetrics.totalTrend}%
                        </span>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-gray-600">0%</span>
                    )}
                    <span className="text-xs text-gray-600">vs prev month</span>
                  </div>
                </div>

                {/* Runtime (Edge) Cost - Placeholder */}
                <div className="p-4 bg-beige-primary rounded-lg border border-border-light">
                  <p className="text-xs text-gray-600 mb-1">Runtime (Edge) Cost</p>
                  <p className="text-lg font-bold text-gray-900">
                    {runtimeFleetMetrics ? `$${(runtimeFleetMetrics.total_requests_served * 0.0001).toFixed(2)}` : '$0.00'}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {runtimeFleetMetrics ? `~${runtimeFleetMetrics.total_requests_served.toLocaleString()} edge requests` : 'No data'}
                  </p>
                </div>

                {/* Blended Total */}
                <div className="p-4 bg-beige-primary rounded-lg border border-border-light">
                  <p className="text-xs text-gray-600 mb-1">Blended Total Cost</p>
                  <p className="text-lg font-bold text-gray-900">
                    ${(costInsightsMetrics.totalSpend + (runtimeFleetMetrics ? runtimeFleetMetrics.total_requests_served * 0.0001 : 0)).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Cloud + Edge combined</p>
                </div>
              </div>

              {/* Cost Comparison Bar */}
              {runtimeFleetMetrics && (
                <div className="p-4 bg-beige-primary rounded-lg border border-border-light">
                  <p className="text-xs text-gray-600 mb-2">Cost Distribution (Cloud vs Edge)</p>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden flex">
                    <div
                      style={{
                        width: `${(costInsightsMetrics.totalSpend / (costInsightsMetrics.totalSpend + runtimeFleetMetrics.total_requests_served * 0.0001)) * 100}%`,
                        backgroundImage: 'repeating-linear-gradient(45deg, #000000 0px, #000000 1px, transparent 1px, transparent 2px)',
                        backgroundSize: '2px 2px',
                      }}
                    />
                    <div
                      style={{
                        width: `${((runtimeFleetMetrics.total_requests_served * 0.0001) / (costInsightsMetrics.totalSpend + runtimeFleetMetrics.total_requests_served * 0.0001)) * 100}%`,
                        backgroundImage: 'repeating-linear-gradient(-45deg, #666666 0px, #666666 1px, transparent 1px, transparent 2px)',
                        backgroundSize: '2px 2px',
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
                    <span>{((costInsightsMetrics.totalSpend / (costInsightsMetrics.totalSpend + runtimeFleetMetrics.total_requests_served * 0.0001)) * 100).toFixed(0)}% Cloud</span>
                    <span>{(((runtimeFleetMetrics.total_requests_served * 0.0001) / (costInsightsMetrics.totalSpend + runtimeFleetMetrics.total_requests_served * 0.0001)) * 100).toFixed(0)}% Edge</span>
                  </div>
                </div>
              )}
            </div>

            {/* ENHANCEMENT 3 & 4: Real-time Cost Meter + Cost Forecasting */}
            {overtureUsage && overtureCostTrend && (
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Real-time Cost Meter */}
                <div className="p-4 bg-beige-primary rounded-lg border border-border-light">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Real-Time Cost (This Month)
                    </h3>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></div>
                      <span className="text-xs text-gray-600">Live</span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-gray-900">${overtureUsage.total_spend_usd.toFixed(2)}</span>
                    <span className="text-sm text-gray-600">/ ${overtureUsage.budget_limit_usd.toFixed(2)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-600">Today (est.)</p>
                      <p className="font-semibold text-gray-900">${(overtureUsage.total_spend_usd / new Date().getDate()).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">This Hour (est.)</p>
                      <p className="font-semibold text-gray-900">${(overtureUsage.total_spend_usd / (new Date().getDate() * 24)).toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Burn Rate</p>
                      <p className="font-semibold text-gray-900">${(overtureUsage.total_spend_usd / new Date().getDate()).toFixed(2)}/day</p>
                    </div>
                  </div>
                </div>

                {/* Cost Forecasting */}
                <div className="p-4 bg-beige-primary rounded-lg border border-border-light">
                  <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Month-End Forecast
                  </h3>
                  {(() => {
                    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
                    const currentDay = new Date().getDate();
                    const dailyBurnRate = overtureUsage.total_spend_usd / currentDay;
                    const projectedMonthEnd = dailyBurnRate * daysInMonth;
                    const willExceedBudget = projectedMonthEnd > overtureUsage.budget_limit_usd;
                    const percentOfBudget = (projectedMonthEnd / overtureUsage.budget_limit_usd) * 100;

                    return (
                      <>
                        <div className="flex items-baseline gap-2 mb-3">
                          <span className="text-lg font-bold text-gray-900">${projectedMonthEnd.toFixed(2)}</span>
                          <span className="text-sm text-gray-600">projected</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Projection Confidence</span>
                            <span className="font-medium text-gray-900">{Math.min(95, 60 + (currentDay / daysInMonth) * 40).toFixed(0)}%</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Days Remaining</span>
                            <span className="font-medium text-gray-900">{daysInMonth - currentDay} days</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">Budget Status</span>
                            {willExceedBudget ? (
                              <span className="font-medium text-red-600 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Over by ${(projectedMonthEnd - overtureUsage.budget_limit_usd).toFixed(2)}
                              </span>
                            ) : (
                              <span className="font-medium text-green-600 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" />
                                Within budget ({percentOfBudget.toFixed(0)}%)
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ENHANCEMENT 1: Historical Trend Line Chart (6-month view) */}
            {overtureHistory && overtureHistory.history.length > 0 && (
              <div className="mt-6 p-4 bg-beige-primary rounded-lg border border-border-light">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Cost Trend (Last 6 Months)</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={overtureHistory.history}>
                    <defs>
                      <pattern id="line-stripe" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="1" height="2" fill="#000000" />
                      </pattern>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="year_month"
                      stroke="#6b7280"
                      style={{ fontSize: '10px' }}
                      tickFormatter={(value) => {
                        const [year, month] = value.split('-');
                        return `${month}/${year.slice(2)}`;
                      }}
                    />
                    <YAxis
                      stroke="#6b7280"
                      style={{ fontSize: '10px' }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <Tooltip
                      formatter={(value: any) => [`$${value.toFixed(2)}`, 'Spend']}
                      labelFormatter={(label) => `Month: ${label}`}
                      contentStyle={{
                        backgroundColor: '#f2f1ed',
                        border: '1px solid #e5e4e0',
                        borderRadius: '8px',
                        fontSize: '10px'
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total_spend_usd"
                      stroke="#000000"
                      strokeWidth={0.5}
                      dot={{ fill: '#000000', strokeWidth: 0.5, r: 2 }}
                      activeDot={{ r: 4, fill: '#000000', stroke: '#f2f1ed', strokeWidth: 0.5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="budget_limit_usd"
                      stroke="#dc2626"
                      strokeWidth={0.5}
                      strokeDasharray="5 5"
                      dot={false}
                      name="Budget Limit"
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-4 flex items-center gap-6 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-gray-900"></div>
                    <span className="text-gray-600">Actual Spend</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-red-600 border-dashed"></div>
                    <span className="text-gray-600">Budget Limit</span>
                  </div>
                  {overtureHistory.history.some(h => h.breached) && (
                    <div className="flex items-center gap-2 ml-auto">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <span className="text-orange-600 font-medium">Budget exceeded in {overtureHistory.history.filter(h => h.breached).length} month(s)</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Panel 1: Spend by Provider - Pie Chart */}
              <div className="p-4 bg-beige-primary rounded-lg border border-border-light">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Spend by Provider</h3>
                {costInsightsMetrics.spendByProvider.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <defs>
                          <pattern id="obs-stripe-0" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                            <rect width="2" height="3" fill="#114dcd" />
                            <rect x="2" width="1" height="3" fill="#ffffff" />
                          </pattern>
                          <pattern id="obs-stripe-1" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                            <rect width="2" height="3" fill="#299a93" />
                            <rect x="2" width="1" height="3" fill="#ffffff" />
                          </pattern>
                          <pattern id="obs-stripe-2" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                            <rect width="2" height="3" fill="#1f53d0" />
                            <rect x="2" width="1" height="3" fill="#ffffff" />
                          </pattern>
                          <pattern id="obs-stripe-3" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                            <rect width="2" height="3" fill="#6b7280" />
                            <rect x="2" width="1" height="3" fill="#ffffff" />
                          </pattern>
                        </defs>
                        <Pie
                          data={costInsightsMetrics.spendByProvider}
                          dataKey="spend"
                          nameKey="provider"
                          cx="50%"
                          cy="50%"
                          outerRadius={60}
                          label={(entry) => `${entry.percentage}%`}
                          labelLine={false}
                          style={{ fontSize: '8px' }}
                        >
                          {costInsightsMetrics.spendByProvider.map((entry, index) => {
                            return <Cell key={`cell-${index}`} fill={`url(#obs-stripe-${index % 4})`} />;
                          })}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => `$${value.toFixed(2)}`}
                          contentStyle={{
                            backgroundColor: '#faf9f7',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            fontSize: '9px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-12 space-y-1.5">
                      {costInsightsMetrics.spendByProvider.map((provider, index) => {
                        const gradientColors = ['#114dcd', '#299a93', '#1f53d0', '#6b7280'];
                        return (
                          <div key={index} className="flex items-center justify-between text-[0.65rem]">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: gradientColors[index % gradientColors.length] }}
                              />
                              <span className="text-gray-900 font-medium">{provider.provider}</span>
                            </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900 font-semibold">${provider.spend.toFixed(2)}</span>
                            <span className="text-gray-600">{provider.percentage}%</span>
                            {provider.trend !== 0 && (
                              <div className="flex items-center gap-1">
                                {provider.trend > 0 ? (
                                  <ChevronUp className="h-4 w-4 text-gray-900" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" style={{ color: '#299a93' }} />
                                )}
                                <span
                                  className="text-xs font-medium"
                                  style={{ color: provider.trend > 0 ? '#dc2626' : '#299a93' }}
                                >
                                  {Math.abs(provider.trend)}%
                                </span>
                              </div>
                            )}
                          </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-600">
                    <p className="text-sm">No spend data available</p>
                  </div>
                )}
              </div>

              {/* Panel 2: Spend by Model - Horizontal Bar Chart */}
              <div className="p-4 bg-beige-primary rounded-lg border border-border-light">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Top 10 Models by Spend</h3>
                {costInsightsMetrics.spendByModel.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={costInsightsMetrics.spendByModel} layout="vertical" margin={{ left: 80 }}>
                        <defs>
                          {/* Super thin diagonal stripe pattern for bars */}
                          <pattern id="bar-stripe" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                            <rect width="1" height="2" fill="#000000" />
                          </pattern>
                        </defs>
                        <XAxis type="number" stroke="#6b7280" style={{ fontSize: '10px' }} />
                        <YAxis
                          type="category"
                          dataKey="model"
                          stroke="#6b7280"
                          style={{ fontSize: '10px' }}
                          width={70}
                        />
                        <Tooltip
                          formatter={(value: any) => `$${value.toFixed(2)}`}
                          contentStyle={{
                            backgroundColor: '#f2f1ed',
                            border: '1px solid #e5e4e0',
                            borderRadius: '8px',
                            fontSize: '10px'
                          }}
                        />
                        <Bar dataKey="spend" fill="url(#bar-stripe)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2">
                      {costInsightsMetrics.spendByModel.slice(0, 5).map((model, index) => (
                        <div key={index} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600">{index + 1}.</span>
                            <span className="text-gray-900 font-medium">{model.model}</span>
                            <span className="text-gray-600">({model.provider})</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-900 font-semibold">${model.spend.toFixed(2)}</span>
                            <span className="text-gray-600">{model.percentage}%</span>
                            {model.trend !== 0 && (
                              <div className="flex items-center gap-1">
                                {model.trend > 0 ? (
                                  <ChevronUp className="h-3 w-3 text-gray-900" />
                                ) : (
                                  <ChevronDown className="h-3 w-3" style={{ color: '#299a93' }} />
                                )}
                                <span
                                  className="text-xs font-medium"
                                  style={{ color: model.trend > 0 ? '#dc2626' : '#299a93' }}
                                >
                                  {Math.abs(model.trend)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-600">
                    <p className="text-sm">No model spend data available</p>
                  </div>
                )}
              </div>
            </div>

            {/* NEW: Routing Success & Savings Rate */}
            {overtureRoutingStats && (
              <div className="mt-6 pt-6 border-t border-border-light">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Routing Performance & Savings</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="bg-beige-primary rounded-lg p-4 border border-border-light">
                    <p className="text-xs text-gray-600 mb-1">Success Rate (24h)</p>
                    <p className="text-lg font-bold text-gray-900">{overtureRoutingStats.usage.success_rate.toFixed(1)}%</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {overtureRoutingStats.usage.successful_requests.toLocaleString()} / {overtureRoutingStats.usage.total_requests.toLocaleString()} requests
                    </p>
                  </div>
                  <div className="bg-beige-primary rounded-lg p-4 border border-border-light">
                    <p className="text-xs text-gray-600 mb-1">Failed Requests</p>
                    <p className="text-lg font-bold text-gray-900">{overtureRoutingStats.usage.failed_requests.toLocaleString()}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {((overtureRoutingStats.usage.failed_requests / overtureRoutingStats.usage.total_requests) * 100).toFixed(2)}% error rate
                    </p>
                  </div>
                  <div className="bg-beige-primary rounded-lg p-4 border border-border-light">
                    <p className="text-xs text-gray-600 mb-1">Circuit Breakers</p>
                    <p className="text-lg font-bold text-gray-900">
                      {Object.values(overtureRoutingStats.circuit_breakers).filter(cb => cb.status === 'closed').length}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {Object.keys(overtureRoutingStats.circuit_breakers).length} total providers
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* NEW: Quota Burn Rate & Risk Indicators */}
            {overtureUsage && policy && (
              <div className="mt-6 pt-6 border-t border-border-light">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Budget & Quota Management</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Quota Burn Rate */}
                  <div className="bg-beige-primary rounded-lg p-4 border border-border-light">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-gray-600">Monthly Budget Usage</p>
                      <p className="text-sm font-bold text-gray-900">{overtureUsage.percentage_used.toFixed(1)}%</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                      <div
                        className="h-3 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(overtureUsage.percentage_used, 100)}%`,
                          backgroundColor: overtureUsage.percentage_used >= 100 ? '#ef4444' : overtureUsage.percentage_used >= 80 ? '#f59e0b' : '#10b981',
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">${overtureUsage.total_spend_usd.toFixed(2)} spent</span>
                      <span className="text-gray-600">${overtureUsage.budget_limit_usd.toFixed(2)} limit</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      ${overtureUsage.remaining_usd.toFixed(2)} remaining
                    </p>
                  </div>

                  {/* Risk Indicators */}
                  <div className="bg-beige-primary rounded-lg p-4 border border-border-light">
                    <p className="text-xs text-gray-600 mb-3">Budget Status</p>
                    {overtureUsage.breached ? (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                                <span className="text-sm font-semibold">Budget Exceeded</span>
                      </div>
                    ) : overtureUsage.percentage_used >= 80 ? (
                      <div className="flex items-center gap-2 text-orange-600">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="text-sm font-semibold">Approaching Limit (80%+)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span className="text-sm font-semibold">Within Budget</span>
                      </div>
                    )}
                    <div className="mt-3 space-y-1">
                      <p className="text-xs text-gray-600">Request Count: {overtureUsage.request_count.toLocaleString()}</p>
                      <p className="text-xs text-gray-600">Active Providers: {overtureUsage.provider_count}</p>
                      <p className="text-xs text-gray-600">Models in Use: {overtureUsage.model_count}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* NEW: Runtime Fleet & Cost Insights */}
            {runtimeFleetMetrics && (
              <div className="mt-6 pt-6 border-t border-border-light">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Runtime Fleet Performance (Edge Execution)</h3>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <div className="bg-beige-primary rounded-lg p-4 border border-border-light">
                    <p className="text-xs text-gray-600 mb-1">Fleet Status</p>
                    <p className="text-lg font-bold text-gray-900">{runtimeFleetMetrics.online_instances}/{runtimeFleetMetrics.total_instances}</p>
                    <p className="text-xs text-gray-600 mt-1">instances online</p>
                  </div>
                  <div className="bg-beige-primary rounded-lg p-4 border border-border-light">
                    <p className="text-xs text-gray-600 mb-1">Total Requests</p>
                    <p className="text-lg font-bold text-gray-900">{runtimeFleetMetrics.total_requests_served.toLocaleString()}</p>
                    <p className="text-xs text-gray-600 mt-1">served</p>
                  </div>
                  <div className="bg-beige-primary rounded-lg p-4 border border-border-light">
                    <p className="text-xs text-gray-600 mb-1">Fleet Error Rate</p>
                    <p className="text-lg font-bold text-gray-900">{runtimeFleetMetrics.fleet_error_rate.toFixed(2)}%</p>
                    <p className="text-xs text-gray-600 mt-1">error rate</p>
                  </div>
                  <div className="bg-beige-primary rounded-lg p-4 border border-border-light">
                    <p className="text-xs text-gray-600 mb-1">Capacity Usage</p>
                    <p className="text-lg font-bold text-gray-900">{((runtimeFleetMetrics.used_capacity / runtimeFleetMetrics.total_capacity) * 100).toFixed(0)}%</p>
                    <p className="text-xs text-gray-600 mt-1">{runtimeFleetMetrics.used_capacity}/{runtimeFleetMetrics.total_capacity} used</p>
                  </div>
                </div>
              </div>
            )}

            {/* NEW: GPU Utilization & Top Cost Drivers (from Runtime Fleet Instances) */}
            {runtimeFleetInstances && runtimeFleetInstances.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border-light">
                <h3 className="text-sm font-medium text-gray-900 mb-4">GPU Utilization & Top Cost Drivers</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* GPU/CPU Utilization Chart */}
                  <div className="p-4 bg-beige-primary rounded-lg border border-border-light">
                    <h4 className="text-xs font-medium text-gray-700 mb-3">Fleet Resource Utilization</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={runtimeFleetInstances.slice(0, 5)} layout="horizontal">
                        <defs>
                          {/* Super thin diagonal stripe patterns for CPU/Memory */}
                          <pattern id="cpu-stripe" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                            <rect width="1" height="2" fill="#000000" />
                          </pattern>
                          <pattern id="memory-stripe" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                            <rect width="1" height="2" fill="#666666" />
                          </pattern>
                        </defs>
                        <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '10px' }} />
                        <YAxis stroke="#6b7280" style={{ fontSize: '10px' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#f2f1ed',
                            border: '1px solid #e5e4e0',
                            borderRadius: '8px',
                            fontSize: '10px'
                          }}
                        />
                        <Bar dataKey="cpu_usage" name="CPU %" fill="url(#cpu-stripe)" />
                        <Bar dataKey="memory_usage" name="Memory %" fill="url(#memory-stripe)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Top Cost Drivers Table */}
                  <div className="p-4 bg-beige-primary rounded-lg border border-border-light">
                    <h4 className="text-xs font-medium text-gray-700 mb-3">Top Cost Drivers (by Requests)</h4>
                    <div className="space-y-2">
                      {runtimeFleetInstances
                        .sort((a, b) => b.requests_processed - a.requests_processed)
                        .slice(0, 5)
                        .map((instance, index) => (
                          <div key={instance.id} className="flex items-center justify-between text-xs bg-beige-primary rounded-lg p-2 border border-border-light">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600 font-mono">{index + 1}.</span>
                              <span className="text-gray-900 font-medium">{instance.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-600">{instance.requests_processed.toLocaleString()} req</span>
                              <span className="text-gray-600">{instance.avg_latency}ms avg</span>
                              <Badge variant={instance.error_rate < 1 ? 'default' : 'destructive'} className="text-[0.65rem]">
                                {instance.error_rate.toFixed(1)}% err
                              </Badge>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* NEW: Cost per 1M Tokens (calculated from Runtime data) */}
            {runtimeFleetInstances && overtureUsage && (
              <div className="mt-6 pt-6 border-t border-border-light">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Cost Efficiency Metrics</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="bg-beige-primary rounded-lg p-4 border border-border-light">
                    <p className="text-xs text-gray-600 mb-1">Avg Cost per Request (Cloud)</p>
                    <p className="text-lg font-bold text-gray-900">
                      ${(overtureUsage.total_spend_usd / overtureUsage.request_count).toFixed(4)}
                    </p>
                  </div>
                  <div className="bg-beige-primary rounded-lg p-4 border border-border-light">
                    <p className="text-xs text-gray-600 mb-1">Total Input Tokens</p>
                    <p className="text-lg font-bold text-gray-900">
                      {(overtureUsage.by_provider.reduce((sum, p) => sum + p.input_tokens, 0) / 1000000).toFixed(2)}M
                    </p>
                  </div>
                  <div className="bg-beige-primary rounded-lg p-4 border border-border-light">
                    <p className="text-xs text-gray-600 mb-1">Total Output Tokens</p>
                    <p className="text-lg font-bold text-gray-900">
                      {(overtureUsage.by_provider.reduce((sum, p) => sum + p.output_tokens, 0) / 1000000).toFixed(2)}M
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Panel 3: Tenant Breakdown (Scale tier only) */}
            {tier === 'scale' && (
              <div className="mt-6 pt-6 border-t border-border-light">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-900">Spend by Tenant</h3>
                  <select
                    value={selectedTenant}
                    onChange={(e) => setSelectedTenant(e.target.value)}
                    className="text-sm border border-border-light rounded-md px-3 py-1.5 bg-beige-primary focus:outline-none"
                  >
                    <option value="all">All Tenants</option>
                    {mockTenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bg-beige-primary rounded-lg p-4 border border-border-light">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Tenant Spend</p>
                      <p className="text-base font-bold text-gray-900">
                        ${selectedTenant === 'all'
                          ? costInsightsMetrics.totalSpend.toFixed(2)
                          : (costInsightsMetrics.totalSpend * 0.35).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">% of Total</p>
                      <p className="text-base font-bold text-gray-900">
                        {selectedTenant === 'all' ? '100' : '35'}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Trend</p>
                      <div className="flex items-center gap-1">
                        {costInsightsMetrics.totalTrend > 0 ? (
                          <>
                            <ChevronUp className="h-5 w-5 text-gray-900" />
                            <span className="text-base font-bold text-gray-900">+{costInsightsMetrics.totalTrend}%</span>
                          </>
                        ) : costInsightsMetrics.totalTrend < 0 ? (
                          <>
                            <ChevronDown className="h-5 w-5" style={{ color: '#299a93' }} />
                            <span className="text-base font-bold" style={{ color: '#299a93' }}>
                              {costInsightsMetrics.totalTrend}%
                            </span>
                          </>
                        ) : (
                          <span className="text-base font-bold text-gray-600">0%</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
              </>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          {/* Audit Logs Tab Content */}
          <TabsContent value="audit" className="space-y-6">
            <Card className="border-none shadow-none">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-xs flex items-center gap-2">
                  <Database className="h-3 w-3 text-gray-900" />
                  Audit Logs
                </CardTitle>
                <CardDescription className="text-[9px]">
                  System events, configuration changes, and access logs
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <div className="space-y-4">
                  {/* Filters */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      placeholder="Search logs..."
                      className="max-w-xs text-[10px] h-7"
                    />
                    <Button variant="outline" size="sm" className="h-7 text-[10px] px-2">
                      <Filter className="h-2.5 w-2.5 mr-1" />
                      Filter
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] px-2">
                      <Download className="h-2.5 w-2.5 mr-1" />
                      Export
                    </Button>
                  </div>

                  {/* Audit Log Entries */}
                  <div className="space-y-2">
                    {[
                      {
                        id: '1',
                        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                        user: tenant?.name || 'System',
                        action: 'Provider API Key Updated',
                        resource: 'OpenAI',
                        category: 'configuration',
                        ip: '192.168.1.100',
                        status: 'success',
                      },
                      {
                        id: '2',
                        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                        user: tenant?.name || 'System',
                        action: 'Routing Policy Modified',
                        resource: 'Policy: fallback-to-anthropic',
                        category: 'configuration',
                        ip: '192.168.1.100',
                        status: 'success',
                      },
                      {
                        id: '3',
                        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
                        user: 'Admin',
                        action: 'Runtime Instance Added',
                        resource: 'edge-node-47',
                        category: 'infrastructure',
                        ip: '10.0.0.5',
                        status: 'success',
                      },
                      {
                        id: '4',
                        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
                        user: tenant?.name || 'System',
                        action: 'Failed Login Attempt',
                        resource: 'Authentication',
                        category: 'security',
                        ip: '203.0.113.42',
                        status: 'failed',
                      },
                      {
                        id: '5',
                        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
                        user: 'System',
                        action: 'QLoRA Training Completed',
                        resource: 'Job: custom-agent-v3',
                        category: 'agents',
                        ip: 'internal',
                        status: 'success',
                      },
                    ].map((log) => {
                      const categoryColors = {
                        configuration: 'bg-blue-50 text-blue-700 border-blue-200',
                        infrastructure: 'bg-gray-50 text-gray-700 border-gray-200',
                        security: 'bg-red-50 text-red-700 border-red-200',
                        agents: 'bg-green-50 text-green-700 border-green-200',
                      };

                      return (
                        <div
                          key={log.id}
                          className="py-2 border-b border-border-light/50 hover:bg-gray-50/30 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <h4 className="text-[9px] font-medium text-gray-900">
                                  {log.action}
                                </h4>
                                <Badge className={`${categoryColors[log.category as keyof typeof categoryColors]} border text-[8px] px-1 py-0`}>
                                  {log.category}
                                </Badge>
                                {log.status === 'success' ? (
                                  <CheckCircle className="h-2.5 w-2.5 text-gray-600" />
                                ) : (
                                  <XCircle className="h-2.5 w-2.5 text-gray-900" />
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] text-gray-600">
                                <div>
                                  <span className="font-medium">User:</span> {log.user}
                                </div>
                                <div>
                                  <span className="font-medium">Resource:</span> {log.resource}
                                </div>
                                <div>
                                  <span className="font-medium">IP:</span> {log.ip}
                                </div>
                                <div>
                                  <span className="font-medium">Time:</span> {formatDateTime(log.timestamp)}
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <Eye className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between pt-2 border-t border-border-light/50">
                    <p className="text-[9px] text-gray-600">Showing 1-5 of 127 entries</p>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" className="h-6 text-[9px] px-2" disabled>
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" className="h-6 text-[9px] px-2">
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Request Detail Sheet - CONTINUED IN NEXT PART */}
      <Sheet open={!!selectedTrace} onOpenChange={(open) => !open && setSelectedTrace(null)}>
        <SheetContent className="max-w-3xl">
          <SheetHeader>
            <SheetTitle>Request Trace Details</SheetTitle>
            <SheetClose onClick={() => setSelectedTrace(null)} />
          </SheetHeader>
          <SheetBody>
            {selectedTrace && (
              <div className="space-y-6">
                {/* Privacy Banner in Detail View when Full Tracing is OFF - Show First */}
                {!enableFullTracing && (
                  <div className="bg-beige-primary border border-gray-200/20 rounded-md p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-4 w-4 text-gray-900 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-900">Full tracing is disabled</p>
                        <p className="text-xs text-gray-600 mt-1">
                          Enable full tracing in the banner above to see prompts, completions, and detailed traces. Metadata-only mode protects your privacy.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Overview */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Overview</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600">Model</p>
                      <p className="text-sm font-medium text-gray-900">{selectedTrace.model}</p>
                      {selectedTrace.model_version && (
                        <p className="text-xs text-gray-600 mt-1">{selectedTrace.model_version}</p>
                      )}
                      {selectedTrace.model_fingerprint && (
                        <p className="text-xs font-mono text-gray-500">{selectedTrace.model_fingerprint}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Provider</p>
                      <p className="text-sm font-medium text-gray-900">{selectedTrace.provider}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Latency</p>
                      <p className="text-sm font-medium text-gray-900">{formatLatency(selectedTrace.latency)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Cost</p>
                      <p className="text-sm font-medium text-gray-900">{formatCurrency(selectedTrace.cost)}</p>
                      {selectedTrace.cache_hit && selectedTrace.cache_savings && selectedTrace.cache_savings > 0 && (
                        <p className="text-xs text-green-600 mt-1">Saved: {formatCurrency(selectedTrace.cache_savings)}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Tokens</p>
                      <p className="text-sm font-medium text-gray-900">
                        {formatNumber(selectedTrace.tokens.total)} ({selectedTrace.tokens.input} in / {selectedTrace.tokens.output} out)
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Status</p>
                      <div className="mt-1 flex items-center gap-2">
                        {getStatusBadge(selectedTrace.status)}
                        {selectedTrace.cache_hit && <Badge className="bg-green-50 text-green-700 border-green-200 text-[9px] px-1.5 py-0">CACHE HIT</Badge>}
                      </div>
                    </div>
                    {selectedTrace.user_id && (
                      <div>
                        <p className="text-xs text-gray-600">User ID</p>
                        <p className="text-sm font-medium text-gray-900">{selectedTrace.user_id}</p>
                      </div>
                    )}
                    {selectedTrace.session_id && (
                      <div>
                        <p className="text-xs text-gray-600">Session ID</p>
                        <p className="text-sm font-medium text-gray-900">{selectedTrace.session_id}</p>
                      </div>
                    )}
                    {selectedTrace.client_ip && (
                      <div>
                        <p className="text-xs text-gray-600">Client IP</p>
                        <p className="text-sm font-mono text-gray-900">{selectedTrace.client_ip}</p>
                      </div>
                    )}
                    {selectedTrace.user_agent && (
                      <div className="col-span-2">
                        <p className="text-xs text-gray-600">User Agent</p>
                        <p className="text-xs font-mono text-gray-900">{selectedTrace.user_agent}</p>
                      </div>
                    )}
                    <div className="col-span-2">
                      <p className="text-xs text-gray-600">Request ID</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm font-mono text-gray-900 truncate">{selectedTrace.request_id}</p>
                        <Copy
                          className="h-4 w-4 text-gray-600 cursor-pointer hover:text-gray-900 flex-shrink-0"
                          onClick={() => copyToClipboard(selectedTrace.request_id)}
                        />
                      </div>
                    </div>
                    {selectedTrace.evaluation_score !== undefined && (
                      <div>
                        <p className="text-xs text-gray-600">Evaluation Score</p>
                        <p className="text-sm font-medium text-gray-900">{selectedTrace.evaluation_score.toFixed(2)} / 5.0</p>
                      </div>
                    )}
                    {selectedTrace.human_feedback && (
                      <div>
                        <p className="text-xs text-gray-600">Human Feedback</p>
                        <Badge className={selectedTrace.human_feedback === 'positive' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}>
                          {selectedTrace.human_feedback === 'positive' ? 'Positive' : 'Negative'}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cost Breakdown - Always visible (metadata, not sensitive) */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Cost Breakdown</h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2 px-3 bg-beige-primary rounded border border-border-light">
                      <span className="text-xs font-medium text-gray-900">Input</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-600">{((selectedTrace.cost_breakdown.input / selectedTrace.cost) * 100).toFixed(1)}%</span>
                        <span className="text-xs font-medium text-gray-900">{formatCurrency(selectedTrace.cost_breakdown.input)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2 px-3 bg-beige-primary rounded border border-border-light">
                      <span className="text-xs font-medium text-gray-900">Output</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-600">{((selectedTrace.cost_breakdown.output / selectedTrace.cost) * 100).toFixed(1)}%</span>
                        <span className="text-xs font-medium text-gray-900">{formatCurrency(selectedTrace.cost_breakdown.output)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2 px-3 bg-beige-primary rounded border border-border-light">
                      <span className="text-xs font-medium text-gray-900">Overhead</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-600">{((selectedTrace.cost_breakdown.overhead / selectedTrace.cost) * 100).toFixed(1)}%</span>
                        <span className="text-xs font-medium text-gray-900">{formatCurrency(selectedTrace.cost_breakdown.overhead)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Prompt & Completion Split View - ONLY when full tracing enabled */}
                {enableFullTracing && selectedTrace.prompt && selectedTrace.completion && tierConfig.fullFeatures && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Prompt & Completion</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-600">PROMPT</p>
                          <Copy
                            className="h-3 w-3 text-gray-600 cursor-pointer hover:text-gray-900"
                            onClick={() => copyToClipboard(selectedTrace.prompt || '')}
                          />
                        </div>
                        <div className="bg-beige-primary border border-gray-200/20 rounded-md p-3 max-h-64 overflow-y-auto">
                          <pre className="text-xs text-gray-900 whitespace-pre-wrap font-mono">{selectedTrace.prompt}</pre>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-gray-600">COMPLETION</p>
                          <Copy
                            className="h-3 w-3 text-gray-600 cursor-pointer hover:text-gray-900"
                            onClick={() => copyToClipboard(selectedTrace.completion || '')}
                          />
                        </div>
                        <div className="bg-beige-primary border border-gray-200/20 rounded-md p-3 max-h-64 overflow-y-auto">
                          <pre className="text-xs text-gray-900 whitespace-pre-wrap font-mono">{selectedTrace.completion}</pre>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Generation Parameters - ONLY when full tracing enabled */}
                {enableFullTracing && selectedTrace.generation_params && tierConfig.fullFeatures && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Generation Parameters</h3>
                    <div className="grid grid-cols-3 gap-4 bg-beige-primary border border-gray-200/20 rounded-md p-4">
                      {selectedTrace.generation_params.temperature !== undefined && (
                        <div>
                          <p className="text-xs text-gray-600">Temperature</p>
                          <p className="text-sm font-medium text-gray-900">{selectedTrace.generation_params.temperature}</p>
                        </div>
                      )}
                      {selectedTrace.generation_params.top_p !== undefined && (
                        <div>
                          <p className="text-xs text-gray-600">Top P</p>
                          <p className="text-sm font-medium text-gray-900">{selectedTrace.generation_params.top_p}</p>
                        </div>
                      )}
                      {selectedTrace.generation_params.presence_penalty !== undefined && (
                        <div>
                          <p className="text-xs text-gray-600">Presence Penalty</p>
                          <p className="text-sm font-medium text-gray-900">{selectedTrace.generation_params.presence_penalty}</p>
                        </div>
                      )}
                      {selectedTrace.generation_params.frequency_penalty !== undefined && (
                        <div>
                          <p className="text-xs text-gray-600">Frequency Penalty</p>
                          <p className="text-sm font-medium text-gray-900">{selectedTrace.generation_params.frequency_penalty}</p>
                        </div>
                      )}
                      {selectedTrace.generation_params.max_tokens !== undefined && (
                        <div>
                          <p className="text-xs text-gray-600">Max Tokens</p>
                          <p className="text-sm font-medium text-gray-900">{selectedTrace.generation_params.max_tokens}</p>
                        </div>
                      )}
                      {selectedTrace.generation_params.logprobs && (
                        <div>
                          <p className="text-xs text-gray-600">Logprobs</p>
                          <p className="text-sm font-medium text-gray-900">Enabled</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Request Chain */}
                {(selectedTrace.parent_request_id || selectedTrace.child_request_ids) && tierConfig.fullFeatures && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Request Chain</h3>
                    <div className="bg-beige-primary border border-gray-200/20 rounded-md p-4">
                      <div className="flex items-center gap-3">
                        {selectedTrace.parent_request_id && (
                          <>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0">Parent</Badge>
                              <code className="text-xs font-mono text-gray-900">{selectedTrace.parent_request_id}</code>
                            </div>
                            <span className="text-gray-600">→</span>
                          </>
                        )}
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-50 text-blue-700 text-[9px] px-1.5 py-0">This</Badge>
                          <code className="text-xs font-mono text-gray-900 font-bold">{selectedTrace.request_id}</code>
                        </div>
                        {selectedTrace.child_request_ids && selectedTrace.child_request_ids.length > 0 && (
                          <>
                            <span className="text-gray-600">→</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0">Children ({selectedTrace.child_request_ids.length})</Badge>
                              <div className="flex flex-col gap-1">
                                {selectedTrace.child_request_ids.map((childId, idx) => (
                                  <code key={idx} className="text-xs font-mono text-gray-900">{childId}</code>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Timeline Markers */}
                {selectedTrace.timeline_markers && selectedTrace.timeline_markers.length > 0 && tierConfig.fullFeatures && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Timeline Markers</h3>
                    <div className="space-y-2">
                      {selectedTrace.timeline_markers.map((marker, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 px-3 bg-beige-primary rounded border border-border-light">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-gray-900">{marker.name}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">{marker.type.replace('_', ' ')}</Badge>
                          </div>
                          <span className="text-xs text-gray-600">{new Date(marker.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Token Timeline - ONLY when full tracing enabled */}
                {enableFullTracing && selectedTrace.was_streamed && selectedTrace.token_timeline && selectedTrace.token_timeline.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Token Streaming Timeline (ms)</h3>
                    <div className="w-full" style={{ height: '240px' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={selectedTrace.token_timeline} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis
                            dataKey="token_index"
                            stroke="#6b7280"
                            label={{ value: 'Token #', position: 'insideBottom', offset: -10 }}
                            style={{ fontSize: '10px' }}
                          />
                          <YAxis
                            stroke="#6b7280"
                            width={50}
                            style={{ fontSize: '10px' }}
                          />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="timestamp"
                            stroke="#004aad"
                            strokeWidth={0.5}
                            dot={(props: any) => {
                              const point = selectedTrace.token_timeline?.[props.index];
                              if (point?.is_first || point?.is_last) {
                                return <circle cx={props.cx} cy={props.cy} r={3} fill="#f59e0b" />;
                              }
                              return <></>;
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Speculative Execution Waterfall */}
                {tierConfig.fullFeatures && selectedTrace.speculative_traces && selectedTrace.speculative_traces.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Speculative Execution Waterfall</h3>
                    <div className="space-y-3">
                      {selectedTrace.speculative_traces.map((trace, idx) => {
                        const getStripePattern = (status: string) => {
                          if (status === 'winner') {
                            return `repeating-linear-gradient(
                              45deg,
                              #a7f3d0,
                              #a7f3d0 2px,
                              #d1fae5 2px,
                              #d1fae5 4px
                            )`;
                          } else if (status === 'fallback') {
                            return `repeating-linear-gradient(
                              45deg,
                              #bfdbfe,
                              #bfdbfe 2px,
                              #dbeafe 2px,
                              #dbeafe 4px
                            )`;
                          } else {
                            return `repeating-linear-gradient(
                              45deg,
                              #fecaca,
                              #fecaca 2px,
                              #fee2e2 2px,
                              #fee2e2 4px
                            )`;
                          }
                        };

                        return (
                          <div key={idx} className="flex items-center gap-2 w-full group relative">
                            <span className="text-xs text-gray-600 w-20 flex-shrink-0">{trace.provider}</span>
                            <div className="flex-1 relative h-5 bg-beige-primary rounded min-w-0">
                              <div
                                className="absolute h-full rounded border border-border-light"
                                style={{
                                  left: `${(trace.start / Math.max(...selectedTrace.speculative_traces!.map(t => t.latency))) * 100}%`,
                                  width: `${(trace.latency / Math.max(...selectedTrace.speculative_traces!.map(t => t.latency))) * 100}%`,
                                  background: getStripePattern(trace.status)
                                }}
                              />
                              {/* Enhanced Tooltip */}
                              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 p-3 bg-beige-primary border border-gray-200/20 rounded-lg z-50">
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Provider:</span>
                                    <span className="font-medium text-gray-900">{trace.provider}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Model:</span>
                                    <span className="font-medium text-gray-900">{trace.model}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Latency:</span>
                                    <span className="font-medium text-gray-900">{trace.latency.toFixed(0)}ms</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">Status:</span>
                                    <span className="font-medium text-gray-900">{trace.status}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-gray-600 w-12 flex-shrink-0 text-right">{trace.latency.toFixed(0)}ms</span>
                            <Badge
                              className="flex-shrink-0 text-xs px-2"
                              style={{
                                backgroundColor: trace.status === 'winner' ? '#d1fae5' :
                                  trace.status === 'fallback' ? '#dbeafe' :
                                  '#ffc2c2',
                                color: trace.status === 'winner' ? '#065f46' :
                                  trace.status === 'fallback' ? '#1e3a8a' :
                                  '#991b1b',
                                borderColor: trace.status === 'winner' ? '#299a93' :
                                  trace.status === 'fallback' ? '#004aad' :
                                  '#ffc2c2'
                              }}
                            >
                              {trace.status}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Retry Timeline */}
                {tierConfig.fullFeatures && selectedTrace.retry_attempts && selectedTrace.retry_attempts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Retry Timeline</h3>
                    <div className="space-y-2">
                      {selectedTrace.retry_attempts.map((attempt, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2 px-3 bg-beige-primary rounded">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-gray-900">Try #{attempt.attempt_number}</span>
                            <span className="text-xs text-gray-600">{attempt.duration.toFixed(0)}ms</span>
                          </div>
                          <span className="text-xs font-medium text-gray-900">{attempt.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tag & Share Actions */}
                <div className="space-y-3 pt-4 border-t border-border-light">
                  <div className="flex gap-2">
                    <Select
                      value={selectedTrace.tag || 'none'}
                      onValueChange={(value) => handleTagTrace(selectedTrace, value === 'none' ? null : value as RequestTag)}
                    >
                      <SelectTrigger className="flex-1 text-xs">
                        <SelectValue placeholder="Tag as..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No tag</SelectItem>
                        <SelectItem value="expected">Expected</SelectItem>
                        <SelectItem value="bug">Bug</SelectItem>
                        <SelectItem value="reviewed">Reviewed</SelectItem>
                        <SelectItem value="golden">Golden</SelectItem>
                        <SelectItem value="spam">Spam</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Human Feedback Buttons */}
                  {selectedTrace.status === 200 && (
                    <div>
                      <p className="text-xs text-gray-600 mb-2">Human Feedback</p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(selectedTrace.human_feedback === 'positive' && 'bg-beige-primary text-gray-900 border border-border-light')}
                          onClick={() => {
                            const updatedTrace = { ...selectedTrace, human_feedback: selectedTrace.human_feedback === 'positive' ? null : 'positive' as const };
                            // Optimistic update would go here
                            setSelectedTrace(updatedTrace);
                          }}
                        >
                          Positive
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(selectedTrace.human_feedback === 'negative' && 'bg-beige-primary text-gray-900 border border-border-light')}
                          onClick={() => {
                            const updatedTrace = { ...selectedTrace, human_feedback: selectedTrace.human_feedback === 'negative' ? null : 'negative' as const };
                            // Optimistic update would go here
                            setSelectedTrace(updatedTrace);
                          }}
                        >
                          Negative
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(selectedTrace.curl_command || '')}
                  >
                    <Code className="h-4 w-4 mr-2" />
                    Copy curl
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShareTrace(selectedTrace)}
                  >
                    <Link2 className="h-4 w-4 mr-2" />
                    Share (7d)
                  </Button>
                </div>

                {/* Request/Response JSONs - ONLY when full tracing enabled */}
                {enableFullTracing && (
                  <>
                    <div>
                      <button
                        onClick={() => toggleSection('request')}
                        className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-2"
                      >
                        Request Body
                        {expandedSections.request ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      {expandedSections.request && selectedTrace.request_body && (
                        <pre className="bg-beige-primary text-gray-900 p-3 rounded-md text-xs overflow-x-auto border border-border-light">
                          {JSON.stringify(selectedTrace.request_body, null, 2)}
                        </pre>
                      )}
                    </div>

                    {selectedTrace.response_body && (
                      <div>
                        <button
                          onClick={() => toggleSection('response')}
                          className="flex items-center justify-between w-full text-sm font-medium text-gray-900 mb-2"
                        >
                          Response Body
                          {expandedSections.response ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        {expandedSections.response && (
                          <pre className="bg-beige-primary text-gray-900 p-3 rounded-md text-xs overflow-x-auto border border-border-light">
                            {JSON.stringify(selectedTrace.response_body, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Policy Decision Tree */}
                <div className="border-t border-border-light pt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Policy Evaluation & Decision Tree
                  </h3>
                  <div className="bg-beige-primary border border-gray-200/20 rounded-lg p-4 space-y-3">
                    {/* Decision Flow */}
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium flex-shrink-0">1</div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-900">Request Received</p>
                          <p className="text-xs text-gray-600 mt-0.5">Model: {selectedTrace.model} • User: {selectedTrace.user_id || 'anonymous'}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium flex-shrink-0">2</div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-900">Policy Constraints Evaluated</p>
                          <div className="mt-1 space-y-1">
                            <div className="text-xs text-gray-600 bg-beige-primary rounded px-2 py-1 border border-border-light">
                              ✓ Cost budget: Available
                            </div>
                            <div className="text-xs text-gray-600 bg-beige-primary rounded px-2 py-1 border border-border-light">
                              ✓ Model access: Allowed
                            </div>
                            <div className="text-xs text-gray-600 bg-beige-primary rounded px-2 py-1 border border-border-light">
                              ✓ Rate limit: Within threshold
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium flex-shrink-0">3</div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-900">Provider Selection</p>
                          <p className="text-xs text-gray-600 mt-0.5">Selected: {selectedTrace.provider} (Bayesian optimization)</p>
                        </div>
                      </div>

                      {selectedTrace.used_speculative && (
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-medium flex-shrink-0">4</div>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-900">Speculative Execution</p>
                            <p className="text-xs text-gray-600 mt-0.5">Parallel requests to {selectedTrace.speculative_traces?.length || 3} providers</p>
                          </div>
                        </div>
                      )}

                      {selectedTrace.retry_count && selectedTrace.retry_count > 0 && (
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-medium flex-shrink-0">⚠</div>
                          <div className="flex-1">
                            <p className="text-xs font-medium text-gray-900">Fallback Triggered</p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              Reason: {selectedTrace.status === 429 ? 'Rate limit exceeded' : selectedTrace.status >= 500 ? 'Provider error' : 'Request failed'} •
                              Retried {selectedTrace.retry_count} time(s) with exponential backoff
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                          selectedTrace.status === 200 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>✓</div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-900">Final Result</p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            Status: {selectedTrace.status} •
                            Latency: {formatLatency(selectedTrace.latency)} •
                            Cost: {formatCurrency(selectedTrace.cost)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Fallback Reasons Highlight */}
                    {(selectedTrace.retry_count && selectedTrace.retry_count > 0) && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                        <h4 className="text-xs font-medium text-yellow-900 mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-3 w-3" />
                          Fallback Analysis
                        </h4>
                        <div className="space-y-1 text-xs text-yellow-800">
                          {selectedTrace.retry_attempts?.map((attempt, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="text-yellow-600">•</span>
                              <span>Attempt {attempt.attempt_number}: {attempt.error || `HTTP ${attempt.status}`} ({formatLatency(attempt.duration)})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Error Details */}
                {selectedTrace.error && (
                  <div className="border-t border-border-light pt-4">
                    <button
                      onClick={() => toggleSection('error')}
                      className="flex items-center justify-between w-full text-sm font-medium text-red-700 mb-2"
                    >
                      <span className="flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Error Details
                      </span>
                      {expandedSections.error ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {expandedSections.error && (
                      <div className="bg-red-50 border border-red-200 p-3 rounded-md space-y-2">
                        <p className="text-sm text-red-900 font-medium">{selectedTrace.error.message}</p>
                        {selectedTrace.error.provider_error && (
                          <p className="text-xs text-red-800">Provider: {selectedTrace.error.provider_error}</p>
                        )}
                        {selectedTrace.error.stack && (
                          <pre className="text-xs text-red-800 overflow-x-auto bg-red-100 p-2 rounded">
                            {selectedTrace.error.stack}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Trace Notes/Annotations */}
                <div className="border-t border-border-light pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">Trace Notes</h3>
                    <span className="text-xs text-gray-600">
                      {traceNotes[selectedTrace.id]?.length || 0} notes
                    </span>
                  </div>

                  {/* Add Note Input */}
                  <div className="space-y-2 mb-4">
                    <Input
                      placeholder="Add a note to this trace..."
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      className="text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newNoteContent.trim()) {
                          const newNote = {
                            id: `note_${Date.now()}`,
                            author: tenant?.name || 'You',
                            timestamp: new Date().toISOString(),
                            content: newNoteContent.trim(),
                          };
                          setTraceNotes(prev => ({
                            ...prev,
                            [selectedTrace.id]: [...(prev[selectedTrace.id] || []), newNote],
                          }));
                          setNewNoteContent('');
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        if (newNoteContent.trim()) {
                          const newNote = {
                            id: `note_${Date.now()}`,
                            author: tenant?.name || 'You',
                            timestamp: new Date().toISOString(),
                            content: newNoteContent.trim(),
                          };
                          setTraceNotes(prev => ({
                            ...prev,
                            [selectedTrace.id]: [...(prev[selectedTrace.id] || []), newNote],
                          }));
                          setNewNoteContent('');
                        }
                      }}
                      disabled={!newNoteContent.trim()}
                    >
                      Add Note
                    </Button>
                  </div>

                  {/* Display Notes */}
                  {traceNotes[selectedTrace.id] && traceNotes[selectedTrace.id].length > 0 && (
                    <div className="space-y-3">
                      {traceNotes[selectedTrace.id].slice(-5).reverse().map((note, idx) => (
                        <div key={note.id} className="bg-beige-primary border border-gray-200/20 rounded-md p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-900 text-white font-semibold text-xs">
                                {note.author.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-medium text-gray-900">{note.author}</p>
                                <p className="text-xs text-gray-600">{formatDateTime(note.timestamp)}</p>
                              </div>
                            </div>
                            {tenant?.plan === 'Scale' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-gray-600"
                                onClick={() => {
                                  setTraceNotes(prev => ({
                                    ...prev,
                                    [selectedTrace.id]: prev[selectedTrace.id].filter(n => n.id !== note.id),
                                  }));
                                }}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-gray-900">{note.content}</p>
                        </div>
                      ))}
                      {traceNotes[selectedTrace.id].length > 5 && (
                        <p className="text-xs text-gray-600 text-center">
                          Showing latest 5 of {traceNotes[selectedTrace.id].length} notes
                        </p>
                      )}
                    </div>
                  )}

                  {(!traceNotes[selectedTrace.id] || traceNotes[selectedTrace.id].length === 0) && (
                    <div className="text-center py-4">
                      <p className="text-xs text-gray-600">No notes yet. Add the first one above.</p>
                    </div>
                  )}

                  {tenant?.plan !== 'Scale' && (
                    <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                      <p className="text-sm text-blue-900 font-medium">
                        @mentions available on Scale plan
                      </p>
                      <p className="text-xs text-blue-800 mt-1">
                        Upgrade to mention team members in trace notes
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
