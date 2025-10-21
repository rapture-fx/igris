import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { API_ENDPOINTS, QUERY_KEYS } from '@/utils/constants';
import { toast } from '@/components/ui/use-toast';

export interface Policy {
  tenant_id: string;
  max_monthly_cost: number;
  max_tokens_per_request: number;
  enable_auto_fallback: boolean;
  allowed_providers: string[];
  rate_limit_per_minute?: number;
  enable_caching?: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdatePolicyData {
  max_monthly_cost?: number;
  max_tokens_per_request?: number;
  enable_auto_fallback?: boolean;
  allowed_providers?: string[];
  rate_limit_per_minute?: number;
  enable_caching?: boolean;
}

export function usePolicy() {
  return useQuery<Policy>({
    queryKey: [QUERY_KEYS.POLICY],
    queryFn: () => api.get<Policy>(API_ENDPOINTS.POLICY),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdatePolicyData) =>
      api.put<Policy>(API_ENDPOINTS.POLICY, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.POLICY] });
      toast({
        title: 'Success',
        description: 'Policy updated successfully',
        variant: 'success',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update policy',
        variant: 'destructive',
      });
    },
  });
}
