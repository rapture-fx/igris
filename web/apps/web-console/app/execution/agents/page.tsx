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
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import {
  Brain, Activity, Moon, Shield, AlertTriangle,
  Search, RefreshCw, ChevronRight, Layers, History, Cpu,
} from 'lucide-react';

interface Agent {
  id: string;
  namespace: string;
  state: string;
  last_run_at?: string;
  violation_count: number;
  capabilities: string[];
  lifecycle_history?: Array<{ state: string; timestamp: string }>;
  recent_executions?: Array<{ id: string; status: string; started_at: string }>;
  policy_bounds?: Record<string, any>;
}

export default function ExecutionAgentsPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Agent | null>(null);

  const { data: agents = [], isLoading, refetch } = useQuery<Agent[]>({
    queryKey: ['execution-agents'],
    queryFn: () => api.get('/v1/execution/agents'),
    retry: false,
  });

  const filtered = useMemo(() =>
    agents.filter((a) =>
      !search ||
      a.id.toLowerCase().includes(search.toLowerCase()) ||
      a.namespace?.toLowerCase().includes(search.toLowerCase())
    ), [agents, search]);

  const counts = useMemo(() => ({
    active: agents.filter((a) => a.state === 'RUNNING' || a.state === 'ACTIVE').length,
    idle: agents.filter((a) => a.state === 'IDLE').length,
    safeIdle: agents.filter((a) => a.state === 'SAFE_IDLE').length,
    recovering: agents.filter((a) => a.state === 'RECOVERING').length,
  }), [agents]);

  const STAT_CARDS = [
    { label: 'Active', value: counts.active, icon: Brain, color: 'text-green-600' },
    { label: 'Idle', value: counts.idle, icon: Moon, color: 'text-gray-500' },
    { label: 'Safe Idle', value: counts.safeIdle, icon: Shield, color: 'text-blue-600' },
    { label: 'Recovering', value: counts.recovering, icon: Activity, color: 'text-yellow-600' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Agents</h1>
          <p className="text-xs text-gray-500 mt-0.5">Runtime agents and lifecycle state.</p>
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
                  <span className="text-xl font-semibold text-gray-900 tabular-nums">{c.value}</span>
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
              placeholder="Search by ID or namespace..."
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
                <TableHead>Agent ID</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Violations</TableHead>
                <TableHead>Capabilities</TableHead>
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
                  <TableCell colSpan={7} className="text-center text-gray-400 py-12">No agents found</TableCell>
                </TableRow>
              ) : (
                filtered.map((agent) => (
                  <TableRow key={agent.id} className="cursor-pointer" onClick={() => setSelected(agent)}>
                    <TableCell className="font-mono text-xs text-gray-600">{truncateText(agent.id, 14)}</TableCell>
                    <TableCell className="text-xs">{agent.namespace ?? '—'}</TableCell>
                    <TableCell><StatusBadge status={agent.state} /></TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {agent.last_run_at ? getRelativeTime(agent.last_run_at) : '—'}
                    </TableCell>
                    <TableCell>
                      {agent.violation_count > 0 ? (
                        <Badge variant="destructive" className="text-xs">{agent.violation_count}</Badge>
                      ) : (
                        <span className="text-xs text-gray-300">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(agent.capabilities ?? []).slice(0, 3).map((cap) => (
                          <span key={cap} className="inline-block text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {cap}
                          </span>
                        ))}
                        {(agent.capabilities ?? []).length > 3 && (
                          <span className="text-[10px] text-gray-400">+{(agent.capabilities ?? []).length - 3}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell><ChevronRight className="h-4 w-4 text-gray-300" /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Agent Detail Drawer */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="text-sm font-semibold">Agent Detail</SheetTitle>
                <p className="text-xs font-mono text-gray-500 mt-0.5">{selected.id}</p>
              </SheetHeader>
              <Separator />

              <div className="space-y-5 mt-4">
                {/* State Summary */}
                <div className="flex items-center gap-3">
                  <StatusBadge status={selected.state} />
                  <span className="text-xs text-gray-500">{selected.namespace ?? 'default'}</span>
                </div>

                {/* Lifecycle History */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5" /> Lifecycle History
                  </h3>
                  {(selected.lifecycle_history ?? []).length === 0 ? (
                    <p className="text-xs text-gray-400">No history available</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(selected.lifecycle_history ?? []).slice(0, 8).map((e, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <StatusBadge status={e.state} />
                          <span className="text-gray-400">{getRelativeTime(e.timestamp)}</span>
                        </div>
                      ))}
                    </div>
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
                          <span className="font-mono text-gray-600">{truncateText(ex.id, 14)}</span>
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

                {/* Capabilities */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5" /> Capabilities
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(selected.capabilities ?? []).length === 0 ? (
                      <p className="text-xs text-gray-400">None configured</p>
                    ) : (
                      (selected.capabilities ?? []).map((cap) => (
                        <span key={cap} className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-md border border-gray-200">
                          {cap}
                        </span>
                      ))
                    )}
                  </div>
                </section>

                <Separator />

                {/* Policy Bounds */}
                <section>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" /> Policy Bounds
                  </h3>
                  <pre className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 rounded-md p-3 overflow-auto max-h-32">
                    {selected.policy_bounds ? JSON.stringify(selected.policy_bounds, null, 2) : 'No bounds configured'}
                  </pre>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
