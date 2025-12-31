'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useFleetAgents, useFleetHealth } from '@/app/dashboard/fleet/hooks';
import {
  Server, Activity, RefreshCw, Clock, Eye, Settings, XCircle, MapPin,
  AlertCircle, TrendingUp, TrendingDown, Signal, Plus, Send, CheckCircle, AlertTriangle, ChevronDown, Copy, Check
} from 'lucide-react';
import { formatDateTime, formatDuration, getRelativeTime } from '@/utils/helpers';

export default function RuntimeFleetPage() {
  const { data: agentsData, isLoading: agentsLoading, refetch: refetchAgents, error: agentsError } = useFleetAgents();
  const { data: healthData, isLoading: healthLoading, error: healthError } = useFleetHealth();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'hostname' | 'last_seen' | 'health'>('last_seen');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showAddInstanceModal, setShowAddInstanceModal] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  // Mock data for development/demo
  const mockAgents = [
    {
      agent_id: 'agent-us-east-001',
      fleet_id: 'fleet-prod-001',
      hostname: 'runtime-us-east-1a',
      platform: 'linux',
      version: '1.6.0',
      status: 'active',
      health: 'healthy',
      last_seen: new Date(Date.now() - 30000).toISOString(),
      registered_at: new Date(Date.now() - 86400000 * 7).toISOString(),
    },
    {
      agent_id: 'agent-us-west-002',
      fleet_id: 'fleet-prod-001',
      hostname: 'runtime-us-west-2b',
      platform: 'linux',
      version: '1.6.0',
      status: 'active',
      health: 'healthy',
      last_seen: new Date(Date.now() - 45000).toISOString(),
      registered_at: new Date(Date.now() - 86400000 * 14).toISOString(),
    },
    {
      agent_id: 'agent-eu-west-003',
      fleet_id: 'fleet-prod-001',
      hostname: 'runtime-eu-west-1c',
      platform: 'linux',
      version: '1.5.2',
      status: 'active',
      health: 'degraded',
      last_seen: new Date(Date.now() - 120000).toISOString(),
      registered_at: new Date(Date.now() - 86400000 * 21).toISOString(),
    },
    {
      agent_id: 'agent-ap-south-004',
      fleet_id: 'fleet-prod-001',
      hostname: 'runtime-ap-south-1a',
      platform: 'darwin',
      version: '1.6.0',
      status: 'active',
      health: 'healthy',
      last_seen: new Date(Date.now() - 60000).toISOString(),
      registered_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
    {
      agent_id: 'agent-us-east-005',
      fleet_id: 'fleet-prod-001',
      hostname: 'runtime-us-east-1b',
      platform: 'linux',
      version: '1.6.0',
      status: 'inactive',
      health: 'unhealthy',
      last_seen: new Date(Date.now() - 3600000).toISOString(),
      registered_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      agent_id: 'agent-eu-central-006',
      fleet_id: 'fleet-prod-001',
      hostname: 'runtime-eu-central-1a',
      platform: 'linux',
      version: '1.6.0',
      status: 'active',
      health: 'healthy',
      last_seen: new Date(Date.now() - 15000).toISOString(),
      registered_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
  ];

  const mockHealthData = {
    fleet_id: 'fleet-prod-001',
    total_agents: 6,
    active_agents: 5,
    healthy_agents: 4,
    degraded_agents: 1,
    unhealthy_agents: 1,
    offline_agents: 1,
  };

  // Use real data if available, otherwise use mock data
  const agents = agentsData?.agents && agentsData.agents.length > 0 ? agentsData.agents : mockAgents;
  const totalAgents = agentsData?.total || mockAgents.length;
  const fleetHealth = healthData?.fleets?.[0] || mockHealthData;

  // Calculate fleet metrics
  const fleetMetrics = useMemo(() => {
    const onlineCount = agents.filter(a => a.status === 'active').length;
    const offlineCount = totalAgents - onlineCount;
    const healthyCount = fleetHealth?.healthy_agents || agents.filter(a => a.health === 'healthy').length;
    const degradedCount = fleetHealth?.degraded_agents || agents.filter(a => a.health === 'degraded').length;
    const unhealthyCount = fleetHealth?.unhealthy_agents || agents.filter(a => a.health === 'unhealthy').length;

    // Calculate avg latency, tokens, and fallback events (mock data for demo)
    const avgLatency = 147;
    const totalTokens = 2847293; // Mock: total tokens processed in 24h
    const fallbackEvents = 143; // Mock: fallback events in 24h

    return {
      totalDevices: totalAgents,
      onlineDevices: onlineCount,
      offlineDevices: offlineCount,
      healthyDevices: healthyCount,
      degradedDevices: degradedCount,
      unhealthyDevices: unhealthyCount,
      avgLatency,
      totalTokens,
      fallbackEvents,
      overallHealth: healthyCount === totalAgents ? 'healthy' : degradedCount > 0 ? 'degraded' : 'unhealthy',
    };
  }, [agents, totalAgents, fleetHealth]);

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
      active: { label: 'Online', className: 'bg-green-50 text-green-700 border-green-200' },
      inactive: { label: 'Offline', className: 'bg-gray-50 text-gray-700 border-gray-200' },
      maintenance: { label: 'Maintenance', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    };
    const { label, className } = config[status] || { label: status, className: 'bg-gray-50 text-gray-700 border' };
    return <Badge className={className}>{label}</Badge>;
  };

  const getHealthBadge = (health: string) => {
    const config: Record<string, { icon: any; className: string }> = {
      healthy: { icon: CheckCircle, className: 'text-green-600' },
      degraded: { icon: AlertTriangle, className: 'text-yellow-600' },
      unhealthy: { icon: XCircle, className: 'text-red-600' },
    };
    const { icon: Icon, className } = config[health] || { icon: AlertCircle, className: 'text-gray-600' };
    return <Icon className={`h-4 w-4 ${className}`} />;
  };

  const handleSort = (column: 'hostname' | 'last_seen' | 'health') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const isLoading = agentsLoading || healthLoading;

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border-light">
            <h1 className="text-base font-medium text-gray-900 font-inter">Fleet Overview</h1>
            <p className="text-gray-600 mt-1 font-inter text-xs">
              Real-time status of all Runtime instances running in edge environments
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchAgents()}
              className="flex items-center gap-1 text-xs px-2 py-1"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Overview KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Total Devices</CardTitle>
              <Server className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{fleetMetrics.totalDevices}</div>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-gray-600">{fleetMetrics.onlineDevices} online</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-600">{fleetMetrics.offlineDevices} offline</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Overall Health</CardTitle>
              {fleetMetrics.overallHealth === 'healthy' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : fleetMetrics.overallHealth === 'degraded' ? (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900 capitalize">{fleetMetrics.overallHealth}</div>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-gray-600">{fleetMetrics.healthyDevices} healthy</span>
                {fleetMetrics.degradedDevices > 0 && (
                  <>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-yellow-600">{fleetMetrics.degradedDevices} degraded</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Avg Latency</CardTitle>
              <Activity className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{fleetMetrics.avgLatency}ms</div>
              <p className="text-xs text-gray-600 mt-1">Fleet-wide average</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Tokens (24h)</CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{fleetMetrics.totalTokens.toLocaleString()}</div>
              <p className="text-xs text-gray-600 mt-1">Total processed</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Fallback Events</CardTitle>
              <AlertCircle className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{fleetMetrics.fallbackEvents}</div>
              <p className="text-xs text-gray-600 mt-1">Last 24 hours</p>
            </CardContent>
          </Card>
        </div>

        {/* Fleet Health Summary */}
        <Card className="border-border-light shadow-sm bg-beige-primary">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-900">Fleet Health Summary</CardTitle>
            <CardDescription className="text-xs">Device status breakdown and health metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-beige-primary rounded-lg border border-border-light">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <div className="text-xs text-gray-600">Online Devices</div>
                </div>
                <div className="text-lg font-bold text-gray-900">{fleetMetrics.onlineDevices}</div>
                <div className="text-xs text-gray-600 mt-1">Active and responding</div>
              </div>

              <div className="p-3 bg-beige-primary rounded-lg border border-border-light">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="h-4 w-4 text-gray-600" />
                  <div className="text-xs text-gray-600">Offline Devices</div>
                </div>
                <div className="text-lg font-bold text-gray-900">{fleetMetrics.offlineDevices}</div>
                <div className="text-xs text-gray-600 mt-1">No recent heartbeat</div>
              </div>

              <div className="p-3 bg-beige-primary rounded-lg border border-border-light">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <div className="text-xs text-gray-600">Degraded Devices</div>
                </div>
                <div className="text-lg font-bold text-gray-900">{fleetMetrics.degradedDevices}</div>
                <div className="text-xs text-gray-600 mt-1">Performance issues</div>
              </div>

              <div className="p-3 bg-beige-primary rounded-lg border border-border-light">
                <div className="flex items-center gap-2 mb-1">
                  <Signal className="h-4 w-4 text-gray-900" />
                  <div className="text-xs text-gray-600">Swarm Status</div>
                </div>
                <div className="text-lg font-bold text-gray-900">N/A</div>
                <div className="text-xs text-gray-600 mt-1">No active swarms</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-900">Quick Actions</CardTitle>
            <CardDescription className="text-xs">Manage fleet instances and configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 text-xs"
                onClick={() => setShowAddInstanceModal(true)}
              >
                <Plus className="h-3 w-3" />
                Add New Runtime Instance
              </Button>
              <Button variant="outline" size="sm" className="flex items-center gap-2 text-xs">
                <Send className="h-3 w-3" />
                Push Global Config
              </Button>
              <Button variant="outline" size="sm" className="flex items-center gap-2 text-xs">
                <Settings className="h-3 w-3" />
                Fleet Settings
              </Button>
            </div>

            {showAddInstanceModal && (
              <div className="mt-4 p-4 bg-beige-primary border border-border-light rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Add New Runtime Instance</h4>
                    <p className="text-xs text-gray-600 mt-1">Add fleet configuration to your config.json5:</p>
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
                  <pre className="bg-beige-primary border border-border-light p-3 rounded text-xs overflow-x-auto text-gray-900">{`fleet: {
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
                    {commandCopied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  Then run: <code className="bg-gray-100 px-1 rounded">cargo run --release</code>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Device List Table */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium text-gray-900">Runtime Instances</CardTitle>
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
                  className="px-3 py-1 text-xs border border-border-light rounded-md bg-beige-primary focus:outline-none"
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
                <Server className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                <h3 className="text-sm font-medium text-gray-900 mb-1">
                  {searchTerm || statusFilter !== 'all' || healthFilter !== 'all'
                    ? 'No devices match your filters'
                    : 'No runtime instances registered yet'}
                </h3>
                <p className="text-xs text-gray-600 mb-3">
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
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border-light">
                      <th
                        className="text-left py-3 px-4 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                        onClick={() => handleSort('hostname')}
                      >
                        Device {sortBy === 'hostname' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                      <th
                        className="text-left py-3 px-4 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                        onClick={() => handleSort('health')}
                      >
                        Health {sortBy === 'health' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Platform</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Version</th>
                      <th
                        className="text-left py-3 px-4 font-medium text-gray-600 cursor-pointer hover:text-gray-900"
                        onClick={() => handleSort('last_seen')}
                      >
                        Last Seen {sortBy === 'last_seen' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map((agent) => (
                      <tr key={agent.agent_id} className="border-b border-border-light hover:bg-beige-primary">
                        <td className="py-3 px-4">
                          <div>
                            <div className="font-medium text-gray-900">{agent.hostname}</div>
                            <div className="text-gray-600">{agent.agent_id}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(agent.status)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {getHealthBadge(agent.health)}
                            <span className="capitalize">{agent.health}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="capitalize">{agent.platform}</span>
                        </td>
                        <td className="py-3 px-4">
                          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">{agent.version}</code>
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-gray-900">
                              <Clock className="h-3 w-3" />
                              {getRelativeTime(agent.last_seen)}
                            </div>
                            <div className="text-gray-600">{formatDateTime(agent.last_seen)}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs px-2 py-1"
                              onClick={() => window.location.href = `/dashboard/runtime/devices?id=${agent.agent_id}`}
                            >
                              <Eye className="h-3 w-3 mr-1" />
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
        <Card className="border-border-light shadow-sm bg-beige-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Signal className="h-4 w-4 text-gray-900" />
                  EscapeVector Status (Fleet-Wide)
                </CardTitle>
                <CardDescription className="text-xs">
                  Read-only cache synchronization status across all runtime instances
                </CardDescription>
              </div>
              <a
                href="/dashboard/runtime/escape"
                className="text-xs text-gray-900 hover:text-gray-700 underline flex items-center gap-1"
              >
                Manage cache →
              </a>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-beige-primary rounded-lg border border-border-light">
                <div className="text-xs text-gray-600 mb-1">Last Sync</div>
                <div className="text-sm font-semibold text-gray-900">2 mins ago</div>
                <div className="text-xs text-gray-600 mt-1">All instances synced</div>
              </div>
              <div className="p-3 bg-beige-primary rounded-lg border border-border-light">
                <div className="text-xs text-gray-600 mb-1">TTL Remaining</div>
                <div className="text-sm font-semibold text-gray-900">4h 23m</div>
                <div className="text-xs text-gray-600 mt-1">Next refresh: 6h</div>
              </div>
              <div className="p-3 bg-beige-primary rounded-lg border border-border-light">
                <div className="text-xs text-gray-600 mb-1">Avg Hit Rate</div>
                <div className="text-sm font-semibold text-gray-900">87.3%</div>
                <div className="text-xs text-gray-600 mt-1">Across all instances</div>
              </div>
              <div className="p-3 bg-beige-primary rounded-lg border border-border-light">
                <div className="text-xs text-gray-600 mb-1">Fallback Events</div>
                <div className="text-sm font-semibold text-gray-900">{fleetMetrics.fallbackEvents}</div>
                <div className="text-xs text-gray-600 mt-1">Using cache (24h)</div>
              </div>
            </div>
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-900">
                <strong>Note:</strong> EscapeVector cache is synchronized from Overture cloud to all runtime instances.
                Cache entries are shared across the fleet for offline resilience.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
