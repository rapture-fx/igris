'use client';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  Server, RefreshCw, ArrowLeft, Settings, Download, Trash2, Play, Cpu, MemoryStick,
  Activity, Clock, AlertTriangle, CheckCircle, XCircle, Zap, HardDrive, Signal, Edit2
} from 'lucide-react';

interface EdgeRuntimeInstance {
  id: string;
  name: string;
  hostname: string;
  region: string;
  availability_zone: string;
  status: 'online' | 'offline' | 'degraded';
  health: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  last_heartbeat: string;
  uptime_seconds: number;
  requests_processed: number;
  error_rate: number;
  avg_latency: number;
  cpu_usage: number;
  memory_usage: number;
  gpu_usage?: number;
  disk_usage: number;
  model_loaded: string;
  fallback_mode: string;
  gpu_layers: number;
  tokens_24h: number;
  fallback_events_24h: number;
}

interface ActivityLogEntry {
  id: string;
  timestamp: string;
  event_type: 'config_update' | 'model_load' | 'fallback' | 'error' | 'restart';
  details: string;
  status: 'success' | 'warning' | 'error';
}

// Mock device data generator based on device ID
const generateDeviceData = (deviceId: string): EdgeRuntimeInstance => {
  const deviceMocks: Record<string, Partial<EdgeRuntimeInstance>> = {
    'dev-us-east-001': {
      name: 'Runtime US East 1',
      hostname: 'edge-runtime-us-east-001',
      region: 'us-east-1',
      availability_zone: 'us-east-1a',
      status: 'online',
      health: 'healthy',
      cpu_usage: 45.2,
      memory_usage: 62.8,
      gpu_usage: 34.5,
      error_rate: 0.8,
      avg_latency: 142,
      tokens_24h: 2450000,
      fallback_events_24h: 23,
    },
    'dev-eu-west-002': {
      name: 'Runtime EU West 2',
      hostname: 'edge-runtime-eu-west-002',
      region: 'eu-west-1',
      availability_zone: 'eu-west-1b',
      status: 'online',
      health: 'degraded',
      cpu_usage: 78.9,
      memory_usage: 85.3,
      gpu_usage: 67.2,
      error_rate: 2.5,
      avg_latency: 278,
      tokens_24h: 3420000,
      fallback_events_24h: 67,
    },
  };

  const mockData = deviceMocks[deviceId] || deviceMocks['dev-us-east-001'];

  return {
    id: deviceId,
    name: mockData.name || 'Unknown Device',
    hostname: mockData.hostname || `device-${deviceId}`,
    region: mockData.region || 'us-east-1',
    availability_zone: mockData.availability_zone || 'us-east-1a',
    status: mockData.status || 'offline',
    health: mockData.health || 'unhealthy',
    version: 'v2.1.3',
    last_heartbeat: new Date(Date.now() - 45000).toISOString(),
    uptime_seconds: 864000,
    requests_processed: 125847,
    error_rate: mockData.error_rate || 1.2,
    avg_latency: mockData.avg_latency || 150,
    cpu_usage: mockData.cpu_usage || 50,
    memory_usage: mockData.memory_usage || 60,
    gpu_usage: mockData.gpu_usage || 40,
    disk_usage: 42.1,
    model_loaded: 'phi-3-mini-4k-instruct-q4.gguf',
    fallback_mode: 'prefer_cloud',
    gpu_layers: 0,
    tokens_24h: mockData.tokens_24h || 2000000,
    fallback_events_24h: mockData.fallback_events_24h || 15,
  };
};

