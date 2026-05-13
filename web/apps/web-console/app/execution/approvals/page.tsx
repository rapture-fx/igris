'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/apiClient';
import { toast } from '@/components/ui/use-toast';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import { Clock, CheckCircle2, AlertTriangle, RefreshCw, ChevronDown, ChevronRight, GitBranch } from 'lucide-react';

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => api.post(`/v1/execution/runs/${id}/approve`, {})));
    },
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ['paused-runs'] });
      setSelectedIds(new Set());
      toast({ title: `${ids.length} runs approved`, description: 'Executions will resume.' });
    },
    onError: () => toast({ title: 'Bulk approve failed', variant: 'destructive' }),
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => api.post(`/v1/execution/runs/${id}/reject`, { reason: 'human_rejected' })));
    },
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ['paused-runs'] });
      setSelectedIds(new Set());
      toast({ title: `${ids.length} runs rejected`, description: 'Executions have been terminated.' });
    },
    onError: () => toast({ title: 'Bulk reject failed', variant: 'destructive' }),
  });

  const isPending = approveMutation.isPending || rejectMutation.isPending ||
    bulkApproveMutation.isPending || bulkRejectMutation.isPending;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(selectedIds.size === runs.length ? new Set() : new Set(runs.map((r) => r.id)));
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <h1 className="text-base font-semibold text-foreground">Human-in-the-Loop Approvals</h1>

        {/* ── Approvals Card ──────────────────────────────────────────────── */}
        <div className="border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">Pending Approvals</span>
              {!isLoading && runs.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200">
                  <Clock className="h-2.5 w-2.5" />
                  {runs.length} waiting
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => bulkApproveMutation.mutate(Array.from(selectedIds))}
                    disabled={bulkApproveMutation.isPending}
                  >
                    Approve All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => bulkRejectMutation.mutate(Array.from(selectedIds))}
                    disabled={bulkRejectMutation.isPending}
                  >
                    <UserX className="h-3 w-3" />
                    Reject All
                  </Button>
                </>
              )}
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
          </div>

          <div className="bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white border-b border-black/[0.08] dark:border-white/[0.08]">
                    <th className="w-10 px-4 py-2.5 text-left">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === runs.length && runs.length > 0}
                        onChange={selectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    {['Run ID', 'Agent', 'Paused', 'Reason / Model', 'BT Node', 'Prompt Preview', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="bg-white border-b border-black/[0.08] dark:border-white/[0.08]">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <Skeleton className="h-3.5 w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : runs.length === 0 ? (
                    <tr className="bg-white">
                      <td colSpan={8} className="py-16 text-center">
                        <CheckCircle2 className="h-8 w-8 text-green-300 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">No runs pending approval.</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Use &ldquo;Pause for Approval&rdquo; in an agent drawer to create a review checkpoint.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    runs.map((run) => (
                      <tr key={run.id} className="bg-white border-b border-black/[0.08] dark:border-white/[0.08] hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(run.id)}
                            onChange={() => toggleSelect(run.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">
                          {truncateText(run.id, 16)}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-muted-foreground">{truncateText(run.agent_id, 14)}</p>
                            {run.namespace && (
                              <p className="text-[10px] text-muted-foreground">{run.namespace}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {getRelativeTime(run.paused_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {run.pause_reason ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200">
                                {run.pause_reason === 'hitl' ? 'HitL' : run.pause_reason}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                            {run.model && (
                              <div>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-white text-muted-foreground border border-black/[0.08] dark:border-white/[0.08]">
                                  {run.model}
                                </span>
                              </div>
                            )}
                            {run.violation_type && (
                              <div>
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-50 text-red-600 border border-red-200">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  {run.violation_type}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {run.bt_node_name ? (
                            <div className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <div>
                                <p className="text-muted-foreground">{run.bt_node_name}</p>
                                {run.bt_node_type && (
                                  <p className="text-[9px] text-muted-foreground font-mono">{run.bt_node_type}</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-[220px]">
                          {run.prompt_preview ? (
                            <button
                              type="button"
                              onClick={() => setExpandedPrompt(expandedPrompt === run.id ? null : run.id)}
                              className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground text-left"
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
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
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
                              className="h-7 text-[11px] gap-1 border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => rejectMutation.mutate(run.id)}
                              disabled={isPending}
                            >
                              <UserX className="h-3 w-3" />
                              Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!isLoading && (
              <div className="px-4 py-3">
                <span className="text-xs text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  Approval actions are logged to the tamper-evident execution ledger.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
