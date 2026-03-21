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

const MOCK_KEYS: VaultKey[] = [
  {
    id: 'key-1',
    provider: 'openai',
    key_name: 'Production',
    masked_key: 'sk-proj-abc...xyz',
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    last_used: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'active',
  },
  {
    id: 'key-2',
    provider: 'anthropic',
    key_name: 'Production',
    masked_key: 'sk-ant-abc...xyz',
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    last_used: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    status: 'active',
  },
  {
    id: 'key-3',
    provider: 'google',
    key_name: 'Staging',
    masked_key: 'AIza...xyz',
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    last_used: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    status: 'active',
  },
  {
    id: 'key-4',
    provider: 'xai',
    key_name: 'Default',
    masked_key: 'xai-abc...xyz',
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    last_used: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    status: 'active',
  },
  {
    id: 'key-5',
    provider: 'cohere',
    key_name: 'Default',
    masked_key: 'co-abc...xyz',
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    last_used: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
  },
];

export function useVaultKeys() {
  return useQuery<VaultKey[]>({
    queryKey: [QUERY_KEYS.VAULT_KEYS],
    queryFn: async () => {
      try {
        return await api.get<VaultKey[]>(API_ENDPOINTS.VAULT_KEYS);
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
