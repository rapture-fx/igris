import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import type { GovernanceSummary } from '@/lib/governance';

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
