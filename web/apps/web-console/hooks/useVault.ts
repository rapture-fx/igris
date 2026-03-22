import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { API_ENDPOINTS, QUERY_KEYS } from '@/utils/constants';
import { toast } from '@/components/ui/use-toast';

export interface VaultKey {
  id: string;
  provider: string;
  key_name: string;
  masked_key: string;
  created_at: string;
  last_used?: string;
  status: 'active' | 'inactive';
}

export interface AddVaultKeyData {
  provider: string;
  key_name: string;
  api_key: string;
}


export function useVaultKeys() {
  return useQuery<VaultKey[]>({
    queryKey: [QUERY_KEYS.VAULT_KEYS],
    queryFn: async () => {
      try {
        const res = await api.get<{ keys: VaultKey[] } | VaultKey[]>(API_ENDPOINTS.VAULT_KEYS);
        return Array.isArray(res) ? res : (res as { keys: VaultKey[] }).keys ?? [];
      } catch {
        return [] as VaultKey[];
      }
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useAddVaultKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddVaultKeyData) =>
      api.post<VaultKey>(API_ENDPOINTS.VAULT_KEYS, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.VAULT_KEYS] });
      toast({ title: 'Key added', variant: 'success' });
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
      toast({ title: 'Key removed', variant: 'success' });
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
