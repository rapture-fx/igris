'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { api } from '@/lib/apiClient';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import {
  CloudCog, CheckCircle, XCircle, AlertTriangle, RefreshCw,
  ChevronRight, TrendingUp, Clock, Zap, KeyRound, Activity,
} from 'lucide-react';

interface Provider {
  id: string;
  name: string;
  kind: string;
  status: string;
  endpoint?: string;
  model_count: number;
  request_count_24h: number;
  error_rate_percent: number;
  avg_latency_ms: number;
  last_checked_at?: string;
  api_key_masked?: string;
  supported_models?: string[];
  health?: {
    latency_ms: number;
    status: string;
    checked_at: string;
  };
}

export default function ModelsProvidersPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Provider | null>(null);

  const { data: providers = [], isLoading, refetch } = useQuery<Provider[]>({
    queryKey: ['model-providers'],
    queryFn: () => api.get('/v1/model/providers'),
    retry: false,
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post(`/v1/model/providers/${id}/test`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['model-providers'] }),
  });

  const counts = {
    active: providers.filter((p) => p.status === 'ONLINE' || p.status === 'ACTIVE').length,
    errored: providers.filter((p) => p.status === 'ERROR' || p.status === 'OFFLINE').length,
    totalRequests: providers.reduce((s, p) => s + (p.request_count_24h ?? 0), 0),
  };

  const STAT_CARDS = [
    { label: 'Active', value: counts.active, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Errored', value: counts.errored, icon: XCircle, color: 'text-red-600' },
    { label: 'Requests (24h)', value: counts.totalRequests, icon: Activity, color: 'text-blue-600' },
    { label: 'Providers', value: providers.length, icon: CloudCog, color: 'text-gray-600' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Providers</h1>
            <p className="text-xs text-gray-500 mt-0.5">Model inference providers and health status.</p>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
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

        {/* Provider Table */}
        <Card className="border border-gray-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Models</TableHead>
                <TableHead>Requests (24h)</TableHead>
                <TableHead>Avg Latency</TableHead>
                <TableHead>Error Rate</TableHead>
                <TableHead>Last Checked</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : providers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-400 py-12">
                    No providers configured
                  </TableCell>
                </TableRow>
              ) : (
                providers.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelected(p)}>
                    <TableCell className="text-xs font-medium text-gray-800">{p.name}</TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200">
                        {p.kind}
                      </span>
                    </TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-xs tabular-nums text-gray-600">{p.model_count ?? 0}</TableCell>
                    <TableCell className="text-xs tabular-nums text-gray-600">{(p.request_count_24h ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-xs tabular-nums text-gray-600">
                      {p.avg_latency_ms != null ? `${p.avg_latency_ms}ms` : '—'}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      <span className={p.error_rate_percent > 5 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        {p.error_rate_percent != null ? `${p.error_rate_percent.toFixed(1)}%` : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {p.last_checked_at ? getRelativeTime(p.last_checked_at) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={(e) => { e.stopPropagation(); testMutation.mutate(p.id); }}
                          disabled={testMutation.isPending}
                        >
                          Test
                        </Button>
                        <ChevronRight className="h-4 w-4 text-gray-300 ml-1" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Provider Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="text-sm font-semibold">Provider Detail</SheetTitle>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{selected.id}</p>
              </SheetHeader>
              <Separator />

              <div className="space-y-5 mt-4">
                {/* Basic Info */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <CloudCog className="h-3.5 w-3.5" /> Provider Info
                  </h3>
                  <dl className="space-y-2">
                    {[
                      ['Name', selected.name],
                      ['Kind', selected.kind],
                      ['Status', null],
                      ['Endpoint', selected.endpoint ?? '—'],
                      ['API Key', selected.api_key_masked ?? '—'],
                    ].map(([label, value]) => (
                      <div key={label as string} className="flex items-start justify-between gap-4">
                        <dt className="text-xs text-gray-500 flex-shrink-0 w-20">{label}</dt>
                        <dd className="text-xs text-gray-800 text-right break-all">
                          {label === 'Status' ? (
                            <StatusBadge status={selected.status} />
                          ) : label === 'Endpoint' || label === 'API Key' ? (
                            <span className="font-mono">{value as string}</span>
                          ) : (
                            value as string
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <Separator />

                {/* Health */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" /> Health
                  </h3>
                  {selected.health ? (
                    <dl className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Status</span>
                        <StatusBadge status={selected.health.status} />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Latency</span>
                        <span className="text-gray-800 tabular-nums">{selected.health.latency_ms}ms</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Checked</span>
                        <span className="text-gray-500">{getRelativeTime(selected.health.checked_at)}</span>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-xs text-gray-400">No health data</p>
                  )}
                </section>

                <Separator />

                {/* Supported Models */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" /> Supported Models
                  </h3>
                  {(selected.supported_models ?? []).length === 0 ? (
                    <p className="text-xs text-gray-400">No models listed</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(selected.supported_models ?? []).map((m) => (
                        <span key={m} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-md border border-gray-200">
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
