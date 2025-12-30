'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFleetInstances, useFleetMetrics } from '@/app/dashboard/fleet/hooks';
import {
  Server, Activity, RefreshCw, Clock, Eye, Settings, XCircle, MapPin,
  AlertCircle, TrendingUp, TrendingDown, Signal
} from 'lucide-react';
import { formatDateTime, formatDuration } from '@/utils/helpers';

export default function RuntimeFleetPage() {
  const { data: fleetInstances = [], isLoading: instancesLoading, refetch: refetchInstances } = useFleetInstances();
  const { data: fleetMetrics, isLoading: metricsLoading } = useFleetMetrics();

  const isLoading = false; // Set to false to show mock data

  // Mock data for fleet metrics
  const metrics = fleetMetrics || {
    total_instances: 12,
    online_instances: 10,
    offline_instances: 2,
    maintenance_instances: 0,
    avg_uptime_percentage: 99.7,
    total_requests_served: 1847293,
    fleet_error_rate: 2.3,
    regions_covered: 4,
    total_capacity: 100,
    used_capacity: 67,
  };

  // Mock data for fleet instances
  const mockInstances = [
    {
      id: 'fleet-us-east-001',
      name: 'Runtime US East 1',
      status: 'online' as const,
      error_rate: 1.2,
      avg_latency: 145,
      active_requests: 23,
      requests_processed: 284756,
      cpu_usage: 45.3,
      memory_usage: 62.8,
      last_heartbeat: new Date().toISOString(),
      uptime_seconds: 864000,
    },
    {
      id: 'fleet-us-west-002',
      name: 'Runtime US West 2',
      status: 'online' as const,
      error_rate: 0.8,
      avg_latency: 132,
      active_requests: 18,
      requests_processed: 312489,
      cpu_usage: 38.7,
      memory_usage: 54.2,
      last_heartbeat: new Date(Date.now() - 30000).toISOString(),
      uptime_seconds: 1296000,
    },
    {
      id: 'fleet-eu-west-003',
      name: 'Runtime EU West 1',
      status: 'online' as const,
      error_rate: 2.1,
      avg_latency: 167,
      active_requests: 31,
      requests_processed: 198234,
      cpu_usage: 71.2,
      memory_usage: 78.5,
      last_heartbeat: new Date(Date.now() - 15000).toISOString(),
      uptime_seconds: 432000,
    },
    {
      id: 'fleet-ap-south-004',
      name: 'Runtime AP South 1',
      status: 'online' as const,
      error_rate: 1.5,
      avg_latency: 189,
      active_requests: 12,
      requests_processed: 156782,
      cpu_usage: 52.6,
      memory_usage: 61.3,
      last_heartbeat: new Date(Date.now() - 45000).toISOString(),
      uptime_seconds: 691200,
    },
    {
      id: 'fleet-us-east-005',
      name: 'Runtime US East 2',
      status: 'maintenance' as const,
      error_rate: 0.0,
      avg_latency: 0,
      active_requests: 0,
      requests_processed: 423156,
      cpu_usage: 12.1,
      memory_usage: 28.4,
      last_heartbeat: new Date(Date.now() - 300000).toISOString(),
      uptime_seconds: 518400,
    },
  ];

  const displayInstances = fleetInstances.length > 0 ? fleetInstances : mockInstances;

  const getStatusBadge = (status: 'online' | 'offline' | 'maintenance' | 'syncing') => {
    const config = {
      online: { label: 'Online' },
      offline: { label: 'Offline' },
      maintenance: { label: 'Maintenance' },
      syncing: { label: 'Syncing' },
    };
    const { label } = config[status];
    return <Badge className="bg-gray-50 text-gray-700 border">{label}</Badge>;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-5xl mx-auto flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-900 mr-3" />
          <span className="text-gray-600">Loading fleet status...</span>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border-light">
            <h1 className="text-base font-medium text-gray-900 font-inter">Fleet Overview</h1>
            <p className="text-gray-600 mt-1 font-inter text-xs">
              Monitor distributed runtime instances across global regions
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => refetchInstances()} className="flex items-center gap-1 text-xs px-2 py-1">
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Total Instances</CardTitle>
              <Server className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{metrics.total_instances}</div>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-gray-600">{metrics.online_instances} online</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-600">{metrics.offline_instances} offline</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Regions</CardTitle>
              <MapPin className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{metrics.regions_covered}</div>
              <p className="text-xs text-gray-600 mt-1">Global distribution</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Error Rate</CardTitle>
              <AlertCircle className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{metrics.fleet_error_rate.toFixed(2)}%</div>
              {metrics.fleet_error_rate > 3 ? (
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="h-3 w-3 text-gray-600" />
                  <span className="text-xs text-gray-600">Above threshold</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDown className="h-3 w-3 text-gray-600" />
                  <span className="text-xs text-gray-600">Healthy</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Capacity</CardTitle>
              <Activity className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">
                {metrics.used_capacity}/{metrics.total_capacity}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2 overflow-hidden">
                <div
                  style={{
                    width: `${Math.min((metrics.used_capacity / metrics.total_capacity) * 100, 100)}%`,
                    height: '8px',
                    backgroundImage: 'repeating-linear-gradient(45deg, #000000 0px, #000000 1px, transparent 1px, transparent 3px)',
                    borderRadius: '4px',
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-gray-900" />
              <CardTitle className="text-xs">Runtime Instances</CardTitle>
            </div>
            <CardDescription className="text-xs">Live status of distributed edge runtime nodes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-light">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Instance</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Health</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Requests</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Resources</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Last Heartbeat</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayInstances.map((instance) => (
                    <tr key={instance.id} className="border-b border-border-light hover:bg-beige-primary">
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900">{instance.name}</div>
                          <div className="text-xs text-gray-600">{instance.id}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(instance.status)}</td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              instance.error_rate < 1 ? 'bg-gray-900' :
                              instance.error_rate < 3 ? 'bg-gray-900' :
                              'bg-gray-900'
                            }`} />
                            <span className="text-xs text-gray-900">{instance.error_rate.toFixed(1)}% errors</span>
                          </div>
                          <div className="text-xs text-gray-600">{instance.avg_latency.toFixed(0)}ms avg</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Activity className="h-3 w-3 text-gray-600" />
                            <span className="text-xs text-gray-900">{instance.active_requests} active</span>
                          </div>
                          <div className="text-xs text-gray-600">{instance.requests_processed.toLocaleString()} total</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-1 overflow-hidden">
                              <div
                                style={{
                                  width: `${instance.cpu_usage}%`,
                                  height: '4px',
                                  backgroundImage: 'repeating-linear-gradient(45deg, #000000 0px, #000000 1px, transparent 1px, transparent 3px)',
                                  borderRadius: '2px',
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">CPU {instance.cpu_usage.toFixed(0)}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-1 overflow-hidden">
                              <div
                                style={{
                                  width: `${instance.memory_usage}%`,
                                  height: '4px',
                                  backgroundImage: 'repeating-linear-gradient(45deg, #000000 0px, #000000 1px, transparent 1px, transparent 3px)',
                                  borderRadius: '2px',
                                }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">MEM {instance.memory_usage.toFixed(0)}%</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs text-gray-900">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(instance.last_heartbeat)}
                          </div>
                          <div className="text-xs text-gray-600">{formatDuration(instance.uptime_seconds)} uptime</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Button variant="outline" size="sm" className="text-xs px-2 py-1">
                          <Eye className="h-3 w-3 mr-1" />
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
