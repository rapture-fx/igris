import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { handleApiError } from '@/lib/mockDataGuard';

// ============================================================================
// OVERTURE (Cloud Gateway) TYPES & HOOKS
// ============================================================================

export interface OvertureUsageResponse {
  tenant_id: string;
  current_month: string;
  total_spend_usd: number;
  budget_limit_usd: number;
  remaining_usd: number;
  percentage_used: number;
  breached: boolean;
  request_count: number;
  provider_count: number;
  model_count: number;
  by_provider: {
    provider: string;
    total_cost_usd: number;
    request_count: number;
    avg_cost_usd: number;
    input_tokens: number;
    output_tokens: number;
  }[];
  by_model: {
    model: string;
    provider: string;
    total_cost_usd: number;
    request_count: number;
    avg_cost_usd: number;
    input_tokens: number;
    output_tokens: number;
  }[];
}

export interface OvertureUsageHistoryResponse {
  history: {
    year_month: string;
    total_spend_usd: number;
    budget_limit_usd: number;
    request_count: number;
    breached: boolean;
    breached_at: string | null;
  }[];
  count: number;
}

export interface OvertureCostAnalyticsResponse {
  provider_breakdown: Record<string, number>;
  avg_cost_per_request: number;
  avg_latency_ms: number;
  forecast_accuracy: number;
  total_requests: number;
  total_cost_usd: number;
  time_window: string;
  generated_at: string;
}

export interface OvertureProviderStatsResponse {
  providers: {
    provider: string;
    total_cost: number;
    request_count: number;
    avg_cost: number;
    avg_latency: number;
    forecast_accuracy: number;
  }[];
  time_window: string;
  generated_at: string;
}

export interface OvertureCostTrendResponse {
  window: string;
  interval: string;
  trend: {
    timestamp: string;
    total_cost: number;
    requests: number;
  }[];
}

export interface OvertureRoutingStatsResponse {
  usage: {
    total_requests: number;
    successful_requests: number;
    failed_requests: number;
    success_rate: number;
  };
  providers: Record<string, {
    requests: number;
    latency_ms: number;
    error_rate: number;
  }>;
  circuit_breakers: Record<string, {
    status: string;
    failure_count: number;
    last_failure_time: string | null;
  }>;
}

export interface OvertureProviderLeaderboardResponse {
  leaderboard: {
    provider_id: string;
    provider_name: string;
    status: string;
    is_verified: boolean;
    compatibility_class: string;
    current_latency_ms?: number;
    uptime_percent?: number;
    requests_24h: number;
    successful_requests_24h: number;
    avg_latency_24h?: number;
    total_cost_24h?: number;
    health_score: number;
  }[];
  count: number;
}

