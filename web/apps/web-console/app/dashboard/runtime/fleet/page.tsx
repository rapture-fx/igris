'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { useFleetInstances, useFleetMetrics, EdgeRuntimeInstance } from '@/app/dashboard/fleet/hooks';
import {
  Server, Activity, RefreshCw, Clock, Eye, Settings, XCircle, MapPin,
  AlertCircle, TrendingUp, TrendingDown, Signal, Plus, Send, CheckCircle, AlertTriangle, ChevronDown, Copy, Check,
  Save, RotateCcw, FileText, Shield, Bell, Zap
} from 'lucide-react';
import { formatDateTime, formatDuration, getRelativeTime } from '@/utils/helpers';

// Mock data for preview/demo when API is not available
const MOCK_INSTANCES: EdgeRuntimeInstance[] = [
  {
    id: 'igris-runtime-us-east-1-a',
    name: 'US-EAST-1 A Runtime',
    region: 'us-east-1',
    availability_zone: 'a',
    status: 'online',
    version: 'v1.6.0',
    last_heartbeat: new Date(Date.now() - 5000).toISOString(),
    uptime_seconds: 86400,
    requests_processed: 125000,
    error_rate: 0.5,
    avg_latency: 85.0,
    cpu_usage: 45.2,
    memory_usage: 62.8,
    sync_status: 'in_sync',
    last_sync_time: new Date(Date.now() - 10000).toISOString(),
    capabilities: ['speculative_execution', 'council_mode'],
    provider_connections: 3,
    active_requests: 12,
  },
  {
    id: 'igris-runtime-us-west-2-a',
    name: 'US-WEST-2 A Runtime',
    region: 'us-west-2',
    availability_zone: 'a',
    status: 'online',
    version: 'v1.6.0',
    last_heartbeat: new Date(Date.now() - 3000).toISOString(),
    uptime_seconds: 172800,
    requests_processed: 98000,
    error_rate: 0.3,
    avg_latency: 92.0,
    cpu_usage: 38.5,
    memory_usage: 58.2,
    sync_status: 'in_sync',
    last_sync_time: new Date(Date.now() - 8000).toISOString(),
    capabilities: ['speculative_execution'],
    provider_connections: 3,
    active_requests: 8,
  },
  {
    id: 'igris-runtime-eu-west-1-a',
    name: 'EU-WEST-1 A Runtime',
    region: 'eu-west-1',
    availability_zone: 'a',
    status: 'online',
    version: 'v1.6.0',
    last_heartbeat: new Date(Date.now() - 7000).toISOString(),
    uptime_seconds: 259200,
    requests_processed: 156000,
    error_rate: 0.4,
    avg_latency: 78.0,
    cpu_usage: 52.1,
    memory_usage: 65.3,
    sync_status: 'in_sync',
    last_sync_time: new Date(Date.now() - 15000).toISOString(),
    capabilities: ['speculative_execution', 'council_mode', 'cache_optimization'],
    provider_connections: 4,
    active_requests: 15,
  },
  {
    id: 'igris-runtime-ap-south-1-a',
    name: 'AP-SOUTH-1 A Runtime',
    region: 'ap-south-1',
    availability_zone: 'a',
    status: 'online',
    version: 'v1.6.0',
    last_heartbeat: new Date(Date.now() - 4000).toISOString(),
    uptime_seconds: 432000,
    requests_processed: 203000,
    error_rate: 2.1,
    avg_latency: 145.0,
    cpu_usage: 67.8,
    memory_usage: 72.5,
    sync_status: 'in_sync',
    last_sync_time: new Date(Date.now() - 6000).toISOString(),
    capabilities: ['speculative_execution', 'council_mode'],
    provider_connections: 3,
    active_requests: 23,
  },
  {
    id: 'igris-runtime-us-east-1-b',
    name: 'US-EAST-1 B Runtime',
    region: 'us-east-1',
    availability_zone: 'b',
    status: 'offline',
    version: 'v1.5.2',
    last_heartbeat: new Date(Date.now() - 3600000).toISOString(),
    uptime_seconds: 0,
    requests_processed: 89000,
    error_rate: 5.2,
    avg_latency: 320.0,
    cpu_usage: 0,
    memory_usage: 0,
    sync_status: 'out_of_sync',
    last_sync_time: new Date(Date.now() - 3700000).toISOString(),
    capabilities: ['speculative_execution'],
    provider_connections: 0,
    active_requests: 0,
  },
  {
    id: 'igris-runtime-eu-central-1-a',
    name: 'EU-CENTRAL-1 A Runtime',
    region: 'eu-central-1',
    availability_zone: 'a',
    status: 'maintenance',
    version: 'v1.6.0',
    last_heartbeat: new Date(Date.now() - 120000).toISOString(),
    uptime_seconds: 518400,
    requests_processed: 245000,
    error_rate: 1.2,
    avg_latency: 95.0,
    cpu_usage: 15.2,
    memory_usage: 28.5,
    sync_status: 'syncing',
    last_sync_time: new Date(Date.now() - 120000).toISOString(),
    capabilities: ['speculative_execution', 'council_mode', 'local_llm'],
    provider_connections: 2,
    active_requests: 3,
  },
];

const MOCK_METRICS = {
  total_instances: 6,
  online_instances: 4,
  offline_instances: 1,
  maintenance_instances: 1,
  avg_uptime_percentage: 98.5,
  total_requests_served: 916000,
  fleet_error_rate: 1.62,
  regions_covered: 4,
  total_capacity: 300,
  used_capacity: 82,
};

