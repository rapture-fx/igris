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
  runtime_limit?: number;
  trial_active?: boolean;
  trial_days_left?: number;
  trial_tier?: string;
  trial_ends_at?: string;
  subscription_status?: string;
  api_key_prefix?: string;
  metadata?: Record<string, any>;
}

// Raw shape returned by GET /v1/tenants/current
interface TenantAPIResponse {
  tenant_id: string;
  tenant_name: string;
  email: string;
  tier: string;
  status: string;
  runtime_limit: number;
  created_at: string;
  trial_active: boolean;
  trial_days_left?: number;
  trial_tier?: string;
  trial_ends_at?: string;
  subscription_status: string;
  api_key_prefix?: string;
}

function normalizeTenant(raw: TenantAPIResponse): Tenant {
  return {
    id: raw.tenant_id,
    name: raw.tenant_name || raw.email?.split('@')[0] || 'User',
    email: raw.email,
    plan: raw.tier ?? 'seed',
    status: (raw.status as Tenant['status']) ?? 'active',
    created_at: raw.created_at,
    updated_at: raw.created_at,
    runtime_limit: raw.runtime_limit,
    trial_active: raw.trial_active,
    trial_days_left: raw.trial_days_left,
    trial_tier: raw.trial_tier,
    trial_ends_at: raw.trial_ends_at,
    subscription_status: raw.subscription_status,
    api_key_prefix: raw.api_key_prefix,
  };
}

export function useTenant(options: { enabled?: boolean } = {}) {
  return useQuery<Tenant>({
    queryKey: [QUERY_KEYS.TENANT],
    queryFn: async () => {
      try {
        const raw = await api.get<TenantAPIResponse>(API_ENDPOINTS.TENANT_CURRENT);
        return normalizeTenant(raw);
      } catch (err) {
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
    refetchOnWindowFocus: false,
    enabled: options.enabled ?? true,
  });
}
