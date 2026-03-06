'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
import { getRelativeTime } from '@/utils/helpers';
import {
  CloudCog, CheckCircle, XCircle, Plus, MoreHorizontal, Pencil,
  Trash2, PowerOff, Power, RefreshCw, Activity,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Provider {
  id: string;
  name: string;
  kind: string;
  status: 'active' | 'disabled' | 'error';
  endpoint: string;
  default_model: string;
  api_key_masked: string;
  models_available: number;
  latency_ms: number | null;
  success_rate: number | null;
  last_checked_at: string;
}

interface ProviderForm {
  kind: string;
  api_key: string;
  endpoint: string;
  default_model: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_PROVIDERS: Provider[] = [
  {
    id: 'prov_openai_01',
    name: 'OpenAI',
    kind: 'openai',
    status: 'active',
    endpoint: 'https://api.openai.com/v1',
    default_model: 'gpt-4o',
    api_key_masked: 'sk-...f3a9',
    models_available: 12,
    latency_ms: 318,
    success_rate: 99.1,
    last_checked_at: new Date(Date.now() - 2 * 60_000).toISOString(),
  },
  {
    id: 'prov_anthropic_01',
    name: 'Anthropic',
    kind: 'anthropic',
    status: 'active',
    endpoint: 'https://api.anthropic.com',
    default_model: 'claude-sonnet-4-6',
    api_key_masked: 'sk-ant-...e7c2',
    models_available: 6,
    latency_ms: 274,
    success_rate: 99.8,
    last_checked_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    id: 'prov_deepseek_01',
    name: 'DeepSeek',
    kind: 'deepseek',
    status: 'active',
    endpoint: 'https://api.deepseek.com/v1',
    default_model: 'deepseek-chat',
    api_key_masked: 'sk-...8b41',
    models_available: 3,
    latency_ms: 412,
    success_rate: 97.2,
    last_checked_at: new Date(Date.now() - 11 * 60_000).toISOString(),
  },
  {
    id: 'prov_google_01',
    name: 'Google Gemini',
    kind: 'google',
    status: 'error',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta',
    default_model: 'gemini-1.5-pro',
    api_key_masked: 'AIza...c291',
    models_available: 5,
    latency_ms: null,
    success_rate: 84.3,
    last_checked_at: new Date(Date.now() - 48 * 60_000).toISOString(),
  },
  {
    id: 'prov_xai_01',
    name: 'xAI',
    kind: 'xai',
    status: 'disabled',
    endpoint: 'https://api.x.ai/v1',
    default_model: 'grok-2',
    api_key_masked: 'xai-...d04f',
    models_available: 2,
    latency_ms: null,
    success_rate: null,
    last_checked_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  },
];

// ─── Static Config ────────────────────────────────────────────────────────────

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'xai', label: 'xAI' },
  { value: 'local', label: 'Local (GGUF)' },
];

const PROVIDER_AVATAR: Record<string, { bg: string; text: string; initial: string }> = {
  openai:    { bg: 'bg-[#10a37f]',  text: 'text-white',       initial: 'O' },
  anthropic: { bg: 'bg-orange-100', text: 'text-orange-700',  initial: 'A' },
  deepseek:  { bg: 'bg-blue-100',   text: 'text-blue-700',    initial: 'D' },
  google:    { bg: 'bg-red-100',    text: 'text-red-700',     initial: 'G' },
  xai:       { bg: 'bg-gray-900',   text: 'text-white',       initial: 'X' },
  local:     { bg: 'bg-violet-100', text: 'text-violet-700',  initial: 'L' },
};

