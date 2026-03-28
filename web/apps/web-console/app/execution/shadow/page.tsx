'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/apiClient';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Moon, RefreshCw, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

interface ShadowTrace {
  id: string;
  agent_id: string;
  real_execution_id: string;
  shadow_execution_id: string;
  timestamp: string;
  real: {
    status: string;
    duration_ms: number;
    violations: number;
    output_preview?: string;
    model: string;
  };
  shadow: {
    status: string;
    duration_ms: number;
    violations: number;
    output_preview?: string;
    model: string;
  };
  divergence_score?: number;
}

interface AgentOption {
  id: string;
  namespace: string;
}

function DivergenceBadge({ score }: { score: number | undefined }) {
  if (score == null) return <span className="text-xs text-gray-300">—</span>;
  const pct = Math.round(score * 100);
  const cls = score < 0.1
    ? 'bg-green-50 text-green-700 border-green-200'
    : score < 0.3
    ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-700 border-red-200';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {pct}% divergence
    </span>
  );
}

function TraceColumn({ label, data, isReal }: {
  label: string;
  data: ShadowTrace['real'] | ShadowTrace['shadow'];
  isReal: boolean;
}) {
  return (
    <div className={`flex-1 rounded-md border p-3 ${isReal ? 'border-gray-200 bg-white' : 'border-purple-100 bg-purple-50'}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wide mb-2 ${isReal ? 'text-gray-500' : 'text-purple-600'}`}>
        {label}
      </p>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Status</span>
          <span className={`font-medium ${data.status === 'completed' ? 'text-green-700' : data.status === 'failed' ? 'text-red-700' : 'text-gray-700'}`}>
            {data.status}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Duration</span>
          <span className="font-mono text-gray-700">
            {data.duration_ms < 1000 ? `${data.duration_ms}ms` : `${(data.duration_ms / 1000).toFixed(2)}s`}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Violations</span>
          <span className={`font-mono ${data.violations > 0 ? 'text-red-700' : 'text-gray-700'}`}>
            {data.violations}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Model</span>
          <span className="font-mono text-gray-600 truncate max-w-[100px]">{data.model}</span>
        </div>
        {data.output_preview && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 mb-1">Output Preview</p>
            <p className="text-[11px] text-gray-600 leading-relaxed line-clamp-3">{data.output_preview}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShadowComparisonPage() {
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');

  const { data: agents = [] } = useQuery<AgentOption[]>({
    queryKey: ['agents-for-shadow'],
    queryFn: async () => {
      try {
        const list = await api.get<{ id: string; namespace: string; shadow_mode?: boolean }[]>('/v1/execution/agents');
        return list.filter((a) => a.shadow_mode);
      } catch { return []; }
    },
    staleTime: 60_000,
    retry: false,
  });

  const { data: traces = [], isLoading, refetch, isFetching } = useQuery<ShadowTrace[]>({
    queryKey: ['shadow-traces', selectedAgent, timeRange],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ range: timeRange });
        if (selectedAgent !== 'all') params.set('agent_id', selectedAgent);
        return await api.get<ShadowTrace[]>(`/v1/execution/shadow?${params}`);
      } catch { return []; }
    },
    staleTime: 30_000,
    retry: false,
  });

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Moon className="h-4 w-4 text-purple-500" />
              Shadow Mode Comparison
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Side-by-side comparison of shadow vs enforced traces for the same agent and time window.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="h-8 w-48 text-xs">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All shadow agents</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id} className="text-xs">
                  {a.namespace ?? truncateText(a.id, 18)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h" className="text-xs">Last 1h</SelectItem>
              <SelectItem value="24h" className="text-xs">Last 24h</SelectItem>
              <SelectItem value="7d" className="text-xs">Last 7d</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Traces */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="border border-gray-200 shadow-none">
                <CardContent className="p-4">
                  <Skeleton className="h-32 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : traces.length === 0 ? (
          <Card className="border border-gray-200 shadow-none">
            <CardContent className="py-16 text-center">
              <Moon className="h-10 w-10 text-purple-200 mx-auto mb-3" />
              <p className="text-xs text-gray-400">No shadow traces found for the selected filters.</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Enable Shadow Mode on an agent to start collecting comparison data.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {traces.map((trace) => (
              <Card key={trace.id} className="border border-gray-200 shadow-none">
                <CardHeader className="px-4 pt-3 pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-500">{truncateText(trace.agent_id, 18)}</span>
                      <span className="text-[10px] text-gray-400">{getRelativeTime(trace.timestamp)}</span>
                    </div>
                    <DivergenceBadge score={trace.divergence_score} />
                  </div>
                </CardHeader>
                <Separator />
                <CardContent className="px-4 py-3">
                  <div className="flex items-stretch gap-3">
                    <TraceColumn label="Real (Enforced)" data={trace.real} isReal={true} />
                    <div className="flex items-center flex-shrink-0">
                      <ArrowRight className="h-4 w-4 text-gray-300" />
                    </div>
                    <TraceColumn label="Shadow (Observed)" data={trace.shadow} isReal={false} />
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-[10px] text-gray-400">
                    <span className="font-mono">real: {truncateText(trace.real_execution_id, 14)}</span>
                    <span>·</span>
                    <span className="font-mono">shadow: {truncateText(trace.shadow_execution_id, 14)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
