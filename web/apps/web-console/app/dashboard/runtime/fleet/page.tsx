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

  const isLoading = instancesLoading || metricsLoading;

  const metrics = fleetMetrics || {
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
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border-light">
            <h1 className="text-base font-medium text-gray-900 font-inter">Fleet Overview</h1>
            <p className="text-gray-600 mt-1 font-inter text-xs">
              Monitor distributed runtime instances across global regions
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => refetchInstances()} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Instances</CardTitle>
              <Server className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{metrics.total_instances}</div>
              <div className="flex gap-2 mt-1">
                <span className="text-xs text-gray-600">{metrics.online_instances} online</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-600">{metrics.offline_instances} offline</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Regions</CardTitle>
              <MapPin className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{metrics.regions_covered}</div>
              <p className="text-xs text-gray-600 mt-1">Global distribution</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Error Rate</CardTitle>
              <AlertCircle className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{metrics.fleet_error_rate.toFixed(2)}%</div>
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
              <CardTitle className="text-sm font-medium text-gray-600">Capacity</CardTitle>
              <Activity className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {metrics.used_capacity}/{metrics.total_capacity}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${
                    (metrics.used_capacity / metrics.total_capacity) > 0.8 ? 'bg-gray-900' :
                    (metrics.used_capacity / metrics.total_capacity) > 0.6 ? 'bg-gray-900' :
                    'bg-gray-900'
                  }`}
                  style={{ width: `${Math.min((metrics.used_capacity / metrics.total_capacity) * 100, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-gray-900" />
              <CardTitle className="text-sm">Runtime Instances</CardTitle>
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
                  {fleetInstances.map((instance) => (
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
                            <div className="w-16 bg-gray-200 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full ${
                                  instance.cpu_usage > 80 ? 'bg-gray-900' :
                                  instance.cpu_usage > 60 ? 'bg-gray-900' :
                                  'bg-gray-900'
                                }`}
                                style={{ width: `${instance.cpu_usage}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">CPU {instance.cpu_usage.toFixed(0)}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full ${
                                  instance.memory_usage > 80 ? 'bg-gray-900' :
                                  instance.memory_usage > 60 ? 'bg-gray-900' :
                                  'bg-gray-900'
                                }`}
                                style={{ width: `${instance.memory_usage}%` }}
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
                        <Button variant="outline" size="sm" className="text-xs">
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
