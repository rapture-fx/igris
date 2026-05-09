'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { useVaultKeys } from '@/hooks/useVault';
import { getRelativeTime } from '@/utils/helpers';
import {
  CloudCog, CheckCircle, XCircle, Plus, MoreHorizontal, Pencil,
  Trash2, PowerOff, Power, RefreshCw, Activity,
  type LucideIcon,
} from 'lucide-react';

interface Provider {
  id: string;
  name: string;
  kind: string;
  status: 'active' | 'disabled' | 'error';
  endpoint: string;
  default_model: string;
  key_id: string | null;
  models_available: number;
  latency_ms: number | null;
  success_rate: number | null;
  last_checked_at: string;
}

interface ProviderForm {
  kind: string;
  key_id: string;
  endpoint: string;
  default_model: string;
}

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'groq', label: 'Groq' },
  { value: 'xai', label: 'xAI' },
  { value: 'qwen', label: 'Qwen' },
  { value: 'kimi', label: 'Kimi' },
  { value: 'glm', label: 'GLM' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'google_gemini', label: 'Google Gemini' },
  { value: 'custom', label: 'Custom OpenAI-compatible' },
  { value: 'local', label: 'Local (GGUF)' },
];

const EMPTY_FORM: ProviderForm = { kind: '', key_id: '', endpoint: '', default_model: '' };

function LatencyCell({ ms }: { ms: number | null }) {
  if (ms === null) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = ms < 300 ? 'text-green-600' : ms < 600 ? 'text-yellow-600' : 'text-red-600';
  return <span className={`text-xs font-mono tabular-nums ${cls}`}>{ms}ms</span>;
}

function SuccessRateCell({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = rate >= 98 ? 'text-green-600' : rate >= 90 ? 'text-yellow-600' : 'text-red-600';
  return <span className={`text-xs font-mono tabular-nums ${cls}`}>{rate.toFixed(1)}%</span>;
}

function OverviewCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white">
      <div className="px-4 pt-4 pb-2 text-xs font-medium text-foreground flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
        {label}
      </div>
      <div className="bg-white px-4 pt-4 pb-5">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-3xl font-bold text-foreground tabular-nums">{value}</div>
        )}
      </div>
    </div>
  );
}

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

