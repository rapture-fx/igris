'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/apiClient';
import { getRelativeTime, formatDuration, truncateText } from '@/utils/helpers';
import {
  Play, CheckCircle, XCircle, AlertTriangle,
  Search, RefreshCw, Download, ChevronRight, FileText, Shield, Cpu, Terminal, Hash,
} from 'lucide-react';

interface Execution {
  id: string;
  agent_id: string;
  model: string;
  device_id: string;
  started_at: string;
  ended_at?: string;
  duration_ms?: number;
  status: string;
  has_violation: boolean;
  receipt_id?: string;
  policy_snapshot?: Record<string, any>;
  capability_snapshot?: Record<string, any>;
  logs?: string[];
  receipt_signature?: string;
}

const STATUS_FILTER_OPTIONS = ['all', 'RUNNING', 'COMPLETED', 'ERROR', 'VIOLATION'];

export default function ExecutionRunsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Execution | null>(null);

  const { data: runs = [], isLoading, refetch } = useQuery<Execution[]>({
    queryKey: ['execution-runs'],
    queryFn: () => api.get('/v1/execution/runs?limit=100&sort=created_at:desc'),
    retry: false,
  });

  const filtered = useMemo(() => {
    return runs.filter((r) => {
      const matchSearch =
        !search ||
        r.id.toLowerCase().includes(search.toLowerCase()) ||
        r.agent_id.toLowerCase().includes(search.toLowerCase()) ||
        r.device_id?.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === 'all' ||
        r.status === statusFilter ||
        (statusFilter === 'VIOLATION' && r.has_violation);
      return matchSearch && matchStatus;
    });
  }, [runs, search, statusFilter]);

  const counts = useMemo(() => ({
    running: runs.filter((r) => r.status === 'RUNNING').length,
    completed: runs.filter((r) => r.status === 'COMPLETED').length,
    errored: runs.filter((r) => r.status === 'ERROR').length,
    violated: runs.filter((r) => r.has_violation).length,
  }), [runs]);

  const STAT_CARDS = [
    { label: 'Running', value: counts.running, icon: Play, color: 'text-blue-600' },
    { label: 'Completed', value: counts.completed, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Errored', value: counts.errored, icon: XCircle, color: 'text-red-600' },
    { label: 'Violated', value: counts.violated, icon: AlertTriangle, color: 'text-orange-600' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-base font-semibold text-gray-900">Executions</h1>
          <p className="text-xs text-gray-500 mt-0.5">All governed execution runs.</p>
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
                {isLoading ? (
                  <Skeleton className="h-6 w-10" />
                ) : (
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
              placeholder="Search by ID, agent, device..."
              className="pl-8 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_FILTER_OPTIONS.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">{s === 'all' ? 'All statuses' : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {/* Table */}
        <Card className="border border-gray-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Execution ID</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Violation</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-400 py-12">
                    No executions found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((run) => (
                  <TableRow
                    key={run.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(run)}
                  >
                    <TableCell className="font-mono text-xs text-gray-600">{truncateText(run.id, 12)}</TableCell>
                    <TableCell className="text-xs">{truncateText(run.agent_id, 16)}</TableCell>
                    <TableCell className="text-xs text-gray-600">{run.model ?? '—'}</TableCell>
                    <TableCell className="text-xs text-gray-600">{truncateText(run.device_id, 12)}</TableCell>
                    <TableCell className="text-xs text-gray-500">{getRelativeTime(run.started_at)}</TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {run.duration_ms != null ? formatDuration(run.duration_ms / 1000) : '—'}
                    </TableCell>
                    <TableCell><StatusBadge status={run.status} /></TableCell>
                    <TableCell>
                      {run.has_violation ? <StatusBadge status="VIOLATION" /> : <span className="text-xs text-gray-300">—</span>}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-gray-300" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="text-sm font-semibold">Execution Detail</SheetTitle>
                <p className="text-xs font-mono text-gray-500 mt-0.5">{selected.id}</p>
              </SheetHeader>
              <Separator />

              <div className="space-y-5 mt-4">
                {/* Metadata */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Execution Metadata
                  </h3>
                  <dl className="space-y-2">
                    {[
                      ['Agent', selected.agent_id],
                      ['Model', selected.model ?? '—'],
                      ['Device', selected.device_id],
                      ['Status', null],
                      ['Started', selected.started_at ? getRelativeTime(selected.started_at) : '—'],
                      ['Duration', selected.duration_ms != null ? formatDuration(selected.duration_ms / 1000) : '—'],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex items-start justify-between gap-4">
                        <dt className="text-xs text-gray-500 flex-shrink-0 w-20">{label}</dt>
                        <dd className="text-xs text-gray-800 font-mono break-all text-right">
                          {label === 'Status' ? <StatusBadge status={selected.status} /> : (value as string)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <Separator />

                {/* Policy Snapshot */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" /> Policy Snapshot
                  </h3>
                  <pre className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-md p-3 overflow-auto max-h-32">
                    {selected.policy_snapshot ? JSON.stringify(selected.policy_snapshot, null, 2) : 'No snapshot available'}
                  </pre>
                </section>

                <Separator />

                {/* Capability Snapshot */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5" /> Capability Snapshot
                  </h3>
                  <pre className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-md p-3 overflow-auto max-h-32">
                    {selected.capability_snapshot ? JSON.stringify(selected.capability_snapshot, null, 2) : 'No snapshot available'}
                  </pre>
                </section>

                <Separator />

                {/* Logs */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5" /> Logs
                  </h3>
                  <div className="bg-gray-900 rounded-md p-3 max-h-48 overflow-auto">
                    {(selected.logs ?? []).length === 0 ? (
                      <p className="text-[11px] text-gray-500">No log entries</p>
                    ) : (
                      (selected.logs ?? []).map((line, i) => (
                        <p key={i} className="text-[11px] text-gray-300 font-mono leading-relaxed">{line}</p>
                      ))
                    )}
                  </div>
                </section>

                <Separator />

                {/* Receipt Signature */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5" /> Receipt Signature
                  </h3>
                  <p className="text-[11px] font-mono text-gray-600 break-all bg-gray-50 border border-gray-100 rounded-md p-3">
                    {selected.receipt_signature ?? 'No receipt signature'}
                  </p>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
