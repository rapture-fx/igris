import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/apiClient';
import { API_ENDPOINTS, QUERY_KEYS } from '@/utils/constants';
import { handleApiError } from '@/lib/mockDataGuard';

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
    queryFn: async () => {
      try {
        return await api.get<Tenant>(API_ENDPOINTS.TENANT_CURRENT);
      } catch (error) {
        // Production-safe fallback: throws in production, returns mock in development
        return handleApiError<Tenant>(
          error,
          {
            id: 'demo-tenant-001',
            name: 'Demo Organization',
            email: 'demo@igrisinertial.com',
            plan: 'Seed',
            created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
            status: 'active' as 'active' | 'disabled' | 'suspended',
            metadata: {
              trial_active: false,
              trial_days_left: 0,
            },
          },
          'useTenant'
        );
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
    refetchOnWindowFocus: false,
  });
}
