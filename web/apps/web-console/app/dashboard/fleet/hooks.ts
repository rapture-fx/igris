import { useQuery } from '@tanstack/react-query';

export interface EdgeRuntimeInstance {
  id: string;
  name: string;
  region: string;
  availability_zone: string;
  status: 'online' | 'offline' | 'maintenance' | 'syncing';
  version: string;
  last_heartbeat: string;
  uptime_seconds: number;
  requests_processed: number;
  error_rate: number;
  avg_latency: number;
  cpu_usage: number;
  memory_usage: number;
  sync_status: 'in_sync' | 'out_of_sync' | 'syncing';
  last_sync_time: string;
  capabilities: string[];
  provider_connections: number;
  active_requests: number;
}

export interface FleetMetrics {
  total_instances: number;
  online_instances: number;
  offline_instances: number;
  maintenance_instances: number;
  avg_uptime_percentage: number;
  total_requests_served: number;
  fleet_error_rate: number;
  regions_covered: number;
  total_capacity: number;
  used_capacity: number;
}

const API_BASE_URL = typeof window !== 'undefined'
  ? window.location.hostname === 'localhost'
    ? 'http://localhost:8080'
    : `https://api.${window.location.hostname}`
  : 'http://localhost:8080';

export function useFleetInstances() {
  return useQuery<EdgeRuntimeInstance[]>({
    queryKey: ['fleet', 'instances'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/v1/fleet/instances`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch fleet instances');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 20000,
  });
}

export function useFleetMetrics() {
  return useQuery<FleetMetrics>({
    queryKey: ['fleet', 'metrics'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/v1/fleet/metrics`, {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch fleet metrics');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 20000,
  });
}
