import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { API_ENDPOINTS, QUERY_KEYS } from '@/utils/constants';
import { toast } from '@/components/ui/use-toast';
import { handleApiError } from '@/lib/mockDataGuard';

export interface VaultKey {
  id: string;
  provider: string;
  key_id: string;
  masked_key: string;
  created_at: string;
  last_used?: string;
  status: 'active' | 'inactive';
}

export interface AddVaultKeyData {
  provider: string;
  api_key: string;
}

export function useVaultKeys() {
  return useQuery<VaultKey[]>({
    queryKey: [QUERY_KEYS.VAULT_KEYS],
    queryFn: async () => {
      try {
        return await api.get<VaultKey[]>(API_ENDPOINTS.VAULT_KEYS);
      } catch (error) {
        // Production-safe fallback: throws in production, returns mock in development
        return handleApiError<VaultKey[]>(
          error,
          [
            {
              id: 'key-1',
              provider: 'openai',
              key_id: 'sk-proj-abc...xyz',
              masked_key: 'sk-proj-abc...xyz',
              created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
              last_used: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              status: 'active' as 'active' | 'inactive',
            },
            {
              id: 'key-2',
              provider: 'anthropic',
              key_id: 'sk-ant-abc...xyz',
              masked_key: 'sk-ant-abc...xyz',
              created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              last_used: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
              status: 'active' as 'active' | 'inactive',
            },
            {
              id: 'key-3',
              provider: 'google',
              key_id: 'AIza...xyz',
              masked_key: 'AIza...xyz',
              created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
              last_used: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
              status: 'active' as 'active' | 'inactive',
            },
            {
              id: 'key-4',
              provider: 'xai',
              key_id: 'xai-abc...xyz',
              masked_key: 'xai-abc...xyz',
              created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
              last_used: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
              status: 'active' as 'active' | 'inactive',
            },
            {
              id: 'key-5',
              provider: 'cohere',
              key_id: 'co-abc...xyz',
              masked_key: 'co-abc...xyz',
              created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
              last_used: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              status: 'active' as 'active' | 'inactive',
            },
          ],
          'useVaultKeys'
        );
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useAddVaultKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddVaultKeyData) =>
      api.post<VaultKey>(API_ENDPOINTS.VAULT_KEYS, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.VAULT_KEYS] });
      toast({
        title: 'Success',
        description: 'API key added successfully',
        variant: 'success',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add API key',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteVaultKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (keyId: string) =>
      api.delete(API_ENDPOINTS.VAULT_KEY(keyId)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.VAULT_KEYS] });
      toast({
        title: 'Success',
        description: 'API key deleted successfully',
        variant: 'success',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete API key',
        variant: 'destructive',
      });
    },
  });
}
