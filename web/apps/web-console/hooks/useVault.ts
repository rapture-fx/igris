import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { API_ENDPOINTS, QUERY_KEYS } from '@/utils/constants';
import { toast } from '@/components/ui/use-toast';

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
    queryFn: () => api.get<VaultKey[]>(API_ENDPOINTS.VAULT_KEYS),
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
