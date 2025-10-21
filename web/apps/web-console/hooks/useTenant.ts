import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { API_ENDPOINTS, QUERY_KEYS } from '@/utils/constants';

export interface Tenant {
  id: string;
  name: string;
  email: string;
  plan: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'disabled' | 'suspended';
  metadata?: Record<string, any>;
}

export function useTenant() {
  return useQuery<Tenant>({
    queryKey: [QUERY_KEYS.TENANT],
    queryFn: () => api.get<Tenant>(API_ENDPOINTS.TENANT_CURRENT),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}
