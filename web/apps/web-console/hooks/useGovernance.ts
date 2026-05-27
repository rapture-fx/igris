import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import type {
  GovernanceBoundaryViolation,
  GovernanceExecutionBoundary,
  GovernanceHandoffEvent,
  GovernanceListParams,
  GovernanceListResponse,
  GovernancePolicyDecision,
  GovernanceRecoveryEvent,
  GovernanceRuntimeSummary,
  GovernanceSummary,
  GovernanceVerificationResult,
} from '@/lib/governance';

interface GovernanceQueryOptions {
  enabled?: boolean;
}

/**
 * Tenant-wide execution trust summary behind the Overview page.
 * Backed by `GET /v1/execution/governance/summary`.
 */
export function useGovernanceSummary() {
  return useQuery<GovernanceSummary>({
    queryKey: ['governance-summary'],
    queryFn: () =>
      api.get<GovernanceSummary>('/v1/execution/governance/summary', {
        allowMockFallback: false,
      }),
    refetchInterval: 20_000,
    staleTime: 10_000,
    retry: false,
  });
}

function governanceQuery(params: GovernanceListParams = {}): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === 'all') return;
    q.set(key, String(value));
  });
  return q.toString();
}

function governancePath(path: string, params?: GovernanceListParams): string {
  const query = governanceQuery(params);
  return `/v1/execution/governance/${path}${query ? `?${query}` : ''}`;
}

export function useGovernancePolicyDecisions(params: GovernanceListParams = {}) {
  return useQuery<GovernanceListResponse<GovernancePolicyDecision>>({
    queryKey: ['governance-policy-decisions', params],
    queryFn: () =>
      api.get<GovernanceListResponse<GovernancePolicyDecision>>(
        governancePath('policy-decisions', params),
        { allowMockFallback: false },
      ),
    retry: false,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
}

export function useGovernanceRecoveryEvents(params: GovernanceListParams = {}, options: GovernanceQueryOptions = {}) {
  return useQuery<GovernanceListResponse<GovernanceRecoveryEvent>>({
    queryKey: ['governance-recovery-events', params],
    queryFn: () =>
      api.get<GovernanceListResponse<GovernanceRecoveryEvent>>(
        governancePath('recovery-events', params),
        { allowMockFallback: false },
      ),
    retry: false,
    staleTime: 10_000,
    refetchInterval: options.enabled === false ? false : 20_000,
    enabled: options.enabled ?? true,
  });
}

export function useGovernanceHandoffEvents(params: GovernanceListParams = {}, options: GovernanceQueryOptions = {}) {
  return useQuery<GovernanceListResponse<GovernanceHandoffEvent>>({
    queryKey: ['governance-handoff-events', params],
    queryFn: () =>
      api.get<GovernanceListResponse<GovernanceHandoffEvent>>(
        governancePath('handoff-events', params),
        { allowMockFallback: false },
      ),
    retry: false,
    staleTime: 10_000,
    refetchInterval: options.enabled === false ? false : 20_000,
    enabled: options.enabled ?? true,
  });
}

export function useGovernanceBoundaries(params: GovernanceListParams = {}, options: GovernanceQueryOptions = {}) {
  return useQuery<GovernanceListResponse<GovernanceExecutionBoundary>>({
    queryKey: ['governance-boundaries', params],
    queryFn: () =>
      api.get<GovernanceListResponse<GovernanceExecutionBoundary>>(
        governancePath('boundaries', params),
        { allowMockFallback: false },
      ),
    retry: false,
    staleTime: 10_000,
    refetchInterval: options.enabled === false ? false : 20_000,
    enabled: options.enabled ?? true,
  });
}

export function useGovernanceBoundaryViolations(params: GovernanceListParams = {}, options: GovernanceQueryOptions = {}) {
  return useQuery<GovernanceListResponse<GovernanceBoundaryViolation>>({
    queryKey: ['governance-boundary-violations', params],
    queryFn: () =>
      api.get<GovernanceListResponse<GovernanceBoundaryViolation>>(
        governancePath('boundary-violations', params),
        { allowMockFallback: false },
      ),
    retry: false,
    staleTime: 10_000,
    refetchInterval: options.enabled === false ? false : 20_000,
    enabled: options.enabled ?? true,
  });
}

export function useGovernanceVerificationResults(params: GovernanceListParams = {}, options: GovernanceQueryOptions = {}) {
  return useQuery<GovernanceListResponse<GovernanceVerificationResult>>({
    queryKey: ['governance-verification-results', params],
    queryFn: () =>
      api.get<GovernanceListResponse<GovernanceVerificationResult>>(
        governancePath('verification-results', params),
        { allowMockFallback: false },
      ),
    retry: false,
    staleTime: 10_000,
    refetchInterval: options.enabled === false ? false : 20_000,
    enabled: options.enabled ?? true,
  });
}

export function useGovernanceRuntimes(params: GovernanceListParams = {}) {
  return useQuery<GovernanceListResponse<GovernanceRuntimeSummary>>({
    queryKey: ['governance-runtimes', params],
    queryFn: () =>
      api.get<GovernanceListResponse<GovernanceRuntimeSummary>>(
        governancePath('runtimes', params),
        { allowMockFallback: false },
      ),
    retry: false,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
}

export function useGovernanceRuntime(runtimeId?: string) {
  return useQuery<GovernanceRuntimeSummary>({
    queryKey: ['governance-runtime', runtimeId],
    queryFn: () =>
      api.get<GovernanceRuntimeSummary>(
        `/v1/execution/governance/runtimes/${encodeURIComponent(runtimeId ?? '')}`,
        { allowMockFallback: false },
      ),
    enabled: Boolean(runtimeId),
    retry: false,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });
}
