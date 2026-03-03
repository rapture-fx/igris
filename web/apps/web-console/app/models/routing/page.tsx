'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { Route, Cpu, TrendingUp, Clock, ArrowRight, RefreshCw, Eye } from 'lucide-react';

interface RoutingConfig {
  primary_provider: string;
  fallback_provider: string;
  success_rate_percent: number;
  avg_latency_ms: number;
  shadow_mode: boolean;
  rules: RoutingRule[];
  fallback_chain: FallbackStep[];
}

interface RoutingRule {
  id: string;
  name: string;
  condition: string;
  target_provider: string;
  priority: number;
  enabled: boolean;
}

interface FallbackStep {
  provider: string;
  order: number;
  condition: string;
  status: string;
}

export default function ModelsRoutingPage() {
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery<RoutingConfig>({
    queryKey: ['model-routing'],
    queryFn: () => api.get('/v1/model/routing'),
    retry: false,
  });

  const shadowMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.patch('/v1/model/routing', { shadow_mode: enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['model-routing'] }),
  });

  const STAT_CARDS = [
    {
      label: 'Primary Provider',
      value: config?.primary_provider ?? '—',
      icon: Cpu,
      color: 'text-blue-600',
      numeric: false,
    },
    {
      label: 'Fallback Provider',
      value: config?.fallback_provider ?? '—',
      icon: Route,
      color: 'text-gray-600',
      numeric: false,
    },
    {
      label: 'Success Rate',
      value: config?.success_rate_percent != null ? `${config.success_rate_percent.toFixed(1)}%` : '—',
      icon: TrendingUp,
      color: 'text-green-600',
      numeric: false,
    },
    {
      label: 'Avg Latency',
      value: config?.avg_latency_ms != null ? `${config.avg_latency_ms}ms` : '—',
      icon: Clock,
      color: 'text-violet-600',
      numeric: false,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Routing</h1>
          <p className="text-xs text-gray-500 mt-0.5">Model selection and fallback behavior.</p>
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
                {isLoading ? <Skeleton className="h-6 w-20" /> : (
                  <span className="text-base font-semibold text-gray-900">{c.value}</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Routing Rules */}
          <div className="xl:col-span-2">
            <Card className="border border-gray-200">
              <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-900">Routing Rules</CardTitle>
                <span className="text-xs text-gray-400">Priority order</span>
              </CardHeader>
              <Separator />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Enabled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (config?.rules ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-400 py-8">No routing rules configured</TableCell>
                    </TableRow>
                  ) : (
                    (config?.rules ?? []).map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="text-xs font-medium">{rule.name}</TableCell>
                        <TableCell className="text-xs text-gray-500">{rule.condition}</TableCell>
                        <TableCell>
                          <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                            {rule.target_provider}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-gray-500">{rule.priority}</TableCell>
                        <TableCell>
                          <StatusBadge status={rule.enabled ? 'ACTIVE' : 'INACTIVE'} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Shadow Mode */}
            <Card className="border border-gray-200">
              <CardHeader className="px-4 pt-4 pb-3">
                <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-gray-400" /> Shadow Mode
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-medium text-gray-700">Enable Shadow Mode</Label>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Mirror requests to fallback without affecting traffic
                    </p>
                  </div>
                  <Switch
                    checked={config?.shadow_mode ?? false}
                    onCheckedChange={(checked) => shadowMutation.mutate(checked)}
                    disabled={shadowMutation.isPending}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Fallback Chain */}
            <Card className="border border-gray-200">
              <CardHeader className="px-4 pt-4 pb-3">
                <CardTitle className="text-sm font-medium text-gray-900">Fallback Chain</CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="px-4 py-4">
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : (config?.fallback_chain ?? []).length === 0 ? (
                  <p className="text-xs text-gray-400">No fallback chain configured</p>
                ) : (
                  <div className="space-y-2">
                    {(config?.fallback_chain ?? []).map((step, i) => (
                      <div key={step.provider} className="flex items-center gap-2">
                        {i > 0 && (
                          <div className="absolute -mt-2 ml-4">
                            <ArrowRight className="h-3 w-3 text-gray-300" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 p-2 rounded-md border border-gray-100 bg-gray-50 flex-1">
                          <span className="text-xs text-gray-400 w-4">{step.order}.</span>
                          <span className="text-xs font-medium text-gray-700">{step.provider}</span>
                          <StatusBadge status={step.status} className="ml-auto" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
