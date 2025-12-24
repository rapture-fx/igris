'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/hooks/useTenant';
import { formatDateTime, formatDuration } from '@/utils/helpers';
import {
  Server, Activity, CheckCircle, XCircle, AlertCircle, RefreshCw, 
  Clock, Database, Wifi, WifiOff, MapPin, Users, Settings, Eye,
  Zap, TrendingUp, TrendingDown, Signal
} from 'lucide-react';

interface EdgeRuntimeInstance {
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

interface FleetMetrics {
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

export default function FleetPage() {
  const { data: tenant } = useTenant();

  // State for fleet data
  const [fleetInstances, setFleetInstances] = useState<EdgeRuntimeInstance[]>([]);
  const [fleetMetrics, setFleetMetrics] = useState<FleetMetrics>({
    total_instances: 0,
    online_instances: 0,
    offline_instances: 0,
    maintenance_instances: 0,
    avg_uptime_percentage: 0,
    total_requests_served: 0,
    fleet_error_rate: 0,
    regions_covered: 0,
    total_capacity: 0,
    used_capacity: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<EdgeRuntimeInstance | null>(null);
  const [showInstanceDialog, setShowInstanceDialog] = useState(false);

  // Mock fleet data generation
  useEffect(() => {
    const generateMockFleetData = () => {
      const regions = ['us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1'];
      const availabilityZones = ['a', 'b', 'c'];
      const statuses: Array<'online' | 'offline' | 'maintenance' | 'syncing'> = ['online', 'online', 'online', 'offline', 'maintenance', 'syncing'];
      const capabilities = ['speculative_execution', 'council_mode', 'cache_optimization', 'auto_scaling'];

      const instances: EdgeRuntimeInstance[] = regions.flatMap((region, regionIdx) =>
        availabilityZones.map((az, azIdx) => {
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          const instanceId = `igris-runtime-${region}-${az}`;
          const syncStatus: 'in_sync' | 'out_of_sync' | 'syncing' = status === 'online' ? (Math.random() > 0.1 ? 'in_sync' : 'out_of_sync') : 'syncing';

          return {
            id: instanceId,
            name: `${region.toUpperCase()} ${az.toUpperCase()} Runtime`,
            region: region,
            availability_zone: az,
            status,
            version: 'v2.1.3',
            last_heartbeat: new Date(Date.now() - Math.random() * 60000).toISOString(),
            uptime_seconds: Math.floor(Math.random() * 2592000), // Up to 30 days
            requests_processed: Math.floor(Math.random() * 1000000),
            error_rate: Math.random() * 5,
            avg_latency: 50 + Math.random() * 200,
            cpu_usage: 20 + Math.random() * 60,
            memory_usage: 30 + Math.random() * 50,
            sync_status: syncStatus,
            last_sync_time: new Date(Date.now() - Math.random() * 300000).toISOString(),
            capabilities: capabilities.slice(0, Math.floor(Math.random() * 3) + 1),
            provider_connections: 3 + Math.floor(Math.random() * 3),
            active_requests: Math.floor(Math.random() * 50),
          };
        }).slice(0, 2) // 2 instances per region for demo
      ).slice(0, 12); // Total of 12 instances

      setFleetInstances(instances);

      // Calculate fleet metrics
      const onlineCount = instances.filter(i => i.status === 'online').length;
      const offlineCount = instances.filter(i => i.status === 'offline').length;
      const maintenanceCount = instances.filter(i => i.status === 'maintenance').length;
      const avgUptime = instances.reduce((sum, i) => sum + (i.uptime_seconds / 86400), 0) / instances.length;
      
      setFleetMetrics({
        total_instances: instances.length,
        online_instances: onlineCount,
        offline_instances: offlineCount,
        maintenance_instances: maintenanceCount,
        avg_uptime_percentage: Math.min((avgUptime / 30) * 100, 100),
        total_requests_served: instances.reduce((sum, i) => sum + i.requests_processed, 0),
        fleet_error_rate: instances.reduce((sum, i) => sum + i.error_rate, 0) / instances.length,
        regions_covered: new Set(instances.map(i => i.region)).size,
        total_capacity: instances.length * 100, // 100 req/s per instance
        used_capacity: instances.reduce((sum, i) => sum + i.active_requests, 0),
      });
      
      setIsLoading(false);
    };

    generateMockFleetData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(generateMockFleetData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle instance actions
  const handleInstanceAction = (action: string, instanceId: string) => {
    console.log(`Action ${action} on instance ${instanceId}`);
    // In production, this would make API calls
  };

  const handleRefreshFleet = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  const getStatusBadge = (status: EdgeRuntimeInstance['status']) => {
    const config = {
      online: { bg: 'bg-green-50', text: 'text-green-700', label: 'Online' },
      offline: { bg: 'bg-red-50', text: 'text-red-700', label: 'Offline' },
      maintenance: { bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Maintenance' },
      syncing: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Syncing' },
    };
    const { bg, text, label } = config[status];
    return <Badge className={`${bg} ${text} border`}>{label}</Badge>;
  };

  const getSyncStatusBadge = (status: 'in_sync' | 'out_of_sync' | 'syncing') => {
    const config = {
      in_sync: { bg: 'bg-green-50', text: 'text-green-700', label: 'In Sync' },
      out_of_sync: { bg: 'bg-red-50', text: 'text-red-700', label: 'Out of Sync' },
      syncing: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Syncing' },
    };
    const { bg, text, label } = config[status];
    return <Badge className={`${bg} ${text} border text-xs`}>{label}</Badge>;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-900 mr-3" />
          <span className="text-gray-600">Loading fleet status...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-900 font-inter">
              Edge Fleet Management
            </h1>
            <p className="text-gray-600 mt-1 font-inter">
              Monitor distributed runtime instances across global regions
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleRefreshFleet}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Fleet Overview Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Instances
              </CardTitle>
              <Server className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{fleetMetrics.total_instances}</div>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-green-600">{fleetMetrics.online_instances} online</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-red-600">{fleetMetrics.offline_instances} offline</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Regions Covered
              </CardTitle>
              <MapPin className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{fleetMetrics.regions_covered}</div>
              <p className="text-xs text-gray-600 mt-1">
                Global distribution
              </p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Fleet Error Rate
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{fleetMetrics.fleet_error_rate.toFixed(2)}%</div>
              {fleetMetrics.fleet_error_rate > 3 ? (
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-red-600" />
                  <span className="text-xs text-red-600">Above threshold</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDown className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">Healthy</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Fleet Capacity
              </CardTitle>
              <Activity className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {fleetMetrics.used_capacity}/{fleetMetrics.total_capacity}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${
                    (fleetMetrics.used_capacity / fleetMetrics.total_capacity) > 0.8
                      ? 'bg-red-500'
                      : (fleetMetrics.used_capacity / fleetMetrics.total_capacity) > 0.6
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{
                    width: `${Math.min((fleetMetrics.used_capacity / fleetMetrics.total_capacity) * 100, 100)}%`
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fleet Instances Table */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-gray-900" />
              Runtime Instances
            </CardTitle>
            <CardDescription>
              Live status of distributed edge runtime nodes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-light">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Instance</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Sync Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Health</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Requests</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Resources</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Last Hearbeat</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fleetInstances.map((instance) => (
                    <tr key={instance.id} className="border-b border-border-light hover:bg-beige-primary">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">{instance.name}</div>
                          <div className="text-xs text-gray-600">{instance.id}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(instance.status)}
                      </td>
                      <td className="py-3 px-4">
                        {getSyncStatusBadge(instance.sync_status)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              instance.error_rate < 1 ? 'bg-green-500' :
                              instance.error_rate < 3 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`} />
                            <span className="text-xs text-gray-900">
                              {instance.error_rate.toFixed(1)}% errors
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            {instance.avg_latency.toFixed(0)}ms avg latency
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Activity className="h-3 w-3 text-gray-600" />
                            <span className="text-xs text-gray-900">
                              {instance.active_requests} active
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            {instance.requests_processed.toLocaleString()} total
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full ${
                                  instance.cpu_usage > 80 ? 'bg-red-500' :
                                  instance.cpu_usage > 60 ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${instance.cpu_usage}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">
                              CPU {instance.cpu_usage.toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full ${
                                  instance.memory_usage > 80 ? 'bg-red-500' :
                                  instance.memory_usage > 60 ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${instance.memory_usage}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">
                              MEM {instance.memory_usage.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-gray-900">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(instance.last_heartbeat)}
                          </div>
                          <div className="text-xs text-gray-600">
                            {formatDuration(instance.uptime_seconds)} uptime
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedInstance(instance);
                              setShowInstanceDialog(true);
                            }}
                            className="text-xs"
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
          </CardContent>
        </Card>

        {/* Instance Details Dialog */}
        {showInstanceDialog && selectedInstance && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedInstance.name}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInstanceDialog(false)}
                >
                  ×
                </Button>
              </div>

              <div className="space-y-4">
                {/* Instance Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-beige-primary border border-border-light rounded-lg">
                    <h4 className="text-xs font-medium text-gray-600 mb-2">Instance Details</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">ID:</span>
                        <span className="text-gray-900 font-mono text-xs">{selectedInstance.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Version:</span>
                        <span className="text-gray-900">{selectedInstance.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Region:</span>
                        <span className="text-gray-900">{selectedInstance.region.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-beige-primary border border-border-light rounded-lg">
                    <h4 className="text-xs font-medium text-gray-600 mb-2">Status</h4>
                    <div className="space-y-2">
                      {getStatusBadge(selectedInstance.status)}
                      {getSyncStatusBadge(selectedInstance.sync_status)}
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Clock className="h-3 w-3" />
                        Last sync: {formatDateTime(selectedInstance.last_sync_time)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="p-3 bg-beige-primary border border-border-light rounded-lg">
                  <h4 className="text-xs font-medium text-gray-600 mb-3">Performance Metrics</h4>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-gray-600">Error Rate</div>
                      <div className={`text-lg font-medium ${
                        selectedInstance.error_rate < 1 ? 'text-green-600' :
                        selectedInstance.error_rate < 3 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {selectedInstance.error_rate.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Avg Latency</div>
                      <div className="text-lg font-medium text-gray-900">
                        {selectedInstance.avg_latency.toFixed(0)}ms
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Active Requests</div>
                      <div className="text-lg font-medium text-gray-900">
                        {selectedInstance.active_requests}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">Total Processed</div>
                      <div className="text-lg font-medium text-gray-900">
                        {(selectedInstance.requests_processed / 1000000).toFixed(1)}M
                      </div>
                    </div>
                  </div>
                </div>

                {/* Capabilities */}
                <div className="p-3 bg-beige-primary border border-border-light rounded-lg">
                  <h4 className="text-xs font-medium text-gray-600 mb-3">Capabilities</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedInstance.capabilities.map((capability) => (
                      <Badge
                        key={capability}
                        variant="outline"
                        className="text-xs"
                      >
                        {capability.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Provider Connections */}
                <div className="p-3 bg-beige-primary border border-border-light rounded-lg">
                  <h4 className="text-xs font-medium text-gray-600 mb-3">Provider Connections</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Signal className="h-4 w-4 text-gray-600" />
                      <span className="text-sm text-gray-900">
                        {selectedInstance.provider_connections} active connections
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t border-border-light">
                  <Button variant="outline" className="flex-1">
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Restart
                  </Button>
                  <Button variant="destructive" className="flex-1">
                    <XCircle className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
