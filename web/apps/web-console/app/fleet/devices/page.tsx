'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/ui/status-badge';
import { Progress } from '@/components/ui/progress';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetClose,
} from '@/components/ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import {
  MonitorSmartphone, Wifi, WifiOff, Activity, AlertTriangle,
  Search, RefreshCw, ChevronRight, Server, Shield, History, Cpu,
} from 'lucide-react';

interface Device {
  id: string;
  status: string;
  version: string;
  last_seen_at?: string;
  execution_count: number;
  violation_count: number;
  health?: {
    cpu_percent: number;
    memory_mb: number;
    memory_limit_mb: number;
    uptime_seconds: number;
  };
  recent_executions?: Array<{ id: string; status: string; started_at: string }>;
  policy_snapshot?: Record<string, any>;
  violation_history?: Array<{ kind: string; created_at: string }>;
}

export default function FleetDevicesPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Device | null>(null);

  const { data: devices = [], isLoading, refetch } = useQuery<Device[]>({
    queryKey: ['fleet-devices'],
    queryFn: () => api.get('/v1/fleet/devices'),
    retry: false,
  });

  const filtered = useMemo(() =>
    devices.filter((d) =>
      !search ||
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.version?.toLowerCase().includes(search.toLowerCase())
    ), [devices, search]);

  const counts = useMemo(() => ({
    online: devices.filter((d) => d.status === 'ONLINE').length,
    offline: devices.filter((d) => d.status === 'OFFLINE').length,
    totalExec: devices.reduce((sum, d) => sum + (d.execution_count ?? 0), 0),
    totalViol: devices.reduce((sum, d) => sum + (d.violation_count ?? 0), 0),
  }), [devices]);

  const STAT_CARDS = [
    { label: 'Online', value: counts.online, icon: Wifi, color: 'text-green-600' },
    { label: 'Offline', value: counts.offline, icon: WifiOff, color: 'text-gray-500' },
    { label: 'Total Executions', value: counts.totalExec, icon: Activity, color: 'text-blue-600' },
    { label: 'Violations', value: counts.totalViol, icon: AlertTriangle, color: 'text-orange-600' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Devices</h1>
          <p className="text-xs text-gray-500 mt-0.5">Edge and cloud runtime instances.</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_CARDS.map((c) => (
            <Card key={c.label} className="border border-gray-200">
              <CardHeader className="px-4 pt-3 pb-0">
                <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-1">
                {isLoading ? <Skeleton className="h-6 w-10" /> : (
                  <span className="text-base font-semibold text-gray-900 tabular-nums">{c.value}</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search by ID or version..."
              className="pl-8 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {/* Table */}
        <Card className="border border-gray-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Executions</TableHead>
                <TableHead>Violations</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 py-12">No devices found</TableCell>
                </TableRow>
              ) : (
                filtered.map((device) => (
                  <TableRow key={device.id} className="cursor-pointer" onClick={() => setSelected(device)}>
                    <TableCell className="text-xs text-gray-600">{truncateText(device.id, 14)}</TableCell>
                    <TableCell><StatusBadge status={device.status} /></TableCell>
                    <TableCell className="text-xs text-gray-600">{device.version ?? '—'}</TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {device.last_seen_at ? getRelativeTime(device.last_seen_at) : '—'}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">{device.execution_count ?? 0}</TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {device.violation_count > 0 ? (
                        <span className="text-orange-600 font-medium">{device.violation_count}</span>
                      ) : 0}
                    </TableCell>
                    <TableCell><ChevronRight className="h-4 w-4 text-gray-300" /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Device Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <div>
                  <SheetTitle className="text-sm font-semibold">Device Detail</SheetTitle>
                  <p className="text-xs text-gray-500 mt-0.5">{selected.id}</p>
                </div>
                <SheetClose onClick={() => setSelected(null)} />
              </SheetHeader>

              <SheetBody>
              <div className="space-y-5">
                {/* Health Metrics */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5" /> Device Health Metrics
                  </h3>
                  {selected.health ? (
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">CPU</span>
                          <span className="text-gray-700 tabular-nums">{selected.health.cpu_percent?.toFixed(1)}%</span>
                        </div>
                        <Progress value={selected.health.cpu_percent} />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Memory</span>
                          <span className="text-gray-700 tabular-nums">
                            {selected.health.memory_mb} / {selected.health.memory_limit_mb} MB
                          </span>
                        </div>
                        <Progress value={(selected.health.memory_mb / selected.health.memory_limit_mb) * 100} />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Uptime</span>
                        <span className="text-gray-700 tabular-nums">
                          {Math.floor(selected.health.uptime_seconds / 3600)}h {Math.floor((selected.health.uptime_seconds % 3600) / 60)}m
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No health data available</p>
                  )}
                </section>

                <Separator />

                {/* Recent Executions */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" /> Recent Executions
                  </h3>
                  {(selected.recent_executions ?? []).length === 0 ? (
                    <p className="text-xs text-gray-400">No recent executions</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(selected.recent_executions ?? []).map((ex) => (
                        <div key={ex.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">{truncateText(ex.id, 14)}</span>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={ex.status} />
                            <span className="text-gray-400">{getRelativeTime(ex.started_at)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <Separator />

                {/* Policy Snapshot */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" /> Policy Snapshot
                  </h3>
                  <pre className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-md p-3 overflow-auto max-h-32">
                    {selected.policy_snapshot ? JSON.stringify(selected.policy_snapshot, null, 2) : 'No snapshot available'}
                  </pre>
                </section>

                <Separator />

                {/* Violation History */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5" /> Violation History
                  </h3>
                  {(selected.violation_history ?? []).length === 0 ? (
                    <p className="text-xs text-gray-400">No violations recorded</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(selected.violation_history ?? []).map((v, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-orange-700 font-medium">{v.kind}</span>
                          <span className="text-gray-400">{getRelativeTime(v.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
