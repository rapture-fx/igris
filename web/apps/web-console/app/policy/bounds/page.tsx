'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { getRelativeTime, formatDateTime, truncateText } from '@/utils/helpers';
import { CopyButton } from '@/components/execution/shared';
import {
  Save, RefreshCw, CheckCircle, History, Cpu, RotateCcw, Zap, Shield,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PolicyBounds {
  max_execution_ms: number;
  max_tick_ms: number;
  max_steps: number;
  cpu_percent: number;
  memory_mb: number;
  disk_write_mb: number;
  policy_hash: string;
  updated_at: string;
}

interface PolicyHistoryEntry {
  id: string;
  timestamp: string;
  policy_hash: string;
  changed_by: string;
  change_summary: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_BOUNDS: PolicyBounds = {
  max_execution_ms: 30_000,
  max_tick_ms: 5_000,
  max_steps: 100,
  cpu_percent: 80,
  memory_mb: 512,
  disk_write_mb: 256,
  policy_hash: 'sha256:c4a2f1e8b9d3a7f6e2c5d8b1a0f3e4d7',
  updated_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
};

const MOCK_HISTORY: PolicyHistoryEntry[] = [
  {
    id: '3',
    timestamp: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    policy_hash: 'sha256:c4a2f1e8b9d3a7f6e2c5d8b1a0f3e4d7',
    changed_by: 'admin@acme.io',
    change_summary: 'max_execution_ms 20000 → 30000',
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    policy_hash: 'sha256:b3e1d9c8a7f6e5d4c3b2a1f0e9d8c7b6',
    changed_by: 'admin@acme.io',
    change_summary: 'cpu_percent 70 → 80, memory_mb 256 → 512',
  },
  {
    id: '1',
    timestamp: new Date(Date.now() - 21 * 86_400_000).toISOString(),
    policy_hash: 'sha256:a2d0c8b7f6e5d4c3b2a1f0e9d8c7b6a5',
    changed_by: 'system',
    change_summary: 'Initial policy created',
  },
];

// ─── Field Configs ────────────────────────────────────────────────────────────

const EXECUTION_FIELDS = [
  { key: 'max_execution_ms' as const, label: 'Max Execution Duration', unit: 'ms', description: 'Maximum total runtime of a single execution.', min: 1_000, max: 600_000 },
  { key: 'max_tick_ms' as const, label: 'Max Tick Duration', unit: 'ms', description: 'Maximum time allowed for a single runtime tick.', min: 100, max: 60_000 },
  { key: 'max_steps' as const, label: 'Max Execution Steps', unit: 'steps', description: 'Maximum number of steps an execution may perform.', min: 1, max: 10_000 },
];

const RESOURCE_NUMBER_FIELDS = [
  { key: 'memory_mb' as const, label: 'Memory Limit', unit: 'MB', description: 'Maximum memory allocated per execution.', min: 64, max: 65_536 },
  { key: 'disk_write_mb' as const, label: 'Disk Write Limit', unit: 'MB', description: 'Maximum disk write allowed per execution.', min: 0, max: 10_240 },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PolicyBoundsPage() {
  const qc = useQueryClient();
  const EMPTY_BOUNDS: PolicyBounds = {
    max_execution_ms: 30_000,
    max_tick_ms: 5_000,
    max_steps: 100,
    cpu_percent: 80,
    memory_mb: 512,
    disk_write_mb: 256,
    policy_hash: '',
    updated_at: new Date().toISOString(),
  };
  const [form, setForm] = useState<PolicyBounds>(EMPTY_BOUNDS);
  const [savedIndicator, setSavedIndicator] = useState(false);

  const { data: serverBounds, isLoading } = useQuery<PolicyBounds>({
    queryKey: ['policy-bounds-v2'],
    queryFn: async () => {
      try { return await api.get<PolicyBounds>('/policy/bounds'); }
      catch { return null as unknown as PolicyBounds; }
    },
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const { data: history = [] } = useQuery<PolicyHistoryEntry[]>({
    queryKey: ['policy-history'],
    queryFn: async () => {
      try { return await api.get<PolicyHistoryEntry[]>('/policy/history'); }
      catch { return [] as PolicyHistoryEntry[]; }
    },
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => { if (serverBounds) setForm(serverBounds); }, [serverBounds]);

  const mutation = useMutation({
    mutationFn: (data: PolicyBounds) => api.post('/policy/bounds', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy-bounds-v2'] });
      qc.invalidateQueries({ queryKey: ['policy-history'] });
      setSavedIndicator(true);
      setTimeout(() => setSavedIndicator(false), 2000);
    },
  });

  const set = <K extends keyof PolicyBounds>(key: K, value: PolicyBounds[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const isDirty = useMemo(() => {
    if (!serverBounds) return false;
    const keys = ['max_execution_ms', 'max_tick_ms', 'max_steps', 'cpu_percent', 'memory_mb', 'disk_write_mb'] as const;
    return keys.some((k) => form[k] !== serverBounds[k]);
  }, [form, serverBounds]);

  const displayBounds = serverBounds ?? EMPTY_BOUNDS;

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-2xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Execution Bounds</h1>
            <p className="text-xs text-gray-500 mt-0.5">System limits enforced during runtime execution.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isDirty && (
              <span className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded-md border border-yellow-200 whitespace-nowrap">
                Unsaved changes
              </span>
            )}
            <Button
              variant="outline" size="sm" className="h-8 text-xs gap-1.5"
              onClick={() => serverBounds && setForm(serverBounds)}
              disabled={!isDirty}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
            <Button
              size="sm" className="h-8 text-xs gap-1.5"
              onClick={() => mutation.mutate(form)}
              disabled={!isDirty || mutation.isPending}
            >
              {savedIndicator ? <><CheckCircle className="h-3.5 w-3.5" /> Saved</>
                : mutation.isPending ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                : <><Save className="h-3.5 w-3.5" /> Save Changes</>}
            </Button>
          </div>
        </div>

        {/* Execution Limits */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-gray-400" /> Execution Limits
            </CardTitle>
            <p className="text-xs text-gray-400 mt-1">Limits applied to each individual execution run.</p>
          </CardHeader>
          <Separator />
          <CardContent className="px-5 py-5">
            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-32" /><Skeleton className="h-3 w-44" /><Skeleton className="h-8 w-full mt-1" />
                    </div>
                  ))
                : EXECUTION_FIELDS.map((f) => (
                    <div key={f.key}>
                      <div className="flex items-baseline justify-between mb-0.5">
                        <Label className="text-xs font-medium text-gray-700">{f.label}</Label>
                        <span className="text-xs text-gray-400">{f.unit}</span>
                      </div>
                      <p className="text-xs text-gray-400 mb-2 leading-relaxed">{f.description}</p>
                      <Input
                        type="number" min={f.min} max={f.max}
                        value={form[f.key]}
                        onChange={(e) => set(f.key, Number(e.target.value))}
                        className="h-8 text-xs font-mono"
                      />
                      <p className="text-[10px] text-gray-300 font-mono mt-1 tabular-nums">
                        {f.min.toLocaleString()} – {f.max.toLocaleString()}
                      </p>
                    </div>
                  ))}
            </div>
          </CardContent>
        </Card>

        {/* Resource Limits */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-gray-400" /> Resource Limits
            </CardTitle>
            <p className="text-xs text-gray-400 mt-1">System resource constraints enforced per execution.</p>
          </CardHeader>
          <Separator />
          <CardContent className="px-5 py-5 space-y-5">
            {isLoading ? (
              <>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-48" /><Skeleton className="h-4 w-full mt-2" />
                </div>
                <div className="grid grid-cols-2 gap-x-8">
                  {[0, 1].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-40" /><Skeleton className="h-8 w-full mt-1" />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* CPU Slider */}
                <div>
                  <div className="flex items-baseline justify-between mb-0.5">
                    <Label className="text-xs font-medium text-gray-700">CPU Limit</Label>
                    <span className="text-sm font-mono font-semibold text-gray-900 tabular-nums">
                      {form.cpu_percent}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                    Maximum CPU usage permitted per execution.
                  </p>
                  <Slider
                    min={1} max={100} step={1}
                    value={[form.cpu_percent]}
                    onValueChange={([v]) => set('cpu_percent', v)}
                  />
                  <div className="flex justify-between text-[10px] text-gray-300 font-mono mt-1.5 tabular-nums">
                    <span>1%</span><span>100%</span>
                  </div>
                </div>
                {/* Memory + Disk */}
                <div className="grid grid-cols-2 gap-x-8">
                  {RESOURCE_NUMBER_FIELDS.map((f) => (
                    <div key={f.key}>
                      <div className="flex items-baseline justify-between mb-0.5">
                        <Label className="text-xs font-medium text-gray-700">{f.label}</Label>
                        <span className="text-xs text-gray-400">{f.unit}</span>
                      </div>
                      <p className="text-xs text-gray-400 mb-2 leading-relaxed">{f.description}</p>
                      <Input
                        type="number" min={f.min} max={f.max}
                        value={form[f.key]}
                        onChange={(e) => set(f.key, Number(e.target.value))}
                        className="h-8 text-xs font-mono"
                      />
                      <p className="text-[10px] text-gray-300 font-mono mt-1 tabular-nums">
                        {f.min.toLocaleString()} – {f.max.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Policy Version */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-gray-400" /> Policy Version
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="px-5 py-4">
            {isLoading ? (
              <dl className="grid grid-cols-[140px_1fr] gap-x-6 gap-y-3">
                <Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-56" />
                <Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-36" />
              </dl>
            ) : displayBounds.policy_hash ? (
              <dl className="grid grid-cols-[140px_1fr] gap-x-6 gap-y-3">
                <dt className="text-xs text-gray-500 flex items-start pt-0.5">Policy Hash</dt>
                <dd className="flex items-center gap-1.5">
                  <Badge variant="outline" className="font-mono text-xs px-2 py-0.5 tracking-tight border-gray-200">
                    {truncateText(displayBounds.policy_hash, 26)}
                  </Badge>
                  <CopyButton value={displayBounds.policy_hash} />
                </dd>
                <dt className="text-xs text-gray-500 flex items-start pt-0.5">Last Updated</dt>
                <dd className="text-xs text-gray-700">{formatDateTime(displayBounds.updated_at)}</dd>
              </dl>
            ) : (
              <p className="text-xs text-gray-400">No policy saved yet. Configure bounds above and save.</p>
            )}
          </CardContent>
        </Card>

        {/* Policy History */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <History className="h-4 w-4 text-gray-400" /> Policy History
            </CardTitle>
          </CardHeader>
          <Separator />
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Timestamp', 'Hash', 'Changed By', 'Summary'].map((col) => (
                  <TableHead key={col} className="text-xs font-medium text-gray-500 h-9 px-5 bg-gray-50 hover:bg-gray-50">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-xs text-gray-400 py-10">
                    No policy changes recorded.
                  </TableCell>
                </TableRow>
              ) : history.map((entry) => (
                <TableRow key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <TableCell className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {getRelativeTime(entry.timestamp)}
                  </TableCell>
                  <TableCell className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="font-mono text-xs px-2 py-0 border-gray-200">
                        {truncateText(entry.policy_hash, 14)}
                      </Badge>
                      <CopyButton value={entry.policy_hash} />
                    </div>
                  </TableCell>
                  <TableCell className="px-5 py-3 text-xs text-gray-600 whitespace-nowrap">
                    {entry.changed_by}
                  </TableCell>
                  <TableCell className="px-5 py-3 text-xs text-gray-500 max-w-[240px]">
                    <span className="line-clamp-2">{entry.change_summary}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {mutation.isError && (
          <p className="text-xs text-red-600">Failed to save policy changes. Try again.</p>
        )}
      </div>
    </DashboardLayout>
  );
}
