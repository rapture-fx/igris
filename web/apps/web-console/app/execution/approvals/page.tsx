'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/apiClient';
import { toast } from '@/components/ui/use-toast';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { UserCheck, UserX, Clock, CheckCircle2, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, GitBranch } from 'lucide-react';

interface PausedRun {
  id: string;
  agent_id: string;
  namespace?: string;
  paused_at: string;
  pause_reason?: string;
  prompt_preview?: string;
  model?: string;
  bt_node_name?: string;
  bt_node_type?: string;
  violation_type?: string;
}

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

  const { data: runs = [], isLoading, refetch, isFetching } = useQuery<PausedRun[]>({
    queryKey: ['paused-runs'],
    queryFn: async () => {
      try {
        return await api.get<PausedRun[]>('/v1/execution/runs?status=PAUSED');
      } catch {
        return [];
      }
    },
    refetchInterval: 10_000,
    retry: false,
  });

  const approveMutation = useMutation({
    mutationFn: (runId: string) =>
      api.post(`/v1/execution/runs/${runId}/approve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paused-runs'] });
      toast({ title: 'Run approved', description: 'Execution will resume.' });
    },
    onError: () => toast({ title: 'Approve failed', variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: (runId: string) =>
      api.post(`/v1/execution/runs/${runId}/reject`, { reason: 'human_rejected' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paused-runs'] });
      toast({ title: 'Run rejected', description: 'Execution has been terminated.' });
    },
    onError: () => toast({ title: 'Reject failed', variant: 'destructive' }),
  });

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-5xl">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-amber-500" />
              Human-in-the-Loop Approvals
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Execution runs paused awaiting human review. Approve to resume, reject to terminate.
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

        {/* Pending count badge */}
        {!isLoading && runs.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-md">
            <Clock className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
            <span className="text-xs text-amber-700 font-medium">
              {runs.length} run{runs.length !== 1 ? 's' : ''} awaiting approval
            </span>
          </div>
        )}

        {/* Table */}
        <Card className="border border-gray-200 shadow-none overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Run ID', 'Agent', 'Paused', 'Reason / Model', 'BT Node', 'Prompt Preview', 'Actions'].map((h) => (
                  <TableHead key={h} className="text-xs font-medium text-gray-500 h-9 px-4 bg-gray-50">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j} className="px-4 py-3">
                        <Skeleton className="h-3.5 w-20" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">No runs pending approval.</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Use &ldquo;Pause for Approval&rdquo; in an agent drawer to create a review checkpoint.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow key={run.id} className="border-b border-gray-100">
                    <TableCell className="px-4 py-3 text-xs font-mono text-gray-700">
                      {truncateText(run.id, 16)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div>
                        <p className="text-xs text-gray-700">{truncateText(run.agent_id, 14)}</p>
                        {run.namespace && (
                          <p className="text-[10px] text-gray-400">{run.namespace}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {getRelativeTime(run.paused_at)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="space-y-1">
                        {run.pause_reason ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            {run.pause_reason === 'hitl' ? 'HitL' : run.pause_reason}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                        {run.model && (
                          <div>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-gray-50 text-gray-600 border border-gray-200">
                              {run.model}
                            </span>
                          </div>
                        )}
                        {run.violation_type && (
                          <div>
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-50 text-red-700 border border-red-200">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {run.violation_type}
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      {run.bt_node_name ? (
                        <div className="flex items-center gap-1">
                          <GitBranch className="h-3 w-3 text-gray-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-700">{run.bt_node_name}</p>
                            {run.bt_node_type && (
                              <p className="text-[9px] text-gray-400 font-mono">{run.bt_node_type}</p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 max-w-[220px]">
                      {run.prompt_preview ? (
                        <div>
                          <button
                            type="button"
                            onClick={() => setExpandedPrompt(expandedPrompt === run.id ? null : run.id)}
                            className="flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-800 text-left"
                          >
                            {expandedPrompt === run.id
                              ? <ChevronDown className="h-3 w-3 flex-shrink-0" />
                              : <ChevronRight className="h-3 w-3 flex-shrink-0" />}
                            <span className={expandedPrompt === run.id ? '' : 'truncate'}>
                              {expandedPrompt === run.id
                                ? run.prompt_preview
                                : `${run.prompt_preview.slice(0, 55)}${run.prompt_preview.length > 55 ? '…' : ''}`}
                            </span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="h-7 text-[11px] gap-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => approveMutation.mutate(run.id)}
                          disabled={isPending}
                        >
                          <UserCheck className="h-3 w-3" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1 border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => rejectMutation.mutate(run.id)}
                          disabled={isPending}
                        >
                          <UserX className="h-3 w-3" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Info footer */}
        <div className="px-1">
          <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            Approval actions are logged to the tamper-evident execution ledger.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
