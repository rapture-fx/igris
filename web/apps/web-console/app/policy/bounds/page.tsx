'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { getRelativeTime, formatDateTime, truncateText } from '@/utils/helpers';
import { CopyButton } from '@/components/execution/shared';
import { toast } from '@/components/ui/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Save, RefreshCw, CheckCircle, History, Cpu, RotateCcw, Zap, Shield, Brain,
  type LucideIcon,
} from 'lucide-react';

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

interface AgentSummary { id: string; namespace: string; state: string; }

const EXECUTION_FIELDS = [
  { key: 'max_execution_ms' as const, label: 'Max Execution Duration', unit: 'ms', description: 'Maximum total runtime of a single execution.', min: 1_000, max: 600_000 },
  { key: 'max_tick_ms' as const, label: 'Max Tick Duration', unit: 'ms', description: 'Maximum time allowed for a single runtime tick.', min: 100, max: 60_000 },
  { key: 'max_steps' as const, label: 'Max Execution Steps', unit: 'steps', description: 'Maximum number of steps an execution may perform.', min: 1, max: 10_000 },
];

const RESOURCE_NUMBER_FIELDS = [
  { key: 'memory_mb' as const, label: 'Memory Limit', unit: 'MB', description: 'Maximum memory allocated per execution.', min: 64, max: 65_536 },
  { key: 'disk_write_mb' as const, label: 'Disk Write Limit', unit: 'MB', description: 'Maximum disk write allowed per execution.', min: 0, max: 10_240 },
];

