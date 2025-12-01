'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetBody } from '@/components/ui/sheet';
import { useTenant } from '@/hooks/useTenant';
import { formatCurrency, formatNumber, formatLatency, formatDateTime, downloadCSV, downloadJSON, cn } from '@/utils/helpers';
import {
  Activity, Download, Clock, Database, Filter, Search, X,
  ChevronDown, ChevronUp, Copy, Share2, AlertCircle, CheckCircle,
  XCircle, Loader2, BarChart3, Zap, Tag, Code, Link2, Eye
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CHART_COLORS } from '@/utils/constants';

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
      { provider: 'OpenAI', start: 0, duration: latency * 1.2, status: 'failed' as const, latency: latency * 1.2 },
      { provider: 'Anthropic', start: 0, duration: latency, status: 'winner' as const, latency },
      { provider: 'Google', start: 0, duration: latency * 1.5, status: 'fallback' as const, latency: latency * 1.5 },
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
      user_agent: ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'schlep-sdk/1.0', 'python-requests/2.31.0'][Math.floor(Math.random() * 3)],
      request_id: `req_${Date.now()}_${i}`,
      parent_request_id: hasParent ? `req_${Date.now()}_${i - 1}` : undefined,
      child_request_ids: hasChildren ? [`req_${Date.now()}_${i + 1}`, `req_${Date.now()}_${i + 2}`] : undefined,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'schlep-sdk/1.0',
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
      shared_url: Math.random() > 0.8 ? `https://schlep.ai/traces/${i}?token=abc123` : undefined,
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

  // State
  const [traces, setTraces] = useState<RequestTrace[]>(() => generateMockTraces(150));
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

  // Real-time metrics state (updates every 5s)
  const [realTimeMetrics, setRealTimeMetrics] = useState({
    requestsPerSecond: 12.5,
    p50Latency: 145,
    p95Latency: 320,
    costPerHour: 2.34,
    activeProviders: 4,
    requestsSparkline: Array.from({ length: 12 }, (_, i) => ({ value: 10 + Math.random() * 10 })),
  });

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

  // Real-time metrics update every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRealTimeMetrics({
        requestsPerSecond: 8 + Math.random() * 10,
        p50Latency: 120 + Math.random() * 80,
        p95Latency: 280 + Math.random() * 100,
        costPerHour: 2 + Math.random() * 1.5,
        activeProviders: 3 + Math.floor(Math.random() * 3),
        requestsSparkline: Array.from({ length: 12 }, (_, i) => ({ value: 8 + Math.random() * 10 })),
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);



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

  // Cost Insights - 30-day calculations
  const costInsightsMetrics = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = now - (60 * 24 * 60 * 60 * 1000);

    // Last 30 days
    const last30DayTraces = traces.filter(t => {
      const traceTime = new Date(t.timestamp).getTime();
      return traceTime >= thirtyDaysAgo && traceTime <= now;
    });

    // Previous 30 days (30-60 days ago)
    const prev30DayTraces = traces.filter(t => {
      const traceTime = new Date(t.timestamp).getTime();
      return traceTime >= sixtyDaysAgo && traceTime < thirtyDaysAgo;
    });

    // Spend by provider (last 30 days)
    const providerSpend: Record<string, number> = {};
    const prevProviderSpend: Record<string, number> = {};

    last30DayTraces.forEach(trace => {
      providerSpend[trace.provider] = (providerSpend[trace.provider] || 0) + trace.cost;
    });

    prev30DayTraces.forEach(trace => {
      prevProviderSpend[trace.provider] = (prevProviderSpend[trace.provider] || 0) + trace.cost;
    });

    const totalSpend = Object.values(providerSpend).reduce((sum, cost) => sum + cost, 0);
    const prevTotalSpend = Object.values(prevProviderSpend).reduce((sum, cost) => sum + cost, 0);

    const spendByProvider = Object.entries(providerSpend).map(([provider, spend]) => {
      const percentage = totalSpend > 0 ? (spend / totalSpend) * 100 : 0;
      const prevSpend = prevProviderSpend[provider] || 0;
      const trend = prevSpend > 0 ? ((spend - prevSpend) / prevSpend) * 100 : 0;

      return {
        provider,
        spend: parseFloat(spend.toFixed(2)),
        percentage: parseFloat(percentage.toFixed(1)),
        trend: parseFloat(trend.toFixed(1))
      };
    }).sort((a, b) => b.spend - a.spend);

    // Spend by model (last 30 days, top 10)
    const modelSpend: Record<string, { spend: number; provider: string; requests: number }> = {};
    const prevModelSpend: Record<string, number> = {};

    last30DayTraces.forEach(trace => {
      if (!modelSpend[trace.model]) {
        modelSpend[trace.model] = { spend: 0, provider: trace.provider, requests: 0 };
      }
      modelSpend[trace.model].spend += trace.cost;
      modelSpend[trace.model].requests++;
    });

    prev30DayTraces.forEach(trace => {
      prevModelSpend[trace.model] = (prevModelSpend[trace.model] || 0) + trace.cost;
    });

    const spendByModel = Object.entries(modelSpend).map(([model, data]) => {
      const percentage = totalSpend > 0 ? (data.spend / totalSpend) * 100 : 0;
      const prevSpend = prevModelSpend[model] || 0;
      const trend = prevSpend > 0 ? ((data.spend - prevSpend) / prevSpend) * 100 : 0;

      return {
        model,
        provider: data.provider,
        spend: parseFloat(data.spend.toFixed(2)),
        percentage: parseFloat(percentage.toFixed(1)),
        requests: data.requests,
        trend: parseFloat(trend.toFixed(1))
      };
    }).sort((a, b) => b.spend - a.spend).slice(0, 10);

    return {
      spendByProvider,
      spendByModel,
      totalSpend: parseFloat(totalSpend.toFixed(2)),
      prevTotalSpend: parseFloat(prevTotalSpend.toFixed(2)),
      totalTrend: prevTotalSpend > 0 ? parseFloat((((totalSpend - prevTotalSpend) / prevTotalSpend) * 100).toFixed(1)) : 0
    };
  }, [traces]);

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
    const sharedUrl = `https://schlep.ai/traces/${trace.id}?token=${btoa(Date.now().toString())}`;
    copyToClipboard(sharedUrl);
    // Update trace with shared URL
    setTraces(prev => prev.map(t => t.id === trace.id ? { ...t, shared_url: sharedUrl } : t));
    alert('Trace URL copied to clipboard! Valid for 7 days.');
  };

  const handleTagTrace = (trace: RequestTrace, tag: RequestTag) => {
    setTraces(prev => prev.map(t => t.id === trace.id ? { ...t, tag } : t));
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
      setTraces([]);
      setSelectedTrace(null);
      alert('All traces have been permanently deleted.');
    }
  };

  const getStatusBadge = (status: number) => {
    if (status === 200) {
      return <Badge className="bg-green-50 text-green-700 border-green-200">200 OK</Badge>;
    } else if (status === 429) {
      return <Badge style={{ backgroundColor: '#ffc2c2', color: '#991b1b', borderColor: '#ffc2c2' }}>429 Rate Limit</Badge>;
    } else if (status === 500) {
      return <Badge style={{ backgroundColor: '#ffc2c2', color: '#991b1b', borderColor: '#ffc2c2' }}>{status} Error</Badge>;
    } else {
      return <Badge className="bg-red-50 text-red-700 border-red-200">{status} Error</Badge>;
    }
  };

  const getTagBadge = (tag: RequestTag) => {
    if (!tag) return null;
    const config = {
      expected: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Expected' },
      bug: { bg: 'bg-red-50', text: 'text-red-700', label: 'Bug' },
      reviewed: { bg: 'bg-green-50', text: 'text-green-700', label: 'Reviewed' },
      golden: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Golden' },
      spam: { bg: 'bg-gray-50', text: 'text-gray-700', label: 'Spam' },
    };
    const { bg, text, label } = config[tag];
    return <Badge className={cn(bg, text, 'border')}>{label}</Badge>;
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 font-inter">
                Observability
              </h1>
              <p className="text-gray-700 mt-1 font-inter font-medium">
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
                onChange={(e) => setFilters({ ...filters, timeRange: e.target.value })}
                className="w-32"
              >
                <option value="1h">1 hour</option>
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
              </Select>

              {/* Retention Badge */}
              {tier === 'growth' ? (
                <a
                  href="/pricing"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer text-sm font-medium"
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>30 days</span>
                  <span className="text-blue-600">·</span>
                  <span className="text-blue-600">Upgrade to 90 days (Scale)</span>
                </a>
              ) : (
                <Badge className="bg-green-50 text-green-700 border-green-200 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm">
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>90 days retention</span>
                </Badge>
              )}

              {/* Multi-Tenant Dropdown (Scale Only) */}
              {tier === 'scale' ? (
                <Select
                  value={selectedTenant}
                  onChange={(e) => setSelectedTenant(e.target.value)}
                  className="w-48"
                >
                  {mockTenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
              ) : (
                <div className="relative group">
                  <Select
                    disabled
                    className="w-48 cursor-not-allowed opacity-60"
                  >
                    <option>All tenants</option>
                  </Select>
                  <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 bg-beige-primary border border-border-light rounded-lg shadow-lg p-3 z-50">
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
                        className="p-1 hover:bg-beige-secondary rounded-md transition-colors"
                        onMouseEnter={() => setShowTracingInfo(true)}
                        onMouseLeave={() => setShowTracingInfo(false)}
                        onClick={() => setShowTracingInfo(!showTracingInfo)}
                      >
                        <AlertCircle className="h-5 w-5 text-gray-600" />
                      </button>
                      {showTracingInfo && (
                        <div className="absolute top-full right-0 mt-2 w-80 bg-beige-primary border border-border-light rounded-lg shadow-lg p-4 z-50">
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
                      className="shadow-md text-red-600 border-red-300 hover:bg-red-50"
                      onClick={handleDeleteAllTraces}
                    >
                      Delete All Traces
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    className="shadow-md"
                    onClick={() => setEnableFullTracing(false)}
                  >
                    Disable Full Tracing
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  className="shadow-md"
                  onClick={() => setEnableFullTracing(true)}
                >
                  Enable Full Tracing
                </Button>
              )}
              {tierConfig.fullFeatures && (
                <>
                  <Button variant="outline" className="shadow-md" onClick={handleExportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button variant="outline" className="shadow-md" onClick={handleExportJSON}>
                    <Download className="h-4 w-4 mr-2" />
                    Export JSON
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 1. REAL-TIME METRICS - Live updating every 5s */}
        <Card className="border-border-light shadow-md bg-gradient-to-br from-beige-primary to-beige-secondary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-900 animate-pulse" />
              Real-Time Metrics
              <Badge className="bg-green-50 text-green-700 border-green-200 text-xs ml-2">LIVE</Badge>
            </CardTitle>
            <CardDescription>Updates every 5 seconds</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {/* Requests/Second */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Requests / Second</p>
                <div className="flex items-end gap-3">
                  <p className="text-3xl font-bold text-gray-900">{realTimeMetrics.requestsPerSecond.toFixed(1)}</p>
                  <div className="flex-1 h-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={realTimeMetrics.requestsSparkline}>
                        <Line type="monotone" dataKey="value" stroke="#000000" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <p className="text-xs text-gray-600">Last 60 seconds</p>
              </div>

              {/* P50/P95 Latency */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">P50 / P95 Latency</p>
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-bold text-gray-900">{realTimeMetrics.p50Latency.toFixed(0)}ms</p>
                    <span className="text-xs text-gray-600">P50</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-xl font-semibold text-gray-700">{realTimeMetrics.p95Latency.toFixed(0)}ms</p>
                    <span className="text-xs text-gray-600">P95</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600">Last 5 minutes</p>
              </div>

              {/* Cost/Hour */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Cost / Hour</p>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-gray-900">${realTimeMetrics.costPerHour.toFixed(2)}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span>Projected: ${(realTimeMetrics.costPerHour * 24).toFixed(2)}/day</span>
                  </div>
                </div>
                <p className="text-xs text-gray-600">Last hour</p>
              </div>

              {/* Active Providers */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Active Providers</p>
                <p className="text-3xl font-bold text-gray-900">{realTimeMetrics.activeProviders}</p>
                <div className="flex gap-1 mt-2">
                  {['OpenAI', 'Anthropic', 'Google', 'xAI', 'Cohere'].slice(0, realTimeMetrics.activeProviders).map((provider, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{provider}</Badge>
                  ))}
                </div>
                <p className="text-xs text-gray-600">Currently responding</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tier Upgrade Banner for Growth Users */}
        {!tierConfig.fullFeatures && (
          <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-100 rounded-full p-3">
                    <Zap className="h-6 w-6 text-blue-700" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      Unlock the Full Observability Experience
                    </h3>
                    <p className="text-sm text-gray-700 mt-1">
                      Upgrade to Scale for: Prompt/Completion split view • Generation parameters • Request chains • Timeline markers • Saved filter presets • 90-day retention • Unlimited exports
                    </p>
                  </div>
                </div>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                  onClick={() => router.push('/dashboard/settings?tab=billing')}
                >
                  Upgrade to Scale
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Traces
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(metrics.total)}</div>
              <p className="text-xs text-gray-600 mt-1">
                Last {filters.timeRange === '1h' ? 'hour' : filters.timeRange === '24h' ? '24h' : filters.timeRange === '7d' ? '7 days' : '30 days'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Avg Latency
              </CardTitle>
              <Clock className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatLatency(metrics.avgLatency)}</div>
              <p className="text-xs text-gray-600 mt-1">Response time</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Cost
              </CardTitle>
              <Zap className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(metrics.totalCost)}</div>
              <p className="text-xs text-gray-600 mt-1">This period</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Error Rate
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{metrics.errorRate.toFixed(1)}%</div>
              <p className="text-xs text-gray-600 mt-1">
                {tier === 'scale' ? '90-day' : tier === 'growth' ? '7-day' : 'Limited'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Speculative
              </CardTitle>
              <Zap className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(metrics.speculativeCount)}</div>
              <p className="text-xs text-gray-600 mt-1">Used parallel</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Retried
              </CardTitle>
              <Activity className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(metrics.retriedCount)}</div>
              <p className="text-xs text-gray-600 mt-1">Had retries</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-900" />
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
                    className="pl-10 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border-light"
                  />
                </div>
              </div>

              {/* Provider */}
              <Select
                value={filters.provider}
                onChange={(e) => setFilters(prev => ({ ...prev, provider: e.target.value }))}
                className="focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border-light"
              >
                <option value="">All Providers</option>
                <option value="OpenAI">OpenAI</option>
                <option value="Anthropic">Anthropic</option>
                <option value="Google">Google</option>
                <option value="xAI">xAI</option>
              </Select>

              {/* Status */}
              <Select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border-light"
              >
                <option value="">All Status</option>
                <option value="200">200 OK</option>
                <option value="429">429 Rate Limit</option>
                <option value="500">500 Error</option>
              </Select>

              {/* Tag */}
              <Select
                value={filters.tag}
                onChange={(e) => setFilters(prev => ({ ...prev, tag: e.target.value as RequestTag | '' }))}
                className="focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border-light"
              >
                <option value="">All Tags</option>
                <option value="expected">Expected</option>
                <option value="bug">Bug</option>
                <option value="reviewed">Reviewed</option>
                <option value="golden">Golden</option>
                <option value="spam">Spam</option>
              </Select>

              {/* Time Range */}
              <Select
                value={filters.timeRange}
                onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value }))}
                className="focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border-light"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </Select>
            </div>

            {/* Advanced Filters */}
            <div className="flex gap-3 mt-4 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className={filters.hasError ? 'bg-beige-secondary shadow-md text-gray-900 border border-border-light' : ''}
                onClick={() => setFilters(prev => ({ ...prev, hasError: !prev.hasError }))}
              >
                {filters.hasError && <CheckCircle className="h-3 w-3 mr-1" />}
                Has Error
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={filters.usedSpeculative ? 'bg-beige-secondary shadow-md text-gray-900 border border-border-light' : ''}
                onClick={() => setFilters(prev => ({ ...prev, usedSpeculative: !prev.usedSpeculative }))}
              >
                {filters.usedSpeculative && <CheckCircle className="h-3 w-3 mr-1" />}
                Used Speculative
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={filters.wasRetried ? 'bg-beige-secondary shadow-md text-gray-900 border border-border-light' : ''}
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
                    <div key={idx} className="flex items-center gap-2 bg-beige-secondary border border-border-light rounded px-3 py-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLoadPreset(preset)}
                        className="h-auto p-0 text-sm font-medium text-gray-900 hover:text-gray-700"
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
                    className="flex-1 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border-light"
                  />
                  <Button variant="outline" size="sm" onClick={handleSavePreset}>
                    Save Current Filters
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Request Traces Table */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-gray-900" />
              Request Traces
            </CardTitle>
            <CardDescription>
              {filteredTraces.length} of {traces.length} requests
              {tier === 'growth' && ' (Limited to 1,000 requests)'}
              {tier === 'scale' && ' (Up to 100,000 requests)'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredTraces.length === 0 ? (
              <div className="text-center py-16 px-6">
                <div className="bg-beige-secondary rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                  <Activity className="h-12 w-12 text-gray-900" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No requests yet — make your first call to see the magic
                </h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Every request shows: token timelines, cost breakdowns, speculative races, retry attempts, cache savings, and shareable traces.
                </p>
                <div className="mt-6">
                  <code className="bg-beige-secondary text-gray-900 px-4 py-2 rounded text-sm font-mono">
                    curl -X POST {'{your-endpoint}'}/v1/infer -H "Authorization: Bearer YOUR_KEY"
                  </code>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="max-h-[600px] overflow-y-auto scrollbar-hide">
                  <table className="w-full">
                    <thead className="sticky top-0 z-10" style={{ backgroundColor: '#f2f1ed' }}>
                      <tr className="border-b border-border-light">
                        <th className="text-left py-3 px-4 font-medium text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Time</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Model</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Provider</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Status</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Latency</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Cost</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Tokens</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Cache</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>User</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Chain</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Tags</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600" style={{ backgroundColor: '#f2f1ed' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                    {filteredTraces.map((trace) => (
                      <tr
                        key={trace.id}
                        className="border-b border-border-light hover:bg-beige-secondary cursor-pointer transition-colors"
                        onClick={() => setSelectedTrace(trace)}
                      >
                        <td className="py-3 px-4 text-sm text-gray-900 font-inter">
                          {new Date(trace.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          <div className="flex flex-col">
                            <span>{trace.model}</span>
                            {trace.model_version && <span className="text-xs text-gray-600">{trace.model_version}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {trace.provider}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(trace.status)}
                            {trace.used_speculative && <Badge variant="outline" className="text-xs">Spec</Badge>}
                            {trace.retry_count && trace.retry_count > 0 && <Badge variant="outline" className="text-xs">{trace.retry_count}x</Badge>}
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-gray-900">
                          {formatLatency(trace.latency)}
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-gray-900">
                          {formatCurrency(trace.cost)}
                        </td>
                        <td className="text-right py-3 px-4 text-sm text-gray-900">
                          {formatNumber(trace.tokens.total)}
                        </td>
                        <td className="py-3 px-4">
                          {trace.cache_hit ? (
                            <div className="flex flex-col">
                              <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">HIT</Badge>
                              {trace.cache_savings && trace.cache_savings > 0 && (
                                <span className="text-xs text-green-600 mt-1">-{formatCurrency(trace.cache_savings)}</span>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-xs text-gray-600">MISS</Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {trace.user_id && (
                            <div className="flex flex-col">
                              <span className="text-xs">{trace.user_id}</span>
                              {trace.session_id && <span className="text-xs text-gray-600">{trace.session_id}</span>}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {(trace.parent_request_id || trace.child_request_ids) && (
                            <div className="flex items-center gap-1">
                              {trace.parent_request_id && <Badge variant="outline" className="text-xs">↑ Parent</Badge>}
                              {trace.child_request_ids && <Badge variant="outline" className="text-xs">↓ {trace.child_request_ids.length}</Badge>}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {getTagBadge(trace.tag)}
                        </td>
                        <td className="text-right py-3 px-4">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShareTrace(trace);
                              }}
                            >
                              <Share2 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTrace(trace);
                              }}
                            >
                              <Eye className="h-3 w-3" />
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
          </CardContent>
        </Card>

        {/* 3. PERFORMANCE MONITORING - Dedicated Section */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-900" />
              Performance Monitoring
            </CardTitle>
            <CardDescription>Provider reliability and performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Error Rate - Main Metric with 7-day rolling */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Error Rate (7-day rolling)</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl font-bold text-gray-900">{errorRateMetrics.sevenDayErrorRate}%</span>
                    <div className="flex items-center gap-1">
                      {errorRateMetrics.trendDirection === 'up' && (
                        <>
                          <ChevronUp className="h-5 w-5 text-red-600" />
                          <span className="text-sm font-semibold text-red-600">+{Math.abs(errorRateMetrics.errorRateDelta).toFixed(2)}%</span>
                        </>
                      )}
                      {errorRateMetrics.trendDirection === 'down' && (
                        <>
                          <ChevronDown className="h-5 w-5 text-green-600" />
                          <span className="text-sm font-semibold text-green-600">-{Math.abs(errorRateMetrics.errorRateDelta).toFixed(2)}%</span>
                        </>
                      )}
                      {errorRateMetrics.trendDirection === 'flat' && (
                        <span className="text-sm font-semibold text-gray-600">~{errorRateMetrics.errorRateDelta.toFixed(2)}%</span>
                      )}
                      <span className="text-xs text-gray-600 ml-1">vs prev 24h</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Failed requests: 4xx (except 429), 5xx, timeout &gt;30s
                  </p>
                </div>
              </div>

              {/* 30-day sparkline */}
              <div className="mt-4">
                <ResponsiveContainer width="100%" height={80}>
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
                            <div className="bg-beige-primary border border-border-light rounded-md p-2 shadow-md">
                              <p className="text-xs text-gray-600">{payload[0].payload.day}</p>
                              <p className="text-sm font-semibold text-gray-900">{payload[0].value}%</p>
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
                      strokeWidth={1.5}
                      fill="url(#errorRateGradient)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <p className="text-xs text-gray-600 mt-1">30-day trend</p>
              </div>
            </div>

            {/* Provider Reliability Score */}
            <div className="mt-6 pt-6 border-t border-border-light">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Provider Reliability Score (7-day)</h3>
              {providerReliabilityMetrics.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-light bg-beige-secondary">
                        <th className="text-left py-3 px-4 text-xs font-medium text-gray-600">Provider</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-600">Reliability Score</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {providerReliabilityMetrics.map((provider, index) => (
                        <tr key={index} className="border-b border-border-light hover:bg-beige-secondary">
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">{provider.provider}</td>
                          <td className="text-right py-3 px-4">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-32 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gray-900 transition-all duration-300"
                                  style={{ width: `${provider.reliabilityScore}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold text-gray-900 min-w-[50px]">{provider.reliabilityScore}%</span>
                            </div>
                          </td>
                          <td className="text-right py-3 px-4">
                            <Badge className={cn(
                              provider.badge === 'Excellent' ? "bg-green-50 text-green-700 border-green-200" :
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
                  <p className="text-sm">No provider data available for the last 7 days</p>
                </div>
              )}
            </div>

            {/* Latency CDF - Percentiles Table + Interactive Chart */}
            <div className="mt-6 pt-6 border-t border-border-light">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Latency Distribution (CDF) - 7-day</h3>

              {/* Percentiles Table */}
              {latencyCDFMetrics.percentileData.length > 0 ? (
                <>
                  <div className="overflow-x-auto mb-6">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border-light bg-beige-secondary">
                          <th className="text-left py-3 px-4 text-xs font-medium text-gray-600">Provider</th>
                          <th className="text-right py-3 px-4 text-xs font-medium text-gray-600">P50</th>
                          <th className="text-right py-3 px-4 text-xs font-medium text-gray-600">P75</th>
                          <th className="text-right py-3 px-4 text-xs font-medium text-gray-600">P90</th>
                          <th className="text-right py-3 px-4 text-xs font-medium text-gray-600">P95</th>
                          <th className="text-right py-3 px-4 text-xs font-medium text-gray-600">P99</th>
                          <th className="text-right py-3 px-4 text-xs font-medium text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latencyCDFMetrics.percentileData.map((provider, index) => (
                          <tr key={index} className="border-b border-border-light hover:bg-beige-secondary">
                            <td className="py-3 px-4 text-sm font-medium text-gray-900">{provider.provider}</td>
                            <td className="text-right py-3 px-4 text-sm text-gray-700">{provider.p50}ms</td>
                            <td className="text-right py-3 px-4 text-sm text-gray-700">{provider.p75}ms</td>
                            <td className="text-right py-3 px-4 text-sm text-gray-700">{provider.p90}ms</td>
                            <td className="text-right py-3 px-4 text-sm font-semibold text-gray-900">{provider.p95}ms</td>
                            <td className="text-right py-3 px-4 text-sm text-gray-700">{provider.p99}ms</td>
                            <td className="text-right py-3 px-4">
                              {index === 0 && (
                                <Badge style={{ backgroundColor: '#e6f7f6', color: '#299a93', borderColor: '#299a93' }}>
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
                    <ResponsiveContainer width="100%" height={350}>
                      <LineChart data={latencyCDFMetrics.cdfChartData} margin={{ bottom: 30 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="latency"
                          stroke="#6b7280"
                          fontSize={11}
                          label={{ value: 'Latency (ms)', position: 'insideBottom', offset: -10 }}
                        />
                        <YAxis
                          stroke="#6b7280"
                          fontSize={11}
                          domain={[0, 100]}
                          label={{ value: '% of Requests', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip
                          formatter={(value: any) => `${value}%`}
                          labelFormatter={(label) => `${label}ms`}
                          contentStyle={{
                            backgroundColor: '#f2f1ed',
                            border: '1px solid #e5e4e0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        {latencyCDFMetrics.providers.map((provider, idx) => {
                          const colors = ['#000000', '#1a1a1a', '#333333', '#4d4d4d', '#666666', '#808080'];
                          return (
                            <Line
                              key={provider}
                              type="monotone"
                              dataKey={provider}
                              stroke={colors[idx % colors.length]}
                              strokeWidth={2}
                              dot={false}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="mt-3 text-xs text-gray-600">
                      <p>CDF shows the percentage of requests completing below each latency threshold. Steeper curves = faster, more consistent performance.</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-600">
                  <p className="text-sm">No latency data available for the last 7 days</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 4. COST INSIGHTS - 3-Panel Layout */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-900" />
              Cost Insights
            </CardTitle>
            <CardDescription>30-day spend analysis across providers and models</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Total Spend Overview */}
            <div className="mb-6 p-4 bg-beige-secondary rounded-lg border border-border-light">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Total Spend (30 days)</p>
                  <p className="text-3xl font-bold text-gray-900">${costInsightsMetrics.totalSpend.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {costInsightsMetrics.totalTrend > 0 ? (
                    <>
                      <ChevronUp className="h-5 w-5 text-red-600" />
                      <span className="text-sm font-semibold text-red-600">+{costInsightsMetrics.totalTrend}%</span>
                    </>
                  ) : costInsightsMetrics.totalTrend < 0 ? (
                    <>
                      <ChevronDown className="h-5 w-5" style={{ color: '#299a93' }} />
                      <span className="text-sm font-semibold" style={{ color: '#299a93' }}>
                        {costInsightsMetrics.totalTrend}%
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-semibold text-gray-600">0%</span>
                  )}
                  <span className="text-xs text-gray-600">vs prev 30d</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Panel 1: Spend by Provider - Pie Chart */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-4">Spend by Provider</h3>
                {costInsightsMetrics.spendByProvider.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <Pie
                          data={costInsightsMetrics.spendByProvider}
                          dataKey="spend"
                          nameKey="provider"
                          cx="50%"
                          cy="50%"
                          outerRadius={110}
                          label={(entry) => `${entry.percentage}%`}
                        >
                          {costInsightsMetrics.spendByProvider.map((entry, index) => {
                            const gradientColors = ['#000000', '#1a1a1a', '#333333', '#4d4d4d', '#666666', '#808080', '#999999'];
                            return <Cell key={`cell-${index}`} fill={gradientColors[index % gradientColors.length]} />;
                          })}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => `$${value.toFixed(2)}`}
                          contentStyle={{
                            backgroundColor: '#f2f1ed',
                            border: '1px solid #e5e4e0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2">
                      {costInsightsMetrics.spendByProvider.map((provider, index) => {
                        const gradientColors = ['#000000', '#1a1a1a', '#333333', '#4d4d4d', '#666666', '#808080', '#999999'];
                        return (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: gradientColors[index % gradientColors.length] }}
                              />
                              <span className="text-gray-900 font-medium">{provider.provider}</span>
                            </div>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-900 font-semibold">${provider.spend.toFixed(2)}</span>
                            <span className="text-gray-600">{provider.percentage}%</span>
                            {provider.trend !== 0 && (
                              <div className="flex items-center gap-1">
                                {provider.trend > 0 ? (
                                  <ChevronUp className="h-4 w-4 text-red-600" />
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
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-4">Top 10 Models by Spend</h3>
                {costInsightsMetrics.spendByModel.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={costInsightsMetrics.spendByModel} layout="vertical" margin={{ left: 80 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" stroke="#6b7280" fontSize={11} />
                        <YAxis
                          type="category"
                          dataKey="model"
                          stroke="#6b7280"
                          fontSize={11}
                          width={70}
                        />
                        <Tooltip
                          formatter={(value: any) => `$${value.toFixed(2)}`}
                          contentStyle={{
                            backgroundColor: '#f2f1ed',
                            border: '1px solid #e5e4e0',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                        />
                        <Bar dataKey="spend" fill="#000000" radius={[0, 4, 4, 0]} />
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
                                  <ChevronUp className="h-3 w-3 text-red-600" />
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

            {/* Panel 3: Tenant Breakdown (Scale tier only) */}
            {tier === 'scale' && (
              <div className="mt-6 pt-6 border-t border-border-light">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-900">Spend by Tenant</h3>
                  <select
                    value={selectedTenant}
                    onChange={(e) => setSelectedTenant(e.target.value)}
                    className="text-sm border border-border-light rounded-md px-3 py-1.5 bg-beige-primary focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="all">All Tenants</option>
                    {mockTenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="bg-beige-secondary rounded-lg p-4 border border-border-light">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Tenant Spend</p>
                      <p className="text-xl font-bold text-gray-900">
                        ${selectedTenant === 'all'
                          ? costInsightsMetrics.totalSpend.toFixed(2)
                          : (costInsightsMetrics.totalSpend * 0.35).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">% of Total</p>
                      <p className="text-xl font-bold text-gray-900">
                        {selectedTenant === 'all' ? '100' : '35'}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Trend</p>
                      <div className="flex items-center gap-1">
                        {costInsightsMetrics.totalTrend > 0 ? (
                          <>
                            <ChevronUp className="h-5 w-5 text-red-600" />
                            <span className="text-xl font-bold text-red-600">+{costInsightsMetrics.totalTrend}%</span>
                          </>
                        ) : costInsightsMetrics.totalTrend < 0 ? (
                          <>
                            <ChevronDown className="h-5 w-5" style={{ color: '#299a93' }} />
                            <span className="text-xl font-bold" style={{ color: '#299a93' }}>
                              {costInsightsMetrics.totalTrend}%
                            </span>
                          </>
                        ) : (
                          <span className="text-xl font-bold text-gray-600">0%</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Request Detail Sheet - CONTINUED IN NEXT PART */}
      <Sheet open={!!selectedTrace} onOpenChange={(open) => !open && setSelectedTrace(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Request Trace Details</SheetTitle>
            <SheetClose onClick={() => setSelectedTrace(null)} />
          </SheetHeader>
          <SheetBody>
            {selectedTrace && (
              <div className="space-y-6">
                {/* Privacy Banner in Detail View when Full Tracing is OFF - Show First */}
                {!enableFullTracing && (
                  <div className="bg-beige-secondary border border-border-light rounded-md p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-gray-900 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Full tracing is disabled</p>
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
                        {selectedTrace.cache_hit && <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">CACHE HIT</Badge>}
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
                    <div className="flex items-center justify-between py-2 px-3 bg-beige-secondary rounded border border-border-light">
                      <span className="text-xs font-medium text-gray-900">Input</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-600">{((selectedTrace.cost_breakdown.input / selectedTrace.cost) * 100).toFixed(1)}%</span>
                        <span className="text-xs font-medium text-gray-900">{formatCurrency(selectedTrace.cost_breakdown.input)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2 px-3 bg-beige-secondary rounded border border-border-light">
                      <span className="text-xs font-medium text-gray-900">Output</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-600">{((selectedTrace.cost_breakdown.output / selectedTrace.cost) * 100).toFixed(1)}%</span>
                        <span className="text-xs font-medium text-gray-900">{formatCurrency(selectedTrace.cost_breakdown.output)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2 px-3 bg-beige-secondary rounded border border-border-light">
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
                        <div className="bg-beige-secondary border border-border-light rounded-md p-3 max-h-64 overflow-y-auto">
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
                        <div className="bg-beige-secondary border border-border-light rounded-md p-3 max-h-64 overflow-y-auto">
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
                    <div className="grid grid-cols-3 gap-4 bg-beige-secondary border border-border-light rounded-md p-4">
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
                    <div className="bg-beige-secondary border border-border-light rounded-md p-4">
                      <div className="flex items-center gap-3">
                        {selectedTrace.parent_request_id && (
                          <>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">Parent</Badge>
                              <code className="text-xs font-mono text-gray-900">{selectedTrace.parent_request_id}</code>
                            </div>
                            <span className="text-gray-600">→</span>
                          </>
                        )}
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-50 text-blue-700 text-xs">This</Badge>
                          <code className="text-xs font-mono text-gray-900 font-bold">{selectedTrace.request_id}</code>
                        </div>
                        {selectedTrace.child_request_ids && selectedTrace.child_request_ids.length > 0 && (
                          <>
                            <span className="text-gray-600">→</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">Children ({selectedTrace.child_request_ids.length})</Badge>
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
                        <div key={idx} className="flex items-center justify-between py-2 px-3 bg-beige-secondary rounded border border-border-light">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-gray-900">{marker.name}</span>
                            <Badge variant="outline" className="text-xs">{marker.type.replace('_', ' ')}</Badge>
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
                            style={{ fontSize: '11px' }}
                          />
                          <YAxis
                            stroke="#6b7280"
                            width={50}
                            style={{ fontSize: '11px' }}
                          />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="timestamp"
                            stroke="#004aad"
                            strokeWidth={1}
                            dot={(props: any) => {
                              const point = selectedTrace.token_timeline?.[props.index];
                              if (point?.is_first || point?.is_last) {
                                return <circle cx={props.cx} cy={props.cy} r={3} fill="#f59e0b" />;
                              }
                              return null;
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
                              #e5e4e0,
                              #e5e4e0 1px,
                              #f2f1ed 1px,
                              #f2f1ed 2px
                            )`;
                          } else if (status === 'fallback') {
                            return `repeating-linear-gradient(
                              45deg,
                              #e5e4e0,
                              #e5e4e0 1px,
                              #f2f1ed 1px,
                              #f2f1ed 2px
                            )`;
                          } else {
                            return `repeating-linear-gradient(
                              45deg,
                              #e5e4e0,
                              #e5e4e0 1px,
                              #f2f1ed 1px,
                              #f2f1ed 2px
                            )`;
                          }
                        };

                        return (
                          <div key={idx} className="flex items-center gap-2 w-full group relative">
                            <span className="text-xs text-gray-600 w-20 flex-shrink-0">{trace.provider}</span>
                            <div className="flex-1 relative h-5 bg-beige-secondary rounded min-w-0">
                              <div
                                className="absolute h-full rounded border border-border-light"
                                style={{
                                  left: `${(trace.start / Math.max(...selectedTrace.speculative_traces!.map(t => t.latency))) * 100}%`,
                                  width: `${(trace.latency / Math.max(...selectedTrace.speculative_traces!.map(t => t.latency))) * 100}%`,
                                  background: getStripePattern(trace.status)
                                }}
                              />
                              {/* Enhanced Tooltip */}
                              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-56 p-3 bg-beige-primary border border-border-light rounded-lg shadow-lg z-50">
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
                        <div key={idx} className="flex items-center justify-between py-2 px-3 bg-beige-secondary rounded">
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
                      value={selectedTrace.tag || ''}
                      onChange={(e) => handleTagTrace(selectedTrace, e.target.value as RequestTag)}
                      className="flex-1"
                    >
                      <option value="">Tag as...</option>
                      <option value="expected">Expected</option>
                      <option value="bug">Bug</option>
                      <option value="reviewed">Reviewed</option>
                      <option value="golden">Golden</option>
                      <option value="spam">Spam</option>
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
                          className={cn("flex-1", selectedTrace.human_feedback === 'positive' && 'bg-beige-secondary shadow-md text-gray-900 border border-border-light')}
                          onClick={() => {
                            const updatedTrace = { ...selectedTrace, human_feedback: selectedTrace.human_feedback === 'positive' ? null : 'positive' as const };
                            setTraces(prev => prev.map(t => t.id === selectedTrace.id ? updatedTrace : t));
                            setSelectedTrace(updatedTrace);
                          }}
                        >
                          Positive
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn("flex-1", selectedTrace.human_feedback === 'negative' && 'bg-beige-secondary shadow-md text-gray-900 border border-border-light')}
                          onClick={() => {
                            const updatedTrace = { ...selectedTrace, human_feedback: selectedTrace.human_feedback === 'negative' ? null : 'negative' as const };
                            setTraces(prev => prev.map(t => t.id === selectedTrace.id ? updatedTrace : t));
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
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(selectedTrace.curl_command || '')}
                  >
                    <Code className="h-4 w-4 mr-2" />
                    Copy curl
                  </Button>
                  <Button
                    variant="outline"
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
                        <pre className="bg-beige-secondary text-gray-900 p-3 rounded-md text-xs overflow-x-auto border border-border-light">
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
                          <pre className="bg-beige-secondary text-gray-900 p-3 rounded-md text-xs overflow-x-auto border border-border-light">
                            {JSON.stringify(selectedTrace.response_body, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Error Details */}
                {selectedTrace.error && (
                  <div>
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
              </div>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