export interface OvertureAuditLogsResponse {
  events: {
    id: string;
    event_type: string;
    event_category: string;
    severity: string;
    provider?: string;
    model?: string;
    action?: string;
    cost_usd?: number;
    trace_id?: string;
    metadata: any;
    error_message?: string;
    timestamp: string;
  }[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// RUNTIME (Edge Execution) TYPES & HOOKS
// ============================================================================

export interface RuntimeFleetInstance {
  id: string;
  name: string;
  region: string;
  availability_zone: string;
  status: 'Online' | 'Offline' | 'Maintenance' | 'Syncing';
  version: string;
  last_heartbeat: string;
  uptime_seconds: number;
  requests_processed: number;
  error_rate: number;
  avg_latency: number;
  cpu_usage: number;
  memory_usage: number;
  sync_status: 'InSync' | 'OutOfSync' | 'Syncing';
  last_sync_time: string;
  capabilities: string[];
  provider_connections: number;
  active_requests: number;
}

export interface RuntimeFleetMetrics {
  total_instances: number;
  online_instances: number;
  offline_instances: number;
  maintenance_instances: number;
  avg_uptime_percentage: number;
  total_requests_served: number;
  fleet_error_rate: number;
  regions_covered: number;
  total_capacity: number;
  used_capacity: number;
}

// ============================================================================
// OVERTURE HOOKS
// ============================================================================

/**
 * Get current month usage and cost data
 */
export function useOvertureUsage() {
  return useQuery<OvertureUsageResponse>({
    queryKey: ['overture-usage'],
    queryFn: async () => {
      try {
        return await api.get<OvertureUsageResponse>('/v1/usage');
      } catch (error) {
        // Production-safe fallback: throws in production, returns mock in development
        return handleApiError<OvertureUsageResponse>(
          error,
          {
            tenant_id: 'tenant-demo',
            current_month: new Date().toISOString().slice(0, 7),
            total_spend_usd: 1234.56,
            budget_limit_usd: 5000.00,
            remaining_usd: 3765.44,
            percentage_used: 24.69,
            breached: false,
            request_count: 15000,
            provider_count: 3,
            model_count: 5,
            by_provider: [
              { provider: 'openai', total_cost_usd: 800.00, request_count: 10000, avg_cost_usd: 0.08, input_tokens: 500000, output_tokens: 300000 },
              { provider: 'anthropic', total_cost_usd: 300.00, request_count: 3500, avg_cost_usd: 0.086, input_tokens: 200000, output_tokens: 120000 },
              { provider: 'google', total_cost_usd: 134.56, request_count: 1500, avg_cost_usd: 0.090, input_tokens: 100000, output_tokens: 60000 },
            ],
            by_model: [
              { model: 'gpt-4', provider: 'openai', total_cost_usd: 500.00, request_count: 5000, avg_cost_usd: 0.10, input_tokens: 250000, output_tokens: 150000 },
              { model: 'gpt-4-turbo', provider: 'openai', total_cost_usd: 300.00, request_count: 5000, avg_cost_usd: 0.06, input_tokens: 250000, output_tokens: 150000 },
              { model: 'claude-3-opus', provider: 'anthropic', total_cost_usd: 200.00, request_count: 2000, avg_cost_usd: 0.10, input_tokens: 120000, output_tokens: 70000 },
              { model: 'claude-3-sonnet', provider: 'anthropic', total_cost_usd: 100.00, request_count: 1500, avg_cost_usd: 0.067, input_tokens: 80000, output_tokens: 50000 },
              { model: 'gemini-pro', provider: 'google', total_cost_usd: 134.56, request_count: 1500, avg_cost_usd: 0.090, input_tokens: 100000, output_tokens: 60000 },
            ],
          },
          'useOvertureUsage'
        );
      }
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Get historical monthly usage (6-24 months)
 */
export function useOvertureUsageHistory(months: number = 6) {
  return useQuery<OvertureUsageHistoryResponse>({
    queryKey: ['overture-usage-history', months],
    queryFn: async () => {
      try {
        return await api.get<OvertureUsageHistoryResponse>(`/v1/usage/history?months=${months}`);
      } catch (error) {
        // Production-safe fallback: throws in production, returns mock in development
        const history = Array.from({ length: months }, (_, i) => {
          const date = new Date();
          date.setMonth(date.getMonth() - (months - i - 1));
          const spend = 800 + Math.random() * 1500;
          return {
            year_month: date.toISOString().slice(0, 7),
            total_spend_usd: parseFloat(spend.toFixed(2)),
            budget_limit_usd: 5000.00,
            request_count: Math.floor(10000 + Math.random() * 10000),
            breached: spend > 5000,
            breached_at: spend > 5000 ? date.toISOString() : null,
          };
        });
        return handleApiError<OvertureUsageHistoryResponse>(
          error,
          { history, count: months },
          'useOvertureUsageHistory'
        );
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get cost analytics for time window
 */
export function useOvertureCostAnalytics(window: string = '24h') {
  return useQuery<OvertureCostAnalyticsResponse>({
    queryKey: ['overture-cost-analytics', window],
    queryFn: async () => {
      try {
        return await api.get<OvertureCostAnalyticsResponse>(`/v1/analytics/cost?window=${window}`);
      } catch (error) {
        // Production-safe fallback: throws in production, returns mock in development
        return handleApiError<OvertureCostAnalyticsResponse>(
          error,
          {
            provider_breakdown: {
              openai: 65.5,
              anthropic: 25.2,
              google: 9.3,
            },
            avg_cost_per_request: 0.082,
            avg_latency_ms: 450,
            forecast_accuracy: 0.92,
            total_requests: 15000,
            total_cost_usd: 1230.00,
            time_window: window,
            generated_at: new Date().toISOString(),
          },
          'useOvertureCostAnalytics'
        );
      }
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Get per-provider cost statistics
 */
export function useOvertureProviderStats(window: string = '24h') {
  return useQuery<OvertureProviderStatsResponse>({
    queryKey: ['overture-provider-stats', window],
    queryFn: async () => {
      try {
        return await api.get<OvertureProviderStatsResponse>(`/v1/analytics/cost/providers?window=${window}`);
      } catch (error) {
        // Production-safe fallback: throws in production, returns mock in development
        return handleApiError<OvertureProviderStatsResponse>(
          error,
          {
            providers: [
              { provider: 'openai', total_cost: 805.65, request_count: 10000, avg_cost: 0.081, avg_latency: 420, forecast_accuracy: 0.94 },
              { provider: 'anthropic', total_cost: 310.50, request_count: 3600, avg_cost: 0.086, avg_latency: 480, forecast_accuracy: 0.91 },
              { provider: 'google', total_cost: 113.85, request_count: 1400, avg_cost: 0.081, avg_latency: 520, forecast_accuracy: 0.88 },
            ],
            time_window: window,
            generated_at: new Date().toISOString(),
          },
          'useOvertureProviderStats'
        );
      }
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Get cost trend over time
 */
export function useOvertureCostTrend(window: string = '24h', interval: string = '1h') {
  return useQuery<OvertureCostTrendResponse>({
    queryKey: ['overture-cost-trend', window, interval],
    queryFn: async () => {
      try {
        return await api.get<OvertureCostTrendResponse>(`/v1/analytics/cost/trend?window=${window}&interval=${interval}`);
      } catch (error) {
        // Production-safe fallback: throws in production, returns mock in development
        const trend = Array.from({ length: 24 }, (_, i) => {
          const timestamp = new Date();
          timestamp.setHours(timestamp.getHours() - (24 - i));
          return {
            timestamp: timestamp.toISOString(),
            total_cost: 40 + Math.random() * 30,
            requests: Math.floor(500 + Math.random() * 300),
          };
        });
        return handleApiError<OvertureCostTrendResponse>(
          error,
          { window, interval, trend },
          'useOvertureCostTrend'
        );
      }
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Get routing statistics and circuit breaker status
 */
export function useOvertureRoutingStats(hours: number = 24) {
  return useQuery<OvertureRoutingStatsResponse>({
    queryKey: ['overture-routing-stats', hours],
    queryFn: async () => {
      try {
        return await api.get<OvertureRoutingStatsResponse>(`/v1/routing/stats?hours=${hours}`);
      } catch (error) {
        // Production-safe fallback: throws in production, returns mock in development
        return handleApiError<OvertureRoutingStatsResponse>(
          error,
          {
            usage: {
              total_requests: 15000,
              successful_requests: 14700,
              failed_requests: 300,
              success_rate: 98.0,
            },
            providers: {
              openai: { requests: 10000, latency_ms: 420, error_rate: 0.02 },
              anthropic: { requests: 3500, latency_ms: 480, error_rate: 0.015 },
              google: { requests: 1500, latency_ms: 520, error_rate: 0.025 },
            },
            circuit_breakers: {
              openai: { status: 'closed', failure_count: 0, last_failure_time: null },
              anthropic: { status: 'closed', failure_count: 0, last_failure_time: null },
              google: { status: 'closed', failure_count: 0, last_failure_time: null },
            },
          },
          'useOvertureRoutingStats'
        );
      }
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Get provider leaderboard (top 10 by health score)
 */
export function useOvertureProviderLeaderboard() {
  return useQuery<OvertureProviderLeaderboardResponse>({
    queryKey: ['overture-provider-leaderboard'],
    queryFn: async () => {
      try {
        return await api.get<OvertureProviderLeaderboardResponse>('/v1/routing/leaderboard');
      } catch (error) {
        // Production-safe fallback: throws in production, returns mock in development
        return handleApiError<OvertureProviderLeaderboardResponse>(
          error,
          {
            leaderboard: [
              { provider_id: 'openai-1', provider_name: 'OpenAI', status: 'active', is_verified: true, compatibility_class: 'openai', current_latency_ms: 420, uptime_percent: 99.8, requests_24h: 10000, successful_requests_24h: 9800, avg_latency_24h: 425, total_cost_24h: 805.65, health_score: 98.5 },
              { provider_id: 'anthropic-1', provider_name: 'Anthropic', status: 'active', is_verified: true, compatibility_class: 'anthropic', current_latency_ms: 480, uptime_percent: 99.5, requests_24h: 3500, successful_requests_24h: 3458, avg_latency_24h: 485, total_cost_24h: 310.50, health_score: 97.2 },
              { provider_id: 'google-1', provider_name: 'Google', status: 'active', is_verified: true, compatibility_class: 'google', current_latency_ms: 520, uptime_percent: 98.9, requests_24h: 1500, successful_requests_24h: 1463, avg_latency_24h: 525, total_cost_24h: 113.85, health_score: 95.8 },
            ],
            count: 3,
          },
          'useOvertureProviderLeaderboard'
        );
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get audit logs for cost events
 */
export function useOvertureAuditLogs(params?: { limit?: number; since_hours?: number; event_type?: string }) {
  const limit = params?.limit || 100;
  const since_hours = params?.since_hours || 24;
  const event_type = params?.event_type || '';

  return useQuery<OvertureAuditLogsResponse>({
    queryKey: ['overture-audit-logs', limit, since_hours, event_type],
    queryFn: async () => {
      try {
        let endpoint = `/v1/audit?limit=${limit}&since_hours=${since_hours}`;
        if (event_type) endpoint += `&event_type=${event_type}`;
        return await api.get<OvertureAuditLogsResponse>(endpoint);
      } catch (error) {
        // Production-safe fallback: throws in production, returns mock in development
        return handleApiError<OvertureAuditLogsResponse>(
          error,
          {
            events: [
              { id: 'evt-1', event_type: 'cost_spike', event_category: 'cost_optimization', severity: 'warning', provider: 'openai', model: 'gpt-4', cost_usd: 150.00, trace_id: 'trace-123', metadata: {}, timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
              { id: 'evt-2', event_type: 'quota_alert', event_category: 'budget', severity: 'info', cost_usd: 1200.00, metadata: { threshold: '80%' }, timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
            ],
            total: 2,
            limit,
            offset: 0,
          },
          'useOvertureAuditLogs'
        );
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// ============================================================================
// RUNTIME HOOKS
// ============================================================================

/**
 * Get all fleet instances with detailed metrics
 */
export function useRuntimeFleetInstances() {
  return useQuery<RuntimeFleetInstance[]>({
    queryKey: ['runtime-fleet-instances'],
    queryFn: async () => {
      try {
        // Runtime API is on a different base URL - you may need to configure this
        const RUNTIME_API_BASE = process.env.NEXT_PUBLIC_RUNTIME_API_URL || 'http://localhost:3030';
        const response = await fetch(`${RUNTIME_API_BASE}/v1/fleet/instances`);
        if (!response.ok) throw new Error('Failed to fetch fleet instances');
        return await response.json();
      } catch (error) {
        // Production-safe fallback: throws in production, returns mock in development
        return handleApiError<RuntimeFleetInstance[]>(
          error,
          [
            {
              id: 'igris-runtime-us-east-1-a',
              name: 'US-EAST-1 A Runtime',
              region: 'us-east-1',
              availability_zone: 'us-east-1a',
              status: 'Online' as const,
              version: 'v1.6.0',
              last_heartbeat: new Date().toISOString(),
              uptime_seconds: 2592000,
              requests_processed: 50000,
              error_rate: 0.5,
              avg_latency: 120,
              cpu_usage: 45.2,
              memory_usage: 62.8,
              sync_status: 'InSync' as const,
              last_sync_time: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
              capabilities: ['speculative_execution', 'council_mode', 'cache_optimization'],
              provider_connections: 3,
              active_requests: 5,
            },
            {
              id: 'igris-runtime-us-west-2-b',
              name: 'US-WEST-2 B Runtime',
              region: 'us-west-2',
              availability_zone: 'us-west-2b',
              status: 'Online' as const,
              version: 'v1.6.0',
              last_heartbeat: new Date().toISOString(),
              uptime_seconds: 2500000,
              requests_processed: 45000,
              error_rate: 0.4,
              avg_latency: 110,
              cpu_usage: 38.5,
              memory_usage: 58.3,
              sync_status: 'InSync' as const,
              last_sync_time: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
              capabilities: ['speculative_execution', 'council_mode', 'cache_optimization'],
              provider_connections: 3,
              active_requests: 3,
            },
          ],
          'useRuntimeFleetInstances'
        );
      }
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}

/**
 * Get fleet-wide aggregate metrics
 */
export function useRuntimeFleetMetrics() {
  return useQuery<RuntimeFleetMetrics>({
    queryKey: ['runtime-fleet-metrics'],
    queryFn: async () => {
      try {
        const RUNTIME_API_BASE = process.env.NEXT_PUBLIC_RUNTIME_API_URL || 'http://localhost:3030';
        const response = await fetch(`${RUNTIME_API_BASE}/v1/fleet/metrics`);
        if (!response.ok) throw new Error('Failed to fetch fleet metrics');
        return await response.json();
      } catch (error) {
        // Production-safe fallback: throws in production, returns mock in development
        return handleApiError<RuntimeFleetMetrics>(
          error,
          {
            total_instances: 10,
            online_instances: 9,
            offline_instances: 1,
            maintenance_instances: 0,
            avg_uptime_percentage: 99.8,
            total_requests_served: 500000,
            fleet_error_rate: 0.3,
            regions_covered: 5,
            total_capacity: 1000,
            used_capacity: 650,
          },
          'useRuntimeFleetMetrics'
        );
      }
    },
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 2 * 60 * 1000, // Refetch every 2 minutes
  });
}
