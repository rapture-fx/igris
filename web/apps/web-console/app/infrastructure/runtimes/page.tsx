'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/apiClient';
import { getRelativeTime, formatDateTime, truncateText } from '@/utils/helpers';
import Link from 'next/link';
import { CopyButton, KeyValueGrid, JSONViewer } from '@/components/execution/shared';
import {
  Wifi, WifiOff, Activity, AlertTriangle, Search, RefreshCw,
  Shield, History, Cpu, CheckCircle2, AlertCircle, Server, Box, Zap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RosNode {
  node_name: string;
  namespace: string;
  lifecycle_state: string;
  air_gapped: boolean;
  last_trace_at?: string;
  cpu_usage_percent?: number;
  memory_usage_mb?: number;
  violation_count_24h?: number;
}

interface Device {
  device_id: string;
  status: 'online' | 'offline';
  runtime_version: string;
  last_seen: string;
  registration_time: string;
  license_id: string | null;
  cpu_usage_percent: number;
  memory_usage_mb: number;
  active_executions: number;
  executions_24h: number;
  violations_24h: number;
  last_execution_id: string | null;
  policy_hash: string;
  global_policy_hash: string;
  ros_node?: RosNode;
  containment?: {
    enabled: boolean;
    mode?: string;
    violation_count?: number;
  };
}

interface ExecutionMini {
  execution_id: string;
  agent_id: string;
  status: 'running' | 'completed' | 'failed' | 'terminated';
  duration_ms: number;
  timestamp: string;
}

interface ViolationMini {
  timestamp: string;
  violation_type: string;
  limit: string;
  observed: string;
  execution_id: string;
}

interface DeviceStats {
  executions_total: number;
  violations_total: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ViolationCountBadge({ count }: { count: number }) {
  if (count === 0) return <span className="text-xs text-muted-foreground">—</span>;
  if (count <= 5) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 flex-shrink-0" />
        {count}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500 flex-shrink-0" />
      {count}
    </span>
  );
}

function PolicySyncIndicator({
  policyHash,
  globalPolicyHash,
}: {
  policyHash: string;
  globalPolicyHash: string;
}) {
  if (policyHash === globalPolicyHash) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        In Sync
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-yellow-700">
      <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
      Out of Sync
    </span>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function ContainmentBadge({ containment }: { containment?: { enabled: boolean; mode?: string; violation_count?: number } }) {
  if (!containment?.enabled) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
      <Shield className="h-2.5 w-2.5" />
      {containment.mode ?? 'Contained'}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FleetDevicesPage() {
  return (
    <Suspense fallback={null}>
      <FleetDevicesContent />
    </Suspense>
  );
}

function FleetDevicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  // ── Runtimes list ──
  const { data: devices = [], isLoading: devicesLoading, refetch } = useQuery<Device[]>({
    queryKey: ['fleet-devices-v2'],
    queryFn: async () => {
      try {
        return await api.get<Device[]>('/devices');
      } catch {
        return [] as Device[];
      }
    },
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // ── 24h stats ──
  const { data: stats } = useQuery<DeviceStats | null>({
    queryKey: ['fleet-devices-stats', timeRange],
    queryFn: async () => {
      try {
        return await api.get<DeviceStats>(`/devices/stats?range=${timeRange}`);
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // ── Runtime quota from subscription ──
  const { data: runtimeQuota } = useQuery<{
    tier_name: string;
    runtimes: { used: number; limit: number; percent: number };
    upgrade_tier: string;
  } | null>({
    queryKey: ['subscription-status'],
    queryFn: async () => {
      try {
        return await api.get<{
          tier_name: string;
          runtimes: { used: number; limit: number; percent: number };
          upgrade_tier: string;
        }>('/api/subscription/status');
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const runtimeLimitReached = (runtimeQuota?.runtimes.percent ?? 0) >= 100;

  // ── URL-synced drawer ──
  const deviceFromUrl = searchParams.get('device');

  const selectedDevice = useMemo(
    () => devices.find((d) => d.device_id === deviceFromUrl) ?? null,
    [devices, deviceFromUrl],
  );

  const openDevice = (id: string) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('device', id);
    router.push(`?${p.toString()}`, { scroll: false });
  };

  const closeDrawer = () => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete('device');
    router.push(`?${p.toString()}`, { scroll: false });
  };

  // ── Runtime detail queries (enabled only when drawer open) ──
  const { data: deviceExecutions = [], isLoading: execLoading } = useQuery<ExecutionMini[]>({
    queryKey: ['device-executions', deviceFromUrl],
    enabled: !!deviceFromUrl,
    queryFn: async () => {
      try {
        return await api.get<ExecutionMini[]>(`/devices/${deviceFromUrl}/executions?limit=10`);
      } catch {
        return [] as ExecutionMini[];
      }
    },
    staleTime: 30_000,
    retry: false,
  });

  const { data: deviceViolations = [], isLoading: violLoading } = useQuery<ViolationMini[]>({
    queryKey: ['device-violations', deviceFromUrl],
    enabled: !!deviceFromUrl,
    queryFn: async () => {
      try {
        return await api.get<ViolationMini[]>(`/devices/${deviceFromUrl}/violations?limit=10`);
      } catch {
        return [] as ViolationMini[];
      }
    },
    staleTime: 30_000,
    retry: false,
  });

  // ── ESC key ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchParams.get('device')) {
        const p = new URLSearchParams(searchParams.toString());
        p.delete('device');
        router.push(`?${p.toString()}`, { scroll: false });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [router, searchParams]);

  // ── Filtered devices ──
  const filtered = useMemo(() => {
    return devices.filter((d) => {
      if (search && !d.device_id.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      return true;
    });
  }, [devices, search, statusFilter]);

  const counts = useMemo(
    () => ({
      online: devices.filter((d) => d.status === 'online').length,
      offline: devices.filter((d) => d.status === 'offline').length,
    }),
    [devices],
  );

  const STAT_CARDS = [
    { label: 'Online', value: counts.online, icon: Wifi, pending: devicesLoading },
    { label: 'Offline', value: counts.offline, icon: WifiOff, pending: devicesLoading },
    { label: 'Executions (24h)', value: stats?.executions_total ?? '—', icon: Activity, pending: !stats },
    { label: 'Violations (24h)', value: stats?.violations_total ?? '—', icon: AlertTriangle, pending: !stats },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-base font-semibold text-foreground">Runtimes</h1>

          {runtimeQuota && (
            <div className="flex-shrink-0 min-w-[200px]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Runtime quota · {runtimeQuota.tier_name}
                </span>
                <span className="text-xs tabular-nums font-medium text-foreground">
                  {runtimeQuota.runtimes.used} / {runtimeQuota.runtimes.limit}
                </span>
              </div>
              <Progress value={runtimeQuota.runtimes.percent} className="h-1.5" />
              {runtimeLimitReached && (
                <p className="text-[11px] text-red-600 mt-1.5">
                  Runtime limit reached.{' '}
                  <Link href="/settings/license" className="underline">
                    Review license capacity.
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Summary Cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_CARDS.map((c) => (
            <div key={c.label} className="border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white">
              <div className="px-4 pt-4 pb-2 text-xs font-medium text-foreground flex items-center gap-1.5">
                <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
                {c.label}
              </div>
              <div className="bg-white px-4 pt-4 pb-5">
                {c.pending ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <div className="text-3xl font-bold tabular-nums text-foreground">{c.value}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Runtimes Table ──────────────────────────────────────────── */}
        <div className="border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-medium text-foreground">Runtimes</span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search runtime_id…"
                  className="pl-8 h-8 text-xs w-48"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="h-8 w-[110px] text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All</SelectItem>
                  <SelectItem value="online" className="text-xs">Online</SelectItem>
                  <SelectItem value="offline" className="text-xs">Offline</SelectItem>
                </SelectContent>
              </Select>
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
                <SelectTrigger className="h-8 w-[80px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h" className="text-xs">24h</SelectItem>
                  <SelectItem value="7d" className="text-xs">7d</SelectItem>
                  <SelectItem value="30d" className="text-xs">30d</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white border-b border-black/[0.08] dark:border-white/[0.08]">
                    {['Runtime ID', 'Status', 'Version', 'Last Seen', 'Active Exec', 'Runs (24h)', 'Violations', 'Policy Sync', 'Containment'].map((col) => (
                      <th key={col} className="px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {devicesLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="bg-white border-b border-black/[0.08] dark:border-white/[0.08]">
                        {Array.from({ length: 9 }).map((_, j) => (
                          <td key={j} className="px-4 py-2.5">
                            <Skeleton className="h-3.5 w-16" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr className="bg-white">
                      <td colSpan={9} className="py-14">
                        <div className="flex flex-col items-center gap-2.5 text-center">
                          <Server className="h-9 w-9 text-gray-200" />
                          <p className="text-xs text-muted-foreground">No runtime nodes registered yet.</p>
                          {runtimeLimitReached ? (
                            <div className="flex flex-col items-center gap-1">
                              <Button variant="outline" size="sm" className="h-7 text-xs mt-0.5" disabled>
                                Runtime limit reached
                              </Button>
                              <Link href="/settings/license" className="text-[11px] text-blue-600 hover:text-blue-700">
                                Review license capacity
                              </Link>
                            </div>
                          ) : (
                            <Button variant="outline" size="sm" className="h-7 text-xs mt-0.5" asChild>
                              <Link href="/downloads/runtime">Register Runtime Node</Link>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((device) => (
                      <tr
                        key={device.device_id}
                        className="bg-white border-b border-black/[0.08] dark:border-white/[0.08] hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => openDevice(device.device_id)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-muted-foreground">{truncateText(device.device_id, 18)}</span>
                            <CopyButton value={device.device_id} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={device.status.toUpperCase()} />
                        </td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">{device.runtime_version}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{getRelativeTime(device.last_seen)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-foreground">{device.active_executions}</td>
                        <td className="px-4 py-2.5 tabular-nums text-foreground">{device.executions_24h}</td>
                        <td className="px-4 py-2.5">
                          <ViolationCountBadge count={device.violations_24h} />
                        </td>
                        <td className="px-4 py-2.5">
                          <PolicySyncIndicator policyHash={device.policy_hash} globalPolicyHash={device.global_policy_hash} />
                        </td>
                        <td className="px-4 py-2.5">
                          <ContainmentBadge containment={device.containment} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3">
              <span className="text-xs text-foreground">
                {filtered.length} runtime{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Runtime Detail Drawer ──────────────────────────────────────────────── */}
      <Sheet open={!!selectedDevice} onOpenChange={(open) => !open && closeDrawer()}>
        <SheetContent>
          {selectedDevice && (
            <>
              <SheetHeader>
                <div>
                  <SheetTitle className="text-sm font-semibold">Runtime Node</SheetTitle>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{selectedDevice.device_id}</p>
                </div>
                <SheetClose onClick={closeDrawer} />
              </SheetHeader>

              <SheetBody>
                <div className="space-y-6">

                  {/* Runtime Metadata */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Server className="h-3.5 w-3.5" />
                      Runtime Metadata
                    </h3>
                    <KeyValueGrid
                      rows={[
                        {
                          label: 'Runtime ID',
                          value: (
                            <span className="font-mono break-all text-gray-900">
                              {selectedDevice.device_id}
                            </span>
                          ),
                          copyable: selectedDevice.device_id,
                        },
                        {
                          label: 'Status',
                          value: <StatusBadge status={selectedDevice.status.toUpperCase()} />,
                        },
                        {
                          label: 'Runtime Version',
                          value: (
                            <span className="font-mono">{selectedDevice.runtime_version}</span>
                          ),
                        },
                        {
                          label: 'Registered',
                          value: formatDateTime(selectedDevice.registration_time),
                        },
                        {
                          label: 'Last Seen',
                          value: getRelativeTime(selectedDevice.last_seen),
                        },
                        {
                          label: 'License ID',
                          value: selectedDevice.license_id ? (
                            <span className="font-mono">{selectedDevice.license_id}</span>
                          ) : null,
                          copyable: selectedDevice.license_id ?? undefined,
                        },
                      ]}
                    />
                  </section>

                  <Separator />

                  {/* Runtime Health */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5" />
                      Runtime Health
                    </h3>
                    <div className="space-y-3 mb-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-500">CPU Usage</span>
                          <span className="text-gray-700 tabular-nums font-mono">
                            {selectedDevice.cpu_usage_percent.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={selectedDevice.cpu_usage_percent} className="h-1.5" />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-500">Memory</span>
                          <span className="text-gray-700 tabular-nums font-mono">
                            {selectedDevice.memory_usage_mb} MB
                          </span>
                        </div>
                        <Progress
                          value={Math.min((selectedDevice.memory_usage_mb / 2048) * 100, 100)}
                          className="h-1.5"
                        />
                      </div>
                    </div>
                    <KeyValueGrid
                      rows={[
                        {
                          label: 'Active Executions',
                          value: (
                            <span className="tabular-nums font-semibold">
                              {selectedDevice.active_executions}
                            </span>
                          ),
                        },
                        {
                          label: 'Last Execution ID',
                          value: selectedDevice.last_execution_id ? (
                            <span className="font-mono">
                              {truncateText(selectedDevice.last_execution_id, 20)}
                            </span>
                          ) : null,
                          copyable: selectedDevice.last_execution_id ?? undefined,
                        },
                      ]}
                    />
                  </section>

                  <Separator />

                  {/* Policy Snapshot */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      Policy Snapshot
                    </h3>
                    {selectedDevice.policy_hash !== selectedDevice.global_policy_hash && (
                      <div className="mb-3 flex items-start gap-2 px-3 py-2.5 rounded-md bg-yellow-50 border border-yellow-200">
                        <AlertCircle className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-700 leading-relaxed">
                          Policy hash mismatch — this node is running an outdated policy version and
                          may not enforce current governance rules.
                        </p>
                      </div>
                    )}
                    <KeyValueGrid
                      rows={[
                        {
                          label: 'Node Policy Hash',
                          value: (
                            <span
                              className={`font-mono break-all text-xs ${
                                selectedDevice.policy_hash !== selectedDevice.global_policy_hash
                                  ? 'text-yellow-700'
                                  : 'text-gray-900'
                              }`}
                            >
                              {selectedDevice.policy_hash}
                            </span>
                          ),
                          copyable: selectedDevice.policy_hash,
                        },
                        {
                          label: 'Global Policy Hash',
                          value: (
                            <span className="font-mono break-all text-xs text-green-700">
                              {selectedDevice.global_policy_hash}
                            </span>
                          ),
                          copyable: selectedDevice.global_policy_hash,
                        },
                        {
                          label: 'Sync Status',
                          value: (
                            <PolicySyncIndicator
                              policyHash={selectedDevice.policy_hash}
                              globalPolicyHash={selectedDevice.global_policy_hash}
                            />
                          ),
                        },
                      ]}
                    />
                  </section>

                  <Separator />

                  {/* Recent Executions */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" />
                      Recent Executions
                    </h3>
                    {execLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-8 w-full" />
                        ))}
                      </div>
                    ) : deviceExecutions.length === 0 ? (
                      <p className="text-xs text-gray-400">No executions recorded for this runtime.</p>
                    ) : (
                      <div className="border border-gray-100 rounded-md overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Execution</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500">Agent</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500">Status</th>
                              <th className="text-right px-3 py-2 font-medium text-gray-500">Duration</th>
                              <th className="text-right px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deviceExecutions.map((ex) => (
                              <tr
                                key={ex.execution_id}
                                className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                                onClick={() => router.push(`/execution/runs/${ex.execution_id}`)}
                              >
                                <td className="px-3 py-2 font-mono text-gray-600 whitespace-nowrap">
                                  {truncateText(ex.execution_id, 16)}
                                </td>
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{truncateText(ex.agent_id, 16)}</td>
                                <td className="px-3 py-2">
                                  <StatusBadge status={ex.status.toUpperCase()} />
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums text-gray-500 font-mono whitespace-nowrap">
                                  {formatDuration(ex.duration_ms)}
                                </td>
                                <td className="px-3 py-2 text-right text-gray-400 whitespace-nowrap">
                                  {getRelativeTime(ex.timestamp)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  <Separator />

                  {/* Violation History */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5" />
                      Violation History
                    </h3>
                    {violLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Skeleton key={i} className="h-8 w-full" />
                        ))}
                      </div>
                    ) : deviceViolations.length === 0 ? (
                      <p className="text-xs text-gray-400">No violations recorded for this runtime.</p>
                    ) : (
                      <div className="border border-gray-100 rounded-md overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Time</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500">Type</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500">Limit</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500">Observed</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Execution</th>
                            </tr>
                          </thead>
                          <tbody>
                            {deviceViolations.map((v, i) => (
                              <tr
                                key={i}
                                className="border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                                onClick={() =>
                                  router.push(`/proof/violations?execution_id=${v.execution_id}`)
                                }
                              >
                                <td className="px-3 py-2 text-gray-400 whitespace-nowrap">
                                  {getRelativeTime(v.timestamp)}
                                </td>
                                <td className="px-3 py-2 font-mono text-orange-700 whitespace-nowrap">
                                  {v.violation_type}
                                </td>
                                <td className="px-3 py-2 tabular-nums text-gray-500 whitespace-nowrap">
                                  {v.limit}
                                </td>
                                <td className="px-3 py-2 tabular-nums text-red-600 whitespace-nowrap">
                                  {v.observed}
                                </td>
                                <td className="px-3 py-2 font-mono text-gray-500 whitespace-nowrap">
                                  {truncateText(v.execution_id, 14)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  {/* Raw JSON */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Box className="h-3.5 w-3.5" />
                      Raw JSON
                    </h3>
                    <JSONViewer data={selectedDevice} defaultOpen={false} />
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