export default function DeviceDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const deviceId = resolvedParams.id;
  const router = useRouter();
  const { toast } = useToast();

  // Mock device data - in production, fetch from /api/fleet/instances/${deviceId}
  const [device, setDevice] = useState<EdgeRuntimeInstance>(generateDeviceData(deviceId));

  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([
    {
      id: '1',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      event_type: 'config_update',
      details: 'Fleet configuration synced',
      status: 'success',
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      event_type: 'fallback',
      details: 'Cloud provider unavailable, used local model',
      status: 'warning',
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 10800000).toISOString(),
      event_type: 'model_load',
      details: 'Loaded phi-3-mini-4k-instruct-q4.gguf',
      status: 'success',
    },
  ]);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(device.name);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSaveName = async () => {
    setIsLoading(true);
    try {
      // In production: await fetch(`/api/fleet/instances/${deviceId}`, { method: 'PATCH', body: { name: editedName } })
      await new Promise(resolve => setTimeout(resolve, 500));
      setDevice({ ...device, name: editedName });
      setIsEditingName(false);
      toast({
        title: 'Device name updated',
        description: `Device renamed to "${editedName}"`,
      });
    } catch (error) {
      toast({
        title: 'Update failed',
        description: 'Failed to update device name.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestartDevice = async () => {
    setIsLoading(true);
    try {
      // In production: await fetch(`/api/fleet/instances/${deviceId}/restart`, { method: 'POST' })
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: 'Restart initiated',
        description: 'Device is restarting. This may take a few minutes.',
      });
      setShowRestartDialog(false);
    } catch (error) {
      toast({
        title: 'Restart failed',
        description: 'Failed to restart device.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveDevice = async () => {
    setIsLoading(true);
    try {
      // In production: await fetch(`/api/fleet/instances/${deviceId}`, { method: 'DELETE' })
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast({
        title: 'Device removed',
        description: 'Device has been removed from the fleet.',
      });
      router.push('/dashboard/runtime/fleet');
    } catch (error) {
      toast({
        title: 'Remove failed',
        description: 'Failed to remove device.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadLogs = async () => {
    toast({
      title: 'Downloading logs',
      description: 'Device logs will download shortly.',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-50 text-green-700 border-green-200';
      case 'offline': return 'bg-gray-50 text-gray-700 border-gray-200';
      case 'degraded': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-black" />;
      case 'degraded': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'unhealthy': return <XCircle className="h-4 w-4 text-red-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'config_update': return <Settings className="h-3 w-3 text-gray-600" />;
      case 'model_load': return <Server className="h-3 w-3 text-blue-600" />;
      case 'fallback': return <AlertTriangle className="h-3 w-3 text-yellow-600" />;
      case 'error': return <XCircle className="h-3 w-3 text-red-600" />;
      case 'restart': return <RefreshCw className="h-3 w-3 text-gray-600" />;
      default: return <Activity className="h-3 w-3 text-gray-600" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getTimeSince = (isoString: string) => {
    const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/dashboard/runtime/fleet')}
              className="text-xs"
            >
              <ArrowLeft className="h-3 w-3 mr-1" />
              Back to Fleet
            </Button>
            <div className="h-4 w-px bg-border-light" />
            <div>
              <h1 className="text-base font-medium text-gray-900 font-inter">Device Details</h1>
              <p className="text-gray-600 text-xs font-inter">{device.hostname}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>

        {/* Device Status Hero Card */}
        <Card className="border-border-light shadow-sm bg-beige-primary">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <Server className="h-6 w-6 text-gray-900" />
                  <div>
                    {isEditingName ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="text-base font-medium h-8 max-w-xs"
                        />
                        <Button size="sm" onClick={handleSaveName} disabled={isLoading} className="h-7 text-xs">
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setIsEditingName(false);
                          setEditedName(device.name);
                        }} className="h-7 text-xs">
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-medium text-gray-900">{device.name}</h2>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditingName(true)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-gray-600 mt-1">ID: {device.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-[0.65rem] text-gray-600 mb-1">Status</div>
                    <Badge className={getStatusColor(device.status)}>
                      {device.status}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-[0.65rem] text-gray-600 mb-1">Health</div>
                    <div className="flex items-center gap-1.5">
                      {getHealthIcon(device.health)}
                      <span className="text-xs font-medium text-gray-900 capitalize">{device.health}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[0.65rem] text-gray-600 mb-1">Last Seen</div>
                    <div className="text-xs font-medium text-gray-900">{getTimeSince(device.last_heartbeat)}</div>
                  </div>
                  <div>
                    <div className="text-[0.65rem] text-gray-600 mb-1">Uptime</div>
                    <div className="text-xs font-medium text-gray-900">{formatUptime(device.uptime_seconds)}</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadLogs}
                  className="text-xs"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Logs
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRestartDialog(true)}
                  className="text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Restart
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRemoveDialog(true)}
                  className="text-xs text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics Grid */}
        <div className="bg-beige-primary">
          <div className="grid grid-cols-6 divide-x divide-border-light">
            <div className="p-4">
              <div className="text-[0.65rem] font-medium text-gray-600 mb-1">Avg Latency</div>
              <div className="text-sm font-bold text-gray-900">{device.avg_latency}ms</div>
              <p className="text-[0.6rem] text-gray-600 mt-1">Last 24h</p>
            </div>
            <div className="p-4">
              <div className="text-[0.65rem] font-medium text-gray-600 mb-1">Tokens (24h)</div>
              <div className="text-sm font-bold text-gray-900">{(device.tokens_24h / 1000000).toFixed(2)}M</div>
              <p className="text-[0.6rem] text-gray-600 mt-1">Processed</p>
            </div>
            <div className="p-4">
              <div className="text-[0.65rem] font-medium text-gray-600 mb-1">Error Rate</div>
              <div className={`text-sm font-bold ${device.error_rate > 2 ? 'text-red-600' : 'text-gray-900'}`}>
                {device.error_rate.toFixed(2)}%
              </div>
              <p className="text-[0.6rem] text-gray-600 mt-1">Last 24h</p>
            </div>
            <div className="p-4">
              <div className="text-[0.65rem] font-medium text-gray-600 mb-1">CPU Usage</div>
              <div className="text-sm font-bold text-gray-900">{device.cpu_usage.toFixed(1)}%</div>
              <p className="text-[0.6rem] text-gray-600 mt-1">Current</p>
            </div>
            <div className="p-4">
              <div className="text-[0.65rem] font-medium text-gray-600 mb-1">Memory</div>
              <div className="text-sm font-bold text-gray-900">{device.memory_usage.toFixed(1)}%</div>
              <p className="text-[0.6rem] text-gray-600 mt-1">Current</p>
            </div>
            <div className="p-4">
              <div className="text-[0.65rem] font-medium text-gray-600 mb-1">Fallbacks</div>
              <div className="text-sm font-bold text-gray-900">{device.fallback_events_24h}</div>
              <p className="text-[0.6rem] text-gray-600 mt-1">Last 24h</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Configuration Card */}
          <Card className="border-border-light shadow-sm bg-beige-primary">
            <CardHeader>
              <CardTitle className="text-sm">Device Configuration</CardTitle>
              <CardDescription className="text-xs">Current runtime settings (read-only)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs text-gray-600">Model Loaded</Label>
                <div className="text-xs font-medium text-gray-900 font-mono">{device.model_loaded}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600">GPU Layers</Label>
                  <div className="text-xs font-medium text-gray-900">{device.gpu_layers}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-gray-600">Fallback Mode</Label>
                  <div className="text-xs font-medium text-gray-900">{device.fallback_mode}</div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-600">Region / AZ</Label>
                <div className="text-xs font-medium text-gray-900">{device.region} / {device.availability_zone}</div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-gray-600">Version</Label>
                <div className="text-xs font-medium text-gray-900">{device.version}</div>
              </div>
              <div className="pt-2 border-t border-border-light">
                <a
                  href="/dashboard/runtime/fleet"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push('/dashboard/runtime/fleet');
                    setTimeout(() => {
                      const button = document.querySelector('[data-fleet-settings]') as HTMLButtonElement;
                      if (button) button.click();
                    }, 500);
                  }}
                  className="text-xs text-gray-900 hover:text-gray-700 underline"
                >
                  Edit fleet-wide config →
                </a>
              </div>
            </CardContent>
          </Card>

          {/* EscapeVector Status Card */}
          <Card className="border-border-light shadow-sm bg-beige-primary">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Signal className="h-4 w-4" />
                    EscapeVector Status
                  </CardTitle>
                  <CardDescription className="text-xs">Local cache synchronization</CardDescription>
                </div>
                <a
                  href="/dashboard/overture/escapevector"
                  className="text-xs text-gray-900 hover:text-gray-700 underline"
                >
                  Manage →
                </a>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-600">Last Sync</div>
                  <div className="text-xs font-semibold text-gray-900 mt-1">2 mins ago</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">TTL Remaining</div>
                  <div className="text-xs font-semibold text-gray-900 mt-1">4h 45m</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Local Hit Rate</div>
                  <div className="text-xs font-semibold text-gray-900 mt-1">91.2%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-600">Cache Events</div>
                  <div className="text-xs font-semibold text-gray-900 mt-1">{device.fallback_events_24h}</div>
                </div>
              </div>
              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-[0.65rem] text-blue-900">
                Cache enables offline operation and reduces latency
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Log */}
        <Card className="border-border-light shadow-sm bg-beige-primary">
          <CardHeader>
            <CardTitle className="text-sm">Recent Activity</CardTitle>
            <CardDescription className="text-xs">Latest events and operations on this device</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activityLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-3 bg-beige-primary border border-border-light rounded-lg"
                >
                  <div className="mt-0.5">
                    {getEventIcon(entry.event_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-900 capitalize">
                        {entry.event_type.replace('_', ' ')}
                      </span>
                      <Badge className={`text-[0.6rem] ${
                        entry.status === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
                        entry.status === 'warning' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {entry.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{entry.details}</p>
                  </div>
                  <div className="text-[0.65rem] text-gray-600 whitespace-nowrap">
                    {getTimeSince(entry.timestamp)}
                  </div>
                </div>
              ))}
            </div>
            {activityLog.length === 0 && (
              <div className="text-center py-8 text-xs text-gray-600">
                No recent activity
              </div>
            )}
          </CardContent>
        </Card>

        {/* Restart Dialog */}
        <Dialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">Restart Device</DialogTitle>
              <DialogDescription className="text-xs">
                This will restart the runtime instance. Active requests will be interrupted.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRestartDialog(false)} className="text-xs">
                Cancel
              </Button>
              <Button onClick={handleRestartDevice} disabled={isLoading} className="text-xs bg-gray-900 hover:bg-gray-800 text-white">
                {isLoading ? 'Restarting...' : 'Restart Device'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove Dialog */}
        <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm text-red-600">Remove Device</DialogTitle>
              <DialogDescription className="text-xs">
                This will permanently remove this device from the fleet. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRemoveDialog(false)} className="text-xs">
                Cancel
              </Button>
              <Button onClick={handleRemoveDevice} disabled={isLoading} className="text-xs bg-red-600 hover:bg-red-700 text-white">
                {isLoading ? 'Removing...' : 'Remove Device'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