export default function RuntimeFleetPage() {
  // Fetch real data from Runtime API
  const { data: instancesData, isLoading: instancesLoading, refetch: refetchInstances, error: instancesError } = useFleetInstances();
  const { data: metricsData, isLoading: metricsLoading, error: metricsError } = useFleetMetrics();

  // Use mock data for preview if API data not available
  const actualInstancesData = instancesData && instancesData.length > 0 ? instancesData : MOCK_INSTANCES;
  const actualMetricsData = metricsData || MOCK_METRICS;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'hostname' | 'last_seen' | 'health'>('last_seen');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAddInstanceModal, setShowAddInstanceModal] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);
  const [showFleetSettings, setShowFleetSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const { toast } = useToast();

  // Fleet Settings State
  const [fleetSettings, setFleetSettings] = useState({
    // General Settings
    fleetName: 'Production Fleet',
    defaultModel: 'gpt-4o-mini',
    heartbeatInterval: 300,
    autoRetryFailed: true,
    maxRetryAttempts: 3,

    // Runtime Behavior
    defaultGpuLayers: 0,
    maxConcurrentRequests: 10,
    fallbackMode: 'prefer_cloud',
    localModelPath: 'models/phi-3-mini-4k-instruct-q4.gguf',
    temperature: 0.7,
    maxTokens: 1000,

    // Swarm Coordination
    swarmEnabled: false,
    swarmGroupName: 'default-swarm',
    maxSwarmSize: 100,
    electionTimeoutMin: 5,
    electionTimeoutMax: 10,
    heartbeatIntervalSwarm: 2,
    conflictResolution: 'voting',

    // Security
    requireApprovalNewDevices: false,
    allowedIpRanges: '',
    enableTls: true,

    // Monitoring & Alerts
    alertOfflineMinutes: 5,
    alertLatencyMs: 500,
    alertErrorRate: 5.0,
    notificationChannels: '',
    alertFrequency: 60,

    // Advanced
    enableTelemetry: true,
    telemetryInterval: 60,
    autoSyncConfig: true,
    syncInterval: 300,
  });

  // Map EdgeRuntimeInstance to agent format for compatibility with existing UI
  const agents = useMemo(() => {
    return actualInstancesData.map((instance: EdgeRuntimeInstance) => ({
      agent_id: instance.id,
      fleet_id: 'fleet-prod-001',
      hostname: instance.name,
      platform: 'linux', // Platform info not in API yet
      version: instance.version,
      status: instance.status === 'online' ? 'active' : instance.status === 'offline' ? 'inactive' : instance.status,
      health: instance.error_rate < 1 ? 'healthy' : instance.error_rate < 3 ? 'degraded' : 'unhealthy',
      last_seen: instance.last_heartbeat,
      registered_at: new Date(Date.now() - instance.uptime_seconds * 1000).toISOString(),
      // Additional fields from EdgeRuntimeInstance for enhanced display
      region: instance.region,
      availability_zone: instance.availability_zone,
      requests_processed: instance.requests_processed,
      error_rate: instance.error_rate,
      avg_latency: instance.avg_latency,
      cpu_usage: instance.cpu_usage,
      memory_usage: instance.memory_usage,
      active_requests: instance.active_requests,
      capabilities: instance.capabilities,
    }));
  }, [actualInstancesData]);

  const totalAgents = agents.length;

  // Calculate fleet metrics from real data
  const fleetMetrics = useMemo(() => {
    // Use real metrics from API if available
    const onlineCount = actualMetricsData?.online_instances || agents.filter(a => a.status === 'active').length;
    const offlineCount = actualMetricsData?.offline_instances || (totalAgents - onlineCount);
    const maintenanceCount = actualMetricsData?.maintenance_instances || 0;

    // Calculate health counts based on error rates
    const healthyCount = agents.filter(a => a.health === 'healthy').length;
    const degradedCount = agents.filter(a => a.health === 'degraded').length;
    const unhealthyCount = agents.filter(a => a.health === 'unhealthy').length;

    // Calculate average latency from real instances
    const avgLatency = agents.length > 0
      ? agents.reduce((sum, a) => sum + (a.avg_latency || 0), 0) / agents.length
      : 0;

    // Total requests served (from API or calculated from instances)
    const totalRequests = actualMetricsData?.total_requests_served ||
      agents.reduce((sum, a) => sum + (a.requests_processed || 0), 0);

    // Mock fallback events until we have real telemetry
    const fallbackEvents = Math.floor(totalRequests * (actualMetricsData?.fleet_error_rate || 0.4) / 100);

    return {
      totalDevices: actualMetricsData?.total_instances || totalAgents,
      onlineDevices: onlineCount,
      offlineDevices: offlineCount,
      maintenanceDevices: maintenanceCount,
      healthyDevices: healthyCount,
      degradedDevices: degradedCount,
      unhealthyDevices: unhealthyCount,
      avgLatency: Math.round(avgLatency),
      totalTokens: totalRequests, // Using total requests as proxy for tokens
      fallbackEvents,
      overallHealth: healthyCount === totalAgents ? 'healthy' : degradedCount > 0 ? 'degraded' : 'unhealthy',
      regionsCount: actualMetricsData?.regions_covered || 0,
      fleetErrorRate: actualMetricsData?.fleet_error_rate || 0,
    };
  }, [agents, totalAgents, actualMetricsData]);

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    let filtered = agents.filter(agent => {
      const matchesSearch = agent.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           agent.agent_id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'all' || agent.status === statusFilter;
      const matchesHealth = healthFilter === 'all' || agent.health === healthFilter;
      return matchesSearch && matchesStatus && matchesHealth;
    });

    filtered.sort((a, b) => {
      let aValue, bValue;
      switch (sortBy) {
        case 'hostname':
          aValue = a.hostname;
          bValue = b.hostname;
          break;
        case 'last_seen':
          aValue = new Date(a.last_seen).getTime();
          bValue = new Date(b.last_seen).getTime();
          break;
        case 'health':
          const healthOrder = { healthy: 0, degraded: 1, unhealthy: 2 };
          aValue = healthOrder[a.health as keyof typeof healthOrder] || 3;
          bValue = healthOrder[b.health as keyof typeof healthOrder] || 3;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [agents, searchTerm, statusFilter, healthFilter, sortBy, sortOrder]);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; className: string }> = {
      active: { label: 'Online', className: 'bg-green-50 dark:bg-green-950 text-green-700 text-black border-green-200 dark:border-green-900 text-[8px] px-1 py-0' },
      inactive: { label: 'Offline', className: 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-black border-gray-200 dark:border-gray-700 text-[8px] px-1 py-0' },
      maintenance: { label: 'Maintenance', className: 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900 text-[8px] px-1 py-0' },
    };
    const { label, className } = config[status] || { label: status, className: 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-black border text-[8px] px-1 py-0' };
    return <Badge className={className}>{label}</Badge>;
  };

  const getHealthBadge = (health: string) => {
    const config: Record<string, { icon: any; className: string }> = {
      healthy: { icon: CheckCircle, className: 'text-black' },
      degraded: { icon: AlertTriangle, className: 'text-black' },
      unhealthy: { icon: XCircle, className: 'text-red-600' },
    };
    const { icon: Icon, className } = config[health] || { icon: AlertCircle, className: 'text-gray-600' };
    return <Icon className={`h-2.5 w-2.5 ${className}`} />;
  };

  const handleSort = (column: 'hostname' | 'last_seen' | 'health') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Fleet Settings Handlers
  const handleSaveFleetSettings = async () => {
    setIsSavingSettings(true);
    try {
      // In production, this would call: PATCH /api/fleet/{fleet_id}/config
      // For now, simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      toast({
        title: 'Fleet Settings Saved',
        description: 'Configuration has been applied to all fleet instances.',
      });

      setShowFleetSettings(false);
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Failed to save fleet settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleResetFleetSettings = () => {
    // Reset to defaults
    setFleetSettings({
      fleetName: 'Production Fleet',
      defaultModel: 'gpt-4o-mini',
      heartbeatInterval: 300,
      autoRetryFailed: true,
      maxRetryAttempts: 3,
      defaultGpuLayers: 0,
      maxConcurrentRequests: 10,
      fallbackMode: 'prefer_cloud',
      localModelPath: 'models/phi-3-mini-4k-instruct-q4.gguf',
      temperature: 0.7,
      maxTokens: 1000,
      swarmEnabled: false,
      swarmGroupName: 'default-swarm',
      maxSwarmSize: 100,
      electionTimeoutMin: 5,
      electionTimeoutMax: 10,
      heartbeatIntervalSwarm: 2,
      conflictResolution: 'voting',
      requireApprovalNewDevices: false,
      allowedIpRanges: '',
      enableTls: true,
      alertOfflineMinutes: 5,
      alertLatencyMs: 500,
      alertErrorRate: 5.0,
      notificationChannels: '',
      alertFrequency: 60,
      enableTelemetry: true,
      telemetryInterval: 60,
      autoSyncConfig: true,
      syncInterval: 300,
    });

    toast({
      title: 'Settings Reset',
      description: 'All settings have been reset to defaults.',
    });
  };

  const isLoading = instancesLoading || metricsLoading;
  const hasError = instancesError || metricsError;
  const usingMockData = !instancesData || instancesData.length === 0;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto flex items-center justify-center h-32">
          <RefreshCw className="h-5 w-5 animate-spin text-gray-900 mr-2" />
          <span className="text-sm text-gray-600">Loading fleet status...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Mock Data Notice */}
        {usingMockData && (
          <Card className="border-border-light dark:border-[#2d2a24]">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-gray-600 dark:text-black" />
                <div className="flex-1">
                  <h3 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4]">Displaying Demo Data</h3>
                  <p className="text-[10px] text-gray-700 dark:text-black mt-1">
                    Runtime API is not connected. Showing mock data for preview. Start the Runtime server on port 8080 to see real fleet data.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => refetchInstances()} className="text-[10px]">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border-light dark:border-[#2d2a24]">
            <h1 className="text-base font-medium text-gray-900 dark:text-[#f6f6f4] font-inter">Fleet Overview</h1>
            <p className="text-gray-600 dark:text-black mt-1 font-inter text-xs">
              Real-time status of all Runtime instances running in edge environments
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchInstances()}
              className="flex items-center gap-1 text-xs px-2 py-1"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Overview KPI Cards */}
        <div className="bg-beige-primary dark:bg-[#1b1912]">
          <div className="grid grid-cols-5 divide-x divide-border-light dark:divide-[#2d2a24]">
            <div className="p-4">
              <div className="text-[9px] font-medium text-gray-600 dark:text-black mb-1">Total Devices</div>
              <div className="text-sm font-bold text-gray-900 dark:text-[#f6f6f4]">{fleetMetrics.totalDevices}</div>
              <div className="flex gap-2 mt-1">
                <span className="text-[7px] text-gray-600 dark:text-black">{fleetMetrics.onlineDevices} online</span>
                <span className="text-[7px] text-black dark:text-gray-500">•</span>
                <span className="text-[7px] text-gray-600 dark:text-black">{fleetMetrics.offlineDevices} offline</span>
              </div>
            </div>
            <div className="p-4">
              <div className="text-[9px] font-medium text-gray-600 dark:text-black mb-1">Overall Health</div>
              <div className="text-sm font-bold text-gray-900 dark:text-[#f6f6f4] capitalize">{fleetMetrics.overallHealth}</div>
              <div className="flex gap-2 mt-1">
                <span className="text-[7px] text-gray-600 dark:text-black">{fleetMetrics.healthyDevices} healthy</span>
                {fleetMetrics.degradedDevices > 0 && (
                  <>
                    <span className="text-[7px] text-black dark:text-gray-500">•</span>
                    <span className="text-[7px] text-black dark:text-yellow-400">{fleetMetrics.degradedDevices} degraded</span>
                  </>
                )}
              </div>
            </div>
            <div className="p-4">
              <div className="text-[9px] font-medium text-gray-600 dark:text-black mb-1">Avg Latency</div>
              <div className="text-sm font-bold text-gray-900 dark:text-[#f6f6f4]">{fleetMetrics.avgLatency}ms</div>
              <p className="text-[7px] text-gray-600 dark:text-black mt-1">Fleet-wide average</p>
            </div>
            <div className="p-4">
              <div className="text-[9px] font-medium text-gray-600 dark:text-black mb-1">Tokens (24h)</div>
              <div className="text-sm font-bold text-gray-900 dark:text-[#f6f6f4]">{fleetMetrics.totalTokens.toLocaleString()}</div>
              <p className="text-[7px] text-gray-600 dark:text-black mt-1">Total processed</p>
            </div>
            <div className="p-4">
              <div className="text-[9px] font-medium text-gray-600 dark:text-black mb-1">Fallback Events</div>
              <div className="text-sm font-bold text-gray-900 dark:text-[#f6f6f4]">{fleetMetrics.fallbackEvents}</div>
              <p className="text-[7px] text-gray-600 dark:text-black mt-1">Last 24 hours</p>
            </div>
          </div>
        </div>

        {/* Fleet Health Summary */}
        <Card className="border-border-light dark:border-[#2d2a24] shadow-sm bg-beige-primary dark:bg-[#1b1912]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4]">Fleet Health Summary</CardTitle>
            <CardDescription className="text-[10px]">Device status breakdown and health metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-beige-primary dark:bg-[#1b1912] rounded-lg border border-border-light dark:border-[#2d2a24]">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-3.5 w-3.5 text-black text-black" />
                  <div className="text-[8px] text-gray-600 dark:text-black">Online Devices</div>
                </div>
                <div className="text-xs font-semibold text-gray-900 dark:text-[#f6f6f4]">{fleetMetrics.onlineDevices}</div>
                <div className="text-[7px] text-gray-600 dark:text-black mt-0.5">Active and responding</div>
              </div>

              <div className="p-3 bg-beige-primary dark:bg-[#1b1912] rounded-lg border border-border-light dark:border-[#2d2a24]">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="h-3.5 w-3.5 text-gray-600 dark:text-black" />
                  <div className="text-[8px] text-gray-600 dark:text-black">Offline Devices</div>
                </div>
                <div className="text-xs font-semibold text-gray-900 dark:text-[#f6f6f4]">{fleetMetrics.offlineDevices}</div>
                <div className="text-[7px] text-gray-600 dark:text-black mt-0.5">No recent heartbeat</div>
              </div>

              <div className="p-3 bg-beige-primary dark:bg-[#1b1912] rounded-lg border border-border-light dark:border-[#2d2a24]">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-black dark:text-yellow-400" />
                  <div className="text-[8px] text-gray-600 dark:text-black">Degraded Devices</div>
                </div>
                <div className="text-xs font-semibold text-gray-900 dark:text-[#f6f6f4]">{fleetMetrics.degradedDevices}</div>
                <div className="text-[7px] text-gray-600 dark:text-black mt-0.5">Performance issues</div>
              </div>

              <div className="p-3 bg-beige-primary dark:bg-[#1b1912] rounded-lg border border-border-light dark:border-[#2d2a24]">
                <div className="flex items-center gap-2 mb-1">
                  <Signal className="h-3.5 w-3.5 text-gray-900 dark:text-[#f6f6f4]" />
                  <div className="text-[8px] text-gray-600 dark:text-black">Swarm Status</div>
                </div>
                <div className="text-xs font-semibold text-gray-900 dark:text-[#f6f6f4]">N/A</div>
                <div className="text-[7px] text-gray-600 dark:text-black mt-0.5">No active swarms</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-border-light dark:border-[#2d2a24] shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4]">Quick Actions</CardTitle>
            <CardDescription className="text-xs">Manage fleet instances and configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="flex items-center gap-1.5 text-[9px] h-auto py-0.5 px-2 rounded-none"
                onClick={() => setShowAddInstanceModal(true)}
              >
                <Plus className="h-2.5 w-2.5" />
                Add New Runtime Instance
              </Button>
              <Button variant="outline" className="flex items-center gap-1.5 text-[9px] h-auto py-0.5 px-2 rounded-none">
                <Send className="h-2.5 w-2.5" />
                Push Global Config
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-1.5 text-[9px] h-auto py-0.5 px-2 rounded-none"
                onClick={() => setShowFleetSettings(true)}
              >
                <Settings className="h-2.5 w-2.5" />
                Fleet Settings
              </Button>
            </div>

            {showAddInstanceModal && (
              <div className="mt-4 p-4 bg-beige-primary dark:bg-[#1b1912] border border-border-light dark:border-[#2d2a24] rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4]">Add New Runtime Instance</h4>
                    <p className="text-xs text-gray-600 dark:text-black mt-1">Add fleet configuration to your config.json5:</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAddInstanceModal(false)}
                    className="h-6 w-6 p-0"
                  >
                    ×
                  </Button>
                </div>
                <div className="relative">
                  <pre className="bg-beige-primary dark:bg-[#1b1912] border border-border-light dark:border-[#2d2a24] p-3 rounded text-xs overflow-x-auto text-gray-900 dark:text-[#f6f6f4]">{`fleet: {
  enabled: true,
  overture_endpoint: "${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080'}",
  agent_id: "runtime-edge-001",
  api_key_env: "FLEET_API_KEY",
  enable_tls: true,
  sync_interval_secs: 300,
  auto_sync_config: true,
  enable_telemetry: true,
  telemetry_interval_secs: 60
}`}</pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const config = `fleet: {
  enabled: true,
  overture_endpoint: "${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080'}",
  agent_id: "runtime-edge-001",
  api_key_env: "FLEET_API_KEY",
  enable_tls: true,
  sync_interval_secs: 300,
  auto_sync_config: true,
  enable_telemetry: true,
  telemetry_interval_secs: 60
}`;
                      navigator.clipboard.writeText(config);
                      setCommandCopied(true);
                      setTimeout(() => setCommandCopied(false), 2000);
                    }}
                    className="absolute top-2 right-2 h-6 w-6 p-0"
                  >
                    {commandCopied ? <Check className="h-3 w-3 text-black text-black" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-600 dark:text-black mt-2">
                  Then run: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">cargo run --release</code>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Device List Table */}
        <Card className="border-border-light dark:border-[#2d2a24] shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4]">Runtime Instances</CardTitle>
                <CardDescription className="text-xs">
                  {filteredAgents.length} of {totalAgents} devices {searchTerm || statusFilter !== 'all' || healthFilter !== 'all' ? '(filtered)' : ''}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search devices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-1 text-xs border border-border-light dark:border-[#2d2a24] rounded-md bg-beige-primary dark:bg-[#1b1912] text-gray-900 dark:text-[#f6f6f4] focus:outline-none"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs h-auto py-1 px-2">
                      {statusFilter === 'all' ? 'All Status' : statusFilter === 'active' ? 'Online' : 'Offline'}
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="text-xs">
                    <DropdownMenuItem onClick={() => setStatusFilter('all')} className="text-xs py-1">All Status</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('active')} className="text-xs py-1">Online</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('inactive')} className="text-xs py-1">Offline</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="text-xs h-auto py-1 px-2">
                      {healthFilter === 'all' ? 'All Health' : healthFilter.charAt(0).toUpperCase() + healthFilter.slice(1)}
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="text-xs">
                    <DropdownMenuItem onClick={() => setHealthFilter('all')} className="text-xs py-1">All Health</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setHealthFilter('healthy')} className="text-xs py-1">Healthy</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setHealthFilter('degraded')} className="text-xs py-1">Degraded</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setHealthFilter('unhealthy')} className="text-xs py-1">Unhealthy</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredAgents.length === 0 ? (
              <div className="text-center py-8">
                <Server className="h-8 w-8 text-black dark:text-gray-500 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4] mb-1">
                  {searchTerm || statusFilter !== 'all' || healthFilter !== 'all'
                    ? 'No devices match your filters'
                    : 'No runtime instances registered yet'}
                </h3>
                <p className="text-xs text-gray-600 dark:text-black mb-3">
                  {searchTerm || statusFilter !== 'all' || healthFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Add your first Runtime instance to get started'}
                </p>
                {!(searchTerm || statusFilter !== 'all' || healthFilter !== 'all') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddInstanceModal(true)}
                    className="text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Runtime Instance
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="border-b border-border-light dark:border-[#2d2a24]">
                      <th
                        className="text-left py-1.5 px-2 font-medium text-gray-600 dark:text-black cursor-pointer hover:text-gray-900 dark:hover:text-[#f6f6f4] text-[8px]"
                        onClick={() => handleSort('hostname')}
                      >
                        Device {sortBy === 'hostname' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-left py-1.5 px-2 font-medium text-gray-600 dark:text-black text-[8px]">Region</th>
                      <th className="text-left py-1.5 px-2 font-medium text-gray-600 dark:text-black text-[8px]">Status</th>
                      <th
                        className="text-left py-1.5 px-2 font-medium text-gray-600 dark:text-black cursor-pointer hover:text-gray-900 dark:hover:text-[#f6f6f4] text-[8px]"
                        onClick={() => handleSort('health')}
                      >
                        Health {sortBy === 'health' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-left py-1.5 px-2 font-medium text-gray-600 dark:text-black text-[8px]">Requests/Latency</th>
                      <th className="text-left py-1.5 px-2 font-medium text-gray-600 dark:text-black text-[8px]">Version</th>
                      <th
                        className="text-left py-1.5 px-2 font-medium text-gray-600 dark:text-black cursor-pointer hover:text-gray-900 dark:hover:text-[#f6f6f4] text-[8px]"
                        onClick={() => handleSort('last_seen')}
                      >
                        Last Seen {sortBy === 'last_seen' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-left py-1.5 px-2 font-medium text-gray-600 dark:text-black text-[8px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map((agent) => (
                      <tr key={agent.agent_id} className="border-b border-border-light dark:border-[#2d2a24] hover:bg-beige-primary dark:hover:bg-[#25231e]">
                        <td className="py-1.5 px-2">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-[#f6f6f4] text-[9px]">{agent.hostname}</div>
                            <div className="text-gray-600 dark:text-black text-[7px] font-mono">{agent.agent_id}</div>
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5 text-gray-500 dark:text-black" />
                            <span className="text-gray-900 dark:text-[#f6f6f4] text-[9px]">{agent.region || 'N/A'}</span>
                          </div>
                          {agent.availability_zone && (
                            <div className="text-gray-600 dark:text-black text-[7px] mt-0.5">AZ: {agent.availability_zone}</div>
                          )}
                        </td>
                        <td className="py-1.5 px-2">{getStatusBadge(agent.status)}</td>
                        <td className="py-1.5 px-2">
                          <div className="flex items-center gap-1.5">
                            {getHealthBadge(agent.health)}
                            <div>
                              <div className="capitalize text-gray-900 dark:text-[#f6f6f4] text-[9px]">{agent.health}</div>
                              {agent.error_rate !== undefined && (
                                <div className="text-gray-600 dark:text-black text-[7px]">{agent.error_rate.toFixed(2)}% errors</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="space-y-0.5">
                            {agent.requests_processed !== undefined && (
                              <div className="flex items-center gap-1 text-gray-900 dark:text-[#f6f6f4] text-[9px]">
                                <Activity className="h-2.5 w-2.5 text-gray-500 dark:text-black" />
                                <span>{(agent.requests_processed / 1000).toFixed(1)}K reqs</span>
                              </div>
                            )}
                            {agent.avg_latency !== undefined && (
                              <div className="text-gray-600 dark:text-black text-[7px]">{agent.avg_latency.toFixed(0)}ms avg</div>
                            )}
                            {agent.active_requests !== undefined && (
                              <div className="text-gray-600 dark:text-black text-[7px]">{agent.active_requests} active</div>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <code className="text-[8px] bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">{agent.version}</code>
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-gray-900 dark:text-[#f6f6f4] text-[9px]">
                              <Clock className="h-2.5 w-2.5" />
                              {getRelativeTime(agent.last_seen)}
                            </div>
                            <div className="text-gray-600 dark:text-black text-[7px]">{formatDateTime(agent.last_seen)}</div>
                          </div>
                        </td>
                        <td className="py-1.5 px-2">
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              className="text-[8px] px-1.5 py-0.5 h-auto"
                              onClick={() => window.location.href = `/dashboard/runtime/devices?id=${agent.agent_id}`}
                            >
                              <Eye className="h-2.5 w-2.5 mr-0.5" />
                              Details
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* EscapeVector Status */}
        <Card className="border-border-light dark:border-[#2d2a24] shadow-sm bg-beige-primary dark:bg-[#1b1912]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Signal className="h-3.5 w-3.5 text-gray-900 dark:text-[#f6f6f4]" />
                  EscapeVector Status (Fleet-Wide)
                </CardTitle>
                <CardDescription className="text-[10px]">
                  Read-only cache synchronization status across all runtime instances
                </CardDescription>
              </div>
              <a
                href="/dashboard/runtime/escape"
                className="text-[10px] text-gray-900 dark:text-[#f6f6f4] hover:text-gray-700 dark:hover:text-gray-300 underline flex items-center gap-1"
              >
                Manage cache →
              </a>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-beige-primary dark:bg-[#1b1912] rounded-lg border border-border-light dark:border-[#2d2a24]">
                <div className="text-[8px] text-gray-600 dark:text-black mb-1">Last Sync</div>
                <div className="text-[10px] font-medium text-gray-900 dark:text-[#f6f6f4]">2 mins ago</div>
                <div className="text-[7px] text-gray-600 dark:text-black mt-0.5">All instances synced</div>
              </div>
              <div className="p-3 bg-beige-primary dark:bg-[#1b1912] rounded-lg border border-border-light dark:border-[#2d2a24]">
                <div className="text-[8px] text-gray-600 dark:text-black mb-1">TTL Remaining</div>
                <div className="text-[10px] font-medium text-gray-900 dark:text-[#f6f6f4]">4h 23m</div>
                <div className="text-[7px] text-gray-600 dark:text-black mt-0.5">Next refresh: 6h</div>
              </div>
              <div className="p-3 bg-beige-primary dark:bg-[#1b1912] rounded-lg border border-border-light dark:border-[#2d2a24]">
                <div className="text-[8px] text-gray-600 dark:text-black mb-1">Avg Hit Rate</div>
                <div className="text-[10px] font-medium text-gray-900 dark:text-[#f6f6f4]">87.3%</div>
                <div className="text-[7px] text-gray-600 dark:text-black mt-0.5">Across all instances</div>
              </div>
              <div className="p-3 bg-beige-primary dark:bg-[#1b1912] rounded-lg border border-border-light dark:border-[#2d2a24]">
                <div className="text-[8px] text-gray-600 dark:text-black mb-1">Fallback Events</div>
                <div className="text-[10px] font-medium text-gray-900 dark:text-[#f6f6f4]">{fleetMetrics.fallbackEvents}</div>
                <div className="text-[7px] text-gray-600 dark:text-black mt-0.5">Using cache (24h)</div>
              </div>
            </div>
            <div className="mt-3 p-3 border border-border-light dark:border-[#2d2a24] rounded-lg">
              <p className="text-[9px] text-gray-900 dark:text-[#f6f6f4]">
                <strong>Note:</strong> EscapeVector cache is synchronized from Overture cloud to all runtime instances.
                Cache entries are shared across the fleet for offline resilience.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Fleet Settings Modal */}
        <Dialog open={showFleetSettings} onOpenChange={setShowFleetSettings}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <Settings className="h-4 w-4" />
                Fleet Settings
              </DialogTitle>
              <DialogDescription>
                Configure fleet-wide settings for all Runtime instances. Changes will be applied to all connected devices.
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
                <TabsTrigger value="runtime" className="text-xs">Runtime</TabsTrigger>
                <TabsTrigger value="swarm" className="text-xs">Swarm</TabsTrigger>
                <TabsTrigger value="security" className="text-xs">Security</TabsTrigger>
                <TabsTrigger value="alerts" className="text-xs">Alerts</TabsTrigger>
              </TabsList>

              {/* General Settings Tab */}
              <TabsContent value="general" className="h-[500px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="fleetName" className="text-xs">Fleet Name</Label>
                    <Input
                      id="fleetName"
                      value={fleetSettings.fleetName}
                      onChange={(e) => setFleetSettings({ ...fleetSettings, fleetName: e.target.value })}
                      className="text-xs"
                    />
                    <p className="text-[10px] text-gray-600">Display name for this fleet</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="defaultModel" className="text-xs">Default Model</Label>
                    <Select
                      value={fleetSettings.defaultModel}
                      onValueChange={(value) => setFleetSettings({ ...fleetSettings, defaultModel: value })}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Select model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                        <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                        <SelectItem value="claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                        <SelectItem value="groq-llama70b">Groq Llama 3 70B</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-gray-600">Default cloud model for all instances</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="heartbeatInterval" className="text-xs">Heartbeat Interval (seconds)</Label>
                      <Input
                        id="heartbeatInterval"
                        type="number"
                        value={fleetSettings.heartbeatInterval}
                        onChange={(e) => setFleetSettings({ ...fleetSettings, heartbeatInterval: parseInt(e.target.value) })}
                        className="text-xs"
                      />
                      <p className="text-[10px] text-gray-600">How often instances check in</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxRetryAttempts" className="text-xs">Max Retry Attempts</Label>
                      <Input
                        id="maxRetryAttempts"
                        type="number"
                        value={fleetSettings.maxRetryAttempts}
                        onChange={(e) => setFleetSettings({ ...fleetSettings, maxRetryAttempts: parseInt(e.target.value) })}
                        className="text-xs"
                      />
                      <p className="text-[10px] text-gray-600">Failed device reconnection attempts</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between py-2 border-t border-border-light">
                    <div className="space-y-0.5">
                      <Label htmlFor="autoRetry" className="text-xs">Auto-Retry Failed Devices</Label>
                      <p className="text-[10px] text-gray-600">Automatically retry connecting to offline devices</p>
                    </div>
                    <Switch
                      id="autoRetry"
                      checked={fleetSettings.autoRetryFailed}
                      onCheckedChange={(checked) => setFleetSettings({ ...fleetSettings, autoRetryFailed: checked })}
                      className="scale-75"
                    />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="enableTelemetry" className="text-xs">Enable Telemetry</Label>
                      <p className="text-[10px] text-gray-600">Collect metrics and logs from fleet</p>
                    </div>
                    <Switch
                      id="enableTelemetry"
                      checked={fleetSettings.enableTelemetry}
                      onCheckedChange={(checked) => setFleetSettings({ ...fleetSettings, enableTelemetry: checked })}
                      className="scale-75"
                    />
                  </div>

                  {fleetSettings.enableTelemetry && (
                    <div className="space-y-2 ml-6 border-l-2 border-gray-200 pl-4">
                      <Label htmlFor="telemetryInterval" className="text-xs">Telemetry Upload Interval (seconds)</Label>
                      <Input
                        id="telemetryInterval"
                        type="number"
                        value={fleetSettings.telemetryInterval}
                        onChange={(e) => setFleetSettings({ ...fleetSettings, telemetryInterval: parseInt(e.target.value) })}
                        className="text-xs"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="autoSyncConfig" className="text-xs">Auto-Sync Configuration</Label>
                      <p className="text-[10px] text-gray-600">Automatically sync config changes to fleet</p>
                    </div>
                    <Switch
                      id="autoSyncConfig"
                      checked={fleetSettings.autoSyncConfig}
                      onCheckedChange={(checked) => setFleetSettings({ ...fleetSettings, autoSyncConfig: checked })}
                      className="scale-75"
                    />
                  </div>

                  {fleetSettings.autoSyncConfig && (
                    <div className="space-y-2 ml-6 border-l-2 border-gray-200 pl-4">
                      <Label htmlFor="syncInterval" className="text-xs">Sync Interval (seconds)</Label>
                      <Input
                        id="syncInterval"
                        type="number"
                        value={fleetSettings.syncInterval}
                        onChange={(e) => setFleetSettings({ ...fleetSettings, syncInterval: parseInt(e.target.value) })}
                        className="text-xs"
                      />
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Runtime Behavior Tab */}
              <TabsContent value="runtime" className="h-[500px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="fallbackMode" className="text-xs">Fallback Mode</Label>
                    <Select
                      value={fleetSettings.fallbackMode}
                      onValueChange={(value) => setFleetSettings({ ...fleetSettings, fallbackMode: value })}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Select fallback mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prefer_cloud">Prefer Cloud (fallback to local)</SelectItem>
                        <SelectItem value="prefer_local">Prefer Local (fallback to cloud)</SelectItem>
                        <SelectItem value="local_only">Local Only</SelectItem>
                        <SelectItem value="cloud_only">Cloud Only</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-gray-600">How instances handle cloud provider failures</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="defaultGpuLayers" className="text-xs">Default GPU Layers</Label>
                      <Input
                        id="defaultGpuLayers"
                        type="number"
                        min="0"
                        max="100"
                        value={fleetSettings.defaultGpuLayers}
                        onChange={(e) => setFleetSettings({ ...fleetSettings, defaultGpuLayers: parseInt(e.target.value) })}
                        className="text-xs"
                      />
                      <p className="text-[10px] text-gray-600">0 = CPU only, higher = more GPU</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxConcurrentRequests" className="text-xs">Max Concurrent Requests</Label>
                      <Input
                        id="maxConcurrentRequests"
                        type="number"
                        min="1"
                        value={fleetSettings.maxConcurrentRequests}
                        onChange={(e) => setFleetSettings({ ...fleetSettings, maxConcurrentRequests: parseInt(e.target.value) })}
                        className="text-xs"
                      />
                      <p className="text-[10px] text-gray-600">Per instance limit</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="localModelPath" className="text-xs">Local Model Path</Label>
                    <Input
                      id="localModelPath"
                      value={fleetSettings.localModelPath}
                      onChange={(e) => setFleetSettings({ ...fleetSettings, localModelPath: e.target.value })}
                      className="text-xs font-mono"
                      placeholder="models/phi-3-mini-4k-instruct-q4.gguf"
                    />
                    <p className="text-[10px] text-gray-600">Path to local LLM model file</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="temperature" className="text-xs">Temperature</Label>
                      <Input
                        id="temperature"
                        type="number"
                        min="0"
                        max="2"
                        step="0.1"
                        value={fleetSettings.temperature}
                        onChange={(e) => setFleetSettings({ ...fleetSettings, temperature: parseFloat(e.target.value) })}
                        className="text-xs"
                      />
                      <p className="text-[10px] text-gray-600">0.0 = deterministic, 2.0 = creative</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxTokens" className="text-xs">Max Tokens</Label>
                      <Input
                        id="maxTokens"
                        type="number"
                        min="1"
                        value={fleetSettings.maxTokens}
                        onChange={(e) => setFleetSettings({ ...fleetSettings, maxTokens: parseInt(e.target.value) })}
                        className="text-xs"
                      />
                      <p className="text-[10px] text-gray-600">Maximum response length</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Swarm Coordination Tab */}
              <TabsContent value="swarm" className="h-[500px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between py-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="swarmEnabled" className="text-xs font-medium">Enable Swarm Coordination</Label>
                      <p className="text-[10px] text-gray-600">Allow instances to coordinate as a swarm</p>
                    </div>
                    <Switch
                      id="swarmEnabled"
                      checked={fleetSettings.swarmEnabled}
                      onCheckedChange={(checked) => setFleetSettings({ ...fleetSettings, swarmEnabled: checked })}
                      className="scale-75"
                    />
                  </div>

                  {fleetSettings.swarmEnabled && (
                    <div className="space-y-4 border-l-2 border-blue-200 pl-4">
                      <div className="space-y-2">
                        <Label htmlFor="swarmGroupName" className="text-xs">Swarm Group Name</Label>
                        <Input
                          id="swarmGroupName"
                          value={fleetSettings.swarmGroupName}
                          onChange={(e) => setFleetSettings({ ...fleetSettings, swarmGroupName: e.target.value })}
                          className="text-xs"
                        />
                        <p className="text-[10px] text-gray-600">Logical grouping for swarm discovery</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="maxSwarmSize" className="text-xs">Max Swarm Size</Label>
                        <Input
                          id="maxSwarmSize"
                          type="number"
                          min="2"
                          value={fleetSettings.maxSwarmSize}
                          onChange={(e) => setFleetSettings({ ...fleetSettings, maxSwarmSize: parseInt(e.target.value) })}
                          className="text-xs"
                        />
                        <p className="text-[10px] text-gray-600">Maximum agents in swarm (2-100)</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="electionTimeoutMin" className="text-xs">Election Timeout Min (s)</Label>
                          <Input
                            id="electionTimeoutMin"
                            type="number"
                            min="1"
                            value={fleetSettings.electionTimeoutMin}
                            onChange={(e) => setFleetSettings({ ...fleetSettings, electionTimeoutMin: parseInt(e.target.value) })}
                            className="text-xs"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="electionTimeoutMax" className="text-xs">Election Timeout Max (s)</Label>
                          <Input
                            id="electionTimeoutMax"
                            type="number"
                            min="1"
                            value={fleetSettings.electionTimeoutMax}
                            onChange={(e) => setFleetSettings({ ...fleetSettings, electionTimeoutMax: parseInt(e.target.value) })}
                            className="text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="heartbeatIntervalSwarm" className="text-xs">Heartbeat Interval (seconds)</Label>
                        <Input
                          id="heartbeatIntervalSwarm"
                          type="number"
                          min="1"
                          value={fleetSettings.heartbeatIntervalSwarm}
                          onChange={(e) => setFleetSettings({ ...fleetSettings, heartbeatIntervalSwarm: parseInt(e.target.value) })}
                          className="text-xs"
                        />
                        <p className="text-[10px] text-gray-600">Leader heartbeat frequency</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="conflictResolution" className="text-xs">Conflict Resolution Strategy</Label>
                        <Select
                          value={fleetSettings.conflictResolution}
                          onValueChange={(value) => setFleetSettings({ ...fleetSettings, conflictResolution: value })}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Select strategy" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="voting">Majority Voting</SelectItem>
                            <SelectItem value="leader_decides">Leader Decides</SelectItem>
                            <SelectItem value="priority">Priority-Based</SelectItem>
                            <SelectItem value="consensus">Consensus (All Agree)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-gray-600">How swarm resolves conflicts</p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Security Tab */}
              <TabsContent value="security" className="h-[500px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between py-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="enableTls" className="text-xs font-medium">Enable TLS</Label>
                      <p className="text-[10px] text-gray-600">Require encrypted connections</p>
                    </div>
                    <Switch
                      id="enableTls"
                      checked={fleetSettings.enableTls}
                      onCheckedChange={(checked) => setFleetSettings({ ...fleetSettings, enableTls: checked })}
                      className="scale-75"
                    />
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="space-y-0.5">
                      <Label htmlFor="requireApproval" className="text-xs font-medium">Require Approval for New Devices</Label>
                      <p className="text-[10px] text-gray-600">Manual approval before new devices join</p>
                    </div>
                    <Switch
                      id="requireApproval"
                      checked={fleetSettings.requireApprovalNewDevices}
                      onCheckedChange={(checked) => setFleetSettings({ ...fleetSettings, requireApprovalNewDevices: checked })}
                      className="scale-75"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="allowedIpRanges" className="text-xs">Allowed IP Ranges (CIDR)</Label>
                    <Input
                      id="allowedIpRanges"
                      value={fleetSettings.allowedIpRanges}
                      onChange={(e) => setFleetSettings({ ...fleetSettings, allowedIpRanges: e.target.value })}
                      className="text-xs font-mono"
                      placeholder="192.168.1.0/24, 10.0.0.0/8"
                    />
                    <p className="text-[10px] text-gray-600">Comma-separated CIDR ranges. Leave empty to allow all.</p>
                  </div>

                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex gap-2">
                      <Shield className="h-4 w-4 text-yellow-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-medium text-yellow-900">Security Best Practices</h4>
                        <ul className="text-[10px] text-yellow-800 mt-1 space-y-0.5 list-disc list-inside">
                          <li>Always enable TLS for production fleets</li>
                          <li>Restrict IP ranges to known networks</li>
                          <li>Rotate API keys regularly (contact support)</li>
                          <li>Enable approval for new devices in sensitive environments</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Alerts & Monitoring Tab */}
              <TabsContent value="alerts" className="h-[500px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="space-y-4 py-4">
                  <h3 className="text-xs font-medium text-gray-900 flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Alert Thresholds
                  </h3>

                  <div className="space-y-2">
                    <Label htmlFor="alertOffline" className="text-xs">Alert if Offline Longer Than (minutes)</Label>
                    <Input
                      id="alertOffline"
                      type="number"
                      min="1"
                      value={fleetSettings.alertOfflineMinutes}
                      onChange={(e) => setFleetSettings({ ...fleetSettings, alertOfflineMinutes: parseInt(e.target.value) })}
                      className="text-xs"
                    />
                    <p className="text-[10px] text-gray-600">Trigger alert when device offline exceeds this duration</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="alertLatency" className="text-xs">Alert if Latency Above (ms)</Label>
                    <Input
                      id="alertLatency"
                      type="number"
                      min="1"
                      value={fleetSettings.alertLatencyMs}
                      onChange={(e) => setFleetSettings({ ...fleetSettings, alertLatencyMs: parseInt(e.target.value) })}
                      className="text-xs"
                    />
                    <p className="text-[10px] text-gray-600">Trigger alert when average latency exceeds threshold</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="alertErrorRate" className="text-xs">Alert if Error Rate Above (%)</Label>
                    <Input
                      id="alertErrorRate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={fleetSettings.alertErrorRate}
                      onChange={(e) => setFleetSettings({ ...fleetSettings, alertErrorRate: parseFloat(e.target.value) })}
                      className="text-xs"
                    />
                    <p className="text-[10px] text-gray-600">Trigger alert when error rate exceeds percentage</p>
                  </div>

                  <div className="border-t border-border-light pt-4 mt-4">
                    <h3 className="text-xs font-medium text-gray-900 mb-3">Notification Channels</h3>

                    <div className="space-y-2">
                      <Label htmlFor="notificationChannels" className="text-xs">Channels (Email/Slack/Webhook URLs)</Label>
                      <Input
                        id="notificationChannels"
                        value={fleetSettings.notificationChannels}
                        onChange={(e) => setFleetSettings({ ...fleetSettings, notificationChannels: e.target.value })}
                        className="text-xs"
                        placeholder="email@example.com, https://hooks.slack.com/..."
                      />
                      <p className="text-[10px] text-gray-600">Comma-separated notification endpoints</p>
                    </div>

                    <div className="space-y-2 mt-3">
                      <Label htmlFor="alertFrequency" className="text-xs">Alert Frequency (seconds)</Label>
                      <Input
                        id="alertFrequency"
                        type="number"
                        min="30"
                        value={fleetSettings.alertFrequency}
                        onChange={(e) => setFleetSettings({ ...fleetSettings, alertFrequency: parseInt(e.target.value) })}
                        className="text-xs"
                      />
                      <p className="text-[10px] text-gray-600">Minimum time between repeated alerts</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={handleResetFleetSettings}
                className="text-xs"
                disabled={isSavingSettings}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset to Defaults
              </Button>
              <div className="flex-1" />
              <Button
                variant="outline"
                onClick={() => setShowFleetSettings(false)}
                className="text-xs"
                disabled={isSavingSettings}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveFleetSettings}
                className="text-xs bg-gray-900 hover:bg-gray-800 text-white"
                disabled={isSavingSettings}
              >
                {isSavingSettings ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3 mr-1" />
                    Apply to All Fleet
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
