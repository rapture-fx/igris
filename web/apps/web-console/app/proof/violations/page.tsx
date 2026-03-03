'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import { AlertTriangle, Clock, Server, Brain, Search, RefreshCw, Download } from 'lucide-react';

interface Violation {
  id: string;
  timestamp: string;
  kind: string;
  agent_id: string;
  device_id: string;
  limit_value: number | string;
  observed_value: number | string;
  unit?: string;
}

const KIND_OPTIONS = ['all', 'CPU_LIMIT', 'MEMORY_LIMIT', 'QUOTA_EXCEEDED', 'TICK_TIMEOUT', 'CAPABILITY_DENIED'];

export default function ProofViolationsPage() {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('all');

  const { data: violations = [], isLoading, refetch } = useQuery<Violation[]>({
    queryKey: ['proof-violations'],
    queryFn: () => api.get('/v1/proof/violations?limit=200&sort=timestamp:desc'),
    retry: false,
  });

  const filtered = useMemo(() =>
    violations.filter((v) => {
      const matchSearch =
        !search ||
        v.agent_id.toLowerCase().includes(search.toLowerCase()) ||
        v.device_id?.toLowerCase().includes(search.toLowerCase()) ||
        v.kind.toLowerCase().includes(search.toLowerCase());
      const matchKind = kindFilter === 'all' || v.kind === kindFilter;
      return matchSearch && matchKind;
    }), [violations, search, kindFilter]);

  const now = Date.now();
  const last24h = violations.filter(
    (v) => now - new Date(v.timestamp).getTime() < 86400000
  ).length;

  const byDevice = useMemo(() => {
    const map: Record<string, number> = {};
    violations.forEach((v) => { map[v.device_id] = (map[v.device_id] ?? 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0];
  }, [violations]);

  const byAgent = useMemo(() => {
    const map: Record<string, number> = {};
    violations.forEach((v) => { map[v.agent_id] = (map[v.agent_id] ?? 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0];
  }, [violations]);

  const STAT_CARDS = [
    { label: 'Total', value: violations.length, icon: AlertTriangle, color: 'text-orange-600', sub: 'All time' },
    { label: 'Last 24h', value: last24h, icon: Clock, color: 'text-red-600', sub: 'Recent' },
    { label: 'Top Device', value: byDevice ? `${truncateText(byDevice[0], 12)} (${byDevice[1]})` : '—', icon: Server, color: 'text-gray-600', sub: 'Most violations', text: true },
    { label: 'Top Agent', value: byAgent ? `${truncateText(byAgent[0], 12)} (${byAgent[1]})` : '—', icon: Brain, color: 'text-violet-600', sub: 'Most violations', text: true },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Violations</h1>
          <p className="text-xs text-gray-500 mt-0.5">Policy enforcement events.</p>
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
                {isLoading ? <Skeleton className="h-6 w-12" /> : (
                  (c as any).text ? (
                    <span className="text-sm font-medium text-gray-800 font-mono">{c.value}</span>
                  ) : (
                    <span className="text-base font-semibold text-gray-900 tabular-nums">{c.value}</span>
                  )
                )}
                <p className="text-[11px] text-gray-400 mt-0.5">{c.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="Search by agent, device, kind..."
              className="pl-8 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Kind" />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((k) => (
                <SelectItem key={k} value={k} className="text-xs">{k === 'all' ? 'All kinds' : k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>

        {/* Table */}
        <Card className="border border-gray-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Limit</TableHead>
                <TableHead>Observed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-12">No violations found</TableCell>
                </TableRow>
              ) : (
                filtered.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-xs text-gray-500">{getRelativeTime(v.timestamp)}</TableCell>
                    <TableCell>
                      <span className="text-xs font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                        {v.kind}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-gray-600">{truncateText(v.agent_id, 14)}</TableCell>
                    <TableCell className="text-xs font-mono text-gray-600">{truncateText(v.device_id, 12)}</TableCell>
                    <TableCell className="text-xs tabular-nums text-gray-500">
                      {v.limit_value}{v.unit ? ` ${v.unit}` : ''}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-red-600 font-medium">
                      {v.observed_value}{v.unit ? ` ${v.unit}` : ''}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