export default function ModelsProvidersPage() {
  const qc = useQueryClient();
  const { data: vaultKeys = [] } = useVaultKeys();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Provider | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null);
  const [form, setForm] = useState<ProviderForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const { data: providers = [], isLoading, refetch } = useQuery<Provider[]>({
    queryKey: ['model-providers-v2'],
    queryFn: async () => {
      try {
        const res = await api.get<{ providers: Provider[] } | Provider[]>('/models/providers');
        return Array.isArray(res) ? res : (res as { providers: Provider[] }).providers ?? [];
      } catch { return [] as Provider[]; }
    },
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const addMutation = useMutation({
    mutationFn: (data: ProviderForm) => api.post('/models/providers', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['model-providers-v2'] }); closeDialog(); },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProviderForm }) =>
      api.put(`/models/providers/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['model-providers-v2'] }); closeDialog(); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'disabled' }) =>
      api.put(`/models/providers/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['model-providers-v2'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/models/providers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['model-providers-v2'] }); setDeleteTarget(null); },
  });

  const openAdd = () => { setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setDialogOpen(true); };
  const openEdit = (p: Provider) => {
    setEditTarget(p);
    setForm({ kind: p.kind, key_id: p.key_id ?? '', endpoint: p.endpoint, default_model: p.default_model });
    setFormError('');
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditTarget(null); };

  const handleSubmit = () => {
    if (!form.kind) { setFormError('Select a provider type.'); return; }
    if (!form.key_id) { setFormError('Select a key reference from the vault.'); return; }
    setFormError('');
    if (editTarget) {
      editMutation.mutate({ id: editTarget.id, data: form });
    } else {
      addMutation.mutate(form);
    }
  };

  const counts = useMemo(() => ({
    active: providers.filter((p) => p.status === 'active').length,
    error: providers.filter((p) => p.status === 'error').length,
    totalModels: providers.reduce((s, p) => s + (p.models_available ?? 0), 0),
    avgLatency: (() => {
      const valid = providers.filter((p) => p.latency_ms !== null);
      if (!valid.length) return null;
      return Math.round(valid.reduce((s, p) => s + p.latency_ms!, 0) / valid.length);
    })(),
  }), [providers]);

  const isPending = addMutation.isPending || editMutation.isPending;
  const relevantKeys = form.kind ? vaultKeys.filter((k) => k.provider === form.kind) : vaultKeys;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-base font-semibold text-foreground">Model Providers</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" /> Add Provider
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <OverviewCard
            icon={CheckCircle}
            label="Active"
            value={counts.active}
            loading={isLoading}
          />
          <OverviewCard
            icon={XCircle}
            label="Errors"
            value={counts.error}
            loading={isLoading}
          />
          <OverviewCard
            icon={CloudCog}
            label="Models Available"
            value={counts.totalModels}
            loading={isLoading}
          />
          <OverviewCard
            icon={Activity}
            label="Avg Latency"
            value={counts.avgLatency !== null ? `${counts.avgLatency}ms` : '—'}
            loading={isLoading}
          />
        </div>

        <SurfaceSection
          icon={CloudCog}
          title="Configured Providers"
          actions={
            providers.length > 0 ? (
              <span className="text-[11px] text-muted-foreground">{providers.length} configured</span>
            ) : undefined
          }
          bodyClassName="px-0 py-0"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-white">
                  {['Provider', 'Status', 'Key Reference', 'Models', 'Latency', 'Success Rate', 'Last Checked', ''].map((col) => (
                    <TableHead key={col} className="text-xs font-medium text-muted-foreground uppercase tracking-wide h-9 px-4 bg-white border-b border-black/[0.08] dark:border-white/[0.08]">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="bg-white">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j} className="px-4 py-3">
                          <Skeleton className="h-3.5 w-16" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : providers.length === 0 ? (
                  <TableRow className="bg-white">
                    <TableCell colSpan={8} className="px-4 py-10 text-center">
                      <div className="flex flex-col items-center gap-2.5">
                        <CloudCog className="h-7 w-7 text-gray-200" />
                        <p className="text-xs text-muted-foreground">No providers configured.</p>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 mt-0.5" onClick={openAdd}>
                          <Plus className="h-3.5 w-3.5" /> Add Provider
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  providers.map((p) => {
                    const linkedKey = vaultKeys.find((k) => k.id === p.key_id);
                    return (
                      <TableRow key={p.id} className="border-b border-black/[0.08] dark:border-white/[0.08] hover:bg-gray-50 bg-white">
                        <TableCell className="px-4 py-2.5">
                          <p className="text-xs font-medium text-foreground">{p.name}</p>
                        </TableCell>
                        <TableCell className="px-4 py-2.5">
                          <StatusBadge status={p.status === 'active' ? 'ACTIVE' : p.status === 'error' ? 'ERROR' : 'INACTIVE'} />
                        </TableCell>
                        <TableCell className="px-4 py-2.5">
                          {linkedKey ? (
                            <span className="text-xs text-muted-foreground font-mono">
                              {linkedKey.key_name} · <span className="text-gray-400">{linkedKey.masked_key}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600">No key linked</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-foreground">{p.models_available}</TableCell>
                        <TableCell className="px-4 py-2.5"><LatencyCell ms={p.latency_ms} /></TableCell>
                        <TableCell className="px-4 py-2.5"><SuccessRateCell rate={p.success_rate} /></TableCell>
                        <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">{getRelativeTime(p.last_checked_at)}</TableCell>
                        <TableCell className="px-4 py-2.5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem className="text-xs gap-2 cursor-pointer" onClick={() => openEdit(p)}>
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-xs gap-2 cursor-pointer"
                                onClick={() => toggleMutation.mutate({
                                  id: p.id,
                                  status: p.status === 'disabled' ? 'active' : 'disabled',
                                })}
                              >
                                {p.status === 'disabled'
                                  ? <><Power className="h-3.5 w-3.5 text-muted-foreground" /> Enable</>
                                  : <><PowerOff className="h-3.5 w-3.5 text-muted-foreground" /> Disable</>}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-xs gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                                onClick={() => setDeleteTarget(p)}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </SurfaceSection>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              {editTarget ? 'Edit Provider' : 'Add Provider'}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              {editTarget
                ? `Update configuration for ${editTarget.name}.`
                : 'Connect a new AI provider for routing.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Provider</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm((f) => ({ ...f, kind: v, key_id: '' }))}
                disabled={!!editTarget}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select provider…" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Key Reference</Label>
              <Select
                value={form.key_id}
                onValueChange={(v) => setForm((f) => ({ ...f, key_id: v }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select vault key…" />
                </SelectTrigger>
                <SelectContent>
                  {relevantKeys.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-gray-400 text-center">
                      No keys for this provider.{' '}
                      <Link href="/settings/keys" className="underline">Add one in Settings → Keys</Link>
                    </div>
                  ) : (
                    relevantKeys.map((k) => (
                      <SelectItem key={k.id} value={k.id} className="text-xs">
                        {k.key_name} · <span className="text-gray-400">{k.masked_key}</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-[9px] text-gray-400">
                Keys are managed in{' '}
                <Link href="/settings/keys" className="underline underline-offset-1">Settings → Keys</Link>.
                Raw API keys are never stored here.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">
                Endpoint <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                placeholder="https://api.example.com/v1"
                className="h-8 text-xs font-mono"
                value={form.endpoint}
                onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">
                Default Model <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                placeholder="gpt-4o"
                className="h-8 text-xs font-mono"
                value={form.default_model}
                onChange={(e) => setForm((f) => ({ ...f, default_model: e.target.value }))}
              />
            </div>

            {formError && <p className="text-xs text-red-600">{formError}</p>}
            {(addMutation.isError || editMutation.isError) && (
              <p className="text-xs text-red-600">Failed to save. Try again.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={closeDialog}>Cancel</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleSubmit} disabled={isPending}>
              {isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              {editTarget ? 'Save Changes' : 'Add Provider'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Delete Provider</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Remove <span className="font-medium text-gray-700">{deleteTarget?.name}</span> from your
              provider list. Routing rules pointing to this provider will stop working.
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.isError && (
            <p className="text-xs text-red-600 -mt-2">Failed to delete. Try again.</p>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-red-600 hover:bg-red-700 text-white border-0"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              Delete Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
