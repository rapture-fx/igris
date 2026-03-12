import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { toast } from '@/components/ui/use-toast';

export interface ApiKeyInfo {
  has_key: boolean;
  prefix?: string;
  created_at?: string;
}

export interface GeneratedApiKey {
  api_key: string;
  prefix: string;
  created_at: string;
}

const QUERY_KEY = 'runtime_api_key';

export function useApiKey() {
  return useQuery<ApiKeyInfo>({
    queryKey: [QUERY_KEY],
    queryFn: () => api.get<ApiKeyInfo>('/v1/account/api-key'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGenerateApiKey() {
  const queryClient = useQueryClient();

  return useMutation<GeneratedApiKey>({
    mutationFn: () => api.post<GeneratedApiKey>('/v1/account/api-key'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate API key',
        variant: 'destructive',
      });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();

  return useMutation<{ revoked: boolean }>({
    mutationFn: () => api.delete<{ revoked: boolean }>('/v1/account/api-key'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: 'API key revoked', variant: 'success' });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke API key',
        variant: 'destructive',
      });
    },
  });
}
