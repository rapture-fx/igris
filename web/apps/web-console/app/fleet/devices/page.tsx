'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
}

interface ExecutionMini {
  execution_id: string;
  agent_id: string;
  model: string;
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

// ─── Mock Data ────────────────────────────────────────────────────────────────

const GLOBAL_POLICY_HASH = 'sha256:c4a2f1e8b9d3a7f6';

const MOCK_DEVICES: Device[] = [
  {
    device_id: 'dev_9f3a2c1b8e4d7f6a',
    status: 'online',
    runtime_version: 'igris-runtime/0.12.4',
    last_seen: new Date(Date.now() - 45_000).toISOString(),
    registration_time: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    license_id: 'lic_h7f3a2c1b8e',
    cpu_usage_percent: 23.4,
    memory_usage_mb: 512,
    active_executions: 3,
    executions_24h: 147,
    violations_24h: 0,
    last_execution_id: 'exec_4a7b8c9d0e1f2a3b',
    policy_hash: GLOBAL_POLICY_HASH,
    global_policy_hash: GLOBAL_POLICY_HASH,
  },
  {
    device_id: 'dev_a1b2c3d4e5f67890',
    status: 'online',
    runtime_version: 'igris-runtime/0.12.4',
    last_seen: new Date(Date.now() - 120_000).toISOString(),
    registration_time: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    license_id: 'lic_j9k2l3m4n5',
    cpu_usage_percent: 67.8,
    memory_usage_mb: 1024,
    active_executions: 7,
    executions_24h: 312,
    violations_24h: 3,
    last_execution_id: 'exec_b1c2d3e4f5a60001',
    policy_hash: 'sha256:stale_old_9xz1y2',
    global_policy_hash: GLOBAL_POLICY_HASH,
  },
  {
    device_id: 'dev_f7e8d9c0b1a2e3f4',
    status: 'online',
    runtime_version: 'igris-runtime/0.11.9',
    last_seen: new Date(Date.now() - 300_000).toISOString(),
    registration_time: new Date(Date.now() - 60 * 86_400_000).toISOString(),
    license_id: null,
    cpu_usage_percent: 5.1,
    memory_usage_mb: 256,
    active_executions: 0,
    executions_24h: 22,
    violations_24h: 8,
    last_execution_id: 'exec_c3d4e5f6a7b80002',
    policy_hash: 'sha256:legacy_hash_a4b5',
    global_policy_hash: GLOBAL_POLICY_HASH,
  },
  {
    device_id: 'dev_3b4c5d6e7f8a9b0c',
    status: 'offline',
    runtime_version: 'igris-runtime/0.12.3',
    last_seen: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    registration_time: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    license_id: 'lic_n5o6p7q8r9',
    cpu_usage_percent: 0,
    memory_usage_mb: 0,
    active_executions: 0,
    executions_24h: 89,
    violations_24h: 1,
    last_execution_id: 'exec_d5e6f7a8b9c00003',
    policy_hash: GLOBAL_POLICY_HASH,
    global_policy_hash: GLOBAL_POLICY_HASH,
  },
  {
    device_id: 'dev_5e6f7a8b9c0d1e2f',
    status: 'offline',
    runtime_version: 'igris-runtime/0.12.1',
    last_seen: new Date(Date.now() - 18 * 3_600_000).toISOString(),
    registration_time: new Date(Date.now() - 90 * 86_400_000).toISOString(),
    license_id: 'lic_s0t1u2v3w4',
    cpu_usage_percent: 0,
    memory_usage_mb: 0,
    active_executions: 0,
    executions_24h: 0,
    violations_24h: 0,
    last_execution_id: null,
    policy_hash: 'sha256:stale_old_e4f5g6h7',
    global_policy_hash: GLOBAL_POLICY_HASH,
  },
  {
    device_id: 'dev_c8d9e0f1a2b3c4d5',
    status: 'online',
    runtime_version: 'igris-runtime/0.12.4',
    last_seen: new Date(Date.now() - 15_000).toISOString(),
    registration_time: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    license_id: 'lic_x5y6z7a8b9',
    cpu_usage_percent: 41.2,
    memory_usage_mb: 768,
    active_executions: 2,
    executions_24h: 58,
    violations_24h: 2,
    last_execution_id: 'exec_e7f8a9b0c1d20004',
    policy_hash: GLOBAL_POLICY_HASH,
    global_policy_hash: GLOBAL_POLICY_HASH,
  },
];

const MOCK_STATS: DeviceStats = { executions_total: 628, violations_total: 14 };

const EXECUTION_MODELS = [
  'claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-opus-4-6', 'gpt-4o', 'gemini-1.5-pro',
];
const EXECUTION_STATUSES: ExecutionMini['status'][] = [
  'completed', 'completed', 'running', 'failed', 'completed', 'terminated',
];

function getMockExecutions(deviceId: string): ExecutionMini[] {
  return Array.from({ length: 8 }).map((_, i) => ({
    execution_id: `exec_${deviceId.slice(-6)}${i.toString().padStart(4, '0')}`,
    agent_id: `agent_${(i + 1).toString(16).padStart(6, '0')}`,
    model: EXECUTION_MODELS[i % EXECUTION_MODELS.length],
    status: EXECUTION_STATUSES[i % EXECUTION_STATUSES.length],
    duration_ms: 400 + Math.abs(Math.sin(i + 1) * 1600 | 0),
    timestamp: new Date(Date.now() - (i + 1) * 22 * 60_000).toISOString(),
  }));
}

const VIOLATION_TYPES = [
  'rate_limit_exceeded',
  'token_budget_exceeded',
  'model_not_allowed',
  'capability_violation',
  'context_length_exceeded',
];
const VIOLATION_LIMITS = ['100/min', '50k tokens', 'claude-opus-*', 'web_search', '128k tokens'];
const VIOLATION_OBSERVED = ['143/min', '72k tokens', 'claude-opus-4-6', 'web_search_active', '201k tokens'];

function getMockViolations(deviceId: string): ViolationMini[] {
  return Array.from({ length: 5 }).map((_, i) => ({
    timestamp: new Date(Date.now() - (i + 1) * 3 * 3_600_000).toISOString(),
    violation_type: VIOLATION_TYPES[i % VIOLATION_TYPES.length],
    limit: VIOLATION_LIMITS[i % VIOLATION_LIMITS.length],
    observed: VIOLATION_OBSERVED[i % VIOLATION_OBSERVED.length],
    execution_id: `exec_${deviceId.slice(-6)}vio${i}`,
  }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ViolationCountBadge({ count }: { count: number }) {
  if (count === 0) return <span className="text-xs text-gray-300">—</span>;
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FleetDevicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  // ── Devices list ──
  const { data: devices = [], isLoading: devicesLoading, refetch } = useQuery<Device[]>({
    queryKey: ['fleet-devices-v2'],
    queryFn: async () => {
      try {
        return await api.get<Device[]>('/devices');
      } catch {
        return MOCK_DEVICES;
      }
    },
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // ── 24h stats ──
  const { data: stats } = useQuery<DeviceStats>({
    queryKey: ['fleet-devices-stats', timeRange],
    queryFn: async () => {
      try {
        return await api.get<DeviceStats>(`/devices/stats?range=${timeRange}`);
      } catch {
        return MOCK_STATS;
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
  }>({
    queryKey: ['subscription-status'],
    queryFn: async () => {
      try {
        return await api.get('/api/subscription/status');
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

  // ── Device detail queries (enabled only when drawer open) ──
  const { data: deviceExecutions = [], isLoading: execLoading } = useQuery<ExecutionMini[]>({
    queryKey: ['device-executions', deviceFromUrl],
    enabled: !!deviceFromUrl,
    queryFn: async () => {
      try {
        return await api.get<ExecutionMini[]>(`/devices/${deviceFromUrl}/executions?limit=10`);
      } catch {
        return getMockExecutions(deviceFromUrl!);
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
        return getMockViolations(deviceFromUrl!);
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
    { label: 'Online', value: counts.online, icon: Wifi, color: 'text-green-600', pending: devicesLoading },
    { label: 'Offline', value: counts.offline, icon: WifiOff, color: 'text-gray-500', pending: devicesLoading },
    { label: 'Executions (24h)', value: stats?.executions_total ?? '—', icon: Activity, color: 'text-blue-600', pending: !stats },
    { label: 'Violations (24h)', value: stats?.violations_total ?? '—', icon: AlertTriangle, color: 'text-orange-600', pending: !stats },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Devices</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Distributed runtime nodes participating in governed execution.
            </p>
          </div>

          {runtimeQuota && (
            <div className="flex-shrink-0 min-w-[200px]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Runtime quota · {runtimeQuota.tier_name}
                </span>
                <span className="text-xs tabular-nums font-medium text-gray-900">
                  {runtimeQuota.runtimes.used} / {runtimeQuota.runtimes.limit}
                </span>
              </div>
              <Progress value={runtimeQuota.runtimes.percent} className="h-1.5" />
              {runtimeLimitReached && (
                <p className="text-[11px] text-red-600 mt-1.5">
                  Limit reached.{' '}
                  <Link href="/settings/billing" className="underline">
                    Upgrade to add more runtimes.
                  </Link>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_CARDS.map((c) => (
            <Card key={c.label} className="border border-gray-200 shadow-none">
              <CardHeader className="px-4 pt-3 pb-0">
                <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-1">
                {c.pending ? (
                  <Skeleton className="h-6 w-10" />
                ) : (
                  <span className="text-base font-semibold text-gray-900 tabular-nums">
                    {c.value}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search device_id…"
              className="pl-8 h-8 text-xs"
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
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 ml-auto"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        {/* Devices Table */}
        <Card className="border border-gray-200 shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Device ID', 'Status', 'Runtime', 'Last Seen', 'Exec (24h)', 'Violations', 'Policy Sync'].map((col) => (
                  <TableHead
                    key={col}
                    className="text-xs font-medium text-gray-500 h-9 px-3 bg-gray-50 hover:bg-gray-50"
                  >
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {devicesLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j} className="px-3 py-2.5">
                        <Skeleton className="h-3.5 w-16" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-14">
                    <div className="flex flex-col items-center gap-2.5 text-center">
                      <Server className="h-9 w-9 text-gray-200" />
                      <p className="text-xs text-gray-400">No runtime nodes registered yet.</p>
                      {runtimeLimitReached ? (
                        <div className="flex flex-col items-center gap-1">
                          <Button variant="outline" size="sm" className="h-7 text-xs mt-0.5" disabled>
                            Runtime limit reached
                          </Button>
                          <Link href="/settings/billing" className="text-[11px] text-blue-600 hover:text-blue-700">
                            Upgrade to add more runtimes
                          </Link>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="h-7 text-xs mt-0.5">
                          Register Runtime Node
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((device) => (
                  <TableRow
                    key={device.device_id}
                    className="cursor-pointer hover:bg-gray-50 border-b border-gray-100 transition-colors"
                    onClick={() => openDevice(device.device_id)}
                  >
                    <TableCell className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-gray-700">
                          {truncateText(device.device_id, 18)}
                        </span>
                        <CopyButton value={device.device_id} />
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <StatusBadge status={device.status.toUpperCase()} />
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-xs font-mono text-gray-600">
                      {device.runtime_version}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-xs text-gray-500">
                      {getRelativeTime(device.last_seen)}
                    </TableCell>
                    <TableCell className="px-3 py-2.5 text-xs tabular-nums text-gray-700">
                      {device.executions_24h}
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <ViolationCountBadge count={device.violations_24h} />
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <PolicySyncIndicator
                        policyHash={device.policy_hash}
                        globalPolicyHash={device.global_policy_hash}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* ── Device Detail Drawer ──────────────────────────────────────────────── */}
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

                  {/* Device Metadata */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Server className="h-3.5 w-3.5" />
                      Device Metadata
                    </h3>
                    <KeyValueGrid
                      rows={[
                        {
                          label: 'Device ID',
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
                      <p className="text-xs text-gray-400">No executions recorded for this device.</p>
                    ) : (
                      <div className="border border-gray-100 rounded-md overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                              <th className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">Execution</th>
                              <th className="text-left px-3 py-2 font-medium text-gray-500">Model</th>
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
                                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{ex.model}</td>
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
                      <p className="text-xs text-gray-400">No violations recorded for this device.</p>
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

                  <Separator />

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