const EMPTY_FORM: ProviderForm = { kind: '', api_key: '', endpoint: '', default_model: '' };

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProviderAvatar({ kind }: { kind: string }) {
  const meta = PROVIDER_AVATAR[kind] ?? { bg: 'bg-gray-100', text: 'text-gray-600', initial: kind[0]?.toUpperCase() ?? '?' };
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold flex-shrink-0 ${meta.bg} ${meta.text}`}>
      {meta.initial}
    </span>
  );
}

function LatencyCell({ ms }: { ms: number | null }) {
  if (ms === null) return <span className="text-xs text-gray-300">—</span>;
  const cls = ms < 300 ? 'text-green-700' : ms < 600 ? 'text-yellow-700' : 'text-red-600';
  return <span className={`text-xs font-mono tabular-nums ${cls}`}>{ms}ms</span>;
}

function SuccessRateCell({ rate }: { rate: number | null }) {
  if (rate === null) return <span className="text-xs text-gray-300">—</span>;
  const cls = rate >= 98 ? 'text-green-700' : rate >= 90 ? 'text-yellow-700' : 'text-red-600';
  return <span className={`text-xs font-mono tabular-nums ${cls}`}>{rate.toFixed(1)}%</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ModelsProvidersPage() {
  const qc = useQueryClient();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Provider | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null);
  const [form, setForm] = useState<ProviderForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const { data: providers = [], isLoading, refetch } = useQuery<Provider[]>({
    queryKey: ['model-providers-v2'],
    queryFn: async () => {
      try { return await api.get<Provider[]>('/models/providers'); }
      catch { return MOCK_PROVIDERS; }
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

  // Helpers
  const openAdd = () => { setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setDialogOpen(true); };
  const openEdit = (p: Provider) => {
    setEditTarget(p);
    setForm({ kind: p.kind, api_key: '', endpoint: p.endpoint, default_model: p.default_model });
    setFormError('');
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditTarget(null); };

  const handleSubmit = () => {
    if (!form.kind) { setFormError('Select a provider.'); return; }
    if (!form.api_key && !editTarget) { setFormError('API key is required.'); return; }
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

  const STAT_CARDS = [
    { label: 'Active', value: counts.active, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Errors', value: counts.error, icon: XCircle, color: 'text-red-600' },
    { label: 'Models Available', value: counts.totalModels, icon: CloudCog, color: 'text-blue-600' },
    { label: 'Avg Latency', value: counts.avgLatency !== null ? `${counts.avgLatency}ms` : '—', icon: Activity, color: 'text-gray-500' },
  ];

  const isPending = addMutation.isPending || editMutation.isPending;

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Model Providers</h1>
            <p className="text-xs text-gray-500 mt-0.5">AI providers available for routing.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" /> Add Provider
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_CARDS.map((c) => (
            <Card key={c.label} className="border border-gray-200 shadow-none">
              <CardHeader className="px-4 pt-3 pb-0">
                <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-1">
                {isLoading
                  ? <Skeleton className="h-6 w-10" />
                  : <span className="text-base font-semibold text-gray-900 tabular-nums">{c.value}</span>}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Providers Table */}
        <Card className="border border-gray-200 shadow-none">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Provider', 'Status', 'Models', 'Latency', 'Success Rate', 'Last Checked', ''].map((col) => (
                  <TableHead
                    key={col}
                    className="text-xs font-medium text-gray-500 h-9 px-4 bg-gray-50 hover:bg-gray-50"
                  >
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j} className="px-4 py-3">
                        <Skeleton className="h-3.5 w-16" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : providers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-14">
                    <div className="flex flex-col items-center gap-2.5">
                      <CloudCog className="h-8 w-8 text-gray-200" />
                      <p className="text-xs text-gray-400">No providers configured.</p>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 mt-0.5" onClick={openAdd}>
                        <Plus className="h-3.5 w-3.5" /> Add Provider
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                providers.map((p) => (
                  <TableRow key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    {/* Provider */}
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div>
                          <p className="text-xs font-medium text-gray-900">{p.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                            {p.api_key_masked}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    {/* Status */}
                    <TableCell className="px-4 py-3">
                      <StatusBadge status={p.status === 'active' ? 'ACTIVE' : p.status === 'error' ? 'ERROR' : 'INACTIVE'} />
                    </TableCell>
                    {/* Models */}
                    <TableCell className="px-4 py-3 text-xs tabular-nums text-gray-700">
                      {p.models_available}
                    </TableCell>
                    {/* Latency */}
                    <TableCell className="px-4 py-3">
                      <LatencyCell ms={p.latency_ms} />
                    </TableCell>
                    {/* Success Rate */}
                    <TableCell className="px-4 py-3">
                      <SuccessRateCell rate={p.success_rate} />
                    </TableCell>
                    {/* Last Checked */}
                    <TableCell className="px-4 py-3 text-xs text-gray-400">
                      {getRelativeTime(p.last_checked_at)}
                    </TableCell>
                    {/* Actions */}
                    <TableCell className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem
                            className="text-xs gap-2 cursor-pointer"
                            onClick={() => openEdit(p)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-gray-400" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-xs gap-2 cursor-pointer"
                            onClick={() => toggleMutation.mutate({
                              id: p.id,
                              status: p.status === 'disabled' ? 'active' : 'disabled',
                            })}
                          >
                            {p.status === 'disabled'
                              ? <><Power className="h-3.5 w-3.5 text-gray-400" /> Enable</>
                              : <><PowerOff className="h-3.5 w-3.5 text-gray-400" /> Disable</>
                            }
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-xs gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                            onClick={() => setDeleteTarget(p)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* ── Add / Edit Dialog ─────────────────────────────────────────────────── */}
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
            {/* Provider select */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Provider</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}
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

            {/* API Key */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">
                API Key
                {editTarget && <span className="text-gray-400 font-normal ml-1">(leave blank to keep existing)</span>}
              </Label>
              <Input
                type="password"
                placeholder={editTarget ? '••••••••' : 'sk-...'}
                className="h-8 text-xs font-mono"
                value={form.api_key}
                onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
              />
            </div>

            {/* Endpoint */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">
                Endpoint
                <span className="text-gray-400 font-normal ml-1">(optional)</span>
              </Label>
              <Input
                placeholder="https://api.example.com/v1"
                className="h-8 text-xs font-mono"
                value={form.endpoint}
                onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
              />
            </div>

            {/* Default Model */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">
                Default Model
                <span className="text-gray-400 font-normal ml-1">(optional)</span>
              </Label>
              <Input
                placeholder="gpt-4o"
                className="h-8 text-xs font-mono"
                value={form.default_model}
                onChange={(e) => setForm((f) => ({ ...f, default_model: e.target.value }))}
              />
            </div>

            {formError && (
              <p className="text-xs text-red-600">{formError}</p>
            )}
            {(addMutation.isError || editMutation.isError) && (
              <p className="text-xs text-red-600">Failed to save. Try again.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              {editTarget ? 'Save Changes' : 'Add Provider'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ─────────────────────────────────────────────── */}
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
            <Button
              variant="outline" size="sm" className="h-8 text-xs"
              onClick={() => setDeleteTarget(null)}
            >
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