function SurfaceSection({
  icon: Icon,
  title,
  actions,
  bodyClassName = 'px-4 py-4',
  className = '',
  children,
}: {
  icon: LucideIcon;
  title: string;
  actions?: ReactNode;
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white ${className}`}>
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-xs font-medium text-foreground">{title}</p>
        </div>
        {actions}
      </div>
      <div className={`bg-white ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}

function FieldCard({
  label,
  unit,
  description,
  children,
  range,
}: {
  label: string;
  unit: string;
  description: string;
  children: ReactNode;
  range?: string;
}) {
  return (
    <div className="rounded-lg border-[0.5px] border-black/[0.08] dark:border-white/[0.08] bg-white px-3 py-3 space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label className="text-xs font-medium text-foreground">{label}</Label>
        <span className="text-[10px] text-muted-foreground">{unit}</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
      {children}
      {range && (
        <p className="text-[10px] text-muted-foreground font-mono tabular-nums">{range}</p>
      )}
    </div>
  );
}

export default function PolicyBoundsPage() {
  const qc = useQueryClient();
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());

  const { data: agents = [] } = useQuery<AgentSummary[]>({
    queryKey: ['agents-for-policy'],
    queryFn: async () => {
      try { return await api.get<AgentSummary[]>('/v1/execution/agents'); }
      catch { return []; }
    },
    staleTime: 60_000,
    retry: false,
  });

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

  const assignMutation = useMutation({
    mutationFn: (agentIds: string[]) =>
      api.post('/v1/policies/assign', { agent_ids: agentIds, policy_hash: form.policy_hash }),
    onSuccess: () => {
      toast({ title: 'Policy applied', description: `Applied to ${selectedAgentIds.size} agent(s).` });
      setSelectedAgentIds(new Set());
    },
    onError: () => {
      toast({ title: 'Failed to apply', description: 'Could not assign policy to agents.', variant: 'destructive' });
    },
  });

  const toggleAgent = (id: string) =>
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
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
      <div className="space-y-5">
        <div className="flex items-center justify-end gap-4">
          {isDirty && (
            <span className="text-[11px] text-yellow-600 bg-yellow-50 px-2.5 py-1 rounded-full border border-yellow-200 whitespace-nowrap">
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
            {savedIndicator
              ? <><CheckCircle className="h-3.5 w-3.5" /> Saved</>
              : mutation.isPending
              ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving…</>
              : <><Save className="h-3.5 w-3.5" /> Save Changes</>}
          </Button>
        </div>

        {mutation.isError && (
          <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3 text-xs text-red-600">
            Failed to save policy changes. Try again.
          </div>
        )}

        <SurfaceSection
          icon={Zap}
          title="Execution Limits"
        >
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {EXECUTION_FIELDS.map((f) => (
                <FieldCard
                  key={f.key}
                  label={f.label}
                  unit={f.unit}
                  description={f.description}
                  range={`${f.min.toLocaleString()} – ${f.max.toLocaleString()}`}
                >
                  <Input
                    type="number" min={f.min} max={f.max}
                    value={form[f.key]}
                    onChange={(e) => set(f.key, Number(e.target.value))}
                    className="h-8 text-xs font-mono bg-background"
                  />
                </FieldCard>
              ))}
            </div>
          )}
        </SurfaceSection>

        <SurfaceSection
          icon={Cpu}
          title="Resource Limits"
        >
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 rounded-lg" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-24 rounded-lg" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border-[0.5px] border-black/[0.08] dark:border-white/[0.08] bg-white px-3 py-3 space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label className="text-xs font-medium text-foreground">CPU Limit</Label>
                  <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
                    {form.cpu_percent}%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Maximum CPU usage permitted per execution.
                </p>
                <Slider
                  min={1} max={100} step={1}
                  value={[form.cpu_percent]}
                  onValueChange={([v]) => set('cpu_percent', v)}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono tabular-nums">
                  <span>1%</span><span>100%</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {RESOURCE_NUMBER_FIELDS.map((f) => (
                  <FieldCard
                    key={f.key}
                    label={f.label}
                    unit={f.unit}
                    description={f.description}
                    range={`${f.min.toLocaleString()} – ${f.max.toLocaleString()}`}
                  >
                    <Input
                      type="number" min={f.min} max={f.max}
                      value={form[f.key]}
                      onChange={(e) => set(f.key, Number(e.target.value))}
                      className="h-8 text-xs font-mono bg-background"
                    />
                  </FieldCard>
                ))}
              </div>
            </div>
          )}
        </SurfaceSection>

        <SurfaceSection
          icon={Shield}
          title="Policy Version"
        >
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          ) : displayBounds.policy_hash ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border-[0.5px] border-black/[0.08] dark:border-white/[0.08] bg-white px-3 py-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Policy Hash</p>
                <div className="flex items-center gap-1.5">
                  <code className="text-xs font-mono text-foreground truncate">
                    {truncateText(displayBounds.policy_hash, 26)}
                  </code>
                  <CopyButton value={displayBounds.policy_hash} />
                </div>
              </div>
              <div className="rounded-lg border-[0.5px] border-black/[0.08] dark:border-white/[0.08] bg-white px-3 py-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Last Updated</p>
                <p className="text-xs text-foreground">{formatDateTime(displayBounds.updated_at)}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-black/[0.08] dark:border-white/[0.08] bg-white px-4 py-5 text-center">
              <p className="text-xs text-muted-foreground">No policy saved yet. Configure bounds above and save.</p>
            </div>
          )}
        </SurfaceSection>

        <SurfaceSection
          icon={Brain}
          title="Apply to Agents"
        >
          {agents.length === 0 ? (
            <div className="rounded-lg border border-dashed border-black/[0.08] dark:border-white/[0.08] bg-white px-4 py-5 text-center">
              <p className="text-xs text-muted-foreground">No agents registered. Deploy a runtime to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border-[0.5px] border-black/[0.08] dark:border-white/[0.08] bg-white divide-y divide-black/[0.08] dark:divide-white/[0.08] max-h-52 overflow-y-auto">
                {agents.map((agent) => (
                  <div key={agent.id} className="flex items-center gap-2.5 px-3 py-2.5">
                    <Checkbox
                      id={`agent-${agent.id}`}
                      checked={selectedAgentIds.has(agent.id)}
                      onCheckedChange={() => toggleAgent(agent.id)}
                    />
                    <label htmlFor={`agent-${agent.id}`} className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground truncate">{agent.id}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{agent.namespace}</span>
                      <span className={`ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${
                        agent.state === 'RUNNING' || agent.state === 'ACTIVE'
                          ? 'bg-green-50 text-green-600 border-green-200'
                          : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}>{agent.state}</span>
                    </label>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  {selectedAgentIds.size > 0 ? `${selectedAgentIds.size} selected` : 'Select agents above'}
                </span>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  disabled={selectedAgentIds.size === 0 || !displayBounds.policy_hash || assignMutation.isPending}
                  onClick={() => assignMutation.mutate(Array.from(selectedAgentIds))}
                >
                  {assignMutation.isPending
                    ? <><RefreshCw className="h-3 w-3 animate-spin" /> Applying…</>
                    : <><CheckCircle className="h-3 w-3" /> Apply to Selected</>}
                </Button>
              </div>
            </div>
          )}
        </SurfaceSection>

        <SurfaceSection
          icon={History}
          title="Policy History"
          bodyClassName="px-4 py-4"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-white">
                  {['Timestamp', 'Hash', 'Changed By', 'Summary'].map((col) => (
                    <TableHead key={col} className="text-xs font-medium text-muted-foreground h-9 px-4 bg-white uppercase tracking-wide">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow className="bg-white">
                    <TableCell colSpan={4} className="px-4 py-10 text-center text-xs text-muted-foreground">
                      No policy changes recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((entry) => (
                    <TableRow key={entry.id} className="bg-white border-b border-black/[0.08] dark:border-white/[0.08] hover:bg-gray-50">
                      <TableCell className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {getRelativeTime(entry.timestamp)}
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-black/[0.08] dark:border-white/[0.08]">
                            {truncateText(entry.policy_hash, 14)}
                          </code>
                          <CopyButton value={entry.policy_hash} />
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {entry.changed_by}
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-xs text-muted-foreground max-w-[240px]">
                        <span className="line-clamp-2">{entry.change_summary}</span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SurfaceSection>
      </div>
    </DashboardLayout>
  );
}
