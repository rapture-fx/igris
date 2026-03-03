'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Cpu, RefreshCw, Eye, Settings, Terminal, Signal } from 'lucide-react';

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
  const router = useRouter();
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
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border-light dark:border-[#2d2a24]">
            <h1 className="text-base font-medium text-gray-900 dark:text-[#f6f6f4] font-inter">Device Details</h1>
            <p className="text-gray-600 dark:text-black mt-1 font-inter text-xs">
              Deep dive into individual runtime instance metrics and logs
            </p>
          </div>
          <Button variant="outline" size="sm" className="flex items-center gap-1 text-xs px-2 py-1">
            <RefreshCw className="h-3 w-3" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {devices.map((device) => (
            <Card key={device.id} className="border-border-light dark:border-[#2d2a24] shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Cpu className="h-4 w-4 text-gray-900 dark:text-[#f6f6f4]" />
                    <div>
                      <CardTitle className="text-xs">{device.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">{device.id}</CardDescription>
                    </div>
                  </div>
                  <Badge className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-black border dark:border-gray-700">
                    {device.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-600 dark:text-black">Model:</span>
                      <div className="font-medium text-gray-900 dark:text-[#f6f6f4]">{device.model}</div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-black">Version:</span>
                      <div className="font-medium text-gray-900 dark:text-[#f6f6f4]">{device.version}</div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-black">Region:</span>
                      <div className="font-medium text-gray-900 dark:text-[#f6f6f4]">{device.region.toUpperCase()}</div>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-black">Uptime:</span>
                      <div className="font-medium text-gray-900 dark:text-[#f6f6f4]">
                        {Math.floor(device.uptime / 86400)}d {Math.floor((device.uptime % 86400) / 3600)}h
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600 dark:text-black">CPU</span>
                        <span className="font-medium text-gray-900 dark:text-[#f6f6f4]">
                          {device.cpu_usage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
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
                        <span className="text-gray-600 dark:text-black">Memory</span>
                        <span className="font-medium text-gray-900 dark:text-[#f6f6f4]">
                          {device.memory_usage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
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
                        <span className="text-gray-600 dark:text-black">Disk</span>
                        <span className="font-medium text-gray-900 dark:text-[#f6f6f4]">{device.disk_usage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2">
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

                  <div className="bg-beige-primary dark:bg-[#1b1912] border border-border-light dark:border-[#2d2a24] rounded-lg p-3">
                    <div className="text-xs text-gray-600 dark:text-black mb-1">Network I/O</div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-900 dark:text-[#f6f6f4]">In: {device.network_in.toFixed(1)} MB/s</span>
                      <span className="text-gray-900 dark:text-[#f6f6f4]">Out: {device.network_out.toFixed(1)} MB/s</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs px-2 py-1"
                      onClick={() => router.push(`/dashboard/runtime/devices/${device.id}`)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      View Details
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs px-2 py-1" onClick={() => setSelectedDevice(device)}>
                      <Terminal className="h-3 w-3 mr-1" />
                      Logs
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs px-2 py-1">
                      <Settings className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* EscapeVector Status Card for Selected Device */}
        {selectedDevice && (
          <Card className="border-border-light dark:border-[#2d2a24] shadow-sm bg-beige-primary dark:bg-[#1b1912]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xs">
                    <Signal className="h-4 w-4 text-gray-900 dark:text-[#f6f6f4]" />
                    EscapeVector on {selectedDevice.name}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Read-only cache status for this specific runtime instance
                  </CardDescription>
                </div>
                <a
                  href="/dashboard/overture/escapevector"
                  className="text-xs text-gray-900 dark:text-[#f6f6f4] hover:text-gray-700 dark:hover:text-gray-300 underline flex items-center gap-1"
                >
                  Manage cache →
                </a>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-beige-primary dark:bg-[#1b1912] rounded-lg border border-border-light dark:border-[#2d2a24]">
                  <div className="text-xs text-gray-600 dark:text-black mb-1">Last Sync</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-[#f6f6f4]">45 secs ago</div>
                  <div className="text-xs text-gray-600 dark:text-black mt-1">Sync active</div>
                </div>
                <div className="p-3 bg-beige-primary dark:bg-[#1b1912] rounded-lg border border-border-light dark:border-[#2d2a24]">
                  <div className="text-xs text-gray-600 dark:text-black mb-1">TTL Remaining</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-[#f6f6f4]">5h 12m</div>
                  <div className="text-xs text-gray-600 dark:text-black mt-1">Auto-refresh enabled</div>
                </div>
                <div className="p-3 bg-beige-primary dark:bg-[#1b1912] rounded-lg border border-border-light dark:border-[#2d2a24]">
                  <div className="text-xs text-gray-600 dark:text-black mb-1">Local Hit Rate</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-[#f6f6f4]">91.2%</div>
                  <div className="text-xs text-gray-600 dark:text-black mt-1">This device only</div>
                </div>
                <div className="p-3 bg-beige-primary dark:bg-[#1b1912] rounded-lg border border-border-light dark:border-[#2d2a24]">
                  <div className="text-xs text-gray-600 dark:text-black mb-1">Fallback Events</div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-[#f6f6f4]">23</div>
                  <div className="text-xs text-gray-600 dark:text-black mt-1">Using cache (24h)</div>
                </div>
              </div>
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg">
                <p className="text-xs text-blue-900 dark:text-blue-400">
                  <strong>Note:</strong> This device receives EscapeVector cache updates from Overture cloud. Cache enables offline operation and reduces latency for repeated queries.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Show EscapeVector status for all devices when no device is selected */}
        {!selectedDevice && (
          <Card className="border-border-light dark:border-[#2d2a24] shadow-sm bg-beige-primary dark:bg-[#1b1912]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xs">
                    <Signal className="h-4 w-4 text-gray-900 dark:text-[#f6f6f4]" />
                    EscapeVector Status - All Devices
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Read-only cache synchronization status across displayed devices
                  </CardDescription>
                </div>
                <a
                  href="/dashboard/overture/escapevector"
                  className="text-xs text-gray-900 dark:text-[#f6f6f4] hover:text-gray-700 dark:hover:text-gray-300 underline flex items-center gap-1"
                >
                  Manage cache →
                </a>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {devices.map((device) => (
                  <div key={device.id} className="p-4 bg-beige-primary dark:bg-[#1b1912] rounded-lg border border-border-light dark:border-[#2d2a24]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-medium text-gray-900 dark:text-[#f6f6f4] text-xs">{device.name}</div>
                      <Badge className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-black border dark:border-gray-700 text-xs">Synced</Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div>
                        <div className="text-xs text-gray-600 dark:text-black">Last Sync</div>
                        <div className="text-xs font-semibold text-gray-900 dark:text-[#f6f6f4] mt-1">2 mins ago</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 dark:text-black">TTL Remaining</div>
                        <div className="text-xs font-semibold text-gray-900 dark:text-[#f6f6f4] mt-1">4h 45m</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 dark:text-black">Hit Rate</div>
                        <div className="text-xs font-semibold text-gray-900 dark:text-[#f6f6f4] mt-1">89.5%</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 dark:text-black">Fallbacks</div>
                        <div className="text-xs font-semibold text-gray-900 dark:text-[#f6f6f4] mt-1">12</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg">
                <p className="text-xs text-blue-900 dark:text-blue-400">
                  <strong>Tip:</strong> Select "View Logs" on a device card to see device-specific EscapeVector metrics and cache performance.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
