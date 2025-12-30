'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cpu, RefreshCw, Eye, Settings, Terminal } from 'lucide-react';

interface DeviceDetail {
  id: string;
  name: string;
  model: string;
  version: string;
  region: string;
  status: 'online' | 'offline';
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_in: number;
  network_out: number;
  uptime: number;
  last_heartbeat: string;
}

export default function RuntimeDevicesPage() {
  const [devices] = useState<DeviceDetail[]>([
    {
      id: 'dev-us-east-001',
      name: 'Runtime US East 1',
      model: 'edge-runtime-v2',
      version: 'v2.1.3',
      region: 'us-east-1',
      status: 'online',
      cpu_usage: 45.2,
      memory_usage: 62.8,
      disk_usage: 34.5,
      network_in: 125.4,
      network_out: 89.2,
      uptime: 864000,
      last_heartbeat: '30 seconds ago',
    },
    {
      id: 'dev-eu-west-002',
      name: 'Runtime EU West 2',
      model: 'edge-runtime-v2',
      version: 'v2.1.3',
      region: 'eu-west-1',
      status: 'online',
      cpu_usage: 78.9,
      memory_usage: 85.3,
      disk_usage: 67.2,
      network_in: 342.8,
      network_out: 278.5,
      uptime: 432000,
      last_heartbeat: '1 minute ago',
    },
  ]);

  const [selectedDevice, setSelectedDevice] = useState<DeviceDetail | null>(null);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border-light">
            <h1 className="text-base font-medium text-gray-900 font-inter">Device Details</h1>
            <p className="text-gray-600 mt-1 font-inter text-xs">
              Deep dive into individual runtime instance metrics and logs
            </p>
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {devices.map((device) => (
            <Card key={device.id} className="border-border-light shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Cpu className="h-5 w-5 text-gray-900" />
                    <div>
                      <CardTitle className="text-sm text-base">{device.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">{device.id}</CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-gray-50 text-gray-700 border">
                    {device.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Model:</span>
                      <div className="font-medium text-gray-900">{device.model}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Version:</span>
                      <div className="font-medium text-gray-900">{device.version}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Region:</span>
                      <div className="font-medium text-gray-900">{device.region.toUpperCase()}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Uptime:</span>
                      <div className="font-medium text-gray-900">
                        {Math.floor(device.uptime / 86400)}d {Math.floor((device.uptime % 86400) / 3600)}h
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">CPU</span>
                        <span className="font-medium text-gray-900">
                          {device.cpu_usage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <svg width="100%" height="8" className="overflow-visible">
                          <defs>
                            <pattern id={`cpu-stripe-${device.id}`} width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                              <rect width="1" height="2" fill={
                                device.cpu_usage > 80 ? '#ef4444' : device.cpu_usage > 60 ? '#eab308' : '#22c55e'
                              } />
                            </pattern>
                          </defs>
                          <rect
                            x="0"
                            y="0"
                            width={`${device.cpu_usage}%`}
                            height="8"
                            fill={`url(#cpu-stripe-${device.id})`}
                            rx="4"
                          />
                        </svg>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">Memory</span>
                        <span className="font-medium text-gray-900">
                          {device.memory_usage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <svg width="100%" height="8" className="overflow-visible">
                          <defs>
                            <pattern id={`memory-stripe-${device.id}`} width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                              <rect width="1" height="2" fill={
                                device.memory_usage > 80 ? '#ef4444' : device.memory_usage > 60 ? '#eab308' : '#22c55e'
                              } />
                            </pattern>
                          </defs>
                          <rect
                            x="0"
                            y="0"
                            width={`${device.memory_usage}%`}
                            height="8"
                            fill={`url(#memory-stripe-${device.id})`}
                            rx="4"
                          />
                        </svg>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">Disk</span>
                        <span className="font-medium text-gray-900">{device.disk_usage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <svg width="100%" height="8" className="overflow-visible">
                          <defs>
                            <pattern id={`disk-stripe-${device.id}`} width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                              <rect width="1" height="2" fill={
                                device.disk_usage > 80 ? '#ef4444' : device.disk_usage > 60 ? '#eab308' : '#22c55e'
                              } />
                            </pattern>
                          </defs>
                          <rect
                            x="0"
                            y="0"
                            width={`${device.disk_usage}%`}
                            height="8"
                            fill={`url(#disk-stripe-${device.id})`}
                            rx="4"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="bg-beige-primary border border-border-light rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Network I/O</div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-900">In: {device.network_in.toFixed(1)} MB/s</span>
                      <span className="text-gray-900">Out: {device.network_out.toFixed(1)} MB/s</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setSelectedDevice(device)}>
                      <Eye className="h-3 w-3 mr-1" />
                      View Logs
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 text-xs">
                      <Terminal className="h-3 w-3 mr-1" />
                      Shell
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs">
                      <Settings className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
