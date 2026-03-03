'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/hooks/useTenant';
import { formatDateTime, formatDuration } from '@/utils/helpers';
import { useFleetInstances, useFleetMetrics, EdgeRuntimeInstance, FleetMetrics } from './hooks';
import {
  Server, Activity, CheckCircle, XCircle, AlertCircle, RefreshCw,
  Clock, Database, Wifi, WifiOff, MapPin, Users, Settings, Eye,
  Zap, TrendingUp, TrendingDown, Signal
} from 'lucide-react';

export default function FleetPage() {
  const { data: tenant } = useTenant();

  // Use React Query hooks instead of mock data
  const { data: fleetInstances = [], isLoading: instancesLoading, refetch: refetchInstances } = useFleetInstances();
  const { data: fleetMetrics, isLoading: metricsLoading } = useFleetMetrics();

  const isLoading = instancesLoading || metricsLoading;

  const [selectedInstance, setSelectedInstance] = useState<EdgeRuntimeInstance | null>(null);
  const [showInstanceDialog, setShowInstanceDialog] = useState(false);

  // Default metrics if not loaded yet
  const metrics: FleetMetrics = fleetMetrics || {
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
  };

  // Handle instance actions
  const handleInstanceAction = (action: string, instanceId: string) => {
    console.log(`Action ${action} on instance ${instanceId}`);
    // In production, this would make API calls
  };

  const handleRefreshFleet = () => {
    refetchInstances();
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
          <div className="pb-4 border-b border-border-light">
            <h1 className="text-base font-medium text-gray-900 font-inter">
              Edge Fleet Management
            </h1>
            <p className="text-gray-600 mt-1 font-inter text-xs">
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
          <div className="border border-border-light shadow-sm rounded-lg p-4">
            <div className="flex flex-row items-center justify-between pb-2">
              <div className="text-sm font-medium text-gray-600">
                Total Instances
              </div>
              <Server className="h-4 w-4 text-gray-900" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{metrics.total_instances}</div>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-black">{metrics.online_instances} online</span>
                <span className="text-xs text-black">•</span>
                <span className="text-xs text-black">{metrics.offline_instances} offline</span>
              </div>
            </div>
          </div>

          <div className="border border-border-light shadow-sm rounded-lg p-4">
            <div className="flex flex-row items-center justify-between pb-2">
              <div className="text-sm font-medium text-gray-600">
                Regions Covered
              </div>
              <MapPin className="h-4 w-4 text-gray-900" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{metrics.regions_covered}</div>
              <p className="text-xs text-gray-600 mt-1">
                Global distribution
              </p>
            </div>
          </div>

          <div className="border border-border-light shadow-sm rounded-lg p-4">
            <div className="flex flex-row items-center justify-between pb-2">
              <div className="text-sm font-medium text-gray-600">
                Fleet Error Rate
              </div>
              <AlertCircle className="h-4 w-4 text-gray-900" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{metrics.fleet_error_rate.toFixed(2)}%</div>
              {metrics.fleet_error_rate > 3 ? (
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-black" />
                  <span className="text-xs text-black">Above threshold</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDown className="h-3 w-3 text-black" />
                  <span className="text-xs text-black">Healthy</span>
                </div>
              )}
            </div>
          </div>

          <div className="border border-border-light shadow-sm rounded-lg p-4">
            <div className="flex flex-row items-center justify-between pb-2">
              <div className="text-sm font-medium text-gray-600">
                Fleet Capacity
              </div>
              <Activity className="h-4 w-4 text-gray-900" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {metrics.used_capacity}/{metrics.total_capacity}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <svg width="100%" height="8" className="overflow-visible">
                  <defs>
                    <pattern id="fleet-capacity-stripe" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width="1" height="2" fill={
                        (metrics.used_capacity / metrics.total_capacity) > 0.8
                          ? '#ef4444'
                          : (metrics.used_capacity / metrics.total_capacity) > 0.6
                          ? '#eab308'
                          : '#22c55e'
                      } />
                    </pattern>
                  </defs>
                  <rect
                    x="0"
                    y="0"
                    width={`${Math.min((metrics.used_capacity / metrics.total_capacity) * 100, 100)}%`}
                    height="8"
                    fill="url(#fleet-capacity-stripe)"
                    rx="4"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Fleet Instances Table */}
        <div className="border border-border-light shadow-sm rounded-lg">
          <div className="p-6 pb-0">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-gray-900" />
              <h2 className="text-lg font-semibold text-gray-900">
                Runtime Instances
              </h2>
            </div>
            <p className="text-gray-600 mt-1 font-inter">
              Live status of distributed edge runtime nodes
            </p>
          </div>
          <div className="p-6 pt-0">
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
                              <svg width="64" height="4" className="overflow-visible">
                                <defs>
                                  <pattern id={`cpu-stripe-${instance.id}`} width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                    <rect width="1" height="2" fill={
                                      instance.cpu_usage > 80 ? '#ef4444' : instance.cpu_usage > 60 ? '#eab308' : '#22c55e'
                                    } />
                                  </pattern>
                                </defs>
                                <rect
                                  x="0"
                                  y="0"
                                  width={`${instance.cpu_usage * 0.64}`}
                                  height="4"
                                  fill={`url(#cpu-stripe-${instance.id})`}
                                  rx="2"
                                />
                              </svg>
                            </div>
                            <span className="text-xs text-gray-600">
                              CPU {instance.cpu_usage.toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-1">
                              <svg width="64" height="4" className="overflow-visible">
                                <defs>
                                  <pattern id={`memory-stripe-${instance.id}`} width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                    <rect width="1" height="2" fill={
                                      instance.memory_usage > 80 ? '#ef4444' : instance.memory_usage > 60 ? '#eab308' : '#22c55e'
                                    } />
                                  </pattern>
                                </defs>
                                <rect
                                  x="0"
                                  y="0"
                                  width={`${instance.memory_usage * 0.64}`}
                                  height="4"
                                  fill={`url(#memory-stripe-${instance.id})`}
                                  rx="2"
                                />
                              </svg>
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
          </div>
        </div>

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
                        selectedInstance.error_rate < 1 ? 'text-black' :
                        selectedInstance.error_rate < 3 ? 'text-yellow-600' :
                        'text-black'
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
