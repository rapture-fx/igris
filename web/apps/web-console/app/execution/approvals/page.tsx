'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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
    <DashboardLayout fullWidth>
      <div className="space-y-6 flex-1 flex flex-col min-h-0">
        {/* ── Approvals Card ──────────────────────────────────────────────── */}
        <div className="border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white flex-1 flex flex-col min-h-0">
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
                    className="h-7 text-xs"
                    onClick={() => bulkRejectMutation.mutate(Array.from(selectedIds))}
                    disabled={bulkRejectMutation.isPending}
                  >
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

          <div className="bg-white overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-auto">
              <Table className="w-full table-fixed">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-white border-b border-black/[0.08] dark:border-white/[0.08] hover:bg-white">
                    <TableHead className="w-10 px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === runs.length && runs.length > 0}
                        onChange={selectAll}
                        className="rounded border-gray-300"
                      />
                    </TableHead>
                    <TableHead className="w-[140px] px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide whitespace-nowrap">Run ID</TableHead>
                    <TableHead className="w-[140px] px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide whitespace-nowrap">Agent</TableHead>
                    <TableHead className="w-[100px] px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide whitespace-nowrap">Paused</TableHead>
                    <TableHead className="w-[140px] px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide whitespace-nowrap">Reason / Model</TableHead>
                    <TableHead className="w-[140px] px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide whitespace-nowrap">BT Node</TableHead>
                    <TableHead className="px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide">Prompt Preview</TableHead>
                    <TableHead className="w-[120px] px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i} className="bg-white border-b border-black/[0.08] dark:border-white/[0.08]">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <TableCell key={j} className="px-4 py-3">
                            <Skeleton className="h-3.5 w-20" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : runs.length === 0 ? (
                    <TableRow className="bg-white">
                      <TableCell colSpan={8} className="py-16 text-center">
                        <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                        <p className="text-xs text-foreground">No runs pending approval.</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Use &ldquo;Pause for Approval&rdquo; in an agent drawer to create a review checkpoint.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    runs.map((run) => (
                      <TableRow key={run.id} className="bg-white border-b border-black/[0.08] dark:border-white/[0.08] hover:bg-gray-50 transition-colors">
                        <TableCell className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(run.id)}
                            onChange={() => toggleSelect(run.id)}
                            className="rounded border-gray-300"
                          />
                        </TableCell>
                        <TableCell className="px-4 py-3 font-mono text-foreground">
                          {truncateText(run.id, 16)}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div>
                            <p className="text-foreground">{truncateText(run.agent_id, 14)}</p>
                            {run.namespace && (
                              <p className="text-[10px] text-muted-foreground">{run.namespace}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-foreground whitespace-nowrap">
                          {getRelativeTime(run.paused_at)}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="space-y-1">
                            {run.pause_reason ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200">
                                {run.pause_reason === 'hitl' ? 'HitL' : run.pause_reason}
                              </span>
                            ) : (
                              <span className="text-foreground">—</span>
                            )}
                            {run.model && (
                              <div>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-white text-foreground border border-black/[0.08] dark:border-white/[0.08]">
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
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {run.bt_node_name ? (
                            <div className="flex items-center gap-1">
                              <GitBranch className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <div>
                                <p className="text-foreground">{run.bt_node_name}</p>
                                {run.bt_node_type && (
                                  <p className="text-[9px] text-muted-foreground font-mono">{run.bt_node_type}</p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 max-w-[220px]">
                          {run.prompt_preview ? (
                            <button
                              type="button"
                              onClick={() => setExpandedPrompt(expandedPrompt === run.id ? null : run.id)}
                              className="flex items-center gap-0.5 text-foreground hover:text-foreground/80 text-left"
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
                            <span className="text-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              onClick={() => approveMutation.mutate(run.id)}
                              disabled={isPending}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              onClick={() => rejectMutation.mutate(run.id)}
                              disabled={isPending}
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
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
